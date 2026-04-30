#!/usr/bin/env python3
"""Auto-test harness for GS Court Forms.

Runs without a browser, without Cowork, without a human. Catches the bug
categories that the 2026-04-29 Cowork live test caught (BUG-1, BUG-3,
BUG-4, BUG-2 hard-rule check) plus structural regressions.

What this DOES test:
- Tag audit (delegates to scripts/audit_tags.py)
- Builder determinism (rebuild + hash check)
- Hard rule: no judge-signed template carries the AI cert
- forms.json schema sanity
- Template render correctness (via docxtemplater in Node) for representative
  permutations: testate/intestate, single/multi PR, has_codicil, used_ai
  with each county, Florida-resident PR, etc.

What this does NOT test:
- Browser UI (auto-populate, visible_if conditional rendering, click flows)
- Auth + RLS
- Network round-trip to Supabase

Setup: scripts/test/ has its own package.json with docxtemplater + pizzip.
Run `npm install` in that dir once. The harness shells out to Node for
rendering.

Usage:
    python3 scripts/auto_test.py            # run all, print summary
    python3 scripts/auto_test.py -v         # print every test result
    python3 scripts/auto_test.py --md       # write TEST_RESULTS_AUTO.md

Exit code: 0 on all-pass, 1 on any failure.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

ROOT = Path(__file__).parent.parent
TEMPLATES = ROOT / "templates"
SCRIPTS = ROOT / "scripts"
TEST_DIR = SCRIPTS / "test"
RENDER_JS = TEST_DIR / "render.js"
NODE_MODULES = TEST_DIR / "node_modules"

# Templates that are signed by a judge or issued by the court — must NEVER
# carry an AI cert. Hard rule per CLAUDE.md.
JUDGE_SIGNED = [
    "P3-ORDER",
    "P3-LETTERS",
    "P2-ORDER",
    "P3-CURATOR-ORDER",
    "P3-CURATOR-LETTERS",
    "G3-ORDER",
    "G3-LETTERS",
    "P5-ORDER-DISCHARGE",
    "G3-EMERGENCY-ORDER",
    "G3-EMERGENCY-LETTERS",
]


@dataclass
class TestResult:
    name: str
    status: str   # PASS | FAIL | SKIP
    detail: str = ""

    @property
    def is_fail(self) -> bool:
        return self.status == "FAIL"


@dataclass
class TestSuite:
    results: list[TestResult] = field(default_factory=list)

    def record(self, name: str, status: str, detail: str = "") -> TestResult:
        r = TestResult(name, status, detail)
        self.results.append(r)
        return r

    def summary(self) -> dict[str, int]:
        out = {"PASS": 0, "FAIL": 0, "SKIP": 0}
        for r in self.results:
            out[r.status] = out.get(r.status, 0) + 1
        return out


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
TAG_RE = re.compile(r"\{[#/^]?([a-zA-Z0-9_]+)\}")


def template_text(path: Path) -> str:
    """Return concatenated visible text from a .docx template (tags + prose)."""
    chunks = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.endswith(".xml"):
                xml = z.read(name).decode("utf-8", errors="ignore")
                chunks.append(re.sub(r"<[^>]+>", "", xml))
    return "\n".join(chunks)


def rendered_text(path: Path) -> str:
    """Same as template_text but for a rendered output .docx."""
    return template_text(path)


def render_template(template_id: str, data: dict) -> Optional[str]:
    """Render a template with the given data via the Node CLI. Returns the
    rendered .docx text on success, None on render failure.
    """
    template_path = TEMPLATES / f"{template_id}.docx"
    if not template_path.exists():
        return None
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        data_path = td / "data.json"
        out_path = td / "out.docx"
        data_path.write_text(json.dumps(data))
        proc = subprocess.run(
            ["node", str(RENDER_JS), str(template_path), str(data_path), str(out_path)],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            return f"__RENDER_ERROR__:{proc.stderr.strip()}"
        return rendered_text(out_path)


def file_hashes(paths: list[Path]) -> dict[str, str]:
    out = {}
    for p in paths:
        out[p.name] = hashlib.sha256(p.read_bytes()).hexdigest()
    return out


# ---------------------------------------------------------------------------
# Structural tests (no rendering)
# ---------------------------------------------------------------------------

def test_tag_audit(s: TestSuite) -> None:
    proc = subprocess.run(
        ["python3", str(SCRIPTS / "audit_tags.py")],
        capture_output=True,
        text=True,
    )
    if proc.returncode == 0 and "PASS" in proc.stdout:
        s.record("structural/tag-audit", "PASS")
    else:
        s.record("structural/tag-audit", "FAIL",
                 proc.stdout.strip() + "\n" + proc.stderr.strip())


def _content_hash(path: Path) -> str:
    """Hash the visible text content of a .docx, ignoring volatile XML
    attributes (rsids, paragraph ids) that python-docx randomizes on every
    save. A true content change must change this hash; a no-op rebuild must
    not.
    """
    text = template_text(path)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_builder_determinism(s: TestSuite) -> None:
    """Rebuild templates and verify visible-text content is stable across
    rebuilds. Hashes ignore volatile XML attributes (rsids, ids) that
    python-docx randomizes on every save — those churn but don't change
    output to a reader. A real determinism failure means a builder is
    embedding a timestamp or random value in the rendered text.
    """
    docxs = sorted(TEMPLATES.glob("*.docx"))
    before = {p.name: _content_hash(p) for p in docxs}
    for builder in ("build_guardianship_templates.py", "build_probate_templates.py"):
        proc = subprocess.run(
            ["python3", str(SCRIPTS / builder)],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            s.record(f"structural/builder-runs[{builder}]", "FAIL", proc.stderr.strip())
            return
    after = {p.name: _content_hash(p) for p in sorted(TEMPLATES.glob("*.docx"))}
    drift = [name for name in before if before[name] != after.get(name)]
    if drift:
        s.record("structural/builder-determinism", "FAIL",
                 f"{len(drift)} templates have content drift on rebuild: {drift[:5]}")
    else:
        s.record("structural/builder-determinism", "PASS",
                 f"rebuilt {len(after)} templates, all content-stable")


def test_hard_rule_no_ai_cert_on_judge_signed(s: TestSuite) -> None:
    """Hard rule per CLAUDE.md: no template signed by a judge ever carries
    an AI cert. Search for both the template tags ({#used_ai}) and prose
    fragments that would indicate AI cert text leaked in."""
    forbidden = ["{#used_ai}", "generative artificial", "Generative artificial"]
    failures = []
    for tid in JUDGE_SIGNED:
        path = TEMPLATES / f"{tid}.docx"
        if not path.exists():
            failures.append(f"{tid}: template missing")
            continue
        text = template_text(path)
        for needle in forbidden:
            if needle in text:
                failures.append(f"{tid}: contains forbidden text '{needle}'")
    if failures:
        s.record("structural/hard-rule-no-ai-cert-on-judge-signed",
                 "FAIL", "\n".join(failures))
    else:
        s.record("structural/hard-rule-no-ai-cert-on-judge-signed", "PASS",
                 f"checked {len(JUDGE_SIGNED)} judge-signed templates")


def test_forms_json_sanity(s: TestSuite) -> None:
    cfg = json.loads((ROOT / "forms.json").read_text())
    issues = []
    seen_ids = set()
    for form in cfg.get("forms", []):
        fid = form.get("id")
        if not fid:
            issues.append("form with no id")
            continue
        if fid in seen_ids:
            issues.append(f"duplicate id: {fid}")
        seen_ids.add(fid)
        if form.get("delivery") == "pdf_passthrough":
            tpl = form.get("template")
            if not tpl or not (ROOT / tpl).exists():
                issues.append(f"{fid}: passthrough template missing: {tpl}")
        else:
            if not (TEMPLATES / f"{fid}.docx").exists():
                issues.append(f"{fid}: no .docx in templates/")
    if issues:
        s.record("structural/forms-json-sanity", "FAIL", "\n".join(issues))
    else:
        s.record("structural/forms-json-sanity", "PASS",
                 f"{len(seen_ids)} forms, all templates present")


# ---------------------------------------------------------------------------
# Render tests (Node + docxtemplater)
# ---------------------------------------------------------------------------

def base_data() -> dict:
    """A baseline data dict that satisfies every required tag in P3-PETITION
    and friends. Tests override fields they care about.
    """
    return {
        # Caption / matter
        "county": "Broward",
        "county_caption": "BROWARD",
        "county_is_broward": True,
        "county_is_miami_dade": False,
        "decedent_name": "Helen Marie Torres",
        "decedent_full_name": "Helen Marie Torres",
        "decedent_address": "300 SE 2nd St, Fort Lauderdale, FL 33301",
        "decedent_death_date": "March 2, 2026",
        "decedent_dod_county": "Broward",
        "decedent_dod_state": "Florida",
        "decedent_domicile": "Broward",
        "decedent_domicile_state": "Florida",
        "decedent_ssn_last4": "1234",
        "decedent_age": "82",
        "file_no": "",
        "division": "Probate",
        "is_testate": True,
        "is_ancillary": False,
        "has_codicil": False,
        "codicil_dates": "",
        "is_self_proved": True,
        "will_date": "January 5, 2024",
        "will_location": "Decedent's residence",
        # Petitioner / PR
        "petitioner_name": "Margaret Torres",
        "petitioner_address": "300 SE 2nd St, Fort Lauderdale, FL 33301",
        "petitioner_names": "Margaret Torres",
        "petitioner_label": "Petitioner",
        "petitioner_poss": "petitioner’s",
        "petitioner_verb_alleges": "alleges",
        "petitioner_verb_has": "has",
        "petitioner_verb_is": "is",
        "multiple_petitioners": False,
        "petitioners": [{
            "pet_name": "Margaret Torres",
            "pet_address": "300 SE 2nd St, Fort Lauderdale, FL 33301",
            "pet_interest": "Daughter",
        }],
        "pr_name": "Margaret Torres",
        "pr_address": "300 SE 2nd St, Fort Lauderdale, FL 33301",
        "pr_is_fl_resident": True,
        "pr_relationship": "Daughter",
        "pr_names": "Margaret Torres",
        "pr_label": "personal representative",
        "pr_label_title": "Personal Representative",
        "pr_label_caps": "PERSONAL REPRESENTATIVE",
        "pr_verb_is": "is",
        "pr_pronoun_he_she": "he or she",
        "pr_pronoun_his_her": "his or her",
        "multiple_prs": False,
        "prs": [{
            "pr_name": "Margaret Torres",
            "pr_address": "300 SE 2nd St, Fort Lauderdale, FL 33301",
            "pr_is_fl_resident": True,
            "pr_relationship": "Daughter",
        }],
        # Attorney
        "attorney_name": "David A. Shulman",
        "attorney_firm": "Ginsberg Shulman, PL",
        "attorney_email": "david@ginsbergshulman.com",
        "attorney_email_secondary": "",
        "attorney_bar_no": "150762",
        "attorney_address": "300 SE 2nd St, Suite 600\nFort Lauderdale, FL 33301",
        "attorney_phone": "954-990-0896",
        # Resident agent
        "resident_agent_name": "David A. Shulman",
        "resident_agent_address": "300 SE 2nd St, Suite 600\nFort Lauderdale, FL 33301",
        # Beneficiaries
        "beneficiaries": [
            {"ben_name": "Robert Torres", "ben_address": "1 Main St", "ben_relationship": "Son", "ben_share": "1/3"},
        ],
        # Estate assets
        "estate_assets": [
            {"asset_description": "Cash", "asset_value": "10000", "asset_value_formatted": "$10,000.00"},
        ],
        "estate_assets_total": "10000",
        "estate_assets_total_formatted": "$10,000.00",
        # Venue
        "venue_reason": "decedent was a resident of this county at the time of death",
        # AI cert
        "used_ai": False,
        # Misc
        "affiant_name": "Margaret Torres",
        "notary_state": "Florida",
        "notary_county": "Broward",
    }


def render_and_assert(s: TestSuite, name: str, template_id: str,
                       overrides: dict, must_contain: list[str] = None,
                       must_not_contain: list[str] = None) -> None:
    must_contain = must_contain or []
    must_not_contain = must_not_contain or []
    data = base_data()
    data.update(overrides)
    text = render_template(template_id, data)
    if text is None:
        s.record(name, "SKIP", f"template {template_id}.docx missing")
        return
    if isinstance(text, str) and text.startswith("__RENDER_ERROR__:"):
        s.record(name, "FAIL", text.replace("__RENDER_ERROR__:", "render error: "))
        return
    failures = []
    for needle in must_contain:
        if needle not in text:
            failures.append(f"missing: {needle!r}")
    for needle in must_not_contain:
        if needle in text:
            failures.append(f"unexpected: {needle!r}")
    if failures:
        s.record(name, "FAIL", "; ".join(failures))
    else:
        s.record(name, "PASS")


def test_render_suite(s: TestSuite) -> None:
    if not NODE_MODULES.exists():
        s.record("render/setup", "SKIP",
                 "scripts/test/node_modules missing — run `npm install` in scripts/test/")
        return

    # BUG-1 regression: single FL-resident PR
    render_and_assert(
        s, "render/BUG-1: single FL-resident PR (P3-PETITION)",
        "P3-PETITION",
        {"prs": [{"pr_name": "Margaret Torres", "pr_address": "300 SE 2nd St, Fort Lauderdale, FL 33301", "pr_is_fl_resident": True, "pr_relationship": "Daughter"}]},
        must_contain=["resident of Florida"],
        must_not_contain=["is not a resident of Florida"],
    )

    # Inverse: non-FL-resident PR. Set both prs[0] AND top-level since the
    # template reads top-level (the hoist that mirrors prs[0]→top-level lives
    # in app.js prepareTemplateData(), not in the template itself; this
    # render-test bypasses app.js).
    render_and_assert(
        s, "render/single non-FL-resident PR (P3-PETITION)",
        "P3-PETITION",
        {
            "pr_is_fl_resident": False,
            "pr_relationship": "Son",
            "prs": [{"pr_name": "Robert Torres", "pr_address": "100 5th Ave, New York, NY 10011", "pr_is_fl_resident": False, "pr_relationship": "Son"}],
        },
        must_contain=["is not a resident of Florida"],
    )

    # BUG-4 regression: codicil dates appear on Letters
    render_and_assert(
        s, "render/BUG-4: codicil dates on P3-LETTERS",
        "P3-LETTERS",
        {"has_codicil": True, "codicil_dates": "May 1, 2024"},
        must_contain=["codicil(s) dated May 1, 2024"],
    )

    # No codicil → no codicil text on Letters
    render_and_assert(
        s, "render/no codicil on P3-LETTERS when has_codicil=false",
        "P3-LETTERS",
        {"has_codicil": False, "codicil_dates": ""},
        must_not_contain=["codicil"],
    )

    # BUG-3 regression: Miami-Dade AI cert renders when used_ai+county_is_miami_dade
    render_and_assert(
        s, "render/BUG-3: Miami-Dade AI cert (used_ai=true, county=miami-dade)",
        "P3-PETITION",
        {"used_ai": True, "county_is_broward": False, "county_is_miami_dade": True},
        must_contain=["Generative artificial intelligence was used in the preparation of this filing"],
        must_not_contain=["The undersigned hereby certifies that generative artificial"],  # Broward-flavored language must not leak
    )

    # Broward AI cert renders when used_ai+county_is_broward
    render_and_assert(
        s, "render/Broward AI cert (used_ai=true, county=broward)",
        "P3-PETITION",
        {"used_ai": True, "county_is_broward": True, "county_is_miami_dade": False},
        must_contain=["The undersigned hereby certifies that generative artificial"],
    )

    # used_ai=false → NO cert at all
    render_and_assert(
        s, "render/no AI cert when used_ai=false (Broward matter)",
        "P3-PETITION",
        {"used_ai": False, "county_is_broward": True, "county_is_miami_dade": False},
        must_not_contain=["generative artificial intelligence", "Generative artificial intelligence"],
    )

    # used_ai=true but county is Palm Beach → NO cert
    render_and_assert(
        s, "render/no AI cert when used_ai=true but county is neither Broward nor MD",
        "P3-PETITION",
        {"used_ai": True, "county_is_broward": False, "county_is_miami_dade": False},
        must_not_contain=["generative artificial intelligence", "Generative artificial intelligence"],
    )

    # Hard rule render-side check: P3-ORDER never has AI cert even with used_ai=true
    render_and_assert(
        s, "render/hard-rule: P3-ORDER no AI cert even with used_ai=true",
        "P3-ORDER",
        {"used_ai": True, "county_is_broward": True, "county_is_miami_dade": True},
        must_not_contain=["generative artificial intelligence", "Generative artificial intelligence"],
    )

    # Intestate path — no testate-specific allegations. ("codicil" intentionally
    # not blacklisted: an intestate petition correctly says "petitioner is
    # unaware of any unrevoked wills or codicils of decedent" which mentions
    # the word; we instead check for the testate-only "last will dated" phrase.)
    render_and_assert(
        s, "render/intestate P3-PETITION drops will-dated allegation",
        "P3-PETITION",
        {"is_testate": False, "has_codicil": False, "is_self_proved": False, "will_date": "", "will_location": ""},
        must_not_contain=["last will dated", "accompanies this petition"],
    )

    # Multi-petitioner: both names render
    render_and_assert(
        s, "render/multi-petitioner P3-PETITION lists both names",
        "P3-PETITION",
        {
            "multiple_petitioners": True,
            "petitioner_label": "Petitioners",
            "petitioner_names": "Margaret Torres and Thomas Hartley",
            "petitioners": [
                {"pet_name": "Margaret Torres", "pet_address": "300 SE 2nd St", "pet_interest": "Daughter"},
                {"pet_name": "Thomas Hartley", "pet_address": "88 Coral Way", "pet_interest": "Son"},
            ],
        },
        must_contain=["Margaret Torres", "Thomas Hartley"],
    )

    # Ancillary: no domicile-county sentence
    render_and_assert(
        s, "render/ancillary P3-PETITION drops Florida-domicile language",
        "P3-PETITION",
        {"is_ancillary": True, "decedent_domicile_state": "France"},
        must_not_contain=["resident of Broward County, Florida"],
    )

    # P2-ORDER testate path: combined Order Admitting Will + Summary Admin
    render_and_assert(
        s, "render/P2-ORDER testate: combined will-admit + summary admin",
        "P2-ORDER",
        {"is_testate": True},
        must_contain=["WILL"],  # will-admit language present
    )

    # P2-ORDER intestate: standalone summary admin order, NO will-admit
    render_and_assert(
        s, "render/P2-ORDER intestate: no will-admit clause",
        "P2-ORDER",
        {"is_testate": False, "has_codicil": False, "will_date": "", "is_self_proved": False},
        must_not_contain=["admitted to probate"],
    )

    # G3-025: Jill's bar number renders
    render_and_assert(
        s, "render/G3-025 with Jill as signing attorney",
        "G3-025",
        {
            "attorney_name": "Jill R. Ginsberg",
            "attorney_bar_no": "813850",
            "attorney_email": "jill@ginsbergshulman.com",
            "attorney_phone": "954-332-2310",
            "aip_name": "Theodore Whitfield",
            "aip_name_upper": "THEODORE WHITFIELD",
            "decedent_name": "Theodore Whitfield",
            "decedent_full_name": "Theodore Whitfield",
        },
        must_contain=["813850", "Jill R. Ginsberg"],
        must_not_contain=["150762"],  # David's bar must not leak in
    )


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def write_md_report(suite: TestSuite, path: Path) -> None:
    summary = suite.summary()
    lines = [
        "# Auto-Test Results",
        "",
        f"**Run:** `python3 scripts/auto_test.py`  ",
        f"**Tests:** {len(suite.results)} total — "
        f"{summary['PASS']} PASS, {summary['FAIL']} FAIL, {summary['SKIP']} SKIP",
        "",
        "| Test | Status | Detail |",
        "|------|--------|--------|",
    ]
    for r in suite.results:
        d = (r.detail or "").replace("\n", " · ").replace("|", "\\|")
        if len(d) > 140:
            d = d[:140] + "…"
        lines.append(f"| `{r.name}` | {r.status} | {d} |")
    if summary["FAIL"]:
        lines.extend(["", "## Failures", ""])
        for r in suite.results:
            if r.is_fail:
                lines.append(f"### `{r.name}`")
                lines.append("")
                lines.append("```")
                lines.append(r.detail.strip())
                lines.append("```")
                lines.append("")
    path.write_text("\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--md", action="store_true",
                    help="write TEST_RESULTS_AUTO.md alongside printing to stdout")
    args = ap.parse_args()

    suite = TestSuite()
    test_tag_audit(suite)
    test_builder_determinism(suite)
    test_hard_rule_no_ai_cert_on_judge_signed(suite)
    test_forms_json_sanity(suite)
    test_render_suite(suite)

    summary = suite.summary()
    if args.verbose or summary["FAIL"]:
        for r in suite.results:
            marker = {"PASS": "✓", "FAIL": "✗", "SKIP": "·"}[r.status]
            line = f"  {marker} {r.name}"
            if r.detail and (r.is_fail or args.verbose):
                first = r.detail.splitlines()[0] if r.detail else ""
                line += f"  ({first[:120]})"
            print(line)

    print()
    print(f"PASS={summary['PASS']}  FAIL={summary['FAIL']}  SKIP={summary['SKIP']}  "
          f"({len(suite.results)} total)")

    if args.md:
        out_path = ROOT / "TEST_RESULTS_AUTO.md"
        write_md_report(suite, out_path)
        print(f"Wrote {out_path.relative_to(ROOT)}")

    return 0 if summary["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
