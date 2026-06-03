/* trust-guardrails · regression test
 *
 * The first trust-architecture guardrails. Static string checks (no jsdom)
 * against server.py + the cOMpass/Studio frontends. The contract under test:
 *   • member data egress endpoints are gated (no world-readable Golden Thread,
 *     no ungated Nexus / Golden-Thread writes)
 *   • cOMpass shows a one-time Nexus consent/disclosure before the first
 *     message leaves the browser
 *   • only a first name (never the full legal name) is sent to Nexus/Claude
 *
 *   Run: node tests/trust-guardrails.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.py');
const index = read('index.html');
const studio = read('studio.html');

let pass = 0;
function ok(cond, label) {
  assert(cond, label);
  console.log('  ok  ' + label);
  pass++;
}

console.log('1. shared member-access gate exists');
ok(/def _has_member_access\(request: Request\) -> bool:/.test(server),
   '_has_member_access(request) helper is defined');
ok(/_has_admin_access\(request\)/.test(server) &&
   /_has_beta_access\(request\)/.test(server) &&
   /_valid_invite_token\(/.test(server),
   '_has_member_access checks admin OR beta OR valid invite token');

// Narrow the search to the helper body so we know it composes the checks.
const helperBody = (server.match(/def _has_member_access[\s\S]*?\n\n\n/) || [''])[0];
ok(/_has_admin_access\(request\)/.test(helperBody) &&
   /_has_beta_access\(request\)/.test(helperBody) &&
   /_invite_token_from_cookie\(request\)/.test(helperBody) &&
   /request\.query_params\.get\("invite"\)/.test(helperBody),
   'helper combines admin, beta cookie, invite cookie, and ?invite= param');

console.log('\n2. GET /api/golden-thread is no longer world-readable');
const getGt = (server.match(/@app\.get\("\/api\/golden-thread"\)[\s\S]*?\n\n\n/) || [''])[0];
ok(/async def get_golden_thread\(\s*req: Request/.test(getGt),
   'get_golden_thread takes req: Request');
ok(/if not _has_member_access\(req\):/.test(getGt) && /status_code=403/.test(getGt),
   'get_golden_thread 403s without member access');
// Privacy isolation (Stage 1 hotfix): reads are keyed per-user by cipher_id,
// with an invite-token-cookie fallback, and the old unfiltered all-rows branch
// is gone. A first-name `companion` must never be the read filter.
ok(/cipher_id/.test(getGt) && /WHERE cipher_id=\?/.test(getGt),
   'get_golden_thread keys reads by cipher_id');
ok(/_invite_token_from_cookie\(req\)/.test(getGt) && /WHERE invite_token=\?/.test(getGt),
   'get_golden_thread falls back to the caller\'s own invite-token cookie');
ok(/rows = \[\]/.test(getGt),
   'get_golden_thread returns NO rows when no per-user key resolves (no table dump)');
ok(!/SELECT \* FROM golden_thread ORDER BY timestamp DESC LIMIT \?/.test(getGt),
   'the unfiltered all-rows SELECT is removed from the member GET');
ok(!/WHERE companion=\?/.test(getGt),
   'companion (first name) is never used as the read filter');

console.log('\n3. POST /api/golden-thread is gated');
const postGt = (server.match(/@app\.post\("\/api\/golden-thread"\)[\s\S]*?return \{"ok": True/) || [''])[0];
ok(/if not _has_member_access\(req\):/.test(postGt) && /status_code=403/.test(postGt),
   'save_golden_thread 403s without member access');

console.log('\n4. /rose-mirror (Nexus) is gated and can read cookies');
const roseSig = (server.match(/@app\.post\("\/rose-mirror"\)[\s\S]{0,400}/) || [''])[0];
ok(/async def rose_mirror\(request: RoseMirrorRequest, req: Request\):/.test(roseSig),
   'rose_mirror takes req: Request (so it can read the gate cookies)');
ok(/if not _has_member_access\(req\):/.test(roseSig) && /status_code=403/.test(roseSig),
   'rose_mirror 403s without member access');

console.log('\n5. admin Golden Thread view stays admin-gated (unchanged)');
const adminGt = (server.match(/@app\.get\("\/api\/admin\/golden-thread"\)[\s\S]*?return/) || [''])[0];
ok(/_require_admin\(request\)/.test(adminGt),
   'admin_golden_thread still requires admin');

console.log('\n6. cOMpass first-use Nexus consent disclosure');
ok(/commonunity_nexus_consent_v1/.test(index),
   'a versioned consent localStorage key exists');
ok(/function compassNexusHasConsent\(/.test(index) &&
   /function compassNexusGrantConsent\(/.test(index),
   'consent read + grant helpers exist');
ok(/function compassNexusRequestConsent\(/.test(index),
   'the disclosure renderer exists');
// The send path must check consent before posting to the AI.
const sendFn = (index.match(/async function sendCompassNexusMessage[\s\S]*?\n  sendBtn\.classList\.add\('loading'\);/) || [''])[0];
ok(/if \(!compassNexusHasConsent\(\)\)/.test(sendFn) &&
   /await compassNexusRequestConsent\(\)/.test(sendFn),
   'sendCompassNexusMessage gates the first send behind consent');
// Disclosure copy must name the recipient + the reflection-companion framing.
ok(/sends that message and relevant cOMpass[\s\S]*?context[\s\S]*?to Claude/.test(index),
   'disclosure states the message + context is sent to Claude');
ok(/not a private diary[\s\S]*?not a[\s\S]*?replacement for your own inner authority/.test(index),
   'disclosure frames Nexus as a reflection companion, not a diary/authority');

console.log('\n7. identity minimization: pseudonymous Unity Point to Nexus/Claude');
// The first-name helper survives as the Golden Thread back-compat lookup key.
ok(/function compassNexusIdentity\(\)/.test(index),
   'cOMpass keeps the first-name helper (Golden Thread lookup key)');
ok(/\(state\.companion \|\| ''\)\.trim\(\)\.split\(\/\\s\+\/\)\[0\]/.test(index),
   'cOMpass first-name helper takes only the first whitespace-delimited token');
// The AI address is now the pseudonymous Unity Point, derived from the cipher
// identity, falling back to the first name only when no gate is known yet.
ok(/function compassNexusAddress\(\)/.test(index) &&
   /function compassCipherIdentity\(\)/.test(index),
   'cOMpass exposes the Unity Point address + cipher identity helpers');
// Scope the check to the /rose-mirror send so unrelated endpoints (e.g.
// /search) that legitimately carry the full companion are not flagged.
const roseSend = (index.match(/fetch\(`\$\{API_BASE\}\/rose-mirror`[\s\S]*?golden_thread:/) || [''])[0];
ok(/companion: compassNexusAddress\(\)/.test(roseSend),
   'the /rose-mirror payload sends the pseudonymous Unity Point address');
ok(!/companion: state\.companion/.test(roseSend),
   'the /rose-mirror payload no longer sends the full name raw to the AI');
ok(!/companion: compassNexusIdentity\(\)/.test(roseSend),
   'the /rose-mirror payload no longer sends the raw first name to the AI');

ok(/function studioNexusAddress\(\)/.test(studio) &&
   /function studioCipherIdentity\(\)/.test(studio),
   'Studio exposes the Unity Point address + cipher identity helpers');
ok(/companion: studioNexusAddress\(\)/.test(studio),
   'Studio AI payloads send the pseudonymous Unity Point address');
// Both Studio AI payloads (rose-room-opening + rose-mirror) must be pseudonymous.
ok((studio.match(/companion: studioNexusAddress\(\)/g) || []).length >= 2,
   'both Studio AI payloads send the pseudonymous Unity Point address');

console.log('\n8. the pseudonymous OM Cipher identity has superseded the interim');
// The interim first-name TODO is gone; the server now documents the
// pseudonymous identity directly in the prompt path.
ok(!/TODO\(trust-architecture\)/.test(server),
   'server no longer carries the interim first-name TODO (superseded)');
ok(/pseudonymous OM Cipher operating identity|pseudonymous OM Cipher/.test(server),
   'server prompt names the pseudonymous OM Cipher identity');

console.log(`\n${pass} passed`);
