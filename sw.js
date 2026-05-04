const CACHE = 'logistica-leno-v1';
const ASSETS = ['./index.html', './icon.svg', './manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

// Network first, fallback to cache
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok && e.request.url.includes(self.location.origin)) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

// Push notifications (para futuro)
self.addEventListener('push', e => {
    const data = e.data?.json() || { title: '🚚 Logística', body: 'Nueva actualización' };
    e.waitUntil(self.registration.showNotification(data.title, {
        body: data.body,
        icon: './icon.svg',
        badge: './icon.svg',
        tag: 'logistica',
        renotify: true
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.openWindow('./'));
});
