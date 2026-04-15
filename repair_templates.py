#!/usr/bin/env python3
"""
repair_templates.py — Repairs G3-010.docx and G3-026.docx in-place.

Reads raw XML from each docx via zipfile, applies targeted string replacements
to insert docxtemplater tags, then rewrites the docx. No dependencies beyond
Python 3 stdlib (zipfile, shutil, os, re).

Run from project root:
    python3 repair_templates.py

The script overwrites the source files in templates/.
"""

import zipfile
import shutil
import os
import re
import tempfile


TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')

# ---------------------------------------------------------------------------
# Shared XML helpers
# ---------------------------------------------------------------------------

ARIAL_RPR = (
    '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
    '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
)
ARIAL_RPR_U = (
    '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
    '<w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr>'
)


def text_run(text, underline=False):
    """Build a <w:r> with text content. No f-string escaping issues."""
    rpr = ARIAL_RPR_U if underline else ARIAL_RPR
    return '<w:r>' + rpr + '<w:t xml:space="preserve">' + text + '</w:t></w:r>'


def tab_run():
    """Build a <w:r> containing just a tab."""
    return '<w:r>' + ARIAL_RPR + '<w:tab/></w:r>'


def make_nok_loop_para(tabs_xml, spacing, sectpr=''):
    """Build a single paragraph containing the NOK repeating-group loop."""
    ppr = (
        '<w:pPr><w:widowControl/><w:tabs>' + tabs_xml + '</w:tabs>'
        '<w:spacing w:line="' + spacing + '" w:lineRule="auto"/>'
        '<w:jc w:val="both"/>'
        '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
        + sectpr +
        '</w:pPr>'
    )
    body = (
        text_run('{#next_of_kin}{name}') +
        tab_run() +
        text_run('{address}') +
        tab_run() +
        text_run('{relationship}{/next_of_kin}')
    )
    return '<w:p>' + ppr + body + '</w:p>'


NOK_HEADER_TABS = (
    '<w:tab w:val="left" w:pos="-1440"/><w:tab w:val="left" w:pos="-720"/>'
    '<w:tab w:val="left" w:pos="0"/><w:tab w:val="left" w:pos="720"/>'
    '<w:tab w:val="left" w:pos="1440"/><w:tab w:val="left" w:pos="2160"/>'
    '<w:tab w:val="left" w:pos="2880"/><w:tab w:val="right" w:pos="9360"/>'
)


def patch_docx(docx_path, replacements):
    """
    Apply a list of (old_str, new_str, label) replacements to word/document.xml
    inside the given .docx, overwriting the file in-place.
    Returns a report dict: {label: True/False}.
    """
    report = {}
    abs_path = os.path.join(TEMPLATES_DIR, docx_path)

    with zipfile.ZipFile(abs_path, 'r') as zin:
        xml = zin.read('word/document.xml').decode('utf-8')
        other_files = {}
        for item in zin.infolist():
            if item.filename != 'word/document.xml':
                other_files[item.filename] = zin.read(item.filename)

    for old_str, new_str, label in replacements:
        if old_str in xml:
            xml = xml.replace(old_str, new_str, 1)
            report[label] = True
        else:
            report[label] = False

    # Write back
    fd, tmp_path = tempfile.mkstemp(suffix='.docx')
    os.close(fd)
    with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        zout.writestr('word/document.xml', xml.encode('utf-8'))
        for fname, data in other_files.items():
            zout.writestr(fname, data)

    shutil.move(tmp_path, abs_path)
    return report


# ===========================================================================
# Standard 11-tab pPr block (used by most body paragraphs in both templates)
# ===========================================================================

TABS_11 = (
    '<w:tab w:val="left" w:pos="-1440"/><w:tab w:val="left" w:pos="-720"/>'
    '<w:tab w:val="left" w:pos="0"/><w:tab w:val="left" w:pos="720"/>'
    '<w:tab w:val="left" w:pos="1440"/><w:tab w:val="left" w:pos="2160"/>'
    '<w:tab w:val="left" w:pos="2880"/><w:tab w:val="left" w:pos="3600"/>'
    '<w:tab w:val="left" w:pos="4320"/><w:tab w:val="left" w:pos="5040"/>'
    '<w:tab w:val="left" w:pos="5760"/>'
)


# ===========================================================================
# G3-010 repairs
# ===========================================================================

def repair_g3_010():
    print('=' * 60)
    print('Repairing G3-010.docx (Emergency Temp Guardian)')
    print('=' * 60)

    replacements = []

    # -----------------------------------------------------------------------
    # 1. Para 2 — underlined spaces + ", an alleged..." → {aip_name}
    # -----------------------------------------------------------------------
    old_para2 = (
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr>'
        '<w:t xml:space="preserve">'
        '                                                                                                 '
        '</w:t></w:r>'
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
        '<w:t>,\xa0an alleged incapacitated person, but a guardian has not been appointed.</w:t></w:r>'
    )
    new_para2 = (
        text_run('{aip_name}', underline=True) +
        text_run(', an alleged incapacitated person, but a guardian has not been appointed.')
    )
    replacements.append((old_para2, new_para2, 'aip_name (para 2)'))

    # -----------------------------------------------------------------------
    # 2. Para 4 — imminent_danger_reason (blank para 2B26DC03 with sectPr)
    #    Insert text run while preserving sectPr.
    # -----------------------------------------------------------------------
    old_imminent = (
        '<w:p w14:paraId="2B26DC03" w14:textId="77777777" '
        'w:rsidR="003D5A60" w:rsidRPr="00C04C5E" w:rsidRDefault="003D5A60">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:spacing w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/>'
        '<w:jc w:val="both"/>' + ARIAL_RPR +
        '<w:sectPr w:rsidR="003D5A60" w:rsidRPr="00C04C5E">'
        '<w:footerReference w:type="default" r:id="rId6"/>'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="360" w:left="1440" '
        'w:header="1440" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:noEndnote/></w:sectPr></w:pPr></w:p>'
    )
    new_imminent = (
        '<w:p w14:paraId="2B26DC03" w14:textId="77777777" '
        'w:rsidR="003D5A60" w:rsidRPr="00C04C5E" w:rsidRDefault="003D5A60">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:spacing w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/>'
        '<w:jc w:val="both"/>' + ARIAL_RPR +
        '<w:sectPr w:rsidR="003D5A60" w:rsidRPr="00C04C5E">'
        '<w:footerReference w:type="default" r:id="rId6"/>'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="360" w:left="1440" '
        'w:header="1440" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:noEndnote/></w:sectPr></w:pPr>' +
        text_run('{imminent_danger_reason}') +
        '</w:p>'
    )
    replacements.append((old_imminent, new_imminent, 'imminent_danger_reason (para 4)'))

    # -----------------------------------------------------------------------
    # 3. Para 10 — appointment_reason: 3 blank paras → 1 tagged para
    #    3rd blank has sectPr; preserve it.
    # -----------------------------------------------------------------------
    blank1_appt = (
        '<w:p w14:paraId="1CA803FF" w14:textId="77777777" '
        'w:rsidR="003D5A60" w:rsidRDefault="003D5A60">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:jc w:val="both"/>' + ARIAL_RPR + '</w:pPr></w:p>'
    )
    blank2_appt = (
        '<w:p w14:paraId="74ADFDD0" w14:textId="77777777" '
        'w:rsidR="0015477F" w:rsidRDefault="0015477F">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:jc w:val="both"/>' + ARIAL_RPR + '</w:pPr></w:p>'
    )
    blank3_appt = (
        '<w:p w14:paraId="51EF0CE6" w14:textId="77777777" '
        'w:rsidR="00C04C5E" w:rsidRPr="00C04C5E" w:rsidRDefault="00C04C5E">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:jc w:val="both"/>' + ARIAL_RPR +
        '<w:sectPr w:rsidR="00C04C5E" w:rsidRPr="00C04C5E">'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="360" w:left="1440" '
        'w:header="1440" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:noEndnote/></w:sectPr></w:pPr></w:p>'
    )
    old_appt = blank1_appt + blank2_appt + blank3_appt
    new_appt = (
        '<w:p w14:paraId="1CA803FF" w14:textId="77777777" '
        'w:rsidR="003D5A60" w:rsidRDefault="003D5A60">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:jc w:val="both"/>' + ARIAL_RPR +
        '<w:sectPr w:rsidR="00C04C5E" w:rsidRPr="00C04C5E">'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="360" w:left="1440" '
        'w:header="1440" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:noEndnote/></w:sectPr></w:pPr>' +
        text_run('{appointment_reason}') +
        '</w:p>'
    )
    replacements.append((old_appt, new_appt, 'appointment_reason (para 10)'))

    # -----------------------------------------------------------------------
    # 4. Para 11 — property_nature_value: 2 blank paras → 1 tagged para
    # -----------------------------------------------------------------------
    blank1_prop = (
        '<w:p w14:paraId="443B203F" w14:textId="77777777" '
        'w:rsidR="00A011E7" w:rsidRPr="00C04C5E" w:rsidRDefault="00A011E7">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:ind w:firstLine="720"/><w:jc w:val="both"/>'
        + ARIAL_RPR + '</w:pPr></w:p>'
    )
    blank2_prop = (
        '<w:p w14:paraId="2B50DE24" w14:textId="77777777" '
        'w:rsidR="00A011E7" w:rsidRDefault="00A011E7" w:rsidP="00A011E7">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:spacing w:line="480" w:lineRule="auto"/><w:jc w:val="both"/>'
        + ARIAL_RPR + '</w:pPr></w:p>'
    )
    old_prop = blank1_prop + blank2_prop
    new_prop = (
        '<w:p w14:paraId="443B203F" w14:textId="77777777" '
        'w:rsidR="00A011E7" w:rsidRPr="00C04C5E" w:rsidRDefault="00A011E7">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:ind w:firstLine="720"/><w:jc w:val="both"/>'
        + ARIAL_RPR + '</w:pPr>' +
        text_run('{property_nature_value}') +
        '</w:p>'
    )
    replacements.append((old_prop, new_prop, 'property_nature_value (para 11)'))

    # -----------------------------------------------------------------------
    # 5. NOK section — replace 5 blank data lines with loop paragraph.
    #    Each blank has different rsid attributes (must match exactly).
    # -----------------------------------------------------------------------

    # Each blank line's exact opening tag attributes
    blank_attrs = [
        ('58F4CEB6', 'w:rsidR="003D5A60" w:rsidRPr="00C04C5E" w:rsidRDefault="003D5A60"'),
        ('42AAF73B', 'w:rsidR="003D5A60" w:rsidRDefault="003D5A60"'),
        ('33DB677A', 'w:rsidR="00C04C5E" w:rsidRDefault="00C04C5E"'),
        ('031D9362', 'w:rsidR="00C04C5E" w:rsidRDefault="00C04C5E"'),
        ('20ABC4D6', 'w:rsidR="00C04C5E" w:rsidRPr="00C04C5E" w:rsidRDefault="00C04C5E"'),
    ]
    old_nok_blanks = ''
    for pid, attrs in blank_attrs:
        old_nok_blanks += (
            '<w:p w14:paraId="' + pid + '" w14:textId="77777777" ' + attrs + '>'
            '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
            '<w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="both"/>'
            + ARIAL_RPR + '</w:pPr></w:p>'
        )

    new_nok = make_nok_loop_para(NOK_HEADER_TABS, '360')
    replacements.append((old_nok_blanks, new_nok, 'next_of_kin loop (para 7)'))

    # -----------------------------------------------------------------------
    # 6. Attorney email — replace underline run (paraId 1048EFE1)
    # -----------------------------------------------------------------------
    old_email = (
        '<w:r>' + ARIAL_RPR_U +
        '<w:t>_</w:t><w:tab/>'
        '<w:t xml:space="preserve">                                   </w:t></w:r>'
    )
    new_email = text_run('{attorney_email}')
    replacements.append((old_email, new_email, 'attorney_email'))

    # -----------------------------------------------------------------------
    # 7. Attorney phone — replace "Telephone: [underline]"
    # -----------------------------------------------------------------------
    old_phone = (
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve">Telephone:  </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U +
        '<w:tab/><w:t xml:space="preserve">                            </w:t></w:r>'
    )
    new_phone = text_run('Telephone:  {attorney_phone}')
    replacements.append((old_phone, new_phone, 'attorney_phone'))

    report = patch_docx('G3-010.docx', replacements)
    print_report(report)
    return report


# ===========================================================================
# G3-026 repairs
# ===========================================================================

def repair_g3_026():
    print()
    print('=' * 60)
    print('Repairing G3-026.docx (Limited Guardian Person & Property)')
    print('=' * 60)

    replacements = []

    # -----------------------------------------------------------------------
    # 1. County — underlined spaces between "FOR " and " COUNTY"
    # -----------------------------------------------------------------------
    old_county = (
        '<w:r>' + ARIAL_RPR_U +
        '<w:t xml:space="preserve">'
        '                                '
        '</w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve"> COUNTY, FLORIDA</w:t></w:r>'
    )
    new_county = (
        text_run('{county}', underline=True) +
        text_run(' COUNTY, FLORIDA')
    )
    replacements.append((old_county, new_county, 'county'))

    # -----------------------------------------------------------------------
    # 2. File No — underlined tab after "File No. "
    # -----------------------------------------------------------------------
    old_fileno = (
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve">File No. </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U + '<w:tab/></w:r>'
    )
    new_fileno = text_run('File No. {file_no}')
    replacements.append((old_fileno, new_fileno, 'file_no'))

    # -----------------------------------------------------------------------
    # 3. Petitioner name — underlined spaces between "Petitioner, " and ",alleges:"
    # -----------------------------------------------------------------------
    old_pet_name = (
        '<w:r>' + ARIAL_RPR_U +
        '<w:t xml:space="preserve">'
        '                                                                                                                                '
        '</w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t>,alleges:</w:t></w:r>'
    )
    new_pet_name = (
        text_run('{petitioner_name}', underline=True) +
        text_run(',alleges:')
    )
    replacements.append((old_pet_name, new_pet_name, 'petitioner_name'))

    # -----------------------------------------------------------------------
    # 4. Petitioner address — after "and petitioner\u2019s post office address is "
    #    Smart apostrophe U+2019
    # -----------------------------------------------------------------------
    old_pet_addr = (
        '<w:t xml:space="preserve"> and petitioner\u2019s post office address is </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U +
        '<w:tab/><w:tab/><w:tab/><w:tab/>'
        '<w:t xml:space="preserve">          </w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t>.</w:t></w:r>'
    )
    new_pet_addr = (
        '<w:t xml:space="preserve"> and petitioner\u2019s post office address is </w:t></w:r>' +
        text_run('{petitioner_address}', underline=True) +
        text_run('.')
    )
    replacements.append((old_pet_addr, new_pet_addr, 'petitioner_address'))

    # -----------------------------------------------------------------------
    # 5. AIP age — underlined spaces in "who is [blank] years of age"
    # -----------------------------------------------------------------------
    old_aip_age = (
        '<w:t xml:space="preserve">is an alleged incapacitated person who is </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U +
        '<w:t xml:space="preserve">                              </w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve"> years of age.  The residence of the Ward is  </w:t></w:r>'
    )
    new_aip_age = (
        '<w:t xml:space="preserve">is an alleged incapacitated person who is </w:t></w:r>' +
        text_run('{aip_age}', underline=True) +
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve"> years of age.  The residence of the Ward is  </w:t></w:r>'
    )
    replacements.append((old_aip_age, new_aip_age, 'aip_age'))

    # -----------------------------------------------------------------------
    # 6. AIP residence — 13 tabs + spaces underlined run
    # -----------------------------------------------------------------------
    old_aip_res = (
        '<w:r>' + ARIAL_RPR_U +
        '<w:tab/><w:tab/><w:tab/><w:tab/><w:tab/><w:tab/><w:tab/><w:tab/>'
        '<w:tab/><w:tab/><w:tab/><w:tab/><w:tab/>'
        '<w:t xml:space="preserve"> </w:t><w:tab/>'
        '<w:t xml:space="preserve">      </w:t><w:tab/>'
        '<w:t xml:space="preserve"> </w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve">, and the post office address of the Ward is </w:t></w:r>'
    )
    new_aip_res = (
        text_run('{aip_residence}', underline=True) +
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve">, and the post office address of the Ward is </w:t></w:r>'
    )
    replacements.append((old_aip_res, new_aip_res, 'aip_residence'))

    # -----------------------------------------------------------------------
    # 7. AIP address — 11 tabs + spaces underlined run before "."
    # -----------------------------------------------------------------------
    old_aip_addr = (
        '<w:r>' + ARIAL_RPR_U +
        '<w:tab/><w:tab/><w:tab/><w:tab/><w:tab/><w:tab/><w:tab/><w:tab/>'
        '<w:tab/><w:tab/><w:tab/>'
        '<w:t xml:space="preserve">   </w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t>.</w:t></w:r>'
    )
    new_aip_addr = (
        text_run('{aip_address}', underline=True) +
        text_run('.')
    )
    replacements.append((old_aip_addr, new_aip_addr, 'aip_address'))

    # -----------------------------------------------------------------------
    # 8. NOK section — replace spacer + header + 9 blank lines (last w/ sectPr)
    #    Keep header; replace blanks with loop para carrying the sectPr.
    # -----------------------------------------------------------------------
    spacer_763 = (
        '<w:p w14:paraId="76358E95" w14:textId="77777777" '
        'w:rsidR="00DF7BB2" w:rsidRDefault="00DF7BB2">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:jc w:val="both"/>' + ARIAL_RPR + '</w:pPr></w:p>'
    )

    header_7fab = (
        '<w:p w14:paraId="7FABD19A" w14:textId="77777777" '
        'w:rsidR="00DF7BB2" w:rsidRDefault="00DF7BB2">'
        '<w:pPr><w:widowControl/><w:tabs>' + NOK_HEADER_TABS + '</w:tabs>'
        '<w:jc w:val="both"/>' + ARIAL_RPR + '</w:pPr>'
        '<w:r>' + ARIAL_RPR +
        '<w:t>NAME</w:t><w:tab/><w:tab/><w:tab/><w:tab/>'
        '<w:t xml:space="preserve">     ADDRESS</w:t><w:tab/>'
        '<w:t>RELATIONSHIP</w:t></w:r></w:p>'
    )

    # 8 regular blank lines
    blank_ids_026 = ['7D94FB4D', '5779AAA3', '71941E2E', '5A56CB49',
                     '4EC1A408', '75BEB20D', '2FC19330', '303852A8']
    blank_paras_026 = ''
    for pid in blank_ids_026:
        blank_paras_026 += (
            '<w:p w14:paraId="' + pid + '" w14:textId="77777777" '
            'w:rsidR="00DF7BB2" w:rsidRDefault="00DF7BB2">'
            '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
            '<w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="both"/>'
            + ARIAL_RPR + '</w:pPr></w:p>'
        )

    # Last blank with sectPr
    last_blank_026 = (
        '<w:p w14:paraId="7BC7D609" w14:textId="77777777" '
        'w:rsidR="00DF7BB2" w:rsidRDefault="00DF7BB2">'
        '<w:pPr><w:widowControl/><w:tabs>' + TABS_11 + '</w:tabs>'
        '<w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="both"/>'
        + ARIAL_RPR +
        '<w:sectPr w:rsidR="00DF7BB2">'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="360" w:left="1440" '
        'w:header="1440" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:noEndnote/></w:sectPr></w:pPr></w:p>'
    )

    old_nok_026 = spacer_763 + header_7fab + blank_paras_026 + last_blank_026

    sectpr_026 = (
        '<w:sectPr w:rsidR="00DF7BB2">'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="360" w:left="1440" '
        'w:header="1440" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/><w:noEndnote/></w:sectPr>'
    )
    new_nok_026 = header_7fab + make_nok_loop_para(NOK_HEADER_TABS, '360', sectpr_026)

    replacements.append((old_nok_026, new_nok_026, 'next_of_kin loop (para 8)'))

    # -----------------------------------------------------------------------
    # 9. Proposed guardian name (body) — "The proposed guardian, [tab],"
    # -----------------------------------------------------------------------
    old_pg_name_body = (
        '<w:t xml:space="preserve">The proposed guardian, </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U + '<w:tab/></w:r>'
        '<w:r>' + ARIAL_RPR + '<w:t>,</w:t></w:r>'
    )
    new_pg_name_body = (
        '<w:t xml:space="preserve">The proposed guardian, </w:t></w:r>' +
        text_run('{proposed_guardian_name}', underline=True) +
        text_run(',')
    )
    replacements.append((old_pg_name_body, new_pg_name_body, 'proposed_guardian_name (body)'))

    # -----------------------------------------------------------------------
    # 10. Proposed guardian residence — "whose residence is [tab]"
    # -----------------------------------------------------------------------
    old_pg_res = (
        '<w:t xml:space="preserve">whose residence is </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U + '<w:tab/></w:r></w:p>'
    )
    new_pg_res = (
        '<w:t xml:space="preserve">whose residence is </w:t></w:r>' +
        text_run('{proposed_guardian_residence}', underline=True) +
        '</w:p>'
    )
    replacements.append((old_pg_res, new_pg_res, 'proposed_guardian_residence'))

    # -----------------------------------------------------------------------
    # 11. Proposed guardian address — "whose post office address is [tab]"
    # -----------------------------------------------------------------------
    old_pg_addr = (
        '<w:t xml:space="preserve">whose post office address is </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U + '<w:tab/></w:r></w:p>'
    )
    new_pg_addr = (
        '<w:t xml:space="preserve">whose post office address is </w:t></w:r>' +
        text_run('{proposed_guardian_address}', underline=True) +
        '</w:p>'
    )
    replacements.append((old_pg_addr, new_pg_addr, 'proposed_guardian_address'))

    # -----------------------------------------------------------------------
    # 12. Proposed guardian name (prayer) — "requests that [spaces] be appointed"
    # -----------------------------------------------------------------------
    old_pg_prayer = (
        '<w:t xml:space="preserve">Petitioner requests that </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U +
        '<w:t xml:space="preserve">'
        '                                                                                                               '
        '</w:t></w:r>'
        '<w:r>' + ARIAL_RPR +
        '<w:t xml:space="preserve"> be appointed limited guardian of the person and property of the Ward.</w:t></w:r>'
    )
    new_pg_prayer = (
        '<w:t xml:space="preserve">Petitioner requests that </w:t></w:r>' +
        text_run('{proposed_guardian_name}', underline=True) +
        text_run(' be appointed limited guardian of the person and property of the Ward.')
    )
    replacements.append((old_pg_prayer, new_pg_prayer, 'proposed_guardian_name (prayer)'))

    # -----------------------------------------------------------------------
    # 13. Attorney bar number — "Florida Bar No. [tab]"
    # -----------------------------------------------------------------------
    old_bar = (
        '<w:t xml:space="preserve">Florida Bar No. </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U + '<w:tab/></w:r>'
    )
    new_bar = (
        '<w:t xml:space="preserve">Florida Bar No. </w:t></w:r>' +
        text_run('{attorney_bar_no}')
    )
    replacements.append((old_bar, new_bar, 'attorney_bar_no'))

    # -----------------------------------------------------------------------
    # 14. Attorney phone — "Telephone: [tab]" (has lastRenderedPageBreak)
    # -----------------------------------------------------------------------
    old_phone_026 = (
        '<w:lastRenderedPageBreak/>'
        '<w:t xml:space="preserve">Telephone:  </w:t></w:r>'
        '<w:r>' + ARIAL_RPR_U + '<w:tab/></w:r>'
    )
    new_phone_026 = (
        '<w:lastRenderedPageBreak/>'
        '<w:t xml:space="preserve">Telephone:  {attorney_phone}</w:t></w:r>'
    )
    replacements.append((old_phone_026, new_phone_026, 'attorney_phone'))

    report = patch_docx('G3-026.docx', replacements)
    print_report(report)
    return report


# ===========================================================================
# Verification & reporting
# ===========================================================================

def verify_tags(docx_path, expected_tags):
    """Read the patched docx and verify all expected tags are present."""
    abs_path = os.path.join(TEMPLATES_DIR, docx_path)
    with zipfile.ZipFile(abs_path) as z:
        xml = z.open('word/document.xml').read().decode('utf-8')

    print('\n  Verification — tags in ' + docx_path + ':')
    all_ok = True
    for tag in sorted(expected_tags):
        present = tag in xml
        status = 'OK' if present else 'MISSING'
        if not present:
            all_ok = False
        print('    ' + tag + ': ' + status)

    if all_ok:
        print('  All ' + str(len(expected_tags)) + ' expected tags verified present.')
    else:
        print('  WARNING: Some tags are missing!')
    return all_ok


def print_report(report):
    print('\n  Replacement report:')
    for label, success in report.items():
        status = 'APPLIED' if success else 'NOT FOUND'
        print('    ' + label + ': ' + status)
    failed = [k for k, v in report.items() if not v]
    if failed:
        print('\n  WARNING: ' + str(len(failed)) + ' replacement(s) failed!')
    else:
        print('\n  All ' + str(len(report)) + ' replacements applied successfully.')


# ===========================================================================
# Main
# ===========================================================================

def main():
    print('repair_templates.py \u2014 Repairing G3-010.docx and G3-026.docx')
    print()

    r1 = repair_g3_010()

    expected_010 = [
        '{county}', '{file_no}', '{division}',
        '{petitioner_name}', '{petitioner_residence}', '{petitioner_address}',
        '{petitioner_phone}',
        '{aip_name}', '{aip_dob_month}', '{aip_dob_day}', '{aip_dob_year}',
        '{aip_age}', '{aip_residence}', '{aip_address}', '{aip_incapacity_nature}',
        '{proposed_guardian_name}', '{proposed_guardian_residence}',
        '{proposed_guardian_address}', '{proposed_guardian_professional}',
        '{proposed_guardian_relationship}',
        '{has_alternatives_check}', '{has_preneed_check}', '{guardianship_scope}',
        '{signing_day}', '{signing_month}', '{signing_year}',
        '{attorney_bar_no}', '{attorney_email}', '{attorney_phone}',
        '{imminent_danger_reason}', '{appointment_reason}', '{property_nature_value}',
        '{#next_of_kin}', '{/next_of_kin}', '{name}', '{address}', '{relationship}',
    ]
    verify_tags('G3-010.docx', expected_010)

    r2 = repair_g3_026()

    expected_026 = [
        '{county}', '{file_no}', '{division}',
        '{petitioner_name}', '{petitioner_residence}', '{petitioner_address}',
        '{aip_name}', '{aip_age}', '{aip_residence}', '{aip_address}',
        '{proposed_guardian_name}', '{proposed_guardian_residence}',
        '{proposed_guardian_address}', '{proposed_guardian_professional_check}',
        '{proposed_guardian_pronoun}', '{proposed_guardian_relationship}',
        '{has_alternatives_check}', '{alternatives_description}', '{has_preneed_check}',
        '{appointment_reason}', '{property_value_description}', '{incapable_property}',
        '{remove_marry_check}', '{remove_vote_check}', '{remove_govt_benefits_check}',
        '{remove_drivers_license_check}', '{remove_travel_check}',
        '{remove_employment_check}',
        '{delegate_contract_check}', '{delegate_sue_check}',
        '{delegate_govt_benefits_check}', '{delegate_property_check}',
        '{delegate_residence_check}', '{delegate_medical_check}',
        '{delegate_social_check}',
        '{signing_day}', '{signing_month}', '{signing_year}',
        '{attorney_name}', '{attorney_email}', '{attorney_address}',
        '{attorney_bar_no}', '{attorney_phone}',
        '{#next_of_kin}', '{/next_of_kin}', '{name}', '{address}', '{relationship}',
    ]
    verify_tags('G3-026.docx', expected_026)

    # Summary
    print()
    print('=' * 60)
    all_ok_1 = all(r1.values())
    all_ok_2 = all(r2.values())
    if all_ok_1 and all_ok_2:
        print('SUCCESS \u2014 Both templates repaired.')
    else:
        if not all_ok_1:
            print('G3-010.docx: Some replacements failed.')
        if not all_ok_2:
            print('G3-026.docx: Some replacements failed.')
    print('=' * 60)


if __name__ == '__main__':
    main()
