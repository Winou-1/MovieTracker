let friendsState = {
    friends: [],
    requests: [],
    searchResults: [],
    currentTab: 'friends'
};

// Initialiser la section amis
async function initFriendsSection() {
    if (!getToken()) {
        switchView('movies');
        openAuthModal(true);
        return;
    }
    
    await loadFriends();
    await loadFriendRequests();
    renderFriendsSection();
}

// Charger la liste d'amis
async function loadFriends() {
    try {
        const friends = await apiRequest('/friends');
        friendsState.friends = friends || [];
    } catch (error) {
        console.error('Erreur chargement amis:', error);
        friendsState.friends = [];
    }
}

// Charger les demandes d'amis
async function loadFriendRequests() {
    try {
        const requests = await apiRequest('/friends/requests');
        friendsState.requests = requests || [];
    } catch (error) {
        console.error('Erreur chargement demandes:', error);
        friendsState.requests = [];
    }
}

// tout est dans le nom
async function searchUsers(query) {
    const resultsContainer = document.getElementById('userSearchResults');
    const input = document.getElementById('userSearchInput');
    const cleanQuery = query.replace(/\D/g, ''); 
    if (cleanQuery !== query) {
        input.value = cleanQuery;
    }
    clearTimeout(window.searchTimeout);
    if (cleanQuery.length !== 6) {
        if (resultsContainer) resultsContainer.innerHTML = '';
        return;
    }
    window.searchTimeout = setTimeout(async () => {
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div style="text-align:center; padding:20px;"><div class="loader"></div></div>';
        }

        try {
            const results = await apiRequest(`/friends/search?q=${cleanQuery}`);
            friendsState.searchResults = results || [];

            if (resultsContainer) {
                resultsContainer.innerHTML = renderOnlyResultsHTML();
            }
        } catch (error) {
            console.error('Erreur:', error);
            if (resultsContainer) resultsContainer.innerHTML = '<p class="text-error">Erreur recherche</p>';
        }
    }, 300);
}

// Fonction helper pour générer le HTML des résultats seulement
function renderOnlyResultsHTML() {
    if (friendsState.searchResults.length === 0) {
        return `
            <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🔍</div>
                <p style="font-size: 16px; margin-bottom: 8px;">Aucun utilisateur trouvé</p>
                <p style="font-size: 13px; opacity: 0.7;">Vérifiez le code ami à 6 chiffres</p>
            </div>
        `;
    }

    return friendsState.searchResults.map(user => `
        <div class="friend-card search-result" style="cursor: default;">
            <div class="friend-info-left" style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div class="friend-avatar" style="cursor: pointer;" onclick="event.stopPropagation(); viewFriendProfile(${user.id})">
                    ${user.avatar 
                        ? `<img src="${user.avatar}" alt="${user.username}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 50%; border: 2px solid var(--primary);">` 
                        : `<div class="avatar-placeholder" style="width: 56px; height: 56px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700;">${user.username[0].toUpperCase()}</div>`
                    }
                </div>
                <div class="friend-details" style="cursor: pointer; flex: 1;" onclick="event.stopPropagation(); viewFriendProfile(${user.id})">
                    <div class="friend-username" style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${user.username}</div>
                    <div class="friend-code" style="font-family: monospace; color: var(--text-secondary); font-size: 12px;">#${user.friend_code}</div>
                </div>
            </div>
            
            <div class="friend-action" onclick="event.stopPropagation();">
                ${user.is_friend 
                    ? '<span class="badge-friend" style="background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;">Déjà ami</span>'
                    : user.has_requested 
                        ? '<span class="badge-pending" style="background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;">En attente</span>'
                        : user.has_received
                            ? '<button class="btn-primary btn-sm" onclick="event.stopPropagation(); acceptFriendRequest(' + user.id + ')" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Accepter</button>'
                            : `<button class="btn-icon-add" onclick="event.stopPropagation(); sendFriendRequest(${user.id})" title="Envoyer une demande" style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                 </svg>
                               </button>`
                }
            </div>
        </div>
    `).join('');
}

// Envoyer une demande d'ami
async function sendFriendRequest(friendId) {
    try {
        await apiRequest('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ friend_id: friendId })
        });
        showToast('Demande envoyée !');
        await searchUsers(document.getElementById('userSearchInput').value);
    } catch (error) {
        showToast('Erreur lors de l\'envoi', 'error');
    }
}

// Accepter une demande
async function acceptFriendRequest(friendId) {
    try {
        await apiRequest(`/friends/accept/${friendId}`, { method: 'PUT' });
        showToast('Ami ajouté !');
        await loadFriends();
        await loadFriendRequests();
        renderFriendsSection();
    } catch (error) {
        showToast('Erreur', 'error');
    }
}

// Supprimer un ami ou refuser
async function removeFriend(friendId) {
    if (!confirm('Êtes-vous sûr ?')) return;
    
    try {
        await apiRequest(`/friends/${friendId}`, { method: 'DELETE' });
        showToast('Ami supprimé');
        await loadFriends();
        await loadFriendRequests();
        renderFriendsSection();
    } catch (error) {
        showToast('Erreur', 'error');
    }
}

// Voir le profil d'un ami
async function viewFriendProfile(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'friendProfileModal';
    modal.innerHTML = `
        <div class="modal-content friend-profile-modal" style="max-width: 700px; max-height: 90vh; overflow-y: auto; border-radius: 12px; position: relative;">
            <button class="close-modal" onclick="closeFriendProfile()">&times;</button>
            <div class="loading">Chargement...</div>
        </div>
    `;
    document.body.appendChild(modal);
    
    try {
        const profile = await apiRequest(`/profile/${userId}`);
        
        if (profile.is_private) {
            modal.querySelector('.modal-content').innerHTML = `
                <button class="close-modal" onclick="closeFriendProfile()">&times;</button>
                <div class="friend-profile-private">
                    <div class="friend-profile-private-icon">🔒</div>
                    <div class="friend-profile-private-avatar">
                        <img src="${profile.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.username)}" 
                             alt="${profile.username}">
                    </div>
                    <h2>${profile.username}</h2>
                    <p class="friend-profile-private-text">Ce profil est privé</p>
                    ${profile.friendship_status === 'pending' ? 
                        '<div class="friend-profile-badge">Demande en attente</div>' : ''}
                    ${!profile.friendship_status ? 
                        `<button class="btn" onclick="sendFriendRequest(${profile.id}); closeFriendProfile();">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="8.5" cy="7" r="4"/>
                                <line x1="20" y1="8" x2="20" y2="14"/>
                                <line x1="23" y1="11" x2="17" y2="11"/>
                            </svg>
                            Envoyer une demande
                        </button>` : ''}
                </div>
            `;
            return;
        }
        
        const watchedMovies = (profile.watched && profile.watched.length > 0) 
        ? await Promise.all(profile.watched.slice(0, 8).map(async (w) => {
                try {
                    const response = await fetch(
                        `${CONFIG.TMDB_BASE_URL}/movie/${w.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                    );
                    return await response.json();
                } catch {
                    return null;
                }
            }))
    : [];
        
        const likedMovies = (profile.likes && profile.likes.length > 0)
    ? await Promise.all(profile.likes.slice(0, 8).map(async (movieId) => {
                try {
                    const response = await fetch(
                        `${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                    );
                    return await response.json();
                } catch {
                    return null;
                }
            }))
    : [];
        
        modal.querySelector('.modal-content').innerHTML = `
            <button class="close-modal" onclick="closeFriendProfile()">&times;</button>
            
            <div class="friend-profile-header">
                <div class="friend-profile-cover"></div>
                <div class="friend-profile-avatar-wrapper">
                    <img src="${profile.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.username)}" 
                         alt="${profile.username}" 
                         class="friend-profile-avatar">
                </div>
                <div class="friend-profile-info">
                    <h2 class="friend-profile-username">${profile.username}</h2>
                    <p class="friend-profile-since">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        Ami depuis ${new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>
            
            <div class="friend-profile-stats">
                <div class="friend-profile-stat">
                    <div class="friend-profile-stat-icon">🎬</div>
                    <div class="friend-profile-stat-content">
                        <div class="friend-profile-stat-value">${profile.stats?.watched_count || 0}</div>
                        <div class="friend-profile-stat-label">Films vus</div>
                    </div>
                </div>
                <div class="friend-profile-stat">
                    <div class="friend-profile-stat-icon">❤️</div>
                    <div class="friend-profile-stat-content">
                        <div class="friend-profile-stat-value">${profile.stats?.likes_count || 0}</div>
                        <div class="friend-profile-stat-label">Favoris</div>
                    </div>
                </div>
                <div class="friend-profile-stat">
                    <div class="friend-profile-stat-icon">📌</div>
                    <div class="friend-profile-stat-content">
                        <div class="friend-profile-stat-value">${profile.stats?.watchlist_count || 0}</div>
                        <div class="friend-profile-stat-label">À voir</div>
                    </div>
                </div>
                <div class="friend-profile-stat">
                    <div class="friend-profile-stat-icon">⭐</div>
                    <div class="friend-profile-stat-content">
                        <div class="friend-profile-stat-value">${profile.stats?.average_rating || 0}</div>
                        <div class="friend-profile-stat-label">Note moy.</div>
                    </div>
                </div>
            </div>
            
            ${likedMovies.filter(m => m).length > 0 ? `
                <div class="friend-profile-section">
                    <h3 class="friend-profile-section-title">
                        <span class="friend-profile-section-icon">❤️</span>
                        Coups de cœur
                    </h3>
                    <div class="friend-profile-movies">
                        ${likedMovies.filter(m => m).map(movie => `
                            <div class="friend-profile-movie" onclick="showMovieDetails(${movie.id}); closeFriendProfile();">
                                <img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">
                                <div class="friend-profile-movie-overlay">
                                    <div class="friend-profile-movie-title">${movie.title}</div>
                                    <div class="friend-profile-movie-rating">⭐ ${movie.vote_average.toFixed(1)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${watchedMovies.filter(m => m).length > 0 ? `
                <div class="friend-profile-section">
                    <h3 class="friend-profile-section-title">
                        <span class="friend-profile-section-icon">👁️</span>
                        Films vus récemment
                    </h3>
                    <div class="friend-profile-movies">
                        ${watchedMovies.filter(m => m).map(movie => `
                            <div class="friend-profile-movie" onclick="showMovieDetails(${movie.id}); closeFriendProfile();">
                                <img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">
                                <div class="friend-profile-movie-overlay">
                                    <div class="friend-profile-movie-title">${movie.title}</div>
                                    <div class="friend-profile-movie-rating">⭐ ${movie.vote_average.toFixed(1)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${likedMovies.filter(m => m).length === 0 && watchedMovies.filter(m => m).length === 0 ? `
                <div class="friend-profile-empty">
                    <div class="friend-profile-empty-icon">🎬</div>
                    <p>Aucune activité récente</p>
                </div>
            ` : ''}
        `;
        
    } catch (error) {
        console.error('Erreur chargement profil:', error);
        showToast('Erreur de chargement', 'error');
        closeFriendProfile();
    }
}

function closeFriendProfile() {
    const modal = document.getElementById('friendProfileModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    document.body.style.overflow = '';
}

// netoyer les zombis là
function cleanupModals() {
    const orphanModals = document.querySelectorAll('#friendProfileModal');
    orphanModals.forEach(modal => {
        modal.remove();
    });
    document.body.style.overflow = '';
}

function renderFriendsSection() {
    const container = document.querySelector('#friendsSection .container');
    if (!container) return;
    
    container.innerHTML = `
        <h2 class="title">Amis</h2>
        
        <div class="friends-tabs">
            <button class="friends-tab ${friendsState.currentTab === 'friends' ? 'active' : ''}" onclick="switchFriendsTab('friends')">
                Mes amis (${friendsState.friends.length})
            </button>
            <button class="friends-tab ${friendsState.currentTab === 'requests' ? 'active' : ''}" onclick="switchFriendsTab('requests')">
                Demandes ${friendsState.requests.length > 0 ? `<span class="badge">${friendsState.requests.length}</span>` : ''}
            </button>
            <button class="friends-tab ${friendsState.currentTab === 'search' ? 'active' : ''}" onclick="switchFriendsTab('search')">
                Rechercher
            </button>
        </div>
        
        <div id="friendsTabContent"></div>
    `;
    
    renderFriendsTab();
}

function switchFriendsTab(tab) {
    friendsState.currentTab = tab;
    renderFriendsSection();
}

function renderFriendsTab() {
    const content = document.getElementById('friendsTabContent');
    
    if (friendsState.currentTab === 'friends') {
        content.innerHTML = `
            <div class="friends-list">
                ${friendsState.friends.length === 0 ? `
                    <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">👥</div>
                        <h3 style="color: var(--text-primary); margin-bottom: 12px; font-size: 20px;">Aucun ami pour le moment</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 24px;">Recherchez des utilisateurs avec leur code ami</p>
                        <button class="btn" onclick="switchFriendsTab('search')" style="padding: 12px 24px;">
                            Rechercher des amis
                        </button>
                    </div>
                ` : ''}
                ${friendsState.friends.map(friend => `
                    <div class="friend-card" style="cursor: default;">
                        <div style="display: flex; align-items: center; gap: 16px; flex: 1; cursor: pointer;" onclick="viewFriendProfile(${friend.id})">
                            <img src="${friend.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(friend.username)}" alt="${friend.username}" class="friend-avatar" style="flex-shrink: 0;">
                            <div class="friend-info" style="flex: 1;">
                                <div class="friend-name">${friend.username}</div>
                                <div class="friend-meta">Ami depuis ${new Date(friend.friend_since).toLocaleDateString('fr-FR')}</div>
                            </div>
                        </div>
                        <div class="friend-actions" onclick="event.stopPropagation();">
                            <button class="friend-btn friend-btn-secondary" onclick="removeFriend(${friend.id})">Retirer</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (friendsState.currentTab === 'requests') {
        content.innerHTML = `
            <div class="friends-list">
                ${friendsState.requests.length === 0 ? `
                    <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📭</div>
                        <h3 style="color: var(--text-primary); font-size: 20px;">Aucune demande en attente</h3>
                    </div>
                ` : ''}
                ${friendsState.requests.map(request => `
                    <div class="friend-card" style="cursor: default;">
                        <div style="display: flex; align-items: center; gap: 16px; flex: 1; cursor: pointer;" onclick="viewFriendProfile(${request.id})">
                            <img src="${request.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(request.username)}" alt="${request.username}" class="friend-avatar" style="flex-shrink: 0;">
                            <div class="friend-info" style="flex: 1;">
                                <div class="friend-name">${request.username}</div>
                                <div class="friend-meta">Il y a ${timeSince(request.requested_at)}</div>
                            </div>
                        </div>
                        <div class="friend-actions" onclick="event.stopPropagation();">
                            <button class="friend-btn friend-btn-primary" onclick="acceptFriendRequest(${request.id})">Accepter</button>
                            <button class="friend-btn friend-btn-secondary" onclick="removeFriend(${request.id})">Refuser</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (friendsState.currentTab === 'search') {
        const userCode = state.user?.friend_code || '000000';
        
        content.innerHTML = `
            <div class="my-friend-code" style="background: var(--bg-card); padding: 20px; border-radius: 16px; margin-bottom: 24px; text-align: center; border: 2px solid var(--primary);">
                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Mon code ami</p>
                <div style="font-family: monospace; font-size: 32px; font-weight: 700; color: var(--primary); letter-spacing: 4px; margin-bottom: 12px;">#${userCode}</div>
                <button onclick="copyFriendCode('${userCode}')" style="padding: 8px 16px; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 8px; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer;">
                    📋 Copier mon code
                </button>
            </div>
            
            <div class="friends-search">
                <div style="margin-bottom: 12px;">
                    <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">
                        🔍 Rechercher un ami par son code
                    </p>
                </div>
                <input 
                    type="text" 
                    id="userSearchInput"
                    class="friends-search-input" 
                    placeholder="Entrez le code à 6 chiffres (ex: 123456)..." 
                    maxlength="6"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    onkeyup="searchUsers(this.value)"
                    style="width: 100%; padding: 16px; border: 2px solid rgba(68, 85, 102, 0.3); border-radius: 12px; background: var(--bg-elevated); color: var(--text-primary); font-size: 16px; font-family: monospace; letter-spacing: 4px; text-align: center;"
                >
            </div>
            
            <div id="userSearchResults" class="friends-list" style="margin-top: 24px;">
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🔍</div>
                    <p style="font-size: 14px;">Entrez un code ami pour commencer</p>
                </div>
            </div>
        `;
    }
}

function copyFriendCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('Code copié ! 📋');
    }).catch(() => {
        showToast('Impossible de copier', 'error');
    });
}

function timeSince(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const intervals = {
        'an': 31536000,
        'mois': 2592000,
        'jour': 86400,
        'heure': 3600,
        'minute': 60
    };
    
    for (const [name, value] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / value);
        if (interval >= 1) {
            return `${interval} ${name}${interval > 1 && name !== 'mois' ? 's' : ''}`;
        }
    }
    return 'à l\'instant';
}

// Ajouter l'option de confidentialité dans les settings
window.openPrivacySettings = function() {
    const modal = document.createElement('div');
    modal.className = 'settings-modal active';
    modal.id = 'privacyModal';
    
    const currentPrivacy = profileData.user?.profile_privacy || 'public';
    
    modal.innerHTML = `
        <div class="settings-content" style="max-width: 500px; margin: auto; border-radius: 24px;">
            <div class="settings-handle"></div>
            <div class="settings-header">
                <div class="settings-header-top">
                    <h2 class="settings-title">Confidentialité du profil</h2>
                    <button class="settings-close-btn" onclick="closePrivacyModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="settings-body">
                <div class="privacy-options">
                    <div class="privacy-option ${currentPrivacy === 'public' ? 'active' : ''}" onclick="selectPrivacy('public')">
                        <div class="privacy-option-icon">🌍</div>
                        <div class="privacy-option-info">
                            <div class="privacy-option-title">Public</div>
                            <div class="privacy-option-desc">Tout le monde peut voir votre profil</div>
                        </div>
                    </div>
                    
                    <div class="privacy-option ${currentPrivacy === 'friends_only' ? 'active' : ''}" onclick="selectPrivacy('friends_only')">
                        <div class="privacy-option-icon">👥</div>
                        <div class="privacy-option-info">
                            <div class="privacy-option-title">Amis uniquement</div>
                            <div class="privacy-option-desc">Seuls vos amis peuvent voir votre profil</div>
                        </div>
                    </div>
                    
                    <div class="privacy-option ${currentPrivacy === 'private' ? 'active' : ''}" onclick="selectPrivacy('private')">
                        <div class="privacy-option-icon">🔒</div>
                        <div class="privacy-option-info">
                            <div class="privacy-option-title">Privé</div>
                            <div class="privacy-option-desc">Personne ne peut voir votre profil</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
};

window.closePrivacyModal = function() {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
};

window.selectPrivacy = async function(privacy) {
    try {
        await apiRequest('/profile/privacy', {
            method: 'PUT',
            body: JSON.stringify({ privacy })
        });
        
        if (profileData.user) {
            profileData.user.profile_privacy = privacy;
        }
        
        showToast('Confidentialité mise à jour !');
        closePrivacyModal();
        
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && settingsModal.classList.contains('active')) {
            closeSettings();
            setTimeout(() => {
                createSettingsModal();
                openSettings();
            }, 100);
        }
    } catch (error) {
        showToast('Erreur', 'error');
    }
};

window.showFriendsWhoWatched = async function(movieId) {
    try {
        const friends = await apiRequest(`/movies/${movieId}/friends`);
        
        if (!friends || friends.length === 0) return '';
        
        return `
            <div class="movie-friends-badge">
                <div class="movie-friends-avatars">
                    ${friends.slice(0, 3).map(friend => `
                        <img src="${friend.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(friend.username)}" 
                             alt="${friend.username}" 
                             class="movie-friend-avatar"
                             title="${friend.username}${friend.rating ? ` - ${friend.rating}/10` : ''}"
                             onclick="event.stopPropagation(); viewFriendProfile(${friend.id})">
                    `).join('')}
                </div>
                <div class="movie-friends-text">
                    ${friends.length} ami${friends.length > 1 ? 's' : ''} ${friends[0].has_liked ? '❤️' : '👁️'}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erreur amis film:', error);
        return '';
    }
};

// fermeture quand on clique en dehors
window.addEventListener('click', (event) => {
    const friendsInteractionModal = document.getElementById('friendsInteractionModal');
    if (friendsInteractionModal && event.target === friendsInteractionModal) {
        friendsInteractionModal.style.display = 'none';
    }
    const movieModal = document.getElementById('movieModal');
    if (movieModal && event.target === movieModal) {
        if (typeof closeMovieModal === 'function') {
            closeMovieModal();
        } else {
            movieModal.style.display = 'none';
            movieModal.classList.remove('active');
        }
    }
    
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && event.target === settingsModal) {
        if (typeof closeSettings === 'function') {
            closeSettings();
        } else {
            settingsModal.classList.remove('active');
        }
    }
});