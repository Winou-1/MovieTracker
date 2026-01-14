// modal-movie.js - Modal Film Redesigné avec Swipe et Suggestions

let currentMovieId = null;
let touchStartX = 0;
let touchEndX = 0;
let modalSwipeOffset = 0;

async function showMovieDetails(movieId) {
    currentMovieId = movieId;
    const modal = document.getElementById('movieModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Reset swipe position
    modalSwipeOffset = 0;
    if (modalContent) {
        modalContent.style.transform = 'translateX(0)';
    }
    
    modal.classList.add('active');
    
    // Charger les données
    await loadMovieDetails(movieId);
    
    // Setup swipe
    setupModalSwipe();
    
    // Setup back button
    setupBackButton();
}

async function loadMovieDetails(movieId) {
    const modalContent = document.querySelector('#movieModal .modal-content');
    modalContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        // Charger le film avec tous les détails
        const movieRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`);
        const movie = await movieRes.json();
        
        // Charger les crédits
        const creditsRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${CONFIG.TMDB_API_KEY}`);
        const credits = await creditsRes.json();
        
        // Stratégie de suggestions intelligente
        let suggestedMovies = [];
        
        // 1. Essayer la collection d'abord (pour les sagas)
        if (movie.belongs_to_collection) {
            try {
                const collectionRes = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/collection/${movie.belongs_to_collection.id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const collectionData = await collectionRes.json();
                const collectionMovies = collectionData.parts?.filter(m => m.id !== movieId) || [];
                
                if (collectionMovies.length > 0) {
                    // Trier par date de sortie
                    suggestedMovies = collectionMovies.sort((a, b) => {
                        return new Date(a.release_date) - new Date(b.release_date);
                    }).slice(0, 6);
                }
            } catch (e) {
                console.log('Collection not available');
            }
        }
        
        // 2. Si pas de collection ou pas assez de films, utiliser les recommandations
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
        
        // 3. En dernier recours, utiliser similar
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
        
        renderMovieModal(movie, credits, suggestedMovies, movie.belongs_to_collection ? true : false);
        
    } catch (error) {
        console.error(error);
        modalContent.innerHTML = '<div class="error">Erreur de chargement</div>';
    }
}

function renderMovieModal(movie, credits, suggestedMovies, isCollection) {
    const modalContent = document.querySelector('#movieModal .modal-content');
    const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
    const isWatched = state.watched.some(w => w.movie_id == movie.id);
    
    // Récupérer la note actuelle
    const currentRating = getUserRating(movie.id);
    
    const poster = movie.poster_path ? `${CONFIG.TMDB_IMG_URL}${movie.poster_path}` : '';
    const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : poster;
    
    // Cast (8 premiers acteurs)
    const cast = credits.cast?.slice(0, 8) || [];
    
    modalContent.innerHTML = `
        <div class="movie-modal-new">
            <!-- Back Button -->
            <button class="modal-back-btn" onclick="closeMovieModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            
            <!-- Heart Button -->
            <button class="modal-heart-btn ${inWatchlist ? 'active' : ''}" 
                    onclick="toggleWatchlistFromModal(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${inWatchlist ? 'currentColor' : 'none'}">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            
            <!-- Header Image -->
            <div class="movie-modal-header" style="background-image: url('${backdrop}')">
                <div class="movie-modal-gradient"></div>
                <div class="movie-modal-poster">
                    <img src="${poster}" alt="${movie.title}">
                </div>
            </div>
            
            <!-- Content -->
            <div class="movie-modal-content">
                <!-- Title & Info -->
                <div class="movie-modal-title-section">
                    <h1 class="movie-modal-title">${movie.title}</h1>
                    <div class="movie-modal-meta">
                        <span class="meta-item">📅 ${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                        <span class="meta-item">⏱️ ${movie.runtime ? movie.runtime + ' min' : 'N/A'}</span>
                        <span class="meta-item">⭐ ${movie.vote_average.toFixed(1)}/10</span>
                    </div>
                    
                    <!-- Genres -->
                    <div class="movie-modal-genres">
                        ${movie.genres?.map(g => `<span class="genre-pill">${g.name}</span>`).join('') || ''}
                    </div>
                </div>
                
                <!-- Rating Section -->
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
                
                <!-- Action Buttons -->
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
                
                <!-- Synopsis -->
                <div class="movie-modal-section">
                    <h3 class="section-title">Synopsis</h3>
                    <p class="movie-synopsis">${movie.overview || 'Pas de synopsis disponible.'}</p>
                </div>
                
                <!-- Cast -->
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
                
                <!-- Similar/Collection Movies -->
                ${suggestedMovies.length > 0 ? `
                    <div class="movie-modal-section">
                        <h3 class="section-title">${isCollection ? 'Autres films de la saga' : 'Vous aimerez aussi'}</h3>
                        <div class="similar-movies-grid">
                            ${suggestedMovies.map(rec => `
                                <div class="similar-movie-card" onclick="showMovieDetails(${rec.id})">
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
    
    // Setup rating stars
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
    
    // Récupérer la note réelle depuis l'API
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
            
            // Update visual
            stars.forEach(s => {
                const sVal = parseInt(s.dataset.value);
                s.classList.toggle('active', sVal <= rating);
            });
            
            // Save to API
            await apiRequest('/ratings', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, rating })
            });
            
            showToast(`Note: ${rating}/10`);
            
            // Afficher le bouton de suppression
            updateClearButton(movieId, true);
        });
    });
}

async function clearMovieRating(movieId) {
    if (!confirm('Supprimer votre note ?')) return;
    
    try {
        await apiRequest(`/ratings/${movieId}`, { method: 'DELETE' });
        
        // Reset stars
        const stars = document.querySelectorAll(`#modal-rating-${movieId} .modal-star-new`);
        stars.forEach(s => s.classList.remove('active'));
        
        // Hide clear button
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

// Nouvelle fonction pour ouvrir Wikipedia de l'acteur
function openActorWikipedia(actorName) {
    const encodedName = encodeURIComponent(actorName);
    window.open(`https://fr.wikipedia.org/wiki/${encodedName}`, '_blank');
}

// Toggle functions adaptées pour le nouveau modal
async function toggleWatchlistFromModal(movieId, title, posterPath) {
    if (!getToken()) return;
    
    const btn = document.getElementById(`modal-btn-watchlist-${movieId}`);
    const heartBtn = document.querySelector('.modal-heart-btn');
    
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
            if (heartBtn) heartBtn.classList.remove('active');
        } else {
            await apiRequest('/watchlist', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Ajouté à la watchlist');
            if (btn) btn.classList.add('active');
            if (heartBtn) heartBtn.classList.add('active');
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

// Swipe functionality
function setupModalSwipe() {
    const modalContent = document.querySelector('#movieModal .modal-content');
    if (!modalContent) return;
    
    modalContent.addEventListener('touchstart', handleTouchStart, { passive: true });
    modalContent.addEventListener('touchmove', handleTouchMove, { passive: false });
    modalContent.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
}

function handleTouchMove(e) {
    touchEndX = e.touches[0].clientX;
    const diff = touchEndX - touchStartX;
    
    if (diff > 0) {
        modalSwipeOffset = diff;
        const modalContent = e.currentTarget;
        modalContent.style.transform = `translateX(${diff}px)`;
        modalContent.style.transition = 'none';
    }
}

function handleTouchEnd(e) {
    const modalContent = e.currentTarget;
    const diff = touchEndX - touchStartX;
    
    if (diff > 150) {
        modalContent.style.transition = 'transform 0.3s ease';
        modalContent.style.transform = 'translateX(100%)';
        setTimeout(() => {
            closeMovieModal();
        }, 300);
    } else {
        modalContent.style.transition = 'transform 0.3s ease';
        modalContent.style.transform = 'translateX(0)';
    }
    
    touchStartX = 0;
    touchEndX = 0;
    modalSwipeOffset = 0;
}

function setupBackButton() {
    window.addEventListener('popstate', closeMovieModal);
}

function closeMovieModal() {
    const modal = document.getElementById('movieModal');
    modal.classList.remove('active');
    currentMovieId = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeMovieModal');
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }
});