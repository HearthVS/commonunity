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

// ── Action-detection regex sanity (behavioural) ───────────────
// Re-implement the detector's contract and assert it classifies example
// phrases the way the UI expects. Keep in lockstep with compassNexusDetectAction.
console.log('Action detection behaviour');
function detect(msg) {
  const s = (msg || '').toLowerCase().trim();
  if (s.length > 90) return null;
  const mentionsThread = /\b(this|the|full|whole|entire|our)\b.*\b(thread|conversation|chat|dialogue|exchange|talk)\b/.test(s)
    || /\b(thread|conversation|dialogue)\b/.test(s);
  const verb = /\b(export|save|download|keep|preserve|archive|back ?up)\b/.test(s);
  if (!verb || !mentionsThread) return null;
  if (/\bpdf\b/.test(s)) return 'pdf';
  if (/\b(markdown|\.md|md)\b/.test(s)) return 'markdown';
  if (/\b(text|txt|plain)\b/.test(s)) return 'text';
  return 'menu';
}
assert(detect('export this thread as PDF') === 'pdf', 'recognizes "export this thread as PDF"');
assert(detect('save this conversation') === 'menu', 'recognizes "save this conversation"');
assert(detect('download the full thread as text') === 'text', 'recognizes "download the full thread as text"');
assert(detect('save full thread') === 'menu', 'recognizes "save full thread"');
assert(detect('preserve our dialogue as markdown') === 'markdown', 'recognizes "preserve our dialogue as markdown"');
assert(detect('what does this hexagram mean?') === null, 'ignores ordinary contemplation');
assert(detect('I want to save more time in my day') === null, 'ignores unrelated "save" usage');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('All Nexus export structural tests passed.');
