// forgot-password.js - Système de réinitialisation de mot de passe

// ==================== MOT DE PASSE OUBLIÉ ====================

// Ajouter un lien "Mot de passe oublié" dans le modal d'authentification
function addForgotPasswordLink() {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    
    // Vérifier si le lien existe déjà
    if (document.getElementById('forgotPasswordLink')) return;
    
    // Ne l'ajouter que si on est en mode login
    // Vérifier si le champ username est caché (= mode login)
    const usernameGroup = document.getElementById('usernameGroup');
    if (usernameGroup && usernameGroup.style.display !== 'none') {
        return; // On est en mode register, ne pas ajouter le lien
    }
    
    const authFormContainer = document.getElementById('authFormContainer');
    if (!authFormContainer) return;
    
    // Créer le lien
    const linkContainer = document.createElement('div');
    linkContainer.id = 'forgotPasswordLinkContainer';
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
        transition: all 0.3s;
    `;
    
    forgotLink.onmouseover = () => {
        forgotLink.style.textDecoration = 'underline';
        forgotLink.style.opacity = '0.8';
    };
    
    forgotLink.onmouseout = () => {
        forgotLink.style.textDecoration = 'none';
        forgotLink.style.opacity = '1';
    };
    
    forgotLink.onclick = (e) => {
        e.preventDefault();
        openForgotPasswordModal();
    };
    
    linkContainer.appendChild(forgotLink);
    
    // Insérer après le bouton submit
    const submitBtn = document.getElementById('authSubmitBtn');
    if (submitBtn) {
        submitBtn.parentNode.insertBefore(linkContainer, submitBtn.nextSibling);
    }
}

// Ouvrir le modal de mot de passe oublié
function openForgotPasswordModal() {
    // Fermer le modal d'auth actuel
    document.getElementById('authModal').classList.remove('active');
    // Créer ou afficher le modal de réinitialisation
    let forgotModal = document.getElementById('forgotPasswordModal');
    if (!forgotModal) {
        forgotModal = createForgotPasswordModal();
        document.body.appendChild(forgotModal);
    }
    // Reset le formulaire
    document.getElementById('forgotEmail').value = '';
    document.getElementById('forgotError').style.display = 'none';
    document.getElementById('forgotSuccess').style.display = 'none';
    forgotModal.classList.add('active');
}

function openForgotPasswordModalprofile() {
    // Fermer le modal d'auth actuel
    document.getElementById('authModal').classList.remove('active');
    // Créer ou afficher le modal de réinitialisation
    let forgotModal = document.getElementById('forgotPasswordModal');
    if (!forgotModal) {
        forgotModal = createForgotPasswordModal();
        document.body.appendChild(forgotModal);
    }
    // Reset le formulaire
    document.getElementById('forgotEmail').value = profileData.user.email || '';
    document.getElementById('forgotError').style.display = 'none';
    document.getElementById('forgotSuccess').style.display = 'none';
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
                <div id="forgotSuccess" style="display: none; padding: 12px; background: rgba(16, 185, 129, 0.2); color: #10b981; border-radius: 8px; margin-bottom: 16px; font-size: 14px; border: 1px solid rgba(16, 185, 129, 0.3);"></div>
                
                <button class="btn btn-full" onclick="sendPasswordResetEmail()" id="forgotSubmitBtn">
                    Envoyer le lien
                </button>
                
                <div style="text-align: center; margin-top: 16px;">
                    <a href="#" onclick="backToLogin(event)" style="color: var(--primary); font-size: 14px; text-decoration: none;">
                        ← Retour à la connexion
                    </a>
                </div>
            </div>
        </div>
    `;
    
    // Fermer au clic extérieur
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
    const submitBtn = document.getElementById('forgotSubmitBtn');
    
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
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours...';
        
        const response = await apiRequest('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        
        if (response && !response.error) {
            // Afficher le message de succès
            successDiv.innerHTML = `
                <strong>✓ Email envoyé !</strong><br>
                Si un compte existe avec <strong>${email}</strong>, un lien de réinitialisation a été envoyé.<br>
                Vérifiez votre boîte de réception (ET VOS SPAMS).
            `;
            successDiv.style.display = 'block';
            
            // Vider le champ email
            document.getElementById('forgotEmail').value = '';
            
            // Mode DEV: Afficher le lien directement
            if (response.devMode && response.resetLink) {
                console.log('🔗 Lien de reset (DEV):', response.resetLink);
                
                const devLink = document.createElement('div');
                devLink.style.cssText = `
                    margin-top: 16px;
                    padding: 12px;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 8px;
                    font-size: 12px;
                `;
                devLink.innerHTML = `
                    <strong style="color: var(--primary);">🔧 Mode DEV</strong><br>
                    <a href="${response.resetLink}" style="color: var(--primary); word-break: break-all;">
                        ${response.resetLink}
                    </a>
                `;
                successDiv.appendChild(devLink);
            }
        } else {
            errorDiv.textContent = response?.error || 'Erreur lors de l\'envoi';
            errorDiv.style.display = 'block';
        }
        
    } catch (error) {
        console.error(error);
        errorDiv.textContent = 'Erreur de connexion au serveur';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer le lien';
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

// ==================== PAGE DE RÉINITIALISATION ====================

// Vérifier si on est sur une page de reset (avec token dans l'URL)
function checkResetToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        openResetPasswordModal(token);
    }
}

// Créer le modal de changement de mot de passe (avec token)
function openResetPasswordModal(token) {
    let resetModal = document.getElementById('resetPasswordModal');
    
    if (!resetModal) {
        resetModal = document.createElement('div');
        resetModal.id = 'resetPasswordModal';
        resetModal.className = 'modal active';
        
        resetModal.innerHTML = `
            <div class="modal-content">
                <h2>Nouveau mot de passe</h2>
                
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Choisissez un nouveau mot de passe sécurisé.
                </p>
                
                <div class="form-group">
                    <label for="newPassword">Nouveau mot de passe</label>
                    <input type="password" id="newPassword" placeholder="Minimum 6 caractères" minlength="6">
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword">Confirmer le mot de passe</label>
                    <input type="password" id="confirmPassword" placeholder="Retapez votre mot de passe">
                </div>
                
                <div id="resetError" class="error" style="display: none;"></div>
                <div id="resetSuccess" style="display: none; padding: 12px; background: rgba(16, 185, 129, 0.2); color: #10b981; border-radius: 8px; margin-bottom: 16px; font-size: 14px; border: 1px solid rgba(16, 185, 129, 0.3);"></div>
                
                <button class="btn btn-full" onclick="submitPasswordReset('${token}')" id="resetSubmitBtn">
                    Réinitialiser le mot de passe
                </button>
            </div>
        `;
        
        document.body.appendChild(resetModal);
    } else {
        resetModal.classList.add('active');
    }
}

// Soumettre le nouveau mot de passe
async function submitPasswordReset(token) {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('resetError');
    const successDiv = document.getElementById('resetSuccess');
    const submitBtn = document.getElementById('resetSubmitBtn');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (!newPassword || !confirmPassword) {
        errorDiv.textContent = 'Veuillez remplir tous les champs';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Les mots de passe ne correspondent pas';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Réinitialisation...';
        
        const response = await apiRequest('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword })
        });
        
        if (response && !response.error) {
            successDiv.innerHTML = `
                <strong>✓ Mot de passe réinitialisé !</strong><br>
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
            `;
            successDiv.style.display = 'block';
            
            // Rediriger vers login après 2s
            setTimeout(() => {
                document.getElementById('resetPasswordModal').remove();
                window.history.replaceState({}, document.title, window.location.pathname);
                openAuthModal(true);
            }, 2000);
        } else {
            errorDiv.textContent = response?.error || 'Erreur lors de la réinitialisation';
            errorDiv.style.display = 'block';
        }
        
    } catch (error) {
        console.error(error);
        errorDiv.textContent = 'Erreur de connexion au serveur';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Réinitialiser le mot de passe';
    }
}

// ==================== CHANGEMENT DE MOT DE PASSE DANS LE PROFIL ====================

// Fonction appelée depuis profile.js
window.editPassword = function() {
    openChangePasswordModal();
};

function openChangePasswordModal() {
    let changeModal = document.getElementById('changePasswordModal');
    
    if (!changeModal) {
        changeModal = document.createElement('div');
        changeModal.id = 'changePasswordModal';
        changeModal.className = 'modal';
        
        changeModal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal" onclick="closeChangePasswordModal()">×</button>
                <h2>Changer le mot de passe</h2>
                
                <div class="form-group">
                    <label for="currentPasswordChange">Mot de passe actuel</label>
                    <input type="password" id="currentPasswordChange" placeholder="Votre mot de passe actuel">
                </div>
                
                <div class="form-group">
                    <label for="newPasswordChange">Nouveau mot de passe</label>
                    <input type="password" id="newPasswordChange" placeholder="Minimum 6 caractères" minlength="6">
                </div>
                
                <div class="form-group">
                    <label for="confirmPasswordChange">Confirmer le nouveau mot de passe</label>
                    <input type="password" id="confirmPasswordChange" placeholder="Retapez votre mot de passe">
                </div>
                
                <div id="changePasswordError" class="error" style="display: none;"></div>
                
                <button class="btn btn-full" onclick="submitPasswordChange()" id="changePasswordBtn">
                    Changer le mot de passe
                </button>
            </div>
        `;
        
        changeModal.onclick = (e) => {
            if (e.target === changeModal) {
                closeChangePasswordModal();
            }
        };
        
        document.body.appendChild(changeModal);
    }
    
    // Reset
    document.getElementById('currentPasswordChange').value = '';
    document.getElementById('newPasswordChange').value = '';
    document.getElementById('confirmPasswordChange').value = '';
    document.getElementById('changePasswordError').style.display = 'none';
    
    changeModal.classList.add('active');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function submitPasswordChange() {
    const currentPassword = document.getElementById('currentPasswordChange').value;
    const newPassword = document.getElementById('newPasswordChange').value;
    const confirmPassword = document.getElementById('confirmPasswordChange').value;
    const errorDiv = document.getElementById('changePasswordError');
    const submitBtn = document.getElementById('changePasswordBtn');
    
    errorDiv.style.display = 'none';
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        errorDiv.textContent = 'Veuillez remplir tous les champs';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Le nouveau mot de passe doit contenir au moins 6 caractères';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Les nouveaux mots de passe ne correspondent pas';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (currentPassword === newPassword) {
        errorDiv.textContent = 'Le nouveau mot de passe doit être différent de l\'ancien';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Changement en cours...';
        
        const response = await apiRequest('/profile/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        if (response && !response.error) {
            showToast('Mot de passe changé avec succès !');
            closeChangePasswordModal();
        } else {
            errorDiv.textContent = response?.error || 'Erreur lors du changement';
            errorDiv.style.display = 'block';
        }
        
    } catch (error) {
        console.error(error);
        errorDiv.textContent = 'Erreur de connexion au serveur';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Changer le mot de passe';
    }
}

// ==================== INITIALISATION ====================

// Ajouter le lien au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si on a un token de reset dans l'URL
    checkResetToken();
    
    // Observer les changements du modal d'auth pour ajouter le lien
    const observer = new MutationObserver(() => {
        const authModal = document.getElementById('authModal');
        const usernameGroup = document.getElementById('usernameGroup');
        
        // Ajouter le lien seulement si le modal est actif ET qu'on est en mode login
        if (authModal && authModal.classList.contains('active') && 
            usernameGroup && usernameGroup.style.display === 'none') {
            addForgotPasswordLink();
        } else {
            // Retirer le lien si on passe en mode register
            const linkContainer = document.getElementById('forgotPasswordLinkContainer');
            if (linkContainer) {
                linkContainer.remove();
            }
        }
    });
    
    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style']
    });
});