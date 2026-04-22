// ============================================================================
// Supabase authentication — magic link + email allowlist
// ============================================================================
// Exposes:
//   window.supabaseClient        — Supabase JS client
//   window.currentUser           — { id, email, role, display_name } or null
//   window.isAdmin()             — true if currentUser.role === 'admin'
//   window.ensureAuthenticated() — promise that resolves when a session exists
// ============================================================================

// Only these emails can even request a magic link. The server-side guard is
// "disable public signup" in the Supabase dashboard. This is a second layer
// for immediate UX feedback.
const ALLOWED_EMAILS = [
    'david@ginsbergshulman.com',
    'jill@ginsbergshulman.com'
];

window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

window.currentUser = null;

window.isAdmin = function () {
    return !!(window.currentUser && window.currentUser.role === 'admin');
};

function showLoginScreen() {
    document.getElementById('loginGate').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showApp() {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    const emailEl = document.getElementById('currentUserEmail');
    if (emailEl && window.currentUser) {
        const roleTag = window.currentUser.role === 'admin' ? ' (admin)' : '';
        emailEl.textContent = window.currentUser.email + roleTag;
    }
}

function setLoginStatus(msg) {
    const el = document.getElementById('loginStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    document.getElementById('loginError').style.display = 'none';
}

function setLoginError(msg) {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    document.getElementById('loginStatus').style.display = 'none';
}

async function loadProfile(userId) {
    const { data, error } = await window.supabaseClient
        .from('user_profiles')
        .select('id, email, role, display_name')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.warn('Failed to load user_profiles row:', error);
        return null;
    }
    return data;
}

async function establishSession(session) {
    if (!session || !session.user) {
        window.currentUser = null;
        showLoginScreen();
        return;
    }

    // Fetch profile (role, display_name). The handle_new_user trigger creates
    // the row server-side the first time a user signs in, so it should exist.
    const profile = await loadProfile(session.user.id);
    window.currentUser = {
        id: session.user.id,
        email: session.user.email,
        role: profile ? profile.role : 'standard',
        display_name: profile ? profile.display_name : null
    };

    showApp();
    // Let app.js know to (re)load data from Supabase
    document.dispatchEvent(new CustomEvent('gs-auth-ready', { detail: window.currentUser }));
}

async function handleMagicLinkSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const btn = document.getElementById('loginSubmitBtn');

    setLoginError('');

    if (!ALLOWED_EMAILS.includes(email)) {
        setLoginError('That email is not authorized for this app.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await window.supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: false  // must exist in auth.users already
        }
    });

    btn.disabled = false;
    btn.textContent = 'Send magic link';

    if (error) {
        setLoginError(error.message || 'Failed to send magic link.');
        return;
    }

    setLoginStatus('Check ' + email + ' for a sign-in link.');
}

async function handleSignOut() {
    await window.supabaseClient.auth.signOut();
    window.currentUser = null;
    // Clear the localStorage cache so the next user doesn't see stale data
    localStorage.removeItem('gs_court_forms_clients');
    location.reload();
}

document.addEventListener('DOMContentLoaded', async function () {
    // Wire up form and sign-out button
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleMagicLinkSubmit);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

    // On auth state change (initial load, magic-link callback, logout)
    window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        await establishSession(session);
    });

    // Immediate check (onAuthStateChange also fires but this avoids a flash
    // of login screen when we already have a session)
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    await establishSession(session);
});

window.ensureAuthenticated = function () {
    return new Promise((resolve) => {
        if (window.currentUser) return resolve(window.currentUser);
        document.addEventListener('gs-auth-ready', () => resolve(window.currentUser), { once: true });
    });
};
