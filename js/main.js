document.addEventListener('DOMContentLoaded', () => {
    // Auth
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal(true));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal(false));
    
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(!isLoginMode);
    });
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    document.getElementById('avatarUpload').addEventListener('change', handleAvatarUpload);

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

    document.getElementById('searchBtn').addEventListener('click', (e) => {
        e.preventDefault();
        searchMovies(false);
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
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
        
        // ✅ RÉCUPÉREZ LE USERNAME depuis localStorage
        const savedUsername = localStorage.getItem('username');
        
        apiRequest('/stats').then(data => {
            if (data) {
                state.user = { username: savedUsername || 'Utilisateur' };
                state.userProfile.username = state.user.username;
                state.userProfile.email = localStorage.getItem('userEmail') || '';
                
                updateUI();
                loadUserData(); // ✅ Ceci chargera maintenant l'avatar automatiquement
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
        document.getElementById(`mobileNav${item}`).addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.toLowerCase();
            
            if (['swiper', 'watchlist', 'watched', 'profile'].includes(view) && !getToken()) {
                openAuthModal(true);
            } else {
                updateMobileNav(`mobileNav${item}`);
                switchView(view === 'films' ? 'movies' : view);
                
                // ✅ On ajoute un état dans l'historique pour chaque changement de vue
                window.history.pushState({ view: view === 'films' ? 'movies' : view }, '', '');
            }
        });
    });
}