# Supabase + Microsoft OAuth Setup — Checklist

Sign-in is via Microsoft (Entra ID / Azure AD) restricted to the
`ginsbergshulman.com` tenant only. Supabase is the session store.

Total time: ~20 minutes (one-time setup).

---

## Phase A — Azure Portal (10 min)

Open https://entra.microsoft.com (Microsoft Entra admin center).

### 1. Create the app registration

1. Left sidebar → **Identity** → **Applications** → **App registrations**
2. **+ New registration**
3. Fill in:
   - **Name**: `GS Court Forms`
   - **Supported account types**: **Accounts in this organizational directory only (Ginsberg Shulman PL - Single tenant)**
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://xcjrpfkexdxggkaswefh.supabase.co/auth/v1/callback`
4. Click **Register**

### 2. Copy the identifiers

From the app's **Overview** page, copy these:
- **Application (client) ID**
- **Directory (tenant) ID**

### 3. Create a client secret

1. Left nav (inside the app) → **Certificates & secrets** → **Client secrets**
2. **+ New client secret**
3. Description: `Supabase production`, Expires: **24 months**
4. Click **Add**
5. **Copy the `Value` immediately** — it shows only once

### 4. API permissions (verify default)

1. Left nav → **API permissions**
2. Confirm `User.Read` is present under Microsoft Graph
3. If you see yellow "Admin consent required" → click **Grant admin consent** → confirm

### 5. Token configuration (optional)

1. Left nav → **Token configuration**
2. **+ Add optional claim** → **ID** → check `email` and `preferred_username` → Add

---

## Phase B — Supabase dashboard (3 min)

Open https://supabase.com/dashboard/project/xcjrpfkexdxggkaswefh

### 6. Apply the schema (if not already done)

1. **SQL Editor** → **+ New query**
2. Paste contents of `supabase-setup.sql`
3. **Run**. Expected: "Success. No rows returned."

### 7. Enable the Azure provider

1. **Authentication** → **Sign In / Providers**
2. Find **Azure (Microsoft)** → click
3. Toggle **Enable Azure provider** → ON
4. Fill in:
   - **Azure Client ID**: the Application (client) ID from step 2
   - **Azure Secret**: the client secret `Value` from step 3
   - **Azure Tenant URL**: `https://login.microsoftonline.com/<tenant-id>`
     (replace `<tenant-id>` with the Directory ID from step 2)
5. Confirm the **Callback URL** at the top of the provider card matches:
   `https://xcjrpfkexdxggkaswefh.supabase.co/auth/v1/callback`
6. **Save**

### 8. Clean slate — remove any previous test users

If you created magic-link users earlier, delete them now. Their user IDs
won't match the OAuth-created ones.

1. **Authentication** → **Users** → delete each listed user
2. **SQL Editor** → run: `DELETE FROM user_profiles;`

### 9. Redirect URL allowlist

1. **Authentication** → **URL Configuration**
2. **Site URL**: `https://davidshulman22.github.io/guardianship-forms/`
3. **Redirect URLs** (add each):
   - `https://davidshulman22.github.io/guardianship-forms/`
   - `http://localhost:8765/`
4. **Save**

---

## Phase C — Local smoke test (3 min)

### 10. Start the server

```
cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
git checkout supabase-migration
git pull
python3 -m http.server 8765
```

### 11. Sign in as David

1. Open http://localhost:8765
2. Click **Sign in with Microsoft**
3. Microsoft prompts → pick your `david@ginsbergshulman.com` account → consent if prompted → you land back in the app
4. **Expected:** header shows `david@ginsbergshulman.com` (not yet "admin")

### 12. Promote David to admin

Supabase SQL Editor:
```sql
UPDATE user_profiles
  SET role = 'admin'
  WHERE email = 'david@ginsbergshulman.com';

SELECT email, role FROM user_profiles ORDER BY role;
```

Expected: one row, `david@ginsbergshulman.com | admin`.

Reload the app (⌘R) — header should now show `(admin)` next to your email.

### 13. Have Jill sign in

Jill opens the same URL on her Windows machine (once we're deployed) or
through a remote browser session, clicks **Sign in with Microsoft**, picks
her account, consents. Her `user_profiles` row auto-creates with
`role='standard'`. Confirm in SQL:
```sql
SELECT email, role FROM user_profiles ORDER BY role;
```

---

## Troubleshooting

**"AADSTS50020: User account does not exist in tenant"**
The user signed in with a personal Microsoft account instead of the
ginsbergshulman.com work account. They need to pick the work account on
the Microsoft chooser screen.

**"AADSTS700016: Application with identifier was not found"**
The Client ID in Supabase doesn't match the Azure app registration.
Double-check you pasted the Application (client) ID, not the Object ID.

**"Invalid login credentials" / redirect loop**
Redirect URL mismatch. In Azure, the redirect URI must be exactly
`https://xcjrpfkexdxggkaswefh.supabase.co/auth/v1/callback` (no trailing
slash, no path variations).

**"Permission denied for table user_profiles"**
The `handle_new_user` trigger didn't fire. Re-run the schema SQL in step 6.

**User signs in but immediately sees an empty client list when they had data before**
Expected — this is the multi-user migration's blank state. Anything that
was in browser localStorage isn't in Supabase yet and won't appear. You
create it fresh here, or import via the Claude Import feature.

---

## What's different from magic-link setup

- No `ALLOWED_EMAILS` array in `auth.js` — Azure single-tenant enforces this
- No email to check; Microsoft SSO is one-click
- User creation in Supabase happens automatically on first sign-in, not
  manually in the dashboard
- Client secret in Azure expires after 24 months — calendar a renewal
