// Vendored copy of repo-root sdk/sigil.js so the field/ Docker build context
// (rootDirectory=/field on Railway) can resolve it without reaching above /app.
// Canonical source: ../../sdk/sigil.js — keep in sync.
/**
 * CommonUnity Sigil Engine
 * Hybrid deterministic identity glyph: SVG geometry seeded by
 * Gene Keys, Compass points, tone/frequency, name gematria, and birthdate.
 *
 * Pure CommonJS/ESM-friendly module. No runtime dependencies.
 */

// ─────────────────────────────────────────────────────────────────────────
// Solfeggio + colour correspondences (warm-dark, candlelit register)
// ─────────────────────────────────────────────────────────────────────────
const SOLFEGGIO = [
  { hz: 174, name: "Ut",       theme: "Foundation",   chakra: "Root",         color: "#7a2e2e", note: "F"  },
  { hz: 285, name: "Re-natal", theme: "Tissue",       chakra: "Sacral",       color: "#a85a2a", note: "C#" },
  { hz: 396, name: "Ut",       theme: "Liberation",   chakra: "Root",         color: "#9c3232", note: "G"  },
  { hz: 417, name: "Re",       theme: "Change",       chakra: "Sacral",       color: "#c46a2e", note: "G#" },
  { hz: 528, name: "Mi",       theme: "Transformation", chakra: "Solar",      color: "#d2a13a", note: "C"  },
  { hz: 639, name: "Fa",       theme: "Connection",   chakra: "Heart",        color: "#3a8a6f", note: "D#" },
  { hz: 741, name: "Sol",      theme: "Expression",   chakra: "Throat",       color: "#2e6f8a", note: "F#" },
  { hz: 852, name: "La",       theme: "Intuition",    chakra: "Third Eye",    color: "#3c4a8a", note: "G#" },
  { hz: 963, name: "Si",       theme: "Awakening",    chakra: "Crown",        color: "#7a4a8a", note: "B"  },
];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Standard 12-tone equal-tempered: midi note for a given freq in Hz.
function frequencyToNote(hz) {
  if (!hz || hz <= 0) return null;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const rounded = Math.round(midi);
  const noteName = NOTES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  const exactCents = Math.round((midi - rounded) * 100);
  return { midi: rounded, note: noteName, octave, cents: exactCents };
}

// Map an arbitrary Hz onto the nearest solfeggio family + colour register.
function frequencyToSolfeggio(hz) {
  if (!hz || hz <= 0) return null;
  let nearest = SOLFEGGIO[0];
  let best = Math.abs(SOLFEGGIO[0].hz - hz);
  for (const row of SOLFEGGIO) {
    const d = Math.abs(row.hz - hz);
    if (d < best) { best = d; nearest = row; }
  }
  return { ...nearest, distance: best };
}

// ─────────────────────────────────────────────────────────────────────────
// Numerology — birthday digital root (theosophical reduction)
// ─────────────────────────────────────────────────────────────────────────
function digitalRoot(n) {
  let x = Math.abs(Math.trunc(Number(n) || 0));
  while (x >= 10) {
    x = String(x).split("").reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

function birthdayDigitalRoot(isoDate) {
  if (!isoDate) return null;
  const digits = String(isoDate).replace(/\D/g, "");
  if (!digits) return null;
  const sum = digits.split("").reduce((s, d) => s + Number(d), 0);
  return { sum, root: digitalRoot(sum) };
}

// ─────────────────────────────────────────────────────────────────────────
// Simple gematria — sum of letter values, A=1..Z=26, then digital root.
// (Pythagorean / English ordinal; safe for ASCII, ignores accents.)
// ─────────────────────────────────────────────────────────────────────────
function gematria(name) {
  if (!name) return null;
  const cleaned = String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const sum = cleaned.split("").reduce((s, ch) => s + (ch.charCodeAt(0) - 64), 0);
  return { letters: cleaned.length, sum, root: digitalRoot(sum) };
}

// ─────────────────────────────────────────────────────────────────────────
// Handle proposal — kebab-case, deterministic, with collision suffix hint.
// Transliterates common non-ASCII letters that don't decompose via NFD
// (Turkish ı/İ/ş/ğ, German ß, Scandinavian æ/ø/å, etc.) so the proposed
// handle reflects the spelling the person actually goes by.
// ─────────────────────────────────────────────────────────────────────────
const TRANSLIT_MAP = {
  // Turkish
  "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
  "ç": "c", "Ç": "c", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u",
  // German
  "ß": "ss",
  // Scandinavian / extended
  "æ": "ae", "Æ": "ae", "ø": "o", "Ø": "o", "å": "a", "Å": "a",
  "œ": "oe", "Œ": "oe",
  // Eastern European
  "ł": "l", "Ł": "l", "đ": "d", "Đ": "d",
};
function transliterate(s) {
  return String(s || "").split("").map(ch => TRANSLIT_MAP[ch] || ch).join("");
}

function proposeHandle(displayName) {
  if (!displayName) return null;
  const base = transliterate(displayName)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return base || null;
}

// ─────────────────────────────────────────────────────────────────────────
// Seed encoder — packs all symbolic inputs into a deterministic dictionary
// the renderer consumes. Stable across calls; no randomness.
// ─────────────────────────────────────────────────────────────────────────
function encodeSigilSeed(input = {}) {
  const {
    display_name,
    handle,
    full_name,
    birthdate, // ISO YYYY-MM-DD
    gene_keys = {},      // { life_work, evolution, radiance, purpose }
    compass = {},        // { work, lens, field, call } each { gk_num, gk_line }
    tone = {},           // { tonal_center, dominant_hz, seed_syllable }
    salts = null,        // SaltConfig[] — symbolic tissue-salt layer (optional)
  } = input;

  const dr = birthdayDigitalRoot(birthdate);
  const gem = gematria(full_name || display_name);
  const note = tone.dominant_hz ? frequencyToNote(tone.dominant_hz) : null;
  const sol  = tone.dominant_hz ? frequencyToSolfeggio(tone.dominant_hz) : null;

  // Gather Gene Key gates from both gene_keys object and compass points.
  const gates = [];
  for (const k of ["life_work", "evolution", "radiance", "purpose"]) {
    const v = gene_keys[k];
    if (v) {
      // "GK 5.5" → gate 5 line 5 ; "45" → gate 45
      const m = String(v).match(/(\d+)(?:\.(\d+))?/);
      if (m) {
        const n = parseInt(m[1], 10);
        const line = m[2] ? parseInt(m[2], 10) : null;
        if (Number.isFinite(n)) gates.push({ slot: k, gate: n, line });
      }
    }
  }
  for (const k of ["work", "lens", "field", "call"]) {
    const p = compass[k];
    if (p && p.gk_num) {
      const n = parseInt(String(p.gk_num).replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n)) gates.push({ slot: k, gate: n, line: Number(p.gk_line) || null });
    }
  }

  const proposedHandle = handle || proposeHandle(display_name);

  // Normalise the salt layer if present. The canonical person profile keeps
  // salts as SaltConfig[]: [{ saltId, weight }]. The renderer reads salts[0]
  // for the primary geometry; secondaries are preserved for future accents.
  let normalisedSalts = null;
  if (Array.isArray(salts) && salts.length) {
    normalisedSalts = salts
      .filter(s => s && typeof s.saltId === "string")
      .map(s => ({
        saltId: s.saltId,
        weight: Number.isFinite(s.weight) ? s.weight : 1,
      }));
    if (!normalisedSalts.length) normalisedSalts = null;
  }

  return {
    handle: proposedHandle,
    display_name: display_name || null,
    gates,
    digital_root: dr ? dr.root : null,
    gematria: gem ? { sum: gem.sum, root: gem.root } : null,
    tone: {
      tonal_center: tone.tonal_center || (note ? note.note : null),
      dominant_hz: tone.dominant_hz || null,
      derived_note: note || null,
      solfeggio: sol || null,
      seed_syllable: tone.seed_syllable || "Om",
    },
    color_primary: sol ? sol.color : "#d2a13a", // default: warm gold
    salts: normalisedSalts,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic hash (FNV-1a 32-bit) → used for stable pseudo-random angles
// without bringing in a randomness dependency.
// ─────────────────────────────────────────────────────────────────────────
function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ─────────────────────────────────────────────────────────────────────────
// SVG rendering — Living Profile aligned (Phase 1 visual contract).
//
// Mirrors studio.html .lp-hero-slot.is-sigil: a rounded-corner panel filled
// with a soft conic gradient cycling through Work (amber) → Lens (indigo) →
// Field (emerald) → Call (rose) → rose-accent, with the Devanagari ॐ
// centered in Cormorant Garamond serif. Uniqueness comes from the seed:
// the conic rotation start angle is derived from gates + handle hash, and
// the rose accent shifts toward the tone's solfeggio colour family.
//
// Studio dark-theme palette (canonical):
//   --work #f59e0b   --lens #6366f1   --field #10b981   --call #f43f5e
//   --rose-color #c4b5fd
//
// SVG has no native conic-gradient, so we approximate it with 5 colored
// arc wedges plus a Gaussian blur to soften the seams — visually
// indistinguishable from the CSS conic at the sizes we use.
// ─────────────────────────────────────────────────────────────────────────
const SIGIL_PALETTE = {
  work:  "#f59e0b",  // amber
  lens:  "#6366f1",  // indigo
  field: "#10b981",  // emerald
  call:  "#f43f5e",  // rose-red
  rose:  "#c4b5fd",  // lavender accent (the --rose-color tint)
};

// Build an SVG arc-wedge path from cx,cy at radius r, between two angles
// (radians, 0 = right, clockwise positive).
function arcWedge(cx, cy, r, a0, a1) {
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

// ─────────────────────────────────────────────────────────────────────────
// Tissue salt geometry layer — symbolic / somatic / contemplative.
// Draws a faint inner cube (square projection) under the OM halo and Compass,
// with primary-salt edge emphasis and bond-motif micro-marks at intersections
// between the cube edges and the inner ring + Compass axes. Density controls
// how many intersection points receive a motif.
//
// All helpers return SVG strings so they compose cleanly with renderSigilSVG.
// The same inputs (seed + salts) always produce the same string — no random.
// ─────────────────────────────────────────────────────────────────────────
const { CELL_SALTS: _CELL_SALTS, getSaltGeometryProfile } = require("./cell_salts.js");

function _saltGeometry(center, radius) {
  // Square inscribed in the inner ring (corners touching the ring).
  // Side length = radius * sqrt(2); centered on `center`.
  const r = radius;
  const tl = { x: center.x - r * Math.SQRT1_2, y: center.y - r * Math.SQRT1_2 };
  const tr = { x: center.x + r * Math.SQRT1_2, y: center.y - r * Math.SQRT1_2 };
  const br = { x: center.x + r * Math.SQRT1_2, y: center.y + r * Math.SQRT1_2 };
  const bl = { x: center.x - r * Math.SQRT1_2, y: center.y + r * Math.SQRT1_2 };
  // Edge midpoints — used for cardinal emphasis + intersection motifs.
  const mid = {
    top:    { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 },
    right:  { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 },
    bottom: { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 },
    left:   { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 },
  };
  return { corners: { tl, tr, br, bl }, mid, radius: r, center };
}

function drawBaseSaltCube(opts) {
  const { center, radius, lineWidth = 1, opacity = 0.14 } = opts;
  const g = _saltGeometry(center, radius);
  const { tl, tr, br, bl } = g.corners;
  const stroke = `rgba(241,245,249,${opacity})`;
  const square = `<path d="M ${tl.x.toFixed(2)} ${tl.y.toFixed(2)} L ${tr.x.toFixed(2)} ${tr.y.toFixed(2)} L ${br.x.toFixed(2)} ${br.y.toFixed(2)} L ${bl.x.toFixed(2)} ${bl.y.toFixed(2)} Z" fill="none" stroke="${stroke}" stroke-width="${lineWidth}"/>`;
  // Optional cube-suggestion diagonals (very faint).
  const diag = `<path d="M ${tl.x.toFixed(2)} ${tl.y.toFixed(2)} L ${br.x.toFixed(2)} ${br.y.toFixed(2)} M ${tr.x.toFixed(2)} ${tr.y.toFixed(2)} L ${bl.x.toFixed(2)} ${bl.y.toFixed(2)}" fill="none" stroke="rgba(241,245,249,${(opacity * 0.55).toFixed(3)})" stroke-width="${(lineWidth * 0.6).toFixed(2)}"/>`;
  return square + diag;
}

function highlightSaltEdges(profile, geometry, opts = {}) {
  if (!profile) return "";
  const { tl, tr, br, bl } = geometry.corners;
  const { mid, center, radius } = geometry;
  const opacity = opts.opacity || 0.28;
  const lineWidth = opts.lineWidth || 1.4;
  const stroke = `rgba(241,245,249,${opacity})`;
  const sym = profile.symmetry;

  if (sym === "cubic") {
    // Emphasise all four square edges with a slightly thicker stroke.
    return `<path d="M ${tl.x.toFixed(2)} ${tl.y.toFixed(2)} L ${tr.x.toFixed(2)} ${tr.y.toFixed(2)} L ${br.x.toFixed(2)} ${br.y.toFixed(2)} L ${bl.x.toFixed(2)} ${bl.y.toFixed(2)} Z" fill="none" stroke="${stroke}" stroke-width="${lineWidth}"/>`;
  }

  if (sym === "orthorhombic") {
    // Stretched/diagonal feel — emphasise the two diagonals + slightly elongate
    // (a vertical "tall rectangle" hint inside the square via a faint inner band).
    const innerTop = { x: center.x, y: center.y - radius * 0.85 };
    const innerBot = { x: center.x, y: center.y + radius * 0.85 };
    return (
      `<path d="M ${tl.x.toFixed(2)} ${tl.y.toFixed(2)} L ${br.x.toFixed(2)} ${br.y.toFixed(2)} M ${tr.x.toFixed(2)} ${tr.y.toFixed(2)} L ${bl.x.toFixed(2)} ${bl.y.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}"/>` +
      `<path d="M ${innerTop.x.toFixed(2)} ${innerTop.y.toFixed(2)} L ${innerBot.x.toFixed(2)} ${innerBot.y.toFixed(2)}" fill="none" stroke="rgba(241,245,249,${(opacity * 0.7).toFixed(3)})" stroke-width="${(lineWidth * 0.7).toFixed(2)}"/>`
    );
  }

  if (sym === "hexagonal") {
    // Faint hexagon inside the square — vertices on a circle of ~radius * 0.92
    // with the standard 60° spacing; pointy-top orientation.
    const pts = [];
    const hexR = radius * 0.92;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      pts.push({ x: center.x + hexR * Math.cos(a), y: center.y + hexR * Math.sin(a) });
    }
    const d = pts.map((p, i) => (i === 0 ? "M " : "L ") + p.x.toFixed(2) + " " + p.y.toFixed(2)).join(" ") + " Z";
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}"/>`;
  }

  if (sym === "network") {
    // Web-like cross-connections between edge midpoints.
    return (
      `<path d="M ${mid.top.x.toFixed(2)} ${mid.top.y.toFixed(2)} L ${mid.right.x.toFixed(2)} ${mid.right.y.toFixed(2)} L ${mid.bottom.x.toFixed(2)} ${mid.bottom.y.toFixed(2)} L ${mid.left.x.toFixed(2)} ${mid.left.y.toFixed(2)} Z" fill="none" stroke="${stroke}" stroke-width="${lineWidth}"/>` +
      `<path d="M ${mid.top.x.toFixed(2)} ${mid.top.y.toFixed(2)} L ${mid.bottom.x.toFixed(2)} ${mid.bottom.y.toFixed(2)} M ${mid.left.x.toFixed(2)} ${mid.left.y.toFixed(2)} L ${mid.right.x.toFixed(2)} ${mid.right.y.toFixed(2)}" fill="none" stroke="rgba(241,245,249,${(opacity * 0.6).toFixed(3)})" stroke-width="${(lineWidth * 0.7).toFixed(2)}"/>`
    );
  }
  return "";
}

function _saltIntersections(geometry) {
  // Eight stable, deterministic intersection points used by motif decoration:
  //   - 4 corners of the cube projection (where edges touch the inner ring)
  //   - 4 midpoints of the cube edges (where they meet the Compass axes)
  const { corners, mid } = geometry;
  return [
    corners.tl, mid.top, corners.tr, mid.right,
    corners.br, mid.bottom, corners.bl, mid.left,
  ];
}

function decorateSaltIntersections(profile, geometry, opts = {}) {
  if (!profile) return "";
  const points = _saltIntersections(geometry);
  const density = profile.nodeDensity;
  const motif = profile.bondMotif;
  const opacity = opts.opacity || 0.32;
  const color = `rgba(241,245,249,${opacity})`;
  const scale = (geometry.radius / 80) * (opts.scale || 1); // motif size scales with sigil

  // Density → modulo stride for stepping through intersection points.
  const stride = density === "dense" ? 1 : density === "medium" ? 2 : 3;

  const out = [];
  for (let i = 0; i < points.length; i += stride) {
    const p = points[i];
    out.push(_motifMark(motif, p, scale, color));
  }
  return out.join("");
}

function _motifMark(motif, p, scale, color) {
  const x = p.x;
  const y = p.y;
  const s = Math.max(2, scale * 3);
  if (motif === "paired") {
    // Twin dots side-by-side joined by a tiny connector.
    return (
      `<circle cx="${(x - s).toFixed(2)}" cy="${y.toFixed(2)}" r="${(s * 0.45).toFixed(2)}" fill="${color}"/>` +
      `<circle cx="${(x + s).toFixed(2)}" cy="${y.toFixed(2)}" r="${(s * 0.45).toFixed(2)}" fill="${color}"/>` +
      `<line x1="${(x - s).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + s).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="${(s * 0.18).toFixed(2)}"/>`
    );
  }
  if (motif === "cross") {
    // Small plus.
    return (
      `<line x1="${(x - s).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + s).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="${(s * 0.25).toFixed(2)}"/>` +
      `<line x1="${x.toFixed(2)}" y1="${(y - s).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + s).toFixed(2)}" stroke="${color}" stroke-width="${(s * 0.25).toFixed(2)}"/>`
    );
  }
  if (motif === "ring") {
    // Tiny hex-ish triangle ring.
    const r = s * 0.95;
    const a = -Math.PI / 2;
    const pts = [0, 1, 2].map(i => {
      const ang = a + i * ((Math.PI * 2) / 3);
      return (x + r * Math.cos(ang)).toFixed(2) + "," + (y + r * Math.sin(ang)).toFixed(2);
    });
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${(s * 0.22).toFixed(2)}"/>`;
  }
  if (motif === "branching") {
    // Tiny Y / fork — three small arms 120° apart.
    const r = s;
    const arms = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map(ang => {
      const ex = x + r * Math.cos(ang);
      const ey = y + r * Math.sin(ang);
      return `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" stroke="${color}" stroke-width="${(s * 0.22).toFixed(2)}"/>`;
    });
    return arms.join("");
  }
  return "";
}

function _renderSaltLayer(seed, center, innerR) {
  const profile = getSaltGeometryProfile(seed && seed.salts);
  if (!profile) return "";
  // Salt cube touches the inner ring; a hair smaller keeps the corners crisp.
  const cubeR = innerR * 0.985;
  const geometry = _saltGeometry(center, cubeR);
  const cube = drawBaseSaltCube({ center, radius: cubeR, lineWidth: 1, opacity: 0.14 });
  const edges = highlightSaltEdges(profile, geometry, { opacity: 0.28, lineWidth: 1.4 });
  const marks = decorateSaltIntersections(profile, geometry, { opacity: 0.32 });
  return (
    `<g class="cu-sigil-salt-layer" data-salt-id="${profile.saltId}" data-salt-symmetry="${profile.symmetry}" data-salt-motif="${profile.bondMotif}" data-salt-density="${profile.nodeDensity}">` +
    cube + edges + marks +
    `</g>`
  );
}

function renderSigilSVG(seed, opts = {}) {
  const size = opts.size || 256;
  const cx = size / 2;
  const cy = size / 2;
  const handle = seed.handle || "anon";
  const safeId = String(handle).replace(/[^a-zA-Z0-9_-]/g, "_");
  const h = fnv1a(handle + "|" + (seed.display_name || ""));

  // Deterministic rotation start (degrees → radians). Studio LP uses
  // `from 200deg` / `from 210deg`; we use 200° + a per-seed offset of up to
  // 360° so two profiles in the family share the language but no two
  // rotations are identical.
  const startDeg = 200 + (h % 360);
  const start = (startDeg * Math.PI) / 180;

  // The five wedges, in the same order as the LP conic gradient.
  const wedgeColors = [
    SIGIL_PALETTE.rose,
    SIGIL_PALETTE.work,
    SIGIL_PALETTE.lens,
    SIGIL_PALETTE.field,
    SIGIL_PALETTE.call,
    SIGIL_PALETTE.rose,
  ];
  const TWO_PI = Math.PI * 2;
  const step = TWO_PI / (wedgeColors.length - 1); // five wedges, last one closes back to rose
  const wedgeR = size * 0.62; // generous overflow — blur softens the edge
  const wedges = wedgeColors.slice(0, -1).map((c, i) => {
    const a0 = start + i * step;
    const a1 = start + (i + 1) * step;
    return `<path d="${arcWedge(cx, cy, wedgeR, a0, a1)}" fill="${c}" fill-opacity="0.32"/>`;
  }).join("");

  // The bīja (ॐ) — Cormorant Garamond serif, soft cream against the field.
  // The Living Profile uses the literal Devanagari glyph regardless of
  // seed_syllable; we honour that convention so the family language is
  // consistent. The seed.tone.seed_syllable is still preserved on the
  // profile data for future per-profile variation.
  const glyph = "ॐ";
  const glyphSize = size * 0.42;
  const glyphColor = "#f1f5f9"; // --text on dark theme; reads on the gradient
  const labelSize = Math.round(size * 0.052);

  // Soft inner ring (echoes the LP slot's subtle ambient pulse).
  const innerR = size * 0.36;

  // Background plate — rounded-corner radius matches LP's `border-radius: 22px`
  // when rendered at the LP slot's ~120px size; we scale to viewBox.
  const radius = Math.round(size * 0.094);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Personal sigil for ${escapeXml(seed.display_name || handle)}">
  <defs>
    <clipPath id="clip-${safeId}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}"/>
    </clipPath>
    <filter id="conic-${safeId}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${(size * 0.07).toFixed(2)}"/>
    </filter>
    <radialGradient id="vignette-${safeId}" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#0d1526" stop-opacity="0.0"/>
      <stop offset="100%" stop-color="#0b1120" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <g clip-path="url(#clip-${safeId})">
    <rect width="${size}" height="${size}" fill="#0d1526"/>
    <g filter="url(#conic-${safeId})">
      ${wedges}
    </g>
    <rect width="${size}" height="${size}" fill="url(#vignette-${safeId})"/>
    <circle cx="${cx}" cy="${cy}" r="${innerR.toFixed(2)}" fill="none" stroke="rgba(241,245,249,0.10)" stroke-width="1"/>
    ${_renderSaltLayer(seed, { x: cx, y: cy }, innerR)}
    <text x="${cx}" y="${(cy + glyphSize * 0.36).toFixed(2)}" text-anchor="middle"
          font-family="Cormorant Garamond, Georgia, 'Times New Roman', serif"
          font-size="${glyphSize.toFixed(2)}" font-weight="500"
          fill="${glyphColor}" fill-opacity="0.92">${glyph}</text>
    <text x="${cx}" y="${(size - labelSize * 1.3).toFixed(2)}" text-anchor="middle"
          font-family="Plus Jakarta Sans, system-ui, sans-serif"
          font-size="${labelSize}" font-weight="500"
          letter-spacing="${(labelSize * 0.22).toFixed(2)}"
          fill="rgba(241,245,249,0.55)">DIGITAL KEY · SIGIL</text>
  </g>
</svg>`;
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─────────────────────────────────────────────────────────────────────────
// Hybrid: structured AI design-prompt generator. Pure data; no API call.
// Consumers may forward this to an LLM to enrich the sigil description.
// ─────────────────────────────────────────────────────────────────────────
function buildDesignPrompt(seed) {
  const sol = seed.tone && seed.tone.solfeggio;
  const gates = (seed.gates || []).map(g => `GK${g.gate}${g.line ? "." + g.line : ""} (${g.slot})`).join(", ");
  return [
    "Design brief for a CommonUnity personal sigil.",
    `Subject: ${seed.display_name || seed.handle}.`,
    `Compass gates / Gene Keys: ${gates || "—"}.`,
    `Tonal centre: ${seed.tone.tonal_center || "—"}; dominant frequency: ${seed.tone.dominant_hz || "—"} Hz; ` +
      `derived musical note: ${seed.tone.derived_note ? seed.tone.derived_note.note + seed.tone.derived_note.octave : "—"}.`,
    sol ? `Solfeggio family: ${sol.name} (${sol.hz} Hz) — theme of ${sol.theme}, chakra ${sol.chakra}, color ${sol.color}.` : "",
    `Numerological digital root: ${seed.digital_root ?? "—"}; gematria root: ${seed.gematria ? seed.gematria.root : "—"}.`,
    `Seed syllable / bīja: ${seed.tone.seed_syllable}.`,
    "Visual register: warm-dark, candlelit, sacred-minimal, organic geometry. No neon, no clip-art.",
    "Goal: a unique glyph that belongs to a coherent CommonUnity family — recognisably of the same lineage, never identical.",
  ].filter(Boolean).join(" ");
}

const SOLFEGGIO_HZ = SOLFEGGIO.map(s => s.hz);

module.exports = {
  // utilities
  frequencyToNote,
  frequencyToSolfeggio,
  digitalRoot,
  birthdayDigitalRoot,
  gematria,
  proposeHandle,
  // sigil
  encodeSigilSeed,
  renderSigilSVG,
  buildDesignPrompt,
  // tissue salt layer helpers (symbolic/somatic, not medical)
  drawBaseSaltCube,
  highlightSaltEdges,
  decorateSaltIntersections,
  // constants
  SOLFEGGIO,
  SOLFEGGIO_HZ,
  NOTES,
};
