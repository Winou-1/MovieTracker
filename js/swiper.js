const RECOMMENDATION_STRATEGY = {
    COLD_START_THRESHOLD: 5,
    LEARNING_THRESHOLD: 15,
    MATURE_THRESHOLD: 30,
    BATCH_SIZE: 50,
    
    COLD_START_MIX: {
        topRated: 0.3,
        popular: 0.3,
        trending: 0.2,
        upcoming: 0.2
    },
    LEARNING_MIX: {
        personalized: 0.4,
        popular: 0.2,
        diverse: 0.2,
        trending: 0.2
    },
    MATURE_MIX: {
        personalized: 0.5,
        diverse: 0.2,
        similar: 0.15,
        trending: 0.15
    }
};

if (!state.seenMovieIds) {
    state.seenMovieIds = new Set();
}

async function loadSwiperMovies() {
    if (!getToken()) {
        document.getElementById('swiperContainer').innerHTML = `
            <div class="swiper-empty">
                <h3>Connecte-toi pour découvrir des films</h3>
            </div>
        `;
        return;
    }

    const watchedMovies = await apiRequest('/watched');
    const watchedIds = watchedMovies ? watchedMovies.map(m => m.movie_id) : [];
    
    const watchlistMovies = await apiRequest('/watchlist');
    const watchlistIds = watchlistMovies ? watchlistMovies.map(m => m.movie_id) : [];
    
    // Ajouter les IDs à notre cache global
    watchedIds.forEach(id => state.seenMovieIds.add(id));
    watchlistIds.forEach(id => state.seenMovieIds.add(id));
    
    const watchedCount = watchedMovies ? watchedMovies.length : 0;
    const recommendationPhase = getRecommendationPhase(watchedCount);
    
    console.log(`🎯 Phase: ${recommendationPhase} | ${watchedCount} vus | ${state.seenMovieIds.size} total exclus`);

    try {
        let allMovies = [];

        switch(recommendationPhase) {
            case 'cold_start':
                allMovies = await loadColdStartMovies(watchedMovies);
                break;
            case 'learning':
                allMovies = await loadLearningMovies(watchedMovies);
                break;
            case 'mature':
                allMovies = await loadMatureMovies(watchedMovies);
                break;
        }
        
        // Filtrer avec le cache global
        const filteredMovies = allMovies.filter(m => !state.seenMovieIds.has(m.id));
        
        console.log(`📦 ${allMovies.length} films chargés → ${filteredMovies.length} après filtrage`);
        
        if (state.swiperIndex === 0) {
            state.swiperMovies = filteredMovies;
        } else {
            state.swiperMovies.push(...filteredMovies);
        }
        
        if (state.swiperMovies.length > 0) {
            displaySwiperMovie();
        } else {
            console.log('⚠️ Plus de films disponibles, réinitialisation du cache...');
            state.seenMovieIds.clear();
            watchedIds.forEach(id => state.seenMovieIds.add(id));
            watchlistIds.forEach(id => state.seenMovieIds.add(id));
            loadSwiperMovies();
        }
    } catch (error) {
        console.error('Erreur chargement swiper:', error);
    }
}

function getRecommendationPhase(watchedCount) {
    if (watchedCount <= RECOMMENDATION_STRATEGY.COLD_START_THRESHOLD) {
        return 'cold_start';
    } else if (watchedCount <= RECOMMENDATION_STRATEGY.LEARNING_THRESHOLD) {
        return 'learning';
    } else {
        return 'mature';
    }
}

async function loadColdStartMovies(watchedMovies) {
    console.log('🌟 Cold Start - Films populaires diversifiés');
    
    const mix = RECOMMENDATION_STRATEGY.COLD_START_MIX;
    const total = RECOMMENDATION_STRATEGY.BATCH_SIZE;
    let allMovies = [];

    // 1. Top Rated - Films cultes (30%)
    const topRatedCount = Math.floor(total * mix.topRated);
    const topRated = await fetchMultiplePages('top_rated', topRatedCount, {
        'vote_count.gte': 1000,
        'vote_average.gte': 7.5
    });
    allMovies.push(...topRated);

    // 2. Popular - Blockbusters (30%)
    const popularCount = Math.floor(total * mix.popular);
    const popular = await fetchMultiplePages('popular', popularCount, {
        'vote_count.gte': 500
    });
    allMovies.push(...popular);

    // 3. Trending - Tendances (20%)
    const trendingCount = Math.floor(total * mix.trending);
    const trending = await fetchTrendingMovies(trendingCount);
    allMovies.push(...trending);

    // 4. Upcoming - Nouveautés (20%)
    const upcomingCount = Math.floor(total * mix.upcoming);
    const upcoming = await fetchUpcomingMovies(upcomingCount);
    allMovies.push(...upcoming);

    return shuffleArray(removeDuplicates(allMovies));
}

// ============================================
// PHASE LEARNING - VERSION AMÉLIORÉE
// ============================================
async function loadLearningMovies(watchedMovies) {
    console.log('🎓 Learning - Personnalisation progressive');
    
    const mix = RECOMMENDATION_STRATEGY.LEARNING_MIX;
    const total = RECOMMENDATION_STRATEGY.BATCH_SIZE;
    let allMovies = [];

    const preferences = await analyzeUserPreferences(watchedMovies);
    console.log('  🎯 Top 3 genres:', preferences.topGenres.map(g => g.name).join(', '));

    // 1. Personnalisés (40%)
    const personalizedCount = Math.floor(total * mix.personalized);
    if (preferences.topGenres.length > 0) {
        const personalized = await fetchPersonalizedByGenres(preferences.topGenres, personalizedCount);
        allMovies.push(...personalized);
    }

    // 2. Popular (20%)
    const popularCount = Math.floor(total * mix.popular);
    const popular = await fetchMultiplePages('popular', popularCount, {});
    allMovies.push(...popular);

    // 3. Découverte (20%)
    const diverseCount = Math.floor(total * mix.diverse);
    const diverse = await fetchDiverseMovies(preferences.exploredGenres, diverseCount);
    allMovies.push(...diverse);

    // 4. Trending (20%)
    const trendingCount = Math.floor(total * mix.trending);
    const trending = await fetchTrendingMovies(trendingCount);
    allMovies.push(...trending);

    return shuffleArray(removeDuplicates(allMovies));
}

// ============================================
// PHASE MATURE - VERSION AMÉLIORÉE
// ============================================
async function loadMatureMovies(watchedMovies) {
    console.log('🎬 Mature - Recommandations avancées');
    
    const mix = RECOMMENDATION_STRATEGY.MATURE_MIX;
    const total = RECOMMENDATION_STRATEGY.BATCH_SIZE;
    let allMovies = [];

    const preferences = await analyzeUserPreferences(watchedMovies);
    console.log('  🎯 Profil:', preferences.topGenres.map(g => g.name).join(', '));

    // 1. Hautement personnalisés (50%)
    const personalizedCount = Math.floor(total * mix.personalized);
    const personalized = await fetchAdvancedPersonalized(preferences, personalizedCount);
    allMovies.push(...personalized);

    // 2. Découverte intelligente (20%)
    const diverseCount = Math.floor(total * mix.diverse);
    const diverse = await fetchSmartDiverseMovies(preferences, diverseCount);
    allMovies.push(...diverse);

    // 3. Films similaires (15%)
    const similarCount = Math.floor(total * mix.similar);
    const similar = await fetchSimilarToFavorites(watchedMovies.slice(-10), similarCount);
    allMovies.push(...similar);

    // 4. Trending récents (15%)
    const trendingCount = Math.floor(total * mix.trending);
    const trending = await fetchTrendingMovies(trendingCount);
    allMovies.push(...trending);

    return shuffleArray(removeDuplicates(allMovies));
}

// ============================================
// ANALYSE PRÉFÉRENCES AMÉLIORÉE
// ============================================
async function analyzeUserPreferences(watchedMovies) {
    const genreCount = {};
    const decadeCount = {};
    const allGenres = new Set();

    const recentMovies = watchedMovies.slice(-30);

    for (const movie of recentMovies) {
        try {
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/movie/${movie.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
            );
            const data = await response.json();
            
            if (data.genres) {
                data.genres.forEach(genre => {
                    genreCount[genre.id] = (genreCount[genre.id] || 0) + 1;
                    allGenres.add(genre.id);
                });
            }

            if (data.release_date) {
                const year = parseInt(data.release_date.substring(0, 4));
                const decade = Math.floor(year / 10) * 10;
                decadeCount[decade] = (decadeCount[decade] || 0) + 1;
            }
        } catch (e) {
            console.error('Erreur analyse:', e);
        }
    }

    const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genreId, count]) => ({
            id: parseInt(genreId),
            count: count,
            name: getGenreName(parseInt(genreId))
        }));

    const preferredDecades = Object.entries(decadeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([decade]) => parseInt(decade));

    return {
        topGenres,
        preferredDecades,
        exploredGenres: Array.from(allGenres)
    };
}

async function fetchMultiplePages(type, targetCount, filters = {}) {
    const movies = [];
    const pagesToFetch = 5;
    
    try {
        const promises = [];
        for (let i = 0; i < pagesToFetch; i++) {
            const page = Math.floor(Math.random() * 20) + 1;
            
            let url;
            if (type === 'top_rated') {
                url = `${CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&sort_by=vote_average.desc&page=${page}`;
            } else if (type === 'popular') {
                url = `${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=${page}`;
            }
            Object.entries(filters).forEach(([key, value]) => {
                url += `&${key}=${value}`;
            });
            
            promises.push(fetch(url).then(r => r.json()));
        }
        
        const results = await Promise.all(promises);
        results.forEach(data => {
            if (data.results) movies.push(...data.results);
        });
        
        return movies.slice(0, targetCount);
    } catch (error) {
        console.error('Erreur fetchMultiplePages:', error);
        return [];
    }
}

// Films tendance
async function fetchTrendingMovies(count) {
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/trending/movie/week?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
        );
        const data = await response.json();
        return (data.results || []).slice(0, count);
    } catch (error) {
        console.error('Erreur trending:', error);
        return [];
    }
}

// Nouveautés à venir
async function fetchUpcomingMovies(count) {
    try {
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/movie/upcoming?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=${Math.floor(Math.random() * 5) + 1}`
        );
        const data = await response.json();
        return (data.results || []).slice(0, count);
    } catch (error) {
        console.error('Erreur upcoming:', error);
        return [];
    }
}

// Personnalisés par genres
async function fetchPersonalizedByGenres(topGenres, count) {
    const movies = [];
    try {
        for (const genre of topGenres.slice(0, 3)) {
            const page = Math.floor(Math.random() * 10) + 1;
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&sort_by=vote_average.desc&with_genres=${genre.id}&vote_count.gte=100&page=${page}`
            );
            const data = await response.json();
            if (data.results) movies.push(...data.results);
        }
        return movies.slice(0, count);
    } catch (error) {
        console.error('Erreur personalized:', error);
        return [];
    }
}

// Personnalisés avancés avec décennies
async function fetchAdvancedPersonalized(preferences, count) {
    const movies = [];
    try {
        const genreIds = preferences.topGenres.slice(0, 3).map(g => g.id).join(',');
        for (const decade of preferences.preferredDecades.slice(0, 2)) {
            const page = Math.floor(Math.random() * 10) + 1;
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&sort_by=vote_average.desc&with_genres=${genreIds}&primary_release_date.gte=${decade}-01-01&primary_release_date.lte=${decade + 9}-12-31&vote_count.gte=50&page=${page}`
            );
            const data = await response.json();
            if (data.results) movies.push(...data.results);
        }
        if (movies.length < count) {
            const page = Math.floor(Math.random() * 10) + 1;
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&with_genres=${genreIds}&vote_count.gte=100&page=${page}`
            );
            const data = await response.json();
            if (data.results) movies.push(...data.results);
        }
        
        return movies.slice(0, count);
    } catch (error) {
        console.error('Erreur advanced:', error);
        return [];
    }
}

// Découverte de nouveaux genres
async function fetchDiverseMovies(exploredGenres, count) {
    const allGenres = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37];
    const unexplored = allGenres.filter(id => !exploredGenres.includes(id));
    
    if (unexplored.length === 0) return [];
    
    const movies = [];
    try {
        const selectedGenres = unexplored.sort(() => Math.random() - 0.5).slice(0, 3).join(',');
        const page = Math.floor(Math.random() * 10) + 1;
        
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&with_genres=${selectedGenres}&vote_count.gte=100&page=${page}`
        );
        const data = await response.json();
        if (data.results) movies.push(...data.results);
        
        return movies.slice(0, count);
    } catch (error) {
        console.error('Erreur diverse:', error);
        return [];
    }
}

// Découverte intelligente (genres adjacents)
async function fetchSmartDiverseMovies(preferences, count) {
    const genreMapping = {
        28: [12, 878, 53], 12: [14, 28, 878], 16: [10751, 14, 35],
        35: [10749, 18, 10751], 80: [53, 9648, 18], 18: [10749, 80, 36],
        27: [53, 878, 14], 878: [28, 12, 53], 53: [80, 9648, 28]
    };
    
    let adjacentGenres = [];
    preferences.topGenres.forEach(genre => {
        if (genreMapping[genre.id]) {
            adjacentGenres.push(...genreMapping[genre.id]);
        }
    });
    
    adjacentGenres = adjacentGenres.filter(id => !preferences.exploredGenres.includes(id));
    
    if (adjacentGenres.length === 0) {
        return fetchDiverseMovies(preferences.exploredGenres, count);
    }
    
    const movies = [];
    try {
        const selectedGenres = [...new Set(adjacentGenres)].slice(0, 3).join(',');
        const page = Math.floor(Math.random() * 10) + 1;
        
        const response = await fetch(
            `${CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&sort_by=vote_average.desc&with_genres=${selectedGenres}&vote_count.gte=200&page=${page}`
        );
        const data = await response.json();
        if (data.results) movies.push(...data.results);
        
        return movies.slice(0, count);
    } catch (error) {
        console.error('Erreur smart diverse:', error);
        return [];
    }
}

// Films similaires aux favoris
async function fetchSimilarToFavorites(recentWatched, count) {
    const movies = [];
    try {
        // Prendre 3 films récents au hasard
        const samples = recentWatched.sort(() => Math.random() - 0.5).slice(0, 3);
        
        for (const movie of samples) {
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/movie/${movie.movie_id}/similar?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=1`
            );
            const data = await response.json();
            if (data.results) movies.push(...data.results);
        }
        
        return movies.slice(0, count);
    } catch (error) {
        console.error('Erreur similar:', error);
        return [];
    }
}

// ============================================
// UTILITAIRES
// ============================================

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function removeDuplicates(movies) {
    const seen = new Set();
    return movies.filter(movie => {
        if (seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
    });
}

function getGenreName(genreId) {
    const genres = {
        28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie',
        80: 'Crime', 99: 'Documentaire', 18: 'Drame', 10751: 'Famille',
        14: 'Fantasy', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique',
        9648: 'Mystère', 10749: 'Romance', 878: 'Science-Fiction',
        10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western'
    };
    return genres[genreId] || 'Inconnu';
}

// ============================================
// UI ET INTERACTIONS (inchangées)
// ============================================

function displaySwiperMovie() {
    const container = document.getElementById('swiperContainer');
    const currentMovie = state.swiperMovies[state.swiperIndex];
    const nextMovie = state.swiperMovies[state.swiperIndex + 1];
    
    if (!currentMovie) {
        loadSwiperMovies();
        return;
    }

    const poster = currentMovie.poster_path ? `${CONFIG.TMDB_IMG_URL}${currentMovie.poster_path}` : 'placeholder.jpg';
    const backdrop = currentMovie.backdrop_path ? `${CONFIG.TMDB_IMG_URL}${currentMovie.backdrop_path}` : poster;
    const year = currentMovie.release_date ? currentMovie.release_date.split('-')[0] : '';

    let nextMovieHTML = '';
    if (nextMovie) {
        const nextPoster = nextMovie.poster_path ? `${CONFIG.TMDB_IMG_URL}${nextMovie.poster_path}` : 'placeholder.jpg';
        const nextYear = nextMovie.release_date ? nextMovie.release_date.split('-')[0] : '';
        nextMovieHTML = `
            <div class="swiper-card-modern behind" id="nextCard">
                <div class="swiper-card-inner">
                    <div class="swiper-header">
                        <h2 class="swiper-title-modern">${nextMovie.title}</h2>
                        <div class="swiper-year-modern">${nextYear}</div>
                    </div>
                    <div class="swiper-poster-container">
                        <div class="swiper-poster-modern">
                            <img src="${nextPoster}" alt="${nextMovie.title}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="swiper-backdrop" id="swiperBackdrop" style="background-image: url('${backdrop}')"></div>
        <div class="swiper-close" onclick="switchView('movies')">×</div>
        
        <div class="swiper-card-stack">
            ${nextMovieHTML}
            
            <div class="swiper-card-modern active" id="currentCard" 
                 data-movie-id="${currentMovie.id}" 
                 data-movie-title="${currentMovie.title.replace(/'/g, "\\'")}" 
                 data-movie-poster="${currentMovie.poster_path}">
                <div class="swiper-card-inner">
                    <div class="swiper-header">
                        <h2 class="swiper-title-modern">${currentMovie.title}</h2>
                        <div class="swiper-year-modern">${year}</div>
                    </div>
                    <div class="swiper-poster-container" id="posterContainer">
                        <div class="swiper-poster-modern">
                            <img src="${poster}" alt="${currentMovie.title}">
                        </div>
                        <div class="swipe-overlay left">
                            <div>WATCHLIST</div>
                        </div>
                        <div class="swipe-overlay right">
                            <div>VU</div>
                        </div>
                        <div class="swipe-overlay up">
                            <div>SUIVANT</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="swiper-hints">
            <div class="swiper-hint">
                <div class="swiper-hint-icon watchlist">←</div>
                <div class="swiper-hint-label">Watchlist</div>
            </div>
            <div class="swiper-hint">
                <div class="swiper-hint-icon skip">↑</div>
                <div class="swiper-hint-label">Passer</div>
            </div>
            <div class="swiper-hint">
                <div class="swiper-hint-icon watched">→</div>
                <div class="swiper-hint-label">Vu</div>
            </div>
        </div>
    `;

    setupTinderSwipe();
}

function setupTinderSwipe() {
    const card = document.getElementById('currentCard');
    const posterContainer = document.getElementById('posterContainer');
    const backdrop = document.getElementById('swiperBackdrop');
    let clickStartTime = 0;
    let hasMoved = false;
    
    if (!card || !posterContainer) return;

    let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;

    const overlayLeft = posterContainer.querySelector('.swipe-overlay.left');
    const overlayRight = posterContainer.querySelector('.swipe-overlay.right');
    const overlayUp = posterContainer.querySelector('.swipe-overlay.up');

    posterContainer.addEventListener('touchstart', handleStart, { passive: false });
    posterContainer.addEventListener('touchmove', handleMove, { passive: false });
    posterContainer.addEventListener('touchend', handleEnd, { passive: false });
    posterContainer.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    function handleStart(e) {
        e.preventDefault();
        isDragging = true;
        hasMoved = false;
        clickStartTime = Date.now();
        posterContainer.classList.add('dragging');
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        currentX = 0;
        currentY = 0;
        card.style.transition = 'none';
    }

    function handleMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        hasMoved = true;
        const touch = e.type === 'touchmove' ? e.touches[0] : e;
        currentX = touch.clientX - startX;
        currentY = touch.clientY - startY;
        if (currentY > 0) currentY = currentY * 0.3;
        const rotation = currentX * 0.05;
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
        } else {
            card.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px)) rotate(${rotation}deg)`;
        }

        overlayLeft.classList.remove('active');
        overlayRight.classList.remove('active');
        overlayUp.classList.remove('active');
        const threshold = 50;
        
        if (Math.abs(currentY) > Math.abs(currentX) && currentY < -threshold) {
            overlayUp.classList.add('active');
            backdrop.style.opacity = '0.3';
        } else if (currentX < -threshold) {
            const opacity = Math.min(Math.abs(currentX) / 150, 1);
            overlayLeft.style.opacity = opacity;
            overlayLeft.classList.add('active');
            backdrop.style.opacity = Math.max(0.4 - opacity * 0.2, 0.2);
        } else if (currentX > threshold) {
            const opacity = Math.min(currentX / 150, 1);
            overlayRight.style.opacity = opacity;
            overlayRight.classList.add('active');
            backdrop.style.opacity = Math.max(0.4 - opacity * 0.2, 0.2);
        } else {
            backdrop.style.opacity = '0.4';
        }
    }

    function handleEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        posterContainer.classList.remove('dragging');
        const clickDuration = Date.now() - clickStartTime;
        
        if (!hasMoved && clickDuration < 300) {
            const movieId = parseInt(card.dataset.movieId);
            showMovieDetails(movieId);
            card.style.transform = 'translate(-50%, -50%) rotate(0deg)';
            backdrop.style.opacity = '0.4';
            overlayLeft.style.opacity = '0';
            overlayRight.style.opacity = '0';
            overlayUp.style.opacity = '0';
            overlayLeft.classList.remove('active');
            overlayRight.classList.remove('active');
            overlayUp.classList.remove('active');
            return;
        }
        
        const swipeThreshold = 100;
        const movieId = parseInt(card.dataset.movieId);
        const movieTitle = card.dataset.movieTitle;
        const moviePoster = card.dataset.moviePoster;
        let action = null;

        if (Math.abs(currentY) > Math.abs(currentX) && currentY < -swipeThreshold) {
            action = 'skip';
            animateCardOut(card, 'up');
            // ✅ Ajouter au cache même si skip
            state.seenMovieIds.add(movieId);
        } else if (currentX < -swipeThreshold) {
            action = 'watchlist';
            animateCardOut(card, 'left');
            addToWatchlistSwiper(movieId, movieTitle, moviePoster);
        } else if (currentX > swipeThreshold) {
            action = 'watched';
            animateCardOut(card, 'right');
            addToWatchedSwiper(movieId, movieTitle, moviePoster);
        } else {
            card.classList.add('animating');
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                card.style.transform = 'translate(0, 0) rotate(0deg)';
            } else {
                card.style.transform = 'translate(-50%, -50%) rotate(0deg)';
            }
            backdrop.style.opacity = '0.4';
            overlayLeft.style.opacity = '0';
            overlayRight.style.opacity = '0';
            overlayUp.style.opacity = '0';
            overlayLeft.classList.remove('active');
            overlayRight.classList.remove('active');
            overlayUp.classList.remove('active');
            setTimeout(() => {
                card.classList.remove('animating');
                card.style.transition = '';
            }, 300);
            return;
        }

        if (action) {
            setTimeout(() => nextSwiperMovie(), 300);
        }
    }

    function animateCardOut(card, direction) {
        card.classList.add('animating');
        let transform;
        switch(direction) {
            case 'left':
                transform = 'translate(calc(-50% - 150vw), -50%) rotate(-30deg)';
                break;
            case 'right':
                transform = 'translate(calc(-50% + 150vw), -50%) rotate(30deg)';
                break;
            case 'up':
                transform = 'translate(-50%, calc(-50% - 150vh)) rotate(0deg)';
                break;
        }
        card.style.transform = transform;
        card.style.opacity = '0';
        backdrop.style.opacity = '0.4';
    }

    posterContainer.addEventListener('mouseleave', () => {
        if (isDragging) handleEnd({ type: 'mouseup' });
    });
}

async function addToWatchlistSwiper(movieId, title, posterPath) {
    const result = await apiRequest('/watchlist', {
        method: 'POST',
        body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
    });
    if (result) {
        state.watchlist.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
        state.seenMovieIds.add(movieId);
        showToast('Ajouté à la watchlist');
    }
}

async function addToWatchedSwiper(movieId, title, posterPath) {
    const result = await apiRequest('/watched', {
        method: 'POST',
        body: JSON.stringify({ movie_id: movieId, movie_title: title, movie_poster: posterPath })
    });
    if (result) {
        state.watched.push({ movie_id: movieId, movie_title: title, movie_poster: posterPath });
        state.seenMovieIds.add(movieId);
        showToast('Marqué comme vu');
        if (state.swiperIndex >= state.swiperMovies.length - 5) {
            await loadMoreAdaptedMovies();
        }
    }
}

async function loadMoreAdaptedMovies() {
    if (!getToken()) return;
    const watchedMovies = await apiRequest('/watched');
    const watchedCount = watchedMovies ? watchedMovies.length : 0;
    const recommendationPhase = getRecommendationPhase(watchedCount);
    
    try {
        let newMovies = [];
        switch(recommendationPhase) {
            case 'cold_start':
                newMovies = await loadColdStartMovies(watchedMovies);
                break;
            case 'learning':
                newMovies = await loadLearningMovies(watchedMovies);
                break;
            case 'mature':
                newMovies = await loadMatureMovies(watchedMovies);
                break;
        }
        const filtered = newMovies.filter(m => !state.seenMovieIds.has(m.id));
        state.swiperMovies.push(...filtered);
        console.log(`🎬 ${filtered.length} nouveaux films préchargés`);
    } catch (error) {
        console.error('Erreur préchargement:', error);
    }
}

function nextSwiperMovie() {
    state.swiperIndex++;
    if (state.swiperIndex >= state.swiperMovies.length) {
        loadSwiperMovies();
    } else {
        displaySwiperMovie();
    }
}