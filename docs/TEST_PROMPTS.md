# Cowork Test Prompts — GS Court Forms

Paste any single block into a fresh Cowork session. Each prompt is self-contained — Cowork has zero prior context. All testing targets the live URL.

**Driver assumption:** Cowork uses the Chrome extension (`mcp__Claude_in_Chrome__*`) to drive the browser. If the extension isn't connected, Cowork should ask David to install it before falling back to computer-use.

**Live URL:** https://davidshulman22.github.io/guardianship-forms/
**Sign-in:** Microsoft OAuth (David's account, already authorized as admin).
**Test client:** Use the seeded Margaret "Maggie" Torres client. To force a refresh, open DevTools console and bump `seedVersion` per CLAUDE.md, or create a fresh test client per prompt.

**Verification pattern:** Download every generated .docx, open it via the `anthropic-skills:docx` skill, and grep for the strings the prompt names. PDF passthrough downloads should be opened via `anthropic-skills:pdf`. Take a screenshot of the questionnaire before generating, and another of the rendered .docx text. Report PASS/FAIL with the screenshots and grep results.

**Report format every prompt expects back:**

```
PROMPT: <number + name>
RESULT: PASS | FAIL | PARTIAL
PERMUTATIONS TESTED: <list>
PERMUTATIONS PASSED: <list>
PERMUTATIONS FAILED: <list with one-line cause>
EVIDENCE: <screenshots + .docx excerpts>
DEFECTS: <numbered list, each with: form ID, permutation, expected vs. actual, severity (blocker/major/minor)>
```

---

## Prompt 1 — Wizard matrix coverage

```
You are testing the Open Estate Wizard at https://davidshulman22.github.io/guardianship-forms/.
The wizard asks 4 questions and selects a form set + matter flags. There are 16 possible
combinations. You will drive every one and verify the right form set + matter flags.

The wizard questions:
1. Administration: Formal | Summary
2. Will: Testate | Intestate
3. Jurisdiction: Domiciliary | Ancillary
4. County: Broward | Palm Beach | Miami-Dade | Other

That is 2 × 2 × 2 × 4 = 32 paths. Test all 32.

For each path:
1. Sign in. Click "New Matter" → Open Estate Wizard. Use the Margaret Torres client.
2. Step through the 4 wizard questions with the target combo.
3. Before clicking "Generate," take a screenshot of the form-selection screen showing
   which forms were selected.
4. Open DevTools console and dump matter.matterData. Capture the JSON.
5. Cancel out (don't actually generate).
6. Repeat for next combo.

Verifications per combo:
- The set of selected form IDs matches what's in app.js wizardFormMatrix for that key.
- BW-0010..BW-0050 ONLY appear when County = Broward.
- matter.matterData has correct flags: is_testate, is_ancillary, multiple_petitioners
  (false by default — the wizard does not directly set this; it stays false unless
  user explicitly toggles), multiple_prs (same).
- For Summary admin: form set should be exactly P2-PETITION + P2-ORDER + P2-0355
  (no other P2-*, no P3-*, plus P1-0900).
- For Formal admin: form set should include P3-PETITION + P3-OATH + P3-ORDER + P3-LETTERS
  + P1-0900 (plus BW-0010..0050 if Broward).
- Testate vs intestate: confirm matter.matterData.is_testate is set correctly.
- Ancillary: confirm matter.matterData.is_ancillary is set correctly. Domiciliary
  fields on petitions should be hidden when is_ancillary === true.

Report PASS/FAIL per combo. If any combo selects the wrong form set or fails to set
a matter flag, that's a BLOCKER defect — capture the wizardFormMatrix entry that's
wrong and the resulting form list.
```

---

## Prompt 2 — Formal admin happy path (end-to-end)

```
You are end-to-end testing the formal-administration probate flow at
https://davidshulman22.github.io/guardianship-forms/.

Setup:
1. Sign in.
2. Use the seeded Margaret Torres client → "Probate formal admin — Estate of Helen
   Marie Torres" matter (already pre-seeded with full P3-0100 data).
3. Configure: Broward County, testate, single PR, domiciliary, has_codicil = false.

Forms to generate as a zip bundle:
- P3-PETITION
- P3-OATH
- P3-ORDER
- P3-LETTERS
- P1-0900

Steps:
1. Open the matter, click "Generate forms" or equivalent.
2. Walk the merged questionnaire end-to-end. For every field that's blank,
   pick a sensible test value. For every conditional field that should appear
   based on your earlier answers, verify it appears.
3. Take a screenshot of every section of the questionnaire.
4. Generate. The output should be a .zip with 5 .docx files.
5. Download the zip, extract, and open each .docx via the docx skill.

Verifications on the rendered .docx files (every one):
- Caption block: bold; first line "IN THE CIRCUIT COURT OF THE 17TH JUDICIAL CIRCUIT
  IN AND FOR BROWARD COUNTY, FLORIDA" with BROWARD in ALL CAPS; "PROBATE DIVISION"
  bold; "IN RE: ESTATE OF HELEN MARIE TORRES, Deceased." present; "File No." line
  present; "Division" line present.
- Real Word numbering on numbered paragraphs (1., 2., 3., not text "1." prefixes).
  Open the .docx and confirm via the docx skill that paragraphs have numPr properties,
  not literal numbers in the text.
- 1.5 line spacing.
- No empty spacer paragraphs between numbered items.
- Broward AI certification language appears above the signature block on EVERY .docx
  that has a signature block. Verify exact text matches AO 2026-03-Gen.
- Signature block has petitioner Margaret Torres + attorney David A. Shulman with
  Bar 150762, david@ginsbergshulman.com, 954-990-0896, firm address.
- Resident agent auto-populated to David A. Shulman with the firm address.
- Petitioner row auto-populated with Margaret Torres + her address.
- 3 beneficiaries from the seed render in P3-PETITION's beneficiaries table.

Report PASS/FAIL per .docx, with the docx skill's text excerpt as evidence.
```

---

## Prompt 3 — Formal admin permutations

```
You are testing every permutation of the formal-administration smart templates at
https://davidshulman22.github.io/guardianship-forms/.

Smart templates being permuted: P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS.

Axes (test all combinations = 32 runs):
- is_testate: true | false
- multiple_petitioners: true | false
- multiple_prs: true | false
- is_ancillary: true | false
- has_codicil: true | false (only meaningful when is_testate = true; skip when intestate)
- is_self_proved: true | false (only meaningful when is_testate = true)
- county: Broward | Miami-Dade | Other (rotate across runs to also exercise the
  AI-certification axis)

For each permutation:
1. Create a fresh matter via the wizard with the target axis values.
2. If has_codicil = true, fill in codicil_dates with one or two test dates.
3. Generate all 4 P3 templates as a zip.
4. Open each .docx via the docx skill.

Verifications per .docx:
- Testate path: P3-PETITION includes will-related language ("Last Will and Testament
  dated ___"). P3-ORDER says "the decedent's last will dated X is admitted to
  probate." If has_codicil = true, P3-ORDER also says "and codicil(s) dated Y."
  P3-LETTERS title says "Letters of Administration."
- Intestate path: NO will references anywhere. P3-ORDER does NOT have any
  "admitted to probate" language for a will. P3-LETTERS may say
  "Letters of Administration" still (no codicil/will language).
- Multiple petitioners: P3-PETITION's signature block has rows for each petitioner.
  Petitioners table renders all rows.
- Multiple PRs: P3-OATH has multiple oath signatures. P3-LETTERS lists multiple PRs.
- Ancillary: P3-PETITION omits the domiciliary block (death/residence in Florida).
  Adds ancillary-specific allegations (where original probate is pending).
- Self-proved: P3-PETITION does NOT request witness testimony or include witness
  attestation language. (Verify against FLSSI 2.0103 if uncertain.)
- has_codicil = true: P3-PETITION mentions codicil(s) dated X. P3-ORDER admits
  the codicil. P3-LETTERS still names the PR correctly. has_codicil = false:
  no codicil text appears anywhere.
- AI certification: Broward = AO 2026-03-Gen language. Miami-Dade = AO 26-04
  language above the signature block. Other county = no AI certification text.

Build a results matrix: rows = permutations, columns = the 4 P3 templates,
cells = PASS or FAIL with one-line cause. Defect severity: any wrong
testate/intestate behavior or wrong codicil rendering is a BLOCKER.
```

---

## Prompt 4 — Summary admin matrix

```
You are testing the summary-administration smart templates at
https://davidshulman22.github.io/guardianship-forms/.

Smart templates being permuted: P2-PETITION, P2-ORDER, P2-0355.

Axes (test all combinations):
- is_testate: true | false
- multiple_petitioners: true | false
- is_ancillary: true | false
- has_codicil: true | false (only when is_testate; skip when intestate)
- is_self_proved: true | false (only when is_testate)
- is_auth_copy_of_will: true | false (only when is_testate AND is_ancillary;
  skip otherwise)
- county: Broward | Other

Background context (from CLAUDE.md / HANDOFF.md):
- P2-ORDER's testate path = COMBINED Order Admitting Will to Probate AND Order
  of Summary Administration (P2-0500-style).
- P2-ORDER's intestate path = standalone Order of Summary Admin only.
- P2-PETITION consolidates 8 FLSSI petition variants.

For each permutation:
1. Create a fresh matter via the wizard: Administration = Summary, set the
   axis values you're testing.
2. Walk the merged questionnaire. Use cross-form data sharing — answers entered
   on P2-PETITION should auto-flow into P2-ORDER and P2-0355.
3. Pay attention to the summary_admin_distributees repeating group on P2-PETITION
   — verify it surfaces the same data on P2-0355 (Notice to Creditors) via the
   distribution_table.
4. Generate all 3 templates as a zip.
5. Open each .docx via the docx skill.

Verifications per .docx:
- P2-PETITION: caption correct, allegations match testate/intestate axis,
  ancillary block (or its absence) correct, codicil text only when has_codicil.
  Distributees table renders all rows.
- P2-ORDER (testate): single document with both "Order Admitting Will" AND
  "Order of Summary Administration" sections. Codicil admitted if has_codicil.
  If is_auth_copy_of_will, language reflects authenticated copy admission.
- P2-ORDER (intestate): standalone Order of Summary Admin, no will references,
  no codicil references.
- P2-0355: same distributees as P2-PETITION (cross-form share works).
  Notice to creditors language correct.
- AI certification: Broward = AO 2026-03-Gen on EVERY template. Other = no AI cert.

Build a results matrix. Any wrong testate/intestate behavior on P2-ORDER is a
BLOCKER. Cross-form data sync failure (distributees not flowing from
P2-PETITION → P2-0355) is a BLOCKER.
```

---

## Prompt 5 — Service forms matrix

```
You are testing the P1 service-form smart templates at
https://davidshulman22.github.io/guardianship-forms/.

Templates being permuted (test independently — separate matters):

A) P1-CAVEAT — axes: caveator_type (creditor | IP) × caveator_is_nonresident
   (true | false) = 4 permutations.
B) P1-FORMAL-NOTICE — axes: is_adversary (true | false) = 2 permutations.
C) P1-PROOF-OF-SERVICE-FN — axes: service_type (mail | personal | publication or
   whatever the 3 types are; check forms.json) × is_adversary = 6 permutations.
D) P1-NOTICE-CONFIDENTIAL — axes: is_contemporaneous (true | false) = 2 permutations.

Total: 14 permutations.

For each permutation:
1. Create a probate matter (formal admin works fine for service-form testing).
2. Add the target form via the manual form selection or bundle.
3. Fill out the questionnaire with sensible test values. For axes, use the actual
   conditional fields (e.g., for P1-CAVEAT pick the caveator_type dropdown and
   toggle caveator_is_nonresident).
4. Verify the questionnaire shows the correct conditional fields for the axis.
   E.g., for caveator_type = creditor, creditor-specific fields appear. For
   caveator_is_nonresident = true, the designated agent block appears.
5. Generate the .docx. Open via docx skill.

Verifications per .docx:
- P1-CAVEAT: title and body match the FLSSI source for the matching variant
  (P1-0301 for creditor resident, P1-0305 creditor nonresident, P1-0311 IP
  resident, P1-0315 IP nonresident — verify against reference/FLSSI-2025).
- P1-FORMAL-NOTICE: regular vs. adversary version differs in exactly the
  language called for by FLSSI P1-0500 vs. P1-0501.
- P1-PROOF-OF-SERVICE-FN: title and body switch on service_type and adversary
  flag. Compare against FLSSI P1-0507/0510/0511/0512/0513.
- P1-NOTICE-CONFIDENTIAL: contemporaneous version (filed with the document)
  vs. after-the-fact version differ in the right language. Compare against
  FLSSI P1-0640 vs. P1-0641.
- Caveator name + addresses auto-populate from currentClient on first render
  (for P1-CAVEAT).
- All Broward AI cert lines render when matter county = Broward.

Report a 14-row results table. Any wrong-variant rendering is a BLOCKER.
```

---

## Prompt 6 — Curator + witness/proof-of-will

```
You are testing two clusters of probate templates at
https://davidshulman22.github.io/guardianship-forms/.

Cluster A — Curator suite:
- P3-CURATOR-PETITION (single template)
- P3-CURATOR-ORDER (smart, axis: bond_required true | false)
- P3-CURATOR-OATH (with notary)
- P3-CURATOR-LETTERS

Cluster B — Witness/proof-of-will:
- P3-OATH-WITNESS (smart, axes: document_type will | codicil × document_status
  original | copy = 4 permutations)
- P3-PROOF-WILL (smart, axis: document_type will | codicil = 2 permutations)

Total: 4 (curator: 2 perms on order × 1 on each of the others) + 6 = 10 runs.

For each run:
1. Create or reuse a probate formal-admin matter.
2. Add the target form, fill the questionnaire.
3. For P3-CURATOR-ORDER: toggle bond_required. Verify the conditional appears.
4. For P3-OATH-WITNESS: pick the document_type and document_status. Verify
   the form references the correct document.
5. For P3-PROOF-WILL: pick the document_type. Verify the proof references
   the correct document.
6. Generate, open via docx skill.

Verifications:
- P3-CURATOR-OATH: notary block present (signature line for notary, "before me
  this ___ day of ___, 20___" language).
- P3-CURATOR-ORDER bond_required = true: bond amount + sureties language present.
  bond_required = false: order says "no bond required" or omits bond block entirely.
- P3-OATH-WITNESS: title and body match the 4 FLSSI variants exactly
  (P3-0300 will original, P3-0301 will copy, P3-0310 codicil original,
  P3-0311 codicil copy).
- P3-PROOF-WILL: matches FLSSI P3-0320 (will) or P3-0330 (codicil).
- All four curator templates have bold caption + ALL CAPS county.
- All Broward matters have AI certification.

Report results per run. Notary block missing on P3-CURATOR-OATH = BLOCKER.
```

---

## Prompt 7 — Standalone P1 forms

```
You are testing five standalone P1 forms at
https://davidshulman22.github.io/guardianship-forms/.

Forms (one run each):
- P1-0100 (Petition to Open Safe Deposit Box)
- P1-0400 (Request for Notice and Copies)
- P1-0530 (Notice of Hearing)
- P1-0620 (Joinder Waiver Consent — has notary block)
- P1-0800 (Notice of Trust)

For each:
1. Create or reuse a probate matter (use Broward County so AI cert renders).
2. Add the form via manual selection.
3. Fill the questionnaire. For P1-0100, expect safe-deposit-box-specific fields.
   For P1-0620, expect joinder/waiver/consent fields and a notary block on the
   .docx output.
4. Generate, open via docx skill.

Verifications per .docx:
- Caption: bold + ALL CAPS county.
- Body content matches the FLSSI source in reference/FLSSI-2025/.
- P1-0620 has a notary block.
- P1-0530 includes hearing date / time / location fields.
- P1-0800 is correctly titled "Notice of Trust" and references the trust by name.
- Broward AI cert above signature block.
- Cross-form data: matter-level data (county, decedent name) flows in.

Report 5-row results table.
```

---

## Prompt 8 — PDF passthrough

```
You are testing PDF passthrough delivery at
https://davidshulman22.github.io/guardianship-forms/.

Forms (5 total):
- BW-0010 (Affidavit of Criminal History)
- BW-0020 (Mandatory Checklist — Formal Admin Testate)
- BW-0030 (Mandatory Checklist — Formal Admin Intestate)
- BW-0040 (Mandatory Checklist — Summary Admin Testate)
- BW-0050 (Mandatory Checklist — Summary Admin Intestate)

Setup: Use any Broward probate matter.

For each form:
1. Add the form via manual selection. Verify the questionnaire screen shows
   "no questions" or a passthrough notice (sections: [] in forms.json).
2. Click Generate.

Verifications:
- Downloaded file has .pdf extension (NOT .docx).
- File downloads byte-for-byte identical to the source at reference/
  Broward-Checklist-*.pdf or reference/BW-Affidavit-Criminal-History.pdf
  (exact path varies — check forms.json template field). Verify by computing
  SHA-256 of the downloaded file and comparing to the source. If you can't
  compute SHA-256 in-browser, open both PDFs side by side and confirm visual
  parity (page count, first-page header, last-page footer).
- Filename pattern: <Last>, <First> - <Form ID> - <Form Name> - DRAFT.pdf or
  similar — check makeDocFileName() in app.js for the exact pattern.
- Generating multiple passthroughs alongside .docx forms produces a mixed-content
  .zip with both file types correctly.

Report a 5-row results table. Any byte mismatch = BLOCKER (this defeats the
purpose of passthrough).
```

---

## Prompt 9 — Guardianship sweep

```
You are testing all 5 guardianship templates at
https://davidshulman22.github.io/guardianship-forms/.

This is a Phase 7a/7b verification — these forms shipped without a Jill/Maribel
test pass.

Templates:
- G2-010 (Designation of Resident Agent)
- G2-140 (some certificate of service form — check forms.json)
- G3-010 (Petition for Appointment of Plenary Guardian)
- G3-025 (Petition for Appointment of Emergency Temporary Guardian)
- G3-026 (similar — check forms.json)

Setup:
1. Sign in (David's account is fine — admin sees Maribel's matters too in theory).
2. Create a guardianship matter (Maggie Torres has 2 already seeded:
   "Robert James Torres" person & property, "Sophia Grace Reyes" property only).
3. Use the Robert James Torres matter — it has more fields populated.
4. Verify the matter's signing attorney defaults to Jill Ginsberg.

For each template:
1. Add to manual selection.
2. Walk the questionnaire. Capture screenshots.
3. Specifically verify:
   - All 12 *_address fields render as STRUCTURED ADDRESS GRID (street/city/
     state/zip), not free-text. petitioner_address, AIP address, proposed_guardian_
     address, physician_address (and others — count the address fields).
   - next_of_kin.address renders as structured address inside the repeating group.
   - alternatives_description and alternatives_insufficient_reason are HIDDEN
     when has_considered_alternatives = false. They APPEAR when = true.
   - preneed_name appears when has_preneed = true. preneed_no_reason appears
     when has_preneed != true (default — preneed is rare).
   - Felony danger callout (red/danger styling, F.S. §744.309(3) reference)
     appears above "Proposed Guardian" section in G3-010, G3-025, G3-026.
   - aip_dob is a SINGLE date field (not 3 text fields for month/day/year).
     Verify formatDateFieldValue formats it as "Month D, YYYY" in the .docx.
   - proposed_guardian_name and proposed_guardian_address auto-populate from
     currentClient on first render. (User can edit.)
   - signing_month / signing_year fields are GONE. cos_month / cos_year on
     G2-140 are GONE. The .docx renders "Signed on this _____ day of __________,
     20___." for the signer to fill by hand.
4. Generate, open via docx skill.

Verifications on .docx:
- Caption bold + ALL CAPS county.
- "IN RE: GUARDIANSHIP OF" present (not "ESTATE OF").
- Real Word numbering, 1.5 line spacing.
- Signature block lists Jill Ginsberg, Bar 813850, jill@ginsbergshulman.com,
  954-332-2310. (NOT David's bar.)
- Resident agent on G2-010 = Jill (signing attorney).
- aip_dob renders as e.g. "January 15, 1948" not "1/15/1948" or three numbers.
- next_of_kin table renders all rows from the repeating group.
- Felony language renders in G3-010, G3-025, G3-026.

Report per-template results. Failure of structured-address rendering = BLOCKER.
Wrong attorney = BLOCKER.
```

---

## Prompt 10 — Cross-cutting checks

```
You are running cross-cutting regression checks at
https://davidshulman22.github.io/guardianship-forms/.

These checks span every form. Pick ONE representative .docx-generating form
(e.g., P3-PETITION) and run the matrix below. Then spot-check 2 other forms
to confirm consistency.

Checks:

1. AI certification language by county:
   - Broward (matter county = Broward): exact language matches
     "Broward County Administrative Order 2026-03-Gen" / certification is on the
     FACE of the filing. Verify the exact text.
   - Miami-Dade (matter county = Miami-Dade): exact language matches
     "Eleventh Judicial Circuit Administrative Order 26-04" / certification is
     ABOVE the signature block. Verify the exact text.
   - Palm Beach (matter county = Palm Beach): no AI certification expected
     (no current AO). Confirm the .docx has NO AI cert text.
   - Other (matter county = Other or anything else): no AI cert text.

2. Caption fix (bold + ALL CAPS county):
   - First caption line: "IN THE CIRCUIT COURT OF THE Xth JUDICIAL CIRCUIT IN
     AND FOR <COUNTY> COUNTY, FLORIDA" — county must be ALL CAPS.
   - Every caption line must be bold (verify via docx skill paragraph properties).
   - "PROBATE DIVISION" or "GUARDIANSHIP DIVISION" present and bold.
   - "IN RE: ESTATE OF X, Deceased." or "IN RE: GUARDIANSHIP OF X" line present.

3. Address parser round-trip:
   - Create a fresh matter. On a form, find an address field.
   - Enter a free-text address: "123 Main St\nSuite 200\nFort Lauderdale, FL 33301"
   - Reload the form. Verify the structured grid auto-populated: street = 123 Main
     St, line2 = Suite 200, city = Fort Lauderdale, state = FL, zip = 33301.
   - Toggle to free-text mode. Verify the free-text shows the original.
   - Toggle back to structured. Verify grid re-populates correctly.

4. Petitioners + PRs auto-population:
   - Create a fresh probate matter. Open P3-PETITION.
   - On first render, petitioners[] should have one row pre-populated with
     Margaret Torres's name and address.
   - prs[] should have one row pre-populated similarly.
   - With multiple_petitioners flag = false, the petitioners row should be
     row-locked (only 1 row, can't add more).
   - Set multiple_petitioners = true via wizard or matter edit. Reload form.
     Verify can now add more rows.

5. Resident agent auto-population:
   - On any form with resident_agent_name + resident_agent_address fields:
     - resident_agent_name field should be a VALIDATED SELECT dropdown with
       only "David A. Shulman" and "Jill R. Ginsberg" as options.
     - Default value matches matter's signing attorney.
     - resident_agent_address auto-populates with firm address (300 SE 2nd St,
       Suite 600, Fort Lauderdale, FL 33301).

6. Per-matter signing attorney override:
   - Create a probate matter. Edit it. Set signing attorney = Jill.
   - Generate any P3 template.
   - Verify the .docx signature block has JILL's bar number, email, phone —
     NOT David's.

Report each check as PASS/FAIL with screenshot evidence. Any failure here is
likely MAJOR or BLOCKER (these are the foundational behaviors).
```

---

## Prompt 11 — Auth + RLS

```
You are testing authentication and row-level security at
https://davidshulman22.github.io/guardianship-forms/.

Auth: Microsoft OAuth via Supabase Azure provider. Two relevant accounts:
- david@ginsbergshulman.com (admin role, auto-promoted by handle_new_user trigger)
- maribel@ginsbergshulman.com (admin role, also in trigger allow-list)

Cannot easily test a "standard" user without a test account — skip the standard-
user RLS test if no test account is available, and report SKIPPED.

Tests:

1. Sign-out / sign-in flow:
   - Sign out from current session.
   - Click "Sign in with Microsoft."
   - Complete OAuth flow.
   - Verify landed back at the app, signed in.
   - Verify user_profiles row exists (open Supabase dashboard or query via
     console: select * from user_profiles where email = 'david@...').
   - Verify role = 'admin'.

2. Admin visibility:
   - As David, list all clients. Verify Margaret Torres + any others created
     by Maribel are visible.
   - As David, list all matters. Verify all matters across all users visible.

3. RLS isolation (if Maribel test access available):
   - Sign out. Sign in as Maribel.
   - Create a new client "Test Client RLS" with a Maribel-only matter.
   - Sign out, sign back in as David.
   - Verify David sees the new "Test Client RLS" (admin role bypasses RLS).
   - If a third standard-role test account exists, sign in as them and verify
     they do NOT see Maribel's or David's data — only their own.

4. handle_new_user trigger:
   - This was tested at sign-in time (test #1). Confirm by checking that the
     user_profiles row was created and role was assigned automatically — no
     manual SQL needed.

Report each test as PASS/FAIL/SKIPPED with evidence. Any RLS leak (standard
user seeing others' data) = BLOCKER.
```

---

## Prompt 12 — Local regressions

```
You are running local regression checks for the GS Court Forms project.

This prompt is for a Cowork session that has filesystem access (Claude Code-
adjacent or computer-use to a terminal). If running in a chat-only session,
have the user run these commands and paste the output back to you.

Project path:
/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project

Commands:

1. Tag audit:
   cd "<project path>"
   python3 scripts/audit_tags.py

   Expected: PASS. Every {tag} in every templates/*.docx is declared in
   forms.json (or is on the audit allow-list like county_caption, beneficiaries,
   petitioners, prs, etc.). Any missing tag = template will render literally
   (e.g., "{undefined_field}") = BLOCKER.

2. Builder re-runs (verify deterministic output):
   python3 scripts/build_guardianship_templates.py
   python3 scripts/build_probate_templates.py

   Expected: both run cleanly with no errors. Templates regenerated. Run
   `git status` after — verify no .docx files have unexpected diffs.
   (Some diff is OK if templates were last built on a different machine; what
   matters is no errors and no template completely missing.)

3. Re-run tag audit after rebuild:
   python3 scripts/audit_tags.py

   Expected: still PASS.

4. Static file consistency:
   - Confirm forms.json parses as valid JSON: python3 -c "import json;
     json.load(open('forms.json'))"
   - Confirm every form ID in forms.json has a corresponding template at
     templates/<id>.docx OR is delivery: pdf_passthrough with a valid path
     in reference/.

5. Git hygiene:
   git status
   - Expected: clean.
   git log --oneline -5
   - Capture for the report.

Report each command's output. Any failure = BLOCKER for shipping further work.
```

---

## After running all 12

Aggregate results into a single status doc:

```
TEST RUN: <date>
PROMPTS RUN: 1-12
PROMPTS PASSED: <list>
PROMPTS FAILED: <list>
TOTAL DEFECTS: <count>
  BLOCKERS: <count + one-line each>
  MAJOR: <count + one-line each>
  MINOR: <count + one-line each>
NEXT ACTION: <fix blockers, then re-run failed prompts>
```

File this report at `docs/TEST_RESULTS_<date>.md` and commit it.
