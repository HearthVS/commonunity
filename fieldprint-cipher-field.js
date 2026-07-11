/* =================================================================
   Cipher Field — the one optional Arrival Portrait overlay treatment.

   A single, deterministic, privacy-safe field/geometry wash derived
   ONLY from public Fieldprint primitives: the three palette ROLES
   (root / expression / radiance) and the field hue + a stable seed.
   It NEVER receives birth data, Gene Keys, gate labels or mechanics —
   there is nothing sensitive to leak, by construction. No network, no
   generative call: the SVG is a pure function of its inputs.

   The module is DOM-free so it can be unit-tested directly in Node and
   reused later by a stUdio Digital Vista workflow without change. The
   persisted "recipe" is the source of truth a future workflow re-opens.
   ================================================================= */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CipherField = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const VERSION = 1;
  const TREATMENT = 'cipher-field';
  const OFF = 'off';
  const DEFAULT_INTENSITY = 0.5;

  /* ---- deterministic hash + PRNG (self-contained, mirrors fieldprint) ---- */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

  /* Only allow simple, safe colour tokens through into markup (oklch / hex /
     rgb / hsl / named). Anything else falls back so no arbitrary string can be
     injected into the SVG we render. */
  function safeColor(c, fallback) {
    c = (typeof c === 'string') ? c.trim() : '';
    return /^(#[0-9a-fA-F]{3,8}|oklch\([^)"'<>]*\)|rgba?\([^)"'<>]*\)|hsla?\([^)"'<>]*\)|[a-zA-Z]{3,20})$/.test(c)
      ? c : fallback;
  }

  /* Map the 0..1 intensity to a restrained layer opacity. Kept as a named
     helper so the builder (CSS var) and tests agree on the exact curve. The
     ceiling stays well under 1 so the treatment reads as art direction, never
     a heavy filter over a face. */
  function overlayOpacity(intensity) {
    return Math.round((0.1 + clamp01(num(intensity, DEFAULT_INTENSITY)) * 0.4) * 1000) / 1000;
  }

  /* Build the deterministic overlay SVG from public field primitives.
     input: { roles:{root,expression,radiance}, hue:Number, seed:String }
     Intensity is intentionally NOT baked in — it is applied as a single CSS
     opacity lever by the host — so this stays a pure function of the field. */
  function buildOverlaySvg(input) {
    input = input || {};
    const roles = (input.roles && typeof input.roles === 'object') ? input.roles : {};
    const root = safeColor(roles.root, 'oklch(0.55 0.05 260)');
    const expression = safeColor(roles.expression, 'oklch(0.6 0.05 80)');
    const radiance = safeColor(roles.radiance, 'oklch(0.55 0.05 318)');
    const hue = ((Math.round(num(input.hue, 80)) % 360) + 360) % 360;
    const seed = String(input.seed || 'om-field');

    const rnd = mulberry32(hashSeed(seed + '|' + TREATMENT + '|' + hue));

    // Anchor the densest field toward one off-centre corner so the centred
    // face and the hero copy region stay clear.
    const corners = [[16, 18], [84, 18], [82, 84], [18, 84]];
    const a = corners[Math.floor(rnd() * corners.length)];
    const ax = a[0], ay = a[1];

    // 2–3 torus-derived contour rings, drifting out from the anchor.
    const ringCount = 2 + Math.floor(rnd() * 2);
    const rings = [];
    let r = 20 + rnd() * 8;
    for (let i = 0; i < ringCount; i++) {
      rings.push({
        cx: ax + (rnd() * 12 - 6),
        cy: ay + (rnd() * 12 - 6),
        r: r,
        col: [root, expression, radiance][i % 3],
        sw: 0.5 + rnd() * 0.5,
      });
      r += 12 + rnd() * 10;
    }

    // A single restrained arc (torus meridian) sweeping past the anchor.
    const arcR = 34 + rnd() * 10;
    const arcSweep = rnd() > 0.5 ? 1 : 0;
    const arc = 'M ' + f2(ax - arcR * 0.7) + ' ' + f2(ay + arcR * 0.2) +
      ' A ' + f2(arcR) + ' ' + f2(arcR) + ' 0 0 ' + arcSweep + ' ' +
      f2(ax + arcR * 0.6) + ' ' + f2(ay - arcR * 0.7);

    const ringMarkup = rings.map((g) =>
      '<circle cx="' + f2(g.cx) + '" cy="' + f2(g.cy) + '" r="' + f2(g.r) +
      '" fill="none" stroke="' + g.col + '" stroke-width="' + f2(g.sw) +
      '" stroke-opacity="0.5"/>').join('');

    // face-safe luminance mask: transparent (black) at centre, revealing
    // (white) toward the edges, so nothing paints over the face.
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<radialGradient id="cf-field" cx="' + f2(ax) + '%" cy="' + f2(ay) + '%" r="82%">' +
      '<stop offset="0%" stop-color="' + radiance + '" stop-opacity="0.55"/>' +
      '<stop offset="42%" stop-color="' + expression + '" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="' + root + '" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="cf-safe" cx="50%" cy="42%" r="60%">' +
      '<stop offset="0%" stop-color="#000"/>' +
      '<stop offset="48%" stop-color="#000"/>' +
      '<stop offset="100%" stop-color="#fff"/>' +
      '</radialGradient>' +
      '<mask id="cf-mask"><rect x="0" y="0" width="100" height="100" fill="url(#cf-safe)"/></mask>' +
      '</defs>' +
      '<g mask="url(#cf-mask)">' +
      '<rect x="0" y="0" width="100" height="100" fill="url(#cf-field)"/>' +
      ringMarkup +
      '<path d="' + arc + '" fill="none" stroke="' + radiance + '" stroke-width="0.6" stroke-opacity="0.45"/>' +
      '</g></svg>';
  }

  /* ---- recipe: the persisted, future-compatible source of truth ---- */
  function defaultRecipe() {
    return { treatment: OFF, version: VERSION, intensity: DEFAULT_INTENSITY, palette: 'om-field' };
  }

  // Normalise any stored/foreign recipe into a safe, current-shape recipe.
  // Unknown treatments collapse to OFF so a future stUdio-authored recipe
  // never renders an overlay this build cannot draw.
  function normalizeRecipe(r) {
    r = (r && typeof r === 'object') ? r : {};
    const treatment = (r.treatment === TREATMENT) ? TREATMENT : OFF;
    return {
      treatment: treatment,
      version: (typeof r.version === 'number' && isFinite(r.version)) ? r.version : VERSION,
      intensity: clamp01(num(r.intensity, DEFAULT_INTENSITY)),
      palette: (typeof r.palette === 'string' && r.palette) ? r.palette : 'om-field',
    };
  }

  function isOn(recipe) { return !!recipe && recipe.treatment === TREATMENT; }

  return {
    VERSION: VERSION,
    TREATMENT: TREATMENT,
    OFF: OFF,
    DEFAULT_INTENSITY: DEFAULT_INTENSITY,
    hashSeed: hashSeed,
    buildOverlaySvg: buildOverlaySvg,
    overlayOpacity: overlayOpacity,
    defaultRecipe: defaultRecipe,
    normalizeRecipe: normalizeRecipe,
    isOn: isOn,
  };
});
