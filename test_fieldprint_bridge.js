/* FieldPrint Builder open/ready bridge — state-machine regression tests.
   Run: node --test test_fieldprint_bridge.js   (Node 20+, no dependencies)

   Guards a CRITICAL integration defect found in browser QA: opening the Builder
   to deliver a reviewed content prefill must NOT also push the full sanitized
   model. That full-model path (phV5PostModel → fieldprint-model →
   hydrateFromModel) is destructive — it resets hero framing/roleOverrides and
   can surface The Work raw transcript via the buildWebsitePreview body
   fallback. So while a prefill is pending, the bridge must post ONLY
   `fieldprint-prefill`; a normal open (no pending prefill) must still post
   `fieldprint-model`.

   The shipped phV5 bridge functions are extracted from studio.html (no copy)
   and run against DOM/window mocks so the open→ready handshake is verifiable. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

function extractFn(name) {
  const start = HTML.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' must exist in studio.html');
  let i = HTML.indexOf('{', start);
  let depth = 0;
  for (; i < HTML.length; i++) {
    const c = HTML[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return HTML.slice(start, i);
}

const ORIGIN = 'http://localhost';
const NAMES = ['phV5BuildModel', 'phV5PostModel', 'phV5FlushPrefill',
  'phV5WireBridge', 'phV5ConsumeIntent', 'phV5RevealAndLoad',
  'phV5OwnerKey', 'openFieldprintV5', 'phV5SendPrefill'];

function setup() {
  const posted = [];
  const contentWindow = { postMessage: (msg) => posted.push(msg) };
  const frame = {
    _src: 'about:blank',
    contentWindow: contentWindow,
    getAttribute: (k) => (k === 'src' ? frame._src : null),
    setAttribute: (k, v) => { if (k === 'src') frame._src = v; },
  };
  const overlay = { hidden: true, classList: { add() {}, remove() {} } };
  const documentMock = {
    getElementById: (id) => (id === 'fieldprint-v5-frame' ? frame
      : id === 'fieldprint-v5-overlay' ? overlay : null),
    body: { classList: { add() {}, remove() {} } },
  };
  const windowMock = {
    location: { origin: ORIGIN },
    _msg: null,
    addEventListener(type, fn) { if (type === 'message') this._msg = fn; },
    removeEventListener() {},
  };
  // A truthy sanitized model so phV5PostModel WOULD post fieldprint-model if
  // (wrongly) called — makes an accidental full-model post detectable.
  const buildWebsitePreview = () => ({ raw: 'RAW TRANSCRIPT LEAK' });
  const phPublicHomeModel = (m) => ({ rooms: [], _src: m });

  // phV5OwnerKey derives a stable key from the person identity via
  // _studioCipherHashHex; supply both so the owner-carrying posts resolve.
  const state = { compassData: { companion: 'QA Tester' } };
  const _studioCipherHashHex = (s, l) => 'h' + String(s).length + 'x' + l;

  const src = "var phV5Bridged=false, phV5PendingPrefill=null, phV5PrefillAck=null, phV5OpenIntent='none';\n" +
    NAMES.map(extractFn).join('\n') +
    '\nreturn { sendPrefill: phV5SendPrefill, open: openFieldprintV5, wire: phV5WireBridge };';
  const bridge = new Function(
    'document', 'window', 'buildWebsitePreview', 'phPublicHomeModel', 'openHomeWorkbench',
    'state', '_studioCipherHashHex', src
  )(documentMock, windowMock, buildWebsitePreview, phPublicHomeModel, () => {},
    state, _studioCipherHashHex);

  const fireReady = () => windowMock._msg({ origin: ORIGIN, source: contentWindow, data: { type: 'fieldprint-ready' } });
  const types = () => posted.map((m) => m.type);
  return { bridge, posted, types, frame, fireReady };
}

test('fresh-load prefill: ready posts ONLY fieldprint-prefill, never the full model', () => {
  const s = setup();
  s.bridge.sendPrefill([{ key: 'make', title: 'Only Heading' }]);
  // Opening a blank frame just sets src; nothing posted until ready.
  assert.deepStrictEqual(s.types(), [], 'no message before ready');
  assert.strictEqual(s.frame._src, '/fieldprint', 'surface loaded');
  s.fireReady();
  assert.deepStrictEqual(s.types(), ['fieldprint-prefill'], 'only the prefill is posted');
  assert.ok(!s.types().includes('fieldprint-model'), 'the destructive full model is never posted');
  assert.deepStrictEqual(s.posted[0].sections, [{ key: 'make', title: 'Only Heading' }]);
});

test('normal open (no pending prefill): ready posts the full model as before', () => {
  const s = setup();
  s.bridge.open();
  assert.strictEqual(s.frame._src, '/fieldprint');
  s.fireReady();
  assert.deepStrictEqual(s.types(), ['fieldprint-model'], 'legacy live-model handshake preserved');
});

test('already-loaded prefill: flushes inline, no full-model repost', () => {
  const s = setup();
  s.frame._src = '/fieldprint'; // surface already live from a prior open
  s.bridge.sendPrefill([{ key: 'perceive', narrative: 'N' }]);
  assert.deepStrictEqual(s.types(), ['fieldprint-prefill'], 'inline prefill only');
  assert.ok(!s.types().includes('fieldprint-model'), 'no model repost for a live surface');
});

test('passive/load-time ready with no open intent posts NOTHING (draft is never mutated)', () => {
  const s = setup();
  s.bridge.wire();               // listener is live, as it is once the surface loads
  // The iframe posts fieldprint-ready on its own load, after restoring its
  // on-device draft. With no deliberate open, intent is 'none'.
  s.fireReady();
  assert.deepStrictEqual(s.types(), [], 'a bare ready never pushes the destructive full model');
});

test('full page-load sequence: passive ready first → nothing; later reviewed prefill → only prefill', () => {
  const s = setup();
  // 1) Page load: the seeded Builder comes up and announces itself. No open
  //    intent yet, so the seeded hero/body/role draft must be left untouched.
  s.frame._src = '/fieldprint';  // surface is live from its own load
  s.bridge.wire();
  s.fireReady();
  assert.deepStrictEqual(s.types(), [], 'load-time ready did not touch the seeded draft');
  // 2) Person now runs the reviewed handoff of a single field.
  s.bridge.sendPrefill([{ key: 'make', title: 'Only Heading' }]);
  assert.deepStrictEqual(s.types(), ['fieldprint-prefill'], 'only the reviewed field is posted');
  assert.ok(!s.types().includes('fieldprint-model'),
    'the destructive full model is never posted, so seeded framing/body/role survive');
});

test('a stray ready AFTER a consumed prefill still posts nothing (intent does not replay)', () => {
  const s = setup();
  s.bridge.sendPrefill([{ key: 'make', title: 'X' }]);
  s.fireReady();                 // consumes the 'prefill' intent
  s.fireReady();                 // e.g. a later self-reload — intent is now 'none'
  assert.deepStrictEqual(s.types(), ['fieldprint-prefill'],
    'the prefill fired once; the second, intentless ready mutates nothing');
});

test('raw transcript text is never present in any bridge message', () => {
  const s = setup();
  s.bridge.sendPrefill([{ key: 'make', title: 'Only Heading' }]);
  s.fireReady();
  assert.ok(!/RAW TRANSCRIPT LEAK/.test(JSON.stringify(s.posted)),
    'the buildWebsitePreview raw fallback never reaches the Builder during a prefill');
});
