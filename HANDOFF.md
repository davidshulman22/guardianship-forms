# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-15
**Source:** Claude Code session — lifecycle sections + wizard persistence
**Status:** RESUME-READY

---

# 1. Objective

Build a browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms) that David Shulman uses daily for his probate filings. Everything runs client-side with localStorage persistence. The key differentiator: Claude integration — populate forms directly from matter context files without manual data entry.

---

# 2. Current State

The app is functional for all Broward County domiciliary probate paths. 41 forms defined in forms.json. **Claude import feature is built and working.** The matter view is now organized into **three lifecycle sections**: Open Estate (wizard-driven), Estate Administration (Notice to Creditors, Inventory), and Close Estate (Petition/Order of Discharge). Wizard selections persist on the matter — imported or previously-configured matters auto-restore their wizard state and load forms immediately instead of showing a blank "Open Estate" wizard. The app runs at `http://localhost:8765` via `python3 -m http.server 8765`.

---

# 3. Work Completed (This Session)

- **Wizard selection persistence** — wizard choices (admin type, will, jurisdiction, petitioners, county) are saved to `matter.wizardSelections` when "Load Forms" is clicked. Re-entering the matter auto-restores selections and auto-loads forms.
- **Import wizard inference** — Claude import now infers wizard selections from imported data: `will_date`/`will_year` → testate, petitioners array length → single/multiple, defaults to formal + domiciliary. Existing imported matters without `wizardSelections` get inference from `_shared` formData on first view.
- **Bug fix: imported matters stuck on "Open Estate"** — previously, opening an imported matter showed a blank wizard with no forms loaded. Now it auto-detects the matter has data and restores/infers the wizard state.
- **Lifecycle section cards** — matter view reorganized into three sections:
  - **Open Estate** (blue border) — wizard with admin/will/jurisdiction/petitioners/county toggles + "Forms to Generate" tags
  - **Estate Administration** (green border) — Notice to Creditors (P3-0740), Inventory (P3-0900) as clickable toggle buttons
  - **Close Estate** (red border) — Petition for Discharge (P5-0400), Order of Discharge (P5-0800)
  - **All forms** — collapsed `<details>` at bottom with full checklist + bundle buttons as fallback
- Form section buttons toggle forms into/out of `selectedFormIds`, syncing with the manual checklist and merged questionnaire
- Wizard header dynamically shows "Change selections below if needed" for configured matters vs. "Answer these questions to load the correct forms" for new matters
- **Committed and pushed** to `main` on GitHub

---

# 4. Key Decisions (with reasoning)

| Decision | Why It Was Made |
|----------|----------------|
| Save `wizardSelections` on the matter object | Eliminates the "stuck on Open Estate" bug — matter remembers its configuration across sessions |
| Infer wizard selections from import data | Imported matters should auto-configure without manual wizard interaction; will_date presence → testate, petitioners array → single/multiple are reliable signals |
| Default inference: formal + domiciliary | These are by far the most common cases; summary admin and ancillary are rarer and can be corrected |
| Three lifecycle sections instead of one long list | Matches the mental model of estate progression: open → administer → close |
| Keep "All forms" as collapsed fallback | Power-user escape hatch; also needed for summary admin forms not covered by sections |
| `formSections` config object in app.js | Easy to add/remove/reorder forms per section later when David identifies seldom-used forms |

---

# 5. Constraints & Preferences

**Technical constraints:**
- Vanilla JS, no frameworks — single `app.js`, `index.html`, `styles.css`
- docxtemplater (CDN) for `.docx` generation, PizZip, FileSaver.js
- All form field definitions live in `forms.json`, NOT in app.js
- Template tags: `{field_name}` for text, `{field_check}` for checkboxes, `{#group}...{/group}` for loops
- No required fields during build phase
- This is a personal practice tool, never for sale (FLSSI forms require licenses)

**User preferences:**
- Probate first, guardianship later
- David is both builder and primary user
- Plans, handoffs, and working artifacts must be saved in the Dropbox project folder
- Git commit and push at end of every session
- Hardcode for David's workflow — no need to generalize for other attorneys or counties

**Non-negotiables:**
- File No. always optional (assigned after filing)
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896
- Address: Ginsberg Shulman PL, 300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301

---

# 6. Remaining Work

**Priority 1 — Additional import bugs (David has more to report):**
- [ ] Debug and fix other issues David encounters with the import flow
- [ ] Test import → wizard → generate → download end-to-end in David's browser

**Priority 2 — Section refinement:**
- [ ] David will identify seldom/never-used forms to move to their own collapsed section to reduce clutter
- [ ] Summary admin forms need section treatment (currently only in "All forms" fallback)

**Priority 3 — Claude direct document generation (v2 vision):**
- [ ] "Draft the petition" in chat → .docx output, no browser interaction
- [ ] Best approach: standalone Node.js script using docxtemplater directly
- [ ] Claude reads context → picks the right form → populates fields → generates .docx → saves to Dropbox

**Priority 4 — In-progress matter onboarding:**
- [ ] "Quick Add Matter" flow to enter existing matters mid-stream without the opening wizard
- [ ] David has "a whole bunch" of matters to add

**Priority 5 — From the original roadmap:**
- [ ] Ancillary Broward checklists (URLs captured, not built)
- [ ] Helen Torres chronological walkthrough (verify template chain)
- [ ] Template tag audit (29 of 30 probate templates un-audited; P3-0100 had 4 missing tags)
- [ ] Lifecycle bundles beyond opening (Notice to Creditors, Inventory, Closing/Discharge)

**Priority 6 — Case management system:**
- [ ] Complete case management layer that tracks assets, key dates, deadlines, todos, and case status per matter
- [ ] Asset inventory tracking (real property, bank accounts, investments, personal property, etc.)
- [ ] Date/deadline management (filing deadlines, creditor claim periods, inventory due dates, accounting periods)
- [ ] Todo/task list per matter (what's been done, what's next, what's overdue)
- [ ] Integrate with existing matter data model — extend, don't replace

**Captured URLs (Broward checklists not yet built):**
- Formal Ancillary: `http://www.17th.flcourts.org/wp-content/uploads/2017/08/Petition.for_.Formal.Ancillary.Admininistration.pdf`
- Summary Ancillary: `http://www.17th.flcourts.org/wp-content/uploads/2025/12/Revised-Petition.for_.ANCILLARY.Summary.Administration-12.9.25_forms.pdf`
- Homestead: `https://www.17th.flcourts.org/wp-content/uploads/2023/10/REVISED-HOMESTEAD-CHECKLIST-2-1-1.pdf`
- Disposition: `http://www.17th.flcourts.org/wp-content/uploads/2017/08/Disposition.of_.Property.Without.Administration..pdf`
- Sell Real Property: `https://www.17th.flcourts.org/wp-content/uploads/2023/11/Checklist-for-Petition-to-Sell-Real-Property-Estate-and-Guardianship-1-1.pdf`

---

# 7. Known Issues / Risks

**Fixed this session:**
- Imported matters no longer stuck on blank "Open Estate" wizard

**Remaining problems:**
- David reported additional import bugs (not yet specified — needs debugging next session)

**Weak spots:**
- 29 un-audited probate templates may have missing/mismatched tags
- Ancillary wizard entries only have BW-0010
- `seedVersion` was not bumped — existing seed data won't refresh unless bumped
- localStorage is fragile long-term (browser wipe = data loss)
- Summary admin forms don't have section cards yet (only in "All forms" fallback)

---

# 8. Unknowns / Missing Context

- What other specific bugs David is seeing with the import
- Which forms David considers seldom/never-used (for decluttering into a separate section)
- Whether the "Quick Add Matter" needs batch import or one-at-a-time
- For v2 direct generation: whether David wants a CLI command, a Cowork skill, or both

---

# 9. Next Best Action

Have David test the updated matter view with imported matters, then identify which forms to move to a "seldom used" section. Continue debugging any remaining import bugs.

---

# 10. Drop-In Starter Prompt for New Chat

> Copy and paste this entire block into a new chat to resume immediately.

---

## Handoff — GS Court Forms

**Where it is:** `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project`
**Repo:** `https://github.com/davidshulman22/guardianship-forms` (main branch, up to date)
**Run it:** `cd` to project dir, `python3 -m http.server 8765`, open `http://localhost:8765`

### What exists now
- **41 forms** in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local)
- **Three lifecycle sections** in matter view:
  - **Open Estate** — wizard auto-configures from saved/inferred selections; opening forms load automatically for existing matters
  - **Estate Administration** — Notice to Creditors, Inventory (clickable toggle buttons)
  - **Close Estate** — Petition for Discharge, Order of Discharge
  - **All forms** — collapsed fallback with bundles + full checklist
- **Claude Import feature** — "Import from Claude" button in sidebar. Paste JSON → auto-preview → creates/updates client + matter + all form fields + infers wizard selections. Schema in `claude_import_schema.md`, example in `examples/muscara_import.json`.
- **Wizard persistence** — `matter.wizardSelections` saves admin type, will, jurisdiction, petitioners, county. Auto-restored on re-entry.
- **Human-readable filenames** — downloads use form names not IDs
- **Cross-form data sharing** — fields entered on one form auto-populate into others
- **Homepage dashboard** — recent matters, quick actions, overview stats
- **No login required** — auth disabled for local dev

### How the sections work
- Open Estate wizard saves selections to `matter.wizardSelections` on "Load Forms"
- Import infers selections: `will_date`→testate, petitioners array→single/multiple, defaults to formal+domiciliary
- Existing imported matters without selections get inference from `_shared` formData on first view
- Section form buttons toggle forms into/out of `selectedFormIds`, syncing with manual checklist
- `formSections` config in app.js defines which forms go in Administration vs Closing — easy to modify

### What's next (priority order)
1. **Fix remaining import bugs** David found (unspecified — debug first)
2. **Declutter sections** — David will identify seldom-used forms to move to collapsed section
3. **Summary admin section treatment** — currently only in "All forms" fallback
4. **Claude direct generation (v2)** — "Draft the petition" in chat → .docx output
5. **Quick Add Matter** — onboard existing mid-stream matters without wizard
6. **Ancillary Broward checklists** — URLs captured
7. **Template tag audit** — 29 remaining probate templates un-audited
8. **Case management system** — track assets, dates, deadlines, and todos per matter

### Key files
- `app.js` — all application logic (~1900 lines), includes wizard persistence, sections, import, batch generation
- `forms.json` — 41 form definitions with all field/section structure
- `index.html` — single-page app shell with wizard + section cards + import modal
- `styles.css` — all styles including section card styling
- `claude_import_schema.md` — field reference for Claude to generate import JSON
- `examples/muscara_import.json` — real-world import example
- `CLAUDE.md` — full project context (read this first)

### Key code locations
- `formSections` object — defines which forms go in Administration/Closing sections
- `initWizardForMatter()` — restores/infers wizard selections, auto-loads forms
- `confirmClaudeImport()` — infers `wizardSelections` from import data
- `populateFormSections()` / `renderFormSection()` / `toggleSectionForm()` — section card rendering and interaction
- `wizardLoadForms()` — saves `wizardSelections` to matter

### Constraints
- Personal tool, never for sale (FLSSI license restriction)
- No required fields during build phase
- Probate first, guardianship later
- Save all artifacts to Dropbox project folder
- Git commit and push at end of every session
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896

---
