# Plan: Broward Local Forms + Multiple Petitioners

## Context

David uses this app daily for Broward County probate filings. The wizard currently handles opening a formal testate estate in Broward, but intestate and summary admin paths are missing their mandatory Broward checklists — meaning David can't use the wizard for those case types yet. The Affidavit of Heirs is required for ALL intestate cases and doesn't exist in the app. Multi-petitioner support is needed because summary admin petitions commonly have multiple beneficiaries as co-petitioners.

Additionally, David has existing in-progress matters he wants to add to the system (not just new filings). This needs a smooth onboarding path — discussed separately at the end.

---

## Phase 1: Save Reference PDFs + Update BW-0020

**Goal**: Get the downloaded PDFs into `reference/`, update BW-0020 to match the actual court form.

### 1A. Save downloaded PDFs to reference/
Copy the 3 downloaded checklist PDFs to `reference/` with consistent naming:
- `Broward-Checklist-Formal-Admin-Intestate.pdf`
- `Broward-Checklist-Summary-Admin-Testate.pdf`
- `Broward-Checklist-Summary-Admin-Intestate.pdf`

### 1B. Update BW-0020 template to match actual PDF
The actual testate formal admin checklist (reference PDF) has items the current BW-0020 is missing:

**Add to `create_broward_templates.py` → `create_mandatory_checklist_testate()`:**
- After `cl_self_proved_check`: add OR clause for non-FL-resident will conformity affidavit (`cl_will_conformity_check`)
- Update certification language to match actual PDF format (signature lines with dates, "diligent search and reasonable effort" in Cert B)

**Add to `forms.json` BW-0020 definition:**
- New checkbox: `cl_will_conformity` — "Non-FL resident: affidavit of will conformity filed"

**Files**: `create_broward_templates.py`, `forms.json`

---

## Phase 2: Create BW-0030 (Formal Admin Intestate Checklist)

**Source**: `reference/Broward-Checklist-Formal-Admin-Intestate.pdf` (3 pages)

### Exact checklist items from the actual PDF:
1. `cl_death_cert` — A death certificate was filed.
2. `cl_criminal_history` — An Affidavit Concerning Criminal History was filed.
3. `cl_affidavit_heirs` — An Affidavit of Heirs was filed.
4. `cl_petition_verified` — The Petition is verified.
5. `cl_petition_signed_interested` — The Petition is signed by the interested person(s).
6. `cl_petition_signed_attorney` — The Petition is signed by an attorney of record.
7. `cl_petitioner_relationship` — The Petition includes the Petitioner's relationship to decedent and the Petitioner's residence.
8. `cl_petitioner_qualified` — The Petitioner is not a convicted felon and is a FL resident (or related if non-FL).
9. `cl_beneficiaries` — The correct beneficiaries are listed with birthdates of minors.
10. `cl_pr_intestate_preference` — The proposed PR has preference of appointment in an intestate administration.
11. `cl_assets` — The assets and approximate values are listed.
12. `cl_oath_filed` — Oath of PR and designation of resident agent filed.
13. `cl_order_filed` — Proposed order appointing PR filed, with space for bond.
14. `cl_order_sig_page` — Signature page has 4+ lines and case number.
15. `cl_letters_filed` — Proposed letters of administration filed with 4+ lines on sig page.
+ Certifications A and B (petition-type-specific language)

**Key differences from testate (BW-0020):**
- NO Broward residence/property situs item
- NO will items (will filed, lost will, self-proved, will conformity)
- NO preference of appointment for testate
- NO trust beneficiary section
- ADD Affidavit of Heirs
- Petition items split into 4 separate checks (verified, signed by interested persons, signed by attorney, relationship/residence) vs 2 combined items in testate
- Order includes "space for the Court to enter a bond in its discretion"

**Files**: `create_broward_templates.py` (new function), `forms.json` (new entry), `app.js` (wizard matrix)

---

## Phase 3: Create BW-0040 (Summary Admin Testate Checklist)

**Source**: `reference/Broward-Checklist-Summary-Admin-Testate.pdf` (4 pages, revised 12/9/2025)

### Exact checklist items from the actual PDF:
1. `scl_death_cert` — Death certificate was filed.
2. `scl_medical_bills` — Proof of payment of medical bills from last 60 days of last illness.
   - OR `scl_no_medical` — No such expenses, stated in Petition.
3. `scl_funeral_expenses` — Proof of payment of reasonable funeral expenses.
4. `scl_criminal_history` — Affidavit Regarding Criminal History filed.
5. `scl_beneficiary_info` — Petition includes: (a) surviving spouse name/address; (b) beneficiary names/addresses/relationships; (c) minor birthdates.
6. `scl_venue` — Petition includes statement showing venue.
7. `scl_domiciliary_proceedings` — Petition includes statement re: domiciliary/principal proceedings from another state/country.
8. `scl_summary_eligible` — Petition demonstrates summary eligibility (died 2+ years ago or estate < $75K less exempt property).
9. `scl_petitioner_qualified` — Petitioner is a beneficiary or person nominated as PR in will.
10. `scl_will_no_admin` — Petition states will does not direct ch.733 administration.
11. `scl_assets_described` — Petition specifically describes assets with values (institution names, account numbers, legal descriptions).
12. `scl_creditor_search` — Petition states diligent search for creditors conducted + penalty acknowledged.
13. Claims group:
    - `scl_no_claims` — No claims filed. OR
    - `scl_claims_filed` — Claims filed, with sub-options:
      - `scl_claims_barred` — Claims barred by statute; OR
      - `scl_claims_paid` — Provision for payment made; OR
      - `scl_claims_insufficient` — Insufficient assets + formal notice served on creditors.
14. Beneficiary notice group:
    - `scl_formal_notice` — All beneficiaries received formal notice of petition + proposed distribution; OR
    - `scl_consents_filed` — Consents from all beneficiaries filed.
15. `scl_distribution_correct` — Proposed order includes correct distribution per will.
16. `scl_will_admitted` — Proposed order admitting will to probate was filed.
17. `scl_order_sig_page` — Sig page has 4+ lines + case number.
18. Trust group:
    - `scl_no_trust` — Trust is NOT a beneficiary. OR
    - `scl_trust_beneficiary` — Trust IS a beneficiary:
      - `scl_trustee_is_petitioner` — Every trustee is also a petitioner + disclosure filed + served qualified beneficiaries; OR
      - `scl_trustee_not_petitioner` — At least one trustee is not a petitioner.
19. Real property group:
    - `scl_no_real_property` — No real property. OR
    - `scl_has_real_property` — Has real property:
      - `scl_homestead_filed` — Claiming homestead, petition filed; OR
      - `scl_no_homestead` — Not claiming homestead.
+ Certifications A and B

**Note**: Summary checklists use `scl_` prefix to avoid collision with formal admin `cl_` fields (they share form data across a matter, and a matter could theoretically have both formal and summary forms).

**Files**: `create_broward_templates.py` (new function), `forms.json` (new entry), `app.js` (wizard matrix)

---

## Phase 4: Create BW-0050 (Summary Admin Intestate Checklist)

**Source**: `reference/Broward-Checklist-Summary-Admin-Intestate.pdf` (4 pages, revised 12/9/2025)

### Exact checklist items — differs from summary testate:
1-4. Same: death cert, medical bills, funeral expenses, criminal history
5. `scl_affidavit_heirs` — Affidavit of Heirs filed. *(intestate-only, replaces beneficiary-info-from-will)*
6. `scl_venue` — same
7. `scl_domiciliary_proceedings` — same
8. `scl_summary_eligible` — same
9. `scl_petitioner_is_beneficiary` — Petitioner is a beneficiary of the estate. *(simpler — no "nominated as PR in will")*
10. `scl_beneficiary_info_intestate` — Petition includes: (a) surviving spouse; (b) beneficiary names/addresses/relationships; (c) minor birthdates.
11. `scl_no_wills` — Petition states after diligent search, Petitioner is unaware of any unrevoked wills or codicils. *(intestate-only)*
12. `scl_assets_described` — same
13. Beneficiary notice: all **intestate** beneficiaries formal notice OR consents from all **intestate** beneficiaries
14. `scl_creditor_search` — same
15. Claims group — same structure
16. `scl_distribution_intestacy` — Proposed order includes correct distribution under laws governing intestacy. *(not "per will")*
17. `scl_order_sig_page` — same
18. Real property group — same (but references "Petition to Determine Homestead" instead of "Petition for Homestead")
19. NO trust section *(intestate — no will = no trust beneficiary of will)*
+ Certifications A and B (intestate-specific language)

**Files**: `create_broward_templates.py` (new function), `forms.json` (new entry), `app.js` (wizard matrix)

---

## Phase 5: Create BW-0060 (Affidavit of Heirs)

**Source**: `reference/Broward-Affidavit-of-Heirs.pdf` (4 pages)

### Template structure from the actual PDF:
- Case caption: `{decedent_name}`, `{file_no}`, `{judge}`
- **Item 1** — Affiant info:
  - `{affiant_name}` (shared with BW-0010)
  - `{aoh_has_interest_check}` / `{aoh_no_interest_check}`
  - `{aoh_is_related_check}` / `{aoh_not_related_check}`
  - `{aoh_relationship}` — relationship description
  - `{aoh_years_known}` — years known
- **Item 2a** — `{aoh_spouse_info}` (textarea)
- **Item 2b** — `{aoh_former_spouses}` (textarea)
- **Item 3a** — `{aoh_children}` (textarea)
- **Item 3b** — `{aoh_non_biological_children}` (textarea)
- **Item 4** — `{aoh_grandchildren}` (textarea)
- **Item 5** — `{aoh_parents}` (textarea)
- **Item 6** — `{aoh_siblings}` (textarea)
- **Item 7** — `{aoh_nephews_nieces}` (textarea)
- **Item 8** — `{aoh_grandparents}` (textarea)
- **Item 9** — `{aoh_other_relatives}` (textarea)
- Perjury statement (static)
- Signature block + notary block (same pattern as BW-0010)

**Files**: `create_broward_templates.py` (new function), `forms.json` (new entry), `app.js` (wizard matrix)

---

## Phase 6: Update Wizard Matrix

Update `wizardFormMatrix` in `app.js` (lines 593-648):

| Key | Current broward | New broward |
|-----|----------------|-------------|
| formal\|testate\|domiciliary\|single | BW-0010, BW-0020 | *no change* |
| formal\|testate\|domiciliary\|multiple | BW-0010, BW-0020 | *no change* |
| formal\|intestate\|domiciliary\|single | BW-0010 | BW-0010, BW-0030, BW-0060 |
| formal\|intestate\|domiciliary\|multiple | BW-0010 | BW-0010, BW-0030, BW-0060 |
| summary\|testate\|domiciliary\|single | BW-0010 | BW-0010, BW-0040 |
| summary\|testate\|domiciliary\|multiple | BW-0010 | BW-0010, BW-0040 |
| summary\|intestate\|domiciliary\|single | BW-0010 | BW-0010, BW-0050, BW-0060 |
| summary\|intestate\|domiciliary\|multiple | BW-0010 | BW-0010, BW-0050, BW-0060 |
| summary\|testate\|ancillary\|* | BW-0010 | BW-0010 *(ancillary has own checklist — defer)* |
| summary\|intestate\|ancillary\|* | BW-0010 | BW-0010 *(ancillary has own checklist — defer)* |

**Ancillary checklists**: David provided the URLs. These are separate forms. Defer to a follow-up — the ancillary domiciliary cases are the high-priority path.

---

## Phase 7: Multiple Petitioners Model

### 7A. Data model
Add `petitioners` repeating group to multi-petitioner forms in `forms.json`.

For P2-0205, P2-0215, P2-0220, P2-0225 — replace the flat `petitioner_names` text field with:
```json
{
  "name": "petitioners",
  "label": "Petitioners",
  "type": "repeating_group",
  "subfields": [
    { "name": "pet_name", "label": "Name", "type": "text" },
    { "name": "pet_address", "label": "Address", "type": "text" },
    { "name": "pet_relationship", "label": "Relationship to decedent", "type": "text" }
  ]
}
```

### 7B. Auto-population (`app.js` → `getAutoPopulateDefaults()`)
Seed `petitioners` array with client as first entry when empty:
```javascript
if (!defaults.petitioners || defaults.petitioners.length === 0) {
    defaults.petitioners = [{
        pet_name: fullName,
        pet_address: currentClient.address || '',
        pet_relationship: ''
    }];
}
```

### 7C. Template data derivation (`app.js` → `prepareTemplateData()`)
Add backward-compatible `petitioner_names` derivation from petitioners array:
```javascript
if (data.petitioners && Array.isArray(data.petitioners)) {
    data.petitioner_names = data.petitioners.map(p => p.pet_name).filter(Boolean).join(' and ');
}
```

### 7D. Update 4 .docx templates
Create `update_multi_petitioner_templates.py` to replace `{petitioner_names}` with `{#petitioners}{pet_name}, {pet_address}{/petitioners}` in P2-0205, P2-0215, P2-0220, P2-0225.

**Files**: `forms.json`, `app.js`, new Python script, 4 template files

---

## Phase 8: Verification

1. Run `create_broward_templates.py` — confirm 6 .docx files generated (BW-0010 through BW-0060)
2. Start dev server (`python3 -m http.server 8765`)
3. Test each wizard path with Broward selected:
   - Formal testate → BW-0010 + BW-0020
   - Formal intestate → BW-0010 + BW-0030 + BW-0060
   - Summary testate → BW-0010 + BW-0040
   - Summary intestate → BW-0010 + BW-0050 + BW-0060
4. Fill out a summary intestate Broward matter, generate all forms as .zip, spot-check tags
5. Test multi-petitioner: summary testate + multiple → add 2 petitioners, generate, verify loop expands
6. Verify cross-form data sharing (affiant_name, notary fields shared between BW-0010 and BW-0060)

---

## In-Progress Matters (David's second request)

David has existing probate matters that are mid-stream — already past the opening petition stage. He needs to add these to the system without going through the wizard opening flow.

**Current state**: The app has client/matter creation UI (add client button, add matter to client). But there's no "import existing matter" flow that lets him quickly enter: client, matter type, case number, county, and jump to whichever lifecycle stage the matter is at.

**Approach** (to discuss after Phases 1-7):
- Add a "Quick Add Matter" flow that lets David enter client info + matter metadata (type, county, case number, division, subject name) without running the wizard
- The matter appears in the sidebar like any wizard-created matter
- David can then select whichever forms he needs next (inventory, creditor notice, discharge) from the manual form picker or future lifecycle bundles
- This is essentially the current "add matter" flow but with prominent placement and a streamlined UX for batch onboarding

---

## Files Modified (summary)

| File | What changes |
|------|-------------|
| `create_broward_templates.py` | Update BW-0020 function; add 4 new functions (BW-0030, BW-0040, BW-0050, BW-0060); update `__main__` |
| `forms.json` | Add `cl_will_conformity` to BW-0020; add 4 new form defs; update petitioners section in P2-0205/0215/0220/0225 |
| `app.js` | Update `wizardFormMatrix` (8 entries); update `getAutoPopulateDefaults()` for petitioners; update `prepareTemplateData()` for petitioner_names derivation |
| `templates/` | Regenerate BW-0020; generate BW-0030, BW-0040, BW-0050, BW-0060; update P2-0205/0215/0220/0225 with loop tags |
| new: `update_multi_petitioner_templates.py` | Script to update petitioner loop tags in 4 templates |
| `CLAUDE.md` | Update form count (37→41+), file structure, note multi-petitioner model |
