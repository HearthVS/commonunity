/* magic-link-import-allowlist · Tranche 1 front-end identity guard
 *
 * The cOMpass SPA must treat the SERVER session identity (GET
 * /api/session/identity, resolved from the signed HttpOnly invite cookie) as
 * authoritative, and must never let an imported session JSON escalate the
 * session. This guards the client half of the Tranche 1 fix in index.html:
 *
 *   1. Import allowlist — cuStripImportedIdentity() removes every role /
 *      identity-binding / permission field (role, companion_mode, token,
 *      token_hash, scopes/scope, guide_id, companion_id, circle, session,
 *      permissions) from an imported object, returning them for audit, while
 *      leaving companion-owned content (points, profile birth data) intact.
 *
 *   2. Identity lock — when a companion invite is bound (cuSessionIdentityBound),
 *      loadJSON drops the file's guide/companion NAMES and syncSetupIntoProfile
 *      forces the profile identity from the server companion name, so an
 *      imported file cannot repaint WHO the session is.
 *
 *   3. Wiring — init() resolves /api/session/identity on load; loadJSON runs the
 *      allowlist before merging.
 *
 * Static source assertions + a functional check of the stripper. No DOM/network.
 *
 *   Run: node tests/magic-link-import-allowlist.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

function extractFn(html, name) {
  const start = html.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (start < 0) return '';
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

console.log('1. Import allowlist strips role/identity/permission fields, keeps content');
const topDecl = (src.match(/var\s+IMPORT_FORBIDDEN_TOP\s*=\s*\[[^\]]*\];/) || [])[0];
const profDecl = (src.match(/var\s+IMPORT_FORBIDDEN_PROFILE\s*=\s*\[[^\]]*\];/) || [])[0];
const stripFn = extractFn(src, 'cuStripImportedIdentity');
ok('IMPORT_FORBIDDEN_TOP declares role/companion_mode/token/scopes/guide_id/companion_id',
   !!topDecl && /role/.test(topDecl) && /companion_mode/.test(topDecl) &&
   /token/.test(topDecl) && /scopes/.test(topDecl) &&
   /guide_id/.test(topDecl) && /companion_id/.test(topDecl));
ok('cuStripImportedIdentity helper exists', !!stripFn);

let strip = null;
try {
  // eslint-disable-next-line no-eval
  strip = eval('(function(){' + topDecl + profDecl + stripFn +
    ';return cuStripImportedIdentity;})()');
} catch (e) { ok('stripper eval (' + e.message + ')', false); }

if (strip) {
  // The reported incident fixture shape: guide=Markus, companion=Eda,
  // companion_mode=false, plus injected escalation fields.
  const legacy = {
    guide: 'markus Lehto',
    companion: 'Eda Çarmıklı',
    companion_mode: false,
    role: 'guide',
    token: 'FORGED',
    scopes: 'admin',
    guide_id: 'x', companion_id: 'y', circle: 'z',
    points: { work: { summary: 'Eda content' } },
    profile: { legal_name: 'Eda Çarmıklı', birthdate: '1990-01-01', role: 'guide', token: 't' },
  };
  const rejected = strip(legacy);
  ok('role escalation field is stripped', legacy.role === undefined);
  ok('companion_mode override is stripped', legacy.companion_mode === undefined);
  ok('forged token is stripped', legacy.token === undefined);
  ok('scopes escalation is stripped', legacy.scopes === undefined);
  ok('guide_id / companion_id / circle overrides are stripped',
     legacy.guide_id === undefined && legacy.companion_id === undefined && legacy.circle === undefined);
  ok('nested profile.role / profile.token are stripped',
     legacy.profile.role === undefined && legacy.profile.token === undefined);
  ok('companion-owned CONTENT survives (points + profile birth data)',
     legacy.points.work.summary === 'Eda content' && legacy.profile.birthdate === '1990-01-01');
  ok('rejected list reports the stripped keys for audit',
     rejected.includes('role') && rejected.includes('companion_mode') &&
     rejected.includes('profile.role'));
}

console.log('\n2. Identity lock — server session is authoritative over imported names');
const boundFn = extractFn(src, 'cuSessionIdentityBound');
ok('cuSessionIdentityBound helper exists', !!boundFn);
// loadJSON drops imported guide/companion names when a companion invite is bound.
ok('loadJSON runs the import allowlist before merging',
   /const\s+_rejected\s*=\s*cuStripImportedIdentity\(data\)/.test(src));
ok('loadJSON drops imported guide/companion names when identity is bound',
   /if\s*\(cuSessionIdentityBound\(\)\)\s*\{\s*delete\s+data\.guide;\s*delete\s+data\.companion;/.test(src));
// syncSetupIntoProfile forces identity from the bound session and blocks the
// field-based seeding when bound.
const sync = extractFn(src, 'syncSetupIntoProfile');
ok('syncSetupIntoProfile forces profile identity from the bound companion name',
   /if\s*\(cuSessionIdentityBound\(\)\)\s*\{[\s\S]*SESSION_IDENTITY\.companion_name/.test(sync));
ok('field-based companion seeding is skipped when identity is server-bound',
   /if\s*\(companionName\s*&&\s*!cuSessionIdentityBound\(\)\)/.test(sync));

console.log('\n3. Wiring — the session identity is resolved from the server on load');
ok('a /api/session/identity resolver exists',
   /fetch\(['"]\/api\/session\/identity['"]/.test(src));
ok('init() applies the server session identity',
   /cuApplySessionIdentity\(\)/.test(src));
ok('the resolver fails closed on error (SESSION_IDENTITY = null)',
   /\.catch\(function\s*\(\)\s*\{\s*SESSION_IDENTITY\s*=\s*null/.test(src));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: magic-link import allowlist + identity lock pass.');
}
