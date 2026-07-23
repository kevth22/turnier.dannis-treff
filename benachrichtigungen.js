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
const TIMEOUT_MS = 15000;

const $ = id => document.getElementById(id);
const user = getLogin();

let messaging = null;
let serviceWorkerRegistration = null;

function withTimeout(promise, message, timeout = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    })
  ]);
}

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

function resetEnableButton() {
  const button = $("enablePushButton");
  button.disabled = false;
  button.textContent = "Benachrichtigungen aktivieren";
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

  await withTimeout(
    setDoc(doc(db, "pushAbos", docId), {
      token,
      benutzername: user.benutzername,
      nickname: user.nickname || user.benutzername,
      rolle: String(user.rolle || "gast").toLowerCase(),
      aktiv: true,
      userAgent: navigator.userAgent,
      aktualisiertAm: serverTimestamp()
    }, { merge: true }),
    "FIRESTORE_TIMEOUT"
  );

  localStorage.setItem(TOKEN_DOC_STORAGE_KEY, docId);
}

async function getReadyServiceWorker() {
  const registration = await withTimeout(
    navigator.serviceWorker.register("./sw.js?v=6"),
    "SERVICE_WORKER_REGISTER_TIMEOUT"
  );

  await withTimeout(
    navigator.serviceWorker.ready,
    "SERVICE_WORKER_READY_TIMEOUT"
  );

  return registration;
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

  try {
    serviceWorkerRegistration = await getReadyServiceWorker();
    messaging = getMessaging();
  } catch (error) {
    console.error(error);
    setStatus("Service Worker fehlerhaft");
    showMessage("Die App-Aktualisierung wurde noch nicht vollständig geladen. Schließe Dart11en komplett und öffne sie erneut.");
    return;
  }

  if (Notification.permission === "granted") {
    try {
      const token = await withTimeout(
        getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration
        }),
        "FCM_TOKEN_TIMEOUT"
      );

      if (token) {
        await savePushToken(token);
        setStatus("Aktiv");
        setButtons(true);
        return;
      }
    } catch (error) {
      console.error(error);
      setStatus("Einrichtung unvollständig");
      showMessage(errorToMessage(error));
      return;
    }
  }

  if (Notification.permission === "denied") {
    setStatus("Blockiert");
    $("enablePushButton").disabled = true;
    showMessage("Benachrichtigungen sind in den iPhone-Einstellungen blockiert.");
    return;
  }

  setStatus("Nicht aktiviert");
  setButtons(false);
}

async function enablePush() {
  const button = $("enablePushButton");
  button.disabled = true;
  button.textContent = "Wird aktiviert …";
  $("pushMessage").hidden = true;

  try {
    const permission = await withTimeout(
      Notification.requestPermission(),
      "PERMISSION_TIMEOUT"
    );

    if (permission !== "granted") {
      setStatus(permission === "denied" ? "Abgelehnt" : "Nicht aktiviert");
      showMessage("Ohne Zustimmung können keine Push-Benachrichtigungen gesendet werden.");
      return;
    }

    serviceWorkerRegistration = serviceWorkerRegistration || await getReadyServiceWorker();
    messaging = messaging || getMessaging();

    const token = await withTimeout(
      getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration
      }),
      "FCM_TOKEN_TIMEOUT"
    );

    if (!token) throw new Error("NO_TOKEN");

    await savePushToken(token);

    setStatus("Aktiv");
    setButtons(true);
    showMessage("Push-Benachrichtigungen wurden aktiviert.", true);
  } catch (error) {
    console.error(error);
    setStatus("Fehler");
    showMessage(errorToMessage(error));
  } finally {
    resetEnableButton();
  }
}

function errorToMessage(error) {
  const code = String(error?.message || error || "");

  if (code.includes("SERVICE_WORKER")) {
    return "Der Service Worker konnte nicht gestartet werden. Schließe die App komplett und öffne sie erneut.";
  }

  if (code.includes("FCM_TOKEN")) {
    return "Firebase konnte innerhalb von 15 Sekunden kein Push-Gerät registrieren. Prüfe anschließend die FCM Registration API.";
  }

  if (code.includes("FIRESTORE")) {
    return "Das Gerät wurde erkannt, aber Firestore blockiert das Speichern. Die Regeln für „pushAbos“ müssen ergänzt werden.";
  }

  if (code.includes("PERMISSION")) {
    return "Die iPhone-Abfrage für Benachrichtigungen wurde nicht abgeschlossen.";
  }

  return "Push konnte nicht aktiviert werden. Öffne die App erneut und versuche es noch einmal.";
}

async function disablePush() {
  $("disablePushButton").disabled = true;

  try {
    if (messaging) await deleteToken(messaging);

    const docId = localStorage.getItem(TOKEN_DOC_STORAGE_KEY);

    if (docId) {
      await deleteDoc(doc(db, "pushAbos", docId));
    }

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
    serviceWorkerRegistration = serviceWorkerRegistration || await getReadyServiceWorker();

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
  showMessage(errorToMessage(error));
  resetEnableButton();
});
