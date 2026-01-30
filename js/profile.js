let profileData = {
    user: null,
    stats: {},
    likedMovies: [],
    watchlistMovies: [],
    watchedMovies: [],
    settings: {
        language: 'fr',
        notifications: true,
        autoplay: false,
        darkMode: true
    }
};

// ==================== INITIALISATION ====================

async function initProfile() {
    console.log('🎬 Init Profile - Début');
    
    if (!getToken()) {
        console.log('⚠️ Pas de token, redirection');
        switchView('movies');
        openAuthModal(true);
        return;
    }

    // ✅ D'abord afficher le profil avec les données disponibles
    renderProfile();
    console.log('📄 Premier render du profil');

    try {
        // ✅ Charger toutes les données en parallèle
        console.log('🔄 Chargement des données profil...');
        
        await Promise.all([
            loadUserProfile().catch(err => {
                console.error('❌ Erreur loadUserProfile:', err);
                return null;
            }),
            loadUserStats().catch(err => {
                console.error('❌ Erreur loadUserStats:', err);
                return null;
            }),
            loadLikedMovies().catch(err => {
                console.error('❌ Erreur loadLikedMovies:', err);
                return [];
            }),
            loadWatchlistMovies().catch(err => {
                console.error('❌ Erreur loadWatchlistMovies:', err);
                return [];
            }),
            loadWatchedMovies().catch(err => {
                console.error('❌ Erreur loadWatchedMovies:', err);
                return [];
            })
        ]);

        console.log('✅ Données chargées:', {
            user: !!profileData.user,
            stats: Object.keys(profileData.stats).length,
            liked: profileData.likedMovies?.length || 0,
            watchlist: profileData.watchlistMovies?.length || 0,
            watched: profileData.watchedMovies?.length || 0
        });

        // ✅ Rafraîchir l'affichage avec toutes les données
        renderProfile();
        console.log('✅ Profil rechargé avec toutes les données');
        
    } catch (error) {
        console.error('❌ Erreur chargement profil:', error);
        // ✅ Afficher le profil même en cas d'erreur (mode dégradé)
        renderProfile();
    }
}

// ==================== CHARGEMENT PROFIL ====================

async function loadUserProfile() {
    try {
        let data = null;
        
        // ✅ CACHE-FIRST
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            data = await OfflineStorage.getProfile();
            if (data) {
                console.log('⚡ Profil depuis cache');
                profileData.user = data;
                renderProfile();
            }
        }
        
        // ✅ Sync serveur en parallèle
        if (navigator.onLine) {
            try {
                const freshData = await apiRequest('/profile');
                
                if (freshData) {
                    // Mettre à jour le cache
                    if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                        await OfflineStorage.saveToStore('settings', {
                            key: 'profile',
                            value: freshData,
                            updated_at: new Date().toISOString()
                        });
                    }
                    
                    // Si différent du cache, re-render
                    if (JSON.stringify(data) !== JSON.stringify(freshData)) {
                        profileData.user = freshData;
                        renderProfile();
                        console.log('🔄 Profil mis à jour depuis serveur');
                    }
                }
            } catch (apiError) {
                console.warn('⚠️ Erreur API profil, utilisation du cache');
            }
        }
        
        return profileData.user;
        
    } catch (error) {
        console.error('Erreur profil:', error);
        throw error;
    }
}

// ==================== CHARGEMENT STATS ====================

async function loadUserStats() {
    try {
        let stats = null;
        let watchedData = null;
        
        // ✅ CACHE-FIRST
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            watchedData = await OfflineStorage.getWatched();
            if (watchedData && watchedData.length > 0) {
                console.log('⚡ Stats depuis cache (' + watchedData.length + ' films vus)');
            }
        }
        
        // ✅ Sync serveur
        if (navigator.onLine) {
            try {
                const freshStats = await apiRequest('/stats');
                const freshWatched = await apiRequest('/watched');
                
                if (freshStats) stats = freshStats;
                
                if (freshWatched && freshWatched.length > 0) {
                    watchedData = freshWatched;
                    
                    // ✅ CORRECTION CRITIQUE : saveListWithDetails au lieu de saveWatchedWithDetails
                    if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                        // Ne pas bloquer le chargement, faire en arrière-plan
                        OfflineStorage.saveListWithDetails('watched', freshWatched).catch(err => {
                            console.warn('Erreur sauvegarde cache watched:', err);
                        });
                    }
                }
            } catch (apiError) {
                console.warn('⚠️ Erreur API stats, calcul local');
            }
        }
        
        // ✅ Stats en mode offline/fallback
        if (!stats) {
            let watchlistData = [];
            let likesData = [];
            
            if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                watchlistData = await OfflineStorage.getWatchlist() || [];
                likesData = await OfflineStorage.getLikes() || [];
            }
            
            stats = {
                rated_count: 0,
                reviews_count: 0,
                watchlist_count: watchlistData.length,
                average_rating: 0
            };
        }
        
        // ✅ Calcul des stats
        profileData.stats = {
            rated_count: stats?.rated_count || 0,
            reviews_count: stats?.reviews_count || 0,
            watchlist_count: stats?.watchlist_count || 0,
            average_rating: stats?.average_rating || 0
        };

        profileData.stats.watched_count = watchedData?.length || 0;

        // Films vus ce mois
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        profileData.stats.watched_this_month = (watchedData || []).filter(movie => {
            const watchedDate = new Date(movie.watched_at || movie.added_at);
            return watchedDate.getMonth() === currentMonth && 
                   watchedDate.getFullYear() === currentYear;
        }).length;

        // Temps total (120min par film)
        profileData.stats.total_hours = Math.round((profileData.stats.watched_count * 120) / 60);

        return profileData.stats;
        
    } catch (error) {
        console.error('Erreur stats:', error);
        // ✅ Stats par défaut au lieu de crash
        profileData.stats = {
            rated_count: 0,
            reviews_count: 0,
            watchlist_count: 0,
            average_rating: 0,
            watched_count: 0,
            watched_this_month: 0,
            total_hours: 0
        };
        return profileData.stats;
    }
}

// ==================== CHARGEMENT LIKES ====================

async function loadLikedMovies() {
    try {
        let likes = null;
        
        // ✅ CACHE-FIRST
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            const cachedLikes = await OfflineStorage.getLikes();
            if (cachedLikes && cachedLikes.length > 0) {
                likes = cachedLikes;
                console.log('⚡ Likes depuis cache (' + likes.length + ')');
            }
        }
        
        // ✅ Sync serveur
        if (navigator.onLine) {
            try {
                const freshLikes = await apiRequest('/likes/all');
                if (freshLikes && freshLikes.length > 0) {
                    likes = freshLikes;
                    
                    if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                        OfflineStorage.saveLikesWithDetails(freshLikes).catch(err => {
                            console.warn('Erreur cache likes:', err);
                        });
                    }
                }
            } catch (apiError) {
                console.warn('⚠️ Erreur API likes');
            }
        }
        
        if (!likes || likes.length === 0) {
            profileData.likedMovies = [];
            return [];
        }

        // ✅ Récupérer détails des 6 derniers
        const recentLikes = likes.slice(0, 6);
        const moviesPromises = recentLikes.map(async (like) => {
            try {
                // Vérifier cache d'abord
                if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                    const cached = await OfflineStorage.getFromStore('movies_cache', like.movie_id);
                    if (cached && cached.data) {
                        return {
                            id: cached.data.id,
                            title: cached.data.title,
                            poster_path: cached.data.poster_path
                        };
                    }
                }
                
                // Fetch TMDB si en ligne
                if (navigator.onLine) {
                    const response = await fetch(
                        `${CONFIG.TMDB_BASE_URL}/movie/${like.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                    );
                    const movie = await response.json();
                    return {
                        id: movie.id,
                        title: movie.title,
                        poster_path: movie.poster_path
                    };
                }
                
                return null;
            } catch (error) {
                return null;
            }
        });

        const movies = await Promise.all(moviesPromises);
        profileData.likedMovies = movies.filter(m => m !== null);
        return profileData.likedMovies;
        
    } catch (error) {
        console.error('Erreur films likés:', error);
        profileData.likedMovies = [];
        return [];
    }
}

// ==================== CHARGEMENT WATCHLIST ====================

async function loadWatchlistMovies() {
    try {
        let watchlist = null;
        
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            watchlist = await OfflineStorage.getWatchlist();
            if (watchlist && watchlist.length > 0) {
                console.log('⚡ Watchlist profil depuis cache');
            }
        }
        
        if (navigator.onLine) {
            try {
                const freshWatchlist = await apiRequest('/watchlist');
                if (freshWatchlist) {
                    watchlist = freshWatchlist;
                }
            } catch (error) {
                console.warn('⚠️ Erreur API watchlist');
            }
        }
        
        if (watchlist && watchlist.length > 0) {
            profileData.watchlistMovies = watchlist.slice(0, 6).map(w => ({
                movie_id: w.movie_id,
                movie_title: w.details?.title || w.movie_title,
                movie_poster: w.details?.poster_path || w.movie_poster
            }));
        } else {
            profileData.watchlistMovies = [];
        }
        
        return profileData.watchlistMovies;
        
    } catch (error) {
        console.error('Erreur watchlist:', error);
        profileData.watchlistMovies = [];
        return [];
    }
}

// ==================== CHARGEMENT WATCHED ====================

async function loadWatchedMovies() {
    try {
        let watched = null;
        
        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
            watched = await OfflineStorage.getWatched();
            if (watched && watched.length > 0) {
                console.log('⚡ Watched profil depuis cache');
            }
        }
        
        if (navigator.onLine) {
            try {
                const freshWatched = await apiRequest('/watched');
                if (freshWatched) {
                    watched = freshWatched;
                }
            } catch (error) {
                console.warn('⚠️ Erreur API watched');
            }
        }
        
        if (watched && watched.length > 0) {
            profileData.watchedMovies = watched.slice(0, 6).map(w => ({
                movie_id: w.movie_id,
                movie_title: w.details?.title || w.movie_title,
                movie_poster: w.details?.poster_path || w.movie_poster
            }));
        } else {
            profileData.watchedMovies = [];
        }
        
        return profileData.watchedMovies;
        
    } catch (error) {
        console.error('Erreur films vus:', error);
        profileData.watchedMovies = [];
        return [];
    }
}


// Rendre le profil
function renderProfile() {
    const container = document.querySelector('.profile-content');
    if (!container) return;

    // ✅ Vérifier que les données sont chargées
    const user = profileData.user || {};
    const stats = profileData.stats || {};
    
    // ✅ Valeurs par défaut si données manquantes
    const username = user.username || state.userProfile?.username || state.user?.username || 'Utilisateur';
    const email = user.email || state.userProfile?.email || state.user?.email || 'email@exemple.com';
    const avatar = user.avatar || state.userProfile?.avatar || state.user?.avatar;
    const friendCode = user.friend_code || state.user?.friend_code || '000000';

    container.innerHTML = `
    <div class="profile-header">
        <div class="profile-header-actions">
            <button class="profile-friends-btn" onclick="switchView('friends')" title="Mes amis">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span class="profile-friends-badge" id="friendsBadgeCount">0</span>
            </button>
            
            <button class="profile-settings-btn" onclick="openSettings()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
        </div>
        
        <div class="profile-header-content">
            <div class="profile-avatar-wrapper">
                <img src="${avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) + '&background=2563eb&color=fff&size=200'}" 
                     alt="${username}" 
                     class="profile-avatar">
            </div>
            <div class="profile-info">
                <h2>${username}</h2>
                <p class="profile-email">${email}</p>
                <p style="color:var(--text-muted); font-family:monospace; font-size:1.1em; letter-spacing:2px; margin-top:8px;">#${friendCode}</p>
            </div>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-card-icon">🎬</span>
                <span class="stat-card-value">${stats.watched_count || 0}</span>
            </div>
            <div class="stat-card-label">Films vus</div>
            <div class="stat-card-sublabel">Au total</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-card-icon">📅</span>
                <span class="stat-card-value">${stats.watched_this_month || 0}</span>
            </div>
            <div class="stat-card-label">Ce mois</div>
            <div class="stat-card-sublabel">${new Date().toLocaleDateString('fr-FR', { month: 'long' })}</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-card-icon">⏱️</span>
                <span class="stat-card-value">${stats.total_hours || 0}h</span>
            </div>
            <div class="stat-card-label">Temps total</div>
            <div class="stat-card-sublabel">Visionnage</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-card-header">
                <span class="stat-card-icon">⭐</span>
                <span class="stat-card-value">${stats.average_rating || 0}</span>
            </div>
            <div class="stat-card-label">Note moy.</div>
            <div class="stat-card-sublabel">${stats.rated_count || 0} notes</div>
        </div>
    </div>

    <div class="stats-inline">
        <div class="stat-inline-item">
            <div class="stat-inline-value">${stats.reviews_count || 0}</div>
            <div class="stat-inline-label">Avis</div>
        </div>
        <div class="stat-inline-item">
            <div class="stat-inline-value">${profileData.likedMovies?.length || 0}</div>
            <div class="stat-inline-label">Favoris</div>
        </div>
        <div class="stat-inline-item">
            <div class="stat-inline-value">${stats.watchlist_count || 0}</div>
            <div class="stat-inline-label">À voir</div>
        </div>
    </div>
    <div class="profile-stats-button-container" style="padding: 0 16px; margin-bottom: 24px;">
        <button onclick="switchView('stats')" style="
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 16px;
            color: white;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'">
            <span style="font-size: 24px;">📊</span>
            Voir mes statistiques détaillées
        </button>
    </div>


    ${renderMoviesSection('❤️ Films aimés', profileData.likedMovies, 'liked')}
    ${renderMoviesSection('📖 À voir', profileData.watchlistMovies, 'watchlist')}
    ${renderMoviesSection('👁️ Vus récemment', profileData.watchedMovies, 'watched')}
    `;
    
    loadFriendsCount();
    createSettingsModal();
}

async function loadFriendsCount() {
    try {
        const friendsData = await apiRequest('/friends');
        const friendsCount = friendsData ? friendsData.length : 0;
        const badge = document.getElementById('friendsBadgeCount');
        if (badge) {
            badge.textContent = friendsCount;
            badge.style.display = friendsCount > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Erreur chargement nombre d\'amis:', error);
    }
}
// Rendre une section de films
function renderMoviesSection(title, movies, type) {
    // ✅ Vérifier que movies existe et est un tableau
    const moviesList = Array.isArray(movies) ? movies : [];
    
    if (moviesList.length === 0) {
        return `
            <div class="profile-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <span class="section-title-icon">${title.split(' ')[0]}</span>
                        ${title.split(' ').slice(1).join(' ')}
                    </h3>
                </div>
                <div class="profile-empty-state">
                    <div class="profile-empty-state-icon">🎬</div>
                    <p class="profile-empty-state-text">Aucun film pour le moment</p>
                    <p class="profile-empty-state-hint">Explorez et ajoutez des films !</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="profile-section">
            <div class="section-header">
                <h3 class="section-title">
                    <span class="section-title-icon">${title.split(' ')[0]}</span>
                    ${title.split(' ').slice(1).join(' ')}
                </h3>
                <a href="#" class="section-see-all" onclick="showAllMovies('${type}'); return false;">
                    Voir tout
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </a>
            </div>
            <div class="movies-horizontal-scroll">
                ${moviesList.map(movie => {
                    const movieId = movie.movie_id || movie.id;
                    const movieTitle = movie.movie_title || movie.title || 'Film';
                    const moviePoster = movie.movie_poster || movie.poster_path;
                    const posterUrl = moviePoster ? (moviePoster.startsWith('http') ? moviePoster : CONFIG.TMDB_IMG_URL + moviePoster) : '';
                    
                    return `
                        <div class="movie-mini-card" onclick="showMovieDetails(${movieId})">
                            ${posterUrl ? `<img src="${posterUrl}" alt="${movieTitle}" class="movie-mini-poster">` : '<div class="movie-mini-poster" style="background:#374151;display:flex;align-items:center;justify-content:center;">🎬</div>'}
                            <div class="movie-mini-title">${movieTitle}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Créer le modal de settings
function createSettingsModal() {
    if (document.getElementById('settingsModal')) return;

    const modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'settings-modal';
    modal.innerHTML = `
        <div class="settings-content">
            <div class="settings-handle"></div>
            <div class="settings-header">
                <div class="settings-header-top">
                    <h2 class="settings-title">Paramètres</h2>
                    <button class="settings-close-btn" onclick="closeSettings()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="settings-body">
                <div class="settings-section">
                    <div class="settings-section-title">Profil</div>
                    
                    <div class="settings-option" id="setting-avatar">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Photo de profil</div>
                                <div class="settings-option-value">Modifier votre avatar</div>
                            </div>
                            <svg class="settings-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>

                    <div class="settings-option" id="setting-username">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Pseudo</div>
                                <div class="settings-option-value">${profileData.user?.username || ''}</div>
                            </div>
                            <svg class="settings-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>

                    <div class="settings-option" id="setting-email">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Email</div>
                                <div class="settings-option-value">${profileData.user?.email || ''}</div>
                            </div>
                            <svg class="settings-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>

                    <div class="settings-option" id="setting-password">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Mot de passe</div>
                                <div class="settings-option-value">••••••••</div>
                            </div>
                            <svg class="settings-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="settings-option" id="setting-privacy">
                    <div class="settings-option-header">
                        <div class="settings-option-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </div>
                        <div class="settings-option-info">
                            <div class="settings-option-label">Confidentialité</div>
                            <div class="settings-option-value">${
                                profileData.user?.profile_privacy === 'public' ? 'Public' :
                                profileData.user?.profile_privacy === 'private' ? 'Privé' :
                                'Amis uniquement'
                            }</div>
                        </div>
                        <svg class="settings-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </div>
                </div>
                <div class="settings-option settings-toggle">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Notifications</div>
                                <div class="settings-option-value">Recevoir les alertes</div>
                            </div>
                        </div>
                        <div class="toggle-switch ${profileData.settings.notifications ? 'active' : ''}" 
                             onclick="toggleSetting('notifications', this)">
                            <div class="toggle-slider"></div>
                        </div>
                    </div>

                    <div class="settings-option settings-toggle">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Mode Offline</div>
                                <div class="settings-option-value" id="offlineModeValue">Données en local</div>
                            </div>
                        </div>
                        <div class="toggle-switch ${typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled() ? 'active' : ''}" 
                             id="offlineModeToggle"
                             onclick="toggleOfflineMode(this)">
                            <div class="toggle-slider"></div>
                        </div>
                    </div>

                    <div class="settings-option" id="setting-offline-info" style="cursor: default;">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="16" x2="12" y2="12"/>
                                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Cache</div>
                                <div class="settings-option-value" id="cacheSize">Calcul...</div>
                            </div>
                        </div>
                        <button class="btn-secondary btn-small" onclick="manualSync()" style="padding: 6px 12px; font-size: 12px;">
                            🔄 Sync
                        </button>
                        <button class="btn-secondary btn-small" onclick="resetOfflineStorage()" 
                                style="padding: 6px 12px; font-size: 12px; background: #ef4444; color: white; margin-left: 8px;">
                            🗑️ Reset
                        </button>
                    </div>
                    
                <div class="settings-section">
                    <div class="settings-section-title">Préférences</div>
                    
                    <div class="settings-option settings-toggle">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Notifications</div>
                                <div class="settings-option-value">Recevoir les alertes</div>
                            </div>
                        </div>
                        <div class="toggle-switch ${profileData.settings.notifications ? 'active' : ''}" 
                             onclick="toggleSetting('notifications', this)">
                            <div class="toggle-slider"></div>
                        </div>
                    </div>

                     <div class="settings-option" id="setting-language">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Langue</div>
                                <div class="settings-option-value" id="currentLanguageDisplay"></div>
                            </div>
                            <svg class="settings-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>

                    <!--<div class="settings-option settings-toggle">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Lecture auto</div>
                                <div class="settings-option-value">Bandes-annonces</div>
                            </div>
                        </div>
                        <div class="toggle-switch ${profileData.settings.autoplay ? 'active' : ''}" 
                             onclick="toggleSetting('autoplay', this)">
                            <div class="toggle-slider"></div>
                        </div>
                    </div>-->
                </div>

                <div class="settings-section settings-danger-zone">
                    <div class="settings-section-title">Zone dangereuse</div>
                    <button class="settings-btn-danger" onclick="confirmLogout()">
                        Déconnexion
                    </button>
                    <button class="settings-btn-danger" onclick="confirmDeleteAccount()" style="margin-top: 12px;">
                        Supprimer mon compte
                    </button>
                </div>
            </div>
        </div>
    `;
    setTimeout(async () => {
        // Vérifier que OfflineStorage existe avant de l'utiliser
        if (typeof OfflineStorage !== 'undefined') {
            const cacheSize = await OfflineStorage.getCacheSize();
            const cacheSizeElement = document.getElementById('cacheSize');
            if (cacheSizeElement) {
                cacheSizeElement.textContent = cacheSize;
            }
        }
    }, 100);

    document.body.appendChild(modal);
    setupSettingsEvents();
    
    // Charger la taille du cache après un court délai
    setTimeout(async () => {
        if (typeof OfflineStorage !== 'undefined') {
            const cacheSize = await OfflineStorage.getCacheSize();
            const cacheSizeElement = document.getElementById('cacheSize');
            if (cacheSizeElement) {
                cacheSizeElement.textContent = cacheSize;
            }
        }
    }, 200);
}


function setupSettingsEvents() {
    document.getElementById('setting-avatar')?.addEventListener('click', () => editAvatar());
    document.getElementById('setting-username')?.addEventListener('click', () => editUsername());
    document.getElementById('setting-email')?.addEventListener('click', () => editEmail());
    document.getElementById('setting-password')?.addEventListener('click', () => editPassword());
    document.getElementById('setting-language')?.addEventListener('click', () => openLanguageModal());
    document.getElementById('setting-privacy')?.addEventListener('click', () => openPrivacySettings());
    updateCurrentLanguageDisplay();
}

function updateCurrentLanguageDisplay() {
    const languageNames = {
        fr: 'Français',
        en: 'English',
        es: 'Español'
    };
    
    const currentLang = localStorage.getItem('app_language') || 'fr';
    const display = document.getElementById('currentLanguageDisplay');
    if (display) {
        display.textContent = languageNames[currentLang] || 'Français';
    }
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function toggleSetting(setting, element) {
    profileData.settings[setting] = !profileData.settings[setting];
    element.classList.toggle('active');
    localStorage.setItem('userSettings', JSON.stringify(profileData.settings));
    showToast(`${setting === 'notifications' ? 'Notifications' : 'Lecture auto'} ${profileData.settings[setting] ? 'activée' : 'désactivée'}`);
}

function editUsername() {
    const currentUsername = profileData.user.username;
    
    const modal = document.createElement('div');
    modal.className = 'settings-modal active';
    modal.id = 'usernameEditModal';
    modal.innerHTML = `
        <div class="settings-content" style="max-width: 400px; margin: auto; border-radius: 24px;">
            <div class="settings-handle"></div>
            <div class="settings-header">
                <div class="settings-header-top">
                    <h2 class="settings-title">Modifier le pseudo</h2>
                    <button class="settings-close-btn" onclick="closeUsernameModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="settings-body">
                <div class="settings-input-group">
                    <input 
                        type="text" 
                        id="newUsernameInput" 
                        class="settings-input" 
                        value="${currentUsername}"
                        placeholder="Nouveau pseudo"
                        maxlength="30"
                    >
                </div>
                <button class="settings-btn-save" onclick="saveNewUsername()">
                    Enregistrer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        document.getElementById('newUsernameInput').focus();
        document.getElementById('newUsernameInput').select();
    }, 100);
    localStorage.setItem('username', newUsername);
    updateUI();
    
    document.getElementById('newUsernameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNewUsername();
        }
    });
}

function closeUsernameModal() {
    const modal = document.getElementById('usernameEditModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

async function saveNewUsername() {
    const newUsername = document.getElementById('newUsernameInput').value.trim();
    const currentUsername = profileData.user.username;
    
    if (!newUsername || newUsername === currentUsername) {
        closeUsernameModal();
        return;
    }
    
    try {
        const result = await apiRequest('/profile/username', {
            method: 'PUT',
            body: JSON.stringify({ username: newUsername })
        });
        
        if (result) {
            profileData.user.username = newUsername;
            showToast('Pseudo mis à jour !');
            closeUsernameModal();
            await initProfile();
        }
    } catch (error) {
        showToast('Ce pseudo est déjà pris', 'error');
    }
}

// ✅ Modifier l'avatar avec cropper
function editAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            showToast('Image trop volumineuse (max 10MB)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            openCropperModal(event.target.result);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function openCropperModal(imageSrc) {
    const cropperModal = document.getElementById('cropperModal');
    if (!cropperModal) {
        console.error('Modal cropper introuvable');
        return;
    }
    
    const imageToCrop = document.getElementById('imageToCrop');
    imageToCrop.src = imageSrc;
    
    cropperModal.classList.add('active');
    
    if (window.currentCropper) {
        window.currentCropper.destroy();
    }
    
    setTimeout(() => {
        window.currentCropper = new Cropper(imageToCrop, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    }, 100);
    
    const cancelBtn = document.getElementById('cancelCropBtn');
    cancelBtn.onclick = () => {
        closeCropperModal();
    };
    
    const saveBtn = document.getElementById('cropAndSaveBtn');
    saveBtn.onclick = async () => {
        await saveCroppedAvatar();
    };
}

function closeCropperModal() {
    const cropperModal = document.getElementById('cropperModal');
    if (cropperModal) {
        cropperModal.classList.remove('active');
    }
    
    if (window.currentCropper) {
        window.currentCropper.destroy();
        window.currentCropper = null;
    }
}

async function saveCroppedAvatar() {
    if (!window.currentCropper) return;
    
    try {
        const canvas = window.currentCropper.getCroppedCanvas({
            width: 400,
            height: 400,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });
        
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        
        const result = await apiRequest('/profile/avatar', {
            method: 'PUT',
            body: JSON.stringify({ avatar: base64 })
        });
        
        if (result) {
            profileData.user.avatar = base64;
            showToast('Avatar mis à jour !');
            closeCropperModal();
            await initProfile();
            
            const headerAvatar = document.getElementById('profileAvatar');
            if (headerAvatar) {
                headerAvatar.src = base64;
            }
        }
    } catch (error) {
        console.error('Erreur upload avatar:', error);
        showToast('Erreur lors de la mise à jour', 'error');
    }
}

// 1. Fonction pour OUVRIR la modale (Style identique à editUsername)
function editEmail() {
    const currentEmail = profileData.user.email || '';
    
    // Création dynamique de la modale
    const modal = document.createElement('div');
    modal.className = 'settings-modal active';
    modal.id = 'emailEditModal';
    modal.innerHTML = `
        <div class="settings-content" style="max-width: 400px; margin: auto; border-radius: 24px;">
            <div class="settings-handle"></div>
            <div class="settings-header">
                <div class="settings-header-top">
                    <h2 class="settings-title">Modifier l'email</h2>
                    <button class="settings-close-btn" onclick="closeEmailModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="settings-body">
                <div class="settings-input-group">
                    <input 
                        type="email" 
                        id="newEmailInput" 
                        class="settings-input" 
                        value="${currentEmail}"
                        placeholder="Nouvelle adresse email"
                    >
                </div>
                <button class="settings-btn-save" onclick="saveNewEmail()">
                    Enregistrer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Focus automatique sur le champ
    setTimeout(() => {
        const input = document.getElementById('newEmailInput');
        if(input) {
            input.focus();
            input.select();
        }
    }, 100);
    
    // Support de la touche "Entrée"
    document.getElementById('newEmailInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNewEmail();
        }
    });
}

async function saveNewEmail() {
    const input = document.getElementById('newEmailInput');
    const newEmail = input.value.trim();
    const currentEmail = profileData.user.email;

    // Vérification basique
    if (!newEmail || newEmail === currentEmail) {
        closeEmailModal();
        return;
    }

    // Ta validation Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        showToast('Format d\'email invalide', 'error');
        input.focus(); // On redonne le focus en cas d'erreur
        return;
    }

    // Appel API
    try {
        const response = await apiRequest('/profile', {
            method: 'PUT',
            body: JSON.stringify({ email: newEmail })
        });

        if (response && !response.error) {
            profileData.user.email = newEmail;
            
            const emailDisplay = document.querySelector('.profile-email');
            if (emailDisplay) emailDisplay.textContent = newEmail;
            
            showToast('Email mis à jour avec succès !', 'success');
            loadUserProfile();
            closeEmailModal();
        } else {
            showToast(response?.error || 'Erreur lors du changement d\'email', 'error');
        }
    } catch (error) {
        console.error('Erreur changement email:', error);
        showToast(error.message || 'Erreur lors du changement d\'email', 'error');
    }
}

// 3. Fonction pour FERMER la modale
function closeEmailModal() {
    const modal = document.getElementById('emailEditModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

function editPassword() {
    if (typeof window.openForgotPasswordModalprofile() === 'function') {
        window.openForgotPasswordModalprofile();
    }
}

function confirmLogout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        closeSettings()
        logout();
        switchView('movies');
    }
}

function confirmDeleteAccount() {
    const confirmation = prompt('Tapez "SUPPRIMER" pour confirmer la suppression définitive de votre compte:');
    if (confirmation === 'SUPPRIMER') {
        showToast('Fonctionnalité à venir', 'info');
    }
}

function showAllMovies(type) {
    if (type === 'watchlist') {
        switchView('watchlist');
    } else if (type === 'watched') {
        switchView('watched');
    } else {
        showToast('Fonctionnalité à venir', 'info');
    }
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('settingsModal');
    if (modal && e.target === modal) {
        closeSettings();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfile);
} else {
    initProfile();
}
// ✅ REMPLACER LA FONCTION manualSync dans profile.js

async function manualSync() {
    // Vérifier que OfflineStorage existe
    if (typeof OfflineStorage === 'undefined') {
        showToast('Service de synchronisation non disponible', 'error');
        return;
    }
    
    if (!OfflineStorage.isEnabled()) {
        showToast('Mode offline désactivé', 'error');
        return;
    }
    
    console.log('🔄 DÉBUT SYNCHRONISATION MANUELLE');
    showToast('Synchronisation en cours...', 'info');
    
    try {
        // S'assurer que la DB est initialisée
        await OfflineStorage.init();
        console.log('✅ DB initialisée');
        
        await OfflineStorage.syncAllData();
        console.log('✅ syncAllData terminé');
        
        // Mettre à jour l'affichage de la taille du cache
        const cacheSize = await OfflineStorage.getCacheSize();
        console.log('📊 Taille cache:', cacheSize);
        
        const cacheSizeElement = document.getElementById('cacheSize');
        if (cacheSizeElement) {
            cacheSizeElement.textContent = cacheSize;
        }
        
        showToast('✅ Données synchronisées !', 'success');
        
        // Recharger la page pour voir les changements
        setTimeout(() => {
            if (state.currentView === 'profile') {
                initProfile();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erreur sync complète:', error);
        console.error('Stack:', error.stack);      
        // Si erreur liée aux stores
        if (error.name === 'NotFoundError' || 
            (error.message && error.message.includes('object store'))) {
            
            const shouldReset = confirm(
                '⚠️ La base de données semble corrompue.\n\n' +
                'Voulez-vous la réinitialiser ?\n' +
                '(Vos données sur le serveur seront conservées)'
            );
            
            if (shouldReset) {
                try {
                    showToast('Réinitialisation en cours...', 'info');
                    await OfflineStorage.resetDatabase();
                    showToast('✅ Base réinitialisée !', 'success');
                    
                    // Relancer la synchro après 2 secondes
                    setTimeout(async () => {
                        showToast('Synchronisation des données...', 'info');
                        await OfflineStorage.syncAllData();
                        showToast('✅ Synchronisation terminée !', 'success');
                        
                        // Recharger le profil
                        if (state.currentView === 'profile') {
                            await initProfile();
                        }
                    }, 2000);
                    
                } catch (resetError) {
                    console.error('❌ Erreur reset:', resetError);
                    showToast('Impossible de réinitialiser. Rechargez la page.', 'error');
                }
            }
        } else {
            showToast('Erreur lors de la synchronisation', 'error');
        }
    }
}

// Rendre la fonction accessible globalement
window.manualSync = manualSync;

// ✅ AJOUTER AUSSI : Fonction pour réinitialiser manuellement depuis les settings
async function resetOfflineStorage() {
    if (typeof OfflineStorage === 'undefined') {
        showToast('Service non disponible', 'error');
        return;
    }
    
    const confirmed = confirm(
        '⚠️ ATTENTION ⚠️\n\n' +
        'Cela va supprimer TOUTES les données en cache local.\n' +
        'Vos données sur le serveur seront conservées.\n\n' +
        'Continuer ?'
    );
    
    if (!confirmed) return;
    
    try {
        showToast('Réinitialisation...', 'info');
        console.log('🗑️ Début du reset...');
        
        await OfflineStorage.resetDatabase();
        
        console.log('✅ Reset terminé');
        showToast('✅ Cache réinitialisé !', 'success');
        
        // Mettre à jour l'affichage
        const cacheSizeElement = document.getElementById('cacheSize');
        if (cacheSizeElement) {
            const newSize = await OfflineStorage.getCacheSize();
            cacheSizeElement.textContent = newSize;
        }
        
        // Proposer de resynchroniser
        setTimeout(() => {
            const shouldSync = confirm(
                '✅ Cache réinitialisé avec succès.\n\n' +
                'Voulez-vous synchroniser vos données maintenant ?'
            );
            
            if (shouldSync) {
                manualSync();
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ Erreur reset:', error);
        showToast('Erreur lors de la réinitialisation', 'error');
        
        // Si c'est bloqué, proposer de recharger la page
        if (error.message && error.message.includes('blocked')) {
            const shouldReload = confirm(
                '⚠️ La réinitialisation est bloquée.\n\n' +
                'Fermez tous les autres onglets de l\'application,\n' +
                'puis rechargez cette page.\n\n' +
                'Recharger maintenant ?'
            );
            
            if (shouldReload) {
                window.location.reload();
            }
        }
    }
}

window.resetOfflineStorage = resetOfflineStorage;


// Fonction toggle pour le mode offline
function toggleOfflineMode(toggleElement) {
    if (typeof OfflineStorage === 'undefined') {
        showToast('Service offline non disponible', 'error');
        return;
    }
    
    const isCurrentlyEnabled = OfflineStorage.isEnabled();
    const newState = !isCurrentlyEnabled;
    
    OfflineStorage.setEnabled(newState);
    toggleElement.classList.toggle('active', newState);
    
    const valueDisplay = document.getElementById('offlineModeValue');
    if (valueDisplay) {
        valueDisplay.textContent = newState ? 'Données en local' : 'Désactivé';
    }
    
    if (newState) {
        showToast('Mode offline activé - Synchronisation...', 'info');
    } else {
        showToast('Mode offline désactivé', 'info');
    }
}

window.toggleOfflineMode = toggleOfflineMode;