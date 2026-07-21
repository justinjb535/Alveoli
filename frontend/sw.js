const CACHE_NAME = "alveoli-v1";
const FILES_TO_CACHE = [
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

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
