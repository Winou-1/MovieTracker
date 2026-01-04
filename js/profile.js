async function loadProfile() {
    if (!getToken()) return;

    // ✅ Charger le profil depuis la base de données
    const profileData = await apiRequest('/profile');
    
    if (profileData) {
        state.user = profileData;
        state.userProfile.username = profileData.username;
        state.userProfile.email = profileData.email;
        state.userProfile.avatar = profileData.avatar;
    }

    // Afficher l'avatar
    const avatarImg = document.getElementById('profileAvatar');
    if (state.userProfile.avatar) {
        avatarImg.src = state.userProfile.avatar;
    } else {
        avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%233b82f6'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='white' font-size='40' font-family='Arial'%3E👤%3C/text%3E%3C/svg%3E";
    }

    // Afficher les infos
    document.getElementById('profileUsername').textContent = state.userProfile.username;
    document.getElementById('profileEmail').textContent = state.userProfile.email;

    // Charger les stats
    await loadUserData();

    // Charger les genres favoris
    await loadFavoriteGenres();
}

async function loadFavoriteGenres() {
    const watched = await apiRequest('/watched');
    if (!watched || watched.length === 0) {
        document.getElementById('genreList').innerHTML = '<p>Regarde des films pour voir tes genres préférés</p>';
        return;
    }

    const genreCount = {};
    
    for (const movie of watched.slice(0, 20)) {
        try {
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/movie/${movie.movie_id}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
            );
            const data = await response.json();
            
            if (data.genres) {
                data.genres.forEach(genre => {
                    genreCount[genre.name] = (genreCount[genre.name] || 0) + 1;
                });
            }
        } catch (e) {
            console.error('Erreur chargement genre:', e);
        }
    }

    const sortedGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const genreList = document.getElementById('genreList');
    genreList.innerHTML = sortedGenres.map(([genre, count]) => `
        <div class="genre-tag">
            ${genre} <span class="genre-count">${count}</span>
        </div>
    `).join('');
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!getToken()) {
        showToast('Connecte-toi pour changer ton avatar', 'error');
        return;
    }

    // Vérifier la taille du fichier (max 500KB)
    if (file.size > 500000) {
        showToast('Image trop volumineuse (max 500KB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const avatar = event.target.result;
        
        // ✅ Envoyer l'avatar à la base de données
        const result = await apiRequest('/profile/avatar', {
            method: 'PUT',
            body: JSON.stringify({ avatar })
        });

        if (result && result.user) {
            // ✅ Mettre à jour le state
            state.userProfile.avatar = result.user.avatar;
            
            // ✅ Mettre à jour l'affichage du profil
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                profileAvatar.src = result.user.avatar;
            }
            
            // ✅ Mettre à jour l'avatar dans le header
            updateHeaderAvatar();
            
            showToast('Avatar mis à jour');
        } else {
            showToast('Erreur lors de la mise à jour', 'error');
        }
    };
    
    reader.readAsDataURL(file);
}

async function editUsername() {
    const newUsername = prompt('Nouveau pseudo:', state.userProfile.username);
    if (!newUsername || !newUsername.trim()) return;

    // ✅ Envoyer le nouveau username à la base de données
    const result = await apiRequest('/profile/username', {
        method: 'PUT',
        body: JSON.stringify({ username: newUsername.trim() })
    });

    if (result && result.user) {
        state.userProfile.username = result.user.username;
        document.getElementById('profileUsername').textContent = result.user.username;
        document.getElementById('usernameDisplay').textContent = result.user.username;
        showToast('Pseudo mis à jour');
    } else {
        showToast('Erreur lors de la mise à jour', 'error');
    }
}