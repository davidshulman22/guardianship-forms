# CHAT HANDOFF — RESUME-READY
**Last updated:** 2026-04-29 (end of day)
**Status:** Phases 1–9 all merged + pushed to `main` and live. 38 forms, 38 active templates. Phase 8 + 7a/7b live-tested by Cowork on 2026-04-29 — 41/50 PASS, 5 real bugs found, all 5 fixed same day in commits `7fcc787` (BUG-3 + AI cert refactor) and `1d9ec4f` (BUG-1, BUG-4, BUG-5). Auto-test harness (`scripts/auto_test.py`) added in `7ed3c0a` — 19 PASS / 0 FAIL on current main, runs without browser/Cowork. Tag audit passes.

---

# 0. Where things stand

**Live:** https://davidshulman22.github.io/guardianship-forms/ — `main` is the deployed branch. Probate Phase 8 and guardianship Phase 7a/7b were live-tested by Cowork on 2026-04-29 (Chrome MCP + JS console). Five bugs found and fixed same day. Guardianship side still hasn't been put in front of Jill or Maribel for human user-feedback.

**Local pickup on any machine:**
```bash
cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
git pull
python3 -m http.server 8765   # http://localhost:8765
```

If a fresh clone is needed:
```bash
git clone https://github.com/davidshulman22/guardianship-forms.git
cd guardianship-forms
```

**Recent commit history (newest first):**
1. `7ed3c0a` Auto-test harness: 19 checks, no Cowork required (Phase 9c)
2. `76e5fba` Test artifacts from 2026-04-29 live test run (Phase 9b)
3. `1d9ec4f` Fix live-test bugs 1, 4, 5 (Phase 9a)
4. `7fcc787` AI cert: opt-in per form + add Miami-Dade AO 26-04 (Phase 9 — also fixes BUG-3)
5. `6e1d893` Phase 8e: P1-0800 Notice of Trust
2. `af94d8d` Phase 8d: integrate codicil flow into will templates (no standalone codicil templates)
3. `6fe3bc5` Phase 8c: P1-0100, P1-0620 (with notary), confidential info, curator suite, oath of witness, proof of will
4. `5ba68d9` Phase 8b: smart consolidations for Formal Notice + Proof of Service
5. `7ce14f5` Phase 8a: smart consolidations on the probate side (P1 batch + P2 summary admin)
6. `1112707` Phase 7e: universal caption fix (bold + county ALL CAPS)
7. `65b70d2` Phase 7d: guardianship live-test fixes (residence, same-as-petitioner)
8. `5008188` Phase 7c: structured address in client modal + toggle defaults unchecked
9. `fd0a4fa` Phase 7b: drop signing dates + consolidate AIP DOB across guardianship
10. `0ea3f33` Phase 7a: bring questionnaire UX upgrades to guardianship forms
11. `fd46146` Merge phase1-2-questionnaire-cleanup → main
12. `9915bb8` Phase 6b: second-batch live-test fixes
13. `0539ea3` Phase 6: live-test fixes (1/5/12/13/15 + drop file_no/division)
14. `8e6730f` Phase 5: PDF passthrough for Broward checklists + P1-0900 rebuild
15. `77c96cf` Phase 4: Structured address field type with foreign toggle

---

# 1. Objective

Browser-based Florida court form generator for Ginsberg Shulman, PL. Runs client-side with docxtemplater; data in Supabase (RLS-gated) with Microsoft OAuth sign-in. Eventual direction: complete probate + guardianship file management system.

---

# 2. Current State

**Forms (38 total in `forms.json`):**
- **Guardianship (5):** G2-010, G2-140, G3-010, G3-025, G3-026
- **P1 General (10):** P1-0100, P1-0400, P1-0530, P1-0620, P1-0800, P1-0900, P1-CAVEAT (smart), P1-FORMAL-NOTICE (smart), P1-PROOF-OF-SERVICE-FN (smart), P1-NOTICE-CONFIDENTIAL (smart)
- **P2 Summary Admin (3):** P2-PETITION (smart), P2-ORDER (smart), P2-0355
- **P3 Formal Admin (12):** P3-PETITION (smart), P3-OATH (smart), P3-ORDER (smart), P3-LETTERS (smart), P3-CURATOR-PETITION, P3-CURATOR-ORDER (smart), P3-CURATOR-OATH, P3-CURATOR-LETTERS, P3-OATH-WITNESS (smart), P3-PROOF-WILL (smart), P3-0740 (legacy), P3-0900 (legacy)
- **P5 Discharge (2 — both legacy):** P5-0400, P5-0800
- **BW Broward Local (6):** BW-0010..0050 (PDF passthrough), BW-0060 (legacy .docx)

**Templates on the new builder pattern (29):** All G* (5), all P1* (10), all P2* (3), the 10 P3* smart/curator/witness/proof-will templates. Built via `scripts/build_probate_templates.py` and `scripts/build_guardianship_templates.py`.

**PDF passthrough (5):** BW-0010, BW-0020, BW-0030, BW-0040, BW-0050.

**Legacy templates remaining (4):** P3-0740 (Notice to Creditors), P3-0900 (Inventory), P5-0400 + P5-0800 (Discharge — David uses full-waiver path only, see queue), BW-0060 (Affidavit of Heirs).

**Smart consolidations to date — 47+ FLSSI forms collapsed:** P3-PETITION (12), P3-ORDER (~13), P3-LETTERS (4), P1-CAVEAT (4, pro se dropped), P1-FORMAL-NOTICE (2), P1-PROOF-OF-SERVICE-FN (5), P2-PETITION (8), P2-ORDER (6), P2-0355 (rebuilt), P3-CURATOR-ORDER (2), P3-OATH-WITNESS (4), P3-PROOF-WILL (2), P1-NOTICE-CONFIDENTIAL (2). Codicil-related forms all integrated into their will counterparts (no standalone codicil templates anywhere).

**Tag audit:** `python3 scripts/audit_tags.py` → PASS.

**Questionnaire layer supports:**
- Field types: `text`, `number`, `date`, `textarea`, `checkbox`, `info`, `address`, `select`, `repeating_group`
- `visible_if` conditional visibility — reads either form data (`field`) or matter-level flags (`matter_flag`)
- `row_lock_unless_matter_flag` for repeating groups (caps to 1 row + renders one empty row when locked)
- RG subfield checkboxes
- Per-field input attrs: `pattern`, `maxlength`, `inputmode`, `placeholder`
- `delivery: pdf_passthrough` to bundle official PDFs unchanged
- Address parsing: free-text addresses are auto-parsed into the structured grid (street/city/state/zip)
- PR + petitioner rows auto-populate from `currentClient` on first render

---

# 3. forms.json schema reference (current)

```json
{
  "name": "field_name",
  "type": "info | date | address | select | text | number | checkbox | textarea | repeating_group",

  "severity": "info | warning | danger",        // info type only
  "content": "<html>...</html>",                 // info type only

  "options": [{ "value": "x", "label": "X" }],  // select type only
  "placeholder": "...",                          // select OR text

  "pattern": "\\d{4}",                           // text — client-side validation
  "maxlength": 4,
  "inputmode": "numeric",

  "visible_if": { "field": "other_field", "equals": true },
  "visible_if": { "matter_flag": "is_ancillary", "equals": true },

  "row_lock_unless_matter_flag": "multiple_prs"  // repeating_group only
}
```

Form-level entries support `delivery: "pdf_passthrough"` with `template` pointing into `reference/`:
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

Address values are objects: `{ street, line2, city, state, zip, foreign, foreign_text }`. Free-text strings (auto-populated client defaults, legacy data, paste) are auto-parsed via `parseStringToStructuredAddress()` on render.

---

# 4. Key files

- **`app.js`** (~2500 lines) — main application logic. Important helpers:
  - `renderAddressField`, `parseStringToStructuredAddress`, `formatAddressValue`
  - `formatDateFieldValue`, `collectDateFieldNames`, `collectAddressFieldNames`
  - `applyConditionalVisibility`, `applyVisibleIfAttrs`, `getMatterFlag`
  - `renderSingleDoc`, `makeDocFileName` (PDF passthrough handling)
  - `getAutoPopulateDefaults` — 4 layers (cross-form → matter → client → attorney) plus auto-populated petitioners/PRs arrays and resident agent
  - `ATTORNEY_PROFILES` constant — David / Jill
  - `US_STATES` constant
- **`auth.js`** — Microsoft OAuth + Supabase session
- **`forms.json`** — 39 form definitions
- **`scripts/build_guardianship_templates.py`** — builder + all shared helpers
- **`scripts/build_probate_templates.py`** — probate builder (incl. `build_p1_0900()`)
- **`scripts/audit_tags.py`** — tag audit; skips passthrough forms
- **`reference/`** — clerk-published PDFs (passthrough sources)
- **`styles.css`** — `.field-info-callout`, `.address-field` + sub-classes
- **`supabase-setup.sql`** — schema + handle_new_user trigger

---

# 5. Work Completed 2026-04-23 → 2026-04-29

**Phase 9 (2026-04-29) — Cowork live-test pass + bug-fix sweep + auto-tester:**
- Cowork (Chrome MCP, JS console) ran 8 cohorts / ~50 tests against `main` per `TESTING_PLAN.md`. Results in `TEST_RESULTS.md`: 41 PASS, 5 real bugs.
- **AI cert refactor (commit `7fcc787`)** — replaces auto-render-when-county-matches with explicit per-form opt-in. New `used_ai` checkbox in a "Generative AI Disclosure" section at the bottom of every form that can carry a cert (default OFF). Templates wrap cert in `{#used_ai}{#county_is_*}...{/}{/}`. Adds Miami-Dade AO 26-04 cert with verbatim text (BUG-3). **Hard rule (per David, 2026-04-29):** nothing signed by a judge ever carries the AI cert — verified by `auto_test.py` against P3-ORDER, P3-LETTERS, P2-ORDER, P3-CURATOR-ORDER, P3-CURATOR-LETTERS.
- **Bug fixes (commit `1d9ec4f`)** — BUG-1: hoist `prs[0]` → top-level in `prepareTemplateData()` so single-PR FL-resident path renders correctly. BUG-4: P3-LETTERS codicil clause now includes `dated {codicil_dates}`. BUG-5: strip leading "Estate of " on matter save + update input label/placeholder.
- **Test artifacts (commit `76e5fba`)** — `TESTING_PLAN.md` (Cowork's plan), `TEST_RESULTS.md` (Cowork's findings), `docs/TEST_PROMPTS.md` (alternative prompt set, retained for reference).
- **Auto-test harness (commit `7ed3c0a`)** — `scripts/auto_test.py` runs 19 checks without browser/Cowork: tag audit, builder content-determinism, hard-rule scan for judge-signed templates, forms.json sanity, plus 15 render tests via Node + docxtemplater (regression checks for BUG-1/3/4, opt-in cert behavior matrix, judge-signed render check, intestate/ancillary/multi-petitioner/Jill-as-attorney paths). Setup: `cd scripts/test && npm install`. Run: `python3 scripts/auto_test.py [-v] [--md]`. Current state: 19 PASS / 0 FAIL.

**Phases 1–4 (2026-04-23 evening):** drop draft-time-unknown fields; info/date/address field types; `visible_if` conditional visibility; row-lock for repeating groups; petitioner-same-as-PR auto-copy; venue checkbox list; felony danger callout; minor Y/N gate for beneficiary year-of-birth; structured address with foreign toggle.

**Phase 5 (2026-04-23 late evening):** PDF passthrough for the 4 Broward mandatory checklists + Affidavit of Criminal History; P1-0900 rebuilt on the new builder pattern.

**Phase 6 (2026-04-28 morning):** Six fixes from David's first live-test round:
- #12 PR row reappears when locked + empty (renders 1 empty row)
- #1/#5 address parser parses string defaults into structured grid; toggle relabeled
- #3/#4 File No. and Division removed from new-matter modal
- #13 domiciliary fields gated on `is_ancillary` via new `matter_flag` visible_if
- #15 resident agent name + address auto-populate from signing attorney

**Phase 6b (2026-04-28 mid-day):** Four fixes from second-batch feedback:
- B-1 toggle-off repopulates structured grid from foreign_text or original value
- B-2/3 prs[] array auto-populates from client (name + address)
- B-4 resident_agent_name now a validated `select` — David/Jill only

**Phase 7a (2026-04-28 afternoon):** Bring Phase 1–6b parity to all 5 guardianship forms.
- 12 `*_address` fields converted to structured `address` type across G2-010, G3-010, G3-025, G3-026 (petitioner / AIP / proposed guardian / physician). `next_of_kin.address` subfield converted in all 4 forms with NOK groups.
- `visible_if` gates on alternatives (description + insufficient reason) and preneed (name shown on `has_preneed === true`; reason on `not_equals: true` so the default "no preneed" path shows by default).
- Felony danger callout (F.S. §744.309(3)) above each "Proposed Guardian" / "Proposed Emergency Temporary Guardian" section in G3-010, G3-025, G3-026.
- `proposed_guardian_name` and `proposed_guardian_address` auto-populate from `currentClient` on first render.

**Phase 7b (2026-04-28 afternoon):** Drop draft-time-unknown signing fields and consolidate AIP DOB on the guardianship side.
- Removed `signing_month` / `signing_year` from all 5 G forms (forms.json) and `cos_month` / `cos_year` from G2-140's Certificate of Service section.
- `_add_signature_block()` and the G2-140 builder now render `Signed on this _____ day of __________, 20___.` — handwritten by signer.
- G3-010: collapsed `aip_dob_month` / `aip_dob_day` / `aip_dob_year` (three text fields) into a single `aip_dob` field of type `date`. Template body uses `{aip_dob}` (auto-formatted to "Month D, YYYY" by `formatDateFieldValue`).
- All 5 G*.docx templates rebuilt; tag audit passes.

**Phase 8a (2026-04-28 late evening, IN-FLIGHT — uncommitted):** Smart-template consolidations on the probate side.
- **P1-CAVEAT** smart template — consolidates FLSSI P1-0301/0305/0311/0315 (4→1). Pro se variants (P1-0300/0310 with designated agent) intentionally out of scope. Axes: caveator_type (creditor/IP) × caveator_is_nonresident.
- **Batch 1 P1 forms built individually:** P1-0400 (Request for Notice and Copies), P1-0500 (Formal Notice), P1-0510 (Proof of Service of Formal Notice), P1-0530 (Notice of Hearing). All built on the new builder pattern with FLSSI 2025 source DOCX as reference.
- **Full summary admin replacement (P2):** 19 legacy P2 forms (P2-0204..0225 petitions, P2-0300..0325 summary admin orders, P2-0500..0650 will-admit orders) replaced with **3 smart templates**:
  - **P2-PETITION** consolidates 8 petition variants (testate/intestate × single/multi × dom/ancillary)
  - **P2-ORDER** consolidates 6 order variants. Per David's preference, testate path = combined Order Admitting Will to Probate AND of Summary Administration (P2-0500-style); intestate path = standalone Order of Summary Admin. Axes: is_testate × is_ancillary × is_self_proved (testate only) × is_auth_copy_of_will (testate ancillary only).
  - **P2-0355** Notice to Creditors (summary admin) — rebuilt with new schema using cross-form `summary_admin_distributees` from petition.
- Wizard matrix collapsed: all 8 summary admin keys now → `['P2-PETITION', 'P2-ORDER', 'P2-0355']`. Bundles + sections updated. Legacy P2 templates deleted from `templates/`.
- New derived flags in `prepareTemplateData()`: `caveator_is_creditor`/`caveator_is_ip` (from caveator_type select), `creditors_all_barred`/`creditors_no_debt`/`creditors_has_debt` (from creditors_status select). New auto-pop layer for `caveator_name`/`caveator_mailing_address`/`caveator_residence_address` from currentClient.
- New helper `_distribution_table()` (3-col: name/address/share/amount) for summary-admin distributees.
- New `reference/FLSSI-2025/` directory with all 14 source DOCX from `FODPROBWD2025/Converted DOCX` for body-text accuracy.
- All affected templates (10 builder-pattern + 5 new + P1-CAVEAT + 3 P2) rebuilt; tag audit passes.
- **NOT YET LIVE-TESTED.** Needs end-to-end test on a summary admin matter before declaring done.

**Phase 8d (2026-04-28 late evening):** Codicil flow integrated into opening order — no separate "Order Admitting Codicil" template needed.
- Added `has_codicil` checkbox upfront in P3-PETITION, P3-ORDER, P3-LETTERS, P2-PETITION, P2-ORDER. `codicil_dates` field gated `visible_if has_codicil === true`.
- Builder templates switched from `{#codicil_dates}...{/codicil_dates}` (truthy-test on string) to explicit `{#has_codicil}...{/has_codicil}` conditional.
- **Result:** when David opens an estate with a will + codicil, the codicil is admitted to probate as part of P3-ORDER (testate path: "the decedent's last will dated X, and codicil(s) dated Y is/are admitted to probate"). FLSSI P3-0460/0470 (separate Order Admitting Codicil) — handled by this integrated flow; no separate template needed unless a codicil is filed AFTER the original will admission (rare; not in scope).

**Phase 7e (2026-04-28 evening):** Universal caption fix across both builders.
- `prepareTemplateData()` now sets `data.county_caption = (matter.county || '').toUpperCase()`. Body-text references to `{county}` keep the matter's original casing; only the caption line uses `{county_caption}`.
- `_add_probate_caption()` and `_add_guardianship_caption()` now render every line bold (`IN THE CIRCUIT COURT...`, `IN RE: ESTATE OF` / `IN RE: GUARDIANSHIP OF`, `PROBATE DIVISION`, the case-title line, `File No.`, `Division`) and use `{county_caption}` for the centered top line.
- Both builders re-ran; all 10 active builder-pattern templates (G2-010, G2-140, G3-010, G3-025, G3-026, P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS, P1-0900) rebuilt.
- `audit_tags.py` allow-list updated to include `county_caption`; tag audit passes.
- The remaining ~24 legacy probate templates will inherit the fix when they're rebuilt on the new pattern.

---

# 6. Remaining Work

**Priority 1 — Probate template rebuild (in progress):**
- [x] Formal admin opening — 4 smart templates (P3-PETITION/OATH/ORDER/LETTERS)
- [x] P1-0900 Notice of Designation
- [x] BW-0010 Criminal History affidavit (PDF passthrough)
- [x] BW-0020/0030/0040/0050 Mandatory Checklists (PDF passthrough)
- [x] Live test formal admin opening — two rounds passed, all bugs fixed
- [x] **P1-CAVEAT** smart template (4 FLSSI variants → 1, Phase 8a)
- [x] **P1-0400 / P1-0500 / P1-0510 / P1-0530** built individually (Phase 8a) — NOT YET LIVE-TESTED
- [x] **Summary admin (P2-PETITION + P2-ORDER + P2-0355)** — 19 legacy P2 forms collapsed into 3 smart templates (Phase 8a) — NOT YET LIVE-TESTED
- [x] **P1-FORMAL-NOTICE** smart template (P1-0500/0501) — Phase 8b
- [x] **P1-PROOF-OF-SERVICE-FN** smart template (P1-0507/0510/0511/0512/0513) — Phase 8b
- [x] **P1-0100** Petition to Open Safe Deposit Box, **P1-0620** Joinder Waiver Consent (with notary), **P1-NOTICE-CONFIDENTIAL** smart (P1-0640/0641 — contemporaneous y/n) — Phase 8c
- [x] **Curator suite (4 templates):** P3-CURATOR-PETITION, P3-CURATOR-ORDER smart (P3-0065/0070, bond y/n), P3-CURATOR-OATH (with notary), P3-CURATOR-LETTERS — Phase 8c
- [x] **P3-OATH-WITNESS** smart (P3-0300/0301/0310/0311 — will/codicil × original/copy) — Phase 8c
- [x] **P3-PROOF-WILL** smart (P3-0320/0330 — will/codicil) — Phase 8c
- [x] **P1-0800** Notice of Trust (Phase 8e)
- [ ] **P1-0520** Notice of Action (publication)
- [ ] **P3-0740 Notice to Creditors** (formal admin) — small, self-contained
- [ ] **P3-0900 Inventory** (rewire to `estate_assets` repeating group; address type for asset addresses)
- [ ] **Discharge (full-waiver path only):** P5-0550/0551 → P5-PETITION-DISCHARGE-FULL-WAIVER smart; P5-0510/0511 → P5-RECEIPT smart; P5-0700/0701 → P5-REPORT-DIST smart; P5-0800/0810 → P5-ORDER-DISCHARGE smart. David never uses non-full-waiver path (P5-0400/0401/0500/0501/0300/0340/0410/0411/0420 — all dropped).
- [ ] BW-0060 Affidavit of Heirs (last remaining BW legacy .docx)

**Priority 1a — Live-test follow-ups deferred from 2026-04-28 testing:**
- [ ] **#2** Decedent / Ward / AIP names broken into Last / First / Middle (schema change — affects matter modal + auto-populate + multiple template fields)
- [ ] **#6** "Interest in estate" as a `select` dropdown with "Other" option (the select type now exists, just needs the data + an "other" free-text path)
- [ ] **#14** Self-proved will: does the petition need to capture witness names? Verify against FLSSI 2.0103 / template content
- [ ] **#16** David started a 16th feedback item but it was cut off — confirm what he intended
- [x] **Universal caption fix (all templates).** ✅ Shipped Phase 7e (2026-04-28 evening) — see Section 5.

**Priority 1b — Matter-level data interview (architectural, in progress on `matter-interview` fork):**
*Active work.* Local-only branch in sibling worktree `../Forms Project Interview/`. Plan of record: that worktree's `docs/MATTER_INTERVIEW_PLAN.md` (entity model: role-based people with tagged roles, single `people[]` and `assets[]` arrays on `matter.matterData`). Will not auto-merge — cherry-pick or merge when proven. Constraint: every field optional, no required inputs ever (per memory).

- Lift decedent / assets / beneficiaries up from per-form `formData` to `matter.matterData`. Today's wizard propagation of `multiple_petitioners` / `multiple_prs` is a small step in this direction.
- David's 2026-04-28 feedback items #7-11 all describe this same shift:
  - #7 Decedent legal name asked once
  - #8 Decedent last known address asked once
  - #9 Decedent pre-interview separate from matter interview (last/first/middle, DOD, last address, last 4 SSN, place of death, county, assets)
  - #10 Common interview questions separated from per-form
  - #11 Decedent / assets / beneficiaries as separate sections, then inserted
- Also from second-batch feedback: dropdown of names of people already entered (auto-populate addresses by name selection)
- **Don't start without explicit go-ahead from David.** Plan the schema migration first.
- Prerequisite for the file-management-system direction.

**Priority 1c — Checklist re-integration (deferred from Phase 5):**
- Once the app becomes a more complete file-management system, re-integrate the Broward mandatory checklists as an interactive **pre-filing review step** (not drafting-time).
- **Rule-violation warnings at questionnaire time** — e.g., if beneficiaries include a trust, surface trust-disclosure requirement; if decedent residence is non-FL and petitioner isn't related, flag residency requirement.

**Priority 1d — Guardianship of a Minor forms (NEXT — added 2026-04-29):**
*New build-out track.* Existing G2/G3 templates cover adult AIPs/wards only. Minor guardianship is a separate FLSSI form family that the app does not yet support. Build via the same builder pattern as the rebuilt adult guardianship templates (`build_guardianship_templates.py`).

- [ ] Catalog the FLSSI minor-guardianship forms in `docs/FORMS_CATALOG_MAP.md` (Petition for Appointment of Guardian of Minor; Order Appointing; Letters; Oath/Acceptance; consent/waiver forms; minor's preference/designation if 14+).
- [ ] Add a "Guardianship of a minor" path to the matter-creation flow / wizard (sibling to existing guardianship-of-person/property paths). Subject = minor's name; matter-level flags for `minor_age_14_plus`, `parents_consent`, `parents_deceased`, `natural_guardian_designated_in_will`, etc.
- [ ] Auto-populate: petitioner(s) (parent/relative), minor's name + DOB, parents' names/addresses (or status if deceased), minor's preference if age 14+.
- [ ] Build templates via `build_guardianship_templates.py` (use existing `_pleading_para`, `_apply_running_header`, signature block, AI cert helpers). Caption format: "IN RE: GUARDIANSHIP OF {minor_name}, A MINOR".
- [ ] Bond + plan considerations: minor-guardianship requires Initial Plan + Annual Plan/Accounting. Likely fold into existing G3 annual templates with a `is_minor` axis rather than duplicating.
- [ ] Live-test with Jill/Maribel before marking complete. Maribel drafts; Jill is attorney of record.

**Priority 2 — FLSSI catalog build-out (waiting on David):**
- David marks `[x]` in SKIP column of `docs/FORMS_CATALOG_MAP.md`; build all unmarked forms via the builder pattern.

**Priority 3 — Import bug testing:**
- End-to-end test: Claude import → wizard → generate → download.

**Priority 4 — Claude direct document generation (v2):**
- "Draft the petition" in chat → .docx output, no browser interaction.

**Priority 5 — Quick Add Matter:**
- Onboard existing mid-stream matters without the opening wizard.

**Priority 6 — Ancillary Broward checklists** (PDFs in `reference/` — Discharge, Disposition, Formal-Ancillary, Homestead, Instructions, Sell-Real-Property, Summary-Ancillary). Same passthrough pattern when forms are wired up.

**Priority 7 — Case management / file management system (long-term).** See `docs/CASE_MANAGEMENT_SYSTEM_PLAN.md`.

**Priority 8 — Adversary-flavored forms (deprioritized per David 2026-04-28):**
The adversary axis is already built into P1-FORMAL-NOTICE and P1-PROOF-OF-SERVICE-FN, so those work for adversary use today. These remaining adversary-only forms are last in the queue:
- [ ] **P1-0531** Notice of Hearing Adversary — fold into P1-0530 with adversary axis (same pattern as P1-FORMAL-NOTICE)
- [ ] **P4-0600** Declaration that Proceeding is Adversary
- [ ] **P4-0610** Order that Proceeding is Adversary
- [ ] **P4-0650** Notice of Civil Action

---

# 7. Known Issues / Risks

- **4 legacy templates** still on 2-column FLSSI layout: P3-0740, P3-0900, P5-0400, P5-0800, BW-0060. Rebuild queue (Priority 1). Phase 8a-8e collapsed all other legacy P2 + many P3 forms into smart templates.
- **Legacy Supabase rows** with old field names (`will_year`, `signing_month`, `bond_required`, `will_status_*`, `notary_online`, `cl_*`, `scl_*`) remain in the database. Not a failure mode — they're just unused. Fresh matters won't have them.
- **`resident_agent_address`** still a free-text input (the name field is now validated). Auto-populates from firm address; user can override. Acceptable for now.
- **Address parser** handles `"street[, line2], city, ST zip"` (with `\n` or `,` separators) and falls back to free-text mode for anything else. Foreign / unstructured addresses go through the toggle.
- **python-docx numbering workaround** (`_inject_numbering_part`) unchanged.
- **First load on legacy matters** with old string addresses: parser tries first, free-text fallback if it can't read the format. Toggle-off recovery added in Phase 6b.

---

# 8. Next Best Action

1. **Live-test Phase 8 work.** All of Phase 8 (a/b/c/d/e) shipped without a live-test pass. Walk through end-to-end:
   - Open a probate matter via the wizard (testate, single/multi petitioner, dom/ancillary)
   - Fill out P3-PETITION → P3-OATH → P3-ORDER → P3-LETTERS → P1-0900
   - Toggle `has_codicil` and verify codicil text renders / doesn't render appropriately on the petition + order + letters
   - Open a summary admin matter via the wizard, fill out P2-PETITION → P2-ORDER → P2-0355
   - Generate one each of: P1-CAVEAT (creditor + IP, resident + nonresident), P1-FORMAL-NOTICE (regular + adversary), P1-PROOF-OF-SERVICE-FN (all 3 service types × adversary), P1-0100, P1-0620, P1-0800, P1-NOTICE-CONFIDENTIAL (contemporaneous + after-the-fact)
   - Generate the curator suite (P3-CURATOR-PETITION/ORDER/OATH/LETTERS), P3-OATH-WITNESS (will/codicil × original/copy), P3-PROOF-WILL (will + codicil)
2. **Live-test the guardianship side.** Phase 7a/7b shipped without a Jill/Maribel test pass. Walk a G3-025 or G3-026 questionnaire end-to-end.
3. **Guardianship of a Minor forms (Priority 1d, NEW).** Catalog the FLSSI minor-guardianship form family, add a minor path to the matter-creation flow, build templates via the existing guardianship builder pattern. See Priority 1d for the breakdown.
4. **Start P3-0740 Notice to Creditors rebuild** — small, self-contained legacy template.
5. **Discharge cluster (full-waiver path)** — P5-PETITION-DISCHARGE-FULL-WAIVER, P5-RECEIPT, P5-REPORT-DIST, P5-ORDER-DISCHARGE smart templates. ~9 FLSSI forms → 5 templates. See queue.
6. **Or schedule the Priority 1b matter-data interview** if David explicitly asks — next big architectural move.

---

# 9. Drop-In Starter Prompt for New Chat

> Copy and paste this entire block into a new chat to resume immediately.

---

## Handoff — GS Court Forms

**Where it is:** `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project` — or clone fresh from `https://github.com/davidshulman22/guardianship-forms`.
**Live:** `https://davidshulman22.github.io/guardianship-forms/` (GitHub Pages, deploys from `main`)
**Local dev:** `cd` to project dir, run `python3 -m http.server 8765`. Open `http://localhost:8765`. Hard-refresh (Cmd+Shift+R) to bust cached forms.json / app.js.

### Branch state

`main` is current. The `phase1-2-questionnaire-cleanup` branch is merged and retained for git history. A `matter-interview` branch exists in a sibling worktree (`../Forms Project Interview/`) — local-only, never pushed, exploring the Priority 1b matter-level data interview; will not auto-merge. See that worktree's `docs/MATTER_INTERVIEW_PLAN.md` for its plan. Start of session: `git pull`. New work: branch from `main` if it's a multi-day feature, or commit straight to `main` if it's a small surgical fix.

### What's deployed (Phases 1–8e, all merged to `main` 2026-04-28)

**Questionnaire layer** — field types: `text`, `number`, `date`, `textarea`, `checkbox`, `info`, `address`, `select`, `repeating_group`. Conditional visibility (`visible_if` reads form data or `matter_flag`). Row-lock for repeating groups. Address parser auto-converts string defaults to structured grid. Validated dropdowns (resident agent: David/Jill). Auto-populate: petitioners[] + prs[] from client; resident agent from signing attorney; firm address pre-filled. Caveator + curator name/address auto-pop. Universal caption fix (bold + county ALL CAPS).

**Smart templates (Phase 8 consolidations)** — collapsed 47+ legacy FLSSI forms:
- P3 formal admin opening: P3-PETITION (12 forms) / P3-OATH / P3-ORDER (~13 forms) / P3-LETTERS (4 forms)
- P2 summary admin: P2-PETITION (8 forms) / P2-ORDER (6 forms, testate path = combined will-admit + summary admin) / P2-0355
- P1 service: P1-CAVEAT (4) / P1-FORMAL-NOTICE (2) / P1-PROOF-OF-SERVICE-FN (5) / P1-NOTICE-CONFIDENTIAL (2)
- P3 curator: P3-CURATOR-PETITION / -ORDER (2) / -OATH (with notary) / -LETTERS
- P3 will/codicil: P3-OATH-WITNESS (4) / P3-PROOF-WILL (2)
- Codicil flow: integrated into all will templates via `has_codicil` axis (no standalone codicil templates)

**PDF passthrough**: BW-0010..0050 (Broward criminal history + 4 checklists). Wizard-driven row-lock booleans on `matter.matterData`. File No. + Division removed from new-matter modal.

**FLSSI source library**: `reference/FLSSI-2025/` contains all source DOCX downloaded from `FODPROBWD2025/Converted DOCX` for body-text accuracy in builders.

### What's next

**Live-test Phase 8** before doing any more building — that's the biggest open risk. Walk all the new smart templates end-to-end on a real matter.

Then: **Guardianship of a Minor forms (Priority 1d, new track 2026-04-29)** — catalog FLSSI minor-guardianship forms, add a minor path to the matter-creation flow, build templates via the existing guardianship builder pattern. Or **P3-0740 Notice to Creditors** rebuild (small, self-contained). Or **Discharge cluster (full-waiver path)** — P5-PETITION-DISCHARGE-FULL-WAIVER + P5-RECEIPT + P5-REPORT-DIST + P5-ORDER-DISCHARGE smart templates. Or any deferred Priority 1a feedback items (#2 names schema change, #6 interest dropdown, #14 self-proved will witnesses, #16 cut-off item). Or the architectural Priority 1b matter-level data interview if David asks.

### Constraints

- Vanilla JS, no frameworks. Single `app.js`, `index.html`, `styles.css`.
- All form field definitions in `forms.json`, NOT in app.js.
- Templates: `{field}` text, `{#cond}...{/cond}` conditional, `{^cond}...{/}` negation, `{#group}...{/group}` loop. Run `audit_tags.py` after any forms.json or template change.
- New .docx templates ALWAYS via builder scripts (`build_probate_templates.py` / `build_guardianship_templates.py`). Never hand-edit.
- Address values are objects `{ street, line2, city, state, zip, foreign, foreign_text }` — `formatAddressValue()` composes for templates.
- No required fields during build phase. File No. always optional.
- Personal tool, never for sale. Project lives in Dropbox; git is source of truth.
- David: Bar 150762 (probate). Jill: Bar 813850 (guardianship). Maribel: paralegal, not in `ATTORNEY_PROFILES`.

### Git discipline

- `git pull` at start. Commit + push at end.
- Multi-day features → branch. Surgical fixes → commit straight to `main`.
- Hooks: don't skip. Don't amend; create a new commit.
