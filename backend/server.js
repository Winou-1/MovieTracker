// server.js - Backend Node.js pour CineTrack

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const JWT_SECRET = 'votre_secret_jwt_a_changer'; // À changer en production !

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ✅ Augmenter la limite pour les images base64

// Initialisation de la base de données SQLite
const db = new sqlite3.Database('./cinetrack.db', (err) => {
    if (err) {
        console.error('Erreur connexion DB:', err);
    } else {
        console.log('✓ Base de données connectée');
        initDatabase();
    }
});

// Création des tables
function initDatabase() {
    db.serialize(() => {
        // Table utilisateurs (✅ AVEC AVATAR)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Table notations
        db.run(`CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, movie_id)
        )`);

        // Table critiques
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            movie_title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Table watchlist (films à voir)
        db.run(`CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            movie_title TEXT NOT NULL,
            movie_poster TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, movie_id)
        )`);

        // Table films vus
        db.run(`CREATE TABLE IF NOT EXISTS watched (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            movie_title TEXT NOT NULL,
            movie_poster TEXT,
            watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, movie_id)
        )`);

        console.log('✓ Tables initialisées');
    });
}

// Middleware d'authentification
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
}

// ==================== ROUTES AUTHENTIFICATION ====================

// Inscription
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
                    }
                    return res.status(500).json({ error: 'Erreur lors de l\'inscription' });
                }

                const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '7d' });

                res.status(201).json({
                    message: 'Utilisateur créé avec succès',
                    token,
                    user: { 
                        id: this.lastID, 
                        username, 
                        email,
                        avatar: null // ✅ Avatar null par défaut
                    }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Connexion
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

            res.json({
                message: 'Connexion réussie',
                token,
                user: { 
                    id: user.id, 
                    username: user.username, 
                    email: user.email,
                    avatar: user.avatar // ✅ Retourne l'avatar
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });
});

// ==================== ROUTES PROFIL ====================

// ✅ Récupérer le profil complet
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get(
        'SELECT id, username, email, avatar, created_at FROM users WHERE id = ?',
        [req.user.id],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            res.json(user);
        }
    );
});

// ✅ Mettre à jour l'avatar
app.put('/api/profile/avatar', authenticateToken, (req, res) => {
    const { avatar } = req.body;

    if (!avatar) {
        return res.status(400).json({ error: 'Avatar requis' });
    }

    // Vérifier que c'est bien une image base64
    if (!avatar.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Format d\'image invalide' });
    }

    // Limiter la taille (environ 1MB en base64)
    if (avatar.length > 1500000) {
        return res.status(400).json({ error: 'Image trop volumineuse (max 1MB)' });
    }

    db.run(
        'UPDATE users SET avatar = ? WHERE id = ?',
        [avatar, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
            }

            // Récupérer l'utilisateur mis à jour
            db.get(
                'SELECT id, username, email, avatar FROM users WHERE id = ?',
                [req.user.id],
                (err, user) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    res.json({ 
                        message: 'Avatar mis à jour',
                        user 
                    });
                }
            );
        }
    );
});

// ✅ Mettre à jour le username
app.put('/api/profile/username', authenticateToken, (req, res) => {
    const { username } = req.body;

    if (!username || username.trim().length === 0) {
        return res.status(400).json({ error: 'Username requis' });
    }

    db.run(
        'UPDATE users SET username = ? WHERE id = ?',
        [username.trim(), req.user.id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
                }
                return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
            }

            // Récupérer l'utilisateur mis à jour
            db.get(
                'SELECT id, username, email, avatar FROM users WHERE id = ?',
                [req.user.id],
                (err, user) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    res.json({ 
                        message: 'Pseudo mis à jour',
                        user 
                    });
                }
            );
        }
    );
});

// ==================== ROUTES NOTATIONS ====================

// Ajouter/Modifier une notation
app.post('/api/ratings', authenticateToken, (req, res) => {
    const { movie_id, rating } = req.body;
    const user_id = req.user.id;

    if (!movie_id || !rating || rating < 1 || rating > 10) {
        return res.status(400).json({ error: 'Données invalides' });
    }

    db.run(
        'INSERT OR REPLACE INTO ratings (user_id, movie_id, rating) VALUES (?, ?, ?)',
        [user_id, movie_id, rating],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
            }
            res.json({ message: 'Notation enregistrée', rating_id: this.lastID });
        }
    );
});

// Récupérer les notations d'un utilisateur
app.get('/api/ratings/user', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM ratings WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, ratings) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json(ratings);
        }
    );
});

// Récupérer la notation d'un film spécifique
app.get('/api/ratings/:movie_id', authenticateToken, (req, res) => {
    db.get(
        'SELECT * FROM ratings WHERE user_id = ? AND movie_id = ?',
        [req.user.id, req.params.movie_id],
        (err, rating) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json(rating || null);
        }
    );
});

// ==================== ROUTES CRITIQUES ====================

// Ajouter une critique
app.post('/api/reviews', authenticateToken, (req, res) => {
    const { movie_id, movie_title, content } = req.body;
    const user_id = req.user.id;

    if (!movie_id || !movie_title || !content) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    db.run(
        'INSERT INTO reviews (user_id, movie_id, movie_title, content) VALUES (?, ?, ?, ?)',
        [user_id, movie_id, movie_title, content],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
            }
            res.status(201).json({ 
                message: 'Critique ajoutée',
                review_id: this.lastID 
            });
        }
    );
});

// Récupérer les critiques d'un utilisateur
app.get('/api/reviews/user', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, reviews) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json(reviews);
        }
    );
});

// Récupérer toutes les critiques (feed public)
app.get('/api/reviews/feed', (req, res) => {
    db.all(
        `SELECT r.*, u.username 
         FROM reviews r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY r.created_at DESC 
         LIMIT 50`,
        (err, reviews) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json(reviews);
        }
    );
});

// ==================== ROUTES WATCHLIST ====================

// Ajouter à la watchlist
app.post('/api/watchlist', authenticateToken, (req, res) => {
    const { movie_id, movie_title, movie_poster } = req.body;
    const user_id = req.user.id;

    if (!movie_id || !movie_title) {
        return res.status(400).json({ error: 'Données invalides' });
    }

    db.run(
        'INSERT OR IGNORE INTO watchlist (user_id, movie_id, movie_title, movie_poster) VALUES (?, ?, ?, ?)',
        [user_id, movie_id, movie_title, movie_poster],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de l\'ajout' });
            }
            res.json({ message: 'Film ajouté à la watchlist' });
        }
    );
});

// Récupérer la watchlist
app.get('/api/watchlist', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC',
        [req.user.id],
        (err, watchlist) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json(watchlist);
        }
    );
});

// Retirer de la watchlist
app.delete('/api/watchlist/:movie_id', authenticateToken, (req, res) => {
    db.run(
        'DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?',
        [req.user.id, req.params.movie_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json({ message: 'Film retiré de la watchlist' });
        }
    );
});

// ==================== ROUTES WATCHED (FILMS VUS) ====================

// Ajouter aux films vus
app.post('/api/watched', authenticateToken, (req, res) => {
    const { movie_id, movie_title, movie_poster } = req.body;
    const user_id = req.user.id;

    if (!movie_id || !movie_title) {
        return res.status(400).json({ error: 'Informations du film manquantes' });
    }

    db.run(
        'INSERT OR IGNORE INTO watched (user_id, movie_id, movie_title, movie_poster) VALUES (?, ?, ?, ?)',
        [user_id, movie_id, movie_title, movie_poster],
        function(err) {
            if (err) {
                console.error("Erreur SQL:", err);
                return res.status(500).json({ error: 'Erreur serveur lors de l\'ajout' });
            }
            res.json({ message: 'Film marqué comme vu', id: this.lastID });
        }
    );
});

// Récupérer la liste des films vus
app.get('/api/watched', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM watched WHERE user_id = ? ORDER BY watched_at DESC',
        [req.user.id],
        (err, watched) => {
            if (err) {
                console.error("Erreur SQL:", err);
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json(watched);
        }
    );
});

// Retirer de la liste des films vus
app.delete('/api/watched/:movie_id', authenticateToken, (req, res) => {
    db.run(
        'DELETE FROM watched WHERE user_id = ? AND movie_id = ?',
        [req.user.id, req.params.movie_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.json({ message: 'Film retiré des films vus' });
        }
    );
});

// ==================== ROUTES STATISTIQUES ====================

// Statistiques utilisateur
app.get('/api/stats', authenticateToken, (req, res) => {
    const user_id = req.user.id;

    const stats = {};

    // Nombre de films notés
    db.get('SELECT COUNT(*) as count FROM ratings WHERE user_id = ?', [user_id], (err, result) => {
        stats.rated_count = result ? result.count : 0;

        // Nombre de critiques
        db.get('SELECT COUNT(*) as count FROM reviews WHERE user_id = ?', [user_id], (err, result) => {
            stats.reviews_count = result ? result.count : 0;

            // Note moyenne
            db.get('SELECT AVG(rating) as avg FROM ratings WHERE user_id = ?', [user_id], (err, result) => {
                stats.average_rating = result && result.avg ? result.avg.toFixed(1) : 0;

                // Films dans la watchlist
                db.get('SELECT COUNT(*) as count FROM watchlist WHERE user_id = ?', [user_id], (err, result) => {
                    stats.watchlist_count = result ? result.count : 0;

                    res.json(stats);
                });
            });
        });
    });
});

// ==================== DÉMARRAGE SERVEUR ====================

app.listen(PORT, () => {
    console.log(`✓ Serveur démarré sur http://localhost:${PORT}`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Base de données fermée');
        process.exit(0);
    });
});


// ==================== SUPPRESSION DE NOTATION ====================

// Supprimer une notation
app.delete('/api/ratings/:movie_id', authenticateToken, (req, res) => {
    const { movie_id } = req.params;
    const user_id = req.user.id;

    db.run(
        'DELETE FROM ratings WHERE user_id = ? AND movie_id = ?',
        [user_id, movie_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la suppression' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Note non trouvée' });
            }
            
            res.json({ 
                message: 'Note supprimée avec succès', 
                deleted: true,
                changes: this.changes 
            });
        }
    );
});


// Créer la table reset_tokens
db.run(`CREATE TABLE IF NOT EXISTS reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Route pour demander la réinitialisation
app.post('/api/auth/forgot-password', async (req, res) => {
    // Voir le code commenté dans forgot-password.js
});

// Route pour réinitialiser le mot de passe
app.post('/api/auth/reset-password', async (req, res) => {
    // Voir le code commenté dans forgot-password.js
});