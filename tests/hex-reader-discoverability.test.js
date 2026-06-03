/* Hexagram reader · discoverability + placement
 *
 * cOMpass usability fix: the Hexagram Reader used to sit at the very
 * bottom of each room's card, below the "Guide Only" facilitator panel,
 * so first-time users never found it. It now opens BESIDE the Session
 * Notes inside Layer 1 (.notes-with-reader). The embedded panels are the
 * discoverable entry point — the redundant top-toolbar button was removed.
 *
 * This is a static-assertion test over index.html (no DOM boot). It
 * guards:
 *   • exactly four readers (one per room), each inside a
 *     .notes-with-reader block in the Layer 1 raw panel
 *   • no reader is left stranded at the bottom of a card
 *   • the redundant top-toolbar entry point (#btn-read-gene-key +
 *     openHexReader()) is removed — embedded panels are the entry point
 *   • the passcode input stays type="password" and is not pre-filled
 *   • the reader markup precedes the notes column in DOM order, so the
 *     mobile stacked layout shows the reader first (discoverable)
 *
 *   Run: node tests/hex-reader-discoverability.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let pass = 0;
function ok(cond, label) {
  if (!cond) throw new Error('FAILED: ' + label);
  console.log('  ok  ' + label);
  pass++;
}

const POINTS = ['work', 'lens', 'field', 'call'];

console.log('1. exactly four readers, all relocated beside the notes');
const readerMatches = index.match(/class="hex-reader" data-hex-reader="/g) || [];
ok(readerMatches.length === 4, 'exactly four .hex-reader blocks (one per room)');

const wrapperMatches = index.match(/class="notes-with-reader"/g) || [];
ok(wrapperMatches.length === 4, 'exactly four .notes-with-reader wrappers');

console.log('\n2. each reader lives inside its room\'s Layer 1 raw panel, beside the notes');
for (const p of POINTS) {
  // The raw panel for this point: from data-layer="raw" up to the qa-section.
  const rawStart = index.indexOf(`<textarea class="layer-textarea" data-key="${p}.raw"`);
  ok(rawStart > 0, `${p}: Layer 1 raw textarea present`);

  // Walk back to the enclosing notes-with-reader wrapper and confirm the
  // reader + the notes textarea share it.
  const wrapStart = index.lastIndexOf('class="notes-with-reader"', rawStart);
  ok(wrapStart > 0 && wrapStart < rawStart, `${p}: raw notes sit inside a .notes-with-reader`);

  const wrapSlice = index.slice(wrapStart, rawStart);
  ok(wrapSlice.includes(`data-hex-reader="${p}"`),
     `${p}: the reader is inside the same .notes-with-reader as the notes`);

  // DOM order: reader markup must come BEFORE the notes column so the
  // mobile stacked layout shows the reader first (discoverable).
  const readerIdx = index.indexOf(`data-hex-reader="${p}"`);
  const notesColIdx = index.indexOf(`data-key="${p}.raw"`);
  ok(readerIdx > 0 && readerIdx < notesColIdx,
     `${p}: reader precedes the notes column in DOM order (reader-first on mobile)`);
}

console.log('\n3. no reader is stranded at the bottom of a card');
// The old layout placed the reader immediately before the card-closing
// comment. Assert that pattern is gone for every room.
for (const p of POINTS) {
  const stranded = new RegExp(`data-hex-reader="${p}"[\\s\\S]{0,400}?<!-- /card ${p} -->`);
  ok(!stranded.test(index), `${p}: reader is not left just above the card close`);
}

console.log('\n4. the redundant top-toolbar entry point is removed');
// The Hexagram Reader is now clear in the workflow (embedded beside the
// Session Notes in every room), so the separate top-toolbar button was
// removed. The embedded readers (asserted above) are the entry point.
ok(!/id="btn-read-gene-key"/.test(index),
   'no #btn-read-gene-key toolbar button remains');
ok(!/function openHexReader\b/.test(index),
   'the now-unused openHexReader() handler is removed');
const actionsStart = index.indexOf('class="compass-actions"');
const actionsEnd = index.indexOf('class="compass-tabs"', actionsStart);
const actionsSlice = index.slice(actionsStart, actionsEnd);
ok(!actionsSlice.includes('btn-read-gene-key'),
   'the compass toolbar no longer carries a Hexagram Reader button');
// Guard against a stray duplicate label leaking back into the toolbar
// region (the embedded panels keep their own "Hexagram Reader" labels).
ok(!actionsSlice.includes('Hexagram Reader'),
   'no "Hexagram Reader" label in the top toolbar (embedded panels keep theirs)');

console.log('\n6. the passcode flow is unchanged (no exposure)');
const codeInputs = index.match(/class="hex-reader-code-input" data-hex-action="code-input"/g) || [];
ok(codeInputs.length === 4, 'four activation-code inputs (one per reader)');
const pwInputs = index.match(/type="password" class="hex-reader-code-input"/g) || [];
ok(pwInputs.length === 4, 'every activation-code input is type="password"');
// No value="..." pre-fill on the code input, and no email field introduced.
ok(!/hex-reader-code-input[^>]*value=/.test(index),
   'the activation-code input is never pre-filled with a value');
ok(/data-hex-action="unlock-show"/.test(index),
   'the unlock-show gate path is preserved');

console.log('\n7. responsive layout: side-by-side desktop, stacked on small screens');
ok(/\.notes-with-reader\s*\{[\s\S]*?display:\s*grid/.test(index),
   '.notes-with-reader is a resizable grid row on desktop');
ok(/@media \(max-width: 860px\)[\s\S]*?\.notes-with-reader\s*\{[\s\S]*?grid-template-columns:\s*1fr/.test(index),
   '.notes-with-reader collapses to a single column on small screens');

console.log(`\n${pass} passed`);
