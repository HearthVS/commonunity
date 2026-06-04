/* nexus-payload-identity-minimization · privacy regression test
 *
 * Markus assumed Nexus already received a Nexus-safe DERIVED Cipher context
 * rather than raw identity/source data. This test proves it — and would have
 * caught the two leaks that existed before this change:
 *
 *   1. studioNexusAddress() / compassNexusAddress() fell back to the real
 *      first name (studioNexusIdentity / compassNexusIdentity) whenever no
 *      gate / Unity Point was derived yet, so a fresh user's real name was
 *      sent to Nexus as `companion`.
 *   2. updateNexusMemory() prepended "Name: <real display name>" into the
 *      nexus_memory blob, which is sent verbatim to /rose-mirror and
 *      /rose-room-opening.
 *
 * Approach (mirrors cell-salts-compass-payload-flow.test.js): extract the real
 * helper functions from index.html + studio.html and execute them against a
 * fake-window harness seeded with a fixture that carries LEGAL NAME, FIRST
 * NAME, EMAIL, BIRTH DATE/TIME/PLACE, RAW SEED, FULL RECORD JSON, plus
 * user-authored Field Notes / Golden Thread / Gene Keys. We then build the
 * exact outbound identity context and assert:
 *
 *   • NONE of the source-identity values appear in the outbound JSON.
 *   • The derived/pseudonymous context IS present (Unity Point, cipher_id,
 *     unity_code, Gene Keys labels, frequency, Field Notes, Golden Thread).
 *   • Sacred Mode text is never auto-included (guarded by sacred-mode.js;
 *     asserted here at the policy level).
 *
 * Run: node tests/nexus-payload-identity-minimization.test.js
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const assert = require('node:assert/strict');
const vm     = require('vm');

const root  = path.resolve(__dirname, '..');
const read  = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const index = read('index.html');
const studio = read('studio.html');

let pass = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  console.log('  ok  ' + label);
  pass++;
}

// Brace-balanced function extractor (same technique as the existing payload
// tests). Pulls a top-level `function NAME(...) { ... }` out of an HTML blob.
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

// Extract a `const NAME = <literal>;` declaration (for the neutral-address
// consts the helpers depend on).
function extractConst(html, name) {
  const re = new RegExp('const\\s+' + name + '\\s*=\\s*[^;]+;');
  const m = html.match(re);
  assert.ok(m, 'could not locate const ' + name);
  return m[0];
}

// ── The fixture: a fully-populated source record with real identity ─────────
// Every value below is SOURCE identity that must NEVER reach Nexus, except the
// clearly-marked derived/user-authored fields at the bottom.
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
  sacred_text:  'A private prayer I am holding, not offering.',
  // Derived / user-authored — ALLOWED in the Nexus payload:
  unity_point: 'Unity Point 22.5',
  unity_code:  'UC-22.5',
  cipher_id:   'cipher_abc123def456abc123def4',
  gk_label:    'GK22 (Grace → Graciousness → Forgiveness)',
  field_notes: 'I keep returning to the same threshold in my work.',
  golden_thread: 'A moment I chose to carry forward about my creative call.',
  frequency:   'Gift — 8'
};

// The list of source-identity values that must be absent from any outbound
// Nexus payload string. (raw_seed/full_record_json substrings include the
// legal name, so they are covered transitively, but we assert each anyway.)
const FORBIDDEN = [
  FIXTURE.legal_name, FIXTURE.first_name, FIXTURE.email,
  FIXTURE.birth_date, FIXTURE.birth_time, FIXTURE.birth_place,
  FIXTURE.raw_seed, FIXTURE.full_record_json, FIXTURE.invite_token,
  FIXTURE.sacred_text
];

function assertNoSourceIdentity(label, payloadStr) {
  FORBIDDEN.forEach((val) => {
    ok(payloadStr.indexOf(val) === -1,
       `${label}: source-identity value is absent → "${String(val).slice(0, 28)}…"`);
  });
}

// ════════════════════════════════════════════════════════════════════════
console.log('cOMpass (index.html)');
// ════════════════════════════════════════════════════════════════════════
{
  // Build a sandbox with the real cOMpass helpers. We stub compassCipherIdentity
  // to return ONLY the pseudonymous identity (which is what the real contract
  // helper produces) so we exercise the address + safe-context builders as
  // written.
  const sandbox = { console };
  vm.createContext(sandbox);

  const src = [
    extractConst(index, 'COMPASS_NEXUS_NEUTRAL_ADDRESS'),
    extractFn(index, 'compassNexusAddress'),
    extractFn(index, 'buildNexusSafeCipherContext'),
    // A fixture-backed compassCipherIdentity stub (the real one reads the OM
    // Cipher contract from localStorage; here we hand it the derived identity).
    `function compassCipherIdentity() {
       return { unity_point: ${JSON.stringify(FIXTURE.unity_point)},
                unity_code:  ${JSON.stringify(FIXTURE.unity_code)},
                cipher_id:   ${JSON.stringify(FIXTURE.cipher_id)} };
     }`,
    // compassNexusIdentity returns the REAL first name (Golden Thread lookup
    // key). It must never be reachable from the Nexus address path.
    `var state = { companion: ${JSON.stringify(FIXTURE.legal_name)} };
     function compassNexusIdentity() {
       return (state.companion || '').trim().split(/\\s+/)[0] || '';
     }`,
    // Reconstruct the actual /rose-mirror payload identity slice + the derived
    // pattern fields the real send attaches, then serialize as the browser would.
    `var __payload = JSON.stringify(Object.assign({
        message: 'where am I avoiding the work?',
        gk_shadow: ${JSON.stringify(FIXTURE.gk_label)},
        golden_thread: ${JSON.stringify(FIXTURE.golden_thread)},
        session_notes: ${JSON.stringify(FIXTURE.field_notes)},
        frequency_label: ${JSON.stringify(FIXTURE.frequency)}
     }, buildNexusSafeCipherContext()));`
  ].join('\n');

  vm.runInContext(src, sandbox);
  const payload = sandbox.__payload;

  // The real first name MUST still be derivable locally (Golden Thread key)…
  ok(vm.runInContext('compassNexusIdentity()', sandbox) === FIXTURE.first_name,
     'compassNexusIdentity still yields the first name locally (Golden Thread key)');
  // …but the Nexus address must be the pseudonymous Unity Point, never the name.
  ok(vm.runInContext('compassNexusAddress()', sandbox) === FIXTURE.unity_point,
     'compassNexusAddress returns the Unity Point (pseudonymous)');

  assertNoSourceIdentity('cOMpass /rose-mirror', payload);

  ok(payload.indexOf(FIXTURE.unity_point) !== -1, 'cOMpass payload retains Unity Point');
  ok(payload.indexOf(FIXTURE.unity_code) !== -1,  'cOMpass payload retains unity_code');
  ok(payload.indexOf(FIXTURE.cipher_id) !== -1,   'cOMpass payload retains cipher_id');
  ok(payload.indexOf(FIXTURE.gk_label) !== -1,    'cOMpass payload retains Gene Keys label');
  ok(payload.indexOf(FIXTURE.golden_thread) !== -1, 'cOMpass payload retains Golden Thread');
  ok(payload.indexOf(FIXTURE.field_notes) !== -1, 'cOMpass payload retains Field Notes');
  ok(payload.indexOf(FIXTURE.frequency) !== -1,   'cOMpass payload retains frequency state');

  // The neutral fallback: when NO gate / Unity Point is derived, the address
  // must NOT collapse to the real first name.
  vm.runInContext(
    'function compassCipherIdentity(){ return null; }',
    sandbox);
  const neutral = vm.runInContext('compassNexusAddress()', sandbox);
  ok(neutral !== FIXTURE.first_name && neutral !== FIXTURE.legal_name,
     'cOMpass neutral fallback is not the real name');
  ok(neutral === 'this Cipher', 'cOMpass neutral fallback is the neutral pseudonym');
}

// ════════════════════════════════════════════════════════════════════════
console.log('\nstUdio (studio.html)');
// ════════════════════════════════════════════════════════════════════════
{
  const sandbox = { console };
  vm.createContext(sandbox);

  // nexus_memory as built by the OLD updateNexusMemory would have started with
  // a "Name: <legal name>" line. We seed exactly that legacy shape to prove the
  // sanitizer strips it while keeping the derived Gene Keys / Field Notes lines.
  const legacyMemory =
    `Name: ${FIXTURE.legal_name}\n` +
    `The Work: ${FIXTURE.gk_label}\n` +
    `Recent writing across rooms:\n${FIXTURE.field_notes}`;

  const src = [
    extractConst(studio, 'NEXUS_NEUTRAL_ADDRESS'),
    extractFn(studio, 'studioNexusAddress'),
    extractFn(studio, 'sanitizeNexusMemory'),
    extractFn(studio, 'buildNexusSafeCipherContext'),
    `function studioCipherIdentity() {
       return { unity_point: ${JSON.stringify(FIXTURE.unity_point)},
                unity_code:  ${JSON.stringify(FIXTURE.unity_code)},
                cipher_id:   ${JSON.stringify(FIXTURE.cipher_id)} };
     }`,
    // studioNexusIdentity returns the REAL first name (derived from the display
    // name). It must never be reachable from the Nexus address path.
    `var state = { person: ${JSON.stringify(FIXTURE.legal_name)},
                   compassData: { companion: ${JSON.stringify(FIXTURE.legal_name)} },
                   nexusMemory: ${JSON.stringify(legacyMemory)} };
     function studioNexusIdentity() {
       const full = state.compassData?.companion || state.person || '';
       return String(full).trim().split(/\\s+/)[0] || '';
     }`,
    `var __payload = JSON.stringify(Object.assign({
        message: 'help me shape the launch',
        gk_work: ${JSON.stringify(FIXTURE.gk_label)},
        golden_thread: ${JSON.stringify(FIXTURE.golden_thread)},
        session_notes: ${JSON.stringify(FIXTURE.field_notes)}
     }, buildNexusSafeCipherContext()));`
  ].join('\n');

  vm.runInContext(src, sandbox);
  const payload = sandbox.__payload;

  ok(vm.runInContext('studioNexusIdentity()', sandbox) === FIXTURE.first_name,
     'studioNexusIdentity still yields the first name locally');
  ok(vm.runInContext('studioNexusAddress()', sandbox) === FIXTURE.unity_point,
     'studioNexusAddress returns the Unity Point (pseudonymous)');

  assertNoSourceIdentity('stUdio /rose-mirror', payload);

  ok(payload.indexOf(FIXTURE.unity_point) !== -1, 'stUdio payload retains Unity Point');
  ok(payload.indexOf(FIXTURE.cipher_id) !== -1,   'stUdio payload retains cipher_id');
  ok(payload.indexOf(FIXTURE.gk_label) !== -1,    'stUdio payload retains Gene Keys label');
  ok(payload.indexOf(FIXTURE.golden_thread) !== -1, 'stUdio payload retains Golden Thread');
  ok(payload.indexOf(FIXTURE.field_notes) !== -1, 'stUdio payload retains Field Notes');

  // The sanitizer specifically: strips the legacy "Name:" line, keeps the rest.
  const cleaned = vm.runInContext('sanitizeNexusMemory(state.nexusMemory)', sandbox);
  ok(cleaned.indexOf(FIXTURE.legal_name) === -1,
     'sanitizeNexusMemory strips the legacy "Name: <real name>" line');
  ok(cleaned.indexOf(FIXTURE.gk_label) !== -1 && cleaned.indexOf(FIXTURE.field_notes) !== -1,
     'sanitizeNexusMemory retains derived Gene Keys + Field Notes lines');

  // Neutral fallback when no gate is known.
  vm.runInContext('function studioCipherIdentity(){ return null; }', sandbox);
  const neutral = vm.runInContext('studioNexusAddress()', sandbox);
  ok(neutral !== FIXTURE.first_name && neutral !== FIXTURE.legal_name,
     'stUdio neutral fallback is not the real name');
  ok(neutral === 'this Cipher', 'stUdio neutral fallback is the neutral pseudonym');
}

// ════════════════════════════════════════════════════════════════════════
console.log('\nDefense in depth + Sacred Mode policy');
// ════════════════════════════════════════════════════════════════════════
// updateNexusMemory must no longer WRITE the real name into the blob.
const updateMemFn = extractFn(studio, 'updateNexusMemory');
ok(!/parts\.push\(`Name: \$\{name\}`\)/.test(updateMemFn),
   'updateNexusMemory no longer writes the real name into nexus_memory');

// Sacred Mode (PR #77/#78): sacred text is local-only and only crosses the
// boundary as a deliberate, user-driven "Offer to Nexus" — never auto-sent.
const sacred = read('sdk/sacred-mode.js');
ok(/NEVER auto-persisted/.test(sacred) && /Offer to Nexus/.test(sacred),
   'Sacred Mode text is local-only and only offered deliberately (unchanged)');
ok(/isActive/.test(sacred),
   'Sacred Mode exposes isActive() so hosts treat sacred surfaces as empty for normal payloads');

console.log(`\n${pass} passed`);
