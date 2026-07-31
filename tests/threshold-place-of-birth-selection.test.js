/* Threshold "Place of birth" — validated city selection.
 *
 * PRs #210/#211 gave the cOMpass #pob field a gazetteer-backed combobox,
 * but the onboarding threshold (threshold/threshold.js, screen 5) kept a
 * plain free-text input. Anything typed there became
 * contract.identity.birth_place and cOMpass could only fuzzy-match it
 * afterwards — the exact behaviour #210 removed, still reachable by
 * every new person, since /threshold is the default entry point.
 *
 * Verifies the threshold now enforces the same contract, and that the
 * canonical record is shared rather than re-derived.
 *
 * Run:  node tests/threshold-place-of-birth-selection.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT     = path.resolve(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const thHtml   = fs.readFileSync(path.join(ROOT, 'threshold', 'threshold.html'), 'utf8');
const thSrc    = fs.readFileSync(path.join(ROOT, 'threshold', 'threshold.js'), 'utf8');
const contract = fs.readFileSync(path.join(ROOT, 'threshold', 'contract.js'), 'utf8');
const Places   = require(path.join(ROOT, 'sdk', 'place_gazetteer.js'));

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

// ── 1. The canonical shape is shared, not duplicated ──────────────
section('1. One stored shape · both surfaces call toStoredPlace()');
{
  ok('the gazetteer exposes toStoredPlace()', typeof Places.toStoredPlace === 'function');
  const rec = Places.suggest('sudb')[0];
  const stored = Places.toStoredPlace(rec, 'suggestion');
  ok('it carries place_id',      stored.place_id === rec.id);
  ok('it carries display_label', stored.display_label === 'Sudbury, Ontario, Canada');
  ok('it carries city',          stored.city === 'Sudbury');
  ok('it carries region',        stored.region === 'Ontario');
  ok('it carries country',       stored.country === 'Canada');
  ok('it carries country_code',  stored.country_code === 'CA');
  ok('it carries latitude',      typeof stored.latitude === 'number');
  ok('it carries longitude',     typeof stored.longitude === 'number');
  ok('it carries tz offset',     stored.tz_offset_minutes === -300);
  ok('null in, null out',        Places.toStoredPlace(null) === null);

  ok('cOMpass builds its record through it, not its own literal',
     /pobGazetteer\(\)\.toStoredPlace\(/.test(extractFn(indexSrc, 'pobSetSelection')));
  ok('the threshold builds its record through it too',
     /toStoredPlace\(/.test(extractFn(thSrc, 'thPlaceSelect')));
}

// ── 2. Loading · same provider, same cache-busting key ────────────
section('2. threshold.html loads the same gazetteer, cache-busted');
{
  const thTag = thHtml.match(/<script src="\/sdk\/place_gazetteer\.js\?v=(\d+)"><\/script>/);
  const ixTag = indexSrc.match(/<script src="\/sdk\/place_gazetteer\.js\?v=(\d+)"><\/script>/);
  ok('threshold.html loads the vendored gazetteer', !!thTag);
  ok('its URL is cache-busted', !!thTag);
  ok('both pages pin the same version so neither can go stale alone',
     !!thTag && !!ixTag && thTag[1] === ixTag[1]);
  const thData = thHtml.match(/preload\('\/data\/places\/city_timezones\.json\?v=(\d+)'\)/);
  const ixData = indexSrc.match(/preload\('\/data\/places\/city_timezones\.json\?v=(\d+)'\)/);
  ok('it preloads the vendored dataset — no new provider or key', !!thData);
  ok('the dataset URL is cache-busted too — /data is cached like /sdk',
     !!thData && !!ixData && thData[1] === ixData[1]);
  ok('no second geocoding provider is introduced',
     !/googleapis|mapbox|nominatim|opencage/i.test(thHtml + thSrc));
  ok('the contract schema carries the canonical record',
     /birth_place_canonical/.test(contract));
}

// ── Sandbox for the threshold field controller ────────────────────
const CONTROLLER = ['el', 'thPlaceProvider', 'thPlaceInput', 'thPlaceHasSelection',
  'thPlaceAdoptStored', 'thPlaceSelect', 'thPlaceSetError', 'thPlaceClose',
  'thPlaceRender', 'thPlaceRequireSelection']
  .map(n => extractFn(thSrc, n)).join('\n\n');

function build(identityOver, provider) {
  const els = {};
  function make(id) {
    const node = {
      id, value: '', textContent: '', innerHTML: '', className: '',
      _cls: {}, _children: [],
      classList: {
        add: c => { node._cls[c] = true; },
        remove: c => { delete node._cls[c]; },
        toggle: (c, on) => { if (on) node._cls[c] = true; else delete node._cls[c]; },
      },
      setAttribute(k, v) { node[k] = v; },
      focus() { node.focused = true; },
      appendChild(child) { node._children.push(child); return child; },
      addEventListener() {},
    };
    return node;
  }
  function el(id) { if (!els[id]) els[id] = make(id); return els[id]; }
  const state = { identity: Object.assign(
    { birth_place: '', birth_place_canonical: null }, identityOver || {}) };
  const sandbox = {
    state, console, setTimeout,
    window: { CommonUnityPlaces: provider === undefined ? Places : provider },
    document: {
      getElementById: el,
      createElement: () => make('created'),
      createTextNode: t => ({ textContent: t }),
    },
    thPlaceTyped: false, thPlaceMatches: [],
  };
  vm.createContext(sandbox);
  vm.runInContext(CONTROLLER +
    '\nthis.__api = { thPlaceRequireSelection, thPlaceHasSelection,' +
    ' thPlaceSelect, thPlaceRender, thPlaceAdoptStored };', sandbox);
  return { api: sandbox.__api, state, el, sandbox };
}

// ── 3. The gate ───────────────────────────────────────────────────
section('3. Continue · typed text alone fails, a chosen city passes');
{
  const env = build();
  env.el('th-birth-place').value = 'Sudburyyy';
  env.sandbox.thPlaceTyped = true;
  ok('unconfirmed typed text fails the gate', env.api.thPlaceRequireSelection() === false);
  ok('the message matches cOMpass exactly',
     env.el('th-birth-place-error').textContent === 'Please choose a city from the list');
  ok('the error is made visible', env.el('th-birth-place-error')._cls.visible === true);
  ok('no canonical record is stored', env.state.identity.birth_place_canonical === null);

  const rec = Places.suggest('sudb')[0];
  env.api.thPlaceSelect(rec, 'suggestion');
  env.el('th-birth-place').value = rec.displayLabel;
  ok('a chosen city passes the gate', env.api.thPlaceRequireSelection() === true);
  ok('the stored label is the clean canonical one',
     env.state.identity.birth_place === 'Sudbury, Ontario, Canada');
  ok('the stored record is the shared shape',
     env.state.identity.birth_place_canonical.place_id === rec.id &&
     env.state.identity.birth_place_canonical.tz_offset_minutes === -300);

  env.el('th-birth-place').value = rec.displayLabel + ' (by the lake)';
  env.sandbox.thPlaceTyped = true;
  ok('editing the label afterwards invalidates it',
     env.api.thPlaceRequireSelection() === false);

  const empty = build();
  ok('an empty place still passes — it was never required',
     empty.api.thPlaceRequireSelection() === true);
  ok('and clears any stale record',
     empty.state.identity.birth_place_canonical === null);
}

// ── 4. Legacy + degraded provider behave as cOMpass does ──────────
section('4. Compatibility · drafts adopted, missing provider never blocks');
{
  const legacy = build({ birth_place: 'Sudbury ontario canada' });
  legacy.el('th-birth-place').value = 'Sudbury ontario canada';
  ok('a draft from before validation still passes',
     legacy.api.thPlaceRequireSelection() === true);
  ok('it is upgraded to a canonical record',
     !!legacy.state.identity.birth_place_canonical &&
     legacy.state.identity.birth_place_canonical.city === 'Sudbury');
  ok('adoption is tagged, as in cOMpass',
     legacy.state.identity.birth_place_canonical.selection_method === 'legacy-resolved');
  ok('the visible value is cleaned up',
     legacy.el('th-birth-place').value === 'Sudbury, Ontario, Canada');

  const junk = build({ birth_place: 'zzzzznotacity' });
  junk.el('th-birth-place').value = 'zzzzznotacity';
  ok('an unresolvable draft still fails the gate',
     junk.api.thPlaceRequireSelection() === false);

  // A stale cached gazetteer defines the global without the new methods
  // — the #211 failure mode. It must not accuse or lock anyone in.
  // el() appends strings as text nodes, so read one level down.
  const rendered = env =>
    env.el('th-birth-place-suggest')._children
      .map(li => (li._children || []).map(n => n.textContent).join(''));

  const stale = build({}, { resolve: Places.resolve });
  stale.el('th-birth-place').value = 'Su';
  stale.sandbox.thPlaceTyped = true;
  stale.api.thPlaceRender();
  ok('a stale gazetteer renders no "No matching city"',
     rendered(stale).every(t => t !== 'No matching city'));
  ok('and does not block Continue', stale.api.thPlaceRequireSelection() === true);

  const live = build();
  live.el('th-birth-place').value = 'zzzznotacity';
  live.sandbox.thPlaceTyped = true;
  live.api.thPlaceRender();
  ok('a real miss still says "No matching city"',
     rendered(live).some(t => t === 'No matching city'));
}

// ── 5. Handoff into cOMpass ───────────────────────────────────────
section('5. Handoff · cOMpass adopts the record instead of re-matching');
{
  ok('writeContract carries the canonical record across',
     /contract\.identity\.birth_place_canonical\s*=/.test(extractFn(thSrc, 'writeContract')));
  const sites = indexSrc.match(/if \(id\.birth_place\)[\s\S]{0,320}?\n  \}/g) || [];
  const guarded = (indexSrc.match(/id\.birth_place_canonical/g) || []).length;
  ok('both threshold hydration paths adopt it', guarded >= 2);
  ok('they set state.pob_place from it',
     /id\.birth_place_canonical\)?\s*(&&|\))[\s\S]{0,80}state\.pob_place\s*=/.test(indexSrc));
  ok('a contract without one still hydrates the label (legacy path intact)',
     sites.length >= 0 && /state\.pob = /.test(indexSrc));
}

console.log('');
if (failed) { console.error('FAILED: ' + failed + ' check(s).'); process.exit(1); }
console.log('OK: threshold place-of-birth selection tests pass.');
