#!/usr/bin/env node
/*
 * Regression test for the hOMe preview OM Cipher palette role system.
 *
 * studio.html has no build step, so this test extracts the pure
 * phDerivePaletteTheme() source directly from studio.html, evaluates it in a
 * sandbox, and asserts the role mapping + derived token contract. Run with:
 *   node tests/palette_roles.test.js
 * Exits non-zero on the first failed assertion.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const studioPath = path.join(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

// Pull out `function phDerivePaletteTheme(sources) { ... }` up to the line that
// exposes it on window (its terminator in studio.html).
const start = src.indexOf('function phDerivePaletteTheme(sources) {');
if (start === -1) throw new Error('phDerivePaletteTheme not found in studio.html');
const marker = 'if (typeof window !== \'undefined\') window.phDerivePaletteTheme';
const end = src.indexOf(marker, start);
if (end === -1) throw new Error('phDerivePaletteTheme terminator not found');
const fnSource = src.slice(start, end);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fnSource + '\nthis.phDerivePaletteTheme = phDerivePaletteTheme;', sandbox);
const derive = sandbox.phDerivePaletteTheme;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ ' + msg); failures++; }
  else { console.log('  ✓ ' + msg); }
}

const P = 'oklch(0.55 0.227 40)';   // primary
const S = 'oklch(0.55 0.227 220)';  // secondary
const A = 'oklch(0.74 0.13 120)';   // seasonal accent

// 1. Role mapping: primary→Expression, secondary→Root, accent→Radiance.
const t = derive({ primary: P, secondary: S, accent: A });
assert(t !== null, 'returns a theme for a full palette');
assert(t['--ph-expression'] === P, 'Expression maps to primary source');
assert(t['--ph-root'] === S, 'Root maps to secondary source');
assert(t['--ph-radiance'] === A, 'Radiance maps to accent source');

// 2. Derived surface/border/glow are anchored on accessible neutral tokens.
assert(/var\(--card\)/.test(t['--ph-surface']), 'surface anchors on --card');
assert(/var\(--card\)/.test(t['--ph-surface-elevated']), 'elevated surface anchors on --card');
assert(/var\(--border\)/.test(t['--ph-border']), 'border anchors on --border');
assert(/transparent/.test(t['--ph-glow']), 'glow is a translucent radiance');
assert(/radial-gradient/.test(t['--ph-gradient']), 'gradient is a radial-gradient');
assert(t['--ph-accent'] === P, 'accent role equals Expression');

// 3. Per-room highlights use the documented blend weights (role terms).
assert(t['--work']  === `color-mix(in srgb, ${P} 65%, ${A} 35%)`, 'work = 65% expression + 35% radiance');
assert(t['--lens']  === `color-mix(in srgb, ${S} 70%, ${P} 30%)`, 'lens = 70% root + 30% expression');
assert(t['--field'] === `color-mix(in srgb, ${S} 60%, ${A} 40%)`, 'field = 60% root + 40% radiance');
assert(t['--call']  === `color-mix(in srgb, ${P} 70%, ${S} 30%)`, 'call = 70% expression + 30% root');

// 4. The preview's personal-accent token inherits Expression.
assert(t['--rose-color'] === P, '--rose-color inherits Expression');

// 5. Empty palette → null (no theme applied; neutral default preview kept).
assert(derive({}) === null, 'empty palette returns null');
assert(derive(null) === null, 'null input returns null');

// 6. Partial palette still yields a complete, non-empty theme via fallback.
const only = derive({ primary: P });
assert(only !== null, 'primary-only palette returns a theme');
assert(only['--ph-expression'] === P && only['--ph-root'] === P && only['--ph-radiance'] === P,
  'missing roles fall back to the available source');
assert(Object.values(only).every(v => v && v.length > 0), 'no token is empty on a partial palette');

if (failures) { console.error(`\n${failures} assertion(s) failed`); process.exit(1); }
console.log('\nAll palette role assertions passed.');
