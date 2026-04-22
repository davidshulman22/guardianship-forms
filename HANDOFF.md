# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-21 (late evening)
**Source:** Claude Code session — G3-025 rebuild + Supabase/OAuth attempt
**Status:** RESUME-READY — David tapped out late; forms formatting is top priority for next session

---

# 0. READ FIRST — State as of 2026-04-21 end-of-night

**The top priority for next session is fixing form formatting across the rest
of the catalog.** David said: "Jill has no tech knowledge. she has no idea
how long this takes. she tries and if it doesn't work perfectly she gets
frustrated and gives up. So let's go back to what we started on, making
the forms look right."

Two work threads landed on `main` tonight:

**A. G3-025 rebuild (working).** `templates/G3-025.docx` was rebuilt from
scratch via `build_guardianship_templates.py` to match Jill's preferred
clean single-column format. Real tables for next-of-kin and property,
docxtemplater conditionals for has-alternatives / has-preneed /
is-professional, running header on pages 2+. forms.json updated, app.js
attorney switcher updated (guardianship → Jill, probate → David).

**B. Supabase + Microsoft OAuth (shipped but flaky).** localStorage → Supabase
migration with Azure AD single-tenant auth. Deployed to `main` but the
OAuth callback flow is unreliable — `exchangeCodeForSession` and
`getSession` hang indefinitely under conditions we never pinned down.
Latest commit (`8c897e6`) added timeouts and simplified to rely only on
`onAuthStateChange`. David saw the login screen work but the full
end-to-end flow is still shaky.

**Decision David did NOT make:** whether to revert the Supabase merge
from `main` so Jill can use the app without login. **Ask him first
thing.** If he says revert, run:

```bash
git revert -m 1 9186c07
git revert 8c897e6
git push origin main
```

Branch `supabase-migration` keeps the work for later. Supabase project
is live with David as admin; Jill has never signed in.

**Recommendation: revert auth, focus on forms.** Jill needs the app to
just work without setup. Auth adds friction she won't tolerate, and the
current implementation has a real hang bug we don't fully understand.

---

---

# 1. Objective

Build a browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms) that David Shulman uses daily for his probate filings. Everything runs client-side with localStorage persistence. The key differentiator: Claude integration — populate forms directly from matter context files without manual data entry.

---

# 2. Current State

The app is functional for all Broward County domiciliary probate paths. **41 forms** defined in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local). **All 36 probate/local templates pass tag audit — zero mismatches.** Claude import feature is built and working. The matter view has **three lifecycle sections** (Open Estate, Estate Administration, Close Estate) that dynamically switch between formal and summary admin form sets based on wizard selections. App runs locally only at `http://localhost:8765`.

---

# 3. Work Completed

**Latest session (2026-04-21, evening):**
- **Rebuilt G3-025 Plenary Guardian of Property template** from scratch to
  match Jill's preferred format (Villareal case PDFs on David's Desktop were
  the reference). Abandoned the FLSSI two-column layout — it was breaking
  when fields with line breaks hit justified paragraphs, spreading words
  across the page. New layout: single-column, clean caption table, real
  Word tables for next-of-kin and property with Nature/Value columns,
  docxtemplater conditional blocks for has-alternatives, has-preneed, and
  is-professional-guardian, running header "Guardianship of {aip_name} /
  Page X of Y" on pages 2+.
- **Added `build_guardianship_templates.py`** — python-docx builder with
  reusable helpers (`_add_para`, `_table_with_borders`, `_add_page_field`,
  `_set_different_first_page_header`). Follow this pattern for the other
  guardianship forms.
- **forms.json for G3-025 rewritten** — added `aip_age`, `aip_address`,
  `petitioner_address`, `has_alternatives`, `preneed_guardian_name`,
  `preneed_reason`, `is_professional_guardian`; replaced the
  `property_description` textarea with a `property_items` repeating group.
- **`getAttorneyDefaults(matterType)` helper in app.js** — guardianship
  matters default to Jill (Bar 813850, jill@ + maribel@hflegalsolutions.com
  secondary), probate stays David. `prepareTemplateData` updated: booleans
  passed raw so `{#field}` conditionals resolve, legacy `_check` preserved
  for older templates, `aip_name_upper` emitted for captions.
- **Seeded Villareal test matter** in `seedTestData()` (seedVersion not
  bumped, so existing users won't see it; fresh installs will).
- **Supabase auth migration** (shipped but unreliable, see section 0):
  new schema (`clients`, `matters`, `form_data`, `user_profiles` with
  admin/standard roles via RLS), Microsoft OAuth through Supabase's Azure
  provider, login gate in `index.html`, `auth.js` for sign-in/out, owner
  badge in client list for admins. `SUPABASE_SETUP.md` documents the
  dashboard steps.

**Prior mini-session (2026-04-17):**
- **Housekeeping** — added `.claude/` and `*.docx.bak` to `.gitignore`; untracked `.DS_Store`; deleted stale `templates/P3-0100.docx.bak`
- **Added `audit_tags.py`** — reusable tag audit script. Walks `subfields` inside repeating groups; excludes auto-populated fields (caption, attorney defaults, petitioner/affiant/notary). Run: `python3 audit_tags.py`. Currently passes clean.
- **Fixed BW-0060** (Affidavit of Heirs) — template had `{judge_name}` tag but forms.json was missing the field. Added `judge_name` text field to Affiant Information section.
- **Captured 5 Broward ancillary/misc checklist PDFs** to `reference/` (Formal Ancillary, Summary Ancillary, Homestead, Sell Real Property, Disposition) — ready to build templates from. NOT YET BUILT.
- **Added "Future / fork" priority** to Remaining Work — generalize template architecture to non-court documents (engagement letters, estate planning docs, etc.)

**Prior session (2026-04-16, third pass):**
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

**Priority 1 — Fix form formatting across the catalog (TOP PRIORITY):**
- [ ] G3-025 is done (see section 3 — single-column rebuild using
      `build_guardianship_templates.py`). The rest of the catalog still
      uses the old FLSSI two-column layout that breaks on multi-line
      fields in justified paragraphs.
- [ ] Use G3-025 as the pattern. Extend `build_guardianship_templates.py`
      with a builder function per form. Build one form end-to-end, review
      with David, iterate on the pattern, then batch the rest.
- [ ] Likely next targets (Jill's area — guardianship):
      **G3-026** Petition for Limited Guardian of Person and Property,
      **G3-010** Petition for Emergency Temporary Guardian,
      **G2-010** Petition to Determine Incapacity.
- [ ] Reference docs: `Villareal ... 2026-04-21.pdf` (BEFORE — broken)
      and `Villareal ... Updated JRG1.pdf` (AFTER — Jill's format).
      Both on David's Desktop.
- [ ] Key docxtemplater features to lean on: `{#conditional}...{/conditional}`
      for optional paragraphs, `{#loop}...{/loop}` in a table row for
      repeating data, `{^neg}...{/neg}` for "show when falsy", plain
      `{field}` for scalars. Booleans pass through raw now (see
      `prepareTemplateData()` in app.js).
- [ ] Beware of justified text + line-break-containing fields — that
      combo is what breaks the old FLSSI layouts. Use left-aligned
      paragraphs or separate paragraphs per value.

**Priority 2 — FLSSI catalog build-out (waiting on David):**
- [ ] David marks `[x]` in SKIP column of `FORMS_CATALOG_MAP.md` for forms he doesn't want
- [ ] When David says "ready", build all unmarked forms: tag source .docx, add to forms.json, wire into wizard/sections
- [ ] 138 missing forms; realistic batch after skips: ~60–80

**Priority 3 — Import bugs (David has more to report):**
- [ ] Debug and fix issues David encounters with the import flow
- [ ] Test import → wizard → generate → download end-to-end

**Priority 4 — Section refinement:**
- [ ] Identify seldom/never-used forms for a collapsed section

**Priority 4 — Claude direct document generation (v2 vision):**
- [ ] "Draft the petition" in chat → .docx output, no browser interaction
- [ ] Standalone Node.js script or Cowork skill using docxtemplater directly

**Priority 5 — Quick Add Matter:**
- [ ] Onboard existing mid-stream matters without the opening wizard

**Priority 6 — Ancillary Broward checklists:**
- [ ] PDFs downloaded 2026-04-17 — `reference/Broward-Checklist-{Formal-Ancillary,Summary-Ancillary,Homestead,Sell-Real-Property,Disposition}.pdf`
- [ ] For each: add builder fn to `create_broward_templates.py` (follow BW-0020/0030 pattern), extract checkbox items from the PDF, enumerate fields in `forms.json`, wire into `wizardFormMatrix`
- [ ] Suggested IDs: BW-0070 (Formal Ancillary), BW-0080 (Summary Ancillary), BW-0090 (Homestead), BW-0100 (Sell Real Property), BW-0110 (Disposition)
- [ ] Rough scope: ~150 lines of Python per template + forms.json entry. Plus new wizard questions for ancillary/homestead/sell/disposition paths.
- [ ] Recommend: build ONE (e.g., Homestead) end-to-end as pattern, review, then batch the other 4

**Priority 7 — Case management system:**
- [ ] Asset inventory, date/deadline tracking, todo/task list per matter

**Future / fork — Generalize beyond court forms:**
- [ ] Extend the same template + forms.json + auto-populate architecture to any fill-in document: engagement letters, estate planning documents (wills, trusts, POAs, HC surrogates), retainer agreements, correspondence, etc.
- [ ] Likely a fork or a sibling "Documents" section rather than mixing with court pleadings
- [ ] Same mechanics: `.docx` template with `{tags}` → forms.json field defs → cross-matter auto-populate → generate
- [ ] Captured 2026-04-17 — do not start until FLSSI catalog build-out is done

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

**Immediate (for next Claude session):**
1. Greet David, then read section 0 out loud (summarize). Ask whether to
   revert the Supabase/OAuth merge from `main` so Jill can keep using
   the app without login. Recommendation: yes, revert.
2. Regardless of revert decision, the next work is **fixing form
   formatting** — Priority 1. Ask David which form to tackle first.
   Default suggestion: G3-026 (Limited Guardian of Person and Property),
   since it's structurally similar to G3-025 which we just nailed.
3. Use `build_guardianship_templates.py` as the scaffold. Add a
   `build_g3_026()` function next to `build_g3_025()`.

**After first form rebuilt:** run tag audit, commit, push, ask for
David's review on the output before moving to the next form.

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

**IMMEDIATE TASK — Fix form formatting across the catalog:**
- G3-025 (Plenary Guardian of Property) was rebuilt 2026-04-21 via
  `build_guardianship_templates.py` using a clean single-column layout
  that matches Jill's Villareal edits. The rest of the catalog still
  uses the old FLSSI two-column style that breaks on multi-line fields
  in justified paragraphs (words spread across the page).
- Next form to tackle: **G3-026** (Limited Guardian of Person and Property).
- Pattern: add a `build_g3_026()` function to
  `build_guardianship_templates.py`, using the same helpers. Inspect the
  existing FLSSI source at `templates/G3-026.docx` for the paragraph
  content, but rewrite the layout from scratch.
- Build one, review with David, iterate, then batch the rest.

**UNRESOLVED DECISION — Revert Supabase/OAuth merge?**
- Tonight's session shipped Microsoft OAuth + Supabase multi-user
  storage to main. The sign-in flow is flaky (hang bugs not fully fixed).
- Jill is non-technical and will bounce if sign-in fails. David called
  it a night before deciding whether to revert.
- First thing next session: ask. If yes →
  `git revert -m 1 9186c07 && git revert 8c897e6 && git push origin main`.
  Keeps Supabase work alive on branch `supabase-migration`.

**After forms formatting:**
2. FLSSI catalog build-out (see `FORMS_CATALOG_MAP.md`)
3. Fix remaining import bugs
4. Declutter sections
5. Claude direct generation (v2)
6. Quick Add Matter for mid-stream matters
7. Ancillary Broward checklists
8. Case management system

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
