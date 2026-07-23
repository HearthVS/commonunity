/* stUdio shell atmosphere — regression tests for Round 7 issue 1.

   Guards that the room atmosphere reaches the workspace SHELL, not only the
   scoped panels. Two layers:

   1. Palette layer (pure): roomSurfaces.atmosGradient — the broad background
      field the shell now consumes — is distinct per room hue and moves across
      the depth slider (light / default / deep), so the dominant field responds.

   2. Static wiring layer: applyRoomAtmosphere in studio.html scopes
      --bg-gradient onto the room shell ancestors (#screen-room / .room-body),
      and the formerly-fixed columns (.room-archive / .room-workbench) actually
      read var(--bg-gradient). Without both, the centre Field Observations
      backing and left rail keep the fixed navy theme gradient regardless of
      room or slider — the bug this round fixes.

   Run: node --test test_studio_shell_atmosphere.js   (Node 20+, no deps) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const SP = require('./studio-palette.js');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

// The four stUdio room semantic colours (theme A --work/--lens/--field/--call).
const ROOM_HEXES = { work: '#f59e0b', lens: '#6366f1', field: '#10b981', call: '#f43f5e' };
// Light / default / deep positions of the existing depth slider.
const DEPTHS = { light: 0, default: 50, deep: 100 };

/* ---- Palette layer: the broad field the shell now paints ---------------- */

test('atmosGradient carries each room hue verbatim (distinct field per room)', () => {
  const seen = new Set();
  for (const hex of Object.values(ROOM_HEXES)) {
    const hue = SP.extractHue(hex);
    const s = SP.roomSurfaces({ hue, dark: DEPTHS.default });
    assert.match(s.atmosGradient, /radial-gradient/, 'atmosGradient is a gradient');
    assert.strictEqual(SP.extractHue(s.atmosGradient), hue, 'gradient carries the room hue');
    seen.add(s.atmosGradient);
  }
  assert.strictEqual(seen.size, 4, 'four rooms => four distinct background fields');
});

test('atmosGradient moves across the depth slider for every room (light/default/deep)', () => {
  for (const hex of Object.values(ROOM_HEXES)) {
    const hue = SP.extractHue(hex);
    const light = SP.roomSurfaces({ hue, dark: DEPTHS.light });
    const def   = SP.roomSurfaces({ hue, dark: DEPTHS.default });
    const deep  = SP.roomSurfaces({ hue, dark: DEPTHS.deep });
    // Three slider positions must yield three distinct fields.
    const grads = new Set([light.atmosGradient, def.atmosGradient, deep.atmosGradient]);
    assert.strictEqual(grads.size, 3, `hue ${hue}: light/default/deep fields all differ`);
    // And the field genuinely lightens toward the light end (bg L monotonic).
    assert.ok(light.L.bg > def.L.bg && def.L.bg > deep.L.bg,
      `hue ${hue}: field lightness responds monotonically to depth`);
  }
});

/* ---- Static wiring layer: the shell actually consumes the field --------- */

// Pull the body of applyRoomAtmosphere's setTok closure for assertions.
function setTokBlock() {
  const fn = HTML.indexOf('function applyRoomAtmosphere');
  assert.ok(fn > -1, 'applyRoomAtmosphere must exist');
  const start = HTML.indexOf('const setTok', fn);
  assert.ok(start > -1, 'setTok closure must exist');
  const end = HTML.indexOf('};', start);
  return HTML.slice(start, end);
}

test('applyRoomAtmosphere scopes --bg-gradient onto the shell', () => {
  const block = setTokBlock();
  assert.match(block, /setProperty\('--bg-gradient',\s*surfaces\.atmosGradient\)/,
    'setTok must override --bg-gradient with the room atmosphere gradient');
});

test('applyRoomAtmosphere applies scoped tokens to both shell ancestors', () => {
  const fn = HTML.slice(HTML.indexOf('function applyRoomAtmosphere'),
                        HTML.indexOf('function doEnterRoom'));
  assert.match(fn, /setTok\(roomScreen\)/, 'tokens applied to #screen-room');
  assert.match(fn, /setTok\(document\.querySelector\('\.room-body'\)\)/,
    'tokens applied to .room-body (ancestor of the columns)');
});

test('the formerly-fixed columns read var(--bg-gradient) so the scope reaches them', () => {
  // Each column selector may appear in more than one rule (base + DAW layout);
  // at least one rule must paint the shared gradient for the scope to recolour it.
  for (const sel of ['.room-archive', '.room-workbench']) {
    let idx = HTML.indexOf(sel + ' {');
    assert.ok(idx > -1, `${sel} rule exists`);
    let consumes = false;
    while (idx > -1) {
      const rule = HTML.slice(idx, HTML.indexOf('}', idx));
      if (/background-image:\s*var\(--bg-gradient\)/.test(rule)) { consumes = true; break; }
      idx = HTML.indexOf(sel + ' {', idx + 1);
    }
    assert.ok(consumes,
      `${sel} must consume var(--bg-gradient) in some rule (so room scope recolours it)`);
  }
});
