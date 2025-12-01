const CACHE_NAME = 'siborsin-FORCE-UPDATE-v500'; // Versi saya naikkan drastis
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './dashboard.html',
  './tambah_karyawan.html',
  './data_karyawan.html',
  './tambah_data_ulos.html',
  './ulos.html',
  './tambah_pesanan.html',
  './pesanan.html',
  './tambah_terjual.html',
  './riwayat_terjual.html',
  './hitung_gaji.html',
  './rekapan_gaji.html',
  './slip_gaji.html',
  './tambah_bukti.html',
  './bukti_pembayaran.html',
  './tentang.html',
  './borsin.png',
  './manifest.json',
  // Library Eksternal
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Paksa install baru
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)) // Coba internet dulu, baru cache
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Ambil alih halaman segera
});
