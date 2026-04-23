# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-23 (evening)
**Source:** Claude Code session — questionnaire UX overhaul (Phases 1–4)
**Status:** 4 phases of UX cleanup committed + pushed on branch `phase1-2-questionnaire-cleanup` — UNMERGED, needs live test before merging to main

---

# 0. READ FIRST — State as of 2026-04-23 evening

**Major branch of work done today, sitting on `phase1-2-questionnaire-cleanup`.** Six commits based on live-test feedback from the `Bush, George 2026-04-23` bundle. All four phases audit-clean and syntax-clean; verified visually in a preview render. **Not tested end-to-end through the real OAuth'd app yet.**

**Branch is pushed to GitHub:** `origin/phase1-2-questionnaire-cleanup`
Compare/merge URL: https://github.com/davidshulman22/guardianship-forms/compare/main...phase1-2-questionnaire-cleanup

**To pick up on another computer or in a new session:**
```bash
cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
git fetch origin
git checkout phase1-2-questionnaire-cleanup
git pull   # ensure up to date
```
If the project isn't cloned on the other machine yet:
```bash
git clone https://github.com/davidshulman22/guardianship-forms.git
cd guardianship-forms
git checkout phase1-2-questionnaire-cleanup
```

Branch commits (newest first):
1. `b405852` Update HANDOFF for Phase 1-4 questionnaire UX branch
2. `aedd90b` Phase 4 fix: preserve legacy string addresses on migration
3. `77c96cf` Phase 4: Structured address field type with foreign toggle
4. `b5fbff6` Phase 3: Date field type + SSN pattern input
5. `e505ef8` Phase 2: Questionnaire UX improvements
6. `5a23de3` Phase 1: Drop draft-time-unknown fields from formal-admin

Diff summary: 10 files, +650 / −134.

**What the phases do:**

**Phase 1 — Remove draft-time-unknown fields.** The Bush live test surfaced several questionnaire fields the user can't know at drafting time. Removed from forms.json + templates rebuilt with blanks where they used to render:
- `signing_month` / `signing_year` (from P3-PETITION + P3-OATH) — template now renders `___ day of __________, 20__`
- `notary_online` (P3-OATH) — template renders both checkbox glyphs: `☐ online notarization or ☐ physical presence`
- `bond_required` (P3-ORDER) — template defaults to "to serve without bond" (court enters separate order if bond needed)
- `will_status_original` / `_authenticated_other` / `_authenticated_notarial` (P3-PETITION) — template defaults to "accompanies this petition"

**Phase 2 — Questionnaire UX cleanup.** Built a general conditional-visibility / row-locking system, then applied to the specific Bush feedback items:
- **Petitioner-same-as-PR** checkbox at top of Petitioners section. When checked: petitioners group hides; at render time `prepareTemplateData()` mirrors `prs` rows into `petitioners` (interest defaults to "the nominated personal representative"). 95%+ of matters can now just check this box.
- **Wizard-driven row lock.** `wizardLoadForms()` now writes `multiple_petitioners` / `multiple_prs` booleans to `matter.matterData` based on the "single/multiple" wizard answer. Repeating-group fields can declare `row_lock_unless_matter_flag: 'multiple_prs'` — when that flag is false, the UI caps at 1 row and hides "+ Add Row". Applied to `petitioners` + `prs` in P3-PETITION, P3-OATH, P3-ORDER.
- **Generic `visible_if` system.** Fields/subfields can declare `visible_if: { field: X, equals | not_equals: V }`. `applyConditionalVisibility()` runs after every `collectFormData()`. Subfield-scoped visibility references other subfields in the same RG row (e.g. `ben_year_of_birth` visible only when `ben_is_minor` checked).
- **New `info` field type** — severity-styled callouts (info/warning/danger). Used for two callouts on P3-PETITION:
  - Venue section: info callout explaining §733.101 checkbox choices.
  - PR section: **danger callout warning about felony disqualification** (§733.303(1)(a)) — Bush feedback #13.
- **Venue as checkboxes + "Other".** Three statutory §733.101 reasons as checkboxes, plus free-text Other. `prepareTemplateData()` composes into a single prose string for `{venue_reason}`.
- **Beneficiary minor gating.** New `ben_is_minor` checkbox subfield; `ben_year_of_birth` is `visible_if ben_is_minor == true`. At render time, non-minors get `N/A` in the beneficiary table.

**Phase 3 — `date` field type + SSN pattern.**
- New `date` type, supported at top-level AND as RG subfield. Renders a native `<input type="date">`; storage is ISO `YYYY-MM-DD`.
- `collectDateFieldNames()` walks selected forms; `prepareTemplateData()` converts every ISO date to `"Month D, YYYY"` for template rendering. Legacy free-text dates pass through unchanged (backward-compatible).
- Applied to `decedent_death_date` + `will_date` (also merged `will_year` into the single `will_date` date field). `codicil_dates` stays free-text (multiple dates harder to validate).
- New optional field attrs: `pattern`, `maxlength`, `inputmode`, `placeholder` (applied at both top-level and RG subfield render). `decedent_ssn_last4` now uses `pattern="\d{4}" maxlength=4 inputmode=numeric placeholder="e.g. 1234"`.

**Phase 4 — Structured `address` field type.**
- New `address` type. Storage shape:
  ```js
  { street, line2, city, state, zip, foreign, foreign_text }
  ```
- Renders: street → line2 → (city / state dropdown / zip) grid + "Foreign (non-US) address" toggle that swaps the US grid for a free-text textarea.
- State dropdown: 50 states + DC + 5 territories (57 total).
- Zip pattern `\d{5}(-\d{4})?`; state pre-selects based on stored value.
- Supported at top-level AND as RG subfield (compact sub-grid inside each row).
- `formatAddressValue()` composes structured object → `"123 Main St, Apt 4, Miami, FL 33101"` for `{pet_address}`-style template tags. Legacy plain-string addresses on older matters pass through unchanged.
- **Legacy migration**: on first render of a plain-string address, show it as a foreign (free-text) entry so user doesn't lose data on first interaction. They can re-enter structured if US.
- Migrated to `type: address`: `decedent_address`, `domiciliary_court_address`, `domiciliary_representative_address` (top-level); `pet_address`, `pr_address`, `ben_address` (RG subfields).
- **Deferred**: `resident_agent_address` stays text per David's note ("may not be necessary now, but later"). BW-0040 rewrite queued with other legacy BW templates.

---

# 1. Objective

Browser-based Florida court form generator for Ginsberg Shulman, PL. Runs client-side with docxtemplater; data in Supabase (RLS-gated) with Microsoft OAuth sign-in. Live at `https://davidshulman22.github.io/guardianship-forms/`. Eventual direction: complete probate + guardianship file management system.

---

# 2. Current State (as of branch `phase1-2-questionnaire-cleanup`)

**Once merged, reflects:**
- **39 forms** in forms.json (5 guardianship, 24 summary admin / closing / general / inventory / notice, 4 smart formal-admin, 6 Broward local)
- **9 templates on the new builder pattern** — G2-010, G2-140, G3-010, G3-025, G3-026, P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS
- **~25 legacy templates remain** — all summary admin, closing, Broward local, Inventory, Notice to Creditors, Notice of Designation
- **Tag audit passes** (`python3 scripts/audit_tags.py`)
- **Questionnaire layer** now supports: `info`, `date`, `address` field types; `visible_if` conditional visibility; `row_lock_unless_matter_flag` for repeating groups; RG subfield checkboxes; per-field attrs (`pattern`/`maxlength`/`inputmode`/`placeholder`).

**If the branch is abandoned, everything above reverts.** Main still has the pre-Bush-feedback state from 2026-04-23 morning.

---

# 3. Work Completed This Session (2026-04-23 evening)

See Section 0 for the phase breakdown. All commits on branch `phase1-2-questionnaire-cleanup`. Audit passes, `node --check app.js` passes, `json.load('forms.json')` passes. Preview-rendered P3-PETITION confirms all new field types display correctly (venue callout, felony warning, structured address with state dropdown, date inputs, SSN pattern, petitioner-same-as-PR checkbox, PR row lock active).

**Infrastructure added**:
- `renderAddressField(opts)` — reusable address renderer (top-level + subfield)
- `formatAddressValue(raw)` — object → prose
- `formatDateFieldValue(raw)` — ISO → "Month D, YYYY"
- `collectDateFieldNames()` / `collectAddressFieldNames()` — walk selected forms for type-based post-processing
- `applyConditionalVisibility()` — runs after every `collectFormData()`
- `applyVisibleIfAttrs(el, visibleIf, scope)` — tags DOM with visibility metadata
- `getMatterFlag(name)` — reads `matter.matterData[name]` for row-lock decisions
- `US_STATES` constant (57 entries)

---

# 4. Key Decisions (this session)

| Decision | Why |
|----------|-----|
| Remove bond question from questionnaire | Court decides bond — asking at drafting is noise. If bond is required, the court enters a separate order. |
| Remove will-status + notarization-mode checkboxes | Filing-time facts, not draft-time. Templates default to the common case ("accompanies this petition" / both notary glyphs) and user edits at signing. |
| Felony disqualification as a warning, not a field | §733.303(1)(a) makes a felon categorically disqualified — asking the yes/no would imply the petition could proceed with "yes". Warning in red danger callout instead. |
| Structured address with foreign toggle | Can't force a 50-state dropdown for non-US addresses; toggle swaps to free-text. |
| Legacy string addresses → foreign free-text on migration | Don't silently lose existing data; show it as foreign until user re-enters structured. |
| Petitioner-same-as-PR auto-copy via single checkbox | 95%+ of matters have identical petitioner + PR; eliminates duplicate data entry. When different, uncheck and fill both. |
| Wizard-driven row locking | Wizard answer ("single" vs "multiple") should constrain the form. Prevents user from adding rows the wizard said wouldn't exist. |

---

# 5. Constraints & Preferences

Unchanged from prior handoff:
- Vanilla JS, no frameworks — single `app.js`, `index.html`, `styles.css`
- docxtemplater (CDN) for `.docx` generation, PizZip, FileSaver.js
- All form field definitions in `forms.json`, NOT in app.js
- Template tags: `{field}` for text, `{#cond}...{/cond}` for conditionals, `{^cond}...{/cond}` for negation, `{#group}...{/group}` for loops
- No required fields during build phase
- Personal practice tool, never for sale
- Git commit + push at end of every session (branch work: push after live test)

**New conventions introduced this session (forms.json schema):**
- `visible_if: { field, equals | not_equals }` on any field or subfield
- `row_lock_unless_matter_flag: "flag_name"` on repeating_group fields
- Field types: `info` (severity + content), `date`, `address`
- Field attrs: `pattern`, `maxlength`, `inputmode`, `placeholder` (all optional)
- Info field names prefixed with `_` (e.g. `_pr_felony_warning`) to signal non-data fields

---

# 6. Remaining Work

**Priority 0 — Live test + merge the branch (IMMEDIATE):**

Steps (cold-start friendly — works on Mac Studio, MacBook Air, or a fresh clone):

1. Get onto the branch:
   ```bash
   cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
   git fetch origin
   git checkout phase1-2-questionnaire-cleanup
   git pull
   ```
2. Start local server if needed: `python3 -m http.server 8765` (or use `scripts/serve.py`). Open `http://localhost:8765`. Hard-refresh (Cmd+Shift+R).
3. Sign in with Microsoft OAuth.
4. Create a new test matter (any decedent name, Broward county, testate, single petitioner, domiciliary).
5. Run the Open Estate wizard, load forms.
6. Exercise each new feature in the questionnaire:
   - **Petitioner-same-as-PR** checkbox at top of Petitioners section — toggle it, verify the Petitioners repeating group hides/shows
   - **Structured address** (Decedent's last known address) — fill out street, city, state dropdown (try picking FL), zip. Also try the "Foreign" toggle.
   - **SSN last 4** — should reject more than 4 chars and non-digits
   - **Date of death** — native date picker
   - **Venue** — three §733.101 checkboxes + "Other" free-text
   - **Red warning above Proposed PR section** about felony disqualification (visually distinctive)
   - **PR row lock** — should NOT show "+ Add Row" (single-PR wizard answer)
   - **Beneficiaries** — add a row, check "Is a minor" → year-of-birth field should appear. Uncheck → disappears.
7. Click Generate, open the .docx files. Verify:
   - Petitioner names auto-filled from PR (if same-as-PR was checked)
   - Address renders as `"123 Main St, Apt 4, Miami, FL 33101"` (or free-text if foreign)
   - Dates render as `"March 2, 2026"` not ISO
   - Venue section reads as prose (composed from the checkbox selections)
   - Signing date blank is `___ day of __________, 20__`
   - Notary mode has both `☐ online notarization or ☐ physical presence`
   - Order says "to serve without bond" (no bond question anymore)
   - Beneficiary table shows `N/A` for non-minors
8. If clean: merge + push.
   ```bash
   git checkout main
   git merge phase1-2-questionnaire-cleanup
   git push
   ```
   GitHub Pages will redeploy automatically.
9. If bugs found: tell the new Claude session what's broken, fix on the branch, re-test, then merge.

**Rollback plan if merge was a mistake:** `git reset --hard HEAD~1 && git push --force-with-lease` on main (or better, `git revert <merge-commit>` for a forward-only fix).

**Priority 1 — Complete probate template rebuild (IN PROGRESS):**
- [x] Formal admin opening — **DONE** via 4 smart templates (P3-PETITION / P3-OATH / P3-ORDER / P3-LETTERS)
- [x] Live test formal admin opening — done 2026-04-23 morning (Bush, George). Feedback addressed by the branch above.
- [ ] **BW-0040** — legacy template. Rewrite when rebuilding: drop the felony yes/no question (disqualified anyway; warning already in petition), clean up the criminal history affidavit.
- [ ] P3-0740 Notice to Creditors
- [ ] P3-0900 Inventory (rewire to `estate_assets` repeating group; leverage the new `address` type for asset addresses if useful)
- [ ] Notice of Administration (new — consolidate FLSSI P3-0802/0804 into one smart `P3-NOTICE-ADMIN`)
- [ ] Summary admin (P2-*, 19 templates) — strong candidate for smart-template consolidation
- [ ] Discharge (P5-0400, P5-0800)
- [ ] Broward locals (BW-*, 6 templates)
- [ ] P1-0900 Notice of Designation of Email

**Priority 1b — Matter-level data interview (architectural, NOT YET STARTED):**
- Lift decedent/AIP/relatives/assets up from per-form `formData` to `matter.matterData`. Today's wizard propagation of `multiple_petitioners` / `multiple_prs` is a small step in this direction.
- Weekend-sized. Don't start without asking David.
- Prerequisite for the file-management-system direction.

**Priority 2 — FLSSI catalog build-out (waiting on David):**
- David marks `[x]` in SKIP column of `docs/FORMS_CATALOG_MAP.md`; then build all unmarked forms using the new builder pattern.

**Priority 3 — Import bug testing:**
- End-to-end test import → wizard → generate → download.

**Priority 4 — Claude direct document generation (v2):**
- "Draft the petition" in chat → .docx output, no browser interaction.

**Priority 5 — Quick Add Matter:**
- Onboard existing mid-stream matters without the opening wizard.

**Priority 6 — Ancillary Broward checklists** (PDFs captured 2026-04-17 under `reference/`).

**Priority 7 — Case management / file management system (LONG-TERM).** See `docs/CASE_MANAGEMENT_SYSTEM_PLAN.md`.

---

# 7. Known Issues / Risks

- **Branch not end-to-end tested.** Visual preview of rendering is clean, but full OAuth → wizard → questionnaire → generate → docx round-trip hasn't been exercised. Possible issues: (a) Supabase save of new nested-object address shape, (b) cross-form data sharing interaction with `visible_if`, (c) legacy test data in Supabase with old string addresses.
- **Legacy string addresses display as "Foreign" on migration.** Intentional (preserves data) but may confuse users with pre-existing matters. User toggles off Foreign to re-enter structured.
- **Orphaned Supabase rows with old field names** (will_year, signing_month, bond_required, will_status_*, notary_online) from matters created before this branch. Not a failure mode — they're just unused. No migration needed; fresh matters won't have them.
- **`resident_agent_address` still free-text.** Deferred.
- ~25 probate/local templates still on legacy 2-column FLSSI layout. Rebuild queue.
- python-docx numbering workaround (`_inject_numbering_part`) unchanged.

---

# 8. Next Best Action

1. **Live test the branch** (see Priority 0 above). This is the only blocker before merging.
2. **Merge + push** if clean.
3. Pick next target from Priority 1 list — recommend **BW-0040 rewrite** next (drops the felony question and aligns with the new petition's warning), or **Notice to Creditors** (smaller, self-contained).

---

# 9. Drop-In Starter Prompt for New Chat

> Copy and paste this entire block into a new chat to resume immediately.

---

## Handoff — GS Court Forms

**Where it is (Mac Studio / MacBook Air):** `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project`
**Repo:** `https://github.com/davidshulman22/guardianship-forms` (username: `davidshulman22`)
**Live:** `https://davidshulman22.github.io/guardianship-forms/` (GitHub Pages, deploys from `main`)
**Local dev:** `cd` to project dir, run `python3 -m http.server 8765` (or use the running one). Open `http://localhost:8765`. Hard-refresh (Cmd+Shift+R) to bust cached forms.json / app.js.

### Current branch state

- **`main`** (origin synced) — pre-Bush-feedback state (2026-04-23 morning). 4 smart formal-admin templates + 5 guardianship on new pattern. **This is what the live GitHub Pages site serves.**
- **`phase1-2-questionnaire-cleanup`** (origin synced) — UNMERGED branch with 6 commits implementing the Bush-feedback UX overhaul. Needs live test before merging.
  - GitHub: https://github.com/davidshulman22/guardianship-forms/tree/phase1-2-questionnaire-cleanup
  - Compare: https://github.com/davidshulman22/guardianship-forms/compare/main...phase1-2-questionnaire-cleanup

**To pick up the branch on any machine:**
```bash
cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
git fetch origin
git checkout phase1-2-questionnaire-cleanup
git pull
```
Then refresh `http://localhost:8765`, exercise the new questionnaire (see §6 Priority 0 test checklist below), merge to main if clean:
```bash
git checkout main
git merge phase1-2-questionnaire-cleanup
git push
```

### What's in the branch (summary)
- Dropped draft-time-unknown fields (signing dates, notary mode, bond, will-status checkboxes). Templates render blanks/defaults.
- New field types: `info` (severity callout), `date` (native picker + ISO → prose), `address` (structured with foreign toggle).
- New capabilities: `visible_if` conditional visibility, `row_lock_unless_matter_flag` on repeating groups, per-field input attrs (`pattern`/`maxlength`/`inputmode`/`placeholder`), RG subfield checkboxes.
- UX fixes: petitioner-same-as-PR auto-copy, wizard-driven row lock for single-PR matters, felony danger callout, venue checkbox list (§733.101), minor Y/N gate for beneficiary year-of-birth.

### What's next
**Pre-merge:** live test the branch. Post-merge:
- BW-0040 rewrite (drop felony question)
- P3-0740 Notice to Creditors
- P3-0900 Inventory (wire to `estate_assets`)
- New `P3-NOTICE-ADMIN` smart template (consolidates P3-0802 + P3-0804)
- Summary admin (P2-*) smart-template consolidation
- Discharge + Broward + P1-0900 rebuilds

### Key files
- `app.js` — ~2400 lines. New helpers: `renderAddressField`, `formatAddressValue`, `formatDateFieldValue`, `collectDateFieldNames`, `collectAddressFieldNames`, `applyConditionalVisibility`, `applyVisibleIfAttrs`, `getMatterFlag`. `US_STATES` constant.
- `auth.js` — Microsoft OAuth + Supabase session handling
- `scripts/build_guardianship_templates.py` — builder + all shared helpers
- `scripts/build_probate_templates.py` — probate builder
- `scripts/audit_tags.py` — tag audit (`python3 scripts/audit_tags.py`). `venue_reason` now in AUTO_POPULATED (composed from checkboxes).
- `forms.json` — 39 form definitions with new schema (visible_if, row_lock_unless_matter_flag, info/date/address field types, input attrs)
- `styles.css` — new classes: `.field-info-callout` (+ `-info`/`-warning`/`-danger`), `.address-field` (+ `-grid` / `-row-3` / `-foreign-toggle` / `-foreign-wrap`)
- `supabase-setup.sql` — DB schema + trigger allow-list for admin
- `CLAUDE.md` — full project context with builder pattern notes
- `docs/FORMS_CATALOG_MAP.md` — FLSSI 2025 catalog with SKIP checkboxes

### forms.json schema additions (from the branch)
```json
{
  "name": "field_name",
  "type": "info | date | address | text | number | checkbox | textarea | repeating_group",
  "severity": "info | warning | danger",   // info type only
  "content": "<html>...</html>",            // info type only
  "pattern": "\\d{4}",                      // text type — client-side validation
  "maxlength": 4,
  "inputmode": "numeric",
  "placeholder": "e.g. 1234",
  "visible_if": { "field": "other_field", "equals": true },
  "row_lock_unless_matter_flag": "multiple_prs"   // repeating_group only
}
```

### Builder pattern (unchanged)
See `CLAUDE.md` for the Python builder pattern; all new templates must go through `build_probate_templates.py` / `build_guardianship_templates.py`. Never hand-edit .docx.

### Git discipline
- Project in Dropbox (intentional). Git is source of truth.
- Start: `git pull`. End: commit + push.
- Branch work: push after live test, not before.

### Constraints
- Personal tool, never for sale
- No required fields during build phase
- File No. always optional
- David: Bar 150762, 954-990-0896 (probate). Jill: Bar 813850, 954-332-2310 (guardianship). Maribel: paralegal, not in ATTORNEY_PROFILES.

---
