/* OM Cipher top-layer access — index.html regressions
 *
 *   1. The dropdown menu item formerly labelled "Companion Profile"
 *      now reads "OM Cipher", and the profile modal header + aria
 *      label match.
 *   2. A pill button (#btn-open-om-cipher) is present in the compass
 *      header so the identity-engine layer is one click away.
 *   3. The OM Cipher source-data section contains the canonical
 *      bhramari input (data-profile="bhramari_baseline_hz"), the
 *      gene-keys readout fields, Human Design (type/profile/strategy/
 *      authority/incarnation_cross), and astrology (sun/moon/rising).
 *   4. The "Additional Information" section exists and contains
 *      CV / LinkedIn / brand notes / work-bg / education / practices
 *      / communities / projects.
 *   5. buildCompassExport: bhramari_baseline_hz round-trips through
 *      profile.* AND profile.foundation.*, and Human Design
 *      strategy / authority / incarnation_cross land on
 *      profile.human_design.
 *
 * Usage:  node tests/om-cipher-top-layer.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const indexSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'),
  'utf8'
);

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('OM Cipher — rename and access');
assert(
  /id="menu-profile"[\s\S]{0,400}OM Cipher/.test(indexSrc),
  'menu item renders "OM Cipher" (renamed from "Companion Profile")'
);
assert(
  !/Companion Profile/.test(indexSrc),
  'no remaining "Companion Profile" strings in index.html'
);
assert(
  /id="profile-modal"[^>]*aria-label="OM Cipher"/.test(indexSrc),
  'profile modal aria-label is "OM Cipher"'
);
assert(
  /class="profile-modal-title">OM Cipher</.test(indexSrc),
  'profile modal title text is "OM Cipher"'
);
assert(
  /id="btn-open-om-cipher"/.test(indexSrc),
  'pill button #btn-open-om-cipher exists for top-level access'
);
assert(
  /om-cipher-pill-btn/.test(indexSrc),
  'pill button uses .om-cipher-pill-btn class (Living-Profile-style pill)'
);

// Setup-screen MUST NOT carry an OM Cipher pill — keeping Setup pure
// is the explicit product decision. The Cipher lives in the Compass
// header and becomes accessible once the user enters Compass.
{
  const setupOpen   = indexSrc.indexOf('<div id="screen-setup">');
  const setupClose  = setupOpen >= 0
    ? indexSrc.indexOf('<div id="screen-compass">', setupOpen)
    : -1;
  const setupBlock  = (setupOpen >= 0 && setupClose > setupOpen)
    ? indexSrc.slice(setupOpen, setupClose)
    : '';
  assert(
    !/id="btn-open-om-cipher-setup"/.test(setupBlock),
    'Setup screen does NOT contain a #btn-open-om-cipher-setup pill (Setup stays pure)'
  );
  assert(
    !/id="setup-toolbar"/.test(setupBlock),
    'Setup screen has no #setup-toolbar wrapper (Setup stays pure)'
  );
  assert(
    !/om-cipher-pill-btn/.test(setupBlock),
    'Setup screen contains no .om-cipher-pill-btn anywhere'
  );
}

// Compass-screen pill: this is the only pill the user can click.
{
  const compassOpen  = indexSrc.indexOf('<div id="screen-compass">');
  const compassClose = compassOpen >= 0
    ? indexSrc.indexOf('</div><!-- /screen-compass -->', compassOpen)
    : -1;
  const compassBlock = (compassOpen >= 0 && compassClose > compassOpen)
    ? indexSrc.slice(compassOpen, compassClose)
    : '';
  assert(
    /id="btn-open-om-cipher"/.test(compassBlock),
    'Compass screen contains the #btn-open-om-cipher pill (visible once user enters Compass)'
  );
}

console.log('\nOM Cipher — identity-engine source fields');
assert(
  /data-profile="bhramari_baseline_hz"/.test(indexSrc),
  'Bhramari baseline input bound to data-profile="bhramari_baseline_hz"'
);
assert(
  /Bhramari baseline \(Hz\)/.test(indexSrc),
  'Bhramari label reads "Bhramari baseline (Hz)"'
);
assert(
  /data-profile="human_design_type"/.test(indexSrc) &&
    /data-profile="human_design_profile"/.test(indexSrc) &&
    /data-profile="human_design_strategy"/.test(indexSrc) &&
    /data-profile="human_design_authority"/.test(indexSrc) &&
    /data-profile="human_design_incarnation_cross"/.test(indexSrc),
  'Human Design fields cover type, profile, strategy, authority, incarnation cross'
);
assert(
  /data-profile="astrology_sun"/.test(indexSrc) &&
    /data-profile="astrology_moon"/.test(indexSrc) &&
    /data-profile="astrology_rising"/.test(indexSrc),
  'Astrology fields cover sun, moon, rising'
);
assert(
  /data-profile="gene_keys_life_work"/.test(indexSrc) &&
    /data-profile="gene_keys_evolution"/.test(indexSrc) &&
    /data-profile="gene_keys_radiance"/.test(indexSrc) &&
    /data-profile="gene_keys_purpose"/.test(indexSrc),
  'Gene Keys activation-sequence readouts (life_work / evolution / radiance / purpose) present'
);
// After the bodygraph engine landed, all OM Cipher identity fields
// are computed locally. Placeholders use precise per-field states:
// Tropical / Vedic / HD profile fields read "calculated from birth
// data" or "calculated from birth date + time" (HD-specific). The
// older "requires bodygraph calculation" wording is gone — Type /
// Strategy / Authority / Profile / Incarnation Cross are derived
// from the deterministic engine in sdk/human_design.js.
assert(
  /calculated from birth data/.test(indexSrc),
  'derived placeholders use "calculated from birth data" wording'
);
assert(
  !/requires bodygraph/.test(indexSrc),
  'bodygraph engine has landed — no field still says "requires bodygraph"'
);
assert(
  /calculated from birth date \+ time/.test(indexSrc),
  'HD subfields advertise their birth-date + time precision label'
);

// Vedic / sidereal — these are now derived locally via approximate
// Lahiri ayanamsha. Inputs still round-trip if filled manually.
assert(
  /data-profile="vedic_sun"/.test(indexSrc) &&
    /data-profile="vedic_moon"/.test(indexSrc) &&
    /data-profile="vedic_ascendant"/.test(indexSrc),
  'Vedic astrology fields (sun / moon / ascendant) are present'
);
assert(
  /Vedic Astrology[\s\S]{0,1500}(Lahiri|requires birth time)/.test(indexSrc),
  'Vedic Astrology section declares Lahiri ayanamsha or birth-time requirement'
);
assert(
  /Human Design[\s\S]{0,1500}calculated from birth date \+ time/.test(indexSrc),
  'Human Design section advertises that Type / Strategy / Authority / Cross are calculated from birth date + time'
);
assert(
  !/Optional, fillable in your own time/.test(indexSrc),
  'misleading "Optional, fillable in your own time" framing is gone from the modal intro'
);

console.log('\nOM Cipher — Additional Information section');
assert(
  /Additional Information/.test(indexSrc),
  '"Additional Information" heading present'
);
const additional = indexSrc.split('Additional Information')[1] || '';
assert(
  /id="cv-dropzone"/.test(additional),
  'CV dropzone moved under Additional Information'
);
assert(
  /id="linkedin-url"/.test(additional),
  'LinkedIn URL field moved under Additional Information'
);
assert(
  /id="brand-ref-dropzone"/.test(additional),
  'Brand Voice Reference moved under Additional Information'
);
assert(
  /data-profile="work_background"/.test(additional),
  'Professional Background moved under Additional Information'
);
assert(
  /data-profile="education"/.test(additional),
  'Education moved under Additional Information'
);
assert(
  /id="practice-pills"/.test(additional),
  'Active Practices pills moved under Additional Information'
);
assert(
  /data-profile="communities"/.test(additional),
  'Communities moved under Additional Information'
);
assert(
  /data-profile="purpose_projects"/.test(additional),
  'Projects & Vision moved under Additional Information'
);

console.log('\nOM Cipher — Additional Information must NOT contain identity-engine fields');
assert(
  !/data-profile="bhramari_baseline_hz"/.test(additional),
  'Bhramari is in the OM Cipher block, not Additional Information'
);
assert(
  !/data-profile="human_design_type"/.test(additional),
  'Human Design is in the OM Cipher block, not Additional Information'
);
assert(
  !/data-profile="astrology_sun"/.test(additional),
  'Astrology is in the OM Cipher block, not Additional Information'
);

console.log('\nOM Cipher — buildCompassExport round-trip');
const exportMatch = indexSrc.match(
  /function buildCompassExport\(s\)\s*\{[\s\S]*?\n  return out;\n\}/m
);
if (!exportMatch) {
  fail('could not extract buildCompassExport');
} else {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    exportMatch[0] +
      ';\nthis.buildCompassExport = buildCompassExport;',
    sandbox
  );
  const fn = sandbox.buildCompassExport;

  const state = {
    companion: 'Test Companion',
    dob: '1988-04-23',
    profile: {
      bhramari_baseline_hz: '136.1',
      human_design_type: 'Generator',
      human_design_profile: '2/4',
      human_design_strategy: 'Wait to respond',
      human_design_authority: 'Sacral',
      human_design_incarnation_cross: 'Right Angle Cross of Tension',
      astrology_sun: 'Taurus',
      astrology_moon: 'Pisces',
      astrology_rising: 'Leo',
      vedic_sun: 'Aries (Mesha)',
      vedic_moon: 'Revati nakshatra',
      vedic_ascendant: 'Cancer (Karka lagna)'
    }
  };
  const out = fn(state);
  const p = out.profile;

  assert(
    p.bhramari_baseline_hz === 136.1,
    'bhramari_baseline_hz is normalized to a number on profile.* ' +
      '(got ' + JSON.stringify(p.bhramari_baseline_hz) + ')'
  );
  assert(
    p.foundation && p.foundation.bhramari_baseline_hz === 136.1,
    'bhramari_baseline_hz mirrored to profile.foundation.*'
  );
  assert(
    p.human_design && p.human_design.type === 'Generator',
    'human_design.type round-trips'
  );
  assert(
    p.human_design && p.human_design.strategy === 'Wait to respond',
    'human_design.strategy round-trips'
  );
  assert(
    p.human_design && p.human_design.authority === 'Sacral',
    'human_design.authority round-trips'
  );
  assert(
    p.human_design &&
      p.human_design.incarnation_cross ===
        'Right Angle Cross of Tension',
    'human_design.incarnation_cross round-trips'
  );
  assert(
    p.astrology &&
      p.astrology.sun === 'Taurus' &&
      p.astrology.moon === 'Pisces' &&
      p.astrology.rising === 'Leo',
    'astrology.sun/moon/rising round-trip'
  );
  assert(
    p.vedic &&
      p.vedic.sun === 'Aries (Mesha)' &&
      p.vedic.moon === 'Revati nakshatra' &&
      p.vedic.ascendant === 'Cancer (Karka lagna)',
    'vedic.sun/moon/ascendant round-trip (extension-point fields preserved verbatim)'
  );
  assert(
    p.foundation && p.foundation.vedic &&
      p.foundation.vedic.sun === 'Aries (Mesha)' &&
      p.foundation.vedic.ascendant === 'Cancer (Karka lagna)',
    'vedic block is mirrored onto profile.foundation for legacy importers'
  );

  // Empty bhramari shouldn't leak a NaN onto the export.
  const stateBlank = { profile: { bhramari_baseline_hz: '' } };
  const outBlank = fn(stateBlank);
  assert(
    !('bhramari_baseline_hz' in outBlank.profile) ||
      outBlank.profile.bhramari_baseline_hz === '' ||
      typeof outBlank.profile.bhramari_baseline_hz === 'number',
    'blank bhramari input does not leak NaN onto the export'
  );
  assert(
    outBlank.profile.foundation.bhramari_baseline_hz === undefined,
    'blank bhramari leaves foundation.bhramari_baseline_hz undefined'
  );
}

console.log('\nOM Cipher — tropicalSunSign derivation helper');
const sunFnMatch = indexSrc.match(
  /function tropicalSunSign\([^)]*\)\s*\{[\s\S]*?\n\}/m
);
if (!sunFnMatch) {
  fail('tropicalSunSign helper not found');
} else {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    sunFnMatch[0] +
      ';\nthis.tropicalSunSign = tropicalSunSign;',
    sandbox
  );
  const sun = sandbox.tropicalSunSign;
  assert(sun(1988, 4, 23) === 'Taurus', 'Apr 23 → Taurus');
  assert(sun(1990, 1, 1) === 'Capricorn', 'Jan 1 → Capricorn');
  assert(sun(1990, 12, 31) === 'Capricorn', 'Dec 31 → Capricorn');
  assert(sun(2000, 3, 21) === 'Aries', 'Mar 21 → Aries');
  assert(sun(2000, 3, 20) === 'Pisces', 'Mar 20 → Pisces');
  assert(sun(2000, 7, 4) === 'Cancer', 'Jul 4 → Cancer');
}

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: OM Cipher top-layer regressions pass.');
