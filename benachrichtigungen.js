import { getLogin, db } from "./auth-utils.js";

import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const VAPID_KEY = "BHFx79BbOtY791xPJ1Q9xOWh9vJQxwF_Opmc33zkYfpl6WINJslHVoVqTDvOBwXqGi9268J1B-i7cYjjJQdtUoQ";
const TOKEN_DOC_STORAGE_KEY = "dart11enPushTokenDokument";

const $ = id => document.getElementById(id);
const user = getLogin();
let messaging = null;
let serviceWorkerRegistration = null;

function showMessage(text, success = false) {
  const box = $("pushMessage");
  box.textContent = text;
  box.className = `konto-meldung ${success ? "erfolg" : "fehler"}`;
  box.hidden = false;
}

function setStatus(text) {
  $("pushStatus").textContent = text;
}

function setButtons(enabled) {
  $("enablePushButton").hidden = enabled;
  $("testPushButton").hidden = !enabled;
  $("disablePushButton").hidden = !enabled;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

async function tokenDocumentId(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function savePushToken(token) {
  const docId = await tokenDocumentId(token);

  await setDoc(doc(db, "pushAbos", docId), {
    token,
    benutzername: user.benutzername,
    nickname: user.nickname || user.benutzername,
    rolle: String(user.rolle || "gast").toLowerCase(),
    aktiv: true,
    userAgent: navigator.userAgent,
    aktualisiertAm: serverTimestamp()
  }, { merge: true });

  localStorage.setItem(TOKEN_DOC_STORAGE_KEY, docId);
}

async function initialisePush() {
  if (!user) {
    $("loginRequired").hidden = false;
    return;
  }

  if (String(user.rolle || "gast").toLowerCase() === "gast") {
    $("guestBlocked").hidden = false;
    return;
  }

  $("pushPanel").hidden = false;

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    setStatus("Nicht unterstützt");
    $("enablePushButton").disabled = true;
    return;
  }

  if (!(await isSupported())) {
    setStatus("Nicht unterstützt");
    $("enablePushButton").disabled = true;
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !isStandalone()) {
    setStatus("App zuerst installieren");
    showMessage("Öffne Safari, tippe auf Teilen und dann auf „Zum Home-Bildschirm“.");
    $("enablePushButton").disabled = true;
    return;
  }

  serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js");
  await navigator.serviceWorker.ready;
  messaging = getMessaging();

  if (Notification.permission === "granted") {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration
    });

    if (token) {
      await savePushToken(token);
      setStatus("Aktiv");
      setButtons(true);
      return;
    }
  }

  if (Notification.permission === "denied") {
    setStatus("Blockiert");
    $("enablePushButton").disabled = true;
    showMessage("Benachrichtigungen sind in den Geräteeinstellungen blockiert.");
    return;
  }

  setStatus("Nicht aktiviert");
  setButtons(false);
}

async function enablePush() {
  $("enablePushButton").disabled = true;
  $("enablePushButton").textContent = "Wird aktiviert …";
  $("pushMessage").hidden = true;

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus("Nicht aktiviert");
      showMessage("Ohne Zustimmung können keine Push-Benachrichtigungen gesendet werden.");
      return;
    }

    serviceWorkerRegistration = serviceWorkerRegistration
      || await navigator.serviceWorker.register("./sw.js");

    await navigator.serviceWorker.ready;
    messaging = messaging || getMessaging();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration
    });

    if (!token) throw new Error("NO_TOKEN");

    await savePushToken(token);
    setStatus("Aktiv");
    setButtons(true);
    showMessage("Push-Benachrichtigungen wurden aktiviert.", true);
  } catch (error) {
    console.error(error);
    setStatus("Fehler");
    showMessage("Push konnte nicht aktiviert werden. Möglicherweise fehlen Firestore-Berechtigungen.");
  } finally {
    $("enablePushButton").disabled = false;
    $("enablePushButton").textContent = "Benachrichtigungen aktivieren";
  }
}

async function disablePush() {
  $("disablePushButton").disabled = true;

  try {
    if (messaging) await deleteToken(messaging);

    const docId = localStorage.getItem(TOKEN_DOC_STORAGE_KEY);
    if (docId) await deleteDoc(doc(db, "pushAbos", docId));

    localStorage.removeItem(TOKEN_DOC_STORAGE_KEY);
    setStatus("Deaktiviert");
    setButtons(false);
    showMessage("Push-Benachrichtigungen wurden deaktiviert.", true);
  } catch (error) {
    console.error(error);
    showMessage("Push konnte nicht vollständig deaktiviert werden.");
  } finally {
    $("disablePushButton").disabled = false;
  }
}

async function showTestNotification() {
  try {
    serviceWorkerRegistration = serviceWorkerRegistration
      || await navigator.serviceWorker.ready;

    await serviceWorkerRegistration.showNotification("Dart11en Test", {
      body: "Push-Benachrichtigungen funktionieren auf diesem Gerät.",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "dart11en-test",
      data: { url: "./benachrichtigungen.html" }
    });
  } catch (error) {
    console.error(error);
    showMessage("Die Testbenachrichtigung konnte nicht angezeigt werden.");
  }
}

$("enablePushButton")?.addEventListener("click", enablePush);
$("disablePushButton")?.addEventListener("click", disablePush);
$("testPushButton")?.addEventListener("click", showTestNotification);

initialisePush().catch(error => {
  console.error(error);
  setStatus("Fehler");
  showMessage("Die Push-Einstellungen konnten nicht geladen werden.");
});
