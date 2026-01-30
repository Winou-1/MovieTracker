// js/offline-storage.js - Système de cache IndexedDB CORRIGÉ

const OfflineStorage = {
    DB_NAME: 'CineTrackDB',
    DB_VERSION: 5, // ✅ Incrémenté pour ajouter user_ratings
    db: null,
    isInitializing: false,

    // ✅ Initialisation sécurisée
    async init() {
        if (this.db) return this.db;
        if (this.isInitializing) {
            // Attendre que l'init en cours se termine
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.init();
        }

        this.isInitializing = true;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                this.isInitializing = false;
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitializing = false;
                console.log('✅ IndexedDB initialisée (v' + this.DB_VERSION + ')');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔧 Migration IndexedDB v' + event.oldVersion + ' → v' + this.DB_VERSION);

                // ✅ Supprimer TOUS les anciens stores
                const storeNames = Array.from(db.objectStoreNames);
                storeNames.forEach(name => {
                    db.deleteObjectStore(name);
                    console.log('🗑️ Store supprimé:', name);
                });

                // ✅ Créer les stores proprement
                db.createObjectStore('watchlist', { keyPath: 'movie_id' });
                db.createObjectStore('watched', { keyPath: 'movie_id' });
                db.createObjectStore('likes', { keyPath: 'movie_id' });
                db.createObjectStore('user_ratings', { keyPath: 'movie_id' }); // ✅ NOUVEAU : Store pour les notes
                
                const cacheStore = db.createObjectStore('movies_cache', { keyPath: 'movie_id' });
                cacheStore.createIndex('cached_at', 'cached_at', { unique: false });
                
                db.createObjectStore('settings', { keyPath: 'key' });

                console.log('✅ Tous les stores créés');
            };
        });
    },

    isEnabled() {
        const enabled = localStorage.getItem('offline_mode_enabled');
        return enabled === null ? true : enabled === 'true';
    },

    async setEnabled(enabled) {
        localStorage.setItem('offline_mode_enabled', enabled.toString());
        if (enabled) {
            await this.init();
            await this.syncAllData();
        } else {
            await this.clearAllData();
        }
    },

    // ✅ SYNCHRONISATION OPTIMISÉE
    async syncAllData() {
        if (!this.isEnabled() || !getToken()) {
            console.log('⚠️ Sync annulée (offline désactivé ou pas de token)');
            return;
        }

        try {
            await this.init();
            console.log('🔄 Début synchronisation...');

            // 1. Profil
            const profile = await apiRequest('/profile');
            if (profile) {
                await this.saveToStore('settings', {
                    key: 'profile',
                    value: profile,
                    updated_at: new Date().toISOString()
                });
                console.log('✅ Profil sauvegardé');
            }

            // 2. Watchlist avec détails
            const watchlist = await apiRequest('/watchlist');
            if (watchlist && watchlist.length > 0) {
                await this.saveListWithDetails('watchlist', watchlist);
            }

            // 3. Films vus avec détails
            const watched = await apiRequest('/watched');
            if (watched && watched.length > 0) {
                await this.saveListWithDetails('watched', watched);
            }

            // 4. Likes avec détails
            const likes = await apiRequest('/likes/all');
            if (likes && likes.length > 0) {
                await this.saveLikesWithDetails(likes);
            }

            // 5. Dernière sync
            await this.saveToStore('settings', {
                key: 'last_sync',
                value: new Date().toISOString()
            });

            console.log('✅ Synchronisation terminée');
            
        } catch (error) {
            console.error('❌ Erreur sync:', error);
            throw error;
        }
    },

    // ✅ NOUVELLE FONCTION : Sauvegarder avec gestion intelligente du cache
    async saveListWithDetails(storeName, items) {
        console.log(`📦 Sauvegarde ${items.length} éléments dans ${storeName}...`);
        
        await this.clearStore(storeName);
        
        const BATCH_SIZE = 10;
        let saved = 0;
        
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (item) => {
                try {
                    // ✅ Vérifier le cache d'abord
                    let movieDetails = await this.getFromStore('movies_cache', item.movie_id);
                    
                    // Si pas en cache ou cache > 7 jours, refetch
                    if (!movieDetails || this.isCacheExpired(movieDetails.cached_at, 7)) {
                        const response = await fetch(
                            `${CONFIG.TMDB_BASE_URL}/movie/${item.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
                        );
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            // Sauvegarder dans le cache
                            movieDetails = {
                                movie_id: item.movie_id,
                                data: data,
                                cached_at: new Date().toISOString()
                            };
                            
                            await this.saveToStore('movies_cache', movieDetails);
                        }
                    }
                    
                    // Sauvegarder l'item avec détails
                    const itemToSave = {
                        movie_id: item.movie_id,
                        movie_title: item.movie_title,
                        movie_poster: item.movie_poster,
                        added_at: item.added_at || item.watched_at,
                        rating: item.rating || null,                    // ✅ AJOUT : Note utilisateur
                        watched_at: item.watched_at || item.added_at,  // ✅ AJOUT : Date de visionnage
                        details: movieDetails?.data ? {
                            title: movieDetails.data.title,
                            poster_path: movieDetails.data.poster_path,
                            release_date: movieDetails.data.release_date,
                            genres: movieDetails.data.genres,
                            vote_average: movieDetails.data.vote_average,  // ✅ AJOUT : Note TMDB
                            vote_count: movieDetails.data.vote_count,      // ✅ AJOUT : Nombre de votes
                            runtime: movieDetails.data.runtime || 0        // ✅ AJOUT : Durée du film en minutes
                        } : null
                    };
                    
                    await this.saveToStore(storeName, itemToSave);
                    saved++;
                    
                } catch (error) {
                    console.error(`Erreur film ${item.movie_id}:`, error);
                }
            }));
            
            console.log(`📊 Progression: ${saved}/${items.length}`);
        }

        console.log(`✅ ${saved} films sauvegardés dans ${storeName}`);
    },

    // ✅ Sauvegarder les likes
    async saveLikesWithDetails(likes) {
        console.log(`📦 Sauvegarde ${likes.length} likes...`);
        
        await this.clearStore('likes');
        
        for (const like of likes) {
            try {
                await this.saveToStore('likes', {
                    movie_id: like.movie_id,
                    created_at: like.created_at
                });
            } catch (error) {
                console.error(`Erreur like ${like.movie_id}:`, error);
            }
        }

        console.log(`✅ ${likes.length} likes sauvegardés`);
    },

    // ✅ Vérifier si le cache est expiré
    isCacheExpired(cachedAt, maxDays = 7) {
        if (!cachedAt) return true;
        const cacheAge = Date.now() - new Date(cachedAt).getTime();
        const maxAge = maxDays * 24 * 60 * 60 * 1000;
        return cacheAge > maxAge;
    },

    // ✅ Opérations de base sécurisées
    async saveToStore(storeName, data) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    async getAllFromStore(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    async getFromStore(storeName, key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    async clearStore(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    // ✅ Récupération des données
    async getWatchlist() {
        if (!this.isEnabled()) return null;
        try {
            await this.init();
            return await this.getAllFromStore('watchlist');
        } catch (error) {
            console.error('Erreur getWatchlist:', error);
            return null;
        }
    },

    async getWatched() {
        if (!this.isEnabled()) return null;
        try {
            await this.init();
            return await this.getAllFromStore('watched');
        } catch (error) {
            console.error('Erreur getWatched:', error);
            return null;
        }
    },

    async getLikes() {
        if (!this.isEnabled()) return null;
        try {
            await this.init();
            return await this.getAllFromStore('likes');
        } catch (error) {
            console.error('Erreur getLikes:', error);
            return null;
        }
    },

    async getProfile() {
        if (!this.isEnabled()) return null;
        try {
            await this.init();
            const result = await this.getFromStore('settings', 'profile');
            return result?.value || null;
        } catch (error) {
            console.error('Erreur getProfile:', error);
            return null;
        }
    },

    async getLastSync() {
        try {
            await this.init();
            const result = await this.getFromStore('settings', 'last_sync');
            return result ? new Date(result.value) : null;
        } catch (error) {
            return null;
        }
    },

    // ✅ Nettoyage
    async clearAllData() {
        try {
            await this.init();
            await this.clearStore('watchlist');
            await this.clearStore('watched');
            await this.clearStore('likes');
            await this.clearStore('movies_cache');
            await this.clearStore('settings');
            console.log('🗑️ Cache offline vidé');
        } catch (error) {
            console.error('Erreur clearAllData:', error);
        }
    },

    // ✅ Taille du cache (FIXÉE)
    async getCacheSize() {
        try {
            if (!navigator.storage || !navigator.storage.estimate) {
                return "N/A";
            }
            
            const estimate = await navigator.storage.estimate();
            const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
            const quotaMB = (estimate.quota / 1024 / 1024).toFixed(0);
            
            return `${usedMB} MB / ${quotaMB} MB`;
        } catch (error) {
            return "N/A";
        }
    },

    // ✅ Santé du stockage
    async getStorageHealth() {
        try {
            await this.init();
            
            const watchlist = await this.getAllFromStore('watchlist');
            const watched = await this.getAllFromStore('watched');
            const likes = await this.getAllFromStore('likes');
            const cache = await this.getAllFromStore('movies_cache');
            
            return {
                watchlist_count: watchlist.length,
                watched_count: watched.length,
                likes_count: likes.length,
                cached_movies: cache.length,
                total_size: await this.getCacheSize(),
                last_sync: await this.getLastSync()
            };
        } catch (error) {
            console.error('Erreur getStorageHealth:', error);
            return {
                watchlist_count: 0,
                watched_count: 0,
                likes_count: 0,
                cached_movies: 0,
                total_size: "N/A",
                last_sync: null
            };
        }
    },

    // ✅ Reset complet de la DB
    async resetDatabase() {
        console.log('🔄 Réinitialisation complète...');
        
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.DB_NAME);
            
            deleteRequest.onsuccess = async () => {
                console.log('✅ Base supprimée');
                try {
                    await this.init();
                    console.log('✅ Base recréée');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            
            deleteRequest.onerror = () => reject(deleteRequest.error);
            
            deleteRequest.onblocked = () => {
                console.warn('⚠️ Suppression bloquée');
                setTimeout(() => {
                    this.resetDatabase().then(resolve).catch(reject);
                }, 1000);
            };
        });
    }
};

// ✅ Auto-sync quand on revient en ligne
window.addEventListener('online', async () => {
    if (OfflineStorage.isEnabled() && getToken()) {
        console.log('🌐 Connexion rétablie, synchronisation...');
        setTimeout(async () => {
            await OfflineStorage.syncAllData();
        }, 2000);
    }
});

// ✅ Auto-sync toutes les 30 minutes
setInterval(async () => {
    if (OfflineStorage.isEnabled() && getToken() && navigator.onLine) {
        await OfflineStorage.syncAllData();
    }
}, 30 * 60 * 1000);

// ✅ Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    if (OfflineStorage.isEnabled()) {
        await OfflineStorage.init();
    }
});

window.OfflineStorage = OfflineStorage;