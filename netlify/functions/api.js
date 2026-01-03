import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const sql = neon(); // Utilise automatiquement NETLIFY_DATABASE_URL
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Helper pour vérifier le token JWT
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Helper pour les réponses
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event, context) {
  // Gérer les requêtes OPTIONS pour CORS
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const authHeader = event.headers.authorization || event.headers.Authorization;

  try {
    // ==================== AUTH ROUTES ====================
    
    // Register
    if (path === '/auth/register' && method === 'POST') {
      const { username, email, password } = body;
      
      if (!username || !email || !password) {
        return response(400, { error: 'Tous les champs sont requis' });
      }

      // Vérifier si l'email existe
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) {
        return response(400, { error: 'Cet email est déjà utilisé' });
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // Créer l'utilisateur
      const [user] = await sql`
        INSERT INTO users (username, email, password)
        VALUES (${username}, ${email}, ${hashedPassword})
        RETURNING id, username, email
      `;

      // Générer le token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

      return response(201, { token, user });
    }

    // Login
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = body;

      if (!email || !password) {
        return response(400, { error: 'Email et mot de passe requis' });
      }

      // Trouver l'utilisateur
      const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!user) {
        return response(401, { error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier le mot de passe
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return response(401, { error: 'Email ou mot de passe incorrect' });
      }

      // Générer le token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

      return response(200, {
        token,
        user: { id: user.id, username: user.username, email: user.email }
      });
    }

    // ==================== PROTECTED ROUTES ====================
    
    const userData = verifyToken(authHeader);
    if (!userData) {
      return response(401, { error: 'Non authentifié' });
    }

    const userId = userData.userId;

    // Stats
    if (path === '/stats' && method === 'GET') {
      const [stats] = await sql`
        SELECT 
          COUNT(DISTINCT CASE WHEN rating > 0 THEN movie_id END) as rated_count,
          ROUND(AVG(CASE WHEN rating > 0 THEN rating END), 1) as average_rating,
          COUNT(DISTINCT CASE WHEN review IS NOT NULL THEN movie_id END) as reviews_count,
          (SELECT COUNT(*) FROM watchlist WHERE user_id = ${userId}) as watchlist_count
        FROM watched
        WHERE user_id = ${userId}
      `;

      return response(200, {
        rated_count: parseInt(stats.rated_count) || 0,
        average_rating: parseFloat(stats.average_rating) || 0,
        reviews_count: parseInt(stats.reviews_count) || 0,
        watchlist_count: parseInt(stats.watchlist_count) || 0
      });
    }

    // Watchlist - GET
    if (path === '/watchlist' && method === 'GET') {
      const watchlist = await sql`
        SELECT movie_id, movie_title, movie_poster, added_at
        FROM watchlist
        WHERE user_id = ${userId}
        ORDER BY added_at DESC
      `;
      return response(200, watchlist);
    }

    // Watchlist - POST
    if (path === '/watchlist' && method === 'POST') {
      const { movie_id, movie_title, movie_poster } = body;

      const [item] = await sql`
        INSERT INTO watchlist (user_id, movie_id, movie_title, movie_poster)
        VALUES (${userId}, ${movie_id}, ${movie_title}, ${movie_poster})
        ON CONFLICT (user_id, movie_id) DO NOTHING
        RETURNING *
      `;

      return response(201, item || { message: 'Déjà dans la watchlist' });
    }

    // Watchlist - DELETE
    if (path.startsWith('/watchlist/') && method === 'DELETE') {
      const movieId = path.split('/')[2];

      await sql`
        DELETE FROM watchlist
        WHERE user_id = ${userId} AND movie_id = ${movieId}
      `;

      return response(200, { message: 'Retiré de la watchlist' });
    }

    // Watched - GET
    if (path === '/watched' && method === 'GET') {
      const watched = await sql`
        SELECT movie_id, movie_title, movie_poster, watched_at
        FROM watched
        WHERE user_id = ${userId}
        ORDER BY watched_at DESC
      `;
      return response(200, watched);
    }

    // Watched - POST
    if (path === '/watched' && method === 'POST') {
      const { movie_id, movie_title, movie_poster } = body;

      const [item] = await sql`
        INSERT INTO watched (user_id, movie_id, movie_title, movie_poster)
        VALUES (${userId}, ${movie_id}, ${movie_title}, ${movie_poster})
        ON CONFLICT (user_id, movie_id) DO UPDATE
        SET watched_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      return response(201, item);
    }

    // Watched - DELETE
    if (path.startsWith('/watched/') && method === 'DELETE') {
      const movieId = path.split('/')[2];

      await sql`
        DELETE FROM watched
        WHERE user_id = ${userId} AND movie_id = ${movieId}
      `;

      return response(200, { message: 'Retiré des films vus' });
    }

    // Ratings - GET
    if (path.startsWith('/ratings/') && method === 'GET') {
      const movieId = path.split('/')[2];

      const [rating] = await sql`
        SELECT rating FROM watched
        WHERE user_id = ${userId} AND movie_id = ${movieId}
      `;

      return response(200, rating || { rating: null });
    }

    // Ratings - POST
    if (path === '/ratings' && method === 'POST') {
      const { movie_id, rating } = body;

      const [item] = await sql`
        INSERT INTO watched (user_id, movie_id, rating)
        VALUES (${userId}, ${movie_id}, ${rating})
        ON CONFLICT (user_id, movie_id) DO UPDATE
        SET rating = ${rating}
        RETURNING *
      `;

      return response(200, item);
    }

    // Route non trouvée
    return response(404, { error: 'Route non trouvée' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
}