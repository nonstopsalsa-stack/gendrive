/**
 * Gendrive Mobile Lite - Service Worker
 * Offline Cache & High-Speed Launch Engine (v1.5.1)
 */

const CACHE_NAME = 'gendrive-lite-v151';
const ASSETS_TO_CACHE = [
  './mobile.html',
  './mobile.css?v=20260906_v151',
  './mobile.js?v=20260906_v151',
  './js/config.js?v=20260906_v151',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Google Apps Script API calls should bypass cache
  if (event.request.url.includes('script.google.com') || event.request.url.includes('google.com')) {
    return;
  }

  // Network First with Cache Fallback strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});