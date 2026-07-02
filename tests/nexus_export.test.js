#!/usr/bin/env node
// Structural tests for the Nexus full-thread export / action layer.
// These assert that the client-side export functions and typed-command
// recognition are present in the served Compass (index.html) and Studio
// (studio.html) entry files, and that the privacy contract holds: exports
// are local (Blob/download or window.print) and never posted to the server
// or any admin endpoint.
//
// Run: node tests/nexus_export.test.js
// No test framework required.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let checks = 0;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assert(cond, label) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  ✗ ${label}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

// ── Compass (index.html) ──────────────────────────────────────
console.log('Compass Nexus export (index.html)');
const compass = read('index.html');
[
  'compassNexusBuildTranscript',
  'compassNexusExportMarkdown',
  'compassNexusExportText',
  'compassNexusExportPDF',
  'compassNexusDetectAction',
  'compassNexusShowActionCard',
  'compassNexusDownload'
].forEach(fn => assert(compass.includes(`function ${fn}`), `defines ${fn}()`));
assert(/id="compass-nexus-keep"/.test(compass), 'header has keep/export affordance');
assert(compass.includes('compassNexusDetectAction(msg)') || /compassNexusDetectAction\(/.test(compass), 'send handler consults action detection');
assert(compass.includes('new Blob'), 'export uses client-side Blob download');
assert(compass.includes('window.print'), 'PDF export uses browser print pipeline');
// Golden Thread clarity copy near the keep affordance.
assert(/whole conversation/i.test(compass) && /Golden Thread/.test(compass), 'clarifies knot vs full-thread export');

// ── Studio (studio.html) ──────────────────────────────────────
console.log('Studio Nexus export (studio.html)');
const studio = read('studio.html');
[
  'studioNexusBuildTranscript',
  'studioNexusExportMarkdown',
  'studioNexusExportText',
  'studioNexusExportPDF',
  'studioNexusDetectAction',
  'studioNexusShowActionCard'
].forEach(fn => assert(studio.includes(`function ${fn}`), `defines ${fn}()`));
assert(/id="nexus-keep-btn"/.test(studio), 'header has keep/export affordance');
assert(studio.includes('new Blob'), 'export uses client-side Blob download');
assert(studio.includes('window.print'), 'PDF export uses browser print pipeline');

// ── Privacy contract ──────────────────────────────────────────
// The export helpers must not POST thread content anywhere. We check that no
// export function name is used as the argument to a fetch(...) call and that
// exports do not reference admin endpoints.
console.log('Privacy contract');
[['index.html', compass], ['studio.html', studio]].forEach(([name, src]) => {
  // Grab the export region heuristically: from the first export helper to the
  // send handler. Simpler: assert the export helpers themselves contain no
  // fetch( and no /admin reference by scanning each function body.
  const exportFns = name === 'index.html'
    ? ['compassNexusExportMarkdown', 'compassNexusExportText', 'compassNexusExportPDF', 'compassNexusDownload', 'compassNexusBuildTranscript']
    : ['studioNexusExportMarkdown', 'studioNexusExportText', 'studioNexusExportPDF', 'studioNexusDownload', 'studioNexusBuildTranscript'];
  exportFns.forEach(fn => {
    const start = src.indexOf(`function ${fn}`);
    if (start === -1) return; // covered by the presence checks above
    // Extract a bounded slice (the function + a little) and check it.
    const slice = src.slice(start, start + 1600);
    const body = slice.slice(0, slice.indexOf('\nfunction ') === -1 ? slice.length : slice.indexOf('\nfunction '));
    assert(!/fetch\s*\(/.test(body), `${name}: ${fn}() does not call fetch()`);
    assert(!/admin/i.test(body), `${name}: ${fn}() references no admin endpoint`);
  });
});

// ── Action-detection behaviour (against the REAL served function) ─
// Extract the actual detector from each served file and evaluate it, so this
// test tracks production code rather than a hand-kept copy. This is what would
// have caught the 2026-07 regression where natural phrasing ("do a pdf of our
// conversation") fell through to the AI, which replied it could not save files.
console.log('Action detection behaviour');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`could not find ${name} in served file`);
  // Walk braces from the first '{' to find the matching close.
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const body = src.slice(start, i);
  // eslint-disable-next-line no-new-func
  return new Function(`${body}; return ${name};`)();
}

const compassDetect = extractFn(compass, 'compassNexusDetectAction');
const studioDetect  = extractFn(studio, 'studioNexusDetectAction');

// Phrases that MUST be recognized. Value is the expected format ('menu' when
// no format is named). Includes the user's exact failed phrase.
const RECOGNIZE = [
  ['do a pdf of our conversation', 'pdf'],          // ← the exact reported failure
  ['make a pdf of this conversation', 'pdf'],
  ['can you save this as a pdf', 'pdf'],
  ['save our conversation as pdf', 'pdf'],
  ['export our conversation to pdf', 'pdf'],
  ['download this chat as pdf', 'pdf'],
  ['save the whole thread', 'menu'],
  ['can you export all of this', 'menu'],
  ['export this thread as PDF', 'pdf'],
  ['save this conversation', 'menu'],
  ['download the full thread as text', 'text'],
  ['save full thread', 'menu'],
  ['preserve our dialogue as markdown', 'markdown'],
];
// Phrases that must be IGNORED (ordinary conversation → goes to Nexus).
const IGNORE = [
  'what does this hexagram mean?',
  'I want to save more time in my day',
  'keep this in mind as we go',
  'do you think this is right',
  'make the text bigger please',
  'can you summarize our conversation',
  'what should I do about this',
];

[['Compass', compassDetect], ['Studio', studioDetect]].forEach(([label, fn]) => {
  RECOGNIZE.forEach(([phrase, expected]) => {
    assert(fn(phrase) === expected, `${label} recognizes "${phrase}" → ${expected}`);
  });
  IGNORE.forEach(phrase => {
    assert(fn(phrase) === null, `${label} ignores "${phrase}"`);
  });
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('All Nexus export structural tests passed.');
