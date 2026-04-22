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

document.addEventListener('DOMContentLoaded', async function () {
    const signInBtn = document.getElementById('msSignInBtn');
    if (signInBtn) signInBtn.addEventListener('click', handleMicrosoftSignIn);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

    // Fires on initial load, on OAuth callback return, on sign-out, and on
    // token refresh. Single source of truth for "is the user logged in?"
    window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        await establishSession(session);
    });

    // Wrap a promise with a hard timeout. Supabase's getSession can hang
    // indefinitely when the stored token is in a weird state (observed on
    // reload after OAuth), and hangs would leave the app blank because
    // neither screen is shown. Timing out lets us recover via the catch.
    const withTimeout = (promise, ms, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(
            () => reject(new Error(label + ' timed out after ' + ms + 'ms')),
            ms
        ))
    ]);

    try {
        // If we arrived back from Microsoft with a code in the URL, manually
        // exchange it. detectSessionInUrl is supposed to handle this but
        // occasionally silently fails; explicit exchange surfaces the error.
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            const { data, error } = await withTimeout(
                window.supabaseClient.auth.exchangeCodeForSession(code),
                8000,
                'exchangeCodeForSession'
            );
            if (error) {
                console.error('exchangeCodeForSession error:', error);
                showLoginScreen();
                setLoginError('Sign-in callback failed: ' + error.message);
                return;
            }
            // Clean the URL so reloads don't try to re-exchange a stale code
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            await establishSession(data.session);
            return;
        }

        // Normal load — check for an existing session
        const { data: { session } } = await withTimeout(
            window.supabaseClient.auth.getSession(),
            5000,
            'getSession'
        );
        await establishSession(session);
    } catch (err) {
        console.error('Auth init failed:', err);
        // If getSession hung, the stored token is probably corrupt. Nuke it so
        // the user can start clean without manually clearing localStorage.
        if (err && err.message && err.message.indexOf('timed out') !== -1) {
            Object.keys(localStorage)
                .filter(k => k.indexOf('sb-') === 0)
                .forEach(k => localStorage.removeItem(k));
        }
        showLoginScreen();
        setLoginError('Auth init failed: ' + (err && err.message ? err.message : 'unknown') + ' — try signing in again.');
    }
});

window.ensureAuthenticated = function () {
    return new Promise((resolve) => {
        if (window.currentUser) return resolve(window.currentUser);
        document.addEventListener('gs-auth-ready', () => resolve(window.currentUser), { once: true });
    });
};
