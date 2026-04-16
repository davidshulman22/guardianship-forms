# GS Court Forms — Project Context

## What This Is

A browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms). Select a client, select a matter, answer a few questions or pick forms, fill out a merged questionnaire, and download populated `.docx` files — individually or as a `.zip` bundle. No server-side rendering — everything runs in the browser with localStorage persistence.

## Who Uses This

David Shulman is both the builder and the primary end user. He handles probate matters in Broward County and will use this daily for his own filings. Jill Ginsberg handles guardianship — she may or may not adopt it.

## Current State

The app is **functional for probate** with an Open Estate wizard that guides form selection. 41 forms are defined in forms.json (5 guardianship, 30 probate FLSSI, 6 Broward local). All probate templates are tagged and generating correctly.

**Auth is disabled** for local dev — no login required. Data persists in localStorage with seed test data.

## Stack

- **Frontend**: Single-page HTML (`index.html`), vanilla JS (`app.js`), vanilla CSS (`styles.css`)
- **Storage**: localStorage (Supabase exists but auth is disabled for dev)
- **Document Generation**: docxtemplater (client-side, CDN) + PizZip + FileSaver.js
- **Config Layer**: `forms.json` — all form field definitions live here, NOT in app.js
- **Templates**: `.docx` files in `templates/` with `{field_name}` placeholders

## Data Model

```
Client (Margaret Torres)
  ├── firstName, lastName, address, phone, email
  └── Matters[]
      ├── Matter (Probate — Estate of Helen Marie Torres)
      │   ├── type: 'probate'
      │   ├── subjectName, county, fileNo, division
      │   ├── matterData: { decedent_address, decedent_death_date, ... }
      │   └── formData: { 'P3-0100': { field: value, ... }, 'P3-0420': { ... } }
      └── Matter (Guardianship — Robert James Torres)
          └── ...
```

**Cross-form data sharing**: Fields entered on any form for a matter are available to every other form in that matter. Enter once, populate everywhere. Priority: form data → matter data → client data → attorney defaults.

## File Structure

```
├── index.html                  # Single-page app shell
├── app.js                      # All application logic (~2000 lines)
├── styles.css                  # All styles
├── forms.json                  # 41 form definitions (sections, fields, template paths)
├── CLAUDE.md                   # This file
├── create_broward_templates.py # Script to generate Broward local form templates
├── tag_probate_templates.py    # Tags summary admin forms (rerunnable)
├── tag_formal_admin_templates.py # Tags formal admin forms (rerunnable)
├── repair_templates.py         # One-time fix for G3-010.docx and G3-026.docx
├── templates/
│   ├── G2-010.docx .. G3-026.docx   # 5 guardianship templates
│   ├── P1-0900.docx                  # Notice of Designation of Email Addresses
│   ├── P2-0204.docx .. P2-0650.docx # 19 summary admin templates
│   ├── P3-0100.docx .. P3-0900.docx # 8 formal admin templates
│   ├── P5-0400.docx, P5-0800.docx   # 2 discharge templates
│   ├── BW-0010.docx                  # Broward: Affidavit Regarding Criminal History
│   ├── BW-0020.docx                  # Broward: Mandatory Checklist (Formal Admin Testate)
│   ├── BW-0030.docx                  # Broward: Mandatory Checklist (Formal Admin Intestate)
│   ├── BW-0040.docx                  # Broward: Mandatory Checklist (Summary Admin Testate)
│   ├── BW-0050.docx                  # Broward: Mandatory Checklist (Summary Admin Intestate)
│   └── BW-0060.docx                  # Broward: Affidavit of Heirs
```

## How to Run

```bash
cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
python3 -m http.server 8765
# Open http://localhost:8765
```

## Key Features

### Open Estate Wizard
The primary entry point for filing. Asks 4 questions:
1. **Administration**: Formal / Summary
2. **Will**: Testate / Intestate
3. **Jurisdiction**: Domiciliary / Ancillary
4. **County**: Broward / Palm Beach / Miami-Dade / Other

These map to a `wizardFormMatrix` in app.js that selects the exact right set of forms. County = Broward triggers local forms (BW-*) automatically.

### Batch Form Generation
- Select multiple forms (via wizard, bundle presets, or manual checkboxes)
- All fields merge into one deduplicated questionnaire
- Single form → downloads `.docx` directly
- Multiple forms → downloads `.zip` with all `.docx` files
- Bundle presets available under "Manual form selection" for non-wizard workflows

### Auto-Population Layers
`getAutoPopulateDefaults()` builds field values from 4 sources (in priority order):
1. Data from other forms in this matter (cross-form sharing)
2. Matter-level data (county, subject name, matterData)
3. Client-level data (petitioner name/address)
4. Attorney defaults (David A. Shulman, Bar No. 150762, etc.)

### Seed Test Data
Margaret "Maggie" Torres with 3 matters:
- Guardianship of person & property — Robert James Torres
- Guardianship of property — Sophia Grace Reyes
- **Probate formal admin — Estate of Helen Marie Torres** (testate, died 3/2/2026, Broward County)
  - P3-0100 pre-seeded with full data including 3 beneficiaries

Bump `seedVersion` in `loadClientsFromStorage()` to force test data refresh.

## Form ID Conventions

- `G*` — Guardianship FLSSI forms (G2-010, G3-025, etc.)
- `P1-*` — General probate FLSSI forms
- `P2-*` — Summary administration FLSSI forms
- `P3-*` — Formal administration FLSSI forms
- `P5-*` — Discharge FLSSI forms
- `BW-*` — Broward County local forms

## docxtemplater Conventions

- Text fields: `{field_name}` → value from data
- Repeating groups: `{#beneficiaries}{ben_name} {ben_address}{/beneficiaries}`
- Checkboxes: Field name in forms.json is plain (e.g. `no_felony`). Template tag has `_check` appended: `{no_felony_check}`. `prepareTemplateData()` handles the transform: `true`→`(X)`, `false`→`(  )`.

## Template Repair Notes

When fixing or creating FLSSI templates:
1. **rsid attributes vary per paragraph** — never assume shared values between `<w:p>` elements
2. **Smart apostrophes** — FLSSI uses U+2019 (`'`) not ASCII `'`
3. **No f-strings for template tags** — Python f-strings double-escape braces. Use `+` concatenation
4. For new Broward templates, use `create_broward_templates.py` (requires `python-docx`)

## Broward County (17th Circuit) — Local Requirements

**Judges (current as of April 2026):**
- Judge Kenneth L. Gillespie — Administrative Judge (Div. 62J)
- Judge Nicholas Lopane (Div. 60J)
- Judge Natasha DePrimo (Div. 61J)
- General Magistrate Yves Laventure

**Filing rules:**
- Mandatory checklists required for ALL petition types — Clerk will NOT forward without them
- Proposed orders must have at least 4 lines of text + case number on signature page
- Affidavit Regarding Criminal History required for every estate opening (testate AND intestate)
- Non-FL-resident PRs must post a bond (uniform policy)
- Original will must be deposited with Clerk; original death certificate required
- Contact: probate@17th.flcourts.org / guardian@17th.flcourts.org

**Reference docs downloaded:**
- Local Procedures (Oct 2023, 22 pages) — saved during session
- Mandatory checklists for all petition types — URLs captured
- Affidavit of Heirs form (4 pages) — needed for intestate

## GitHub

Repository: `https://github.com/davidshulman22/guardianship-forms`

**Git discipline:** Project lives in Dropbox — that's intentional, don't move it. Git is source of truth. Start of session: `git pull`. End of session: commit and push.

## Constraints

- No required fields during build phase
- Probate first, guardianship later
- File No. assigned after filing — always optional
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896
- Address: Ginsberg Shulman PL, 300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301
