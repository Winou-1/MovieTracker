// install-guard.js - Système de garde PWA et Auth obligatoire (VERSION NON-BLOQUANTE)

let deferredPrompt = null;

// ✅ DÉTECTER SI ON EST SUR PC OU MOBILE
function isDesktop() {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isSmallScreen = window.innerWidth <= 1024;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return !isMobileUA && (!isTouchDevice || !isSmallScreen);
}

// Vérifier si l'app est installée
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
}

// Vérifier si l'utilisateur est connecté
function isUserAuthenticated() {
    return !!localStorage.getItem('token');
}

// ⚠️ FONCTION LÉGÈRE : Juste vérifier et logger, ne pas bloquer
function initPWAGuard() {
    const isInstalled = isPWAInstalled();
    const isAuthenticated = isUserAuthenticated();
    const desktop = isDesktop();

    console.log('🖥️ Desktop:', desktop);
    console.log('📱 PWA Installée:', isInstalled);
    console.log('👤 Authentifié:', isAuthenticated);

    // Sur PC : Ne rien faire, laisser l'app se charger normalement
    if (desktop) {
        console.log('💻 Mode PC - Pas de garde PWA');
        // L'authentification sera gérée par main.js
        return;
    }

    // Sur Mobile : Vérifier l'installation uniquement
    if (!isInstalled) {
        console.log('📱 Mobile non installé - Affichage écran installation');
        showInstallScreen();
        return;
    }

    console.log('✅ Mobile installé - App chargée normalement');
    // L'authentification sera gérée par main.js
}

// Afficher l'écran d'installation PWA (SEULEMENT sur mobile non installé)
function showInstallScreen() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showInstallScreen);
        return;
    }

    // Masquer tout le contenu existant
    const body = document.body;
    body.innerHTML = '';
    
    const installScreen = document.createElement('div');
    installScreen.id = 'pwa-install-screen';
    installScreen.innerHTML = `
        <style>
            #pwa-install-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                z-index: 999999;
            }
            .install-card {
                background: white;
                border-radius: 24px;
                padding: 48px 32px;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.5s ease;
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .install-logo {
                font-size: 64px;
                margin-bottom: 16px;
            }
            .install-title {
                font-size: 32px;
                font-weight: 800;
                color: #1a202c;
                margin-bottom: 8px;
            }
            .install-subtitle {
                font-size: 16px;
                color: #718096;
                margin-bottom: 32px;
            }
            .install-features {
                display: flex;
                flex-direction: column;
                gap: 16px;
                margin-bottom: 32px;
            }
            .install-feature {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 15px;
                color: #4a5568;
                padding: 12px 16px;
                background: #f7fafc;
                border-radius: 12px;
            }
            .feature-icon {
                font-size: 24px;
            }
            .install-button {
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
                margin-bottom: 16px;
            }
            .install-button:hover {
                transform: translateY(-2px);
            }
            .install-requirement {
                font-size: 13px;
                color: #a0aec0;
                font-style: italic;
            }
            .install-instructions {
                margin-top: 20px;
                padding: 16px;
                background: #edf2f7;
                border-radius: 12px;
                text-align: left;
                font-size: 14px;
                color: #4a5568;
                display: none;
            }
            .install-instructions.show {
                display: block;
            }
        </style>
        
        <div class="install-card">
            <div class="install-logo">🎬</div>
            <h1 class="install-title">CineTrack</h1>
            <p class="install-subtitle">Ton journal de films personnalisé</p>
            
            <div class="install-features">
                <div class="install-feature">
                    <span class="feature-icon">📱</span>
                    <span>Accès hors ligne</span>
                </div>
                <div class="install-feature">
                    <span class="feature-icon">⚡</span>
                    <span>Rapide et fluide</span>
                </div>
                <div class="install-feature">
                    <span class="feature-icon">🔔</span>
                    <span>Notifications</span>
                </div>
            </div>

            <button class="install-button" onclick="window.triggerPWAInstall()">
                📲 Installer l'application
            </button>

            <p class="install-requirement">
                Installation requise pour continuer sur mobile
            </p>

            <div class="install-instructions" id="installInstructions">
                <h4>Instructions d'installation :</h4>
                <ul>
                    <li><strong>Chrome/Edge :</strong> Menu (⋮) → Installer l'application</li>
                    <li><strong>Safari iOS :</strong> Partager → Sur l'écran d'accueil</li>
                    <li><strong>Firefox :</strong> Menu → Installer</li>
                </ul>
            </div>
        </div>
    `;
    
    body.appendChild(installScreen);
}

// Déclencher l'installation PWA
window.triggerPWAInstall = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('✅ Installation acceptée');
            deferredPrompt = null;
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    } else {
        const instructions = document.getElementById('installInstructions');
        if (instructions) {
            instructions.classList.add('show');
        }
    }
};

// Capturer l'événement d'installation PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('📲 beforeinstallprompt déclenché');
});

// Détecter après installation
window.addEventListener('appinstalled', () => {
    console.log('✅ App installée avec succès');
    setTimeout(() => {
        window.location.reload();
    }, 500);
});

// ⚠️ IMPORTANT : S'exécuter IMMÉDIATEMENT (avant DOMContentLoaded)
// Pour bloquer l'affichage sur mobile non installé
(function() {
    // Vérification ultra-rapide au chargement du script
    const desktop = isDesktop();
    const installed = isPWAInstalled();
    
    console.log('🚀 Init rapide - Desktop:', desktop, 'Installed:', installed);
    
    // Si mobile ET non installé : bloquer immédiatement
    if (!desktop && !installed) {
        console.log('🛑 Blocage mobile non installé');
        // Injecter un style pour masquer le body en attendant
        const style = document.createElement('style');
        style.textContent = 'body { opacity: 0; }';
        document.head.appendChild(style);
        
        // Afficher l'écran d'installation dès que possible
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                showInstallScreen();
            });
        } else {
            showInstallScreen();
        }
    } else {
        // Laisser l'app se charger normalement
        console.log('✅ Chargement normal de l\'app');
    }
})();

// Note : Plus besoin de DOMContentLoaded car la logique est dans l'IIFE ci-dessus