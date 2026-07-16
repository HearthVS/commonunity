/* =================================================================
   Fieldprint — CommonUnity Studio public-hOMepage surface (v5 port).
   In-memory state only. No storage APIs (no localStorage / cookies).
   Flow is one-directional: state -> apply()/render().

   Studio adapter contract
   -----------------------
   This surface runs inside a same-origin iframe embedded in studio.html.
   It NEVER runs the OM Cipher engine and never sees raw birth data, Gene
   Keys, or mechanics. Studio runs the engine, builds the sanitized public
   model (phPublicHomeModel → { identity, hero, rooms, invitation, palette
   roles, cipher: scrubbed svg + crop, transition, ... }) and posts it in.
   Only public-safe assets cross the seam:
     - the three palette ROLES (root / expression / radiance)
     - a deterministic Cipher SVG already scrubbed of gate labels / data-*
     - user-approved, visibility:public section images (src is data:/https)
   Nothing sensitive is ever written to the DOM the visitor sees.

   With no model posted (e.g. opened directly), it renders a birth-data-free
   static demo field built from placeholder marks so the surface is never
   blank — clearly labelled as a demo in the panel.
   ================================================================= */
(function () {
  'use strict';

  /* ---------- the four public sections (fallback demo copy) ---------- */
  const SECTION_KEYS = ['make', 'perceive', 'alive', 'here'];
  const SECTIONS = [
    {
      key: 'make', sig: 'make',
      eyebrow: 'What I make',
      title: 'Quiet systems for shared understanding',
      body: 'I design tools that lower the temperature of hard conversations. Structures that hold many voices without flattening them — where the goal is not to win, but to be understood, and to understand in return.',
      role: 'side',
      enter: 'Step into the workshop',
      narrative: 'This is where the work is actually made. Not pitches or roadmaps — the instruments themselves: the small structures that let a group of people stay in the same conversation long enough to change their minds.',
      artifacts: [
        { tag: 'Instrument', title: 'Consensus loom', note: 'A weaving surface where many positions become one legible fabric — without erasing the threads.' },
        { tag: 'Instrument', title: 'Temperature dial', note: 'A live read of how hot a conversation is running, so a room can cool itself before it breaks.' },
        { tag: 'Method', title: 'Slow-release notes', note: 'Change introduced at the speed a community can metabolise it — never faster.' },
      ],
      prompt: 'What would you need built to be understood?',
    },
    {
      key: 'perceive', sig: 'perceive',
      eyebrow: 'How I perceive',
      title: 'Patterns before positions',
      body: 'I notice the shape of a room before its arguments. Tension, rhythm, the thing left unsaid. I trust slow attention over fast opinion, and I build for the person who is quietly overwhelmed rather than the loudest in the thread.',
      role: 'inset',
      enter: 'Enter the observatory',
      narrative: 'Perception here is a discipline, not a mood. Before a single feature is drawn I sit with the field: who speaks, who withdraws, where the current runs under the words.',
      artifacts: [
        { tag: 'Reading', title: 'The room before the argument', note: 'Shape, tension and rhythm noticed before any position is taken.' },
        { tag: 'Reading', title: 'The quietly overwhelmed', note: 'Designing for the person at the edge of the thread, not its loudest centre.' },
        { tag: 'Practice', title: 'Slow attention', note: 'Trusting the reading that only arrives after the urge to respond has passed.' },
      ],
      prompt: 'What in your field goes unnoticed?',
    },
    {
      key: 'alive', sig: 'alive',
      eyebrow: 'What keeps me alive',
      title: 'Craft, walks, and the long game',
      body: 'Long walks with no destination. A sentence that finally lands. The moment a system stops fighting the people using it. I stay alive in the space between rigor and warmth — and I refuse to give up either one.',
      role: 'bleed',
      enter: 'Walk into the long game',
      narrative: 'Endurance is its own craft. What keeps me alive is not intensity but rhythm — the walk with no destination, the sentence that finally lands, the system that stops fighting the people using it.',
      artifacts: [
        { tag: 'Ritual', title: 'Walks with no destination', note: 'Movement that lets a stuck idea unclench itself.' },
        { tag: 'Ritual', title: 'The sentence that lands', note: 'The small, exact win that makes a long project survivable.' },
        { tag: 'Value', title: 'Rigor and warmth, both', note: 'Refusing the trade most work asks you to make between the two.' },
      ],
      prompt: 'What keeps you in the long game?',
    },
    {
      key: 'here', sig: 'here',
      eyebrow: "What I'm here for",
      title: 'To make belonging buildable',
      body: 'Community is not a feeling you wait for — it is something you can compose, section by section, with care. I am here to give that work better instruments, and to prove that restraint and depth can share the same page.',
      role: 'none',
      enter: 'Cross into the purpose',
      narrative: 'This is the far room — the reason the others exist. Belonging is treated here not as a feeling you wait for but as something you can compose, section by section, with care.',
      artifacts: [
        { tag: 'Intent', title: 'Belonging, composed', note: 'Built deliberately rather than hoped for.' },
        { tag: 'Intent', title: 'Better instruments', note: 'Handing the work of community sharper, kinder tools.' },
        { tag: 'Proof', title: 'Restraint and depth together', note: 'One page can hold both; this whole field is the argument.' },
      ],
      prompt: 'What are you here for?',
    },
  ];

  /* automatic layout role per section signature (used when sigmode = auto) */
  const AUTO_ROLE = { make: 'side', perceive: 'inset', alive: 'bleed', here: 'none' };
  const SIG_LABEL = {
    make: 'Maker rhythm · sharper structure',
    perceive: 'Soft field · orbital lines · spacious type',
    alive: 'Warm tactile band · intimate spacing',
    here: 'Clear signal · stronger contrast',
  };

  /* Public image-display roles (match the sanitized model's phPublicRoomImage
     vocabulary). Each maps to a v5 layout role for section composition. */
  const ROLE_META = [
    { value: 'inset', name: 'Inset' },
    { value: 'full-bleed', name: 'Full-bleed' },
    { value: 'background', name: 'Background' },
    { value: 'artifact', name: 'Artifact' },
  ];
  const IMG_LAYOUT = {
    inset: 'inset', 'full-bleed': 'bleed', background: 'bleed',
    artifact: 'side', hero: 'bleed', none: 'none',
  };

  const PAL_NAME = {
    'om-field': 'OM field — live roles from the Cipher engine',
    'om-dawn': 'OM dawn — warm neutral light',
    'om-deep': 'OM deep field — night, brass + slate',
    'om-ember': 'OM ember — warm tactile earth',
    'om-signal': 'OM clear signal — bright, teal signal',
  };

  const DEFAULT_ROLES = {
    root: 'oklch(0.55 0.227 260)',
    expression: 'oklch(0.55 0.227 80)',
    radiance: 'oklch(0.55 0.204 318)',
  };

  /* graphic-overlay sources + the short, readable blend set */
  const OVERLAY_SOURCES = ['off', 'cipher', 'torus', 'upload'];
  const OVERLAY_BLENDS = ['normal', 'multiply', 'screen', 'soft-light'];

  /* ---------- in-memory state ---------- */
  const state = {
    seed: 'om-field',
    fieldIdx: 0,
    cipher: 'placeholder',   // 'engine' once a scrubbed model svg is hydrated
    intensity: 'balanced',
    sigil: 'mark',
    torus: 'subtle',
    texture: 'subtle',       // off / subtle / inside / wallpaper
    transition: 'fade',      // none / fade / threshold
    hero: 'contained',
    palette: 'om-field',
    photo: 'warm',
    sigmode: 'auto',
    name: 'Markus Lehto',
    tagline: 'I build quiet systems that help people understand each other.',
    heroCta: 'enter the field',
    eyebrow: 'CommonUnity',
    heroPhoto: '',
    heroAlt: '',
    heroPhotoHasAlpha: false,
    heroFocalX: 50,
    heroFocalY: 50,
    heroZoom: 100,           // portrait zoom % (100 = no zoom; framing a face)
    heroFadeMode: 'none',
    heroFadeStrength: 0.6,
    heroOverlay: 'off',      // Cipher Field treatment: 'off' | 'cipher-field'
    heroOverlayIntensity: 0.5,
    // Arrival intro (identity sentence) sizing. Auto fits the sentence to the
    // available box; manual exposes an explicit size. Width is the text measure.
    introFit: 'auto',        // auto / manual
    introWidth: 26,          // text-box measure (ch)
    introSize: 22,           // manual font size (px), bounded 15..40
    // Manual arrival GRAPHIC OVERLAY — a static layer distinct from the portrait,
    // the field background and the text. Never a live Canvas loop. Uploaded art is
    // held on-device only (never posted to the published model).
    overlay: {
      source: 'off',        // off / cipher / torus / upload
      src: '',              // sanitized data-URL when source === 'upload'
      x: 50, y: 42,         // position (% of stage, centre-anchored)
      scale: 62,            // box width (% of stage width), 10..100
      opacity: 0.9,         // 0..1
      blend: 'normal',      // normal / multiply / screen / soft-light
      rotate: 0,            // degrees, -180..180
    },
    roleOverrides: { root: null, expression: null, radiance: null },
    sections: SECTIONS.map((s) => ({ ...s, image: null, imgRole: null, textSize: 'medium' })),
    view: 'desktop',
    route: { view: 'overview', roomIdx: 0 },
    hydrated: false,
  };

  /* manual Cipher-texture adjustments (from the zoom / opacity sliders) */
  let manualZoom = 420;       // % mask-size for inside-crop
  let manualOpacity = 0.2;    // 0..1

  /* ---------- element refs ---------- */
  const $ = (id) => document.getElementById(id);
  const viz = $('viz');
  const vizBody = $('vizBody');
  const vizRoom = $('vizRoom');
  const vizName = $('vizName');
  const vizTag = $('vizTag');
  const vizHeroCta = $('vizHeroCta');
  const vizEyebrowText = $('vizEyebrowText');
  const vizFootName = $('vizFootName');
  const sectionCopyControls = $('sectionCopyControls');
  const roomImageControls = $('roomImageControls');
  const stage = document.querySelector('.stage');
  const stageState = $('stageState');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const embedded = (function () { try { return window.parent && window.parent !== window; } catch (_) { return false; } })();

  /* ---------- deterministic hash + PRNG ---------- */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
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

  /* current field (in-memory only; hydrated from the sanitized model) */
  let field = null;

  /* A birth-data-free placeholder field so the surface is never blank before a
     real model arrives (standalone demo, or Studio pre-handshake). Uses only a
     seed + generated sigil — no engine, no personal data. */
  function buildDemoField() {
    const hue = hashSeed(state.seed) % 360;
    field = {
      seedLabel: state.seed,
      roles: DEFAULT_ROLES,
      primaryHue: hue,
      secondaryHue: (hue + 180) % 360,
      points: 9,
      lifePath: 2,
      radial: makeSigil('om-field|' + state.seed, 0, { size: 200, stroke: 1.6 }),
      crop: null,
    };
    state.cipher = 'placeholder';
  }

  /* ---------- SVG helpers (public-safe) ---------- */
  function scrubSvg(svg) {
    return String(svg || '')
      .replace(/<text[\s\S]*?<\/text>/g, '')
      .replace(/\sdata-(?:radiance-)?gate="[^"]*"/g, '')
      .replace(/\sdata-axis="[^"]*"/g, '');
  }
  function sizeSvg(svg, size) {
    return String(svg || '').replace(/(<svg\b[^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
      `$1 width="${size}" height="${size}"`);
  }
  function monoSvg(svg) {
    return String(svg || '').replace(/oklch\([^)]*\)/g, 'currentColor');
  }

  /* ---------- graphic overlay: safe sources ---------- */
  // Encode an SVG string as a data URL for an <img> (script-inert context).
  function svgToDataUrl(svg) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(String(svg || ''));
  }
  // A static, deterministic torus graphic (no Canvas, no animation) drawn from
  // the live role colours — an optional member of the CommonUnity graphic family.
  function torusOverlaySvg() {
    const c1 = toHex(activeRoleColor('radiance'));
    const c2 = toHex(activeRoleColor('expression'));
    const c3 = toHex(activeRoleColor('root'));
    let rings = '';
    for (let i = 0; i < 9; i++) {
      const rx = 122 - i * 11, ry = rx * 0.46, op = (0.5 - i * 0.045).toFixed(2);
      rings += `<ellipse cx="140" cy="140" rx="${rx}" ry="${ry}" fill="none" stroke="${i % 2 ? c2 : c1}" stroke-width="1.5" opacity="${op}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" width="280" height="280">`
      + `<defs><radialGradient id="tg" cx="50%" cy="42%" r="62%">`
      + `<stop offset="0%" stop-color="${c1}" stop-opacity="0.55"/>`
      + `<stop offset="55%" stop-color="${c2}" stop-opacity="0.18"/>`
      + `<stop offset="100%" stop-color="${c3}" stop-opacity="0"/></radialGradient></defs>`
      + `<circle cx="140" cy="140" r="130" fill="url(#tg)"/>`
      + `<g transform="rotate(-18 140 140)">${rings}</g></svg>`;
  }
  // Strip anything executable/external from an uploaded SVG payload. The overlay
  // is only ever rendered through an <img>, which already neutralises scripts;
  // this is defence in depth so nothing active survives even that.
  function scrubOverlaySvg(svgText) {
    return String(svgText || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/(?:xlink:href|href)\s*=\s*"(?!#)[^"]*"/gi, '')
      .replace(/(?:xlink:href|href)\s*=\s*'(?!#)[^']*'/gi, '');
  }
  // Overlay uploads accept PNG / WebP / SVG only. SVG payloads are scrubbed and
  // re-encoded; raster payloads pass through the shared data-URL allowlist.
  function safeOverlaySrc(dataUrl) {
    const s = (typeof dataUrl === 'string') ? dataUrl.trim() : '';
    if (/^data:image\/svg\+xml/i.test(s)) {
      let payload = s.replace(/^data:image\/svg\+xml[^,]*,/i, '');
      const isB64 = /;base64/i.test(s.slice(0, s.indexOf(',')));
      let text;
      try { text = isB64 ? atob(payload) : decodeURIComponent(payload); }
      catch (_) { try { text = decodeURIComponent(payload); } catch (__) { return ''; } }
      if (!/<svg[\s\S]*<\/svg>/i.test(text)) return '';
      return svgToDataUrl(scrubOverlaySvg(text));
    }
    return /^data:image\/(png|webp);/i.test(s) ? s : '';
  }

  /* the active Cipher SVG (single source: the scrubbed model mark or none) */
  function cipherSvg() {
    return field ? (field.radial || null) : null;
  }

  function markSvg(size, opts) {
    opts = opts || {};
    if (state.cipher === 'placeholder' || !field) {
      return makeSigil(state.seed, opts.variant || 0, { size: size, stroke: opts.stroke || 1.6 });
    }
    let svg = cipherSvg();
    if (!svg) return makeSigil(state.seed, opts.variant || 0, { size: size, stroke: opts.stroke || 1.6 });
    if (opts.mono) svg = monoSvg(svg);
    svg = sizeSvg(svg, size);
    if (opts.rotate) svg = svg.replace(/<svg\b/, `<svg style="transform:rotate(${opts.rotate}deg)"`);
    return svg;
  }

  function watermarkSvg() {
    if (state.cipher === 'placeholder' || !field) return makeWatermark(state.seed);
    const svg = cipherSvg();
    return svg ? sizeSvg(svg, 320) : makeWatermark(state.seed);
  }

  /* apply live OM-field palette roles as CSS custom properties on the viz. */
  function applyFieldPalette() {
    const clear = ['--bg', '--surface', '--fg', '--muted', '--faint', '--line',
      '--accent', '--accent-2', '--field-a', '--field-b', '--field-c',
      '--portrait-a', '--portrait-b', '--portrait-c'];
    if (state.palette !== 'om-field' || !field) {
      clear.forEach((p) => viz.style.removeProperty(p));
      return;
    }
    const hue = field.primaryHue;
    const hue2 = field.secondaryHue;
    const set = {
      '--bg': `oklch(0.965 0.018 ${hue})`,
      '--surface': `oklch(0.93 0.03 ${hue})`,
      '--fg': `oklch(0.28 0.045 ${hue})`,
      '--muted': `oklch(0.5 0.04 ${hue})`,
      '--faint': `oklch(0.68 0.03 ${hue})`,
      '--line': `oklch(0.88 0.03 ${hue})`,
      '--accent': `oklch(0.55 0.16 ${hue})`,
      '--accent-2': `oklch(0.6 0.14 ${hue2})`,
      '--field-a': `oklch(0.9 0.05 ${hue})`,
      '--field-b': `oklch(0.72 0.12 ${hue})`,
      '--field-c': `oklch(0.5 0.14 ${hue2})`,
      '--portrait-a': `oklch(0.82 0.07 ${hue})`,
      '--portrait-b': `oklch(0.6 0.1 ${hue})`,
      '--portrait-c': `oklch(0.4 0.1 ${hue2})`,
    };
    Object.keys(set).forEach((p) => viz.style.setProperty(p, set[p]));
    const chips = $('fieldPalChips');
    if (chips) {
      const c = chips.querySelectorAll('i');
      if (c[0]) c[0].style.background = activeRoleColor('root');
      if (c[1]) c[1].style.background = activeRoleColor('expression');
      if (c[2]) c[2].style.background = activeRoleColor('radiance');
    }
  }

  /* =========================================================
     TORUS FIELD — deterministic canvas keyed to the field
     ========================================================= */
  let torusCanvas = null;
  let torusRaf = 0;
  let torusLastInteract = 0;
  let torusPoints = null;
  let activeNodeIdx = -1;
  let torusVisible = true;      // set false by IntersectionObserver when offscreen
  let torusPaintAt = 0;         // last painted frame timestamp (fps throttle)
  let wakeRaf = 0;              // coalesces restart requests from wake events
  const IDLE_SLEEP_MS = 4000;   // stop the loop 4s after the last interaction
  const TORUS_FPS = 30;
  const TORUS_FRAME_MS = 1000 / TORUS_FPS;
  const NT = 30, NP = 12;       // ~360–420 points — the visual minimum that still reads as a torus

  function ensureTorusCanvas() {
    const host = $('fieldTorus');
    if (!host) return null;
    if (!torusCanvas) {
      torusCanvas = document.createElement('canvas');
      torusCanvas.className = 'fieldtorus-canvas';
      host.appendChild(torusCanvas);
    }
    return torusCanvas;
  }
  /* the active colour for a palette role — a user override (hex) wins, else the
     Cipher-derived role colour, else a neutral fallback. */
  function activeRoleColor(which) {
    const ov = state.roleOverrides && state.roleOverrides[which];
    if (ov) return ov;
    return field ? field.roles[which] : DEFAULT_ROLES[which];
  }
  /* Parse a role colour ONCE and return an alpha→string shader, so a hot draw
     loop can vary opacity without re-parsing the base colour per call. */
  function roleShader(which) {
    const base = activeRoleColor(which);
    const h = base ? String(base).trim() : '';
    if (h[0] === '#') {
      const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
      if (isFinite(r) && isFinite(g) && isFinite(b)) return (a) => `rgba(${r},${g},${b},${a})`;
    }
    if (/\)$/.test(h)) { const pre = h.slice(0, -1); return (a) => `${pre} / ${a})`; }
    return (a) => `rgba(150,140,110,${a})`;
  }
  /* normalize any CSS colour (oklch / rgb / hex / name) to #rrggbb for the
     native colour inputs, via computed style. */
  function toHex(color) {
    try {
      const d = document.createElement('div');
      d.style.color = String(color || '');
      d.style.display = 'none';
      document.body.appendChild(d);
      const cs = getComputedStyle(d).color;
      document.body.removeChild(d);
      const m = cs && cs.match(/\d+(\.\d+)?/g);
      if (!m || m.length < 3) return '#888888';
      return '#' + m.slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('');
    } catch (_) { return '#888888'; }
  }
  function bakeTorusPoints() {
    const pts = [];
    const dens = field ? (field.points % 5) : 2;
    const np = NP + dens;
    for (let i = 0; i < NT; i++) {
      const theta = (i / NT) * Math.PI * 2;
      for (let j = 0; j < np; j++) {
        const phi = (j / np) * Math.PI * 2;
        const ct = Math.cos(theta), st = Math.sin(theta);
        const cp = Math.cos(phi), sp = Math.sin(phi);
        pts.push({ x: (1 + cp) * ct, y: sp, z: (1 + cp) * st, equator: Math.abs(sp) < 0.16, theta: theta });
      }
    }
    torusPoints = pts;
  }
  // Refresh the keep-alive timestamp (cheap) on every interaction, but coalesce
  // any actual (re)start of the loop into a single rAF so a burst of pointermove
  // / scroll events can't thrash drawFieldTorus.
  function wakeTorus() {
    torusLastInteract = performance.now();
    if (torusRaf || wakeRaf || !shouldAnimateTorus()) return;
    wakeRaf = requestAnimationFrame(() => { wakeRaf = 0; if (!torusRaf && shouldAnimateTorus()) drawFieldTorus(); });
  }
  function shouldAnimateTorus() {
    return state.transition === 'threshold' && state.torus !== 'off' &&
      !reduceMotion && !document.hidden && torusVisible;
  }
  function stopTorus() {
    if (torusRaf) { cancelAnimationFrame(torusRaf); torusRaf = 0; }
    if (wakeRaf) { cancelAnimationFrame(wakeRaf); wakeRaf = 0; }
  }
  function drawFieldTorus() {
    const cv = ensureTorusCanvas();
    if (!cv) return;
    if (torusRaf) { cancelAnimationFrame(torusRaf); torusRaf = 0; }
    const ctx0 = cv.getContext('2d');
    if (state.torus === 'off') { ctx0 && ctx0.clearRect(0, 0, cv.width, cv.height); return; }
    if (!torusPoints) bakeTorusPoints();

    // Parse each role colour ONCE per (re)start into a cheap shader closure, so
    // the per-point inner loop only does a string concat instead of re-parsing.
    const shade = { root: roleShader('root'), expression: roleShader('expression'), radiance: roleShader('radiance') };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const host = cv.parentElement;
    const w = host.clientWidth || 900;
    const fullH = host.clientHeight || 900;
    const h = Math.min(fullH, Math.max(760, w * 1.05));
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w * 0.5, cy = h * 0.42;
    const scale = Math.min(w, h) * 0.30;
    const FOV = 620, Z_OFF = 3.0;
    const tilt = 0.34 + ((field ? field.lifePath : 2) % 6) * 0.05;
    const spin0 = (field ? field.primaryHue : 80) * Math.PI / 180;
    const hue = field ? field.primaryHue : 80;

    const breathing = shouldAnimateTorus();
    if (breathing && !torusLastInteract) torusLastInteract = performance.now();
    const levelAlpha = state.torus === 'subtle' ? 0.42 : state.torus === 'atmospheric' ? 0.72 : 1;
    const nodeThetas = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

    function render(t) {
      // Re-check liveness every frame (covers tab hidden / offscreen / torus
      // toggled off mid-loop) and schedule the next frame BEFORE painting so a
      // throttled (skipped) frame can't kill the loop.
      torusRaf = 0;
      const animating = shouldAnimateTorus() && (performance.now() - torusLastInteract < IDLE_SLEEP_MS);
      if (animating) torusRaf = requestAnimationFrame(render);
      // Cap paint rate to ~30fps — drop frames that arrive inside the budget.
      if (animating && t - torusPaintAt < TORUS_FRAME_MS) return;
      torusPaintAt = t;

      ctx.clearRect(0, 0, w, h);
      const spin = spin0 + (breathing ? t * 0.00007 : 0);
      const breath = breathing ? (1 + Math.sin(t * 0.0009) * 0.025) : 1;
      const cosS = Math.cos(spin), sinS = Math.sin(spin);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const s = scale * breath;

      const g = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 2.4);
      g.addColorStop(0, shade.expression(0.16 * levelAlpha));
      g.addColorStop(0.45, shade.root(0.06 * levelAlpha));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Single pass: project + draw in baked order. No per-frame array alloc and
      // no depth sort — at these alphas the painter's ordering is imperceptible.
      const zmin = 1.0, zmax = 5.0;
      for (let k = 0; k < torusPoints.length; k++) {
        const P = torusPoints[k];
        const x = P.x * cosS - P.z * sinS;
        const zr = P.x * sinS + P.z * cosS;
        const y0 = P.y;
        const z2 = y0 * sinT + zr * cosT + Z_OFF;
        const y = y0 * cosT - zr * sinT;
        const f = FOV / (FOV + z2 * scale);
        const dn = 1 - Math.min(1, Math.max(0, (z2 - zmin) / (zmax - zmin)));
        const a = (0.05 + dn * 0.22) * levelAlpha;
        const shader = (k % 3 === 0) ? shade.radiance : (k % 3 === 1) ? shade.expression : shade.root;
        ctx.beginPath();
        ctx.arc(cx + x * s * f, cy + y * s * f, (1.4 + dn * 2.6) * f, 0, Math.PI * 2);
        ctx.fillStyle = shader(a);
        ctx.fill();
      }

      for (let n = 0; n < 4; n++) {
        const th = nodeThetas[n];
        let x = 2 * Math.cos(th), z = 2 * Math.sin(th), y = 0;
        const rx = x * cosS - z * sinS; const rz = x * sinS + z * cosS;
        const ry = y * cosT - rz * sinT; const rz2 = y * sinT + rz * cosT + Z_OFF;
        const f = FOV / (FOV + rz2 * scale);
        const nx = cx + rx * s * f, ny = cy + ry * s * f;
        const on = (n === activeNodeIdx);
        const nodeHue = hue + n * 90;
        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, (on ? 34 : 14) * f);
        glow.addColorStop(0, `oklch(0.66 0.17 ${nodeHue} / ${(on ? 0.55 : 0.18) * levelAlpha})`);
        glow.addColorStop(1, `oklch(0.66 0.17 ${nodeHue} / 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(nx, ny, (on ? 34 : 14) * f, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    torusPaintAt = 0;
    render(performance.now());
  }

  /* =========================================================
     CIPHER WEAVE — subliminal full-bleed texture
     ========================================================= */
  function weaveSvgToMask(svg) {
    let s = String(svg || '')
      .replace(/<rect\b[^>]*\/>/g, '')
      .replace(/<rect\b[^>]*>[\s\S]*?<\/rect>/g, '')
      .replace(/#[0-9a-fA-F]{3,8}\b/g, '#000')
      .replace(/oklch\([^)]*\)/g, '#000');
    s = s.replace(/stroke="[^"]*"/g, 'stroke="#000"')
         .replace(/fill="(?!none)[^"]*"/g, 'fill="#000"');
    return 'data:image/svg+xml,' + encodeURIComponent(s);
  }
  function applyCipherWeave() {
    const weave = $('fieldWeave');
    if (!weave) return;
    if (state.texture === 'off' || !field) {
      weave.style.removeProperty('-webkit-mask-image');
      weave.style.removeProperty('mask-image');
      weave.style.opacity = '0';
      weave.dataset.mode = 'off';
      return;
    }
    const uri = weaveSvgToMask(cipherSvg() || field.radial);
    weave.style.setProperty('-webkit-mask-image', `url("${uri}")`);
    weave.style.setProperty('mask-image', `url("${uri}")`);

    if (state.texture === 'inside') {
      const zoom = manualZoom;
      let px, py;
      if (field.crop) { px = field.crop.x; py = field.crop.y; }
      else {
        const seedN = hashSeed(state.seed + '|inside');
        const rng = mulberry32(seedN + (state.route.view === 'room' ? (state.route.roomIdx + 1) * 733 : 0));
        px = 12 + Math.floor(rng() * 76);
        py = 12 + Math.floor(rng() * 76);
      }
      weave.style.setProperty('-webkit-mask-size', zoom + '%');
      weave.style.setProperty('mask-size', zoom + '%');
      weave.style.setProperty('-webkit-mask-repeat', 'no-repeat');
      weave.style.setProperty('mask-repeat', 'no-repeat');
      weave.style.setProperty('-webkit-mask-position', `${px}% ${py}%`);
      weave.style.setProperty('mask-position', `${px}% ${py}%`);
      weave.dataset.mode = 'inside';
      weave.style.opacity = String(manualOpacity);
      return;
    }

    const tile = state.texture === 'wallpaper' ? 210 : 320;
    weave.style.setProperty('-webkit-mask-size', tile + 'px');
    weave.style.setProperty('mask-size', tile + 'px');
    weave.style.setProperty('-webkit-mask-repeat', 'repeat');
    weave.style.setProperty('mask-repeat', 'repeat');
    weave.style.removeProperty('-webkit-mask-position');
    weave.style.removeProperty('mask-position');
    weave.dataset.mode = state.texture;
    weave.style.opacity = String(manualOpacity);
  }

  /* =========================================================
     THRESHOLD TRANSITIONS
     ========================================================= */
  function playTransition() {
    if (reduceMotion || state.transition === 'none') return;
    if (state.transition === 'threshold') {
      viz.animate(
        [{ opacity: 0.35, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }],
        { duration: 720, easing: 'cubic-bezier(.22,.61,.36,1)' }
      );
      return;
    }
    // fade (default)
    viz.animate(
      [{ opacity: 0.5, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 620, easing: 'cubic-bezier(.22,.61,.36,1)' }
    );
  }

  /* =========================================================
     PLACEHOLDER SIGIL GENERATOR (birth-data-free demo fallback)
     ========================================================= */
  function makeSigil(seed, variant, opts) {
    opts = opts || {};
    const stroke = opts.stroke || 1.5;
    const size = opts.size || 40;
    const rng = mulberry32(hashSeed(seed) + variant * 2654435761);
    const cx = 20, cy = 20;
    const spokes = 3 + Math.floor(rng() * 4);
    const baseAngle = rng() * Math.PI * 2;
    const rOuter = 15, rInner = 5.4;
    let paths = '';
    paths += `<circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="currentColor" stroke-width="${stroke}" opacity="0.55"/>`;
    const ry = 5 + rng() * 3;
    paths += `<ellipse cx="${cx}" cy="${cy}" rx="${rOuter}" ry="${ry.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${(stroke * 0.7).toFixed(2)}" opacity="0.30"/>`;
    const pts = [];
    for (let i = 0; i < spokes; i++) {
      const a = baseAngle + (i / spokes) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const len = rInner + rng() * (rOuter - rInner);
      const x1 = cx + Math.cos(a) * rInner, y1 = cy + Math.sin(a) * rInner;
      const x2 = cx + Math.cos(a) * len, y2 = cy + Math.sin(a) * len;
      paths += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="${(stroke * 0.85).toFixed(2)}" stroke-linecap="round" opacity="0.8"/>`;
      pts.push([x2, y2]);
    }
    if (pts.length >= 2) {
      const i = Math.floor(rng() * pts.length);
      const j = (i + 1 + Math.floor(rng() * (pts.length - 1))) % pts.length;
      paths += `<path d="M ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} Q ${cx} ${cy} ${pts[j][0].toFixed(1)} ${pts[j][1].toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${(stroke * 0.8).toFixed(2)}" opacity="0.55"/>`;
    }
    paths += `<circle cx="${cx}" cy="${cy}" r="${(rInner - 1.4).toFixed(1)}" fill="currentColor"/>`;
    return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" fill="none" role="img" aria-hidden="true">${paths}</svg>`;
  }
  function makeWatermark(seed) {
    const rng = mulberry32(hashSeed(seed) + 99);
    const cx = 100, cy = 100;
    let paths = '';
    for (let ring = 0; ring < 4; ring++) {
      const r = 30 + ring * 20;
      const ry = r * (0.32 + rng() * 0.1);
      paths += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.4" transform="rotate(${(rng() * 30 - 15).toFixed(1)} ${cx} ${cy})"/>`;
    }
    const spokes = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rng() * 0.4;
      paths += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * 92).toFixed(1)}" y2="${(cy + Math.sin(a) * 92).toFixed(1)}" stroke="currentColor" stroke-width="1"/>`;
    }
    paths += `<circle cx="${cx}" cy="${cy}" r="7" fill="currentColor"/>`;
    return `<svg viewBox="0 0 200 200" fill="none" role="img" aria-hidden="true">${paths}</svg>`;
  }

  function renderFieldCard() {
    $('fieldSeed').textContent = state.seed;
    $('fieldSigil').innerHTML = markSvg(44, { mono: true, stroke: 1.6 });
    $('fieldPalName').textContent = PAL_NAME[state.palette] || '';
    document.querySelectorAll('.tile--sig .tile__viz[data-sig="mark"]').forEach((el) => {
      el.innerHTML = markSvg(26, { mono: true, stroke: 1.6 });
    });
    document.querySelectorAll('.tile--sig .tile__viz[data-sig="watermark"]').forEach((el) => {
      el.innerHTML = markSvg(34, { mono: true, stroke: 1.2 });
    });
    document.querySelectorAll('.tile--sig .tile__viz[data-sig="glyphs"]').forEach((el) => {
      el.innerHTML = [0, 1, 2, 3].map((v) => markSvg(15, { mono: true, stroke: 1.7, variant: v + 1, rotate: v * 30 })).join('');
    });
  }

  /* =========================================================
     RENDER: visitor sections from state (with real imagery)
     ========================================================= */
  /* a room image only renders publicly if it exists and is not marked private.
     (Defense in depth on top of sanitizeImage, which also drops private.) */
  function visibleImage(img) {
    return (img && img.visibility !== 'private') ? img : null;
  }
  function imageStyle(img) {
    const fx = (typeof img.focalX === 'number') ? img.focalX : 50;
    const fy = (typeof img.focalY === 'number') ? img.focalY : 50;
    let st = `object-position:${fx}% ${fy}%`;
    if (typeof img.opacity === 'number') st += `;opacity:${img.opacity}`;
    if (img.blend) st += `;mix-blend-mode:${img.blend}`;
    return st;
  }

  function renderSections() {
    vizBody.innerHTML = '';
    state.sections.forEach((sec, i) => {
      const el = document.createElement('section');
      el.className = 'viz-section reveal';
      const img = visibleImage(sec.image);
      const layoutRole = img ? (IMG_LAYOUT[img.role] || 'inset') : sec.role;
      el.dataset.role = layoutRole;
      el.dataset.key = sec.key;
      el.dataset.sig = sec.sig;
      if (img) el.dataset.imgrole = img.role;
      if (layoutRole === 'side' && i % 2 === 1) el.classList.add('is-flip');

      let media = '';
      if (img) {
        media = `<div class="viz-sec-media"><img class="viz-sec-photo" src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" style="${escapeHtml(imageStyle(img))}" loading="lazy" /><div class="torusmask"></div></div>`;
      } else if (layoutRole !== 'none') {
        media = `<div class="viz-sec-media"><div class="abstract"></div><div class="torusmask"></div><div class="grain"></div></div>`;
      }

      const glyph = markSvg(16, { mono: true, stroke: 1.8, variant: i + 1, rotate: i * 30 });
      const secMark = `<div class="viz-sec-mark">${watermarkSvg()}</div>`;

      el.innerHTML = `
        ${secMark}
        <div class="viz-section__inner">
          <div class="viz-sec-copy">
            <span class="viz-sec-eyebrow"><span class="viz-sec-glyph">${glyph}</span><span class="viz-sec-num">0${i + 1}</span> ${escapeHtml(sec.eyebrow)}</span>
            <h2 class="viz-sec-title">${escapeHtml(sec.title)}</h2>
            <p class="viz-sec-body">${escapeHtml(sec.body)}</p>
            <button class="viz-sec-enter" type="button" data-enter="${i}"
                    aria-label="${escapeHtml(sec.enter)} — enter the ${escapeHtml(sec.eyebrow)} room">
              <span class="viz-sec-enter__label">${escapeHtml(sec.enter)}</span>
              <span class="viz-sec-enter__arrow" aria-hidden="true">→</span>
            </button>
          </div>
          ${media}
        </div>`;
      el.querySelector('.viz-sec-enter').addEventListener('click', (ev) => { ev.stopPropagation(); enterRoom(i); });
      vizBody.appendChild(el);
    });
    observeReveals();
  }

  /* =========================================================
     ROOM DEPTH — travel into a section as a destination
     ========================================================= */
  /* Editorial room composition: an asymmetric masthead spread grounded in the v5
     field. Media honours the image role (inset / full-bleed / background /
     artifact); when there is no public image the media region is omitted entirely
     (no gradient/hatch fake-content band). Highlights render as numbered,
     hairline-ruled ledger entries — never rounded bordered cards. */
  function renderRoom(idx) {
    const sec = state.sections[idx];
    if (!sec) return;
    const num = `0${idx + 1}`;
    const glyph = markSvg(22, { mono: true, stroke: 1.6, variant: idx + 1, rotate: idx * 30 });
    const img = visibleImage(sec.image);
    const role = img ? (img.role || 'inset') : 'none';

    const arts = Array.isArray(sec.artifacts) ? sec.artifacts : [];
    const ledger = arts.length
      ? `<ol class="room__ledger reveal">${arts.map((a, j) => `
          <li class="room__entry">
            <span class="room__entry-num" aria-hidden="true">${String(j + 1).padStart(2, '0')}</span>
            <div class="room__entry-body">
              ${a.tag ? `<span class="room__entry-tag">${escapeHtml(a.tag)}</span>` : ''}
              ${a.title ? `<h3 class="room__entry-title">${escapeHtml(a.title)}</h3>` : ''}
              ${a.note ? `<p class="room__entry-note">${escapeHtml(a.note)}</p>` : ''}
            </div>
          </li>`).join('')}</ol>`
      : '';

    // Role-aware media pieces. All start empty; only the piece matching the
    // image role is populated. With no public image (role 'none') every piece
    // stays empty, so the media region is omitted — no fake-content band.
    let bleedHTML = '';
    let bgHTML = '';
    let mastheadFig = '';
    let asideFig = '';
    const figCaption = (img && img.alt && img.alt.trim())
      ? `<figcaption class="room__figcap">${escapeHtml(img.alt)}</figcaption>` : '';
    function figure(kind) {
      return `<figure class="room__figure room__figure--${kind} reveal">
        <img class="room__img" src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" style="${escapeHtml(imageStyle(img))}" loading="lazy" />
        ${figCaption}
      </figure>`;
    }
    if (role === 'full-bleed') {
      bleedHTML = `<figure class="room__bleed reveal">
        <img class="room__img" src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" style="${escapeHtml(imageStyle(img))}" loading="lazy" />
        ${figCaption}
      </figure>`;
    } else if (role === 'background') {
      bgHTML = `<div class="room__bg" aria-hidden="true">
        <img class="room__bg-img" src="${escapeHtml(img.src)}" alt="" style="${escapeHtml(imageStyle(img))}" loading="lazy" />
        <span class="room__bg-scrim"></span>
      </div>`;
    } else if (role === 'inset') {
      mastheadFig = figure('inset');
    } else if (role === 'artifact') {
      asideFig = figure('artifact');
    }

    const hasAside = !!(ledger || asideFig);
    const prevIdx = (idx - 1 + state.sections.length) % state.sections.length;
    const nextIdx = (idx + 1) % state.sections.length;
    const pager = state.sections.map((s, j) => `
      <button class="room__page ${j === idx ? 'is-current' : ''}" type="button"
              data-goto="${j}" aria-label="Go to ${escapeHtml(s.eyebrow)} room"
              aria-current="${j === idx ? 'true' : 'false'}"><span class="room__page-num">0${j + 1}</span><span class="room__page-name">${escapeHtml(s.eyebrow)}</span></button>`).join('');

    const closing = (sec.prompt || '').trim()
      ? `<div class="room__closing reveal"><p class="room__closing-text">${escapeHtml(sec.prompt)}</p></div>`
      : '';

    vizRoom.innerHTML = `
      <article class="room room--editorial" data-imgrole="${role}" data-textsize="${sec.textSize || 'medium'}">
        ${bgHTML}
        <div class="room__wrap">
          <div class="room__top">
            <button class="room__back" type="button" data-back aria-label="Return to the overview">
              <span aria-hidden="true">←</span> Back to the field
            </button>
            <span class="room__breadcrumb">${escapeHtml(state.name)} · Room ${num}</span>
          </div>

          ${bleedHTML}

          <div class="room__spread ${hasAside ? '' : 'room__spread--solo'}">
            <div class="room__masthead reveal">
              <span class="room__eyebrow"><span class="room__glyph">${glyph}</span><span class="room__num">${num}</span> ${escapeHtml(sec.eyebrow)}</span>
              <h1 class="room__title">${escapeHtml(sec.title)}</h1>
              <p class="room__narrative">${escapeHtml(sec.narrative || sec.body)}</p>
              ${mastheadFig}
            </div>
            ${hasAside ? `<aside class="room__aside">${asideFig}${ledger}</aside>` : ''}
          </div>

          ${closing}

          <nav class="room__nav" aria-label="Room navigation">
            <button class="room__navlink room__navlink--prev" type="button" data-goto="${prevIdx}"
                    aria-label="Previous room: ${escapeHtml(state.sections[prevIdx].eyebrow)}">
              <span class="room__navlink-arrow" aria-hidden="true">←</span>
              <span class="room__navlink-meta"><span class="room__navlink-dir">Previous</span><span class="room__navlink-name">${escapeHtml(state.sections[prevIdx].eyebrow)}</span></span>
            </button>
            <div class="room__pager" role="group" aria-label="All rooms">${pager}</div>
            <button class="room__navlink room__navlink--next" type="button" data-goto="${nextIdx}"
                    aria-label="Next room: ${escapeHtml(state.sections[nextIdx].eyebrow)}">
              <span class="room__navlink-meta"><span class="room__navlink-dir">Next</span><span class="room__navlink-name">${escapeHtml(state.sections[nextIdx].eyebrow)}</span></span>
              <span class="room__navlink-arrow" aria-hidden="true">→</span>
            </button>
          </nav>
        </div>
      </article>`;

    vizRoom.querySelector('[data-back]').addEventListener('click', exitRoom);
    vizRoom.querySelectorAll('[data-goto]').forEach((b) => {
      b.addEventListener('click', () => gotoRoom(+b.dataset.goto));
    });
    observeReveals();
  }

  function enterRoom(idx) {
    state.route = { view: 'room', roomIdx: idx };
    vizRoom.hidden = false;
    viz.classList.add('is-room-open');
    renderRoom(idx);
    applyCipherWeave();
    activeNodeIdx = idx;
    drawFieldTorus();
    updateStageState();
    playTransition();
    const scroller = $('stageScroll');
    if (scroller) scroller.scrollTop = 0;
    vizRoom.focus();
  }
  function gotoRoom(idx) {
    if (state.route.view === 'room' && idx === state.route.roomIdx) return;
    enterRoom(idx);
  }
  function exitRoom() {
    const from = state.route.roomIdx;
    state.route = { view: 'overview', roomIdx: from };
    viz.classList.remove('is-room-open');
    applyCipherWeave();
    drawFieldTorus();
    updateStageState();
    playTransition();
    vizRoom.hidden = true;
    const back = vizBody.querySelector(`.viz-sec-enter[data-enter="${from}"]`);
    if (back) back.focus();
  }

  /* =========================================================
     APPLY composition
     ========================================================= */
  function applyComposition() {
    viz.dataset.intensity = state.intensity;
    viz.dataset.sigil = state.sigil;
    viz.dataset.torus = state.torus;
    viz.dataset.texture = state.texture;
    viz.dataset.transition = state.transition;
    viz.dataset.motion = (reduceMotion || state.transition === 'none') ? 'still'
      : state.transition === 'threshold' ? 'threshold' : 'threshold';
    viz.dataset.hero = state.hero;
    viz.dataset.palette = state.palette;
    viz.dataset.photo = state.photo;
    viz.dataset.sigmode = state.sigmode;

    // Portrait media vs. Cipher atmosphere are separate layers. A real public
    // photo renders cleanly in its own <img> (object-fit cover); the placeholder
    // Cipher gradient/egg (.portrait), the soft-light torus mask and the hero
    // watermark are suppressed via data-has-photo so nothing is ever painted
    // over a human face. The Cipher stays present as the site-wide field bg.
    const hasPhoto = !!state.heroPhoto;
    viz.dataset.hasPhoto = hasPhoto ? 'true' : 'false';
    // A transparent portrait (alpha detected) composites straight over the
    // atmospheric field — no opaque card/backing. Opaque photos keep the cover
    // crop + focal framing. Detection runs where heroPhoto changes.
    viz.dataset.photoAlpha = (hasPhoto && state.heroPhotoHasAlpha) ? 'true' : 'false';
    // Portrait fade: a true alpha mask (CSS mask-image) softens the image edge
    // that meets text, or feathers all edges, so it merges into the field and
    // adjacent copy. Direction is resolved responsively in CSS from data-hero /
    // the mobile stage. Strength drives the gradient reach via --fade-strength.
    viz.dataset.fade = hasPhoto ? state.heroFadeMode : 'none';
    viz.style.setProperty('--fade-strength', String(state.heroFadeStrength));
    const heroImg = $('heroPhoto');
    if (heroImg) {
      if (hasPhoto) {
        if (heroImg.getAttribute('src') !== state.heroPhoto) heroImg.setAttribute('src', state.heroPhoto);
        heroImg.hidden = false;
        heroImg.alt = state.heroAlt || '';
        heroImg.style.objectPosition = `${state.heroFocalX}% ${state.heroFocalY}%`;
        // Restrained zoom: scale from the focal point so a face can be framed
        // without distortion (object-fit still preserves aspect ratio).
        const z = Math.max(1, state.heroZoom / 100);
        heroImg.style.transform = z > 1 ? `scale(${z})` : '';
        heroImg.style.transformOrigin = `${state.heroFocalX}% ${state.heroFocalY}%`;
      } else {
        // No real media — never retain a stale portrait between models.
        heroImg.removeAttribute('src');
        heroImg.hidden = true;
        heroImg.style.transform = '';
      }
    }
    applyCipherFieldOverlay(hasPhoto);
    const portrait = viz.querySelector('.portrait');
    if (portrait) {
      portrait.dataset.photo = state.photo;
      portrait.style.removeProperty('background-image');
    }

    vizName.textContent = state.name || 'Untitled';
    vizTag.textContent = state.tagline || '';
    if (vizHeroCta) vizHeroCta.textContent = state.heroCta || 'enter the field';
    vizEyebrowText.textContent = state.eyebrow || 'CommonUnity';
    vizFootName.textContent = state.name || 'Untitled';

    $('eyebrowSigil').innerHTML = markSvg(20, { mono: true, stroke: 1.7 });
    $('footSigil').innerHTML = markSvg(26, { mono: true, stroke: 1.6 });
    $('heroWatermark').innerHTML = watermarkSvg();
    $('fieldPalName').textContent = PAL_NAME[state.palette] || '';

    applyFieldPalette();
    applyCipherWeave();
    applyOverlay();
    fitIntro();
    drawFieldTorus();
    updateStageState();
  }

  /* Cipher Field — the one optional Arrival Portrait overlay. Deterministic SVG
     built from public field primitives only (role colours + hue + a stable
     seed), applied over the portrait with a face-safe centre mask. Intensity is
     a single CSS opacity lever. Regenerated only when its inputs change. */
  let cipherFieldSig = null;
  function applyCipherFieldOverlay(hasPhoto) {
    const node = $('heroCipherField');
    const CF = window.CipherField;
    const on = hasPhoto && state.heroOverlay === 'cipher-field' && !!CF;
    viz.dataset.overlay = on ? 'cipher-field' : 'off';
    if (!node) return;
    if (!on) { node.innerHTML = ''; cipherFieldSig = null; return; }
    const roles = {
      root: activeRoleColor('root'),
      expression: activeRoleColor('expression'),
      radiance: activeRoleColor('radiance'),
    };
    const hue = (field && typeof field.primaryHue === 'number') ? field.primaryHue : 80;
    const seed = state.palette + '|' + (field && field.radial ? String(field.radial).length : 0);
    const sig = [roles.root, roles.expression, roles.radiance, hue, seed].join('~');
    if (sig !== cipherFieldSig) {
      node.innerHTML = CF.buildOverlaySvg({ roles: roles, hue: hue, seed: seed });
      cipherFieldSig = sig;
    }
    viz.style.setProperty('--hero-overlay-opacity', String(CF.overlayOpacity(state.heroOverlayIntensity)));
  }

  /* =========================================================
     ARRIVAL GRAPHIC OVERLAY — a static layer above the portrait /
     field but below all text and navigation. Pure DOM/<img>; no rAF.
     ========================================================= */
  function overlaySrc() {
    const o = state.overlay;
    if (!o || o.source === 'off') return '';
    if (o.source === 'cipher') { const svg = cipherSvg(); return svg ? svgToDataUrl(scrubSvg(svg)) : ''; }
    if (o.source === 'torus') return svgToDataUrl(torusOverlaySvg());
    if (o.source === 'upload') return safeOverlaySrc(o.src) || '';
    return '';
  }
  function applyOverlay() {
    const wrap = $('heroOverlay');
    if (!wrap) return;
    const img = $('heroOverlayImg');
    const o = state.overlay;
    const src = overlaySrc();
    if (!src) { wrap.hidden = true; if (img) img.removeAttribute('src'); return; }
    wrap.hidden = false;
    if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
    const x = clampNum(o.x, 0, 100, 50), y = clampNum(o.y, 0, 100, 42);
    const scale = clampNum(o.scale, 10, 100, 62), rot = clampNum(o.rotate, -180, 180, 0);
    wrap.style.left = x + '%';
    wrap.style.top = y + '%';
    wrap.style.width = scale + '%';
    wrap.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
    wrap.style.opacity = String(clamp01(numOr(o.opacity, 0.9)));
    wrap.style.mixBlendMode = OVERLAY_BLENDS.indexOf(o.blend) !== -1 ? o.blend : 'normal';
  }

  /* Fit the arrival intro sentence to its box. Auto shrinks the size (within an
     accessible min/max) so a long sentence never overflows the picture/stage;
     manual holds an explicit size. Runs on demand only — never on a loop. */
  function fitIntro() {
    if (!vizTag) return;
    const measure = clampNum(state.introWidth, 16, 52, 26);
    vizTag.style.maxWidth = measure + 'ch';
    const MIN = 15, MAX = 40;
    if (state.introFit === 'manual') {
      vizTag.style.fontSize = clampNum(state.introSize, MIN, MAX, 22) + 'px';
      return;
    }
    // Auto: binary-search the largest size that keeps the sentence within the
    // vertical space left in the hero below the tagline's top edge (reserving
    // room for the scroll hint). A few synchronous measurements — no animation.
    const hero = viz.querySelector('.viz-hero');
    const scroll = viz.querySelector('.viz-hero__scroll');
    let avail;
    if (hero) {
      const heroBottom = hero.getBoundingClientRect().bottom;
      const tagTop = vizTag.getBoundingClientRect().top;
      const scrollH = scroll ? scroll.getBoundingClientRect().height + 40 : 56;
      avail = Math.max(80, heroBottom - tagTop - scrollH);
    } else {
      avail = Math.round(window.innerHeight * 0.4);
    }
    let lo = MIN, hi = MAX, best = MIN;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      vizTag.style.fontSize = mid + 'px';
      if (vizTag.scrollHeight <= avail) { best = mid; lo = mid; } else { hi = mid; }
    }
    vizTag.style.fontSize = best.toFixed(1) + 'px';
  }

  function updateStageState() {
    if (state.route.view === 'room') {
      const sec = state.sections[state.route.roomIdx];
      stageState.textContent = `Room 0${state.route.roomIdx + 1} · ${sec ? sec.eyebrow : ''}`;
    } else {
      stageState.textContent = `Fieldprint · ${cap(state.intensity)} · Torus ${cap(state.torus)}`;
    }
  }

  /* =========================================================
     SECTION CONTROLS (image role + editable copy)
     ========================================================= */
  /* ---- CONTENT / COPY editors (heading + body per room) ---- */
  function buildCopyControls() {
    if (!sectionCopyControls) return;
    sectionCopyControls.innerHTML = '';
    state.sections.forEach((sec, i) => {
      const card = document.createElement('div');
      card.className = 'seccard';
      const glyph = makeSigil(state.seed, i + 1, { size: 16, stroke: 1.8 });
      const arts = Array.isArray(sec.artifacts) ? sec.artifacts : [];
      const artRows = arts.map((a, j) => `
        <div class="artrow" data-artrow="${i}-${j}">
          <div class="artrow__head">
            <input class="mini-input mini-input--tag" type="text" data-arttag="${i}-${j}"
              value="${escapeHtml(a.tag || '')}" placeholder="Tag" aria-label="Room 0${i + 1} highlight ${j + 1} tag" />
            <button class="linkbtn linkbtn--mini artrow__rm" type="button" data-artrm="${i}-${j}"
              aria-label="Remove highlight ${j + 1} from room 0${i + 1}">Remove</button>
          </div>
          <input class="mini-input" type="text" data-arttitle="${i}-${j}"
            value="${escapeHtml(a.title || '')}" placeholder="Highlight title" aria-label="Room 0${i + 1} highlight ${j + 1} title" />
          <textarea class="seccard__area" rows="2" data-artnote="${i}-${j}"
            placeholder="Note (optional)" aria-label="Room 0${i + 1} highlight ${j + 1} note">${escapeHtml(a.note || '')}</textarea>
        </div>`).join('');
      card.innerHTML = `
        <div class="seccard__head">
          <span class="seccard__title"><span class="seccard__glyph">${glyph}</span><span class="seccard__titletext" data-sectitletext="${i}">${escapeHtml(sec.eyebrow)}</span></span>
          <span class="seccard__idx">0${i + 1}</span>
        </div>
        <div class="minilabel-row">
          <label class="minilabel" for="secEyebrow${i}">Display heading</label>
          <button class="linkbtn linkbtn--mini" type="button" data-secheadingreset="${i}">Reset</button>
        </div>
        <input class="mini-input" id="secEyebrow${i}" type="text" data-seceyebrow="${i}"
          value="${escapeHtml(sec.eyebrow)}" aria-label="Room 0${i + 1} display heading" />
        <label class="minilabel" for="secTitle${i}">Heading</label>
        <input class="mini-input" id="secTitle${i}" type="text" data-sectitle="${i}"
          value="${escapeHtml(sec.title)}" aria-label="Room 0${i + 1} heading" />
        <label class="minilabel" for="secBody${i}">Overview body</label>
        <textarea class="seccard__area" id="secBody${i}" rows="3" data-secbody="${i}"
          aria-label="Room 0${i + 1} overview body text">${escapeHtml(sec.body)}</textarea>
        <label class="minilabel" for="secNarr${i}">Room intro</label>
        <textarea class="seccard__area" id="secNarr${i}" rows="3" data-secnarr="${i}"
          aria-label="Room 0${i + 1} intro text">${escapeHtml(sec.narrative || '')}</textarea>
        <div class="minilabel-row">
          <span class="minilabel">Highlights</span>
          <button class="linkbtn linkbtn--mini" type="button" data-artadd="${i}">+ Add</button>
        </div>
        <div class="artgroup" data-artgroup="${i}">${artRows}</div>
        <label class="minilabel" for="secPrompt${i}">Closing line</label>
        <input class="mini-input" id="secPrompt${i}" type="text" data-secprompt="${i}"
          value="${escapeHtml(sec.prompt || '')}" aria-label="Room 0${i + 1} closing line" />
        <label class="minilabel" for="secEnter${i}">Entry phrase</label>
        <input class="mini-input" id="secEnter${i}" type="text" data-secenter="${i}"
          value="${escapeHtml(sec.enter || '')}" aria-label="Room 0${i + 1} entry phrase" />
        <span class="minilabel" id="secTextSizeLbl${i}">Text size</span>
        <div class="segset segset--row" role="radiogroup" aria-labelledby="secTextSizeLbl${i}" data-sectextsize="${i}">
          <button role="radio" class="pill" type="button" data-textsize="small" aria-checked="${(sec.textSize || 'medium') === 'small'}">Small</button>
          <button role="radio" class="pill" type="button" data-textsize="medium" aria-checked="${(sec.textSize || 'medium') === 'medium'}">Medium</button>
          <button role="radio" class="pill" type="button" data-textsize="large" aria-checked="${(sec.textSize || 'medium') === 'large'}">Large</button>
        </div>`;
      sectionCopyControls.appendChild(card);
    });

    // Display heading (the room's public kicker/overline). Editing it updates the
    // overview, room detail, room rail and prev/next nav live. Routing stays keyed
    // to the stable room index/key, so renaming a heading can never break it.
    function applyEyebrowLive(idx) {
      const tt = sectionCopyControls.querySelector(`[data-sectitletext="${idx}"]`);
      if (tt) tt.textContent = state.sections[idx].eyebrow;
      renderSections();
      if (state.route.view === 'room') renderRoom(state.route.roomIdx);
    }
    sectionCopyControls.querySelectorAll('[data-seceyebrow]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.dataset.seceyebrow;
        state.sections[idx].eyebrow = inp.value;
        applyEyebrowLive(idx);
      });
    });
    sectionCopyControls.querySelectorAll('[data-secheadingreset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.secheadingreset;
        state.sections[idx].eyebrow = baseEyebrow(idx);
        const inp = sectionCopyControls.querySelector(`[data-seceyebrow="${idx}"]`);
        if (inp) inp.value = state.sections[idx].eyebrow;
        applyEyebrowLive(idx);
        markDirty();
      });
    });

    sectionCopyControls.querySelectorAll('[data-sectitle]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.dataset.sectitle;
        state.sections[idx].title = inp.value;
        const target = vizBody.children[idx];
        if (target) { const t = target.querySelector('.viz-sec-title'); if (t) t.textContent = inp.value; }
        if (state.route.view === 'room' && state.route.roomIdx === idx) {
          const rt = vizRoom.querySelector('.room__title'); if (rt) rt.textContent = inp.value;
        }
      });
    });
    sectionCopyControls.querySelectorAll('[data-secbody]').forEach((ta) => {
      ta.addEventListener('input', () => {
        const idx = +ta.dataset.secbody;
        state.sections[idx].body = ta.value;
        const target = vizBody.children[idx];
        if (target) { const p = target.querySelector('.viz-sec-body'); if (p) p.textContent = ta.value; }
      });
    });

    // Room-detail copy: narrative (intro), closing line (prompt), entry phrase
    // (enter). These live in the room detail; re-render it in place when open.
    function liveRoom(idx) {
      if (state.route.view === 'room' && state.route.roomIdx === idx) renderRoom(idx);
    }
    sectionCopyControls.querySelectorAll('[data-secnarr]').forEach((ta) => {
      ta.addEventListener('input', () => {
        const idx = +ta.dataset.secnarr;
        state.sections[idx].narrative = ta.value;
        liveRoom(idx);
      });
    });
    sectionCopyControls.querySelectorAll('[data-secprompt]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.dataset.secprompt;
        state.sections[idx].prompt = inp.value;
        liveRoom(idx);
      });
    });
    sectionCopyControls.querySelectorAll('[data-secenter]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.dataset.secenter;
        state.sections[idx].enter = inp.value;
        renderSections();
        liveRoom(idx);
      });
    });
    // Per-room narrative text size (Small/Medium/Large). Applies only to the
    // room's editorial body copy, not to system chrome or heading hierarchy.
    const TEXT_SIZES = ['small', 'medium', 'large'];
    sectionCopyControls.querySelectorAll('[data-sectextsize]').forEach((seg) => {
      seg.querySelectorAll('button[data-textsize]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = +seg.dataset.sectextsize;
          const v = btn.getAttribute('data-textsize');
          if (TEXT_SIZES.indexOf(v) === -1) return;
          state.sections[idx].textSize = v;
          seg.querySelectorAll('button[data-textsize]').forEach((b) => {
            b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
          });
          liveRoom(idx);
          markDirty();
        });
      });
    });

    // Highlights (editorial ledger entries): tag / title / note. Text edits mutate
    // state and live-render the open room without rebuilding controls (keeps focus).
    const parseIJ = (s) => s.split('-').map(Number);
    sectionCopyControls.querySelectorAll('[data-arttag]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const [i, j] = parseIJ(inp.dataset.arttag);
        if (state.sections[i].artifacts && state.sections[i].artifacts[j]) {
          state.sections[i].artifacts[j].tag = inp.value; liveRoom(i);
        }
      });
    });
    sectionCopyControls.querySelectorAll('[data-arttitle]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const [i, j] = parseIJ(inp.dataset.arttitle);
        if (state.sections[i].artifacts && state.sections[i].artifacts[j]) {
          state.sections[i].artifacts[j].title = inp.value; liveRoom(i);
        }
      });
    });
    sectionCopyControls.querySelectorAll('[data-artnote]').forEach((ta) => {
      ta.addEventListener('input', () => {
        const [i, j] = parseIJ(ta.dataset.artnote);
        if (state.sections[i].artifacts && state.sections[i].artifacts[j]) {
          state.sections[i].artifacts[j].note = ta.value; liveRoom(i);
        }
      });
    });
    // Add/remove structurally rebuild the editor group, then live-render + autosave.
    sectionCopyControls.querySelectorAll('[data-artadd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.artadd;
        if (!Array.isArray(state.sections[i].artifacts)) state.sections[i].artifacts = [];
        state.sections[i].artifacts.push({ tag: 'Signal', title: '', note: '' });
        buildCopyControls();
        liveRoom(i);
        markDirty();
      });
    });
    sectionCopyControls.querySelectorAll('[data-artrm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [i, j] = parseIJ(btn.dataset.artrm);
        if (Array.isArray(state.sections[i].artifacts)) {
          state.sections[i].artifacts.splice(j, 1);
          buildCopyControls();
          liveRoom(i);
          markDirty();
        }
      });
    });
  }

  /* ---- IMAGES: one image per room (upload/role/alt/private/focal/opacity/blend).
     Image role is fully independent of sigmode — automatic signatures never
     disable these controls. ---- */
  const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
  function buildImageControls() {
    if (!roomImageControls) return;
    roomImageControls.innerHTML = '';
    state.sections.forEach((sec, i) => {
      const card = document.createElement('div');
      card.className = 'seccard';
      const img = sec.image;
      const hasImg = !!img;
      const activeRole = (img && img.role) || sec.imgRole || 'inset';
      const isPrivate = !!(img && img.visibility === 'private');
      const fx = (img && typeof img.focalX === 'number') ? img.focalX : 50;
      const fy = (img && typeof img.focalY === 'number') ? img.focalY : 50;
      const op = (img && typeof img.opacity === 'number') ? Math.round(img.opacity * 100) : 100;
      const blend = (img && img.blend) || 'normal';
      const glyph = makeSigil(state.seed, i + 1, { size: 16, stroke: 1.8 });
      const roleBtns = ROLE_META.map((r) => `
        <button role="radio" class="roleopt" data-imgsec="${i}" data-role="${r.value}"
                aria-checked="${activeRole === r.value}" aria-label="${escapeHtml(sec.eyebrow)}: ${r.name} image">
          <span class="roleopt__ic" data-role="${r.value === 'full-bleed' ? 'bleed' : r.value === 'background' ? 'bleed' : r.value === 'artifact' ? 'side' : 'inset'}"></span>
          <span class="roleopt__name">${r.name}</span>
        </button>`).join('');

      card.innerHTML = `
        <div class="seccard__head">
          <span class="seccard__title"><span class="seccard__glyph">${glyph}</span>${escapeHtml(sec.eyebrow)}</span>
          <span class="seccard__idx">0${i + 1}</span>
        </div>
        <div class="imgeditor__btns">
          <button class="minibtn" data-imgupload="${i}" type="button">${hasImg ? 'Replace' : 'Upload'}</button>
          <button class="minibtn minibtn--ghost" data-imgremove="${i}" type="button" ${hasImg ? '' : 'hidden'}>Remove</button>
        </div>
        <input type="file" accept="image/*" data-imgfile="${i}" hidden />
        <div class="imgctls" ${hasImg ? '' : 'hidden'}>
          <span class="seccard__rolelabel">Image role</span>
          <div class="rolerow" role="radiogroup" aria-label="${escapeHtml(sec.eyebrow)} image role">${roleBtns}</div>
          <label class="minilabel" for="imgAlt${i}">Alt text</label>
          <input class="mini-input" id="imgAlt${i}" type="text" data-imgalt="${i}"
            value="${escapeHtml((img && img.alt) || '')}" placeholder="Describe the image" />
          <label class="toggle"><input type="checkbox" data-imgprivate="${i}" ${isPrivate ? 'checked' : ''} />
            <span>Private — hide from the public page</span></label>
          <div class="focalrow">
            <div class="adj"><span class="adj__label">Focal X <span class="adj__val" data-fxval="${i}">${fx}%</span></span>
              <input type="range" min="0" max="100" step="1" value="${fx}" data-imgfx="${i}" aria-label="${escapeHtml(sec.eyebrow)} image focal X" /></div>
            <div class="adj"><span class="adj__label">Focal Y <span class="adj__val" data-fyval="${i}">${fy}%</span></span>
              <input type="range" min="0" max="100" step="1" value="${fy}" data-imgfy="${i}" aria-label="${escapeHtml(sec.eyebrow)} image focal Y" /></div>
          </div>
          <div class="adj"><span class="adj__label">Opacity <span class="adj__val" data-opval="${i}">${op}%</span></span>
            <input type="range" min="0" max="100" step="1" value="${op}" data-imgop="${i}" aria-label="${escapeHtml(sec.eyebrow)} image opacity" /></div>
          <label class="minilabel" for="imgBlend${i}">Blend</label>
          <select class="mini-input" id="imgBlend${i}" data-imgblend="${i}">
            ${BLEND_MODES.map((b) => `<option value="${b}" ${blend === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>`;
      roomImageControls.appendChild(card);
    });
    wireImageControls();
  }

  function ensureImage(i) {
    if (!state.sections[i].image) {
      state.sections[i].image = { src: '', role: state.sections[i].imgRole || 'inset', alt: '',
        focalX: 50, focalY: 50, opacity: 1, blend: 'normal', visibility: 'public' };
    }
    return state.sections[i].image;
  }
  function updateImgLive(i) {
    const img = state.sections[i].image;
    if (!img) return;
    const secEl = vizBody.children[i];
    if (secEl) { const im = secEl.querySelector('.viz-sec-photo'); if (im) { im.setAttribute('style', imageStyle(img)); im.alt = img.alt || ''; } }
    if (state.route.view === 'room' && state.route.roomIdx === i) {
      vizRoom.querySelectorAll('.room__img,.room__bg-img').forEach((rm) => {
        rm.setAttribute('style', imageStyle(img));
        if (!rm.classList.contains('room__bg-img')) rm.alt = img.alt || '';
      });
    }
  }

  function wireImageControls() {
    roomImageControls.querySelectorAll('[data-imgupload]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.imgupload;
        const inp = roomImageControls.querySelector(`[data-imgfile="${i}"]`);
        if (inp) inp.click();
      });
    });
    roomImageControls.querySelectorAll('[data-imgfile]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const i = +inp.dataset.imgfile;
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = safeMediaSrc(ev.target.result);
          if (src) {
            const img = ensureImage(i);
            img.src = src;
            renderSections();
            if (state.route.view === 'room' && state.route.roomIdx === i) renderRoom(i);
            buildImageControls();
            markDirty();
          }
          inp.value = '';
        };
        reader.readAsDataURL(f);
      });
    });
    roomImageControls.querySelectorAll('[data-imgremove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.imgremove;
        state.sections[i].image = null;
        renderSections();
        if (state.route.view === 'room' && state.route.roomIdx === i) renderRoom(i);
        buildImageControls();
        markDirty();
      });
    });
    roomImageControls.querySelectorAll('.roleopt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.imgsec;
        const role = btn.dataset.role;
        state.sections[i].imgRole = role;
        if (state.sections[i].image) state.sections[i].image.role = role;
        btn.parentElement.querySelectorAll('.roleopt').forEach((b) =>
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false'));
        renderSections();
        if (state.route.view === 'room' && state.route.roomIdx === i) renderRoom(i);
        markDirty();
      });
    });
    roomImageControls.querySelectorAll('[data-imgalt]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.imgalt;
        const img = state.sections[i].image; if (!img) return;
        img.alt = inp.value; updateImgLive(i);
      });
    });
    roomImageControls.querySelectorAll('[data-imgprivate]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const i = +cb.dataset.imgprivate;
        const img = state.sections[i].image; if (!img) return;
        img.visibility = cb.checked ? 'private' : 'public';
        renderSections();
        if (state.route.view === 'room' && state.route.roomIdx === i) renderRoom(i);
      });
    });
    roomImageControls.querySelectorAll('[data-imgfx]').forEach((r) => {
      r.addEventListener('input', () => {
        const i = +r.dataset.imgfx;
        const img = state.sections[i].image; if (!img) return;
        img.focalX = +r.value;
        const lbl = roomImageControls.querySelector(`[data-fxval="${i}"]`); if (lbl) lbl.textContent = r.value + '%';
        updateImgLive(i);
      });
    });
    roomImageControls.querySelectorAll('[data-imgfy]').forEach((r) => {
      r.addEventListener('input', () => {
        const i = +r.dataset.imgfy;
        const img = state.sections[i].image; if (!img) return;
        img.focalY = +r.value;
        const lbl = roomImageControls.querySelector(`[data-fyval="${i}"]`); if (lbl) lbl.textContent = r.value + '%';
        updateImgLive(i);
      });
    });
    roomImageControls.querySelectorAll('[data-imgop]').forEach((r) => {
      r.addEventListener('input', () => {
        const i = +r.dataset.imgop;
        const img = state.sections[i].image; if (!img) return;
        img.opacity = Math.max(0, Math.min(1, (+r.value || 0) / 100));
        const lbl = roomImageControls.querySelector(`[data-opval="${i}"]`); if (lbl) lbl.textContent = r.value + '%';
        updateImgLive(i);
      });
    });
    roomImageControls.querySelectorAll('[data-imgblend]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.imgblend;
        const img = state.sections[i].image; if (!img) return;
        img.blend = sel.value; updateImgLive(i);
      });
    });
  }

  /* Detect whether the arrival portrait carries real transparency. A PNG/WebP/
     SVG with alpha should composite directly over the field (no opaque card);
     an opaque JPEG/PNG keeps the cover-crop card. The src is a same-origin
     data:/https media URL already gated by safeMediaSrc, so the canvas read is
     never tainted. Detection is async (image decode) and only updates the
     data-photo-alpha flag the CSS reacts to — it never mutates the src. */
  function setHeroAlpha(v, forSrc) {
    // Ignore stale results if the portrait changed while decoding.
    if (forSrc !== undefined && forSrc !== state.heroPhoto) return;
    state.heroPhotoHasAlpha = !!v;
    viz.dataset.photoAlpha = (state.heroPhoto && v) ? 'true' : 'false';
  }
  function detectHeroAlpha(src) {
    if (!src) { setHeroAlpha(false); return; }
    const probe = new Image();
    probe.onload = () => {
      try {
        const w = Math.max(1, Math.min(probe.naturalWidth || 0, 80));
        const h = Math.max(1, Math.min(probe.naturalHeight || 0, 80));
        if (!probe.naturalWidth || !probe.naturalHeight) { setHeroAlpha(false, src); return; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) { setHeroAlpha(false, src); return; }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(probe, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let hasAlpha = false;
        for (let i = 3; i < data.length; i += 4) { if (data[i] < 250) { hasAlpha = true; break; } }
        setHeroAlpha(hasAlpha, src);
      } catch (_) { setHeroAlpha(false, src); }
    };
    probe.onerror = () => setHeroAlpha(false, src);
    probe.src = src;
  }

  /* ---- IDENTITY: arrival portrait (upload / replace / remove / alt / focal).
     Every src passes through safeMediaSrc; private/unsafe portraits never
     render. Removal and rehydration always clear any stale <img> src. ---- */
  function wireHeroPhoto() {
    const up = $('heroUploadBtn'), rm = $('heroRemoveBtn'), file = $('heroPhotoInput'),
      alt = $('heroAltInput'), fx = $('heroFocalX'), fy = $('heroFocalY');
    if (up && file) up.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) { return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = safeMediaSrc(ev.target.result);
        if (src) {
          state.heroPhoto = src;
          state.heroPhotoHasAlpha = false;
          applyComposition(); syncHeroEditor();
          detectHeroAlpha(src);
          markDirty();
        }
        file.value = '';
      };
      reader.readAsDataURL(f);
    });
    if (rm) rm.addEventListener('click', () => {
      state.heroPhoto = ''; state.heroAlt = '';
      state.heroFocalX = 50; state.heroFocalY = 50;
      state.heroZoom = 100;
      state.heroPhotoHasAlpha = false;
      state.heroFadeMode = 'none'; state.heroFadeStrength = 0.6;
      state.heroOverlay = 'off'; state.heroOverlayIntensity = 0.5;
      applyComposition(); syncHeroEditor();
      markDirty();
    });
    if (alt) alt.addEventListener('input', () => {
      state.heroAlt = alt.value;
      const heroImg = $('heroPhoto'); if (heroImg && state.heroPhoto) heroImg.alt = state.heroAlt;
    });
    if (fx) fx.addEventListener('input', () => applyHeroFocal('x', fx.value));
    if (fy) fy.addEventListener('input', () => applyHeroFocal('y', fy.value));
    const fadeSeg = $('heroFadeSeg');
    if (fadeSeg) fadeSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-herofade]');
      if (!btn) return;
      state.heroFadeMode = btn.getAttribute('data-herofade');
      applyComposition(); syncHeroEditor();
      markDirty();
    });
    const fadeStr = $('heroFadeStrength');
    if (fadeStr) fadeStr.addEventListener('input', () => {
      const n = Math.max(0, Math.min(100, +fadeStr.value || 0));
      state.heroFadeStrength = n / 100;
      const l = $('heroFadeStrengthVal'); if (l) l.textContent = n + '%';
      applyComposition();
    });
    const zoom = $('heroZoom');
    if (zoom) zoom.addEventListener('input', () => {
      const n = Math.max(100, Math.min(200, +zoom.value || 100));
      state.heroZoom = n;
      const l = $('heroZoomVal'); if (l) l.textContent = n + '%';
      applyComposition();
      markDirty();
    });
    const overlaySeg = $('heroOverlaySeg');
    if (overlaySeg) overlaySeg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-overlay]');
      if (!btn) return;
      state.heroOverlay = btn.getAttribute('data-overlay') === 'cipher-field' ? 'cipher-field' : 'off';
      applyComposition(); syncHeroEditor();
      markDirty();
    });
    const overlayInt = $('heroOverlayIntensity');
    if (overlayInt) overlayInt.addEventListener('input', () => {
      const n = Math.max(0, Math.min(100, +overlayInt.value || 0));
      state.heroOverlayIntensity = n / 100;
      const l = $('heroOverlayIntensityVal'); if (l) l.textContent = n + '%';
      applyComposition();
      markDirty();
    });
    const overlayReset = $('heroOverlayReset');
    if (overlayReset) overlayReset.addEventListener('click', () => {
      state.heroOverlay = 'off'; state.heroOverlayIntensity = 0.5;
      applyComposition(); syncHeroEditor();
      markDirty();
    });
  }
  function applyHeroFocal(axis, val) {
    const n = Math.max(0, Math.min(100, +val || 0));
    if (axis === 'x') { state.heroFocalX = n; const l = $('heroFocalXVal'); if (l) l.textContent = n + '%'; }
    else { state.heroFocalY = n; const l = $('heroFocalYVal'); if (l) l.textContent = n + '%'; }
    const heroImg = $('heroPhoto');
    if (heroImg && state.heroPhoto) heroImg.style.objectPosition = `${state.heroFocalX}% ${state.heroFocalY}%`;
  }
  function syncHeroEditor() {
    const has = !!state.heroPhoto;
    const up = $('heroUploadBtn'), rm = $('heroRemoveBtn'), note = $('heroPhotoNote'),
      fields = $('heroPhotoFields'), alt = $('heroAltInput'), fx = $('heroFocalX'),
      fy = $('heroFocalY'), fxv = $('heroFocalXVal'), fyv = $('heroFocalYVal'),
      fadeSeg = $('heroFadeSeg'), fadeRow = $('heroFadeStrengthRow'),
      fadeStr = $('heroFadeStrength'), fadeStrVal = $('heroFadeStrengthVal');
    if (up) up.textContent = has ? 'Replace' : 'Upload';
    if (rm) rm.hidden = !has;
    if (note) note.hidden = has;
    if (fields) fields.hidden = !has;
    if (alt) alt.value = state.heroAlt || '';
    if (fx) fx.value = String(state.heroFocalX);
    if (fy) fy.value = String(state.heroFocalY);
    if (fxv) fxv.textContent = state.heroFocalX + '%';
    if (fyv) fyv.textContent = state.heroFocalY + '%';
    if (fadeSeg) fadeSeg.querySelectorAll('[data-herofade]').forEach((b) => {
      const on = b.getAttribute('data-herofade') === state.heroFadeMode;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    // Strength only matters when a fade is active.
    if (fadeRow) fadeRow.hidden = state.heroFadeMode === 'none';
    const pct = Math.round(state.heroFadeStrength * 100);
    if (fadeStr) fadeStr.value = String(pct);
    if (fadeStrVal) fadeStrVal.textContent = pct + '%';
    // Portrait zoom.
    const zoom = $('heroZoom'), zoomVal = $('heroZoomVal');
    if (zoom) zoom.value = String(state.heroZoom);
    if (zoomVal) zoomVal.textContent = state.heroZoom + '%';
    // Cipher Field overlay controls.
    const overlaySeg = $('heroOverlaySeg'), overlayRow = $('heroOverlayIntensityRow'),
      overlayInt = $('heroOverlayIntensity'), overlayIntVal = $('heroOverlayIntensityVal');
    if (overlaySeg) overlaySeg.querySelectorAll('[data-overlay]').forEach((b) => {
      const on = b.getAttribute('data-overlay') === state.heroOverlay;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    if (overlayRow) overlayRow.hidden = state.heroOverlay !== 'cipher-field';
    const opct = Math.round(state.heroOverlayIntensity * 100);
    if (overlayInt) overlayInt.value = String(opct);
    if (overlayIntVal) overlayIntVal.textContent = opct + '%';
  }

  /* ---- ARRIVAL GRAPHIC OVERLAY controls (source / upload / transform). ---- */
  function wireOverlay() {
    const seg = $('overlaySourceSeg');
    if (seg) seg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-overlaysrc]');
      if (!btn) return;
      const v = btn.getAttribute('data-overlaysrc');
      if (OVERLAY_SOURCES.indexOf(v) === -1) return;
      state.overlay.source = v;
      applyOverlay(); syncOverlayEditor(); markDirty();
    });
    const up = $('overlayUploadBtn'), file = $('overlayFileInput');
    if (up && file) up.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = safeOverlaySrc(ev.target.result);
        if (src) {
          state.overlay.src = src;
          state.overlay.source = 'upload';
          applyOverlay(); syncOverlayEditor(); markDirty();
          setOverlayNote(true, 'Artwork added — on-device only.');
        } else {
          setOverlayNote(false, 'Unsupported file. Use PNG, WebP or SVG.');
        }
        file.value = '';
      };
      reader.readAsDataURL(f);
    });
    const sliders = [
      ['overlayX', 'x', 0, 100], ['overlayY', 'y', 0, 100],
      ['overlayScale', 'scale', 10, 100], ['overlayOpacityR', 'opacity', 0, 100],
      ['overlayRotate', 'rotate', -180, 180],
    ];
    sliders.forEach(([id, key, lo, hi]) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const n = clampNum(el.value, lo, hi, +el.value || 0);
        state.overlay[key] = (key === 'opacity') ? n / 100 : n;
        applyOverlay(); syncOverlayEditor(); markDirty();
      });
    });
    const blend = $('overlayBlendSeg');
    if (blend) blend.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-overlayblend]');
      if (!btn) return;
      const v = btn.getAttribute('data-overlayblend');
      if (OVERLAY_BLENDS.indexOf(v) === -1) return;
      state.overlay.blend = v;
      applyOverlay(); syncOverlayEditor(); markDirty();
    });
    const reset = $('overlayResetBtn');
    if (reset) reset.addEventListener('click', () => {
      state.overlay = { source: 'off', src: '', x: 50, y: 42, scale: 62, opacity: 0.9, blend: 'normal', rotate: 0 };
      applyOverlay(); syncOverlayEditor(); setOverlayNote(false, ''); markDirty();
    });
  }
  function setOverlayNote(ok, text) {
    const n = $('overlayNote');
    if (!n) return;
    n.textContent = text || '';
    n.hidden = !text;
    n.classList.toggle('is-ok', !!ok);
  }
  function syncOverlayEditor() {
    const o = state.overlay;
    const seg = $('overlaySourceSeg');
    if (seg) seg.querySelectorAll('[data-overlaysrc]').forEach((b) => {
      const on = b.getAttribute('data-overlaysrc') === o.source;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    const controls = $('overlayControls');
    if (controls) controls.hidden = (o.source === 'off');
    const uploadRow = $('overlayUploadRow');
    if (uploadRow) uploadRow.hidden = (o.source !== 'upload');
    const set = (id, val, suffix) => {
      const el = $(id); if (el) el.value = String(val);
      const lbl = $(id + 'Val'); if (lbl) lbl.textContent = val + (suffix || '');
    };
    set('overlayX', Math.round(clampNum(o.x, 0, 100, 50)), '%');
    set('overlayY', Math.round(clampNum(o.y, 0, 100, 42)), '%');
    set('overlayScale', Math.round(clampNum(o.scale, 10, 100, 62)), '%');
    set('overlayOpacityR', Math.round(clamp01(numOr(o.opacity, 0.9)) * 100), '%');
    set('overlayRotate', Math.round(clampNum(o.rotate, -180, 180, 0)), '°');
    const blend = $('overlayBlendSeg');
    if (blend) blend.querySelectorAll('[data-overlayblend]').forEach((b) => {
      const on = b.getAttribute('data-overlayblend') === o.blend;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
  }

  /* ---- ARRIVAL INTRO text fit (auto/manual + measure + manual size). ---- */
  function wireIntroFit() {
    const seg = $('introFitSeg');
    if (seg) seg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-introfit]');
      if (!btn) return;
      state.introFit = btn.getAttribute('data-introfit') === 'manual' ? 'manual' : 'auto';
      fitIntro(); syncIntroEditor(); markDirty();
    });
    const w = $('introWidth');
    if (w) w.addEventListener('input', () => {
      state.introWidth = clampNum(w.value, 16, 52, 26);
      const l = $('introWidthVal'); if (l) l.textContent = Math.round(state.introWidth) + 'ch';
      fitIntro(); markDirty();
    });
    const s = $('introSize');
    if (s) s.addEventListener('input', () => {
      state.introSize = clampNum(s.value, 15, 40, 22);
      const l = $('introSizeVal'); if (l) l.textContent = Math.round(state.introSize) + 'px';
      fitIntro(); markDirty();
    });
  }
  function syncIntroEditor() {
    const seg = $('introFitSeg');
    if (seg) seg.querySelectorAll('[data-introfit]').forEach((b) => {
      const on = b.getAttribute('data-introfit') === state.introFit;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    const sizeRow = $('introSizeRow');
    if (sizeRow) sizeRow.hidden = (state.introFit !== 'manual');
    const w = $('introWidth'), wv = $('introWidthVal');
    if (w) w.value = String(Math.round(state.introWidth));
    if (wv) wv.textContent = Math.round(state.introWidth) + 'ch';
    const s = $('introSize'), sv = $('introSizeVal');
    if (s) s.value = String(Math.round(state.introSize));
    if (sv) sv.textContent = Math.round(state.introSize) + 'px';
  }

  /* ---- COLOURS: editable role colours over the Cipher-derived harmony.
     Overrides are stored as hex and win over the derived tones; reset clears
     them back to the Cipher colours. ---- */
  const ROLE_KEYS = ['root', 'expression', 'radiance'];
  function wireColors() {
    const inputs = { root: $('roleColorRoot'), expression: $('roleColorExpression'), radiance: $('roleColorRadiance') };
    ROLE_KEYS.forEach((which) => {
      const inp = inputs[which];
      if (!inp) return;
      inp.addEventListener('input', () => {
        state.roleOverrides[which] = inp.value;
        applyFieldPalette(); renderSections(); applyComposition();
        if (state.route.view === 'room') renderRoom(state.route.roomIdx);
      });
    });
    const reset = $('resetColorsBtn');
    if (reset) reset.addEventListener('click', () => {
      state.roleOverrides = { root: null, expression: null, radiance: null };
      applyFieldPalette(); syncColorInputs(); renderSections(); applyComposition();
      if (state.route.view === 'room') renderRoom(state.route.roomIdx);
      markDirty();
    });
  }
  function syncColorInputs() {
    const inputs = { root: $('roleColorRoot'), expression: $('roleColorExpression'), radiance: $('roleColorRadiance') };
    ROLE_KEYS.forEach((which) => {
      const inp = inputs[which];
      if (inp) inp.value = toHex(activeRoleColor(which));
    });
  }

  function applyAutoSignatures() {
    if (state.sigmode !== 'auto') return;
    state.sections.forEach((s) => { s.role = AUTO_ROLE[s.sig] || 'inset'; });
  }

  /* =========================================================
     GENERIC RADIO GROUPS
     ========================================================= */
  function wireRadioGroups() {
    document.querySelectorAll('[data-control]').forEach((group) => {
      const key = group.dataset.control;
      group.querySelectorAll('[role="radio"]').forEach((btn) => {
        btn.addEventListener('click', () => selectRadio(group, btn, key));
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRadio(group, btn, key); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moveRadio(group, btn, 1, key); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moveRadio(group, btn, -1, key); }
        });
        btn.tabIndex = btn.getAttribute('aria-checked') === 'true' ? 0 : -1;
      });
    });
  }
  function moveRadio(group, current, dir, key) {
    const btns = [...group.querySelectorAll('[role="radio"]')];
    let idx = btns.indexOf(current) + dir;
    if (idx < 0) idx = btns.length - 1;
    if (idx >= btns.length) idx = 0;
    selectRadio(group, btns[idx], key);
    btns[idx].focus();
  }
  function selectRadio(group, btn, key) {
    group.querySelectorAll('[role="radio"]').forEach((b) => {
      const on = b === btn;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    state[key] = btn.dataset.value;
    if (key === 'sigmode') { applyAutoSignatures(); renderSections(); }
    else if (key === 'palette' || key === 'photo' || key === 'sigil' || key === 'torus') { renderSections(); }
    else if (key === 'texture') { syncAdjustToState(); }
    applyComposition();
    if (key === 'palette' || key === 'hero' || key === 'texture') playTransition();
    markDirty();
  }

  function setGroup(key, value) {
    const group = document.querySelector(`[data-control="${key}"]`);
    if (!group) return;
    group.querySelectorAll('[role="radio"]').forEach((b) => {
      const on = b.dataset.value === value;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
  }
  function syncControlsToState() {
    ['intensity', 'sigil', 'torus', 'texture', 'transition', 'hero', 'palette', 'photo', 'sigmode'].forEach((k) => setGroup(k, state[k]));
    $('in-name').value = state.name;
    $('in-tag').value = state.tagline;
    syncAdjustToState();
  }

  /* =========================================================
     CIPHER ADJUST SLIDERS (zoom + opacity)
     ========================================================= */
  function syncAdjustToState() {
    const z = $('cipherZoom'), o = $('cipherOpacity'), zv = $('zoomVal'), ov = $('opacityVal');
    if (z) { z.value = String(Math.round(manualZoom)); z.disabled = (state.texture !== 'inside'); }
    if (zv) zv.textContent = Math.round(manualZoom) + '%';
    if (o) o.value = String(Math.round(manualOpacity * 100));
    if (ov) ov.textContent = Math.round(manualOpacity * 100) + '%';
    const row = $('cipherAdjust');
    if (row) row.style.opacity = (state.texture === 'off') ? '0.45' : '1';
  }
  function wireAdjust() {
    const z = $('cipherZoom'), o = $('cipherOpacity');
    if (z) z.addEventListener('input', () => {
      manualZoom = Math.max(120, Math.min(800, +z.value || 420));
      if ($('zoomVal')) $('zoomVal').textContent = Math.round(manualZoom) + '%';
      if (field) field.crop = null;   // manual zoom overrides the deterministic crop
      applyCipherWeave();
    });
    if (o) o.addEventListener('input', () => {
      manualOpacity = Math.max(0, Math.min(1, (+o.value || 0) / 100));
      if ($('opacityVal')) $('opacityVal').textContent = Math.round(manualOpacity * 100) + '%';
      applyCipherWeave();
    });
  }

  /* =========================================================
     IDENTITY text bindings + viewport + recast
     ========================================================= */
  function wireTextBindings() {
    const nameInput = $('in-name');
    const tagInput = $('in-tag');
    nameInput.value = state.name;
    tagInput.value = state.tagline;
    nameInput.addEventListener('input', () => {
      state.name = nameInput.value;
      vizName.textContent = nameInput.value || 'Untitled';
      vizFootName.textContent = nameInput.value || 'Untitled';
    });
    tagInput.addEventListener('input', () => {
      state.tagline = tagInput.value;
      vizTag.textContent = tagInput.value;
    });
  }
  function wireViewToggle() {
    document.querySelectorAll('.viewbtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viewbtn').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        state.view = btn.dataset.view;
        stage.classList.toggle('is-mobile', state.view === 'mobile');
        requestAnimationFrame(() => { drawFieldTorus(); fitIntro(); });
      });
    });
  }
  function wireRegen() {
    $('regenBtn').addEventListener('click', () => {
      // With no engine in this frame, "Recast" only re-cuts the placeholder demo
      // marks (birth-data-free). Real fields arrive via Load Field JSON / Studio.
      if (state.cipher === 'placeholder' || !field) {
        state.seed = randomSeed();
        buildDemoField();
        torusPoints = null;
      }
      renderFieldCard();
      buildCopyControls();
      buildImageControls();
      renderSections();
      applyComposition();
      playTransition();
      const card = $('fieldCard');
      card.animate(
        [{ boxShadow: '0 0 0 0 rgba(199,164,79,.5)' }, { boxShadow: '0 0 0 8px rgba(199,164,79,0)' }],
        { duration: 620, easing: 'cubic-bezier(.22,.61,.36,1)' });
    });
  }
  function randomSeed() {
    const initials = (state.name || 'CU').trim().split(/\s+/).map((w) => w[0] || '').join('').toUpperCase().slice(0, 3) || 'CU';
    const n1 = Math.floor(Math.random() * 9) + 1;
    const n2 = Math.floor(Math.random() * 900) + 100;
    return `${initials}-${n1}·${n2}`;
  }

  /* =========================================================
     PUBLIC hOMepage PREVIEW toggle
     ========================================================= */
  function wirePublicPreview() {
    const btn = $('publicPreviewBtn');
    const app = $('app');
    if (!btn || !app) return;
    btn.addEventListener('click', () => {
      const on = !app.classList.contains('is-public-preview');
      app.classList.toggle('is-public-preview', on);
      btn.textContent = on ? 'Return to Fieldprint' : 'Preview public hOMepage';
      requestAnimationFrame(drawFieldTorus);
    });
  }

  /* =========================================================
     STUDIO ADAPTER — hydrate from the sanitized public model
     ========================================================= */
  function safeMediaSrc(s) {
    s = (typeof s === 'string') ? s.trim() : '';
    return (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(s) || /^https:\/\//i.test(s)) ? s : '';
  }
  function sanitizeImage(img) {
    // Defense in depth: Studio already filtered private images + unsafe src via
    // phPublicRoomImage, but re-validate here so nothing unsafe can render.
    if (!img || typeof img !== 'object') return null;
    if (img.visibility === 'private') return null;
    const src = safeMediaSrc(img.src);
    if (!src) return null;
    const ROLES = ['inset', 'full-bleed', 'background', 'artifact', 'hero'];
    const role = (ROLES.indexOf(img.role) !== -1) ? img.role : 'inset';
    const out = { src: src, role: role, alt: (typeof img.alt === 'string') ? img.alt : '' };
    if (typeof img.focalX === 'number') out.focalX = img.focalX;
    if (typeof img.focalY === 'number') out.focalY = img.focalY;
    if (typeof img.opacity === 'number') out.opacity = img.opacity;
    if (typeof img.blend === 'string') out.blend = img.blend;
    return out;
  }

  function hydrateFromModel(model) {
    if (!model || typeof model !== 'object') return;
    const id = (model.identity && typeof model.identity === 'object') ? model.identity : {};
    const hero = (model.hero && typeof model.hero === 'object') ? model.hero : {};
    if (id.name) state.name = String(id.name);
    state.heroPhoto = safeMediaSrc(id.photo);
    // A fresh model never inherits the previous portrait's alt/focal framing.
    state.heroAlt = state.heroPhoto ? (typeof id.alt === 'string' ? id.alt : '') : '';
    state.heroFocalX = 50;
    state.heroFocalY = 50;
    // Transparency is re-derived from the new portrait (async); assume opaque
    // until the decode completes so no stale alpha framing carries over.
    state.heroPhotoHasAlpha = false;
    if (state.heroPhoto) detectHeroAlpha(state.heroPhoto);
    // A fresh model never inherits the previous portrait's fade framing.
    state.heroFadeMode = 'none';
    state.heroFadeStrength = 0.6;
    // A fresh model resets zoom + the optional Cipher Field treatment to off.
    state.heroZoom = 100;
    state.heroOverlay = 'off';
    state.heroOverlayIntensity = 0.5;
    // Imported palettes replace any prior user colour overrides.
    state.roleOverrides = { root: null, expression: null, radiance: null };
    if (hero.intro) state.tagline = String(hero.intro);
    if (hero.cta) state.heroCta = String(hero.cta);

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    state.sections = SECTION_KEYS.map((key, i) => {
      const r = (rooms[i] && typeof rooms[i] === 'object') ? rooms[i] : {};
      const def = SECTIONS[i];
      const arts = [];
      (Array.isArray(r.highlights) ? r.highlights : []).forEach((h) => { if (h) arts.push({ tag: 'Signal', title: String(h), note: '' }); });
      (Array.isArray(r.insights) ? r.insights : []).forEach((x) => { if (x) arts.push({ tag: 'Insight', title: String(x), note: '' }); });
      const label = r.label || r.eyebrow || def.eyebrow;
      return {
        key: key, sig: key,
        eyebrow: r.eyebrow || r.label || def.eyebrow,
        title: r.heading || r.label || def.title,
        body: r.body || def.body,
        role: AUTO_ROLE[key],
        imgRole: null,
        enter: 'Enter ' + label,
        narrative: r.summary || r.body || def.narrative,
        artifacts: arts.length ? arts : def.artifacts,
        prompt: r.closing || def.prompt,
        image: sanitizeImage(r.image),
      };
    });

    const roles = (model.palette && model.palette.roles && typeof model.palette.roles === 'object')
      ? { root: model.palette.roles.root, expression: model.palette.roles.expression, radiance: model.palette.roles.radiance }
      : null;
    const c = (model.cipher && typeof model.cipher === 'object') ? model.cipher : null;
    const cipherSvgSafe = c ? scrubSvg(c.svg) : '';
    const hasCipher = !!cipherSvgSafe;

    if (roles || hasCipher) {
      const hue = (c && typeof c.hue === 'number' && isFinite(c.hue)) ? ((c.hue % 360) + 360) % 360 : 80;
      field = {
        seedLabel: 'om-field',
        roles: roles || DEFAULT_ROLES,
        primaryHue: hue,
        secondaryHue: (hue + 180) % 360,
        points: 9,
        lifePath: 2,
        radial: hasCipher ? cipherSvgSafe : makeSigil('om-field', 0, { size: 200, stroke: 1.6 }),
        crop: (c && c.crop && typeof c.crop === 'object') ? { x: c.crop.x, y: c.crop.y, scale: c.crop.scale } : null,
      };
      state.cipher = hasCipher ? 'engine' : 'placeholder';
      state.seed = 'om-field';
      state.palette = 'om-field';
      torusPoints = null;
      if (field.crop && typeof field.crop.scale === 'number') manualZoom = Math.max(120, Math.min(800, field.crop.scale));
    }

    if (c) {
      const MODES = ['off', 'subtle', 'inside', 'wallpaper'];
      if (MODES.indexOf(c.mode) !== -1) state.texture = c.mode;
      const INT = { soft: 'quiet', medium: 'balanced', bold: 'luminous' };
      if (INT[c.intensity]) state.intensity = INT[c.intensity];
      if (typeof c.opacity === 'number' && isFinite(c.opacity)) manualOpacity = Math.max(0, Math.min(1, c.opacity));
    } else if (!hasCipher && !roles) {
      // No cipher at all → keep the demo field but honor an 'off' etc. later.
    }

    const TRANS = ['none', 'fade', 'threshold'];
    if (TRANS.indexOf(model.transition) !== -1) state.transition = model.transition;

    state.hydrated = true;
  }

  /* Non-destructive content prefill from the Studio FieldPrint editor tab.
     Merges ONLY the named text/artifact fields into matching sections by key.
     Hero framing, palette/roleOverrides, cipher, images, section role/imgRole,
     and any field not present in the payload are left exactly as they are.
     Returns the number of fields actually applied. */
  function applyPrefill(sections, arrival) {
    let applied = 0;
    // Global Arrival welcome → the hero identity sentence (tagline) and the
    // hero entry CTA. This is an explicitly authorised overwrite of those two
    // hero fields: a non-empty message/CTA sent from Studio replaces whatever
    // the Builder held. Everything else — portrait, palette, framing, images,
    // layout and unsent fields — is left untouched.
    if (arrival && typeof arrival === 'object') {
      const msg = typeof arrival.message === 'string' ? arrival.message.trim() : '';
      if (msg) { state.tagline = msg; applied++; }
      const cta = typeof arrival.cta === 'string' ? arrival.cta.trim() : '';
      if (cta) { state.heroCta = cta; applied++; }
    }
    if (!Array.isArray(sections) || !Array.isArray(state.sections)) return applied;
    const TEXT_FIELDS = ['eyebrow', 'title', 'body', 'narrative', 'prompt'];
    sections.forEach((incoming) => {
      if (!incoming || typeof incoming !== 'object') return;
      const target = state.sections.find((s) => s && s.key === incoming.key);
      if (!target) return;
      TEXT_FIELDS.forEach((f) => {
        if (incoming[f] != null) { target[f] = String(incoming[f]); applied++; }
      });
      if (incoming.artifacts != null && Array.isArray(incoming.artifacts)) {
        const mapped = incoming.artifacts
          .filter((a) => a && (a.title || a.note))
          .map((a) => ({
            tag: (typeof a.tag === 'string' && a.tag) ? a.tag : 'Signal',
            title: a.title != null ? String(a.title) : '',
            note: a.note != null ? String(a.note) : '',
          }));
        // Only count as an applied field when real artifact content is present,
        // so the success feedback never over-reports empty payloads.
        if (mapped.length) { target.artifacts = mapped; applied++; }
      }
    });
    return applied;
  }

  function fullRender() {
    renderFieldCard();
    applyAutoSignatures();
    buildCopyControls();
    buildImageControls();
    renderSections();
    syncControlsToState();
    syncHeroEditor();
    syncOverlayEditor();
    syncIntroEditor();
    syncColorInputs();
    applyComposition();
    requestAnimationFrame(observeReveals);
    playTransition();
  }

  function setLoadNote(ok, text) {
    const n = $('loadNote');
    if (!n) return;
    n.textContent = text;
    n.classList.toggle('is-ok', !!ok);
  }

  /* JSON load — read the file, hand the raw text to Studio for normalization
     through the privacy firewall; Studio reposts a sanitized model. */
  function wireJsonLoad() {
    const btn = $('loadJsonBtn');
    const input = $('loadJsonInput');
    if (!btn || !input) return;
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const raw = ev.target.result;
        if (embedded) {
          postToParent({ type: 'fieldprint-import-json', raw: raw });
          setLoadNote(false, 'Loading through the Studio privacy firewall…');
        } else {
          setLoadNote(false, 'Open Fieldprint inside CommonUnity Studio to load a real Field JSON safely.');
        }
        input.value = '';
      };
      reader.readAsText(file);
    });
  }

  /* =========================================================
     postMessage bridge (same-origin Studio parent)
     ========================================================= */
  function postToParent(msg) {
    if (!embedded) return;
    try { window.parent.postMessage(msg, window.location.origin); } catch (_) {}
  }
  function wireBridge() {
    window.addEventListener('message', async (e) => {
      if (e.source !== window.parent) return;
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'fieldprint-model' && d.model) {
        hydrateFromModel(d.model);
        fullRender();
        setLoadNote(true, 'Live Fieldprint from your Studio data.');
        // Re-baseline to the imported field, then restore a matching draft under
        // the Studio-supplied owner key (stable across reloads).
        establishBaselineAndRestore(d.owner);
      } else if (d.type === 'fieldprint-prefill') {
        // Non-destructive content handoff from the Studio FieldPrint editor.
        // On a cold reload no model was hydrated this load, so we may be sitting
        // on built-in demo defaults under the wrong owner. Adopt the owner the
        // parent targeted and RESTORE that person's saved draft first — otherwise
        // we'd merge onto defaults and then persist those defaults over the real
        // draft. loadDraft() only applies a record whose owner matches, so a
        // foreign draft is never read into this identity. We never hydrate a full
        // model and never import raw here.
        if (d.owner != null && d.owner !== '' && String(d.owner) !== currentOwner) {
          currentOwner = String(d.owner);
          baseline = snapshot();          // safe reset baseline for this identity
          await loadDraft();              // restores the matching saved draft, if any
        }
        const applied = applyPrefill(d.sections, d.arrival);
        if (applied) {
          // Refresh the hero preview (identity sentence + entry CTA, rendered by
          // applyComposition) and the Identity text inputs so an explicitly sent
          // Arrival is actually visible — updating state alone left the old
          // tagline and CTA on screen.
          renderSections();
          syncControlsToState();
          syncHeroEditor();
          applyComposition();
          markDirty();
          setLoadNote(true, 'Applied ' + applied + ' field' + (applied === 1 ? '' : 's') + ' from Studio — your framing and images are unchanged.');
          // Persist immediately under the correct owner so the merge survives an
          // actual page refresh, not just same-frame memory.
          try { await flushSave(); } catch (_) {}
        }
        postToParent({ type: 'fieldprint-prefilled', applied: applied });
      } else if (d.type === 'fieldprint-flush') {
        // Studio is closing the overlay: commit any queued autosave, then ack so
        // the parent can safely release (blank) the iframe without data loss.
        // Only write when edits are actually pending — never fabricate a draft.
        const ack = () => postToParent({ type: 'fieldprint-flushed' });
        if (saveTimer) Promise.resolve(flushSave()).catch(() => {}).then(ack);
        else ack();
      }
    });
  }

  /* =========================================================
     THRESHOLD FADE — reveal-on-scroll inside the stage scroller
     ========================================================= */
  let io = null;
  const NODE_INDEX = { make: 0, perceive: 1, alive: 2, here: 3 };
  function observeReveals() {
    if (io) io.disconnect();
    const root = $('stageScroll');
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        if (!reduceMotion) e.target.classList.add('is-in');
        const key = e.target.dataset.key;
        if (key && key in NODE_INDEX) {
          const idx = NODE_INDEX[key];
          if (idx !== activeNodeIdx) {
            activeNodeIdx = idx;
            document.querySelectorAll('.viz-section.is-active-node').forEach((s) => s.classList.remove('is-active-node'));
            e.target.classList.add('is-active-node');
            if (!torusRaf) drawFieldTorus();
          }
        }
      });
    }, { root, threshold: 0.12 });
    document.querySelectorAll('.viz .reveal').forEach((el) => io.observe(el));
  }

  // Stop the torus loop whenever its canvas host leaves the scroller viewport,
  // and resume when it re-enters. A single long-lived observer — no per-open
  // accumulation.
  let torusIO = null;
  function observeTorusVisibility() {
    const host = $('fieldTorus');
    if (!host || typeof IntersectionObserver === 'undefined') return;
    if (torusIO) torusIO.disconnect();
    torusIO = new IntersectionObserver((entries) => {
      torusVisible = entries.some((e) => e.isIntersecting);
      if (!torusVisible) stopTorus();
      else if (shouldAnimateTorus()) wakeTorus();
    }, { root: $('stageScroll') });
    torusIO.observe(host);
  }

  /* ---------- utils ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

  /* =========================================================
     ON-DEVICE DRAFT PERSISTENCE
     A private, versioned, public-safe draft saved to THIS browser only —
     never a cloud/account, never published. Text + settings live in
     localStorage; image data URLs live in IndexedDB (they can exceed the
     localStorage quota). Raw imported JSON and any private/birth/Gene-Keys
     fields are never persisted, and PRIVATE room images are omitted entirely
     — public/private filtering is enforced on both save and load. A schema
     version + an owner fingerprint prevent loading a stale/foreign draft.
     ========================================================= */
  const DRAFT_SCHEMA = 1;
  const DRAFT_KEY = 'commonunity.fieldprint.draft.v1';
  const IDB_NAME = 'commonunity-fieldprint';
  const IDB_STORE = 'images';
  let baseline = null;         // in-memory snapshot of the imported/demo field (incl images)
  let currentOwner = 'demo';   // fingerprint of the active field's identity/source
  let saveTimer = 0;
  let hasSavedDraft = false;

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const numOr = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const clampNum = (v, lo, hi, d) => Math.max(lo, Math.min(hi, numOr(+v, d)));
  function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h.toString(36); }

  // Fingerprint the active identity/source so a draft never bleeds across people.
  function computeOwner() {
    const sig = [
      state.name || '',
      (state.cipher === 'engine' && field) ? Math.round(field.primaryHue || 0) : 'demo',
      (field && field.radial) ? String(field.radial).length : 0,
    ].join('|');
    return djb2(sig);
  }

  // The public-safe, editable composition — the ONLY thing we ever persist.
  function snapshot() {
    return {
      name: state.name,
      tagline: state.tagline,
      hero: {
        mode: state.hero, photo: state.photo, alt: state.heroAlt,
        cta: state.heroCta,
        focalX: state.heroFocalX, focalY: state.heroFocalY,
        zoom: state.heroZoom,
        fadeMode: state.heroFadeMode, fadeStrength: state.heroFadeStrength,
        src: state.heroPhoto || '',
        // Cipher Field treatment recipe — structured so a later stUdio Digital
        // Vista workflow can re-open and extend it without a migration.
        overlay: {
          treatment: state.heroOverlay === 'cipher-field' ? 'cipher-field' : 'off',
          version: (window.CipherField && window.CipherField.VERSION) || 1,
          intensity: state.heroOverlayIntensity,
          palette: state.palette,
        },
      },
      introFit: state.introFit, introWidth: state.introWidth, introSize: state.introSize,
      overlay: {
        source: state.overlay.source, src: state.overlay.src || '',
        x: state.overlay.x, y: state.overlay.y, scale: state.overlay.scale,
        opacity: state.overlay.opacity, blend: state.overlay.blend, rotate: state.overlay.rotate,
      },
      sections: state.sections.map((s) => ({
        key: s.key, eyebrow: s.eyebrow, title: s.title, body: s.body,
        narrative: s.narrative, prompt: s.prompt, enter: s.enter, imgRole: s.imgRole || null,
        textSize: s.textSize || 'medium',
        artifacts: Array.isArray(s.artifacts)
          ? s.artifacts.map((a) => ({ tag: a.tag || '', title: a.title || '', note: a.note || '' }))
          : [],
        image: s.image ? {
          src: s.image.src || '', role: s.image.role || 'inset', alt: s.image.alt || '',
          visibility: s.image.visibility || 'public',
          focalX: s.image.focalX, focalY: s.image.focalY, opacity: s.image.opacity, blend: s.image.blend,
        } : null,
      })),
      roleOverrides: { ...state.roleOverrides },
      fieldset: {
        intensity: state.intensity, sigil: state.sigil, torus: state.torus, texture: state.texture,
        transition: state.transition, palette: state.palette, photo: state.photo, sigmode: state.sigmode,
        zoom: manualZoom, opacity: manualOpacity,
      },
    };
  }

  // Apply a composition back onto state. Never touches the cipher/field engine
  // (that comes from the imported model / demo, applied before this overlay).
  function applySnapshot(s) {
    if (!s) return;
    if (s.name != null) state.name = String(s.name);
    if (s.tagline != null) state.tagline = String(s.tagline);
    const h = s.hero || {};
    if (h.cta != null) state.heroCta = String(h.cta);
    if (h.mode) state.hero = h.mode;
    if (h.photo) state.photo = h.photo;
    state.heroAlt = h.alt || '';
    state.heroFocalX = numOr(h.focalX, 50);
    state.heroFocalY = numOr(h.focalY, 50);
    // Absent in pre-overlay drafts → default (no zoom), so old pages load unchanged.
    state.heroZoom = Math.max(100, Math.min(200, numOr(h.zoom, 100)));
    state.heroFadeMode = ['none', 'text', 'edges'].indexOf(h.fadeMode) !== -1 ? h.fadeMode : 'none';
    state.heroFadeStrength = clamp01(numOr(h.fadeStrength, 0.6));
    // Cipher Field recipe (absent → off). CipherField normalizes unknown shapes.
    const rec = (window.CipherField && window.CipherField.normalizeRecipe)
      ? window.CipherField.normalizeRecipe(h.overlay)
      : { treatment: 'off', intensity: 0.5 };
    state.heroOverlay = rec.treatment === 'cipher-field' ? 'cipher-field' : 'off';
    state.heroOverlayIntensity = clamp01(numOr(rec.intensity, 0.5));
    state.heroPhoto = safeMediaSrc(h.src) || '';
    state.heroPhotoHasAlpha = false;
    if (state.heroPhoto) detectHeroAlpha(state.heroPhoto);
    if (s.introFit != null) state.introFit = s.introFit === 'manual' ? 'manual' : 'auto';
    if (s.introWidth != null) state.introWidth = clampNum(s.introWidth, 16, 52, 26);
    if (s.introSize != null) state.introSize = clampNum(s.introSize, 15, 40, 22);
    if (s.overlay) {
      const o = s.overlay;
      state.overlay.source = OVERLAY_SOURCES.indexOf(o.source) !== -1 ? o.source : 'off';
      // Overlay uploads are re-validated (scrubbed) on the way back in.
      state.overlay.src = (state.overlay.source === 'upload') ? (safeOverlaySrc(o.src) || '') : '';
      if (!state.overlay.src && state.overlay.source === 'upload') state.overlay.source = 'off';
      state.overlay.x = clampNum(o.x, 0, 100, 50);
      state.overlay.y = clampNum(o.y, 0, 100, 42);
      state.overlay.scale = clampNum(o.scale, 10, 100, 62);
      state.overlay.opacity = clamp01(numOr(o.opacity, 0.9));
      state.overlay.blend = OVERLAY_BLENDS.indexOf(o.blend) !== -1 ? o.blend : 'normal';
      state.overlay.rotate = clampNum(o.rotate, -180, 180, 0);
    }
    if (Array.isArray(s.sections)) {
      s.sections.forEach((ss, i) => {
        const tgt = state.sections[i];
        if (!tgt || !ss) return;
        if (ss.eyebrow != null) tgt.eyebrow = String(ss.eyebrow);
        if (ss.title != null) tgt.title = String(ss.title);
        if (ss.body != null) tgt.body = String(ss.body);
        if (ss.narrative != null) tgt.narrative = String(ss.narrative);
        if (ss.prompt != null) tgt.prompt = String(ss.prompt);
        if (ss.enter != null) tgt.enter = String(ss.enter);
        // Only tag/title/note strings are copied — never any raw/private field.
        if (Array.isArray(ss.artifacts)) {
          tgt.artifacts = ss.artifacts.map((a) => ({
            tag: String((a && a.tag) || ''),
            title: String((a && a.title) || ''),
            note: String((a && a.note) || ''),
          }));
        }
        tgt.imgRole = ss.imgRole || null;
        tgt.textSize = ['small', 'medium', 'large'].indexOf(ss.textSize) !== -1 ? ss.textSize : 'medium';
        // sanitizeImage re-runs privacy/safety filtering (defense in depth).
        tgt.image = (ss.image && ss.image.src) ? sanitizeImage(ss.image) : null;
      });
    }
    if (s.roleOverrides) {
      state.roleOverrides = {
        root: s.roleOverrides.root || null,
        expression: s.roleOverrides.expression || null,
        radiance: s.roleOverrides.radiance || null,
      };
    }
    const f = s.fieldset || {};
    ['intensity', 'sigil', 'torus', 'texture', 'transition', 'palette', 'photo', 'sigmode'].forEach((k) => { if (f[k]) state[k] = f[k]; });
    if (typeof f.zoom === 'number') manualZoom = Math.max(120, Math.min(800, f.zoom));
    if (typeof f.opacity === 'number') manualOpacity = clamp01(f.opacity);
  }

  // Split a snapshot into localStorage-safe metadata + an images map for IDB.
  // PRIVATE images are dropped from both — never written to disk.
  function toStorable(snap) {
    const meta = JSON.parse(JSON.stringify(snap));
    const images = {};
    if (meta.hero && meta.hero.src) { images.hero = meta.hero.src; meta.hero.src = ''; meta.hero.hasImage = true; }
    else if (meta.hero) meta.hero.hasImage = false;
    // Uploaded overlay artwork is on-device only (IDB), never in the published
    // model. Split its data-URL out like other images so localStorage stays lean.
    if (meta.overlay && meta.overlay.source === 'upload' && meta.overlay.src) {
      images.overlay = meta.overlay.src; meta.overlay.src = ''; meta.overlay.hasImage = true;
    } else if (meta.overlay) { meta.overlay.hasImage = false; }
    meta.sections.forEach((ss, i) => {
      if (!ss.image) return;
      if (ss.image.visibility === 'private') { ss.image = null; return; }  // never persist private media
      if (ss.image.src) { images['room' + i] = ss.image.src; ss.image.src = ''; ss.image.hasImage = true; }
    });
    return { meta, images };
  }
  function fromStorable(meta, images) {
    const snap = meta;
    if (snap.hero && snap.hero.hasImage && images && images.hero) snap.hero.src = images.hero;
    if (snap.overlay && snap.overlay.hasImage && images && images.overlay) snap.overlay.src = images.overlay;
    (snap.sections || []).forEach((ss, i) => {
      if (ss && ss.image && ss.image.hasImage && images && images['room' + i]) ss.image.src = images['room' + i];
    });
    return snap;
  }

  /* ---- IndexedDB (image blobs) ---- */
  function idbOpen() {
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function idbPutImages(owner, images) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(images, owner);
      tx.oncomplete = () => { db.close(); res(true); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    });
  }
  async function idbGetImages(owner) {
    try {
      const db = await idbOpen();
      return await new Promise((res) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const rq = tx.objectStore(IDB_STORE).get(owner);
        rq.onsuccess = () => { db.close(); res(rq.result || {}); };
        rq.onerror = () => { db.close(); res({}); };
      });
    } catch (_) { return {}; }
  }
  async function idbDelImages(owner) {
    try {
      const db = await idbOpen();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(owner);
      await new Promise((res) => { tx.oncomplete = res; tx.onerror = res; });
      db.close();
    } catch (_) {}
  }

  /* ---- status + affordances ---- */
  function setSaveStatus(st, customText) {
    const el = $('saveStatus');
    if (!el) return;
    el.dataset.state = st;
    const map = {
      idle: 'Saves to this device', dirty: 'Unsaved changes', saving: 'Saving…',
      saved: 'Saved on this device', error: "Couldn't save on this device",
    };
    el.textContent = customText || map[st] || '';
  }
  function updateSaveAffordances() {
    const rv = $('revertSavedBtn');
    if (rv) rv.hidden = !hasSavedDraft;
  }

  /* ---- save / autosave ---- */
  async function saveDraft() {
    setSaveStatus('saving');
    try {
      const { meta, images } = toStorable(snapshot());
      const record = { schema: DRAFT_SCHEMA, owner: currentOwner, savedAt: Date.now(), data: meta };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(record));
      } catch (_) {
        setSaveStatus('error', "Couldn't save — this browser's storage is full");
        return;
      }
      let imagesOk = true;
      const hasImages = Object.keys(images).length > 0;
      if (hasImages) { try { await idbPutImages(currentOwner, images); } catch (_) { imagesOk = false; } }
      else { await idbDelImages(currentOwner); }
      hasSavedDraft = true;
      // Be honest if images could not be stored on this device.
      setSaveStatus('saved', imagesOk ? '' : 'Saved on this device (text only — images too large to store here)');
      updateSaveAffordances();
    } catch (_) {
      setSaveStatus('error');
    }
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 800); }
  function markDirty() { setSaveStatus('dirty'); scheduleSave(); }
  function flushSave() { clearTimeout(saveTimer); return saveDraft(); }

  async function loadDraft() {
    let record;
    try { record = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { record = null; }
    if (!record || record.schema !== DRAFT_SCHEMA) return false;   // schema mismatch → ignore
    if (record.owner !== currentOwner) return false;               // foreign identity/source → never load
    const images = await idbGetImages(currentOwner);
    applySnapshot(fromStorable(record.data, images));
    fullRender();
    hasSavedDraft = true;
    setSaveStatus('saved');
    updateSaveAffordances();
    return true;
  }

  // Capture the imported/demo field as the reset baseline, then restore any
  // matching on-device draft on top of it.
  async function establishBaselineAndRestore(ownerOverride) {
    baseline = snapshot();
    // Prefer an owner key supplied by the embedding Studio (stable across cold
    // reloads and page refreshes); fall back to the locally-derived fingerprint
    // for the standalone Builder. Both sides must agree so a saved draft is
    // found again on the next open.
    currentOwner = (ownerOverride != null && ownerOverride !== '')
      ? String(ownerOverride) : computeOwner();
    // Does a matching draft already exist? (drives Revert affordance)
    let record = null;
    try { record = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) {}
    hasSavedDraft = !!(record && record.schema === DRAFT_SCHEMA && record.owner === currentOwner);
    const restored = await loadDraft();
    if (!restored) { setSaveStatus('idle'); updateSaveAffordances(); }
  }

  async function revertToSaved() {
    clearTimeout(saveTimer);  // cancel any queued autosave so it can't overwrite the revert
    const ok = await loadDraft();
    if (!ok) setSaveStatus('idle');
  }
  async function resetToImported() {
    if (!baseline) return;
    clearTimeout(saveTimer);  // cancel any queued autosave so it can't resurrect the cleared draft
    applySnapshot(baseline);
    fullRender();
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    await idbDelImages(currentOwner);
    hasSavedDraft = false;
    setSaveStatus('idle');
    updateSaveAffordances();
  }

  function baseEyebrow(i) {
    if (baseline && baseline.sections && baseline.sections[i]) return baseline.sections[i].eyebrow;
    return SECTIONS[i] ? SECTIONS[i].eyebrow : '';
  }

  function wireSave() {
    const s = $('saveBtn');
    if (s) s.addEventListener('click', () => flushSave());
    const rv = $('revertSavedBtn');
    if (rv) rv.addEventListener('click', () => {
      if (window.confirm('Revert to the last version saved on this device? Unsaved changes will be lost.')) revertToSaved();
    });
    const ri = $('resetImportedBtn');
    if (ri) ri.addEventListener('click', () => {
      if (window.confirm('Reset to the imported Fieldprint? This clears your on-device draft and all edits.')) resetToImported();
    });
    // Debounced autosave on any native input/change in the control rail. Custom
    // radio/segment buttons call markDirty() directly from their handlers.
    const panel = $('panelScroll');
    if (panel) ['input', 'change'].forEach((ev) => panel.addEventListener(ev, markDirty));
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    if (reduceMotion) { const note = $('motionNote'); if (note) note.hidden = false; }
    // When embedded in Studio, reserve top-right space so the iframe's own
    // actions never collide with the overlay's floating Close control.
    if (embedded) { const app = $('app'); if (app) app.classList.add('is-embedded'); }
    // Start on the birth-data-free demo field until Studio posts a real model.
    buildDemoField();
    renderFieldCard();
    applyAutoSignatures();
    buildCopyControls();
    buildImageControls();
    renderSections();
    wireRadioGroups();
    wireTextBindings();
    wireViewToggle();
    wireRegen();
    wireAdjust();
    wirePublicPreview();
    wireJsonLoad();
    wireHeroPhoto();
    wireOverlay();
    wireIntroFit();
    wireColors();
    wireSave();
    wireBridge();
    syncControlsToState();
    syncHeroEditor();
    syncOverlayEditor();
    syncIntroEditor();
    syncColorInputs();
    applyComposition();
    requestAnimationFrame(observeReveals);
    // Capture the demo field as baseline, then restore any on-device draft.
    establishBaselineAndRestore();

    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => { drawFieldTorus(); fitIntro(); });
    });
    const scroller = $('stageScroll');
    if (scroller) scroller.addEventListener('scroll', wakeTorus, { passive: true });
    ['pointermove', 'pointerdown'].forEach((ev) => window.addEventListener(ev, wakeTorus, { passive: true }));

    // Pause all animation when the tab is backgrounded or the field scrolls
    // offscreen; resume when it returns. shouldAnimateTorus() also consults
    // these flags, so the loop self-terminates cleanly.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopTorus();
      else if (shouldAnimateTorus()) wakeTorus();
    });
    observeTorusVisibility();

    // Tell Studio we're ready to receive the sanitized model.
    if (embedded) postToParent({ type: 'fieldprint-ready' });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
