// Minimal network-only service worker. Its presence (with a fetch handler) makes
// RevenueDesk installable as a PWA; it never caches, so the app always loads fresh.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {
  // Network-only by design: no respondWith, requests pass through untouched.
});
