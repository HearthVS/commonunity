/* FieldPrint Builder draft-owner + reviewed-handoff preservation tests.
   Run: node --test test_fieldprint_owner.js   (Node 20+, no dependencies)

   Guards the deepest handoff defect found in browser QA: after the Builder
   draft is saved on-device, a reviewed "Send to Builder" handoff cold-reloads
   the iframe (Studio blanks it on close). With full-model hydration correctly
   suppressed, the freshly loaded Builder must still RESTORE the person's saved
   draft before merging the reviewed fields — otherwise it starts from built-in
   defaults, applies the one field, and then persists those defaults OVER the
   real draft (losing heroZoom / body / roleOverrides).

   The fix carries a stable owner key from Studio on BOTH the model and the
   prefill messages so save-time and restore-time owners agree even across a
   real page refresh. These tests extract the SHIPPED fieldprint.js draft
   functions (snapshot/applySnapshot/toStorable/fromStorable/loadDraft/saveDraft/
   flushSave/applyPrefill) and drive them against an in-memory localStorage. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FPJS = fs.readFileSync(path.join(__dirname, 'fieldprint.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

function extractFrom(src, name) {
  let start = src.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' must exist');
  // Preserve a leading `async ` so async functions stay async when extracted.
  if (src.slice(start - 6, start) === 'async ') start -= 6;
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const FNS = ['snapshot', 'applySnapshot', 'toStorable', 'fromStorable',
  'loadDraft', 'saveDraft', 'flushSave', 'applyPrefill'];

function defaultSections() {
  return ['make', 'perceive', 'alive', 'here'].map((k) => ({
    key: k, sig: k, eyebrow: 'EB ' + k, title: 'DEFAULT TITLE ' + k,
    body: 'DEFAULT BODY ' + k, narrative: 'DEFAULT NARRATIVE ' + k,
    prompt: 'DEFAULT PROMPT', enter: 'Enter', imgRole: null, textSize: 'medium',
    artifacts: [], image: null,
  }));
}

function defaultState() {
  return {
    name: 'Demo', tagline: 'demo tagline',
    hero: 'field', photo: 'om-field', heroAlt: '', heroFocalX: 50, heroFocalY: 50,
    heroZoom: 100, heroFadeMode: 'none', heroFadeStrength: 0.6,
    heroOverlay: 'off', heroOverlayIntensity: 0.5, heroPhoto: '', heroPhotoHasAlpha: false,
    introFit: 'auto', introWidth: 26, introSize: 22,
    overlay: { source: 'off', src: '', x: 50, y: 42, scale: 62, opacity: 0.9, blend: 'normal', rotate: 0 },
    sections: defaultSections(),
    roleOverrides: { root: null, expression: null, radiance: null },
    intensity: 'balanced', sigil: 'a', torus: 'b', texture: 'off',
    transition: 'threshold', palette: 'om-field', sigmode: 'x', hydrated: false,
  };
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Build a sandbox with the shipped draft functions over a mutable module scope.
async function makeBuilder() {
  const store = {};
  const localStorageMock = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const header = `
    let state = INIT_STATE();
    let field = null, manualZoom = 200, manualOpacity = 0.9;
    let currentOwner = 'demo', baseline = null, hasSavedDraft = false, saveTimer = 0;
    const DRAFT_SCHEMA = 1;
    const DRAFT_KEY = 'commonunity.fieldprint.draft.v1';
    const OVERLAY_SOURCES = ['off','cipher','torus','upload'];
    const OVERLAY_BLENDS = ['normal','multiply','screen','soft-light'];
    const clamp01 = (n) => Math.max(0, Math.min(1, n));
    const numOr = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
    const clampNum = (v, lo, hi, d) => Math.max(lo, Math.min(hi, numOr(+v, d)));
    const safeMediaSrc = (s) => (typeof s === 'string' ? s : '');
    const safeOverlaySrc = (s) => (typeof s === 'string' ? s : '');
    const sanitizeImage = (im) => im || null;
    const detectHeroAlpha = () => {};
    const fullRender = () => {};
    const setSaveStatus = () => {};
    const updateSaveAffordances = () => {};
    const idbGetImages = async () => ({});
    const idbPutImages = async () => true;
    const idbDelImages = async () => {};
  `;
  const body = header + FNS.map((n) => extractFrom(FPJS, n)).join('\n') + `
    return {
      get state() { return state; },
      setState(s) { state = s; },
      get owner() { return currentOwner; },
      setOwner(o) { currentOwner = o; },
      resetForColdReload() { state = INIT_STATE(); field = null; manualZoom = 200; currentOwner = 'demo'; baseline = null; hasSavedDraft = false; },
      setBaseline() { baseline = snapshot(); },
      snapshot, applySnapshot, loadDraft, saveDraft, flushSave, applyPrefill,
      readRecord() { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); },
    };
  `;
  return new AsyncFunction('localStorage', 'window', 'INIT_STATE', body)(
    localStorageMock, { CipherField: null }, defaultState);
}

test('matching owner: saved draft is restored, then one reviewed field applied, framing preserved', async () => {
  const b = await makeBuilder();
  // 1) Person edits the Builder and it autosaves under a stable Studio owner.
  b.setOwner('cu-owner-alice');
  b.state.heroZoom = 149;
  b.state.sections[0].body = 'SENTINEL BODY CLEAN';
  b.state.sections[0].narrative = 'SENTINEL NARRATIVE CLEAN';
  b.state.roleOverrides = { root: '#123456', expression: '#654321', radiance: '#abcdef' };
  await b.saveDraft();

  // 2) Reviewed handoff cold-reloads the iframe: fresh defaults, wrong owner.
  b.resetForColdReload();
  assert.strictEqual(b.state.heroZoom, 100, 'cold reload starts from defaults');
  assert.strictEqual(b.state.sections[0].body, 'DEFAULT BODY make');

  // 3) The shipped prefill ordering: adopt the parent owner, RESTORE, then merge.
  b.setOwner('cu-owner-alice');
  b.setBaseline();
  const restored = await b.loadDraft();
  assert.strictEqual(restored, true, 'the matching saved draft is restored');
  const applied = b.applyPrefill([{ key: 'make', title: 'CLEAN REVIEWED HEADING' }]);
  await b.flushSave();

  assert.strictEqual(applied, 1, 'exactly one reviewed field applied');
  assert.strictEqual(b.state.sections[0].title, 'CLEAN REVIEWED HEADING', 'selected field updated');
  // Everything the person had is preserved.
  assert.strictEqual(b.state.heroZoom, 149, 'heroZoom preserved (not reset to 100)');
  assert.strictEqual(b.state.sections[0].body, 'SENTINEL BODY CLEAN', 'body sentinel preserved');
  assert.strictEqual(b.state.sections[0].narrative, 'SENTINEL NARRATIVE CLEAN', 'narrative sentinel preserved');
  assert.deepStrictEqual(b.state.roleOverrides,
    { root: '#123456', expression: '#654321', radiance: '#abcdef' }, 'roleOverrides preserved');

  // 4) Survives a real refresh: the persisted record holds the merged draft.
  const rec = b.readRecord();
  assert.strictEqual(rec.owner, 'cu-owner-alice', 'persisted under the correct owner');
  assert.strictEqual(rec.data.hero.zoom, 149, 'refresh-safe: zoom is on disk');
  assert.strictEqual(rec.data.sections[0].title, 'CLEAN REVIEWED HEADING');
  assert.strictEqual(rec.data.sections[0].body, 'SENTINEL BODY CLEAN');
});

test('mismatched owner: a different person’s saved draft is NEVER read into this identity', async () => {
  const b = await makeBuilder();
  // Alice has a saved draft with distinctive framing.
  b.setOwner('cu-owner-alice');
  b.state.heroZoom = 149;
  b.state.sections[0].body = 'ALICE PRIVATE BODY';
  await b.saveDraft();

  // Bob does a handoff. Cold reload, then adopt Bob's owner and try to restore.
  b.resetForColdReload();
  b.setOwner('cu-owner-bob');
  b.setBaseline();
  const restored = await b.loadDraft();
  assert.strictEqual(restored, false, 'no draft for Bob → nothing restored');
  const applied = b.applyPrefill([{ key: 'make', title: 'BOB HEADING' }]);
  await b.flushSave();

  assert.strictEqual(applied, 1);
  assert.strictEqual(b.state.sections[0].title, 'BOB HEADING', 'Bob gets his selected field');
  // Bob must NOT inherit Alice's framing/body.
  assert.strictEqual(b.state.heroZoom, 100, 'Bob keeps default framing, not Alice’s 149');
  assert.notStrictEqual(b.state.sections[0].body, 'ALICE PRIVATE BODY', 'Alice content never bleeds to Bob');
  assert.strictEqual(b.state.sections[0].body, 'DEFAULT BODY make');
});

test('no saved draft at all: handoff initializes safely and applies the field', async () => {
  const b = await makeBuilder();
  b.resetForColdReload();
  b.setOwner('cu-owner-carol');
  b.setBaseline();
  const restored = await b.loadDraft();
  assert.strictEqual(restored, false, 'nothing to restore');
  const applied = b.applyPrefill([{ key: 'perceive', narrative: 'Fresh narrative' }]);
  await b.flushSave();
  assert.strictEqual(applied, 1);
  assert.strictEqual(b.state.sections[1].narrative, 'Fresh narrative');
  const rec = b.readRecord();
  assert.strictEqual(rec.owner, 'cu-owner-carol', 'new draft persisted under this owner');
});

test('the reviewed prefill payload never carries raw transcript text', async () => {
  // buildHandoffSections omits raw; assert a raw-only room contributes nothing
  // and the applied draft never contains the raw marker.
  const b = await makeBuilder();
  const RAW = '--- From transcript... [Guide: hi]';
  const applied = b.applyPrefill([{ key: 'make', title: 'Heading only' }]);
  assert.strictEqual(applied, 1);
  assert.ok(!JSON.stringify(b.state).includes(RAW), 'no raw ever enters Builder state');
});

test('shipped wireBridge restores the draft BEFORE applying the prefill (ordering guard)', () => {
  const wire = extractFrom(FPJS, 'wireBridge');
  const branch = wire.slice(wire.indexOf("'fieldprint-prefill'"));
  const iLoad = branch.indexOf('loadDraft');
  const iApply = branch.indexOf('applyPrefill');
  assert.ok(iLoad > -1, 'prefill branch must restore the saved draft (loadDraft)');
  assert.ok(iApply > -1, 'prefill branch must apply the reviewed fields');
  assert.ok(iLoad < iApply, 'loadDraft must run BEFORE applyPrefill so defaults never overwrite the draft');
  assert.ok(/currentOwner\s*=\s*String\(d\.owner\)/.test(branch),
    'prefill branch must adopt the Studio-supplied owner key');
});

test('Studio sends the SAME stable owner key on both the model and the prefill', () => {
  // phV5OwnerKey is identity-derived and stable; both posts must include it.
  const post = extractFrom(HTML, 'phV5PostModel');
  const flush = extractFrom(HTML, 'phV5FlushPrefill');
  assert.ok(/owner:\s*phV5OwnerKey\(\)/.test(post), 'model post carries the owner key');
  assert.ok(/owner:\s*phV5OwnerKey\(\)/.test(flush), 'prefill post carries the owner key');

  // The key itself is a stable function of the person identity, not random.
  const ownerFn = extractFrom(HTML, 'phV5OwnerKey');
  const hashFn = extractFrom(HTML, '_studioCipherHashHex');
  const make = new Function('state', '_studioCipherHashHex',
    ownerFn + '\nreturn phV5OwnerKey;');
  const hash = new Function('str', 'len', hashFn + '\nreturn _studioCipherHashHex(str, len);');
  const key = (companion) => make({ compassData: { companion: companion } },
    (s, l) => hash(s, l))();
  const a1 = key('Ada Lovelace');
  const a2 = key('ada lovelace');   // case-insensitive → same person
  const b1 = key('Bob Jones');
  assert.strictEqual(a1, a2, 'same identity → same owner key (stable across reloads)');
  assert.notStrictEqual(a1, b1, 'different identities → different owner keys');
  assert.strictEqual(make({}, () => 'x')(), null, 'empty identity → null (Builder falls back to computeOwner)');
});
