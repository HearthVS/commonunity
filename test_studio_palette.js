/* Studio Palette — unit tests for the pure mood→colour mapping.
   Run: node --test test_studio_palette.js   (Node 20+, no dependencies) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const SP = require('./studio-palette.js');

test('extractHue reads OM Cipher OKLCH primaries', () => {
  assert.strictEqual(SP.extractHue('oklch(0.55 0.227 280)'), 280);
  assert.strictEqual(SP.extractHue('oklch(0.55 0.227 0)'), 0);
  assert.strictEqual(SP.extractHue('oklch(0.6 0.1 108)'), 108);
});

test('extractHue accepts hsl fallback and rejects junk', () => {
  assert.strictEqual(SP.extractHue('hsl(140, 50%, 40%)'), 140);
  assert.strictEqual(SP.extractHue('hsla(200 10% 10% / 1)'), 200);
  assert.strictEqual(SP.extractHue('not-a-colour'), null);
  assert.strictEqual(SP.extractHue(''), null);
  assert.strictEqual(SP.extractHue(null), null);
  assert.strictEqual(SP.extractHue(undefined), null);
});

test('extractHue wraps into 0..359', () => {
  assert.strictEqual(SP.extractHue('oklch(0.55 0.2 400)'), 40);
  assert.strictEqual(SP.extractHue('hsl(720, 1%, 1%)'), 0);
});

test('mapping is deterministic (pure function)', () => {
  const inp = { hue: 140, glow: 60, dark: 65, warm: 30 };
  assert.deepStrictEqual(SP.moodFilter(inp), SP.moodFilter(inp));
  assert.deepStrictEqual(SP.accentColor(inp), SP.accentColor(inp));
  assert.deepStrictEqual(SP.paletteRoles(140), SP.paletteRoles(140));
});

test('brightness is floored so a room is never crushed to near-black', () => {
  // Maximum "depth" must still leave the surface clearly readable.
  const darkest = SP.moodFilter({ hue: 220, glow: 50, dark: 100, warm: 0 });
  assert.strictEqual(darkest.brightness, SP.BRIGHTNESS_BOUNDS.min);
  assert.ok(darkest.brightness >= 0.82, 'brightness floor holds');
  const lightest = SP.moodFilter({ hue: 220, glow: 50, dark: 0, warm: 0 });
  assert.strictEqual(lightest.brightness, SP.BRIGHTNESS_BOUNDS.max);
  // Monotonic: more depth => not brighter.
  assert.ok(darkest.brightness <= lightest.brightness);
});

test('a single hue can only gently tint the surface (no full-page wash)', () => {
  // Even an extreme hue away from the baseline stays within the small rotate cap.
  for (const h of [0, 40, 108, 180, 260, 320, 359]) {
    const f = SP.moodFilter({ hue: h, glow: 50, dark: 50, warm: 100 });
    assert.ok(Math.abs(f.hueRotate) <= SP.HUE_ROTATE_MAX,
      `hueRotate ${f.hueRotate} within ±${SP.HUE_ROTATE_MAX} for hue ${h}`);
  }
});

test('accent luminance and chroma stay within rich-but-not-dark bounds', () => {
  for (let dark = 0; dark <= 100; dark += 10) {
    for (let glow = 0; glow <= 100; glow += 10) {
      const a = SP.accentColor({ hue: 140, glow, dark });
      assert.ok(a.l >= SP.LUMINANCE_BOUNDS.min && a.l <= SP.LUMINANCE_BOUNDS.max,
        `lightness ${a.l} within bounds (dark=${dark})`);
      assert.ok(a.c >= SP.CHROMA_BOUNDS.min && a.c <= SP.CHROMA_BOUNDS.max,
        `chroma ${a.c} within bounds (glow=${glow})`);
    }
  }
  // The deepest setting is still well above black.
  const deepest = SP.accentColor({ hue: 140, glow: 0, dark: 100 });
  assert.ok(deepest.l >= 0.48, 'accent never collapses toward black');
});

test('accent carries the chosen hue verbatim', () => {
  assert.strictEqual(SP.accentColor({ hue: 108, glow: 50, dark: 50 }).h, 108);
  assert.match(SP.accentColor({ hue: 108, glow: 50, dark: 50 }).css, /oklch\([\d.]+ [\d.]+ 108\)/);
});

test('legacy / out-of-range persisted slider values clamp safely', () => {
  // Old presets could store strings or out-of-range numbers; nothing should NaN.
  const f = SP.moodFilter({ hue: '999', glow: 999, dark: -50, warm: 'x' });
  assert.ok(isFinite(f.brightness) && isFinite(f.saturate) && isFinite(f.hueRotate));
  assert.strictEqual(f.brightness, SP.BRIGHTNESS_BOUNDS.max, 'dark<0 clamps to 0 -> brightest');
  assert.strictEqual(f.saturate, SP.SATURATE_BOUNDS.max, 'glow>100 clamps to 100');
  const a = SP.accentColor({ hue: '999', glow: 999, dark: -50 });
  assert.ok(a.l <= SP.LUMINANCE_BOUNDS.max && a.c <= SP.CHROMA_BOUNDS.max);
  // Empty input falls back to the neutral baseline without throwing.
  const n = SP.normalizeMood(undefined);
  assert.strictEqual(n.hue, SP.HUE_BASELINE);
});

test('paletteRoles mirror the OM Cipher role geometry (primary / +180 / +30)', () => {
  const r = SP.paletteRoles(100);
  assert.strictEqual(SP.extractHue(r.root), 100);
  assert.strictEqual(SP.extractHue(r.expression), 280); // +180
  assert.strictEqual(SP.extractHue(r.radiance), 130);   // +30
});
