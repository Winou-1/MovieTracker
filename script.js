// script.js - Version améliorée avec Swiper et profil avancé

const CONFIG = {
    //API_URL: 'http://localhost:3000/api',
    API_URL: '/.netlify/functions/api',
    TMDB_API_KEY: 'f05382a7b84dc7c40d1965fb01e19f2b',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMG_URL: 'https://image.tmdb.org/t/p/w500'
};

const state = {
    user: null,
    token: null,
    movies: [],
    watchlist: [],
    watched: [],
    currentView: 'swiper',
    swiperMovies: [],
    swiperIndex: 0,
    userProfile: {
        avatar: null,
        username: '',
        email: ''
    }
};

// ==================== UTILS ====================

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
    state.token = token;
}

function clearToken() {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401 || response.status === 403) {
            clearToken();
            updateUI();
            showToast('Session expirée, veuillez vous reconnecter', 'error');
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== AUTHENTIFICATION ====================

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

    document.getElementById('authForm').reset();
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
        document.getElementById('authModal').classList.remove('active');
        updateUI();
        loadUserData();
        setupMobileProfileClick();
        showToast('Connexion réussie !');
        switchView('swiper');
    } else {
        document.getElementById('authError').textContent = data?.error || 'Erreur';
        document.getElementById('authError').style.display = 'block';
    }
}

function logout() {
    clearToken();
    state.userProfile = { avatar: null, username: '', email: '' };
    updateUI();
    switchView('movies');
    showToast('Déconnexion réussie');
}

async function loadUserData() {
    if (!getToken()) return;

    const stats = await apiRequest('/stats');
    if (stats) {
        document.getElementById('statRated').textContent = stats.rated_count;
        document.getElementById('statAverage').textContent = stats.average_rating;
        document.getElementById('statReviews').textContent = stats.reviews_count;
        document.getElementById('statWatchlist').textContent = stats.watchlist_count;
    }

    const watchlist = await apiRequest('/watchlist');
    if (watchlist) state.watchlist = watchlist;

    const watched = await apiRequest('/watched');
    if (watched) state.watched = watched;

    // Charger l'avatar depuis localStorage
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar) {
        state.userProfile.avatar = savedAvatar;
    }
}

// ==================== UI ====================

function updateUI() {
    const isLoggedIn = !!getToken();
    document.getElementById('authButtons').style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('userMenu').style.display = isLoggedIn ? 'flex' : 'none';

    if (isLoggedIn && state.user) {
        document.getElementById('usernameDisplay').textContent = state.userProfile.username || state.user.username;
    }
}

function setupMobileProfileClick() {
    const userMenu = document.getElementById('userMenu');
    
    // Détection mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile && userMenu) {
        userMenu.style.cursor = 'pointer';
        
        // Supprime l'ancien listener s'il existe
        userMenu.replaceWith(userMenu.cloneNode(true));
        
        // Récupère le nouveau noeud
        const newUserMenu = document.getElementById('userMenu');
        
        newUserMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (getToken()) {
                switchView('profile');
                updateMobileNav('mobileNavProfile');
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

    // Mise à jour de la navigation mobile
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });

    switch(view) {
        case 'movies':
            document.getElementById('searchSection').style.display = 'block';
            document.getElementById('moviesSection').style.display = 'block';
            document.getElementById('mobileNavFilms')?.classList.add('active');
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
            document.getElementById('profileSection').style.display = 'block';
            document.getElementById('mobileNavProfile')?.classList.add('active');
            loadProfile();
            break;
        case 'swiper':
            document.getElementById('swiperSection').style.display = 'block';
            document.getElementById('mobileNavSwiper')?.classList.add('active');
            loadSwiperMovies();
            break;
    }
}

// ==================== SWIPER ====================

async function loadSwiperMovies() {
    if (!getToken()) {
        document.getElementById('swiperContainer').innerHTML = `
            <div class="swiper-empty">
                <h3>Connecte-toi pour découvrir des films</h3>
            </div>
        `;
        return;
    }

    // Récupérer les IDs des films déjà vus ou en watchlist
    const watchedIds = state.watched.map(m => m.movie_id);
    const watchlistIds = state.watchlist.map(m => m.movie_id);
    const excludedIds = [...watchedIds, ...watchlistIds];

    // Charger des films populaires
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=${Math.floor(Math.random() * 5) + 1}`
        );
        const data = await response.json();
        
        // Filtrer les films déjà vus/en watchlist
        state.swiperMovies = data.results.filter(m => !excludedIds.includes(m.id));
        state.swiperIndex = 0;
        
        if (state.swiperMovies.length > 0) {
            displaySwiperMovie();
        } else {
            document.getElementById('swiperContainer').innerHTML = `
                <div class="swiper-empty">
                    <h3>Plus de films à découvrir !</h3>
                    <p>Reviens plus tard pour de nouvelles suggestions</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur chargement swiper:', error);
    }
}

function displaySwiperMovie() {
    const container = document.getElementById('swiperContainer');
    const movie = state.swiperMovies[state.swiperIndex];
    
    if (!movie) {
        loadSwiperMovies();
        return;
    }

    const poster = movie.poster_path ? `${CONFIG.TMDB_IMG_URL}${movie.poster_path}` : 'placeholder.jpg';
    const backdrop = movie.backdrop_path ? `${CONFIG.TMDB_IMG_URL}${movie.backdrop_path}` : poster;
    const year = movie.release_date ? movie.release_date.split('-')[0] : '';

    container.innerHTML = `
        <div class="swiper-backdrop" style="background-image: url('${backdrop}')"></div>
        <div class="swiper-card-modern">
            <div class="swiper-close" onclick="switchView('movies')">×</div>
            <div class="swiper-header">
                <h2 class="swiper-title-modern">${movie.title}</h2>
                <div class="swiper-year-modern">${year}</div>
            </div>
            <div class="swiper-poster-modern">
                <img src="${poster}" alt="${movie.title}">
            </div>
            <div class="swiper-actions-modern">
                <button class="swiper-action-modern" onclick="addToWatchedSwiper(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')" title="Marquer comme vu">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>Watch</span>
                </button>
                <button class="swiper-action-modern star" onclick="showMovieDetails(${movie.id})" title="Noter">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>Rate</span>
                </button>
                <button class="swiper-action-modern" onclick="addToWatchlistSwiper(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')" title="Ajouter à la watchlist">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    <span>Watchlist</span>
                </button>
            </div>
        </div>
    `;
}

async function addToWatchlistSwiper(movieId, title, posterPath) {
    await apiRequest('/watchlist', {
        method: 'POST',
        body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
    });
    state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
    showToast('Ajouté à la watchlist');
    nextSwiperMovie();
}

async function addToWatchedSwiper(movieId, title, posterPath) {
    await apiRequest('/watched', {
        method: 'POST',
        body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
    });
    state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
    showToast('Marqué comme vu');
    nextSwiperMovie();
}

function nextSwiperMovie() {
    state.swiperIndex++;
    if (state.swiperIndex >= state.swiperMovies.length) {
        loadSwiperMovies();
    } else {
        displaySwiperMovie();
    }
}

function prevSwiperMovie() {
    if (state.swiperIndex > 0) {
        state.swiperIndex--;
        displaySwiperMovie();
    }
}

// ==================== TRAILER ====================

async function showTrailer(movieId) {
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
        );
        const data = await response.json();
        
        const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        
        if (trailer) {
            window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
        } else {
            showToast('Aucun trailer disponible', 'error');
        }
    } catch (error) {
        showToast('Erreur lors du chargement du trailer', 'error');
    }
}

// ==================== PROFILE ====================

async function loadProfile() {
    if (!getToken()) return;

    await loadUserData();

    // Afficher l'avatar
    const avatarImg = document.getElementById('profileAvatar');
    if (state.userProfile.avatar) {
        avatarImg.src = state.userProfile.avatar;
    }

    // Afficher les infos
    document.getElementById('profileUsername').textContent = state.userProfile.username || state.user.username;
    document.getElementById('profileEmail').textContent = state.userProfile.email || state.user.email;

    // Charger les genres favoris
    await loadFavoriteGenres();
}

async function loadFavoriteGenres() {
    const watched = await apiRequest('/watched');
    if (!watched || watched.length === 0) {
        document.getElementById('genreList').innerHTML = '<p>Regarde des films pour voir tes genres préférés</p>';
        return;
    }

    const genreCount = {};
    
    for (const movie of watched.slice(0, 20)) {
        try {
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/movie/${movie.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
            );
            const data = await response.json();
            
            if (data.genres) {
                data.genres.forEach(genre => {
                    genreCount[genre.name] = (genreCount[genre.name] || 0) + 1;
                });
            }
        } catch (e) {
            console.error('Erreur chargement genre:', e);
        }
    }

    const sortedGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const genreList = document.getElementById('genreList');
    genreList.innerHTML = sortedGenres.map(([genre, count]) => `
        <div class="genre-tag">
            ${genre} <span class="genre-count">${count}</span>
        </div>
    `).join('');
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const avatar = event.target.result;
        state.userProfile.avatar = avatar;
        localStorage.setItem('userAvatar', avatar);
        document.getElementById('profileAvatar').src = avatar;
        showToast('Avatar mis à jour');
    };
    reader.readAsDataURL(file);
}

function editUsername() {
    const newUsername = prompt('Nouveau pseudo:', state.userProfile.username);
    if (newUsername && newUsername.trim()) {
        state.userProfile.username = newUsername.trim();
        localStorage.setItem('username', newUsername.trim());
        document.getElementById('profileUsername').textContent = newUsername.trim();
        document.getElementById('usernameDisplay').textContent = newUsername.trim();
        showToast('Pseudo mis à jour');
    }
}

// ==================== MOVIE DETAILS ====================

async function showMovieDetails(movieId) {
    const modal = document.getElementById('movieModal');
    const details = document.getElementById('movieDetails');
    
    details.innerHTML = '<div class="loading">Chargement...</div>';
    modal.classList.add('active');

    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
        );
        const movie = await response.json();

        const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
        const isWatched = state.watched.some(w => w.movie_id == movie.id);
        const poster = movie.poster_path ? `${CONFIG.TMDB_IMG_URL}${movie.poster_path}` : 'placeholder.jpg';
        const year = movie.release_date ? movie.release_date.split('-')[0] : '';

        details.innerHTML = `
            <div class="movie-details-grid">
                <div class="movie-details-poster">
                    <img src="${poster}" alt="${movie.title}">
                </div>
                <div class="movie-details-info">
                    <h2>${movie.title} <span style="font-weight:400; color:#888; font-size: 0.8em;">(${year})</span></h2>
                    
                    <div class="genre-badges">
                        ${movie.genres ? movie.genres.map(g => `<span class="genre-badge">${g.name}</span>`).join('') : ''}
                    </div>

                    <div style="margin-top: 15px;">
                        <span>⭐ TMDB: ${movie.vote_average.toFixed(1)}/10</span>
                    </div>

                    <div class="user-rating-section">
                        <span class="rating-label">Votre note :</span>
                        <div class="modal-stars" id="modal-rating-${movie.id}"></div>
                    </div>

                    <div class="movie-actions">
                        ${getToken() ? `
                            <button class="btn btn-small" onclick="showTrailer(${movie.id})">
                                ▶️ Trailer
                            </button>
                            
                            <button id="btn-watchlist-${movie.id}" 
                                    class="btn-secondary btn-small" 
                                    onclick="toggleWatchlist(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                                ${inWatchlist ? '✓ Watchlist' : '+ Watchlist'}
                            </button>
                            
                            <button id="btn-watched-${movie.id}" 
                                    class="btn-secondary btn-small" 
                                    onclick="toggleWatched(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                                ${isWatched ? '✓ Vu' : '👁️ Vu'}
                            </button>
                        ` : '<p>Connectez-vous pour gérer ce film</p>'}
                    </div>

                    <div style="margin-top: 20px;">
                        <h3>Synopsis</h3>
                        <p>${movie.overview || 'Pas de résumé.'}</p>
                    </div>
                </div>
            </div>
        `;

        setupRatingStars(movie.id);

    } catch (error) {
        console.error(error);
        details.innerHTML = '<div class="error">Erreur de chargement.</div>';
    }
}

// ==================== WATCHLIST & WATCHED ====================

async function toggleWatchlist(movieId, title, posterPath) {
    if (!getToken()) return;

    const btn = document.getElementById(`btn-watchlist-${movieId}`);
    const index = state.watchlist.findIndex(m => m.movie_id == movieId);
    const isInList = index !== -1;

    if (btn) {
        btn.textContent = isInList ? '+ Watchlist' : '✓ Watchlist';
    }

    try {
        if (isInList) {
            await apiRequest(`/watchlist/${movieId}`, { method: 'DELETE' });
            state.watchlist.splice(index, 1);
            showToast('Retiré de la watchlist');
        } else {
            await apiRequest('/watchlist', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Ajouté à la watchlist');
        }
    } catch (error) {
        if (btn) btn.textContent = isInList ? '✓ Watchlist' : '+ Watchlist';
        showToast('Erreur', 'error');
    }
}

async function toggleWatched(movieId, title, posterPath) {
    if (!getToken()) return;

    const btn = document.getElementById(`btn-watched-${movieId}`);
    const index = state.watched.findIndex(m => m.movie_id == movieId);
    const isWatched = index !== -1;

    if (btn) {
        btn.textContent = isWatched ? '👁️ Vu' : '✓ Vu';
    }

    try {
        if (isWatched) {
            await apiRequest(`/watched/${movieId}`, { method: 'DELETE' });
            state.watched.splice(index, 1);
            showToast('Retiré des films vus');
        } else {
            await apiRequest('/watched', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Marqué comme vu');
        }
    } catch (error) {
        if (btn) btn.textContent = isWatched ? '✓ Vu' : '👁️ Vu';
        showToast('Erreur', 'error');
    }
}

async function loadWatchlist() {
    if (!getToken()) {
        document.getElementById('watchlistGrid').innerHTML = 
            '<div class="empty-state"><h3>Connecte-toi pour voir ta watchlist</h3></div>';
        return;
    }

    const grid = document.getElementById('watchlistGrid');
    grid.innerHTML = '<div class="loading">Chargement...</div>';
    
    const watchlist = await apiRequest('/watchlist');
    
    if (!watchlist || watchlist.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Ta watchlist est vide</h3></div>';
        return;
    }

    state.watchlist = watchlist;
    const movies = watchlist.map(w => ({
        id: w.movie_id,
        title: w.movie_title,
        poster_path: w.movie_poster
    }));

    displayMovies(movies, 'watchlistGrid');
}

async function loadWatched() {
    if (!getToken()) {
        document.getElementById('watchedGrid').innerHTML = 
            '<div class="empty-state"><h3>Connecte-toi</h3></div>';
        return;
    }

    const grid = document.getElementById('watchedGrid');
    grid.innerHTML = '<div class="loading">Chargement...</div>';
    
    const watched = await apiRequest('/watched');
    
    if (!watched || watched.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Aucun film vu</h3></div>';
        return;
    }

    state.watched = watched;
    const movies = watched.map(w => ({
        id: w.movie_id,
        title: w.movie_title,
        poster_path: w.movie_poster
    }));

    displayMovies(movies, 'watchedGrid');
}

// ==================== MOVIES ====================

async function loadPopularMovies() {
    const grid = document.getElementById('moviesGrid');
    
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=1`
        );
        const data = await response.json();
        
        state.movies = data.results;
        displayMovies(data.results, 'moviesGrid');
    } catch (error) {
        grid.innerHTML = '<div class="error">Erreur</div>';
    }
}

async function searchMovies() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        loadPopularMovies();
        return;
    }
    
    const grid = document.getElementById('moviesGrid');
    grid.innerHTML = '<div class="loading">Recherche...</div>';
    
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        displayMovies(data.results, 'moviesGrid');
    } catch (error) {
        grid.innerHTML = '<div class="error">Erreur</div>';
    }
}

function displayMovies(movies, gridId) {
    const grid = document.getElementById(gridId);
    
    if (movies.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Aucun film trouvé</h3></div>';
        return;
    }

    grid.innerHTML = movies.map(movie => {
        const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
        const isWatched = state.watched.some(w => w.movie_id == movie.id);
        
        return `
            <div class="movie-card" data-movie-id="${movie.id}" onclick="showMovieDetails(${movie.id})">
                <div class="movie-poster">
                    ${movie.poster_path ? `<img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">` : '🎬'}
                    ${inWatchlist ? '<div class="watchlist-badge">À voir</div>' : ''}
                    ${isWatched ? '<div class="watched-badge">✓ Vu</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ==================== RATING STARS ====================

async function setupRatingStars(movieId) {
    const container = document.getElementById(`modal-rating-${movieId}`);
    if (!container) return;

    let currentRating = 0;
    if (getToken()) {
        try {
            const data = await apiRequest(`/ratings/${movieId}`);
            if (data && data.rating) {
                currentRating = data.rating;
            }
        } catch (e) {}
    }

    const starsHtml = Array.from({ length: 10 }, (_, i) => i + 1).map(starValue => `
        <span class="modal-star ${starValue <= currentRating ? 'active' : ''}" 
              data-value="${starValue}" 
              title="${starValue}/10">★</span>
    `).join('');
    
    container.innerHTML = starsHtml;

    if (!getToken()) return;

    const stars = container.querySelectorAll('.modal-star');
    const label = container.parentElement.querySelector('.rating-label'); 
    
    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.dataset.value);
            if(label) label.textContent = `Votre note : ${val}/10`;
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.value);
                s.classList.toggle('hover', sVal <= val);
            });
        });

        star.addEventListener('click', async () => {
            const rating = parseInt(star.dataset.value);
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.value);
                s.classList.toggle('active', sVal <= rating);
            });
            currentRating = rating;

            await apiRequest('/ratings', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, rating: rating })
            });
            
            showToast(`Note: ${rating}/10`);
        });
    });
    
    container.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hover'));
        if(label) {
            label.textContent = currentRating > 0 ? `Votre note : ${currentRating}/10` : 'Votre note :';
        }
    });
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
    // Auth
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal(true));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal(false));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(!isLoginMode);
    });
    document.getElementById('authForm').addEventListener('submit', handleAuth);

    // Upload avatar
    document.getElementById('avatarUpload').addEventListener('change', handleAvatarUpload);
    

    // Navigation Desktop
    document.getElementById('navFilms').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('movies');
    });
    document.getElementById('navSwiper').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            switchView('swiper');
        }
    });
    document.getElementById('navWatchlist').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            switchView('watchlist');
        }
    });
    document.getElementById('navWatched').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            switchView('watched');
        }
    });
    document.getElementById('navProfile').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            switchView('profile');
        }
    });

    // Navigation Mobile
    document.getElementById('mobileNavFilms').addEventListener('click', (e) => {
        e.preventDefault();
        updateMobileNav('mobileNavFilms');
        switchView('movies');
    });
    document.getElementById('mobileNavSwiper').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            updateMobileNav('mobileNavSwiper');
            switchView('swiper');
        }
    });
    document.getElementById('mobileNavWatchlist').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            updateMobileNav('mobileNavWatchlist');
            switchView('watchlist');
        }
    });
    document.getElementById('mobileNavWatched').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            updateMobileNav('mobileNavWatched');
            switchView('watched');
        }
    });
    document.getElementById('mobileNavProfile').addEventListener('click', (e) => {
        e.preventDefault();
        if (!getToken()) {
            openAuthModal(true);
        } else {
            updateMobileNav('mobileNavProfile');
            switchView('profile');
        }
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', searchMovies);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchMovies();
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

    const token = getToken();
    if (token) {
        state.token = token;
        apiRequest('/stats').then(data => {
            if (data) {
                state.user = { username: localStorage.getItem('username') || 'Utilisateur' };
                state.userProfile.username = state.user.username;
                updateUI();
                loadUserData();
                setupMobileProfileClick();
            }
        });
    }

    loadPopularMovies();
    updateUI();
});

function updateMobileNav(activeId) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}

const toastStyles = document.createElement('style');
toastStyles.textContent = `
@keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
}
`;
document.head.appendChild(toastStyles);