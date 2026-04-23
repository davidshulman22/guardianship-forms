# Complete Probate + Guardianship Case Management System — Planning Document

**Created:** 2026-04-22
**Status:** PLANNING ONLY — no implementation. Revisit after probate template rebuild (Priority 1) and Matter Interview (Priority 1b) are complete.

This document captures the full brainstorm for evolving the current forms generator into a complete probate + guardianship case management system. It is the long-term north star; the current app is Phase 0 of this vision.

---

## A. Matter Lifecycle (the timeline view)

**1. Pre-matter**
- Conflict check across firm's entire party history
- Initial inquiry tracking (who called, when, outcome)
- Scheduling prospective client consults (Fantastical integration)

**2. Intake**
- Matter type wizard (probate: formal/summary/ancillary/domiciliary × testate/intestate; guardianship: person/property/both × plenary/limited × emergency/permanent)
- Intake questionnaire per matter type (decedent facts, AIP facts, family tree, assets, documents on hand)
- Document upload (death cert, original will, medical records, prior POA)
- Fee agreement + engagement letter generation (skills already exist)
- Retainer collection → trust account deposit
- Matter opened in Clio

**3. Opening the estate/guardianship**
- Petition preparation (current forms app)
- Oath / Designation of Resident Agent / Bond
- Affidavit of Heirs (intestate) / Affidavit re Criminal History (Broward)
- Filing via FL Courts E-Portal
- Original will deposit with Clerk
- Letters issued → PR/Guardian appointed
- Case number + division + judge captured

**4. Administration**
- Notice of Administration → 3-month creditor claim period
- Notice to Creditors (publication + known-creditor service)
- Formal Notice to interested persons (Rule 5.040)
- Inventory (60 days after letters)
- Marshaling assets (title transfers, account retitling)
- Creditor claims register + objection deadlines (4 months)
- Estate tax return tracking (9 months from DOD if applicable)
- Guardianship: Initial Plan + Inventory (60 days), then Annual Plan + Annual Accounting
- Interim distributions / sales requiring court approval
- Depository (restricted) account for guardianship property

**5. Closing**
- Final accounting (or waiver)
- Proposed plan of distribution
- Receipts, releases, refunding bonds from beneficiaries
- Petition for Discharge (P5-0800)
- Final distribution
- Order of Discharge → matter archived
- Closing letter + return of originals

---

## B. Functional Subsystems

**1. People & Parties Registry** *(the missing spine)*
- Unified person records across all matters
- Roles per person per matter (PR, beneficiary, heir, creditor, ward, AIP, next of kin, interested person, witness, co-counsel, opposing counsel, judge, process server)
- Relationships (spouse, child, parent, sibling, step-, deceased-)
- Contact info (addresses, phones, emails, preferred contact method)
- SSN (encrypted) for heirs
- DOB, DOD where applicable
- Capacity notes for guardianship subjects
- De-duplication when same person appears across matters

**2. Matter Data / Facts** *(Priority 1b in current roadmap)*
- `matterData` as source of truth — forms read from it, not the reverse
- Sections: Parties / Relatives / Assets / Liabilities / Addresses / Key Dates / Court Info
- Matter Interview UI per matter type
- Cross-matter lookups (same family → probate after estate plan)

**3. Deadlines & Calendar**
- Statutory deadlines auto-calculated from trigger events
  - Probate: 3-mo Notice of Admin, 4-mo creditor objections, 60-day inventory, 9-mo estate tax return, 12-mo final accounting target
  - Guardianship: 60-day initial plan + inventory, annual plan/accounting due dates, examining committee deadlines
- Court-set deadlines (hearings, status conferences, trial)
- Local rule deadlines (Broward-specific, PBC-specific, Miami-Dade)
- Reminders (30/14/7/1 day + overdue)
- Calendar sync (Outlook, Fantastical, Google)
- Judge-specific standing orders + hearing availability

**4. Tasks & Workflows**
- Task templates per matter subtype (Broward formal admin playbook, summary admin, guardianship of property)
- Dependencies (can't file inventory before letters issued)
- Assignments across David / Jill / Maribel / client
- Mandatory checklists (Broward will not forward without them)
- Status: open / in progress / waiting / done / blocked
- "What's next" per matter — smart next-action suggestion

**5. Documents — Generation** *(current app is this subsystem)*
- FLSSI statewide forms
- Broward local forms
- Palm Beach / Miami-Dade forms
- Firm template library (letters, memos, engagement letters, retainer agreements)
- Pleadings builder (petitions, motions, orders, responses)
- Correspondence templates
- Proposed orders (Broward requires 4 lines + case number on signature page)
- Inventories, accountings, plans (generated from financial data)
- Merge from matter data, not manual re-entry

**6. Documents — Management**
- Central matter file (one per matter)
- Categories: Pleadings / Correspondence / Evidence / Orders / Financial / Client-provided / Third-party records
- Versioning (draft / signed / filed / file-stamped)
- OCR on incoming scans → searchable
- Bates numbering for litigation
- Dropbox as underlying storage (keep current architecture)
- Full-text search across matter + across firm
- Audit log (who viewed/downloaded)

**7. Court Filings**
- E-Portal integration (FL Courts E-Filing Portal) or at minimum a submission tracker
- Filing register per matter (what's filed, when, by whom)
- Pending-filing queue
- File-stamped copy receipt + attach to record
- Clerk correspondence log
- Service list management + Certificate of Service auto-generation
- Formal Notice tracking + proof of service

**8. Service / Notice**
- Service list per matter with method per recipient (formal notice vs informal)
- Waiver + Consent tracker (beneficiary consents, waivers of accounting)
- Process server coordination (for formal notice requiring personal service)
- Publication tracking (Notice to Creditors — which newspaper, dates, affidavit of publication)

**9. Estate/Guardianship Financials**
- Estate bank account ledger
- Guardianship depository (restricted) account
- Asset inventory with DOD values
- Income/expense register post-DOD
- Distributions made
- Creditor claims paid/objected/compromised
- PR/Guardian compensation (§733.617, §744.108)
- Attorney fees (require court approval in some scenarios)
- Reconciliation to bank statements
- Annual accounting generation (from the ledger)
- 1041 fiduciary return support, 706 estate tax prep support

**10. Firm Financials** *(mostly Clio/QBO already)*
- Time entries per matter (Clio integration — already in place)
- Trust accounting (IOTA) — three-way reconciliation
- Invoice generation
- Cost tracking
- Flat fee vs hourly handling
- Attorney fee petitions (probate needs court approval)
- QBO sync (accounting skill exists)

**11. Creditor Claims Register**
- Claim filed date + claimant + amount
- Objection deadline calculator
- Status: allowed / objected / compromised / paid / abandoned
- Limitation bar tracker
- Payment record

**12. Beneficiary & Distribution Management**
- Beneficiary list with shares (per will or intestate succession)
- Specific devises vs residuary
- Minor beneficiary handling (UTMA, trust, guardianship of property required?)
- Disclaimers tracked
- Distribution record with receipts/releases/refunding bonds
- Tax withholding + 1099 handling

**13. Guardianship-Specific**
- Examining committee tracking (3 members, report deadlines)
- Court visitor reports
- Medical/residential decision log (person guardianship)
- Restoration of rights petitions
- Annual Guardian Plan (person) drafting assistant
- Annual Accounting (property) drafting assistant
- Periodic review hearing schedule
- Court-required CE for guardian (if lay guardian)

**14. Communications Hub**
- Email threading per matter (Microsoft 365 integration — in place)
- Phone call log
- Text log
- Meeting notes (Fireflies integration — in place)
- Client portal with secure messaging
- Auto-attach emails to matter file by subject/address matching

**15. Contested Matters**
- Will contest tracking
- Guardianship contest
- Accounting objections
- Discovery (RFPs, interrogatories, requests to admit, depositions)
- Mediation scheduling
- Trial exhibits + witness list
- Order on motion tracking

**16. Reporting & Dashboards**
- "My day" — what's due today across all my matters
- Matter status grid
- Deadlines within 30 days, firm-wide
- Stalled matters (no activity in N days)
- Revenue by matter type
- Average time to close by matter type
- PR/Guardian compliance dashboard (accountings overdue, etc.)

**17. Compliance & Audit Trail**
- Full change log (who did what, when) per matter
- Retention policy enforcement
- Florida Bar trust accounting compliance check
- Conflict check every new matter
- Document access log
- Data export for bar audit

---

## C. Cross-Cutting Concerns

**Authentication & Roles**
- David (admin), Jill (admin), Maribel (paralegal — full matter access, no firm-admin)
- Future: co-counsel temporary access, client read-only portal, examining committee portal
- 2FA mandatory for attorneys

**Integrations**
- Clio Manage (matters, billing, contacts) — existing
- QuickBooks Online (firm books) — existing
- Dropbox (doc storage) — existing
- Microsoft 365 (email, calendar, contacts) — existing
- DocuSign (signing) — existing
- Clio Draft (form templates) — existing
- Fireflies (meeting transcripts) — existing
- Florida Courts E-Filing Portal — new
- Clerk dockets (Broward/PBC/MDC) — new, for docket auto-sync
- WealthCounsel / ILS (estate planning bridge into probate)
- Westlaw/Fastcase (research links) — optional
- Newspapers for Notice to Creditors publication — optional

**AI Layer**
- Draft documents from matter facts ("draft the petition for [matter]")
- Review incoming docs (extract facts from uploaded will, accounting, creditor claim)
- Summarize long documents
- Answer procedural questions with matter context
- Chat with matter ("what's outstanding on Torres?")
- Auto-generate file memos (skill exists)
- Flag deadline risks
- Draft correspondence in firm voice (blog/letter skills exist)

**Mobile**
- View matter on phone
- Log calls/tasks
- Photo-upload documents received in mail
- See today's deadlines

**Data Model (the spine everything hangs on)**
- Person (universal, dedupes across matters)
- Matter (typed; has state machine by type)
- Role (Person × Matter × RoleType)
- Event (everything that happens: filing, hearing, call, email, deadline hit)
- Document (versioned, categorized, linked to events)
- Transaction (money in/out — estate, trust, operating)
- Task (workflow item)
- Deadline (computed or court-set)

---

## D. Open Design Decisions (the ones that matter)

1. **Build vs buy.** Clio has Clio Manage, Clio Grow, Clio Draft — not a probate-specific system. Smokeball, MyCase, Practice Panther exist but none probate-specialized. Actipro has ProbateNote. The case for building: probate/guardianship is procedurally tight enough that a purpose-built workflow beats generic case management. The case against: trust accounting and billing are commodity; don't rebuild Clio.
2. **System of record boundary.** Clio = billing + contacts + time. QBO = firm books. Your system = matter workflow + documents + estate financials + deadlines. Draw the line clearly or you'll have conflicting source-of-truth.
3. **Single-tenant or multi-tenant from day one.** You're the only firm now. But if this ever goes anywhere, the schema decisions made now are hard to undo. Probably single-tenant with clean tenancy boundaries so splitting later is possible.
4. **Client portal scope.** Full self-service intake + document upload + matter status + signing? Or just secure messaging + document delivery? Big UX scope difference.
5. **E-Portal integration depth.** Florida's E-Portal has no public API. Options: (a) manual logging of what was filed, (b) browser automation, (c) wait for an API that may never come. Affects how tight the filing tracker can be.
6. **Offline/mobile requirements.** If you need to work a hearing from court with spotty wifi, architecture changes.
7. **Contested matter scope.** Litigation support is an enormous feature area. Include now, punt, or partner with existing tool?
8. **Data migration.** Existing matters in Clio + Dropbox need to come in. One-time import or live sync?
9. **Post-Jill plan.** Guardianship leaves with Jill. System needs to gracefully shed that domain without breaking probate.
10. **Retention & departure.** What happens to matter data if you retire? Export format, client handoff.

---

## E. Suggested Phasing

**Phase 0 — current:** Forms generator with matter/client data. ✅

**Phase 1 — Matter Interview (already planned as Priority 1b).** Lift matter facts to `matterData`. Forms read from it. This is the foundation for everything else.

**Phase 2 — People Registry.** Universal person records with roles. Replace ad-hoc beneficiary/heir arrays.

**Phase 3 — Deadlines + Tasks.** Statutory deadline calculator + task templates per matter type. "My day" view. Biggest quality-of-life win for daily use.

**Phase 4 — Document Management.** Centralize matter files (Dropbox as storage, your system as the index + metadata + categories + versioning).

**Phase 5 — Estate Financials.** Inventory + accounting generation from a real ledger. Unlocks auto-generated annual accountings (guardianship) and final accountings (probate).

**Phase 6 — Filing Tracker + Service Lists.** What's filed, what's served, what's pending.

**Phase 7 — Communications Hub.** Email/call/text threading per matter.

**Phase 8 — AI Chat-with-Matter.** Full natural-language assistant with complete matter context.

**Phase 9 — Client Portal.** Once everything internal is solid.

---

## F. Things to Flag Now

- **Person registry is the sleeper priority.** Every other subsystem assumes it exists. If matter data is built before person registry, refactoring follows.
- **Deadline calculator is the highest-leverage early win** — it turns this from "form generator" into "case management." Statutory deadlines are deterministic and rule-based; easy to implement, huge daily value.
- **Don't rebuild Clio.** Billing, time, and contacts live there. Pull via API when needed; don't mirror the data.
- **Estate financials vs firm financials are different animals.** Keep them separate. QBO handles firm books; estate ledger is its own thing per matter.
- **Plan the data export on day one.** If ever leaving Supabase or handing a file to successor counsel, a defined export format matters.

---

## G. Not Now

Do not start this work until:
1. Probate template rebuild (Priority 1) is complete — all 35 remaining forms on the new builder pattern
2. Matter Interview (Priority 1b) is complete — `matterData` is the source of truth for matter facts

Then revisit this document and pick the next phase.
