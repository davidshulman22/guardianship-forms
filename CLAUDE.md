# FLSSI Forms — Project Context

## What This Is

A static HTML/JS/CSS web app for David Shulman (and potentially Jill Ginsberg) to select a Florida FLSSI 2025 court form — guardianship or probate — fill out a questionnaire, and download a populated `.docx`. No server-side rendering — everything runs in the browser.

## Who Uses This

David Shulman is both the builder and the primary end user. He handles probate matters and will use this daily for his own filings. Jill Ginsberg handles guardianship — she may or may not adopt it. UX should be simple (court filing speed matters) but doesn't need to be dumbed down.

## Project Scope

The project covers both **guardianship AND probate** Florida FLSSI forms. There are ~400 total forms across both folders but only a prioritized subset will be converted. David identifies which forms to add next.

## Roadmap

**Phase 1 (current):** Convert the most-used FLSSI forms — tag templates, wire into forms.json, verify. Get the form-filling pipeline working for both probate and guardianship.

**Phase 2 (future):** Full case management system. Probate and guardianship matters are created with persistent memory of people (ward, decedent, PR, guardian, beneficiaries, creditors), addresses, relationships, and case details. Enter once, auto-populate everywhere across all forms for that matter. During Phase 1, track which fields recur across forms — those become the Phase 2 schema.

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
├── config.js           # Supabase credentials (gitignored)
├── config.example.js   # Template for config.js on new clones
├── .gitignore          # Ignores config.js, .env, .DS_Store
├── supabase-setup.sql  # Schema reference (DO NOT re-run — schema is live)
├── repair_templates.py # One-time script that fixed G3-010.docx and G3-026.docx
├── CLAUDE.md           # This file
├── templates/
│   ├── G2-010.docx     # Petition to Determine Incapacity (fully tagged)
│   ├── G2-140.docx     # Notice of Designation of Email Addresses (fully tagged)
│   ├── G3-010.docx     # Emergency Temp Guardian (fully tagged after repair)
│   ├── G3-025.docx     # Plenary Guardian / Property (fully tagged)
│   └── G3-026.docx     # Limited Guardian Person & Property (fully tagged after repair)
```

## Supabase

**Project URL**: `https://xcjrpfkexdxggkaswefh.supabase.co`

The Supabase URL and anon key live in `config.js` (gitignored). A template is provided in `config.example.js`. To set up a new clone, copy `config.example.js` to `config.js` and fill in the real values.

**DO NOT recreate or modify the schema — it is live.**

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

**Important:** Fields not in the `clients` table schema are form-specific and live in `form_submissions.form_data` as JSON. Do NOT add them to the `clients` table. This includes fields like `petitioner_residence`, `petitioner_phone`, `aip_dob_month/day/year`, `aip_residence`, `aip_incapacity_nature`, `proposed_guardian_*`, `imminent_danger_reason`, etc. The `clients` table only holds fields that are shared across ALL forms. Form-specific fields belong in `forms.json` and get stored in `form_data`.

### Auth
Three accounts exist (`david@`, `dshulman@`, `jill@ginsbergshulman.com`) — passwords unknown. Email confirmation is enforced. Password reset via Supabase dashboard is needed before full UI testing.

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
                {"name": "name", "label": "Name", "type": "text"}
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

If a template uses a field that matches a core field name (e.g. `{county}`), the core field value is used automatically.

## Template Repair Notes

When writing repair scripts for new FLSSI forms:

1. **rsid attributes vary per paragraph** — each `<w:p>` has unique rsidR/rsidRPr/rsidRDefault. Never assume consecutive paragraphs share the same values. Verify each one individually.
2. **Smart apostrophes** — FLSSI forms use U+2019 (`'`) not ASCII `'`. Always check with hex/ord.
3. **No f-strings for template tags** — Python f-strings treat `"{{county}}"` inside expressions as literal `{{county}}` (double braces), but docxtemplater needs single braces `{county}`. Use `+` concatenation instead.
4. **repair_templates.py** uses Python stdlib only (zipfile, shutil, os, re) — no pip dependencies. Run with `python3` (macOS).

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

(May need renaming now that probate is in scope.)

**Git discipline:** Project lives in Dropbox — that's intentional, don't move it. Git is source of truth, Dropbox syncs whatever Git leaves on disk. Start of session: `git pull`. End of session: commit and push. Claude Code handles this — David doesn't need to run terminal commands.

## TODOs

- [ ] Reset Supabase auth passwords so the app can be fully UI-tested
- [ ] Full UI-path E2E test (login → create client → select form → generate → download)
- [ ] David identifies next batch of FLSSI forms to convert
- [ ] Consider renaming repo/app title from "Guardianship Forms" to something broader
- [ ] Phase 2 planning: case management schema for persistent people/roles/addresses
