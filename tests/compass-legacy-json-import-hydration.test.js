/* cOMpass legacy-JSON import hydration (Eda's beta-flow bug).
 *
 * Bug: after threshold → cOMpass, a user loaded an OLD exported CommonUnity
 * JSON. Tissue salts populated, but Gene Keys, Vedic astrology, and tropical
 * astrology did NOT. Root cause: index.html's loadJSON() merged the file into
 * state but never re-ran the derived-data chain (syncSetupIntoProfile →
 * autoPopulateGeneKeysFromState → calcIdentityChartFromState → tissue-salt
 * render). Tissue salts appeared anyway because they are always recomputed
 * from a name|dob seed on every modal/salt render; the other three sections
 * had no recompute-on-import path and stayed blank when the legacy file
 * lacked structured profile.astrology / profile.vedic blocks and carried
 * Gene Keys only in the engine-slot gk_profile (no per-room points[].gk_num).
 *
 * Fix (index.html loadJSON):
 *   1. Reset derived identity fields before merge (privacy: no prior
 *      occupant's calculated values can survive into the imported person).
 *   2. Promote legacy gk_profile slots → room points[].gk_num/gk_line.
 *   3. Mirror imported dob/tob/pob into the visible setup inputs.
 *   4. Run the conservative (fill-blanks-only) hydration chain so all four
 *      sections populate from the just-imported birth data.
 *
 * This extracts loadJSON + the data-bearing helpers from index.html and runs
 * them in a vm sandbox with the REAL sdk astronomy / places / cell-salts
 * engines and a minimal fake DOM. FileReader is simulated by invoking
 * reader.onload with the fixture text.
 *
 *   Run: node tests/compass-legacy-json-import-hydration.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const Astro  = require('../sdk/astronomy.js');
const Places = require('../sdk/place_gazetteer.js');
const Salts  = require('../sdk/cell_salts.js');

const LEGACY = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'eda-legacy-compass-2025-09-01.json'), 'utf8');

function extractFn(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = src.search(re);
  if (start < 0) throw new Error('cannot find function ' + name);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

const POINTS = ['work', 'lens', 'field', 'call'];

// ── GENE_KEYS map: deterministic gift label per gate (only `.gift` is read
//    by the populate code under test). ───────────────────────────────────
const GENE_KEYS = new Proxy({}, { get: () => ({ gift: 'Gift', shadow: 'Sh', siddhi: 'Si' }) });

// ── Real Gene Keys gate derivation from a Sun longitude. The fixture's
//    gk_profile is authored independently of birth date (legacy exports
//    stored gates the user calculated), so the test asserts the PROMOTION
//    of gk_profile → room slots, not a recomputation match. ──────────────

// ── Minimal fake DOM. Inputs are keyed by id; value sinks only. ─────────
function makeDoc() {
  const els = {};
  function el(id) {
    if (!els[id]) {
      els[id] = {
        id, value: '', textContent: '', style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener() {},
      };
    }
    return els[id];
  }
  return {
    _els: els,
    getElementById(id) { return el(id); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return el('__tmp_' + Math.random()); },
  };
}

// ── Astronomy + GK longitude helpers used by autoPopulateGeneKeysFromState
//    and calcIdentityChartFromState. We pull the real Meeus astronomy from
//    the sdk so the chart values are genuine, and provide the gate/line
//    derivation helpers that index.html defines elsewhere. ───────────────
function dateToJD(d) { return Astro.dateToJD(d); }
function jdToSolarLongitude(jd) { return Astro.solarLongitude(jd); }
function longitudeToGateLine(lon) {
  // Mirror index.html's wheel: 64 gates over 360°, 6 lines per gate.
  const GATE_ORDER = null; // not needed — we only assert promotion path
  const g = (((lon % 360) + 360) % 360) / 360 * 64;
  const gate = (Math.floor(g) % 64) + 1;
  const line = (Math.floor((g - Math.floor(g)) * 6) % 6) + 1;
  return { gate, line };
}
function tropicalSunSign() { return null; }

function buildSandbox(state, doc) {
  const win = {
    CommonUnityAstro: Astro,
    CommonUnityPlaces: Places,
    CU_OM_CIPHER_ENABLED: true,
  };
  // Wire the inlined cuCellSalts surface that index.html builds at runtime,
  // backed by the real sdk cell-salts engine.
  win.cuCellSalts = {
    assignSaltsFromBirth: Salts.assignSaltsFromBirth,
    getPersonSaltView:    Salts.getPersonSaltView,
    getCellSalt:          Salts.getCellSalt,
  };

  const sandbox = {
    window: win,
    document: doc,
    state,
    POINTS,
    GENE_KEYS,
    CommonUnityAstro: Astro,
    CommonUnityPlaces: Places,
    dateToJD, jdToSolarLongitude, longitudeToGateLine, tropicalSunSign,
    // Pure-UI side effects we don't assert on — stub to no-ops.
    applyTheme() {}, restoreQA() {}, restoreL3Output() {},
    updateAllLineThemes() {}, showToast() {}, lookupGK() {},
    renderInsights() {}, renderHighlights() {}, updateNamesDisplay() {},
    bindDataKeys() {}, refreshAllHexReaders() {},
    populateNameNarrativeEssay() {}, updateAllSGSTriads() {},
    saveToStorage() {}, saveToStorage_() {},
    FileReader: class {
      readAsText() { /* driven manually below */ }
    },
    setTimeout: (fn) => { try { fn(); } catch (_) {} },
    console,
  };
  sandbox.window.cuRenderCompassTissueSalts = null; // set after extraction
  return sandbox;
}

// Extract the data-bearing functions under test + their dependencies.
const SRC = [
  'loadJSON',
  'syncSetupIntoProfile',
  'autoPopulateGeneKeysFromState',
  'calcIdentityChartFromState',
  'cuComputeCompassSalts',
  'restoreAllFields',
].map(n => extractFn(indexSrc, n)).join('\n\n');

// cuRenderCompassTissueSalts touches DOM heavily; replace its body with a
// thin shim that just runs cuComputeCompassSalts (the data path we assert).
const renderShim = `
function cuRenderCompassTissueSalts() {
  try { if (typeof cuComputeCompassSalts === 'function') cuComputeCompassSalts(); } catch (_) {}
}`;

function freshState(extraProfile) {
  const points = {};
  POINTS.forEach(p => { points[p] = { gk_num: '', gk_line: '', raw: '', theme: '', insights: [], highlights: [] }; });
  return {
    theme: 'A', guide: '', companion: '',
    dob: '', tob: '', pob: '',
    points, profile: Object.assign({}, extraProfile || {}),
    gk_profile: { cs: null, us: null, ce: null, ue: null },
  };
}

function runImport(state) {
  const doc = makeDoc();
  const sandbox = buildSandbox(state, doc);
  vm.createContext(sandbox);
  vm.runInContext(SRC + '\n' + renderShim +
    '\nwindow.cuRenderCompassTissueSalts = cuRenderCompassTissueSalts;' +
    '\nthis.__loadJSON = loadJSON;', sandbox);
  // Simulate FileReader: call loadJSON, then fire onload with the fixture.
  // loadJSON sets reader.onload then calls reader.readAsText; our FileReader
  // is inert, so we re-create the closure by patching FileReader to capture.
  let captured = null;
  sandbox.FileReader = class {
    set onload(fn) { captured = fn; }
    readAsText() { captured && captured({ target: { result: LEGACY } }); }
  };
  vm.runInContext('this.__loadJSON({});', sandbox);
  return { state, doc };
}

console.log('cOMpass legacy-JSON import hydration (Eda)\n');

// Expected genuine chart for the fixture's birth data.
const r = Places.resolve('London England');
const expectChart = Astro.computeIdentityChart({
  year: 1988, month: 4, day: 12, hour: 9, minute: 45,
  tzOffsetMinutes: r.tzOffsetMinutes, lat: r.latitude, lng: r.longitude,
});

console.log('1. tropical astrology populates from imported birth data');
{
  const { state } = runImport(freshState());
  ok(state.profile.astrology_sun === expectChart.tropical.sun,
     'astrology_sun = ' + expectChart.tropical.sun + ' (got ' + state.profile.astrology_sun + ')');
  ok(state.profile.astrology_moon === expectChart.tropical.moon,
     'astrology_moon = ' + expectChart.tropical.moon + ' (got ' + state.profile.astrology_moon + ')');
  ok(state.profile.astrology_rising === expectChart.tropical.rising,
     'astrology_rising = ' + expectChart.tropical.rising + ' (got ' + state.profile.astrology_rising + ')');
}

console.log('\n2. Vedic astrology populates from imported birth data');
{
  const { state } = runImport(freshState());
  ok(state.profile.vedic_sun === expectChart.vedic.sun,
     'vedic_sun = ' + expectChart.vedic.sun + ' (got ' + state.profile.vedic_sun + ')');
  ok(state.profile.vedic_moon === expectChart.vedic.moon,
     'vedic_moon = ' + expectChart.vedic.moon + ' (got ' + state.profile.vedic_moon + ')');
  ok(state.profile.vedic_ascendant === expectChart.vedic.ascendant,
     'vedic_ascendant = ' + expectChart.vedic.ascendant + ' (got ' + state.profile.vedic_ascendant + ')');
}

console.log('\n3. Gene Keys populate — legacy gk_profile promoted to room slots');
{
  const { state } = runImport(freshState());
  // The fixture carries gates only in gk_profile (cs/ce/us/ue). They must
  // surface in the per-room points so the visible Gene Key inputs hydrate.
  ok(state.points.work.gk_num === '25',  'work room gk_num = cs 25 (got ' + state.points.work.gk_num + ')');
  ok(state.points.work.gk_line === '3',  'work room gk_line = csLine 3');
  ok(state.points.lens.gk_num === '46',  'lens room gk_num = ce 46');
  ok(state.points.field.gk_num === '17', 'field room gk_num = us 17');
  ok(state.points.call.gk_num === '18',  'call room gk_num = ue 18');
  // OM Cipher modal Gene Key activation strings also populate.
  ok(/^GK \d+/.test(state.profile.gene_keys_life_work || ''),
     'gene_keys_life_work activation string populated (got "' + state.profile.gene_keys_life_work + '")');
  ok(/^GK \d+/.test(state.profile.gene_keys_purpose || ''),
     'gene_keys_purpose activation string populated');
}

console.log('\n4. tissue salts still populate (regression guard)');
{
  const { state } = runImport(freshState());
  ok(Array.isArray(state.profile.salts) && state.profile.salts.length > 0,
     'state.profile.salts is a non-empty array (got ' +
     (Array.isArray(state.profile.salts) ? state.profile.salts.length : typeof state.profile.salts) + ')');
  ok(state.profile.salts[0] && state.profile.salts[0].saltId === 'kali_phos',
     'imported primary salt preserved (kali_phos)');
}

console.log('\n5. privacy: a prior occupant\'s data cannot survive the import');
{
  // Pre-seed state as if a DIFFERENT person had been in this cOMpass first.
  const prior = freshState({
    first_name: 'Otherperson', last_name: 'Ghost', legal_name: 'Otherperson Ghost',
    astrology_sun: 'Leo', astrology_moon: 'Taurus', astrology_rising: 'Scorpio',
    vedic_sun: 'Cancer', vedic_moon: 'Gemini', vedic_ascendant: 'Aries',
    gene_keys_life_work: 'GK 1 · Ghost (Line 1)',
    birth_latitude: 12.34, birth_longitude: 56.78, birth_tz_offset_minutes: 480,
    salts: [{ saltId: 'silicea', weight: 1.0, kind: 'primary' }],
  });
  prior.dob = '1950-01-01'; prior.tob = '00:00'; prior.pob = 'Tokyo Japan';
  prior.companion = 'Otherperson Ghost';
  POINTS.forEach(p => { prior.points[p].gk_num = '7'; prior.points[p].gk_line = '7'; });
  prior.gk_profile = { cs: 7, csLine: 7, ce: 7, ceLine: 7, us: 7, usLine: 7, ue: 7, ueLine: 7 };

  const { state } = runImport(prior);

  // Identity now reflects Eda, never the ghost.
  ok(state.companion === 'Eda Solberg', 'companion replaced by imported person (Eda Solberg)');
  ok(state.profile.first_name === 'Eda', 'profile.first_name = Eda (ghost gone)');
  ok(state.profile.astrology_sun === expectChart.tropical.sun,
     'astrology_sun recomputed for Eda (' + expectChart.tropical.sun + '), not ghost Leo (got ' + state.profile.astrology_sun + ')');
  ok(state.profile.vedic_sun === expectChart.vedic.sun,
     'vedic_sun recomputed for Eda (' + expectChart.vedic.sun + '), not ghost Cancer (got ' + state.profile.vedic_sun + ')');
  ok(state.points.work.gk_num === '25',
     'work gk_num is Eda\'s 25, not ghost 7 (got ' + state.points.work.gk_num + ')');
  ok(!/Ghost/.test(state.profile.gene_keys_life_work || ''),
     'ghost gene-key activation string did not survive');
  ok(state.profile.salts[0] && state.profile.salts[0].saltId === 'kali_phos',
     'salts are Eda\'s imported set, not ghost silicea (got ' +
     (state.profile.salts[0] && state.profile.salts[0].saltId) + ')');
  // Birth coordinates were reset + re-resolved from Eda's POB (London ≈ 51.5, ~0).
  ok(Math.round(state.profile.birth_latitude) === 51,
     'birth_latitude re-resolved to London (~51), not ghost Tokyo 12.34 (got ' + state.profile.birth_latitude + ')');
}

console.log('\n' + (fail === 0 ? '✅ all passed' : '❌ ' + fail + ' failed') +
  ` (${pass} passed, ${fail} failed)`);
if (fail) process.exit(1);
