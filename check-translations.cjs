#!/usr/bin/env node
/** Strict i18n key parity check (F2-M10). */
const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, 'src', 'locales');
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'));
if (files.length < 2) {
  console.error('need at least 2 locale files');
  process.exit(1);
}
const maps = files.map((f) => [f, JSON.parse(fs.readFileSync(path.join(localesDir, f), 'utf8'))]);
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v, key));
    else out[key] = true;
  }
  return out;
}
const [aName, a] = maps[0];
const aKeys = new Set(Object.keys(flatten(a)));
let fail = 0;
for (let i = 1; i < maps.length; i++) {
  const [bName, b] = maps[i];
  const bKeys = new Set(Object.keys(flatten(b)));
  for (const k of aKeys) if (!bKeys.has(k)) { console.error(`${bName} missing ${k}`); fail++; }
  for (const k of bKeys) if (!aKeys.has(k)) { console.error(`${aName} missing ${k}`); fail++; }
}
console.log(`check-translations: ${fail === 0 ? 'OK' : 'FAIL'} (${files.join(', ')})`);
process.exit(fail === 0 ? 0 : 1);
