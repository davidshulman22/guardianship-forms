# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-16 (updated)
**Source:** Claude Code session — tag audit + CLAUDE.md refresh
**Status:** RESUME-READY — awaiting David's skip marks on FORMS_CATALOG_MAP.md

---

# 1. Objective

Build a browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms) that David Shulman uses daily for his probate filings. Everything runs client-side with localStorage persistence. The key differentiator: Claude integration — populate forms directly from matter context files without manual data entry.

---

# 2. Current State

The app is functional for all Broward County domiciliary probate paths. **41 forms** defined in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local). **All 36 probate/local templates pass tag audit — zero mismatches.** Claude import feature is built and working. The matter view has **three lifecycle sections** (Open Estate, Estate Administration, Close Estate) that dynamically switch between formal and summary admin form sets based on wizard selections. App runs locally only at `http://localhost:8765`.

---

# 3. Work Completed

**Latest mini-session (2026-04-16, third pass):**
- **Full tag audit** — audited all 36 probate/local templates against forms.json, excluding auto-populated fields (case caption, attorney defaults) and deferred guardianship forms
- Found and fixed **4 real mismatches**:
  - P2-0500: added missing `decedent_death_year` and `will_year` fields to forms.json
  - P3-0420: added missing `decedent_death_date` and `decedent_death_year` fields to forms.json
- **Updated CLAUDE.md** — corrected stale numbers (37→41 forms, ~1100→~2000 lines app.js), added BW-0030 through BW-0060 to file structure
- Confirmed BW-0030 through BW-0060 templates, forms.json entries, and wizard matrix wiring were all already complete from prior session
- Committed and pushed to `main`

**Prior session (2026-04-16, second pass):**
- Surveyed full FLSSI 2025 probate catalog — **194 forms** exist in source directory, only **31 probate forms built** so far
- Created `FORMS_CATALOG_MAP.md` — exclude-list format grouping all 138 missing probate forms by series with SKIP checkboxes

**Prior session (2026-04-16, first pass):**
- **Template tag audit** — fixed 16 templates with missing/mismatched tags
- **Summary admin lifecycle sections** — `formSections` now has `formal` and `summary` sub-configs
- **Broward local forms BW-0030 through BW-0060** — all built, tagged, wired into forms.json and wizard matrix
- **Multi-petitioner model** — `petitioners` repeating group added to P2-0205/0215/0220/0225

---

# 4. Key Decisions (with reasoning)

| Decision | Why It Was Made |
|----------|----------------|
| Fix template tags via XML manipulation, not python-docx | FLSSI templates have specific rsid attributes and formatting that python-docx would destroy |
| Auto-populated fields not in forms.json by design | `decedent_name`, `file_no`, `county`, `division`, `attorney_*`, `petitioner_name` are injected by `prepareTemplateData()` from matter/client/attorney defaults — no need to duplicate in every form's field list |
| Nest formSections under `formal`/`summary` keys | Cleanest way to show different lifecycle forms without restructuring the HTML |
| Summary checklist fields use `scl_` prefix | Avoids collision with formal admin `cl_` fields since forms share data across a matter |

---

# 5. Constraints & Preferences

**Technical constraints:**
- Vanilla JS, no frameworks — single `app.js`, `index.html`, `styles.css`
- docxtemplater (CDN) for `.docx` generation, PizZip, FileSaver.js
- All form field definitions live in `forms.json`, NOT in app.js
- Template tags: `{field_name}` for text, `{field_check}` for checkboxes, `{#group}...{/group}` for loops
- No required fields during build phase
- Personal practice tool, never for sale (FLSSI forms require licenses)

**User preferences:**
- Probate first, guardianship later
- David is both builder and primary user
- Git commit and push at end of every session
- Hardcode for David's workflow — no need to generalize

**Non-negotiables:**
- File No. always optional (assigned after filing)
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896
- Address: Ginsberg Shulman PL, 300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301

---

# 6. Remaining Work

**Priority 1 — FLSSI catalog build-out (waiting on David):**
- [ ] David marks `[x]` in SKIP column of `FORMS_CATALOG_MAP.md` for forms he doesn't want
- [ ] When David says "ready", build all unmarked forms: tag source .docx, add to forms.json, wire into wizard/sections
- [ ] 138 missing forms; realistic batch after skips: ~60–80

**Priority 2 — Import bugs (David has more to report):**
- [ ] Debug and fix issues David encounters with the import flow
- [ ] Test import → wizard → generate → download end-to-end

**Priority 3 — Section refinement:**
- [ ] Identify seldom/never-used forms for a collapsed section

**Priority 4 — Claude direct document generation (v2 vision):**
- [ ] "Draft the petition" in chat → .docx output, no browser interaction
- [ ] Standalone Node.js script or Cowork skill using docxtemplater directly

**Priority 5 — Quick Add Matter:**
- [ ] Onboard existing mid-stream matters without the opening wizard

**Priority 6 — Ancillary Broward checklists:**
- [ ] Build from captured URLs (formal ancillary, summary ancillary, homestead, disposition, sell real property)

**Priority 7 — Case management system:**
- [ ] Asset inventory, date/deadline tracking, todo/task list per matter

---

# 7. Known Issues / Risks

**Weak spots:**
- Ancillary wizard entries only have BW-0010 (no ancillary-specific checklists yet)
- `seedVersion` was not bumped — existing seed data won't refresh unless bumped
- localStorage is fragile long-term (browser wipe = data loss)

**Open questions:**
- What specific import bugs is David seeing?
- Which forms does David consider seldom/never-used?
- Quick Add Matter: batch import or one-at-a-time?

---

# 8. Next Best Action

**Immediate:** Open `FORMS_CATALOG_MAP.md` and put `[x]` in the SKIP column for any forms you do NOT want built. Write "SKIP ALL" next to section headers to skip whole sections. When done, say "ready" to kick off the batch build.

**After catalog batch:** run tag audit on every new template, commit, push.

---

# 9. Drop-In Starter Prompt for New Chat

> Copy and paste this entire block into a new chat to resume immediately.

---

## Handoff — GS Court Forms

**Where it is:** `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project`
**Repo:** `https://github.com/davidshulman22/guardianship-forms` (main branch, up to date)
**Run it:** `cd` to project dir, `python3 -m http.server 8765`, open `http://localhost:8765`

### What exists now
- **41 forms** in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local)
- **All 36 probate/local templates pass tag audit** — zero mismatches
- **Three lifecycle sections** in matter view, dynamic by admin type:
  - **Open Estate** — wizard auto-configures; opening forms load automatically
  - **Estate Administration** — formal: Notice to Creditors + Inventory; summary: Notice to Creditors
  - **Close Estate** — formal: Petition/Order of Discharge; summary: Will admission orders
  - **All forms** — collapsed fallback with bundles + full checklist
- **Claude Import feature** — "Import from Claude" button. Paste JSON → auto-preview → creates/updates client + matter + all form fields. Schema in `claude_import_schema.md`.
- **Wizard persistence** — `matter.wizardSelections` saves and restores on re-entry
- **Multi-petitioner model** — `petitioners` repeating group on summary admin forms
- **Cross-form data sharing** — fields entered on one form auto-populate into others
- **Human-readable filenames** — downloads use form names not IDs
- **Local only** — no login, no auth, localStorage persistence

### What's next (priority order)

**IMMEDIATE TASK — Build out the full FLSSI catalog:**
- David is reviewing `FORMS_CATALOG_MAP.md` and marking `[x]` in the SKIP column for forms he does not want built.
- When David says "ready" (possibly on a different computer — always `git pull` first), execute the batch build:
  1. Read `FORMS_CATALOG_MAP.md`, extract the list of unbuilt forms NOT marked skip.
  2. Source files: `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/FODPROBWD2025/Converted DOCX/` — 194 FLSSI 2025 .docx files. Match by ID prefix (some source filenames have typos).
  3. For each: unzip .docx, replace blanks with docxtemplater tags via raw XML. Preserve rsid, smart apostrophes, formatting. No python-docx for tags.
  4. Save to `templates/{FORM-ID}.docx`, add definition to `forms.json`, wire into sections/wizard if relevant.
  5. After all builds: run tag audit, bump `seedVersion` if needed, commit, push.

**After catalog batch:**
2. Fix remaining import bugs
3. Declutter sections
4. Claude direct generation (v2)
5. Quick Add Matter for mid-stream matters
6. Ancillary Broward checklists
7. Case management system

### Key files
- `app.js` — all application logic (~2000 lines)
- `forms.json` — 41 form definitions with all field/section structure
- `index.html` — single-page app shell
- `styles.css` — all styles
- `claude_import_schema.md` — field reference for Claude import JSON
- `CLAUDE.md` — full project context
- `FORMS_CATALOG_MAP.md` — full FLSSI 2025 catalog with SKIP checkboxes; drives the next batch build
- `PLAN.md` — detailed plan for Broward local forms + multi-petitioner (completed)
- `tag_probate_templates.py` / `tag_formal_admin_templates.py` — tagging script patterns
- Source .docx: `../FODPROBWD2025/Converted DOCX/` (194 source forms)

### Key code locations
- `wizardFormMatrix` (~line 702) — maps wizard selections to form sets
- `formSections` — formal/summary sub-configs for lifecycle sections
- `populateFormSections()` — picks formal vs summary based on wizardSelections
- `prepareTemplateData()` (~line 1668) — auto-populates caption/attorney fields
- `confirmClaudeImport()` — infers wizardSelections from import data
- `getAutoPopulateDefaults()` — builds field values from 4 sources

### Constraints
- Personal tool, never for sale (FLSSI license restriction)
- No required fields during build phase
- Probate first, guardianship later
- Git commit and push at end of every session
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896

---
