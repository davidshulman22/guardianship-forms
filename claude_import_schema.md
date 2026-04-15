# Claude Import Schema — GS Court Forms

When David asks you to "populate forms for [matter]" or "generate import JSON," read the matter context file and produce a JSON object in this exact format. David will paste it into the app's "Import from Claude" modal.

## JSON Structure

```json
{
  "client": {
    "firstName": "string",
    "lastName": "string (REQUIRED)",
    "address": "string (multi-line OK)",
    "phone": "string",
    "email": "string"
  },
  "matter": {
    "type": "probate | guardianship (default: probate)",
    "subjectName": "string (REQUIRED) — decedent name for probate, AIP name for guardianship",
    "county": "string — e.g. 'Broward'",
    "fileNo": "string — case number, leave empty if not yet assigned",
    "division": "string — e.g. '62J'",
    "matterData": {
      "decedent_address": "string",
      "decedent_death_date": "string — month and day only, e.g. 'June 14'",
      "decedent_death_year": "string — e.g. '2025'",
      "decedent_death_place": "string — city, county, state",
      "decedent_domicile": "string — county name, e.g. 'Broward'",
      "decedent_ssn_last4": "string — last 4 digits, leave empty if unknown"
    }
  },
  "formData": {
    "...all form field values — see Field Reference below..."
  }
}
```

## Rules

1. **Client matching**: If a client with the same last name (and first name, if provided) already exists in the app, the import updates that client rather than creating a duplicate.
2. **Matter matching**: If a matter with the same `subjectName` already exists under the client, the import merges data into it.
3. **Empty values**: Use empty string `""` for unknown values. Never omit a field entirely if you have partial data for its section.
4. **The `client` is the petitioner** (usually). For probate, the client is typically the personal representative / petitioner.
5. **Attorney defaults are automatic** — do NOT include `attorney_name`, `attorney_email`, `attorney_bar_no`, `attorney_address`, or `attorney_phone`. The app fills these in.

## Field Reference — Probate (Formal Administration)

### Core identification (used by nearly every form)
| Field | Description | Example |
|-------|-------------|---------|
| `petitioner_name` | Full name(s) of petitioner(s) | `"Robert Keith Muscara and Cheryl Marie Rondinelli"` |
| `petitioner_interest` | Petitioner's relationship/interest | `"co-personal representatives named in the Last Will and Testament"` |
| `petitioner_address` | Petitioner mailing address | |
| `decedent_full_name` | Full legal name of decedent | `"Lorraine Ann Muscara"` |
| `decedent_address` | Last known address | `"2417 NE 26th Avenue, Lighthouse Point, FL 33064"` |
| `decedent_ssn_last4` | Last 4 of SSN | `"4321"` |
| `decedent_death_date` | Month and day of death | `"June 14"` |
| `decedent_death_year` | Year of death | `"2025"` |
| `decedent_death_place` | City, County, State | `"Lighthouse Point, Broward County, Florida"` |
| `decedent_domicile` | County of domicile | `"Broward"` |

### Will information (testate only)
| Field | Description | Example |
|-------|-------------|---------|
| `will_date` | Month and day will was executed | `"October 30"` |
| `will_year` | Year will was executed | `"2021"` |
| `codicil_dates` | Codicil dates, if any | `""` |

### Venue and jurisdiction
| Field | Description | Example |
|-------|-------------|---------|
| `venue_reason` | Why venue is proper | `"the decedent was domiciled in Broward County, Florida at the time of death"` |
| `county` | Filing county | `"Broward"` |
| `file_no` | Case number | `"PRC250003382"` |
| `division` | Court division | `"62J"` |
| `judge_name` | Assigned judge | `"Hon. Kenneth L. Gillespie"` |
| `court_county` | County for court address | `"Broward"` |
| `court_address` | Court clerk address | `"201 SE 6th Street, Fort Lauderdale, FL 33301"` |

### Personal representative
| Field | Description | Example |
|-------|-------------|---------|
| `pr_name` | PR full name(s) | `"Robert Keith Muscara and Cheryl Marie Rondinelli"` |
| `pr_address` | PR mailing address | |
| `pr_relationship` | PR's relationship to decedent | `"nephew and niece of decedent"` |
| `pr_residence` | PR's state/county of residence | `"Florida"` |

### Ancillary (only if non-domiciliary)
| Field | Description |
|-------|-------------|
| `domiciliary_court_address` | Address of domiciliary court |
| `domiciliary_representative` | Name of domiciliary PR |
| `domiciliary_representative_address` | Address of domiciliary PR |

### Oath / Notary (P3-0600)
| Field | Description |
|-------|-------------|
| `oath_state` | State for oath (usually "Florida") |
| `oath_county` | County for oath |
| `agent_name` | Resident agent name |
| `agent_county` | Agent's county |
| `agent_address` | Agent's address |

### Notice to Creditors (P3-0740)
| Field | Description |
|-------|-------------|
| `publication_date` | Date of first publication |
| `publication_year` | Year of first publication |

### Signing fields (auto-populated in app)
| Field | Description |
|-------|-------------|
| `signing_day` | Day of signing |
| `signing_month` | Month of signing |
| `signing_year` | Year of signing |

### Broward local fields
| Field | Description |
|-------|-------------|
| `affiant_name` | Name of affiant (for BW-0010 Criminal History) |
| `notary_state` | Usually "Florida" |
| `notary_county` | Usually "Broward" |

### Repeating groups

**beneficiaries** — array of objects:
```json
"beneficiaries": [
  {
    "ben_name": "Full name",
    "ben_address": "Mailing address",
    "ben_relationship": "Relationship to decedent",
    "ben_year_of_birth": "Year of birth (if known)"
  }
]
```

**petitioners** — array of objects (for multi-petitioner forms):
```json
"petitioners": [
  {
    "pet_name": "Full name",
    "pet_address": "Mailing address",
    "pet_relationship": "Relationship to decedent"
  }
]
```

## Broward County Judges (current April 2026)
- **Judge Kenneth L. Gillespie** — Administrative Judge (Div. 62J)
- **Judge Nicholas Lopane** (Div. 60J)
- **Judge Natasha DePrimo** (Div. 61J)
- **General Magistrate Yves Laventure**

## Example

See `examples/muscara_import.json` for a complete real-world example generated from a matter context file.

## How David Uses This

1. David says: "Populate forms for [matter name]" or "Generate import JSON from [context file path]"
2. You read the context file (or use information from the conversation)
3. You output the JSON blob
4. David copies it, clicks "Import from Claude" in the app, pastes, clicks Import
5. Client + matter + all form fields are created and ready for document generation
