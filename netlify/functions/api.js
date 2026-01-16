import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.SITE_URL || 'http://localhost:8888';

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

    // ==================== PASSWORD ROUTES ====================

    // Change password (from profile)
    if (path === '/profile/password' && method === 'PUT') {
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return response(400, { error: 'Mot de passe actuel et nouveau requis' });
      }

      if (newPassword.length < 6) {
        return response(400, { error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
      }

      // Vérifier le mot de passe actuel
      const [user] = await sql`SELECT password FROM users WHERE id = ${userId}`;
      
      if (!user) {
        return response(404, { error: 'Utilisateur non trouvé' });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return response(401, { error: 'Mot de passe actuel incorrect' });
      }

      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await sql`
        UPDATE users
        SET password = ${hashedPassword}
        WHERE id = ${userId}
      `;

      return response(200, { message: 'Mot de passe mis à jour avec succès' });
    }

    // Request password reset (no auth required)
    if (path === '/auth/forgot-password' && method === 'POST') {
      const { email } = body;

      if (!email) {
        return response(400, { error: 'Email requis' });
      }

      // Vérifier si l'utilisateur existe
      const [user] = await sql`SELECT id, email, username FROM users WHERE email = ${email}`;

      // Pour la sécurité, toujours retourner le même message
      if (!user) {
        return response(200, { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
      }

      // Générer un token de réinitialisation (valide 1h)
      const resetToken = jwt.sign(
        { userId: user.id, purpose: 'reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Sauvegarder le token en DB
      await sql`
        INSERT INTO reset_tokens (user_id, token, expires_at)
        VALUES (${user.id}, ${resetToken}, NOW() + INTERVAL '1 hour')
        ON CONFLICT (user_id) DO UPDATE
        SET token = ${resetToken}, expires_at = NOW() + INTERVAL '1 hour'
      `;

      // Envoyer l'email avec Resend
      try {
        const resetLink = `${SITE_URL}/reset-password.html?token=${resetToken}`;
        
        await resend.emails.send({
          from: 'CineTrack <onboarding@resend.dev>', // Changez avec votre domaine vérifié
          to: user.email,
          subject: 'Réinitialisation de votre mot de passe - CineTrack',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                .button:hover { background: #2563eb; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎬 CineTrack</h1>
                </div>
                <div class="content">
                  <h2>Réinitialisation de mot de passe</h2>
                  <p>Bonjour <strong>${user.username}</strong>,</p>
                  <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                  
                  <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
                  </div>
                  
                  <p>Ou copiez ce lien dans votre navigateur :</p>
                  <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 12px;">
                    ${resetLink}
                  </p>
                  
                  <div class="warning">
                    <strong>⚠️ Important :</strong> Ce lien est valide pendant <strong>1 heure</strong> seulement.
                  </div>
                  
                  <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email. Votre mot de passe actuel reste inchangé.</p>
                  
                  <div class="footer">
                    <p>CineTrack - Votre gestionnaire de films préféré</p>
                    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `
        });

        console.log(`✅ Email de reset envoyé à ${user.email}`);
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError);
        // On continue quand même pour ne pas révéler si l'email existe
      }

      return response(200, { 
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
      });
    }

    // Reset password with token (no auth required)
    if (path === '/auth/reset-password' && method === 'POST') {
      const { token, newPassword } = body;

      if (!token || !newPassword) {
        return response(400, { error: 'Token et nouveau mot de passe requis' });
      }

      if (newPassword.length < 6) {
        return response(400, { error: 'Le mot de passe doit contenir au moins 6 caractères' });
      }

      try {
        // Vérifier le token JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.purpose !== 'reset') {
          return response(400, { error: 'Token invalide' });
        }

        // Vérifier que le token existe en DB et n'a pas expiré
        const [resetToken] = await sql`
          SELECT * FROM reset_tokens 
          WHERE user_id = ${decoded.userId} 
          AND token = ${token} 
          AND expires_at > NOW()
        `;

        if (!resetToken) {
          return response(400, { error: 'Token invalide ou expiré' });
        }

        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Mettre à jour le mot de passe
        await sql`
          UPDATE users
          SET password = ${hashedPassword}
          WHERE id = ${decoded.userId}
        `;

        // Supprimer le token utilisé
        await sql`DELETE FROM reset_tokens WHERE token = ${token}`;

        return response(200, { message: 'Mot de passe réinitialisé avec succès' });

      } catch (error) {
        return response(400, { error: 'Token invalide ou expiré' });
      }
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