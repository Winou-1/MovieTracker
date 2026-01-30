// js/offline-intro.js - Gestion de l'intro mode offline

function createOfflineIntro() {
    return `
    <div class="offline-intro-container">
        <div class="offline-intro-content">
            <!-- Icône de connexion -->
            <div class="offline-icon-wrapper">
                <svg class="offline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                    <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                    <line x1="12" y1="20" x2="12.01" y2="20"></line>
                </svg>
                <div class="offline-pulse"></div>
            </div>

            <!-- Titre -->
            <h1 class="offline-title">📡 Mode Hors Ligne</h1>
            
            <!-- Message -->
            <div class="offline-message">
                <p class="offline-main-text">
                    Vous êtes actuellement en mode hors ligne.
                </p>
                <p class="offline-sub-text">
                    Vous pouvez toujours accéder à vos films sauvegardés :
                </p>
            </div>

            <!-- Fonctionnalités disponibles -->
            <div class="offline-features">
                <div class="offline-feature">
                    <div class="offline-feature-icon">📌</div>
                    <div class="offline-feature-text">Watchlist</div>
                </div>
                <div class="offline-feature">
                    <div class="offline-feature-icon">✓</div>
                    <div class="offline-feature-text">Films vus</div>
                </div>
            </div>

            <!-- Actions -->
            <div class="offline-actions">
                <button class="btn-offline-continue" onclick="switchView('watchlist')">
                    📌 Voir ma Watchlist
                </button>
                <button class="btn-offline-continue btn-secondary" onclick="switchView('watched')">
                    ✓ Voir mes Films vus
                </button>
            </div>

            <!-- Aide -->
            <div class="offline-help">
                <div class="offline-help-title">🔧 Problème de connexion ?</div>
                <div class="offline-help-text">
                    Si vous pensez que c'est une erreur :
                </div>
                <ul class="offline-help-list">
                    <li>Vérifiez votre connexion Wi-Fi ou données mobiles</li>
                    <li>Désactivez le mode avion</li>
                    <li>Rechargez l'application (⟳)</li>
                </ul>
                <button class="btn-offline-reload" onclick="location.reload()">
                    🔄 Recharger l'application
                </button>
            </div>
        </div>
    </div>
    `;
}

function showOfflineIntro() {
    // Créer une section pour l'intro offline
    let introSection = document.getElementById('offlineIntroSection');
    
    if (!introSection) {
        introSection = document.createElement('section');
        introSection.id = 'offlineIntroSection';
        introSection.className = 'offline-intro-section';
        introSection.style.display = 'none';
        
        const main = document.querySelector('main');
        if (main) {
            main.appendChild(introSection);
        }
    }
    
    introSection.innerHTML = createOfflineIntro();
    introSection.style.display = 'block';
}

// Vérifier la connexion au chargement
function checkConnectionStatus() {
    const isOnline = navigator.onLine;
    const hasToken = !!localStorage.getItem('token');
    
    console.log('🔍 Vérification connexion:', { isOnline, hasToken });
    
    if (!isOnline && hasToken) {
        console.log('📡 Mode offline détecté, affichage intro');
        return true;
    }
    
    return false;
}

// Export
window.OfflineIntro = {
    show: showOfflineIntro,
    checkStatus: checkConnectionStatus
};