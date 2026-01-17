function updateUI() {
    const isLoggedIn = !!getToken();
    document.getElementById('authButtons').style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('userMenu').style.display = isLoggedIn ? 'flex' : 'none';

    if (isLoggedIn && state.user) {
        document.getElementById('usernameDisplay').textContent = state.userProfile.username || state.user.username;
        updateHeaderAvatar();
        
        setupMobileProfileClick();
    }
}

//FONCTION pour mettre à jour l'avatar du header
function updateHeaderAvatar() {
    const userMenu = document.getElementById('userMenu');
    const avatar = state.userProfile.avatar;
    let avatarElement = userMenu.querySelector('.user-avatar');
    let placeholderElement = userMenu.querySelector('.user-avatar-placeholder');
    
    if (avatar) {
        if (!avatarElement) {
            avatarElement = document.createElement('img');
            avatarElement.className = 'user-avatar';
            avatarElement.alt = 'Avatar';
            if (placeholderElement) {
                placeholderElement.remove();
            }
            
            userMenu.appendChild(avatarElement);
        }
        avatarElement.src = avatar;
    } else {
        if (!placeholderElement) {
            placeholderElement = document.createElement('div');
            placeholderElement.className = 'user-avatar-placeholder';
            placeholderElement.textContent = '👤';
            if (avatarElement) {
                avatarElement.remove();
            }
            
            userMenu.appendChild(placeholderElement);
        }
    }
}

function setupMobileProfileClick() {
    const userMenu = document.getElementById('userMenu');
    const usernameDisplay = document.getElementById('usernameDisplay');
    
    if (!getToken() || !userMenu || !usernameDisplay) return;
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        userMenu.style.cursor = 'pointer';
        userMenu.replaceWith(userMenu.cloneNode(true));
        const newUserMenu = document.getElementById('userMenu');
        
        newUserMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (getToken()) {
                switchView('profile');
                updateMobileNav('mobileNavProfile');
            }
        });
    } else {
        userMenu.style.cursor = 'pointer';
        const newUserMenu = userMenu.cloneNode(true);
        userMenu.parentNode.replaceChild(newUserMenu, userMenu);
        
        newUserMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (getToken()) {
                switchView('profile');
            }
        });
    }
}

function switchView(view) {
    state.currentView = view;

    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('moviesSection').style.display = 'none';
    document.getElementById('watchlistSection').style.display = 'none';
    document.getElementById('watchedSection').style.display = 'none';
    document.getElementById('profileSection').style.display = 'none';
    document.getElementById('swiperSection').style.display = 'none';

    // Gérer l'affichage du widget de recherche flottant
    const searchWidget = document.getElementById('searchWidget');
    if (view === 'watchlist' || view === 'watched') {
        searchWidget.style.display = 'flex';
    } else {
        searchWidget.style.display = 'none';
        searchWidget.classList.remove('active');
    }

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });

    switch(view) {
        case 'movies':
            document.getElementById('searchSection').style.display = 'block';
            document.getElementById('moviesSection').style.display = 'block';
            document.getElementById('mobileNavFilms')?.classList.add('active');
            loadPopularMovies(false);
            break;
        case 'watchlist':
            document.getElementById('watchlistSection').style.display = 'block';
            document.getElementById('mobileNavWatchlist')?.classList.add('active');
            loadWatchlist();
            break;
        case 'watched':
            document.getElementById('watchedSection').style.display = 'block';
            document.getElementById('mobileNavWatched')?.classList.add('active');
            loadWatched();
            break;
        case 'profile':
            moviesSection.style.display = 'none';
            swiperSection.style.display = 'none';
            watchlistSection.style.display = 'none';
            watchedSection.style.display = 'none';
            profileSection.style.display = 'block';
            
            if (typeof initProfile === 'function') {
                initProfile();
            }
            break;
        case 'swiper':
            document.getElementById('swiperSection').style.display = 'block';
            document.getElementById('mobileNavSwiper')?.classList.add('active');
            loadSwiperMovies();
            break;
    }
}

function updateMobileNav(activeId) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}