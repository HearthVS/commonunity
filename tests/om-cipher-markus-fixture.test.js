// Fixture-pinned regression for the OM Cipher Studio render path.
//
// Loads a real Studio JSON export (Markus, 2026-05-15) into a fake
// window.state, extracts cuBuildOmCipherInput + cuRenderOmCipherSection
// from studio.html, and verifies:
//
//   1. cuBuildOmCipherInput resolves canonical values even though the
//      top-level `birthData` field of the export is null — every alias
//      lives under `compassData`.
//   2. Identity uses compassData.guide ("Markus Lehto") as legal_name
//      so Expression/Soul/Personality match the Markus baseline.
//   3. The Activation Sequence is wired from compassData.gk_profile
//      (cs/ce/us/ue + line aliases) and surfaces in the rendered line.
//   4. The renderer paints: real SVG sigil (not the static ॐ badge),
//      a Draft/Sealed seal (not "pending"), full gematria grid, and
//      activation copy with line roles.
//
// Run:  node tests/om-cipher-markus-fixture.test.js
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

const SRC_MERGE_GK   = extractFn('cuMergeGeneKeysSlots');
const SRC_BUILD_INPUT = extractFn('cuBuildOmCipherInput');
const SRC_CIPHER_NAME = extractFn('cuCipherNameFromRecord');
const SRC_CIPHER_SUB  = extractFn('cuCipherSubtitleFromRecord');
const SRC_ACTIVATION  = extractFn('cuActivationLineFromDisplay');
let SRC_RENDER = extractFn('cuRenderOmCipherSection');
SRC_RENDER = SRC_RENDER
  .replace(/try\s*\{\s*\n\s*if\s*\(window\.CU_OM_CIPHER_ENABLED/, '{ if (window.CU_OM_CIPHER_ENABLED')
  .replace(/\}\s*catch\s*\(_\)\s*\{[^}]*\}\s*\}\s*$/, '} }');

// Also pull the IIFE that defines window.cuOmCipherDisplay — the
// renderer relies on it for the Activation Sequence label.
const bridgeStart = html.indexOf("Om Cipher v1 — browser bridge");
const iifeStart   = html.indexOf("(function () {", bridgeStart);
const iifeEnd     = html.indexOf("})();", iifeStart);
assert.ok(iifeStart > 0 && iifeEnd > iifeStart, 'browser-bridge IIFE not located');
const SRC_BRIDGE = html.slice(iifeStart, iifeEnd + '})();'.length);

// ─── Minimal fake DOM (mirrors om-cipher-section-render.test.js) ─────
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
  _descendants() { const out = []; (function walk(node) { for (const c of node.children) { out.push(c); walk(c); } })(this); return out; }
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
  leaf(sec, 'p',  { 'data-cu-om-cipher-seal-full': '1' });
  leaf(sec, 'p',  { 'data-cu-om-cipher-input-fingerprint': '1' });
  leaf(sec, 'p',  { 'data-cu-om-cipher-bhramari': '1' });
  ['life_path','expression','soul_urge','personality','lunar_phase','solar_quarter','temporal_gate'].forEach(k => {
    const item = leaf(sec, 'div', { 'data-cu-om-cipher-gematria': k }, ['oc-source-item', 'is-pending']);
    leaf(item, 'dt');
    leaf(item, 'dd');
  });
  return sec;
}

// ─── Compose a window from the exact exported JSON shape ─────────────
function makeWindow(exported) {
  const win = {
    CU_OM_CIPHER_ENABLED: true,
    CU_BHRAMARI_CAPTURE_ENABLED: true,
    cuOmCipher: om,
    state: {
      person: exported.person || null,
      birthData: exported.birthData || null,
      compassData: exported.compassData || {},
    },
  };
  // Mount the studio.html browser-bridge so cuOmCipherDisplay is real.
  new Function('window', SRC_BRIDGE)(win);
  return win;
}

function makeRenderer(win) {
  const ctx = { document: { querySelectorAll: () => [] } };
  const fn = new Function(
    'window', 'document', 'cuBuildPublishPayload',
    SRC_MERGE_GK + '\n' +
    'window.cuMergeGeneKeysSlots = cuMergeGeneKeysSlots;\n' +
    SRC_CIPHER_NAME + '\n' +
    SRC_CIPHER_SUB + '\n' +
    SRC_ACTIVATION + '\n' +
    SRC_BUILD_INPUT + '\n' +
    SRC_RENDER + '\n' +
    'return { render: cuRenderOmCipherSection, buildInput: cuBuildOmCipherInput, merge: cuMergeGeneKeysSlots };'
  );
  // The renderer reads window.cuOmCipherDisplay — already mounted in
  // makeWindow via the browser-bridge IIFE. Provide a stub payload
  // builder so the inner branch resolves without buildLivingProfile.
  return fn(win, ctx.document, function () { return null; });
}

let passed = 0, failed = 0;
function test(name, body) {
  try { body(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('OM Cipher fixture — Markus Studio export 2026-05-15');

// ── 1. buildInput resolves identity from compassData even though
//      top-level birthData is null. ────────────────────────────────
test('birthData=null at top level → buildInput still resolves from compassData', () => {
  assert.equal(FIXTURE.birthData, null, 'fixture precondition: top-level birthData is null');
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const input = r.buildInput(null);
  assert.equal(input.birth_date, '1973-11-18');
  assert.equal(input.birth_time, '03:21');
  // Birthplace is normalised into structured {city, province, country}
  // with title case so the foundation card reads `Sudbury, Ontario, Canada`.
  assert.equal(input.birth_place.city, 'Sudbury');
  assert.equal(input.birth_place.province, 'Ontario');
  assert.equal(input.birth_place.country, 'Canada');
});

// ── 2. Legal name prefers compassData.guide ("Markus Lehto") so
//      Expression/Soul/Personality match the Markus baseline. ─────
test('legal_name = compassData.guide ("Markus Lehto"), preferred_name = "Markus"', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const input = r.buildInput(null);
  assert.equal(input.legal_name, 'Markus Lehto');
  assert.equal(input.preferred_name, 'Markus');
});

// ── 3. Compass slots carry Gene Keys gate + line merged from
//      compassData.gk_profile (cs/ce/us/ue + line aliases). ────────
test('compass slots populated from gk_profile: GK14.2 / GK8.2 / GK29.4 / GK30.4', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const input = r.buildInput(null);
  // String/number tolerant — bridge parses with parseInt anyway.
  assert.equal(Number(input.compass.work.gk_num),  14);
  assert.equal(Number(input.compass.work.gk_line), 2);
  assert.equal(Number(input.compass.lens.gk_num),  8);
  assert.equal(Number(input.compass.lens.gk_line), 2);
  assert.equal(Number(input.compass.field.gk_num),  29);
  assert.equal(Number(input.compass.field.gk_line), 4);
  assert.equal(Number(input.compass.call.gk_num),  30);
  assert.equal(Number(input.compass.call.gk_line), 4);
});

// ── 4. Canonical engine on the fixture input matches the Markus
//      baseline (Life Path 22, Expression 8, Soul 6, Personality 2). ─
test('canonical engine on fixture matches Markus baseline (LP22 / Ex8 / SU6 / Pe11)', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const input = r.buildInput(null);
  const rec = om.generate(input, { featureFlag: true });
  assert.equal(rec.metadata.life_path.value, 22);
  assert.equal(rec.metadata.life_path.is_master, true);
  assert.equal(rec.metadata.expression.value, 8);
  assert.equal(rec.metadata.soul_urge.value, 6);
  // Master 11 preserved in the visible card (raw 29 → 11). Canonical seed
  // string still uses single-digit `PE:2` to keep the sealed seed stable.
  assert.equal(rec.metadata.personality.value, 11);
  assert.equal(rec.metadata.personality.is_master, true);
});

// ── 5. Renderer paints a real SVG sigil (not the static ॐ badge). ─
test('renderer paints SVG sigil into the hero slot (not ॐ fallback)', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  const slot = sec.querySelector('.lp-hero-slot.is-sigil');
  slot.innerHTML = '<span>ॐ</span>';
  r.render({}, sec);
  assert.ok(slot.innerHTML.startsWith('<svg'), 'slot innerHTML should start with <svg>');
  assert.ok(slot.classList.contains('cu-om-cipher-sigil-rendered'));
  assert.equal(slot.getAttribute('data-cu-om-cipher-sigil'), '1');
});

// ── 6. Section is sealed (profile carries legal name + birth_date)
//      and the seed shows a hash, not "pending". ───────────────────
test('section state is "sealed" + seed shows hash (no Draft/pending)', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  assert.equal(sec.getAttribute('data-cu-om-cipher-state'), 'sealed');
  const seed = sec.querySelector('[data-cu-om-cipher-seed]');
  assert.match(seed.textContent, /^[0-9a-f]{8}…[0-9a-f]{4}$/, 'seed format <8>…<4>');
  assert.ok(!/Draft/.test(seed.textContent), 'sealed seed must not be labelled Draft');
});

// ── 7. Gematria grid populated; Life Path is 22 + master. ─────────
test('gematria grid filled — Life Path 22 (master), Expression 8, Soul 6, Personality 11 (master)', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  const lp = sec.querySelector('[data-cu-om-cipher-gematria="life_path"]');
  assert.ok(lp.querySelector('dd').textContent.startsWith('22'));
  assert.ok(lp.classList.contains('is-master'));
  assert.ok(!lp.classList.contains('is-pending'));
  ['expression','soul_urge','personality','lunar_phase','solar_quarter','temporal_gate'].forEach(k => {
    const el = sec.querySelector('[data-cu-om-cipher-gematria="' + k + '"]');
    assert.ok(el.querySelector('dd').textContent.length > 0, k + ' painted');
    assert.ok(!el.classList.contains('is-pending'), k + ' not pending');
  });
  // Personality master is preserved in display (Markus = 11, not the
  // single-digit 2 used inside the canonical seed string).
  const pe = sec.querySelector('[data-cu-om-cipher-gematria="personality"]');
  assert.ok(pe.querySelector('dd').textContent.startsWith('11'),
    'Personality card should read 11 for Markus, got: ' + pe.querySelector('dd').textContent);
  assert.ok(pe.classList.contains('is-master'),
    'Personality card should carry the is-master class for Markus');
});

// ── 8. Activation Sequence line surfaces all four GK pair labels. ──
test('activation sequence carries Challenge 2 + Stability 4 with line roles', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  const act = sec.querySelector('[data-cu-om-cipher-activation]');
  assert.ok(!act.classList.contains('is-pending'), 'activation not pending');
  // Challenge pair (work/lens=Evolution) — both line 2 →
  // "Challenge 2: Dancer / Passion & Relationships"
  assert.ok(/Challenge 2:.*Dancer.*Passion & Relationships/.test(act.textContent),
    'expected Challenge 2 with Dancer + Passion & Relationships; got: ' + act.textContent);
  // Stability pair (field=Radiance/call) — both line 4 →
  // "Stability 4: Friendship / Breath"
  assert.ok(/Stability 4:.*Friendship.*Breath/.test(act.textContent),
    'expected Stability 4 with Friendship + Breath; got: ' + act.textContent);
});

// ── 9. Cipher name is derived (`[Preferred] of the [Temporal Qualifier]`).
//      For Markus (solar 3 / lunar 6) the temporal phrase resolves to
//      "of the Autumn Gate". The Master Builder descriptor lives in the
//      subtitle surface, not the primary name.
test('cipher name = "Markus of the Autumn Gate"; subtitle carries Master Builder', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  const nameEl = sec.querySelector('[data-cu-om-cipher-name]');
  assert.equal(nameEl.textContent, 'Markus of the Autumn Gate');
  const subEl = sec.querySelector('[data-cu-om-cipher-subtitle]');
  assert.ok(subEl, 'subtitle surface exists');
  assert.ok(/Master Builder/.test(subEl.textContent),
    'subtitle carries LP22 Master Builder label; got: ' + subEl.textContent);
});

// ── 10. Narrative surface is the Layer 6 archetypal story seed —
//       deterministic mirror, NOT a personal biography (that lives
//       in the Living Profile). For Markus (Ex8, SU6, Pe2) the seed
//       composes the three fragments from archetypal_stories.json.
test('narrative surface renders the Layer 6 archetypal story seed (keyed 8_6)', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  const narr = sec.querySelector('[data-cu-om-cipher-narrative]');
  assert.ok(!narr.classList.contains('is-pending'),
    'narrative should not be pending — keyed 8_6 entry available');
  // Markus = Expression 8 / Soul Urge 6 → keyed lookup `8_6`.
  assert.ok(/paradox of power and service/.test(narr.textContent),
    'narrative carries the keyed 8_6 story seed; got: ' + narr.textContent.slice(0, 160));
  assert.ok(/you build so others have somewhere to stand/i.test(narr.textContent),
    'narrative carries the 8_6 closing line; got: ' + narr.textContent.slice(0, 160));
  // No instruction text embedded in the story content itself.
  assert.ok(!/Living Profile/.test(narr.textContent),
    'story content must not contain UI instruction text');
});

// ── 11. Cipher seed: canonical engine seed (NOT input_hash) is preserved
//        on data-* attributes for debugging/provenance, but the
//        member-facing UI does NOT display it. For Markus the canonical
//        seed is sha256("LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1")
//        = 58b2ea61…f388784.
test('cipher seed preserved on data-* attributes for debugging (canonical 58b2ea61…f388784)', () => {
  const CANONICAL_SEED = '58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784';
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  // Internal/debug surface: the short seed element still carries the
  // canonical seed on data-cu-om-cipher-seed-full so debugging tooling
  // can read it even though the visible caption is hidden.
  const seedShort = sec.querySelector('[data-cu-om-cipher-seed]');
  assert.equal(seedShort.getAttribute('data-cu-om-cipher-seed-full'), CANONICAL_SEED,
    'data-cu-om-cipher-seed-full carries the full canonical seed');
  // The full 64-char seal element still exists in the DOM and carries
  // the bare canonical hash on its data attribute, even though the
  // surrounding oc-seal-block is hidden from members in the template.
  const sealFull = sec.querySelector('[data-cu-om-cipher-seal-full]');
  assert.equal(sealFull.getAttribute('data-cu-om-cipher-seed-full'), CANONICAL_SEED,
    'oc-seal-full carries the bare canonical hash on data-cu-om-cipher-seed-full');
});

// ── 11b. The default member-facing OM Cipher panel must NOT display
//         `Cipher seed:`, `Input fingerprint:`, the canonical-seed prefix
//         `58b2ea61`, or the full input fingerprint. These technical
//         hashes are preserved on data-* attributes for debugging only.
test('default member-facing UI hides Cipher seed / Input fingerprint surfaces', () => {
  // The template marks the caption + oc-seal-block as hidden so they
  // never paint in the member-facing UI. Verify the studio.html source
  // carries that contract.
  assert.ok(/data-cu-om-cipher-seed-hash[^>]*\bhidden\b/.test(html),
    'sigil caption (data-cu-om-cipher-seed-hash) must be marked hidden in template');
  assert.ok(/data-cu-om-cipher-seed-hash[^>]*display:\s*none/i.test(html),
    'sigil caption must use display:none in template');
  assert.ok(/oc-seal-block[^>]*\bhidden\b/.test(html),
    'oc-seal-block (Cipher seed + Input fingerprint) must be marked hidden in template');
  assert.ok(/oc-seal-block[^>]*display:\s*none/i.test(html),
    'oc-seal-block must use display:none in template');
});

// ── 12. Input fingerprint preserved on data-* for debugging, distinct
//        from the canonical Cipher seed, but not surfaced in default UI.
test('input fingerprint preserved on data-* attribute (distinct from canonical seed)', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);

  // Re-derive what the engine should produce for the fixture so we can
  // compare against the data attribute on the (hidden) surface.
  const input = r.buildInput(null);
  const rec = om.generate(input, { featureFlag: true });
  const fp = sec.querySelector('[data-cu-om-cipher-input-fingerprint]');
  assert.ok(rec.input_hash && rec.input_hash.length === 64,
    'engine input_hash present');
  assert.equal(fp.getAttribute('data-cu-om-cipher-input-fingerprint-full'),
    rec.input_hash, 'fingerprint surface stores full input_hash on data attribute');
  // Critically — the input fingerprint must NOT equal the canonical seed.
  assert.notEqual(rec.input_hash, rec.seed,
    'input fingerprint is distinct from canonical Cipher seed');
});

// ── 13. Field-pattern hero line (visible beside the sigil) renders
//        the canonical Activation Sequence labels for Markus.
//        Acceptance copy from the task spec:
//          Root 4 · Challenge 2: Dancer / Passion & Relationships ·
//          Stability 4: Friendship / Breath
test('field-pattern hero line renders canonical Markus activation labels', () => {
  const win = makeWindow(FIXTURE);
  const r = makeRenderer(win);
  const sec = buildSection();
  r.render({}, sec);
  const fp = sec.querySelector('[data-cu-om-cipher-field-pattern]');
  assert.ok(!fp.classList.contains('is-pending'),
    'field pattern should render, not stay pending');
  const txt = fp.textContent;
  assert.ok(/Root 4\b/.test(txt),
    'expected "Root 4" prefix; got: ' + txt);
  assert.ok(/Challenge 2: Dancer \/ Passion & Relationships/.test(txt),
    'expected canonical Evolution-sphere label "Passion & Relationships"; got: ' + txt);
  assert.ok(/Stability 4: Friendship \/ Breath/.test(txt),
    'expected canonical Radiance-sphere label "Friendship"; got: ' + txt);
  // Regression: the previous swap put Radiance labels on the lens slot
  // and Evolution labels on the field slot.
  assert.ok(!/Challenge 2: Dancer \/ Marriage/.test(txt),
    'lens (Evolution) line 2 must not surface "Marriage"; got: ' + txt);
  assert.ok(!/Stability 4: Love & Community \/ Breath/.test(txt),
    'field (Radiance) line 4 must not surface "Love & Community"; got: ' + txt);
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
