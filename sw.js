const CACHE_NAME = 'alveoli-cache-v1.1.1'; // <-- bump this every release. v1 was v1, now v2
const urlsToCache = [
  "/",
  "/index.html",
  "/dash.html",
  "/teach.html",
  "/register.html",
  "/main.js",
  "/dashB.css",
  "/loading.css",
  "/manifest.json",
  "/A_20260714_180909_0000 (1).png",
  "/IMG_20260714_194104.png",
  "/alv_logo"
];

// 1. INSTALL: cache new files and take over immediately
self.addEventListener('install', event => {
  self.skipWaiting(); // force new SW to activate right away
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 2. ACTIVATE: delete old caches
self.addEventListener('activate', event => {
  self.clients.claim(); // take control of all open tabs
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // delete v1 cache
          }
        })
      );
    })
  );
});

// 3. FETCH: serve from cache, but always check network first for html/js
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If we have it in cache, return it. But also fetch new version in background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
        return response || fetchPromise;
      })
  );
});
