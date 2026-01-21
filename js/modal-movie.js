// modal-movie.js - Système de navigation swipe amélioré

let currentMovieId = null;
let currentMovieIndex = -1;
let currentGridMovies = []; 
let touchStartX = 0;
let touchEndX = 0;
let modalSwipeOffset = 0;
let isDraggingModal = false;
let swipeStartTime = 0;
let similarMoviesData = [];
let similarMoviesPage = 0;
const SIMILAR_MOVIES_PER_PAGE = 6;
const MAX_SIMILAR_MOVIES = 25;
let similarMoviesObserver = null;
let isLoadingSimilarMovies = false;
let currentMovieTitle = '';

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
    
    // Nettoyer le lazy loading précédent
    cleanupSimilarMoviesLazyLoad();
    
    try {
        const movieRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`);
        const movie = await movieRes.json();
        currentMovieTitle = movie.title;
        let isLiked = false;
        if (getToken()) {
            const likeStatus = await apiRequest(`/likes/${movieId}`);
            if (likeStatus) isLiked = likeStatus.liked;
        }
        
        const creditsRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${CONFIG.TMDB_API_KEY}`);
        const credits = await creditsRes.json();
        let suggestedMovies = [];
        
        // Collection
        if (movie.belongs_to_collection) {
            try {
                const collectionRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/collection/${movie.belongs_to_collection.id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const collectionData = await collectionRes.json();
                const collectionMovies = collectionData.parts?.filter(m => m.id !== movieId && m.poster_path) || [];
                
                if (collectionMovies.length > 0) {
                    suggestedMovies = collectionMovies.sort((a, b) => {
                        return new Date(a.release_date) - new Date(b.release_date);
                    });
                }
            } catch (e) {
                console.log('Collection not available');
            }
        }
        
        // Recommandations
        if (suggestedMovies.length < MAX_SIMILAR_MOVIES) {
            try {
                const recommendationsRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=1`
                );
                const recommendations = await recommendationsRes.json();
                
                if (recommendations.results && recommendations.results.length > 0) {
                    const remaining = MAX_SIMILAR_MOVIES - suggestedMovies.length;
                    const recsToAdd = recommendations.results
                        .filter(r => r.poster_path && !suggestedMovies.find(m => m.id === r.id))
                        .slice(0, remaining);
                    suggestedMovies = [...suggestedMovies, ...recsToAdd];
                }
            } catch (e) {
                console.log('Recommendations not available');
            }
        }
        
        // Similaires
        if (suggestedMovies.length < MAX_SIMILAR_MOVIES) {
            try {
                const similarRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=1`
                );
                const similar = await similarRes.json();
                if (similar.results && similar.results.length > 0) {
                    const remaining = MAX_SIMILAR_MOVIES - suggestedMovies.length;
                    const similarToAdd = similar.results
                        .filter(s => s.poster_path && !suggestedMovies.find(m => m.id === s.id))
                        .slice(0, remaining);
                    suggestedMovies = [...suggestedMovies, ...similarToAdd];
                }
            } catch (e) {
                console.log('Similar not available');
            }
        }
        
        console.log('🎯 Total films similaires:', suggestedMovies.length);
        
        // Render
        await renderMovieModal(movie, credits, suggestedMovies, movie.belongs_to_collection ? true : false, isLiked);
        if (suggestedMovies.length > 0) {
            setTimeout(() => {
                initSimilarMoviesLazyLoad(suggestedMovies);
            }, 100);
        }
        
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
                                <div class="cast-item" onclick="openActorModal(${actor.id}, '${actor.name.replace(/'/g, "\\'")}')">
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
                        <h3 class="section-title">
                            ${isCollection ? 'Autres films de la saga' : 'Vous aimerez aussi'}
                            <span class="filmography-count">(${suggestedMovies.length})</span>
                        </h3>
                        <div class="similar-movies-grid" id="similarMoviesGrid">
                            <!-- Les films seront chargés par le lazy loading -->
                        </div>
                        ${suggestedMovies.length > SIMILAR_MOVIES_PER_PAGE ? `
                            <div class="similar-movies-loader" id="similarMoviesLoader">
                                <div class="spinner"></div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    if (getToken()) {
        setupModalRatingStars(movie.id, currentRating);
    }

    setTimeout(() => {
        const friendsBadge = document.querySelector('.movie-friends-badge');
        if (friendsBadge) {
            friendsBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                openFriendsMovieModal(movie.id, movie.title);
            });
        }
    }, 100);
    
    if (getToken()) {
        setupModalRatingStars(movie.id, currentRating);
    }
}

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
    
    let activeRating = currentRating;
    const starsHtml = Array.from({ length: 10 }, (_, i) => {
        const fullValue = i + 1;
        const halfValue = i + 0.5;
        
        let starClass = '';
        if (currentRating >= fullValue) {
            starClass = 'full';
        } else if (currentRating >= halfValue) {
            starClass = 'half';
        }
        
        return `
            <span class="modal-star-new ${starClass}" 
                  data-value="${fullValue}"
                  data-half-value="${halfValue}">★</span>
        `;
    }).join('');
    
    container.innerHTML = starsHtml;
    
    if (currentRating > 0) {
        const ratingContainer = container.closest('.rating-stars-container');
        if (ratingContainer && !ratingContainer.querySelector('.rating-clear-btn')) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'rating-clear-btn';
            clearBtn.onclick = () => clearMovieRating(movieId);
            clearBtn.title = 'Supprimer la note';
            clearBtn.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18" stroke-width="3" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke-width="3" stroke-linecap="round"/>
                </svg>
            `;
            ratingContainer.insertBefore(clearBtn, container);
        }
    }
    
    const stars = container.querySelectorAll('.modal-star-new');
    
    stars.forEach(star => {
        star.addEventListener('click', async (e) => {
            const rect = star.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const starWidth = rect.width;
            
            let rating;
            if (clickX < starWidth / 2) {
                rating = parseFloat(star.dataset.halfValue);
            } else {
                rating = parseFloat(star.dataset.value);
            }
            updateStarsDisplay(stars, rating);
            activeRating = rating;
            
            await apiRequest('/ratings', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, rating })
            });
            
            showToast(`Note: ${rating}/10`);
            updateClearButton(movieId, true);
        });
        
        star.addEventListener('mousemove', (e) => {
            const rect = star.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const starWidth = rect.width;
            
            let previewRating;
            if (clickX < starWidth / 2) {
                previewRating = parseFloat(star.dataset.halfValue);
            } else {
                previewRating = parseFloat(star.dataset.value);
            }
            
            updateStarsDisplay(stars, previewRating);
        });
    });
    
    container.addEventListener('mouseleave', () => {
        updateStarsDisplay(stars, activeRating); 
    });
}

function updateStarsDisplay(stars, rating) {
    stars.forEach(star => {
        const fullValue = parseFloat(star.dataset.value);
        const halfValue = parseFloat(star.dataset.halfValue);
        
        star.classList.remove('full', 'half');
        
        if (rating >= fullValue) {
            star.classList.add('full');
        } else if (rating >= halfValue) {
            star.classList.add('half');
        }
    });
}

async function clearMovieRating(movieId) {
    try {
        await apiRequest(`/ratings/${movieId}`, { method: 'DELETE' });
        const stars = document.querySelectorAll(`#modal-rating-${movieId} .modal-star-new`);
        stars.forEach(s => {
            s.classList.remove('full', 'half');
        });
        updateClearButton(movieId, false);
        showToast('Note supprimée');
        setupModalRatingStars(movieId, 0);
        
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
// ==================== ACTOR MODAL - FIXED VERSION ====================

let actorMoviesData = [];
let actorMoviesPage = 0;
const ACTOR_MOVIES_PER_PAGE = 18;
let actorMoviesObserver = null;
let isLoadingActorMovies = false;

async function openActorModal(actorId, actorName) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'actorModal';
    
    modal.innerHTML = `
        <div class="actor-modal-container">
            <button class="actor-modal-close" onclick="closeActorModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="actor-modal-loading">
                <div class="spinner"></div>
                <p>Chargement...</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    try {
        const [actorResponse, creditsResponse] = await Promise.all([
            fetch(`${CONFIG.TMDB_BASE_URL}/person/${actorId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`),
            fetch(`${CONFIG.TMDB_BASE_URL}/person/${actorId}/movie_credits?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`)
        ]);
        
        const actor = await actorResponse.json();
        const credits = await creditsResponse.json();
        
        // Trier tous les films par popularité
        const allMovies = credits.cast
            .filter(m => m.poster_path)
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        // Calculer l'âge
        let ageText = '';
        if (actor.birthday) {
            const birthDate = new Date(actor.birthday);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            ageText = actor.deathday ? '' : ` • ${age} ans`;
        }
        
        const container = modal.querySelector('.actor-modal-container');
        container.innerHTML = `
            <button class="actor-modal-close" onclick="closeActorModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            
            <!-- Header avec backdrop blur -->
            <div class="actor-modal-header">
                <div class="actor-modal-backdrop" style="background-image: url('${actor.profile_path ? `https://image.tmdb.org/t/p/original${actor.profile_path}` : ''}')"></div>
                <div class="actor-modal-header-content">
                    <div class="actor-modal-avatar">
                        <img src="${actor.profile_path ? `https://image.tmdb.org/t/p/w300${actor.profile_path}` : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(actor.name) + '&size=200'}" alt="${actor.name}">
                    </div>
                    <div class="actor-modal-title">
                        <h1>${actor.name}</h1>
                        <p class="actor-modal-subtitle">
                            ${actor.birthday ? new Date(actor.birthday).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}${ageText}
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Stats compactes -->
            <div class="actor-modal-stats">
                <div class="actor-stat-item">
                    <span class="actor-stat-value">${allMovies.length}</span>
                    <span class="actor-stat-label">Films</span>
                </div>
                <div class="actor-stat-divider"></div>
                <div class="actor-stat-item">
                    <span class="actor-stat-value">${actor.popularity ? actor.popularity.toFixed(0) : '0'}</span>
                    <span class="actor-stat-label">Popularité</span>
                </div>
                <div class="actor-stat-divider"></div>
                <div class="actor-stat-item">
                    <span class="actor-stat-value">${actor.known_for_department || 'Acting'}</span>
                    <span class="actor-stat-label">Métier</span>
                </div>
            </div>
            
            <!-- Biographie expandable -->
            ${actor.biography ? `
                <div class="actor-modal-bio">
                    <h3>À propos</h3>
                    <p class="actor-bio-text ${actor.biography.length > 300 ? 'collapsed' : ''}" id="actorBioText">
                        ${actor.biography}
                    </p>
                    ${actor.biography.length > 300 ? `
                        <button class="actor-bio-toggle" onclick="toggleActorBio()">
                            <span class="show-more">Lire plus</span>
                            <span class="show-less" style="display: none;">Lire moins</span>
                        </button>
                    ` : ''}
                </div>
            ` : ''}
            
            <!-- Grille des films avec lazy loading -->
            <div class="actor-modal-filmography" id="actorFilmography">
                <h3>Filmographie <span class="filmography-count">(${allMovies.length})</span></h3>
                <div class="actor-films-grid" id="actorFilmsGrid"></div>
                <div class="actor-films-loader" id="actorFilmsLoader">
                    <div class="spinner"></div>
                </div>
            </div>
        `;
        
        // Initialiser le lazy loading
        initActorFilmsLazyLoad(allMovies);
        
    } catch (error) {
        console.error('Erreur chargement acteur:', error);
        modal.querySelector('.actor-modal-container').innerHTML = `
            <button class="actor-modal-close" onclick="closeActorModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="actor-modal-error">
                <div style="font-size: 64px; margin-bottom: 20px;">❌</div>
                <h2>Erreur de chargement</h2>
                <p>Impossible de récupérer les informations</p>
            </div>
        `;
    }
}
function initActorFilmsLazyLoad(movies) {
    actorMoviesData = movies;
    actorMoviesPage = 0;
    isLoadingActorMovies = false;
    if (actorMoviesObserver) {
        actorMoviesObserver.disconnect();
        actorMoviesObserver = null;
    }
    loadMoreActorMovies();
    const container = document.querySelector('.actor-modal-container');
    const loader = document.getElementById('actorFilmsLoader');
    
    if (container && loader) {
        actorMoviesObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoadingActorMovies) {
                loadMoreActorMovies();
            }
        }, {
            rootMargin: '300px',
            threshold: 0
        });
        
        actorMoviesObserver.observe(loader);
    }
}

function loadMoreActorMovies() {
    if (isLoadingActorMovies || !actorMoviesData) return;
    
    const grid = document.getElementById('actorFilmsGrid');
    const loader = document.getElementById('actorFilmsLoader');
    
    if (!grid || !actorMoviesData) return;
    
    const start = actorMoviesPage * ACTOR_MOVIES_PER_PAGE;
    const end = start + ACTOR_MOVIES_PER_PAGE;
    const moviesChunk = actorMoviesData.slice(start, end);
    
    console.log(`📦 Chargement acteur: ${start}-${end} (${moviesChunk.length} films) sur ${actorMoviesData.length} total`);
    
    if (moviesChunk.length === 0) {
        if (loader) loader.style.display = 'none';
        console.log('✅ Tous les films acteur chargés');
        return;
    }
    
    isLoadingActorMovies = true;
    if (loader) {
        loader.style.display = 'flex';
    }
    
    // Utiliser requestAnimationFrame pour de meilleures performances
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        
        moviesChunk.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'actor-film-card';
            card.onclick = () => {
                closeActorModal();
                showMovieDetails(movie.id);
            };
            
            card.innerHTML = `
                <div class="actor-film-poster">
                    <img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}" loading="lazy">
                    <div class="actor-film-overlay">
                        <div class="actor-film-rating">
                            ${movie.vote_average ? `<span>⭐ ${movie.vote_average.toFixed(1)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="actor-film-info">
                    <h4 class="actor-film-title">${movie.title}</h4>
                    <p class="actor-film-meta">
                        ${movie.character ? movie.character : 'Acteur'}
                        ${movie.release_date ? ` • ${movie.release_date.split('-')[0]}` : ''}
                    </p>
                </div>
            `;
            
            fragment.appendChild(card);
        });
        
        grid.appendChild(fragment);
        actorMoviesPage++;
        
        console.log(`✅ Page ${actorMoviesPage} chargée`);
        const hasMore = end < actorMoviesData.length;
        
        if (!hasMore) {
            if (loader) loader.style.display = 'none';
            if (actorMoviesObserver) {
                actorMoviesObserver.disconnect();
                console.log('🏁 Chargement terminé - observer déconnecté');
            }
        } else {
            if (loader) loader.style.display = 'flex';
        }
        
        isLoadingActorMovies = false;
    });
}

function toggleActorBio() {
    const bioText = document.getElementById('actorBioText');
    const toggle = document.querySelector('.actor-bio-toggle');
    const showMore = toggle.querySelector('.show-more');
    const showLess = toggle.querySelector('.show-less');
    
    bioText.classList.toggle('collapsed');
    
    if (bioText.classList.contains('collapsed')) {
        showMore.style.display = 'inline';
        showLess.style.display = 'none';
    } else {
        showMore.style.display = 'none';
        showLess.style.display = 'inline';
    }
}

function closeActorModal() {
    const modal = document.getElementById('actorModal');
    if (modal) {
        if (actorMoviesObserver) {
            actorMoviesObserver.disconnect();
            actorMoviesObserver = null;
        }
        actorMoviesData = [];
        actorMoviesPage = 0;
        isLoadingActorMovies = false;
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        setTimeout(() => modal.remove(), 300);
    }
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
    
    const modalContent = e.currentTarget;
    const isAtTop = modalContent.scrollTop <= 10;
    
    if (isAtTop && currentGridMovies.length > 0) {
        isDraggingModal = true;
    }
}

function handleModalTouchMove(e) {
    if (!isDraggingModal) return;
    
    touchEndX = e.touches[0].clientX;
    const diff = touchEndX - touchStartX;
    
    if (Math.abs(diff) > 10) {
        e.preventDefault();
        
        const modalContent = e.currentTarget;
        modalContent.style.transform = `translateX(${diff}px)`;
        modalContent.style.transition = 'none';
        
        const opacity = Math.min(Math.abs(diff) / 150, 0.5);
        if (diff > 0 && currentMovieIndex > 0) {
            modalContent.style.background = `linear-gradient(to right, rgba(59, 130, 246, ${opacity}), transparent)`;
        } else if (diff < 0 && currentMovieIndex < currentGridMovies.length - 1) {
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
    
    const threshold = 100;
    const isQuickSwipe = swipeVelocity > 0.5;
    
    modalContent.style.transition = 'transform 0.3s ease, background 0.3s ease';
    modalContent.style.background = '';
    
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












// ==================== CORRECTION FINALE - LAZY LOADING FILMS SIMILAIRES ====================


function initSimilarMoviesLazyLoad(movies) {
    console.log('🎬 Init lazy loading similaires:', movies.length, 'films');
    
    similarMoviesData = movies.slice(0, MAX_SIMILAR_MOVIES);
    similarMoviesPage = 0;
    isLoadingSimilarMovies = false;
    
    if (similarMoviesObserver) {
        similarMoviesObserver.disconnect();
        similarMoviesObserver = null;
    }
    
    const grid = document.getElementById('similarMoviesGrid');
    const loader = document.getElementById('similarMoviesLoader');
    
    if (!grid) {
        console.error('❌ Grid similaire introuvable');
        return;
    }
    
    if (similarMoviesData.length === 0) {
        console.log('⚠️ Pas de films similaires');
        if (loader) loader.style.display = 'none';
        return;
    }
    
    loadMoreSimilarMovies();
    
    if (similarMoviesData.length > SIMILAR_MOVIES_PER_PAGE) {
        if (loader) {
            // Montrer le loader
            loader.style.display = 'flex';
            
            similarMoviesObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !isLoadingSimilarMovies) {
                        console.log('📥 Observer déclenché - chargement films similaires');
                        loadMoreSimilarMovies();
                    }
                });
            }, {
                root: null,
                rootMargin: '200px',
                threshold: 0.1
            });
            
            similarMoviesObserver.observe(loader);
            console.log('👁️ Observer attaché sur loader');
        }
    } else {
        if (loader) loader.style.display = 'none';
    }
}

function loadMoreSimilarMovies() {
    if (isLoadingSimilarMovies || !similarMoviesData) {
        console.log('⏸️ Chargement déjà en cours ou pas de données');
        return;
    }
    
    const grid = document.getElementById('similarMoviesGrid');
    const loader = document.getElementById('similarMoviesLoader');
    
    if (!grid) {
        console.error('❌ Grid introuvable');
        return;
    }
    
    const start = similarMoviesPage * SIMILAR_MOVIES_PER_PAGE;
    const end = start + SIMILAR_MOVIES_PER_PAGE;
    const moviesChunk = similarMoviesData.slice(start, end);
    
    console.log(`📦 Chargement films ${start}-${end} (${moviesChunk.length} films) sur ${similarMoviesData.length} total`);
    
    if (moviesChunk.length === 0) {
        if (loader) loader.style.display = 'none';
        console.log('✅ Tous les films chargés');
        return;
    }
    
    isLoadingSimilarMovies = true;
    
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        
        moviesChunk.forEach(movie => {
            if (!movie.poster_path) return;
            
            const card = document.createElement('div');
            card.className = 'similar-movie-card';
            card.onclick = () => showMovieDetails(movie.id, true);
            
            card.innerHTML = `
                <img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" 
                     alt="${movie.title}" 
                     loading="lazy">
                <div class="similar-movie-title">${movie.title}</div>
            `;
            
            fragment.appendChild(card);
        });
        
        grid.appendChild(fragment);
        similarMoviesPage++;
        
        console.log(`✅ ${moviesChunk.length} films ajoutés (page ${similarMoviesPage}/${Math.ceil(similarMoviesData.length / SIMILAR_MOVIES_PER_PAGE)})`);
        
        const hasMore = end < similarMoviesData.length;
        
        if (!hasMore) {
            if (loader) loader.style.display = 'none';
            if (similarMoviesObserver) {
                similarMoviesObserver.disconnect();
                console.log('🏁 Chargement terminé - observer déconnecté');
            }
        } else {
            if (loader) loader.style.display = 'flex';
        }
        
        isLoadingSimilarMovies = false;
    });
}

function cleanupSimilarMoviesLazyLoad() {
    console.log('🧹 Nettoyage lazy loading similaires');
    
    if (similarMoviesObserver) {
        similarMoviesObserver.disconnect();
        similarMoviesObserver = null;
    }
    similarMoviesData = [];
    similarMoviesPage = 0;
    isLoadingSimilarMovies = false;
}








// ==================== MODAL AMIS QUI ONT VU LE FILM ====================

async function openFriendsMovieModal(movieId, movieTitle) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'friendsMovieModal';
    
    modal.innerHTML = `
        <div class="friends-movie-modal-container">
            <button class="friends-movie-modal-close" onclick="closeFriendsMovieModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="friends-movie-modal-loading">
                <div class="spinner"></div>
                <p>Chargement...</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    try {
        const friends = await apiRequest(`/movies/${movieId}/friends`);
        
        if (!friends || friends.length === 0) {
            modal.querySelector('.friends-movie-modal-container').innerHTML = `
                <button class="friends-movie-modal-close" onclick="closeFriendsMovieModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                <div class="friends-movie-modal-empty">
                    <div class="friends-movie-modal-empty-icon">👥</div>
                    <h2>Aucun ami n'a vu ce film</h2>
                    <p>Soyez le premier à le regarder !</p>
                </div>
            `;
            return;
        }
        
        // Séparer les amis par type d'interaction
        const friendsWhoLiked = friends.filter(f => f.has_liked);
        const friendsWhoWatched = friends.filter(f => f.watched_at && !f.has_liked);
        
        const container = modal.querySelector('.friends-movie-modal-container');
        container.innerHTML = `
            <button class="friends-movie-modal-close" onclick="closeFriendsMovieModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            
            <div class="friends-movie-modal-header">
                <h2>${movieTitle}</h2>
                <p class="friends-movie-modal-subtitle">
                    ${friends.length} ami${friends.length > 1 ? 's' : ''} 
                    ${friends.length > 1 ? 'ont' : 'a'} interagi avec ce film
                </p>
            </div>
            
            <div class="friends-movie-modal-body">
                ${friendsWhoLiked.length > 0 ? `
                    <div class="friends-movie-section">
                        <div class="friends-movie-section-header">
                            <span class="friends-movie-section-icon">❤️</span>
                            <h3>Coups de cœur</h3>
                            <span class="friends-movie-section-count">${friendsWhoLiked.length}</span>
                        </div>
                        <div class="friends-movie-list">
                            ${friendsWhoLiked.map(friend => renderFriendItem(friend, 'liked')).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${friendsWhoWatched.length > 0 ? `
                    <div class="friends-movie-section">
                        <div class="friends-movie-section-header">
                            <span class="friends-movie-section-icon">👁️</span>
                            <h3>Vus</h3>
                            <span class="friends-movie-section-count">${friendsWhoWatched.length}</span>
                        </div>
                        <div class="friends-movie-list">
                            ${friendsWhoWatched.map(friend => renderFriendItem(friend, 'watched')).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
    } catch (error) {
        console.error('Erreur chargement amis film:', error);
        modal.querySelector('.friends-movie-modal-container').innerHTML = `
            <button class="friends-movie-modal-close" onclick="closeFriendsMovieModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="friends-movie-modal-error">
                <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                <h2>Erreur de chargement</h2>
                <p>Impossible de récupérer les informations</p>
            </div>
        `;
    }
}

function renderFriendItem(friend, type) {
    const hasRating = friend.rating && friend.rating > 0;
    const watchedDate = friend.watched_at ? new Date(friend.watched_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }) : null;
    
    return `
        <div class="friends-movie-item" onclick="viewFriendProfile(${friend.id}); closeFriendsMovieModal();">
            <div class="friends-movie-item-avatar">
                <img src="${friend.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(friend.username)}" 
                     alt="${friend.username}">
                <div class="friends-movie-item-badge ${type === 'liked' ? 'liked' : 'watched'}">
                    ${type === 'liked' ? '❤️' : '👁️'}
                </div>
            </div>
            <div class="friends-movie-item-info">
                <div class="friends-movie-item-name">${friend.username}</div>
                <div class="friends-movie-item-meta">
                    ${hasRating ? `
                        <span class="friends-movie-item-rating">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            ${friend.rating}/10
                        </span>
                    ` : ''}
                    ${watchedDate ? `
                        <span class="friends-movie-item-date">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            ${watchedDate}
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="friends-movie-item-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        </div>
    `;
}

function closeFriendsMovieModal() {
    const modal = document.getElementById('friendsMovieModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => modal.remove(), 300);
    }
}

window.openFriendsMovieModal = openFriendsMovieModal;
window.closeFriendsMovieModal = closeFriendsMovieModal;

async function showFriendsWhoWatched(movieId) {
    try {
        const friends = await apiRequest(`/movies/${movieId}/friends`);
        
        if (!friends || friends.length === 0) return '';
        const movieTitle = currentMovieTitle || 'Ce film';
        
        return `
            <div class="movie-friends-badge" onclick="event.stopPropagation(); openFriendsMovieModal(${movieId}, \`${movieTitle.replace(/`/g, '\\`').replace(/'/g, "\\'")}\`);" style="cursor: pointer;">
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
                    ${friends.length} ami${friends.length > 1 ? 's' : ''} 
                    ${friends.filter(f => f.has_liked).length > 0 ? '❤️' : '👁️'}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        `;
    } catch (error) {
        console.error('Erreur amis film:', error);
        return '';
    }
}