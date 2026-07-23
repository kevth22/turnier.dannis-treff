importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",
  authDomain: "dannistreffturnier.firebaseapp.com",
  projectId: "dannistreffturnier",
  storageBucket: "dannistreffturnier.firebasestorage.app",
  messagingSenderId: "829873084116",
  appId: "1:829873084116:web:683bbf1ea3e58f1a4ecd41"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || payload.data?.title || "Dart11en";
  const options = {
    body: payload.notification?.body || payload.data?.body || "Neue Mitteilung",
    icon: payload.notification?.icon || payload.data?.icon || "./icon-192.png",
    badge: "./icon-192.png",
    tag: payload.data?.tag || "dart11en-push",
    data: {
      url: payload.data?.url || "./index.html"
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./index.html", self.location.href).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

const VERSION = "dart11en-v1-5-0";
const APP_SHELL = [
  "turnier-theme.css",
  "turnier-theme.js",
  "./", "./index.html", "./style.css", "./konto.css", "./konto-admin.css",
  "./benachrichtigungen.html", "./benachrichtigungen.js", "./benachrichtigungen.css",
  "./pwa.js", "./manifest.json",
  "./login.html", "./login.js", "./auth-utils.js", "./account-ui.js",
  "./registrieren.html", "./registrieren.js", "./konto-admin.html", "./konto-admin.js",
  "./turniere.html", "./turnier-live.html", "./turnier-live-v3.css",
  "./turnier-tv-fit.css", "./turnier-tv-fit.js",
  "./gruppen-turnier-v3.css", "./gruppen-turnier-v3.js",
  "./turnier-live-v3.js", "./turnier-v3-manager.js",
  "./liga.html", "./kalender.html", "./kader.html", "./spieltag-center.html",
  "./dart11enlogo.png", "./icon-192.png", "./icon-512.png", "./offline.html"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.url.includes("firestore.googleapis.com")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./offline.html");
        return Response.error();
      })
  );
});
