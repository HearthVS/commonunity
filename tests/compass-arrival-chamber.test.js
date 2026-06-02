/* cOMpass arrival chamber · regression test
 *
 * The arrival chamber is the FIRST page inside cOMpass, shown once after
 * the threshold completes and before the working cOMpass view. It is a
 * bolt-on module (arrival/arrival.{html,css,js}) that mirrors the
 * threshold's bolt-on shape and reuses its visual language.
 *
 * This is a jsdom-free static check against the arrival module sources,
 * the threshold handoff, and the server wiring. The contract under test:
 *   • arrival module exists and carries the required orientation content
 *   • the two begin paths are NON-EXCLUSIVE (request one-on-one does not
 *     block the solo start)
 *   • the threshold hands off to /compass/arrival on first completion, and
 *     returning users skip straight into cOMpass
 *   • the server exposes the arrival routes + the orientation-request API
 *   • the magic-link email carries the Hexagram Reader passcode
 *
 *   Run: node tests/compass-arrival-chamber.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'arrival/arrival.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'arrival/arrival.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'arrival/arrival.js'), 'utf8');
const thresholdJs = fs.readFileSync(path.join(ROOT, 'threshold/threshold.js'), 'utf8');
const serverPy = fs.readFileSync(path.join(ROOT, 'server.py'), 'utf8');
const adminHtml = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else { console.log('  FAIL ' + label); fail++; }
}

console.log('1. arrival module exists + reuses threshold visual language');
ok(/\/threshold\/threshold\.css/.test(html),
   'arrival.html links the threshold stylesheet (shared visual language)');
ok(/\/threshold\/contract\.js/.test(html),
   'arrival.html loads the OM Cipher contract module (read-only)');
ok(/\/compass\/arrival\/arrival\.(css|js)/.test(html),
   'arrival.html references its own assets under /compass/arrival/');
ok(/arrival-card/.test(css) && /arrival-paths/.test(css),
   'arrival.css defines the chamber card + two-path layout');

console.log('\n2. required title + lede');
ok(/Welcome to cOMpass/.test(js),
   "carries the 'Welcome to cOMpass' title");
ok(/This is the beginning of your orientation\./.test(js),
   "carries the 'This is the beginning of your orientation.' lede");

console.log('\n3. orientation prose (Markus source)');
ok(/to .?orient.? means to find north/.test(js),
   'orientation text opens with the north framing');
ok(/to turn toward the East/.test(js),
   'orientation text turns toward the East');
ok(/The cOMpass exists for this re-orientation/.test(js),
   'orientation text names the re-orientation purpose');
ok(/one of the first pioneers of CommonUnity/.test(js),
   'orientation text addresses the pioneer/beta role');

console.log('\n4. the two begin paths are non-exclusive');
ok(/Begin your orientation/.test(js),
   "carries the 'Begin your orientation' section");
ok(/These are not separate paths/.test(js),
   'copy states the paths are not separate');
ok(/still begin on your own while you wait/.test(js),
   'copy states solo start is possible while waiting for a one-on-one');
ok(/Request one-on-one orientation/.test(js) && /Begin your first solo session/.test(js),
   'both path cards are present');

console.log('\n5. one-on-one request wiring (does NOT block solo)');
ok(/\/api\/orientation-request/.test(js),
   'one-on-one button posts to /api/orientation-request');
ok(/One-on-one requested\. Markus will reach out personally\./.test(js),
   'post-request state confirms Markus will reach out');
// The solo handoff must be reachable regardless of the request state:
// the solo card + footer button both call handoffToCompass unconditionally.
ok(/function handoffToCompass/.test(js),
   'handoffToCompass is defined');
ok((js.match(/handoffToCompass/g) || []).length >= 3,
   'handoffToCompass is wired to multiple solo-begin affordances');

console.log('\n6. solo session instructions are present');
ok(/Read your first Gene Key hexagram/.test(js),
   'instruction: read first Gene Key hexagram');
ok(/check your magic-link email for the reader passcode/.test(js),
   'instruction: passcode comes from the magic-link email (not front-and-center)');
ok(/Chat with Nexus if you want reflective support/.test(js),
   'instruction: Nexus support');
ok(/You can return later and continue/.test(js),
   'instruction: sessions can be resumed');
ok(!/buythebook/.test(js),
   'the passcode itself is NOT printed on the arrival page');

console.log('\n7. solo handoff routes into the working cOMpass view');
ok(/\/compass\?threshold=done&enter=compass/.test(js),
   'solo begin routes to /compass?threshold=done&enter=compass');

console.log('\n8. threshold hands off to the arrival chamber on first completion');
ok(/window\.location\.href\s*=\s*'\/compass\/arrival'/.test(thresholdJs),
   'threshold.js handoffToCompass navigates to /compass/arrival');
ok(/window\.location\.replace\('\/compass\?threshold=done&enter=compass'\)/.test(thresholdJs),
   'returning/completed browsers skip the chamber and go straight into cOMpass');

console.log('\n9. server wiring');
ok(/@app\.get\("\/compass\/arrival"\)/.test(serverPy),
   'server serves /compass/arrival');
ok(/@app\.get\("\/compass\/arrival\/\{filename\}"\)/.test(serverPy),
   'server serves /compass/arrival/<file> assets');
ok(/@app\.post\("\/api\/orientation-request"\)/.test(serverPy),
   'server exposes POST /api/orientation-request');
ok(/CREATE TABLE IF NOT EXISTS orientation_request/.test(serverPy),
   'orientation_request table is created');
ok(/@app\.get\("\/api\/admin\/orientation-requests"\)/.test(serverPy),
   'admin can list orientation requests');

console.log('\n10. magic-link email carries the Hexagram Reader passcode (gently framed)');
ok(/buythebook/.test(serverPy),
   "magic-link email includes the 'buythebook' passcode");
ok(/For when you choose to begin on your own/.test(serverPy),
   'passcode is framed gently for those beginning alone');

console.log('\n11. one-on-one notification defaults to Markus, env overrides');
ok(/_ORIENTATION_NOTIFY_DEFAULT\s*=\s*"markus@jointidea\.com"/.test(serverPy),
   'notification recipient defaults to markus@jointidea.com');
ok(/os\.getenv\(_ORIENTATION_NOTIFY_ENV, ""\)\.strip\(\)\s*or\s*_ORIENTATION_NOTIFY_DEFAULT/.test(serverPy),
   'ORIENTATION_NOTIFY_EMAIL overrides the default when set');

console.log('\n12. admin panel is the center of truth for entry links (PR #56 audit)');
// Markus enters via the admin panel and treats it as the source of truth.
// User-facing links must resolve against the server-computed public base
// (commonunity.io in prod) — never the raw Railway origin — and the
// quick-links must reflect the post-threshold arrival chamber.
ok(/center of truth/i.test(adminHtml),
   'admin.html documents that it is the center of truth for entry links');
ok(/const publicBase\s*=\s*\(\)\s*=>\s*\(state\.configured && state\.configured\.invite_base_url\)\s*\|\|\s*location\.origin/.test(adminHtml),
   'publicBase() prefers configured.invite_base_url over location.origin');
ok(/const magicLink\s*=\s*\(token\)\s*=>\s*`\$\{publicBase\(\)/.test(adminHtml),
   'magic links are built from publicBase() (not bare location.origin)');
ok(/\['cOMpass arrival',\s*'\/compass\/arrival'/.test(adminHtml),
   'quick-links include the /compass/arrival orientation chamber');
ok(/\['cOMpass workspace',\s*'\/compass',[^\]]*returning users \/ debug/.test(adminHtml),
   '/compass workspace link is labeled as returning-user / debug entry');
ok(/const base\s*=\s*publicBase\(\)\.replace\(\/\\\/\$\/, ''\);[\s\S]{0,200}new URL\(path, base \+ '\/'\)/.test(adminHtml),
   'live-links render against publicBase() rather than location.origin');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
