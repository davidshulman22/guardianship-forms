# Guardianship Forms — Project Context

## What This Is

A static HTML/JS/CSS web app that lets Jill Ginsberg (David's law partner) and non-technical staff select a Florida FLSSI 2025 guardianship court form, fill out a questionnaire, and download a populated `.docx`. No server-side rendering — everything runs in the browser.

## Stack

- **Frontend**: Single-page HTML (`index.html`), vanilla JS (`app.js`), vanilla CSS (`styles.css`)
- **Auth & Data**: Supabase (hosted) — `clients` + `form_submissions` tables with RLS
- **Document Generation**: docxtemplater (client-side, loaded via CDN) + PizZip + FileSaver.js
- **Config Layer**: `forms.json` — all form field definitions live here, NOT in app.js
- **Templates**: `.docx` files in `templates/` with `{field_name}` placeholders

## File Structure

```
├── index.html          # Single-page app shell
├── app.js              # All application logic
├── styles.css          # All styles
├── forms.json          # Form configuration (sections, fields, template paths)
├── supabase-setup.sql  # Schema reference (DO NOT re-run — schema is live)
├── repair_templates.py # One-time script to fix G3-010.docx and G3-026.docx
├── templates/
│   ├── G2-010.docx     # Petition to Determine Incapacity (fully tagged)
│   ├── G2-140.docx     # Notice of Designation of Email Addresses (fully tagged)
│   ├── G3-010.docx     # Emergency Temp Guardian (fully tagged after repair)
│   ├── G3-025.docx     # Plenary Guardian / Property (fully tagged)
│   ├── G3-026.docx     # Limited Guardian Person & Property (fully tagged after repair)
│   └── [originals]     # Untagged FLSSI originals (reference only, names have full titles)
```

## Supabase Schema (DO NOT MODIFY)

**Project URL**: `https://xcjrpfkexdxggkaswefh.supabase.co`

### `clients` table
Core fields shared across all forms:
- `county`, `file_no`, `division`
- `petitioner_name`, `petitioner_age`, `petitioner_address`, `petitioner_relationship`
- `aip_name`, `aip_age`, `aip_county`, `aip_primary_language`, `aip_address`
- `attorney_name`, `attorney_email`, `attorney_bar_no`, `attorney_address`, `attorney_phone`
- `physician_name`, `physician_address`, `physician_phone`
- `created_by` (uuid ref to `auth.users`)

### `form_submissions` table
- `client_id` (FK → clients), `form_id` (text, e.g. "G3-010"), `form_data` (jsonb)
- Form-specific field values stored as JSON in `form_data`

Both tables have RLS enabled — all authenticated users have full CRUD.

## forms.json Structure

```json
{
  "forms": [
    {
      "id": "G2-010",
      "name": "Human-readable form name",
      "template": "templates/G2-010.docx",
      "sections": [
        {
          "title": "Section Title",
          "fields": [
            {"name": "field_name", "label": "UI Label", "type": "text|textarea|checkbox"},
            {
              "name": "next_of_kin",
              "label": "Next of kin",
              "type": "repeating_group",
              "subfields": [
                {"name": "name", "label": "Name", "type": "text"},
                ...
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Field types: `text`, `textarea`, `checkbox`, `repeating_group`.

## docxtemplater Conventions

- Text fields: `{field_name}` in template → value from data
- Repeating groups: `{#next_of_kin}{name}\t{address}\t{relationship}{/next_of_kin}`
- Checkboxes: In `forms.json`, the field name is plain (e.g. `has_alternatives`). In the template, the tag has `_check` appended: `{has_alternatives_check}`. The `prepareTemplateData()` function in `app.js` handles this transform automatically — it creates both `has_alternatives` and `has_alternatives_check` keys, converting `true`→`(X)` and `false`→`(  )`.

## Core Fields vs Form-Specific Fields

**Core fields** live in the `clients` table and are shared across all forms. They appear in the "Client Info" panel in the UI and auto-populate into every template.

**Form-specific fields** are defined in `forms.json` sections and stored in `form_submissions.form_data` as JSON. They only appear when that form is selected.

If a template uses a field that matches a core field name (e.g. `{county}`), the core field value is used automatically. Form-specific fields only need entries in `forms.json` if they don't match a core field.

## Template Status

| Template | Status | Notes |
|----------|--------|-------|
| G2-010.docx | Fully tagged | Wired in forms.json since initial build |
| G2-140.docx | Fully tagged | forms.json entry added |
| G3-010.docx | Fully tagged | Repaired by repair_templates.py |
| G3-025.docx | Fully tagged | forms.json entry added |
| G3-026.docx | Fully tagged | Repaired by repair_templates.py |

## GitHub

Repository: `https://github.com/davidshulman22/guardianship-forms`

## TODOs

- [ ] Move Supabase anon key from hardcoded in `app.js` to `.env` file; add `.env` to `.gitignore`
- [ ] End-to-end testing of document generation for all 5 forms
- [ ] Consider adding form-level validation before generation
