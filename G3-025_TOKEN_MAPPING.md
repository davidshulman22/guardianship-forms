# G3-025 Tokenization Mapping
## Florida Petition for Appointment of Plenary Guardian (Property)

### Overview
The G3-025 form has been successfully tokenized for use with docxtemplater. All fillable blank fields and underlined sections have been replaced with mustache-style template tokens.

---

## Token Reference

### Header Information
- **{county}** - County name (appears in "IN THE CIRCUIT COURT FOR {county} COUNTY, FLORIDA")
- **{file_no}** - File number from the court case
- **{division}** - Court division (e.g., "PROBATE DIVISION")

### Petitioner Information
- **{petitioner_name}** - Name of the petitioner filing the petition
- **{petitioner_residence}** - Petitioner's residence/address (Paragraph 1)
- **{petitioner_address}** - Petitioner's post office address (Paragraph 1)

### Ward/Alleged Incapacitated Person (AIP) Information
- **{aip_name}** - Full name of the ward/alleged incapacitated person (used in multiple paragraphs)
- **{aip_age}** - Age of the ward in years (Paragraph 2)
- **{aip_residence}** - Residence of the ward (Paragraph 2)
- **{aip_address}** - Post office address of the ward (Paragraph 2)

### Incapacity and Alternatives (Paragraphs 3-4)
- **{ward_incapacity_nature}** - Description of the nature of the ward's alleged incapacity (Paragraph 3)
- **{alternatives_description}** - Description of alternatives to guardianship considered (Paragraph 4)
- **{alternatives_insufficient_reason}** - Explanation of why alternatives are insufficient (Paragraph 4)

### Preneed Guardian Designation (Paragraph 5)
- **{has_preneed_check}** - Check option: "(has)(has no)" - Select which applies

### Proposed Guardian Information (Paragraph 7)
- **{proposed_guardian_name}** - Full name of the proposed guardian (appears multiple times)
- **{proposed_guardian_residence}** - Residence of the proposed guardian
- **{proposed_guardian_address}** - Post office address of the proposed guardian
- **{proposed_guardian_professional_check}** - Check option: "(is)(is not)" professional guardian
- **{proposed_guardian_relationship}** - Description of relationship and previous association with the ward
- **{appointment_reason}** - Explanation of why the proposed guardian should be appointed

### Property Information (Paragraph 8)
- **{property_description}** - Description of the nature and value of the property subject to guardianship

### Final Request
- The proposed guardian name is reused ({proposed_guardian_name}) in the final request: "{proposed_guardian_name} be appointed plenary guardian of the property of the Ward."

### Signature Section
- **{signing_day}** - Day of signing (numeric, e.g., "15")
- **{signing_month}** - Month of signing (name, e.g., "March")
- **{signing_year}** - Year of signing (numeric, e.g., "2024")
- **{petitioner_name}** - Petitioner's name (reused in signature block)

### Attorney Information
- **{attorney_name}** - Name of attorney for petitioner
- **{attorney_email}** - Email address of attorney
- **{attorney_bar_no}** - Florida Bar number of attorney
- **{attorney_address}** - Office address of attorney
- **{attorney_phone}** - Phone number of attorney

### Next of Kin (Paragraph 6)
The next of kin section uses a repeating loop with the following structure:

```
{#next_of_kin}
{name}  {address}  {relationship}
{/next_of_kin}
```

Each iteration should provide:
- **{name}** - Name of the next of kin
- **{address}** - Address of the next of kin
- **{relationship}** - Relationship to the ward

---

## Usage Notes

### Checkbox Items
Some fields contain checkbox options in the original form that should be handled during merging:
1. **{has_preneed_check}** - Replace with either "(has)" or "(has no)"
2. **{proposed_guardian_professional_check}** - Replace with either "(is)" or "(is not)"

### Field Reuse
The following tokens appear multiple times and should be populated with the same value:
- **{aip_name}** - Ward's name (used in paragraph 2 header and throughout)
- **{petitioner_name}** - Appears in initial statement and signature block
- **{proposed_guardian_name}** - Appears in paragraph 7 and final request

### Next of Kin Table
The next of kin section supports variable numbers of entries. If no next of kin information is available, leave the loop empty. The loop must use docxtemplater's array iteration syntax.

---

## Validation
- Total paragraphs: 72 (reduced from 74 due to removal of placeholder rows)
- All required field tokens have been implemented
- The document validates successfully against docxtemplater requirements
- File size: 19 KB

---

## File Location
Tokenized template: `/sessions/charming-hopeful-mayer/mnt/Forms Project/templates/G3-025.docx`

Original form: `/sessions/charming-hopeful-mayer/mnt/Forms Project/templates/G3-025 Petition for Appointment of Plenary Guardian Property.docx`
