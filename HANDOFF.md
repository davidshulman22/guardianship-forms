# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-23 (late evening)
**Source:** Claude Code session — questionnaire UX overhaul (Phases 1–5)
**Status:** 5 phases of UX cleanup on branch `phase1-2-questionnaire-cleanup` — UNMERGED, partial live test, needs completion before merging to main

---

# 0. READ FIRST — State as of 2026-04-23 late evening

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

**Live-test status (partial):** David started the live test on 2026-04-23 evening. The first round surfaced that the Broward mandatory checklist forms asked *filing verification* questions that are unanswerable at drafting time (e.g. "Death certificate was filed", "Original will deposited with Clerk"). We pivoted mid-test and converted those forms to **PDF passthrough** (bundle the clerk's official PDF unchanged — see Phase 5 below). **David did NOT complete the full end-to-end .docx verification pass.** When picking up tomorrow, hard-refresh the browser and re-run the full Priority 0 checklist.

Branch commits (newest first — tonight's work still uncommitted at the moment this HANDOFF is being written; the actual commit SHAs will appear after `git log` once the session wrap-up commit lands):
1. Phase 5: PDF passthrough for Broward checklists + BW-0010; P1-0900 rebuilt on new pattern *(tonight)*
2. `5e1c2a1` HANDOFF: cross-machine pickup instructions + pushed branch URL
3. `b405852` Update HANDOFF for Phase 1-4 questionnaire UX branch
4. `aedd90b` Phase 4 fix: preserve legacy string addresses on migration
5. `77c96cf` Phase 4: Structured address field type with foreign toggle
6. `b5fbff6` Phase 3: Date field type + SSN pattern input
7. `e505ef8` Phase 2: Questionnaire UX improvements
8. `5a23de3` Phase 1: Drop draft-time-unknown fields from formal-admin

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
- **Deferred**: `resident_agent_address` stays text per David's note ("may not be necessary now, but later").

**Phase 5 — PDF passthrough for Broward checklists + P1-0900 rebuild (tonight).**

*Context:* The live-test pivot. David hit the BW-0020 "Filing Verification" section in the questionnaire and said: "I don't think we should have this on first generation … it's impossible to answer. We're creating the documents."

His resolution: for forms whose content is 100% post-filing verification or by-hand notary data, *don't generate a .docx at all* — bundle the clerk's official PDF unchanged into the zip. The clerk has to accept their own form exactly as published; any re-typesetting risks rejection.

- **New `delivery: "pdf_passthrough"` schema on forms.json entries.** `template` field now points at the PDF in `reference/` instead of a .docx under `templates/`.
- **5 forms converted to passthrough**:
  | Form | Clerk's PDF used |
  |---|---|
  | BW-0010 Affidavit Regarding Criminal History | `reference/Broward-Affidavit-Criminal-History.pdf` |
  | BW-0020 Mandatory Checklist — Formal Admin Testate | `reference/Broward-Checklist-Formal-Admin-Testate.pdf` |
  | BW-0030 Mandatory Checklist — Formal Admin Intestate | `reference/Broward-Checklist-Formal-Admin-Intestate.pdf` |
  | BW-0040 Mandatory Checklist — Summary Admin Testate | `reference/Broward-Checklist-Summary-Admin-Testate.pdf` |
  | BW-0050 Mandatory Checklist — Summary Admin Intestate | `reference/Broward-Checklist-Summary-Admin-Intestate.pdf` |
- **app.js changes**: `renderSingleDoc()` short-circuits on `delivery === 'pdf_passthrough'` — fetches the PDF and returns the bytes as a `Blob` unchanged (no docxtemplater involvement). `makeDocFileName()` emits `.pdf` for passthrough forms instead of `.docx`. Two unsafe `form.sections.*` accesses guarded with `|| []` to tolerate forms with no questionnaire fields.
- **audit_tags.py** skips passthrough forms (the legacy .docx files for BW-0020/0030/0040/0050 stay on disk unused — they're just not referenced by forms.json anymore).
- **P1-0900 (Notice of Designation of Email Addresses) rebuilt on the new builder pattern.** New `build_p1_0900()` in `scripts/build_probate_templates.py`. Matches P3-PETITION/P3-OATH formatting (probate caption via `_add_probate_caption`, Broward AI certification via `_add_broward_ai_certification`, running header "Estate of …", 1.5-line spacing, attorney-only signature block with blank `___ day of __________, 20__` signing line — same Phase-1 treatment). Questionnaire section cleared entirely — all four fields (`attorney_email`, `attorney_email_secondary`, `attorney_bar_no`, `attorney_phone`) auto-populate from the attorney profile.
- **Future work deferred (explicit from David tonight):**
  - Re-integrate the checklists as an interactive pre-filing review step once the system is more complete.
  - Add rule-violation warnings (e.g. "decedent has non-FL residence but petitioner isn't related" triggers a Broward-checklist rule) surfaced at questionnaire time.

*Tag audit passes:* `python3 scripts/audit_tags.py` → PASS.

---

# 1. Objective

Browser-based Florida court form generator for Ginsberg Shulman, PL. Runs client-side with docxtemplater; data in Supabase (RLS-gated) with Microsoft OAuth sign-in. Live at `https://davidshulman22.github.io/guardianship-forms/`. Eventual direction: complete probate + guardianship file management system.

---

# 2. Current State (as of branch `phase1-2-questionnaire-cleanup`)

**Once merged, reflects:**
- **39 forms** in forms.json (5 guardianship, 24 summary admin / closing / general / inventory / notice, 4 smart formal-admin, 6 Broward local — of which 5 are now PDF passthrough)
- **10 templates on the new builder pattern** — G2-010, G2-140, G3-010, G3-025, G3-026, P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS, **P1-0900**
- **5 forms delivered as clerk PDF passthrough** — BW-0010, BW-0020, BW-0030, BW-0040, BW-0050
- **~24 legacy templates remain** — all summary admin, closing, BW-0060 (Affidavit of Heirs), Inventory, Notice to Creditors
- **Tag audit passes** (`python3 scripts/audit_tags.py`)
- **Questionnaire layer** now supports: `info`, `date`, `address` field types; `visible_if` conditional visibility; `row_lock_unless_matter_flag` for repeating groups; RG subfield checkboxes; per-field attrs (`pattern`/`maxlength`/`inputmode`/`placeholder`); `delivery: pdf_passthrough` to bundle official PDFs unchanged.

**If the branch is abandoned, everything above reverts.** Main still has the pre-Bush-feedback state from 2026-04-23 morning.

---

# 3. Work Completed 2026-04-23 (two sessions)

**Evening session (Mac Studio):** Phases 1–4. See phase breakdown in Section 0. All commits `5a23de3` through `5e1c2a1` on branch `phase1-2-questionnaire-cleanup`.

**Late evening session (Mac Studio, pivot from partial live test):** Phase 5 — PDF passthrough + P1-0900 rebuild. Uncommitted at the moment this HANDOFF is written; next action is to commit + push (see Section 6 Priority 0).

**Infrastructure added across the branch:**
- `renderAddressField(opts)` — reusable address renderer (top-level + subfield)
- `formatAddressValue(raw)` — object → prose
- `formatDateFieldValue(raw)` — ISO → "Month D, YYYY"
- `collectDateFieldNames()` / `collectAddressFieldNames()` — walk selected forms for type-based post-processing
- `applyConditionalVisibility()` — runs after every `collectFormData()`
- `applyVisibleIfAttrs(el, visibleIf, scope)` — tags DOM with visibility metadata
- `getMatterFlag(name)` — reads `matter.matterData[name]` for row-lock decisions
- `US_STATES` constant (57 entries)
- **Phase 5 additions**: `renderSingleDoc()` passthrough short-circuit, `makeDocFileName()` ext switch, `build_p1_0900()` in probate builder, `passthrough_form_ids()` in audit_tags.py.

---

# 4. Key Decisions (this branch)

| Decision | Why |
|----------|-----|
| Remove bond question from questionnaire | Court decides bond — asking at drafting is noise. If bond is required, the court enters a separate order. |
| Remove will-status + notarization-mode checkboxes | Filing-time facts, not draft-time. Templates default to the common case ("accompanies this petition" / both notary glyphs) and user edits at signing. |
| Felony disqualification as a warning, not a field | §733.303(1)(a) makes a felon categorically disqualified — asking the yes/no would imply the petition could proceed with "yes". Warning in red danger callout instead. |
| Structured address with foreign toggle | Can't force a 50-state dropdown for non-US addresses; toggle swaps to free-text. |
| Legacy string addresses → foreign free-text on migration | Don't silently lose existing data; show it as foreign until user re-enters structured. |
| Petitioner-same-as-PR auto-copy via single checkbox | 95%+ of matters have identical petitioner + PR; eliminates duplicate data entry. When different, uncheck and fill both. |
| Wizard-driven row locking | Wizard answer ("single" vs "multiple") should constrain the form. Prevents user from adding rows the wizard said wouldn't exist. |
| PDF passthrough for Broward checklists + criminal-history affidavit | Clerk publishes these forms as PDFs and expects them back in that exact form. Re-typesetting them in .docx risks rejection. At drafting time the verification checkboxes are unanswerable anyway ("was the death certificate filed?" — we're still creating the package). Bundling the clerk's PDF unchanged is the correct answer until the system becomes a full file-management system that can track filing state. |
| P1-0900 rebuilt as .docx (not passthrough) | Only three fields (`signing_day/month/year`) were unanswerable — same Phase-1 treatment (drop + blank line in template). Attorney info all auto-populates. PDF passthrough made no sense when the attorney knows their own emails/bar/phone. |

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

**New conventions introduced during this branch (forms.json schema):**
- `visible_if: { field, equals | not_equals }` on any field or subfield
- `row_lock_unless_matter_flag: "flag_name"` on repeating_group fields
- Field types: `info` (severity + content), `date`, `address`
- Field attrs: `pattern`, `maxlength`, `inputmode`, `placeholder` (all optional)
- Info field names prefixed with `_` (e.g. `_pr_felony_warning`) to signal non-data fields
- **`delivery: "pdf_passthrough"`** on form entries — signals "bundle this PDF unchanged instead of rendering a .docx". `template` field points at a PDF under `reference/`. `sections: []` (no questionnaire fields).

---

# 6. Remaining Work

**Priority 0 — Finish the live test + merge the branch (IMMEDIATE, tomorrow morning):**

Steps (cold-start friendly — works on Mac Studio, MacBook Air, or a fresh clone):

1. Get onto the branch:
   ```bash
   cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
   git fetch origin
   git checkout phase1-2-questionnaire-cleanup
   git pull
   ```
   Verify you see the Phase 5 commit (PDF passthrough + P1-0900 rebuild) in `git log --oneline -5`.
2. Start local server if needed: `python3 -m http.server 8765` (or use `scripts/serve.py`). Open `http://localhost:8765`. Hard-refresh (Cmd+Shift+R).
3. Sign in with Microsoft OAuth.
4. Create a new test matter (any decedent name, **Broward** county, **testate**, **single petitioner**, **domiciliary**).
5. Run the Open Estate wizard, load forms. Expected bundle: `P3-PETITION`, `P3-ORDER`, `P3-OATH`, `P3-LETTERS`, `P1-0900`, `BW-0010`, `BW-0020`.
6. Exercise each new feature in the questionnaire:
   - **Petitioner-same-as-PR** checkbox at top of Petitioners section — toggle it, verify the Petitioners repeating group hides/shows.
   - **Structured address** (Decedent's last known address) — fill out street, city, state dropdown (try picking FL), zip. Also try the "Foreign" toggle.
   - **SSN last 4** — should reject more than 4 chars and non-digits.
   - **Date of death** — native date picker.
   - **Venue** — three §733.101 checkboxes + "Other" free-text.
   - **Red warning above Proposed PR section** about felony disqualification (visually distinctive).
   - **PR row lock** — should NOT show "+ Add Row" (single-PR wizard answer).
   - **Beneficiaries** — add a row, check "Is a minor" → year-of-birth field should appear. Uncheck → disappears.
   - **BW-0010, BW-0020 should NOT appear in the questionnaire at all** — they're PDF passthrough. Zero fields. (This is the fix for David's evening feedback.)
   - **P1-0900 should NOT appear in the questionnaire at all** — all attorney fields auto-populate.
7. Click Generate. Output is a `.zip` containing:
   - 5 generated `.docx` files (P3-PETITION, P3-ORDER, P3-OATH, P3-LETTERS, P1-0900)
   - 2 passthrough `.pdf` files (BW-0010, BW-0020)
8. Verify in the .docx files:
   - Petitioner names auto-filled from PR (if same-as-PR was checked)
   - Address renders as `"123 Main St, Apt 4, Miami, FL 33101"` (or free-text if foreign)
   - Dates render as `"March 2, 2026"` not ISO
   - Venue section reads as prose (composed from the checkbox selections)
   - Signing date blank is `___ day of __________, 20__`
   - Notary mode has both `☐ online notarization or ☐ physical presence`
   - Order says "to serve without bond" (no bond question anymore)
   - Beneficiary table shows `N/A` for non-minors
   - **P1-0900 looks like the P3-* templates**: running header with "Estate of …", single-column caption, Broward AI certification, attorney-only signature block
9. Verify the passthrough `.pdf` files:
   - Opening them should give the clerk's exact blank form — no branding, no altered layout, byte-for-byte the same as `reference/Broward-Affidavit-Criminal-History.pdf` / `reference/Broward-Checklist-Formal-Admin-Testate.pdf`.
   - The PR fills these by hand (affidavit at notary, checklist at filing-package-assembly time).
10. If clean: merge + push.
    ```bash
    git checkout main
    git merge phase1-2-questionnaire-cleanup
    git push
    ```
    GitHub Pages will redeploy automatically.
11. If bugs found: fix on the branch, re-test, then merge.

**Rollback plan if merge was a mistake:** `git reset --hard HEAD~1 && git push --force-with-lease` on main (or better, `git revert <merge-commit>` for a forward-only fix).

**Priority 1 — Complete probate template rebuild (IN PROGRESS):**
- [x] Formal admin opening — **DONE** via 4 smart templates (P3-PETITION / P3-OATH / P3-ORDER / P3-LETTERS)
- [x] P1-0900 Notice of Designation — **DONE** (Phase 5)
- [x] BW-0010 Criminal History — **DONE via PDF passthrough** (Phase 5)
- [x] BW-0020/0030/0040/0050 Mandatory Checklists — **DONE via PDF passthrough** (Phase 5)
- [x] Live test formal admin opening (first round) — done 2026-04-23 morning (Bush, George). Feedback addressed by Phases 1–5.
- [ ] **Complete live test** — see Priority 0.
- [ ] P3-0740 Notice to Creditors (rebuild)
- [ ] P3-0900 Inventory (rewire to `estate_assets` repeating group; leverage the `address` type for asset addresses if useful)
- [ ] Notice of Administration (new — consolidate FLSSI P3-0802/0804 into one smart `P3-NOTICE-ADMIN`)
- [ ] Summary admin (P2-*, 19 templates) — strong candidate for smart-template consolidation
- [ ] Discharge (P5-0400, P5-0800)
- [ ] BW-0060 Affidavit of Heirs (rebuild — last remaining BW legacy .docx)

**Priority 1b — Matter-level data interview (architectural, NOT YET STARTED):**
- Lift decedent/AIP/relatives/assets up from per-form `formData` to `matter.matterData`. Today's wizard propagation of `multiple_petitioners` / `multiple_prs` is a small step in this direction.
- Weekend-sized. Don't start without asking David.
- Prerequisite for the file-management-system direction.

**Priority 1c — Checklist re-integration (deferred, flagged by David tonight):**
- Once the app becomes a more complete file-management system, re-integrate the Broward mandatory checklists as an interactive **pre-filing review step** (not drafting-time).
- **Rule-violation warnings at questionnaire time**: e.g., if the beneficiaries repeating group includes a trust, surface a warning about the trust-disclosure requirement from the BW checklist; if decedent residence is non-FL and petitioner isn't related, flag the residency requirement. This is the "smart checklist" direction — checklist items become cross-validated derived facts, not questions asked of the user.

**Priority 2 — FLSSI catalog build-out (waiting on David):**
- David marks `[x]` in SKIP column of `docs/FORMS_CATALOG_MAP.md`; then build all unmarked forms using the new builder pattern.

**Priority 3 — Import bug testing:**
- End-to-end test import → wizard → generate → download.

**Priority 4 — Claude direct document generation (v2):**
- "Draft the petition" in chat → .docx output, no browser interaction.

**Priority 5 — Quick Add Matter:**
- Onboard existing mid-stream matters without the opening wizard.

**Priority 6 — Ancillary Broward checklists** (PDFs captured 2026-04-17 under `reference/` — Discharge, Disposition, Formal-Ancillary, Homestead, Instructions, Sell-Real-Property, Summary-Ancillary). Same passthrough pattern can apply if/when these forms are wired up.

**Priority 7 — Case management / file management system (LONG-TERM).** See `docs/CASE_MANAGEMENT_SYSTEM_PLAN.md`.

---

# 7. Known Issues / Risks

- **Branch live test incomplete.** Partial exercise on evening of 2026-04-23 surfaced the Filing Verification problem. Phase 5 fixed that, but the full end-to-end Priority 0 checklist has not been completed. Possible issues still untested: (a) Supabase save of new nested-object address shape, (b) cross-form data sharing interaction with `visible_if`, (c) legacy test data in Supabase with old string addresses, (d) whether the browser's `fetch(form.template)` correctly serves a PDF from `reference/` on GitHub Pages (it should — GH Pages serves the whole repo — but unverified).
- **Legacy string addresses display as "Foreign" on migration.** Intentional (preserves data) but may confuse users with pre-existing matters. User toggles off Foreign to re-enter structured.
- **Orphaned Supabase rows with old field names** (will_year, signing_month, bond_required, will_status_*, notary_online, cl_*, scl_*) from matters created before this branch. Not a failure mode — they're just unused. No migration needed; fresh matters won't have them.
- **`resident_agent_address` still free-text.** Deferred.
- **Legacy .docx files on disk for passthrough forms** (`templates/BW-0010.docx`, `templates/BW-0020.docx`, etc.) are no longer referenced by forms.json. Not deleted — left in place for git history / in case the passthrough approach is reversed. audit_tags.py skips them explicitly.
- **~24 legacy templates** still on 2-column FLSSI layout. Rebuild queue.
- **python-docx numbering workaround** (`_inject_numbering_part`) unchanged.

---

# 8. Next Best Action

1. **Commit + push the Phase 5 changes tonight (or first thing tomorrow).** The evening-session files are uncommitted. Command:
   ```bash
   cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
   git add app.js forms.json scripts/audit_tags.py scripts/build_probate_templates.py templates/P1-0900.docx templates/P3-LETTERS.docx templates/P3-OATH.docx templates/P3-ORDER.docx templates/P3-PETITION.docx HANDOFF.md .claude/launch.json
   git commit -m "Phase 5: PDF passthrough for BW checklists + P1-0900 rebuild"
   git push
   ```
   *(The P3-* .docx files got re-emitted by the builder script when P1-0900 was added — deterministic re-encoding, no semantic changes.)*
2. **Finish the live test** (see Priority 0 above).
3. **Merge + push** if clean.
4. Pick next target from Priority 1 list — recommend **P3-0740 Notice to Creditors** next (small, self-contained, establishes the pattern for the remaining summary-admin rebuilds).

---

# 9. Drop-In Starter Prompt for New Chat

> Copy and paste this entire block into a new chat to resume immediately.

---

## Handoff — GS Court Forms

**Where it is (Mac Studio / MacBook Air / anywhere with git):** `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project` — or clone fresh from `https://github.com/davidshulman22/guardianship-forms`.
**Live:** `https://davidshulman22.github.io/guardianship-forms/` (GitHub Pages, deploys from `main`)
**Local dev:** `cd` to project dir, run `python3 -m http.server 8765` (or use the running one). Open `http://localhost:8765`. Hard-refresh (Cmd+Shift+R) to bust cached forms.json / app.js.

### Current branch state

- **`main`** (origin synced) — pre-Bush-feedback state (2026-04-23 morning). **This is what the live GitHub Pages site serves.**
- **`phase1-2-questionnaire-cleanup`** (origin synced) — UNMERGED branch with 5 phases of work. Live test partial; needs completion before merging.
  - GitHub: https://github.com/davidshulman22/guardianship-forms/tree/phase1-2-questionnaire-cleanup
  - Compare: https://github.com/davidshulman22/guardianship-forms/compare/main...phase1-2-questionnaire-cleanup

**To pick up the branch on any machine:**
```bash
cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
git fetch origin
git checkout phase1-2-questionnaire-cleanup
git pull
```
Then refresh `http://localhost:8765`, complete the questionnaire live-test (see §6 Priority 0 test checklist below), merge to main if clean:
```bash
git checkout main
git merge phase1-2-questionnaire-cleanup
git push
```

### What's in the branch (summary)

**Phases 1–4** (earlier commits):
- Dropped draft-time-unknown fields (signing dates, notary mode, bond, will-status checkboxes). Templates render blanks/defaults.
- New field types: `info` (severity callout), `date` (native picker + ISO → prose), `address` (structured with foreign toggle).
- New capabilities: `visible_if` conditional visibility, `row_lock_unless_matter_flag` on repeating groups, per-field input attrs (`pattern`/`maxlength`/`inputmode`/`placeholder`), RG subfield checkboxes.
- UX fixes: petitioner-same-as-PR auto-copy, wizard-driven row lock for single-PR matters, felony danger callout, venue checkbox list (§733.101), minor Y/N gate for beneficiary year-of-birth.

**Phase 5** (latest commit — PDF passthrough):
- 5 Broward forms now bundle the clerk's official PDF unchanged instead of generating a .docx: BW-0010 (Criminal History affidavit), BW-0020/0030/0040/0050 (the four mandatory checklists). Rationale: the checklists ask filing-verification questions that are unanswerable at drafting time, and the clerk expects their form back byte-for-byte.
- New `delivery: "pdf_passthrough"` field on forms.json entries. `template` points at a PDF under `reference/`.
- P1-0900 Notice of Designation rebuilt on the P3-* builder pattern (probate caption, Broward AI cert, attorney-only signature block, blank signing date). Questionnaire fields all auto-populate from attorney profile — nothing to fill in.

### What's next
**Pre-merge:** complete the live test (Section 6 Priority 0). Post-merge:
- P3-0740 Notice to Creditors (next rebuild candidate)
- P3-0900 Inventory (wire to `estate_assets`)
- New `P3-NOTICE-ADMIN` smart template (consolidates P3-0802 + P3-0804)
- Summary admin (P2-*) smart-template consolidation
- Discharge + BW-0060 Affidavit of Heirs rebuild
- **Deferred:** checklist re-integration as interactive pre-filing review + rule-violation warnings (Priority 1c)

### Key files
- `app.js` — ~2400 lines. New helpers: `renderAddressField`, `formatAddressValue`, `formatDateFieldValue`, `collectDateFieldNames`, `collectAddressFieldNames`, `applyConditionalVisibility`, `applyVisibleIfAttrs`, `getMatterFlag`. `US_STATES` constant. `renderSingleDoc()` handles `delivery: pdf_passthrough`; `makeDocFileName()` emits `.pdf` for those.
- `auth.js` — Microsoft OAuth + Supabase session handling
- `scripts/build_guardianship_templates.py` — builder + all shared helpers
- `scripts/build_probate_templates.py` — probate builder (now includes `build_p1_0900()`)
- `scripts/audit_tags.py` — tag audit (`python3 scripts/audit_tags.py`). `venue_reason` now in AUTO_POPULATED (composed from checkboxes). Skips pdf_passthrough forms.
- `forms.json` — 39 form definitions. 5 forms with `delivery: pdf_passthrough` pointing into `reference/`.
- `reference/` — clerk-published PDFs bundled as-is by passthrough (`Broward-Affidavit-Criminal-History.pdf`, `Broward-Checklist-*.pdf`, etc.).
- `styles.css` — new classes: `.field-info-callout` (+ `-info`/`-warning`/`-danger`), `.address-field` (+ `-grid` / `-row-3` / `-foreign-toggle` / `-foreign-wrap`).
- `supabase-setup.sql` — DB schema + trigger allow-list for admin.
- `CLAUDE.md` — full project context with builder pattern notes.
- `docs/FORMS_CATALOG_MAP.md` — FLSSI 2025 catalog with SKIP checkboxes.

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

Form-level additions:
```json
{
  "id": "BW-0020",
  "name": "...",
  "delivery": "pdf_passthrough",
  "template": "reference/Broward-Checklist-Formal-Admin-Testate.pdf",
  "county": "Broward",
  "sections": []
}
```

### Builder pattern (unchanged)
See `CLAUDE.md` for the Python builder pattern; all new .docx templates must go through `build_probate_templates.py` / `build_guardianship_templates.py`. Never hand-edit .docx. PDF passthrough forms have no builder — they bundle the clerk's existing PDF from `reference/`.

### Git discipline
- Project in Dropbox (intentional). Git is source of truth.
- Start: `git pull`. End: commit + push.
- Branch work: push after live test, not before — but the Phase 5 commit should land tonight even with test incomplete, so tomorrow's machine can pull it.

### Constraints
- Personal tool, never for sale
- No required fields during build phase
- File No. always optional
- David: Bar 150762, 954-990-0896 (probate). Jill: Bar 813850, 954-332-2310 (guardianship). Maribel: paralegal, not in ATTORNEY_PROFILES.

---
