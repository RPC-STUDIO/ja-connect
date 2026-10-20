import { supabase } from './supabaseClient.js'

let currentUser = null;
let budgetChartInstance = null;

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
        .select('full_name, role')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        document.getElementById('user-greeting').textContent = `Bonjour, ${profile.full_name} (${profile.role})`;
    }

    // Charger les données initiales
    loadEvents();
    loadTransactions();
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

// Utilitaire sécurité anti-XSS basique
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Lancement au démarrage
initSession();
