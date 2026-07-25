/* cOMpass Gene Keys auto-population on the Threshold → cOMpass boot path.
 *
 * Bug (beta): an invitee completed the Threshold (which collects name + birth
 * date/time/place) and landed on cOMpass, but the main page showed the empty
 * "Enter a Gene Key in the Guide panel…" placeholder in all four rooms.
 * Opening Settings and pressing "Reveal my profile" then populated the correct
 * Gene Keys.
 *
 * Root cause: the companion-visible Shadow/Gift/Siddhi triads read ONLY the
 * per-room gates state.points[*].gk_num / gk_line, and no boot/handoff path
 * ever derived them from the contract's birth data. calcGeneKeys() (the
 * "Reveal my profile" handler) was the sole writer. The one calculation on the
 * boot path, autoPopulateGeneKeysFromState(), writes only the formatted
 * state.profile.gene_keys_* strings and the OM Cipher modal inputs. The
 * blank-only room seeder hydrateHexReaderGatesFromProfile() already did the
 * whole job but was unreachable — its only caller sits behind
 * `if (HEX_UNLOCKED)`, which is false by default.
 *
 * Fix under test (index.html):
 *   1. cuHydrateGeneKeysFromContract() — called from initThresholdContract()
 *      after birth-data hydration and before the openCompass() attempt.
 *   2. hydrateHexReaderGatesFromProfile() now carries gk_line as well as the
 *      gate number, and mirrors both into the visible inputs.
 *   3. cuPurgeForeignCompanionState() — cOMpass keeps one global localStorage
 *      key, so a different companion on a shared browser must not inherit (or
 *      be silently recomputed onto) the previous occupant's birth data/gates.
 *      Server identity is authoritative; local/contract identity is only ever
 *      used to detect a mismatch.
 *   4. Null guards on openCompass()'s guide-name/companion-name reads.
 *   5. No "already done" flag — blank-only writes stay idempotent and an
 *      explicit recalc remains authoritative.
 *
 * Runs the real functions extracted from index.html in a vm sandbox against
 * the real sdk/genekeys.js engine and a minimal fake DOM, so the
 * auto-populated gates are asserted to equal what calcGeneKeys() produces.
 *
 *   Run: node tests/compass-gene-keys-threshold-boot.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT     = path.join(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gkSrc    = fs.readFileSync(path.join(ROOT, 'sdk', 'genekeys.js'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}
function section(t) { console.log('\n' + t); }

const POINTS = ['work', 'lens', 'field', 'call'];

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

// Ordering assertions must look at CODE, not at comments that mention the same
// identifiers. Strip // line comments and /* */ blocks first.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

// The derived-identity purge list is a var, not a function — take it verbatim
// from index.html so the test cannot drift from the shipped list.
function extractVarArray(src, name) {
  const start = src.indexOf('var ' + name);
  if (start < 0) throw new Error('cannot find var ' + name);
  const end = src.indexOf('];', start);
  return src.slice(start, end + 2);
}

// ── Minimal fake DOM: id-keyed value/innerHTML sinks. ──────────────────────
function makeDoc() {
  const els = {};
  function el(id) {
    if (!els[id]) {
      els[id] = {
        id, value: '', textContent: '', innerHTML: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        querySelector() { return null; }, querySelectorAll() { return []; },
        appendChild() {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener() {},
      };
    }
    return els[id];
  }
  return {
    _els: els,
    _has(id) { return Object.prototype.hasOwnProperty.call(els, id); },
    getElementById(id) { return el(id); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return el('__tmp_' + Math.random()); },
  };
}

function freshState(over) {
  const points = {};
  POINTS.forEach(p => {
    points[p] = { gk_num: '', gk_line: '', raw: '', theme: '', observations: '',
                  insights: [], highlights: [], qa_answers: {}, frequency: -1 };
  });
  return Object.assign({
    theme: 'A', guide: '', companion: '', dob: '', tob: '', pob: '',
    points, profile: {}, gk_profile: { cs: null, us: null, ce: null, ue: null },
    hexagramsByPoint: {},
  }, over || {});
}

const SRC = [
  'dateToJD', 'jdToSolarLongitude', 'longitudeToGateLine',
  'cuSessionIdentityBound',
  'cuNormalizeIdentityName', 'cuLocalStateIdentity',
  'cuPurgeForeignCompanionState', 'cuHydrateGeneKeysFromContract',
  'autoPopulateGeneKeysFromState', 'hydrateHexReaderGatesFromProfile',
  'updateSGSTriad', 'calcGeneKeys',
].map(n => extractFn(indexSrc, n)).join('\n\n');

const PURGE_LIST_SRC = extractVarArray(indexSrc, 'CU_DERIVED_IDENTITY_FIELDS');

// Real Gene Keys gate table shape — only .gift/.shadow/.siddhi are read.
const GENE_KEYS = new Proxy({}, {
  get: (_t, k) => (Number(k) >= 1 && Number(k) <= 64)
    ? { gift: 'Gift' + k, shadow: 'Shadow' + k, siddhi: 'Siddhi' + k } : undefined,
  has: (_t, k) => Number(k) >= 1 && Number(k) <= 64,
});

function build(state, contractIdentity, sessionIdentity, opts) {
  const o = doc0 => doc0;
  const doc = makeDoc();
  const saves = [];
  const sandbox = {
    document: doc, state, POINTS, GENE_KEYS, console,
    SESSION_IDENTITY: sessionIdentity || null,
    window: {
      ThresholdGate: {
        read: () => (contractIdentity === null ? null : {
          threshold: { completed: true }, identity: contractIdentity,
        }),
      },
    },
    // Side effects we don't assert on.
    showToast() {}, renderLineTheme() {}, loadHexagram: () => ({ then() {} }),
    loadLineData() {}, renderInsights() {}, renderHighlights() {},
    restoreL3Output() {}, updateNamesDisplay() {}, updateNameLabels() {},
    syncSetupIntoProfile() {}, calcIdentityChartFromState() {},
    refreshAllHexReaders() {}, tropicalSunSign: () => null,
    triggerDiamondActivation(cb) { if (cb) cb(); },
    updateAllSGSTriads() { POINTS.forEach(p => sandbox.updateSGSTriad(p)); },
    saveToStorage() { saves.push(JSON.parse(JSON.stringify(state))); },
    setTimeout: fn => { try { fn(); } catch (_) {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(gkSrc, sandbox);
  vm.runInContext(PURGE_LIST_SRC + '\n' + SRC, sandbox);
  // lookupGK is the real bridge from gate → triad; keep the part we assert.
  vm.runInContext(
    'function lookupGK(point){ updateSGSTriad(point); }' +
    '\nthis.__api = { cuHydrateGeneKeysFromContract, cuPurgeForeignCompanionState,' +
    ' hydrateHexReaderGatesFromProfile, calcGeneKeys, updateSGSTriad,' +
    ' cuNormalizeIdentityName, cuLocalStateIdentity, autoPopulateGeneKeysFromState };',
    sandbox);
  return { sandbox, doc, api: sandbox.__api, saves, o };
}

// Gates calcGeneKeys() would produce for a given birth moment, via the real
// engine — the reference the passive path must match.
function referenceGates(sandbox, dob, tob) {
  const st = freshState({ dob, tob });
  const env = build(st, { full_name: 'Ref Person', birth_date: dob, birth_time: tob },
    null, {});
  env.doc.getElementById('dob').value = dob;
  env.doc.getElementById('tob').value = tob;
  env.api.calcGeneKeys();
  const out = {};
  POINTS.forEach(p => { out[p] = { num: st.points[p].gk_num, line: st.points[p].gk_line }; });
  return out;
}

const DOB = '1985-03-14', TOB = '09:25';
const ID_A = { full_name: 'Eda Çarmıklı', birth_date: DOB, birth_time: TOB, birth_place: 'Istanbul' };
const ID_B = { full_name: 'Markus Lehto', birth_date: '1972-11-02', birth_time: '18:40', birth_place: 'Helsinki' };

// ══════════════════════════════════════════════════════════════════════════
section('1. Fresh companion completes Threshold → gates auto-populate');
{
  const st = freshState({ dob: DOB, tob: TOB });
  const env = build(st, ID_A, null, {});
  env.api.cuHydrateGeneKeysFromContract();

  const ref = referenceGates(env.sandbox, DOB, TOB);
  let allNums = true, allLines = true, matches = true;
  POINTS.forEach(p => {
    const g = st.points[p];
    if (!String(g.gk_num || '').trim())  allNums = false;
    if (!String(g.gk_line || '').trim()) allLines = false;
    if (g.gk_num !== ref[p].num || g.gk_line !== ref[p].line) matches = false;
  });
  ok(allNums,  'every room received a gk_num without pressing Reveal');
  ok(allLines, 'every room received a gk_line without pressing Reveal');
  ok(matches,  'auto-populated gates equal calcGeneKeys() exactly');

  // The companion-visible triad, not just state.
  POINTS.forEach(p => env.api.updateSGSTriad(p));
  const triadsRendered = POINTS.every(p => {
    const html = env.doc.getElementById('sgs-' + p).innerHTML;
    return html && !/sgs-empty/.test(html);
  });
  ok(triadsRendered, 'all four SGS triads render (no "Enter a Gene Key" placeholder)');
  const linesShown = POINTS.every(p =>
    /·\s*Line\s*[1-6]/.test(env.doc.getElementById('sgs-' + p).innerHTML));
  ok(linesShown, 'each triad shows its line number');

  const mirrored = POINTS.every(p =>
    env.doc.getElementById(p + '-gk-num').value === st.points[p].gk_num &&
    env.doc.getElementById(p + '-gk-line').value === st.points[p].gk_line);
  ok(mirrored, 'gate + line mirrored into the visible guide-panel inputs');
}

section('2. Idempotence and manual-override preservation (no "already done" flag)');
{
  const st = freshState({ dob: DOB, tob: TOB });
  const env = build(st, ID_A, null, {});
  env.api.cuHydrateGeneKeysFromContract();
  const first = JSON.stringify(st.points);
  env.api.cuHydrateGeneKeysFromContract();
  env.api.cuHydrateGeneKeysFromContract();
  ok(JSON.stringify(st.points) === first, 'repeated boot hydration is a no-op (idempotent)');

  ok(!/already_done|geneKeysHydrated|gk_hydrated|hydrated_once/i.test(SRC),
    'no persisted "already done" flag was introduced');

  const st2 = freshState({ dob: DOB, tob: TOB });
  st2.points.work.gk_num = '7'; st2.points.work.gk_line = '3';
  const env2 = build(st2, ID_A, null, {});
  env2.api.cuHydrateGeneKeysFromContract();
  ok(st2.points.work.gk_num === '7' && st2.points.work.gk_line === '3',
    'a manual guide entry survives (blank-only writes)');
  ok(String(st2.points.lens.gk_num || '').trim() !== '',
    'other rooms still hydrate alongside the manual override');
}

section('3. Reveal remains functional and authoritative; corrected birth data recalculates');
{
  const st = freshState({ dob: DOB, tob: TOB });
  const env = build(st, ID_A, null, {});
  env.api.cuHydrateGeneKeysFromContract();
  const autoWork = st.points.work.gk_num;

  // Corrected birth details, then explicit Reveal.
  const NEW_DOB = '1985-07-22';
  st.dob = NEW_DOB;
  env.doc.getElementById('dob').value = NEW_DOB;
  env.doc.getElementById('tob').value = TOB;
  env.api.calcGeneKeys();

  const ref = referenceGates(env.sandbox, NEW_DOB, TOB);
  const overwritten = POINTS.every(p =>
    st.points[p].gk_num === ref[p].num && st.points[p].gk_line === ref[p].line);
  ok(overwritten, 'Reveal overwrites every room with the corrected gates');
  ok(st.points.work.gk_num !== autoWork || NEW_DOB === DOB,
    'corrected birth data produces different gates than the first hydration');
  ok(String(st.gk_profile.cs || '') !== '', 'Reveal still fills the engine slots (gk_profile)');
}

section('4. Shared browser: a different companion cannot inherit the prior profile');
{
  // Occupant A's state is already in localStorage; B now completes Threshold.
  const st = freshState({
    dob: ID_A.birth_date, tob: ID_A.birth_time, pob: ID_A.birth_place,
    companion: ID_A.full_name,
    profile: { legal_name: ID_A.full_name, first_name: 'Eda', last_name: 'Çarmıklı',
               gene_keys_life_work: 'GK 41 · GiftA (Line 2)',
               astrology_sun: 'Pisces', vedic_moon: 'Ashwini',
               birth_latitude: 41.0, birth_longitude: 29.0, salts: { a: 1 } },
  });
  POINTS.forEach(p => {
    st.points[p].gk_num = '41'; st.points[p].gk_line = '2';
    st.points[p].raw = "A's private transcript";
    st.points[p].observations = "A's guide-only note";
    st.points[p].summary = "A's summary";
    st.points[p].insights = ['one']; st.points[p].highlights = ['two'];
  });

  const env = build(st, ID_B, null, {});
  const purged = env.api.cuPurgeForeignCompanionState(ID_B.full_name);
  ok(purged === true, 'identity mismatch is detected and purged');
  ok(st.dob === '' && st.tob === '' && st.pob === '', "prior occupant's birth data is gone");
  ok(st.companion === '' && !st.profile.legal_name && !st.profile.first_name,
    "prior occupant's identity fields are cleared");
  ok(POINTS.every(p => st.points[p].gk_num === '' && st.points[p].gk_line === ''),
    "prior occupant's room gates are cleared");
  ok(!st.profile.gene_keys_life_work && !st.profile.astrology_sun &&
     !st.profile.vedic_moon && !st.profile.birth_latitude && !st.profile.salts,
    'all derived identity-bearing profile fields are cleared');
  ok(st.gk_profile.cs === null, 'engine slots are reset');
  ok(POINTS.every(p => st.points[p].raw === '' && st.points[p].observations === '' &&
                       st.points[p].summary === '' && st.points[p].insights.length === 0 &&
                       st.points[p].highlights.length === 0),
    "prior occupant's authored room content is cleared");

  // B's own contract now seeds B's gates — and they are B's, not A's.
  st.dob = ID_B.birth_date; st.tob = ID_B.birth_time;
  env.api.cuHydrateGeneKeysFromContract();
  const refB = referenceGates(env.sandbox, ID_B.birth_date, ID_B.birth_time);
  ok(POINTS.every(p => st.points[p].gk_num === refB[p].num),
    "the new companion's own gates populate after the purge");
  ok(POINTS.every(p => st.points[p].gk_num !== '41'), "none of A's gates survive");
}

section('5. Returning same companion keeps their state (no false purge)');
{
  const st = freshState({
    dob: DOB, tob: TOB, companion: ID_A.full_name,
    profile: { legal_name: ID_A.full_name, gene_keys_life_work: 'GK 41 · GiftA (Line 2)' },
  });
  POINTS.forEach(p => { st.points[p].gk_num = '41'; st.points[p].gk_line = '2'; });
  const env = build(st, ID_A, null, {});

  ok(env.api.cuPurgeForeignCompanionState(ID_A.full_name) === false,
    'exact same name → no purge');
  ok(env.api.cuPurgeForeignCompanionState('  eda   çarmıklı  ') === false,
    'case/whitespace variation → no purge');
  ok(env.api.cuPurgeForeignCompanionState(ID_A.full_name.normalize('NFD')) === false,
    'unicode NFD/NFC variation of the same name → no purge (diacritics safe)');
  ok(st.dob === DOB && st.points.work.gk_num === '41',
    'returning companion retains birth data and gates');

  const fresh = freshState({});
  const envF = build(fresh, ID_A, null, {});
  ok(envF.api.cuPurgeForeignCompanionState(ID_A.full_name) === false,
    'fresh browser (no local identity) → nothing to purge');
  ok(env.api.cuPurgeForeignCompanionState('') === false,
    'no authoritative name → never purges (fails safe)');
}

section('6. Server identity wins over local/contract identity');
{
  // A stale contract from a previous occupant must not seed birth data for the
  // companion the SERVER says is bound.
  const st = freshState({});
  const bound = { authenticated: true, role: 'companion', companion_name: ID_B.full_name };
  const env = build(st, ID_A, bound, {});
  env.api.cuHydrateGeneKeysFromContract();
  ok(st.dob === '', "a foreign contract's birth date is ignored under a bound session");
  ok(POINTS.every(p => String(st.points[p].gk_num || '') === ''),
    'no gates are derived from the foreign contract');

  // The bound companion's own contract is accepted.
  const st2 = freshState({});
  const env2 = build(st2, ID_B, bound, {});
  env2.api.cuHydrateGeneKeysFromContract();
  ok(st2.dob === ID_B.birth_date, "the bound companion's own contract seeds birth data");
  ok(POINTS.every(p => String(st2.points[p].gk_num || '') !== ''),
    "the bound companion's gates populate");

  // Purge decision uses the server name when a session is bound.
  const boot = extractFn(indexSrc, 'initThresholdContract');
  ok(/cuPurgeForeignCompanionState\(\s*[\s\S]{0,200}cuSessionIdentityBound\(\)/.test(boot),
    'initThresholdContract prefers the server identity for the purge decision');
  ok(/cuSessionIdentityBound\(\)\s*&&\s*id\.full_name/.test(
       extractFn(indexSrc, 'cuHydrateGeneKeysFromContract')),
    'contract seeding is gated on matching the bound server identity');
}

section('7. Wiring: boot path calls the hydration before the fragile openCompass()');
{
  const boot = stripComments(extractFn(indexSrc, 'initThresholdContract'));
  const hy = boot.indexOf('cuHydrateGeneKeysFromContract()');
  const oc = boot.indexOf('openCompass()');
  ok(hy > 0, 'initThresholdContract calls cuHydrateGeneKeysFromContract()');
  ok(oc > 0 && hy < oc, 'it runs BEFORE the openCompass() attempt that may throw');
  ok(boot.indexOf('id.birth_date') > 0 && boot.indexOf('id.birth_date') < hy,
    'it runs AFTER birth-data hydration');
  ok(boot.indexOf('cuPurgeForeignCompanionState') < boot.indexOf('id.full_name'),
    'the identity-safety purge runs before any hydration');

  const applyId = stripComments(extractFn(indexSrc, "cuApplySessionIdentity"));
  ok(/cuPurgeForeignCompanionState\(name\)/.test(applyId),
    'the authoritative server identity resolution purges a foreign local state');
  ok(applyId.indexOf('cuPurgeForeignCompanionState') < applyId.indexOf('state.companion = name'),
    'the purge happens before the server name overwrites the local one');
  ok(/cuHydrateGeneKeysFromContract\(\)/.test(applyId),
    'gates are re-derived once the async identity fetch resolves');

  const oc2 = stripComments(extractFn(indexSrc, "openCompass"));
  ok(/guideEl\s*\?\s*guideEl\.value/.test(oc2) &&
     /companionEl\s*\?\s*companionEl\.value/.test(oc2),
    'openCompass null-guards its guide-name/companion-name reads');
  ok(!/getElementById\('guide-name'\)\.value/.test(oc2),
    'the unguarded dereference is gone');
}

section('8. No-birth-data and no-contract paths stay safe');
{
  const st = freshState({});
  const env = build(st, { full_name: 'No Birth Data' }, null, {});
  let threw = false;
  try { env.api.cuHydrateGeneKeysFromContract(); } catch (_) { threw = true; }
  ok(!threw, 'a contract without birth data does not throw');
  ok(POINTS.every(p => String(st.points[p].gk_num || '') === ''),
    'no gates are invented without birth data');

  const st2 = freshState({});
  const env2 = build(st2, null, null, {});
  let threw2 = false;
  try { env2.api.cuHydrateGeneKeysFromContract(); } catch (_) { threw2 = true; }
  ok(!threw2, 'a missing contract does not throw');
}

section('9. Scope: nothing unrelated changed');
{
  ok(/HEX_UNLOCKED/.test(indexSrc), 'HEX_UNLOCKED gate still present (reader path untouched)');
  const refresh = extractFn(indexSrc, 'refreshAllHexReaders');
  ok(/if \(HEX_UNLOCKED\)/.test(refresh),
    'refreshAllHexReaders still gates its own seeding on HEX_UNLOCKED');
  ok(/GUIDE_ONLY_POINT_FIELDS|cuStripImportedIdentity/.test(indexSrc),
    'Tranche 1 import allowlist still present');
  const strip = extractFn(indexSrc, 'cuStripImportedIdentity');
  ok(/IMPORT_FORBIDDEN_TOP/.test(strip), 'the import identity stripper is unmodified in shape');
}

console.log('\n' + (fail === 0 ? 'PASS' : 'FAIL') + ' — ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
