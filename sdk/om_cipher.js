/**
 * Om Cipher v1 — Canonical Compass-sealed identity engine.
 *
 * Pure, deterministic, dependency-free. Importable in both Node (CommonJS)
 * and the browser via cu-bridge attach (see studio.html). Companion to the
 * existing `sdk/sigil.js` graphic renderer; this module is the *objective
 * source-code layer* the sigil and downstream projections read from.
 *
 * Reference: docs/product/om-cipher-v1-implementation-plan.md
 *
 * Canonical derivation (engine-first):
 *   Layer 1   Life Path = reduce(day) + reduce(month) + reduce(year),
 *             then reduce preserving master numbers 11/22/33.
 *             Expression / Soul Urge / Personality from Pythagorean
 *             gematria of legal_name (reduced to single digit; master
 *             preservation applies to Life Path only).
 *   Layer 2   Temporal resonance — lunar phase (synodic approx with
 *             baseline 2000-01-06, 29.53059), solar quarter by month
 *             (winter Dec–Feb, spring Mar–May, summer Jun–Aug, autumn
 *             Sep–Nov), temporal gate hour//2 (null if no birth_time).
 *   Layer 3   Gene Keys gate/line read from sealed Compass input.
 *             V1 does not compute Gene Keys internally; if Compass
 *             provides pre-resolved activation lines they are surfaced
 *             from the static 4×6 line table (original/internal labels).
 *   Layer 4   Canonical seed string `LP:..|EX:..|SU:..|PE:..|LUN:..|
 *             SOL:..|TG:..` (TG omitted when birth_time is null).
 *             SHA-256 of that string is the 64-char om_cipher_seed.
 *   Layer 5   Sigil scaffold count: 11 if birth_time, else 9.
 *   Layer 6   Palette — primary hue from Life Path with master-specific
 *             family (22→72, 11→36, 33→108; else root × 40 mod 360);
 *             lunar phase modulates saturation; secondary hue is the
 *             complement. OKLCH strings.
 *
 * Bhramari handling:
 *   - Optional. Missing baseline never blocks generation. The baseline
 *     is sealed alongside identity but excluded from the canonical seed
 *     string so two members with identical identity hash identically
 *     regardless of whether one captured a hum.
 *   - Refinement events are append-only history; they never alter seed,
 *     scaffolding, or input_hash.
 */

"use strict";

// IIFE-wrapped so top-level `const _exports` does not collide with the
// Layer 6 sidecar (`om_cipher_layer6_data.js`) when both files load as
// plain <script> tags in the browser. Module.exports and window assignments
// inside the IIFE preserve Node `require` and browser global access.
(function () {

// ─────────────────────────────────────────────────────────────────────────
// Feature flag — env-driven, opt-in. Honour an explicit override too so the
// browser bridge can pass the flag from a config payload rather than the
// shell environment.
// ─────────────────────────────────────────────────────────────────────────
function isEnabled(override) {
  if (override === true || override === false) return override;
  const env =
    (typeof process !== "undefined" && process.env && process.env.OM_CIPHER_ENABLED) || "";
  if (String(env).toLowerCase() === "true" || env === "1") return true;
  if (typeof window !== "undefined" && window.CU_OM_CIPHER_ENABLED === true) return true;
  return false;
}

function isBhramariEnabled(override) {
  if (override === true || override === false) return override;
  const env =
    (typeof process !== "undefined" && process.env && process.env.BHRAMARI_CAPTURE_ENABLED) || "";
  if (String(env).toLowerCase() === "true" || env === "1") return true;
  if (typeof window !== "undefined" && window.CU_BHRAMARI_CAPTURE_ENABLED === true) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// SHA-256 — works in Node (require("crypto")) and the browser. Provides a
// synchronous JS fallback so the engine stays deterministic and side-
// effect-free at call time.
// ─────────────────────────────────────────────────────────────────────────
function sha256Hex(input) {
  const str = String(input);
  try {
    if (typeof require === "function") {
      // eslint-disable-next-line global-require
      const crypto = require("crypto");
      return crypto.createHash("sha256").update(str, "utf8").digest("hex");
    }
  } catch (_) {
    // fall through to JS implementation
  }
  return sha256JS(str);
}

// Pure-JS SHA-256 fallback for browsers that don't expose `require("crypto")`.
//
// History: the prior implementation computed the padding length such that
// `out.length` was `64 * ceil((N+9)/64) + 8` — i.e. 8 bytes too long and
// NOT a multiple of 64. The block loop then processed an extra trailing
// 64-byte window of mostly-zero/garbage bytes, producing a deterministic
// but completely wrong digest. In Node `sha256Hex` short-circuits to
// `require("crypto")` so tests passed; on the live site (no `require`)
// every Cipher seed surfaced this wrong hash (e.g. Markus rendered
// `25345a79…` instead of the canonical `58b2ea61…`). Fix: pad so the
// total length is exactly `64 * ceil((N+9)/64)`.
function sha256JS(ascii) {
  function rightRotate(n, x) { return (x >>> n) | (x << (32 - n)); }
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  let H = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ]);
  // UTF-8 byte length of the input (not character count).
  const utf8 = unescape(encodeURIComponent(ascii));
  const N = utf8.length;
  // Total padded length: smallest multiple of 64 that fits N + 1 (0x80
  // separator) + 8 (64-bit big-endian bit length).
  const totalLen = 64 * Math.ceil((N + 9) / 64);
  const out = new Uint8Array(totalLen);
  for (let i = 0; i < N; i++) out[i] = utf8.charCodeAt(i);
  out[N] = 0x80;
  // 64-bit big-endian bit length in the last 8 bytes. Top 4 bytes carry
  // bits 32..63 of the length; for inputs shorter than 2^29 bytes these
  // are all zero, but emit them explicitly so longer inputs stay correct.
  const bitLen = N * 8;
  // bitLen ≥ 2^32 is unreachable in practice for our short canonical
  // strings; still write the high word safely.
  const hiBits = Math.floor(bitLen / 0x100000000);
  out[totalLen - 8] = (hiBits >>> 24) & 0xff;
  out[totalLen - 7] = (hiBits >>> 16) & 0xff;
  out[totalLen - 6] = (hiBits >>> 8)  & 0xff;
  out[totalLen - 5] = (hiBits)        & 0xff;
  out[totalLen - 4] = (bitLen >>> 24) & 0xff;
  out[totalLen - 3] = (bitLen >>> 16) & 0xff;
  out[totalLen - 2] = (bitLen >>> 8)  & 0xff;
  out[totalLen - 1] = (bitLen)        & 0xff;
  const W = new Uint32Array(64);
  for (let off = 0; off < totalLen; off += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = ((out[off + i*4] << 24) | (out[off + i*4 + 1] << 16) | (out[off + i*4 + 2] << 8) | (out[off + i*4 + 3])) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(7, W[i-15]) ^ rightRotate(18, W[i-15]) ^ (W[i-15] >>> 3);
      const s1 = rightRotate(17, W[i-2]) ^ rightRotate(19, W[i-2]) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(6,e) ^ rightRotate(11,e) ^ rightRotate(25,e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rightRotate(2,a) ^ rightRotate(13,a) ^ rightRotate(22,a);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0]+a)>>>0; H[1] = (H[1]+b)>>>0; H[2] = (H[2]+c)>>>0; H[3] = (H[3]+d)>>>0;
    H[4] = (H[4]+e)>>>0; H[5] = (H[5]+f)>>>0; H[6] = (H[6]+g)>>>0; H[7] = (H[7]+h)>>>0;
  }
  let hex = "";
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, "0");
  return hex;
}

// ─────────────────────────────────────────────────────────────────────────
// Reductions. `digitalRootKeepMaster` preserves 11/22/33 at every step;
// `digitalRoot` always reduces to a single digit.
// ─────────────────────────────────────────────────────────────────────────
function digitalRootKeepMaster(n) {
  let x = Math.abs(Math.trunc(Number(n) || 0));
  while (x > 9 && x !== 11 && x !== 22 && x !== 33) {
    x = String(x).split("").reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

function digitalRoot(n) {
  let x = Math.abs(Math.trunc(Number(n) || 0));
  while (x >= 10) x = String(x).split("").reduce((s, d) => s + Number(d), 0);
  return x;
}

// `birthRoot` retained as a helper for compatibility — pure digit sum of
// the ISO date, master-preserving. Not the canonical Life Path; see
// `lifePath()` below for the v1 canonical reduction.
function birthRoot(isoDate) {
  if (!isoDate) return null;
  const digits = String(isoDate).replace(/\D/g, "");
  if (!digits) return null;
  const raw = digits.split("").reduce((s, d) => s + Number(d), 0);
  return { raw, reduced: digitalRootKeepMaster(raw) };
}

// Canonical Life Path. Reduce each component (day, month, year) — keeping
// masters at the component step — then sum and reduce once more, again
// keeping masters. Preserves the raw component sum on the return value.
function lifePath(isoDate) {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate));
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const rDay = digitalRootKeepMaster(day);
  const rMonth = digitalRootKeepMaster(month);
  const rYear = digitalRootKeepMaster(year);
  const raw = rDay + rMonth + rYear;
  return {
    day: rDay,
    month: rMonth,
    year: rYear,
    raw,
    reduced: digitalRootKeepMaster(raw),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Pythagorean gematria. Expression/Soul Urge/Personality reduce to a
// single digit — master numbers are *not* preserved here (the v1 canonical
// seed uses single-digit name resonances; see implementation plan).
// ─────────────────────────────────────────────────────────────────────────
const PYTHAGOREAN = {
  A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,
  J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,
  S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8,
};
const VOWELS = new Set(["A","E","I","O","U"]);

function normaliseName(name) {
  return String(name || "")
    .normalize("NFC")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function gematriaSumPyth(name, filter) {
  const cleaned = normaliseName(name);
  if (!cleaned) return null;
  let sum = 0;
  for (const ch of cleaned) {
    if (filter && !filter(ch)) continue;
    const v = PYTHAGOREAN[ch];
    if (v) sum += v;
  }
  if (sum === 0) return null;
  return { raw: sum, reduced: digitalRoot(sum) };
}

function nameResonance(legalName) {
  if (!legalName) return null;
  return {
    expression:  gematriaSumPyth(legalName),
    soul_urge:   gematriaSumPyth(legalName, ch => VOWELS.has(ch)),
    personality: gematriaSumPyth(legalName, ch => !VOWELS.has(ch)),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Gene Keys / I Ching primary gate from sealed Compass input. `compass`
// shape matches existing PointData: { work, lens, field, call } each with
// { gk_num, gk_line }. The "Work" gate is the v1 identity anchor.
// V1 uses static, original line labels (no copyrighted text).
// ─────────────────────────────────────────────────────────────────────────
// Activation Sequence sphere → canonical line names. `lens` = Evolution,
// `field` = Radiance — these are sphere-specific labels, not interchangeable.
const GK_LINE_NAMES = {
  work:  {1:"Creator", 2:"Dancer", 3:"Changer", 4:"Server", 5:"Fixer", 6:"Teacher"},
  lens:  {1:"Self & Empowerment", 2:"Passion & Relationships", 3:"Energy & Experience",
          4:"Love & Community", 5:"Power & Projection", 6:"Education & Surrender"},
  field: {1:"Solitude", 2:"Marriage", 3:"Interaction", 4:"Friendship", 5:"Impact", 6:"Nurture"},
  call:  {1:"Physicality", 2:"Posture", 3:"Movement", 4:"Breath", 5:"Voice", 6:"Intent"},
};

function parseGate(rawNum, rawLine) {
  const num = parseInt(String(rawNum || "").replace(/[^\d]/g, ""), 10);
  const line = parseInt(String(rawLine || "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(num) || num < 1 || num > 64) return null;
  return {
    gate: num,
    line: (Number.isFinite(line) && line >= 1 && line <= 6) ? line : null,
  };
}

function gkLayer(compass) {
  const c = compass || {};
  const out = {};
  for (const slot of ["work", "lens", "field", "call"]) {
    const p = c[slot];
    if (!p) continue;
    const g = parseGate(p.gk_num, p.gk_line);
    if (!g) continue;
    out[slot] = {
      gate: g.gate,
      line: g.line,
      label: g.line ? (GK_LINE_NAMES[slot][g.line] || null) : null,
    };
  }
  return Object.keys(out).length ? out : null;
}

// ─────────────────────────────────────────────────────────────────────────
// Temporal resonance.
//   - solar_quarter: 0 winter (Dec–Feb), 1 spring (Mar–May),
//     2 summer (Jun–Aug), 3 autumn (Sep–Nov).
//   - lunar_phase 0..7 via synodic-month approximation, baseline
//     2000-01-06 (a known new moon), period 29.53059.
//   - temporal_gate 0..11 (two-hour windows) if birth_time present.
// ─────────────────────────────────────────────────────────────────────────
function solarQuarterFromMonth(mo) {
  // 0 winter Dec-Feb, 1 spring Mar-May, 2 summer Jun-Aug, 3 autumn Sep-Nov.
  if (mo === 12 || mo === 1 || mo === 2) return 0;
  if (mo >= 3 && mo <= 5) return 1;
  if (mo >= 6 && mo <= 8) return 2;
  return 3;
}

function lunarPhaseFromDate(y, mo, d) {
  // Julian Day via Meeus simplification.
  const Y = mo <= 2 ? y - 1 : y;
  const M = mo <= 2 ? mo + 12 : mo;
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
  const synodic = 29.53059;
  const refJD = 2451550.1; // 2000-01-06 (known new moon)
  let phase = ((JD - refJD) % synodic + synodic) % synodic;
  return Math.floor((phase / synodic) * 8) % 8;
}

function temporalLayer(isoDate, hhmm) {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate));
  if (!m) return null;
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  const dow = dt.getUTCDay();
  const solar_quarter = solarQuarterFromMonth(mo);
  const lunar_phase = lunarPhaseFromDate(y, mo, d);
  let temporal_gate = null;
  if (hhmm) {
    const t = /^(\d{1,2}):(\d{2})/.exec(String(hhmm));
    if (t) {
      const hh = Math.max(0, Math.min(23, parseInt(t[1], 10)));
      temporal_gate = Math.floor(hh / 2);
    }
  }
  return { day_of_week: dow, solar_quarter, lunar_phase, temporal_gate };
}

// ─────────────────────────────────────────────────────────────────────────
// Bhramari helpers — Hz → nearest semitone label + octave-equivalent
// visible hue. Pure aesthetic mapping; intentional ≤ ~10% perceptual shift.
// ─────────────────────────────────────────────────────────────────────────
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function hzToSemitone(hz) {
  if (!hz || hz <= 0) return null;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const rounded = Math.round(midi);
  return {
    note: NOTES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    midi: rounded,
    cents: Math.round((midi - rounded) * 100),
  };
}

function hzToVisibleHueDeg(hz) {
  if (!hz || hz <= 0) return null;
  let f = hz;
  while (f < 440) f *= 2;
  while (f >= 880) f /= 2;
  const t = (f - 440) / (880 - 440);
  return Math.round(t * 360) % 360;
}

function roundHz(hz) {
  if (!hz || hz <= 0) return null;
  return Math.round(hz * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────
// Canonical seed string.
// Order is fixed (LP, EX, SU, PE, LUN, SOL, TG) so the byte sequence is
// deterministic across engines. Missing components are omitted from the
// string; the order of the remaining keys is preserved.
// ─────────────────────────────────────────────────────────────────────────
const CANONICAL_SEED_ORDER = ["LP", "EX", "SU", "PE", "LUN", "SOL", "TG", "BHR"];

function canonicalSeedString(parts) {
  return CANONICAL_SEED_ORDER
    .filter(k => parts[k] != null)
    .map(k => `${k}:${parts[k]}`)
    .join("|");
}

// ─────────────────────────────────────────────────────────────────────────
// Hue from Life Path.
// Master numbers map to their own hue family:
//   11 → 36   22 → 72   33 → 108
// Non-masters map to (lp × 40) mod 360 (so 1 → 40, 2 → 80, …, 9 → 0).
// ─────────────────────────────────────────────────────────────────────────
const MASTER_HUES = { 11: 36, 22: 72, 33: 108 };

function lifePathHue(lp) {
  if (lp == null) return 0;
  if (MASTER_HUES[lp] != null) return MASTER_HUES[lp];
  return (lp * 40) % 360;
}

function buildPalette(lp, lunarPhase, primaryGate, bhramariHueDeg) {
  const baseHue = lifePathHue(lp);
  const lunar = Number.isFinite(lunarPhase) ? lunarPhase : 0;
  // OKLCH primary is pinned to `oklch(0.55 0.227 <hue>)` so the canonical
  // colour matches the v1 spec exactly for every life-path family. Lunar
  // phase is preserved upstream — modulation is intentionally not applied
  // to colour at this layer (it shapes contemplation / story / mantra
  // instead, where the modulation reads as meaning rather than tint).
  const chroma = 0.227;
  const lit = 0.55;
  void lunar; // referenced for documentation; engine pins primary lightness.
  const primary = `oklch(${lit.toFixed(2)} ${chroma.toFixed(3)} ${baseHue})`;
  const secondary = `oklch(${lit.toFixed(2)} ${chroma.toFixed(3)} ${(baseHue + 180) % 360})`;
  const gateOffset = primaryGate ? (primaryGate * 7) % 360 : 30;
  const accent = `oklch(${lit.toFixed(2)} ${(chroma * 0.9).toFixed(3)} ${(baseHue + gateOffset) % 360})`;
  const out = {
    primary_hue: baseHue,
    secondary_hue: (baseHue + 180) % 360,
    palette: [primary, secondary, accent],
  };
  if (Number.isFinite(bhramariHueDeg)) {
    const blended = Math.round(baseHue * 0.9 + bhramariHueDeg * 0.1) % 360;
    out.palette_resonance_accent = `oklch(${lit.toFixed(2)} ${chroma.toFixed(3)} ${blended})`;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic sigil SVG. 512×512 viewBox, centre node, N outer points
// placed at SEED-DERIVED angles and radii so the geometry is unique to
// each member. Two layers:
//   A — straight spokes from centre to each point (rays, not closed)
//   B — connecting ring across the sorted points (irregular polygon)
// Plus a small filled centre node. No regular polygon, no construction
// dots — the form is a member-specific yantra.
// ─────────────────────────────────────────────────────────────────────────
function _seededRandomFloat(seedHex, i) {
  // Pull a 32-bit window from the SHA-256 hex using a salted offset and
  // hash with the seed. Deterministic for (seedHex, i).
  const salt = sha256Hex(String(seedHex || "") + ":" + String(i));
  const n = parseInt(salt.slice(0, 8), 16);
  return n / 0xffffffff;
}

function buildSigilSvg(pointCount, seedHex, palette) {
  const N = pointCount === 11 ? 11 : 9;
  const cx = 256, cy = 256;
  // Unit-circle scale ⇒ render radius. Spec ranges are 0.65–0.90 of the
  // sigil's outer reach. We map unit radius to a 200px-half plate so the
  // sigil fills the 512 viewBox the way a yantra fills a mandala disc.
  const RENDER_R = 220;

  const pts = [];
  for (let i = 0; i < N; i++) {
    const angle = _seededRandomFloat(seedHex, i) * Math.PI * 2;
    const radius = 0.65 + _seededRandomFloat(seedHex, i + 100) * 0.25;
    pts.push({ angle, radius });
  }
  // Sort points by angle so the connecting ring traces a coherent loop.
  pts.sort((a, b) => a.angle - b.angle);

  const xy = pts.map(p => ({
    x: +(cx + RENDER_R * p.radius * Math.cos(p.angle)).toFixed(3),
    y: +(cy + RENDER_R * p.radius * Math.sin(p.angle)).toFixed(3),
  }));

  const primary = (palette && palette.palette && palette.palette[0]) || "oklch(0.55 0.227 72)";
  const primaryHue = (palette && palette.primary_hue != null) ? palette.primary_hue : 72;

  // Layer A — straight spokes from centre to each point (not closed).
  // Renders as a unique radial ray pattern. Stroke 1.5, opacity 0.7.
  const spokes = xy.map(p => (
    `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" ` +
    `stroke="${primary}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>`
  )).join("");

  // Layer B — connecting ring across sorted points (irregular polygon).
  // Stroke 2.5, opacity 1.0. Closed path so the form reads as an
  // enclosing irregular polygon — the member's unique outer shape.
  const ringD = xy.map((p, i) => (i === 0 ? "M" : "L") + p.x + "," + p.y).join(" ") + " Z";
  const ring =
    `<path d="${ringD}" fill="none" stroke="${primary}" stroke-width="2.5" ` +
    `stroke-linejoin="round" stroke-linecap="round" opacity="1"/>`;

  // Centre anchor — filled circle in primary colour, radius 5px (spec).
  const center = `<circle cx="${cx}" cy="${cy}" r="5" fill="${primary}"/>`;

  // Subtle palette-derived glow. Inert when the renderer ignores filters.
  // Uses the primary hue at reduced opacity so depth comes from the
  // colour the member is keyed to, not arbitrary noise.
  const glowColor = `oklch(0.55 0.227 ${primaryHue} / 0.35)`;
  const filterDef =
    `<defs><filter id="cu-sigil-glow" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>` +
    `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter></defs>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" ` +
    `class="cu-om-cipher-sigil-svg" ` +
    `style="filter:drop-shadow(0 0 8px ${glowColor})">` +
    filterDef +
    `<g filter="url(#cu-sigil-glow)">` +
    spokes + ring + center +
    `</g>` +
    `</svg>`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Structured om_cipher block (additive — sits alongside the legacy record).
//
// Backward compatibility: the legacy record fields (seed, seed_string,
// seed_identity, metadata, sigil_svg, palette) are untouched. The
// structured block is attached as `record.om_cipher_block` and carries
// the six-layer projection v1.1 callers expect. Master numbers 11/22/33
// are preserved here on expression / soul_urge / personality / birthday
// (the legacy `metadata.*` fields stay single-digit so existing baseline
// hashes / tests remain valid).
// ─────────────────────────────────────────────────────────────────────────

// Master-preserving Pythagorean gematria. Used by the structured block
// (not the legacy seed_string which stays single-digit).
function gematriaSumPythKeepMaster(name, filter) {
  const cleaned = normaliseName(name);
  if (!cleaned) return null;
  let sum = 0;
  for (const ch of cleaned) {
    if (filter && !filter(ch)) continue;
    const v = PYTHAGOREAN[ch];
    if (v) sum += v;
  }
  if (sum === 0) return null;
  return { raw: sum, reduced: digitalRootKeepMaster(sum) };
}

// English ordinal gematria — A=1..Z=26. Returns { raw, reduced } where
// reduced applies a single-digit reduction (masters NOT preserved here:
// the ordinal "root" is canonically single-digit, by convention).
function ordinalGematria(name) {
  const cleaned = normaliseName(name);
  if (!cleaned) return null;
  let sum = 0;
  for (const ch of cleaned) sum += (ch.charCodeAt(0) - 64);
  if (sum === 0) return null;
  return { raw: sum, reduced: digitalRoot(sum) };
}

// Birthday number — day-of-month, master-preserving.
function birthdayNumber(isoDate) {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate));
  if (!m) return null;
  const day = parseInt(m[3], 10);
  return { raw: day, reduced: digitalRootKeepMaster(day) };
}

// Octave / law-of-three from life_path. Deterministic, concise.
// Octave (1..7 of the diatonic scale) = ((lp - 1) % 7) + 1. For master
// numbers we reduce to a non-master root only for octave indexing so the
// table stays within the 7-tone scale.
const OCTAVE_NOTES = { 1:"C", 2:"D", 3:"E", 4:"F", 5:"G", 6:"A", 7:"B" };
const LAW_OF_THREE = {
  1: { triad: "Active",   role: "initiator" },
  2: { triad: "Passive",  role: "receiver" },
  3: { triad: "Neutral",  role: "reconciler" },
  4: { triad: "Active",   role: "stabiliser" },
  5: { triad: "Passive",  role: "messenger" },
  6: { triad: "Neutral",  role: "harmoniser" },
  7: { triad: "Active",   role: "investigator" },
  8: { triad: "Passive",  role: "manifestor" },
  9: { triad: "Neutral",  role: "completer" },
};

function temporalOctave(lifePathReduced, dominantGate) {
  if (lifePathReduced == null) return null;
  const root = lifePathReduced > 9
    ? digitalRoot(lifePathReduced)
    : lifePathReduced;
  const octaveIdx = ((root - 1) % 7) + 1;
  const note = OCTAVE_NOTES[octaveIdx] || null;
  const law = LAW_OF_THREE[root] || null;
  return {
    octave: octaveIdx,
    octave_note: note,
    law_of_three: law,
    dominant_gate: dominantGate || null,
  };
}

// Vibrational mapping — palette hue + authority resonance. Authority
// labels are deterministic look-ups; no narrative content.
const AUTHORITY_RESONANCE = {
  "Emotional Solar Plexus": { current: "wave", pace: "ride the wave to clarity" },
  "Sacral":                 { current: "response", pace: "respond in the moment" },
  "Splenic":                { current: "intuition", pace: "answer in the now" },
  "Ego (Heart)":            { current: "will", pace: "commit when willing" },
  "Self-Projected":         { current: "voice", pace: "speak to discover" },
  "Mental (Outer)":         { current: "environment", pace: "decide in right place" },
  "Lunar (Reflector)":      { current: "lunar cycle", pace: "wait a full lunar cycle" },
};

function vibrationalLayer(palette, authorityLabel, baselineHz) {
  if (!palette) return null;
  const out = {
    primary_hue: palette.primary_hue,
    secondary_hue: palette.secondary_hue,
    palette: palette.palette || null,
  };
  if (authorityLabel && AUTHORITY_RESONANCE[authorityLabel]) {
    out.authority_resonance = Object.assign(
      { authority: authorityLabel },
      AUTHORITY_RESONANCE[authorityLabel]
    );
  } else if (authorityLabel) {
    out.authority_resonance = { authority: authorityLabel };
  }
  if (baselineHz) {
    const tone = hzToSemitone(baselineHz);
    out.bhramari = {
      baseline_hz: roundHz(baselineHz),
      nearest_semitone: tone ? `${tone.note}${tone.octave}` : null,
      octave_visible_hue_deg: hzToVisibleHueDeg(baselineHz),
    };
  }
  return out;
}

// Minimal deterministic phoneme lookup for all 64 gates. We map gate
// number to a Sanskrit-bija-flavoured short syllable seeded from the
// gate value so every gate has a stable, non-narrative phoneme. This
// is not a translation table; it is a deterministic placeholder so the
// structured block surfaces SOMETHING for every member without
// hardcoding only Markus.
const PHONEME_TABLE = (function () {
  const consonants = ["K","KH","G","GH","NG","CH","J","JH","T","TH","D","DH","N",
                      "P","PH","B","BH","M","Y","R","L","V","SH","S","H"];
  const vowels = ["A","I","U","E","O","AM","AH","AU"];
  const out = {};
  for (let g = 1; g <= 64; g++) {
    const c = consonants[(g - 1) % consonants.length];
    const v = vowels[Math.floor((g - 1) / consonants.length) % vowels.length];
    out[g] = c + v;
  }
  return out;
})();

function phonemeForGate(gate) {
  const g = Number(gate);
  if (!Number.isFinite(g) || g < 1 || g > 64) return null;
  return PHONEME_TABLE[g];
}

// Map a Compass-merged slot input to the canonical GK label. The slot
// names (work/lens/field/call) are Compass UI; the canonical GK names
// (cs/ce/us/ue → Life Work / Evolution / Radiance / Purpose) are what
// downstream consumers expect on the structured block.
const GK_SPHERE = {
  work:  { canonical: "cs", label: "Life Work",  sphere: "challenge", line_role_set: "work" },
  lens:  { canonical: "ce", label: "Evolution",  sphere: "challenge", line_role_set: "lens" },
  field: { canonical: "us", label: "Radiance",   sphere: "stability", line_role_set: "field" },
  call:  { canonical: "ue", label: "Purpose",    sphere: "stability", line_role_set: "call" },
};

function geneKeysStructured(compassSlots) {
  if (!compassSlots) return null;
  const out = {};
  Object.keys(GK_SPHERE).forEach(function (slot) {
    const meta = GK_SPHERE[slot];
    const p = compassSlots[slot];
    if (!p) { out[meta.canonical] = null; return; }
    const g = parseGate(p.gk_num, p.gk_line);
    if (!g) { out[meta.canonical] = null; return; }
    out[meta.canonical] = {
      gate: g.gate,
      line: g.line,
      label: meta.label,
      line_label: g.line ? (GK_LINE_NAMES[meta.line_role_set][g.line] || null) : null,
    };
  });
  // Empty block when every slot is null.
  const hasAny = Object.keys(out).some(function (k) { return out[k] != null; });
  return hasAny ? out : null;
}

function humanDesignStructured(hd) {
  if (!hd) return null;
  const ic = hd.incarnation_cross || null;
  const crossLabel = (ic && typeof ic === 'object' && ic.label) ||
                     (typeof ic === 'string' ? ic : null);
  const crossGates = (ic && typeof ic === 'object' && ic.gates) || null;
  return {
    type: hd.type || null,
    profile: hd.profile || null,
    authority: hd.authority || null,
    strategy: hd.strategy || null,
    definition: hd.definition || null,
    incarnation_cross: crossLabel || null,
    incarnation_cross_gates: crossGates || null,
    gates: hd.gates || null,
    channels: hd.channels || null,
    centers: hd.centers || null,
  };
}

function buildOmCipherBlock(input, internals) {
  // internals: { lp, name, gk, gkRaw (compass slots), temporal, palette,
  //              primaryGate, baselineHz, seed }
  const lp = internals.lp;
  const masterName = nameResonanceKeepMaster(input.legal_name || input.preferred_name);
  const ord = ordinalGematria(input.legal_name || input.preferred_name);
  const bday = birthdayNumber(input.birth_date);

  const layer1 = {
    life_path: lp ? {
      value: lp.reduced,
      raw: lp.raw,
      is_master: lp.reduced === 11 || lp.reduced === 22 || lp.reduced === 33,
      method: "commonunity_component_preserve_master",
      components: { day: lp.day, month: lp.month, year: lp.year },
    } : null,
    expression: masterName && masterName.expression ? {
      value: masterName.expression.reduced,
      raw: masterName.expression.raw,
      is_master: [11,22,33].indexOf(masterName.expression.reduced) >= 0,
    } : null,
    soul_urge: masterName && masterName.soul_urge ? {
      value: masterName.soul_urge.reduced,
      raw: masterName.soul_urge.raw,
      is_master: [11,22,33].indexOf(masterName.soul_urge.reduced) >= 0,
    } : null,
    personality: masterName && masterName.personality ? {
      value: masterName.personality.reduced,
      raw: masterName.personality.raw,
      is_master: [11,22,33].indexOf(masterName.personality.reduced) >= 0,
    } : null,
    birthday_number: bday,
    gematria_ordinal: ord ? ord.raw : null,
    gematria_ordinal_root: ord ? ord.reduced : null,
  };

  const layer2 = {
    human_design: humanDesignStructured(input.human_design),
    gene_keys: geneKeysStructured(internals.gkRaw),
  };

  const layer3 = temporalOctave(
    lp ? lp.reduced : null,
    internals.primaryGate
  );
  if (layer3 && internals.temporal) {
    layer3.lunar_phase = internals.temporal.lunar_phase;
    layer3.solar_quarter = internals.temporal.solar_quarter;
    layer3.temporal_gate = internals.temporal.temporal_gate;
  }

  const layer4 = vibrationalLayer(
    internals.palette,
    layer2.human_design && layer2.human_design.authority,
    internals.baselineHz
  );

  const fullName = input.legal_name || input.preferred_name || null;
  // Dominant phoneme — derived from personality Sun gate if HD present,
  // else from the gk Life Work gate, else null. Never narrative.
  let dominantPhoneme = null;
  if (input.human_design && input.human_design.activations
      && input.human_design.activations.personality
      && input.human_design.activations.personality.Sun) {
    dominantPhoneme = phonemeForGate(
      input.human_design.activations.personality.Sun.gate
    );
  }
  if (!dominantPhoneme && internals.primaryGate) {
    dominantPhoneme = phonemeForGate(internals.primaryGate);
  }
  const layer5 = {
    current_name: fullName,
    given_name: input.preferred_name || (fullName ? String(fullName).trim().split(/\s+/)[0] : null),
    family_name: (function () {
      if (!fullName) return null;
      const parts = String(fullName).trim().split(/\s+/);
      if (parts.length < 2) return null;
      return parts.slice(1).join(' ');
    })(),
    gematria_ordinal: ord ? ord.raw : null,
    gematria_ordinal_root: ord ? ord.reduced : null,
    dominant_phoneme: dominantPhoneme,
    cipher_name: deriveCipherName(
      input.preferred_name || (fullName ? String(fullName).trim().split(/\s+/)[0] : null),
      internals.temporal ? internals.temporal.solar_quarter : null,
      internals.temporal ? internals.temporal.lunar_phase : null
    ),
  };

  // Layer 6 — hexagonal / Lissajous / crack sigil. Built last so it
  // can read deterministically from layers 1-5.
  const layer6 = buildHexLissajousCrackSigil({
    seed: internals.seed,
    palette: internals.palette,
    cross_gates: layer2.human_design && layer2.human_design.incarnation_cross_gates,
    octave: layer3 ? layer3.octave : null,
    radiance_gate: layer2.gene_keys && layer2.gene_keys.us
                    ? layer2.gene_keys.us.gate : null,
    life_path: lp ? lp.reduced : null,
  });

  return {
    version: "1.1",
    layer1,
    layer2,
    layer3: layer3 || null,
    layer4: layer4 || null,
    layer5,
    layer6,
    notes: {
      hebrew_gematria_excluded: true,
      personal_year_excluded_from_sealed: true,
      master_preserved_in: ["life_path","expression","soul_urge","personality","birthday_number"],
    },
  };
}

// Master-preserving variant of nameResonance for the structured block.
function nameResonanceKeepMaster(legalName) {
  if (!legalName) return null;
  return {
    expression:  gematriaSumPythKeepMaster(legalName),
    soul_urge:   gematriaSumPythKeepMaster(legalName, ch => VOWELS.has(ch)),
    personality: gematriaSumPythKeepMaster(legalName, ch => !VOWELS.has(ch)),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Hexagonal / Lissajous / Crack sigil (Layer 6, preferred form).
//
// Deterministic SVG generated from sealed structured-block data.
//   - Hexagonal base ring (6-fold symmetry) — fixed geometry.
//   - Incarnation cross gates encoded as 4 axis markers (NE/NW/SW/SE).
//   - Inner Lissajous waveform parameters seeded from octave + life_path.
//   - Crack at the Radiance / growth-edge gate axis (slot us).
//   - Colours read deterministically from the palette layer.
//   - When data is incomplete, render the base ring + omit missing
//     elements gracefully (no crashes, no random/un-seeded paths).
// ─────────────────────────────────────────────────────────────────────────
function buildHexLissajousCrackSigil(args) {
  const cx = 256, cy = 256;
  const R  = 200;
  const palette = args.palette || null;
  const primary = (palette && palette.palette && palette.palette[0]) || "oklch(0.55 0.227 72)";
  const secondary = (palette && palette.palette && palette.palette[1]) || "oklch(0.55 0.227 252)";
  const primaryHue = (palette && palette.primary_hue != null) ? palette.primary_hue : 72;

  // ── Hexagonal base ring ─────────────────────────────────────────────
  const hexPts = [];
  for (let i = 0; i < 6; i++) {
    const a = (-Math.PI / 2) + i * (Math.PI / 3);
    hexPts.push({
      x: +(cx + R * Math.cos(a)).toFixed(3),
      y: +(cy + R * Math.sin(a)).toFixed(3),
    });
  }
  const hexD = hexPts.map((p, i) => (i === 0 ? "M" : "L") + p.x + "," + p.y).join(" ") + " Z";
  const hexagon =
    `<path class="cu-sigil-hex" d="${hexD}" fill="none" ` +
    `stroke="${primary}" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"/>`;

  // ── Cross-gate axis markers ─────────────────────────────────────────
  // Map gates to axis angles. Cross = personality_sun (top), personality_earth
  // (bottom), design_sun (right), design_earth (left). Each marker is a
  // small disc at radius 0.92R on its axis, with the gate number written
  // beside it. Missing gates degrade silently to no marker.
  const cg = args.cross_gates || {};
  const axes = [
    { key: "personality_sun",   gate: cg.personality_sun || null,   angle: -Math.PI / 2 },
    { key: "design_sun",        gate: cg.design_sun || null,         angle: 0 },
    { key: "personality_earth", gate: cg.personality_earth || null,  angle:  Math.PI / 2 },
    { key: "design_earth",      gate: cg.design_earth || null,       angle:  Math.PI },
  ];
  let axisMarkers = "";
  axes.forEach(function (ax) {
    if (!ax.gate) return;
    const r = R * 0.94;
    const x = +(cx + r * Math.cos(ax.angle)).toFixed(3);
    const y = +(cy + r * Math.sin(ax.angle)).toFixed(3);
    axisMarkers +=
      `<circle class="cu-sigil-cross-marker" data-axis="${ax.key}" data-gate="${ax.gate}" ` +
      `cx="${x}" cy="${y}" r="6" fill="${primary}" opacity="0.95"/>` +
      `<text x="${x}" y="${(y + (ax.angle === -Math.PI/2 ? -10 : 16)).toFixed(3)}" ` +
      `fill="${primary}" font-size="11" text-anchor="middle" opacity="0.85">` +
      String(ax.gate) +
      `</text>`;
  });

  // ── Inner Lissajous wave ────────────────────────────────────────────
  // x(t) = A sin(a t + δ); y(t) = B sin(b t). Ratios derived from
  // life_path and octave so the curve is deterministic per member.
  // Defaults keep the figure pleasing when data is incomplete.
  const lp  = Number.isFinite(args.life_path) ? args.life_path : 1;
  const oct = Number.isFinite(args.octave) ? args.octave : 3;
  const a = Math.max(1, ((lp - 1) % 7) + 1);
  const b = Math.max(1, ((oct - 1) % 7) + 1);
  const delta = (lp % 6) * (Math.PI / 6);
  const innerR = R * 0.55;
  const samples = 240;
  let lissD = "";
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * 2 * Math.PI;
    const x = +(cx + innerR * Math.sin(a * t + delta)).toFixed(3);
    const y = +(cy + innerR * Math.sin(b * t)).toFixed(3);
    lissD += (i === 0 ? "M" : "L") + x + "," + y + " ";
  }
  const lissajous =
    `<path class="cu-sigil-lissajous" d="${lissD.trim()}" fill="none" ` +
    `stroke="${secondary}" stroke-width="1.5" stroke-linejoin="round" ` +
    `stroke-linecap="round" opacity="0.75"/>`;

  // ── Growth-edge crack ───────────────────────────────────────────────
  // Stylised jagged line from the centre outward along the Radiance
  // gate axis (mapped to top-right diagonal for visual balance). The
  // crack is drawn whenever a Radiance gate is present; otherwise
  // omitted gracefully.
  let crack = "";
  if (args.radiance_gate) {
    const ang = -Math.PI / 4; // upper-right diagonal, fixed for hex base
    const steps = 6;
    const seedNum = parseInt(String(args.seed || "0").slice(0, 8), 16) || 1;
    let cd = `M${cx},${cy}`;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const baseR = R * 0.95 * t;
      // Deterministic jitter from seed bytes per step.
      const jit  = ((seedNum >> (s * 3)) & 0xff) / 255 - 0.5;
      const jit2 = ((seedNum >> (s * 5)) & 0xff) / 255 - 0.5;
      const px = +(cx + baseR * Math.cos(ang + jit * 0.45) + jit2 * 8).toFixed(3);
      const py = +(cy + baseR * Math.sin(ang + jit * 0.45) + jit2 * 8).toFixed(3);
      cd += ` L${px},${py}`;
    }
    crack =
      `<path class="cu-sigil-crack" data-radiance-gate="${args.radiance_gate}" ` +
      `d="${cd}" fill="none" stroke="${primary}" stroke-width="2.25" ` +
      `stroke-linecap="round" stroke-linejoin="miter" opacity="0.9"/>`;
  }

  // Centre node + subtle glow.
  const center = `<circle class="cu-sigil-center" cx="${cx}" cy="${cy}" r="6" fill="${primary}"/>`;
  const glowColor = `oklch(0.55 0.227 ${primaryHue} / 0.30)`;
  const defs =
    `<defs><filter id="cu-hex-sigil-glow" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>` +
    `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter></defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" ` +
    `class="cu-om-cipher-sigil-svg cu-om-cipher-sigil-hex" ` +
    `data-cu-sigil-form="hex-lissajous-crack" ` +
    `style="filter:drop-shadow(0 0 6px ${glowColor})">` +
    defs +
    `<g filter="url(#cu-hex-sigil-glow)">` +
    hexagon + lissajous + axisMarkers + crack + center +
    `</g>` +
    `</svg>`;

  return {
    form: "hex-lissajous-crack",
    svg,
    params: {
      hex: 6,
      lissajous: { a, b, delta: +delta.toFixed(4) },
      cross_axes_drawn: axes.filter(function (ax) { return ax.gate; }).map(function (ax) { return ax.key; }),
      crack_drawn: !!args.radiance_gate,
      primary_hue: primaryHue,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Compass-sealed input hash. SHA-256 of the canonical JSON projection of
// the identity-only fields (Bhramari excluded). Stable across engines.
// ─────────────────────────────────────────────────────────────────────────
function canonicalInputJson(input) {
  const bp = input.birth_place || {};
  const obj = {
    birth_date: input.birth_date || null,
    birth_time: input.birth_time || null,
    birth_place: bp ? {
      lat: bp.lat != null ? +bp.lat : null,
      lng: bp.lng != null ? +bp.lng : null,
      city: bp.city || null,
      country: bp.country || null,
    } : null,
    legal_name: input.legal_name ? String(input.legal_name).normalize("NFC") : null,
    preferred_name: input.preferred_name ? String(input.preferred_name).normalize("NFC") : null,
  };
  // Stable JSON: sorted keys at each level.
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") {
      const keys = Object.keys(v).sort();
      return "{" + keys.map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
    }
    return JSON.stringify(v == null ? null : v);
  }
  return stable(obj);
}

// ─────────────────────────────────────────────────────────────────────────
// Public — `generate(input)`.
// Input shape (only birth_date is required for canonical generation):
//   {
//     birth_date:     "YYYY-MM-DD",
//     birth_time:     "HH:MM" | null,
//     birth_place:    { lat, lng, city, country } | null,
//     legal_name:     string,
//     preferred_name: string | null,
//     compass: { work, lens, field, call } each { gk_num, gk_line },
//     human_design: { type, authority, profile, definition } | null,
//     seed_syllable: string | null,
//     bhramari_baseline: { hz, metadata } | null,
//   }
// Returns the *private/internal* record. Wrap with `toPublicProjection`
// before exposing to cOMmons / Field.
// ─────────────────────────────────────────────────────────────────────────
function generate(input, options) {
  const opts = options || {};
  if (!isEnabled(opts.featureFlag)) {
    return { pending: true, reason: "om_cipher_disabled" };
  }
  if (!input || !input.birth_date) {
    return { pending: true, reason: "missing_birth_date" };
  }

  const lp = lifePath(input.birth_date);
  const name = nameResonance(input.legal_name || input.preferred_name);
  const gk = gkLayer(input.compass);
  const temporal = temporalLayer(input.birth_date, input.birth_time || null);
  const primaryGate = gk && gk.work ? gk.work.gate : (gk && gk.lens && gk.lens.gate) || null;

  const bhramariOn = isBhramariEnabled(opts.bhramariFlag);
  const baselineHz =
    (bhramariOn && input.bhramari_baseline && Number(input.bhramari_baseline.hz)) || null;
  const baselineMetadata =
    (bhramariOn && input.bhramari_baseline && input.bhramari_baseline.metadata) || null;

  // Canonical seed string parts.
  const seedParts = {};
  if (lp) seedParts.LP = lp.reduced;
  if (name && name.expression) seedParts.EX = name.expression.reduced;
  if (name && name.soul_urge) seedParts.SU = name.soul_urge.reduced;
  if (name && name.personality) seedParts.PE = name.personality.reduced;
  if (temporal) {
    seedParts.LUN = temporal.lunar_phase;
    seedParts.SOL = temporal.solar_quarter;
    if (temporal.temporal_gate != null) seedParts.TG = temporal.temporal_gate;
  }
  if (baselineHz) seedParts.BHR = baselineHz;

  const canonical = canonicalSeedString(seedParts);
  const seed = sha256Hex(canonical);

  // Identity-only seed (BHR excluded) — same canonical key order.
  const identityParts = Object.assign({}, seedParts);
  delete identityParts.BHR;
  const identityCanonical = canonicalSeedString(identityParts);
  const seed_identity = sha256Hex(identityCanonical);

  // Compass-sealed input hash — SHA-256 of canonical JSON projection of
  // the sealed inputs (identity layer). Distinct from the seed; the seed
  // captures derived numerology, the input_hash captures the raw bundle.
  const input_hash = sha256Hex(canonicalInputJson(input));

  // Palette.
  const bhramariHueDeg = baselineHz ? hzToVisibleHueDeg(baselineHz) : null;
  const palette = buildPalette(
    lp && lp.reduced,
    temporal && temporal.lunar_phase,
    primaryGate,
    bhramariHueDeg
  );

  // Sigil scaffold.
  const sigil_points = input.birth_time ? 11 : 9;
  const sigil_svg = buildSigilSvg(sigil_points, seed, palette);

  // Metadata — descriptive labels for downstream display.
  const metadata = {
    life_path: lp ? {
      value: lp.reduced,
      raw: lp.raw,
      day: lp.day, month: lp.month, year: lp.year,
      is_master: lp.reduced === 11 || lp.reduced === 22 || lp.reduced === 33,
      label: NUMEROLOGY_LABELS[lp.reduced] || null,
    } : null,
    // Back-compat alias: `digital_root` mirrors the Life Path for the
    // small set of pre-existing consumers (studio bridge, badge). New
    // code should read `life_path` directly.
    digital_root: lp ? { value: lp.reduced, raw: lp.raw } : null,
    expression: name && name.expression ? {
      value: name.expression.reduced,
      raw: name.expression.raw,
      label: NUMEROLOGY_LABELS[name.expression.reduced] || null,
    } : null,
    soul_urge: name && name.soul_urge ? {
      value: name.soul_urge.reduced,
      raw: name.soul_urge.raw,
      label: NUMEROLOGY_LABELS[name.soul_urge.reduced] || null,
    } : null,
    personality: name && name.personality ? {
      value: name.personality.reduced,
      raw: name.personality.raw,
      label: NUMEROLOGY_LABELS[name.personality.reduced] || null,
    } : null,
    gk_primary: gk && gk.work ? gk.work : null,
    gk_all: gk || null,
    hd_type: input.human_design && input.human_design.type || null,
    hd_authority: input.human_design && input.human_design.authority || null,
    hd_profile: input.human_design && input.human_design.profile || null,
    hd_definition: input.human_design && input.human_design.definition || null,
    hd_strategy: input.human_design && input.human_design.strategy || null,
    hd_incarnation_cross: input.human_design && (
      (input.human_design.incarnation_cross && input.human_design.incarnation_cross.label) ||
      (typeof input.human_design.incarnation_cross === 'string'
        ? input.human_design.incarnation_cross : null)
    ) || null,
    hd_gates: input.human_design && input.human_design.gates || null,
    hd_channels: input.human_design && input.human_design.channels || null,
    hd_centers: input.human_design && input.human_design.centers || null,
    hd_calculation_method: input.human_design && input.human_design.calculation_method || null,
    seed_syllable: input.seed_syllable || null,
    lunar_phase: temporal ? {
      value: temporal.lunar_phase,
      label: LUNAR_PHASE_LABELS[temporal.lunar_phase] || null,
    } : null,
    solar_quarter: temporal ? {
      value: temporal.solar_quarter,
      label: SOLAR_QUARTER_LABELS[temporal.solar_quarter] || null,
    } : null,
    temporal_gate: temporal ? {
      value: temporal.temporal_gate,
      label: temporal.temporal_gate != null
        ? `Two-hour window ${temporal.temporal_gate} (${String(temporal.temporal_gate * 2).padStart(2,"0")}:00–${String(temporal.temporal_gate * 2 + 2).padStart(2,"0")}:00 local birth time)`
        : null,
    } : null,
    seed_string: canonical,
    om_cipher_mantra: (function () {
      if (!lp) return null;
      const lpv = lp.reduced;
      const exv = name && name.expression ? name.expression.reduced : 0;
      const lunv = temporal ? temporal.lunar_phase : 0;
      return omCipherMantra(lpv, exv, lunv);
    })(),
    archetypal_story_seed: (function () {
      if (!name) return null;
      const ex = name.expression ? name.expression.reduced : null;
      const su = name.soul_urge ? name.soul_urge.reduced : null;
      const pe = name.personality ? name.personality.reduced : null;
      return archetypalStorySeed(ex, su, pe);
    })(),
    cipher_contemplation: temporal
      ? cipherContemplation(temporal.lunar_phase, temporal.solar_quarter)
      : null,
    cipher_name: deriveCipherName(
      input.preferred_name || (input.legal_name ? String(input.legal_name).trim().split(/\s+/)[0] : null),
      temporal ? temporal.solar_quarter : null,
      temporal ? temporal.lunar_phase : null
    ),
    palette_rationale:
      `Hue ${palette.primary_hue}° from Life Path ${lp ? lp.reduced : "-"}; ` +
      `lunar phase ${temporal ? temporal.lunar_phase : "-"} modulates saturation; ` +
      `secondary ${palette.secondary_hue}° is the complement` +
      (primaryGate ? `; gate ${primaryGate} sets accent offset` : "") +
      (bhramariHueDeg != null ? `; Bhramari accent at ${bhramariHueDeg}°` : ""),
    sigil_points,
    seed_hash: seed.slice(0, 16) + "..." + seed.slice(-4),
  };

  if (baselineHz) {
    const tone = hzToSemitone(baselineHz);
    metadata.bhramari = {
      baseline_hz: baselineHz,
      nearest_semitone: tone ? `${tone.note}${tone.octave}` : null,
      octave_visible_hue_deg: bhramariHueDeg,
      captured_at: baselineMetadata && baselineMetadata.captured_at || null,
      stability: baselineMetadata && baselineMetadata.stability != null
        ? baselineMetadata.stability : null,
      confidence: baselineMetadata && baselineMetadata.confidence != null
        ? baselineMetadata.confidence : null,
      note: "Optional measured resonance. Refinement history via /resonance-events.",
    };
  }

  // Structured om_cipher block (v1.1) — additive, backward-compatible.
  // Derived from the same canonical state used for the legacy fields so
  // there is no duplicate user input. Master numbers preserved here on
  // numerology values; legacy `metadata.*` values stay single-digit so
  // existing baseline hashes and tests are not disturbed.
  let om_cipher_block = null;
  try {
    om_cipher_block = buildOmCipherBlock(input, {
      lp,
      gkRaw: input.compass,
      temporal,
      palette,
      primaryGate,
      baselineHz,
      seed,
    });
  } catch (_) { om_cipher_block = null; }

  return {
    version: 1,
    pending: false,
    generated_at: opts.now || new Date().toISOString(),
    seed,
    seed_string: canonical,
    seed_identity,
    input_hash,
    palette,
    sigil_svg,
    om_cipher_block,
    metadata,
    sealed_inputs: {
      birth_date: input.birth_date,
      birth_time: input.birth_time || null,
      birth_place: input.birth_place || null,
      legal_name: input.legal_name || null,
      preferred_name: input.preferred_name || null,
      compass: input.compass || null,
      human_design: input.human_design || null,
      seed_syllable: input.seed_syllable || null,
    },
    bhramari_baseline_hz: baselineHz,
    bhramari_baseline_metadata: baselineMetadata,
    visibility_tier: "private",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public projection — strips private fields. Two tiers:
//   "badge"  → safe glyph + palette + primary GK label
//   "shared" → adds semitone-level Bhramari (no raw hz/metadata)
// ─────────────────────────────────────────────────────────────────────────
function toPublicProjection(record, tier) {
  if (!record || record.pending) return null;
  const t = tier || "badge";
  const meta = record.metadata || {};
  const out = {
    version: record.version || 1,
    palette: record.palette || null,
    gk_primary_label: meta.gk_primary
      ? `Gate ${meta.gk_primary.gate}${meta.gk_primary.line ? "." + meta.gk_primary.line : ""}` +
        (meta.gk_primary.label ? ` · ${meta.gk_primary.label}` : "")
      : null,
    life_path_label: meta.life_path ? meta.life_path.value : null,
    // Back-compat: digital_root_label mirrors life_path for old consumers.
    digital_root_label: meta.life_path ? meta.life_path.value : null,
    sigil_points: meta.sigil_points || 9,
  };
  if (t === "shared") {
    if (meta.bhramari && meta.bhramari.nearest_semitone) {
      out.bhramari_semitone = meta.bhramari.nearest_semitone;
      out.bhramari_hz_rounded = roundHz(record.bhramari_baseline_hz);
    }
    if (meta.lunar_phase) out.lunar_phase = meta.lunar_phase.value;
    if (meta.solar_quarter) out.solar_quarter = meta.solar_quarter.value;
  }
  return out;
}

// Append-only resonance event — pure helper; caller persists.
function appendResonanceEvent(record, capture, options) {
  const opts = options || {};
  if (!capture || !Number(capture.hz)) {
    throw new Error("resonance event requires hz");
  }
  return {
    id: opts.id || null,
    member_id: (record && record.member_id) || null,
    captured_at: (capture.metadata && capture.metadata.captured_at) ||
                 opts.now || new Date().toISOString(),
    bhramari_hz: Number(capture.hz),
    metadata: capture.metadata || null,
    capture_method: (capture.metadata && capture.metadata.capture_method) ||
                    "bhramari-shanmukhi-v1",
    source_surface: capture.source_surface || "unknown",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Static descriptive labels. Short, original phrasing — no copyrighted text.
// ─────────────────────────────────────────────────────────────────────────
const NUMEROLOGY_LABELS = {
  1:  "Initiator — independence, beginnings",
  2:  "Mediator — partnership, balance",
  3:  "Expresser — creativity, communication",
  4:  "Builder — structure, foundation",
  5:  "Voyager — change, freedom",
  6:  "Nurturer — service, harmony",
  7:  "Seeker — introspection, study",
  8:  "Manifestor — power, mastery",
  9:  "Completer — release, compassion",
  11: "Illuminator — intuition, vision",
  22: "Master Builder — material vision realized",
  33: "Master Teacher — devotion, healing",
};

const LUNAR_PHASE_LABELS = {
  0: "New Moon — seed",
  1: "Waxing Crescent — intention",
  2: "First Quarter — decision",
  3: "Waxing Gibbous — refine",
  4: "Full Moon — illumination",
  5: "Waning Gibbous — share",
  6: "Last Quarter — release",
  7: "Waning Crescent — rest",
};

const SOLAR_QUARTER_LABELS = {
  0: "Winter — incubation",
  1: "Spring — emergence",
  2: "Summer — fullness",
  3: "Autumn — harvest",
};

// ─────────────────────────────────────────────────────────────────────────
// Temporal phrase lookup — Solar Quarter × Lunar Phase. Used by the
// derived Cipher Name (`[Preferred Name] of the [Temporal Qualifier]`).
// Each season carries a phase-specific qualifier so the title is
// archetypal yet unique. For Markus (solar 3 / lunar 6) the lookup
// resolves to "of the Autumn Gate".
// ─────────────────────────────────────────────────────────────────────────
const TEMPORAL_PHRASES = {
  // Winter (0)
  "0_0": "of the Winter Seed",
  "0_1": "of the Winter Quickening",
  "0_2": "of the Winter Threshold",
  "0_3": "of the Winter Forging",
  "0_4": "of the Winter Lantern",
  "0_5": "of the Winter Hearth",
  "0_6": "of the Winter Release",
  "0_7": "of the Winter Stillness",
  // Spring (1)
  "1_0": "of the Spring Awakening",
  "1_1": "of the Spring Rising",
  "1_2": "of the Spring Threshold",
  "1_3": "of the Spring Tending",
  "1_4": "of the Spring Bloom",
  "1_5": "of the Spring Offering",
  "1_6": "of the Spring Release",
  "1_7": "of the Spring Quiet",
  // Summer (2)
  "2_0": "of the Summer Spark",
  "2_1": "of the Summer Tending",
  "2_2": "of the Summer Crossing",
  "2_3": "of the Summer Ripening",
  "2_4": "of the Summer Crown",
  "2_5": "of the Summer Harvest",
  "2_6": "of the Summer Release",
  "2_7": "of the Summer Long Light",
  // Autumn (3)
  "3_0": "of the Autumn Seed",
  "3_1": "of the Autumn Turning",
  "3_2": "of the Autumn Threshold",
  "3_3": "of the Autumn Gathering",
  "3_4": "of the Autumn Harvest",
  "3_5": "of the Autumn Offering",
  "3_6": "of the Autumn Gate",
  "3_7": "of the Autumn Rest",
};

function temporalPhrase(solarQuarter, lunarPhase) {
  if (solarQuarter == null || lunarPhase == null) return null;
  const key = `${solarQuarter}_${lunarPhase}`;
  return TEMPORAL_PHRASES[key] || null;
}

// Derived Cipher Name: `[Preferred Name] [temporal phrase]`.
// e.g. for Markus (solar 3, lunar 6): "Markus of the Autumn Gate".
function deriveCipherName(preferredName, solarQuarter, lunarPhase) {
  if (!preferredName) return null;
  const who = String(preferredName).trim().split(/\s+/)[0];
  if (!who) return null;
  const phrase = temporalPhrase(solarQuarter, lunarPhase);
  if (!phrase) return who;
  return `${who} ${phrase}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 6 — Contemplative outputs.
// Deterministic mirrors derived from sealed Layer 1-2 outputs. The user's
// evolving personal mantra / story / contemplation live in the Living
// Profile; these are the Om Cipher's read-only reflections.
// Data assets live in `data/om_cipher/*.json` (canonical) and are mirrored
// to `sdk/om_cipher_layer6_data.js` for the browser. Generation script:
// `scripts/build_layer6_js.py`.
// ─────────────────────────────────────────────────────────────────────────
function _loadLayer6Data() {
  try {
    if (typeof require === "function") {
      // eslint-disable-next-line global-require
      return require("./om_cipher_layer6_data.js");
    }
  } catch (_) { /* fall through */ }
  if (typeof window !== "undefined" && window.cuOmCipherLayer6) {
    return window.cuOmCipherLayer6;
  }
  return { MANTRA_TABLE: null, ARCHETYPAL_STORIES: null, CONTEMPLATIONS: null };
}

const _LAYER6 = _loadLayer6Data();

function omCipherMantra(lifePathValue, expressionValue, lunarPhaseValue) {
  const table = _LAYER6.MANTRA_TABLE;
  if (!table || !Array.isArray(table.entries) || table.entries.length === 0) {
    return null;
  }
  const lp = Number.isFinite(lifePathValue) ? lifePathValue : 0;
  const ex = Number.isFinite(expressionValue) ? expressionValue : 0;
  const lun = Number.isFinite(lunarPhaseValue) ? lunarPhaseValue : 0;
  const size = table.size || table.entries.length;
  const idx = ((lp + ex + lun) % size + size) % size;
  const entry = table.entries[idx];
  if (!entry) return null;
  return {
    index: idx,
    mantra: entry.mantra,
    keynote: entry.keynote || null,
  };
}

function archetypalStorySeed(expressionValue, soulUrgeValue, personalityValue) {
  const data = _LAYER6.ARCHETYPAL_STORIES;
  if (!data) return null;
  // Primary lookup: keyed `${expression}_${soul_urge}` so combinations
  // with hand-authored archetypal portraits surface intact. Falls back
  // to fragment composition when no key is hit.
  const key = (expressionValue != null && soulUrgeValue != null)
    ? `${expressionValue}_${soulUrgeValue}`
    : null;
  if (key && data.stories && data.stories[key]) {
    const s = data.stories[key];
    return {
      seed: s.story_seed,
      key: s.key || key,
      keynote: s.keynote || null,
      source: "keyed",
    };
  }
  const frags = data.fragments;
  if (!frags) return null;
  function pick(slot, val) {
    const dict = frags[slot] || {};
    if (val != null && dict[String(val)]) return dict[String(val)];
    return null;
  }
  const ex = pick("expression", expressionValue);
  const su = pick("soul_urge", soulUrgeValue);
  const pe = pick("personality", personalityValue);
  const bits = [ex, su, pe].filter(Boolean);
  if (!bits.length) return null;
  return {
    seed: bits.join(" "),
    key: key,
    keynote: null,
    source: "fragments",
    expression_fragment: ex,
    soul_urge_fragment: su,
    personality_fragment: pe,
  };
}

function cipherContemplation(lunarPhaseValue, solarQuarterValue) {
  const data = _LAYER6.CONTEMPLATIONS;
  if (!data || !data.phases) return null;
  const phase = data.phases[String(lunarPhaseValue)] || null;
  if (!phase) return null;
  const solarMod = (data.solar_modifier && data.solar_modifier[String(solarQuarterValue)]) || null;
  return {
    phrase: phase,
    solar_modifier: solarMod,
    combined: solarMod ? (phase + " " + solarMod) : phase,
  };
}

const _exports = {
  // entry points
  generate,
  toPublicProjection,
  appendResonanceEvent,
  // flag checks
  isEnabled,
  isBhramariEnabled,
  // helpers (exported for tests + downstream layers)
  lifePath,
  birthRoot,
  nameResonance,
  gkLayer,
  temporalLayer,
  hzToSemitone,
  hzToVisibleHueDeg,
  roundHz,
  digitalRoot,
  digitalRootKeepMaster,
  sha256Hex,
  lifePathHue,
  canonicalSeedString,
  // Layer 6 — contemplative outputs.
  omCipherMantra,
  archetypalStorySeed,
  cipherContemplation,
  // Derived cipher name (temporal-phrase based).
  temporalPhrase,
  deriveCipherName,
  TEMPORAL_PHRASES,
  // Structured om_cipher block (v1.1).
  buildOmCipherBlock,
  nameResonanceKeepMaster,
  ordinalGematria,
  birthdayNumber,
  phonemeForGate,
  buildHexLissajousCrackSigil,
  PHONEME_TABLE,
  // labels — public so the studio adapter can render without re-encoding.
  NUMEROLOGY_LABELS,
  LUNAR_PHASE_LABELS,
  SOLAR_QUARTER_LABELS,
  GK_LINE_NAMES,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = _exports;
}
if (typeof window !== "undefined") {
  window.cuOmCipher = _exports;
}

})();
