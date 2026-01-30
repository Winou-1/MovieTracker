// stats.js - Page complète de statistiques avec Chart.js

async function initStatsPage() {
    console.log('📊 Initialisation page stats');
    
    if (!getToken()) {
        document.getElementById('statsContainer').innerHTML = `
            <div class="stats-empty">
                <h3>Connecte-toi pour voir tes statistiques</h3>
            </div>
        `;
        return;
    }
    
    // Afficher un loader pendant le chargement
    document.getElementById('statsContainer').innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 400px;">
            <div class="loader"></div>
        </div>
    `;
    
    try {
        // Charger les données - NE PAS appeler /ratings car il n'existe pas
        const [watched, watchlist] = await Promise.all([
            apiRequest('/watched'),
            apiRequest('/watchlist')
        ]);
        
        const watchedMovies = watched || [];
        const watchlistMovies = watchlist || [];
        
        // ✅ Extraire les notes depuis la table watched (colonne rating)
        const userRatings = watchedMovies
            .filter(m => m.rating && m.rating > 0)
            .map(m => ({
                movie_id: m.movie_id,
                rating: m.rating
            }));
        
        console.log('📊 Données chargées:', {
            watched: watchedMovies.length,
            watchlist: watchlistMovies.length,
            ratings: userRatings.length
        });
        
        // Analyser les données
        const stats = analyzeUserStats(watchedMovies, watchlistMovies, userRatings);
        
        // Afficher les statistiques
        displayStatsPage(stats, watchedMovies);
        
    } catch (error) {
        console.error('Erreur chargement stats:', error);
        document.getElementById('statsContainer').innerHTML = `
            <div class="stats-error">
                <h3>❌ Erreur de chargement</h3>
                <p>Impossible de charger les statistiques</p>
                <button onclick="initStatsPage()" style="
                    margin-top: 16px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                ">
                    🔄 Réessayer
                </button>
            </div>
        `;
    }
}

function analyzeUserStats(watched, watchlist, ratings) {
    // Stats générales
    const totalWatched = watched.length;
    const totalWatchlist = watchlist.length;
    const totalRated = ratings.length;
    
    // Note moyenne
    const avgRating = ratings.length > 0 
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : 0;
    
    // Films par genre
    const genreCounts = {};
    watched.forEach(movie => {
        if (movie.genres) {
            movie.genres.forEach(genre => {
                genreCounts[genre.name] = (genreCounts[genre.name] || 0) + 1;
            });
        }
    });
    
    // Films par année
    const yearCounts = {};
    watched.forEach(movie => {
        if (movie.release_date) {
            const year = movie.release_date.substring(0, 4);
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    });
    
    // Films par décennie
    const decadeCounts = {};
    watched.forEach(movie => {
        if (movie.release_date) {
            const year = parseInt(movie.release_date.substring(0, 4));
            const decade = Math.floor(year / 10) * 10;
            decadeCounts[`${decade}s`] = (decadeCounts[`${decade}s`] || 0) + 1;
        }
    });
    
    // Distribution des notes
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    ratings.forEach(r => {
        ratingDistribution[Math.ceil(r.rating / 0.5)] = (ratingDistribution[Math.ceil(r.rating / 0.5)] || 0) + 1;
    });
    
    // Durée totale (estimation)
    const totalMinutes = watched.reduce((sum, movie) => {
        return sum + (movie.runtime || 120); // 120min par défaut
    }, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = (totalHours / 24).toFixed(1);
    
    return {
        totalWatched,
        totalWatchlist,
        totalRated,
        avgRating,
        genreCounts,
        yearCounts,
        decadeCounts,
        ratingDistribution,
        totalHours,
        totalDays,
        totalMinutes
    };
}

function displayStatsPage(stats, watchedMovies) {
    const container = document.getElementById('statsContainer');
    
    container.innerHTML = `
        <div class="stats-page">
            <!-- Header -->
            <div class="stats-page-header">
                <h1>📊 Mes Statistiques</h1>
                <p class="stats-subtitle">Analyse complète de ton activité cinéma</p>
            </div>
            
            <!-- Stats principales -->
            <div class="stats-overview-grid">
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">🎬</div>
                    <div class="stat-overview-value">${stats.totalWatched}</div>
                    <div class="stat-overview-label">Films vus</div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">⭐</div>
                    <div class="stat-overview-value">${stats.avgRating}</div>
                    <div class="stat-overview-label">Note moyenne</div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">⏱️</div>
                    <div class="stat-overview-value">${stats.totalHours}h</div>
                    <div class="stat-overview-label">Temps total</div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon">📌</div>
                    <div class="stat-overview-value">${stats.totalWatchlist}</div>
                    <div class="stat-overview-label">Watchlist</div>
                </div>
            </div>
            
            <!-- Graphiques -->
            <div class="stats-charts-grid">
                <!-- Films par genre -->
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">🎭 Films par Genre</h3>
                    <canvas id="genreChart"></canvas>
                </div>
                
                <!-- Distribution des notes -->
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">⭐ Distribution des Notes</h3>
                    <canvas id="ratingChart"></canvas>
                </div>
                
                <!-- Films par décennie -->
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">📅 Films par Décennie</h3>
                    <canvas id="decadeChart"></canvas>
                </div>
                
                <!-- Évolution dans le temps -->
                <div class="stats-chart-card">
                    <h3 class="stats-chart-title">📈 Activité Mensuelle</h3>
                    <canvas id="activityChart"></canvas>
                </div>
            </div>
            
            <!-- Stats fun -->
            <div class="stats-fun-section">
                <h2 class="stats-section-title">🎉 Stats Fun</h2>
                <div class="stats-fun-grid">
                    <div class="stats-fun-card">
                        <div class="stats-fun-emoji">🍿</div>
                        <div class="stats-fun-value">${Math.ceil(stats.totalWatched * 0.5)}kg</div>
                        <div class="stats-fun-label">de popcorn imaginaire</div>
                    </div>
                    <div class="stats-fun-card">
                        <div class="stats-fun-emoji">🌙</div>
                        <div class="stats-fun-value">${stats.totalDays}</div>
                        <div class="stats-fun-label">jours de visionnage</div>
                    </div>
                    <div class="stats-fun-card">
                        <div class="stats-fun-emoji">🎯</div>
                        <div class="stats-fun-value">${((stats.totalRated / stats.totalWatched) * 100).toFixed(0)}%</div>
                        <div class="stats-fun-label">de films notés</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Créer les graphiques
    createGenreChart(stats.genreCounts);
    createRatingChart(stats.ratingDistribution);
    createDecadeChart(stats.decadeCounts);
    createActivityChart(watchedMovies);
}

function createGenreChart(genreCounts) {
    const ctx = document.getElementById('genreChart');
    if (!ctx) return;
    
    // Top 8 genres
    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedGenres.map(g => g[0]),
            datasets: [{
                data: sortedGenres.map(g => g[1]),
                backgroundColor: [
                    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
                    '#10b981', '#06b6d4', '#f97316', '#84cc16'
                ],
                borderWidth: 2,
                borderColor: '#1f2327'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ab',
                        padding: 15,
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function createRatingChart(ratingDistribution) {
    const ctx = document.getElementById('ratingChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐'],
            datasets: [{
                label: 'Nombre de films',
                data: Object.values(ratingDistribution),
                backgroundColor: '#fbbf24',
                borderColor: '#f59e0b',
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
                    ticks: { color: '#9ab' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#9ab' },
                    grid: { display: false }
                }
            }
        }
    });
}

function createDecadeChart(decadeCounts) {
    const ctx = document.getElementById('decadeChart');
    if (!ctx) return;
    
    const sortedDecades = Object.entries(decadeCounts)
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDecades.map(d => d[0]),
            datasets: [{
                label: 'Films vus',
                data: sortedDecades.map(d => d[1]),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3
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
                    ticks: { color: '#9ab' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#9ab' },
                    grid: { display: false }
                }
            }
        }
    });
}

function createActivityChart(watchedMovies) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    
    // Compter les films par mois (basé sur watched_at)
    const monthlyCounts = {};
    const now = new Date();
    
    // Initialiser les 12 derniers mois
    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyCounts[key] = 0;
    }
    
    // Compter les films
    watchedMovies.forEach(movie => {
        if (movie.watched_at) {
            const date = new Date(movie.watched_at);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyCounts.hasOwnProperty(key)) {
                monthlyCounts[key]++;
            }
        }
    });
    
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const labels = Object.keys(monthlyCounts).map(key => {
        const [year, month] = key.split('-');
        return `${months[parseInt(month) - 1]}`;
    });
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Films vus',
                data: Object.values(monthlyCounts),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                borderRadius: 8
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
                        color: '#9ab',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#9ab' },
                    grid: { display: false }
                }
            }
        }
    });
}