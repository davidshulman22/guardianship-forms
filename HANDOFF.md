# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-15
**Source:** Claude Code session — Claude import integration + document filenames
**Status:** RESUME-READY

---

# 1. Objective

Build a browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms) that David Shulman uses daily for his probate filings. Everything runs client-side with localStorage persistence. The key differentiator: Claude integration — populate forms directly from matter context files without manual data entry.

---

# 2. Current State

The app is functional for all Broward County domiciliary probate paths. 41 forms defined in forms.json. **Claude import feature is built and working** — paste JSON from any Claude conversation to create/update a client + matter with all form fields pre-populated. Document filenames now use human-readable form names. The app runs at `http://localhost:8765` via `python3 -m http.server 8765`.

---

# 3. Work Completed (This Session)

- **Claude Import feature** — full implementation:
  - "Import from Claude" button in sidebar opens a modal with JSON textarea
  - Paste JSON → auto-preview on paste (validates structure, shows client/matter/field count)
  - Preview shows whether client/matter already exists (will update) or is new (will create)
  - Import creates or updates client + matter + populates all form fields via `_shared` formData key
  - Cross-form sharing picks up `_shared` data automatically through existing Layer 1 in `getAutoPopulateDefaults()`
  - Client matching by last name + first name; matter matching by subjectName
- **Import schema reference** (`claude_import_schema.md`) — full field reference for any Claude conversation to generate the right JSON
- **Real-world example** (`examples/muscara_import.json`) — generated from actual `Muscara_Context.md`, tested end-to-end with 28 fields + 2 petitioners + 10 beneficiaries
- **Human-readable document filenames** — `Petition_for_Administration` instead of `P3-0100` in both single-doc and zip downloads
- **Committed and pushed** to `main` on GitHub

---

# 4. Key Decisions (with reasoning)

| Decision | Why It Was Made |
|----------|----------------|
| Paste-JSON approach (not direct localStorage write) | David's browser and Claude's preview browser have separate localStorage contexts; paste is the reliable cross-context bridge |
| `_shared` key in formData for imported data | Leverages existing cross-form sharing (Layer 1 iterates all formData keys); no special-casing needed |
| Auto-preview on paste | Reduces friction — paste JSON, instantly see what will be imported without clicking Preview |
| Client/matter matching before create | Prevents duplicates; re-importing updated data for an existing matter merges cleanly |
| Import data wins for empty fields, preserves existing values | Existing manual edits aren't overwritten; only empty/missing fields get filled |
| Form name in filenames instead of form ID | David's feedback: "I don't know what P3-0100 is. Name it Petition for Administration" |

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

**Priority 1 — Bugs to fix (David noted bugs exist but didn't specify yet):**
- [ ] Debug and fix issues David encounters with the import flow
- [ ] Test import → wizard → generate → download end-to-end in David's browser

**Priority 2 — Claude direct document generation (v2 vision):**
- [ ] David wants to say "Draft the petition to establish restricted depository" in a Claude chat/Cowork session and have the .docx generated directly — no browser interaction
- [ ] Best approach: standalone Node.js script using docxtemplater directly (no browser in loop)
- [ ] Claude reads context → picks the right form → populates fields → generates .docx → saves to Dropbox
- [ ] Prerequisite: import feature must be bug-free, template tag audit should be done

**Priority 3 — In-progress matter onboarding:**
- [ ] "Quick Add Matter" flow to enter existing matters mid-stream without the opening wizard
- [ ] David has "a whole bunch" of matters to add

**Priority 4 — From the original roadmap:**
- [ ] Ancillary Broward checklists (URLs captured, not built)
- [ ] Helen Torres chronological walkthrough (verify template chain)
- [ ] Template tag audit (29 of 30 probate templates un-audited; P3-0100 had 4 missing tags)
- [ ] Lifecycle bundles beyond opening (Notice to Creditors, Inventory, Closing/Discharge)

**Captured URLs (Broward checklists not yet built):**
- Formal Ancillary: `http://www.17th.flcourts.org/wp-content/uploads/2017/08/Petition.for_.Formal.Ancillary.Admininistration.pdf`
- Summary Ancillary: `http://www.17th.flcourts.org/wp-content/uploads/2025/12/Revised-Petition.for_.ANCILLARY.Summary.Administration-12.9.25_forms.pdf`
- Homestead: `https://www.17th.flcourts.org/wp-content/uploads/2023/10/REVISED-HOMESTEAD-CHECKLIST-2-1-1.pdf`
- Disposition: `http://www.17th.flcourts.org/wp-content/uploads/2017/08/Disposition.of_.Property.Without.Administration..pdf`
- Sell Real Property: `https://www.17th.flcourts.org/wp-content/uploads/2023/11/Checklist-for-Petition-to-Sell-Real-Property-Estate-and-Guardianship-1-1.pdf`

---

# 7. Known Issues / Risks

**Problems:**
- David reported bugs with the import flow (not yet specified — needs debugging next session)

**Weak spots:**
- 29 un-audited probate templates may have missing/mismatched tags
- Ancillary wizard entries only have BW-0010
- `seedVersion` was not bumped — existing seed data won't refresh unless bumped
- localStorage is fragile long-term (browser wipe = data loss)

---

# 8. Unknowns / Missing Context

- What specific bugs David is seeing with the import
- Whether the "Quick Add Matter" needs batch import or one-at-a-time
- For v2 direct generation: whether David wants a CLI command, a Cowork skill, or both

---

# 9. Next Best Action

Debug the import bugs David is seeing, then stabilize the import → generate flow end-to-end.

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
- **Claude Import feature** — "Import from Claude" button in sidebar. Paste JSON from any Claude conversation → creates/updates client + matter + all form fields. Auto-preview on paste, validates JSON, shows existing/new status. Import schema in `claude_import_schema.md`, real example in `examples/muscara_import.json`.
- **Human-readable filenames** — downloads use form names (e.g. `Petition_for_Administration`) not IDs
- **Open Estate wizard** with county-aware Broward local form routing
- **Batch generation** — multiple forms → merged questionnaire → .zip download
- **Cross-form data sharing** — fields entered on one form auto-populate into others
- **6 Broward local forms** (criminal history affidavit, 4 mandatory checklists, affidavit of heirs)
- **Multi-petitioner model** for summary admin forms
- **Test data:** Margaret Torres with 3 matters
- **No login required** — auth disabled for local dev

### How Claude Import works
1. In any Claude conversation, read a matter context file (e.g. `Muscara_Context.md`)
2. Generate JSON matching the schema in `claude_import_schema.md`
3. David pastes JSON into the Import modal → Preview → Import
4. Client + matter + all form fields created, ready for wizard + document generation
5. Imported data stored under `_shared` key in formData, picked up by cross-form sharing automatically

### What's next (priority order)
1. **Fix bugs** David found with the import flow (unspecified — debug first)
2. **Claude direct generation (v2)** — "Draft the petition" in chat → .docx output, no browser. Best path: standalone Node.js script using docxtemplater directly
3. **Quick Add Matter** — onboard existing mid-stream matters without wizard
4. **Ancillary Broward checklists** — URLs captured
5. **Template tag audit** — 29 remaining probate templates un-audited
6. **Lifecycle bundles** — Notice to Creditors, Inventory, Closing phases

### Key files
- `app.js` — all application logic (~1350 lines), includes Claude import, wizard, batch generation
- `forms.json` — 41 form definitions with all field/section structure
- `index.html` — single-page app shell with wizard + import modal
- `styles.css` — all styles
- `claude_import_schema.md` — field reference for Claude to generate import JSON
- `examples/muscara_import.json` — real-world import example from Muscara context file
- `CLAUDE.md` — full project context (read this first)

### Constraints
- Personal tool, never for sale (FLSSI license restriction)
- No required fields during build phase
- Probate first, guardianship later
- Save all artifacts to Dropbox project folder
- Git commit and push at end of every session
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896

---
