# Auto-test deps

This directory contains the Node-side renderer for `scripts/auto_test.py`.

## One-time setup

```bash
cd scripts/test
npm install
```

This pulls `docxtemplater` and `pizzip` into `node_modules/` (gitignored).

## How it works

`auto_test.py` shells out to `node render.js <template> <data.json> <out.docx>`
once per render test. The Node process is the only thing that knows how to
run docxtemplater conditionals — the Python harness orchestrates inputs and
verifies outputs, but the rendering itself happens in JS to match what the
browser does in production.

## Files

- `package.json` — pins docxtemplater + pizzip versions
- `render.js` — CLI: takes a template + JSON data, writes rendered .docx
- `node_modules/` — installed deps (gitignored)
- `package-lock.json` — npm lockfile (gitignored; the test harness only
  needs the deps to exist, not to be byte-identical across machines)
