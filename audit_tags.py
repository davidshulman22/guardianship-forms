#!/usr/bin/env python3
"""Tag audit: compare {tags} in each template .docx against forms.json field defs.

Reports tags that are NOT in forms.json and NOT auto-populated by prepareTemplateData().
Skips guardianship templates (deferred per handoff).
"""
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
TEMPLATES = ROOT / "templates"
FORMS_JSON = ROOT / "forms.json"

AUTO_POPULATED = {
    "county", "decedent_name", "decedent_full_name", "aip_name", "file_no", "division",
    "petitioner_name", "petitioner_names", "petitioner_address",
    "affiant_name", "notary_state", "notary_county",
    "attorney_name", "attorney_email", "attorney_email_secondary",
    "attorney_bar_no", "attorney_address", "attorney_phone",
    "petitioners",
}

TAG_RE = re.compile(r"\{([#/]?)([a-zA-Z0-9_]+)\}")

def extract_tags(docx_path: Path) -> set:
    tags = set()
    with zipfile.ZipFile(docx_path) as z:
        for name in z.namelist():
            if name.endswith(".xml"):
                xml = z.read(name).decode("utf-8", errors="ignore")
                xml = re.sub(r"<[^>]+>", "", xml)
                for m in TAG_RE.finditer(xml):
                    prefix, tag = m.group(1), m.group(2)
                    tags.add(tag)
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

def main():
    cfg = json.loads(FORMS_JSON.read_text())
    by_form = forms_json_fields(cfg)

    issues = []
    for docx in sorted(TEMPLATES.glob("*.docx")):
        form_id = docx.stem
        if form_id.startswith("G"):
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
        print("PASS — all probate/local templates match forms.json (excluding auto-populated).")
        return 0

    print(f"FAIL — {len(issues)} templates with issues:\n")
    for form_id, label, orphans, _ in issues:
        print(f"  {form_id}: {label}")
        for t in orphans:
            print(f"    - {t}")
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
