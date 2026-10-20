# JA-Connect 🚀

**JA-Connect** est une application web moderne et légère de type mini-PRONOTE d'équipe conçue pour la gestion d'un accueil ados / association JAD (environ 30 personnes). 

Elle est développée en HTML/JS vanilla avec **Tailwind CSS** (via CDN) pour l'interface, **Chart.js** pour le suivi budgétaire, et se connecte directement à un backend **Supabase** (Authentification, Base de données relationnelle et Temps réel).

---

## 📋 Fonctionnalités

1. **Authentification & Profils :**
   - Connexion et inscription sécurisées via Supabase Auth.
   - Gestion automatique des profils utilisateurs (`profiles`) avec rôles (`membre`, `animateur`, `admin`).
2. **Calendrier & Événements :**
   - Création et consultation des sorties, activités et événements à venir.
3. **Caisse & Suivi Financier :**
   - Ajout de recettes, cotisations et dépenses.
   - Calcul automatique du solde global en temps réel.
   - Graphique interactif d'évolution du budget (via **Chart.js**).
4. **Messagerie Instantanée & Collaboration :**
   - Création de canaux / groupes de discussion (ex: *Général*, *Projet Sortie*).
   - Gestion des membres du groupe (ajout/retrait depuis une liste déroulante des utilisateurs inscrits).
   - Envoi de messages en temps réel (via Supabase Realtime).
   - **Cartes d'aperçu interactives** : attachez un événement ou une transaction de caisse directement dans vos messages (style WhatsApp).

---

## ⚙️ Configuration de Supabase

1. Créez un projet gratuit sur [Supabase](https://supabase.com).
2. Rendez-vous dans l'éditeur **SQL** (`SQL Editor`) et exécutez l'intégralité des scripts SQL fournis pour créer les tables (`profiles`, `events`, `transactions`, `groups`, `group_members`, `messages`), les politiques de sécurité (RLS) et activer **Supabase Realtime** sur la table `messages`.
3. Récupérez vos clés d'API (`Project URL` et `anon public key`) dans les paramètres du projet (`Project Settings > API`).
4. Ouvrez le fichier `js/supabaseClient.js` et remplacez les valeurs fictives par vos clés :
   ```javascript
   const SUPABASE_URL = 'VOTRE_URL_SUPABASE'
   const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_SUPABASE'
   ```

---

## 💻 Lancer le projet en local

Pour tester l'application en local :
1. Ouvrez le dossier dans un éditeur comme **VS Code**.
2. Utilisez l'extension **Live Server** (ou tout autre serveur HTTP local comme `python3 -m http.server`).
3. Assurez-vous que l'URL de votre serveur local (ex: `http://localhost:5500`) est bien déclarée dans l'onglet **Authentication > URL Configuration** de votre tableau de bord Supabase.

---

## 🚢 Déploiement (Vercel / GitHub Pages)

- **Vercel** : Importez simplement votre repository GitHub sur Vercel. Le déploiement est instantané (aucun build complexe requis, ce sont des fichiers statiques).
- **GitHub Pages** : Activez GitHub Pages dans les paramètres de votre repository sur la branche principale (`main` / `root`).
