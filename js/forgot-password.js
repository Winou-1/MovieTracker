function addForgotPasswordLink() {
    const authForm = document.getElementById('authForm');
    if (!authForm) return;
    if (document.getElementById('forgotPasswordLink')) return;
    const linkContainer = document.createElement('div');
    linkContainer.style.cssText = `
        text-align: center;
        margin-top: 16px;
    `;
    
    const forgotLink = document.createElement('a');
    forgotLink.id = 'forgotPasswordLink';
    forgotLink.href = '#';
    forgotLink.textContent = 'Mot de passe oublié ?';
    forgotLink.style.cssText = `
        color: var(--primary);
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        transition: color 0.3s;
    `;
    
    forgotLink.onmouseover = () => {
        forgotLink.style.textDecoration = 'underline';
    };
    
    forgotLink.onmouseout = () => {
        forgotLink.style.textDecoration = 'none';
    };
    
    forgotLink.onclick = (e) => {
        e.preventDefault();
        openForgotPasswordModal();
    };
    
    linkContainer.appendChild(forgotLink);
    const submitBtn = authForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.parentNode.insertBefore(linkContainer, submitBtn.nextSibling);
    }
}

// Ouvrir le modal de mot de passe oublié
function openForgotPasswordModal() {
    document.getElementById('authModal').classList.remove('active');
    let forgotModal = document.getElementById('forgotPasswordModal');
    
    if (!forgotModal) {
        forgotModal = createForgotPasswordModal();
        document.body.appendChild(forgotModal);
    }
    
    forgotModal.classList.add('active');
}

// Créer le modal de mot de passe oublié
function createForgotPasswordModal() {
    const modal = document.createElement('div');
    modal.id = 'forgotPasswordModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal" onclick="closeForgotPasswordModal()">×</button>
            <h2>Réinitialiser le mot de passe</h2>
            
            <div id="forgotPasswordContent">
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>
                
                <div class="form-group">
                    <label for="forgotEmail">Email</label>
                    <input type="email" id="forgotEmail" placeholder="ton@email.com">
                </div>
                
                <div id="forgotError" class="error" style="display: none;"></div>
                <div id="forgotSuccess" style="display: none; padding: 12px; background: #d4edda; color: #155724; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>
                
                <button class="btn btn-full" onclick="sendPasswordResetEmail()">
                    Envoyer le lien
                </button>
                
                <div style="text-align: center; margin-top: 16px;">
                    <a href="#" onclick="backToLogin(event)" style="color: var(--primary); font-size: 14px; text-decoration: none;">
                        Retour à la connexion
                    </a>
                </div>
            </div>
        </div>
    `;
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeForgotPasswordModal();
        }
    };
    
    return modal;
}

// Envoyer l'email de réinitialisation
async function sendPasswordResetEmail() {
    const email = document.getElementById('forgotEmail').value.trim();
    const errorDiv = document.getElementById('forgotError');
    const successDiv = document.getElementById('forgotSuccess');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (!email) {
        errorDiv.textContent = 'Veuillez entrer votre email';
        errorDiv.style.display = 'block';
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorDiv.textContent = 'Email invalide';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        // SIMULATION : Dans la vraie version, appeler l'API
        // const response = await apiRequest('/auth/forgot-password', {
        //     method: 'POST',
        //     body: JSON.stringify({ email })
        // });
        // Simuler un délai
        await new Promise(resolve => setTimeout(resolve, 1500));
        successDiv.innerHTML = `
            <strong>✓ Email envoyé !</strong><br>
            Un lien de réinitialisation a été envoyé à <strong>${email}</strong>.<br>
            Vérifiez votre boîte de réception (et vos spams).
        `;
        successDiv.style.display = 'block';
        document.getElementById('forgotEmail').value = '';
        
    } catch (error) {
        errorDiv.textContent = error.message || 'Erreur lors de l\'envoi de l\'email';
        errorDiv.style.display = 'block';
    }
}

// Fermer le modal de mot de passe oublié
window.closeForgotPasswordModal = function() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

// Retour à la connexion
window.backToLogin = function(e) {
    e.preventDefault();
    closeForgotPasswordModal();
    openAuthModal(true);
};

// Ajouter le lien au chargement
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
        const authModal = document.getElementById('authModal');
        if (authModal && authModal.classList.contains('active')) {
            addForgotPasswordLink();
        }
    });
    
    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });
    addForgotPasswordLink();
});

// ==================== BACKEND ROUTE (À ajouter dans server.js) ====================
/*
// Route pour demander la réinitialisation du mot de passe
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    // Vérifier si l'utilisateur existe
    db.get('SELECT id, email, username FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        // Pour des raisons de sécurité, on renvoie toujours un message de succès
        // même si l'email n'existe pas
        if (!user) {
            return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
        }

        // Générer un token de réinitialisation
        const resetToken = jwt.sign(
            { userId: user.id, purpose: 'reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Sauvegarder le token en DB (créer une table reset_tokens si nécessaire)
        db.run(
            'INSERT OR REPLACE INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+1 hour"))',
            [user.id, resetToken],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Erreur serveur' });
                }

                // IMPORTANT : Envoyer l'email avec le lien
                // const resetLink = `https://votre-domaine.com/reset-password?token=${resetToken}`;
                // sendEmail(user.email, 'Réinitialisation de mot de passe', resetLink);

                res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
            }
        );
    });
});

// Route pour réinitialiser le mot de passe
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    try {
        // Vérifier le token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.purpose !== 'reset') {
            return res.status(400).json({ error: 'Token invalide' });
        }

        // Vérifier que le token existe en DB et n'a pas expiré
        db.get(
            'SELECT * FROM reset_tokens WHERE user_id = ? AND token = ? AND expires_at > datetime("now")',
            [decoded.userId, token],
            async (err, resetToken) => {
                if (err || !resetToken) {
                    return res.status(400).json({ error: 'Token invalide ou expiré' });
                }

                // Hasher le nouveau mot de passe
                const hashedPassword = await bcrypt.hash(newPassword, 10);

                // Mettre à jour le mot de passe
                db.run(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hashedPassword, decoded.userId],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Erreur serveur' });
                        }

                        // Supprimer le token utilisé
                        db.run('DELETE FROM reset_tokens WHERE token = ?', [token]);

                        res.json({ message: 'Mot de passe réinitialisé avec succès' });
                    }
                );
            }
        );
    } catch (error) {
        return res.status(400).json({ error: 'Token invalide ou expiré' });
    }
});
*/