function updateUI() {
    const isLoggedIn = !!getToken();
    const isOnline = navigator.onLine;
    
    console.log('🔄 updateUI:', { isLoggedIn, isOnline });
    
    // Éléments de navigation desktop
    const navSwiper = document.getElementById('navSwiper');
    const navProfile = document.getElementById('navProfile');
    const navFriends = document.getElementById('navFriends');
    const navFilms = document.getElementById('navFilms');
    const statsection = document.getElementById('statsSection');
    
    // Éléments de navigation mobile
    const mobileNavSwiper = document.getElementById('mobileNavSwiper');
    const mobileNavProfile = document.getElementById('mobileNavProfile');
    
    // En mode offline, masquer certains éléments
    if (!isOnline && isLoggedIn) {
        console.log('📡 Mode offline - Masquage des fonctionnalités inaccessibles');
        
        if (statsection) statsection.style.display = 'none';
        // Desktop
        if (navSwiper) navSwiper.style.display = 'none';
        if (navProfile) navProfile.style.display = 'none';
        if (navFriends) navFriends.style.display = 'none';
        if (navFilms) navFilms.style.display = 'none';
        
        
        // Mobile
        if (mobileNavSwiper) mobileNavSwiper.style.display = 'none';
        if (mobileNavProfile) mobileNavProfile.style.display = 'none';
        
        // Afficher l'indicateur offline
        const offlineIndicator = document.getElementById('offlineIndicator');
        if (offlineIndicator) {
            offlineIndicator.style.display = 'block';
            offlineIndicator.textContent = '📡 Mode Hors Ligne - Accès limité';
        }
    } else {
        // Mode online normal
        if (navSwiper) navSwiper.style.display = '';
        if (navProfile) navProfile.style.display = '';
        if (navFriends) navFriends.style.display = '';
        if (navFilms) navFilms.style.display = '';
        
        if (mobileNavSwiper) mobileNavSwiper.style.display = '';
        if (mobileNavProfile) mobileNavProfile.style.display = '';
    }
    
    // Gestion des boutons d'authentification
    document.getElementById('authButtons').style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('userMenu').style.display = isLoggedIn ? 'flex' : 'none';

    if (isLoggedIn && state.user) {
        document.getElementById('usernameDisplay').textContent = state.userProfile.username || state.user.username;
        updateHeaderAvatar();
        
        setupMobileProfileClick();
        
        if (state.user) {
            document.getElementById('usernameDisplay').textContent = state.user.username;
            
            const codeDisplay = document.getElementById('friendCodeDisplay');
            if (codeDisplay && state.user.friend_code) {
                codeDisplay.textContent = '#' + state.user.friend_code;
            }
        }
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

// ==================== PATCH ALTERNATIF POUR ui.js ====================
// Si tu ne peux pas modifier l'ordre dans index.html,
// remplace la fonction switchView dans ui.js par celle-ci
// =====================================================================

function switchView(view) {
    state.currentView = view;
    const orphanModals = document.querySelectorAll('#friendProfileModal, #usernameEditModal, #emailEditModal');
    orphanModals.forEach(modal => modal.remove());
    document.body.style.overflow = '';

    // ✅ CORRECTION CRITIQUE : Réinitialiser les états de chargement
    if (view !== 'watchlist') {
        state.watchlistLoading = false;
        state.watchlistPage = 1;
        state.watchlistAllMovies = [];
    }
    
    if (view !== 'watched') {
        state.watchedLoading = false;
        state.watchedPage = 1;
        state.watchedAllMovies = [];
    }

    // Masquer toutes les sections
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('moviesSection').style.display = 'none';
    document.getElementById('watchlistSection').style.display = 'none';
    document.getElementById('watchedSection').style.display = 'none';
    document.getElementById('profileSection').style.display = 'none';
    document.getElementById('swiperSection').style.display = 'none';
    document.getElementById('friendsSection').style.display = 'none';
    
    // Masquer l'intro offline si elle existe
    const offlineIntroSection = document.getElementById('offlineIntroSection');
    if (offlineIntroSection) {
        offlineIntroSection.style.display = 'none';
    }

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
        case 'intro':
            // Afficher la page d'intro offline
            if (typeof OfflineIntro !== 'undefined') {
                OfflineIntro.show();
            }
            break;
            
        case 'movies':
            document.getElementById('searchSection').style.display = 'block';
            document.getElementById('moviesSection').style.display = 'block';
            document.getElementById('mobileNavFilms')?.classList.add('active');
            
            // ✅ VÉRIFICATION DÉFENSIVE
            if (typeof loadPopularMovies === 'function') {
                loadPopularMovies(false);
            } else {
                console.error('loadPopularMovies not defined');
            }
            break;
            
        case 'watchlist':
            document.getElementById('watchlistSection').style.display = 'block';
            document.getElementById('mobileNavWatchlist')?.classList.add('active');
            
            // ✅ VÉRIFICATION DÉFENSIVE
            if (typeof loadWatchlist === 'function') {
                loadWatchlist();
            } else {
                console.error('loadWatchlist not defined');
            }
            break;
            
        case 'watched':
            document.getElementById('watchedSection').style.display = 'block';
            document.getElementById('mobileNavWatched')?.classList.add('active');
            
            // ✅ VÉRIFICATION DÉFENSIVE
            if (typeof loadWatched === 'function') {
                loadWatched();
            } else {
                console.error('loadWatched not defined');
            }
            break;
            
        case 'profile':
            const moviesSection = document.getElementById('moviesSection');
            const swiperSection = document.getElementById('swiperSection');
            const watchlistSection = document.getElementById('watchlistSection');
            const watchedSection = document.getElementById('watchedSection');
            const profileSection = document.getElementById('profileSection');
            
            moviesSection.style.display = 'none';
            swiperSection.style.display = 'none';
            watchlistSection.style.display = 'none';
            watchedSection.style.display = 'none';
            profileSection.style.display = 'block';
            
            // ✅ VÉRIFICATION DÉFENSIVE
            if (typeof initProfile === 'function') {
                initProfile();
            }
            break;
            
        case 'swiper':
            document.getElementById('swiperSection').style.display = 'block';
            document.getElementById('mobileNavSwiper')?.classList.add('active');
            
            // ✅ CORRECTION PRINCIPALE : Vérification avec retry
            if (typeof loadSwiperMovies === 'function') {
                loadSwiperMovies();
            } else {
                console.warn('⚠️ loadSwiperMovies pas encore chargée, retry dans 100ms...');
                
                // Afficher un loader en attendant
                const swiperContainer = document.getElementById('swiperContainer');
                if (swiperContainer) {
                    swiperContainer.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 16px;">
                            <div class="loader"></div>
                            <p style="color: #9ca3af; font-size: 14px;">Chargement du swiper...</p>
                        </div>
                    `;
                }
                
                // Réessayer après 100ms
                setTimeout(() => {
                    if (typeof loadSwiperMovies === 'function') {
                        console.log('✅ loadSwiperMovies maintenant disponible');
                        loadSwiperMovies();
                    } else {
                        console.error('❌ loadSwiperMovies toujours pas disponible après 100ms');
                        
                        // Réessayer une dernière fois après 500ms
                        setTimeout(() => {
                            if (typeof loadSwiperMovies === 'function') {
                                console.log('✅ loadSwiperMovies disponible (3ème tentative)');
                                loadSwiperMovies();
                            } else {
                                console.error('❌ ERREUR CRITIQUE : swiper.js non chargé');
                                if (swiperContainer) {
                                    swiperContainer.innerHTML = `
                                        <div class="swiper-empty">
                                            <h3>❌ Erreur de chargement</h3>
                                            <p>Le module swiper n'a pas pu être chargé.</p>
                                            <button onclick="location.reload()" style="
                                                margin-top: 16px;
                                                padding: 12px 24px;
                                                background: linear-gradient(135deg, #667eea, #764ba2);
                                                color: white;
                                                border: none;
                                                border-radius: 8px;
                                                cursor: pointer;
                                                font-weight: 600;
                                            ">
                                                🔄 Recharger la page
                                            </button>
                                        </div>
                                    `;
                                }
                            }
                        }, 500);
                    }
                }, 100);
            }
            break;
            
        case 'friends':
            document.getElementById('friendsSection').style.display = 'block';
            document.getElementById('mobileNavProfile')?.classList.add('active');
            
            // ✅ VÉRIFICATION DÉFENSIVE
            if (typeof initFriendsSection === 'function') {
                initFriendsSection();
            } else {
                console.error('initFriendsSection not defined');
            }
            break;

        case 'stats':
            document.getElementById('statsSection').style.display = 'block';
            document.getElementById('mobileNavProfile')?.classList.add('active');
            
            if (typeof initStatsPage === 'function') {
                initStatsPage();
            } else {
                console.error('initStatsPage not defined');
            }
            break;
        }        
}


function updateMobileNav(activeId) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}