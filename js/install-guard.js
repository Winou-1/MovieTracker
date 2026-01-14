// install-guard.js - Système de garde PWA et Auth obligatoire

let deferredPrompt = null;

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

// Initialiser le garde PWA
function initPWAGuard() {
    const isInstalled = isPWAInstalled();
    const isAuthenticated = isUserAuthenticated();

    console.log('PWA Installée:', isInstalled);
    console.log('Utilisateur authentifié:', isAuthenticated);

    // Si pas installée, afficher l'écran d'installation
    if (!isInstalled) {
        showInstallScreen();
        return;
    }

    // Si installée mais pas authentifié, forcer l'authentification
    if (!isAuthenticated) {
        forceAuthentication();
        return;
    }

    // Sinon, laisser accès à l'app normale
    showMainApp();
}

// Afficher l'écran d'installation PWA
function showInstallScreen() {
    // Masquer tout le contenu existant
    document.body.innerHTML = '';
    
    const installScreen = document.createElement('div');
    installScreen.id = 'pwa-install-screen';
    installScreen.innerHTML = `
        <style>
            #pwa-install-screen {
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
                fontSize: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
                margin-bottom: 16px;
            }
            .install-button:hover {
                transform: translateY(-2px);
            }
            .install-button:active {
                transform: translateY(0);
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
            .install-instructions h4 {
                margin-bottom: 12px;
                color: #2d3748;
            }
            .install-instructions ul {
                margin-left: 20px;
            }
            .install-instructions li {
                margin-bottom: 8px;
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

            <button class="install-button" onclick="triggerInstall()">
                📲 Installer l'application
            </button>

            <p class="install-requirement">
                Installation requise pour continuer
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
    
    document.body.appendChild(installScreen);
}

// Déclencher l'installation PWA
window.triggerInstall = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('Installation acceptée');
            deferredPrompt = null;
            // Attendre un peu puis recharger
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    } else {
        // Afficher les instructions manuelles
        document.getElementById('installInstructions').classList.add('show');
    }
};

// Forcer l'authentification
function forceAuthentication() {
    // Masquer le contenu principal
    const mainContent = document.querySelector('main');
    const header = document.querySelector('header');
    const mobileNav = document.querySelector('.mobile-nav');
    
    if (mainContent) mainContent.style.display = 'none';
    if (header) header.style.display = 'none';
    if (mobileNav) mobileNav.style.display = 'none';
    
    // Ouvrir le modal d'authentification en mode forcé
    setTimeout(() => {
        openAuthModal(true);
        
        // Empêcher la fermeture du modal
        const closeBtn = document.getElementById('closeAuthModal');
        if (closeBtn) {
            closeBtn.style.display = 'none';
        }
        
        // Empêcher la fermeture par clic extérieur
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.onclick = (e) => {
                e.stopPropagation();
            };
        }
    }, 100);
}

// Afficher l'app principale
function showMainApp() {
    const mainContent = document.querySelector('main');
    const header = document.querySelector('header');
    const mobileNav = document.querySelector('.mobile-nav');
    
    if (mainContent) mainContent.style.display = 'block';
    if (header) header.style.display = 'block';
    if (mobileNav) mobileNav.style.display = 'flex';
}

// Capturer l'événement d'installation PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('beforeinstallprompt déclenché');
});

// Détecter après installation
window.addEventListener('appinstalled', () => {
    console.log('App installée');
    setTimeout(() => {
        window.location.reload();
    }, 500);
});

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    initPWAGuard();
});

// Vérifier périodiquement l'authentification
setInterval(() => {
    if (isPWAInstalled() && !isUserAuthenticated()) {
        forceAuthentication();
    }
}, 5000);