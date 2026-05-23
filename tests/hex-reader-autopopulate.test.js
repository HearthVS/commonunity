/* Hexagram reader · auto-populate from profile after unlock
 *
 * The reader used to require a guide to type a Gene Key number
 * into each room before any hexagram would load. For companions
 * using the app on their own, this made the reader effectively
 * unreachable after entering the activation code.
 *
 * Fix: after unlock, refreshAllHexReaders() calls
 * hydrateHexReaderGatesFromProfile(), which fills blank
 * state.points[p].gk_num from the four birth-derived gates
 * already stored on state.profile. Manual guide entries are
 * preserved (only blanks are filled).
 *
 * This test extracts the helper plus refreshAllHexReaders from
 * index.html and exercises it against synthetic state. It does
 * not boot the DOM; only the pure data path is verified.
 *
 *   Run: node tests/hex-reader-autopopulate.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const indexSrc = fs.readFileSync(
  path.join(__dirname, '..', 'index.html'),
  'utf8'
);

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

const hydrateSrc  = extractFn(indexSrc, 'hydrateHexReaderGatesFromProfile');
const refreshAllSrc = extractFn(indexSrc, 'refreshAllHexReaders');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

function runCase(name, opts) {
  const sandbox = {
    POINTS: ['work', 'lens', 'field', 'call'],
    HEX_UNLOCKED: !!opts.unlocked,
    state: opts.state,
    refreshCalls: [],
    lookupCalls: [],
    document: {
      getElementById: function (id) {
        // Return a stub input element if the test wants to assert
        // visible-input mirroring. Otherwise null.
        if (opts.numInputs && Object.prototype.hasOwnProperty.call(opts.numInputs, id)) {
          return opts.numInputs[id];
        }
        return null;
      }
    },
    // Stubs that the helper calls best-effort.
    autoPopulateGeneKeysFromState: function () { /* no-op */ },
    lookupGK: function (p) { sandbox.lookupCalls.push(p); },
    saveToStorage: function () { /* no-op */ },
    refreshHexReader: function (p) { sandbox.refreshCalls.push(p); }
  };
  vm.createContext(sandbox);
  vm.runInContext(hydrateSrc + '\n' + refreshAllSrc, sandbox);
  vm.runInContext('refreshAllHexReaders();', sandbox);
  console.log('\n' + name);
  return sandbox;
}

// ── 1. Unlocked + profile present → blank rooms get auto-filled ────────
{
  const numInputs = {
    'work-gk-num':  { value: '' },
    'lens-gk-num':  { value: '' },
    'field-gk-num': { value: '' },
    'call-gk-num':  { value: '' }
  };
  const s = runCase(
    '1. unlocked + profile gates present → blank rooms auto-filled',
    {
      unlocked: true,
      numInputs: numInputs,
      state: {
        dob: '1977-01-01',
        points: {
          work:  { gk_num: '' },
          lens:  { gk_num: '' },
          field: { gk_num: '' },
          call:  { gk_num: '' }
        },
        profile: {
          gene_keys_life_work: 'GK 14 · Bounteousness (Line 4)',
          gene_keys_evolution: 'GK 8 · Style (Line 4)',
          gene_keys_radiance:  'GK 29 · Devotion (Line 3)',
          gene_keys_purpose:   'GK 30 · Rapture (Line 3)'
        }
      }
    }
  );
  ok(s.state.points.work.gk_num  === '14', "work room populated from gene_keys_life_work (= '14')");
  ok(s.state.points.lens.gk_num  === '8',  "lens room populated from gene_keys_evolution (= '8')");
  ok(s.state.points.field.gk_num === '29', "field room populated from gene_keys_radiance (= '29')");
  ok(s.state.points.call.gk_num  === '30', "call room populated from gene_keys_purpose (= '30')");
  ok(numInputs['work-gk-num'].value === '14',  "visible #work-gk-num input mirrored");
  ok(numInputs['lens-gk-num'].value === '8',   "visible #lens-gk-num input mirrored");
  ok(numInputs['field-gk-num'].value === '29', "visible #field-gk-num input mirrored");
  ok(numInputs['call-gk-num'].value === '30',  "visible #call-gk-num input mirrored");
  ok(s.refreshCalls.length === 4, "refreshHexReader called once per point after hydration");
  ok(s.lookupCalls.length === 4,  "lookupGK called once per point to refresh Shadow/Gift/Siddhi triad");
}

// ── 2. Manual guide entry is NEVER overwritten ────────────────────────
{
  const s = runCase(
    '2. manual guide entry is preserved (override remains authoritative)',
    {
      unlocked: true,
      state: {
        dob: '1977-01-01',
        points: {
          work:  { gk_num: '42' },  // guide-set
          lens:  { gk_num: '' },
          field: { gk_num: '' },
          call:  { gk_num: '' }
        },
        profile: {
          gene_keys_life_work: 'GK 14 · Bounteousness (Line 4)',
          gene_keys_evolution: 'GK 8 · Style (Line 4)',
          gene_keys_radiance:  'GK 29 · Devotion (Line 3)',
          gene_keys_purpose:   'GK 30 · Rapture (Line 3)'
        }
      }
    }
  );
  ok(s.state.points.work.gk_num === '42', "manual work entry '42' is preserved (NOT overwritten)");
  ok(s.state.points.lens.gk_num === '8',  "blank lens room is still auto-filled (= '8')");
}

// ── 3. Locked → no hydration, no manual data clobbered ────────────────
{
  const s = runCase(
    '3. locked reader does NOT hydrate (preserves existing behaviour pre-unlock)',
    {
      unlocked: false,
      state: {
        dob: '1977-01-01',
        points: {
          work:  { gk_num: '' },
          lens:  { gk_num: '' },
          field: { gk_num: '' },
          call:  { gk_num: '' }
        },
        profile: {
          gene_keys_life_work: 'GK 14 · Bounteousness (Line 4)'
        }
      }
    }
  );
  ok(s.state.points.work.gk_num === '', "work room remains blank when reader is locked");
}

// ── 4. No birth data → no-op, no breakage ─────────────────────────────
{
  const s = runCase(
    '4. no birth data → graceful no-op, reader still tries to paint',
    {
      unlocked: true,
      state: {
        // No dob, no profile. The reader must still call
        // refreshHexReader per point so the empty-state UI renders.
        points: {
          work:  { gk_num: '' },
          lens:  { gk_num: '' },
          field: { gk_num: '' },
          call:  { gk_num: '' }
        }
      }
    }
  );
  ok(s.state.points.work.gk_num === '', "no profile data → work room stays blank (fallback to manual)");
  ok(s.refreshCalls.length === 4, "refreshHexReader still called per point (empty-state UI shows)");
}

// ── 5. Malformed profile values → defensive parse, no throw ───────────
{
  const s = runCase(
    '5. malformed profile values → defensive parse, no throw',
    {
      unlocked: true,
      state: {
        dob: '1977-01-01',
        points: {
          work:  { gk_num: '' },
          lens:  { gk_num: '' },
          field: { gk_num: '' },
          call:  { gk_num: '' }
        },
        profile: {
          gene_keys_life_work: 'banana',
          gene_keys_evolution: 'GK 99 · invalid (Line 4)',  // out of range
          gene_keys_radiance:  'GK 0 (Line 1)',              // out of range
          gene_keys_purpose:   'GK 14'                       // legal, no line
        }
      }
    }
  );
  ok(s.state.points.work.gk_num  === '',   "non-matching 'banana' → no fill");
  ok(s.state.points.lens.gk_num  === '',   "out-of-range 99 → no fill");
  ok(s.state.points.field.gk_num === '',   "out-of-range 0 → no fill");
  ok(s.state.points.call.gk_num  === '14', "minimal 'GK 14' still parsed");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
