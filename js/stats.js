// ==================== STATS PAGE - VERSION AVEC ENRICHISSEMENT TMDB ====================

const TMDB_API_KEY = 'f05382a7b84dc7c40d1965fb01e19f2b';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Cache pour les détails TMDB
const movieDetailsCache = new Map();

async function initStatsPage() {
    
    const statsSection = document.getElementById('statsSection');
    if (!statsSection) {
        console.error('statsSection introuvable');
        return;
    }
    
    let statsContainer = statsSection.querySelector('.container');
    if (!statsContainer) {
        statsContainer = statsSection;
    }
    
    if (!getToken()) {
        statsContainer.innerHTML = `
            <div style="text-align: center; padding: 80px 20px;">
                <div style="font-size: 72px; margin-bottom: 24px;">📊</div>
                <h2 style="color: var(--text-primary); margin-bottom: 12px;">Connexion requise</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">Vous devez être connecté pour voir vos statistiques</p>
                <button onclick="openAuthModal(true)" class="btn">
                    Se connecter
                </button>
            </div>
        `;
        return;
    }
    
    statsContainer.innerHTML = `
        <div class="stats-page">
            <!-- Bouton retour vers le profil -->
            <div style="margin-bottom: 20px;">
                <button onclick="switchView('profile')" style="
                    background: rgba(68, 85, 102, 0.2);
                    border: 1px solid rgba(68, 85, 102, 0.3);
                    color: var(--text-primary);
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='rgba(68, 85, 102, 0.3)'" onmouseout="this.style.background='rgba(68, 85, 102, 0.2)'">
                    ← Retour au profil
                </button>
            </div>
            
            <div class="stats-loading">
                <div class="stats-loading-spinner"></div>
                <p class="stats-loading-text">Chargement de vos statistiques...</p>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">Enrichissement des données en cours...</p>
            </div>
        </div>
    `;
    
    try {
        // Charger TOUTES les données nécessaires
        const [watchedData, watchlistData, statsData] = await Promise.all([
            apiRequest('/watched'),
            apiRequest('/watchlist'),
            apiRequest('/stats')
        ]);
        
        const watchedMovies = Array.isArray(watchedData) ? watchedData : [];
        const watchlistMovies = Array.isArray(watchlistData) ? watchlistData : [];
        const userStats = statsData || {};
        
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js non chargé');
        }
        
        const enrichedMovies = await enrichMoviesWithTMDB(watchedMovies, statsContainer);
        
        renderStatsPage(statsContainer, enrichedMovies, watchlistMovies, userStats);
        
        setTimeout(() => {
            createStatsCharts(enrichedMovies);
        }, 100);
        
    } catch (error) {
        console.error('❌ Erreur stats:', error);
        statsContainer.innerHTML = `
            <div class="stats-page">
                <div style="margin-bottom: 20px;">
                    <button onclick="switchView('profile')" style="
                        background: rgba(68, 85, 102, 0.2);
                        border: 1px solid rgba(68, 85, 102, 0.3);
                        color: var(--text-primary);
                        padding: 10px 20px;
                        border-radius: 10px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(68, 85, 102, 0.3)'" onmouseout="this.style.background='rgba(68, 85, 102, 0.2)'">
                        ← Retour au profil
                    </button>
                </div>
                
                <div class="stats-error">
                    <div class="stats-error-icon">📊</div>
                    <h2 class="stats-error-title">Erreur</h2>
                    <p class="stats-error-text">Impossible de charger vos statistiques</p>
                    <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">${error.message}</p>
                    <button onclick="initStatsPage()" class="btn" style="margin-top: 24px;">
                        Réessayer
                    </button>
                </div>
            </div>
        `;
    }
}

async function enrichMoviesWithTMDB(movies, container) {
    const batchSize = 10; // Traiter par lot de 10
    const enrichedMovies = [];
    
    for (let i = 0; i < movies.length; i += batchSize) {
        const batch = movies.slice(i, i + batchSize);
        const enrichedBatch = await Promise.all(
            batch.map(movie => fetchMovieDetails(movie))
        );
        enrichedMovies.push(...enrichedBatch);
        
        // Mettre à jour la progression
        const progress = Math.round((i / movies.length) * 100);
        if (container) {
            const loadingText = container.querySelector('.stats-loading-text');
            if (loadingText) {
                loadingText.textContent = `Enrichissement... ${i}/${movies.length} films (${progress}%)`;
            }
        }
    }
    
    return enrichedMovies;
}

async function fetchMovieDetails(movie) {
    // Vérifier le cache
    if (movieDetailsCache.has(movie.movie_id)) {
        return { ...movie, ...movieDetailsCache.get(movie.movie_id) };
    }
    
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${movie.movie_id}?api_key=${TMDB_API_KEY}&language=fr-FR`
        );
        
        if (!response.ok) {
            console.warn(` TMDB failed for movie ${movie.movie_id}`);
            return movie;
        }
        
        const details = await response.json();
        
        const enrichedData = {
            genres: details.genres || [],
            release_date: details.release_date || null,
            runtime: details.runtime || 120
        };
        
        // Mettre en cache
        movieDetailsCache.set(movie.movie_id, enrichedData);
        
        return { ...movie, ...enrichedData };
        
    } catch (error) {
        console.warn(` Erreur TMDB pour film ${movie.movie_id}:`, error);
        return movie;
    }
}

function renderStatsPage(container, watchedMovies, watchlistMovies, userStats) {
    const totalWatched = watchedMovies.length;
    const totalWatchlist = watchlistMovies.length;
    
    // Calculer le temps total (runtime en minutes)
    const totalMinutes = watchedMovies.reduce((sum, movie) => {
        const runtime = movie.runtime || 120;
        return sum + runtime;
    }, 0);
    const totalHours = Math.round(totalMinutes / 60);
    
    // Calculer la note moyenne
    const ratedMovies = watchedMovies.filter(m => {
        const rating = m.rating || m.user_rating;
        return rating && rating > 0;
    });
    
    const avgRating = ratedMovies.length > 0
        ? (ratedMovies.reduce((sum, m) => {
            const rating = m.rating || m.user_rating;
            return sum + parseFloat(rating);
        }, 0) / ratedMovies.length).toFixed(1)
        : '0.0';
    
    const popcornBowls = totalWatched;
    const movieNights = Math.round(totalHours / 2.5);
    const marathonDays = Math.round(totalHours / 24);
    
    container.innerHTML = `
        <div class="stats-page">
            <!-- Bouton retour -->
            <div style="margin-bottom: 20px;">
                <button onclick="switchView('profile')" style="
                    background: rgba(68, 85, 102, 0.2);
                    border: 1px solid rgba(68, 85, 102, 0.3);
                    color: var(--text-primary);
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='rgba(68, 85, 102, 0.3)'" onmouseout="this.style.background='rgba(68, 85, 102, 0.2)'">
                    ← Retour au profil
                </button>
            </div>
            
            <div class="stats-page-header">
                <h1>📊 Mes Statistiques</h1>
                <p class="stats-subtitle">Analyse de votre activité cinématographique</p>
            </div>

            <div class="stats-overview-grid">
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">🎬</div>
                    <div class="stat-overview-value">${totalWatched}</div>
                    <div class="stat-overview-label">Films Vus</div>
                </div>
                
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">📋</div>
                    <div class="stat-overview-value">${totalWatchlist}</div>
                    <div class="stat-overview-label">En Attente</div>
                </div>
                
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">⏱️</div>
                    <div class="stat-overview-value">${totalHours}h</div>
                    <div class="stat-overview-label">Heures Visionnées</div>
                </div>
                
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">⭐</div>
                    <div class="stat-overview-value">${avgRating}</div>
                    <div class="stat-overview-label">Note Moyenne</div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">⏱</div>
                    <div class="stat-overview-value">${totalHours*60}</div>
                    <div class="stat-overview-label">Minutes Visionnées</div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">📺</div>
                    <div class="stat-overview-value">${marathonDays}</div>
                    ${marathonDays <= 1 ? '<div class="stat-overview-label">jour</div>' : '<div class="stat-overview-label">jours</div>'}
                </div>
            </div>
            <div class="stats-charts-grid">
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">🎭 Genres Préférés</h3>
                    <canvas id="genresChart"></canvas>
                </div>
                
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">📅 Activité Mensuelle ${new Date().getFullYear()}</h3>
                    <canvas id="monthlyChart"></canvas>
                </div>
                
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">⭐ Distribution des Notes</h3>
                    <canvas id="ratingsChart"></canvas>
                </div>
                
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">🎞️ Films par Décennie</h3>
                    <canvas id="decadesChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

// Graphiques
let statsCharts = {
    genres: null,
    monthly: null,
    ratings: null,
    decades: null
};

function createStatsCharts(watchedMovies) {
    // Détruire les anciens graphiques
    Object.values(statsCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    createGenresChart(watchedMovies);
    createMonthlyChart(watchedMovies);
    createRatingsChart(watchedMovies);
    createDecadesChart(watchedMovies);
}

function createGenresChart(watchedMovies) {
    const genresCount = {};
    
    watchedMovies.forEach((movie, index) => {
        const genres = movie.genres;
        
        if (Array.isArray(genres) && genres.length > 0) {
            genres.forEach(genre => {
                const genreName = genre.name || genre;
                if (genreName) {
                    genresCount[genreName] = (genresCount[genreName] || 0) + 1;
                }
            });
        }
    });

    if (Object.keys(genresCount).length === 0) {
        const ctx = document.getElementById('genresChart');
        if (ctx) {
            const parent = ctx.parentElement;
            parent.innerHTML = `
                <h3 class="stats-chart-title">🎭 Genres Préférés</h3>
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <p style="font-size: 14px; margin-bottom: 8px;">Aucune donnée disponible</p>
                    <p style="font-size: 12px; opacity: 0.7;">Les informations de genres sont en cours de chargement...</p>
                </div>
            `;
        }
        return;
    }

    const sortedGenres = Object.entries(genresCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const labels = sortedGenres.map(g => g[0]);
    const data = sortedGenres.map(g => g[1]);

    const ctx = document.getElementById('genresChart');
    if (!ctx) return;

    statsCharts.genres = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(99, 102, 241, 0.8)'
                ],
                borderWidth: 2,
                borderColor: 'rgba(20, 24, 28, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ab',
                        font: { size: 11 },
                        padding: 12,
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(20, 24, 28, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#9ab',
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} films (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createRatingsChart(watchedMovies) {
    const ratingsCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    
    watchedMovies.forEach(movie => {
        const rating = movie.rating || movie.user_rating;
        if (rating && rating > 0 && rating <= 10) {
            const roundedRating = Math.round(rating);
            ratingsCount[roundedRating] = (ratingsCount[roundedRating] || 0) + 1;
        }
    });

    const labels = Object.keys(ratingsCount).map(r => `${r}/10`);
    const data = Object.values(ratingsCount);

    const ctx = document.getElementById('ratingsChart');
    if (!ctx) return;

    statsCharts.ratings = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nombre de films',
                data: data,
                backgroundColor: 'rgba(255, 201, 73, 0.8)',
                borderColor: 'rgba(231, 169, 26, 0.8)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20, 24, 28, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#9ab',
                    borderColor: 'rgba(236, 72, 153, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ab',
                        font: { size: 11 },
                        stepSize: 1,
                        callback: function(value) {
                            return Number.isInteger(value) ? value : '';
                        }
                    },
                    grid: {
                        color: 'rgba(68, 85, 102, 0.2)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#9ab',
                        font: { size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function createMonthlyChart(watchedMovies) {
    const monthlyData = Array(12).fill(0);
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    const currentYear = new Date().getFullYear();
    
    watchedMovies.forEach(movie => {
        const dateStr = movie.added_at || movie.watched_at || movie.created_at || movie.date_added;
        
        if (dateStr) {
            const date = new Date(dateStr);
            
            if (!isNaN(date.getTime()) && date.getFullYear() === currentYear) {
                const month = date.getMonth();
                monthlyData[month]++;
            }
        }
    });


    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    statsCharts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: [{
                label: 'Films vus',
                data: monthlyData,
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20, 24, 28, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#9ab',
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ab',
                        font: { size: 11 },
                        stepSize: 1,
                        callback: function(value) {
                            return Number.isInteger(value) ? value : '';
                        }
                    },
                    grid: {
                        color: 'rgba(68, 85, 102, 0.2)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#9ab',
                        font: { size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function createDecadesChart(watchedMovies) {
    const decadesCount = {};
    
    watchedMovies.forEach((movie, index) => {
        const releaseDate = movie.release_date;
        
        if (releaseDate) {
            let year;
            
            if (typeof releaseDate === 'number') {
                year = releaseDate;
            } else if (typeof releaseDate === 'string') {
                if (releaseDate.includes('-')) {
                    year = new Date(releaseDate).getFullYear();
                } else {
                    year = parseInt(releaseDate);
                }
            }
            if (!isNaN(year) && year > 1900 && year < 2100) {
                const decade = Math.floor(year / 10) * 10;
                decadesCount[decade] = (decadesCount[decade] || 0) + 1;
            }
        }
    });

    const sortedDecades = Object.entries(decadesCount)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (sortedDecades.length === 0) {
        const ctx = document.getElementById('decadesChart');
        if (ctx) {
            const parent = ctx.parentElement;
            parent.innerHTML = `
                <h3 class="stats-chart-title">🎞️ Films par Décennie</h3>
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <p style="font-size: 14px; margin-bottom: 8px;">Aucune donnée disponible</p>
                    <p style="font-size: 12px; opacity: 0.7;">Les données sont en cours de chargement...</p>
                </div>
            `;
        }
        return;
    }

    const labels = sortedDecades.map(d => `${d[0]}s`);
    const data = sortedDecades.map(d => d[1]);

    const ctx = document.getElementById('decadesChart');
    if (!ctx) return;

    statsCharts.decades = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Films vus',
                data: data,
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20, 24, 28, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#9ab',
                    borderColor: 'rgba(139, 92, 246, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ab',
                        font: { size: 11 },
                        stepSize: 1,
                        callback: function(value) {
                            return Number.isInteger(value) ? value : '';
                        }
                    },
                    grid: {
                        color: 'rgba(68, 85, 102, 0.2)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#9ab',
                        font: { size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}