// Tissue salts — fresh Compass → publish payload flow.
//
// Acceptance: a fresh user who completes Threshold + Compass should
// produce a canonical publish payload that already carries `salts`,
// without any manual injection. This mirrors the real Studio runtime by
// extracting `cuBuildPublishPayload` from studio.html and executing it
// against a minimal fake-window harness that mounts:
//
//   - the inline browser bundle (window.cuCellSalts) from studio.html
//   - a stub `cuMergeGeneKeysSlots` (shape-compatible)
//   - a synthesised state.compassData that resembles what the live
//     Threshold→Compass pipeline leaves behind after astrology
//     backfill.
//
// Run: node tests/cell-salts-compass-payload-flow.test.js
'use strict';

const fs     = require('fs');
const path   = require('path');
const assert = require('node:assert/strict');
const salts  = require('../sdk/cell_salts.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');

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

// Mount the inline browser bundle so window.cuCellSalts.assignSaltsFromBirth
// is available to cuBuildPublishPayload. We locate the IIFE that sets
// window.cuCellSalts and execute it in a fake-window context.
function extractCuCellSaltsIIFE() {
  const marker = 'if (window.cuCellSalts) return;';
  const mIdx = html.indexOf(marker);
  assert.ok(mIdx > 0, 'cuCellSalts IIFE marker not found');
  // Walk backwards to find the enclosing `(function ()` opener.
  const openIdx = html.lastIndexOf('(function ()', mIdx);
  assert.ok(openIdx > 0, 'cuCellSalts IIFE opener not found');
  // Walk forward to balance the IIFE close `})();`
  let depth = 0, i = html.indexOf('{', openIdx);
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  // Include the trailing `)();`
  const tail = html.indexOf(')();', i);
  return html.slice(openIdx, tail + 4);
}

function mountFakeWindow(compassData) {
  const win = {
    state: { compassData },
    // Stubs the engine reaches for; safe defaults that don't gate on real
    // services existing in the test environment.
  };
  win.window = win;

  // Stub buildLivingProfile so cuBuildPublishPayload can call it without
  // pulling in the whole renderLivingProfile() machinery.
  function buildLivingProfile() {
    return { tagline: null, essence: null };
  }

  // Stub cuMergeGeneKeysSlots — the publish payload calls it on pts.
  function cuMergeGeneKeysSlots(pts, _gk) {
    pts = pts || {};
    return { work: pts.work, lens: pts.lens, field: pts.field, call: pts.call };
  }

  // Mount the cuCellSalts browser bundle into the fake window.
  const iife = extractCuCellSaltsIIFE();
  new Function('window', iife)(win);

  // Mount cuBuildPublishPayload itself.
  const SRC = extractFn('cuBuildPublishPayload');
  new Function(
    'window', 'state', 'buildLivingProfile', 'cuMergeGeneKeysSlots',
    SRC + '\nwindow.cuBuildPublishPayload = cuBuildPublishPayload;'
  )(win, win.state, buildLivingProfile, cuMergeGeneKeysSlots);

  return win;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('cell salts: fresh Threshold→Compass publish payload');

test('inline cuCellSalts bundle exposes assignSaltsFromBirth', () => {
  const win = mountFakeWindow({ profile: {} });
  assert.equal(typeof win.cuCellSalts.assignSaltsFromBirth, 'function');
  assert.equal(typeof win.cuCellSalts.getSaltForSign, 'function');
  assert.equal(typeof win.cuCellSalts.deriveFallbackSalts, 'function');
});

test('fresh Compass with full tropical chart → payload.salts populated', () => {
  const cd = {
    profile: {
      first_name: 'Maya',
      last_name:  'Solis',
      full_name:  'Maya Solis',
      birthdate:  '1988-07-14',
      birth_time: '04:42',
      place_of_birth: 'Mexico City, MX',
      astrology: { sun: 'Cancer', moon: 'Pisces', rising: 'Taurus' },
    },
    points: {},
  };
  const win = mountFakeWindow(cd);
  const payload = win.cuBuildPublishPayload();
  assert.ok(Array.isArray(payload.salts), 'payload.salts is an array');
  assert.ok(payload.salts.length >= 1, 'at least one salt assigned');
  assert.equal(payload.salts[0].saltId, 'calc_fluor', 'Cancer → calc_fluor');
  assert.equal(payload.salts[0].weight, 1.0);
  // Moon Pisces → ferr_phos, Rising Taurus → nat_sulph.
  const ids = payload.salts.map(s => s.saltId);
  assert.ok(ids.includes('ferr_phos'), 'Moon Pisces present');
  assert.ok(ids.includes('nat_sulph'), 'Rising Taurus present');
});

test('vedic-only chart still produces salts', () => {
  const cd = {
    profile: {
      full_name: 'Arun K',
      birthdate: '1979-11-02',
      vedic: { sun: 'Libra', moon: 'Aries', ascendant: 'Capricorn' },
    },
  };
  const win = mountFakeWindow(cd);
  const payload = win.cuBuildPublishPayload();
  assert.ok(Array.isArray(payload.salts));
  assert.equal(payload.salts[0].saltId, 'nat_phos', 'vedic sun Libra → nat_phos');
});

test('no astrology, only birthdate → seed-derived salts (deterministic)', () => {
  const cd = {
    profile: { full_name: 'Anonymous Seeker', birthdate: '1995-03-21' },
  };
  const win1 = mountFakeWindow(cd);
  const win2 = mountFakeWindow(JSON.parse(JSON.stringify(cd)));
  const p1 = win1.cuBuildPublishPayload();
  const p2 = win2.cuBuildPublishPayload();
  assert.ok(Array.isArray(p1.salts) && p1.salts.length, 'salts populated from seed');
  assert.deepEqual(p1.salts, p2.salts, 'same inputs → same salts');
});

test('completely empty profile → payload.salts is null (not crash)', () => {
  const win = mountFakeWindow({ profile: {} });
  const payload = win.cuBuildPublishPayload();
  // With no name / no birthdate / no astrology, seed is empty too.
  assert.equal(payload.salts, null);
});

test('explicit prof.salts wins over derivation', () => {
  const cd = {
    profile: {
      full_name: 'Pre-Salted',
      birthdate: '1990-01-01',
      astrology: { sun: 'Aries', moon: 'Aries', rising: 'Aries' },
      salts: [{ saltId: 'silicea', weight: 1.0, kind: 'primary' }],
    },
  };
  const win = mountFakeWindow(cd);
  const payload = win.cuBuildPublishPayload();
  assert.equal(payload.salts.length, 1);
  assert.equal(payload.salts[0].saltId, 'silicea');
});

test('salts feed getPersonSaltView (panel input contract)', () => {
  const cd = {
    profile: {
      full_name: 'Vista User',
      birthdate: '1988-07-14',
      astrology: { sun: 'Cancer', moon: 'Pisces', rising: 'Taurus' },
    },
  };
  const win = mountFakeWindow(cd);
  const payload = win.cuBuildPublishPayload();
  const view = salts.getPersonSaltView(payload.salts);
  assert.ok(view.primary, 'panel has a primary salt');
  assert.equal(view.primary.id, 'calc_fluor');
  assert.ok(view.secondary.length >= 1, 'panel has secondaries');
});

test('salts feed getSaltGeometryProfile (sigil layer input)', () => {
  const cd = {
    profile: {
      full_name: 'Geometry User',
      birthdate: '1988-07-14',
      astrology: { sun: 'Cancer', moon: 'Pisces', rising: 'Taurus' },
    },
  };
  const win = mountFakeWindow(cd);
  const payload = win.cuBuildPublishPayload();
  const geom = salts.getSaltGeometryProfile(payload.salts);
  assert.ok(geom, 'sigil layer geometry resolved from fresh payload');
  assert.equal(geom.saltId, 'calc_fluor');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
