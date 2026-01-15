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
            state.isSearchMode = true;
            state.currentSearchQuery = query;
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

    const isWatchlistGrid = gridId === 'watchlistGrid';
    const isWatchedGrid = gridId === 'watchedGrid';

    const moviesHtml = movies.map(movie => {
        const inWatchlist = state.watchlist.some(w => w.movie_id == movie.id);
        const isWatched = state.watched.some(w => w.movie_id == movie.id);
        
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
    
    const allGenres = new Set();
    moviesWithDetails.forEach(movie => {
        if (movie.genres && movie.genres.length > 0) {
            movie.genres.forEach(genre => {
                allGenres.add(JSON.stringify({id: genre.id, name: genre.name}));
            });
        }
    });
    
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

    const isMobile = window.innerWidth <= 768;
    const defaultSize = isMobile ? 3 : 6;
    gridSize.value = defaultSize;

    btn.removeEventListener('click', toggleWatchlistDropdown);
    btn.addEventListener('click', toggleWatchlistDropdown);

    sortBy.removeEventListener('change', applyWatchlistFilters);
    sortBy.addEventListener('change', applyWatchlistFilters);
    
    genreFilter.removeEventListener('change', applyWatchlistFilters);
    genreFilter.addEventListener('change', applyWatchlistFilters);

    gridSize.removeEventListener('input', handleWatchlistGridSize);
    gridSize.addEventListener('input', handleWatchlistGridSize);

    document.removeEventListener('click', closeWatchlistDropdownOutside);
    document.addEventListener('click', closeWatchlistDropdownOutside);

    handleWatchlistGridSize({ target: gridSize });
}

function handleWatchlistGridSize(e) {
    const value = e.target.value;
    const valueDisplay = document.getElementById('watchlistGridValue');
    const grid = document.getElementById('watchlistGrid');
    const preview = document.getElementById('watchlistGridPreview');
    const slider = e.target;
    
    valueDisplay.textContent = value;
    
    const percent = ((value - 3) / (8 - 3)) * 100;
    slider.style.setProperty('--slider-value', `${percent}%`);
    
    grid.className = 'movies-grid cols-' + value;
    
    const gaps = {
        3: '12px',
        4: '10px',
        5: '8px',
        6: '6px',
        7: '5px',
        8: '4px'
    };
    grid.style.gap = gaps[value] || '12px';
    
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

    if (genreFilter !== 'all') {
        filtered = filtered.filter(movie => 
            movie.genres && movie.genres.some(g => g.id == genreFilter)
        );
    }

    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'title-asc':
                return (a.title || '').localeCompare(b.title || '');
            case 'title-desc':
                return (b.title || '').localeCompare(a.title || '');
            case 'date-asc':
                return (a.release_date || '9999-12-31').localeCompare(b.release_date || '9999-12-31');
            case 'date-desc':
                return (b.release_date || '0000-01-01').localeCompare(a.release_date || '0000-01-01');
            case 'added-desc':
            default:
                return 0;
        }
    });

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
    
    const allGenres = new Set();
    moviesWithDetails.forEach(movie => {
        if (movie.genres && movie.genres.length > 0) {
            movie.genres.forEach(genre => {
                allGenres.add(JSON.stringify({id: genre.id, name: genre.name}));
            });
        }
    });
    
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

    const isMobile = window.innerWidth <= 768;
    const defaultSize = isMobile ? 3 : 6;
    gridSize.value = defaultSize;

    btn.removeEventListener('click', toggleWatchedDropdown);
    btn.addEventListener('click', toggleWatchedDropdown);

    sortBy.removeEventListener('change', applyWatchedFilters);
    sortBy.addEventListener('change', applyWatchedFilters);
    
    genreFilter.removeEventListener('change', applyWatchedFilters);
    genreFilter.addEventListener('change', applyWatchedFilters);

    gridSize.removeEventListener('input', handleWatchedGridSize);
    gridSize.addEventListener('input', handleWatchedGridSize);

    document.removeEventListener('click', closeWatchedDropdownOutside);
    document.addEventListener('click', closeWatchedDropdownOutside);

    handleWatchedGridSize({ target: gridSize });
}

function handleWatchedGridSize(e) {
    const value = e.target.value;
    const valueDisplay = document.getElementById('watchedGridValue');
    const grid = document.getElementById('watchedGrid');
    const preview = document.getElementById('watchedGridPreview');
    const slider = e.target;
    
    valueDisplay.textContent = value;
    
    const percent = ((value - 3) / (8 - 3)) * 100;
    slider.style.setProperty('--slider-value', `${percent}%`);
    
    grid.className = 'movies-grid cols-' + value;
    
    const gaps = {
        3: '12px',
        4: '10px',
        5: '8px',
        6: '6px',
        7: '5px',
        8: '4px'
    };
    grid.style.gap = gaps[value] || '12px';
    
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

    if (genreFilter !== 'all') {
        filtered = filtered.filter(movie => 
            movie.genres && movie.genres.some(g => g.id == genreFilter)
        );
    }

    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'title-asc':
                return (a.title || '').localeCompare(b.title || '');
            case 'title-desc':
                return (b.title || '').localeCompare(a.title || '');
            case 'date-asc':
                return (a.release_date || '9999-12-31').localeCompare(b.release_date || '9999-12-31');
            case 'date-desc':
                return (b.release_date || '0000-01-01').localeCompare(a.release_date || '0000-01-01');
            case 'added-desc':
            default:
                return 0;
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
    if (!grid) return;
    
    if (!movies || movies.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>Aucun film trouvé</h3></div>';
        return;
    }

    const isWatchlistGrid = gridId === 'watchlistGrid';
    const isWatchedGrid = gridId === 'watchedGrid';

    const watchlistData = state.watchlist || [];
    const watchedData = state.watched || [];
    
    const imageBaseUrl = CONFIG.TMDB_IMG_URL || 'https://image.tmdb.org/t/p/w500';

    let html = '';
    let currentLetter = '';
    
    movies.forEach(movie => {
        if (!movie || !movie.id) return;
        
        const inWatchlist = watchlistData.some(w => w.movie_id == movie.id);
        const isWatched = watchedData.some(w => w.movie_id == movie.id);
        
        const showWatchlistBadge = inWatchlist && !isWatchlistGrid;
        const showWatchedBadge = isWatched && !isWatchedGrid;

        if (separatorType === 'title' && movie.title && movie.title.length > 0) {
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

        const safeTitle = movie.title || 'Film sans titre';
        
        html += `
            <div class="movie-card" data-movie-id="${movie.id}" onclick="showMovieDetails(${movie.id})">
                <div class="movie-poster">
                    ${movie.poster_path 
                        ? `<img src="${imageBaseUrl}${movie.poster_path}" alt="${safeTitle}" loading="lazy">` 
                        : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;">🎬</div>'}
                    ${showWatchlistBadge ? '<div class="watchlist-badge">À voir</div>' : ''}
                    ${showWatchedBadge ? '<div class="watched-badge">✓ Vu</div>' : ''}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function setupInfiniteScroll() {
    const trigger = document.getElementById('infiniteScrollTrigger');
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isLoading) {
            if (state.isSearchMode) {
                searchMovies(true);
            } else {
                loadPopularMovies(true);
            }
        }
    }, {
        rootMargin: '100px',
        threshold: 0.1
    });

    if (trigger) observer.observe(trigger);
}