// ==================== GESTION DU SPLASH SCREEN ====================
document.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('splashScreen');
    
    // Masquer après 2.5 secondes OU quand le contenu est chargé
    const hideSplash = () => {
        setTimeout(() => {
            splash.style.display = 'none';
        }, 2500);
    };
    
    // Si la page est déjà chargée
    if (document.readyState === 'complete') {
        hideSplash();
    } else {
        window.addEventListener('load', hideSplash);
    }
});

// ==================== FERMER LE BANNER OFFLINE ====================
function closeOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    banner.classList.remove('show');
}