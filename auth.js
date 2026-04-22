// ============================================================================
// Supabase authentication — Microsoft (Azure AD) OAuth
// ============================================================================
// Exposes:
//   window.supabaseClient        — Supabase JS client
//   window.currentUser           — { id, email, role, display_name } or null
//   window.isAdmin()             — true if currentUser.role === 'admin'
//   window.ensureAuthenticated() — promise that resolves when a session exists
//
// Every stage logs to the console with the "[auth]" prefix. When a sign-in
// stalls, open DevTools → Console and you can tell which stage died.
// ============================================================================

const AUTH_TAG = '[auth]';
function alog(...args) { console.info(AUTH_TAG, ...args); }
function awarn(...args) { console.warn(AUTH_TAG, ...args); }
function aerr(...args) { console.error(AUTH_TAG, ...args); }

alog('script loaded');

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

// ---------------------------------------------------------------------------
// Login-gate state machine
// ---------------------------------------------------------------------------

function setLoginState(which) {
    // which ∈ 'checking' | 'signingIn' | 'button'
    const map = {
        checking: 'loginStateChecking',
        signingIn: 'loginStateSigningIn',
        button: 'loginStateButton'
    };
    Object.keys(map).forEach(k => {
        const el = document.getElementById(map[k]);
        if (el) el.style.display = (k === which) ? 'flex' : 'none';
    });
    alog('login state →', which);
}

function showLoginScreen(state) {
    document.getElementById('loginGate').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    setLoginState(state || 'button');
}

function showApp() {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    const emailEl = document.getElementById('currentUserEmail');
    if (emailEl && window.currentUser) {
        const roleTag = window.currentUser.role === 'admin' ? ' (admin)' : '';
        emailEl.textContent = window.currentUser.email + roleTag;
    }
    alog('app shown as', window.currentUser && window.currentUser.email);
}

function setLoginError(msg) {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    const statusEl = document.getElementById('loginStatus');
    if (statusEl) statusEl.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Nuke all Supabase localStorage keys. Safe because we don't rely on any
// user-entered data surviving a reset — the DB is source of truth.
// ---------------------------------------------------------------------------
function clearSupabaseStorage() {
    const keys = Object.keys(localStorage).filter(k => k.indexOf('sb-') === 0);
    keys.forEach(k => localStorage.removeItem(k));
    alog('cleared', keys.length, 'sb-* localStorage keys');
}

function hardResetAndReload() {
    alog('hard reset');
    clearSupabaseStorage();
    localStorage.removeItem('gs_court_forms_clients_cache');
    // Strip query string so we don't re-trigger a code exchange after reload.
    window.location.replace(window.location.origin + window.location.pathname);
}

// ---------------------------------------------------------------------------
// Profile load — cosmetic (role badge). Wrap with a 3s timeout so it can
// never block sign-in. If it times out, we default to role='standard' and
// the app still loads; a later page load may pick up the real profile.
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, label) {
    return new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => {
            if (done) return;
            done = true;
            awarn(label, 'timed out after', ms, 'ms');
            resolve({ timedOut: true });
        }, ms);
        promise.then(v => {
            if (done) return;
            done = true;
            clearTimeout(t);
            resolve({ value: v });
        }, e => {
            if (done) return;
            done = true;
            clearTimeout(t);
            resolve({ error: e });
        });
    });
}

async function loadProfileSafely(userId) {
    alog('loadProfile start', userId);
    const result = await withTimeout(
        window.supabaseClient
            .from('user_profiles')
            .select('id, email, role, display_name')
            .eq('id', userId)
            .maybeSingle(),
        3000,
        'loadProfile'
    );

    if (result.timedOut) return null;
    if (result.error) {
        awarn('loadProfile error:', result.error);
        return null;
    }
    const { data, error } = result.value || {};
    if (error) {
        awarn('loadProfile postgrest error:', error);
        return null;
    }
    alog('loadProfile done', data);
    return data;
}

// ---------------------------------------------------------------------------
// Session handling
// ---------------------------------------------------------------------------
async function establishSession(session) {
    alog('establishSession called; has session =', !!session);
    try {
        if (!session || !session.user) {
            window.currentUser = null;
            showLoginScreen('button');
            return;
        }

        // Build a minimal currentUser immediately and flip to the app. Profile
        // load happens in the background so it can never gate sign-in.
        const meta = session.user.user_metadata || {};
        window.currentUser = {
            id: session.user.id,
            email: session.user.email
                || meta.email
                || meta.preferred_username
                || '',
            role: 'standard',
            display_name: meta.full_name || ''
        };

        showApp();
        document.dispatchEvent(new CustomEvent('gs-auth-ready', { detail: window.currentUser }));

        // Background profile fetch — upgrades the cached 'standard' to 'admin'
        // and fills in display_name when available. Non-blocking.
        loadProfileSafely(session.user.id).then(profile => {
            if (!profile || !window.currentUser) return;
            window.currentUser.role = profile.role || window.currentUser.role;
            window.currentUser.display_name = profile.display_name || window.currentUser.display_name;
            // Refresh email badge in the header if the role changed.
            const emailEl = document.getElementById('currentUserEmail');
            if (emailEl) {
                const roleTag = window.currentUser.role === 'admin' ? ' (admin)' : '';
                emailEl.textContent = window.currentUser.email + roleTag;
            }
        });
    } catch (err) {
        aerr('establishSession threw:', err);
        window.currentUser = null;
        showLoginScreen('button');
        setLoginError('Sign-in error: ' + (err && err.message ? err.message : 'unknown') + '. Try again or reset.');
    }
}

// ---------------------------------------------------------------------------
// Sign in / sign out
// ---------------------------------------------------------------------------
async function handleMicrosoftSignIn() {
    alog('sign-in click');
    setLoginError('');
    const btn = document.getElementById('msSignInBtn');
    if (btn) btn.disabled = true;

    const redirectTo = window.location.origin + window.location.pathname;
    alog('redirectTo =', redirectTo);

    const { error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            redirectTo: redirectTo,
            scopes: 'openid email profile User.Read'
        }
    });

    if (btn) btn.disabled = false;
    if (error) {
        aerr('signInWithOAuth failed:', error);
        setLoginError(error.message || 'Sign-in failed. Try again or reset.');
    }
}

async function handleSignOut() {
    alog('sign-out click');
    try { await window.supabaseClient.auth.signOut(); } catch (e) { awarn('signOut:', e); }
    window.currentUser = null;
    localStorage.removeItem('gs_court_forms_clients_cache');
    location.reload();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    const hasCode = /[?&]code=/.test(window.location.search);
    alog('DOMContentLoaded; hasCode =', hasCode);

    // Paint a visible state before anything async runs. If we just got
    // redirected back from Microsoft, show the "Signing you in..." spinner;
    // otherwise show the "Checking your session..." spinner. JS will flip
    // to either showApp() (session found) or state='button' (no session).
    showLoginScreen(hasCode ? 'signingIn' : 'checking');

    // Wire up buttons.
    const signInBtn = document.getElementById('msSignInBtn');
    if (signInBtn) signInBtn.addEventListener('click', handleMicrosoftSignIn);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

    const resetBtn = document.getElementById('resetAuthBtn');
    if (resetBtn) resetBtn.addEventListener('click', hardResetAndReload);

    // detectSessionInUrl: true in the client config makes Supabase auto-
    // exchange ?code=... on page load. It fires an INITIAL_SESSION event
    // via onAuthStateChange once it's done (success or not). We rely on
    // that single code path — calling exchangeCodeForSession manually
    // races with detection and the loser hangs.
    let resolved = false;
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        alog('onAuthStateChange fired; event =', event, '; hasSession =', !!session);
        resolved = true;
        try {
            await establishSession(session);
            // Strip the one-time-use ?code=... after a successful exchange.
            if (session && window.location.search && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
                alog('cleaned ?code= from URL');
            }
        } catch (err) {
            aerr('onAuthStateChange handler threw:', err);
            showLoginScreen('button');
            setLoginError('Session setup failed: ' + (err.message || 'unknown') + '. Click "Reset auth" to retry.');
        }
    });

    // Safety net 1 (6s): if we're in 'signingIn' state (came back with a code)
    // and nothing has happened, the exchange almost certainly failed silently.
    // Clear sb-* keys and show the button with an actionable error.
    setTimeout(() => {
        if (resolved) return;
        if (!hasCode) return;
        awarn('6s: still no auth event after OAuth callback — exchange likely failed');
        clearSupabaseStorage();
        showLoginScreen('button');
        setLoginError('Sign-in didn\'t complete. Click "Sign in with Microsoft" to try again.');
    }, 6000);

    // Safety net 2 (10s): final backstop for any path. If onAuthStateChange
    // never fires at all, don't leave the user staring at a spinner forever.
    setTimeout(() => {
        if (resolved) return;
        awarn('10s: onAuthStateChange never fired — forcing button state');
        clearSupabaseStorage();
        showLoginScreen('button');
        setLoginError('Sign-in stalled. Click "Sign in with Microsoft" to try again.');
    }, 10000);
});

window.ensureAuthenticated = function () {
    return new Promise((resolve) => {
        if (window.currentUser) return resolve(window.currentUser);
        document.addEventListener('gs-auth-ready', () => resolve(window.currentUser), { once: true });
    });
};
