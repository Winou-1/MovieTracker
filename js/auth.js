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
        
        // ✅ Sauvegarder toutes les infos utilisateur (avec avatar)
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

    try {
        // ✅ Charger le profil complet (avec avatar)
        const profileData = await apiRequest('/profile');
        if (profileData) {
            state.user = profileData;
            state.userProfile.username = profileData.username;
            state.userProfile.email = profileData.email;
            state.userProfile.avatar = profileData.avatar;
            
            // ✅ Mettre à jour l'avatar dans le header
            updateHeaderAvatar();
        }

        // Charger les stats UNIQUEMENT si les éléments existent
        const stats = await apiRequest('/stats');
        if (stats) {
            // ✅ Vérifier que les éléments existent avant de modifier textContent
            const statRated = document.getElementById('statRated');
            const statAverage = document.getElementById('statAverage');
            const statReviews = document.getElementById('statReviews');
            const statWatchlist = document.getElementById('statWatchlist');
            
            if (statRated) statRated.textContent = stats.rated_count;
            if (statAverage) statAverage.textContent = stats.average_rating;
            if (statReviews) statReviews.textContent = stats.reviews_count;
            if (statWatchlist) statWatchlist.textContent = stats.watchlist_count;
        }

        // Charger watchlist et watched
        const watchlist = await apiRequest('/watchlist');
        if (watchlist) state.watchlist = watchlist;

        const watched = await apiRequest('/watched');
        if (watched) state.watched = watched;
        
    } catch (error) {
        console.error('Erreur chargement données utilisateur:', error);
    }
}




// ✅ Fonction appelée par le bouton onclick
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
        
        // ✅ Sauvegarder toutes les infos utilisateur (avec avatar)
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