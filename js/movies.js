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
    const query = state.currentSearchQuery || (searchInput ? searchInput.value.trim() : '');
    const grid = document.getElementById('moviesGrid');
    const loader = document.querySelector('#infiniteScrollTrigger .loader');

    // Si pas de requête, retour aux films populaires
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

        // Premier chargement de recherche
        if (!isScrollLoad) {
            state.searchPage = 1;
            state.movies = [];
            state.isSearchMode = true;
            state.currentSearchQuery = query;
        }
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${state.searchPage}&include_adult=false`
        );
        const data = await response.json();
        
        let newMovies = data.results || [];
        if (typeof filterAdultContent === 'function') {
            newMovies = filterAdultContent(newMovies);
        }
        newMovies.sort((a, b) => {
            const scoreA = (a.vote_count || 0) * (a.vote_average || 0);
            const scoreB = (b.vote_count || 0) * (b.vote_average || 0);
            return scoreB - scoreA;
        });
        
        if (!isScrollLoad) {
            state.movies = newMovies;
            grid.innerHTML = '';
        } else {
            state.movies = [...state.movies, ...newMovies];
        }
        
        displayMovies(newMovies, 'moviesGrid', isScrollLoad);
        state.searchPage++;

    } catch (error) {
        console.error('Erreur recherche:', error);
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
    const watchlistArray = Array.isArray(state.watchlist) ? state.watchlist : [];
    const watchedArray = Array.isArray(state.watched) ? state.watched : [];

    const moviesHtml = movies.map(movie => {
        const inWatchlist = watchlistArray.some(w => w.movie_id == movie.id);
        const isWatched = watchedArray.some(w => w.movie_id == movie.id);
        
        const showWatchlistBadge = inWatchlist && !isWatchlistGrid;
        const showWatchedBadge = isWatched && !isWatchedGrid;
        
        let posterUrl = '';
        if (movie.poster_path) {
            if (movie.poster_path.startsWith('/')) {
                posterUrl = `${CONFIG.TMDB_IMG_URL}${movie.poster_path}`;
            } else {
                posterUrl = movie.poster_path;
            }
        }
        
        return `
            <div class="movie-card" data-movie-id="${movie.id}" onclick="showMovieDetails(${movie.id})">
                <div class="movie-poster">
                    ${posterUrl ? `<img src="${posterUrl}" alt="${movie.title}">` : '🎬'}
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


if (!state.watchlistPage) state.watchlistPage = 1;
if (!state.watchlistLoading) state.watchlistLoading = false;
if (!state.watchlistAllMovies) state.watchlistAllMovies = [];
const MOVIES_PER_PAGE = 20;

async function loadWatchlist(isLoadMore = false) {
    if (!getToken()) {
        document.getElementById('watchlistGrid').innerHTML = 
            '<div class="empty-state"><h3>Connecte-toi pour voir ta watchlist</h3></div>';
        return;
    }

    if (state.watchlistLoading) {
        return;
    }
    
    state.watchlistLoading = true;

    const grid = document.getElementById('watchlistGrid');
    
    if (!isLoadMore) {
        grid.innerHTML = '<div class="loading">Chargement...</div>';
        state.watchlistPage = 1;
        state.watchlistAllMovies = [];
    }
    
    try {
        if (state.watchlistAllMovies.length === 0) {
            let watchlist = null;
            let fromCache = false;
            if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                try {
                    watchlist = await OfflineStorage.getWatchlist();
                    if (watchlist && watchlist.length > 0) {
                        fromCache = true;
                    }
                } catch (cacheError) {
                    console.warn('Erreur cache watchlist:', cacheError);
                }
            }
            if (navigator.onLine && !fromCache) {
                try {
                    const freshWatchlist = await apiRequest('/watchlist');
                    if (freshWatchlist && freshWatchlist.length > 0) {
                        watchlist = freshWatchlist;
                        if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                            OfflineStorage.saveListWithDetails('watchlist', freshWatchlist).catch(err => {
                                console.warn('Erreur sauvegarde cache:', err);
                            });
                        }
                    }
                } catch (apiError) {
                    console.warn('⚠️ Erreur API watchlist:', apiError);
                    if (!watchlist) {
                        grid.innerHTML = '<div class="empty-state"><h3>Impossible de charger la watchlist</h3><p>Vérifiez votre connexion</p></div>';
                        state.watchlistLoading = false;
                        return;
                    }
                }
            }
            if (!watchlist || watchlist.length === 0) {
                grid.innerHTML = '<div class="empty-state"><h3>Ta watchlist est vide</h3></div>';
                state.watchlistLoading = false;
                return;
            }

            state.watchlist = watchlist;
            // Trier par date
            const sortedWatchlist = watchlist.sort((a, b) => 
                new Date(b.added_at) - new Date(a.added_at)
            );
            state.watchlistAllMovies = await Promise.all(sortedWatchlist.map(async (w) => {
                let tmdbRating = 0;
                let runtime = 0;
                let details = null;
                // Toujours charger depuis le cache movies pour avoir runtime(sinon ca fonctionne pas et jsp pk)
                if (typeof OfflineStorage !== 'undefined') {
                    try {
                        const cached = await OfflineStorage.getFromStore('movies_cache', w.movie_id);
                        if (cached && cached.data) {
                            details = cached.data;
                            tmdbRating = cached.data.vote_average || 0;
                            runtime = cached.data.runtime || 0;
                        }
                    } catch (e) {
                        console.warn('⚠️ Cache non disponible pour film', w.movie_id);
                    }
                }
                
                // Fallback sur w.details si pas de cache
                if (!details && w.details) {
                    details = w.details;
                    tmdbRating = w.details.vote_average || 0;
                    runtime = w.details.runtime || 0;
                }
                
                if (details) {
                    return {
                        id: w.movie_id,
                        title: details.title || w.movie_title,
                        poster_path: details.poster_path || w.movie_poster,
                        release_date: details.release_date,
                        genres: details.genres || [],
                        added_at: w.added_at,
                        tmdb_rating: tmdbRating,
                        runtime: runtime
                    };
                } else {
                    return {
                        id: w.movie_id,
                        title: w.movie_title || 'Film',
                        poster_path: w.movie_poster,
                        release_date: null,
                        genres: [],
                        added_at: w.added_at,
                        tmdb_rating: 0,
                        runtime: 0 
                    };
                }
            }));
            
            //const withTMDBRating = state.watchlistAllMovies.filter(m => m.tmdb_rating > 0);
            //const withRuntime = state.watchlistAllMovies.filter(m => m.runtime > 0);
            //console.log(` Notes TMDB dans watchlist: ${withTMDBRating.length}/${state.watchlistAllMovies.length}`);
            //console.log(` Films avec durée dans watchlist: ${withRuntime.length}/${state.watchlistAllMovies.length}`);
            
            state.watchlistWithDetails = state.watchlistAllMovies;
            
            // Charger genres
            const allGenres = new Set();
            state.watchlistAllMovies.forEach(movie => {
                if (movie.genres && movie.genres.length > 0) {
                    movie.genres.forEach(genre => {
                        allGenres.add(JSON.stringify({id: genre.id, name: genre.name}));
                    });
                }
            });
            
            const genreSelect = document.getElementById('watchlistGenreFilter');
            if (genreSelect) {
                genreSelect.innerHTML = '<option value="all">Tous les genres</option>';
                
                if (allGenres.size > 0) {
                    Array.from(allGenres)
                        .map(g => JSON.parse(g))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .forEach(genre => {
                            genreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
                        });
                }
            }
        }
        
        // Pagination
        const start = (state.watchlistPage - 1) * MOVIES_PER_PAGE;
        const end = start + MOVIES_PER_PAGE;
        const chunk = state.watchlistAllMovies.slice(start, end);
        
        if (chunk.length === 0) {
            state.watchlistLoading = false;
            return;
        }
        
        displayMovies(chunk, 'watchlistGrid', isLoadMore);
        
        if (!isLoadMore) {
            setupWatchlistFilterListeners();
        }
        
        setupWatchlistInfiniteScroll();
        
        //console.log('Watchlist chargée (' + chunk.length + ' films affichés)');
    } catch (error) {
        console.error('Erreur loadWatchlist:', error);
        grid.innerHTML = '<div class="empty-state"><h3>Erreur de chargement</h3></div>';
    } finally {
        state.watchlistLoading = false;
    }
}

function setupWatchlistInfiniteScroll() {
    const grid = document.getElementById('watchlistGrid');
    if (!grid) return;
    
    if (state.watchlistObserver) {
        state.watchlistObserver.disconnect();
    }
    
    state.watchlistObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.watchlistLoading) {
            const totalPages = Math.ceil(state.watchlistAllMovies.length / MOVIES_PER_PAGE);
            if (state.watchlistPage < totalPages) {
                state.watchlistPage++;
                loadWatchlist(true);
            }
        }
    }, {
        rootMargin: '200px',
        threshold: 0.1
    });

    const cards = grid.querySelectorAll('.movie-card');
    const lastCard = cards[cards.length - 1];
    
    if (lastCard) {
        state.watchlistObserver.observe(lastCard);
    }
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
    const searchQuery = document.getElementById('watchlistSearchInput').value.toLowerCase().trim();
    
    let filtered = [...state.watchlistWithDetails];

    // Filtrer par recherche
    if (searchQuery) {
        filtered = filtered.filter(movie => 
            movie.title && movie.title.toLowerCase().includes(searchQuery)
        );
    }

    // Filtrer par genre
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
            case 'runtime-desc':
                return (b.runtime || 0) - (a.runtime || 0);
            case 'runtime-asc':
                return (a.runtime || 0) - (b.runtime || 0);
            case 'tmdb-rating-desc':
                return (b.tmdb_rating || 0) - (a.tmdb_rating || 0);
            case 'tmdb-rating-asc':
                return (a.tmdb_rating || 0) - (b.tmdb_rating || 0);
            case 'added-desc':
            default:
                return 0;
        }
    });

    if (genreFilter === 'all' && sortBy.includes('title') && !searchQuery) {
        displayMoviesWithSeparators(filtered, 'watchlistGrid', 'title');
    } else {
        displayMovies(filtered, 'watchlistGrid');
    }
}

if (!state.watchedPage) state.watchedPage = 1;
if (!state.watchedLoading) state.watchedLoading = false;
if (!state.watchedAllMovies) state.watchedAllMovies = [];

async function loadWatched(isLoadMore = false) {
    if (!getToken()) {
        document.getElementById('watchedGrid').innerHTML = 
            '<div class="empty-state"><h3>Connecte-toi</h3></div>';
        return;
    }

    if (state.watchedLoading) {
        return;
    }
    
    state.watchedLoading = true;

    const grid = document.getElementById('watchedGrid');
    
    if (!isLoadMore) {
        grid.innerHTML = '<div class="loading">Chargement...</div>';
        state.watchedPage = 1;
        state.watchedAllMovies = [];
    }
    
    try {
        if (state.watchedAllMovies.length === 0) {
            let watched = null;
            let fromCache = false;
            
            if (typeof OfflineStorage !== 'undefined' && OfflineStorage.isEnabled()) {
                watched = await OfflineStorage.getWatched();
                if (watched && watched.length > 0) {
                    fromCache = true;
                }
            }
            
            if (!watched && navigator.onLine) {
                watched = await apiRequest('/watched');
            }
            
            if (!watched || watched.length === 0) {
                grid.innerHTML = '<div class="empty-state"><h3>Aucun film vu</h3></div>';
                state.watchedLoading = false;
                return;
            }

            state.watched = watched;
            const sortedWatched = watched.sort((a, b) => 
                new Date(b.watched_at || b.added_at) - new Date(a.watched_at || a.added_at)
            );

            state.watchedAllMovies = await Promise.all(sortedWatched.map(async (w) => {
                let tmdbRating = 0;
                let runtime = 0;
                let details = null;
                
                // Toujours charger depuis le cache movies pour avoir runtim as i said c'est kaput sinon
                if (typeof OfflineStorage !== 'undefined') {
                    try {
                        const cached = await OfflineStorage.getFromStore('movies_cache', w.movie_id);
                        if (cached && cached.data) {
                            details = cached.data;
                            tmdbRating = cached.data.vote_average || 0;
                            runtime = cached.data.runtime || 0;
                        }
                    } catch (e) {
                        console.warn('⚠️ Cache non disponible pour film', w.movie_id);
                    }
                }
                
                // Fallback sur w.details si pas de cache
                if (!details && w.details) {
                    details = w.details;
                    tmdbRating = w.details.vote_average || 0;
                    runtime = w.details.runtime || 0;
                }
                
                if (details) {
                    return {
                        id: w.movie_id,
                        title: details.title || w.movie_title,
                        poster_path: details.poster_path || w.movie_poster,
                        release_date: details.release_date,
                        genres: details.genres || [],
                        watched_at: w.watched_at || w.added_at,
                        user_rating: w.rating || null,
                        tmdb_rating: tmdbRating,
                        runtime: runtime
                    };
                } else {
                    return {
                        id: w.movie_id,
                        title: w.movie_title || 'Film',
                        poster_path: w.movie_poster,
                        release_date: null,
                        genres: [],
                        watched_at: w.watched_at || w.added_at,
                        user_rating: w.rating || null,
                        tmdb_rating: 0,
                        runtime: 0 
                    };
                }
            }));
            
            //const withUserRating = state.watchedAllMovies.filter(m => m.user_rating !== null);
            //const withTMDBRating = state.watchedAllMovies.filter(m => m.tmdb_rating > 0);
            //const withRuntime = state.watchedAllMovies.filter(m => m.runtime > 0);
            //console.log(`Notes utilisateur: ${withUserRating.length}/${state.watchedAllMovies.length}`);
            //console.log(`Notes TMDB: ${withTMDBRating.length}/${state.watchedAllMovies.length}`);
            //console.log(`Films avec durée: ${withRuntime.length}/${state.watchedAllMovies.length}`);
            
            state.watchedWithDetails = state.watchedAllMovies;
            
            // Genres
            const allGenres = new Set();
            state.watchedAllMovies.forEach(movie => {
                if (movie.genres && movie.genres.length > 0) {
                    movie.genres.forEach(genre => {
                        allGenres.add(JSON.stringify({id: genre.id, name: genre.name}));
                    });
                }
            });
            
            const genreSelect = document.getElementById('watchedGenreFilter');
            if (genreSelect) {
                genreSelect.innerHTML = '<option value="all">Tous les genres</option>';
                
                if (allGenres.size > 0) {
                    Array.from(allGenres)
                        .map(g => JSON.parse(g))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .forEach(genre => {
                            genreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
                        });
                }
            }
        }
        
        const start = (state.watchedPage - 1) * MOVIES_PER_PAGE;
        const end = start + MOVIES_PER_PAGE;
        const chunk = state.watchedAllMovies.slice(start, end);
        
        if (chunk.length === 0) {
            state.watchedLoading = false;
            return;
        }
        
        displayMovies(chunk, 'watchedGrid', isLoadMore);
        
        if (!isLoadMore) {
            setupWatchedFilterListeners();
        }
        
        setupWatchedInfiniteScroll();
        
        //console.log('Films vus chargés (' + chunk.length + ' films affichés)');
    } catch (error) {
        console.error('Erreur loadWatched:', error);
        grid.innerHTML = '<div class="empty-state"><h3>Erreur de chargement</h3></div>';
    } finally {
        state.watchedLoading = false;
    }
}
function setupWatchedInfiniteScroll() {
    const grid = document.getElementById('watchedGrid');
    if (!grid) return;
    
    if (state.watchedObserver) {
        state.watchedObserver.disconnect();
    }
    
    state.watchedObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.watchedLoading) {
            const totalPages = Math.ceil(state.watchedAllMovies.length / MOVIES_PER_PAGE);
            if (state.watchedPage < totalPages) {
                state.watchedPage++;
                loadWatched(true);
            }
        }
    }, {
        rootMargin: '200px',
        threshold: 0.1
    });

    const cards = grid.querySelectorAll('.movie-card');
    const lastCard = cards[cards.length - 1];
    
    if (lastCard) {
        state.watchedObserver.observe(lastCard);
    }
}


function setupWatchedFilterListeners() {
    const btn = document.getElementById('watchedFiltersBtn');
    const dropdown = document.getElementById('watchedFilters');
    const sortBy = document.getElementById('watchedSortBy');
    const genreFilter = document.getElementById('watchedGenreFilter');
    const gridSize = document.getElementById('watchedGridSize');
    const searchInput = document.getElementById('watchedSearchInput');

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

    searchInput.removeEventListener('input', applyWatchedFilters);
    searchInput.addEventListener('input', applyWatchedFilters);

    document.removeEventListener('click', closeWatchedDropdownOutside);
    document.addEventListener('click', closeWatchedDropdownOutside);

    handleWatchedGridSize({ target: gridSize });
}

function setupWatchlistFilterListeners() {
    const btn = document.getElementById('watchlistFiltersBtn');
    const dropdown = document.getElementById('watchlistFilters');
    const sortBy = document.getElementById('watchlistSortBy');
    const genreFilter = document.getElementById('watchlistGenreFilter');
    const gridSize = document.getElementById('watchlistGridSize');
    const searchInput = document.getElementById('watchlistSearchInput');

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

    // Recherche en temps réel
    searchInput.removeEventListener('input', applyWatchlistFilters);
    searchInput.addEventListener('input', applyWatchlistFilters);

    document.removeEventListener('click', closeWatchlistDropdownOutside);
    document.addEventListener('click', closeWatchlistDropdownOutside);

    handleWatchlistGridSize({ target: gridSize });
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
    const searchQuery = document.getElementById('watchedSearchInput').value.toLowerCase().trim();
    
    let filtered = [...state.watchedWithDetails];

    // Filtrer par recherche
    if (searchQuery) {
        filtered = filtered.filter(movie => 
            movie.title && movie.title.toLowerCase().includes(searchQuery)
        );
    }

    // Filtrer par genre
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
            case 'user-rating-desc':
                return (b.user_rating || 0) - (a.user_rating || 0);
            case 'user-rating-asc':
                return (a.user_rating || 0) - (b.user_rating || 0);
            case 'runtime-desc':
                return (b.runtime || 0) - (a.runtime || 0);
            case 'runtime-asc':
                return (a.runtime || 0) - (b.runtime || 0);
            case 'tmdb-rating-desc':
                return (b.tmdb_rating || 0) - (a.tmdb_rating || 0);
            case 'tmdb-rating-asc':
                return (a.tmdb_rating || 0) - (b.tmdb_rating || 0);
            case 'added-desc':
            default:
                return 0;
        }
    });

    if (genreFilter === 'all' && sortBy.includes('title') && !searchQuery) {
        displayMoviesWithSeparators(filtered, 'watchedGrid', 'title');
    } else {
        displayMovies(filtered, 'watchedGrid');
    }
}

function resetWatchlistFilters() {
    document.getElementById('watchlistSortBy').value = 'added-desc';
    document.getElementById('watchlistGenreFilter').value = 'all';
    document.getElementById('watchlistSearchInput').value = '';
    const isMobile = window.innerWidth <= 768;
    const defaultSize = isMobile ? 3 : 6;
    document.getElementById('watchlistGridSize').value = defaultSize;
    handleWatchlistGridSize({ target: document.getElementById('watchlistGridSize') });
    applyWatchlistFilters();
}


function resetWatchedFilters() {
    document.getElementById('watchedSortBy').value = 'added-desc';
    document.getElementById('watchedGenreFilter').value = 'all';
    document.getElementById('watchedSearchInput').value = '';
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

function toggleSearch() {
    const widget = document.getElementById('searchWidget');
    const input = document.getElementById('floatingSearchInput');
    
    widget.classList.toggle('active');
    
    if (widget.classList.contains('active')) {
        input.focus();
        input.removeEventListener('input', handleFloatingSearch);
        input.addEventListener('input', handleFloatingSearch);
    } else {
        input.value = '';
        if (state.currentView === 'watchlist') {
            document.getElementById('watchlistSearchInput').value = '';
            applyWatchlistFilters();
        } else if (state.currentView === 'watched') {
            document.getElementById('watchedSearchInput').value = '';
            applyWatchedFilters();
        }
    }
}

function handleFloatingSearch() {
    const input = document.getElementById('floatingSearchInput');
    const query = input.value;
    
    if (state.currentView === 'watchlist') {
        document.getElementById('watchlistSearchInput').value = query;
        applyWatchlistFilters();
    } else if (state.currentView === 'watched') {
        document.getElementById('watchedSearchInput').value = query;
        applyWatchedFilters();
    }
}

//recherche

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                state.isSearchMode = true;
                state.currentPage = 1;
                state.movies = [];
                state.currentSearchQuery = searchInput.value;
                searchMovies();
                searchInput.blur();
            }
        });
    }
});



/**
 * Met à jour dynamiquement la grille watchlist sans tout recharger
 * @param {number} movieId
 * @param {string} action
 * @param {object} movieData
 */
async function updateWatchlistGrid(movieId, action, movieData = null) {
    const grid = document.getElementById('watchlistGrid');
    if (!grid) return;
    
    
    if (action === 'add' && movieData) {
        const existingCard = grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (existingCard) {
            return;
        }
        let movieDetails = null;
        try {
            const response = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`);
            if (response.ok) {
                movieDetails = await response.json();
            }
        } catch (error) {
            console.error('Erreur chargement détails film:', error);
        }
        // Créernfilm avec tous les détails
        const movie = {
            id: movieId,
            title: movieDetails?.title || movieData.title || 'Film',
            poster_path: movieDetails?.poster_path || movieData.poster_path,
            release_date: movieDetails?.release_date,
            genres: movieDetails?.genres || [],
            tmdb_rating: movieDetails?.vote_average || 0,
            runtime: movieDetails?.runtime || 0,
            added_at: new Date().toISOString()
        };
        
        state.watchlistAllMovies = [movie, ...state.watchlistAllMovies];
        state.watchlistWithDetails = state.watchlistAllMovies;
        
        // Créer la carte HTML
        const movieCard = createMovieCard(movie, 'watchlist');
        const emptyState = grid.querySelector('.empty-state');
        if (emptyState) {
            grid.innerHTML = '';
        }
        grid.insertAdjacentHTML('afterbegin', movieCard);
        const newCard = grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (newCard) {
            newCard.style.opacity = '0';
            newCard.style.transform = 'scale(0.8)';
            requestAnimationFrame(() => {
                newCard.style.transition = 'all 0.3s ease';
                newCard.style.opacity = '1';
                newCard.style.transform = 'scale(1)';
            });
        }
        
        
    } else if (action === 'remove') {
        const card = grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                card.remove();
                state.watchlistAllMovies = state.watchlistAllMovies.filter(m => m.id !== movieId);
                state.watchlistWithDetails = state.watchlistAllMovies;
                if (state.watchlistAllMovies.length === 0) {
                    grid.innerHTML = '<div class="empty-state"><h3>Ta watchlist est vide</h3></div>';
                }
            }, 300);
        }
    }
}

/**
 * Met à jour dynamiquement la grille watched sans tout recharger
 * @param {number} movieId - ID du film
 * @param {string} action - 'add' ou 'remove'
 * @param {object} movieData - Données du film (title, poster_path, rating optionnel)
 */
async function updateWatchedGrid(movieId, action, movieData = null) {
    const grid = document.getElementById('watchedGrid');
    if (!grid) return;
    
    
    if (action === 'add' && movieData) {
        const existingCard = grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (existingCard) {
            return;
        }
        let movieDetails = null;
        try {
            const response = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`);
            if (response.ok) {
                movieDetails = await response.json();
            }
        } catch (error) {
            console.error('Erreur chargement détails film:', error);
        }
        
        // Créer l'objet film avec tous les détails
        const movie = {
            id: movieId,
            movie_id: movieId,
            title: movieDetails?.title || movieData.title || 'Film',
            poster_path: movieDetails?.poster_path || movieData.poster_path,
            release_date: movieDetails?.release_date,
            genres: movieDetails?.genres || [],
            tmdb_rating: movieDetails?.vote_average || 0,
            runtime: movieDetails?.runtime || 0,
            rating: movieData.rating || null,
            watched_at: new Date().toISOString()
        };
        state.watchedAllMovies = [movie, ...state.watchedAllMovies];
        state.watchedWithDetails = state.watchedAllMovies;
        // Créer la carte HTML
        const movieCard = createMovieCard(movie, 'watched');
        const emptyState = grid.querySelector('.empty-state');
        if (emptyState) {
            grid.innerHTML = '';
        }
        grid.insertAdjacentHTML('afterbegin', movieCard);
        const newCard = grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (newCard) {
            newCard.style.opacity = '0';
            newCard.style.transform = 'scale(0.8)';
            requestAnimationFrame(() => {
                newCard.style.transition = 'all 0.3s ease';
                newCard.style.opacity = '1';
                newCard.style.transform = 'scale(1)';
            });
        }
        
        
    } else if (action === 'remove') {
        const card = grid.querySelector(`[data-movie-id="${movieId}"]`);
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                card.remove();
                state.watchedAllMovies = state.watchedAllMovies.filter(m => m.id !== movieId && m.movie_id !== movieId);
                state.watchedWithDetails = state.watchedAllMovies;
                if (state.watchedAllMovies.length === 0) {
                    grid.innerHTML = '<div class="empty-state"><h3>Tu n\'as encore vu aucun film</h3></div>';
                }
                
            }, 300);
        }
    }
}

/**
 * Fonction helper pour créer une carte de film
 * @param {object} movie - Données du film
 * @param {string} type - 'watchlist' ou 'watched'
 * @returns {string} HTML de la carte
 */
function createMovieCard(movie, type) {
    const poster = movie.poster_path 
        ? `${CONFIG.TMDB_IMG_URL}${movie.poster_path}` 
        : 'https://via.placeholder.com/500x750?text=No+Poster';
    
    const year = movie.release_date ? movie.release_date.substring(0, 4) : '';
    
    // Genres (max 2)
    let genresHTML = '';
    if (movie.genres && movie.genres.length > 0) {
        const displayGenres = movie.genres.slice(0, 2);
        genresHTML = displayGenres.map(g => `<span class="genre-badge">${g.name}</span>`).join('');
    }
    
    // Runtime
    let runtimeHTML = '';
    if (movie.runtime && movie.runtime > 0) {
        const hours = Math.floor(movie.runtime / 60);
        const mins = movie.runtime % 60;
        if (hours > 0) {
            runtimeHTML = `<div class="movie-runtime">⏱️ ${hours}h${mins > 0 ? ` ${mins}min` : ''}</div>`;
        } else {
            runtimeHTML = `<div class="movie-runtime">⏱️ ${mins}min</div>`;
        }
    }
    
    // Note TMDB
    let tmdbRatingHTML = '';
    if (movie.tmdb_rating && movie.tmdb_rating > 0) {
        tmdbRatingHTML = `<div class="movie-tmdb-rating">⭐ ${movie.tmdb_rating.toFixed(1)}/10</div>`;
    }
    
    let userRatingHTML = '';
    if (type === 'watched' && movie.rating) {
        const stars = '⭐'.repeat(Math.ceil(movie.rating / 2));
        userRatingHTML = `<div class="user-rating">${stars} ${movie.rating}/10</div>`;
    }
    
    return `
        <div class="movie-card" data-movie-id="${movie.id || movie.movie_id}" onclick="showMovieDetails(${movie.id || movie.movie_id})">
            <img src="${poster}" alt="${movie.title}" loading="lazy">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                ${year ? `<div class="movie-year">${year}</div>` : ''}
                ${genresHTML ? `<div class="movie-genres">${genresHTML}</div>` : ''}
                ${runtimeHTML}
                ${tmdbRatingHTML}
                ${userRatingHTML}
            </div>  
        </div>
    `;
}

// golbal fonctions export
window.updateWatchlistGrid = updateWatchlistGrid;
window.updateWatchedGrid = updateWatchedGrid;
window.createMovieCard = createMovieCard;

