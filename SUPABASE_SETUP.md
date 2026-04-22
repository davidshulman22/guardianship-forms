# Supabase Setup — Checklist

Do these steps in order, in the Supabase dashboard at
https://xcjrpfkexdxggkaswefh.supabase.co

Total time: ~10 minutes.

---

## 1. Apply the schema

1. Dashboard → **SQL Editor** → **New query**
2. Open `supabase-setup.sql` from this repo
3. Copy its contents, paste into the SQL editor, click **Run**
4. You should see "Success. No rows returned." (or similar)
5. **Sanity check**: go to **Table Editor** — you should now see four tables:
   `user_profiles`, `clients`, `matters`, `form_data`

> The SQL file is safe to re-run (it drops existing tables first). But
> re-running will wipe any production data — so after launch, only re-run if
> you really mean it.

---

## 2. Configure authentication

1. Dashboard → **Authentication** → **Sign In / Providers**
2. Find **Email**
3. Set:
   - **Enable Email provider**: ON
   - **Confirm email**: ON
   - **Allow new users to sign up**: **OFF**  ← important
   - **Secure email change**: ON
4. Save

---

## 3. Set redirect URLs

1. Dashboard → **Authentication** → **URL Configuration**
2. **Site URL**: `https://davidshulman22.github.io/guardianship-forms/`
3. **Redirect URLs** (add each as a separate entry):
   - `https://davidshulman22.github.io/guardianship-forms/`
   - `http://localhost:8765/`
   - `http://localhost:8766/`
4. Save

Without the redirect URLs, the magic link will fail on click.

---

## 4. Create the users

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**
2. For each user, enter their email and check **"Auto Confirm User"**
   (this skips the "click to confirm your email" step since you're creating
   the account on their behalf):
   - `david@ginsbergshulman.com`
   - `jill@ginsbergshulman.com`
3. No password needed — they'll sign in via magic link.

After creation, both users will appear in the **Users** tab.

---

## 5. Promote David to admin

1. Dashboard → **SQL Editor** → **New query**
2. Run this:
   ```sql
   UPDATE user_profiles
     SET role = 'admin'
     WHERE email = 'david@ginsbergshulman.com';

   SELECT email, role FROM user_profiles;
   ```
3. The second query should return two rows:
   - `david@ginsbergshulman.com  admin`
   - `jill@ginsbergshulman.com   standard`

Note: `user_profiles` rows are created automatically by a trigger the first
time a user signs in. If David hasn't signed in yet, the UPDATE will affect
zero rows. In that case, have David sign in once, then re-run the UPDATE.

---

## 6. Smoke test

1. Open `http://localhost:8765/` (or the GitHub Pages URL).
2. Enter your email (`david@ginsbergshulman.com`) and click **Send magic link**.
3. Check your inbox — Supabase sends the email within a few seconds
   (from `noreply@supabase.io` by default).
4. Click the link. You should land back on the app, signed in, header
   showing `david@ginsbergshulman.com (admin)`.
5. Create a test client. Reload the page. Client should still be there.
6. Open the app in a private window, sign in as Jill. You should NOT see
   David's client. Create a Jill-owned client.
7. Back in David's window, reload. You should see BOTH clients, with an
   owner tag next to Jill's.

---

## Troubleshooting

**"Invalid login credentials"** when clicking magic link:
- Check the redirect URL is in the allowlist (step 3)
- Check the user exists in the Users tab (step 4)

**Magic link email never arrives**:
- Check the Supabase default email sender's rate limit (4 emails / hour on
  free tier). If you hit it, configure SMTP: Auth → SMTP Settings.

**"That email is not authorized for this app."**:
- The client-side allowlist in `auth.js` only lets two emails sign in.
  If you add a third attorney, update `ALLOWED_EMAILS` in `auth.js`.

**"Permission denied for table X"**:
- User's `user_profiles` row is missing. Check `SELECT * FROM user_profiles;`
  — should have a row for them. If not, the `handle_new_user` trigger
  didn't fire. Re-run the schema SQL.

---

## What changed vs the old schema

The previous `supabase-setup.sql` had a single flat `clients` table with AIP
fields baked in. The new schema matches the actual app model:

- `clients` — just contact info (name, address, phone, email)
- `matters` — one per case, nested under a client
- `form_data` — JSONB per (matter, form_id), keyed by Florida Bar form ID

RLS went from "any authenticated user sees everything" to "admin sees
everything, standard users see their own". Implemented via a helper
function `is_admin()` that checks `user_profiles.role`.
