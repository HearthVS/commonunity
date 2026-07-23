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

/* ---- roomSurfaces (Round 4: distinct per-room background + panels) ------- */

// The four stUdio room semantic colours (theme A --work/--lens/--field/--call).
const ROOM_HEXES = { work: '#f59e0b', lens: '#6366f1', field: '#10b981', call: '#f43f5e' };

test('extractHue reads the hex room tokens', () => {
  // Each room resolves to a different hue, which is what makes rooms distinct.
  const hues = Object.values(ROOM_HEXES).map((h) => SP.extractHue(h));
  hues.forEach((h) => assert.ok(h != null && h >= 0 && h < 360));
  assert.strictEqual(new Set(hues).size, 4, 'all four room hues are distinct');
});

test('each room paints a distinct, hue-carrying surface set', () => {
  const seen = new Set();
  for (const hex of Object.values(ROOM_HEXES)) {
    const hue = SP.extractHue(hex);
    const s = SP.roomSurfaces({ hue, dark: 50 });
    // Every surface role carries the room hue verbatim.
    for (const tok of [s.atmos, s.bg, s.panel, s.panelRaised, s.input, s.border]) {
      assert.strictEqual(SP.extractHue(tok), hue, `${tok} carries hue ${hue}`);
    }
    seen.add(s.bg);
  }
  assert.strictEqual(seen.size, 4, 'four rooms => four distinct backgrounds');
});

test('surfaces are role-separated (atmos/panels sit above the background)', () => {
  const s = SP.roomSurfaces({ hue: 210, dark: 50 });
  assert.ok(s.L.bg < s.L.atmos, 'atmosphere lighter than background');
  assert.ok(s.L.panel > s.L.bg, 'panel raised above background');
  assert.ok(s.L.panelRaised >= s.L.panel, 'raised panel >= panel');
  assert.ok(s.L.border > s.L.bg, 'border brighter than background');
});

test('depth slider spans dark → genuine midtone (materially, not weakly)', () => {
  const light = SP.roomSurfaces({ hue: 210, dark: 0 });
  const mid   = SP.roomSurfaces({ hue: 210, dark: 50 });
  const dark  = SP.roomSurfaces({ hue: 210, dark: 100 });
  // Monotonic: more depth => darker background.
  assert.ok(light.L.bg > mid.L.bg && mid.L.bg > dark.L.bg, 'monotonic darkening');
  // The lightest end is a genuine midtone atmosphere, not a slightly-less-dark
  // surface, and the span is materially obvious (not a weak filter).
  assert.ok(light.L.bg >= SP.SURFACE_LIGHT_BAND.lo, 'lightest end reaches the midtone light band');
  assert.ok(light.L.bg - dark.L.bg >= 0.30, 'materially obvious span across the slider');
  // The default (mid slider) stays tastefully deep, not garish.
  assert.ok(mid.L.bg <= SP.SURFACE_DARK_BAND.hi, 'default stays in the tasteful dark band');
});

// The effective main text luminance for a room: the app keeps its light body
// text where roomSurfaces returns null, otherwise it applies the dark tokens.
function effectiveTextY(surfaces, hue) {
  if (!surfaces.textIsDark) return SP.hexLuminance(SP.TEXT_REF_HEX);
  const m = surfaces.text.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/);
  return SP.oklchLuminance(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
}

// Luminance of a room text token (oklch string).
function tokenY(tok) {
  const m = tok.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/);
  return SP.oklchLuminance(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
}

test('every normal text tier (text/muted/faint) holds AA on every surface at EVERY depth', () => {
  // Not just endpoints and not just the primary tier: muted body text and label
  // roles must also clear the AA floor on bg / card / cardAlt / input, for all
  // four rooms, at every integer depth — with no mid-luminance dead zone.
  for (const hex of Object.values(ROOM_HEXES)) {
    const hue = SP.extractHue(hex);
    for (let d = 0; d <= 100; d++) {
      const s = SP.roomSurfaces({ hue, dark: d });
      const tiers = {
        text: effectiveTextY(s, hue),
        muted: tokenY(s.textMuted),
        faint: tokenY(s.textFaint),
      };
      // Each role renders with its own chroma (bg uses bgC; panels use panelC).
      const roles = {
        bg: [s.L.bg, s.C.bg],
        card: [s.L.panel, s.C.panel],
        cardAlt: [s.L.panelRaised, s.C.panel],
        input: [s.L.input, s.C.panel],
      };
      for (const [tier, ty] of Object.entries(tiers)) {
        for (const [role, [l, c]] of Object.entries(roles)) {
          const y = SP.oklchLuminance(l, c, hue);
          assert.ok(SP.contrast(ty, y) >= SP.TEXT_CONTRAST_MIN,
            `${tier} on ${role} AA (hue=${hue}, depth=${d}, dark-text=${s.textIsDark})`);
        }
      }
    }
  }
});

test('every surface stays within the constrained lightness/chroma bounds', () => {
  for (const hex of Object.values(ROOM_HEXES)) {
    const hue = SP.extractHue(hex);
    for (let dark = 0; dark <= 100; dark += 10) {
      const s = SP.roomSurfaces({ hue, dark });
      for (const [role, l] of Object.entries(s.L)) {
        assert.ok(l >= SP.SURFACE_L_BOUNDS.min && l <= SP.SURFACE_L_BOUNDS.max,
          `${role} L ${l} within surface bounds (dark=${dark})`);
      }
      for (const [role, c] of Object.entries(s.C)) {
        assert.ok(c >= 0 && c <= SP.SURFACE_C_MAX, `${role} C ${c} within chroma cap`);
      }
    }
  }
});

test('light body text is kept on the dark band and swapped for dark text on the light band', () => {
  // Dark endpoints keep the app's light --text (null override); the genuinely
  // light endpoint returns a bounded dark text set instead of clamping back.
  assert.strictEqual(SP.roomSurfaces({ hue: 210, dark: 100 }).textIsDark, false);
  assert.strictEqual(SP.roomSurfaces({ hue: 210, dark: 50 }).textIsDark, false);
  const light = SP.roomSurfaces({ hue: 210, dark: 0 });
  assert.strictEqual(light.textIsDark, true);
  // The dark text set carries real values and stays within a bounded range.
  for (const tok of [light.text, light.textMuted, light.textFaint]) {
    assert.match(tok, /^oklch\(/);
    assert.ok(SP.extractHue(tok) === 210, 'room text stays in family with the hue');
  }
});

test('roomSurfaces is deterministic and clamps legacy/persisted values', () => {
  const inp = { hue: 140, dark: 65, chroma: 0.4 };
  assert.deepStrictEqual(SP.roomSurfaces(inp), SP.roomSurfaces(inp));
  // Out-of-range / string inputs never NaN and stay within bounds.
  const s = SP.roomSurfaces({ hue: '999', dark: -50, chroma: 5 });
  for (const l of Object.values(s.L)) {
    assert.ok(isFinite(l) && l >= SP.SURFACE_L_BOUNDS.min && l <= SP.SURFACE_L_BOUNDS.max);
  }
  // Empty input falls back to the neutral baseline without throwing.
  const n = SP.roomSurfaces(undefined);
  assert.strictEqual(n.hue, SP.HUE_BASELINE);
  assert.ok(typeof n.atmosGradient === 'string' && n.atmosGradient.includes('radial-gradient'));
});
