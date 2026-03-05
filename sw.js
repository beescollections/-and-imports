const CACHE_NAME = 'bees-store-v2'; // Bumped version
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './background.jpg' // Added your background image to the cache
];

// Install the service worker
self.addEventListener('install', event => {
  // Skip waiting forces the waiting service worker to become the active service worker.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Activate event: Delete old caches when a new version is installed
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim clients so the new SW takes control immediately
  self.clients.claim();
});

// Fetch event: Network First Strategy (Fixes the cache bug!)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If the network request is successful, update the cache with the fresh file
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If the network fails (offline), fall back to the cache
        return caches.match(event.request);
      })
  );
});
