-- ============================================================================
-- Supabase schema for GS Court Forms
-- ============================================================================
-- Hierarchy:  clients → matters → form_data
--
-- Authorization model:
--   - Admin users see every row (for troubleshooting).
--   - Standard users see only rows they created.
--   - Role is stored in user_profiles.role ('admin' | 'standard').
--
-- The anon key alone cannot read/write; every request must be authenticated.
--
-- To apply: Supabase dashboard → SQL editor → paste this file → Run.
-- Safe to re-run: all objects drop first.
-- ============================================================================

DROP TABLE IF EXISTS form_data CASCADE;
DROP TABLE IF EXISTS form_submissions CASCADE;  -- legacy table from old schema
DROP TABLE IF EXISTS matters CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- ============================================================================
-- user_profiles — maps auth.users to role + display info
-- ============================================================================

CREATE TABLE user_profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  role          text NOT NULL DEFAULT 'standard' CHECK (role IN ('admin', 'standard')),
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a profile the first time a user logs in.
-- Anyone whose email appears in the ADMIN_EMAILS allow-list gets role='admin'
-- immediately; everyone else starts as 'standard' and can be promoted manually.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_emails text[] := ARRAY[
    'david@ginsbergshulman.com',
    'maribel@ginsbergshulman.com'
  ];
  assigned_role text;
BEGIN
  assigned_role := CASE
    WHEN lower(NEW.email) = ANY(admin_emails) THEN 'admin'
    ELSE 'standard'
  END;
  INSERT INTO user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, assigned_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Helper: is the current user an admin? Used by every RLS policy below.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================================
-- Data tables
-- ============================================================================

CREATE TABLE clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid NOT NULL REFERENCES auth.users(id),

  first_name   text,
  last_name    text,
  address      text,
  phone        text,
  email        text
);

CREATE TABLE matters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid NOT NULL REFERENCES auth.users(id),

  type           text NOT NULL CHECK (type IN ('guardianship', 'probate', 'trust_admin', 'other')),
  subject_name   text,
  county         text,
  file_no        text,
  division       text,

  matter_data    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE form_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  form_id     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid NOT NULL REFERENCES auth.users(id),

  data        jsonb NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (matter_id, form_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_matters_client_id       ON matters(client_id);
CREATE INDEX idx_matters_created_by      ON matters(created_by);
CREATE INDEX idx_clients_created_by      ON clients(created_by);
CREATE INDEX idx_form_data_matter_id     ON form_data(matter_id);
CREATE INDEX idx_form_data_form_id       ON form_data(form_id);
CREATE INDEX idx_clients_last_name       ON clients(last_name);

-- ============================================================================
-- Row-level security
-- ============================================================================
-- Every policy: admin OR created_by = auth.uid()

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_data     ENABLE ROW LEVEL SECURITY;

-- user_profiles: everyone reads own row; admins read all; nobody writes directly
-- (the trigger creates the row, and role changes happen via the Supabase dashboard).
CREATE POLICY "read_own_profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "update_own_display_name" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));

-- clients
CREATE POLICY "select_clients" ON clients
  FOR SELECT TO authenticated
  USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "insert_clients" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_clients" ON clients
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = auth.uid())
  WITH CHECK (is_admin() OR created_by = auth.uid());

CREATE POLICY "delete_clients" ON clients
  FOR DELETE TO authenticated
  USING (is_admin() OR created_by = auth.uid());

-- matters
CREATE POLICY "select_matters" ON matters
  FOR SELECT TO authenticated
  USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "insert_matters" ON matters
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_matters" ON matters
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = auth.uid())
  WITH CHECK (is_admin() OR created_by = auth.uid());

CREATE POLICY "delete_matters" ON matters
  FOR DELETE TO authenticated
  USING (is_admin() OR created_by = auth.uid());

-- form_data
CREATE POLICY "select_form_data" ON form_data
  FOR SELECT TO authenticated
  USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "insert_form_data" ON form_data
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_form_data" ON form_data
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = auth.uid())
  WITH CHECK (is_admin() OR created_by = auth.uid());

CREATE POLICY "delete_form_data" ON form_data
  FOR DELETE TO authenticated
  USING (is_admin() OR created_by = auth.uid());

-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_matters_updated_at
  BEFORE UPDATE ON matters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_form_data_updated_at
  BEFORE UPDATE ON form_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- POST-DEPLOYMENT STEPS (do these in the Supabase dashboard)
-- ============================================================================
-- 1. Auth → Providers: ensure "Email" is enabled, "Confirm email" is ON.
-- 2. Auth → URL Configuration:
--      Site URL = https://davidshulman22.github.io/guardianship-forms/
--      Redirect URLs = https://davidshulman22.github.io/guardianship-forms/
--                      http://localhost:8765/  (for local dev)
-- 3. Auth → Providers → Email: DISABLE "Allow new users to sign up".
--      (This prevents random people from creating accounts.)
-- 4. Auth → Users → "Add user":
--      - david@ginsbergshulman.com  (send magic link or auto-confirm)
--      - jill@ginsbergshulman.com
-- 5. SQL editor — promote anyone missed (David + Maribel are auto-admin via
--    the handle_new_user trigger; use this only to promote someone else):
--      UPDATE user_profiles SET role = 'admin'
--      WHERE email = '<that-person>@ginsbergshulman.com';
-- 6. Verify:
--      SELECT email, role FROM user_profiles;
-- ============================================================================
