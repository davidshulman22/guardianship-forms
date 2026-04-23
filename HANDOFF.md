# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-23 (morning)
**Source:** Claude Code session — smart-template consolidation for formal-admin opening
**Status:** RESUME-READY — 5 guardianship + 4 probate smart templates live; summary admin + closing + Broward still legacy

---

# 0. READ FIRST — State as of 2026-04-23 morning

**Smart-template consolidation.** The 6 per-variant FLSSI probate IDs (P3-0100, P3-0120, P3-0420, P3-0440, P3-0600, P3-0700) are gone. In their place: **4 smart templates** that cover every formal-administration opening variant via docxtemplater conditionals:

- `P3-PETITION` — Petition for Administration. Branches on `is_testate` / `is_ancillary` / `multiple_petitioners` / `multiple_prs`.
- `P3-OATH` — Oath of PR + Designation of Resident Agent. Loops over `prs` for multi-PR oaths.
- `P3-ORDER` — Order Admitting Will / Appointing PR. Branches on `is_testate` / `is_ancillary` / `multiple_prs`.
- `P3-LETTERS` — Letters of Administration / Letters of Ancillary Administration.

David's instruction: "the form numbers are meaningless to us." Summary admin (`P2-*`) stays on the per-variant template pattern; only formal admin was consolidated.

**Grammar fields precomputed in `prepareTemplateData()`** — templates read `{petitioner_label}` / `{petitioner_verb_alleges}` / `{pr_names}` / `{pr_label}` / `{multiple_petitioners}` / `{multiple_prs}` instead of nesting conditionals for every "Petitioner / Petitioners" / "alleges / allege" choice. Petitioners and PRs are `repeating_group` arrays; single-name `petitioner_name`/`pr_name` fallbacks synthesize a 1-element array so legacy single-petitioner flows still work.

**`is_testate` / `is_ancillary` live on `matter.matterData`** and are auto-populated by the wizard (`willType → is_testate`, `jurisdiction → is_ancillary`).

**Estate assets is now a repeating group** with a typed `Number` for `asset_value`. `prepareTemplateData` adds `asset_value_formatted` (USD via `Intl.NumberFormat`), `estate_assets_total`, and `estate_assets_total_formatted` for template display + later math.

**Wizard petitioners question** is no longer dimmed for formal admin (used to be, because formal was single-only; the smart templates now handle multi-petitioner formal).

**Lifecycle sections are collapsible.** Click `Open Estate` / `Estate Administration` / `Close Estate` header to toggle; state persists in `localStorage` (`gs_court_forms_collapsed_sections`).

**Auth is live.** David + Maribel auto-admin via `handle_new_user` trigger allow-list. Jill lands as `standard` until explicitly promoted.

**Per-matter attorney selector** in matter modal. David / Jill dropdown. Maribel is paralegal — not in `ATTORNEY_PROFILES`.

**`seedTestData()` is dead code** — defined but never called. The Maggie/Helen Torres seed referenced in prior handoffs never actually loads; real data lives in Supabase.

---

# 1. Objective

Browser-based Florida court form generator for Ginsberg Shulman, PL. Runs client-side with docxtemplater; data in Supabase (RLS-gated) with Microsoft OAuth sign-in. Live at `https://davidshulman22.github.io/guardianship-forms/`. Eventual direction: complete probate + guardianship file management system (see memory `project_future_file_mgmt_system.md`).

---

# 2. Current State

- **39 forms** in forms.json (5 guardianship, 24 summary admin / closing / general / inventory / notice, 4 smart formal-admin, 6 Broward local)
- **9 templates on the new pattern** — G2-010, G2-140, G3-010, G3-025, G3-026, P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS
- **~25 legacy templates remain** — all summary admin (`P2-*`), closing (`P5-*`), Broward local (`BW-*`), Inventory (P3-0900), Notice to Creditors (P3-0740), Notice of Designation of Email (P1-0900)
- **Tag audit passes** across all templates (`python3 scripts/audit_tags.py`)
- **Supabase live** — 3 tables (clients / matters / form_data) + user_profiles, all RLS-gated
- **Three lifecycle sections** in matter view (Open Estate / Estate Admin / Close Estate) are now collapsible (state persists in localStorage) and dynamically switch between formal and summary admin
- **Per-matter attorney selector** wired through matter modal → `ATTORNEY_PROFILES` → `getAttorneyDefaults(matter)` → template output
- **County-specific AI certifications** — `county_is_broward` / `county_is_miami_dade` booleans auto-populate from `matter.county`
- **Typed number fields** — forms.json supports `"type": "number"`; `asset_value` is the first consumer. Stored as real JS Number; templates get `{asset_value_formatted}` via `Intl.NumberFormat`

---

# 3. Work Completed This Session (2026-04-23 morning)

**Smart-template consolidation for formal administration opening:**
- Deleted 6 per-variant templates (P3-0100, P3-0120, P3-0420, P3-0440, P3-0600, P3-0700)
- Added 4 smart templates — P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS — that cover every formal-admin opening variant (testate × intestate × single × multiple × domiciliary × ancillary) via docxtemplater conditionals
- `build_probate_templates.py` rewritten; new `_estate_assets_table()` helper; `_add_probate_signature_block()` loops over `petitioners` for per-petitioner sig lines; new `_add_order_signature_block()` for judge signatures
- forms.json restructured: petitioners and prs are `repeating_group` arrays (no more `petitioner_name` / `pr_name` single fields on formal-admin forms)

**`prepareTemplateData()` overhaul (app.js):**
- Synthesizes `petitioners` / `prs` arrays from single-name fallbacks so legacy single-petitioner flows still populate the new templates
- Precomputes grammar strings: `petitioner_label` / `petitioner_poss` / `petitioner_verb_alleges` / `petitioner_verb_has` / `petitioner_verb_is` / `pr_label` / `pr_label_title` / `pr_label_caps` / `pr_verb_is` / `pr_pronoun_he_she` / `pr_pronoun_his_her` / `multiple_petitioners` / `multiple_prs` / `pr_names`
- Defaults `is_testate` / `is_ancillary` to `false` when absent
- Estate-assets formatting: maps over `estate_assets` to add `asset_value_formatted`, emits `estate_assets_total` / `estate_assets_total_formatted`

**Wizard fixes:**
- `wizardLoadForms()` propagates `is_testate` (from `willType`) and `is_ancillary` (from `jurisdiction`) onto `matter.matterData`
- Petitioners question no longer dimmed for formal admin (was stale — formal now supports multi-petitioner via smart template)
- `wizardFormMatrix` rewritten: 8 formal keys (testate/intestate × domiciliary/ancillary × single/multiple) all point at the same 4-template bundle; Broward locals attach by county

**Typed number field support:**
- forms.json `"type": "number"` renders `<input type="number" inputmode="decimal">`
- `collectFormData()` coerces to `Number` (or `null` when blank); `dataset.type` drives the coerce
- Works for both top-level fields and `repeating_group` subfields

**UI — collapsible lifecycle sections:**
- HTML: `openEstateWizard` / `adminSection` / `closingSection` got a `collapsible` class
- CSS: chevron marker on header, `.is-collapsed` hides everything below the header
- JS: `setupCollapsibleSections()` wires click-to-toggle, persists state in `localStorage` key `gs_court_forms_collapsed_sections`

**audit_tags.py updates:**
- AUTO_POPULATED extended with grammar fields (`petitioner_label`, `pr_names`, etc.), matter-level booleans (`is_testate`, `is_ancillary`), and derived asset fields (`asset_value_formatted`, `estate_assets_total*`)

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
- [x] Formal admin opening — **DONE** via 4 smart templates (P3-PETITION / P3-OATH / P3-ORDER / P3-LETTERS)
- [ ] Post-opening filings:
  - P3-0740 Notice to Creditors
  - P3-0900 Inventory (coordinate with the new estate_assets schema — inventory can pull directly)
- [ ] Notice of Administration (not yet in forms.json — needs new ID; FLSSI P3-0802 testate, P3-0804 intestate — consolidate into one smart `P3-NOTICE-ADMIN`)
- [ ] Summary admin (P2-*) — 19 templates. Same consolidation opportunity: testate/intestate × single/multiple collapses to ~2 smart templates per function (Petition + Order)
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
- David marks `[x]` in SKIP column of `docs/FORMS_CATALOG_MAP.md` for forms he doesn't want
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

**Priority 7 — Case management / file management system (LONG-TERM, LATER):**
- Full planning document at `docs/CASE_MANAGEMENT_SYSTEM_PLAN.md` (created 2026-04-22)
- Covers: matter lifecycle, 17 functional subsystems, cross-cutting concerns, 10 open design decisions, 9-phase roadmap
- **Do not start until Priority 1 (probate template rebuild) AND Priority 1b (Matter Interview) are complete**
- North-star vision; current forms app is Phase 0 of this system

---

# 7. Known Issues / Risks

- ~25 probate/local templates still on legacy 2-column FLSSI layout. Not broken, but the rebuild will make them consistent with the guardianship + formal-admin-opening set.
- Matter-level facts still live under per-form `formData` — see Priority 1b. Today's work moved `is_testate` / `is_ancillary` to `matterData` but the rest still lives per-form.
- `seedTestData()` is defined but never called — orphan dead code referenced in prior handoffs. Real data lives in Supabase; there is no "seed" loading path.
- Sign-in has been stable since the 2026-04-22 morning fix. If it goes blank again, grab `[auth]` console logs first.
- python-docx numbering is a known pain point — we work around it via post-save zip manipulation in `_inject_numbering_part`. Don't try to use python-docx's built-in `List Number` style; it won't match firm conventions.
- **Existing Supabase form_data rows with old FLSSI form IDs** (P3-0100, P3-0120, etc.) are orphaned — the new smart templates read from P3-PETITION / P3-ORDER / etc. keys. No migration written. If a mid-session matter has saved P3-0100 data, it won't auto-populate P3-PETITION. For fresh matters this isn't a problem.

---

# 8. Next Best Action

**Immediate (next session):**
1. David live-tests each smart template variant on a real matter. Run the wizard, confirm all 8 formal-admin keys (testate/intestate × domiciliary/ancillary × single/multiple) produce correctly-worded .docx files. Especially sanity-check the grammar in the multi-petitioner and ancillary branches — those paths are new.
2. Once formal-admin opening is settled, pick the next chunk: Post-opening filings (Notice to Creditors, Inventory), Notice of Administration, or Summary Admin consolidation.
3. Consider consolidating Summary Admin with the same smart-template approach — the testate/intestate + single/multiple axes are identical, just the administration framework is different.

**Parallel work** — matter-level data interview (Priority 1b) — weekend-sized. Don't start without asking David.

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
- **39 forms** in forms.json (5 guardianship, 24 summary admin / closing / general / inventory / notice, 4 smart formal-admin, 6 Broward local)
- **9 templates on the new builder pattern**: G2-010, G2-140, G3-010, G3-025, G3-026, P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS
  - Real Word numbering, 1.5 line spacing, single-column captions, real Word tables, docxtemplater conditionals, Broward AI cert via `{#county_is_broward}`
- **Smart formal-admin templates** consolidate 6 FLSSI IDs into 4 templates via conditionals (testate/intestate, single/multiple petitioners, domiciliary/ancillary, single/multiple PRs)
- **`build_guardianship_templates.py`** + **`build_probate_templates.py`** — all new templates go through Python builders. Never hand-edit .docx
- **Microsoft OAuth via Supabase**, David + Maribel auto-admin via trigger allow-list
- **Per-matter signing attorney** — David/Jill dropdown in matter modal
- **County-specific AI certifications** — Broward + Miami-Dade handled
- **Typed number fields** — `asset_value` is a real JS Number; templates get `{asset_value_formatted}` via `Intl.NumberFormat` USD
- **Collapsible lifecycle sections** — click header to toggle, state persists in localStorage

### What's next
**IMMEDIATE TASK — Post-opening filings on the new pattern:**
- P3-0740 Notice to Creditors
- P3-0900 Inventory (rewire to `estate_assets` repeating group)
- Notice of Administration (new form — not yet in forms.json; FLSSI P3-0802 / P3-0804)
- Then Summary Admin (P2-*) consolidation, Discharge (P5-*), Broward (BW-*), P1-0900
- Pattern: `build_probate_templates.py` has the helpers. Add a `build_*()` function per form; use the smart-template approach where it helps.

**ARCHITECTURAL TODO — Matter-level data interview (Priority 1b):**
- Lift decedent/AIP/relatives/assets up from per-form `formData` to `matter.matterData`. Weekend-sized. Don't start without asking.

**FUTURE DIRECTION:**
- Eventual file management system (memory `project_future_file_mgmt_system.md`). Not now.

### Key files
- `app.js` — application logic (~2000 lines). `ATTORNEY_PROFILES`, `getAttorneyDefaults(matter)`, `prepareTemplateData()`, `populateFormSections()`
- `auth.js` — Microsoft OAuth + Supabase session handling
- `scripts/build_guardianship_templates.py` — builder + all shared helpers (`_pleading_para`, `_add_broward_ai_certification`, `_inject_numbering_part`, etc.)
- `scripts/build_probate_templates.py` — probate builder; has `_add_probate_caption`, `_beneficiaries_table`, `_estate_assets_table`, `_add_probate_signature_block`, `_add_order_signature_block`
- `scripts/audit_tags.py` — `python3 scripts/audit_tags.py` to verify template tags match forms.json
- `forms.json` — 39 form definitions (post-consolidation)
- `supabase-setup.sql` — DB schema + trigger allow-list for admin
- `CLAUDE.md` — full project context with builder pattern notes
- `docs/FORMS_CATALOG_MAP.md` — FLSSI 2025 catalog with SKIP checkboxes for future batch build

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
