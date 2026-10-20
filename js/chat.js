import { supabase } from './config.js'

let activeGroupId = null;
let currentChatSubscription = null;
let currentAttachment = { type: null, id: null, data: null };

export async function initChat(currentUser) {
    loadGroups(currentUser);

    const groupForm = document.getElementById('group-form');
    if (groupForm) {
        groupForm.addEventListener('submit', async (e) => {
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

            await supabase.from('group_members').insert([{
                group_id: newGroup.id,
                user_id: currentUser.id
            }]);

            groupForm.reset();
            window.closeModal('group-modal');
            loadGroups(currentUser);
            selectGroup(newGroup, currentUser);
        });
    }

    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
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
    }
}

async function loadGroups(currentUser) {
    const { data: memberships, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', currentUser.id);

    const groupsListEl = document.getElementById('groups-list');
    if (!groupsListEl) return;
    groupsListEl.innerHTML = '';

    if (error || !memberships || memberships.length === 0) {
        groupsListEl.innerHTML = `<p class="text-xs text-slate-500 p-2">Aucun groupe. Créez-en un.</p>`;
        return;
    }

    memberships.forEach(m => {
        const group = m.groups;
        if (!group) return;

        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = `w-full text-left p-3 rounded-xl transition flex flex-col space-y-1 ${activeGroupId === group.id ? 'bg-indigo-600/25 border border-indigo-500/50 text-white' : 'hover:bg-slate-800 text-slate-300'}`;
        btn.onclick = () => selectGroup(group, currentUser);
        btn.innerHTML = `
            <div class="font-semibold text-sm"># ${escapeHTML(group.name)}</div>
            <div class="text-xs text-slate-400 truncate">${escapeHTML(group.description || 'Canal de discussion')}</div>
        `;
        groupsListEl.appendChild(btn);
    });

    if (!activeGroupId && memberships.length > 0) {
        selectGroup(memberships[0].groups, currentUser);
    }
}

async function selectGroup(group, currentUser) {
    activeGroupId = group.id;
    const groupNameEl = document.getElementById('active-group-name');
    const groupDescEl = document.getElementById('active-group-desc');
    const manageBtn = document.getElementById('manage-members-btn');

    if (groupNameEl) groupNameEl.textContent = `# ${group.name}`;
    if (groupDescEl) groupDescEl.textContent = group.description || 'Canal de discussion JA-Connect';
    if (manageBtn) manageBtn.classList.remove('hidden');

    loadGroups(currentUser);
    loadMessages(group.id, currentUser);
    loadGroupMembers(group.id, currentUser);
    subscribeToMessages(group.id, currentUser);
}

async function loadGroupMembers(groupId, currentUser) {
    const { data: members, error } = await supabase
        .from('group_members')
        .select('*, profiles(id, username, full_name, role)')
        .eq('group_id', groupId);

    const listEl = document.getElementById('current-members-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (error || !members) return;

    members.forEach(m => {
        const name = m.profiles?.username || m.profiles?.full_name || 'Utilisateur';
        const div = document.createElement('div');
        div.className = "flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-sm";
        div.innerHTML = `
            <div>
                <span class="font-medium text-white">${escapeHTML(name)}</span>
                <span class="text-xs text-indigo-400 ml-2">(${m.profiles?.role || 'membre'})</span>
            </div>
            ${m.user_id !== currentUser.id ? `<button onclick="window.removeMember('${groupId}', '${m.user_id}')" class="text-xs text-rose-400 hover:text-rose-300">Retirer</button>` : '<span class="text-xs text-slate-500">Vous</span>'}
        `;
        listEl.appendChild(div);
    });

    const { data: allProfiles } = await supabase.from('profiles').select('id, username, full_name');
    const selectEl = document.getElementById('add-member-select');
    if (!selectEl) return;
    selectEl.innerHTML = '';

    const existingMemberIds = members.map(m => m.user_id);
    const availableProfiles = (allProfiles || []).filter(p => !existingMemberIds.includes(p.id));

    if (availableProfiles.length === 0) {
        selectEl.innerHTML = `<option value="">Tous les membres sont déjà dans le groupe</option>`;
    } else {
        availableProfiles.forEach(p => {
            const pName = p.username || p.full_name || 'Membre';
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = pName;
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
        // Recharger les membres du groupe actif (on récupère le currentUser stocké ou session)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) loadGroupMembers(activeGroupId, session.user);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (session) loadGroupMembers(groupId, session.user);
    }
};

async function loadMessages(groupId, currentUser) {
    const { data: messages, error } = await supabase
        .from('messages')
        .select(`
            *,
            profiles(username, full_name, role),
            events(id, title, event_date, location, description),
            transactions(id, title, amount, type, transaction_date)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    const container = document.getElementById('messages-container');
    if (!container) return;
    container.innerHTML = '';

    if (error || !messages || messages.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 my-auto">Aucun message dans ce canal. Envoyez le premier !</div>`;
        return;
    }

    messages.forEach(msg => appendMessageElement(msg, currentUser));
    container.scrollTop = container.scrollHeight;
}

function subscribeToMessages(groupId, currentUser) {
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
            const { data: fullMsg } = await supabase
                .from('messages')
                .select(`
                    *,
                    profiles(username, full_name, role),
                    events(id, title, event_date, location, description),
                    transactions(id, title, amount, type, transaction_date)
                `)
                .eq('id', payload.new.id)
                .single();

            if (fullMsg) {
                appendMessageElement(fullMsg, currentUser);
                const container = document.getElementById('messages-container');
                if (container) container.scrollTop = container.scrollHeight;
            }
        })
        .subscribe();
}

function appendMessageElement(msg, currentUser) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    // Retirer le message d'aide s'il est affiché seul
    const placeholder = container.querySelector('.text-slate-500');
    if (placeholder && container.children.length === 1) {
        container.innerHTML = '';
    }

    const isMe = msg.user_id === currentUser.id;
    const authorName = msg.profiles?.username || msg.profiles?.full_name || 'Utilisateur';
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

window.openAttachSelector = async function(type) {
    const menu = document.getElementById('attach-menu');
    if (menu) menu.classList.add('hidden');
    
    const modalTitle = document.getElementById('attach-modal-title');
    const listEl = document.getElementById('attach-selector-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center text-slate-500 py-4">Chargement...</div>';
    window.openModal('attach-selector-modal');

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

    if (preview && content) {
        if (type === 'event') {
            content.innerHTML = `📎 <strong>Événement attaché :</strong> ${escapeHTML(item.title)}`;
        } else {
            content.innerHTML = `📎 <strong>Transaction attachée :</strong> ${escapeHTML(item.title)} (${Math.abs(item.amount).toFixed(2)} €)`;
        }
        preview.classList.remove('hidden');
    }
    window.closeModal('attach-selector-modal');
}

window.clearAttachment = function() {
    currentAttachment = { type: null, id: null, data: null };
    const preview = document.getElementById('attachment-preview');
    if (preview) preview.classList.add('hidden');
};

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
