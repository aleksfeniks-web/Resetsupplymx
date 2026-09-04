const CACHE_NAME = 'visor-cliente-v1';
const ASSETS_TO_CACHE = [
  '/visor',
  '/visor-cliente.html',
  '/manifest-visor.json',
  '/favicon.png',
  '/logoresetsupply.png',
  '/assets/hero_products_1786422334033.jpg',
  '/assets/car_detailing_1786422343111.jpg',
  '/assets/product_alumax_1786422408768.jpg',
  '/assets/product_cera_1786422436985.jpg',
  '/assets/product_plasticos_1786422427894.jpg',
  '/assets/product_vsc_1786422417603.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Algunos recursos no pudieron precachearse:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar endpoints de API ni SSE
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/visor');
        }
      });
    })
  );
});
