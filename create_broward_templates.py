#!/usr/bin/env python3
"""
Create Broward County local form .docx templates with {tags}
for use with docxtemplater in the GS Court Forms app.
"""

from docx import Document
from docx.shared import Pt, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import os

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), 'templates')


def set_run_font(run, size=10, bold=False, font_name='Arial'):
    run.font.size = Pt(size)
    run.font.name = font_name
    run.bold = bold


def add_styled_paragraph(doc, text, size=10, bold=False, alignment=None, space_after=None, space_before=None):
    p = doc.add_paragraph()
    if alignment:
        p.alignment = alignment
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold)
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    if space_before is not None:
        p.paragraph_format.space_before = Pt(space_before)
    return p


def create_criminal_history_affidavit():
    """
    BW-0010: Affidavit Regarding Criminal History
    Required for ALL Personal Representatives and Petitioners in ALL
    testate and intestate cases, formal and summary administrations.
    """
    doc = Document()

    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Arial'
    font.size = Pt(10)

    # Narrow margins
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1.25)

    # Header
    add_styled_paragraph(doc,
        'IN THE SEVENTEENTH JUDICIAL CIRCUIT, IN AND FOR',
        size=11, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    add_styled_paragraph(doc,
        'BROWARD COUNTY, FLORIDA',
        size=11, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    # Case caption - two columns
    p = doc.add_paragraph()
    run = p.add_run('In Re: Estate of {decedent_name}')
    set_run_font(run, size=10)
    p.paragraph_format.space_after = Pt(0)

    p = doc.add_paragraph()
    run = p.add_run('Case No.: {file_no}')
    set_run_font(run, size=10)
    p.paragraph_format.space_after = Pt(0)

    p = doc.add_paragraph()
    run = p.add_run('Division: {division}')
    set_run_font(run, size=10)
    p.paragraph_format.space_after = Pt(12)

    # Title
    add_styled_paragraph(doc,
        'AFFIDAVIT CONCERNING CRIMINAL HISTORY',
        size=11, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    # Instruction
    add_styled_paragraph(doc,
        'This affidavit must be filed by all Personal Representatives and Petitioners in all testate and intestate cases, formal and summary administrations.',
        size=10, space_after=12)

    # Affiant statement
    add_styled_paragraph(doc,
        'I, {affiant_name}, swear or affirm:',
        size=10, space_after=12)

    # Checkbox 1 - no felony
    add_styled_paragraph(doc,
        '{no_felony_check}  I certify that I have not been convicted of a felony.',
        size=10, space_after=6)
    p = doc.add_paragraph()
    run = p.add_run('(initial)')
    set_run_font(run, size=8)
    p.paragraph_format.space_after = Pt(12)

    # Checkbox 2 - felony
    add_styled_paragraph(doc,
        '{has_felony_check}  I certify that I have been convicted of a felony. List offense, date of conviction, court and case number, state and county of the court, regardless of whether adjudication was entered or withheld.',
        size=10, space_after=12)

    # Felony detail fields
    add_styled_paragraph(doc, 'Offense(s): {felony_offenses}', size=10, space_after=6)
    add_styled_paragraph(doc, 'Date(s) of conviction: {felony_dates}', size=10, space_after=6)
    add_styled_paragraph(doc, 'Court & case number: {felony_court_case}', size=10, space_after=6)
    add_styled_paragraph(doc, 'State & County of the court: {felony_state_county}', size=10, space_after=18)

    # Perjury statement
    add_styled_paragraph(doc,
        'UNDER PENALTY OF PERJURY, I SWEAR OR AFFIRM THAT I HAVE READ THE FOREGOING AFFIDAVIT CONCERNING CRIMINAL HISTORY AND THE FACTS STATED HEREIN ARE TRUE AND COMPLETE TO THE BEST OF MY KNOWLEDGE.',
        size=10, bold=True, space_after=24)

    # Signature block
    add_styled_paragraph(doc, '______________________________', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    add_styled_paragraph(doc, "Affiant's signature", size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=12)

    add_styled_paragraph(doc, '______________________________', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    add_styled_paragraph(doc, '______________________________', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    add_styled_paragraph(doc, 'Print name and address of Affiant', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=18)

    # Notary block
    p = doc.add_paragraph()
    run = p.add_run('State of {notary_state}')
    set_run_font(run, size=10)
    p.paragraph_format.space_after = Pt(0)

    p = doc.add_paragraph()
    run = p.add_run('County of {notary_county}')
    set_run_font(run, size=10)
    p.paragraph_format.space_after = Pt(12)

    add_styled_paragraph(doc,
        'Sworn to (or affirmed) and subscribed before me by means of {notary_means} physical presence or ____ online notarization, this {notary_day} day of {notary_month}, 20{notary_year_short}, by {affiant_name}.',
        size=10, space_after=18)

    add_styled_paragraph(doc, '______________________________', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    add_styled_paragraph(doc, 'Notary Public or Deputy Clerk', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=12)

    add_styled_paragraph(doc, '{notary_personally_known_check} Personally known', size=10, space_after=6)
    add_styled_paragraph(doc, '{notary_produced_id_check} Produced identification', size=10, space_after=12)

    add_styled_paragraph(doc, '______________________________', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    add_styled_paragraph(doc, 'Print, Type, or Stamp Commissioned', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    add_styled_paragraph(doc, 'Name of Notary Public or Deputy Clerk', size=10,
        alignment=WD_ALIGN_PARAGRAPH.RIGHT, space_after=12)

    add_styled_paragraph(doc, 'Type of identification: {notary_identification}', size=10, space_after=0)

    # Save
    path = os.path.join(TEMPLATE_DIR, 'BW-0010.docx')
    doc.save(path)
    print(f'Created: {path}')
    return path


def create_mandatory_checklist_testate():
    """
    BW-0020: Mandatory Checklist for Formal Administration of Testate Estate
    Must be e-filed WITH the petition. Clerk will NOT forward without it.
    """
    doc = Document()

    style = doc.styles['Normal']
    font = style.font
    font.name = 'Arial'
    font.size = Pt(9)

    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Header
    add_styled_paragraph(doc,
        'IN THE CIRCUIT COURT OF THE SEVENTEENTH JUDICIAL CIRCUIT,',
        size=10, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    add_styled_paragraph(doc,
        'IN AND FOR BROWARD COUNTY, FLORIDA',
        size=10, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    add_styled_paragraph(doc,
        'PROBATE DIVISION',
        size=10, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    # Title
    add_styled_paragraph(doc,
        'CHECKLIST FOR PETITION FOR FORMAL ADMINISTRATION OF TESTATE ESTATE',
        size=10, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    # Instructions
    add_styled_paragraph(doc,
        'This Checklist must be completed and e-filed with your Petition. Review and sign the applicable certification clause at the end of the checklist prior to submitting it with your Petition. If any of the items below are not checked, please complete "Certification B." Completing and e-filing this Checklist does not obviate any additional obligations imposed by rule or statute.',
        size=9, bold=True, space_after=12)

    # Hearing section
    add_styled_paragraph(doc, 'HEARING:', size=9, bold=True, space_after=6)

    add_styled_paragraph(doc,
        '{hearing_exparte_check}  At the time of filing this Petition, I intend to pursue this Petition on ex-parte, motion, or special set calendar.',
        size=9, space_after=3)
    add_styled_paragraph(doc, 'OR', size=9, bold=True, space_after=3)
    add_styled_paragraph(doc,
        '{hearing_no_hearing_check}  At the time of filing this Petition, I intend to have this Petition submitted to the Judge without a hearing.',
        size=9, space_after=12)

    # Case info
    p = doc.add_paragraph()
    run = p.add_run('CASE NUMBER: PRC-{file_no}          In Re Estate of: {decedent_name}')
    set_run_font(run, size=9)
    p.paragraph_format.space_after = Pt(12)

    # Checklist items
    items = [
        ('cl_death_cert_check', 'A death certificate was filed.'),
        ('cl_criminal_history_check', 'The Petitioner filed an Affidavit Regarding Criminal History (form available on the Seventeenth Judicial Circuit\'s Webpage).'),
        ('cl_residence_check', 'If the decedent was a Florida resident, the death certificate reflects a Broward County residence. If the decedent was not a Florida resident, the decedent owned property in Broward County, and the situs of the property is reflected in the Petition for Administration.'),
        ('cl_petition_verified_check', 'The Petition is verified, signed by the Petitioner, and signed by an attorney of record.'),
        ('cl_interest_address_check', "The Petitioner's interest in estate and the Petitioner's address are listed in the Petition."),
        ('cl_will_filed_check', 'A copy of the original will or codicil was e-filed and the original will / codicil was deposited with the Broward County Clerk of Court;'),
    ]

    for tag, text in items:
        add_styled_paragraph(doc, f'{{{tag}}}  {text}', size=9, space_after=6)

    add_styled_paragraph(doc, 'OR', size=9, bold=True, space_after=3)
    add_styled_paragraph(doc,
        '{cl_lost_will_check}  The original will / codicil cannot be located, a Petition to Establish a Lost or Destroyed Will / Codicil was filed, and those who would take but for the will / codicil have consented to the Petition to Establish a Lost or Destroyed Will / Codicil.',
        size=9, space_after=12)

    items2 = [
        ('cl_self_proved_check', 'The decedent was a Florida resident and the will / codicil is self-proven under the laws of Florida. If the will / codicil is not self-proven, an oath of witness was executed in front of a Clerk of the Court, Commissioner, or Judge and the oath was filed with the Petition. (NOTE: a notary stamp is insufficient.)'),
        ('cl_petitioner_qualified_check', 'The Petitioner is not a convicted felon and the Petitioner is a Florida resident. If the Petitioner is not a Florida Resident, the Petitioner is related to the decedent within the statutorily required degree.'),
        ('cl_beneficiaries_check', 'The correct beneficiaries are listed in the Petition with the birthdates of the minor beneficiaries, if any.'),
        ('cl_assets_check', 'The assets of the estate and the approximate values of the assets are listed in the Petition.'),
        ('cl_preference_check', 'The proposed personal representative has preference of appointment for testate estates. If the Petitioner is not the first personal representative nominated in the will, the Petitioner has filed the necessary renunciations or death certificates that sufficiently demonstrate the proposed personal representative\'s preference of appointment.'),
        ('cl_oath_filed_check', 'An oath of personal representative and designation of resident agent were filed, and they comply with the applicable probate rules.'),
        ('cl_order_filed_check', 'A proposed order admitting will to probate and appointing personal representative was filed, and the signature page contains at least four (4) lines of text and has the case number on it.'),
        ('cl_letters_filed_check', 'Proposed letters of administration were filed and the signature page contains at least four (4) lines of text and has the case number on it.'),
        ('cl_no_trust_check', 'A trust is not a beneficiary of the decedent.'),
    ]

    for tag, text in items2:
        add_styled_paragraph(doc, f'{{{tag}}}  {text}', size=9, space_after=6)

    add_styled_paragraph(doc, 'OR', size=9, bold=True, space_after=3)
    add_styled_paragraph(doc,
        '{cl_trust_beneficiary_check}  If a trust of the decedent is a beneficiary of the will offered for probate: A disclosure of qualified trust beneficiaries is contained in the Petition or in a separate notice.',
        size=9, space_after=18)

    # Certification A
    add_styled_paragraph(doc,
        'Please complete the Certification that applies to your filing (either Certification A or Certification B). If Petitioner is represented by counsel, only counsel must complete the applicable Certification Clause. If Petitioner is pro se then the applicable Certification must be completed by Petitioner.',
        size=9, bold=True, space_after=12)

    add_styled_paragraph(doc, 'CERTIFICATION A:', size=9, bold=True, space_after=6)
    add_styled_paragraph(doc,
        'The undersigned Petitioner {petitioner_name} / Attorney {attorney_name} certifies that he/she has reviewed the information necessary to support the Petition for Administration. The Petitioner / Attorney further certifies that all the required information was previously filed or filed concurrently with the Petition. The Petitioner / Attorney acknowledges that the Petition will not be reviewed by Court staff and a proposed order will be submitted directly to the Judge for review.',
        size=9, space_after=12)

    # Signature
    add_styled_paragraph(doc, '______________________________', size=9, space_after=0)
    p = doc.add_paragraph()
    run = p.add_run('{attorney_name}\nFlorida Bar No. {attorney_bar_no}\n{attorney_address}\nTelephone: {attorney_phone}\nEmail: {attorney_email}')
    set_run_font(run, size=9)
    p.paragraph_format.space_after = Pt(18)

    add_styled_paragraph(doc, 'CERTIFICATION B:', size=9, bold=True, space_after=6)
    add_styled_paragraph(doc,
        'The undersigned Petitioner {petitioner_name} / Attorney {attorney_name} certifies that he/she has reviewed the information necessary to support the Petition for Administration. Not all of the required information has been filed or is being filed concurrently with the Petition. The following information has not been filed (list all items not checked above):',
        size=9, space_after=6)
    add_styled_paragraph(doc, '{cert_b_missing_items}', size=9, space_after=12)

    add_styled_paragraph(doc, '______________________________', size=9, space_after=0)
    p = doc.add_paragraph()
    run = p.add_run('{attorney_name}\nFlorida Bar No. {attorney_bar_no}\n{attorney_address}\nTelephone: {attorney_phone}\nEmail: {attorney_email}')
    set_run_font(run, size=9)

    # Save
    path = os.path.join(TEMPLATE_DIR, 'BW-0020.docx')
    doc.save(path)
    print(f'Created: {path}')
    return path


if __name__ == '__main__':
    create_criminal_history_affidavit()
    create_mandatory_checklist_testate()
    print('\nDone. Templates created in templates/ directory.')
