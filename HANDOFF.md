# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-22 (afternoon)
**Source:** Claude Code session — docx-numbering skill rollout + P3-0100 anchor rebuild
**Status:** RESUME-READY — 5 guardianship + 1 probate template rebuilt and live; 35 probate/local templates queued next

---

# 0. READ FIRST — State as of 2026-04-22 afternoon

**Rebuild continues.** All 5 guardianship templates AND the first probate template (P3-0100 Petition for Administration) are now on the new builder pattern with:

- Real Word numbering (`numPr` / `numId=1`) per the `docx-numbering` skill — no hardcoded `"1.\t"`, no empty spacer paragraphs between numbered items
- 1.5 line spacing on numbered paragraphs
- Single-column captions via borderless tables (abandoned FLSSI 2-column)
- Real Word tables for next-of-kin / property / beneficiaries
- docxtemplater conditionals replace "Strike each statement that is not applicable" language
- Broward AO 2026-03-Gen AI certification rendered only for Broward-county matters (wrapped in `{#county_is_broward}...{/}`)

**35 probate/local templates still use the legacy FLSSI layout** and are the next batch. Approach: David reviews P3-0100 live, then we work through the rest grouped by similarity.

**Auth is live.** David + Maribel auto-admin via `handle_new_user` trigger allow-list. Jill will sign in whenever she's ready — she lands as `standard` (own matters only) unless explicitly promoted.

**Per-matter attorney selector** is in the matter modal. Dropdown picks David or Jill regardless of matter type. Jill's phone is 954-332-2310 (was inheriting David's number in error before today). Maribel is not in `ATTORNEY_PROFILES` — she's paralegal, not attorney; her drafts still say Jill.

---

# 1. Objective

Browser-based Florida court form generator for Ginsberg Shulman, PL. Runs client-side with docxtemplater; data in Supabase (RLS-gated) with Microsoft OAuth sign-in. Live at `https://davidshulman22.github.io/guardianship-forms/`. Eventual direction: complete probate + guardianship file management system (see memory `project_future_file_mgmt_system.md`).

---

# 2. Current State

- **41 forms** in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local)
- **6 templates rebuilt on the new pattern** — G2-010, G2-140, G3-010, G3-025, G3-026, P3-0100
- **35 templates pending rebuild** — the rest of the probate + Broward catalog
- **Tag audit passes** across all templates (`python3 audit_tags.py`)
- **Supabase live** — 3 tables (clients / matters / form_data) + user_profiles, all RLS-gated
- **Three lifecycle sections** in matter view (Open Estate / Estate Admin / Close Estate) dynamically switch between formal and summary admin based on wizard selections
- **Per-matter attorney selector** wired through matter modal → `ATTORNEY_PROFILES` → `getAttorneyDefaults(matter)` → template output
- **County-specific AI certifications** — `county_is_broward` / `county_is_miami_dade` booleans auto-populate from `matter.county`

---

# 3. Work Completed This Session (2026-04-22 afternoon)

**Guardianship template rebuild (commit `b60a9c0`):**
- Refactored G2-010, G2-140, G3-010, G3-025, G3-026 to use `_pleading_para` (real Word numbering) instead of hardcoded `"1.\t"` runs
- Added `PLEADING_NUMBERING_XML` + `_inject_numbering_part()` post-save hook to overwrite python-docx's default `numbering.xml` with firm conventions (decimal `1.` / lowerLetter `a.` / lowerRoman `i.`)
- Added `_add_broward_ai_certification()` helper wrapping Broward cert in `{#county_is_broward}...{/}`
- Unnumbered blank line after each checkbox list in G2-010 / G3-026 (per David's feedback on G3-026)
- All 5 guardianship templates pass audit

**Attorney system refactor (same commit):**
- `ATTORNEY_PROFILES` dict in app.js with `david` and `jill` entries
- `getAttorneyDefaults(matter)` accepts a matter object; honors `matter.attorneyId` override
- Matter modal has a "Signing Attorney" dropdown (defaults to matter-type default, overridable)
- Jill's phone fixed to 954-332-2310
- Jill's `attorney_email_secondary` set to `maribel@ginsbergshulman.com` (was `maribel@hflegalsolutions.com`)

**Maribel onboarding (same commit):**
- `supabase-setup.sql` trigger updated with `ADMIN_EMAILS` allow-list — auto-promotes `david@` and `maribel@ginsbergshulman.com` on first sign-in
- Backfill UPDATE also included for anyone who signed in before the trigger update
- Maribel captured in memory as paralegal (not attorney); comment in `ATTORNEY_PROFILES` explicitly says don't add her

**Probate anchor rebuild (commit `3ceb68c`):**
- `build_probate_templates.py` created; imports shared helpers from `build_guardianship_templates`
- New probate-specific helpers: `_add_probate_caption()`, `_beneficiaries_table()`, `_add_probate_signature_block()`
- P3-0100 Petition for Administration rebuilt — 12 numbered paragraphs, beneficiaries table, Broward AI cert, and **all** "strike each statement that is not applicable" language replaced with docxtemplater conditionals
- forms.json updated with new conditional booleans (`pr_is_fl_resident`, `petitioner_has_prior_conviction`, `higher_preference_exists`, `higher_preference_formal_notice`, `estate_tax_return_required`, `domiciliary_proceedings_pending`, `will_status_original`, `will_status_authenticated_other`, `will_status_authenticated_notarial`)
- `audit_tags.py` now covers all templates (G* no longer skipped); added `county_is_broward`, `county_is_miami_dade`, `aip_name_upper`, `attorney_firm` to AUTO_POPULATED; regex handles `{^field}` negation
- Context docs updated: CLAUDE.md reflects rebuild pattern, new helpers, Maribel/Jill setup, per-matter attorney selector; HANDOFF.md rewritten (this file)

---

# 4. Key Decisions

| Decision | Why |
|----------|-----|
| Rebuild via Python `build_*.py` scripts instead of patching FLSSI templates | FLSSI 2-column layout breaks when multi-line fields hit justified paragraphs (words spread across the page). Cleanest to rebuild. |
| Real Word numbering (`numPr` / `numId=1`) not hardcoded "1.\t" | docx-numbering skill: hardcoded numbers don't renumber when Jill/David edits the doc. Word auto-renumbers. |
| Post-save `_inject_numbering_part()` zip hack | python-docx has no first-class numbering API. Must overwrite python-docx's auto-generated numbering.xml with firm's custom definitions. |
| Replace "Strike each statement that is not applicable" with docxtemplater conditionals | Cleaner output, no manual striking of generated pleadings. |
| Separate `build_guardianship_templates.py` + `build_probate_templates.py` with helpers imported | Fast to set up without refactoring existing working code. Could be refactored into shared `builder_helpers.py` later. |
| Maribel auto-admin via trigger allow-list, not "anyone@ginsbergshulman.com" | Explicit is better than implicit. New hires get considered case-by-case. |
| Maribel not in ATTORNEY_PROFILES | She's paralegal. Documents always list the supervising attorney. |

---

# 5. Constraints & Preferences

Per CLAUDE.md:
- Vanilla JS, no frameworks — single `app.js`, `index.html`, `styles.css`
- docxtemplater (CDN) for `.docx` generation, PizZip, FileSaver.js
- All form field definitions live in `forms.json`, NOT in app.js
- Template tags: `{field}` for text, `{#cond}...{/cond}` for conditionals, `{^cond}...{/cond}` for negation, `{#group}...{/group}` for loops
- No required fields during build phase
- Personal practice tool, never for sale (FLSSI forms require licenses)
- Git commit + push at end of every session
- David A. Shulman, Bar 150762, david@ginsbergshulman.com, 954-990-0896 — probate default
- Jill R. Ginsberg, Bar 813850, jill@ginsbergshulman.com + maribel@ secondary, 954-332-2310 — guardianship default

---

# 6. Remaining Work

**Priority 1 — Complete probate template rebuild (IN PROGRESS):**
- [x] P3-0100 Petition for Administration — testate FL resident single petitioner (COMMIT `3ceb68c`)
- [ ] **Next batch — formal admin petitions & orders (suggest doing in this order):**
  - P3-0120 Petition for Administration — intestate FL resident
  - P3-0420 Oath of Personal Representative
  - P3-0440 Designation of Resident Agent & Acceptance
  - P3-0600 Order Admitting Will to Probate + Appointing PR
  - P3-0700 Letters of Administration
  - P3-0740 Notice of Administration
  - P3-0900 Inventory
- [ ] Summary admin petitions (P2-*) — 19 templates, many share structure
- [ ] Discharge (P5-0400, P5-0800)
- [ ] Broward local forms (BW-*) — 6 templates
- [ ] General probate (P1-0900 Notice of Designation of Email Addresses — simplest, same pattern as G2-140)

**Process for each:** (1) read current template text + forms.json entry via `audit_tags.py` + zip inspection, (2) write `build_pX_YYYY()` in `build_probate_templates.py` using shared helpers, (3) replace "strike" language with conditionals where sensible, (4) update forms.json for any new/renamed fields, (5) run `audit_tags.py`, (6) spot-check output, (7) commit.

**Priority 1b — Lift shared matter data up to a Matter Interview (architectural, NOT YET STARTED):**
- Matter facts (decedent, AIP, relatives, assets, addresses, PR, beneficiaries) should live on `matter.matterData`, not under `matter.formData['P3-0100']` or similar
- Current cross-form sharing is read-through — fragile (delete the form that owns a field and it vanishes from every other form)
- Target: "Matter Interview" view per matter type that writes to `matterData`; forms then read matterData → formData override → client → attorney
- Schema: add a `matter_data.json` schema (parallel to `forms.json`) with sections Parties / Relatives / Assets / Addresses / Key dates
- Migration: one-shot script that promotes existing cross-form fields to `matterData`, then prunes per-form copies
- Rough scope: weekend-sized. Prerequisite for the eventual file-management-system direction (memory `project_future_file_mgmt_system.md`)
- Do not start before Priority 1 (form formatting) is complete

**Priority 2 — FLSSI catalog build-out (waiting on David):**
- David marks `[x]` in SKIP column of `FORMS_CATALOG_MAP.md` for forms he doesn't want
- When David says "ready", build all unmarked forms using the new builder pattern
- 138 missing forms; realistic batch after skips: ~60–80

**Priority 3 — Import bugs (David has more to report):**
- Test import → wizard → generate → download end-to-end
- Debug and fix any issues

**Priority 4 — Claude direct document generation (v2):**
- "Draft the petition" in chat → .docx output, no browser interaction
- Standalone Node.js script or Cowork skill using docxtemplater directly

**Priority 5 — Quick Add Matter:**
- Onboard existing mid-stream matters without the opening wizard

**Priority 6 — Ancillary Broward checklists:**
- PDFs captured 2026-04-17 under `reference/` — Formal Ancillary, Summary Ancillary, Homestead, Sell Real Property, Disposition
- Suggested IDs: BW-0070..BW-0110
- Build via `build_probate_templates.py` using shared helpers

**Priority 7 — Case management / file management system (long-term):**
- Asset inventory, deadline tracking, task list per matter
- Eventually evolves into the complete probate+guardianship file management system (memory captures this vision)

---

# 7. Known Issues / Risks

- 35 probate/local templates still on legacy 2-column FLSSI layout. Not broken, but the rebuild will make them consistent with the guardianship set
- Matter-level facts still live under per-form `formData` — see Priority 1b
- `seedVersion` was not bumped — existing seed data won't refresh unless bumped; fresh installs get the current seed
- Sign-in has been stable since the 2026-04-22 morning fix. If it goes blank again, grab `[auth]` console logs first.
- python-docx numbering is a known pain point — we work around it via post-save zip manipulation in `_inject_numbering_part`. Don't try to use python-docx's built-in `List Number` style; it won't match firm conventions.

---

# 8. Next Best Action

**Immediate (next session):**
1. David live-tests P3-0100 on Helen Marie Torres seed matter. Opens the generated .docx in Word, confirms: auto-numbering (try inserting a paragraph — should renumber), 1.5 line spacing, beneficiaries table, Broward AI cert present, item 6 reads "has not", item 10 reads "are not known to be pending".
2. If P3-0100 looks right, rebuild **P3-0120** (intestate variant of P3-0100) next — similar structure minus the will-status paragraph (no will).
3. Then work through the other formal admin forms in the order in section 6.

**Parallel work** — matter-level data interview (Priority 1b) — weekend-sized. Don't start without asking David. He said "not now" today.

---

# 9. Drop-In Starter Prompt for New Chat

> Copy and paste this entire block into a new chat to resume immediately.

---

## Handoff — GS Court Forms

**Where it is:** `/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project`
**Repo:** `https://github.com/davidshulman22/guardianship-forms` (main branch, up to date)
**Live:** `https://davidshulman22.github.io/guardianship-forms/`
**Local:** `cd` to project dir, `python3 -m http.server 8765`, open `http://localhost:8765`. Hard-refresh (Cmd+Shift+R) to bust cached forms.json / app.js.

### What's done
- **41 forms** in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local)
- **6 templates rebuilt on the new builder pattern**: G2-010, G2-140, G3-010, G3-025, G3-026, P3-0100
  - Real Word numbering (`numPr` / `numId=1`), 1.5 line spacing, single-column captions, real Word tables, docxtemplater conditionals (not "strike each statement"), Broward AI cert via `{#county_is_broward}`
- **`build_guardianship_templates.py`** + **`build_probate_templates.py`** — all new templates go through Python builders. Never hand-edit .docx
- **Microsoft OAuth via Supabase**, David + Maribel auto-admin via trigger allow-list
- **Per-matter signing attorney** — David/Jill dropdown in matter modal
- **County-specific AI certifications** — Broward + Miami-Dade handled

### What's next
**IMMEDIATE TASK — Continue probate template rebuild:**
- P3-0100 is the first probate anchor form (COMMIT `3ceb68c`). David needs to live-test in Word.
- Then rebuild P3-0120 (intestate variant), then the rest of P3-* / P2-* / P5-* / BW-* / P1-0900.
- Pattern: `build_probate_templates.py` has the helpers and imports. Add a `build_pX_YYYY()` function per form.

**ARCHITECTURAL TODO — Matter-level data interview (Priority 1b):**
- Lift decedent/AIP/relatives/assets up from per-form `formData` to `matter.matterData`. Weekend-sized. Don't start without asking.

**FUTURE DIRECTION:**
- Eventual file management system (memory `project_future_file_mgmt_system.md`). Not now.

### Key files
- `app.js` — application logic (~2000 lines). `ATTORNEY_PROFILES`, `getAttorneyDefaults(matter)`, `prepareTemplateData()`, `populateFormSections()`
- `auth.js` — Microsoft OAuth + Supabase session handling
- `build_guardianship_templates.py` — builder + all shared helpers (`_pleading_para`, `_add_broward_ai_certification`, `_inject_numbering_part`, etc.)
- `build_probate_templates.py` — probate builder, imports helpers; has `_add_probate_caption`, `_beneficiaries_table`, `_add_probate_signature_block`
- `audit_tags.py` — `python3 audit_tags.py` to verify template tags match forms.json
- `forms.json` — 41 form definitions
- `supabase-setup.sql` — DB schema + trigger allow-list for admin
- `CLAUDE.md` — full project context with builder pattern notes
- `FORMS_CATALOG_MAP.md` — FLSSI 2025 catalog with SKIP checkboxes for future batch build

### Builder pattern (MUST follow for new forms)
```python
def build_pX_YYYY():
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)
    _add_probate_caption(doc)
    _add_para(doc, 'TITLE', align=CENTER, bold=True, space_after=18)
    _add_para(doc, 'Petitioner, {petitioner_name}, alleges:')      # intro, unnumbered
    _pleading_para(doc, '...')                                      # Word auto-numbers this
    _pleading_para(doc, '...', keep_with_next=True)
    _beneficiaries_table(doc)
    _pleading_para(doc, '...')
    # closing — unnumbered
    _add_para(doc, 'Petitioner respectfully requests...', space_before=12)
    _add_broward_ai_certification(doc, 'Title of Document')
    _add_probate_signature_block(doc)
    out_path = os.path.join(TEMPLATE_DIR, 'P3-XXXX.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)                                # MUST be last — overwrites python-docx's default numbering.xml
```

**Forbidden in new templates** (per docx-numbering skill):
- Hardcoded `_add_run(p, '1.\t')` — use `_pleading_para()`
- Empty paragraphs between numbered items — spacing comes from numbering style
- Non-standard line spacing on numbered paragraphs — use the 1.5 default
- "Strike each statement that is not applicable" language — use `{#cond}...{/}` branches

### Git discipline
- Project lives in Dropbox (intentional, don't move it). Git is source of truth.
- Start of session: `git pull`
- End of session: commit and push. Use Co-Authored-By trailer for Claude commits.

### Constraints
- Personal tool, never for sale (FLSSI license)
- No required fields during build phase
- File No. always optional (assigned after filing)
- David: Bar 150762, 954-990-0896 (probate). Jill: Bar 813850, 954-332-2310 (guardianship, and probate if picked via attorney dropdown). Maribel is paralegal — not in ATTORNEY_PROFILES.

---
