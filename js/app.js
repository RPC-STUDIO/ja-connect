import { supabase } from './supabaseClient.js'

let currentUser = null;
let currentProfile = null;
let budgetChartInstance = null;
let activeGroupId = null;
let currentChatSubscription = null;

// État de l'attachement en cours de rédaction
let currentAttachment = { type: null, id: null, data: null };

// Vérification de la session utilisateur au chargement
async function initSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;
    
    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        currentProfile = profile;
        document.getElementById('user-greeting').textContent = `Bonjour, ${profile.full_name} (${profile.role})`;
    }

    // Charger les données initiales
    loadEvents();
    loadTransactions();
    loadGroups();
}

// Gestion de la déconnexion
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// --- GESTION DES ÉVÉNEMENTS ---
async function loadEvents() {
    const { data: events, error } = await supabase
        .from('events')
        .select('*, profiles(full_name)')
        .order('event_date', { ascending: true });

    const grid = document.getElementById('events-grid');
    grid.innerHTML = '';

    if (error || !events || events.length === 0) {
        grid.innerHTML = `<p class="text-slate-500 col-span-full text-center py-8">Aucun événement à venir pour le moment.</p>`;
        return;
    }

    events.forEach(ev => {
        const dateFormatted = new Date(ev.event_date).toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-lg";
        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">Sortie JAD</span>
                    <span class="text-xs text-slate-500">${dateFormatted}</span>
                </div>
                <h3 class="text-lg font-bold text-white mb-1">${escapeHTML(ev.title)}</h3>
                <p class="text-sm text-slate-400 mb-4">${escapeHTML(ev.description || 'Aucune description.')}</p>
            </div>
            <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>📍 ${escapeHTML(ev.location || 'Lieu non spécifié')}</span>
                <span>Proposé par : ${ev.profiles?.full_name || 'Membre'}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Soumission du formulaire d'événement
document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ev-title').value;
    const description = document.getElementById('ev-desc').value;
    const event_date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-location').value;

    const { error } = await supabase.from('events').insert([{
        title, description, event_date, location, created_by: currentUser.id
    }]);

    if (error) {
        alert('Erreur lors de la création : ' + error.message);
    } else {
        document.getElementById('event-form').reset();
        closeModal('event-modal');
        loadEvents();
    }
});


// --- GESTION DES FINANCES & CAISSE ---
async function loadTransactions() {
    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*, profiles(full_name)')
        .order('transaction_date', { ascending: false });

    const tbody = document.getElementById('transactions-list');
    tbody.innerHTML = '';

    if (error || !txs) return;

    let totalBalance = 0;
    let chartDates = [];
    let chartTotals = [];
    let runningTotal = 0;

    const sortedTxs = [...txs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

    sortedTxs.forEach(tx => {
        const amount = Number(tx.amount);
        const isExpense = tx.type === 'depense';
        const realAmount = isExpense ? -Math.abs(amount) : Math.abs(amount);
        
        totalBalance += realAmount;
        runningTotal += realAmount;

        chartDates.push(new Date(tx.transaction_date).toLocaleDateString('fr-FR'));
        chartTotals.push(runningTotal);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";
        tr.innerHTML = `
            <td class="p-4 text-slate-400">${tx.transaction_date}</td>
            <td class="p-4 font-medium text-white">${escapeHTML(tx.title)}</td>
            <td class="p-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${
                    tx.type === 'recette' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    tx.type === 'cotisation' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }">${tx.type}</span>
            </td>
            <td class="p-4 text-right font-bold ${isExpense ? 'text-rose-400' : 'text-emerald-400'}">
                ${isExpense ? '-' : '+'}${Math.abs(amount).toFixed(2)} €
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-balance').textContent = `${totalBalance.toFixed(2)} €`;
    updateBudgetChart(chartDates, chartTotals);
}

// Soumission d'une transaction
document.getElementById('finance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('tx-title').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const type = document.getElementById('tx-type').value;

    const { error } = await supabase.from('transactions').insert([{
        title, amount, type, created_by: currentUser.id
    }]);

    if (error) {
        alert('Erreur : ' + error.message);
    } else {
        document.getElementById('finance-form').reset();
        closeModal('finance-modal');
        loadTransactions();
    }
});

// Graphique Chart.js du solde de caisse
function updateBudgetChart(labels, data) {
    const ctx = document.getElementById('budgetChart').getContext('2d');
    
    if (budgetChartInstance) {
        budgetChartInstance.destroy();
    }

    budgetChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Évolution du Solde (€)',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}


// --- MODULE MESSAGERIE & GROUPES ---

async function loadGroups() {
    // Récupérer les groupes dont l'utilisateur est membre (ou tous si politique le permet, filtrons via group_members)
    const { data: memberships, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', currentUser.id);

    const groupsListEl = document.getElementById('groups-list');
    groupsListEl.innerHTML = '';

    if (error || !memberships || memberships.length === 0) {
        groupsListEl.innerHTML = `<p class="text-xs text-slate-500 p-2">Aucun groupe. Créez-en un ou demandez à y être invité.</p>`;
        return;
    }

    memberships.forEach(m => {
        const group = m.groups;
        if (!group) return;

        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = `w-full text-left p-3 rounded-xl transition flex flex-col space-y-1 ${activeGroupId === group.id ? 'bg-indigo-600/20 border border-indigo-500/50 text-white' : 'hover:bg-slate-800 text-slate-300'}`;
        btn.onclick = () => selectGroup(group);
        btn.innerHTML = `
            <div class="font-semibold text-sm"># ${escapeHTML(group.name)}</div>
            <div class="text-xs text-slate-400 truncate">${escapeHTML(group.description || 'Canal de discussion')}</div>
        `;
        groupsListEl.appendChild(btn);
    });

    // Sélectionner automatiquement le premier groupe si aucun n'est actif
    if (!activeGroupId && memberships.length > 0) {
        selectGroup(memberships[0].groups);
    }
}

async function selectGroup(group) {
    activeGroupId = group.id;
    document.getElementById('active-group-name').textContent = `# ${group.name}`;
    document.getElementById('active-group-desc').textContent = group.description || 'Canal de discussion JA-Connect';
    document.getElementById('manage-members-btn').classList.remove('hidden');

    loadGroups(); // Rafraîchir l'UI active
    loadMessages(group.id);
    loadGroupMembers(group.id);
    subscribeToMessages(group.id);
}

// Création de groupe
document.getElementById('group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('grp-name').value;
    const description = document.getElementById('grp-desc').value;

    const { data: newGroup, error } = await supabase
        .from('groups')
        .insert([{ name, description, created_by: currentUser.id }])
        .select()
        .single();

    if (error) {
        alert('Erreur création groupe : ' + error.message);
        return;
    }

    // Ajouter automatiquement le créateur comme membre du groupe
    await supabase.from('group_members').insert([{
        group_id: newGroup.id,
        user_id: currentUser.id
    }]);

    document.getElementById('group-form').reset();
    closeModal('group-modal');
    loadGroups();
    selectGroup(newGroup);
});

async function loadGroupMembers(groupId) {
    const { data: members, error } = await supabase
        .from('group_members')
        .select('*, profiles(id, full_name, role)')
        .eq('group_id', groupId);

    const listEl = document.getElementById('current-members-list');
    listEl.innerHTML = '';

    if (error || !members) return;

    members.forEach(m => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-sm";
        div.innerHTML = `
            <div>
                <span class="font-medium text-white">${escapeHTML(m.profiles?.full_name || 'Utilisateur')}</span>
                <span class="text-xs text-indigo-400 ml-2">(${m.profiles?.role})</span>
            </div>
            ${m.user_id !== currentUser.id ? `<button onclick="removeMember('${groupId}', '${m.user_id}')" class="text-xs text-rose-400 hover:text-rose-300">Retirer</button>` : '<span class="text-xs text-slate-500">Vous</span>'}
        `;
        listEl.appendChild(div);
    });

    // Charger aussi la liste des profils disponibles pour l'ajout
    const { data: allProfiles } = await supabase.from('profiles').select('id, full_name');
    const selectEl = document.getElementById('add-member-select');
    selectEl.innerHTML = '';

    const existingMemberIds = members.map(m => m.user_id);
    const availableProfiles = (allProfiles || []).filter(p => !existingMemberIds.includes(p.id));

    if (availableProfiles.length === 0) {
        selectEl.innerHTML = `<option value="">Tous les membres ont été ajoutés</option>`;
    } else {
        availableProfiles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.full_name;
            selectEl.appendChild(opt);
        });
    }
}

window.addMemberToGroup = async function() {
    const userId = document.getElementById('add-member-select').value;
    if (!userId || !activeGroupId) return;

    const { error } = await supabase.from('group_members').insert([{
        group_id: activeGroupId,
        user_id: userId
    }]);

    if (error) {
        alert('Erreur : ' + error.message);
    } else {
        loadGroupMembers(activeGroupId);
    }
};

window.removeMember = async function(groupId, userId) {
    const { error } = await supabase.from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) {
        alert('Erreur : ' + error.message);
    } else {
        loadGroupMembers(groupId);
    }
};


// --- CHARGEMENT & TEMPS RÉEL DES MESSAGES ---

async function loadMessages(groupId) {
    const { data: messages, error } = await supabase
        .from('messages')
        .select(`
            *,
            profiles(full_name, role),
            events(id, title, event_date, location, description),
            transactions(id, title, amount, type, transaction_date)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    if (error || !messages || messages.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 my-auto">Aucun message dans ce canal. Envoyez le premier !</div>`;
        return;
    }

    messages.forEach(msg => appendMessageElement(msg));
    container.scrollTop = container.scrollHeight;
}

function subscribeToMessages(groupId) {
    if (currentChatSubscription) {
        supabase.removeChannel(currentChatSubscription);
    }

    currentChatSubscription = supabase
        .channel(`public:messages:group_id=eq.${groupId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `group_id=eq.${groupId}`
        }, async (payload) => {
            // Récupérer le message complet avec les relations jointes
            const { data: fullMsg } = await supabase
                .from('messages')
                .select(`
                    *,
                    profiles(full_name, role),
                    events(id, title, event_date, location, description),
                    transactions(id, title, amount, type, transaction_date)
                `)
                .eq('id', payload.new.id)
                .single();

            if (fullMsg) {
                appendMessageElement(fullMsg);
                const container = document.getElementById('messages-container');
                container.scrollTop = container.scrollHeight;
            }
        })
        .subscribe();
}

function appendMessageElement(msg) {
    const container = document.getElementById('messages-container');
    // Supprimer le message d'aide initial s'il est présent
    if (container.querySelector('.text-slate-500')) {
        container.innerHTML = '';
    }

    const isMe = msg.user_id === currentUser.id;
    const authorName = msg.profiles?.full_name || 'Utilisateur';
    const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const timeStr = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const wrapper = document.createElement('div');
    wrapper.className = `flex items-start space-x-3 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`;

    let attachmentHTML = '';
    if (msg.events) {
        const ev = msg.events;
        const evDate = new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        attachmentHTML = `
            <div class="mt-2 p-3 bg-indigo-950/60 border border-indigo-500/30 rounded-xl space-y-1">
                <div class="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase">
                    <span>📅 Événement partagé</span>
                </div>
                <div class="font-bold text-white text-sm">${escapeHTML(ev.title)}</div>
                <div class="text-xs text-slate-300">📍 ${escapeHTML(ev.location || 'Lieu non spécifié')} • 🕒 ${evDate}</div>
            </div>
        `;
    } else if (msg.transactions) {
        const tx = msg.transactions;
        const isExp = tx.type === 'depense';
        attachmentHTML = `
            <div class="mt-2 p-3 bg-slate-950 border border-slate-700 rounded-xl space-y-1">
                <div class="flex items-center space-x-2 text-xs font-bold uppercase text-slate-400">
                    <span>💰 Transaction de caisse</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="font-bold text-white text-sm">${escapeHTML(tx.title)}</span>
                    <span class="font-extrabold ${isExp ? 'text-rose-400' : 'text-emerald-400'}">${isExp ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)} €</span>
                </div>
                <div class="text-xs text-slate-400">Type : ${tx.type} • ${tx.transaction_date}</div>
            </div>
        `;
    }

    wrapper.innerHTML = `
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md">
            ${initials}
        </div>
        <div class="max-w-md lg:max-w-lg">
            <div class="flex items-center space-x-2 mb-1 ${isMe ? 'justify-end' : ''}">
                <span class="text-xs font-semibold text-slate-300">${escapeHTML(authorName)}</span>
                <span class="text-[10px] text-slate-500">${timeStr}</span>
            </div>
            <div class="p-3.5 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-none'}">
                ${msg.content ? `<div>${escapeHTML(msg.content)}</div>` : ''}
                ${attachmentHTML}
            </div>
        </div>
    `;

    container.appendChild(wrapper);
}

// Envoi d'un message
document.getElementById('message-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeGroupId) return;

    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content && !currentAttachment.id) return;

    const payload = {
        group_id: activeGroupId,
        user_id: currentUser.id,
        content: content || null,
        event_id: currentAttachment.type === 'event' ? currentAttachment.id : null,
        transaction_id: currentAttachment.type === 'transaction' ? currentAttachment.id : null
    };

    const { error } = await supabase.from('messages').insert([payload]);

    if (error) {
        alert('Erreur envoi message : ' + error.message);
    } else {
        input.value = '';
        clearAttachment();
    }
});


// --- SÉLECTION D'ATTACHEMENT (ÉVÉNEMENT / TRANSACTION) ---

window.openAttachSelector = async function(type) {
    // Fermer le menu déroulant
    document.getElementById('attach-menu').classList.add('hidden');
    
    const modalTitle = document.getElementById('attach-modal-title');
    const listEl = document.getElementById('attach-selector-list');
    listEl.innerHTML = '<div class="text-center text-slate-500 py-4">Chargement...</div>';
    openModal('attach-selector-modal');

    if (type === 'event') {
        modalTitle.textContent = "Sélectionner un événement à attacher";
        const { data: events } = await supabase.from('events').select('*').order('event_date', { ascending: true });
        
        listEl.innerHTML = '';
        if (!events || events.length === 0) {
            listEl.innerHTML = `<p class="text-slate-500 text-center py-4">Aucun événement disponible.</p>`;
            return;
        }

        events.forEach(ev => {
            const item = document.createElement('div');
            item.className = "bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-indigo-500 cursor-pointer transition flex items-center justify-between";
            item.onclick = () => selectAttachment('event', ev);
            item.innerHTML = `
                <div>
                    <div class="font-bold text-white text-sm">${escapeHTML(ev.title)}</div>
                    <div class="text-xs text-slate-400">📅 ${new Date(ev.event_date).toLocaleDateString('fr-FR')} • 📍 ${escapeHTML(ev.location || 'N/A')}</div>
                </div>
                <button type="button" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold rounded-lg">Sélectionner</button>
            `;
            listEl.appendChild(item);
        });

    } else if (type === 'transaction') {
        modalTitle.textContent = "Sélectionner une transaction à attacher";
        const { data: txs } = await supabase.from('transactions').select('*').order('transaction_date', { ascending: false });

        listEl.innerHTML = '';
        if (!txs || txs.length === 0) {
            listEl.innerHTML = `<p class="text-slate-500 text-center py-4">Aucune transaction disponible.</p>`;
            return;
        }

        txs.forEach(tx => {
            const isExp = tx.type === 'depense';
            const item = document.createElement('div');
            item.className = "bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-emerald-500 cursor-pointer transition flex items-center justify-between";
            item.onclick = () => selectAttachment('transaction', tx);
            item.innerHTML = `
                <div>
                    <div class="font-bold text-white text-sm">${escapeHTML(tx.title)}</div>
                    <div class="text-xs text-slate-400">${tx.transaction_date} • <span class="uppercase">${tx.type}</span></div>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="font-bold ${isExp ? 'text-rose-400' : 'text-emerald-400'}">${isExp ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)} €</span>
                    <button type="button" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold rounded-lg">Sélectionner</button>
                </div>
            `;
            listEl.appendChild(item);
        });
    }
};

function selectAttachment(type, item) {
    currentAttachment = {
        type: type,
        id: item.id,
        data: item
    };

    const preview = document.getElementById('attachment-preview');
    const content = document.getElementById('attachment-preview-content');

    if (type === 'event') {
        content.innerHTML = `📎 <strong>Événement attaché :</strong> ${escapeHTML(item.title)}`;
    } else {
        content.innerHTML = `📎 <strong>Transaction attachée :</strong> ${escapeHTML(item.title)} (${Math.abs(item.amount).toFixed(2)} €)`;
    }

    preview.classList.remove('hidden');
    closeModal('attach-selector-modal');
}

window.clearAttachment = function() {
    currentAttachment = { type: null, id: null, data: null };
    document.getElementById('attachment-preview').classList.add('hidden');
};

// Utilitaire sécurité anti-XSS basique
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Lancement au démarrage
initSession();
