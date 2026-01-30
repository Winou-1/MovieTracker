let isLoginMode = true;

function openAuthModal(isLogin = true) {
    isLoginMode = isLogin;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authModalTitle');
    const usernameGroup = document.getElementById('usernameGroup');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitchLink');

    title.textContent = isLogin ? 'Connexion' : 'Inscription';
    usernameGroup.style.display = isLogin ? 'none' : 'block';
    submitBtn.textContent = isLogin ? 'Se connecter' : 'S\'inscrire';
    switchText.textContent = isLogin ? 'Pas encore de compte ?' : 'Déjà inscrit ?';
    switchLink.textContent = isLogin ? 'S\'inscrire' : 'Se connecter';

    // Reset form
    document.getElementById('authUsername').value = '';
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authError').style.display = 'none';
    
    modal.classList.add('active');
}

async function handleAuth(e) {
    e.preventDefault();

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value;

    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    const body = isLoginMode 
        ? { email, password }
        : { username, email, password };

    const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });

    if (data && data.token) {
        setToken(data.token);
        state.user = data.user;
        state.userProfile.username = data.user.username;
        state.userProfile.email = data.user.email;
        state.userProfile.avatar = data.user.avatar;
        
        document.getElementById('authModal').classList.remove('active');
        updateUI();
        loadUserData();
        setupUserMenuClick();
        showToast('Connexion réussie !');
        switchView('movies');
    } else {
        document.getElementById('authError').textContent = data?.error || 'Erreur';
        document.getElementById('authError').style.display = 'block';
    }
}

function logout() {
    clearToken();
    state.user = null;
    state.userProfile = { avatar: null, username: '', email: '' };
    updateUI();
    switchView('movies');
    showToast('Déconnexion réussie');
}
async function loadUserData() {
    if (!getToken()) return;
    
    console.log('🔄 loadUserData - Début');

    try {
        // ✅ Initialiser les tableaux pour éviter les erreurs
        if (!Array.isArray(state.watchlist)) state.watchlist = [];
        if (!Array.isArray(state.watched)) state.watched = [];
        
        // ✅ CACHE-FIRST : Charger d'abord les données offline
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            console.log('📦 Chargement des données depuis le cache...');
            
            // Charger le profil depuis le cache
            const cachedProfile = await OfflineStorage.getProfile();
            if (cachedProfile) {
                state.user = cachedProfile;
                state.userProfile.username = cachedProfile.username;
                state.userProfile.email = cachedProfile.email;
                state.userProfile.avatar = cachedProfile.avatar;
                updateHeaderAvatar();
                console.log('⚡ Profil chargé depuis le cache');
            }
            
            // Charger les listes depuis le cache
            const cachedWatchlist = await OfflineStorage.getWatchlist();
            if (cachedWatchlist && Array.isArray(cachedWatchlist)) {
                state.watchlist = cachedWatchlist;
                console.log('⚡ Watchlist chargée depuis le cache:', cachedWatchlist.length, 'films');
            }
            
            const cachedWatched = await OfflineStorage.getWatched();
            if (cachedWatched && Array.isArray(cachedWatched)) {
                state.watched = cachedWatched;
                console.log('⚡ Films vus chargés depuis le cache:', cachedWatched.length, 'films');
            }
        }
        
        // ✅ Ensuite, si on est en ligne, synchroniser avec le serveur
        if (navigator.onLine) {
            console.log('🌐 Synchronisation avec le serveur...');
            
            try {
                const profileData = await apiRequest('/profile');
                if (profileData) {
                    state.user = profileData;
                    state.userProfile.username = profileData.username;
                    state.userProfile.email = profileData.email;
                    state.userProfile.avatar = profileData.avatar;
                    updateHeaderAvatar();
                }
                
                const stats = await apiRequest('/stats');
                if (stats) {
                    const statRated = document.getElementById('statRated');
                    const statAverage = document.getElementById('statAverage');
                    const statReviews = document.getElementById('statReviews');
                    const statWatchlist = document.getElementById('statWatchlist');
                    if (statRated) statRated.textContent = stats.rated_count;
                    if (statAverage) statAverage.textContent = stats.average_rating;
                    if (statReviews) statReviews.textContent = stats.reviews_count;
                    if (statWatchlist) statWatchlist.textContent = stats.watchlist_count;
                }
                
                const watchlist = await apiRequest('/watchlist');
                if (watchlist && Array.isArray(watchlist)) {
                    state.watchlist = watchlist;
                }

                const watched = await apiRequest('/watched');
                if (watched && Array.isArray(watched)) {
                    state.watched = watched;
                }
                
                // Synchroniser le cache en arrière-plan
                if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                    OfflineStorage.syncAllData();
                }
                
                console.log('✅ Données synchronisées avec le serveur');
            } catch (apiError) {
                console.warn('⚠️ Erreur API, utilisation du cache uniquement');
            }
        } else {
            console.log('📡 Mode offline - Données du cache uniquement');
        }
        
        console.log('✅ loadUserData terminé:', {
            user: !!state.user,
            watchlist: state.watchlist?.length || 0,
            watched: state.watched?.length || 0
        });
        
    } catch (error) {
        console.error('❌ Erreur chargement données utilisateur:', error);
    }
}

async function handleAuthSubmit() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value;

    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    const body = isLoginMode 
        ? { email, password }
        : { username, email, password };

    const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });

    if (data && data.token) {
        setToken(data.token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('userEmail', data.user.email);
        state.user = data.user;
        state.userProfile.username = data.user.username;
        state.userProfile.email = data.user.email;
        state.userProfile.avatar = data.user.avatar;
        
        document.getElementById('authModal').classList.remove('active');
        updateUI();
        loadUserData();
        setupUserMenuClick();
        showToast('Connexion réussie !');
        switchView('movies');
    } else {
        document.getElementById('authError').textContent = data?.error || 'Erreur';
        document.getElementById('authError').style.display = 'block';
    }
}