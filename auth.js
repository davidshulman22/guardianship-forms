// ============================================================================
// Supabase authentication — Microsoft (Azure AD) OAuth
// ============================================================================
// Exposes:
//   window.supabaseClient        — Supabase JS client
//   window.currentUser           — { id, email, role, display_name } or null
//   window.isAdmin()             — true if currentUser.role === 'admin'
//   window.ensureAuthenticated() — promise that resolves when a session exists
//
// Access is restricted at three layers:
//   1. Azure AD app registration is single-tenant (ginsbergshulman.com only).
//      Only users inside the firm's Microsoft 365 tenant can even initiate
//      sign-in — enforced by Microsoft, server-side.
//   2. Supabase is the auth system of record; it creates the user row only
//      after Microsoft confirms the identity.
//   3. RLS policies on every table require an authenticated session.
// ============================================================================

window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
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

function setLoginError(msg) {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    const statusEl = document.getElementById('loginStatus');
    if (statusEl) statusEl.style.display = 'none';
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
    try {
        if (!session || !session.user) {
            window.currentUser = null;
            showLoginScreen();
            return;
        }

        // The handle_new_user trigger creates the user_profiles row server-side
        // the first time a user authenticates; it's available immediately after.
        const profile = await loadProfile(session.user.id);
        window.currentUser = {
            id: session.user.id,
            // Microsoft puts the user's email at different claim keys depending
            // on tenant config. Fall back through the usual candidates.
            email: session.user.email
                || (session.user.user_metadata && (session.user.user_metadata.email
                                                   || session.user.user_metadata.preferred_username))
                || '',
            role: profile ? profile.role : 'standard',
            display_name: profile ? profile.display_name : (
                session.user.user_metadata && session.user.user_metadata.full_name
            )
        };

        showApp();
        document.dispatchEvent(new CustomEvent('gs-auth-ready', { detail: window.currentUser }));
    } catch (err) {
        // If anything in establishSession throws, we'd otherwise leave both
        // screens hidden and the user staring at a blank page. Fall back to
        // the login screen with an error so they have a path forward.
        console.error('establishSession failed:', err);
        window.currentUser = null;
        showLoginScreen();
        setLoginError('Sign-in error: ' + (err && err.message ? err.message : 'unknown') + '. Try again or contact admin.');
    }
}

async function handleMicrosoftSignIn() {
    setLoginError('');
    const btn = document.getElementById('msSignInBtn');
    btn.disabled = true;

    const redirectTo = window.location.origin + window.location.pathname;

    const { error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            redirectTo: redirectTo,
            scopes: 'openid email profile User.Read'
        }
    });

    // On success the browser navigates to Microsoft; we won't reach the next
    // line in the success case. Only hit it on immediate failure.
    btn.disabled = false;
    if (error) {
        console.error('OAuth sign-in failed:', error);
        setLoginError(error.message || 'Sign-in failed. Try again or contact the admin.');
    }
}

async function handleSignOut() {
    await window.supabaseClient.auth.signOut();
    window.currentUser = null;
    // Clear the localStorage cache so the next user doesn't see stale data.
    localStorage.removeItem('gs_court_forms_clients_cache');
    location.reload();
}

document.addEventListener('DOMContentLoaded', function () {
    const signInBtn = document.getElementById('msSignInBtn');
    if (signInBtn) signInBtn.addEventListener('click', handleMicrosoftSignIn);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

    // detectSessionInUrl: true in the client config makes Supabase auto-
    // exchange ?code=... on page load. It fires an INITIAL_SESSION event
    // via onAuthStateChange once it's done (whether it succeeded or not).
    //
    // We rely on that single code path. Calling exchangeCodeForSession
    // manually races with the built-in detection and the loser hangs.
    let resolved = false;
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        resolved = true;
        try {
            await establishSession(session);
            // Clean the URL after a successful OAuth callback so reloads don't
            // choke on a one-time-use code.
            if (session && window.location.search && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (err) {
            console.error('establishSession failed (outer):', err);
            showLoginScreen();
            setLoginError('Session setup failed: ' + (err.message || 'unknown'));
        }
    });

    // Safety net: if onAuthStateChange never fires within 8 seconds (e.g. the
    // auto-detection hangs), surface an error instead of leaving a blank
    // page. Also clear any sb-* keys so the next load starts clean.
    setTimeout(() => {
        if (resolved) return;
        console.warn('onAuthStateChange did not fire within 8s; forcing login screen');
        Object.keys(localStorage)
            .filter(k => k.indexOf('sb-') === 0)
            .forEach(k => localStorage.removeItem(k));
        showLoginScreen();
        setLoginError('Sign-in stalled. Try signing in again.');
    }, 8000);
});

window.ensureAuthenticated = function () {
    return new Promise((resolve) => {
        if (window.currentUser) return resolve(window.currentUser);
        document.addEventListener('gs-auth-ready', () => resolve(window.currentUser), { once: true });
    });
};
