// script.js - Logique Frontend améliorée pour CineTrack

// ==================== CONFIGURATION ====================

const CONFIG = {
    API_URL: 'http://localhost:3000/api',
    TMDB_API_KEY: 'f05382a7b84dc7c40d1965fb01e19f2b',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMG_URL: 'https://image.tmdb.org/t/p/w500'
};

// ==================== STATE ====================

const state = {
    user: null,
    token: null,
    movies: [],
    watchlist: [],
    watched: [],
    currentView: 'movies',
    theme: localStorage.getItem('theme') || 'dark'
};

// ==================== THEME ====================

function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

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
            showError('Session expirée, veuillez vous reconnecter');
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function showError(message, elementId = null) {
    if (elementId) {
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    } else {
        alert(message);
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
        background: ${type === 'success' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
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
        document.getElementById('authModal').classList.remove('active');
        updateUI();
        loadUserData();
        showToast('Connexion réussie !');
    } else {
        showError(data?.error || 'Erreur lors de l\'authentification', 'authError');
    }
}

function logout() {
    clearToken();
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
    if (watchlist) {
        state.watchlist = watchlist;
    }

    const watched = await apiRequest('/watched');
    if (watched) {
        state.watched = watched;
    }
}

// ==================== UI ====================

function updateUI() {
    const isLoggedIn = !!getToken();
    document.getElementById('authButtons').style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('userMenu').style.display = isLoggedIn ? 'flex' : 'none';

    if (isLoggedIn && state.user) {
        document.getElementById('usernameDisplay').textContent = state.user.username;
    }
}

function switchView(view) {
    state.currentView = view;

    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('moviesSection').style.display = 'none';
    document.getElementById('watchlistSection').style.display = 'none';
    document.getElementById('watchedSection').style.display = 'none';
    document.getElementById('profileSection').style.display = 'none';
    document.getElementById('feedSection').style.display = 'none';

    switch(view) {
        case 'movies':
            document.getElementById('searchSection').style.display = 'block';
            document.getElementById('moviesSection').style.display = 'block';
            break;
        case 'watchlist':
            document.getElementById('watchlistSection').style.display = 'block';
            loadWatchlist();
            break;
        case 'watched':
            document.getElementById('watchedSection').style.display = 'block';
            loadWatched();
            break;
        case 'profile':
            document.getElementById('profileSection').style.display = 'block';
            loadProfile();
            break;
        case 'feed':
            document.getElementById('feedSection').style.display = 'block';
            loadFeed();
            break;
    }
}

// ==================== TMDB API ====================

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
        grid.innerHTML = '<div class="error">Erreur lors du chargement des films</div>';
    }
}

async function searchMovies() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        loadPopularMovies();
        return;
    }
    
    const grid = document.getElementById('moviesGrid');
    grid.innerHTML = '<div class="loading">Recherche en cours...</div>';
    
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        displayMovies(data.results, 'moviesGrid');
    } catch (error) {
        grid.innerHTML = '<div class="error">Erreur lors de la recherche</div>';
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
            <div class="movie-card" onclick="showMovieDetails(${movie.id})">
                <div class="movie-poster">
                    ${movie.poster_path 
                        ? `<img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">`
                        : '🎬'}
                    ${inWatchlist ? '<div class="watchlist-badge">À voir</div>' : ''}
                    ${isWatched ? '<div class="watched-badge">✓ Vu</div>' : ''}
                </div>
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                    <div class="movie-year">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</div>
                    <div class="rating" id="rating-${movie.id}"></div>
                </div>
            </div>
        `;
    }).join('');

    if (getToken()) {
        loadRatings(movies);
    }
}

async function loadRatings(movies) {
    for (const movie of movies) {
        const data = await apiRequest(`/ratings/${movie.id}`);
        const ratingDiv = document.getElementById(`rating-${movie.id}`);
        if (ratingDiv) {
            ratingDiv.innerHTML = generateStars(movie.id, data?.rating || 0);
        }
    }
}

function generateStars(movieId, currentRating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= currentRating ? 'filled' : ''}" 
                      onclick="event.stopPropagation(); rateMovie(${movieId}, ${i})"
                      onmouseover="hoverStars(${movieId}, ${i})"
                      onmouseout="unhoverStars(${movieId})">★</span>`;
    }
    return html;
}

function hoverStars(movieId, rating) {
    const stars = document.querySelectorAll(`#rating-${movieId} .star`);
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('hover');
        }
    });
}

function unhoverStars(movieId) {
    const stars = document.querySelectorAll(`#rating-${movieId} .star`);
    stars.forEach(star => star.classList.remove('hover'));
}

async function rateMovie(movieId, rating) {
    if (!getToken()) {
        openAuthModal(true);
        return;
    }

    const data = await apiRequest('/ratings', {
        method: 'POST',
        body: JSON.stringify({ movie_id: movieId, rating })
    });

    if (data) {
        const ratingDiv = document.getElementById(`rating-${movieId}`);
        if (ratingDiv) {
            ratingDiv.innerHTML = generateStars(movieId, rating);
        }
        showToast(`Film noté ${rating}/5 ⭐`);
    }
}

// ==================== MOVIE DETAILS ====================

async function showMovieDetails(movieId) {
    const modal = document.getElementById('movieModal');
    const details = document.getElementById('movieDetails');
    
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
        );
        const movie = await response.json();
        
        const inWatchlist = state.watchlist.some(w => w.movie_id == movieId);
        const isWatched = state.watched.some(w => w.movie_id == movieId);
        
        const genreBadges = movie.genres ? movie.genres.map(g => 
            `<span class="genre-badge">${g.name}</span>`
        ).join('') : '';
        
        details.innerHTML = `
            <div class="movie-details-grid">
                <div class="movie-details-poster">
                    ${movie.poster_path 
                        ? `<img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">`
                        : '<div style="background: #1f2327; aspect-ratio: 2/3; display: flex; align-items: center; justify-content: center;">🎬</div>'}
                </div>
                <div class="movie-details-info">
                    <h2>${movie.title}</h2>
                    <p><strong>Date de sortie:</strong> ${movie.release_date}</p>
                    <p><strong>Note moyenne:</strong> ${movie.vote_average}/10</p>
                    <p><strong>Durée:</strong> ${movie.runtime} minutes</p>
                    ${genreBadges ? `<div class="genre-badges">${genreBadges}</div>` : ''}
                    <div class="movie-actions">
                        ${getToken() ? `
                            <button class="btn btn-small" onclick="event.stopPropagation(); openReviewModal(${movieId}, '${movie.title.replace(/'/g, "\\'")}')">
                                ✏️ Écrire une critique
                            </button>
                            <button class="btn-secondary btn-small" id="watchlist-btn-${movieId}" onclick="event.stopPropagation(); toggleWatchlist(${movieId}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                                ${inWatchlist ? '✓ Dans ma watchlist' : '+ Ajouter à la watchlist'}
                            </button>
                            <button class="btn-secondary btn-small" id="watched-btn-${movieId}" onclick="event.stopPropagation(); toggleWatched(${movieId}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                                ${isWatched ? '✓ Déjà vu' : '👁️ Marquer comme vu'}
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">Synopsis</h3>
                <p>${movie.overview || 'Pas de synopsis disponible'}</p>
            </div>
        `;
        
        modal.classList.add('active');
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ==================== WATCHLIST ====================

async function toggleWatchlist(movieId, title, poster) {
    const inWatchlist = state.watchlist.some(w => w.movie_id == movieId);
    
    if (inWatchlist) {
        const result = await apiRequest(`/watchlist/${movieId}`, { method: 'DELETE' });
        if (result) {
            state.watchlist = state.watchlist.filter(w => w.movie_id != movieId);
            showToast('Retiré de la watchlist');
            
            // Mise à jour du bouton
            const btn = document.getElementById(`watchlist-btn-${movieId}`);
            if (btn) {
                btn.textContent = '+ Ajouter à la watchlist';
            }
            
            // Recharger si on est dans la vue watchlist
            if (state.currentView === 'watchlist') {
                loadWatchlist();
            }
        }
    } else {
        const result = await apiRequest('/watchlist', {
            method: 'POST',
            body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: poster })
        });
        if (result) {
            state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: poster });
            showToast('Ajouté à la watchlist');
            
            // Mise à jour du bouton
            const btn = document.getElementById(`watchlist-btn-${movieId}`);
            if (btn) {
                btn.textContent = '✓ Dans ma watchlist';
            }
        }
    }
    
    // Rafraîchir l'affichage des badges sur les cartes
    refreshMovieCards();
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
        grid.innerHTML = '<div class="empty-state"><h3>Ta watchlist est vide</h3><p>Ajoute des films que tu veux voir !</p></div>';
        return;
    }

    state.watchlist = watchlist;

    const movies = watchlist.map(w => ({
        id: w.movie_id,
        title: w.movie_title,
        poster_path: w.movie_poster,
        release_date: ''
    }));

    displayMovies(movies, 'watchlistGrid');
}

// ==================== WATCHED ====================

async function toggleWatched(movieId, title, poster) {
    const isWatched = state.watched.some(w => w.movie_id == movieId);
    
    if (isWatched) {
        const result = await apiRequest(`/watched/${movieId}`, { method: 'DELETE' });
        if (result) {
            state.watched = state.watched.filter(w => w.movie_id != movieId);
            showToast('Retiré des films vus');
            
            // Mise à jour du bouton
            const btn = document.getElementById(`watched-btn-${movieId}`);
            if (btn) {
                btn.textContent = '👁️ Marquer comme vu';
            }
            
            // Recharger si on est dans la vue watched
            if (state.currentView === 'watched') {
                loadWatched();
            }
        }
    } else {
        const result = await apiRequest('/watched', {
            method: 'POST',
            body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: poster })
        });
        if (result) {
            state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: poster });
            showToast('Marqué comme vu');
            
            // Mise à jour du bouton
            const btn = document.getElementById(`watched-btn-${movieId}`);
            if (btn) {
                btn.textContent = '✓ Déjà vu';
            }
        }
    }
    
    // Rafraîchir l'affichage des badges sur les cartes
    refreshMovieCards();
}

async function loadWatched() {
    if (!getToken()) {
        document.getElementById('watchedGrid').innerHTML = 
            '<div class="empty-state"><h3>Connecte-toi pour voir tes films vus</h3></div>';
        return;
    }

    const grid = document.getElementById('watchedGrid');
    grid.innerHTML = '<div class="loading">Chargement...</div>';
    
    const watched = await apiRequest('/watched');
    
    if (!watched || watched.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Aucun film vu</h3><p>Marque les films que tu as regardés !</p></div>';
        return;
    }

    state.watched = watched;

    const movies = watched.map(w => ({
        id: w.movie_id,
        title: w.movie_title,
        poster_path: w.movie_poster,
        release_date: ''
    }));

    displayMovies(movies, 'watchedGrid');
}

// Fonction pour rafraîchir uniquement les badges des cartes
function refreshMovieCards() {
    const movieCards = document.querySelectorAll('.movie-card');
    movieCards.forEach(card => {
        const movieId = parseInt(card.getAttribute('onclick').match(/\d+/)[0]);
        const poster = card.querySelector('.movie-poster');
        
        // Supprimer les anciens badges
        const oldWatchlistBadge = poster.querySelector('.watchlist-badge');
        const oldWatchedBadge = poster.querySelector('.watched-badge');
        if (oldWatchlistBadge) oldWatchlistBadge.remove();
        if (oldWatchedBadge) oldWatchedBadge.remove();
        
        // Ajouter les nouveaux badges si nécessaire
        const inWatchlist = state.watchlist.some(w => w.movie_id == movieId);
        const isWatched = state.watched.some(w => w.movie_id == movieId);
        
        if (inWatchlist) {
            const badge = document.createElement('div');
            badge.className = 'watchlist-badge';
            badge.textContent = 'À voir';
            poster.appendChild(badge);
        }
        
        if (isWatched) {
            const badge = document.createElement('div');
            badge.className = 'watched-badge';
            badge.textContent = '✓ Vu';
            poster.appendChild(badge);
        }
    });
}

// ==================== REVIEWS ====================

function openReviewModal(movieId, movieTitle) {
    document.getElementById('reviewMovieId').value = movieId;
    document.getElementById('reviewMovieTitle').value = movieTitle;
    document.getElementById('reviewContent').value = '';
    document.getElementById('reviewError').style.display = 'none';
    document.getElementById('reviewModal').classList.add('active');
}

async function submitReview(e) {
    e.preventDefault();

    const movieId = document.getElementById('reviewMovieId').value;
    const movieTitle = document.getElementById('reviewMovieTitle').value;
    const content = document.getElementById('reviewContent').value;

    const data = await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({ movie_id: movieId, movie_title: movieTitle, content })
    });

    if (data) {
        document.getElementById('reviewModal').classList.remove('active');
        document.getElementById('movieModal').classList.remove('active');
        showToast('Critique publiée !');
    } else {
        showError('Erreur lors de la publication', 'reviewError');
    }
}

async function loadProfile() {
    if (!getToken()) return;

    await loadUserData();

    const reviews = await apiRequest('/reviews/user');
    const reviewsList = document.getElementById('userReviewsList');

    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<div class="empty-state"><p>Tu n\'as pas encore écrit de critique</p></div>';
    } else {
        reviewsList.innerHTML = reviews.map(review => `
            <div class="review-card">
                <div class="review-movie">${review.movie_title}</div>
                <div class="review-date">${new Date(review.created_at).toLocaleDateString('fr-FR')}</div>
                <div class="review-content">${review.content}</div>
            </div>
        `).join('');
    }

    loadCharts();
}

async function loadFeed() {
    const feedList = document.getElementById('feedList');
    feedList.innerHTML = '<div class="loading">Chargement...</div>';

    const reviews = await apiRequest('/reviews/feed');

    if (!reviews || reviews.length === 0) {
        feedList.innerHTML = '<div class="empty-state"><h3>Aucune critique pour le moment</h3></div>';
        return;
    }

    feedList.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <span class="review-user">${review.username}</span>
                <span class="review-date">${new Date(review.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="review-movie">${review.movie_title}</div>
            <div class="review-content">${review.content}</div>
        </div>
    `).join('');
}

// ==================== CHARTS ====================

let ratingsChart = null;
let activityChart = null;

async function loadCharts() {
    const ratings = await apiRequest('/ratings/user');
    
    if (ratings && ratings.length > 0) {
        createRatingsChart(ratings);
        createActivityChart(ratings);
    }
}

function createRatingsChart(ratings) {
    const ctx = document.getElementById('ratingsChart');
    if (!ctx) return;

    const ratingCounts = [0, 0, 0, 0, 0];
    ratings.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) {
            ratingCounts[r.rating - 1]++;
        }
    });

    if (ratingsChart) ratingsChart.destroy();

    ratingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1⭐', '2⭐', '3⭐', '4⭐', '5⭐'],
            datasets: [{
                label: 'Nombre de films',
                data: ratingCounts,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                        stepSize: 1
                    },
                    grid: { color: 'rgba(68, 85, 102, 0.2)' }
                },
                x: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Auth
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal(true));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal(false));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(!isLoginMode);
    });
    document.getElementById('authForm').addEventListener('submit', handleAuth);

    // Navigation Desktop
    document.getElementById('navFilms').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('movies');
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
    document.getElementById('navFeed').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('feed');
    });

    // Navigation Mobile
    document.getElementById('mobileNavFilms').addEventListener('click', (e) => {
        e.preventDefault();
        updateMobileNav('mobileNavFilms');
        switchView('movies');
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
    document.getElementById('mobileNavFeed').addEventListener('click', (e) => {
        e.preventDefault();
        updateMobileNav('mobileNavFeed');
        switchView('feed');
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', searchMovies);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchMovies();
    });

    // Reviews
    document.getElementById('reviewForm').addEventListener('submit', submitReview);

    // Modals
    document.getElementById('closeAuthModal').addEventListener('click', () => {
        document.getElementById('authModal').classList.remove('active');
    });
    document.getElementById('closeMovieModal').addEventListener('click', () => {
        document.getElementById('movieModal').classList.remove('active');
    });
    document.getElementById('closeReviewModal').addEventListener('click', () => {
        document.getElementById('reviewModal').classList.remove('active');
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
                state.user = { username: 'Utilisateur' };
                updateUI();
                loadUserData();
            }
        });
    }

    loadPopularMovies();
    updateUI();
});

// Fonction pour mettre à jour la navigation mobile active
function updateMobileNav(activeId) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}

// ==================== STYLES TOASTS ====================

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

// ==================== ACTIVITY CHART ====================

function createActivityChart(ratings) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    const monthCounts = {};
    ratings.forEach(r => {
        const date = new Date(r.created_at);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
    });

    const months = Object.keys(monthCounts).sort().slice(-6);
    const counts = months.map(m => monthCounts[m]);

    if (activityChart) activityChart.destroy();

    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return new Date(year, month - 1)
                    .toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
            }),
            datasets: [{
                label: 'Films notés',
                data: counts,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.15)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary')
                    },
                    grid: {
                        color: 'rgba(68, 85, 102, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary')
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

//
// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser le thème
    initTheme();

    // 2. Charger les films populaires (page d'accueil)
    if (document.getElementById('moviesGrid')) {
        loadPopularMovies();
    }

    // 3. Si l'utilisateur est connecté, charger ses données
    if (getToken()) {
        updateUI();
        loadUserData(); // C'est cette fonction qui récupère la liste 'watched' pour les badges
    }

    // Gestion de la navigation mobile (si nécessaire)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            document.querySelector('.nav-links').classList.toggle('active');
        });
    }
});
