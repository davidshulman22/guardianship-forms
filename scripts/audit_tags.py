#!/usr/bin/env python3
"""Tag audit: compare {tags} in each template .docx against forms.json field defs.

Reports tags that are NOT in forms.json and NOT auto-populated by prepareTemplateData().
Covers probate, Broward local, and guardianship templates.
"""
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
TEMPLATES = ROOT / "templates"
FORMS_JSON = ROOT / "forms.json"

AUTO_POPULATED = {
    "county", "county_caption", "county_is_broward", "county_is_miami_dade",
    "decedent_name", "decedent_full_name",
    "aip_name", "aip_name_upper",
    "file_no", "division",
    "petitioner_name", "petitioner_names", "petitioner_address",
    "affiant_name", "notary_state", "notary_county",
    "attorney_name", "attorney_firm",
    "attorney_email", "attorney_email_secondary",
    "attorney_bar_no", "attorney_address", "attorney_phone",
    "petitioners",
    # Smart-template derived grammar fields (computed in prepareTemplateData)
    "multiple_petitioners", "multiple_prs",
    "petitioner_label", "petitioner_poss",
    "petitioner_verb_alleges", "petitioner_verb_has", "petitioner_verb_is",
    "pr_names", "pr_label", "pr_label_title", "pr_label_caps", "pr_verb_is",
    "pr_pronoun_he_she", "pr_pronoun_his_her",
    # Matter-level booleans (set on matter.matterData, not per-form)
    "is_testate", "is_ancillary",
    # Caveat (P1-CAVEAT) derived flags from caveator_type select
    "caveator_is_creditor", "caveator_is_ip",
    # Summary admin (P2-PETITION) derived flags from creditors_status select
    "creditors_all_barred", "creditors_no_debt", "creditors_has_debt",
    # Derived display fields for numeric estate assets (from prepareTemplateData)
    "asset_value_formatted",
    "estate_assets_total", "estate_assets_total_formatted",
    # Venue reason prose composed from venue_reason_type_* checkboxes + other
    "venue_reason",
}

TAG_RE = re.compile(r"\{[#/^]?([a-zA-Z0-9_]+)\}")

def extract_tags(docx_path: Path) -> set:
    tags = set()
    with zipfile.ZipFile(docx_path) as z:
        for name in z.namelist():
            if name.endswith(".xml"):
                xml = z.read(name).decode("utf-8", errors="ignore")
                xml = re.sub(r"<[^>]+>", "", xml)
                for m in TAG_RE.finditer(xml):
                    tags.add(m.group(1))
    return tags

def walk_fields(section, into):
    for fld in section.get("fields", []) or []:
        if "name" in fld:
            into.add(fld["name"])
        for sub in fld.get("subfields", []) or []:
            if "name" in sub:
                into.add(sub["name"])
        for sub in fld.get("fields", []) or []:
            if "name" in sub:
                into.add(sub["name"])
    for sub in section.get("sections", []) or []:
        walk_fields(sub, into)

def forms_json_fields(forms_cfg):
    by_form = {}
    for form in forms_cfg.get("forms", []):
        fields = set()
        for section in form.get("sections", []) or []:
            walk_fields(section, fields)
        for fld in form.get("fields", []) or []:
            if "name" in fld:
                fields.add(fld["name"])
        by_form[form["id"]] = fields
    return by_form


def passthrough_form_ids(forms_cfg):
    """Return form IDs that bundle a PDF unchanged (no .docx template audit)."""
    return {
        form["id"]
        for form in forms_cfg.get("forms", [])
        if form.get("delivery") == "pdf_passthrough"
    }

def main():
    cfg = json.loads(FORMS_JSON.read_text())
    by_form = forms_json_fields(cfg)
    passthrough = passthrough_form_ids(cfg)

    issues = []
    for docx in sorted(TEMPLATES.glob("*.docx")):
        form_id = docx.stem
        if form_id in passthrough:
            # PDF-passthrough forms bundle the clerk's PDF from reference/;
            # any leftover .docx under templates/ is unused and intentionally
            # skipped by the tag audit.
            continue
        if form_id not in by_form:
            issues.append((form_id, "NO forms.json entry", set(), set()))
            continue

        tags = extract_tags(docx)
        defined = by_form[form_id]

        orphan = set()
        for tag in tags:
            if tag in AUTO_POPULATED:
                continue
            if tag.endswith("_check"):
                base = tag[:-6]
                if base in defined or base in AUTO_POPULATED:
                    continue
            if tag in defined:
                continue
            orphan.add(tag)

        if orphan:
            issues.append((form_id, "orphan tags (in template, not in forms.json)",
                          sorted(orphan), set()))

    if not issues:
        print("PASS — all templates match forms.json (excluding auto-populated).")
        return 0

    print(f"FAIL — {len(issues)} templates with issues:\n")
    for form_id, label, orphans, _ in issues:
        print(f"  {form_id}: {label}")
        for t in orphans:
            print(f"    - {t}")
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
