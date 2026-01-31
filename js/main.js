document.addEventListener('DOMContentLoaded', () => {
    // Auth
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal(true));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal(false));
    
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(!isLoginMode);
    });

    // Navigation Desktop
    document.getElementById('navFilms').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('movies');
    });
    document.getElementById('navSwiper').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) openAuthModal(true);
        else switchView('swiper');
    });
    document.getElementById('navWatchlist').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) openAuthModal(true);
        else switchView('watchlist');
    });
    document.getElementById('navWatched').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) openAuthModal(true);
        else switchView('watched');
    });
    document.getElementById('navProfile').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) openAuthModal(true);
        else switchView('profile');
    });
    setupMobileNavigation();
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (!query) {
            state.isSearchMode = false;
            state.currentSearchQuery = '';
            state.currentPage = 1;
            loadPopularMovies(false);
            return;
        }
        searchTimeout = setTimeout(() => {
            state.isSearchMode = true;
            state.currentSearchQuery = query;
            state.searchPage = 1;
            searchMovies(false);
        }, 500);
    });
    
    // Bouton de recherche
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        
        if (!query) {
            state.isSearchMode = false;
            state.currentSearchQuery = '';
            loadPopularMovies(false);
            return;
        }
        
        state.isSearchMode = true;
        state.currentSearchQuery = query;
        state.searchPage = 1;
        searchMovies(false);
    });
    
    // Recherche avec la touche Entrée
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchTimeout);
            const query = searchInput.value.trim();
            
            if (!query) {
                state.isSearchMode = false;
                state.currentSearchQuery = '';
                loadPopularMovies(false);
                return;
            }
            
            state.isSearchMode = true;
            state.currentSearchQuery = query;
            state.searchPage = 1;
            searchMovies(false);
        }
    });

    // Modals
    document.getElementById('closeAuthModal').addEventListener('click', () => {
        document.getElementById('authModal').classList.remove('active');
    });
    document.getElementById('closeMovieModal').addEventListener('click', () => {
        document.getElementById('movieModal').classList.remove('active');
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    document.getElementById('navFriends').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) openAuthModal(true);
        else switchView('friends');
    });

    if (window.history.state === null) {
        window.history.pushState({ view: 'movies' }, '', '');
    }

    window.addEventListener('popstate', (e) => {
        switchView('movies');
        updateMobileNav('mobileNavFilms');
        window.history.pushState({ view: 'movies' }, '', '');
    });
    const token = getToken();
    if (token) {
        state.token = token;
        
        // Charger immédiatement depuis le cache
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            
            OfflineStorage.getProfile().then(cachedProfile => {
                if (cachedProfile) {
                    state.user = cachedProfile;
                    state.userProfile.username = cachedProfile.username;
                    state.userProfile.email = cachedProfile.email;
                    state.userProfile.avatar = cachedProfile.avatar;
                    localStorage.setItem('username', cachedProfile.username);
                    updateUI();
                }
            });
        }
        
        // Ensuite charger/synchroniser avec le serveur
        const savedUsername = localStorage.getItem('username');
        const savedEmail = localStorage.getItem('userEmail');
        
        apiRequest('/profile').then(userProfile => {
            if (userProfile) {
                state.user = userProfile;
                state.userProfile.username = userProfile.username;
                state.userProfile.email = userProfile.email;
                state.userProfile.avatar = userProfile.avatar;
                localStorage.setItem('username', userProfile.username);
            } else if (!state.user) {
                state.user = { username: savedUsername || 'Utilisateur' };
                state.userProfile.username = state.user.username;
            }
            updateUI();
            loadUserData();
            if (typeof loadFriends === 'function') loadFriends();
        }).catch(error => {
            console.warn('Impossible de charger le profil depuis le serveur');
            updateUI();
        });
    }
    const isOnline = navigator.onLine;
    const hasToken = getToken();
    
    if (!isOnline && hasToken) {
        setTimeout(() => {
            if (typeof OfflineIntro !== 'undefined') {
                switchView('intro');
            } else {
                console.warn('OfflineIntro non chargé, affichage watchlist');
                switchView('watchlist');
            }
        }, 100);
    } else {
        loadPopularMovies();
    }
    
    setupInfiniteScroll();
    
    window.addEventListener('online', () => {
        updateUI();
        if (state.currentView === 'intro') {
            switchView('movies');
        }
        location.reload(); // Recharger pour synchroniser
    });
    
    window.addEventListener('offline', () => {
        updateUI();
        if (getToken()) {
            switchView('intro');
        }
    });
});

function setupMobileNavigation() {
    const mobileNavItems = ['Films', 'Swiper', 'Watchlist', 'Watched', 'Profile'];

    mobileNavItems.forEach(item => {
        const el = document.getElementById(`mobileNav${item}`);
        if (!el) return;

        el.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.toLowerCase();

            if (['swiper', 'watchlist', 'watched', 'profile'].includes(view) && !getToken()) {
                openAuthModal(true);
            } else {
                updateMobileNav(`mobileNav${item}`);
                switchView(view === 'films' ? 'movies' : view);
            }
        });
    });
}