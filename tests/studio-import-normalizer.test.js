// Regression for the Compass-import bug where Studio export wrappers
// (top-level `version: "studio-v1"`, real Compass data nested under
// `compassData`) were rejected by `processCompassImport` with
// "Could not read file — please use a Compass session JSON".
//
// This test:
//   1. Extracts `normalizeImportedStudioOrCompassJson` from studio.html
//      and exercises it with the real Markus Studio export fixture.
//   2. Confirms it also accepts raw Compass session JSON (legacy path).
//   3. Drives the normalized output through cuBuildOmCipherInput +
//      cuRenderOmCipherSection to verify OM Cipher surfaces populate
//      (sigil, name, mantra, gematria, activation, story, seal hash) —
//      i.e., the live failure mode from the screenshot.
//
// Run:  node tests/studio-import-normalizer.test.js
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const om = require('../sdk/om_cipher.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));

// ─── Extract source from studio.html ─────────────────────────────────
function extractFn(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = html.search(re);
  assert.ok(start > 0, 'could not locate function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

const SRC_NORMALIZE = extractFn('normalizeImportedStudioOrCompassJson');

// Build the normalizer in an isolated function scope.
const normalize = new Function(
  SRC_NORMALIZE + '\nreturn normalizeImportedStudioOrCompassJson;'
)();

let passed = 0, failed = 0;
function test(name, body) {
  try { body(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('Studio import normalizer — Markus fixture + compatibility');

// ── 1. Studio wrapper detection. ─────────────────────────────────────
test('accepts Studio export wrapper {version, compassData, rooms, ...}', () => {
  const out = normalize(FIXTURE);
  assert.ok(out, 'normalizer returned null for valid Studio wrapper');
  assert.ok(out.compassData, 'compassData present');
  assert.equal(out.compassData.companion, 'Markus');
  assert.equal(out.compassData.dob, '1973-11-18');
  assert.equal(out.person, 'Markus');
  assert.equal(out.theme, 'A');
  assert.ok(out.rooms, 'rooms preserved');
  assert.ok(out.rooms.work, 'work room preserved');
});

// ── 2. Raw Compass session JSON still works (back-compat). ───────────
test('accepts raw Compass session JSON (has top-level `points`)', () => {
  const raw = {
    points: { work: { summary: 'x' } },
    companion: 'Iris',
    theme: 'B',
    dob: '1990-01-01',
  };
  const out = normalize(raw);
  assert.ok(out, 'normalizer should accept raw Compass session');
  assert.equal(out.compassData, raw, 'raw Compass data is the compassData');
  assert.equal(out.person, 'Iris');
  assert.equal(out.theme, 'B');
  assert.equal(out.birthData, null);
  assert.equal(out.rooms, null);
});

// ── 3. Rejects shapes that are neither wrapper nor raw Compass. ──────
test('rejects unrelated JSON (no points, no compassData)', () => {
  assert.equal(normalize(null), null);
  assert.equal(normalize({}), null);
  assert.equal(normalize({ foo: 'bar' }), null);
  assert.equal(normalize({ version: 'studio-v1' }), null,
    'studio wrapper without compassData is invalid');
});

// ── 4. End-to-end: normalize → state.compassData → OM cipher surfaces.
//      This is the regression that matters for the screenshot — after
//      importing the wrapper, OM Cipher must seal and render full
//      surfaces (not the static ॐ pending state).
test('normalized output drives OM cipher to sealed Markus baseline', () => {
  const out = normalize(FIXTURE);
  // Mirror what processCompassImport does post-normalization.
  const state = {
    person: out.person,
    birthData: out.birthData,
    compassData: out.compassData,
  };

  // Extract the OM cipher input builder and run it against the state
  // shape that processCompassImport produces.
  const SRC_MERGE   = extractFn('cuMergeGeneKeysSlots');
  const SRC_BUILD   = extractFn('cuBuildOmCipherInput');
  const buildInput = new Function(
    'window',
    SRC_MERGE + '\nwindow.cuMergeGeneKeysSlots = cuMergeGeneKeysSlots;\n' +
    SRC_BUILD + '\nreturn cuBuildOmCipherInput;'
  )({ state });

  const input = buildInput(null);
  // Identity + foundation pulled from compassData.
  assert.equal(input.legal_name, 'Markus Lehto');
  assert.equal(input.preferred_name, 'Markus');
  assert.equal(input.birth_date, '1973-11-18');
  assert.equal(input.birth_time, '03:21');
  assert.equal(input.birth_place.city, 'Sudbury');
  assert.equal(input.birth_place.province, 'Ontario');
  assert.equal(input.birth_place.country, 'Canada');
  // Gene Keys gate + line merged from compassData.gk_profile.
  assert.equal(Number(input.compass.work.gk_num),  14);
  assert.equal(Number(input.compass.work.gk_line), 2);
  assert.equal(Number(input.compass.lens.gk_num),   8);
  assert.equal(Number(input.compass.lens.gk_line), 2);
  assert.equal(Number(input.compass.field.gk_num), 29);
  assert.equal(Number(input.compass.field.gk_line), 4);
  assert.equal(Number(input.compass.call.gk_num),  30);
  assert.equal(Number(input.compass.call.gk_line), 4);

  // Canonical engine seals to Markus baseline.
  const rec = om.generate(input, { featureFlag: true });
  assert.equal(rec.metadata.life_path.value, 22);
  assert.equal(rec.metadata.life_path.is_master, true);
  assert.equal(rec.metadata.expression.value, 8);
  assert.equal(rec.metadata.soul_urge.value, 6);
  assert.equal(rec.metadata.personality.value, 2);
  // Stable seal hash (acceptance criterion).
  assert.equal(rec.seed,
    '58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784');
});

// ── 5. Render path — normalized state → sealed sigil + cipher name. ──
//      This is the strongest signal that the user's screenshot would
//      now show the generated sigil instead of the static ॐ badge.
test('renderer paints sealed OM Cipher section against normalized state', () => {
  const out = normalize(FIXTURE);

  // Minimal fake DOM mirroring tests/om-cipher-markus-fixture.test.js.
  class FakeClassList {
    constructor() { this.set = new Set(); }
    add(c) { this.set.add(c); }
    remove(c) { this.set.delete(c); }
    contains(c) { return this.set.has(c); }
    toString() { return Array.from(this.set).join(' '); }
  }
  class FakeEl {
    constructor(tag) {
      this.tagName = (tag || 'div').toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attrs = {};
      this.classList = new FakeClassList();
      this._inner = '';
      this.textContent = '';
    }
    set innerHTML(v) { this._inner = v; }
    get innerHTML() { return this._inner; }
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; }
    querySelector(sel) { const all = [this, ...this._descendants()]; for (const el of all) if (matches(el, sel)) return el; return null; }
    querySelectorAll(sel) { const all = [this, ...this._descendants()]; return all.filter(el => matches(el, sel)); }
    closest(sel) { let n = this; while (n) { if (matches(n, sel)) return n; n = n.parentNode; } return null; }
    _descendants() { const o = []; (function walk(n) { for (const c of n.children) { o.push(c); walk(c); } })(this); return o; }
  }
  function matches(el, sel) {
    if (!el) return false;
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const inner = sel.slice(1, -1);
      const eq = inner.indexOf('=');
      if (eq < 0) return el.attrs[inner] != null;
      const k = inner.slice(0, eq);
      let v = inner.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return el.attrs[k] === v;
    }
    if (sel.startsWith('.')) {
      const parts = sel.slice(1).split('.');
      return parts.every(p => el.classList.contains(p));
    }
    const dot = sel.indexOf('.');
    if (dot > 0) {
      const tag = sel.slice(0, dot).toUpperCase();
      const rest = '.' + sel.slice(dot + 1);
      if (el.tagName !== tag) return false;
      return matches(el, rest);
    }
    return el.tagName === sel.toUpperCase();
  }

  function buildSection() {
    const sec = new FakeEl('section');
    sec.setAttribute('data-cu-om-cipher-section', '1');
    sec.classList.add('lp-om-cipher-section');
    function leaf(parent, tag, attrs, classes) {
      const e = new FakeEl(tag);
      Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
      (classes || []).forEach(c => e.classList.add(c));
      parent.appendChild(e);
      return e;
    }
    leaf(sec, 'div', {}, ['lp-hero-slot', 'is-sigil']);
    leaf(sec, 'em', { 'data-cu-om-cipher-seed': '1' });
    leaf(sec, 'h4', { 'data-cu-om-cipher-name': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-subtitle': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-mantra': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-field-pattern': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-narrative': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-contemplation': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-activation': '1' });
    leaf(sec, 'p',  { 'data-cu-om-cipher-bhramari': '1' });
    ['life_path','expression','soul_urge','personality','lunar_phase','solar_quarter','temporal_gate'].forEach(k => {
      const item = leaf(sec, 'div', { 'data-cu-om-cipher-gematria': k }, ['oc-source-item', 'is-pending']);
      leaf(item, 'dt');
      leaf(item, 'dd');
    });
    return sec;
  }

  const win = {
    CU_OM_CIPHER_ENABLED: true,
    CU_BHRAMARI_CAPTURE_ENABLED: true,
    cuOmCipher: om,
    state: { person: out.person, birthData: out.birthData, compassData: out.compassData },
  };

  // Mount the browser bridge so cuOmCipherDisplay is real.
  const bridgeStart = html.indexOf('Om Cipher v1 — browser bridge');
  const iifeStart   = html.indexOf('(function () {', bridgeStart);
  const iifeEnd     = html.indexOf('})();', iifeStart);
  const SRC_BRIDGE  = html.slice(iifeStart, iifeEnd + '})();'.length);
  new Function('window', SRC_BRIDGE)(win);

  const SRC_MERGE_GK    = extractFn('cuMergeGeneKeysSlots');
  const SRC_BUILD_INPUT = extractFn('cuBuildOmCipherInput');
  const SRC_CIPHER_NAME = extractFn('cuCipherNameFromRecord');
  const SRC_CIPHER_SUB  = extractFn('cuCipherSubtitleFromRecord');
  const SRC_ACTIVATION  = extractFn('cuActivationLineFromDisplay');
  let SRC_RENDER        = extractFn('cuRenderOmCipherSection');
  SRC_RENDER = SRC_RENDER
    .replace(/try\s*\{\s*\n\s*if\s*\(window\.CU_OM_CIPHER_ENABLED/, '{ if (window.CU_OM_CIPHER_ENABLED')
    .replace(/\}\s*catch\s*\(_\)\s*\{[^}]*\}\s*\}\s*$/, '} }');

  const r = new Function(
    'window', 'document', 'cuBuildPublishPayload',
    SRC_MERGE_GK + '\nwindow.cuMergeGeneKeysSlots = cuMergeGeneKeysSlots;\n' +
    SRC_CIPHER_NAME + '\n' +
    SRC_CIPHER_SUB + '\n' +
    SRC_ACTIVATION + '\n' +
    SRC_BUILD_INPUT + '\n' +
    SRC_RENDER + '\n' +
    'return { render: cuRenderOmCipherSection };'
  )(win, { querySelectorAll: () => [] }, function () { return null; });

  const sec = buildSection();
  const slot = sec.querySelector('.lp-hero-slot.is-sigil');
  slot.innerHTML = '<span>ॐ</span>';
  r.render({}, sec);

  // Sigil painted, not ॐ fallback.
  assert.ok(slot.innerHTML.startsWith('<svg'), 'sigil rendered as SVG');
  // Sealed, not pending.
  assert.equal(sec.getAttribute('data-cu-om-cipher-state'), 'sealed');
  // Identity surfaces match the spec from the task acceptance criteria.
  assert.equal(sec.querySelector('[data-cu-om-cipher-name]').textContent,
    'Markus of the Autumn Gate');
  assert.match(sec.querySelector('[data-cu-om-cipher-mantra]').textContent,
    /I hold the form until the form holds others\./);
  assert.match(sec.querySelector('[data-cu-om-cipher-contemplation]').textContent,
    /I do less now, and allow more\./);
  assert.match(sec.querySelector('[data-cu-om-cipher-narrative]').textContent,
    /paradox of power and service/);
  // Activation sequence carries all four GK pair labels.
  const act = sec.querySelector('[data-cu-om-cipher-activation]').textContent;
  assert.match(act, /Challenge 2:/);
  assert.match(act, /Stability 4:/);
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
