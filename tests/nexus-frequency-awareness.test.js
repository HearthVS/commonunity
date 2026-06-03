/* nexus-frequency-awareness · regression test
 *
 * cOMpass has a per-room frequency slider (0-10) asking where the user is
 * currently operating on the room's Gene Key spectrum (shadow 0-4, gift 5-9,
 * siddhi 10). This wires that state into Nexus so it meets the person where
 * they are and guides ONE coherent step up — instead of always speaking from
 * shadow, and without leaping to the Siddhi from the shadow range.
 *
 * Static-assertion test (no DOM boot) over index.html + server.py. It guards:
 *   • the slider value is persisted per room via existing state conventions
 *   • a pure compassFrequencyContext(point) derives band + next attunement step
 *   • the /rose-mirror payload carries the frequency context for the CURRENT
 *     room, placed so it does not regress the pseudonymous-identity guard
 *   • the server model declares the frequency fields and the prompt assembly
 *     gates a frequency section on a set value and instructs meeting + one step
 *   • a light header UI cue exists
 *
 *   Run: node tests/nexus-frequency-awareness.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const server = read('server.py');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('1. slider value is persisted per room (existing state conventions)');
ok('initFreqSliders restores from state.points[point].frequency',
   /const saved = state\.points\[point\]\.frequency/.test(index));
ok('slider input writes state.points[point].frequency and saves',
   /state\.points\[point\]\.frequency = val;[\s\S]{0,80}saveToStorage\(\)/.test(index));

console.log('\n2. compassFrequencyContext(point) derives band + next attunement step');
ok('compassFrequencyContext is defined', /function compassFrequencyContext\(point\)/.test(index));
// Isolate the helper body for the band-logic assertions.
const fnMatch = index.match(/function compassFrequencyContext\(point\)[\s\S]*?\n\}/);
ok('extracted compassFrequencyContext body', !!fnMatch);
const fn = fnMatch ? fnMatch[0] : '';
ok('returns null when the slider is unset (< 0)', /return null/.test(fn));
ok('shadow band covers 0-4 (val <= 4)', /val <= 4/.test(fn) && /band = 'shadow'/.test(fn));
ok('gift band covers 5-9 (val <= 7 and val <= 9)',
   /val <= 7/.test(fn) && /val <= 9/.test(fn) && /band = 'gift'/.test(fn));
ok('siddhi band is the 10 case', /band = 'siddhi'/.test(fn));
ok('shadow step goes toward the first Gift, not the Siddhi',
   /Not the Siddhi yet/.test(fn) && /Math\.min\(val \+ 1, 5\)/.test(fn));
ok('gift 5-7 stabilises / deepens the Gift', /stabilise and deepen the Gift/i.test(fn));
ok('gift 8-9 refines toward Siddhi without inflation',
   /without inflation/i.test(fn) && /spiritual bypass/i.test(fn));
ok('siddhi grounds in ordinary action / service',
   /Ground the Siddhi in ordinary action and service/i.test(fn));
ok('result exposes value/label/band/next_target/guidance',
   /value: val/.test(fn) && /label: FREQ_LABELS/.test(fn) &&
   /band,/.test(fn) && /next_target,/.test(fn) && /guidance/.test(fn));

console.log('\n3. /rose-mirror payload carries the frequency context (current room)');
// Capture the /rose-mirror send slice (fetch → golden_thread:), as the trust
// guard does, so we assert against the exact body that leaves the browser.
const roseSend = (index.match(/fetch\(`\$\{API_BASE\}\/rose-mirror`[\s\S]*?golden_thread:/) || [''])[0];
ok('payload sends frequency_value', /frequency_value:/.test(roseSend));
ok('payload sends frequency_band', /frequency_band:/.test(roseSend));
ok('payload sends frequency_label', /frequency_label:/.test(roseSend));
ok('payload sends frequency_next (next attunement guidance)', /frequency_next:/.test(roseSend));
ok('payload sends frequency_guidance', /frequency_guidance:/.test(roseSend));
// Per-room: the context is derived from the current point (ctx.point).
ok('frequency context is derived for the current room (ctx.point)',
   /const fc = compassFrequencyContext\(ctx\.point\)/.test(index));
ok('frequency fields read from the per-room fc result',
   /frequency_value: fc \? fc\.value : -1/.test(roseSend) &&
   /frequency_band: fc \? fc\.band : ''/.test(roseSend));

console.log('\n4. no pseudonymous-identity regression in the /rose-mirror payload');
ok('payload still sends the pseudonymous Unity Point address',
   /companion: compassNexusAddress\(\)/.test(roseSend));
ok('payload does not send the full name raw',
   !/companion: state\.companion/.test(roseSend));
ok('payload does not send the raw first name',
   !/companion: compassNexusIdentity\(\)/.test(roseSend));

console.log('\n5. server model declares the frequency fields');
ok('RoseMirrorRequest declares frequency_value: int = -1',
   /frequency_value: int = -1/.test(server));
ok('RoseMirrorRequest declares frequency_band / _label / _next / _guidance',
   /frequency_label: str = ""/.test(server) &&
   /frequency_band: str = ""/.test(server) &&
   /frequency_next: str = ""/.test(server) &&
   /frequency_guidance: str = ""/.test(server));

console.log('\n6. server prompt assembly uses the frequency state');
ok('frequency_section is gated on a set value (>= 0)',
   /frequency_section = ""[\s\S]*?request\.frequency_value >= 0/.test(server));
ok('frequency_section is interpolated into the system prompt',
   /\{frequency_section\}/.test(server));
ok('prompt instructs Nexus to meet them and take ONE step up',
   /Meet them at this frequency[\s\S]{0,160}ONE coherent step/i.test(server));
ok('prompt warns against defaulting to shadow / jumping to Siddhi',
   /Do not default to shadow language[\s\S]{0,120}do not jump straight to the Siddhi/i.test(server));

console.log('\n7. light UI cue in the Nexus header');
ok('a compass-nexus-freq-cue element exists', /id="compass-nexus-freq-cue"/.test(index));
ok('updateCompassNexusFreqCue populates "Nexus will reflect from:"',
   /function updateCompassNexusFreqCue\(\)/.test(index) &&
   /Nexus will reflect from: \$\{fc\.label\}/.test(index));
ok('the cue is refreshed when the Nexus modal opens',
   /modal\.classList\.add\('is-open'\);[\s\S]{0,80}updateCompassNexusFreqCue\(\)/.test(index));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: Nexus frequency-awareness regressions pass.');
}
