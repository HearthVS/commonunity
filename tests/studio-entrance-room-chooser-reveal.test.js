/* Regression test: Studio entrance room chooser — visible, active tiles
 * after a JSON / Compass load, and clearer distinction between the two
 * entrance import options.
 *
 * User-reported bug: after loading a session JSON on the Studio
 * hOMe/setup page, the "Choose your room" label appeared but no room
 * cards were visible — yet clicking the empty space still navigated.
 * Cause: the load paths (studioLoadJSON / processCompassImport) added
 * `.visible` to #entrance-room-chooser but never revealed the
 * individual .room-tile buttons, which start at opacity:0 in CSS. The
 * result was invisible-but-clickable hit areas.
 *
 * This test asserts:
 *   1. CSS — .room-tile starts hidden (opacity:0) and .entrance-room-
 *      chooser.visible flips the container to display:flex.
 *   2. A shared revealRoomChooser() helper exists that opens the portal,
 *      makes the chooser visible AND sets every tile to opacity:1.
 *   3. Both restore paths (studioLoadJSON, processCompassImport) call
 *      revealRoomChooser() instead of only toggling the container class.
 *   4. The two entrance import options carry distinct labels + titles
 *      so the redundant-looking pair is disambiguated.
 *
 * Usage:  node tests/studio-entrance-room-chooser-reveal.test.js
 * Deps:   none (static source assertions)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

// Helper: extract the body of a top-level `function name(...) { ... }`
// by brace-matching from its declaration.
function extractFn(source, name) {
  const decl = source.indexOf('function ' + name + '(');
  if (decl === -1) return null;
  const open = source.indexOf('{', decl);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1) CSS — tiles hidden by default; .visible only flips the container.
// ---------------------------------------------------------------------------
console.log('css');

const tileRule = src.match(/\.room-tile\s*\{[^}]*\}/);
assert(!!tileRule, '.room-tile rule present');
assert(!!tileRule && /opacity:\s*0\b/.test(tileRule[0]),
  '.room-tile starts hidden (opacity:0) — relies on JS to reveal');

const chooserVisible = src.match(/\.entrance-room-chooser\.visible\s*\{[^}]*\}/);
assert(!!chooserVisible && /display:\s*flex/.test(chooserVisible[0]),
  '.entrance-room-chooser.visible sets display:flex (container only)');

// ---------------------------------------------------------------------------
// 2) Shared revealRoomChooser() helper exists and reveals every tile.
// ---------------------------------------------------------------------------
console.log('helper');

const reveal = extractFn(src, 'revealRoomChooser');
assert(!!reveal, 'revealRoomChooser() helper is defined');
assert(!!reveal && /portalOpened\s*=\s*true/.test(reveal),
  'revealRoomChooser marks the portal opened');
assert(!!reveal && /doors-open/.test(reveal),
  'revealRoomChooser puts the portal into its doors-open state');
assert(!!reveal && /classList\.add\(\s*['"]visible['"]\s*\)/.test(reveal),
  'revealRoomChooser makes the chooser container visible');
assert(!!reveal && /\.room-tile/.test(reveal) && /opacity\s*=\s*['"]1['"]/.test(reveal),
  'revealRoomChooser sets each .room-tile to opacity:1 (visible + active)');

// ---------------------------------------------------------------------------
// 3) Both restore paths delegate to revealRoomChooser().
// ---------------------------------------------------------------------------
console.log('load-paths');

const loadJSON = extractFn(src, 'studioLoadJSON');
assert(!!loadJSON && /revealRoomChooser\(\)/.test(loadJSON),
  'studioLoadJSON() calls revealRoomChooser()');

const compassImport = extractFn(src, 'processCompassImport');
assert(!!compassImport && /revealRoomChooser\(\)/.test(compassImport),
  'processCompassImport() calls revealRoomChooser()');

// Neither load path should silently flip only the container class
// (the old broken pattern) without revealing tiles. Guard against a
// regression where someone re-introduces a bare chooser.classList.add
// in a load path.
[['studioLoadJSON', loadJSON], ['processCompassImport', compassImport]].forEach(([n, body]) => {
  if (!body) { fail(n + ' body not found'); return; }
  const bareToggle = /chooser\.classList\.add\(\s*['"]visible['"]\s*\)/.test(body);
  assert(!bareToggle,
    n + ' does not toggle the chooser visible without revealing tiles');
});

// ---------------------------------------------------------------------------
// 4) Entrance import options are clearly distinguished.
// ---------------------------------------------------------------------------
console.log('labels');

const importBtn = src.match(/<button[^>]*id="btn-import-compass"[^>]*>([^<]*)<\/button>/);
const loadBtn   = src.match(/<button[^>]*id="btn-studio-load-entrance"[^>]*>([^<]*)<\/button>/);

assert(!!importBtn, '#btn-import-compass present');
assert(!!loadBtn, '#btn-studio-load-entrance present');

const importLabel = importBtn ? importBtn[1].trim() : '';
const loadLabel   = loadBtn ? loadBtn[1].trim() : '';
assert(importLabel.length > 0 && loadLabel.length > 0 && importLabel !== loadLabel,
  'the two import options have distinct labels (' + importLabel + ' / ' + loadLabel + ')');

assert(!!importBtn && /title="[^"]+"/.test(importBtn[0]),
  '#btn-import-compass has an explanatory title tooltip');
assert(!!loadBtn && /title="[^"]+"/.test(loadBtn[0]),
  '#btn-studio-load-entrance has an explanatory title tooltip');

// ---------------------------------------------------------------------------
console.log('');
if (failed) {
  console.error('FAILED: ' + failed + ' assertion(s) in studio-entrance-room-chooser-reveal');
  process.exit(1);
}
console.log('OK: studio-entrance-room-chooser-reveal test passed.');
