-- ============================================================================
-- Supabase Schema Setup for Guardianship Form Assembly App
-- ============================================================================
-- This SQL file sets up the database schema for managing clients and form
-- submissions in a guardianship form assembly application.
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Table: clients
-- Stores information about clients (alleged incapacitated persons and cases)
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),

  -- Core case fields
  county text,
  file_no text,
  division text,

  -- Petitioner information
  petitioner_name text,
  petitioner_age text,
  petitioner_address text,
  petitioner_relationship text,

  -- AIP (Alleged Incapacitated Person) information
  aip_name text,
  aip_age text,
  aip_county text,
  aip_primary_language text,
  aip_address text,

  -- Attorney information
  attorney_name text,
  attorney_email text,
  attorney_bar_no text,
  attorney_address text,
  attorney_phone text,

  -- Physician information
  physician_name text,
  physician_address text,
  physician_phone text,

  -- Generated/computed field for UI display
  display_name text GENERATED ALWAYS AS (COALESCE(aip_name, 'Unnamed Client')) STORED
);

-- Table: form_submissions
-- Stores submitted form data for each client
CREATE TABLE form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  form_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),

  -- JSONB field to store all form-specific data
  -- This includes checkboxes, text fields, narratives, repeating rows, etc.
  form_data jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Index for searching clients by AIP name
CREATE INDEX idx_clients_aip_name ON clients(aip_name);

-- Index for querying form submissions by client
CREATE INDEX idx_form_submissions_client_id ON form_submissions(client_id);

-- Index for querying form submissions by form type
CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);

-- ============================================================================
-- 3. ENABLE ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES
-- ============================================================================

-- Policy: Authenticated users can SELECT all clients
CREATE POLICY "Authenticated users can select clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can INSERT clients
CREATE POLICY "Authenticated users can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can UPDATE clients
CREATE POLICY "Authenticated users can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can DELETE clients
CREATE POLICY "Authenticated users can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can SELECT all form submissions
CREATE POLICY "Authenticated users can select form submissions"
  ON form_submissions
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can INSERT form submissions
CREATE POLICY "Authenticated users can insert form submissions"
  ON form_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can UPDATE form submissions
CREATE POLICY "Authenticated users can update form submissions"
  ON form_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can DELETE form submissions
CREATE POLICY "Authenticated users can delete form submissions"
  ON form_submissions
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. CREATE FUNCTION AND TRIGGERS FOR updated_at
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for clients table
CREATE TRIGGER trigger_update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for form_submissions table
CREATE TRIGGER trigger_update_form_submissions_updated_at
  BEFORE UPDATE ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. GRANTS (Optional - adjust based on your Supabase role setup)
-- ============================================================================
-- Note: In Supabase, RLS policies typically handle access control.
-- The following grants are provided for reference if you need to adjust
-- role permissions explicitly.

-- GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON form_submissions TO authenticated;
