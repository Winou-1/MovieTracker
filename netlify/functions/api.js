import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

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

      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) {
        return response(400, { error: 'Cet email est déjà utilisé' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await sql`
        INSERT INTO users (username, email, password)
        VALUES (${username}, ${email}, ${hashedPassword})
        RETURNING id, username, email, avatar
      `;

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

      return response(201, { 
        token, 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        }
      });
    }

    // Login
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = body;

      if (!email || !password) {
        return response(400, { error: 'Email et mot de passe requis' });
      }

      const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!user) {
        return response(401, { error: 'Email ou mot de passe incorrect' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return response(401, { error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

      return response(200, {
        token,
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          avatar: user.avatar
        }
      });
    }

    // ==================== PROTECTED ROUTES ====================
    
    const userData = verifyToken(authHeader);
    if (!userData) {
      return response(401, { error: 'Non authentifié' });
    }

    const userId = userData.userId;

    // GET USER PROFILE
    if (path === '/profile' && method === 'GET') {
      const [user] = await sql`
        SELECT id, username, email, avatar, created_at
        FROM users
        WHERE id = ${userId}
      `;
      
      if (!user) {
        return response(404, { error: 'Utilisateur non trouvé' });
      }

      return response(200, user);
    }

    // UPDATE AVATAR
    if (path === '/profile/avatar' && method === 'PUT') {
      const { avatar } = body;

      if (!avatar) {
        return response(400, { error: 'Avatar requis' });
      }

      if (avatar.length > 1500000) {
        return response(400, { error: 'Image trop volumineuse (max 1MB)' });
      }

      const [user] = await sql`
        UPDATE users
        SET avatar = ${avatar}
        WHERE id = ${userId}
        RETURNING id, username, email, avatar
      `;

      return response(200, { 
        message: 'Avatar mis à jour',
        user 
      });
    }

    // UPDATE USERNAME
    if (path === '/profile/username' && method === 'PUT') {
      const { username } = body;

      if (!username || username.trim().length === 0) {
        return response(400, { error: 'Username requis' });
      }

      const [user] = await sql`
        UPDATE users
        SET username = ${username.trim()}
        WHERE id = ${userId}
        RETURNING id, username, email, avatar
      `;

      return response(200, { 
        message: 'Pseudo mis à jour',
        user 
      });
    }

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

    // ==================== LIKES ROUTES ====================

    // Get all likes for user
    if (path === '/likes/all' && method === 'GET') {
      const likes = await sql`
        SELECT movie_id, created_at
        FROM likes
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return response(200, likes);
    }

    // Check if movie is liked (doit être AVANT le DELETE)
    if (path.startsWith('/likes/') && path !== '/likes/all' && method === 'GET') {
      const movieId = path.split('/')[2];
      
      const [like] = await sql`
        SELECT id FROM likes
        WHERE user_id = ${userId} AND movie_id = ${movieId}
      `;
      
      return response(200, { liked: !!like });
    }

    // Add like
    if (path === '/likes' && method === 'POST') {
      const { movie_id } = body;
      
      if (!movie_id) {
        return response(400, { error: 'movie_id requis' });
      }
      
      const [like] = await sql`
        INSERT INTO likes (user_id, movie_id)
        VALUES (${userId}, ${movie_id})
        ON CONFLICT (user_id, movie_id) DO NOTHING
        RETURNING *
      `;
      
      return response(200, { message: 'Film liké', liked: true });
    }

    // Remove like
    if (path.startsWith('/likes/') && path !== '/likes/all' && method === 'DELETE') {
      const movieId = path.split('/')[2];
      
      await sql`
        DELETE FROM likes
        WHERE user_id = ${userId} AND movie_id = ${movieId}
      `;
      
      return response(200, { message: 'Like retiré', liked: false });
    }

    return response(404, { error: 'Route non trouvée' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message });
  }
}