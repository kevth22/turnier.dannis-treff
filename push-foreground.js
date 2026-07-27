import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getMessaging, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",
  authDomain: "dannistreffturnier.firebaseapp.com",
  projectId: "dannistreffturnier",
  storageBucket: "dannistreffturnier.firebasestorage.app",
  messagingSenderId: "829873084116",
  appId: "1:829873084116:web:683bbf1ea3e58f1a4ecd41"
};

const DEDUPE_PREFIX = "dart11enForegroundPush:";
const DEDUPE_MS = 15000;

function notificationData(payload) {
  return {
    title: payload?.notification?.title || payload?.data?.title || "Dart11en",
    body: payload?.notification?.body || payload?.data?.body || "Neue Mitteilung",
    icon: payload?.notification?.icon || payload?.data?.icon || "./icon-192.png",
    badge: payload?.notification?.badge || payload?.data?.badge || "./icon-192.png",
    tag: payload?.data?.tag || `dart11en-${Date.now()}`,
    url: payload?.data?.url || "./index.html"
  };
}

function claimNotification(tag) {
  const key = `${DEDUPE_PREFIX}${tag}`;
  const now = Date.now();

  try {
    const previous = Number(localStorage.getItem(key) || 0);
    if (now - previous < DEDUPE_MS) return false;
    localStorage.setItem(key, String(now));

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const storedKey = localStorage.key(index);
      if (!storedKey?.startsWith(DEDUPE_PREFIX)) continue;
      const storedAt = Number(localStorage.getItem(storedKey) || 0);
      if (now - storedAt > 60000) localStorage.removeItem(storedKey);
    }
  } catch {
    // Ohne LocalStorage bleibt die Benachrichtigung trotzdem funktionsfähig.
  }

  return true;
}

async function startForegroundPush() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!(await isSupported())) return;

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  onMessage(messaging, async payload => {
    const notification = notificationData(payload);
    if (!claimNotification(notification.tag)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.title, {
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        tag: notification.tag,
        data: { url: notification.url }
      });
    } catch (error) {
      console.warn("Vordergrund-Push konnte nicht angezeigt werden:", error);
    }
  });
}

startForegroundPush().catch(error => {
  console.warn("Vordergrund-Push konnte nicht gestartet werden:", error);
});
