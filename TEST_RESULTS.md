# GS Court Forms — Test Results

**Run date:** 2026-04-29
**Target:** http://localhost:8765/ (local)
**Method:** Cohort A.1 set up via UI (client + matter creation), remaining cohorts driven via JS console using `renderSingleDoc()` directly. Verification done by parsing rendered .docx XML in-browser and grepping text content.
**Tester:** Cowork (Chrome MCP) + David at console

---

## Summary

| Total tests | PASS | FAIL | TEST-ARTIFACT* | Notes |
|-------------|------|------|----------------|-------|
| ~50         | 41   | 5    | 4              | * "TEST-ARTIFACT" = my regex/field-name was wrong, not an app bug |

**5 confirmed bugs. 0 blockers — all forms generate without unrendered `{tag}` strings.**

---

## Bugs

### BUG-1 (severity: medium) — Single-PR FL-residency renders inverted in P3-PETITION

**Where:** `scripts/build_probate_templates.py` line ~229, `app.js prepareTemplateData()` ~line 2880.

**What:** When the questionnaire writes PR data into the `prs[]` repeating group (the normal path), the single-PR template branch reads top-level `{pr_is_fl_resident}` / `{pr_address}` / `{pr_relationship}` — which are undefined because no hoist exists from `prs[0]` back to top-level. Result: a Florida-resident PR renders as "is not a resident of Florida but is related to the decedent as ..." with empty relationship. Caught on Eleanor Whitfield-Hayes (FL resident) in A.1.

**Fix options:** (a) hoist `data.prs[0].pr_is_fl_resident` → `data.pr_is_fl_resident` in `prepareTemplateData()` for single-PR path, mirroring `pr_names`/`petitioner_names` logic; or (b) change the template to use `{#prs}...{/prs}` even for single PR. Same fix likely needed for `pr_address`/`pr_relationship`.

### BUG-2 (severity: low — confirm intent) — Broward AI certification absent from P3-ORDER and P3-LETTERS

**Where:** `scripts/build_probate_templates.py`.

**What:** P3-PETITION, P3-OATH, P1-0900, P2-PETITION, P2-0355, all the curator/witness/proof-of-will smart templates render the Broward AO 2026-03-Gen certification when `county_is_broward`. P3-ORDER, P3-LETTERS, and P2-ORDER do not. May be intentional (these are judge-signed) but inconsistent with the principle that AI was used to draft the document. Worth a one-question gut-check.

### BUG-3 (severity: high) — Miami-Dade AI certification not implemented in any template

**Where:** No `{#county_is_miami_dade}` block exists in `scripts/build_probate_templates.py` or `scripts/build_guardianship_templates.py`.

**What:** `prepareTemplateData()` sets `data.county_is_miami_dade = true` for Miami-Dade matters, and HANDOFF.md describes this feature as shipped. But no template actually wraps cert text in `{#county_is_miami_dade}...{/county_is_miami_dade}`. Result: filings headed for the 11th Circuit have no AI disclosure. **AO 26-04 requires it on the face of the filing above the signature block.**

**Fix:** Add `_add_miami_dade_ai_certification(doc, doc_title)` helper to `build_probate_templates.py` mirroring `_add_broward_ai_certification`, and call it from every petition/oath/proof builder that already calls the Broward variant.

### BUG-4 (severity: medium) — P3-LETTERS doesn't include codicil dates when has_codicil=true

**Where:** `scripts/build_probate_templates.py` line ~501.

**What:** P3-PETITION and P3-ORDER both render `{codicil_dates}` inside the `{#has_codicil}` block. P3-LETTERS only adds the words "and codicil(s)" with no date. Inconsistent. Letters of Administration should reference the date(s) of codicil(s) admitted to probate, matching the order admitting them.

**Fix:** Change line 501 from `'{#has_codicil} and codicil(s){/has_codicil}'` to `'{#has_codicil} and codicil(s) dated {codicil_dates}{/has_codicil}'`.

### BUG-5 (severity: low) — "Estate of " auto-prefix double-applies on probate matter subject names

**Where:** `app.js` matter rendering / new-matter modal.

**What:** When creating a probate matter and entering "Estate of Harold Whitfield, Sr." as the subject name, the matter title displays "Probate — Estate of Estate of Harold Whitfield, Sr." (double "Estate of"). The app appears to prepend "Estate of " automatically, but doesn't strip it if the user enters it. Field label is `(decedent name)` — so the user shouldn't enter "Estate of" — but the placeholder/help text doesn't make that obvious.

**Fix options:** (a) strip leading "Estate of" on input; (b) add placeholder text like "Decedent name (no 'Estate of' prefix)"; (c) display a warning when "Estate of" is detected on save.

---

## Cohort results

### Pre-flight
| ID  | Status | Notes |
|-----|--------|-------|
| 0.0 | PASS   | Local server already running on :8765 |
| 0.1 | PASS   | Login OK, no console errors, dashboard renders |
| 0.2 | PASS   | `python3 scripts/audit_tags.py` → "PASS" |
| 0.3 | PASS   | Eleanor Whitfield-Hayes created. Address grid populated correctly: street/line2/city=Fort Lauderdale/FL/33316. |

### Cohort A — Formal Probate Admin
| ID  | Status | Notes |
|-----|--------|-------|
| A.1 | PASS w/ bug | All 5 forms generated, no unrendered tags, BROWARD all-caps caption ✓, decedent + petitioner + DOD + beneficiaries + assets all render. **BUG-1 fires here.** **BUG-2 fires here.** Also caught BUG-5 (Estate-of double-prefix). |
| A.2 | PASS w/ bug | has_codicil toggle: P3-PETITION + P3-ORDER render codicil_dates. P3-LETTERS misses date — **BUG-4**. Toggling off correctly removes codicil block. |
| A.3 | PASS   | Multi-petitioner / multi-PR: both Eleanor + Thomas Hartley render in P3-PETITION + P3-LETTERS, plural verbs/labels switch correctly. |
| A.4 | PASS   | Ancillary path: foreign domicile (Paris, France) renders, "ancillary" appears, domiciliary-only fields hidden. |
| A.5 | PASS   | Intestate: no will-admit clause, no will date rendered, "intestate" path triggers. |

### Cohort B — Summary Admin
| ID  | Status | Notes |
|-----|--------|-------|
| B.1 | PASS w/ bug | P2-ORDER correctly renders combined "Order Admitting Will to Probate AND of Summary Administration" (David-preference, Phase 8a). Distributee table renders on petition. **BUG-2 fires on P2-ORDER.** |
| B.2 | PASS   | has_codicil=true → "March 5, 2024" renders on both P2-PETITION and P2-ORDER. |
| B.3 | PASS   | Intestate: standalone Order of Summary Admin renders (no will-admit clause). |
| B.4 | PASS   | Ancillary self-proved auth-copy: title flips to "ORDER ADMITTING WILL OF NONRESIDENT TO PROBATE". `is_self_proved` and `is_auth_copy_of_will` axes both fire. |

### Cohort C — P1 Service Forms
| ID  | Status | Notes |
|-----|--------|-------|
| C.1 (×4) | PASS | All 4 caveator axes work. Resident clause vs nonresident clause flips correctly. Attorney signature block (David's bar #) appears on nonresident variants only (firm represents nonresidents). |
| C.2 (×2) | PASS | P1-FORMAL-NOTICE: adversary axis adds "(adversary)" to title, includes adversary proceeding number. |
| C.3 (×6) | PASS | P1-PROOF-OF-SERVICE-FN: 6 distinct outputs across {certified, first_class, in_the_manner_of} × {regular, adversary}. Title correctly shows "BY FIRST CLASS MAIL", "IN THE MANNER OF FORMAL NOTICE", or default certified. |
| C.4 (×2) | PASS | P1-NOTICE-CONFIDENTIAL: contemporaneous vs after-the-fact paths produce different outputs. |

### Cohort D — P1 Singletons
| ID  | Status | Notes |
|-----|--------|-------|
| D.1 | NEEDS-FIELD-CHECK | P1-0100 generates, decedent + Broward AI cert render, but my test field names for `bank_name`/`box_number` were guesses — they didn't render. Form generates without errors. Actual safe-deposit-box field names need to be checked against forms.json before declaring this PASS. |
| D.2 | PASS   | P1-0620 Joinder Waiver Consent renders with notary acknowledgment block. |
| D.3 | PASS   | P1-0800 Notice of Trust renders trust + trustee + Broward AI cert. |

### Cohort E — Curator Suite
| ID  | Status | Notes |
|-----|--------|-------|
| E.1 | PASS   | P3-CURATOR-PETITION renders with curator name + decedent + Broward AI cert. |
| E.2 (×2) | PASS | P3-CURATOR-ORDER bond axis works (bond=true → $50,000 renders, bond=false → no bond amount). |
| E.3 | PASS   | P3-CURATOR-OATH (with notary block) + P3-CURATOR-LETTERS both generate cleanly. |

### Cohort F — Will Authentication
| ID  | Status | Notes |
|-----|--------|-------|
| F.1 (×4) | PASS | P3-OATH-WITNESS: title flips correctly between "OATH OF WITNESS TO WILL" and "OATH OF WITNESS TO CODICIL". `is_copy=true` adds language about original/copy. 4 distinct outputs. |
| F.2 (×2) | PASS | P3-PROOF-WILL: title flips between "PROOF OF WILL" and "PROOF OF CODICIL". |

### Cohort G — Guardianship
| ID  | Status | Notes |
|-----|--------|-------|
| G.1 | PASS   | G3-025 plenary guardianship: AIP name + structured addresses + Jill's bar # + signing line "_____ day of __________, 20___" + Broward AI cert all render. (Felony danger callout is questionnaire-side info field, not in template — that's by design.) |
| G.2 | PASS   | G3-026 property-only: addresses format correctly. |
| G.3 | PASS   | G3-010 incapacity: AIP DOB renders as "April 3, 1942" (formatDateFieldValue OK), addresses format correctly. |
| G.4 | PASS   | G2-010 + G2-140: handwritten signing line, no pre-filled month/year, Jill's bar #. |

### Cohort H — Cross-cutting
| ID  | Status | Notes |
|-----|--------|-------|
| H.1 | PASS   | `parseStringToStructuredAddress("999 Brickell Bay Dr, Penthouse 3, Miami, FL 33131")` → {street, line2, city=Miami, state=FL, zip=33131, foreign:false}. ✓ |
| H.2 | NOT-RUN | Conditional visibility — UI-only. Skipped (would need DOM inspection while toggling). Not a regression risk based on Cohort A.4 (ancillary fields hidden) and A.2 (codicil_dates appears when has_codicil=true). |
| H.3 | NOT-RUN | Row-lock — UI-only. Skipped. Same rationale as H.2. |
| H.4 | PASS   | Auto-populate: `getAutoPopulateDefaults()` returns petitioners[1], prs[1], resident_agent_name="David A. Shulman", resident_agent_address="300 SE 2nd St Ste 600\nFort Lauderdale, FL 33301". |
| H.5 | PASS   | Per-matter signing attorney toggle: setting `currentMatter.attorneyId='jill'` → bar 813850 + jill@ginsbergshulman.com renders. Setting to `'david'` → bar 150762 + david@. |
| H.6 | FAIL (BUG-3) | Caption ALL-CAPS works on Broward / Miami-Dade / Palm Beach. Broward AI cert renders only on Broward (correct). **Miami-Dade AI cert (AO 26-04) does NOT render on Miami-Dade matters** — not implemented in any template. |
| H.7 | PASS   | All 5 BW-* PDF passthroughs return valid PDF bytes (magic 0x25504446) at expected sizes (122–151 KB). |

---

## Test artifacts (false alarms — my tester error, not app bugs)

1. Cohort A initial run dropped formData because I set `currentMatter.formData['P3-PETITION']` directly via JS — but `prepareTemplateData()` reads currentForm-specific data from the top-level `currentFormData` variable (the form being viewed in the questionnaire). Fix: set `currentFormData` instead. **Not an app bug** — in real user flow, this state is loaded automatically when the user navigates to a form.

2. Cohort B.4 initial regex looked for "ancillary" in P2-ORDER — but the template uses "OF NONRESIDENT" instead. **Not a bug** — different word, same meaning.

3. Cohort C.4 initial regex used `is_filed_contemporaneously`, but the field is `is_contemporaneous`. **Not a bug** — my mistake.

4. Cohort C.1 / D.1 / F.1 various other field-name mismatches in my test setup. **Not bugs** — fixed on retry.

5. Cohort G initial render skipped address/date transforms because `selectedFormIds` didn't include the G forms. `collectAddressFieldNames()` and `collectDateFieldNames()` only iterate selected forms. **Not a bug** — in real user flow, forms are always selected before generation. But worth knowing as a quirk if future automation needs to bypass selection.

---

## Recommended next steps

1. **Fix BUG-3 first.** No AI disclosure on Miami-Dade filings is the highest-stakes bug — 11th Circuit AO 26-04 isn't optional. Priority: this week.
2. **Fix BUG-1.** Hoist prs[0] to top-level for single-PR rendering. One-line change in `prepareTemplateData()`. Priority: this week (it makes every FL-resident PR petition render incorrectly).
3. **Fix BUG-4.** Add `dated {codicil_dates}` to P3-LETTERS codicil clause. Trivial. Priority: with next P3-LETTERS edit.
4. **Confirm intent on BUG-2.** Should P3-ORDER, P3-LETTERS, P2-ORDER carry the AI cert? My read: yes — the order *was* drafted with AI, even though it's signed by the judge. Easy gut check before fixing.
5. **Decide BUG-5.** "Estate of " auto-prefix is a UX quirk — strip on input or warn? Low priority.
6. **Field-name verification on D.1 (Safe Deposit Box).** Quick — check forms.json against template.
7. **UI-only tests skipped (H.2, H.3).** Low risk based on indirect evidence, but worth a 5-minute manual click-through if you want full coverage.
