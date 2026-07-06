/* nexus-new-project-composer · regression test
 *
 * Guards the fix for the Nexus "New Project" regression: after clicking
 * New Project the dialogue/composer disappeared and the room had no writing
 * area. The root cause was nexusNewProject() dropping the room back to the
 * dormant "knock the orb" ritual — it added `nexus-dormant-hidden` to the
 * composer row (opacity:0; pointer-events:none) and removed `nexus-awakened`,
 * so the composer was hidden and unusable until the orb was held again.
 *
 * The fix keeps the composer AWAKE on reset — visible, focusable, and compact —
 * while expanding the ceremonial context (#127) to mark the fresh start. It
 * preserves the collapsible-context (#127) and compact composer (#126) work.
 *
 * Sections:
 *   1. static — the New Project handler no longer hides the composer and keeps
 *      it awakened, focusable, and compact.
 *   2. static — the ceremonial context is expanded (not collapsed) on reset.
 *   3. static — CSS invariants: the awakened composer is interactive and the
 *      dormant-hidden class (the thing we must NOT apply on reset) is inert.
 *   4. static — reset still clears the conversation state (history + DOM).
 *
 *   Run: node tests/nexus-new-project-composer.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

// Extract the nexusNewProject() function body.
const fn = (src.match(/function nexusNewProject\(\)[\s\S]*?\n\}\n/) || [''])[0];

// ---------------------------------------------------------------------------
console.log('1. New Project keeps the composer awake (visible + focusable + compact)');
// ---------------------------------------------------------------------------
ok('nexusNewProject() is found', !!fn);
ok('does NOT hide the composer row with nexus-dormant-hidden',
   !/classList\.add\(\s*['"]nexus-dormant-hidden['"]/.test(fn));
ok('removes nexus-dormant-hidden from the composer row',
   /row\.classList\.remove\(\s*['"]nexus-dormant-hidden['"]/.test(fn));
ok('keeps the composer awakened (adds nexus-awakened)',
   /row\.classList\.add\(\s*['"]nexus-awakened['"]/.test(fn));
ok('marks the session awakened so the knock ritual does not re-hide it',
   /nexusAwakened\s*=\s*true/.test(fn) &&
   !/window\.nexusAwakened\s*=\s*false/.test(fn));
ok('focuses the composer after reset',
   /getElementById\(['"]mirror-input['"]\)\??\.focus\(\)/.test(fn));
ok('resets the composer to its compact rest height (autoGrowMirrorInput)',
   /autoGrowMirrorInput\(/.test(fn));

// ---------------------------------------------------------------------------
console.log('\n2. Ceremonial context is expanded on a fresh project (#127 preserved)');
// ---------------------------------------------------------------------------
ok('expands the ceremonial context (setNexusContextCollapsed(false))',
   /setNexusContextCollapsed\(\s*false\s*\)/.test(fn));

// ---------------------------------------------------------------------------
console.log('\n3. CSS invariants — awakened composer is interactive, dormant is inert');
// ---------------------------------------------------------------------------
const awakenedCss = (src.match(/\.mirror-input-area\.nexus-awakened\s*\{[\s\S]*?\}/) || [''])[0];
ok('.nexus-awakened composer is opaque', /opacity:\s*1/.test(awakenedCss));
ok('.nexus-awakened composer accepts pointer events',
   /pointer-events:\s*all/.test(awakenedCss));

const dormantCss = (src.match(/\.mirror-input-area\.nexus-dormant-hidden\s*\{[\s\S]*?\}/) || [''])[0];
ok('.nexus-dormant-hidden composer is transparent (why we must not apply it on reset)',
   /opacity:\s*0/.test(dormantCss));
ok('.nexus-dormant-hidden composer blocks pointer events',
   /pointer-events:\s*none/.test(dormantCss));

// ---------------------------------------------------------------------------
console.log('\n4. Reset still clears conversation state');
// ---------------------------------------------------------------------------
ok('clears mirrorHistory for the current room',
   /mirrorHistory\s*=\s*\[\]/.test(fn));
ok('clears the conversation DOM',
   /mirror-conversation[\s\S]*?innerHTML\s*=\s*['"]{2}/.test(fn) ||
   /conv\.innerHTML\s*=\s*['"]{2}/.test(fn));
ok('fires a fresh opening message (initRoomRose)',
   /initRoomRose\(/.test(fn));

// ---------------------------------------------------------------------------
if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll nexus-new-project-composer checks passed.');
