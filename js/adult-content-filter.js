// adult-content-filter.js - Filtre pour exclure le contenu adulte

// Liste des genres adultes à filtrer (IDs TMDB)
const ADULT_GENRE_IDS = [
    // Pas de genre spécifique "adulte" dans TMDB, 
    // mais on peut filtrer par mots-clés dans le titre et description
];

// Mots-clés à filtrer dans les titres (en minuscules)
const ADULT_KEYWORDS = [
    'xxx', 'erotic', 'érotique', 'porn', 'adult', 'adulte', 
    'sex', 'sexe', 'sexy', 'nude', 'naked', 'nue',
    'strip', 'playboy', 'penthouse', 'hustler'
];

// Fonction pour vérifier si un film est du contenu adulte
function isAdultContent(movie) {
    if (!movie) return false;
    
    // 1. Vérifier le flag adult de TMDB
    if (movie.adult === true) {
        return true;
    }
    
    // 2. Vérifier le titre
    const title = (movie.title || '').toLowerCase();
    const originalTitle = (movie.original_title || '').toLowerCase();
    
    for (const keyword of ADULT_KEYWORDS) {
        if (title.includes(keyword) || originalTitle.includes(keyword)) {
            console.log(`🚫 Film filtré (titre): ${movie.title}`);
            return true;
        }
    }
    
    // 3. Vérifier la description
    const overview = (movie.overview || '').toLowerCase();
    for (const keyword of ADULT_KEYWORDS) {
        if (overview.includes(keyword)) {
            console.log(`🚫 Film filtré (description): ${movie.title}`);
            return true;
        }
    }
    
    return false;
}

// Fonction pour filtrer une liste de films
function filterAdultContent(movies) {
    if (!Array.isArray(movies)) return movies;
    
    const filtered = movies.filter(movie => !isAdultContent(movie));
    
    const removedCount = movies.length - filtered.length;
    if (removedCount > 0) {
        console.log(`🚫 ${removedCount} film(s) adulte(s) filtré(s)`);
    }
    
    return filtered;
}

// ✅ PATCH pour movies.js - Ajouter dans searchMovies()
/*
Dans le fichier movies.js, remplacer la ligne:

let newMovies = data.results || [];

par:

let newMovies = filterAdultContent(data.results || []);
*/

// ✅ PATCH pour swiper.js - Ajouter dans toutes les fonctions de fetch
/*
Dans le fichier swiper.js, après chaque fetch de films TMDB, ajouter:

movies = filterAdultContent(movies);

Par exemple dans fetchMultiplePages(), fetchTrendingMovies(), etc.
*/

// ✅ PATCH pour api.js - Filtrer côté requête TMDB
/*
Dans toutes les requêtes TMDB, ajouter le paramètre:

&include_adult=false

Exemple:
`${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR&page=${page}&include_adult=false`
*/

// Export pour utilisation globale
window.filterAdultContent = filterAdultContent;
window.isAdultContent = isAdultContent;