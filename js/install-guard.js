let deferredPrompt = null;
function isMobile() {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    return mobileKeywords.some(keyword => userAgent.includes(keyword)); 
}

function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') 
           || true;
}

// Afficher l'écran d'installation
function showInstallScreen() {
    const installOverlay = document.createElement('div');
    installOverlay.id = 'pwa-install-overlay';
    installOverlay.innerHTML = `
        <style>
            #pwa-install-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .install-card {
                background: white;
                border-radius: 24px;
                padding: 40px 28px;
                max-width: 380px;
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
                font-size: 72px;
                margin-bottom: 16px;
                animation: bounce 2s infinite;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
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
                line-height: 1.5;
            }
            
            .install-features {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 32px;
                text-align: left;
            }
            
            .install-feature {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 15px;
                color: #4a5568;
                padding: 12px;
                background: #f7fafc;
                border-radius: 12px;
            }
            
            .feature-icon {
                font-size: 24px;
                flex-shrink: 0;
            }
            
            .install-button {
                width: 100%;
                padding: 18px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 14px;
                font-size: 17px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .install-button:active {
                transform: scale(0.98);
                box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
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
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .install-instructions h4 {
                margin: 0 0 12px 0;
                font-size: 15px;
                font-weight: 700;
                color: #2d3748;
            }
            
            .install-instructions ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .install-instructions li {
                margin-bottom: 8px;
                line-height: 1.5;
            }
            
            .install-instructions strong {
                color: #667eea;
            }
        </style>
        
        <div class="install-card">
            <div class="install-logo">🎬</div>
            <h1 class="install-title">CineTrack</h1>
            <p class="install-subtitle">
                Installe l'application pour une expérience optimale
            </p>
            
            <div class="install-features">
                <div class="install-feature">
                    <span class="feature-icon">📱</span>
                    <span>Accès rapide depuis ton écran d'accueil</span>
                </div>
                <div class="install-feature">
                    <span class="feature-icon">⚡</span>
                    <span>Navigation ultra rapide et fluide</span>
                </div>
                <div class="install-feature">
                    <span class="feature-icon">🔔</span>
                    <span>Notifications pour tes films préférés</span>
                </div>
            </div>

            <button class="install-button" id="installButton">
                📲 Installer l'application
            </button>

            <div class="install-instructions" id="installInstructions">
                <h4>📖 Instructions d'installation :</h4>
                <ul>
                    <li><strong>Chrome/Edge Android :</strong> Appuie sur le menu (⋮) puis "Installer l'application"</li>
                    <li><strong>Safari iOS :</strong> Appuie sur Partager puis "Sur l'écran d'accueil"</li>
                    <li><strong>Firefox :</strong> Appuie sur le menu puis "Installer"</li>
                </ul>
            </div>
        </div>
    `;
    
    document.body.appendChild(installOverlay);
    document.getElementById('installButton').addEventListener('click', triggerInstall);
}

// Déclencher l'installation
async function triggerInstall() {
    const instructions = document.getElementById('installInstructions');
    
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('✅ Installation acceptée');
            deferredPrompt = null;
            setTimeout(() => {
                const overlay = document.getElementById('pwa-install-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.3s';
                    setTimeout(() => overlay.remove(), 300);
                }
            }, 500);
        } else {
            console.log('❌ Installation refusée');
        }
    } else {
        instructions.classList.add('show');
        document.getElementById('installButton').textContent = '📖 Voir les instructions ci-dessous';
    }
}

// Capturer l'événement beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('📲 beforeinstallprompt capturé');
});

// Détecter l'installation réussie
window.addEventListener('appinstalled', () => {
    console.log('✅ App installée avec succès');
    deferredPrompt = null;
    const overlay = document.getElementById('pwa-install-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => overlay.remove(), 300);
    }
});

// Initialisation au chargement
(function init() {
    console.log('🚀 Init PWA Guard');
    console.log('📱 Mobile:', isMobile());
    console.log('✅ Installée:', isPWAInstalled());
    if (isMobile() && !isPWAInstalled()) {
        console.log('🛑 Affichage écran installation');
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showInstallScreen);
        } else {
            showInstallScreen();
        }
    } else {
        console.log('✅ Chargement normal');
    }
})();