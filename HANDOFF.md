# CHAT HANDOFF — RESUME-READY
**Generated:** 2026-04-15
**Source:** Claude Code session — Broward local forms build + multi-petitioner model
**Status:** RESUME-READY

---

# 1. Objective

Build a browser-based app for generating Florida court forms (FLSSI 2025 + Broward County local forms) that David Shulman uses daily for his probate filings. Select a client, select a matter, answer wizard questions or pick forms manually, fill out a merged questionnaire, and download populated `.docx` files individually or as a `.zip` bundle. Everything runs client-side with localStorage persistence.

---

# 2. Current State

The app is functional for all Broward County domiciliary probate paths — formal admin (testate + intestate) and summary admin (testate + intestate). 41 forms are defined in forms.json (5 guardianship, 30 FLSSI probate, 6 Broward local). All templates generate correctly. Multi-petitioner support is implemented as a repeating group. The app runs at `http://localhost:8765` via `python3 -m http.server 8765` or `python3 serve.py`.

---

# 3. Work Completed

- **6 Broward local forms** built from actual 17th Circuit court PDFs:
  - BW-0010: Affidavit Regarding Criminal History (all cases)
  - BW-0020: Mandatory Checklist — Formal Admin Testate (updated with will conformity item)
  - BW-0030: Mandatory Checklist — Formal Admin Intestate (15 items)
  - BW-0040: Mandatory Checklist — Summary Admin Testate (19+ items, rev 12/9/2025)
  - BW-0050: Mandatory Checklist — Summary Admin Intestate (rev 12/9/2025)
  - BW-0060: Affidavit of Heirs (10 family categories + notary)
- **Wizard matrix** updated — all 8 domiciliary entries route to correct Broward checklists; intestate paths auto-include Affidavit of Heirs
- **Multi-petitioner model** — P2-0205, P2-0215, P2-0220, P2-0225 now use `petitioners` repeating group (name, address, relationship) with auto-population from client data and docxtemplater loop tags in templates
- **Reference PDFs** saved to `reference/` for all 3 new checklists (downloaded from 17th Circuit website)
- **3 additional checklist URLs** captured but not yet built: Formal Ancillary, Summary Ancillary, Homestead, Disposition, Sell Real Property
- **Committed and pushed** to `main` on GitHub (`davidshulman22/guardianship-forms`)
- **Form count**: 37 → 41

---

# 4. Key Decisions (with reasoning)

| Decision | Why It Was Made |
|----------|----------------|
| Use `scl_` prefix for summary checklist fields (vs `cl_` for formal) | Avoids field name collision when formal and summary forms share data within a matter |
| Affidavit of Heirs uses textarea fields (not repeating groups) for family info | Matches the actual court form structure — each category is free-text, not structured rows |
| Ancillary checklists deferred | David's priority is domiciliary (Broward-based) cases; ancillary URLs captured for later |
| Multi-petitioner uses repeating group pattern (like beneficiaries) | David chose this over simpler alternatives; matches existing UI/data patterns |
| `petitioner_names` derived from petitioners array for backward compatibility | Single-petitioner forms still use `petitioner_name`; multi-petitioner templates use loop tags |
| All artifacts saved in Dropbox project folder, not just `.claude/` | David moves between computers; Dropbox syncs, `.claude/` does not |

---

# 5. Constraints & Preferences

**Technical constraints:**
- Vanilla JS, no frameworks — single `app.js`, `index.html`, `styles.css`
- docxtemplater (CDN) for `.docx` generation, PizZip, FileSaver.js
- All form field definitions live in `forms.json`, NOT in app.js
- Template tags: `{field_name}` for text, `{field_check}` for checkboxes (bool→`(X)`/`(  )`), `{#group}...{/group}` for loops
- No f-strings in Python template scripts (double-escapes braces); use `+` concatenation
- No required fields during build phase

**User preferences:**
- Probate first, guardianship later
- David is both builder and primary user
- Plans, handoffs, and working artifacts must be saved in the Dropbox project folder
- Git commit and push at end of every session

**Non-negotiables:**
- File No. always optional (assigned after filing)
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896
- Address: Ginsberg Shulman PL, 300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301

---

# 6. Remaining Work

**Priority 1 — David's immediate requests:**
- [ ] **Claude-powered auto-population** — David does substantial work on matters in Claude/Cowork sessions and has context files (e.g., `Muscara_Context.md`) with all client/matter data. Design a flow where Claude reads a context file and generates form field data that populates the app. David specifically said "not Clio — Claude. You."
- [ ] **In-progress matter onboarding** — David has existing probate matters mid-stream (past petition stage). Needs a "Quick Add Matter" flow to enter client + matter metadata (case number, county, division, subject name) without running the opening wizard, then jump to whichever forms/lifecycle stage is needed

**Priority 2 — From the original roadmap:**
- [ ] **Ancillary checklists** — Formal Ancillary and Summary Ancillary Broward checklists. URLs captured:
  - Formal Ancillary: `http://www.17th.flcourts.org/wp-content/uploads/2017/08/Petition.for_.Formal.Ancillary.Admininistration.pdf`
  - Summary Ancillary: `http://www.17th.flcourts.org/wp-content/uploads/2025/12/Revised-Petition.for_.ANCILLARY.Summary.Administration-12.9.25_forms.pdf`
- [ ] **Walk through Helen Torres's estate chronologically** — P3-0100 → P3-0420 → P3-0600 → P3-0700 → P3-0740 → P3-0900 → P5-0400 → P5-0800. Verify each template's tags match and cross-form data flows correctly
- [ ] **Template tag audit for remaining 29 probate templates** — P3-0100 was fully audited; others haven't been
- [ ] **Lifecycle bundles beyond opening** — wizard handles opening; still need bundles for Notice to Creditors, Inventory, and Closing (Discharge) phases

**Other captured URLs (Broward checklists not yet built):**
- Homestead: `https://www.17th.flcourts.org/wp-content/uploads/2023/10/REVISED-HOMESTEAD-CHECKLIST-2-1-1.pdf`
- Disposition: `http://www.17th.flcourts.org/wp-content/uploads/2017/08/Disposition.of_.Property.Without.Administration..pdf`
- Sell Real Property: `https://www.17th.flcourts.org/wp-content/uploads/2023/11/Checklist-for-Petition-to-Sell-Real-Property-Estate-and-Guardianship-1-1.pdf`

---

# 7. Known Issues / Risks

**Problems:**
- None identified — all wizard paths tested and working

**Weak spots:**
- The 29 non-audited probate templates may have missing or mismatched tags (P3-0100 had 4 missing tags when audited)
- Ancillary wizard entries still only have BW-0010 — ancillary checklists are deferred
- `seedVersion` was not bumped — existing seed data won't refresh with new form definitions unless bumped

---

# 8. Unknowns / Missing Context

- How David wants the Claude auto-population to work mechanically (read context file → JSON blob → paste into app? Or write directly to localStorage?)
- Whether the "Quick Add Matter" needs batch import (many matters at once) or one-at-a-time
- Whether ancillary cases are common enough to prioritize

---

# 9. Next Best Action

Design the Claude-powered auto-population flow — David asked for this explicitly and it's the highest-leverage feature for his daily workflow.

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
- **41 tagged .docx templates** in `templates/` (30 FLSSI + 6 Broward + 5 guardianship)
- **Open Estate wizard:** Asks administration type, testate/intestate, domiciliary/ancillary, single/multiple petitioners, county → auto-selects correct forms from a matrix
- **Batch generation:** Select multiple forms, fill merged fields once, download as .zip
- **6 Broward local forms** built from actual 17th Circuit court PDFs:
  - BW-0010 (Criminal History Affidavit — all cases)
  - BW-0020 (Checklist — Formal Admin Testate)
  - BW-0030 (Checklist — Formal Admin Intestate)
  - BW-0040 (Checklist — Summary Admin Testate, rev 12/9/2025)
  - BW-0050 (Checklist — Summary Admin Intestate, rev 12/9/2025)
  - BW-0060 (Affidavit of Heirs — required for all intestate)
- **County-aware wizard:** Broward triggers correct local forms automatically for all domiciliary paths
- **Multi-petitioner model:** P2-0205/0215/0220/0225 use `petitioners` repeating group (name, address, relationship) with docxtemplater loop tags
- **Cross-form data sharing:** Fields entered on one form auto-populate into others for the same matter
- **P3-0100 fully tested** end-to-end — all 32 tags populate, generates clean .docx
- **Test data:** Margaret Torres with 3 matters (probate + 2 guardianship)
- **No login required** — auth disabled for local dev
- **Reference PDFs** in `reference/` — all Broward checklists, Local Procedures, Affidavit of Heirs

### What's next (priority order)
1. **Claude-powered auto-population** — David does substantial matter work in Claude/Cowork sessions and has context files with all client/matter data. Design a flow where Claude reads a context file and generates form data to populate the app. David said explicitly: "not Clio — Claude. You." Example context file: `/Users/davidshulman/Clio/files/Muscara, Robert/Estate of Lorraine Muscara/01700-Muscara-Estate of Lorraine Muscara/Muscara_Context.md`
2. **In-progress matter onboarding** — "Quick Add Matter" flow to enter existing matters that are mid-stream (past petition stage) without running the opening wizard. David has "a whole bunch" to add.
3. **Ancillary Broward checklists** — URLs captured, PDFs downloadable from 17th Circuit site
4. **Helen Torres chronological walkthrough** — verify each template in the full probate lifecycle
5. **Template tag audit** — 29 remaining probate templates haven't been audited
6. **Lifecycle bundles** — Notice to Creditors, Inventory, Closing (Discharge) phases

### Key architecture decisions
- **Wizard form matrix** (`wizardFormMatrix` in app.js) maps all combinations → exact form IDs. Easy to extend.
- **`scl_` prefix** for summary checklist fields vs `cl_` for formal — avoids collision in cross-form data sharing
- **BW-* prefix** for Broward local forms, separate from FLSSI P-* numbering
- **`create_broward_templates.py`** generates all 6 BW templates from scratch using python-docx
- **`update_multi_petitioner_templates.py`** updates FLSSI templates with loop tags
- **Repeating group pattern** used for both beneficiaries and petitioners — same UI, same data flow

### Key files
- `app.js` — all application logic (~1100 lines), includes wizard matrix, batch generation, auto-population
- `forms.json` — 41 form definitions with all field/section structure
- `index.html` — single-page app shell with wizard UI
- `styles.css` — all styles including wizard
- `create_broward_templates.py` — generates all 6 BW-*.docx templates
- `update_multi_petitioner_templates.py` — updates multi-petitioner templates with loop tags
- `CLAUDE.md` — full project context (read this first)
- `PLAN.md` — implementation plan from this session
- `reference/` — all Broward County source PDFs from 17th Circuit

### Constraints
- No required fields during build phase
- Probate first, guardianship later
- File No. assigned after filing — always optional
- Save all artifacts to Dropbox project folder (David moves between computers)
- Git commit and push at end of every session
- Attorney defaults: David A. Shulman, Bar No. 150762, david@ginsbergshulman.com, 954-990-0896
- Address: Ginsberg Shulman PL, 300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301

### Broward County reference
- **Judges:** Gillespie (62J, Administrative), Lopane (60J), DePrimo (61J), Magistrate Laventure
- **Filing rules:** Mandatory checklists for ALL petition types; Clerk will NOT forward without them
- **Remaining checklist URLs not yet built:** Formal Ancillary, Summary Ancillary, Homestead, Disposition, Sell Real Property — all captured in previous handoff

---
