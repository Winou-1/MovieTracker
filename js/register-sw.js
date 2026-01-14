// register-sw.js - Enregistrement du Service Worker

// Enregistrer le Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        registerServiceWorker();
    });
}

async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });

        console.log('✓ Service Worker enregistré:', registration.scope);

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Nouvelle version disponible
                    showUpdateNotification();
                }
            });
        });

        // Vérifier les mises à jour périodiquement
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000); // Toutes les heures

    } catch (error) {
        console.error('✗ Erreur Service Worker:', error);
    }
}

// Afficher une notification de mise à jour
function showUpdateNotification() {
    const updateBanner = document.createElement('div');
    updateBanner.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 16px;
        animation: slideUp 0.4s ease;
        max-width: 90%;
        width: auto;
    `;

    updateBanner.innerHTML = `
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">
                ⚡ Mise à jour disponible
            </div>
            <div style="font-size: 13px; opacity: 0.9;">
                Recharger pour profiter des nouveautés
            </div>
        </div>
        <button 
            onclick="reloadApp()" 
            style="
                background: white;
                color: #667eea;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                font-size: 14px;
            ">
            Recharger
        </button>
    `;

    document.body.appendChild(updateBanner);

    // Animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from { 
                opacity: 0; 
                transform: translate(-50%, 20px); 
            }
            to { 
                opacity: 1; 
                transform: translate(-50%, 0); 
            }
        }
    `;
    document.head.appendChild(style);
}

// Recharger l'application
window.reloadApp = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration && registration.waiting) {
                // Demander au nouveau SW de prendre le contrôle
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }
    
    // Recharger la page
    window.location.reload();
};

// Vider le cache manuellement (pour debugging)
window.clearAppCache = async function() {
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
            registration.active.postMessage({ type: 'CLEAR_CACHE' });
        }
    }
    
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
    }
    
    console.log('✓ Cache vidé');
    window.location.reload();
};