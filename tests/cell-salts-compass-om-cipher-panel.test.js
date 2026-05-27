// Tissue salts — Compass OM Cipher source-data panel.
//
// Acceptance: the OM Cipher modal in index.html contains a Tissue Salts
// card driven by the same canonical CELL_SALTS / cuCellSalts helpers
// that PR #45 added to Studio. The card:
//
//   - exists in the modal markup (data-cu-om-cipher-tissue-salts hook)
//   - carries the same data-testid scheme as the Studio panel so a
//     single set of selectors works across both UIs
//   - starts in a "pending" state when no astrology is set
//   - hydrates primary + secondaries from state.profile when astrology
//     is present (using window.cuCellSalts.assignSaltsFromBirth)
//   - writes the derived salts back onto state.profile.salts so the
//     canonical source record carries them downstream (Studio +
//     publish payload + sigil)
//   - carries a non-medical disclaimer
//
// Run: node tests/cell-salts-compass-om-cipher-panel.test.js
'use strict';

const fs   = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (_) {
  const fallbacks = [
    '/tmp/jsdom-tmp/node_modules/jsdom',
    path.resolve(__dirname, '..', 'node_modules', 'jsdom'),
    '/tmp/commonunity/node_modules/jsdom'
  ];
  for (const p of fallbacks) {
    try { ({ JSDOM } = require(p)); break; } catch (_) { /* keep trying */ }
  }
}

if (!JSDOM) {
  console.log('jsdom not installed — skipping cell-salts-compass-om-cipher-panel test');
  process.exit(0);
}

const indexSrc = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('Compass OM Cipher · tissue-salts panel');

// ── Static markup checks (no scripts evaluated) ─────────────────
const sanitized = indexSrc.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,
  '<!-- script omitted for markup test -->');
const dom = new JSDOM(sanitized, { pretendToBeVisual: true });
const { document } = dom.window;

const block = document.querySelector('[data-cu-om-cipher-tissue-salts]');
assert(block !== null, 'tissue-salts block exists in the OM Cipher modal');
assert(block && block.closest('#profile-modal') !== null,
  'tissue-salts block lives inside #profile-modal');
assert(block && block.getAttribute('data-cu-om-cipher-tissue-salts-state') === 'pending',
  'tissue-salts block starts in pending state');

[
  'data-cu-om-cipher-tissue-salts-primary-line',
  'data-cu-om-cipher-tissue-salts-primary',
  'data-cu-om-cipher-tissue-salts-secondaries',
  'data-cu-om-cipher-tissue-salts-disclaimer',
].forEach(attr => {
  const el = document.querySelector('[' + attr + ']');
  assert(el !== null, attr + ' hook exists');
});

const disclaimer = document.querySelector('[data-cu-om-cipher-tissue-salts-disclaimer]');
assert(disclaimer && /not medical/i.test(disclaimer.textContent),
  'tissue-salts panel carries a non-medical disclaimer');

// ── Browser bundle is mounted as window.cuCellSalts ─────────────
assert(/window\.cuCellSalts\s*=\s*\{/.test(indexSrc),
  'index.html mounts window.cuCellSalts (browser bundle)');
assert(/function\s+cuRenderCompassTissueSalts/.test(indexSrc),
  'index.html defines cuRenderCompassTissueSalts');
assert(/cuRenderCompassTissueSalts\(\)/.test(indexSrc),
  'cuRenderCompassTissueSalts is invoked (e.g. on modal open)');

// ── Outdated copy has been removed ──────────────────────────────
const discText = document.getElementById('om-cipher-info-disclosure').textContent;
assert(!/require[s]?\s+a\s+Human Design chart/i.test(discText),
  'modal info-disclosure no longer says HD chart is required');
assert(!/can be entered manually/i.test(discText),
  'modal info-disclosure no longer mentions manual entry');

// ── Live render path: stub state.profile + call the bundle ──────
// We isolate just the cuCellSalts IIFE (deterministic, no external
// deps) and the canonical sdk to verify both produce the same salts
// for the same input — proving Compass and Studio agree.
const salts = require('../sdk/cell_salts.js');

// Mount the inline cuCellSalts IIFE from index.html so we exercise
// the same code path the browser does.
function extractCellSaltsIIFE() {
  const marker = 'if (window.cuCellSalts) return;';
  const mIdx = indexSrc.indexOf(marker);
  if (mIdx < 0) return null;
  const openIdx = indexSrc.lastIndexOf('(function ()', mIdx);
  if (openIdx < 0) return null;
  let depth = 0, i = indexSrc.indexOf('{', openIdx);
  for (; i < indexSrc.length; i++) {
    const c = indexSrc[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const tail = indexSrc.indexOf(')();', i);
  return indexSrc.slice(openIdx, tail + 4);
}

const iife = extractCellSaltsIIFE();
assert(iife != null, 'can isolate the cuCellSalts IIFE from index.html');

if (iife) {
  const win = {};
  win.window = win;
  new Function('window', iife)(win);
  assert(typeof win.cuCellSalts.assignSaltsFromBirth === 'function',
    'browser bundle exposes assignSaltsFromBirth');

  // Cancer/Pisces/Taurus → calc_fluor + ferr_phos + nat_sulph.
  const out = win.cuCellSalts.assignSaltsFromBirth({
    sun: 'Cancer', moon: 'Pisces', rising: 'Taurus',
    seed: 'Maya Solis|1988-07-14'
  });
  assert(Array.isArray(out) && out.length >= 1, 'salts derived from astrology');
  assert(out[0].saltId === 'calc_fluor', 'Cancer → calc_fluor (primary)');
  const ids = out.map(s => s.saltId);
  assert(ids.includes('ferr_phos'), 'Moon Pisces → ferr_phos present');
  assert(ids.includes('nat_sulph'),  'Rising Taurus → nat_sulph present');

  // Cross-check against the canonical sdk to prove single source of
  // truth: no duplicated zodiac→salt mapping divergence.
  const canonical = salts.assignSaltsFromBirth({
    sun: 'Cancer', moon: 'Pisces', rising: 'Taurus',
    seed: 'Maya Solis|1988-07-14'
  });
  assert(JSON.stringify(out) === JSON.stringify(canonical),
    'inline bundle matches sdk/cell_salts.js byte-for-byte (single source of truth)');
}

// ── Panel render: derive + DOM hydration end-to-end ─────────────
// We run the whole index.html through jsdom *with* scripts allowed
// for the tissue-salts module only. Since other inline scripts may
// reach for globals that aren't safe in jsdom, isolate the panel
// render by recreating the markup + bundle in a minimal fixture.
const dom2 = new JSDOM(`<!doctype html><html><body>
  <div id="profile-modal">
    <div id="profile-tissue-salts-card"
         data-cu-om-cipher-tissue-salts="1"
         data-cu-om-cipher-tissue-salts-state="pending">
      <p data-cu-om-cipher-tissue-salts-primary-line="1"
         id="profile-tissue-salts-primary-line">Primary salt: pending source data</p>
      <div data-cu-om-cipher-tissue-salts-primary="1">
        <p>No primary salt selected yet — complete birth date / time / place to populate.</p>
      </div>
      <div data-cu-om-cipher-tissue-salts-secondaries="1"></div>
      <p data-cu-om-cipher-tissue-salts-disclaimer="1">Symbolic and somatic only — not medical advice or diagnosis.</p>
    </div>
  </div>
</body></html>`);

const win2 = dom2.window;
// Install state.profile with a populated chart.
win2.state = {
  profile: {
    full_name:        'Maya Solis',
    first_name:       'Maya',
    last_name:        'Solis',
    birthdate:        '1988-07-14',
    astrology_sun:    'Cancer',
    astrology_moon:   'Pisces',
    astrology_rising: 'Taurus',
  }
};
// Mount the browser bundle into win2.
if (iife) new Function('window', iife)(win2);

// Mount the renderer + computer functions by extracting them from
// index.html (small, self-contained — they only reach for `state`,
// `window.cuCellSalts`, and the DOM).
function extractFn(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = src.search(re);
  if (start < 0) return null;
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const compSrc = extractFn(indexSrc, 'cuComputeCompassSalts');
const rendSrc = extractFn(indexSrc, 'cuRenderCompassTissueSalts');
assert(compSrc && rendSrc, 'can extract cuComputeCompassSalts + cuRenderCompassTissueSalts');

new Function('window', 'document', 'state',
  compSrc + '\n' + rendSrc + '\n' +
  'window.cuComputeCompassSalts = cuComputeCompassSalts;' +
  'window.cuRenderCompassTissueSalts = cuRenderCompassTissueSalts;'
)(win2, win2.document, win2.state);

// Sanity: nothing has rendered yet.
let pre = win2.document.querySelector('[data-cu-om-cipher-tissue-salts]')
  .getAttribute('data-cu-om-cipher-tissue-salts-state');
assert(pre === 'pending', 'panel starts in pending state before render');

// Render.
win2.cuRenderCompassTissueSalts();

// State has advanced.
const blk = win2.document.querySelector('[data-cu-om-cipher-tissue-salts]');
assert(blk.getAttribute('data-cu-om-cipher-tissue-salts-state') !== 'pending',
  'panel leaves pending state after render with chart present');

// Primary salt name surfaces in the summary line.
const line = win2.document.querySelector('[data-cu-om-cipher-tissue-salts-primary-line]');
assert(/Calcarea Fluorica/.test(line.textContent),
  'primary line shows Calcarea Fluorica (Cancer sun)');

// Primary row has the data-cu-tissue-salt-id hook.
const primaryRow = win2.document.querySelector('[data-cu-tissue-salt-id="calc_fluor"]');
assert(primaryRow !== null, 'primary salt row carries data-cu-tissue-salt-id=calc_fluor');

// Secondary salts present (Pisces moon → ferr_phos, Taurus rising → nat_sulph).
assert(win2.document.querySelector('[data-cu-tissue-salt-id="ferr_phos"]') !== null,
  'secondary row for ferr_phos rendered');
assert(win2.document.querySelector('[data-cu-tissue-salt-id="nat_sulph"]') !== null,
  'secondary row for nat_sulph rendered');

// state.profile.salts populated (single source of truth: Compass →
// publish payload → Studio all read the same record).
assert(Array.isArray(win2.state.profile.salts) && win2.state.profile.salts.length >= 1,
  'state.profile.salts written back to canonical source record');
assert(win2.state.profile.salts[0].saltId === 'calc_fluor',
  'state.profile.salts[0] = calc_fluor (primary)');

// Pending state restored when chart cleared.
win2.state.profile = { full_name: '', birthdate: '' };
win2.cuRenderCompassTissueSalts();
const pending = win2.document.querySelector('[data-cu-om-cipher-tissue-salts]')
  .getAttribute('data-cu-om-cipher-tissue-salts-state');
assert(pending === 'pending', 'panel returns to pending when chart is empty');

if (failed > 0) {
  console.error('\n' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('\nAll Compass OM Cipher tissue-salts assertions passed.');
