const CONFIG = {
    API_URL: 'http://localhost:3000/api',
    //API_URL: '/.netlify/functions/api',
    TMDB_API_KEY: 'f05382a7b84dc7c40d1965fb01e19f2b',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMG_URL: 'https://image.tmdb.org/t/p/w500'
};

const state = {
    user: null,
    token: null,
    movies: [],
    watchlist: [],
    watched: [],
    currentView: 'movies',
    swiperMovies: [],
    swiperIndex: 0,
    currentPage: 1,
    searchPage: 1,
    isSearchMode: false,
    currentSearchQuery: '',
    isLoading: false,
    userProfile: {
        avatar: null,
        username: '',
        email: ''
    }
};

// UTILS
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
    state.token = token;
}

function clearToken() {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401 || response.status === 403) {
            clearToken();
            updateUI();
            showToast('Session expirée, veuillez vous reconnecter', 'error');
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}