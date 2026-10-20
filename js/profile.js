import { supabase } from './config.js'

export async function loadUserProfile(user) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, full_name, role, created_at')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        console.error("Erreur chargement profil:", error);
        document.getElementById('user-greeting').textContent = `Bonjour, Membre`;
        return null;
    }

    const displayName = profile.username || profile.full_name || 'Membre';
    document.getElementById('user-greeting').textContent = `Bonjour, ${displayName}`;

    // Remplir le modal ou la vue paramètres si elle existe
    const profileUsernameInput = document.getElementById('profile-username');
    const profileFullnameEl = document.getElementById('profile-fullname');
    const profileRoleEl = document.getElementById('profile-role');
    const profileCreatedEl = document.getElementById('profile-created');

    if (profileUsernameInput) profileUsernameInput.value = profile.username || '';
    if (profileFullnameEl) profileFullnameEl.textContent = profile.full_name || 'N/A';
    
    if (profileRoleEl) {
        const roleFormatted = profile.role === 'admin' ? 'Administrateur' : profile.role === 'tresorier' ? 'Trésorier' : 'Membre';
        profileRoleEl.textContent = roleFormatted;
    }

    if (profileCreatedEl && profile.created_at) {
        const dateFormatted = new Date(profile.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        profileCreatedEl.textContent = `Membre depuis le ${dateFormatted}`;
    }

    return profile;
}

// Gestion mise à jour du profil (pseudo)
document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const newUsername = document.getElementById('profile-username').value.trim();
            const feedbackEl = document.getElementById('profile-feedback');
            feedbackEl.classList.add('hidden');

            if (!newUsername) {
                feedbackEl.textContent = "Le pseudo ne peut pas être vide.";
                feedbackEl.className = "text-rose-400 text-sm";
                feedbackEl.classList.remove('hidden');
                return;
            }

            // Vérifier unicité
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', newUsername)
                .neq('id', session.user.id)
                .single();

            if (existing) {
                feedbackEl.textContent = "Ce pseudo est déjà utilisé par un autre membre.";
                feedbackEl.className = "text-rose-400 text-sm";
                feedbackEl.classList.remove('hidden');
                return;
            }

            const { error } = await supabase
                .from('profiles')
                .update({ username: newUsername })
                .eq('id', session.user.id);

            if (error) {
                feedbackEl.textContent = "Erreur lors de la mise à jour : " + error.message;
                feedbackEl.className = "text-rose-400 text-sm";
                feedbackEl.classList.remove('hidden');
            } else {
                feedbackEl.textContent = "Profil mis à jour avec succès !";
                feedbackEl.className = "text-emerald-400 text-sm";
                feedbackEl.classList.remove('hidden');
                document.getElementById('user-greeting').textContent = `Bonjour, ${newUsername}`;
            }
        });
    }
});
