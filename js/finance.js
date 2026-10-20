import { supabase } from './config.js'

let budgetChartInstance = null;

export async function loadTransactions() {
    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*, profiles(username, full_name)')
        .order('transaction_date', { ascending: false });

    const tbody = document.getElementById('transactions-list');
    if (!tbody) return;
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

    const balanceEl = document.getElementById('total-balance');
    if (balanceEl) balanceEl.textContent = `${totalBalance.toFixed(2)} €`;
    updateBudgetChart(chartDates, chartTotals);
}

export function initFinanceForm(currentUser) {
    const form = document.getElementById('finance-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
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
            form.reset();
            window.closeModal('finance-modal');
            loadTransactions();
        }
    });
}

function updateBudgetChart(labels, data) {
    const canvas = document.getElementById('budgetChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
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

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
