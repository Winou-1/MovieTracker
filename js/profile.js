// profile.js - Gestion du profil moderne - VERSION COMPLÈTE

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

// Initialiser le profil
async function initProfile() {
    if (!getToken()) {
        window.location.href = '/login.html';
        return;
    }

    try {
        await Promise.all([
            loadUserProfile(),
            loadUserStats(),
            loadLikedMovies(),
            loadWatchlistMovies(),
            loadWatchedMovies()
        ]);

        renderProfile();
    } catch (error) {
        console.error('Erreur chargement profil:', error);
        showToast('Erreur de chargement', 'error');
    }
}

// Charger les données utilisateur
async function loadUserProfile() {
    try {
        const data = await apiRequest('/profile');
        profileData.user = data;
        return data;
    } catch (error) {
        throw error;
    }
}

// Charger les statistiques
async function loadUserStats() {
    try {
        const stats = await apiRequest('/stats');
        
        profileData.stats = {
            rated_count: stats.rated_count || 0,
            reviews_count: stats.reviews_count || 0,
            watchlist_count: stats.watchlist_count || 0,
            average_rating: stats.average_rating || 0
        };

        const watchedData = await apiRequest('/watched');
        profileData.stats.watched_count = watchedData.length || 0;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        profileData.stats.watched_this_month = watchedData.filter(movie => {
            const watchedDate = new Date(movie.watched_at);
            return watchedDate.getMonth() === currentMonth && 
                   watchedDate.getFullYear() === currentYear;
        }).length;

        profileData.stats.total_hours = Math.round((profileData.stats.watched_count * 120) / 60);

        return profileData.stats;
    } catch (error) {
        console.error('Erreur stats:', error);
        return {};
    }
}

// Charger les films likés
async function loadLikedMovies() {
    try {
        const likes = await apiRequest('/likes/all');
        
        if (!likes || likes.length === 0) {
            profileData.likedMovies = [];
            return [];
        }

        const recentLikes = likes.slice(0, 6);
        const moviesPromises = recentLikes.map(async (like) => {
            try {
                const response = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${like.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const movie = await response.json();
                return {
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path
                };
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

// Charger la watchlist
async function loadWatchlistMovies() {
    try {
        const watchlist = await apiRequest('/watchlist');
        profileData.watchlistMovies = watchlist.slice(0, 6);
        return profileData.watchlistMovies;
    } catch (error) {
        console.error('Erreur watchlist:', error);
        profileData.watchlistMovies = [];
        return [];
    }
}

// Charger les films vus
async function loadWatchedMovies() {
    try {
        const watched = await apiRequest('/watched');
        profileData.watchedMovies = watched.slice(0, 6);
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

    const user = profileData.user;
    const stats = profileData.stats;

    container.innerHTML = `
        <div class="profile-header">
            <button class="profile-settings-btn" onclick="openSettings()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
            <div class="profile-header-content">
                <div class="profile-avatar-wrapper">
                    <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username) + '&background=2563eb&color=fff&size=200'}" 
                         alt="${user.username}" 
                         class="profile-avatar">
                </div>
                <div class="profile-info">
                    <h2>${user.username}</h2>
                    <p class="profile-email">${user.email}</p>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">🎬</span>
                    <span class="stat-card-value">${stats.watched_count}</span>
                </div>
                <div class="stat-card-label">Films vus</div>
                <div class="stat-card-sublabel">Au total</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">📅</span>
                    <span class="stat-card-value">${stats.watched_this_month}</span>
                </div>
                <div class="stat-card-label">Ce mois</div>
                <div class="stat-card-sublabel">${new Date().toLocaleDateString('fr-FR', { month: 'long' })}</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">⏱️</span>
                    <span class="stat-card-value">${stats.total_hours}h</span>
                </div>
                <div class="stat-card-label">Temps total</div>
                <div class="stat-card-sublabel">Visionnage</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">⭐</span>
                    <span class="stat-card-value">${stats.average_rating}/10</span>
                </div>
                <div class="stat-card-label">Note moy.</div>
                <div class="stat-card-sublabel">${stats.rated_count} notes</div>
            </div>
        </div>

        <div class="stats-inline">
            <div class="stat-inline-item">
                <div class="stat-inline-value">${stats.reviews_count || 0}</div>
                <div class="stat-inline-label">Avis</div>
            </div>
            <div class="stat-inline-item">
                <div class="stat-inline-value">${profileData.likedMovies.length}</div>
                <div class="stat-inline-label">Favoris</div>
            </div>
            <div class="stat-inline-item">
                <div class="stat-inline-value">${stats.watchlist_count}</div>
                <div class="stat-inline-label">À voir</div>
            </div>
        </div>

        ${renderMoviesSection('❤️ Films aimés', profileData.likedMovies, 'liked')}
        ${renderMoviesSection('📖 À voir', profileData.watchlistMovies, 'watchlist')}
        ${renderMoviesSection('👁️ Vus récemment', profileData.watchedMovies, 'watched')}
    `;

    createSettingsModal();
}

// Rendre une section de films
function renderMoviesSection(title, movies, type) {
    if (!movies || movies.length === 0) {
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
                ${movies.map(movie => `
                    <div class="movie-mini-card" onclick="showMovieDetails(${movie.movie_id || movie.id})">
                        <img src="${movie.movie_poster ? CONFIG.TMDB_IMG_URL + movie.movie_poster : (movie.poster_path ? CONFIG.TMDB_IMG_URL + movie.poster_path : '')}" 
                             alt="${movie.movie_title || movie.title}" 
                             class="movie-mini-poster">
                        <div class="movie-mini-title">${movie.movie_title || movie.title}</div>
                    </div>
                `).join('')}
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

                    <div class="settings-option">
                        <div class="settings-option-header">
                            <div class="settings-option-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                </svg>
                            </div>
                            <div class="settings-option-info">
                                <div class="settings-option-label">Langue</div>
                                <div class="settings-option-value">Français</div>
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
                    </div>
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

    document.body.appendChild(modal);
    setupSettingsEvents();
}

function setupSettingsEvents() {
    document.getElementById('setting-avatar')?.addEventListener('click', () => editAvatar());
    document.getElementById('setting-username')?.addEventListener('click', () => editUsername());
    document.getElementById('setting-email')?.addEventListener('click', () => editEmail());
    document.getElementById('setting-password')?.addEventListener('click', () => editPassword());
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

// ✅ Modifier le pseudo avec modal
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

function editEmail() {
    showToast('Fonctionnalité à venir', 'info');
}

function editPassword() {
    // La fonction est maintenant dans forgot-password.js
    if (typeof window.editPassword === 'function') {
        window.editPassword();
    }
}

function confirmLogout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        logout();
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