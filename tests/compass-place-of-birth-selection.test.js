/* cOMpass "Place of birth" — validated city selection.
 *
 * The field used to be free text: whatever was typed became state.pob
 * and was only fuzzy-matched afterwards, so a typo or an unlisted
 * place silently produced blank or wrong birth coordinates. The field
 * is now a combobox over the vendored gazetteer and downstream reads
 * the canonical record, never the typed string.
 *
 * Verifies:
 *   1. Gazetteer suggest() returns city-level canonical records
 *      carrying displayLabel / city / region / country / lat / lng /
 *      place id, ranks sensibly and narrows on extra tokens.
 *   2. findById() round-trips a stored place id.
 *   3. index.html ships the combobox markup + inline error element.
 *   4. Typed-but-unconfirmed text fails the save/continue gate with
 *      "Please choose a city from the list"; a chosen suggestion passes.
 *   5. Editing the label after choosing invalidates the selection.
 *   6. A legacy stored string (pre-selection sessions / imported JSON)
 *      is adopted once so returning users are not blocked.
 *   7. syncSetupIntoProfile persists the canonical record and takes
 *      coordinates from it rather than from the typed text.
 *
 * Run:  node tests/compass-place-of-birth-selection.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT      = path.resolve(__dirname, '..');
const indexSrc  = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const Places    = require(path.join(ROOT, 'sdk', 'place_gazetteer.js'));

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}
function section(t) { console.log('\n' + t); }

function extractFn(src, name) {
  const start = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (start < 0) return '';
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// ── 1. Gazetteer suggest() ────────────────────────────────────────
section('1. CommonUnityPlaces.suggest() · city-level canonical records');
{
  const hits = Places.suggest('sudb');
  ok('suggest("sudb") returns at least one match', hits.length > 0);
  const s = hits[0];
  ok('label is "Sudbury, Ontario, Canada"', s.displayLabel === 'Sudbury, Ontario, Canada');
  ok('carries city',        s.city === 'Sudbury');
  ok('carries region',      s.province === 'Ontario');
  ok('carries country',     s.country === 'Canada');
  ok('carries country code', s.iso2 === 'CA');
  ok('carries latitude',    Math.abs(s.latitude - 46.5) < 0.1);
  ok('carries longitude',   Math.abs(s.longitude + 80.97) < 0.1);
  ok('carries tz offset',   s.tzOffsetMinutes === -300);
  ok('carries a place id',  typeof s.id === 'string' && s.id.length > 0);

  const londons = Places.suggest('lond');
  ok('prefix query lists several cities', londons.length > 1);
  ok('largest city ranks first', londons[0].city === 'London');
  ok('all suggestions are locality-level (every row has a city)',
     londons.every(r => !!r.city));

  ok('extra tokens narrow the list',
     Places.suggest('springfield il')
       .every(r => r.province === 'Illinois'));
  ok('one-character query returns nothing', Places.suggest('s').length === 0);
  ok('unknown place returns nothing', Places.suggest('zzzznotacity').length === 0);
  ok('respects the limit option', Places.suggest('san', { limit: 3 }).length <= 3);
}

// ── 2. Stored place id round-trips ────────────────────────────────
section('2. findById() · a stored place id re-hydrates');
{
  const chosen = Places.suggest('sudb')[0];
  const back   = Places.findById(chosen.id);
  ok('findById returns a record', !!back);
  ok('it is the same place', back && back.displayLabel === chosen.displayLabel);
  ok('unknown id returns null', Places.findById('nope|xx||0|0') === null);
}

// ── 3. Markup ─────────────────────────────────────────────────────
section('3. index.html · combobox markup');
{
  ok('#pob is wrapped in a .place-combo', /class="place-combo"/.test(indexSrc));
  ok('#pob declares role="combobox"',
     /id="pob"[^>]*role="combobox"|role="combobox"[^>]*id="pob"/.test(indexSrc));
  ok('#pob opts out of browser autocomplete',
     /<input[^>]*id="pob"[^>]*autocomplete="off"/.test(indexSrc));
  ok('a suggestion listbox exists', /id="pob-suggest"[^>]*role="listbox"/.test(indexSrc));
  ok('an inline error element exists', /id="pob-error"/.test(indexSrc));
  ok('the suggestion list has styling', /\.place-suggest\s*\{/.test(indexSrc));
  ok('the "Open as Guide" button gates on a chosen city',
     /btn-open-compass'\)\.addEventListener\('click',[\s\S]{0,200}pobRequireSelection\(\)/.test(indexSrc));
  ok('"Reveal my profile" (calcGeneKeys) gates on a chosen city',
     /pobRequireSelection\(\)/.test(extractFn(indexSrc, 'calcGeneKeys')));
}

// ── Sandbox for the field controller ──────────────────────────────
const CONTROLLER = [
  'pobGazetteer', 'pobSetSelection', 'pobHasSelection', 'pobAdoptStoredValue',
  'pobSyncCanonicalPlace', 'pobSetError', 'pobCloseSuggestions',
  'pobRenderSuggestions', 'pobRequireSelection',
].map(n => extractFn(indexSrc, n)).join('\n\n');

function build(stateOver) {
  const els = {};
  function el(id) {
    if (!els[id]) {
      els[id] = {
        id, value: '', textContent: '', innerHTML: '', className: '',
        _cls: {},
        classList: {
          add: c => { els[id]._cls[c] = true; },
          remove: c => { delete els[id]._cls[c]; },
          toggle: (c, on) => { if (on) els[id]._cls[c] = true; else delete els[id]._cls[c]; },
          contains: c => !!els[id]._cls[c],
        },
        setAttribute() {}, focus() { els[id].focused = true; },
        appendChild() {}, querySelectorAll: () => [],
      };
    }
    return els[id];
  }
  const state = Object.assign(
    { pob: '', pob_place: null, profile: {} }, stateOver || {});
  const sandbox = {
    state, console,
    window: { CommonUnityPlaces: Places },
    document: { getElementById: el, createElement: () => ({ setAttribute() {}, addEventListener() {} }) },
    saveToStorage() {},
    _pobUserTyped: false, _pobMatches: [], _pobActiveIndex: -1,
  };
  vm.createContext(sandbox);
  vm.runInContext(CONTROLLER +
    '\nthis.__api = { pobRequireSelection, pobHasSelection, pobSetSelection,' +
    ' pobAdoptStoredValue, pobSyncCanonicalPlace };', sandbox);
  return { api: sandbox.__api, state, el, sandbox };
}

// ── 4. The save/continue gate ─────────────────────────────────────
section('4. Gate · typed text alone fails, a chosen suggestion passes');
{
  const env = build();
  env.el('pob').value = 'Sudburyyy';
  env.sandbox._pobUserTyped = true;
  ok('unconfirmed typed text fails the gate', env.api.pobRequireSelection() === false);
  ok('the inline error names the fix',
     env.el('pob-error').textContent === 'Please choose a city from the list');
  ok('the error is made visible', env.el('pob-error')._cls.visible === true);
  ok('no canonical place is stored', env.state.pob_place === null);

  const rec = Places.suggest('sudb')[0];
  env.api.pobSetSelection(rec, 'suggestion');
  env.el('pob').value = rec.displayLabel;
  ok('a chosen suggestion passes the gate', env.api.pobRequireSelection() === true);
  ok('the error is cleared', env.el('pob-error').textContent === '');
  ok('the stored label is the clean canonical one',
     env.state.pob === 'Sudbury, Ontario, Canada');

  const sel = env.state.pob_place;
  ok('stores a provider',   !!sel.provider);
  ok('stores a place id',   sel.place_id === rec.id);
  ok('stores displayLabel', sel.display_label === 'Sudbury, Ontario, Canada');
  ok('stores city',         sel.city === 'Sudbury');
  ok('stores region',       sel.region === 'Ontario');
  ok('stores country',      sel.country === 'Canada');
  ok('stores country code', sel.country_code === 'CA');
  ok('stores latitude',     typeof sel.latitude === 'number');
  ok('stores longitude',    typeof sel.longitude === 'number');
  ok('stores tz offset',    sel.tz_offset_minutes === -300);

  const empty = build();
  ok('an empty field still passes (place stays optional)',
     empty.api.pobRequireSelection() === true);
}

// ── 5. Editing the label invalidates the selection ────────────────
section('5. Editing a chosen label invalidates it');
{
  const env = build();
  const rec = Places.suggest('sudb')[0];
  env.api.pobSetSelection(rec, 'suggestion');
  env.el('pob').value = rec.displayLabel;
  ok('selection holds while the text matches', env.api.pobHasSelection() === true);
  env.el('pob').value = rec.displayLabel + ' (near the lake)';
  env.sandbox._pobUserTyped = true;
  ok('edited text no longer counts as chosen', env.api.pobHasSelection() === false);
  ok('and the gate rejects it', env.api.pobRequireSelection() === false);
}

// ── 6. Legacy compatibility ───────────────────────────────────────
section('6. Legacy stored strings are adopted, not rejected');
{
  const env = build({ pob: 'Sudbury ontario canada' });
  env.el('pob').value = 'Sudbury ontario canada';
  ok('a pre-selection session passes the gate', env.api.pobRequireSelection() === true);
  ok('it is upgraded to a canonical record',
     !!env.state.pob_place && env.state.pob_place.city === 'Sudbury');
  ok('adoption is marked as such',
     env.state.pob_place.selection_method === 'legacy-resolved');
  ok('the visible value is cleaned up',
     env.el('pob').value === 'Sudbury, Ontario, Canada');

  const junk = build({ pob: 'zzzzznotacity' });
  junk.el('pob').value = 'zzzzznotacity';
  ok('an unresolvable stored string still fails the gate',
     junk.api.pobRequireSelection() === false);
}

// ── 7. Downstream reads the canonical record ──────────────────────
section('7. Profile sync uses the canonical place, not typed text');
{
  const env = build();
  const rec = Places.suggest('sudb')[0];
  env.api.pobSetSelection(rec, 'suggestion');
  env.el('pob').value = rec.displayLabel;
  const sel = env.api.pobSyncCanonicalPlace();
  ok('returns the selection', !!sel);
  ok('profile.birth_place_canonical is persisted',
     env.state.profile.birth_place_canonical === env.state.pob_place);
  ok('birth_latitude comes from the selection',
     env.state.profile.birth_latitude === rec.latitude);
  ok('birth_longitude comes from the selection',
     env.state.profile.birth_longitude === rec.longitude);
  ok('birth_tz_offset_minutes comes from the selection',
     env.state.profile.birth_tz_offset_minutes === rec.tzOffsetMinutes);
  ok('birth_coordinates records the place id',
     env.state.profile.birth_coordinates.place_id === rec.id);

  const kept = build();
  kept.state.profile.birth_latitude = 1.5;
  kept.api.pobSetSelection(rec, 'suggestion');
  kept.el('pob').value = rec.displayLabel;
  kept.api.pobSyncCanonicalPlace();
  ok('an explicit existing coordinate is not overwritten',
     kept.state.profile.birth_latitude === 1.5);

  const none = build();
  ok('no selection → null (caller falls back to fuzzy resolve)',
     none.api.pobSyncCanonicalPlace() === null);
}

console.log('');
if (failed) { console.error('FAILED: ' + failed + ' check(s).'); process.exit(1); }
console.log('OK: cOMpass place-of-birth selection tests pass.');
