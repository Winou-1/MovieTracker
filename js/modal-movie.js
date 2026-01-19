// modal-movie.js - Système de navigation swipe amélioré

let currentMovieId = null;
let currentMovieIndex = -1; // Index du film actuel dans la grille
let currentGridMovies = []; // Liste des films de la grille actuelle
let touchStartX = 0;
let touchEndX = 0;
let modalSwipeOffset = 0;
let isDraggingModal = false;
let swipeStartTime = 0;

async function showMovieDetails(movieId, fromGrid = null) {
    currentMovieId = movieId;
    
    // Récupérer les films de la grille actuelle
    if (fromGrid || state.currentView === 'movies' || state.currentView === 'watchlist' || state.currentView === 'watched') {
        currentGridMovies = getCurrentGridMovies();
        currentMovieIndex = currentGridMovies.findIndex(m => m.id == movieId);
    } else {
        currentGridMovies = [];
        currentMovieIndex = -1;
    }
    
    const modal = document.getElementById('movieModal');
    const modalContent = modal.querySelector('.modal-content');
    modalSwipeOffset = 0;
    if (modalContent) {
        modalContent.style.transform = 'translateX(0)';
        modalContent.style.transition = '';
    }
    
    modal.classList.add('active');
    await loadMovieDetails(movieId);
    setupModalSwipe();
    setupBackButton();
}

// Récupérer les films de la grille actuelle
function getCurrentGridMovies() {
    const movies = [];
    let gridSelector = '';
    
    // Déterminer quelle grille est active
    if (state.currentView === 'watchlist') {
        gridSelector = '#watchlistGrid';
    } else if (state.currentView === 'watched') {
        gridSelector = '#watchedGrid';
    } else {
        gridSelector = '#moviesGrid';
    }
    
    // Récupérer tous les films de la grille
    const movieCards = document.querySelectorAll(`${gridSelector} .movie-card`);
    movieCards.forEach(card => {
        const movieId = parseInt(card.dataset.movieId);
        if (movieId) {
            movies.push({ id: movieId });
        }
    });
    
    return movies;
}

// Naviguer vers le film précédent
function navigateToPreviousMovie() {
    if (currentMovieIndex > 0) {
        currentMovieIndex--;
        const prevMovie = currentGridMovies[currentMovieIndex];
        loadMovieDetails(prevMovie.id);
        currentMovieId = prevMovie.id;
    }
}

// Naviguer vers le film suivant
function navigateToNextMovie() {
    if (currentMovieIndex < currentGridMovies.length - 1) {
        currentMovieIndex++;
        const nextMovie = currentGridMovies[currentMovieIndex];
        loadMovieDetails(nextMovie.id);
        currentMovieId = nextMovie.id;
    }
}

async function loadMovieDetails(movieId) {
    const modalContent = document.querySelector('#movieModal .modal-content');
    modalContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const movieRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`);
        const movie = await movieRes.json();
        let isLiked = false;
        if (getToken()) {
            const likeStatus = await apiRequest(`/likes/${movieId}`);
            if (likeStatus) isLiked = likeStatus.liked;
        }
        
        const creditsRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${CONFIG.TMDB_API_KEY}`);
        const credits = await creditsRes.json();
        let suggestedMovies = [];
        
        if (movie.belongs_to_collection) {
            try {
                const collectionRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/collection/${movie.belongs_to_collection.id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const collectionData = await collectionRes.json();
                const collectionMovies = collectionData.parts?.filter(m => m.id !== movieId) || [];
                
                if (collectionMovies.length > 0) {
                    suggestedMovies = collectionMovies.sort((a, b) => {
                        return new Date(a.release_date) - new Date(b.release_date);
                    }).slice(0, 6);
                }
            } catch (e) {
                console.log('Collection not available');
            }
        }
        
        if (suggestedMovies.length < 6) {
            try {
                const recommendationsRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const recommendations = await recommendationsRes.json();
                
                if (recommendations.results && recommendations.results.length > 0) {
                    const remaining = 6 - suggestedMovies.length;
                    const recsToAdd = recommendations.results
                        .filter(r => !suggestedMovies.find(m => m.id === r.id))
                        .slice(0, remaining);
                    suggestedMovies = [...suggestedMovies, ...recsToAdd];
                }
            } catch (e) {
                console.log('Recommendations not available');
            }
        }
        
        if (suggestedMovies.length < 6) {
            try {
                const similarRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const similar = await similarRes.json();
                if (similar.results && similar.results.length > 0) {
                    const remaining = 6 - suggestedMovies.length;
                    const similarToAdd = similar.results
                        .filter(s => !suggestedMovies.find(m => m.id === s.id))
                        .slice(0, remaining);
                    suggestedMovies = [...suggestedMovies, ...similarToAdd];
                }
            } catch (e) {
                console.log('Similar not available');
            }
        }
        
        renderMovieModal(movie, credits, suggestedMovies, movie.belongs_to_collection ? true : false, isLiked);
    } catch (error) {
        console.error(error);
        modalContent.innerHTML = '<div class="error">Erreur de chargement</div>';
    }
}

async function renderMovieModal(movie, credits, suggestedMovies, isCollection, isLiked = false) {
    const modalContent = document.querySelector('#movieModal .modal-content');
    const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
    const isWatched = state.watched.some(w => w.movie_id == movie.id);
    const currentRating = getUserRating(movie.id);
    const poster = movie.poster_path ? `${CONFIG.TMDB_IMG_URL}${movie.poster_path}` : '';
    const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : poster;
    const cast = credits.cast?.slice(0, 8) || [];
    
    let friendsSection = '';
    if (getToken()) {
        friendsSection = await showFriendsWhoWatched(movie.id);
    }
    
    // Indicateurs de navigation
    const showPrevIndicator = currentMovieIndex > 0;
    const showNextIndicator = currentMovieIndex < currentGridMovies.length - 1 && currentGridMovies.length > 0;
    
    modalContent.innerHTML = `
        <div class="movie-modal-new">
            <button class="modal-back-btn" onclick="closeMovieModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            
            
            
            <button class="modal-heart-btn ${isLiked ? 'active' : ''}" 
                    onclick="toggleLike(this)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                   <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
            
            <div class="movie-modal-header" style="background-image: url('${backdrop}')">
                <div class="movie-modal-gradient"></div>
                <div class="movie-modal-poster">
                    <img src="${poster}" alt="${movie.title}">
                </div>
            </div>
            
            <div class="movie-modal-content">
                <div class="movie-modal-title-section">
                    <h1 class="movie-modal-title">${movie.title}</h1>
                    <div class="movie-modal-meta">
                        <span class="meta-item">📅 ${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                        <span class="meta-item">⏱️ ${movie.runtime ? movie.runtime + ' min' : 'N/A'}</span>
                        <span class="meta-item">⭐ ${movie.vote_average.toFixed(1)}/10</span>
                    </div>
                    
                    <div class="movie-modal-genres">
                        ${movie.genres?.map(g => `<span class="genre-pill">${g.name}</span>`).join('') || ''}
                    </div>
                    
                    ${friendsSection}
                </div>
                
                ${getToken() ? `
                    <div class="movie-modal-rating-section">
                        <div class="rating-header">
                            <div class="rating-stars-container">
                                ${currentRating ? `
                                    <button class="rating-clear-btn" onclick="clearMovieRating(${movie.id})" title="Supprimer la note">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <line x1="18" y1="6" x2="6" y2="18" stroke-width="3" stroke-linecap="round"/>
                                            <line x1="6" y1="6" x2="18" y2="18" stroke-width="3" stroke-linecap="round"/>
                                        </svg>
                                    </button>
                                ` : ''}
                                <div class="movie-modal-stars" id="modal-rating-${movie.id}"></div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${getToken() ? `
                    <div class="movie-modal-actions">
                        <button class="action-btn btn-trailer" onclick="showTrailer(${movie.id})">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                        
                        <button class="action-btn btn-seen ${isWatched ? 'active' : ''}" 
                                id="modal-btn-watched-${movie.id}"
                                onclick="toggleWatchedFromModal(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                        
                        <button class="action-btn btn-watchlist ${inWatchlist ? 'active' : ''}"
                                id="modal-btn-watchlist-${movie.id}"
                                onclick="toggleWatchlistFromModal(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                            </svg>
                        </button>
                    </div>
                ` : '<p class="login-prompt">Connectez-vous pour gérer ce film</p>'}
                
                <div class="movie-modal-section">
                    <h3 class="section-title">Synopsis</h3>
                    <p class="movie-synopsis">${movie.overview || 'Pas de synopsis disponible.'}</p>
                </div>
                
                ${cast.length > 0 ? `
                    <div class="movie-modal-section">
                        <h3 class="section-title">Casting</h3>
                        <div class="cast-list">
                            ${cast.map(actor => `
                                <div class="cast-item" onclick="openActorWikipedia('${actor.name.replace(/'/g, "\\'")}')">
                                    <div class="cast-photo" style="background-image: url('${actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : ''}')">
                                        ${!actor.profile_path ? '<span>👤</span>' : ''}
                                    </div>
                                    <div class="cast-info">
                                        <div class="cast-name">${actor.name}</div>
                                        <div class="cast-character">${actor.character || 'N/A'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${suggestedMovies.length > 0 ? `
                    <div class="movie-modal-section">
                        <h3 class="section-title">${isCollection ? 'Autres films de la saga' : 'Vous aimerez aussi'}</h3>
                        <div class="similar-movies-grid">
                            ${suggestedMovies.map(rec => `
                                <div class="similar-movie-card" onclick="showMovieDetails(${rec.id}, true)">
                                    <img src="${rec.poster_path ? `${CONFIG.TMDB_IMG_URL}${rec.poster_path}` : ''}" alt="${rec.title}">
                                    <div class="similar-movie-title">${rec.title}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    if (getToken()) {
        setupModalRatingStars(movie.id, currentRating);
    }
}

// Fonction pour récupérer la note de l'utilisateur
function getUserRating(movieId) {
    return null;
}

async function setupModalRatingStars(movieId, currentRating = 0) {
    const container = document.getElementById(`modal-rating-${movieId}`);
    if (!container) return;
    try {
        const data = await apiRequest(`/ratings/${movieId}`);
        if (data && data.rating) {
            currentRating = data.rating;
        }
    } catch (e) {}
    
    const starsHtml = Array.from({ length: 10 }, (_, i) => i + 1).map(val => `
        <span class="modal-star-new ${val <= currentRating ? 'active' : ''}" 
              data-value="${val}">★</span>
    `).join('');
    
    container.innerHTML = starsHtml;
    
    const stars = container.querySelectorAll('.modal-star-new');
    
    stars.forEach(star => {
        star.addEventListener('click', async () => {
            const rating = parseInt(star.dataset.value);
            
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.value);
                s.classList.toggle('active', sVal <= rating);
            });
            
            await apiRequest('/ratings', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, rating })
            });
            
            showToast(`Note: ${rating}/10`);
            updateClearButton(movieId, true);
        });
    });
}

async function clearMovieRating(movieId) {
    try {
        await apiRequest(`/ratings/${movieId}`, { method: 'DELETE' });
        const stars = document.querySelectorAll(`#modal-rating-${movieId} .modal-star-new`);
        stars.forEach(s => s.classList.remove('active'));
        updateClearButton(movieId, false);
        showToast('Note supprimée');
    } catch (error) {
        showToast('Erreur lors de la suppression', 'error');
    }
}

function updateClearButton(movieId, show) {
    const container = document.querySelector('.rating-stars-container');
    if (!container) return;
    
    const existingBtn = container.querySelector('.rating-clear-btn');
    
    if (show && !existingBtn) {
        const btn = document.createElement('button');
        btn.className = 'rating-clear-btn';
        btn.onclick = () => clearMovieRating(movieId);
        btn.title = 'Supprimer la note';
        btn.innerHTML = `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18" stroke-width="3" stroke-linecap="round"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke-width="3" stroke-linecap="round"/>
            </svg>
        `;
        container.insertBefore(btn, container.firstChild);
    } else if (!show && existingBtn) {
        existingBtn.remove();
    }
}

function openActorWikipedia(actorName) {
    const encodedName = encodeURIComponent(actorName);
    window.open(`https://fr.wikipedia.org/wiki/${encodedName}`, '_blank');
}

async function toggleWatchlistFromModal(movieId, title, posterPath) {
    if (!getToken()) return;
    
    const btn = document.getElementById(`modal-btn-watchlist-${movieId}`);
    
    if (btn) {
        btn.style.transform = 'scale(0.85)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    }
    
    const index = state.watchlist.findIndex(m => m.movie_id == movieId);
    const wasInList = index !== -1;
    
    try {
        if (wasInList) {
            await apiRequest(`/watchlist/${movieId}`, { method: 'DELETE' });
            state.watchlist.splice(index, 1);
            showToast('Retiré de la watchlist');
            if (btn) btn.classList.remove('active');
        } else {
            await apiRequest('/watchlist', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Ajouté à la watchlist');
            if (btn) btn.classList.add('active');
        }
    } catch (error) {
        showToast('Erreur', 'error');
    }
}

async function toggleWatchedFromModal(movieId, title, posterPath) {
    if (!getToken()) return;
    
    const btn = document.getElementById(`modal-btn-watched-${movieId}`);
    
    if (btn) {
        btn.style.transform = 'scale(0.85)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    }
    
    const index = state.watched.findIndex(m => m.movie_id == movieId);
    const wasWatched = index !== -1;
    
    try {
        if (wasWatched) {
            await apiRequest(`/watched/${movieId}`, { method: 'DELETE' });
            state.watched.splice(index, 1);
            showToast('Retiré des films vus');
            if (btn) btn.classList.remove('active');
        } else {
            await apiRequest('/watched', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Marqué comme vu');
            if (btn) btn.classList.add('active');
        }
    } catch (error) {
        showToast('Erreur', 'error');
    }
}

// ✅ SYSTÈME DE SWIPE AMÉLIORÉ - Navigation entre films
function setupModalSwipe() {
    const modalContent = document.querySelector('#movieModal .modal-content');
    if (!modalContent) return;
    
    modalContent.addEventListener('touchstart', handleModalTouchStart, { passive: true });
    modalContent.addEventListener('touchmove', handleModalTouchMove, { passive: false });
    modalContent.addEventListener('touchend', handleModalTouchEnd, { passive: true });
}

function handleModalTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchEndX = touchStartX;
    swipeStartTime = Date.now();
    isDraggingModal = false;
    
    // Déterminer si on est en haut du scroll
    const modalContent = e.currentTarget;
    const isAtTop = modalContent.scrollTop <= 10;
    
    // Autoriser le swipe seulement si on est en haut
    if (isAtTop && currentGridMovies.length > 0) {
        isDraggingModal = true;
    }
}

function handleModalTouchMove(e) {
    if (!isDraggingModal) return;
    
    touchEndX = e.touches[0].clientX;
    const diff = touchEndX - touchStartX;
    
    // Empêcher le scroll vertical pendant le swipe horizontal
    if (Math.abs(diff) > 10) {
        e.preventDefault();
        
        const modalContent = e.currentTarget;
        modalContent.style.transform = `translateX(${diff}px)`;
        modalContent.style.transition = 'none';
        
        // Indicateur visuel
        const opacity = Math.min(Math.abs(diff) / 150, 0.5);
        if (diff > 0 && currentMovieIndex > 0) {
            // Swipe vers la droite = film précédent
            modalContent.style.background = `linear-gradient(to right, rgba(59, 130, 246, ${opacity}), transparent)`;
        } else if (diff < 0 && currentMovieIndex < currentGridMovies.length - 1) {
            // Swipe vers la gauche = film suivant
            modalContent.style.background = `linear-gradient(to left, rgba(59, 130, 246, ${opacity}), transparent)`;
        }
    }
}

function handleModalTouchEnd(e) {
    if (!isDraggingModal) return;
    
    const modalContent = e.currentTarget;
    const diff = touchEndX - touchStartX;
    const swipeDuration = Date.now() - swipeStartTime;
    const swipeVelocity = Math.abs(diff) / swipeDuration;
    
    // Seuils : 100px ou vitesse rapide (0.5px/ms)
    const threshold = 100;
    const isQuickSwipe = swipeVelocity > 0.5;
    
    modalContent.style.transition = 'transform 0.3s ease, background 0.3s ease';
    modalContent.style.background = '';
    
    // Swipe vers la droite (film précédent)
    if ((diff > threshold || (diff > 50 && isQuickSwipe)) && currentMovieIndex > 0) {
        modalContent.style.transform = 'translateX(100%)';
        setTimeout(() => {
            modalContent.style.transition = 'none';
            modalContent.style.transform = 'translateX(-100%)';
            navigateToPreviousMovie();
            setTimeout(() => {
                modalContent.style.transition = 'transform 0.3s ease';
                modalContent.style.transform = 'translateX(0)';
            }, 50);
        }, 300);
    }
    // Swipe vers la gauche (film suivant)
    else if ((diff < -threshold || (diff < -50 && isQuickSwipe)) && currentMovieIndex < currentGridMovies.length - 1) {
        modalContent.style.transform = 'translateX(-100%)';
        setTimeout(() => {
            modalContent.style.transition = 'none';
            modalContent.style.transform = 'translateX(100%)';
            navigateToNextMovie();
            setTimeout(() => {
                modalContent.style.transition = 'transform 0.3s ease';
                modalContent.style.transform = 'translateX(0)';
            }, 50);
        }, 300);
    }
    // Retour à la position initiale
    else {
        modalContent.style.transform = 'translateX(0)';
    }
    
    isDraggingModal = false;
    touchStartX = 0;
    touchEndX = 0;
}

function setupBackButton() {
    window.addEventListener('popstate', closeMovieModal);
}

function closeMovieModal() {
    const modal = document.getElementById('movieModal');
    modal.classList.remove('active');
    currentMovieId = null;
    currentMovieIndex = -1;
    currentGridMovies = [];
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeMovieModal');
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }
});

async function toggleLike(btnElement) {
    if (!getToken()) {
        showToast('Connecte-toi pour aimer ce film', 'error');
        return;
    }

    const movieId = currentMovieId; 
    const isLiked = btnElement.classList.contains('active');
    
    btnElement.classList.toggle('active');
    
    const svg = btnElement.querySelector('svg');
    if(svg) {
        svg.setAttribute('fill', !isLiked ? 'currentColor' : 'none');
    }

    try {
        let result;
        if (isLiked) {
            result = await apiRequest(`/likes/${movieId}`, { method: 'DELETE' });
        } else {
            result = await apiRequest('/likes', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId })
            });
        }

        if (!result) {
            btnElement.classList.toggle('active');
            showToast('Erreur de connexion', 'error');
        }
    } catch (error) {
        console.error(error);
        btnElement.classList.toggle('active');
    }
}