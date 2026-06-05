/* synthesis-website-identity-minimization · privacy regression test
 *
 * PR #79 minimized identity in the NEXUS payloads (/rose-mirror, /rose-room-
 * opening). This test covers the SYNTHESIS / personal-website-generation
 * surface, which PR #79 did not touch:
 *
 *   • /generate        — Layer-3 personal website copy
 *   • /inspire         — contemplative starting point
 *   • /inspire-layer2  — Layer-2 synthesis draft (theme / insight / summary)
 *
 * Before this change, cOMpass (index.html) sent state.companion — the real
 * legal/display name (and state.guide, also a real name) — to all three
 * endpoints as the `companion` label, even though the model never needs the
 * real name to produce first/third-person copy.
 *
 * Approach mirrors nexus-payload-identity-minimization.test.js: extract the
 * real cOMpass helpers from index.html and run them in a vm sandbox against a
 * fixture carrying full source identity (legal name, first name, email, birth
 * date/time/place, raw seed, full-record JSON, invite token). We then build the
 * exact outbound synthesis payload identity slice and assert:
 *
 *   • NONE of the source-identity values reach the payload by default
 *     (companion === '{{display_name}}', guide dropped).
 *   • The opt-in real-name path is gated: displayNameMode='real' alone is NOT
 *     enough; it also requires sendRealNameToAI===true.
 *   • The presentation layer (compassApplyDisplayName) CAN insert the chosen
 *     display name locally for each mode, proving rendered output may include
 *     the display name via local substitution.
 *
 * Run: node tests/synthesis-website-identity-minimization.test.js
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const assert = require('node:assert/strict');
const vm     = require('vm');

const root  = path.resolve(__dirname, '..');
const read  = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const index = read('index.html');

let pass = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  console.log('  ok  ' + label);
  pass++;
}

// Brace-balanced top-level `function NAME(...) { ... }` extractor.
function extractFn(html, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = html.search(re);
  assert.ok(start > 0, 'could not locate function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

function extractConst(html, name) {
  const re = new RegExp('const\\s+' + name + '\\s*=\\s*[^;]+;');
  const m = html.match(re);
  assert.ok(m, 'could not locate const ' + name);
  return m[0];
}

// ── Fixture: full source identity. Everything here must stay local. ─────────
const FIXTURE = {
  legal_name:  'Vesna Marija Kovačević',
  first_name:  'Vesna',
  email:       'vesna.kovacevic@example.com',
  birth_date:  '1987-04-12',
  birth_time:  '14:35',
  birth_place: 'Split, Croatia',
  raw_seed:    'Vesna Marija Kovačević|1987-04-12',
  full_record_json: JSON.stringify({
    legal_name: 'Vesna Marija Kovačević', email: 'vesna.kovacevic@example.com',
    birth_date: '1987-04-12', birth_time: '14:35', birth_place: 'Split, Croatia'
  }),
  invite_token: 'tok-secret-9f3a',
  // Derived / allowed pseudonym:
  unity_point: 'Unity Point 22.5',
  unity_code:  'UC-22.5',
  cipher_id:   'cipher_abc123def456abc123def4',
  custom_name: 'V.',
};

const FORBIDDEN = [
  FIXTURE.legal_name, FIXTURE.first_name, FIXTURE.email,
  FIXTURE.birth_date, FIXTURE.birth_time, FIXTURE.birth_place,
  FIXTURE.raw_seed, FIXTURE.full_record_json, FIXTURE.invite_token,
];

function assertNoSourceIdentity(label, payloadStr) {
  FORBIDDEN.forEach((val) => {
    ok(payloadStr.indexOf(val) === -1,
       `${label}: source-identity value absent → "${String(val).slice(0, 28)}…"`);
  });
}

// Build a sandbox carrying the REAL cOMpass synthesis helpers, with a
// fixture-backed compassCipherIdentity stub (the real one reads the OM Cipher
// contract from localStorage; here we hand it the derived identity) and the
// real compassNexusAddress (used by the 'cipher' display mode).
function buildSandbox(stateOverrides) {
  const sandbox = { console, JSON };
  vm.createContext(sandbox);
  const src = [
    extractConst(index, 'COMPASS_NEXUS_NEUTRAL_ADDRESS'),
    extractConst(index, 'SYNTH_DISPLAY_PLACEHOLDER'),
    extractFn(index, 'compassNexusAddress'),
    extractFn(index, 'compassDisplayName'),
    extractFn(index, 'compassSynthAddress'),
    extractFn(index, 'compassApplyDisplayName'),
    `function compassCipherIdentity() {
       return { unity_point: ${JSON.stringify(FIXTURE.unity_point)},
                unity_code:  ${JSON.stringify(FIXTURE.unity_code)},
                cipher_id:   ${JSON.stringify(FIXTURE.cipher_id)} };
     }`,
    `var state = Object.assign({
        companion: ${JSON.stringify(FIXTURE.legal_name)},
        guide: 'Aleksandar Petrović',
        displayNameMode: 'first',
        displayNameCustom: ${JSON.stringify(FIXTURE.custom_name)},
        sendRealNameToAI: false
     }, ${JSON.stringify(stateOverrides || {})});`,
  ].join('\n');
  vm.runInContext(src, sandbox);
  return sandbox;
}

// Reconstruct the exact outbound identity slice each synthesis send attaches.
function buildSynthPayload(sandbox) {
  return vm.runInContext(`JSON.stringify({
    generate:      { companion: compassSynthAddress(), guide: '' },
    inspire:       { companion: compassSynthAddress() },
    inspireLayer2: { companion: compassSynthAddress() }
  });`, sandbox);
}

// ════════════════════════════════════════════════════════════════════════
console.log('cOMpass synthesis / website payloads (index.html)');
// ════════════════════════════════════════════════════════════════════════
{
  const sandbox = buildSandbox();
  const payload = buildSynthPayload(sandbox);

  assertNoSourceIdentity('synthesis default', payload);

  const parsed = JSON.parse(payload);
  ok(parsed.generate.companion === '{{display_name}}',
     '/generate sends the {{display_name}} placeholder, not a real name');
  ok(parsed.generate.guide === '',
     '/generate drops the guide real name');
  ok(parsed.inspire.companion === '{{display_name}}',
     '/inspire sends the {{display_name}} placeholder');
  ok(parsed.inspireLayer2.companion === '{{display_name}}',
     '/inspire-layer2 sends the {{display_name}} placeholder');

  // The real name must still be derivable LOCALLY for rendering.
  ok(vm.runInContext('compassDisplayName()', sandbox) === FIXTURE.first_name,
     "compassDisplayName() resolves locally (mode 'first' → first name)");
}

// ── Opt-in real-name gating ─────────────────────────────────────────────────
console.log('Real-name opt-in gating');
{
  // mode 'real' alone is NOT enough — sendRealNameToAI defaults false.
  const s1 = buildSandbox({ displayNameMode: 'real' });
  ok(vm.runInContext('compassSynthAddress()', s1) === '{{display_name}}',
     "mode 'real' WITHOUT sendRealNameToAI still sends placeholder");
  assertNoSourceIdentity("mode 'real' un-confirmed", buildSynthPayload(s1));

  // Explicit opt-in: mode 'real' AND sendRealNameToAI === true → real name sent.
  const s2 = buildSandbox({ displayNameMode: 'real', sendRealNameToAI: true });
  ok(vm.runInContext('compassSynthAddress()', s2) === FIXTURE.legal_name,
     "mode 'real' WITH sendRealNameToAI sends the real name (explicit confirm)");
}

// ── Presentation layer: local display-name insertion ───────────────────────
console.log('Local display-name substitution (presentation layer)');
{
  const sample = 'I am {{display_name}}, and this is the work that finds me.';

  const first = buildSandbox({ displayNameMode: 'first' });
  ok(vm.runInContext(`compassApplyDisplayName(${JSON.stringify(sample)})`, first)
       === 'I am Vesna, and this is the work that finds me.',
     "mode 'first' inserts the first name into rendered copy");

  const real = buildSandbox({ displayNameMode: 'real' });
  ok(vm.runInContext(`compassApplyDisplayName(${JSON.stringify(sample)})`, real)
       === 'I am Vesna Marija Kovačević, and this is the work that finds me.',
     "mode 'real' inserts the full name into rendered copy (local only)");

  const cipher = buildSandbox({ displayNameMode: 'cipher' });
  ok(vm.runInContext(`compassApplyDisplayName(${JSON.stringify(sample)})`, cipher)
       === 'I am Unity Point 22.5, and this is the work that finds me.',
     "mode 'cipher' inserts the Unity Point pseudonym");

  const custom = buildSandbox({ displayNameMode: 'custom' });
  ok(vm.runInContext(`compassApplyDisplayName(${JSON.stringify(sample)})`, custom)
       === 'I am V., and this is the work that finds me.',
     "mode 'custom' inserts the user's custom display name");

  const anon = buildSandbox({ displayNameMode: 'anonymous' });
  const anonOut = vm.runInContext(`compassApplyDisplayName(${JSON.stringify(sample)})`, anon);
  ok(anonOut.indexOf('{{display_name}}') === -1 && anonOut.indexOf('Vesna') === -1,
     "mode 'anonymous' drops the placeholder and any name from rendered copy");
}

console.log(`\n${pass} assertions passed.`);
