# GS Court Forms — Project Context

## What This Is

A browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms). Select a client, select a matter, answer a few questions or pick forms, fill out a merged questionnaire, and download populated `.docx` files — individually or as a `.zip` bundle. No server-side rendering — everything runs in the browser with localStorage persistence.

## Who Uses This

David Shulman is both the builder and the primary end user. He handles probate matters in Broward County and uses this daily for his own filings. Jill Ginsberg uses it for her guardianship work. Maribel Gannon (paralegal, f/k/a Maribel Diaz, maribel@ginsbergshulman.com) drafts guardianship documents *for* Jill — she signs in with her own account but documents always list Jill as attorney of record.

## Current State

41 forms defined in forms.json (5 guardianship, 30 probate FLSSI, 6 Broward local). Open Estate wizard guides form selection. All templates pass the tag audit.

**Template rebuild in progress.** Six templates (all 5 guardianship + P3-0100) have been rebuilt from scratch on a clean builder pattern that complies with the `docx-numbering` skill (real Word numbering, 1.5 line spacing, no empty spacer paragraphs, Broward AI certification above the signature block). Remaining 35 probate/local templates still use the legacy FLSSI layout and are queued.

**Auth is live.** Microsoft OAuth via Supabase's Azure provider. `user_profiles` table with admin/standard roles, RLS-gated. David and Maribel are auto-promoted to admin on first sign-in via the `handle_new_user` trigger allow-list. Live URL: `https://davidshulman22.github.io/guardianship-forms/`.

## Stack

- **Frontend**: Single-page HTML (`index.html`), vanilla JS (`app.js`), vanilla CSS (`styles.css`)
- **Auth**: Microsoft OAuth via Supabase Azure provider. See `auth.js` + `supabase-setup.sql`.
- **Storage**: Supabase Postgres (`clients`, `matters`, `form_data`, `user_profiles`) with RLS. Admin sees all rows; standard users see their own. localStorage is a cache.
- **Document Generation**: docxtemplater (client-side, CDN) + PizZip + FileSaver.js
- **Config Layer**: `forms.json` — all form field definitions live here, NOT in app.js
- **Templates**: `.docx` files in `templates/` with `{field_name}` placeholders and `{#cond}...{/cond}` conditional blocks

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
├── index.html                      # Single-page app shell
├── app.js                          # Application logic (~2000 lines)
├── auth.js                         # Microsoft OAuth + Supabase session handling
├── styles.css                      # All styles
├── forms.json                      # 41 form definitions
├── supabase-config.js              # Supabase URL + anon key
├── supabase-setup.sql              # DB schema + RLS + handle_new_user trigger
├── CLAUDE.md                       # This file
├── HANDOFF.md                      # Resume-ready handoff
├── audit_tags.py                   # Verify template {tags} match forms.json
├── build_guardianship_templates.py # Builder for G* templates + shared helpers
├── build_probate_templates.py      # Builder for P*/BW* templates (imports helpers)
├── create_broward_templates.py     # LEGACY — generated the original BW-* templates
├── tag_probate_templates.py        # LEGACY — tagged summary admin forms
├── tag_formal_admin_templates.py   # LEGACY — tagged formal admin forms
├── templates/
│   ├── G2-010.docx .. G3-026.docx   # 5 guardianship templates (REBUILT on new pattern)
│   ├── P1-0900.docx                  # Notice of Designation of Email Addresses
│   ├── P2-0204.docx .. P2-0650.docx  # 19 summary admin templates
│   ├── P3-0100.docx                  # Petition for Administration (REBUILT on new pattern)
│   ├── P3-0120.docx .. P3-0900.docx  # 7 more formal admin templates (legacy)
│   ├── P5-0400.docx, P5-0800.docx    # 2 discharge templates
│   ├── BW-0010.docx .. BW-0060.docx  # 6 Broward local forms
└── reference/                       # Downloaded court checklists, local rules, PDFs
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
4. Attorney defaults — per-matter via `ATTORNEY_PROFILES`, keyed by `matter.attorneyId` with a fall-through default (guardianship → Jill, else David)

### Per-Matter Signing Attorney
`ATTORNEY_PROFILES` in `app.js` holds two entries: `david` and `jill`. The matter modal has a "Signing Attorney" dropdown so any matter can explicitly pick David or Jill regardless of type — e.g. a probate matter Jill is handling. Leaving it on "Default for matter type" preserves the old behavior. Maribel is a paralegal, not in `ATTORNEY_PROFILES`; her drafts still list Jill as attorney of record.

### County-Specific AI Certifications
`prepareTemplateData()` sets `county_is_broward` / `county_is_miami_dade` booleans based on the matter's county. Templates wrap AI-certification text in `{#county_is_broward}...{/county_is_broward}` so it renders only when appropriate. Broward language matches AO 2026-03-Gen (17th Circuit); Miami-Dade matches AO 26-04 (11th Circuit).

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
- Conditional blocks: `{#has_alternatives}...{/has_alternatives}` renders only when truthy; `{^has_alternatives}...{/has_alternatives}` renders when falsy (negation). `prepareTemplateData()` passes booleans raw so conditionals resolve.
- Checkboxes (legacy): `{field_check}` — `prepareTemplateData()` transforms `true`→`(X)` and `false`→`(  )`. New templates prefer real conditionals but `_check` is still supported for legacy forms.

## Template Builder Pattern (new forms go here)

**All new templates must be built via Python scripts, never edited by hand.** The scripts produce deterministic .docx output with real Word numbering, clean captions, and conditional AI certifications.

- `build_guardianship_templates.py` — guardianship forms + all shared helpers
- `build_probate_templates.py` — probate + Broward forms; imports helpers

**Shared helpers to use (from `build_guardianship_templates`):**
- `_apply_page_setup(doc)` — 1" margins, Times New Roman 12pt
- `_apply_running_header(doc, title)` — right-aligned on pages 2+, "Page X of Y"
- `_ensure_pleading_numbering(doc)` — marker; numbering is written post-save
- `_pleading_para(doc, text, keep_with_next=False)` — **use this for all numbered body paragraphs.** Word auto-numbers via `numPr` → `numId=1`. Firm conventions: `1.` at level 0, `a.` at level 1, `i.` at level 2. 1.5 line spacing. **Never hardcode numbers as text**, never insert empty paragraphs between numbered items — the skill forbids both.
- `_add_para(doc, text)` — unnumbered prose (intros, closings, signature prep)
- `_next_of_kin_table(doc)` — 3-col NOK table with repeating row
- `_property_items_table(doc)` — 2-col property table with repeating row
- `_add_broward_ai_certification(doc, doc_title)` — wraps Broward AO 2026-03-Gen certification in `{#county_is_broward}...{/}`
- `_add_signature_block(doc)` — petitioner + attorney signature block
- `_inject_numbering_part(docx_path)` — **must be called AFTER `doc.save()`** to overwrite python-docx's default numbering.xml with firm conventions

**Probate-specific helpers (from `build_probate_templates`):**
- `_add_probate_caption(doc)` — "IN RE: ESTATE OF {decedent_full_name}, Deceased."
- `_beneficiaries_table(doc)` — 4-col beneficiaries table
- `_add_probate_signature_block(doc)` — petitioner + attorney block for probate petitions

**Pattern to follow:**
```python
def build_pX_YYYY():
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)
    _add_probate_caption(doc)
    _add_para(doc, 'TITLE OF PETITION', align=CENTER, bold=True)
    _add_para(doc, 'Petitioner, {petitioner_name}, alleges:')       # intro, unnumbered
    _pleading_para(doc, 'First numbered paragraph...')              # auto-numbered
    _pleading_para(doc, 'Second numbered paragraph...')
    _add_para(doc, 'WHEREFORE, Petitioner respectfully requests...')   # closing, unnumbered
    _add_broward_ai_certification(doc, 'Petition Title')
    _add_probate_signature_block(doc)
    out_path = os.path.join(TEMPLATE_DIR, 'P3-XXXX.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
```

## Legacy Template Notes (pre-rebuild)

The 35 templates still using the original FLSSI structure have these quirks:
1. **rsid attributes vary per paragraph** — never assume shared values between `<w:p>` elements when patching
2. **Smart apostrophes** — FLSSI uses U+2019 (`'`) not ASCII `'`
3. **No f-strings for template tags** — Python f-strings double-escape braces. Use `+` concatenation
4. **Two-column layout breaks on multi-line fields with justified text** — exactly the bug that motivated the rebuild

These templates are scheduled for replacement via `build_probate_templates.py`. Do not patch them further; rebuild instead.

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
- File No. assigned after filing — always optional
- David A. Shulman (Bar 150762, david@ginsbergshulman.com, 954-990-0896) — probate default
- Jill R. Ginsberg (Bar 813850, jill@ginsbergshulman.com + maribel@ secondary, 954-332-2310) — guardianship default
- Address: Ginsberg Shulman, PL, 300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301
- Post-Jill (she's 11 yrs older than David): guardianship leaves the firm; solo practice = estate planning + probate + trust admin. Maribel goes with Jill.

## Long-Term Direction

The Forms Project is meant to evolve from a form generator into a **complete probate + guardianship file management system** — matter intake, deadlines, tasks, document generation, correspondence, inventory, accountings. Scope not yet defined. See `.claude/projects/.../memory/project_future_file_mgmt_system.md`. Priority 1b in the handoff (matter-level data interview) is a prerequisite.
