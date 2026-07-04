/* Static test: Field Observations depth — Slice 12 (Prepared organization).
 *
 * Covers the preparation-tray clarity pass over the central Prepared mode:
 *   1. Prepared groups artifacts by process type via a shared type table
 *      (pdf_text now; image_text / audio_transcript reserved for the future),
 *      and only renders a group when real artifacts of that type exist.
 *   2. Cards surface clarity metadata: a type label, source origin, filename,
 *      timestamp, and a cheap client-side character + word count.
 *   3. The offer action reads as an explicit "Offer prepared text to Nexus".
 *   4. The empty state promises text captures / transcripts appear only after
 *      explicit preparation, and makes no claim that image/audio work today.
 *   5. Consent boundary preserved: the Prepared render performs no fetch, no
 *      auto-submit, no /rose-mirror, and adds no browser storage. Hand-off stays
 *      the pre-existing explicit-click path (studioBringProcessedTextIntoNexus →
 *      studioPopulateNexusInput, which never submits).
 *
 * Static/DOM assertions over studio.html markup and its inline script; no
 * server required.
 *
 * Usage:  node tests/studio-fo-prepared-organization.test.js
 * Deps:   jsdom
 */
'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (_) {
  try { JSDOM = require('/tmp/node_modules/jsdom').JSDOM; }
  catch (e) {
    console.error('jsdom not installed — run: npm i jsdom');
    process.exit(2);
  }
}

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

// Extract the Prepared render body once for scoped checks.
const renderMatch = src.match(/function studioRenderPreparedField[\s\S]*?\n}/);
const render = renderMatch ? renderMatch[0] : '';

const cardMatch = src.match(/function foProcessedTextCard[\s\S]*?\n}/);
const card = cardMatch ? cardMatch[0] : '';

// ---------------------------------------------------------------------------
// 1) Prepared groups artifacts by process type via a shared, forward-safe table.
// ---------------------------------------------------------------------------
console.log('prepared organizes artifacts by process type');

assert(render !== '', 'studioRenderPreparedField() body is extractable');
assert(/const FO_PREPARED_TYPES\s*=/.test(src),
  'a shared FO_PREPARED_TYPES table declares the known process types');
['pdf_text', 'image_text', 'audio_transcript'].forEach((t) => {
  assert(new RegExp(`FO_PREPARED_TYPES[\\s\\S]{0,400}${t}`).test(src),
    `${t} appears in the prepared type table`);
});
assert(/FO_PREPARED_TYPES\.map\(/.test(render),
  'prepared iterates the type table to build one group per type');
// A group only renders when it actually has items — no empty scaffolds that
// would imply an unbuilt capability.
assert(/if\s*\(\s*!items\.length\s*\)\s*return\s*''/.test(render),
  'an empty type group renders nothing (no placeholder for absent types)');
assert(/data-fo-prepared-group=/.test(render),
  'each rendered group carries a data-fo-prepared-group hook');

// ---------------------------------------------------------------------------
// 2) Cards surface clarity metadata (label, origin, filename, date, counts).
// ---------------------------------------------------------------------------
console.log('cards surface clarity metadata');

assert(/meta\.label/.test(render) && /meta\.origin/.test(render),
  'card meta includes the type label and origin');
assert(/filename/.test(render),
  'card title falls back through the source media filename');
assert(/created_at[\s\S]{0,60}slice\(0,\s*10\)/.test(render),
  'card meta shows a timestamp (created_at) when present');
assert(card !== '', 'foProcessedTextCard() body is extractable');
assert(/function foWordCount\s*\(/.test(src),
  'a cheap client-side foWordCount() helper exists');
assert(/split\(\/\\s\+\//.test(src.match(/function foWordCount[\s\S]*?\n}/)[0]),
  'foWordCount splits on whitespace (no fetch, purely local)');
assert(/foWordCount\(text\)/.test(card),
  'the processed-text card computes a word count from held text');
assert(/words[\s\S]{0,40}chars/.test(card),
  'the card summary shows both word and character counts');

// ---------------------------------------------------------------------------
// 3) The offer action reads as an explicit "Offer prepared text to Nexus".
// ---------------------------------------------------------------------------
console.log('explicit offer action copy');

assert(/Offer prepared text to Nexus/.test(card),
  'the hand-off button says "Offer prepared text to Nexus"');
assert(!/Bring forward to Nexus/.test(card),
  'the older ambiguous "Bring forward" label is gone from the card');
// The button still routes through the pre-existing explicit-only hand-off.
assert(/fo-processed-bring-btn/.test(render) &&
  /studioBringProcessedTextIntoNexus/.test(render),
  'the offer button wires to the existing explicit hand-off handler');

// ---------------------------------------------------------------------------
// 4) Empty state: preparation-only promise, no false image/audio claim.
// ---------------------------------------------------------------------------
console.log('empty state sets honest expectations');

const emptyMatch = render.match(/!all\.length[\s\S]*?host\.innerHTML\s*=\s*'([^']*)'/);
const emptyCopy = emptyMatch ? emptyMatch[1].toLowerCase() : '';
assert(emptyCopy !== '', 'prepared empty-state copy is extractable');
assert(/prepared/.test(emptyCopy) && /rest here|gather here|appear here|will/.test(emptyCopy),
  'empty state says prepared material will appear here after preparation');
assert(/extract text|side archive/.test(emptyCopy),
  'empty state points to the explicit Extract text step in the side Archive');
// No claim that image OCR / audio transcription works right now.
assert(!/(image|audio|transcript)[^.]{0,40}(now|available|supported|works|ready)/.test(emptyCopy),
  'empty state makes no claim that image/audio preparation works today');

// ---------------------------------------------------------------------------
// 5) Consent boundary: no fetch, no submit, no rose-mirror, no new storage.
// ---------------------------------------------------------------------------
console.log('prepared preserves the consent boundary');

assert(!/fetch\s*\(/.test(render),
  'prepared render performs no fetch (view-only over loaded state)');
assert(!/rose-mirror|\.submit\s*\(/.test(render),
  'prepared render never calls /rose-mirror and never auto-submits');
assert(!/localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie/.test(render),
  'prepared render adds no browser storage');
// Counts still read processed pdf_text state and stay client-only.
const updater = (src.match(/function studioUpdateFoModeCounts[\s\S]*?\n}/) || [''])[0];
assert(/state\.fieldObservationProcessed\b/.test(updater) && /pdf_text/.test(updater),
  'prepared count still reads processed pdf_text state');
assert(!/fetch\s*\(|rose-mirror|\.submit\s*\(/.test(updater),
  'count updater performs no fetch / submit / rose-mirror call');

// ---------------------------------------------------------------------------
// 6) DOM sanity: the prepared panel + host still exist and refresh counts.
// ---------------------------------------------------------------------------
console.log('prepared panel wiring intact');

const dom = new JSDOM(src);
const doc = dom.window.document;
assert(doc.getElementById('fo-panel-prepared') !== null, 'prepared panel exists');
assert(doc.getElementById('fo-prepared-body') !== null, 'prepared body host exists');
assert(/function studioRenderPreparedField[\s\S]{0,120}studioUpdateFoModeCounts/.test(src),
  'prepared render refreshes the mode counts');
const panelText = doc.getElementById('fo-panel-prepared').textContent.replace(/\s+/g, ' ').toLowerCase();
assert(/only sees what you offer/.test(panelText),
  'prepared panel reaffirms Nexus only sees what you offer');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
