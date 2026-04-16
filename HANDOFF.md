# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-16
**Source:** Claude Code session — template audit, Helen Torres walkthrough, summary admin sections
**Status:** RESUME-READY

---

# 1. Objective

Build a browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms) that David Shulman uses daily for his probate filings. Everything runs client-side with localStorage persistence. The key differentiator: Claude integration — populate forms directly from matter context files without manual data entry.

---

# 2. Current State

The app is functional for all Broward County domiciliary probate paths. 41 forms defined in forms.json. **All 36 probate/local templates pass tag audit — zero mismatches.** Claude import feature is built and working. The matter view has **three lifecycle sections** (Open Estate, Estate Administration, Close Estate) that now dynamically switch between formal and summary admin form sets based on wizard selections. GitHub Pages has been disabled — app runs locally only at `http://localhost:8765`.

---

# 3. Work Completed (This Session)

- **Template tag audit** — audited all 36 probate/local templates against forms.json. Fixed 16 templates with missing/mismatched tags:
  - `signing_year` blanks (10 templates): replaced underscore placeholders with `{signing_year}` tag
  - Death date/year fields (P3-0420, P3-0700, P3-0900, P2-0355, P2-0500): replaced blank underlined runs with `{decedent_death_date}` and `{decedent_death_year}`
  - Will/witness tags (P3-0420, P2-0500): added `{will_date}`, `{will_year}`, `{witnesses}`; fixed P2-0500 where `{will_date}` was in the wrong position (after "attested by" instead of after "will dated")
  - Petitioner relationship (P2-0205, P2-0215, P2-0220, P2-0225): added `{pet_relationship}` subfield inside `{#petitioners}` loop
  - Judge name (P2-0310, BW-0060): added/standardized to `{judge_name}`
  - PR entitlement (P3-0440): replaced misplaced `{pr_name}` with `{pr_entitlement_reason}` after "by reason of"
  - Other fields: `{decedent_full_name}` in P3-0600, `{court_county}` and `{court_address}` in P3-0740, `{estate_value}` in P2-0355
- **Helen Torres walkthrough** — verified seed data through wizard → form selection → template data merge → render. 7 forms selected correctly, P3-0100 renders with 26 populated fields and 3 beneficiaries, cross-form data sharing works, no tag splitting issues.
- **Summary admin lifecycle sections** — `formSections` now has separate `formal` and `summary` sub-configs. Summary admin shows P2-0355 (Notice to Creditors) in administration and 5 will admission order variants in closing. Sections auto-update when wizard admin type changes.
- **GitHub Pages disabled** — site was temporarily online, now taken down. App is local-only.
- **Committed and pushed** to `main` on GitHub

---

# 4. Key Decisions (with reasoning)

| Decision | Why It Was Made |
|----------|----------------|
| Fix template tags via XML manipulation, not python-docx | FLSSI templates have specific rsid attributes and formatting that python-docx would destroy; raw XML replacement preserves original structure |
| Standardize `{judge}` to `{judge_name}` in BW-0060 | All other templates use `judge_name`; consistency prevents silent data-missing bugs |
| Replace `{pr_name}` with `{pr_entitlement_reason}` in P3-0440 | The tag was in the "by reason of ___" position, which is the entitlement reason, not the PR's name; the second `{pr_name}` (in "ADJUDGED that {pr_name} is appointed") was correct |
| Nest formSections under `formal`/`summary` keys | Cleanest way to show different lifecycle forms without restructuring the HTML; the existing section card elements just get repopulated with different form lists |
| Summary "closing" section shows will admission orders | In summary admin, the order IS the closing — but separate will admission orders may be needed if not combined with the summary order |

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

**Priority 1 — Import bugs (David has more to report):**
- [ ] Debug and fix other issues David encounters with the import flow
- [ ] Test import → wizard → generate → download end-to-end in David's browser

**Priority 2 — Section refinement:**
- [ ] David will identify seldom/never-used forms to move to their own collapsed section to reduce clutter

**Priority 3 — Claude direct document generation (v2 vision):**
- [ ] "Draft the petition" in chat → .docx output, no browser interaction
- [ ] Best approach: standalone Node.js script using docxtemplater directly
- [ ] Claude reads context → picks the right form → populates fields → generates .docx → saves to Dropbox

**Priority 4 — In-progress matter onboarding:**
- [ ] "Quick Add Matter" flow to enter existing matters mid-stream without the opening wizard
- [ ] David has "a whole bunch" of matters to add

**Priority 5 — From the original roadmap:**
- [ ] Ancillary Broward checklists (URLs captured, not built)
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
- 16 templates had missing/mismatched tags — all now pass audit
- P2-0500 had `{will_date}` in the witnesses position — corrected

**Remaining problems:**
- David reported additional import bugs (not yet specified — needs debugging next session)

**Weak spots:**
- Ancillary wizard entries only have BW-0010
- `seedVersion` was not bumped — existing seed data won't refresh unless bumped
- localStorage is fragile long-term (browser wipe = data loss)

---

# 8. Unknowns / Missing Context

- What other specific bugs David is seeing with the import
- Which forms David considers seldom/never-used (for decluttering into a separate section)
- Whether the "Quick Add Matter" needs batch import or one-at-a-time
- For v2 direct generation: whether David wants a CLI command, a Cowork skill, or both

---

# 9. Next Best Action

Have David test the updated templates with a real matter to verify the tag fixes produce correct output. Continue debugging any remaining import bugs.

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
- **All 36 probate/local templates pass tag audit** — zero mismatches after fixing 16 templates
- **Three lifecycle sections** in matter view, now dynamic by admin type:
  - **Open Estate** — wizard auto-configures from saved/inferred selections; opening forms load automatically
  - **Estate Administration** — formal: Notice to Creditors + Inventory; summary: Notice to Creditors
  - **Close Estate** — formal: Petition/Order of Discharge; summary: Will admission orders
  - **All forms** — collapsed fallback with bundles + full checklist
- **Claude Import feature** — "Import from Claude" button in sidebar. Paste JSON → auto-preview → creates/updates client + matter + all form fields + infers wizard selections. Schema in `claude_import_schema.md`, example in `examples/muscara_import.json`.
- **Wizard persistence** — `matter.wizardSelections` saves admin type, will, jurisdiction, petitioners, county. Auto-restored on re-entry.
- **Human-readable filenames** — downloads use form names not IDs
- **Cross-form data sharing** — fields entered on one form auto-populate into others
- **Homepage dashboard** — recent matters, quick actions, overview stats
- **GitHub Pages disabled** — local only
- **No login required** — auth disabled for local dev

### How the sections work
- `formSections` in app.js has `formal` and `summary` sub-configs under `probate`
- `populateFormSections()` reads `currentMatter.wizardSelections.adminType` to pick the right set
- Section headers and subtitles update dynamically
- `wizardLoadForms()` calls `populateFormSections()` after saving selections so sections update immediately

### What's next (priority order)
1. **Fix remaining import bugs** David found (unspecified — debug first)
2. **Declutter sections** — David will identify seldom-used forms
3. **Claude direct generation (v2)** — "Draft the petition" in chat → .docx output
4. **Quick Add Matter** — onboard existing mid-stream matters without wizard
5. **Ancillary Broward checklists** — URLs captured
6. **Case management system** — track assets, dates, deadlines, and todos per matter

### Key files
- `app.js` — all application logic (~1950 lines), includes wizard persistence, sections, import, batch generation
- `forms.json` — 41 form definitions with all field/section structure
- `index.html` — single-page app shell with wizard + section cards + import modal
- `styles.css` — all styles including section card styling
- `claude_import_schema.md` — field reference for Claude to generate import JSON
- `examples/muscara_import.json` — real-world import example
- `CLAUDE.md` — full project context (read this first)

### Key code locations
- `formSections` object — formal/summary sub-configs for lifecycle sections
- `populateFormSections()` — picks formal vs summary based on wizardSelections.adminType
- `initWizardForMatter()` — restores/infers wizard selections, auto-loads forms
- `confirmClaudeImport()` — infers `wizardSelections` from import data
- `renderFormSection()` / `toggleSectionForm()` — section card rendering and interaction
- `wizardLoadForms()` — saves `wizardSelections` to matter, updates sections

### Constraints
- Personal tool, never for sale (FLSSI license restriction)
- No required fields during build phase
- Probate first, guardianship later
- Save all artifacts to Dropbox project folder
- Git commit and push at end of every session
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896

---
