const VERSION = 'dart11en-v1-2-0';
const APP_SHELL = [
  "turnier-theme.css",
  "turnier-theme.js",
  './', './index.html', './style.css', './pwa.js', './manifest.json',
  './turniere.html', './turnier-live.html', './turnier-live-v3.css',
  './turnier-tv-fit.css', './turnier-tv-fit.js',
  './gruppen-turnier-v3.css', './gruppen-turnier-v3.js',
  './turnier-live-v3.js', './turnier-v3-manager.js',
  './liga.html', './kalender.html', './kader.html', './spieltag-center.html',
  './dart11enlogo.png', './icon-192.png', './icon-512.png', './offline.html'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('firestore.googleapis.com')) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(VERSION).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return caches.match('./offline.html');
    return Response.error();
  }));
});
