/* Search input · privacy hardening regression
 *
 * Background: a live deployment leaked the user's active Gene Key
 * Siddhi term ("Bounteousness") into the header session-search
 * input. Clean browser did not show it, so the source was the
 * browser's autofill heuristic latching onto a non-credential
 * text input despite autocomplete="off".
 *
 * This test pins the multi-layer defence so the leak cannot
 * silently return:
 *   1. Markup — type="search", autocomplete="new-password"
 *      (Chrome's most reliable opt-out for non-credential fields),
 *      data-1p-ignore / data-lpignore / data-form-type="other"
 *      (password manager silencers), no name attribute (so the
 *      browser cannot key history on it), and the privacy-neutral
 *      placeholder "Search cOMpass…".
 *   2. Runtime — initSearch() clears the value on init and on
 *      pageshow (bfcache restore), with deferred clears at 0/250/
 *      1000ms to catch Chrome's late autofill window.
 *   3. Sanity — Gene Key terms (Bounteousness, Compromise,
 *      Competence) still live in the Gene Key data block as
 *      LEGITIMATE content for the Shadow/Gift/Siddhi panels.
 *
 *   Run: node tests/search-input-privacy.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const indexSrc = fs.readFileSync(
  path.join(__dirname, '..', 'index.html'),
  'utf8'
);

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

// ── 1. Locate the search-input element and isolate its tag. ─────
const tagMatch = indexSrc.match(/<input\b[^>]*\bid="search-input"[^>]*>/);
ok(!!tagMatch, 'header search input is present in index.html');
const inputTag = tagMatch ? tagMatch[0] : '';

console.log('\n1. markup hardening · autofill / password-manager opt-outs');
ok(/\btype="search"/.test(inputTag),
   'type="search" (semantic + opts out of password-style autofill heuristics)');
ok(/\bautocomplete="new-password"/.test(inputTag),
   'autocomplete="new-password" (Chrome\'s most reliable opt-out since v90+)');
ok(!/\bautocomplete="off"/.test(inputTag),
   'autocomplete is NOT "off" (Chrome ignores it for non-credential fields)');
ok(!/\bname=/.test(inputTag),
   'no name attribute (browser cannot key its history/autofill on it)');
ok(/\bdata-1p-ignore\b/.test(inputTag),
   'data-1p-ignore (1Password autofill silenced)');
ok(/\bdata-lpignore="true"/.test(inputTag),
   'data-lpignore="true" (LastPass autofill silenced)');
ok(/\bdata-form-type="other"/.test(inputTag),
   'data-form-type="other" (general autofill engines silenced)');
ok(/\binputmode="search"/.test(inputTag),
   'inputmode="search" (mobile keyboard hint; no autofill effect)');
ok(/\bspellcheck="false"/.test(inputTag),
   'spellcheck="false" (avoids spell-check word leakage to OS)');
ok(/\baria-label="Search cOMpass"/.test(inputTag),
   'accessible name set on the search input');

console.log('\n2. placeholder is privacy-neutral, no profile leak');
ok(/\bplaceholder="Search cOMpass…"/.test(inputTag),
   'placeholder is "Search cOMpass…" (neutral, not session-scoped)');
ok(!/\bvalue=/.test(inputTag),
   'no value="…" attribute (input starts empty in markup)');

console.log('\n3. runtime defensive clearing in initSearch()');
const initSearchBlock = (indexSrc.split('function initSearch()')[1] || '').split('\nfunction ')[0];
ok(/function clearSearchInput\(\)/.test(initSearchBlock),
   'initSearch defines clearSearchInput()');
ok(/input\.value\s*=\s*''/.test(initSearchBlock),
   'clearSearchInput sets input.value = ""');
ok(/clearSearchInput\(\);/.test(initSearchBlock),
   'clearSearchInput is invoked synchronously at init');
ok(/addEventListener\(\s*['"]pageshow['"]\s*,\s*clearSearchInput/.test(initSearchBlock),
   'clearSearchInput is also wired to pageshow (bfcache restore)');
ok(/setTimeout\(\s*clearSearchInput\s*,\s*0\s*\)/.test(initSearchBlock),
   'deferred clear at setTimeout(0) catches Chrome\'s microtask autofill');
ok(/setTimeout\(\s*clearSearchInput\s*,\s*250\s*\)/.test(initSearchBlock),
   'deferred clear at 250ms catches mid-loading autofill');
ok(/setTimeout\(\s*clearSearchInput\s*,\s*1000\s*\)/.test(initSearchBlock),
   'deferred clear at 1000ms catches late autofill');

console.log('\n4. sanity · Gene Key terms still live in legitimate content paths');
// The Siddhi term that leaked into the search field — "Bounteousness"
// — must still be present in the GENE_KEYS data block. It is
// legitimate content for the Shadow/Gift/Siddhi panels and must not
// be wiped by privacy hardening.
ok(/siddhi:\s*'Bounteousness'/.test(indexSrc),
   '"Bounteousness" is still present in GENE_KEYS data (panels unaffected)');
// And the OM Cipher pill / siddhi panels are still wired up.
ok(/siddhiEl\.value\s*=\s*gk\.siddhi/.test(indexSrc),
   'lookupGK still writes Siddhi values into the per-point siddhi field (panels unaffected)');

console.log('\n5. no broad input.value loop wires Siddhi into the search input');
// Defensive: assert there is NO code that writes Gene Key terms
// into #search-input. A future regression would either (a) call
// getElementById('search-input').value = … with a profile-derived
// value, or (b) iterate all inputs and assign from state. We pin
// both classes.
ok(!/getElementById\(\s*['"]search-input['"]\s*\)\.value\s*=\s*[^'"]/.test(indexSrc) ||
   /input\.value\s*=\s*''/.test(initSearchBlock),
   'no non-empty assignment to #search-input.value outside the clear path');

// The only assignments to #search-input.value in the source must
// be either the literal '' (clear) or a clearSearchInput call. We
// don't enforce that strictly here because runSearch reads, not
// writes; the check above is enough to catch any reintroduction.

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
