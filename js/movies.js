async function loadPopularMovies(isScrollLoad = false) {
    const grid = document.getElementById('moviesGrid');
    const loader = document.querySelector('#infiniteScrollTrigger .loader');

    if (state.isLoading) return;

    try {
        state.isLoading = true;
        if (loader) loader.style.display = 'inline-block';

        if (!isScrollLoad) {
            state.currentPage = 1;
            state.movies = [];
            state.isSearchMode = false;
            state.currentSearchQuery = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
        }

        const pagesToFetch = [state.currentPage, state.currentPage + 1];

        const promises = pagesToFetch.map(page => 
            fetch(
                `${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=${page}`
            ).then(response => {
                if (!response.ok) throw new Error(`Erreur page ${page}`);
                return response.json();
            })
        );

        const results = await Promise.all(promises);
        const newMovies = results.flatMap(data => data.results);

        state.movies = [...state.movies, ...newMovies];
        displayMovies(newMovies, 'moviesGrid', isScrollLoad);
        state.currentPage += 2;

    } catch (error) {
        console.error(error);
        if (!isScrollLoad) {
            grid.innerHTML = '<div class="error">Erreur lors du chargement des films</div>';
        }
    } finally {
        state.isLoading = false;
        if (loader) loader.style.display = 'none';
    }
}

async function searchMovies(isScrollLoad = false) {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.trim() : '';
    const grid = document.getElementById('moviesGrid');
    const loader = document.querySelector('#infiniteScrollTrigger .loader');

    if (!query) {
        state.searchPage = 1;
        state.isSearchMode = false;
        state.currentSearchQuery = '';
        loadPopularMovies(false);
        return;
    }

    if (state.isLoading) return;
    
    try {
        state.isLoading = true;
        if (loader) loader.style.display = 'inline-block';

        if (!isScrollLoad) {
            state.searchPage = 1;
            state.movies = [];
            state.isSearchMode = true; // ✅ On active le mode recherche
            state.currentSearchQuery = query; // ✅ On mémorise la recherche
        }

        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(state.currentSearchQuery)}&page=${state.searchPage}`
        );
        const data = await response.json();
        
        const newMovies = data.results || [];
        state.movies = [...state.movies, ...newMovies];
        displayMovies(newMovies, 'moviesGrid', isScrollLoad);
        state.searchPage++;

    } catch (error) {
        console.error(error);
        if (!isScrollLoad) {
            grid.innerHTML = '<div class="error">Erreur lors de la recherche</div>';
        }
    } finally {
        state.isLoading = false;
        if (loader) loader.style.display = 'none';
    }
}

function displayMovies(movies, gridId, shouldAppend = false) {
    const grid = document.getElementById(gridId);
    
    if (movies.length === 0) {
        if (!shouldAppend) {
            grid.innerHTML = '<div class="empty-state"><h3>Aucun film trouvé</h3></div>';
        }
        return;
    }

    // Déterminer si on est dans watchlist ou watched pour ne pas afficher les badges
    const isWatchlistGrid = gridId === 'watchlistGrid';
    const isWatchedGrid = gridId === 'watchedGrid';

    const moviesHtml = movies.map(movie => {
        const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
        const isWatched = state.watched.some(w => w.movie_id == movie.id);
        
        // Ne pas afficher les badges si on est dans la grille correspondante
        const showWatchlistBadge = inWatchlist && !isWatchlistGrid;
        const showWatchedBadge = isWatched && !isWatchedGrid;
        
        return `
            <div class="movie-card" data-movie-id="${movie.id}" onclick="showMovieDetails(${movie.id})">
                <div class="movie-poster">
                    ${movie.poster_path ? `<img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">` : '🎬'}
                    ${showWatchlistBadge ? '<div class="watchlist-badge">À voir</div>' : ''}
                    ${showWatchedBadge ? '<div class="watched-badge">✓ Vu</div>' : ''}
                </div>
            </div>
        `;
    }).join('');

    if (shouldAppend) {
        grid.insertAdjacentHTML('beforeend', moviesHtml);
    } else {
        grid.innerHTML = moviesHtml;
    }
}

async function showMovieDetails(movieId) {
    const modal = document.getElementById('movieModal');
    const details = document.getElementById('movieDetails');
    
    details.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement...</div>';
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
                            <button class="btn btn-trailer" onclick="showTrailer(${movie.id})">
                                <i class="fas fa-play"></i> ▶️ Trailer
                            </button>

                            <button id="btn-watched-${movie.id}" 
                                    class="btn btn-seen ${isWatched ? 'active' : ''}" 
                                    onclick="toggleWatched(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                                <i class="fas ${isWatched ? 'fa-check' : 'fa-eye'}"></i> 
                                ${isWatched ? '✓ Vu' : '+ Vu'}
                            </button>

                            <button id="btn-watchlist-${movie.id}" 
                                    class="btn btn-watchlist ${inWatchlist ? 'active' : ''}" 
                                    onclick="toggleWatchlist(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}')">
                                <i class="fas ${inWatchlist ? 'fa-check' : 'fa-plus'}"></i> 
                                ${inWatchlist ? '✓ Watchlist' : '+ Watchlist'}
                            </button>
                            
                        ` : '<p class="login-prompt">Connectez-vous pour gérer ce film</p>'}
                    </div>

                    <div style="margin-top: 20px;">
                        <h3>Synopsis</h3>
                        <p>${movie.overview || 'Pas de résumé disponible.'}</p>
                    </div>
                </div>
            </div>
        `;

        setupRatingStars(movie.id);

    } catch (error) {
        console.error(error);
        details.innerHTML = '<div class="error">Erreur de chargement des détails.</div>';
    }
}
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
async function toggleWatchlist(movieId, title, posterPath) {
    if (!getToken()) return;

    const btn = document.getElementById(`btn-watchlist-${movieId}`);
    if(btn) btn.disabled = true;

    const index = state.watchlist.findIndex(m => m.movie_id == movieId);
    const wasInList = index !== -1;

    try {
        if (wasInList) {
            await apiRequest(`/watchlist/${movieId}`, { method: 'DELETE' });
            state.watchlist.splice(index, 1);
            showToast('Retiré de la watchlist');
            if (btn) {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-plus"></i> Watchlist';
            }
        } else {
            await apiRequest('/watchlist', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Ajouté à la watchlist');
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-check"></i> ✓ Watchlist';
            }
        }
    } catch (error) {
        console.error(error);
        showToast('Erreur lors de la mise à jour', 'error');
    } finally {
        if(btn) btn.disabled = false;
    }
}

/* ==================== TOGGLE WATCHED (Mise à jour visuelle + API) ==================== */
async function toggleWatched(movieId, title, posterPath) {
    if (!getToken()) return;

    const btn = document.getElementById(`btn-watched-${movieId}`);
    if(btn) btn.disabled = true;

    const index = state.watched.findIndex(m => m.movie_id == movieId);
    const wasWatched = index !== -1;

    try {
        if (wasWatched) {
            // Suppression
            await apiRequest(`/watched/${movieId}`, { method: 'DELETE' });
            state.watched.splice(index, 1);
            showToast('Retiré des films vus');
            if (btn) {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-eye"></i> ✓ Vu';
            }
        } else {
            await apiRequest('/watched', {
                method: 'POST',
                body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
            });
            state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
            showToast('Marqué comme vu');
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-check"></i> Vu';
            }
        }
    } catch (error) {
        console.error(error);
        showToast('Erreur lors de la mise à jour', 'error');
    } finally {
        if(btn) btn.disabled = false;
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
    
    // Charger les détails complets pour chaque film
    const moviesWithDetails = await Promise.all(
        watchlist.map(async (w) => {
            try {
                const response = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${w.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const data = await response.json();
                return {
                    id: w.movie_id,
                    title: w.movie_title,
                    poster_path: w.movie_poster,
                    release_date: data.release_date,
                    genres: data.genres || []
                };
            } catch (e) {
                return {
                    id: w.movie_id,
                    title: w.movie_title,
                    poster_path: w.movie_poster,
                    release_date: null,
                    genres: []
                };
            }
        })
    );

    state.watchlistWithDetails = moviesWithDetails;
    
    // Récupérer tous les genres uniques
    const allGenres = new Set();
    moviesWithDetails.forEach(movie => {
        if (movie.genres && movie.genres.length > 0) {
            movie.genres.forEach(genre => {
                allGenres.add(JSON.stringify({id: genre.id, name: genre.name}));
            });
        }
    });
    
    // Peupler le select des genres
    const genreSelect = document.getElementById('watchlistGenreFilter');
    genreSelect.innerHTML = '<option value="all">Tous les genres</option>';
    
    if (allGenres.size > 0) {
        Array.from(allGenres)
            .map(g => JSON.parse(g))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(genre => {
                genreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
            });
    }

    applyWatchlistFilters();
    setupWatchlistFilterListeners();
}

function setupWatchlistFilterListeners() {
    const btn = document.getElementById('watchlistFiltersBtn');
    const dropdown = document.getElementById('watchlistFilters');
    const sortBy = document.getElementById('watchlistSortBy');
    const genreFilter = document.getElementById('watchlistGenreFilter');
    const gridSize = document.getElementById('watchlistGridSize');
    const gridValue = document.getElementById('watchlistGridValue');

    // Set default grid size based on screen width
    const isMobile = window.innerWidth <= 768;
    const defaultSize = isMobile ? 3 : 6;
    gridSize.value = defaultSize;

    // Toggle dropdown
    btn.removeEventListener('click', toggleWatchlistDropdown);
    btn.addEventListener('click', toggleWatchlistDropdown);

    // Apply filters on change
    sortBy.removeEventListener('change', applyWatchlistFilters);
    sortBy.addEventListener('change', applyWatchlistFilters);
    
    genreFilter.removeEventListener('change', applyWatchlistFilters);
    genreFilter.addEventListener('change', applyWatchlistFilters);

    // Grid size slider
    gridSize.removeEventListener('input', handleWatchlistGridSize);
    gridSize.addEventListener('input', handleWatchlistGridSize);

    // Close dropdown when clicking outside
    document.removeEventListener('click', closeWatchlistDropdownOutside);
    document.addEventListener('click', closeWatchlistDropdownOutside);

    // Initialize grid size
    handleWatchlistGridSize({ target: gridSize });
}

function handleWatchlistGridSize(e) {
    const value = e.target.value;
    const valueDisplay = document.getElementById('watchlistGridValue');
    const grid = document.getElementById('watchlistGrid');
    const preview = document.getElementById('watchlistGridPreview');
    const slider = e.target;
    
    valueDisplay.textContent = value;
    
    // Update slider background
    const percent = ((value - 3) / (8 - 3)) * 100;
    slider.style.setProperty('--slider-value', `${percent}%`);
    
    // Update grid columns
    grid.className = 'movies-grid cols-' + value;
    
    // ✅ AJOUT : Ajuster le gap dynamiquement (plus de colonnes = moins de gap)
    const gaps = {
        3: '12px',
        4: '10px',
        5: '8px',
        6: '6px',
        7: '5px',
        8: '4px'
    };
    grid.style.gap = gaps[value] || '12px';
    
    // Update preview
    const items = preview.querySelectorAll('.grid-preview-item');
    items.forEach((item, index) => {
        item.classList.toggle('active', index < value);
    });
}

function toggleWatchlistDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('watchlistFilters');
    const btn = document.getElementById('watchlistFiltersBtn');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('active', !isVisible);
}

function closeWatchlistDropdownOutside(e) {
    const dropdown = document.getElementById('watchlistFilters');
    const btn = document.getElementById('watchlistFiltersBtn');
    if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.style.display = 'none';
        btn.classList.remove('active');
    }
}

function applyWatchlistFilters() {
    const sortBy = document.getElementById('watchlistSortBy').value;
    const genreFilter = document.getElementById('watchlistGenreFilter').value;
    
    let filtered = [...state.watchlistWithDetails];

    // Filter by genre
    if (genreFilter !== 'all') {
        filtered = filtered.filter(movie => 
            movie.genres && movie.genres.some(g => g.id == genreFilter)
        );
    }
    // Sort - AVEC PROTECTION CONTRE LES VALEURS NULL
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'title-asc':
                const titleA = a.title || '';
                const titleB = b.title || '';
                return titleA.localeCompare(titleB);
                
            case 'title-desc':
                const titleDescA = a.title || '';
                const titleDescB = b.title || '';
                return titleDescB.localeCompare(titleDescA);
                
            case 'date-asc':
                const dateA = a.release_date || '9999-12-31';
                const dateB = b.release_date || '9999-12-31';
                return dateA.localeCompare(dateB);
                
            case 'date-desc':
                const dateDscA = a.release_date || '0000-01-01';
                const dateDscB = b.release_date || '0000-01-01';
                return dateDscB.localeCompare(dateDscA);
                
            case 'added-desc':
            default:
                return 0;
        }
    });

    // Display with genre separators if filtered by genre
    if (genreFilter === 'all' && sortBy.includes('title')) {
        displayMoviesWithSeparators(filtered, 'watchlistGrid', 'title');
    } else {
        displayMovies(filtered, 'watchlistGrid');
    }
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
    
    // Charger les détails complets pour chaque film
    const moviesWithDetails = await Promise.all(
        watched.map(async (w) => {
            try {
                const response = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${w.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                );
                const data = await response.json();
                return {
                    id: w.movie_id,
                    title: w.movie_title,
                    poster_path: w.movie_poster,
                    release_date: data.release_date,
                    genres: data.genres || []
                };
            } catch (e) {
                return {
                    id: w.movie_id,
                    title: w.movie_title,
                    poster_path: w.movie_poster,
                    release_date: null,
                    genres: []
                };
            }
        })
    );

    state.watchedWithDetails = moviesWithDetails;
    
    // Récupérer tous les genres uniques
    const allGenres = new Set();
    moviesWithDetails.forEach(movie => {
        if (movie.genres && movie.genres.length > 0) {
            movie.genres.forEach(genre => {
                allGenres.add(JSON.stringify({id: genre.id, name: genre.name}));
            });
        }
    });
    
    // Peupler le select des genres
    const genreSelect = document.getElementById('watchedGenreFilter');
    genreSelect.innerHTML = '<option value="all">Tous les genres</option>';
    
    if (allGenres.size > 0) {
        Array.from(allGenres)
            .map(g => JSON.parse(g))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(genre => {
                genreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
            });
    }

    applyWatchedFilters();
    setupWatchedFilterListeners();
}

function setupWatchedFilterListeners() {
    const btn = document.getElementById('watchedFiltersBtn');
    const dropdown = document.getElementById('watchedFilters');
    const sortBy = document.getElementById('watchedSortBy');
    const genreFilter = document.getElementById('watchedGenreFilter');
    const gridSize = document.getElementById('watchedGridSize');
    const gridValue = document.getElementById('watchedGridValue');

    // Set default grid size based on screen width
    const isMobile = window.innerWidth <= 768;
    const defaultSize = isMobile ? 3 : 6;
    gridSize.value = defaultSize;

    // Toggle dropdown
    btn.removeEventListener('click', toggleWatchedDropdown);
    btn.addEventListener('click', toggleWatchedDropdown);

    // Apply filters on change
    sortBy.removeEventListener('change', applyWatchedFilters);
    sortBy.addEventListener('change', applyWatchedFilters);
    
    genreFilter.removeEventListener('change', applyWatchedFilters);
    genreFilter.addEventListener('change', applyWatchedFilters);

    // Grid size slider
    gridSize.removeEventListener('input', handleWatchedGridSize);
    gridSize.addEventListener('input', handleWatchedGridSize);

    // Close dropdown when clicking outside
    document.removeEventListener('click', closeWatchedDropdownOutside);
    document.addEventListener('click', closeWatchedDropdownOutside);

    // Initialize grid size
    handleWatchedGridSize({ target: gridSize });
}
function handleWatchedGridSize(e) {
    const value = e.target.value;
    const valueDisplay = document.getElementById('watchedGridValue');
    const grid = document.getElementById('watchedGrid');
    const preview = document.getElementById('watchedGridPreview');
    const slider = e.target;
    
    valueDisplay.textContent = value;
    
    // Update slider background
    const percent = ((value - 3) / (8 - 3)) * 100;
    slider.style.setProperty('--slider-value', `${percent}%`);
    
    // Update grid columns
    grid.className = 'movies-grid cols-' + value;
    
    // ✅ AJOUT : Ajuster le gap dynamiquement (plus de colonnes = moins de gap)
    const gaps = {
        3: '12px',
        4: '10px',
        5: '8px',
        6: '6px',
        7: '5px',
        8: '4px'
    };
    grid.style.gap = gaps[value] || '12px';
    
    // Update preview
    const items = preview.querySelectorAll('.grid-preview-item');
    items.forEach((item, index) => {
        item.classList.toggle('active', index < value);
    });
}

function toggleWatchedDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('watchedFilters');
    const btn = document.getElementById('watchedFiltersBtn');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('active', !isVisible);
}

function closeWatchedDropdownOutside(e) {
    const dropdown = document.getElementById('watchedFilters');
    const btn = document.getElementById('watchedFiltersBtn');
    if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.style.display = 'none';
        btn.classList.remove('active');
    }
}
function applyWatchedFilters() {
    const sortBy = document.getElementById('watchedSortBy').value;
    const genreFilter = document.getElementById('watchedGenreFilter').value;
    
    let filtered = [...state.watchedWithDetails];

    // Filter by genre
    if (genreFilter !== 'all') {
        filtered = filtered.filter(movie => 
            movie.genres && movie.genres.some(g => g.id == genreFilter)
        );
    }
    // Sort
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'title-asc':
                // Protection: si title est null/undefined, le mettre à la fin
                const titleA = a.title || '';
                const titleB = b.title || '';
                return titleA.localeCompare(titleB);
                
            case 'title-desc':
                const titleDescA = a.title || '';
                const titleDescB = b.title || '';
                return titleDescB.localeCompare(titleDescA);
                
            case 'date-asc':
                // Protection: si release_date est null, le mettre à la fin
                const dateA = a.release_date || '9999-12-31';
                const dateB = b.release_date || '9999-12-31';
                return dateA.localeCompare(dateB);
                
            case 'date-desc':
                const dateDscA = a.release_date || '0000-01-01';
                const dateDscB = b.release_date || '0000-01-01';
                return dateDscB.localeCompare(dateDscA);
                
            case 'added-desc':
            default:
                return 0; // Keep original order
        }
    });
    if (genreFilter === 'all' && sortBy.includes('title')) {
        displayMoviesWithSeparators(filtered, 'watchedGrid', 'title');
    } else {
        displayMovies(filtered, 'watchedGrid');
    }
}

function resetWatchedFilters() {
    document.getElementById('watchedSortBy').value = 'added-desc';
    document.getElementById('watchedGenreFilter').value = 'all';
    const isMobile = window.innerWidth <= 768;
    const defaultSize = isMobile ? 3 : 6;
    document.getElementById('watchedGridSize').value = defaultSize;
    handleWatchedGridSize({ target: document.getElementById('watchedGridSize') });
    applyWatchedFilters();
}

function displayMoviesWithSeparators(movies, gridId, separatorType) {
    const grid = document.getElementById(gridId);
    
    if (movies.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Aucun film trouvé</h3></div>';
        return;
    }

    // Déterminer si on est dans watchlist ou watched pour ne pas afficher les badges
    const isWatchlistGrid = gridId === 'watchlistGrid';
    const isWatchedGrid = gridId === 'watchedGrid';

    let html = '';
    let currentLetter = '';

    movies.forEach(movie => {
        const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
        const isWatched = state.watched.some(w => w.movie_id == movie.id);
        
        // Ne pas afficher les badges si on est dans la grille correspondante
        const showWatchlistBadge = inWatchlist && !isWatchlistGrid;
        const showWatchedBadge = isWatched && !isWatchedGrid;
        
        // Ajouter un séparateur alphabétique
        if (separatorType === 'title') {
            const firstLetter = movie.title.charAt(0).toUpperCase();
            if (firstLetter !== currentLetter) {
                currentLetter = firstLetter;
                html += `
                    <div class="genre-separator" style="grid-column: 1 / -1;">
                        <h3>${currentLetter}</h3>
                    </div>
                `;
            }
        }

        html += `
            <div class="movie-card" data-movie-id="${movie.id}" onclick="showMovieDetails(${movie.id})">
                <div class="movie-poster">
                    ${movie.poster_path ? `<img src="${CONFIG.TMDB_IMG_URL}${movie.poster_path}" alt="${movie.title}">` : '🎬'}
                    ${showWatchlistBadge ? '<div class="watchlist-badge">À voir</div>' : ''}
                    ${showWatchedBadge ? '<div class="watched-badge">✓ Vu</div>' : ''}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

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

function setupInfiniteScroll() {
    const trigger = document.getElementById('infiniteScrollTrigger');
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isLoading) {
            // ✅ On vérifie le FLAG isSearchMode au lieu de l'input
            if (state.isSearchMode) {
                // Continue la recherche en cours
                searchMovies(true);
            } else {
                // Charge les films populaires
                loadPopularMovies(true);
            }
        }
    }, {
        rootMargin: '100px',
        threshold: 0.1
    });

    if (trigger) observer.observe(trigger);
}