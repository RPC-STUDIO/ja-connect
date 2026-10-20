import { supabase } from './config.js'

let isLoginMode = true;

window.switchTab = (mode) => {
    isLoginMode = (mode === 'login');
    const nameField = document.getElementById('name-field');
    const usernameField = document.getElementById('username-field');
    const submitBtn = document.getElementById('submit-btn');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');

    if (isLoginMode) {
        nameField.classList.add('hidden');
        usernameField.classList.add('hidden');
        submitBtn.textContent = "Se connecter";
        tabLogin.className = "flex-1 py-2 font-medium text-indigo-400 border-b-2 border-indigo-500 transition";
        tabSignup.className = "flex-1 py-2 font-medium text-slate-400 hover:text-white transition";
    } else {
        nameField.classList.remove('hidden');
        usernameField.classList.remove('hidden');
        submitBtn.textContent = "S'inscrire";
        tabSignup.className = "flex-1 py-2 font-medium text-indigo-400 border-b-2 border-indigo-500 transition";
        tabLogin.className = "flex-1 py-2 font-medium text-slate-400 hover:text-white transition";
    }
}

// Vérification de session sur la page de connexion
export async function initAuthPage() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'dashboard.html';
    }

    const form = document.getElementById('auth-form');
    if (!form) return;

    const errorDiv = document.getElementById('error-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.add('hidden');
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (isLoginMode) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            const fullName = document.getElementById('full_name').value;
            const username = document.getElementById('username').value.trim();

            if (!username) {
                errorDiv.textContent = "Le pseudo est obligatoire.";
                errorDiv.classList.remove('hidden');
                return;
            }

            // Vérifier unicité du pseudo
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .single();

            if (existingUser) {
                errorDiv.textContent = "Ce pseudo est déjà pris. Veuillez en choisir un autre.";
                errorDiv.classList.remove('hidden');
                return;
            }

            const { data: authData, error } = await supabase.auth.signUp({
                email,
                password,
                options: { 
                    data: { 
                        full_name: fullName,
                        username: username
                    } 
                }
            });

            if (error) {
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
            } else {
                // Créer ou mettre à jour le profil explicite si le trigger ne l'a pas fait
                if (authData.user) {
                    await supabase.from('profiles').upsert({
                        id: authData.user.id,
                        full_name: fullName,
                        username: username,
                        role: 'membre'
                    });
                }
                alert('Compte créé avec succès ! Vous pouvez vous connecter.');
                switchTab('login');
            }
        }
    });
}
