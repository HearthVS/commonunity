'use strict';

const fs = require('fs');
const path = require('path');

const indexSrc = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('OM Cipher — collapsed threshold name narrative');

assert(/<div class="[^"]*\bom-cipher-card\b[^"]*\bis-empty\b[^"]*" id="profile-name-narrative-card"/.test(indexSrc),
  '#profile-name-narrative-card exists and uses OM Cipher card styling');
assert(/<details class="name-narrative-details">[\s\S]*?<summary>/.test(indexSrc),
  'name narrative is wrapped in a native <details> disclosure');
assert(!/<details class="name-narrative-details"\s+open/.test(indexSrc),
  'name narrative is collapsed by default');
assert(/<span class="om-cipher-card-title">The story of your name<\/span>/.test(indexSrc),
  'summary labels the stored name essay clearly');
assert(/<textarea[^>]+id="profile-name-narrative-essay"[^>]+readonly/.test(indexSrc),
  'name narrative is displayed in a readonly textarea-style input');
assert(!/<textarea[^>]+id="profile-name-narrative-essay"[^>]+data-profile/.test(indexSrc),
  'name narrative does not bind as an editable profile field');
assert(/id="btn-copy-name-narrative"/.test(indexSrc),
  'copy narrative button exists');

assert(/function\s+getThresholdNameNarrative\s*\(/.test(indexSrc), 'ThresholdGate name narrative reader exists');
assert(/function\s+populateNameNarrativeEssay\s*\(/.test(indexSrc), 'populateNameNarrativeEssay helper exists');
assert(/contract\.name_narrative/.test(indexSrc), 'helper reads contract.name_narrative');
assert(/populateNameNarrativeEssay\(\);/.test(indexSrc), 'OM Cipher modal populates name narrative on open');
assert(/btn-copy-name-narrative/.test(indexSrc) && /navigator\.clipboard/.test(indexSrc), 'copy action uses clipboard when available');

assert(/\.name-narrative-details\s*>\s*summary\s*\{[^}]*cursor:\s*pointer/.test(indexSrc),
  'disclosure summary is visibly interactive');
assert(/\.name-narrative-input\s*\{[^}]*min-height:\s*15rem/.test(indexSrc),
  'essay field has enough readable height when expanded');

if (failed > 0) {
  console.error('\n' + failed + ' assertion(s) failed.');
  process.exit(1);
}

console.log('\nAll OM Cipher name narrative assertions passed.');
