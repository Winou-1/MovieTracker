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

    // Navigation Mobile
    setupMobileNavigation();

    // ✅ NOUVELLE GESTION DE LA RECHERCHE EN TEMPS RÉEL
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    let searchTimeout;
    
    // Recherche en temps réel à chaque frappe
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        
        // Attendre 500ms après la dernière frappe avant de rechercher
        searchTimeout = setTimeout(() => {
            searchMovies(false);
        }, 500);
    });
    
    // Bouton de recherche (optionnel, car la recherche se fait déjà automatiquement)
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearTimeout(searchTimeout);
        searchMovies(false);
    });
    
    // Recherche également avec la touche Entrée
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchTimeout);
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

    // Navigation Desktop - ajoute après navProfile
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

    // Init
    const token = getToken();
    if (token) {
        state.token = token;
        const savedUsername = localStorage.getItem('username');
        apiRequest('/stats').then(data => {
            if (data) {
                state.user = { username: savedUsername || 'Utilisateur' };
                state.userProfile.username = state.user.username;
                state.userProfile.email = localStorage.getItem('userEmail') || '';
                
                updateUI();
                loadUserData();
                setupMobileProfileClick();
            }
        });
    }

    loadPopularMovies();
    setupInfiniteScroll();
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