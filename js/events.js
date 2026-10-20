import { supabase } from './config.js'

export async function loadEvents() {
    const { data: events, error } = await supabase
        .from('events')
        .select('*, profiles(username, full_name)')
        .order('event_date', { ascending: true });

    const grid = document.getElementById('events-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (error || !events || events.length === 0) {
        grid.innerHTML = `<p class="text-slate-500 col-span-full text-center py-8">Aucun événement à venir pour le moment.</p>`;
        return;
    }

    events.forEach(ev => {
        const dateFormatted = new Date(ev.event_date).toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const author = ev.profiles?.username || ev.profiles?.full_name || 'Membre JAD';

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
                <span>Proposé par ${escapeHTML(author)}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

export function initEventsForm(currentUser) {
    const form = document.getElementById('event-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
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
            form.reset();
            window.closeModal('event-modal');
            loadEvents();
        }
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
