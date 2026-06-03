/* compass-ui-review-fixes · regression test
 *
 * A user review of cOMpass surfaced eight UI/interaction fixes, shipped in one
 * pass over index.html. This static-assertion test (no DOM boot) guards each
 * fix and the two prior features they must not regress:
 *
 *   1. Setup button: backToSetup() is authoritative over the threshold
 *      handoff's `!important` hide of #screen-setup.
 *   2. Nexus disclosure copy removed; consent flag silently granted, helpers
 *      + localStorage key preserved (trust mechanism intact).
 *   3. Three-dot "thinking" indicator in the Nexus bubble + CSS.
 *   4. "Hold to activate" hint on the Nexus orb pill + updated aria-label.
 *   5. Discoverable notes splitter (Studio-style grip) WITHOUT changing the
 *      grid math / GUTTER (PR #66 guard).
 *   6. Hexagram glyph replaces the fire triangle on the reader title.
 *   7. Frequency copy brightened + mentions Nexus.
 *   8. Slider-area cue that changes affect Nexus on the NEXT message.
 *   + PR #68 guard: the /rose-mirror payload still sends the frequency fields.
 *
 *   Run: node tests/compass-ui-review-fixes.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('1. Setup button — backToSetup() overrides the handoff hide');
const backFn = (index.match(/function backToSetup\(\)[\s\S]*?\n\}/) || [''])[0];
ok('backToSetup() is defined', !!backFn);
ok('clears the data-compass-handoff attribute on <html>',
   /removeAttribute\('data-compass-handoff'\)/.test(backFn));
ok('removes the on-compass-screen body class',
   /classList\.remove\('on-compass-screen'\)/.test(backFn));
ok('shows #screen-setup with important priority',
   /setupScreen\.style\.setProperty\('display', 'flex', 'important'\)/.test(backFn));
ok('hides #screen-compass with important priority',
   /compassScreen\.style\.setProperty\('display', 'none', 'important'\)/.test(backFn));

console.log('\n2. Nexus disclosure removed; consent flag/helpers preserved');
ok('the disclosure copy "Before you chat with Nexus" is gone',
   !/Before you chat with Nexus/.test(index));
ok('the "I understand — continue" button is gone',
   !/I understand — continue/.test(index));
const consentFn = (index.match(/function compassNexusRequestConsent\(\)[\s\S]*?\n\}/) || [''])[0];
ok('compassNexusRequestConsent silently grants consent',
   /compassNexusGrantConsent\(\);[\s\S]{0,60}return Promise\.resolve\(true\)/.test(consentFn));
ok('consent localStorage key is preserved',
   /COMPASS_NEXUS_CONSENT_KEY = 'commonunity_nexus_consent_v1'/.test(index));
ok('consent helpers are preserved',
   /function compassNexusHasConsent\(\)/.test(index) &&
   /function compassNexusGrantConsent\(\)/.test(index));
ok('the send gate still routes through the consent helper',
   /if \(!compassNexusHasConsent\(\)\)[\s\S]{0,120}compassNexusRequestConsent\(\)/.test(index));

console.log('\n3. Three-dot thinking indicator');
ok('the Nexus bubble is seeded with a typing indicator',
   /class="compass-nexus-typing"[\s\S]{0,120}<span><\/span><span><\/span><span><\/span>/.test(index));
ok('the indicator is cleared if the stream ends with no content',
   /if \(!text\) bubble\.textContent = ''/.test(index));
ok('CSS defines the typing dots + bounce keyframes',
   /\.compass-nexus-typing span \{[\s\S]*?animation: compass-nexus-typing-bounce/.test(index) &&
   /@keyframes compass-nexus-typing-bounce/.test(index));

console.log('\n4. "Hold to activate" on the Nexus orb');
ok('orb shows a "Hold to activate" hint span',
   /class="compass-nexus-orb-hint">Hold to activate</.test(index));
ok('orb aria-label / title updated to "hold to activate"',
   /aria-label="Nexus — hold to activate"/.test(index) &&
   /title="Hold to activate the Nexus"/.test(index));
ok('CSS styles the orb hint',
   /\.compass-nexus-orb-hint \{/.test(index));

console.log('\n5. Discoverable splitter — Studio grip, grid math intact (PR #66)');
ok('splitter ::before paints a 3-bar grip via box-shadow at ±4px',
   /\.notes-splitter::before \{[\s\S]*?box-shadow:[\s\S]*?-4px 0 0[\s\S]*?4px 0 0/.test(index));
ok('splitter ::after has a visible backing band (not invisible)',
   /\.notes-splitter::after \{[\s\S]*?background: color-mix/.test(index));
ok('splitter has a focus-visible outline',
   /\.notes-splitter:focus-visible \{[\s\S]*?outline: 2px solid/.test(index));
// PR #66 must not regress: grid math + GUTTER unchanged.
ok('grid still uses var(--hex-reader-width) 0 minmax(0, 1fr)',
   /grid-template-columns: var\(--hex-reader-width\) 0 minmax\(0, 1fr\)/.test(index));
ok('the ::after hit pad is still 18px (matches GUTTER clamp math)',
   /\.notes-splitter::after \{[\s\S]*?width: 18px/.test(index));
ok('GUTTER constant is still 18',
   /var GUTTER\s*=\s*18/.test(index));

console.log('\n6. Hexagram glyph replaces the fire triangle');
ok('no fire-triangle 🜂 glyph remains', !/🜂/.test(index));
ok('four hexagram glyphs (䷀) on the reader labels',
   (index.match(/class="hex-reader-glyph"[^>]*>䷀</g) || []).length === 4);
ok('the four "Hexagram Reader" labels are intact (PR #67 guard)',
   (index.match(/hex-reader-locked-label[\s\S]{0,120}Hexagram Reader/g) || []).length === 4);

console.log('\n7. Frequency copy brightened + mentions Nexus');
const freqPromptRule = (index.match(/\.freq-prompt \{[^}]*\}/) || [''])[0];
ok('.freq-prompt uses a brighter token (text-muted, not text-faint)',
   /color: var\(--text-muted\)/.test(freqPromptRule) &&
   !/color: var\(--text-faint\)/.test(freqPromptRule));
ok('each prompt notes that Nexus considers the current frequency',
   (index.match(/Nexus considers your current frequency when reflecting/g) || []).length === 4);

console.log('\n8. Slider-area cue — changes affect Nexus on the NEXT message');
ok('four freq-nexus-cue lines (one per room)',
   (index.match(/class="freq-nexus-cue"/g) || []).length === 4);
ok('the cue makes clear it shapes the NEXT message, not past replies',
   /shapes Nexus’s <em>next<\/em> message[\s\S]{0,80}doesn’t change replies you’ve already received/.test(index));
ok('CSS styles the cue', /\.freq-nexus-cue \{/.test(index));

console.log('\n+. PR #68 guard — frequency context still sent to Nexus');
const roseSend = (index.match(/fetch\(`\$\{API_BASE\}\/rose-mirror`[\s\S]*?golden_thread:/) || [''])[0];
ok('payload still sends frequency_value',
   /frequency_value: fc \? fc\.value : -1/.test(roseSend));
ok('payload still sends frequency_band / _label / _next / _guidance',
   /frequency_label:/.test(roseSend) && /frequency_band:/.test(roseSend) &&
   /frequency_next:/.test(roseSend) && /frequency_guidance:/.test(roseSend));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: cOMpass UI review fixes regressions pass.');
}
