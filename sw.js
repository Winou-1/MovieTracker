// sw.js - Service Worker pour CineTrack PWA

const CACHE_NAME = 'cinetrack-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/header.css',
    '/css/buttons.css',
    '/css/swiper.css',
    '/css/movies.css',
    '/css/profile.css',
    '/css/modals.css',
    '/css/filters.css',
    '/css/mobile.css',
    '/css/modal-movie.css',
    '/js/config.js',
    '/js/install-guard.js',
    '/js/forgot-password.js',
    '/js/auth.js',
    '/js/ui.js',
    '/js/swiper.js',
    '/js/movies.js',
    '/js/profile.js',
    '/js/main.js',
    '/js/modal-movie.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installation...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cache ouvert');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] Tous les assets sont en cache');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Erreur lors de la mise en cache:', error);
            })
    );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activation...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Service Worker activé');
            return self.clients.claim();
        })
    );
});

// Stratégie de récupération des ressources
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Stratégie différente selon le type de ressource
    
    // 1. API calls : Network First
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 2. Images TMDB : Cache First
    if (url.hostname === 'image.tmdb.org') {
        event.respondWith(cacheFirst(request));
        return;
    }

    // 3. API TMDB : Network First avec cache fallback
    if (url.hostname === 'api.themoviedb.org') {
        event.respondWith(networkFirst(request));
        return;
    }

    // 4. Assets locaux : Cache First avec network fallback
    event.respondWith(cacheFirst(request));
});

// Stratégie Cache First (pour assets statiques et images)
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        
        // Mettre en cache si la requête réussit
        if (response && response.status === 200) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('[SW] Erreur fetch:', error);
        
        // Retourner une page offline si disponible
        const offlinePage = await cache.match('/offline.html');
        if (offlinePage) {
            return offlinePage;
        }
        
        throw error;
    }
}

// Stratégie Network First (pour API)
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        
        // Mettre en cache pour usage offline
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('[SW] Network error, trying cache:', error);
        
        // Fallback sur le cache si network fail
        const cached = await caches.match(request);
        
        if (cached) {
            return cached;
        }
        
        throw error;
    }
}

// Écouter les messages du client
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('[SW] Cache vidé');
        });
    }
});

// Synchronisation en arrière-plan (pour future implémentation)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-ratings') {
        event.waitUntil(syncRatings());
    }
});

async function syncRatings() {
    // Future implémentation : synchroniser les notations offline
    console.log('[SW] Synchronisation des notations...');
}

// Notifications push (pour future implémentation)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Nouvelle notification',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
        self.registration.showNotification('CineTrack', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});