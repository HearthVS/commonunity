/* Hexagram reader · discoverability + placement
 *
 * cOMpass usability fix: the Hexagram Reader used to sit at the very
 * bottom of each room's card, below the "Guide Only" facilitator panel,
 * so first-time users never found it. It now opens BESIDE the Session
 * Notes inside Layer 1 (.notes-with-reader), and a top-level
 * "Hexagram Reader" toolbar action brings it into view.
 *
 * This is a static-assertion test over index.html (no DOM boot). It
 * guards:
 *   • exactly four readers (one per room), each inside a
 *     .notes-with-reader block in the Layer 1 raw panel
 *   • no reader is left stranded at the bottom of a card
 *   • a discoverable top-level #btn-read-gene-key action exists, is
 *     labelled "Hexagram Reader", and is wired to openHexReader()
 *   • openHexReader switches to Layer 1, reveals the code row, scrolls
 *     into view, and NEVER bypasses the activation-code gate
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

console.log('\n4. a discoverable top-level "Hexagram Reader" action exists');
ok(/id="btn-read-gene-key"/.test(index), '#btn-read-gene-key toolbar button exists');
ok(/>\s*Hexagram Reader\s*</.test(index), 'the action is labelled "Hexagram Reader"');
ok(!/Read Gene Key/.test(index), 'the old "Read Gene Key" label is gone (no misleading duplicate)');
// It sits in the compass toolbar (compass-actions), not buried in a card.
const actionsStart = index.indexOf('class="compass-actions"');
const actionsEnd = index.indexOf('class="compass-tabs"', actionsStart);
const actionsSlice = index.slice(actionsStart, actionsEnd);
ok(actionsSlice.includes('id="btn-read-gene-key"'),
   'the Hexagram Reader action lives in the top compass toolbar');

console.log('\n5. the action is wired to openHexReader and respects the gate');
ok(/function openHexReader\(\)/.test(index), 'openHexReader() is defined');
ok(/getElementById\('btn-read-gene-key'\)[\s\S]{0,80}addEventListener\('click', openHexReader\)/.test(index),
   '#btn-read-gene-key is wired to openHexReader');

function extractFn(src, sig) {
  const start = src.indexOf(sig);
  if (start < 0) return '';
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const openFn = extractFn(index, 'function openHexReader()');
ok(openFn.length > 0, 'openHexReader body extracted');
ok(/dataset\.layer === 'raw'/.test(openFn), 'openHexReader switches the card to Layer 1 (raw)');
ok(/scrollIntoView/.test(openFn), 'openHexReader scrolls the reader into view');
ok(/if \(!HEX_UNLOCKED\)/.test(openFn),
   'openHexReader only reveals the code row when still locked');
ok(!/HEX_UNLOCKED\s*=\s*true/.test(openFn),
   'openHexReader NEVER sets HEX_UNLOCKED (does not bypass the activation gate)');
ok(!/verifyHexCode/.test(openFn) || /code-input/.test(openFn),
   'openHexReader does not auto-verify a code');

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
