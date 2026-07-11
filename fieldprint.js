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
    eyebrow: 'CommonUnity',
    heroPhoto: '',
    heroAlt: '',
    heroPhotoHasAlpha: false,
    heroFocalX: 50,
    heroFocalY: 50,
    roleOverrides: { root: null, expression: null, radiance: null },
    sections: SECTIONS.map((s) => ({ ...s, image: null, imgRole: null })),
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
  const IDLE_SLEEP_MS = 30000;
  const NT = 46, NP = 18;

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
  function roleColor(which, alpha) {
    const base = activeRoleColor(which);
    if (base) {
      const h = String(base).trim();
      if (h[0] === '#') {
        const x = h.slice(1);
        const r = parseInt(x.slice(0, 2), 16), g = parseInt(x.slice(2, 4), 16), b = parseInt(x.slice(4, 6), 16);
        if (isFinite(r) && isFinite(g) && isFinite(b)) return `rgba(${r},${g},${b},${alpha})`;
      }
      if (/\)$/.test(h)) return h.replace(/\)$/, ` / ${alpha})`);
    }
    return `rgba(150,140,110,${alpha})`;
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
  function wakeTorus() {
    torusLastInteract = performance.now();
    if (!torusRaf && shouldAnimateTorus()) drawFieldTorus();
  }
  function shouldAnimateTorus() {
    return state.transition === 'threshold' && state.torus !== 'off' && !reduceMotion;
  }
  function drawFieldTorus() {
    const cv = ensureTorusCanvas();
    if (!cv) return;
    if (torusRaf) { cancelAnimationFrame(torusRaf); torusRaf = 0; }
    const ctx0 = cv.getContext('2d');
    if (state.torus === 'off') { ctx0 && ctx0.clearRect(0, 0, cv.width, cv.height); return; }
    if (!torusPoints) bakeTorusPoints();

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
      ctx.clearRect(0, 0, w, h);
      const spin = spin0 + (breathing ? t * 0.00007 : 0);
      const breath = breathing ? (1 + Math.sin(t * 0.0009) * 0.025) : 1;
      const cosS = Math.cos(spin), sinS = Math.sin(spin);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const s = scale * breath;

      const g = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 2.4);
      g.addColorStop(0, roleColor('expression', 0.16 * levelAlpha));
      g.addColorStop(0.45, roleColor('root', 0.06 * levelAlpha));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const proj = [];
      for (let k = 0; k < torusPoints.length; k++) {
        const P = torusPoints[k];
        let x = P.x * cosS - P.z * sinS;
        let z = P.x * sinS + P.z * cosS;
        let y = P.y;
        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;
        y = y2; z = z2 + Z_OFF;
        const f = FOV / (FOV + z * scale);
        proj.push({ sx: cx + x * s * f, sy: cy + y * s * f, depth: z, f: f, equator: P.equator, theta: P.theta });
      }
      proj.sort((a, b) => b.depth - a.depth);

      const zmin = 1.0, zmax = 5.0;
      for (let k = 0; k < proj.length; k++) {
        const p = proj[k];
        const dn = 1 - Math.min(1, Math.max(0, (p.depth - zmin) / (zmax - zmin)));
        const a = (0.05 + dn * 0.22) * levelAlpha;
        const roleName = (k % 3 === 0) ? 'radiance' : (k % 3 === 1) ? 'expression' : 'root';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, (1.4 + dn * 2.6) * p.f, 0, Math.PI * 2);
        ctx.fillStyle = roleColor(roleName, a);
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

      if (breathing) {
        if (performance.now() - torusLastInteract < IDLE_SLEEP_MS) torusRaf = requestAnimationFrame(render);
        else torusRaf = 0;
      }
    }
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
  function renderRoom(idx) {
    const sec = state.sections[idx];
    if (!sec) return;
    const num = `0${idx + 1}`;
    const glyph = markSvg(22, { mono: true, stroke: 1.6, variant: idx + 1, rotate: idx * 30 });
    const artifacts = (sec.artifacts || []).map((a) => `
      <li class="room-artifact">
        <span class="room-artifact__tag">${escapeHtml(a.tag)}</span>
        <h3 class="room-artifact__title">${escapeHtml(a.title)}</h3>
        ${a.note ? `<p class="room-artifact__note">${escapeHtml(a.note)}</p>` : ''}
      </li>`).join('');

    const rail = state.sections.map((s, j) => `
      <button class="room-rail__dot ${j === idx ? 'is-current' : ''}" type="button"
              data-goto="${j}" aria-label="Go to ${escapeHtml(s.eyebrow)} room"
              aria-current="${j === idx ? 'true' : 'false'}">
        <span class="room-rail__num">0${j + 1}</span>
        <span class="room-rail__name">${escapeHtml(s.eyebrow)}</span>
      </button>`).join('');

    const prevIdx = (idx - 1 + state.sections.length) % state.sections.length;
    const nextIdx = (idx + 1) % state.sections.length;
    const img = visibleImage(sec.image);
    const media = img
      ? `<div class="room__media reveal"><img class="room__photo" src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" style="${escapeHtml(imageStyle(img))}" loading="lazy" /><div class="room__mediamask"></div></div>`
      : `<div class="room__media reveal" aria-hidden="true"><div class="room__abstract"></div><div class="room__mediamask"></div></div>`;

    vizRoom.innerHTML = `
      <div class="room__inner">
        <div class="room__top">
          <button class="room__back" type="button" data-back aria-label="Return to the overview">
            <span aria-hidden="true">←</span> Back to the field
          </button>
          <span class="room__breadcrumb">${escapeHtml(state.name)} · Room ${num}</span>
        </div>

        <header class="room__head reveal">
          <span class="room__eyebrow"><span class="room__glyph">${glyph}</span><span class="room__num">${num}</span> ${escapeHtml(sec.eyebrow)}</span>
          <h1 class="room__title">${escapeHtml(sec.title)}</h1>
          <p class="room__narrative">${escapeHtml(sec.narrative || sec.body)}</p>
        </header>

        ${media}

        <ul class="room__artifacts reveal">${artifacts}</ul>

        <div class="room__prompt reveal">
          <span class="room__prompt-mark" aria-hidden="true">${markSvg(18, { mono: true, stroke: 1.7 })}</span>
          <p class="room__prompt-text">${escapeHtml(sec.prompt || '')}</p>
        </div>

        <nav class="room__nav" aria-label="Room navigation">
          <button class="room__nav-btn room__nav-btn--prev" type="button" data-goto="${prevIdx}"
                  aria-label="Previous room: ${escapeHtml(state.sections[prevIdx].eyebrow)}">
            <span aria-hidden="true">←</span>
            <span class="room__nav-meta"><span class="room__nav-dir">Previous</span><span class="room__nav-name">${escapeHtml(state.sections[prevIdx].eyebrow)}</span></span>
          </button>
          <div class="room-rail" role="group" aria-label="All rooms">${rail}</div>
          <button class="room__nav-btn room__nav-btn--next" type="button" data-goto="${nextIdx}"
                  aria-label="Next room: ${escapeHtml(state.sections[nextIdx].eyebrow)}">
            <span class="room__nav-meta"><span class="room__nav-dir">Next</span><span class="room__nav-name">${escapeHtml(state.sections[nextIdx].eyebrow)}</span></span>
            <span aria-hidden="true">→</span>
          </button>
        </nav>
      </div>`;

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
    const heroImg = $('heroPhoto');
    if (heroImg) {
      if (hasPhoto) {
        if (heroImg.getAttribute('src') !== state.heroPhoto) heroImg.setAttribute('src', state.heroPhoto);
        heroImg.hidden = false;
        heroImg.alt = state.heroAlt || '';
        heroImg.style.objectPosition = `${state.heroFocalX}% ${state.heroFocalY}%`;
      } else {
        // No real media — never retain a stale portrait between models.
        heroImg.removeAttribute('src');
        heroImg.hidden = true;
      }
    }
    const portrait = viz.querySelector('.portrait');
    if (portrait) {
      portrait.dataset.photo = state.photo;
      portrait.style.removeProperty('background-image');
    }

    vizName.textContent = state.name || 'Untitled';
    vizTag.textContent = state.tagline || '';
    vizEyebrowText.textContent = state.eyebrow || 'CommonUnity';
    vizFootName.textContent = state.name || 'Untitled';

    $('eyebrowSigil').innerHTML = markSvg(20, { mono: true, stroke: 1.7 });
    $('footSigil').innerHTML = markSvg(26, { mono: true, stroke: 1.6 });
    $('heroWatermark').innerHTML = watermarkSvg();
    $('fieldPalName').textContent = PAL_NAME[state.palette] || '';

    applyFieldPalette();
    applyCipherWeave();
    drawFieldTorus();
    updateStageState();
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
      card.innerHTML = `
        <div class="seccard__head">
          <span class="seccard__title"><span class="seccard__glyph">${glyph}</span>${escapeHtml(sec.eyebrow)}</span>
          <span class="seccard__idx">0${i + 1}</span>
        </div>
        <label class="minilabel" for="secTitle${i}">Heading</label>
        <input class="mini-input" id="secTitle${i}" type="text" data-sectitle="${i}"
          value="${escapeHtml(sec.title)}" aria-label="${escapeHtml(sec.eyebrow)} heading" />
        <label class="minilabel" for="secBody${i}">Body</label>
        <textarea class="seccard__area" id="secBody${i}" rows="3" data-secbody="${i}"
          aria-label="${escapeHtml(sec.eyebrow)} body text">${escapeHtml(sec.body)}</textarea>`;
      sectionCopyControls.appendChild(card);
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
      const rm = vizRoom.querySelector('.room__photo'); if (rm) { rm.setAttribute('style', imageStyle(img)); rm.alt = img.alt || ''; }
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
        }
        file.value = '';
      };
      reader.readAsDataURL(f);
    });
    if (rm) rm.addEventListener('click', () => {
      state.heroPhoto = ''; state.heroAlt = '';
      state.heroFocalX = 50; state.heroFocalY = 50;
      state.heroPhotoHasAlpha = false;
      applyComposition(); syncHeroEditor();
    });
    if (alt) alt.addEventListener('input', () => {
      state.heroAlt = alt.value;
      const heroImg = $('heroPhoto'); if (heroImg && state.heroPhoto) heroImg.alt = state.heroAlt;
    });
    if (fx) fx.addEventListener('input', () => applyHeroFocal('x', fx.value));
    if (fy) fy.addEventListener('input', () => applyHeroFocal('y', fy.value));
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
      fy = $('heroFocalY'), fxv = $('heroFocalXVal'), fyv = $('heroFocalYVal');
    if (up) up.textContent = has ? 'Replace' : 'Upload';
    if (rm) rm.hidden = !has;
    if (note) note.hidden = has;
    if (fields) fields.hidden = !has;
    if (alt) alt.value = state.heroAlt || '';
    if (fx) fx.value = String(state.heroFocalX);
    if (fy) fy.value = String(state.heroFocalY);
    if (fxv) fxv.textContent = state.heroFocalX + '%';
    if (fyv) fyv.textContent = state.heroFocalY + '%';
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
        requestAnimationFrame(drawFieldTorus);
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
    // Imported palettes replace any prior user colour overrides.
    state.roleOverrides = { root: null, expression: null, radiance: null };
    if (hero.intro) state.tagline = String(hero.intro);

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

  function fullRender() {
    renderFieldCard();
    applyAutoSignatures();
    buildCopyControls();
    buildImageControls();
    renderSections();
    syncControlsToState();
    syncHeroEditor();
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
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent) return;
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'fieldprint-model' && d.model) {
        hydrateFromModel(d.model);
        fullRender();
        setLoadNote(true, 'Live Fieldprint from your Studio data.');
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

  /* ---------- utils ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

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
    wireColors();
    wireBridge();
    syncControlsToState();
    syncHeroEditor();
    syncColorInputs();
    applyComposition();
    requestAnimationFrame(observeReveals);

    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(drawFieldTorus);
    });
    const scroller = $('stageScroll');
    if (scroller) scroller.addEventListener('scroll', wakeTorus, { passive: true });
    ['pointermove', 'pointerdown'].forEach((ev) => window.addEventListener(ev, wakeTorus, { passive: true }));

    // Tell Studio we're ready to receive the sanitized model.
    if (embedded) postToParent({ type: 'fieldprint-ready' });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
