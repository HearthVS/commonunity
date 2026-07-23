/* =================================================================
   Studio Palette — the shared, deterministic mapping from the stUdio
   "Colour" mood sliders + a room hue to a constrained set of applied
   colours.

   Two responsibilities (see also fieldprint-cipher-field.js and
   om_cipher_engine.py's `_build_palette`):

   1. moodFilter / accentColor — the global mood atmosphere + palette
      accent (borders / glows / links), held at controlled OKLCH so a
      person's OM Cipher hue reads as a rich accent, never a dark wash.

   2. roomSurfaces — per-room background ATMOSPHERE + panel surfaces so
      The Work / Lens / Field / Call are distinguishable by broad surface
      colour, not only accent strokes. Roles are derived from the room hue
      in OKLCH and separated (outer atmosphere / main background / raised
      panel / input / border) with midtone separation, so a single hue
      colours the room without flattening it. The "depth" slider re-maps
      onto real surface LIGHTNESS across a useful perceptual range, and a
      WCAG contrast floor keeps text readable on every surface.

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
  const lerp = (a, b, t) => a + (b - a) * t;
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

  // Per-room surface bounds. Lightness spans from a deep (never pure-black)
  // dark band up to a genuine midtone light band, so the "depth" slider offers
  // a materially lighter room — not just a slightly-less-dark one. Text stays
  // legible via adaptive room text tokens (light on the dark band, dark on the
  // light band); chroma stays a subtle tint on surfaces, richer on the field.
  const SURFACE_L_BOUNDS = { min: 0.09, max: 0.80 };
  const SURFACE_C_MAX = 0.10;
  // Reference light body text (studio --text) + the minimum WCAG contrast the
  // surfaces are held to. AA normal text is 4.5:1.
  const TEXT_REF_HEX = '#f1f5f9';
  const TEXT_CONTRAST_MIN = 4.5;
  // The two comfortable surface lightness bands the depth slider travels
  // between. They are adjacent (no slider value lands in the mid-luminance
  // "dead zone" ~0.42–0.57, where a raised text-bearing surface can hold AA
  // with neither near-white nor near-black text): the slider steps from the top
  // of the dark band straight to the bottom of the light band. Bands are sized
  // so bg+panel offsets keep every text-bearing surface out of the dead zone.
  const SURFACE_DARK_BAND = { lo: 0.11, hi: 0.33 };
  const SURFACE_LIGHT_BAND = { lo: 0.58, hi: 0.76 };
  // Fraction of the slider spent in the dark band (the rest is the light band).
  const SURFACE_BAND_SPLIT = 0.78;

  const ok = (l, c, h) => 'oklch(' + round3(clamp(l, 0, 1)).toFixed(3) + ' ' +
    round3(clamp(c, 0, SURFACE_C_MAX)).toFixed(3) + ' ' + wrapHue(h) + ')';

  /* ---- colour parsing ---------------------------------------------------- */

  function _parseHex(color) {
    if (typeof color !== 'string') return null;
    let s = color.trim();
    const m = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m) return null;
    s = m[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }

  function _rgbToHue(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return wrapHue(h * 60);
  }

  /* Pull the hue (degrees) out of a colour token. Accepts the OKLCH strings the
     OM Cipher engine emits ("oklch(0.55 0.227 280)"), hsl()/hsla(), and the
     hex semantic room tokens (--work/--lens/--field/--call). Returns 0..359 or
     null. */
  function extractHue(color) {
    if (typeof color !== 'string') return null;
    const oklch = color.match(/oklch\(\s*[\d.]+%?\s+[\d.]+%?\s+([\d.]+)/i);
    if (oklch) { const h = parseFloat(oklch[1]); if (isFinite(h)) return wrapHue(h); }
    const hsl = color.match(/hsla?\(\s*([\d.]+)/i);
    if (hsl) { const h = parseFloat(hsl[1]); if (isFinite(h)) return wrapHue(h); }
    const hex = _parseHex(color);
    if (hex) return _rgbToHue(hex.r, hex.g, hex.b);
    return null;
  }

  /* ---- luminance + WCAG contrast (for the surface contrast floor) -------- */

  function _srgbToLinear(c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function hexLuminance(hex) {
    const p = _parseHex(hex);
    if (!p) return 0;
    return 0.2126 * _srgbToLinear(p.r) + 0.7152 * _srgbToLinear(p.g) + 0.0722 * _srgbToLinear(p.b);
  }

  // OKLCH → linear sRGB (Ottosson) → relative luminance Y. Out-of-gamut
  // channels are clamped, which is fine for a luminance/contrast estimate.
  function oklchLuminance(l, c, h) {
    const hr = wrapHue(h) * Math.PI / 180;
    const a = c * Math.cos(hr), b = c * Math.sin(hr);
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
    const L3 = l_ * l_ * l_, M3 = m_ * m_ * m_, S3 = s_ * s_ * s_;
    let R = 4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
    let G = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
    let B = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3;
    R = clamp(R, 0, 1); G = clamp(G, 0, 1); B = clamp(B, 0, 1);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function contrast(y1, y2) {
    const hi = Math.max(y1, y2), lo = Math.min(y1, y2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Lower an OKLCH lightness (darken) until the surface clears the WCAG floor
  // against light body text. For light-on-dark, darkening only raises contrast,
  // so this always converges within the surface bounds.
  function _enforceTextContrast(l, c, h) {
    const textY = hexLuminance(TEXT_REF_HEX);
    let li = l;
    for (let i = 0; i < 60 && li > SURFACE_L_BOUNDS.min; i++) {
      if (contrast(oklchLuminance(li, c, h), textY) >= TEXT_CONTRAST_MIN) break;
      li = round3(li - 0.01);
    }
    return clamp(li, SURFACE_L_BOUNDS.min, SURFACE_L_BOUNDS.max);
  }

  // Contrast targets per text tier. Every tier — including muted and label
  // roles — clears the AA floor (4.5:1); the tiers differ only in headroom, so
  // hierarchy is expressed without dropping any normal-size text below AA.
  const TEXT_TIERS = { text: 7.5, muted: 5.5, faint: TEXT_CONTRAST_MIN + 0.2 };

  // Find the DIMMEST light-text lightness (lowest L) that still clears `target`
  // against the worst (lightest) text-bearing surface. Higher L => more contrast.
  function _solveLightL(surfaceY, hue, target) {
    let best = 0.995;
    for (let l = 0.995; l >= 0.55; l = round3(l - 0.005)) {
      if (contrast(oklchLuminance(l, 0.012, hue), surfaceY) >= target) best = l; else break;
    }
    return best;
  }

  // Find the DIMMEST dark-text lightness (highest L) that still clears `target`
  // against the worst (darkest) text-bearing surface. Lower L => more contrast.
  function _solveDarkL(surfaceY, hue, target) {
    let best = 0.08;
    for (let l = 0.08; l <= 0.55; l = round3(l + 0.005)) {
      if (contrast(oklchLuminance(l, 0.012, hue), surfaceY) >= target) best = l; else break;
    }
    return best;
  }

  // Build the room text set (text / muted / faint). On the dark band the tokens
  // are light and solved against the lightest text surface; on the light band
  // they are dark and solved against the darkest text surface. Every tier meets
  // AA; a faint hue tint keeps text in family with the room. `isDark` tells the
  // app whether to also override the primary --text (needed on the light band)
  // or leave it to the person's Text-brightness slider (dark band).
  function _roomTextTokens(bgY, panelRaisedY, hue, lightHolds) {
    const mk = (ll, c) => 'oklch(' + round3(clamp(ll, 0.05, 0.995)).toFixed(3) + ' ' +
      c.toFixed(3) + ' ' + wrapHue(hue) + ')';
    if (lightHolds) {
      // Light text; worst surface is the lightest (raised panel).
      return {
        text: mk(_solveLightL(panelRaisedY, hue, TEXT_TIERS.text), 0.010),
        textMuted: mk(_solveLightL(panelRaisedY, hue, TEXT_TIERS.muted), 0.012),
        textFaint: mk(_solveLightL(panelRaisedY, hue, TEXT_TIERS.faint), 0.014),
        isDark: false,
      };
    }
    // Dark text; worst surface is the darkest (background).
    return {
      text: mk(_solveDarkL(bgY, hue, TEXT_TIERS.text), 0.020),
      textMuted: mk(_solveDarkL(bgY, hue, TEXT_TIERS.muted), 0.016),
      textFaint: mk(_solveDarkL(bgY, hue, TEXT_TIERS.faint), 0.012),
      isDark: true,
    };
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

  /* Map the "depth" slider (0..1, where 1 = deepest) onto a real background
     lightness. Most of the travel sits in a tasteful dark band; near the light
     end it opens into a genuine midtone light band so "lighter" is lighter at a
     glance. The narrow transition crosses the mid-luminance dead zone quickly
     and never lands on a slider endpoint (0 / 0.5 / 1 all sit in a band). */
  function _depthToBgL(dark) {
    const t = 1 - dark; // light amount: 0 deepest .. 1 lightest
    const D = SURFACE_DARK_BAND, L = SURFACE_LIGHT_BAND, s = SURFACE_BAND_SPLIT;
    // Dark band, eased so the default (mid slider) stays tastefully deep and the
    // band only opens up as the slider nears the light end.
    if (t < s) return lerp(D.lo, D.hi, Math.pow(t / s, 1.8));
    // Light band — a genuine midtone, entered as a clean step over the dead zone.
    return lerp(L.lo, L.hi, (t - s) / (1 - s));
  }

  /* Per-room background atmosphere + panel surfaces, derived from a single
     room hue. Roles (outer atmosphere / main background / raised panel / input
     / border) are separated in OKLCH lightness so the room reads as a coloured
     ambient field around calmer, readable panels. The "depth" slider (dark)
     re-maps onto real surface LIGHTNESS across a wide perceptual range — from a
     deep room to a genuine midtone room. Text stays AA-legible via adaptive
     room text tokens: light body text on the dark band, a bounded dark text set
     on the light band (returned as text/textMuted/textFaint; null means the
     app's existing light text already clears AA and should be kept).

     input: { hue:0..360, dark:0..100, chroma?:0..1 } */
  function roomSurfaces(input) {
    input = (input && typeof input === 'object') ? input : {};
    const hue = wrapHue(num(input.hue, HUE_BASELINE));
    const dark = clamp(num(input.dark, 50), 0, 100) / 100;
    // chroma amount lets glow/vibrancy modulate tint strength; defaults mid.
    const chromaAmt = clamp(num(input.chroma, 0.55), 0, 1);

    // Main background lightness across the full dark→midtone range.
    const bgL = clamp(_depthToBgL(dark), SURFACE_L_BOUNDS.min, SURFACE_L_BOUNDS.max);
    const cl = (l) => clamp(l, SURFACE_L_BOUNDS.min, SURFACE_L_BOUNDS.max);

    // Chroma per role — subtle on reading surfaces, richer on the outer field.
    const bgC = clamp(0.030 * chromaAmt + 0.014, 0, SURFACE_C_MAX);
    const panelC = clamp(0.034 * chromaAmt + 0.014, 0, SURFACE_C_MAX);
    const atmosC = clamp(0.075 * chromaAmt + 0.020, 0, SURFACE_C_MAX);
    const borderC = clamp(0.050 * chromaAmt + 0.016, 0, SURFACE_C_MAX);

    // Lightness roles. Panels sit above the background for separation; the outer
    // atmosphere is the lightest field. No per-surface darkening is applied —
    // legibility is carried by the adaptive text tokens below, which lets the
    // light band stay genuinely light instead of being clamped back into dark.
    const atmosL = cl(bgL + 0.06);
    const panelL = cl(bgL + 0.05);
    const inputL = cl(bgL + 0.08);
    const panelRaisedL = cl(bgL + 0.09);
    const borderL = cl(bgL + 0.16);

    // Adaptive room text. On the dark band light text can hold AA, so the
    // primary --text is left to the person's Text-brightness slider; on the
    // light band it is overridden with dark text. Either way, muted and faint
    // tiers are solved per-depth so every normal-size text role (incl. labels)
    // clears the AA floor on every surface it can appear on.
    const textRefY = hexLuminance(TEXT_REF_HEX);
    const bgY = oklchLuminance(bgL, bgC, hue);
    const panelRaisedY = oklchLuminance(panelRaisedL, panelC, hue);
    const lightHolds = contrast(textRefY, bgY) >= TEXT_CONTRAST_MIN &&
                       contrast(textRefY, panelRaisedY) >= TEXT_CONTRAST_MIN;
    const textTok = _roomTextTokens(bgY, panelRaisedY, hue, lightHolds);

    const surfaces = {
      hue: hue,
      dark: input.dark == null ? 50 : clamp(num(input.dark, 50), 0, 100),
      atmos: ok(atmosL, atmosC, hue),
      bg: ok(bgL, bgC, hue),
      panel: ok(panelL, panelC, hue),
      panelRaised: ok(panelRaisedL, panelC, hue),
      input: ok(inputL, panelC, hue),
      border: ok(borderL, borderC, hue),
      // Room text set. muted/faint are always applied (AA-solved per depth);
      // the primary `text` is applied only on the light band (textIsDark), where
      // the person's light slider text can no longer hold AA — on the dark band
      // it is left to the slider but still available here for reference/tests.
      text: textTok.text,
      textMuted: textTok.textMuted,
      textFaint: textTok.textFaint,
      textIsDark: textTok.isDark,
      L: { bg: bgL, atmos: atmosL, panel: panelL, input: inputL, panelRaised: panelRaisedL, border: borderL },
      C: { bg: bgC, panel: panelC, atmos: atmosC, border: borderC },
    };
    // Broad coloured ambient field fading to the main background — the outer
    // atmosphere the panels sit inside.
    surfaces.atmosGradient =
      'radial-gradient(ellipse 120% 80% at 50% -10%, ' + surfaces.atmos + ' 0%, ' + surfaces.bg + ' 62%)';
    return surfaces;
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
    SURFACE_L_BOUNDS: SURFACE_L_BOUNDS,
    SURFACE_C_MAX: SURFACE_C_MAX,
    SURFACE_DARK_BAND: SURFACE_DARK_BAND,
    SURFACE_LIGHT_BAND: SURFACE_LIGHT_BAND,
    TEXT_REF_HEX: TEXT_REF_HEX,
    TEXT_CONTRAST_MIN: TEXT_CONTRAST_MIN,
    extractHue: extractHue,
    hexLuminance: hexLuminance,
    oklchLuminance: oklchLuminance,
    contrast: contrast,
    normalizeMood: normalizeMood,
    moodFilter: moodFilter,
    accentColor: accentColor,
    roomSurfaces: roomSurfaces,
    paletteRoles: paletteRoles,
  };
});
