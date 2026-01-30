(function() {
    function removeSplashScreen() {
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            splashScreen.style.animation = 'splashFadeOut 0.6s ease forwards';
            setTimeout(() => {
                splashScreen.remove();
                document.body.style.overflow = '';
                document.body.style.display = '';
                document.body.style.alignItems = '';
                document.body.style.justifyContent = '';
            }, 600);
        }
    }
    function hideSplashImmediately() {
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            splashScreen.remove();
        }
        document.body.style.overflow = '';
    }
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (hasSeenSplash) {
                hideSplashImmediately();
            } else {
                setTimeout(() => {
                    removeSplashScreen();
                    sessionStorage.setItem('hasSeenSplash', 'true');
                }, 3500);
            }
        });
    } else {
        if (hasSeenSplash) {
            hideSplashImmediately();
        } else {
            setTimeout(() => {
                removeSplashScreen();
                sessionStorage.setItem('hasSeenSplash', 'true');
            }, 3500);
        }
    }
})();

// Dans loading.js ou un fichier séparé
function updateOfflineIndicator() {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) return;
    
    if (!navigator.onLine) {
        indicator.style.display = 'block';
        indicator.textContent = '📡 Mode Offline - Données en cache';
    } else {
        indicator.style.display = 'none';
    }
}

window.addEventListener('online', updateOfflineIndicator);
window.addEventListener('offline', updateOfflineIndicator);
document.addEventListener('DOMContentLoaded', updateOfflineIndicator);