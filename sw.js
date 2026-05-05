const CACHE = 'logistica-leno-v2';
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
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

// ── Push notifications (app cerrada) ──────────────────────────
self.addEventListener('push', e => {
    let data = { title: '🚚 Logística Leno', body: 'Nueva actualización' };
    try { data = e.data?.json() || data; } catch {}

    e.waitUntil(self.registration.showNotification(data.title, {
        body: data.body,
        icon: './icon.svg',
        badge: './icon.svg',
        tag: 'logistica-push',
        renotify: true,
        vibrate: [150, 80, 150]
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            const existing = list.find(c => c.url.includes('logistica-leno'));
            if (existing) return existing.focus();
            return clients.openWindow('./');
        })
    );
});
