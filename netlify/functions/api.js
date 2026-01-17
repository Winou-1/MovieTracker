import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const sql = neon(process.env.DATABASE_URL);
const resend = new Resend(process.env.RESEND_API_KEY);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Helper pour extraire le user depuis le token
function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token invalide:', error);
    return null;
  }
}

export const handler = async (event) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const path = event.path.replace('/.netlify/functions/api', '');
    const method = event.httpMethod;
    
    console.log(`${method} ${path}`);

    // ==================== AUTH ====================
    
    // POST /auth/register
    if (path === '/auth/register' && method === 'POST') {
      const { username, email, password } = JSON.parse(event.body);
      
      if (!username || !email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Tous les champs sont requis' })
        };
      }

      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${email} OR username = ${username}
      `;
      
      if (existingUser.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email ou pseudo déjà utilisé' })
        };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await sql`
        INSERT INTO users (username, email, password)
        VALUES (${username}, ${email}, ${hashedPassword})
        RETURNING id, username, email, avatar, created_at
      `;

      const token = jwt.sign(
        { userId: newUser[0].id, username: newUser[0].username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          token,
          user: newUser[0]
        })
      };
    }

    // POST /auth/login
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = JSON.parse(event.body);
      
      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email et mot de passe requis' })
        };
      }

      const users = await sql`
        SELECT id, username, email, password, avatar FROM users WHERE email = ${email}
      `;
      
      if (users.length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Email ou mot de passe incorrect' })
        };
      }

      const user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Email ou mot de passe incorrect' })
        };
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
          }
        })
      };
    }

    // POST /auth/forgot-password
    if (path === '/auth/forgot-password' && method === 'POST') {
      const { email } = JSON.parse(event.body);
      
      const users = await sql`SELECT id FROM users WHERE email = ${email}`;
      
      if (users.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Si un compte existe, un email a été envoyé' })
        };
      }

      const resetToken = jwt.sign(
        { userId: users[0].id, type: 'password-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await sql`
        UPDATE users 
        SET reset_token = ${resetToken}, reset_token_expires = NOW() + INTERVAL '1 hour'
        WHERE id = ${users[0].id}
      `;

      const resetLink = `${process.env.SITE_URL}?token=${resetToken}`;

      try {
        const emailResult = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Réinitialisation de votre mot de passe - CineTrack',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                .container { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 8px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #2563eb; margin: 0; }
                .content { color: #333; line-height: 1.6; }
                .button { display: inline-block; background: #8ba5dd; color: white; padding: 14px 28px; 
                         text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; 
                         color: #666; font-size: 12px; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎬 CineTrack</h1>
                </div>
                <div class="content">
                  <h2>Réinitialisation de votre mot de passe</h2>
                  <p>Bonjour,</p>
                  <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
                  <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
                  </div>
                  <p>Ou copiez ce lien dans votre navigateur :</p>
                  <p style="background: #f4f4f4; padding: 10px; border-radius: 4px; word-break: break-all;">
                    ${resetLink}
                  </p>
                  <p><strong>⏰ Ce lien expire dans 1 heure.</strong></p>
                  <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                </div>
                <div class="footer">
                  <p>Cet email a été envoyé par CineTrack</p>
                </div>
              </div>
            </body>
            </html>
          `
        });

        console.log('📧 Email envoyé avec succès:', emailResult);

        // En DEV, retourner aussi le lien pour faciliter les tests
        if (process.env.NODE_ENV === 'development') {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              message: 'Email envoyé',
              devMode: true,
              resetLink,
              emailId: emailResult.id
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Email envoyé avec succès' })
        };

      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError);
        
        // En DEV, retourner quand même le lien si l'email échoue
        if (process.env.NODE_ENV === 'development') {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              message: 'Email non envoyé (erreur Resend), mais voici le lien',
              devMode: true,
              resetLink,
              emailError: emailError.message
            })
          };
        }

        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Erreur lors de l\'envoi de l\'email',
            details: emailError.message 
          })
        };
      }
    }

    // POST /auth/reset-password
    if (path === '/auth/reset-password' && method === 'POST') {
      const { token, newPassword } = JSON.parse(event.body);
      
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Token invalide ou expiré' })
        };
      }

      const users = await sql`
        SELECT id FROM users 
        WHERE id = ${decoded.userId} 
        AND reset_token = ${token}
        AND reset_token_expires > NOW()
      `;

      if (users.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Token invalide ou expiré' })
        };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await sql`
        UPDATE users 
        SET password = ${hashedPassword}, 
            reset_token = NULL, 
            reset_token_expires = NULL
        WHERE id = ${users[0].id}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Mot de passe réinitialisé' })
      };
    }

    // ==================== ROUTES PUBLIQUES (suite) ====================
    
    // Route de test (pour vérifier que l'API fonctionne)
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', message: 'API is running' })
      };
    }

    // ==================== ROUTES PROTÉGÉES ====================
    
    const user = getUserFromToken(event.headers.authorization);
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Non autorisé' })
      };
    }

    // GET /profile
    if (path === '/profile' && method === 'GET') {
      const userData = await sql`
        SELECT id, username, email, avatar, created_at 
        FROM users 
        WHERE id = ${user.userId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(userData[0])
      };
    }

    // PUT /profile - Mise à jour du profil (Avatar, Username, Email)
    if (path === '/profile' && method === 'PUT') {
      const body = JSON.parse(event.body);
      const updates = [];
      const values = [];
      let paramIndex = 1;

      // Construction dynamique de la requête SQL
      if (body.username) {
        updates.push(`username = $${paramIndex++}`);
        values.push(body.username);
      }
      if (body.avatar) {
        updates.push(`avatar = $${paramIndex++}`);
        values.push(body.avatar);
      }
      if (body.email) {
        updates.push(`email = $${paramIndex++}`);
        values.push(body.email);
      }

      if (updates.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: 'Aucune donnée à mettre à jour' }) };
      }

      values.push(user.userId); 

      try {        
        if (body.email) {
           const existingUser = await sql`SELECT id FROM users WHERE email = ${body.email} AND id != ${user.userId}`;
           if (existingUser.length > 0) {
             return { statusCode: 400, headers, body: JSON.stringify({ message: 'Cet email est déjà utilisé' }) };
           }
           
           await sql`UPDATE users SET email = ${body.email} WHERE id = ${user.userId}`;
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Profil mis à jour avec succès' })
        };

      } catch (error) {
        console.error('Erreur update profile:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: 'Erreur serveur' }) };
      }
    }

    // PUT /profile/username
    if (path === '/profile/username' && method === 'PUT') {
      const { username } = JSON.parse(event.body);
      
      const existing = await sql`
        SELECT id FROM users WHERE username = ${username} AND id != ${user.userId}
      `;
      
      if (existing.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Pseudo déjà pris' })
        };
      }

      await sql`UPDATE users SET username = ${username} WHERE id = ${user.userId}`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Pseudo mis à jour' })
      };
    }

    // PUT /profile/avatar
    if (path === '/profile/avatar' && method === 'PUT') {
      const { avatar } = JSON.parse(event.body);
      
      await sql`UPDATE users SET avatar = ${avatar} WHERE id = ${user.userId}`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Avatar mis à jour' })
      };
    }

    // PUT /profile/password
    if (path === '/profile/password' && method === 'PUT') {
      const { currentPassword, newPassword } = JSON.parse(event.body);
      
      const userData = await sql`SELECT password FROM users WHERE id = ${user.userId}`;
      const isValid = await bcrypt.compare(currentPassword, userData[0].password);
      
      if (!isValid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Mot de passe actuel incorrect' })
        };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.userId}`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Mot de passe modifié' })
      };
    }

    // GET /stats
    if (path === '/stats' && method === 'GET') {
      const stats = await sql`
        SELECT 
          (SELECT COUNT(*) FROM watched WHERE user_id = ${user.userId} AND rating IS NOT NULL) as rated_count,
          (SELECT COALESCE(AVG(rating)::numeric(10,1), 0) FROM watched WHERE user_id = ${user.userId} AND rating IS NOT NULL) as average_rating,
          (SELECT COUNT(*) FROM watchlist WHERE user_id = ${user.userId}) as watchlist_count
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(stats[0])
      };
    }

    // ==================== WATCHLIST ====================
    
    // GET /watchlist
    if (path === '/watchlist' && method === 'GET') {
      const watchlist = await sql`
        SELECT movie_id, movie_title, movie_poster, added_at 
        FROM watchlist 
        WHERE user_id = ${user.userId}
        ORDER BY added_at DESC
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(watchlist)
      };
    }

    // POST /watchlist
    if (path === '/watchlist' && method === 'POST') {
      const { movie_id, movie_title, movie_poster } = JSON.parse(event.body);
      
      await sql`
        INSERT INTO watchlist (user_id, movie_id, movie_title, movie_poster)
        VALUES (${user.userId}, ${movie_id}, ${movie_title}, ${movie_poster})
        ON CONFLICT (user_id, movie_id) DO NOTHING
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Ajouté à la watchlist' })
      };
    }

    // DELETE /watchlist/:id
    if (path.startsWith('/watchlist/') && method === 'DELETE') {
      const movieId = path.split('/')[2];
      
      await sql`
        DELETE FROM watchlist 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Retiré de la watchlist' })
      };
    }

    // ==================== WATCHED ====================
    
    // GET /watched
    if (path === '/watched' && method === 'GET') {
      const watched = await sql`
        SELECT movie_id, movie_title, movie_poster, watched_at 
        FROM watched 
        WHERE user_id = ${user.userId}
        ORDER BY watched_at DESC
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(watched)
      };
    }

    // POST /watched
    if (path === '/watched' && method === 'POST') {
      const { movie_id, movie_title, movie_poster } = JSON.parse(event.body);
      
      await sql`
        INSERT INTO watched (user_id, movie_id, movie_title, movie_poster)
        VALUES (${user.userId}, ${movie_id}, ${movie_title}, ${movie_poster})
        ON CONFLICT (user_id, movie_id) DO NOTHING
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Marqué comme vu' })
      };
    }

    // DELETE /watched/:id
    if (path.startsWith('/watched/') && method === 'DELETE') {
      const movieId = path.split('/')[2];
      
      await sql`
        DELETE FROM watched 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Retiré des films vus' })
      };
    }

    // ==================== RATINGS ====================
    
    // GET /ratings/:id
    if (path.startsWith('/ratings/') && method === 'GET') {
      const movieId = path.split('/')[2];
      
      const rating = await sql`
        SELECT rating FROM ratings 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(rating[0] || { rating: null })
      };
    }

    // POST /ratings
    if (path === '/ratings' && method === 'POST') {
      const { movie_id, rating } = JSON.parse(event.body);
      
      await sql`
        INSERT INTO ratings (user_id, movie_id, rating)
        VALUES (${user.userId}, ${movie_id}, ${rating})
        ON CONFLICT (user_id, movie_id) 
        DO UPDATE SET rating = ${rating}, updated_at = NOW()
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Note enregistrée' })
      };
    }

    // DELETE /ratings/:id
    if (path.startsWith('/ratings/') && method === 'DELETE') {
      const movieId = path.split('/')[2];
      
      await sql`
        DELETE FROM ratings 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Note supprimée' })
      };
    }

    // ==================== LIKES ====================
    
    // GET /likes/:id
    if (path.startsWith('/likes/') && path !== '/likes/all' && method === 'GET') {
      const movieId = path.split('/')[2];
      
      const like = await sql`
        SELECT id FROM likes 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ liked: like.length > 0 })
      };
    }

    // GET /likes/all
    if (path === '/likes/all' && method === 'GET') {
      const likes = await sql`
        SELECT movie_id, created_at 
        FROM likes 
        WHERE user_id = ${user.userId}
        ORDER BY created_at DESC
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(likes)
      };
    }

    // POST /likes
    if (path === '/likes' && method === 'POST') {
      const { movie_id } = JSON.parse(event.body);
      
      await sql`
        INSERT INTO likes (user_id, movie_id)
        VALUES (${user.userId}, ${movie_id})
        ON CONFLICT (user_id, movie_id) DO NOTHING
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Film liké' })
      };
    }

    // DELETE /likes/:id
    if (path.startsWith('/likes/') && method === 'DELETE') {
      const movieId = path.split('/')[2];
      
      await sql`
        DELETE FROM likes 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Like retiré' })
      };
    }

    // ==================== REVIEWS ====================
    
    // GET /reviews/:id
    if (path.startsWith('/reviews/') && method === 'GET') {
      const movieId = path.split('/')[2];
      
      const review = await sql`
        SELECT content, created_at 
        FROM reviews 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(review[0] || null)
      };
    }

    // POST /reviews
    if (path === '/reviews' && method === 'POST') {
      const { movie_id, content } = JSON.parse(event.body);
      
      await sql`
        INSERT INTO reviews (user_id, movie_id, content)
        VALUES (${user.userId}, ${movie_id}, ${content})
        ON CONFLICT (user_id, movie_id) 
        DO UPDATE SET content = ${content}, updated_at = NOW()
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Avis enregistré' })
      };
    }

    // DELETE /reviews/:id
    if (path.startsWith('/reviews/') && method === 'DELETE') {
      const movieId = path.split('/')[2];
      
      await sql`
        DELETE FROM reviews 
        WHERE user_id = ${user.userId} AND movie_id = ${movieId}
      `;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Avis supprimé' })
      };
    }

    // Route non trouvée
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route non trouvée' })
    };

  } catch (error) {
    console.error('Erreur serveur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur',
        details: error.message 
      })
    };
  }
};