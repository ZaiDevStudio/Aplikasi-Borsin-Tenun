const CACHE_NAME = 'borsin-v5'; // Naikkkan versi setiap update (v4 ke v5)

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Memaksa versi baru langsung aktif
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => 
      cache.addAll([
        './dashboard.html', 
        './manifest.json', 
        './borsin.png'
      ])
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
