import { supabase } from './config.js'

export async function initAdminPanel(currentUser) {
    // Vérifier si l'utilisateur est admin
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        // Masquer l'onglet admin si non admin
        const navAdmin = document.getElementById('nav-admin');
        if (navAdmin) navAdmin.classList.add('hidden');
        return;
    }

    // Afficher l'onglet admin
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.classList.remove('hidden');

    loadAdminUsers();
}

async function loadAdminUsers() {
    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('admin-users-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (error || !users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">Aucun utilisateur trouvé.</td></tr>`;
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";
        tr.innerHTML = `
            <td class="p-4 font-medium text-white">${escapeHTML(u.username || 'Sans pseudo')}</td>
            <td class="p-4 text-slate-300">${escapeHTML(u.full_name || 'N/A')}</td>
            <td class="p-4">
                <select onchange="window.updateUserRole('${u.id}', this.value)" class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
                    <option value="membre" ${u.role === 'membre' ? 'selected' : ''}>Membre</option>
                    <option value="tresorier" ${u.role === 'tresorier' ? 'selected' : ''}>Trésorier</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrateur</option>
                </select>
            </td>
            <td class="p-4 text-xs text-slate-400">${u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateUserRole = async function(userId, newRole) {
    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

    if (error) {
        alert('Erreur lors de la mise à jour du rôle : ' + error.message);
    } else {
        // Notification discrète ou simple log
        console.log(`Rôle mis à jour avec succès pour l'utilisateur ${userId} -> ${newRole}`);
    }
};

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
