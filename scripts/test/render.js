#!/usr/bin/env node
// Render a template with given data via docxtemplater.
// Usage: node render.js <template.docx> <data.json> <output.docx>
// Exit code 0 on success, 1 on render failure (e.g. missing tag).
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const [, , templatePath, dataPath, outPath] = process.argv;
if (!templatePath || !dataPath || !outPath) {
  console.error('Usage: node render.js <template.docx> <data.json> <output.docx>');
  process.exit(2);
}

const content = fs.readFileSync(templatePath, 'binary');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const zip = new PizZip(content);

const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
});

try {
  doc.render(data);
} catch (err) {
  console.error('RENDER ERROR:', err.message);
  if (err.properties && err.properties.errors) {
    err.properties.errors.forEach((e) =>
      console.error(' -', e.name, e.properties && e.properties.explanation),
    );
  }
  process.exit(1);
}

const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outPath, buf);
process.exit(0);
