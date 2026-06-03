/* cOMpass setup recalculation is authoritative for room Gene Keys
 *
 * Bug (Stage 2): calcGeneKeys() updated the setup table unconditionally but
 * wrote room state.points[point].gk_num ONLY when blank. So a user who entered
 * the wrong birth data, calculated, then corrected the DOB and recalculated saw
 * the setup table update while the rooms — and the Hexagram Readers that read
 * them — kept the stale gates. Loading a JSON session (which overwrites
 * compassData wholesale) was the only way to fix it.
 *
 * Fix: an explicit Calculate now overwrites room gk_num/gk_line from the freshly
 * computed gates for every point, mirrors them into the visible inputs, and
 * calls refreshAllHexReaders() so the UI updates immediately. Passive hydration
 * paths (hydrateHexReaderGatesFromProfile / autoPopulateGeneKeysFromState) stay
 * blank-only and are intentionally NOT exercised here.
 *
 * This extracts calcGeneKeys() from index.html and runs it in a sandbox with
 * stubbed DOM + astro/GK helpers. We drive two distinct "DOBs" by mapping the
 * parsed Sun longitude to two different gate sets, and assert the rooms follow
 * the second calculation rather than staying on the first.
 *
 *   Run: node tests/compass-recalc-authoritative.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('cannot find function ' + name);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const calcSrc = extractFn(indexSrc, 'calcGeneKeys');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

const POINTS = ['work', 'lens', 'field', 'call'];

// A stub element: textContent/value sinks plus the bits calcGeneKeys touches.
function stubEl() {
  return {
    value: '', textContent: '', style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelectorAll() { return []; },
  };
}

// Build a sandbox whose astronomy maps a chosen Sun longitude to a gate set.
// We bypass the real Meeus math: jdToSolarLongitude returns a fixed longitude
// we control per run, and longitudeToGateLine maps it to deterministic gates.
function makeSandbox(sunLon, els, refreshCalls, state) {
  return {
    // setup inputs
    document: {
      getElementById(id) {
        if (id === 'dob') return { value: '1990-01-01' };
        if (id === 'tob') return { value: '12:00' };
        if (!els[id]) els[id] = stubEl();
        return els[id];
      },
    },
    state,
    GENE_KEYS: new Proxy({}, { get: () => ({ gift: 'X', shadow: 'Y', siddhi: 'Z' }) }),
    // Astronomy stubs — the value of sunLon drives the gate set for this run.
    dateToJD: () => 2451545,
    jdToSolarLongitude: () => sunLon,
    // gate = (round(lon) % 64) + 1, line = (round(lon) % 6) + 1 — deterministic
    // and distinct for distinct longitudes, which is all the test needs.
    longitudeToGateLine: (lon) => {
      const r = Math.round(((lon % 360) + 360) % 360);
      return { gate: (r % 64) + 1, line: (r % 6) + 1 };
    },
    tropicalSunSign: () => 'Capricorn',
    // UI / side-effect stubs
    lookupGK() {},
    refreshAllHexReaders() { refreshCalls.push(true); },
    updateAllSGSTriads() {},
    syncSetupIntoProfile() {},
    calcIdentityChartFromState() {},
    saveToStorage() {},
    showToast() {},
    setTimeout: (fn) => { try { fn(); } catch (_) {} },
    console,
  };
}

function freshState() {
  const points = {};
  POINTS.forEach(p => { points[p] = {}; });
  return { points, profile: {}, gk_profile: null };
}

function gatesFor(sunLon) {
  // Mirror calcGeneKeys' own derivation so the test's expectation is
  // independent of the room-write code under test.
  const gl = (lon) => {
    const r = Math.round(((lon % 360) + 360) % 360);
    return { gate: (r % 64) + 1, line: (r % 6) + 1 };
  };
  const cs = gl(sunLon);
  const ce = gl((sunLon + 180) % 360);
  const us = gl(((sunLon - 88) + 360) % 360);
  const ue = gl((((sunLon - 88) + 360) % 360 + 180) % 360);
  return { work: cs, lens: ce, field: us, call: ue };
}

const state = freshState();
const els = {};
const refreshCalls = [];

function calculateWith(sunLon) {
  const sandbox = makeSandbox(sunLon, els, refreshCalls, state);
  vm.createContext(sandbox);
  vm.runInContext(calcSrc + '\ncalcGeneKeys();', sandbox);
}

console.log('1. first Calculate (DOB A) populates every room from the fresh gates');
const A_LON = 100;            // arbitrary "DOB A" Sun longitude
const expectA = gatesFor(A_LON);
calculateWith(A_LON);
POINTS.forEach(p => {
  ok(state.points[p].gk_num === String(expectA[p].gate),
     `${p}: room gk_num = A gate ${expectA[p].gate}`);
  ok(state.points[p].gk_line === String(expectA[p].line),
     `${p}: room gk_line = A line ${expectA[p].line}`);
});

console.log('\n2. recalculating with corrected DOB B overwrites the stale A gates');
const B_LON = 250;            // a different "DOB B" Sun longitude
const expectB = gatesFor(B_LON);
// Sanity: A and B must actually differ for at least the work room, else the
// test would pass trivially.
ok(expectA.work.gate !== expectB.work.gate, 'precondition: A and B produce different work gates');
calculateWith(B_LON);
POINTS.forEach(p => {
  ok(state.points[p].gk_num === String(expectB[p].gate),
     `${p}: room gk_num updated to B gate ${expectB[p].gate} (no longer stale A)`);
  ok(state.points[p].gk_num !== String(expectA[p].gate) || expectA[p].gate === expectB[p].gate,
     `${p}: stale A gate did not survive the recalc`);
});

console.log('\n3. the readers are refreshed on each explicit Calculate');
ok(refreshCalls.length === 2, 'refreshAllHexReaders() called once per Calculate (twice total)');

console.log('\n4. an explicit recalc overwrites a prior manual room edit (beta behavior)');
// Simulate a guide manually editing a room gate, then recalculating.
state.points.work.gk_num = '7';
state.points.work.gk_line = '1';
calculateWith(A_LON);
ok(state.points.work.gk_num === String(expectA.work.gate),
   'manual room edit is overwritten by explicit Calculate (documented beta behavior)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
