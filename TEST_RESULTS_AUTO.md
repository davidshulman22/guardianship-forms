# Auto-Test Results

**Run:** `python3 scripts/auto_test.py`  
**Tests:** 19 total — 19 PASS, 0 FAIL, 0 SKIP

| Test | Status | Detail |
|------|--------|--------|
| `structural/tag-audit` | PASS |  |
| `structural/builder-determinism` | PASS | rebuilt 38 templates, all content-stable |
| `structural/hard-rule-no-ai-cert-on-judge-signed` | PASS | checked 5 judge-signed templates |
| `structural/forms-json-sanity` | PASS | 38 forms, all templates present |
| `render/BUG-1: single FL-resident PR (P3-PETITION)` | PASS |  |
| `render/single non-FL-resident PR (P3-PETITION)` | PASS |  |
| `render/BUG-4: codicil dates on P3-LETTERS` | PASS |  |
| `render/no codicil on P3-LETTERS when has_codicil=false` | PASS |  |
| `render/BUG-3: Miami-Dade AI cert (used_ai=true, county=miami-dade)` | PASS |  |
| `render/Broward AI cert (used_ai=true, county=broward)` | PASS |  |
| `render/no AI cert when used_ai=false (Broward matter)` | PASS |  |
| `render/no AI cert when used_ai=true but county is neither Broward nor MD` | PASS |  |
| `render/hard-rule: P3-ORDER no AI cert even with used_ai=true` | PASS |  |
| `render/intestate P3-PETITION drops will-dated allegation` | PASS |  |
| `render/multi-petitioner P3-PETITION lists both names` | PASS |  |
| `render/ancillary P3-PETITION drops Florida-domicile language` | PASS |  |
| `render/P2-ORDER testate: combined will-admit + summary admin` | PASS |  |
| `render/P2-ORDER intestate: no will-admit clause` | PASS |  |
| `render/G3-025 with Jill as signing attorney` | PASS |  |
