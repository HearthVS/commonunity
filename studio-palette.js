/* =================================================================
   Studio Palette — the shared, deterministic mapping from the stUdio
   "Colour" mood sliders to a constrained set of applied colours.

   Purpose (see also fieldprint-cipher-field.js and om_cipher_engine.py's
   `_build_palette`): make the OM Cipher palette meaningful in stUdio while
   keeping outputs RICH but never overwhelmingly dark, and while keeping the
   surface/background separate from accents/borders/glows so a single hue can
   no longer flatten the whole interface into one dark wash.

   The palette supplies a HUE. Legibility comes from a stable surface + ink;
   atmosphere comes from a *bounded* body filter; identity comes from an
   accent held at a controlled OKLCH lightness/chroma. This mirrors the
   Fieldprint render philosophy (".phpub": palette TINTS a paper/ink base").

   DOM-free and side-effect-free so it can be unit-tested directly in Node
   and reused by the inline stUdio app without duplication.
   ================================================================= */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudioPalette = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (v, d) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : d;
  };
  const round2 = (n) => Math.round(n * 100) / 100;
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const wrapHue = (h) => ((Math.round(h) % 360) + 360) % 360;

  // The stUdio hue-slider baseline. hueRotate is measured from here so the
  // neutral slider position leaves the theme surfaces untouched (backward
  // compatible with the previous behaviour, which also pivoted on 220).
  const HUE_BASELINE = 220;

  // Bounds. These are the guarantees the tests pin: accents stay rich but
  // never near-black, chroma never washes to grey nor blows out, and the
  // global body filter can never darken the whole page into a monochrome wash.
  const LUMINANCE_BOUNDS = { min: 0.48, max: 0.70 };
  const CHROMA_BOUNDS = { min: 0.06, max: 0.17 };
  const BRIGHTNESS_BOUNDS = { min: 0.82, max: 1.10 };
  const SATURATE_BOUNDS = { min: 0.85, max: 1.35 };
  // A single hue can only gently tint the surface; identity is carried by the
  // accent, not by rotating every pixel. Kept small so backgrounds stay in
  // their theme (warm neutrals for B/C, cool for A) as cOMpass does.
  const HUE_ROTATE_MAX = 24;

  /* Pull the hue (degrees) out of a palette colour token. Accepts the OKLCH
     strings the OM Cipher engine emits ("oklch(0.55 0.227 280)") and an
     hsl()/hsla() fallback. Returns 0..359 or null. */
  function extractHue(color) {
    if (typeof color !== 'string') return null;
    const oklch = color.match(/oklch\(\s*[\d.]+%?\s+[\d.]+%?\s+([\d.]+)/i);
    if (oklch) { const h = parseFloat(oklch[1]); if (isFinite(h)) return wrapHue(h); }
    const hsl = color.match(/hsla?\(\s*([\d.]+)/i);
    if (hsl) { const h = parseFloat(hsl[1]); if (isFinite(h)) return wrapHue(h); }
    return null;
  }

  // Normalise raw slider inputs (0..360 hue, 0..100 for the rest) into 0..1
  // amounts, clamping any out-of-range/legacy persisted values safely.
  function normalizeMood(input) {
    input = (input && typeof input === 'object') ? input : {};
    return {
      hue: wrapHue(num(input.hue, HUE_BASELINE)),
      glow: clamp(num(input.glow, 50), 0, 100) / 100,
      dark: clamp(num(input.dark, 50), 0, 100) / 100,
      warm: clamp(num(input.warm, 0), 0, 100) / 100,
    };
  }

  /* Bounded body-filter atmosphere. brightness is floored so "depth" deepens
     the room without ever crushing it to near-black; saturate follows glow;
     warmth adds warmth via sepia; the hue only tints (small, clamped rotate). */
  function moodFilter(input) {
    const m = normalizeMood(input);
    const brightness = round2(clamp(
      BRIGHTNESS_BOUNDS.max - m.dark * (BRIGHTNESS_BOUNDS.max - BRIGHTNESS_BOUNDS.min),
      BRIGHTNESS_BOUNDS.min, BRIGHTNESS_BOUNDS.max));
    const saturate = round2(clamp(
      SATURATE_BOUNDS.min + m.glow * (SATURATE_BOUNDS.max - SATURATE_BOUNDS.min),
      SATURATE_BOUNDS.min, SATURATE_BOUNDS.max));
    const sepia = round2(clamp(m.warm * 0.38, 0, 0.38));
    const rawShift = (m.hue - HUE_BASELINE) * 0.3 + m.warm * 20;
    const hueRotate = Math.round(clamp(rawShift, -HUE_ROTATE_MAX, HUE_ROTATE_MAX));
    const css = [
      'brightness(' + brightness.toFixed(2) + ')',
      'saturate(' + saturate.toFixed(2) + ')',
      'hue-rotate(' + hueRotate + 'deg)',
      sepia > 0.01 ? 'sepia(' + sepia.toFixed(2) + ')' : '',
    ].filter(Boolean).join(' ');
    return { brightness, saturate, sepia, hueRotate, css };
  }

  /* The palette accent, held at a controlled OKLCH lightness/chroma so it
     reads as a rich accent (borders/glows/links) rather than a dark wash.
     lightness eases down with "depth" but is floored; chroma follows glow. */
  function accentColor(input) {
    const m = normalizeMood(input);
    const l = round3(clamp(
      LUMINANCE_BOUNDS.max - m.dark * (LUMINANCE_BOUNDS.max - LUMINANCE_BOUNDS.min),
      LUMINANCE_BOUNDS.min, LUMINANCE_BOUNDS.max));
    const c = round3(clamp(
      CHROMA_BOUNDS.min + m.glow * (CHROMA_BOUNDS.max - CHROMA_BOUNDS.min),
      CHROMA_BOUNDS.min, CHROMA_BOUNDS.max));
    return { l, c, h: m.hue, css: 'oklch(' + l.toFixed(3) + ' ' + c.toFixed(3) + ' ' + m.hue + ')' };
  }

  /* Standard palette ROLES from a single hue, mirroring the OM Cipher engine's
     `_build_palette` role geometry (primary / secondary +180 / accent +30) but
     pinned to the constrained stUdio lightness/chroma. Deterministic; provided
     so future stUdio surfaces can anchor to the same role set the Cipher uses. */
  function paletteRoles(hue) {
    const h = wrapHue(num(hue, HUE_BASELINE));
    const L = 0.55, C = 0.13;
    const role = (hh) => 'oklch(' + L.toFixed(2) + ' ' + C.toFixed(2) + ' ' + wrapHue(hh) + ')';
    return {
      root: role(h),
      expression: role(h + 180),
      radiance: role(h + 30),
    };
  }

  return {
    HUE_BASELINE: HUE_BASELINE,
    LUMINANCE_BOUNDS: LUMINANCE_BOUNDS,
    CHROMA_BOUNDS: CHROMA_BOUNDS,
    BRIGHTNESS_BOUNDS: BRIGHTNESS_BOUNDS,
    SATURATE_BOUNDS: SATURATE_BOUNDS,
    HUE_ROTATE_MAX: HUE_ROTATE_MAX,
    extractHue: extractHue,
    normalizeMood: normalizeMood,
    moodFilter: moodFilter,
    accentColor: accentColor,
    paletteRoles: paletteRoles,
  };
});
