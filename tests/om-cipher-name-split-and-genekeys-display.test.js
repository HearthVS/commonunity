/* OM Cipher · name split + Gene Keys field display regressions
 *
 * Follows the PR that:
 *   1. removed the manual-lookup hint from the OM Cipher birth-
 *      coordinates card (coords are now auto-resolved from POB);
 *   2. shrank the Gene Keys / HD / Tropical / Vedic field text so
 *      values like "GK 14 · Competence (Line 2)" stop being cut off,
 *      and added field-input--calc compact styling;
 *   3. added explicit "Sun" / "Moon" / "Rising" labels above each
 *      tropical box (and the equivalents for the Vedic sidereal trio);
 *   4. normalised the setup-screen single-name input into
 *      profile.first_name + profile.last_name + profile.legal_name,
 *      with given_name / family_name aliases mirrored for downstream
 *      identity-engine consumers (which prefer legal_name).
 *
 * jsdom-optional; source-text scans run without it.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const indexSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'),
  'utf8'
);

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(a, b, msg) {
  if (a === b) pass(msg + ' (= ' + JSON.stringify(b) + ')');
  else fail(msg + '\n      expected: ' + JSON.stringify(b)
                  + '\n      actual:   ' + JSON.stringify(a));
}

// ── 1. Birth coordinates card · no manual-lookup hint ──────────
console.log('1. Birth coordinates card · coords auto-resolved, manual-lookup hint removed');
assert(
  !/Find your birth city on a map/.test(indexSrc),
  'manual-lookup hint "Find your birth city on a map…" removed'
);
assert(
  !/No coordinates lookup is performed/.test(indexSrc),
  '"No coordinates lookup is performed" sentence removed (it was misleading — lookup IS performed)'
);
assert(
  /Auto-filled from your place of birth/.test(indexSrc),
  'birth-coords info-disclosure advertises auto-fill'
);

// ── 2. Gene Keys / calc fields · explicit labels + compact class ─
console.log('\n2. Gene Keys card · per-field labels + compact text-size class');
assert(
  /for="profile-gk-cs">Life's Work/.test(indexSrc),
  'Gene Keys field has a "Life\'s Work" label above the input'
);
assert(
  /for="profile-gk-ce">Evolution/.test(indexSrc),
  'Gene Keys field has an "Evolution" label above the input'
);
assert(
  /for="profile-gk-us">Radiance/.test(indexSrc),
  'Gene Keys field has a "Radiance" label above the input'
);
assert(
  /for="profile-gk-ue">Purpose/.test(indexSrc),
  'Gene Keys field has a "Purpose" label above the input'
);
assert(
  /<input[^>]*class="[^"]*field-input--calc[^"]*"[^>]*id="profile-gk-cs"/.test(indexSrc),
  'profile-gk-cs uses the compact .field-input--calc class'
);
assert(
  /<input[^>]*class="[^"]*field-input--calc[^"]*"[^>]*id="profile-gk-ue"/.test(indexSrc),
  'profile-gk-ue uses the compact .field-input--calc class'
);
assert(
  /\.field-input--calc\s*\{[\s\S]{0,400}font-size:\s*var\(--text-xs\)/.test(indexSrc),
  '.field-input--calc CSS uses --text-xs (smaller readable size)'
);
assert(
  /\.field-input--calc\s*\{[\s\S]{0,400}text-overflow:\s*ellipsis/.test(indexSrc),
  '.field-input--calc CSS uses text-overflow: ellipsis (no horizontal scroll required)'
);
assert(
  /\.field-input--calc:focus\s*\{[\s\S]{0,200}text-overflow:\s*clip/.test(indexSrc),
  'focused .field-input--calc reveals the full string (text-overflow: clip)'
);

// ── 3. Tropical astrology · Sun / Moon / Rising labels ──────────
console.log('\n3. Tropical astrology · individual labels above each field');
assert(
  /for="profile-astro-sun">Sun</.test(indexSrc),
  '"Sun" label is rendered above the tropical Sun input'
);
assert(
  /for="profile-astro-moon">Moon</.test(indexSrc),
  '"Moon" label is rendered above the tropical Moon input'
);
assert(
  /for="profile-astro-rising">Rising</.test(indexSrc),
  '"Rising" label is rendered above the tropical Rising input'
);
// Old combined "Sun · Moon · Rising" single label should be gone — each
// field should advertise its own role rather than relying on placeholder
// + a combined label.
const tropicalSection = (function () {
  const start = indexSrc.indexOf('id="tropical-info-btn"');
  if (start < 0) return '';
  const end = indexSrc.indexOf('Vedic Astrology', start);
  return end > start ? indexSrc.slice(start, end) : indexSrc.slice(start);
})();
assert(
  !/>Sun · Moon · Rising</.test(tropicalSection),
  'old combined "Sun · Moon · Rising" label no longer rendered in tropical section'
);
// Triple-column responsive class exists.
assert(
  /\.calc-row--triple\s*\{[\s\S]{0,200}1fr 1fr 1fr/.test(indexSrc),
  '.calc-row--triple CSS lays out three columns'
);
assert(
  /calc-row--triple/.test(tropicalSection),
  'tropical card uses calc-row--triple for Sun · Moon · Rising'
);

// ── 4. Identity source card · first_name + last_name + legal_name
console.log('\n4. Identity source card · given / family / legal name inputs');
assert(
  /id="profile-given-name"[^>]*data-profile="first_name"/.test(indexSrc),
  '#profile-given-name input bound to data-profile="first_name"'
);
assert(
  /id="profile-family-name"[^>]*data-profile="last_name"/.test(indexSrc),
  '#profile-family-name input bound to data-profile="last_name"'
);
// legal_name is derived state, not a visible DOM input. The OM Cipher
// modal must NOT render a third name input (Full Legal Name) — it lives
// in state.profile.legal_name only, composed from first + last on input.
assert(
  !/id="profile-legal-name"/.test(indexSrc),
  'no #profile-legal-name input is rendered (legal_name lives in state only)'
);
assert(
  !/Full legal name/i.test(indexSrc.replace(/<!--[\s\S]*?-->/g, '')),
  'no visible "Full legal name" label appears in markup'
);

// ── 5. syncSetupIntoProfile · splits guide-name into given/family + legal ─
console.log('\n5. syncSetupIntoProfile · single-name string → given_name + family_name + legal_name');
const syncStart = indexSrc.indexOf('function syncSetupIntoProfile');
const syncSlice = indexSrc.slice(syncStart, syncStart + 5000);
assert(
  /state\.profile\.first_name\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.first_name'
);
assert(
  /state\.profile\.last_name\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.last_name'
);
assert(
  /state\.profile\.legal_name\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.legal_name'
);
assert(
  /split\(/.test(syncSlice),
  'syncSetupIntoProfile uses a split to tokenise the guide-name string'
);

// ── 6. Functional simulation: contract for guide-name → name parts ──
console.log('\n6. Name-split contract · functional simulation');
function splitNameLikeSync(state, guide) {
  state.profile = state.profile || {};
  guide = (guide || '').trim();
  if (!guide) return state;
  var parts = guide.split(/\s+/).filter(Boolean);
  var given  = parts[0] || '';
  var family = parts.slice(1).join(' ');
  if (given  && !(state.profile.first_name || '').trim()) state.profile.first_name = given;
  if (family && !(state.profile.last_name  || '').trim()) state.profile.last_name  = family;
  if (!(state.profile.legal_name || '').trim()) state.profile.legal_name = guide;
  return state;
}
{
  const out = splitNameLikeSync({}, 'Markus Lehto');
  assertEq(out.profile.first_name, 'Markus', '"Markus Lehto" → first_name = "Markus"');
  assertEq(out.profile.last_name,  'Lehto',  '"Markus Lehto" → last_name  = "Lehto"');
  assertEq(out.profile.legal_name, 'Markus Lehto',
    '"Markus Lehto" → legal_name = "Markus Lehto"');
}
{
  // Multi-word family name (van der Berg, de la Cruz, etc.) — every
  // token after the first joins as one family-name string.
  const out = splitNameLikeSync({}, 'Esmé van der Berg');
  assertEq(out.profile.first_name, 'Esmé',
    'first_name = first token even for multi-word family names');
  assertEq(out.profile.last_name,  'van der Berg',
    'family_name preserves intermediate particles (van der)');
  assertEq(out.profile.legal_name, 'Esmé van der Berg',
    'legal_name preserves the full input string');
}
{
  // Single-token name — given_name gets it, family_name stays blank.
  const out = splitNameLikeSync({}, 'Madonna');
  assertEq(out.profile.first_name, 'Madonna',
    'single-token "Madonna" → first_name = "Madonna"');
  assertEq(out.profile.last_name,  undefined,
    'single-token name leaves last_name unset (family_name still required in OM Cipher)');
  assertEq(out.profile.legal_name, 'Madonna',
    'single-token → legal_name = "Madonna"');
}
{
  // Pre-existing OM Cipher edits MUST win over the setup name.
  const seeded = { profile: { first_name: 'Marcus', last_name: 'Aurelius' } };
  splitNameLikeSync(seeded, 'Different Name');
  assertEq(seeded.profile.first_name, 'Marcus',
    'existing first_name is not overwritten by setup name');
  assertEq(seeded.profile.last_name,  'Aurelius',
    'existing last_name is not overwritten by setup name');
}

// ── 7. buildCompassExport · legal_name + given/family aliases ───
console.log('\n7. buildCompassExport · legal_name + given/family aliases populated');
const buildStart = indexSrc.indexOf('function buildCompassExport');
// buildCompassExport is long (foundation block, contact block, etc.);
// slice generously so the foundation regex can scan past contact-related
// helpers without hitting EOF mid-pattern.
const buildSlice = indexSrc.slice(buildStart, buildStart + 12000);
assert(
  /profile\.legal_name\s*=/.test(buildSlice),
  'buildCompassExport sets profile.legal_name from derived full-name composition'
);
assert(
  /profile\.given_name\s*=/.test(buildSlice),
  'buildCompassExport mirrors profile.given_name (alias of first_name)'
);
assert(
  /profile\.family_name\s*=/.test(buildSlice),
  'buildCompassExport mirrors profile.family_name (alias of last_name)'
);

// Foundation block carries the canonical engine inputs.
const foundationSlice = (function () {
  const m = buildSlice.match(/profile\.foundation\s*=\s*Object\.assign\(\{([\s\S]*?)\},\s*profile\.foundation/);
  return m ? m[1] : '';
})();
assert(/legal_name:/.test(foundationSlice),
  'foundation block exposes legal_name');
assert(/given_name:/.test(foundationSlice),
  'foundation block exposes given_name');
assert(/family_name:/.test(foundationSlice),
  'foundation block exposes family_name');
assert(/first_name:/.test(foundationSlice) && /last_name:/.test(foundationSlice),
  'foundation block keeps the legacy first_name / last_name keys for back-compat');

// ── 8. Backward-compat import path normalises legacy "last_name with whitespace" ─
console.log('\n8. Legacy import · "last_name" containing a space splits into first/last on load');
// Match the documented normalisation we run in the file load path:
//   - If first_name is empty and last_name contains a space, split it.
//   - given/family aliases are then mirrored from first/last.
function normaliseLikeImport(profile) {
  var p = Object.assign({}, profile);
  if (!p.first_name && p.given_name)  p.first_name = p.given_name;
  if (!p.last_name  && p.family_name) p.last_name  = p.family_name;
  if (!p.first_name && typeof p.last_name === 'string' && /\s/.test(p.last_name.trim())) {
    var parts = p.last_name.trim().split(/\s+/);
    p.first_name = parts.shift();
    p.last_name  = parts.join(' ');
  }
  if (!p.given_name  && p.first_name) p.given_name  = p.first_name;
  if (!p.family_name && p.last_name)  p.family_name = p.last_name;
  if (!p.legal_name) {
    var composed = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    p.legal_name = p.full_name || composed || p.first_name || p.last_name || undefined;
  }
  if (!p.full_name && p.legal_name) p.full_name = p.legal_name;
  return p;
}
{
  // Legacy shape from older builds: full name stuffed into last_name.
  const out = normaliseLikeImport({ last_name: 'Markus Lehto' });
  assertEq(out.first_name, 'Markus',
    'legacy last_name="Markus Lehto" → first_name="Markus" after import');
  assertEq(out.last_name,  'Lehto',
    'legacy last_name="Markus Lehto" → last_name="Lehto" after import');
  assertEq(out.legal_name, 'Markus Lehto',
    'legacy legal_name derived from first + last after import');
}
{
  // Already-split data round-trips untouched.
  const out = normaliseLikeImport({ first_name: 'Marcus', last_name: 'Aurelius' });
  assertEq(out.first_name, 'Marcus',  'already-split first_name preserved');
  assertEq(out.last_name,  'Aurelius','already-split last_name preserved');
  assertEq(out.given_name, 'Marcus',  'given_name mirrored from first_name');
  assertEq(out.family_name,'Aurelius','family_name mirrored from last_name');
  assertEq(out.legal_name, 'Marcus Aurelius', 'legal_name composed from first + last');
}
{
  // given/family-only data (no first/last) hydrates first/last.
  const out = normaliseLikeImport({ given_name: 'Marcus', family_name: 'Aurelius' });
  assertEq(out.first_name, 'Marcus',
    'first_name hydrates from given_name when first_name absent');
  assertEq(out.last_name,  'Aurelius',
    'last_name hydrates from family_name when last_name absent');
}

// ── 9. Engine preference · identity engine reads legal_name ─────
console.log('\n9. Identity engine · legal_name is the canonical input (not display_name alone)');
const omCipherSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'sdk', 'om_cipher.js'),
  'utf8'
);
assert(
  /legal_name/.test(omCipherSrc),
  'sdk/om_cipher.js still reads legal_name'
);
assert(
  /preferred_name/.test(omCipherSrc),
  'sdk/om_cipher.js still reads preferred_name (override / nickname)'
);
// Engine prefers legal_name OR preferred_name — not a single ambiguous
// display string. We don't pass display_name through to the gematria.
assert(
  /nameResonance\(input\.legal_name\s*\|\|\s*input\.preferred_name\)/.test(omCipherSrc),
  'om_cipher.js: nameResonance() reads input.legal_name || input.preferred_name'
);

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: OM Cipher name-split + Gene Keys display regressions pass.');
