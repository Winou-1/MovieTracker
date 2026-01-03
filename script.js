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
    
    // Gestion du cas vide
    if (movies.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Aucun film trouvé</h3></div>';
        return;
    }

    grid.innerHTML = movies.map(movie => {
        const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
        const isWatched = state.watched.some(w => w.movie_id == movie.id);
        
        // On ne retourne que la structure du poster, sans le bloc .movie-info
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

    // J'ai supprimé l'appel à loadRatings(movies) car il n'y a plus d'étoiles à afficher dans la grille
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
    for (let i = 1; i <= 10; i++) {
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
        showToast(`Film noté ${rating}/10 ⭐`);
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

                    <div style="margin-top: 15px; display: flex; gap: 15px; align-items: center;">
                        <span>⭐ TMDB: ${movie.vote_average.toFixed(1)}/10</span>
                    </div>

                    <div class="user-rating-section">
                        <span class="rating-label">Votre note :</span>
                        <div class="modal-stars" id="modal-rating-${movie.id}"></div>
                    </div>

                    <div class="movie-actions" style="margin-top: 20px;">
                        ${getToken() ? `
                            <button class="btn btn-small" onclick="openReviewModal(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">
                                ✏️ Critique
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

        // IMPORTANT : On active les étoiles
        setupRatingStars(movie.id);

    } catch (error) {
        console.error(error);
        details.innerHTML = '<div class="error">Erreur de chargement.</div>';
    }
}



// ==================== WATCHLIST ====================

async function toggleWatchlist(movieId, title, posterPath) {
    if (!getToken()) return;

    // 1. Récupérer le bouton dans le modal
    const btn = document.getElementById(`btn-watchlist-${movieId}`);
    
    // 2. Vérifier l'état actuel
    const index = state.watchlist.findIndex(m => m.movie_id == movieId);
    const isInList = index !== -1;

    // 3. Mise à jour VISUELLE immédiate (Optimiste)
    if (btn) {
        btn.textContent = isInList ? '+ Watchlist' : '✓ Watchlist';
        // Petit effet d'animation optionnel
        btn.style.transform = "scale(0.95)";
        setTimeout(() => btn.style.transform = "scale(1)", 150);
    }

    try {
        if (isInList) {
            // RETIRER
            await apiRequest(`/watchlist/${movieId}`, { method: 'DELETE' });
            state.watchlist.splice(index, 1); // Mise à jour locale du tableau
            showToast('Retiré de la watchlist');
        } else {
            // AJOUTER
            await apiRequest('/watchlist', {
                method: 'POST',
                body: JSON.stringify({ 
                    movie_id: movieId, 
                    movie_title: title, 
                    movie_poster: posterPath 
                })
            });
            // Mise à jour locale du tableau
            state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Ajouté à la watchlist');
        }
        
        // 4. Mettre à jour la grille en arrière-plan pour que les badges suivent
        if (state.currentView === 'movies') {
            displayMovies(state.movies, 'moviesGrid');
        }
        
    } catch (error) {
        console.error("Erreur toggle watchlist", error);
        // Si erreur, on annule le changement visuel
        if (btn) btn.textContent = isInList ? '✓ Watchlist' : '+ Watchlist';
        showToast('Erreur de connexion');
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

async function toggleWatched(movieId, title, posterPath) {
    if (!getToken()) return;

    const btn = document.getElementById(`btn-watched-${movieId}`);
    const index = state.watched.findIndex(m => m.movie_id == movieId);
    const isWatched = index !== -1;

    // Mise à jour visuelle immédiate
    if (btn) {
        btn.textContent = isWatched ? '👁️ Vu' : '✓ Vu';
        btn.style.transform = "scale(0.95)";
        setTimeout(() => btn.style.transform = "scale(1)", 150);
    }

    try {
        if (isWatched) {
            await apiRequest(`/watched/${movieId}`, { method: 'DELETE' });
            state.watched.splice(index, 1);
            showToast('Retiré des films vus');
        } else {
            await apiRequest('/watched', {
                method: 'POST',
                body: JSON.stringify({ 
                    movie_id: movieId, 
                    movie_title: title, 
                    movie_poster: posterPath 
                })
            });
            state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Marqué comme vu');
        }

        // Mise à jour grille arrière-plan
        if (state.currentView === 'movies') {
            displayMovies(state.movies, 'moviesGrid');
        }

    } catch (error) {
        console.error("Erreur toggle watched", error);
        if (btn) btn.textContent = isWatched ? '✓ Vu' : '👁️ Vu';
        showToast('Erreur de connexion');
    }
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
function refreshMovieCards(movieId) {
    document.querySelectorAll('.movie-card').forEach(card => {

        const btn = card.querySelector(`[id^="watchlist-btn-${movieId}"]`);
        if (!btn) return; // ⛔️ évite le crash

        const isInWatchlist = state.watchlist.some(w => w.movie_id == movieId);

        btn.textContent = isInWatchlist
            ? '✓ Dans ma watchlist'
            : '+ Ajouter à la watchlist';
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

    const ratingCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    ratings.forEach(r => {
        if (r.rating >= 1 && r.rating <= 10) {
            ratingCounts[r.rating - 1]++;
        }
    });

    if (ratingsChart) ratingsChart.destroy();

    ratingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1⭐', '2⭐', '3⭐', '4⭐', '5⭐', '6⭐', '7⭐', '8⭐', '9⭐', '10⭐'],
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
// ==================== TEST FIX RELOAD ====================

document.addEventListener('click', e => {
    const card = e.target.closest('.movie-card');
    if (!card) return;

    // ⛔️ Si un modal est ouvert, on ignore
    if (document.getElementById('movieModal').classList.contains('active')) {
        return;
    }

    showMovieDetails(card.dataset.movieId);
});


function handleModalAction(e, action) {
    e.preventDefault();
    e.stopPropagation();
    action();
}


async function setupRatingStars(movieId) {
    const container = document.getElementById(`modal-rating-${movieId}`);
    if (!container) return;

    // 1. Récupérer la note existante de l'utilisateur
    let currentRating = 0;
    if (getToken()) {
        try {
            const data = await apiRequest(`/ratings/${movieId}`);
            if (data && data.rating) {
                currentRating = data.rating;
            }
        } catch (e) {
            console.error("Erreur chargement note", e);
        }
    }

    // 2. Générer les 10 étoiles HTML
    const starsHtml = Array.from({ length: 10 }, (_, i) => i + 1).map(starValue => `
        <span class="modal-star ${starValue <= currentRating ? 'active' : ''}" 
              data-value="${starValue}" 
              title="${starValue}/10">★</span>
    `).join('');
    
    container.innerHTML = starsHtml;

    // Si l'utilisateur n'est pas connecté, on s'arrête ici (affichage seul)
    if (!getToken()) {
        container.title = "Connectez-vous pour noter";
        return;
    }

    // 3. Ajouter les événements d'animation (Hover) et de validation (Click)
    const stars = container.querySelectorAll('.modal-star');
    const label = container.parentElement.querySelector('.rating-label'); 
    
    stars.forEach(star => {
        // --- ANIMATION AU SURVOL ---
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.dataset.value);
            
            // Mise à jour du texte temporaire
            if(label) label.textContent = `Votre note : ${val}/10`;
            
            // On ajoute la classe 'hover' à toutes les étoiles jusqu'à celle survolée
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.value);
                s.classList.toggle('hover', sVal <= val);
            });
        });

        // --- VALIDATION AU CLIC ---
        star.addEventListener('click', async () => {
            const rating = parseInt(star.dataset.value);
            
            // On fige visuellement la note avec la classe 'active'
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.value);
                s.classList.toggle('active', sVal <= rating);
            });
            
            currentRating = rating; // On mémorise la nouvelle note

            // Sauvegarde en base de données
            await apiRequest('/ratings', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, rating: rating })
            });
            
            showToast(`Note enregistrée : ${rating}/10`);
        });
    });
    
    // --- RESET QUAND LA SOURIS SORT ---
    container.addEventListener('mouseleave', () => {
        // On retire l'effet de survol
        stars.forEach(s => s.classList.remove('hover'));
        
        // On remet le texte correspondant à la note réelle enregistrée
        if(label) {
            label.textContent = currentRating > 0 ? `Votre note : ${currentRating}/10` : 'Votre note :';
        }
    });
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
const movieModal = document.getElementById('movieModal');


    document.getElementById('movieModal').addEventListener('click', e => {
        e.stopPropagation();
    });

    movieModal.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
    });
    document.querySelectorAll('a[href="#"]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
        });
    });





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
