# GS Court Forms — Local Test Plan

**Target:** http://localhost:8765/ (local dev server — see Prompt 0.0 to start it)
**Scope:** Phase 7a/7b (guardianship parity) + Phase 8a–8e (probate consolidations). Per HANDOFF.md §8.
**Tester:** Cowork (Chrome MCP). Hand-fed prompts below, one cohort at a time.
**Log results at:** `TEST_RESULTS.md` in this folder. Each test row: ID, status (PASS/FAIL/BLOCKED), notes, screenshot path if FAIL.

---

## 0. Pre-flight (run once before Cohort A)

**Prompt 0.0 — Start local dev server**

> Open Terminal. Run:
> ```
> cd "/Users/davidshulman/Library/CloudStorage/Dropbox-GinsbergShulman,PL/David Shulman/FLSSI Forms/Forms Project"
> git pull
> python3 -m http.server 8765
> ```
> Confirm server is listening on port 8765 (Terminal shows "Serving HTTP on :: port 8765"). Leave the Terminal window open for the rest of the session. Log 0.0.

**Prompt 0.1 — Environment check**

> Open http://localhost:8765/ in Chrome. Hard refresh (Cmd+Shift+R). Sign in with David's Microsoft account if not already signed in. Confirm: (a) sign-in succeeds, (b) dashboard renders, (c) console has no errors, (d) the page is being served from localhost (check the URL bar). Take a screenshot. Log 0.1.

**Prompt 0.2 — Tag audit (local)**

> Run `python3 scripts/audit_tags.py` from the project root. Confirm output is "PASS". If FAIL, stop and report which forms failed before any other test runs. Log 0.2.

**Prompt 0.3 — Create test client from scratch**

> On the dashboard, click "Add Client". Enter:
> - First name: `Eleanor`
> - Last name: `Whitfield-Hayes`
> - Address: `1450 Bayshore Drive, Apt 12B, Fort Lauderdale, FL 33316`
> - Phone: `954-555-0142`
> - Email: `eleanor.test@example.com`
>
> Save. Confirm the client appears in the client list with no matters. Confirm structured address grid populated correctly (street, line2, city=Fort Lauderdale, state=FL, zip=33316). Take a screenshot. Log 0.3.
>
> **All subsequent cohorts use this client.** Each cohort opens a new matter on Eleanor Whitfield-Hayes — do NOT reuse the seeded Margaret Torres matters. Wipe localStorage between cohorts only if a cohort says so.

---

## Cohort A — Formal Probate Admin (P3 stack)

Tests P3-PETITION / P3-OATH / P3-ORDER / P3-LETTERS / P1-0900 across testate/intestate × dom/ancillary × single/multi petitioner × has_codicil. Five generation runs.

**Prompt A.1 — Testate, domiciliary, single petitioner, no codicil, Broward**

> On Eleanor Whitfield-Hayes, click "Add Matter". Type: Probate. Subject: `Estate of Harold Whitfield, Sr.`. County: Broward. Save. Run the Open Estate wizard: Formal / Testate / Domiciliary / Broward. Decedent DOD: `2/15/2026`, decedent address: `1450 Bayshore Drive, Apt 12B, Fort Lauderdale, FL 33316`, last 4 SSN: `4421`. Add 3 beneficiaries (`Harold Whitfield Jr.` adult son, `Margaret Whitfield-Chen` adult daughter, `Olivia Chen` minor grandchild — interest: per stirpes share). Generate P3-PETITION, P3-OATH, P3-ORDER, P3-LETTERS, P1-0900 as a zip. Open each .docx. Verify: (a) caption is bold, county "BROWARD" in ALL CAPS, (b) no empty paragraphs between numbered items, (c) "1." level-0 numbering, (d) Broward AI certification appears above signature block on each filing-bound doc, (e) decedent name + DOD + address + 3 beneficiaries render correctly, (f) petitioner name auto-populated as Eleanor Whitfield-Hayes, (g) no `{tag}` strings remain unrendered. Save zip to `~/Desktop/test-out/A1/`. Log A.1.

**Prompt A.2 — Same matter, toggle has_codicil = true**

> On the Estate of Harold Whitfield, Sr. matter's P3-PETITION questionnaire, check `has_codicil` and enter codicil_dates "May 1, 2024". Regenerate P3-PETITION, P3-ORDER, P3-LETTERS. Verify the codicil clause renders in all three. Save to `~/Desktop/test-out/A2/`. Then uncheck has_codicil, regenerate, verify codicil clause is gone. Save to `~/Desktop/test-out/A2-off/`. Log A.2.

**Prompt A.3 — Multi-petitioner / multi-PR**

> On Eleanor Whitfield-Hayes, add a new matter: `Estate of Beatrice Hartley` (probate, Broward). Run wizard with multi-petitioner = yes, multi-PR = yes. Decedent DOD: `1/15/2026`, address: `2200 Las Olas Blvd, Fort Lauderdale, FL 33301`. In P3-PETITION add 2nd petitioner `Thomas Hartley` (`88 Coral Way, Coral Gables, FL 33134`) and 2nd PR (same person). Generate the P3 stack. Verify both names render in the petition body and on the Letters. Save to `~/Desktop/test-out/A3/`. Log A.3.

**Prompt A.4 — Ancillary, testate**

> On Eleanor Whitfield-Hayes, add matter: `Estate of Roland Whitfield` (probate, Broward). Run wizard: Formal / Testate / **Ancillary** / Broward. Confirm `is_ancillary` matter flag is set on the matter object (DevTools → localStorage). Verify domiciliary-only fields are hidden on the questionnaire. Decedent DOD: `1/20/2026`, foreign domicile address: `45 Rue de Rivoli, Paris, France 75001` (use the foreign-address toggle). Generate P3-PETITION + P3-ORDER. Verify ancillary language renders + foreign address renders cleanly. Save to `~/Desktop/test-out/A4/`. Log A.4.

**Prompt A.5 — Intestate**

> On Eleanor Whitfield-Hayes, add matter: `Estate of Cordelia Hayes` (probate, Broward). Run wizard: Formal / **Intestate** / Domiciliary / Broward. Decedent DOD: `2/1/2026`, address: same as Eleanor's address. Generate the P3 stack. Verify will-related clauses are absent and intestate-path language renders. Save to `~/Desktop/test-out/A5/`. Log A.5.

---

## Cohort B — Summary Admin (P2 stack)

**Prompt B.1 — Testate single distributee**

> On Eleanor Whitfield-Hayes, add matter: `Estate of Vincent Marlowe` (probate, Broward). Run wizard: Summary / Testate / Domiciliary / Broward. Decedent DOD: `1/10/2026`, address: `7700 NE 6th Ave, Miami, FL 33138`. Add one distributee: `Eleanor Whitfield-Hayes` (auto-populated), share: 100%. Generate P2-PETITION + P2-ORDER + P2-0355. Verify P2-ORDER is the *combined* "Order Admitting Will to Probate AND of Summary Administration" form (per Phase 8a David-preference). Verify distributee table renders on petition and order. Save to `~/Desktop/test-out/B1/`. Log B.1.

**Prompt B.2 — Toggle has_codicil**

> On the Estate of Vincent Marlowe matter's P2-PETITION, set has_codicil = true with date "March 5, 2024". Regenerate P2-PETITION + P2-ORDER. Verify codicil text renders. Save to `~/Desktop/test-out/B2/`. Log B.2.

**Prompt B.3 — Intestate**

> On Eleanor Whitfield-Hayes, add matter: `Estate of Marcus Doyle` (probate, Broward). Run wizard: Summary / Intestate / Domiciliary / Broward. Decedent DOD: `1/12/2026`, address: `333 Sunrise Blvd, Fort Lauderdale, FL 33304`. Generate P2-PETITION + P2-ORDER. Verify P2-ORDER renders the standalone Order of Summary Admin (no will-admit clause). Save to `~/Desktop/test-out/B3/`. Log B.3.

**Prompt B.4 — Ancillary, testate, self-proved, authenticated copy of will**

> On Eleanor Whitfield-Hayes, add matter: `Estate of Lucia Esposito` (probate, Broward). Run wizard: Summary / Testate / **Ancillary** / Broward. DOD `1/15/2026`, foreign domicile: `Via Veneto 12, Rome, Italy 00187`. On P2-PETITION set is_self_proved = true and is_auth_copy_of_will = true. Generate P2-PETITION + P2-ORDER. Verify both axes render correctly in the order. Save to `~/Desktop/test-out/B4/`. Log B.4.

---

## Cohort C — P1 Service Forms (smart consolidations)

**Prompt C.1 — P1-CAVEAT, all 4 axes**

> Use the Estate of Harold Whitfield, Sr. matter (from A.1). Generate P1-CAVEAT four times: (i) creditor + resident (caveator: `Sunrise Medical Center, 1600 S Andrews Ave, Fort Lauderdale, FL 33316`), (ii) creditor + nonresident (caveator: `Northeast Surgical Group, 88 Park Ave, New York, NY 10016`), (iii) interested person + resident (caveator: Eleanor herself), (iv) interested person + nonresident (caveator: `Harold Whitfield Jr., 245 Beacon St, Boston, MA 02116`). Verify caveator language matches type, and that the "designated agent" block appears only on nonresident variants. Save each to `~/Desktop/test-out/C1-i..iv/`. Log C.1 (one row per variant).

**Prompt C.2 — P1-FORMAL-NOTICE × {regular, adversary}**

> On Estate of Harold Whitfield, Sr., generate P1-FORMAL-NOTICE in regular mode, then adversary mode. Verify adversary axis triggers F.S. §731.301(2) language. Save to `~/Desktop/test-out/C2-reg/`, `~/Desktop/test-out/C2-adv/`. Log C.2 (two rows).

**Prompt C.3 — P1-PROOF-OF-SERVICE-FN × 3 service types × {adversary}**

> On Estate of Harold Whitfield, Sr., generate 6 variants: (mail, hand, publication) × (regular, adversary). Verify the correct service-method block renders and the adversary axis flips text where appropriate. Save under `~/Desktop/test-out/C3-*/`. Log C.3 (six rows).

**Prompt C.4 — P1-NOTICE-CONFIDENTIAL × {contemporaneous, after-the-fact}**

> On Estate of Harold Whitfield, Sr., generate both variants. Verify the contemporaneous-vs-after wording differs. Save to `~/Desktop/test-out/C4-cont/`, `~/Desktop/test-out/C4-after/`. Log C.4 (two rows).

---

## Cohort D — P1 Singletons

**Prompt D.1 — P1-0100 Petition to Open Safe Deposit Box**

> On Estate of Harold Whitfield, Sr., generate P1-0100. Box info: Bank of America, Las Olas branch, box #4421. Verify caption + body + signature block. Save to `~/Desktop/test-out/D1/`. Log D.1.

**Prompt D.2 — P1-0620 Joinder Waiver Consent (with notary)**

> On Estate of Harold Whitfield, Sr., generate P1-0620 for `Harold Whitfield Jr.` as joining beneficiary. Verify notary acknowledgment block renders and is properly formatted. Save to `~/Desktop/test-out/D2/`. Log D.2.

**Prompt D.3 — P1-0800 Notice of Trust**

> On Estate of Harold Whitfield, Sr., generate P1-0800. Trust: `Harold Whitfield, Sr. Revocable Trust dated June 12, 2018`, trustee: Eleanor Whitfield-Hayes. Verify trust details + decedent details + signature block. Save to `~/Desktop/test-out/D3/`. Log D.3.

---

## Cohort E — Curator Suite

**Prompt E.1 — P3-CURATOR-PETITION**

> On Eleanor Whitfield-Hayes, add matter: `Estate of Geraldine Pruitt - Curatorship` (probate, Broward). Decedent DOD `2/20/2026`, address `5500 N Federal Hwy, Fort Lauderdale, FL 33308`. Generate P3-CURATOR-PETITION. Verify curator name + address auto-populate from currentClient (Eleanor). Save to `~/Desktop/test-out/E1/`. Log E.1.

**Prompt E.2 — P3-CURATOR-ORDER × {bond required, no bond}**

> On Estate of Geraldine Pruitt - Curatorship, generate P3-CURATOR-ORDER twice: (i) bond required ($50,000), (ii) no bond. Verify bond clause renders only when bond is required. Save to `~/Desktop/test-out/E2-bond/`, `~/Desktop/test-out/E2-nobond/`. Log E.2 (two rows).

**Prompt E.3 — P3-CURATOR-OATH (with notary) + P3-CURATOR-LETTERS**

> On the curatorship matter, generate both. Verify notary block on the oath. Save to `~/Desktop/test-out/E3/`. Log E.3.

---

## Cohort F — Will Authentication

**Prompt F.1 — P3-OATH-WITNESS, all 4 axes**

> On Estate of Harold Whitfield, Sr., generate P3-OATH-WITNESS four times: (will + original), (will + copy), (codicil + original), (codicil + copy). Witness: `Marjorie Tan, 412 SE 5th Ave, Fort Lauderdale, FL 33301`. Verify wording flips on both axes. Save to `~/Desktop/test-out/F1-i..iv/`. Log F.1 (four rows).

**Prompt F.2 — P3-PROOF-WILL × {will, codicil}**

> On Estate of Harold Whitfield, Sr., generate both variants. Verify wording. Save to `~/Desktop/test-out/F2-will/`, `~/Desktop/test-out/F2-codicil/`. Log F.2 (two rows).

---

## Cohort G — Guardianship (Phase 7a/7b parity)

**Prompt G.1 — G3-025 Petition for Plenary Guardianship (person & property)**

> On Eleanor Whitfield-Hayes, add matter: `Guardianship of Theodore Whitfield` (guardianship — person & property, Broward). Set signing attorney = Jill (matter modal dropdown). AIP: `Theodore Whitfield`, DOB `4/3/1942`, address: `1450 Bayshore Drive, Apt 12B, Fort Lauderdale, FL 33316` (Eleanor's address — co-resident). Proposed guardian: Eleanor (auto-populate). Examining physician: `Dr. Aisha Patel, 2727 N University Dr, Sunrise, FL 33322`. Generate G3-025. Verify: (a) felony danger callout (F.S. §744.309(3)) is visible above the Proposed Guardian section in the questionnaire, (b) AIP DOB renders as a single date field formatted "Month D, YYYY" (i.e., "April 3, 1942"), (c) AIP + petitioner + proposed guardian + physician addresses all render in structured form, (d) signing line reads "Signed on this _____ day of __________, 20___." (no pre-filled month/year), (e) attorney signature block lists Jill (Bar 813850). Save to `~/Desktop/test-out/G1/`. Log G.1.

**Prompt G.2 — G3-026 Petition (property only)**

> On Eleanor Whitfield-Hayes, add matter: `Guardianship of Property of Iris Caldwell` (guardianship — property only, Broward). Signing attorney = Jill. AIP: `Iris Caldwell`, DOB `9/14/1938`, address: `790 NE 26th St, Wilton Manors, FL 33305`. Proposed guardian: Eleanor. Generate G3-026. Verify same UX upgrades as G.1 plus property-only language. Save to `~/Desktop/test-out/G2/`. Log G.2.

**Prompt G.3 — G3-010 Petition to Determine Incapacity**

> On the Theodore Whitfield matter, generate G3-010. Verify ETG felony callout, AIP DOB single date field, structured addresses for AIP + physician. Save to `~/Desktop/test-out/G3/`. Log G.3.

**Prompt G.4 — G2-010 + G2-140 (signing line + cos check)**

> On the Theodore Whitfield matter, generate G2-010 (initial guardian plan) and G2-140 (annual guardian report). Verify no signing_month/signing_year prefill, and on G2-140 no cos_month/cos_year prefill (handwritten by signer). Save to `~/Desktop/test-out/G4/`. Log G.4.

---

## Cohort H — Cross-cutting features

**Prompt H.1 — Address parser**

> On Estate of Harold Whitfield, Sr., manually type a free-text address into a fresh petitioner_address field: `999 Brickell Bay Dr, Penthouse 3, Miami, FL 33131`. Verify it auto-parses into the structured grid (street, line2, city=Miami, state=FL, zip=33131). Toggle "foreign address" on, off — confirm grid repopulates from foreign_text or original value. Log H.1.

**Prompt H.2 — visible_if conditionals**

> On Estate of Harold Whitfield, Sr.'s P3-PETITION, toggle has_codicil and observe codicil_dates field appearing/disappearing. Then open Estate of Roland Whitfield (ancillary matter from A.4), confirm domiciliary-only fields are hidden. Log H.2.

**Prompt H.3 — Row-lock**

> On a single-petitioner matter (Estate of Harold Whitfield, Sr.), confirm petitioners[] is capped to 1 row + an empty row visible. Then on Estate of Beatrice Hartley (multi from A.3), confirm rows can be added freely. Log H.3.

**Prompt H.4 — Auto-populate priority order**

> Add a fresh probate matter on Eleanor Whitfield-Hayes: `Estate of Test Auto-Pop` (Broward, formal). Confirm: (a) petitioners[0] auto-fills with Eleanor's name + structured address, (b) prs[0] auto-fills the same, (c) resident_agent_name dropdown defaults to David (probate matter, default attorney), (d) resident_agent_address auto-fills firm address (300 SE 2nd St Ste 600, Fort Lauderdale, FL 33301). Override petitioner_phone with `555-555-5555`; refresh page; confirm override persists. Log H.4.

**Prompt H.5 — Per-matter signing attorney toggle**

> On Estate of Test Auto-Pop, set signing attorney = Jill via matter modal. Generate P3-PETITION. Verify signature block lists Jill (Bar 813850), email `jill@ginsbergshulman.com`, phone `954-332-2310`. Flip back to David, regenerate, confirm signature block lists David (Bar 150762). Log H.5.

**Prompt H.6 — Universal caption + AI cert gating**

> Add three fresh single-petition test matters on Eleanor Whitfield-Hayes — one Broward, one Miami-Dade, one Palm Beach. Generate P3-PETITION on each. Verify: caption bold + ALL CAPS county on all three; Broward AI cert (AO 2026-03-Gen) only renders on Broward; Miami-Dade AI cert (AO 26-04) only renders on Miami-Dade; Palm Beach has neither. Log H.6.

**Prompt H.7 — PDF passthrough**

> On Estate of Harold Whitfield, Sr., generate BW-0010 / BW-0020 / BW-0030 / BW-0040 / BW-0050. Confirm output is the clerk PDF byte-for-byte (file size matches `reference/` source, opens cleanly in Preview). Log H.7.

---

## Results template

Create `TEST_RESULTS.md` with this header, then one row per test ID:

```
| ID  | Status | Notes                              | Screenshot |
|-----|--------|------------------------------------|------------|
| 0.1 | PASS   | login + seed visible, no errors    |            |
| A.1 | FAIL   | codicil clause rendered when off   | A1-bug.png |
```

When all cohorts complete, summarize at the bottom: total PASS / FAIL / BLOCKED, and list every FAIL with the most likely fix file (forms.json, builder script, app.js helper).

---

## Execution order

A → B → C → D → E → F → G → H. Stop on any FAIL in Cohort A or B (foundational); fix before continuing. Cohorts C–H are independent and can be parallelized if you want to spawn multiple Cowork sessions.
