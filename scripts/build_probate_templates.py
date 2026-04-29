#!/usr/bin/env python3
"""
Build clean single-column probate templates for Ginsberg Shulman.

Four "smart" templates cover every variant of formal-administration opening
via docxtemplater conditionals — FLSSI form numbers are meaningless to the
firm, so this collapses 23 FLSSI IDs into 4 maintainable templates:

  P3-PETITION  Petition for Administration
    Axes: testate/intestate, single/multiple petitioners, domiciliary/ancillary
  P3-OATH      Oath of Personal Representative + Designation of Resident Agent
    Axes: single/multiple PRs
  P3-ORDER     Order Admitting Will and Appointing PR / Order Appointing PR
    Axes: testate/intestate, single/multiple PRs, domiciliary/ancillary
  P3-LETTERS   Letters of Administration / Letters of Ancillary Administration
    Axes: single/multiple PRs, domiciliary/ancillary

Shared conventions (all 4 templates):
  - Single-column caption via borderless table
  - Real Word numbering (numPr/numId=1) per docx-numbering skill
  - Grammar pre-computed in prepareTemplateData() — templates use
    {petitioner_label}/{petitioner_verb_alleges}/{pr_names}/etc.
  - Broward AI certification above signature block (county-conditional)

Shared helpers (_add_para, _pleading_para, _inject_numbering_part, etc.)
are imported from build_guardianship_templates.
"""

import os

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

from build_guardianship_templates import (
    FONT, BODY_SIZE, SMALL_SIZE, TEMPLATE_DIR,
    _add_para, _add_run, _set_run,
    _borderless_table, _table_with_borders, _clear_cell, _cell_para,
    _apply_page_setup, _apply_running_header,
    _ensure_pleading_numbering, _pleading_para,
    _inject_numbering_part,
    _add_broward_ai_certification,
)


# ---------------------------------------------------------------------------
# Probate-specific helpers
# ---------------------------------------------------------------------------

def _add_probate_caption(doc, *, decedent_tag='{decedent_full_name}'):
    """Probate caption:
      IN THE CIRCUIT COURT FOR {county_caption} COUNTY, FLORIDA (centered, bold)
      4-row borderless table (decedent on the left, File No./Division on the right),
      every line bold.

    {county_caption} is set by prepareTemplateData() in app.js to an uppercased
    version of the matter county, so e.g. "Broward" renders as "BROWARD".
    """
    _add_para(doc, 'IN THE CIRCUIT COURT FOR {county_caption} COUNTY, FLORIDA',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=12)
    caption = _borderless_table(doc, rows=4, cols=2, col_widths_in=[3.5, 3.0])
    _clear_cell(caption.cell(0, 0)); _cell_para(caption.cell(0, 0), 'IN RE: ESTATE OF', bold=True, space_after=0)
    _clear_cell(caption.cell(0, 1)); _cell_para(caption.cell(0, 1), 'PROBATE DIVISION', bold=True, space_after=0)
    _clear_cell(caption.cell(1, 0)); _cell_para(caption.cell(1, 0), f'{decedent_tag},', bold=True, space_after=0)
    _clear_cell(caption.cell(1, 1)); _cell_para(caption.cell(1, 1), '', bold=True, space_after=0)
    _clear_cell(caption.cell(2, 0)); _cell_para(caption.cell(2, 0), 'Deceased.', bold=True, space_after=0)
    _clear_cell(caption.cell(2, 1)); _cell_para(caption.cell(2, 1), 'File No. {file_no}', bold=True, space_after=0)
    _clear_cell(caption.cell(3, 0)); _cell_para(caption.cell(3, 0), '', bold=True, space_after=0)
    _clear_cell(caption.cell(3, 1)); _cell_para(caption.cell(3, 1), 'Division {division}', bold=True, space_after=0)
    _add_para(doc, '', space_after=18)


def _estate_assets_table(doc):
    """Two-column bordered table for probate estate assets with repeating row."""
    tbl = _table_with_borders(doc, rows=2, cols=2, col_widths_in=[4.5, 2.0])
    for cell in tbl.rows[0].cells:
        _clear_cell(cell)
    _cell_para(tbl.cell(0, 0), 'NATURE OF ASSET', bold=True, space_after=0)
    _cell_para(tbl.cell(0, 1), 'APPROXIMATE VALUE', bold=True, space_after=0)
    for cell in tbl.rows[1].cells:
        _clear_cell(cell)
    _cell_para(tbl.cell(1, 0), '{#estate_assets}{asset_description}', space_after=0)
    _cell_para(tbl.cell(1, 1), '{asset_value_formatted}{/estate_assets}', space_after=0)
    return tbl


def _distribution_table(doc):
    """Three-column bordered table for summary-admin distribution plan.
    Same row pattern as beneficiaries: header + one looping row
    (`{#summary_admin_distributees}...{/summary_admin_distributees}`)."""
    tbl = _table_with_borders(doc, rows=2, cols=3, col_widths_in=[2.0, 2.8, 1.7])
    for cell in tbl.rows[0].cells:
        _clear_cell(cell)
    _cell_para(tbl.cell(0, 0), 'NAME', bold=True, space_after=0)
    _cell_para(tbl.cell(0, 1), 'ADDRESS', bold=True, space_after=0)
    _cell_para(tbl.cell(0, 2), 'ASSET, SHARE OR AMOUNT', bold=True, space_after=0)
    for cell in tbl.rows[1].cells:
        _clear_cell(cell)
    _cell_para(tbl.cell(1, 0), '{#summary_admin_distributees}{dist_name}', space_after=0)
    _cell_para(tbl.cell(1, 1), '{dist_address}', space_after=0)
    _cell_para(tbl.cell(1, 2), '{dist_share}{/summary_admin_distributees}', space_after=0)
    return tbl


def _beneficiaries_table(doc):
    """Four-column bordered table for probate beneficiaries with a
    docxtemplater paragraph-loop row."""
    tbl = _table_with_borders(doc, rows=2, cols=4, col_widths_in=[1.8, 2.4, 1.4, 0.9])
    for cell in tbl.rows[0].cells:
        _clear_cell(cell)
    _cell_para(tbl.cell(0, 0), 'NAME', bold=True, space_after=0)
    _cell_para(tbl.cell(0, 1), 'ADDRESS', bold=True, space_after=0)
    _cell_para(tbl.cell(0, 2), 'RELATIONSHIP', bold=True, space_after=0)
    _cell_para(tbl.cell(0, 3), 'BIRTH YR.', bold=True, space_after=0)
    for cell in tbl.rows[1].cells:
        _clear_cell(cell)
    _cell_para(tbl.cell(1, 0), '{#beneficiaries}{ben_name}', space_after=0)
    _cell_para(tbl.cell(1, 1), '{ben_address}', space_after=0)
    _cell_para(tbl.cell(1, 2), '{ben_relationship}', space_after=0)
    _cell_para(tbl.cell(1, 3), '{ben_year_of_birth}{/beneficiaries}', space_after=0)
    return tbl


def _add_probate_signature_block(doc):
    """Signature block: one signer line per petitioner (via loop) + attorney.

    Signing date left blank — filler at signing time (won't be known at draft).
    """
    indent = Inches(0.5)
    _add_para(doc, 'Signed on this _____ day of ______________________, 20____.',
              first_indent=indent, space_after=24)

    # Per-petitioner signature line (loops over petitioners array; renders a
    # single sig line when there's only one petitioner).
    _add_para(doc, '{#petitioners}', space_after=0)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{pet_name}, Petitioner', space_after=24)
    _add_para(doc, '{/petitioners}', space_after=0)

    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{attorney_name}, Attorney for {petitioner_label}', space_after=18)
    _add_para(doc, 'Email Addresses:', space_after=0)
    _add_para(doc, '{attorney_email}', space_after=0)
    _add_para(doc, '{#attorney_email_secondary}{attorney_email_secondary}{/attorney_email_secondary}', space_after=0)
    _add_para(doc, 'Florida Bar No. {attorney_bar_no}', space_after=12)
    _add_para(doc, '{attorney_firm}', space_after=0)
    _add_para(doc, '{attorney_address}', space_after=12)
    _add_para(doc, 'Telephone {attorney_phone}', space_after=0)


def _add_order_signature_block(doc):
    """Signature block for court orders: date stamp + judge signature."""
    _add_para(doc, '', space_after=18)
    _add_para(doc, 'DONE AND ORDERED in {county} County, Florida.', space_after=36)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, 'CIRCUIT JUDGE', space_after=24)
    _add_para(doc, 'Copies furnished to:', space_after=0)
    _add_para(doc, '{attorney_name}, {attorney_firm}', space_after=0)
    _add_para(doc, '{attorney_address}', space_after=0)


# ---------------------------------------------------------------------------
# P3-PETITION  Petition for Administration (smart / conditional)
# ---------------------------------------------------------------------------

def build_p3_petition():
    """One template covering every opening-petition variant via conditionals:
      {is_testate}        — testate vs intestate
      {is_ancillary}      — domiciliary vs ancillary
      {multiple_petitioners} / {multiple_prs} — grammar + loop branches
    Grammar strings ({petitioner_label}, {petitioner_verb_alleges}, etc.)
    are precomputed in prepareTemplateData().
    """
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    # ---- Title (conditional on is_ancillary) ----
    _add_para(doc, 'PETITION FOR{#is_ancillary} ANCILLARY{/is_ancillary} ADMINISTRATION',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    # Intro — unnumbered. Grammar pre-computed.
    _add_para(doc, '{petitioner_label}, {petitioner_names}, {petitioner_verb_alleges}:',
              space_after=12)

    # 1. Interest + address (loops petitioners; grammar switches on multiple_petitioners)
    _pleading_para(doc,
        '{^multiple_petitioners}{#petitioners}Petitioner has an interest in the above '
        'estate as {pet_interest}. Petitioner\u2019s address is {pet_address}, and the '
        'name and office address of petitioner\u2019s attorney are set forth at the end of '
        'this petition.{/petitioners}{/multiple_petitioners}'
        '{#multiple_petitioners}Each petitioner has an interest in the above estate, as '
        'set forth below: {#petitioners}{pet_name} is {pet_interest}, whose address is '
        '{pet_address}. {/petitioners}The name and office address of petitioners\u2019 '
        'attorney are set forth at the end of this petition.{/multiple_petitioners}')

    # 2. Decedent (ancillary vs domiciliary + testate vs intestate)
    _pleading_para(doc,
        'Decedent, {decedent_full_name}, whose last known address was {decedent_address}, '
        'and the last four digits of whose social security number are {decedent_ssn_last4}, '
        'died on {decedent_death_date} at {decedent_death_place}. On the date of death, '
        'decedent was domiciled in '
        '{^is_ancillary}{decedent_domicile} County, Florida{/is_ancillary}'
        '{#is_ancillary}{decedent_domicile_state} and left property in {county} County, '
        'Florida{/is_ancillary}'
        '{^is_testate}, and died intestate{/is_testate}.')

    # 3. Beneficiaries
    _pleading_para(doc,
        'So far as is known, the names of the beneficiaries of this estate and of the '
        'decedent\u2019s surviving spouse, if any, their addresses and relationships to '
        'decedent, and the years of birth of any who are minors, are:',
        keep_with_next=True)
    _beneficiaries_table(doc)

    # 4. Venue
    _pleading_para(doc,
        'Venue of this proceeding is in this county because {venue_reason}.')

    # 5. PR qualifications (single PR vs multiple PRs; FL-resident conditional on each)
    _pleading_para(doc,
        '{^multiple_prs}{pr_names}, whose address is {pr_address}, is qualified to serve '
        'as personal representative of the decedent\u2019s estate: {pr_names} has not been '
        'convicted of a felony, is mentally and physically able to perform the duties of '
        'personal representative, and is 18 years of age or older. '
        '{#pr_is_fl_resident}{pr_names} is a resident of Florida.{/pr_is_fl_resident}'
        '{^pr_is_fl_resident}{pr_names} is not a resident of Florida but is related to '
        'the decedent as {pr_relationship} and is qualified to serve as personal '
        'representative under Florida Statutes section 733.304.{/pr_is_fl_resident}'
        '{/multiple_prs}'
        '{#multiple_prs}Each proposed personal representative is qualified to serve: '
        '{#prs}{pr_name}, whose address is {pr_address}, has not been convicted of a '
        'felony, is mentally and physically able to perform the duties of personal '
        'representative, and is 18 years of age or older. '
        '{#pr_is_fl_resident}{pr_name} is a resident of Florida.{/pr_is_fl_resident}'
        '{^pr_is_fl_resident}{pr_name} is not a resident of Florida but is related to the '
        'decedent as {pr_relationship} and is qualified under Florida Statutes section '
        '733.304.{/pr_is_fl_resident} {/prs}{/multiple_prs}')

    # 6. Petitioner(s) prior conviction
    _pleading_para(doc,
        '{petitioner_label} {#petitioner_has_prior_conviction}{petitioner_verb_has}'
        '{/petitioner_has_prior_conviction}{^petitioner_has_prior_conviction}'
        '{petitioner_verb_has} not{/petitioner_has_prior_conviction} been convicted in any '
        'state or foreign jurisdiction of abuse, neglect, or exploitation of an elderly '
        'person or a disabled adult, as those terms are defined in Florida Statutes '
        'section 825.101.')

    # 7. Preference
    _pleading_para(doc,
        '{^higher_preference_exists}No person has equal or higher preference to be '
        'appointed personal representative.{/higher_preference_exists}'
        '{#higher_preference_exists}The following person(s) has/have equal or higher '
        'preference to be appointed personal representative: {higher_preference_names}. '
        '{#higher_preference_formal_notice}Formal notice of this petition will be served '
        'on such person(s).{/higher_preference_formal_notice}'
        '{^higher_preference_formal_notice}Formal notice of this petition will not be '
        'served on such person(s).{/higher_preference_formal_notice}'
        '{/higher_preference_exists}')

    # 8. Assets
    _pleading_para(doc,
        'The nature and approximate value of the assets in this estate are:',
        keep_with_next=True)
    _estate_assets_table(doc)

    # 9. Estate tax return
    _pleading_para(doc,
        'This estate {#estate_tax_return_required}will{/estate_tax_return_required}'
        '{^estate_tax_return_required}will not{/estate_tax_return_required} be required '
        'to file a federal estate tax return.')

    # 10. Domiciliary/principal proceedings — ancillary ALWAYS has pending domiciliary
    _pleading_para(doc,
        '{#is_ancillary}Domiciliary proceedings are pending in {domiciliary_court_name}, '
        'the address of which is {domiciliary_court_address}, and letters have been '
        'issued to {domiciliary_representative}, whose address is '
        '{domiciliary_representative_address}.{/is_ancillary}'
        '{^is_ancillary}Domiciliary or principal proceedings '
        '{#domiciliary_proceedings_pending}are known to be pending in '
        '{domiciliary_court_name}, the address of which is {domiciliary_court_address}. '
        'Letters have been issued to {domiciliary_representative}, whose address is '
        '{domiciliary_representative_address}.{/domiciliary_proceedings_pending}'
        '{^domiciliary_proceedings_pending}are not known to be pending in another state '
        'or country.{/domiciliary_proceedings_pending}{/is_ancillary}')

    # 11. Will disposition (testate) / Unaware of unrevoked wills (intestate) — ONE paragraph.
    # Will status (original in court, accompanies petition, authenticated copy, etc.) is a
    # filing-time fact — omitted here. Clerk-review language defaults to neutral "accompanies
    # this petition"; revise at filing if the original was previously deposited.
    _pleading_para(doc,
        '{#is_testate}The decedent\u2019s last will dated {will_date}'
        '{#codicil_dates}, and codicil(s) dated {codicil_dates}{/codicil_dates}, '
        'accompanies this petition. Petitioner is unaware of any unrevoked will or codicil '
        'of decedent other than as set forth above.{/is_testate}'
        '{^is_testate}After the exercise of reasonable diligence, petitioner is unaware '
        'of any unrevoked wills or codicils of decedent.{/is_testate}')

    # Closing — unnumbered.
    indent = Inches(0.5)
    _add_para(doc,
        'WHEREFORE, {petitioner_label} respectfully '
        '{^multiple_petitioners}requests{/multiple_petitioners}'
        '{#multiple_petitioners}request{/multiple_petitioners} that '
        '{#is_testate}the decedent\u2019s will be admitted to probate and that {/is_testate}'
        '{pr_names} be appointed {pr_label} of the estate of the decedent'
        '{#is_ancillary} and that letters of ancillary administration be issued'
        '{/is_ancillary}.',
        first_indent=indent, space_before=12, space_after=12)
    _add_para(doc,
        'Under penalties of perjury, {petitioner_label} declare{^multiple_petitioners}s'
        '{/multiple_petitioners} that {petitioner_label} {petitioner_verb_has} read the '
        'foregoing, and the facts alleged are true, to the best of '
        '{petitioner_poss} knowledge and belief.',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Petition for Administration')

    _add_probate_signature_block(doc)

    out_path = os.path.join(TEMPLATE_DIR, 'P3-PETITION.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P3-OATH  Oath of Personal Representative + Designation of Resident Agent
# ---------------------------------------------------------------------------

def build_p3_oath():
    """Combined oath + designation of resident agent. Single document per
    PR; when there are multiple PRs, each one signs their own block below.
    """
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'OATH OF {pr_label_caps}',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=12)
    _add_para(doc, 'AND DESIGNATION OF RESIDENT AGENT AND ACCEPTANCE',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    # Oath section — one body paragraph per PR via loop
    _add_para(doc, 'OATH', bold=True, space_after=6)
    _add_para(doc,
        '{#prs}I, {pr_name}, swear or affirm that I will faithfully administer the '
        'estate of the above-named decedent according to law.{/prs}',
        space_after=24)

    # Per-PR oath signature block
    _add_para(doc, '{#prs}', space_after=0)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{pr_name}', space_after=18)
    _add_para(doc, 'Sworn to (or affirmed) and subscribed before me by means of '
                   '\u2610 online notarization or \u2610 physical presence this '
                   '_____ day of ______________________, 20____, by {pr_name}, '
                   'who is personally known to me or produced '
                   '______________________________ as identification.', space_after=18)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, 'Notary Public', space_after=0)
    _add_para(doc, 'State of Florida', space_after=24)
    _add_para(doc, '{/prs}', space_after=0)

    # Designation of Resident Agent
    _add_para(doc, 'DESIGNATION OF RESIDENT AGENT AND ACCEPTANCE',
              bold=True, space_before=12, space_after=12)
    _add_para(doc,
        '{pr_label_title} hereby designate{^multiple_prs}s{/multiple_prs} {resident_agent_name}, '
        'whose address is {resident_agent_address}, as resident agent '
        'to accept service of process within the State of Florida in any '
        'action or proceeding affecting the estate of the above-named decedent.',
        space_after=18)

    # PR signature(s) for the designation
    _add_para(doc, '{#prs}', space_after=0)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{pr_name}, {pr_label_title}', space_after=18)
    _add_para(doc, '{/prs}', space_after=6)

    # Resident agent acceptance
    _add_para(doc, 'ACCEPTANCE', bold=True, space_before=12, space_after=12)
    _add_para(doc,
        'I, {resident_agent_name}, having a business address within the State of Florida, '
        'hereby accept the foregoing designation as resident agent.',
        space_after=18)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{resident_agent_name}', space_after=0)
    _add_para(doc, 'Resident Agent', space_after=18)

    _add_broward_ai_certification(doc, 'Oath of Personal Representative')

    out_path = os.path.join(TEMPLATE_DIR, 'P3-OATH.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P3-ORDER  Order Admitting Will & Appointing PR / Order Appointing PR
# ---------------------------------------------------------------------------

def build_p3_order():
    """Proposed order granting the petition. Handles:
      - testate: admits will, appoints PR
      - intestate: appoints PR only
      - single/multiple PRs
      - domiciliary (Letters of Administration) vs ancillary (Letters of
        Ancillary Administration)
    """
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    # Title varies on testate + ancillary
    _add_para(doc,
        'ORDER '
        '{#is_testate}ADMITTING WILL TO PROBATE AND {/is_testate}'
        'APPOINTING {pr_label_caps}'
        '{#is_ancillary} OF ANCILLARY ADMINISTRATION{/is_ancillary}',
        align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    # Findings preamble
    _add_para(doc,
        'On the petition of {petitioner_names} for administration of the estate of '
        '{decedent_full_name}, deceased, the Court finds that the decedent died on '
        '{decedent_death_date}; that the decedent was domiciled in '
        '{^is_ancillary}{decedent_domicile} County, Florida{/is_ancillary}'
        '{#is_ancillary}{decedent_domicile_state}{/is_ancillary} at the time of death; '
        'that {pr_names} {pr_verb_is} entitled to preference in appointment and '
        '{pr_verb_is} qualified to serve as {pr_label}; and that the petition '
        'satisfies the requirements of Florida Probate Code. It is',
        space_after=18)

    _add_para(doc, 'ORDERED and ADJUDGED:', bold=True, space_after=12)

    # Testate-only: admit will
    _pleading_para(doc,
        '{#is_testate}The decedent\u2019s last will dated {will_date}'
        '{#codicil_dates}, and codicil(s) dated {codicil_dates}{/codicil_dates} '
        '{#will_is_self_proved}{pr_verb_is} self-proved and {/will_is_self_proved}'
        '{pr_verb_is} admitted to probate according to law.{/is_testate}'
        '{^is_testate}The decedent died intestate. Administration of the '
        'decedent\u2019s estate is granted.{/is_testate}')

    # Appoint PR(s). Bond omitted from the questionnaire — if the court wants bond,
    # it will enter a separate order requiring it.
    _pleading_para(doc,
        '{pr_names} {pr_verb_is} appointed as {pr_label} of the estate of the decedent, '
        'to serve without bond.')

    # Letters
    _pleading_para(doc,
        'Upon {pr_pronoun_his_her} qualification by filing of {pr_pronoun_his_her} oath, '
        'letters of {#is_ancillary}ancillary {/is_ancillary}administration shall issue to '
        '{pr_names}.')

    _add_order_signature_block(doc)

    out_path = os.path.join(TEMPLATE_DIR, 'P3-ORDER.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P3-LETTERS  Letters of Administration / Letters of Ancillary Administration
# ---------------------------------------------------------------------------

def build_p3_letters():
    """Letters issued by the clerk once the order is entered. Single template
    covers domiciliary + ancillary, single + multiple PRs."""
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc,
        'LETTERS OF {#is_ancillary}ANCILLARY {/is_ancillary}ADMINISTRATION',
        align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    _add_para(doc, 'TO ALL WHOM IT MAY CONCERN:', bold=True, space_after=12)

    _add_para(doc,
        'WHEREAS, {decedent_full_name}, a resident of '
        '{^is_ancillary}{decedent_domicile} County, Florida{/is_ancillary}'
        '{#is_ancillary}{decedent_domicile_state}{/is_ancillary}, died on '
        '{decedent_death_date}, '
        '{#is_testate}owning assets in this state, and a duly executed last will'
        '{#codicil_dates} and codicil(s){/codicil_dates} of the decedent has been '
        'admitted to probate in this Court; and{/is_testate}'
        '{^is_testate}leaving assets in this state and having died intestate; and'
        '{/is_testate}',
        space_after=12)

    _add_para(doc,
        'WHEREAS, {pr_names} {pr_verb_is} qualified under the laws of the State of '
        'Florida to act as {pr_label}'
        '{#is_ancillary} of ancillary administration{/is_ancillary} of the estate of '
        'the decedent, and has/have taken the prescribed oath;',
        space_after=12)

    _add_para(doc,
        'NOW, THEREFORE, I, the undersigned Circuit Judge, do declare {pr_names} '
        'duly qualified under the laws of the State of Florida to act as {pr_label}'
        '{#is_ancillary} of ancillary administration{/is_ancillary} of the estate of '
        '{decedent_full_name}, deceased, with full power to administer the estate '
        'according to law; to ask, demand, sue for, recover and receive the property '
        'of the decedent; to pay the debts of the decedent as far as the assets of '
        'the estate will permit and the law directs; and to make distribution of the '
        'estate according to law.',
        space_after=24)

    _add_para(doc, 'WITNESS my hand and the seal of this Court.',
              space_after=24)

    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, 'CIRCUIT JUDGE', space_after=0)

    out_path = os.path.join(TEMPLATE_DIR, 'P3-LETTERS.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P1-0900  Notice of Designation of Email Addresses for Service
# ---------------------------------------------------------------------------

def build_p1_0900():
    """Rule 2.516(b)(1)(A) notice of primary/secondary service emails.
    Attorney-signed only (no petitioner signature). Signing date left blank
    (filled at signing).
    """
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'NOTICE OF DESIGNATION OF EMAIL ADDRESSES',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=0)
    _add_para(doc, 'FOR SERVICE OF DOCUMENTS',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    indent = Inches(0.5)
    _add_para(doc,
        'Pursuant to Florida Rule of General Practice and Judicial Administration '
        '2.516(b)(1)(A), the undersigned counsel gives notice of the following '
        'primary and secondary e-mail addresses for service in this matter:',
        first_indent=indent, space_after=12)

    _add_para(doc, 'Primary Email Address: {attorney_email}',
              first_indent=indent, space_after=6)
    _add_para(doc,
        'Secondary Email Address: '
        '{#attorney_email_secondary}{attorney_email_secondary}{/attorney_email_secondary}'
        '{^attorney_email_secondary}N/A{/attorney_email_secondary}',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Notice of Designation of Email Addresses')

    # Attorney-only signature block (no petitioner sig on a service notice).
    _add_para(doc, 'Signed on this _____ day of ______________________, 20____.',
              first_indent=indent, space_after=24)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{attorney_name}, Attorney for {petitioner_label}', space_after=18)
    _add_para(doc, 'Email Addresses:', space_after=0)
    _add_para(doc, '{attorney_email}', space_after=0)
    _add_para(doc, '{#attorney_email_secondary}{attorney_email_secondary}{/attorney_email_secondary}', space_after=0)
    _add_para(doc, 'Florida Bar No. {attorney_bar_no}', space_after=12)
    _add_para(doc, '{attorney_firm}', space_after=0)
    _add_para(doc, '{attorney_address}', space_after=12)
    _add_para(doc, 'Telephone {attorney_phone}', space_after=0)

    out_path = os.path.join(TEMPLATE_DIR, 'P1-0900.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# Shared helpers for P1 service / consent forms (Batch 1)
# ---------------------------------------------------------------------------

def _add_attorney_signature_block(doc):
    """Attorney-only signature block for P1 service / consent / notice forms.
    Signing date left blank (handwritten at signing per Phase 7b convention).
    """
    indent = Inches(0.5)
    _add_para(doc, 'Signed on this _____ day of ______________________, 20____.',
              first_indent=indent, space_after=24)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{attorney_name}, Attorney for {petitioner_label}', space_after=18)
    _add_para(doc, 'Email Addresses:', space_after=0)
    _add_para(doc, '{attorney_email}', space_after=0)
    _add_para(doc, '{#attorney_email_secondary}{attorney_email_secondary}{/attorney_email_secondary}', space_after=0)
    _add_para(doc, 'Florida Bar No. {attorney_bar_no}', space_after=12)
    _add_para(doc, '{attorney_firm}', space_after=0)
    _add_para(doc, '{attorney_address}', space_after=12)
    _add_para(doc, 'Telephone {attorney_phone}', space_after=0)


# ---------------------------------------------------------------------------
# P1-0400  Request for Notice and Copies
# ---------------------------------------------------------------------------

def build_p1_0400():
    """Florida Probate Rule 5.060 — request by an interested person for notice
    and copies of subsequent pleadings/documents in the estate.
    Signed by requestor + attorney; cert of service to PR's attorney.
    """
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'REQUEST FOR NOTICE AND COPIES',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    _add_para(doc, '{requestor_name}, alleges:', space_after=12)

    _pleading_para(doc, 'I have an interest in the above estate as {requestor_interest}.')
    _pleading_para(doc, 'My residence is {requestor_residence}.')
    _pleading_para(doc, 'My post office address is {requestor_mailing_address}.')
    _pleading_para(doc, 'The name and address of my attorney, if any, are set forth below.')
    _pleading_para(doc, 'A copy of this request is being served on the attorney for the personal representative.')

    indent = Inches(0.5)
    _add_para(doc,
        'I request that, as long as I am an interested person, notice of all '
        'further proceedings in this estate and copies of subsequent pleadings '
        'and documents be sent to:',
        first_indent=indent, space_after=6)
    _add_para(doc, '{service_address}', first_indent=indent, space_after=12)

    _add_para(doc,
        'Under penalties of perjury, I declare that I have read the foregoing, '
        'and the facts alleged are true, to the best of my knowledge and belief.',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Request for Notice and Copies')

    # Requestor signature, then attorney signature.
    _add_para(doc, 'Signed on this _____ day of ______________________, 20____.',
              first_indent=indent, space_after=24)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{requestor_name}, Requesting Party', space_after=24)

    _add_attorney_signature_block(doc)

    # Certificate of Service
    _add_para(doc, '', space_after=12)
    _add_para(doc, 'CERTIFICATE OF SERVICE',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=12)
    _add_para(doc,
        'I CERTIFY that a copy hereof has been furnished to {cos_recipients} '
        'by {cos_method} on _____ day of ______________________, 20____.',
        first_indent=indent, space_after=24)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{attorney_name}, Attorney', space_after=0)

    out_path = os.path.join(TEMPLATE_DIR, 'P1-0400.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P1-0500  Formal Notice
# ---------------------------------------------------------------------------

def build_p1_0500():
    """Florida Probate Rule 5.040(a) formal notice. Served by attorney with
    a copy of the underlying petition; recipient has 20 days to respond.
    """
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'FORMAL NOTICE',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    indent = Inches(0.5)
    _add_para(doc, 'TO:', space_after=6)
    _add_para(doc, '{notice_to}', first_indent=indent, space_after=18)

    _add_para(doc,
        'YOU ARE NOTIFIED that a {petition_being_noticed} has been filed in '
        'this court, a copy of which accompanies this notice. You are required '
        'to serve written defenses on the undersigned within 20 days after '
        'service of this notice, exclusive of the day of service, and to file '
        'the original of the written defenses with the clerk of the above court '
        'either before service or immediately thereafter. Failure to serve and '
        'file written defenses as required may result in a judgment or order '
        'for the relief demanded in the pleading or motion, without further '
        'notice.',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Formal Notice')

    _add_attorney_signature_block(doc)

    out_path = os.path.join(TEMPLATE_DIR, 'P1-0500.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P1-0510  Proof of Service of Formal Notice
# ---------------------------------------------------------------------------

def build_p1_0510():
    """Sworn proof that formal notice + underlying pleading were served per
    Florida Probate Rule 5.040(a). Signed by attorney."""
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'PROOF OF SERVICE OF FORMAL NOTICE',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    indent = Inches(0.5)
    _add_para(doc,
        'Under penalties of perjury, I swear or affirm that on {service_date}, '
        'a copy of {pleading_title} and a copy of the formal notice thereof '
        'filed in the above proceeding were mailed by United States registered '
        'or certified mail, return receipt requested, postage prepaid, or were '
        'delivered in a manner permitted by Florida Probate Rule 5.040(a), to:',
        first_indent=indent, space_after=12)

    _add_para(doc, '{service_recipients}', first_indent=indent, space_after=18)

    _add_para(doc,
        "Signed receipts or other evidence that service was made on each "
        "addressee or the addressee's agent are attached.",
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Proof of Service of Formal Notice')

    _add_attorney_signature_block(doc)

    out_path = os.path.join(TEMPLATE_DIR, 'P1-0510.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P1-0530  Notice of Hearing
# ---------------------------------------------------------------------------

def build_p1_0530():
    """Notice of Hearing per Florida Probate Rule 5.060 / 2.516.
    Signed by attorney; includes ADA accommodation language."""
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'NOTICE OF HEARING',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    indent = Inches(0.5)
    _add_para(doc, 'TO:', space_after=6)
    _add_para(doc, '{notice_to}', first_indent=indent, space_after=18)

    _add_para(doc,
        'YOU ARE HEREBY NOTIFIED that the undersigned will call up for hearing '
        "before the Honorable {judge_name}, judge of the above court, in the "
        "judge's chambers in the {county} County Courthouse, the address of "
        'which is {courthouse_address}, Florida, on {hearing_date}, at '
        '{hearing_time} o’clock {hearing_time_ampm}.M., or as soon thereafter '
        'as same may be heard, the {hearing_subject}.',
        first_indent=indent, space_after=12)

    _add_para(doc,
        'Time set aside by the court is {time_set_aside}.',
        first_indent=indent, space_after=18)

    _add_para(doc, 'PLEASE GOVERN YOURSELVES ACCORDINGLY.',
              first_indent=indent, space_after=18)

    _add_para(doc,
        'I CERTIFY that a copy hereof has been furnished to the above '
        'addressees by {cos_method} on _____ day of ______________________, '
        '20____.',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Notice of Hearing')

    _add_attorney_signature_block(doc)

    # ADA accommodation notice (FLSSI standard footer).
    _add_para(doc, '', space_after=12)
    _add_para(doc,
        'If you are a person with a disability who needs any accommodation in '
        'order to participate in this proceeding, you are entitled, at no cost '
        'to you, to the provision of certain assistance. Please contact '
        '{ada_contact} at least 7 days before your scheduled court appearance, '
        'or immediately upon receiving this notification if the time before '
        'the scheduled appearance is less than 7 days; if you are hearing or '
        'voice impaired, call 711.',
        space_after=0)

    out_path = os.path.join(TEMPLATE_DIR, 'P1-0530.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P1-CAVEAT  Smart caveat: consolidates FLSSI P1-0301/0305/0311/0315
#   Axes: caveator_type (creditor / interested_person)
#         caveator_is_nonresident (drives FL-attorney representation paragraph
#                                   + attorney signature block)
#   Pro se variants (P1-0300, P1-0310 with designated agent) are intentionally
#   out of scope — the firm always represents the caveator.
# ---------------------------------------------------------------------------

def build_p1_caveat():
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    # Title — branches on caveator_type
    _add_para(doc,
        '{#caveator_is_creditor}CAVEAT BY CREDITOR{/caveator_is_creditor}'
        '{#caveator_is_ip}CAVEAT BY INTERESTED PERSON{/caveator_is_ip}',
        align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    # Paragraph 1: caveator's interest + decedent ID block
    _pleading_para(doc,
        'The interest of the caveator is '
        '{#caveator_is_creditor}that of a creditor of {decedent_full_name}, '
        'deceased{/caveator_is_creditor}'
        '{#caveator_is_ip}{caveator_interest}, of {decedent_full_name}, '
        'deceased{/caveator_is_ip}, whose last known residence address is '
        '{decedent_last_residence}, the last four digits of whose social '
        'security number, if known, are {decedent_ssn_last4}, whose year of '
        'birth, if known, is {decedent_year_of_birth}, and who died on or '
        'about {decedent_death_date}.')

    # Paragraph 2: caveator's name + addresses
    _pleading_para(doc,
        "Caveator's name, mailing address, and residence address are: "
        '{caveator_name}; {caveator_mailing_address}; '
        '{caveator_residence_address}.')

    # Paragraph 3 (nonresident only): FL attorney representation
    _pleading_para(doc,
        '{#caveator_is_nonresident}Caveator, a non-resident of the State of '
        'Florida, is represented by an attorney admitted to practice in '
        'Florida.{/caveator_is_nonresident}'
        '{^caveator_is_nonresident}Caveator is a resident of the State of '
        'Florida.{/caveator_is_nonresident}')

    indent = Inches(0.5)

    # Request paragraph — branches on type AND residency
    _add_para(doc,
        '{#caveator_is_creditor}Caveator requests that the clerk notify the '
        "{#caveator_is_nonresident}caveator's attorney{/caveator_is_nonresident}"
        '{^caveator_is_nonresident}caveator{/caveator_is_nonresident} in '
        'writing of the date of issuance of letters of administration and of '
        'the names and addresses of the personal representative and the '
        "personal representative's attorney, and that caveator be given such "
        'additional notice as the Florida Probate Rules require.'
        '{/caveator_is_creditor}'
        '{#caveator_is_ip}Caveator requests that the court not admit a will '
        'of the decedent to probate or appoint a personal representative '
        'without formal notice '
        '{#caveator_is_nonresident}on caveator or his or her designated '
        'agent{/caveator_is_nonresident}'
        '{^caveator_is_nonresident}on caveator{/caveator_is_nonresident}, '
        'and that caveator be given such additional notice as the Florida '
        'Probate Rules require.{/caveator_is_ip}',
        first_indent=indent, space_after=18)

    _add_para(doc,
        'Under penalties of perjury, I declare that I have read the '
        'foregoing, and the facts alleged are true, to the best of my '
        'knowledge and belief.',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Caveat')

    # Caveator signature (always)
    _add_para(doc, 'Signed on this _____ day of ______________________, 20____.',
              first_indent=indent, space_after=24)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{caveator_name}, Caveator', space_after=24)

    # Attorney signature block — only when nonresident (firm represents
    # caveator as Florida attorney).
    _add_para(doc, '{#caveator_is_nonresident}', space_after=0)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{attorney_name}, Attorney for Caveator', space_after=18)
    _add_para(doc, 'Email Addresses:', space_after=0)
    _add_para(doc, '{attorney_email}', space_after=0)
    _add_para(doc, '{#attorney_email_secondary}{attorney_email_secondary}{/attorney_email_secondary}', space_after=0)
    _add_para(doc, 'Florida Bar No. {attorney_bar_no}', space_after=12)
    _add_para(doc, '{attorney_firm}', space_after=0)
    _add_para(doc, '{attorney_address}', space_after=12)
    _add_para(doc, 'Telephone {attorney_phone}', space_after=0)
    _add_para(doc, '{/caveator_is_nonresident}', space_after=0)

    out_path = os.path.join(TEMPLATE_DIR, 'P1-CAVEAT.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P2-PETITION  Smart Petition for Summary Administration
#   Consolidates 8 FLSSI variants (P2-0204/0205/0214/0215/0219/0220/0224/0225).
#   Axes: is_testate × is_ancillary × multiple_petitioners
#   Self-proved status is a property of the will/order, not the petition.
# ---------------------------------------------------------------------------

def build_p2_petition():
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'PETITION FOR SUMMARY ADMINISTRATION',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    _add_para(doc, '{petitioner_label}, {petitioner_names}, {petitioner_verb_alleges}:',
              space_after=12)

    # 1. Interest of petitioner(s)
    _pleading_para(doc,
        '{^multiple_petitioners}{#petitioners}Petitioner has an interest in the above '
        'estate as {pet_interest}. Petitioner’s address is set forth in paragraph 3 '
        'and the name and office address of petitioner’s attorney are set forth at '
        'the end of this petition.{/petitioners}{/multiple_petitioners}'
        '{#multiple_petitioners}Each petitioner has an interest in the above estate as '
        'set forth below: {#petitioners}{pet_name} is {pet_interest}. {/petitioners}'
        'Their addresses are set forth in paragraph 3 and the name and office address of '
        'their attorney are set forth at the end of this petition.{/multiple_petitioners}')

    # 2. Decedent
    _pleading_para(doc,
        'Decedent, {decedent_full_name}, whose last known address was {decedent_address}, '
        'and the last four digits of whose social security number are {decedent_ssn_last4}, '
        'died on {decedent_death_date}, at {decedent_death_place}, and on the date of death, '
        'decedent was domiciled in '
        '{^is_ancillary}{decedent_domicile} County, Florida{/is_ancillary}'
        '{#is_ancillary}{decedent_domicile_state}{/is_ancillary}.')

    # 3. Beneficiaries
    _pleading_para(doc,
        'So far as is known, the names of the beneficiaries of this estate and of '
        'decedent’s surviving spouse, if any, their addresses and relationships to '
        'decedent, and the years of birth of any who are minors, are:',
        keep_with_next=True)
    _beneficiaries_table(doc)

    # 4. Venue
    _pleading_para(doc,
        'Venue of this proceeding is in this county because {venue_reason}.')

    # 5. Will (testate only) — branches on FL res vs ancillary
    _pleading_para(doc,
        '{#is_testate}'
        '{^is_ancillary}The original of the decedent’s last will, dated {will_date}'
        '{#codicil_dates}, and codicil(s) dated {codicil_dates}{/codicil_dates}, '
        'is/are in the possession of the above court or accompany/accompanies this petition.'
        '{/is_ancillary}'
        '{#is_ancillary}An authenticated copy of the decedent’s last will, dated '
        '{will_date}{#codicil_dates}, and codicil(s) dated {codicil_dates}{/codicil_dates}, '
        'and an authenticated copy of so much of the domiciliary proceedings as is required '
        'by Florida Probate Rule 5.470 accompany this petition.{/is_ancillary}'
        '{/is_testate}'
        '{^is_testate}After the exercise of reasonable diligence, {petitioner_label} '
        '{petitioner_verb_is} unaware of any unrevoked wills or codicils of decedent.'
        '{/is_testate}')

    # 6. No other unrevoked wills (testate only)
    _pleading_para(doc,
        '{#is_testate}{petitioner_label} {petitioner_verb_is} unaware of any unrevoked '
        'will or codicil of decedent other than as set forth in paragraph 5.{/is_testate}')

    # 7. Qualifies for summary admin — render only the checked grounds
    _pleading_para(doc,
        '{petitioner_label} {petitioner_verb_is} entitled to summary administration because:'
        '{#qualifies_no_admin_required} Decedent’s will does not direct administration '
        'as required by Florida Statutes Chapter 733.{/qualifies_no_admin_required}'
        '{#qualifies_under_75k} To the best knowledge of the {#multiple_petitioners}'
        'petitioners{/multiple_petitioners}{^multiple_petitioners}petitioner'
        '{/multiple_petitioners}, the value of the entire estate subject to administration '
        'in this state, less the value of property exempt from the claims of creditors, '
        'does not exceed $75,000.{/qualifies_under_75k}'
        '{#qualifies_2_year_rule} The decedent has been dead for more than two years.'
        '{/qualifies_2_year_rule}')

    # 8. Domiciliary / principal probate proceedings
    _pleading_para(doc,
        '{#is_ancillary}Domiciliary proceedings are pending in {domiciliary_court_name}, '
        'the address of which is {domiciliary_court_address}, and letters have been issued '
        'to {domiciliary_representative}, whose address is '
        '{domiciliary_representative_address}.{/is_ancillary}'
        '{^is_ancillary}Domiciliary or principal probate proceedings '
        '{#domiciliary_proceedings_pending}are known to be pending in '
        '{domiciliary_court_name}, the address of which is {domiciliary_court_address}. '
        'Letters have been issued to {domiciliary_representative}, whose address is '
        '{domiciliary_representative_address}.{/domiciliary_proceedings_pending}'
        '{^domiciliary_proceedings_pending}are not known to be pending in another state '
        'or country.{/domiciliary_proceedings_pending}{/is_ancillary}')

    # 9. Assets
    _pleading_para(doc,
        'The following is a complete list of the assets in this estate and their estimated '
        'values, together with those assets claimed to be exempt:',
        keep_with_next=True)
    _estate_assets_table(doc)

    # 10. Creditors status — single-select, render only the chosen branch
    _pleading_para(doc,
        'With respect to claims of creditors:'
        '{#creditors_all_barred} All claims of creditors are barred.{/creditors_all_barred}'
        '{#creditors_no_debt} {petitioner_label} {petitioner_verb_has} made diligent search '
        'and reasonable inquiry for any known or reasonably ascertainable creditors and the '
        'estate is not indebted.{/creditors_no_debt}'
        '{#creditors_has_debt} {petitioner_label} {petitioner_verb_has} made diligent search '
        'and reasonable inquiry for any known or reasonably ascertainable creditors and the '
        'estate is indebted; provision for the payment of debts and the information required '
        'by Florida Statutes section 735.206 and Florida Probate Rule 5.530 are set forth on '
        'the attached schedule.{/creditors_has_debt}')

    # 11. Notice to creditors plan
    _pleading_para(doc,
        'All creditors ascertained to have claims and which have not joined in this '
        'petition or consented to entry of the order requested will be served by formal '
        'notice with a copy of this petition. {petitioner_label} '
        '{#multiple_petitioners}acknowledge{/multiple_petitioners}'
        '{^multiple_petitioners}acknowledges{/multiple_petitioners} that any known or '
        'reasonably ascertainable creditor who did not receive timely notice of this '
        'petition and for whom provision for payment was not made may enforce a timely '
        'claim and, if the creditor prevails, shall be awarded reasonable attorney’s '
        'fees as an element of costs against those who joined in the petition.')

    # 12. Distribution
    _pleading_para(doc,
        'It is proposed that all assets of the decedent, including exempt property, be '
        'distributed to the following:',
        keep_with_next=True)
    _distribution_table(doc)

    # Closing — unnumbered
    indent = Inches(0.5)
    _add_para(doc,
        '{petitioner_label} '
        '{#multiple_petitioners}waive{/multiple_petitioners}'
        '{^multiple_petitioners}waives{/multiple_petitioners} notice of hearing on this '
        'petition and '
        '{#multiple_petitioners}request{/multiple_petitioners}'
        '{^multiple_petitioners}requests{/multiple_petitioners} that '
        '{#is_testate}the decedent’s last will and codicil(s), if applicable, be '
        'admitted to probate and {/is_testate}'
        'an order of summary administration be entered directing distribution of the '
        'assets in the estate in accordance with the schedule set forth above.',
        first_indent=indent, space_before=12, space_after=12)

    _add_para(doc,
        'Under penalties of perjury, {petitioner_label} declare'
        '{^multiple_petitioners}s{/multiple_petitioners} that {petitioner_label} '
        '{petitioner_verb_has} read the foregoing, and the facts alleged are true, to the '
        'best of {petitioner_poss} knowledge and belief.',
        first_indent=indent, space_after=18)

    _add_broward_ai_certification(doc, 'Petition for Summary Administration')

    _add_probate_signature_block(doc)

    out_path = os.path.join(TEMPLATE_DIR, 'P2-PETITION.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P2-ORDER  Smart Order of Summary Administration
#   Testate path: combined Order Admitting Will to Probate AND of Summary
#                 Administration (per firm convention — David always uses
#                 the combined order for testate).
#   Intestate path: just Order of Summary Administration.
#
#   Replaces P2-0300/0310/0320/0322/0325 + P2-0500 (and the firm's intent
#   for testate-nonresident combined, which FLSSI does not provide directly).
#
#   Axes: is_testate × is_ancillary × is_self_proved (testate only)
#         × is_auth_copy_of_will (testate ancillary only)
# ---------------------------------------------------------------------------

def build_p2_order():
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    # Title — branches on testate × ancillary × auth-copy
    _add_para(doc,
        '{#is_testate}ORDER ADMITTING WILL'
        '{#is_ancillary} OF NONRESIDENT{/is_ancillary} TO PROBATE'
        '{/is_testate}'
        '{#is_testate} AND OF SUMMARY ADMINISTRATION{/is_testate}'
        '{^is_testate}ORDER OF SUMMARY ADMINISTRATION{/is_testate}',
        align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=0)

    _add_para(doc,
        '{#is_testate}{#is_self_proved}(self-proved){/is_self_proved}'
        '{#is_auth_copy_of_will}(authenticated copy of will){/is_auth_copy_of_will}'
        '{/is_testate}'
        '{^is_testate}{#is_ancillary}(nonresident decedent){/is_ancillary}{/is_testate}',
        align=WD_ALIGN_PARAGRAPH.CENTER, italic=True, space_after=18)

    indent = Inches(0.5)

    # Recital — branches heavily on testate / self-proved
    _add_para(doc,
        'On the petition of {petitioner_names} for summary administration of the estate of '
        '{decedent_full_name}, deceased, the court finding that the decedent died on '
        '{decedent_death_date}; that all interested persons have been served proper notice '
        'of the petition and hearing or have waived notice thereof; that the material '
        'allegations of the petition are true; '
        '{#is_testate}that the writing presented to this court as the last will of '
        '{decedent_full_name}, deceased, '
        '{#is_self_proved}having been executed in conformity with law and made self-proved '
        'at the time of its execution by the acknowledgement of the decedent and the '
        'affidavits of the witnesses, made before an officer authorized to administer '
        'oaths and evidenced by the officer’s certificate attached to or following '
        'the will in the form required by law, and{/is_self_proved}'
        '{^is_self_proved}having been established by the oath of {will_witnesses}, a '
        'subscribing and attesting witness, as being the last will of the decedent, and'
        '{/is_self_proved} no objection having been made to its probate; '
        '{/is_testate}'
        'and that the decedent’s estate qualifies for summary administration and an '
        'Order '
        '{#is_testate}Admitting Will to Probate and of Summary Administration{/is_testate}'
        '{^is_testate}of Summary Administration{/is_testate} should be entered, it is',
        first_indent=indent, space_after=12)

    _add_para(doc, 'ADJUDGED that:', bold=True, space_after=12)

    # Testate-only: numbered ¶1 admits the will to probate.
    # Wrapped in {#is_testate}...{/is_testate} marker paragraphs so the entire
    # numbered paragraph is dropped (and renumbered) in intestate mode.
    _add_para(doc, '{#is_testate}', space_after=0)
    _pleading_para(doc,
        'The will dated {will_date}'
        '{#codicil_dates}, together with codicil(s) dated {codicil_dates},{/codicil_dates}'
        ' attested by {will_witnesses} as subscribing and attesting witnesses, is admitted '
        'to probate according to law as the last will of the decedent.')
    _add_para(doc, '{/is_testate}', space_after=0)

    # Always: distribution preamble (numbered ¶2 in testate, ¶1 in intestate)
    _pleading_para(doc,
        'There be immediate distribution of the assets of the decedent as follows:',
        keep_with_next=True)
    _distribution_table(doc)

    _pleading_para(doc,
        'Those to whom specified assets of the decedent’s estate are distributed by '
        'this order have the right to receive and collect those assets and to maintain '
        'actions to enforce their rights.')

    _pleading_para(doc,
        'Debtors of the decedent, those holding property of the decedent, and those with '
        'whom securities or other property of decedent are registered, are authorized and '
        'directed to comply with this order by paying, delivering, or transferring to the '
        'beneficiaries specified above the parts of the decedent’s estate distributed '
        'to them by this order, and the persons so paying, delivering, or transferring '
        'shall not be accountable to anyone else for the property.')

    _add_para(doc, '', space_after=12)
    _add_para(doc, 'ORDERED on _____ day of ______________________, 20____.',
              space_after=36)

    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, 'Circuit Judge', space_after=18)

    out_path = os.path.join(TEMPLATE_DIR, 'P2-ORDER.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


# ---------------------------------------------------------------------------
# P2-0355  Notice to Creditors (summary administration)
# ---------------------------------------------------------------------------

def build_p2_0355():
    doc = Document()
    _apply_page_setup(doc)
    _apply_running_header(doc, 'Estate of {decedent_name}')
    _ensure_pleading_numbering(doc)

    _add_probate_caption(doc)

    _add_para(doc, 'NOTICE TO CREDITORS',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=0)
    _add_para(doc, '(summary administration)',
              align=WD_ALIGN_PARAGRAPH.CENTER, italic=True, space_after=18)

    _add_para(doc, 'TO ALL PERSONS HAVING CLAIMS OR DEMANDS AGAINST',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=0)
    _add_para(doc, 'THE ABOVE ESTATE:',
              align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, space_after=18)

    indent = Inches(0.5)
    _add_para(doc,
        'You are hereby notified that an Order of Summary Administration has been entered '
        'in the estate of {decedent_full_name}, deceased, File Number {file_no}, by the '
        'Circuit Court for {county} County, Florida, Probate Division, the address of '
        'which is {court_address}; that the decedent’s date of death was '
        '{decedent_death_date}; that the total value of the estate is {total_estate_value} '
        'and that the names and addresses of those to whom it has been assigned by such '
        'order are:',
        first_indent=indent, space_after=12)

    _distribution_table(doc)

    _add_para(doc, '', space_after=12)
    _add_para(doc, 'ALL INTERESTED PERSONS ARE NOTIFIED THAT:',
              bold=True, space_after=12)

    _add_para(doc,
        'All creditors of the estate of the decedent and persons having claims or demands '
        'against the estate of the decedent other than those for whom provision for full '
        'payment was made in the Order of Summary Administration must file their claims '
        'with this court WITHIN THE TIME PERIODS SET FORTH IN FLORIDA STATUTES SECTION '
        '733.702. ALL CLAIMS AND DEMANDS NOT SO FILED WILL BE FOREVER BARRED. '
        'NOTWITHSTANDING ANY OTHER APPLICABLE TIME PERIOD, ANY CLAIM FILED TWO (2) YEARS '
        'OR MORE AFTER THE DECEDENT’S DATE OF DEATH IS BARRED.',
        first_indent=indent, space_after=18)

    _add_para(doc,
        'The date of first publication of this Notice is _____ day of '
        '______________________, 20____.',
        first_indent=indent, space_after=24)

    _add_broward_ai_certification(doc, 'Notice to Creditors (Summary Administration)')

    # Signature: attorney + petitioner (Person Giving Notice).
    _add_para(doc, 'Signed on this _____ day of ______________________, 20____.',
              first_indent=indent, space_after=24)
    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{petitioner_name}, Person Giving Notice', space_after=24)

    _add_para(doc, '_______________________________________', space_after=0)
    _add_para(doc, '{attorney_name}, Attorney for {petitioner_label}', space_after=18)
    _add_para(doc, 'Email Addresses:', space_after=0)
    _add_para(doc, '{attorney_email}', space_after=0)
    _add_para(doc, '{#attorney_email_secondary}{attorney_email_secondary}{/attorney_email_secondary}', space_after=0)
    _add_para(doc, 'Florida Bar No. {attorney_bar_no}', space_after=12)
    _add_para(doc, '{attorney_firm}', space_after=0)
    _add_para(doc, '{attorney_address}', space_after=12)
    _add_para(doc, 'Telephone {attorney_phone}', space_after=0)

    out_path = os.path.join(TEMPLATE_DIR, 'P2-0355.docx')
    doc.save(out_path)
    _inject_numbering_part(out_path)
    print(f'Wrote {out_path}')


if __name__ == '__main__':
    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    build_p3_petition()
    build_p3_oath()
    build_p3_order()
    build_p3_letters()
    build_p1_0900()
    build_p1_0400()
    build_p1_0500()
    build_p1_0510()
    build_p1_0530()
    build_p1_caveat()
    build_p2_petition()
    build_p2_order()
    build_p2_0355()
