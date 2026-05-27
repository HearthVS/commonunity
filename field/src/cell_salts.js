// Vendored copy of repo-root sdk/cell_salts.js so the field/ Docker build
// context (rootDirectory=/field on Railway) can resolve it without reaching
// above /app. Canonical source: ../../sdk/cell_salts.ts — keep in sync.
/**
 * CommonUnity SDK — Tissue Salt Layer (cell salts) · JS mirror
 * Canonical source: sdk/cell_salts.ts — keep in sync.
 *
 * Symbolic / somatic / contemplative. NOT medical advice.
 *
 * The twelve Schuessler tissue salts each carry an archetypal crystal
 * geometry (symmetry, bond motif, node density) which the Sigil engine
 * projects as a faint inner layer under the OM halo + Compass.
 */

const CELL_SALTS = [
  {
    id: "calc_fluor",
    name: "Calcarea Fluorica",
    formula: "CaF₂",
    primarySymmetry: "cubic",
    bondMotif: "paired",
    nodeDensity: "dense",
    shortBodyZone: "Elastic tissue · enamel · ligaments",
    shortTheme: "Resilience held in suppleness",
  },
  {
    id: "calc_phos",
    name: "Calcarea Phosphorica",
    formula: "Ca₃(PO₄)₂",
    primarySymmetry: "hexagonal",
    bondMotif: "ring",
    nodeDensity: "medium",
    shortBodyZone: "Bone · teeth · cellular framework",
    shortTheme: "Structure that grows with you",
  },
  {
    id: "calc_sulph",
    name: "Calcarea Sulphurica",
    formula: "CaSO₄",
    primarySymmetry: "orthorhombic",
    bondMotif: "branching",
    nodeDensity: "medium",
    shortBodyZone: "Clearing tissues · drainage pathways",
    shortTheme: "Release of what has finished",
  },
  {
    id: "ferr_phos",
    name: "Ferrum Phosphoricum",
    formula: "FePO₄",
    primarySymmetry: "network",
    bondMotif: "cross",
    nodeDensity: "dense",
    shortBodyZone: "Blood · oxygen transport · first response",
    shortTheme: "Bright vigilance at the threshold",
  },
  {
    id: "kali_mur",
    name: "Kali Muriaticum",
    formula: "KCl",
    primarySymmetry: "cubic",
    bondMotif: "paired",
    nodeDensity: "medium",
    shortBodyZone: "Fibrin · mucous membranes",
    shortTheme: "Steady weave of containment",
  },
  {
    id: "kali_phos",
    name: "Kali Phosphoricum",
    formula: "K₂HPO₄",
    primarySymmetry: "orthorhombic",
    bondMotif: "branching",
    nodeDensity: "sparse",
    shortBodyZone: "Nerves · brain · cellular charge",
    shortTheme: "Quiet electricity of attention",
  },
  {
    id: "kali_sulph",
    name: "Kali Sulphuricum",
    formula: "K₂SO₄",
    primarySymmetry: "orthorhombic",
    bondMotif: "ring",
    nodeDensity: "medium",
    shortBodyZone: "Skin · oxygen exchange in cells",
    shortTheme: "Carrying breath to the edges",
  },
  {
    id: "mag_phos",
    name: "Magnesia Phosphorica",
    formula: "MgHPO₄",
    primarySymmetry: "hexagonal",
    bondMotif: "ring",
    nodeDensity: "sparse",
    shortBodyZone: "Muscle · nerve sheath · rhythm",
    shortTheme: "Release of held contraction",
  },
  {
    id: "nat_mur",
    name: "Natrum Muriaticum",
    formula: "NaCl",
    primarySymmetry: "cubic",
    bondMotif: "paired",
    nodeDensity: "dense",
    shortBodyZone: "Fluid balance · tears · saliva",
    shortTheme: "Held and let-go of water",
  },
  {
    id: "nat_phos",
    name: "Natrum Phosphoricum",
    formula: "Na₂HPO₄",
    primarySymmetry: "orthorhombic",
    bondMotif: "cross",
    nodeDensity: "medium",
    shortBodyZone: "Acid–alkaline balance · digestion",
    shortTheme: "Equilibrium between fire and ground",
  },
  {
    id: "nat_sulph",
    name: "Natrum Sulphuricum",
    formula: "Na₂SO₄",
    primarySymmetry: "orthorhombic",
    bondMotif: "branching",
    nodeDensity: "medium",
    shortBodyZone: "Liver · intercellular fluid · clearing",
    shortTheme: "Letting old water move on",
  },
  {
    id: "silicea",
    name: "Silicea",
    formula: "SiO₂",
    primarySymmetry: "network",
    bondMotif: "cross",
    nodeDensity: "dense",
    shortBodyZone: "Connective tissue · hair · nails · nerves",
    shortTheme: "Bright spine through delicate form",
  },
];

const SALT_INDEX = CELL_SALTS.reduce(function (acc, s) {
  acc[s.id] = s;
  return acc;
}, Object.create(null));

function getCellSalt(id) {
  if (!id) return null;
  return SALT_INDEX[id] || null;
}

/**
 * Derive the geometry profile from a SaltConfig[]. Primary = salts[0];
 * secondary salts are accepted/passed through but do not affect geometry
 * yet (reserved for future color/motif accents).
 *
 * Returns null when no usable primary is provided.
 */
function getSaltGeometryProfile(salts) {
  if (!salts || !salts.length) return null;
  const primary = salts[0];
  if (!primary || !primary.saltId) return null;
  const salt = getCellSalt(primary.saltId);
  if (!salt) return null;
  return {
    symmetry: salt.primarySymmetry,
    bondMotif: salt.bondMotif,
    nodeDensity: salt.nodeDensity,
    saltId: salt.id,
  };
}

/**
 * UI-ready view: primary = salts[0], secondaries = salts[1] / salts[2].
 */
function getPersonSaltView(salts) {
  if (!salts || !salts.length) return { primary: null, secondary: [] };
  const primary = getCellSalt(salts[0] && salts[0].saltId);
  const secondary = [];
  const max = Math.min(salts.length, 3);
  for (let i = 1; i < max; i++) {
    const s = getCellSalt(salts[i] && salts[i].saltId);
    if (s) secondary.push(s);
  }
  return { primary, secondary };
}

// ── Sign → salt mapping (mirrors sdk/cell_salts.js) ─────────────────────
const ZODIAC_SALT_MAP = {
  aries:       "kali_phos",
  taurus:      "nat_sulph",
  gemini:      "kali_mur",
  cancer:      "calc_fluor",
  leo:         "mag_phos",
  virgo:       "kali_sulph",
  libra:       "nat_phos",
  scorpio:     "calc_sulph",
  sagittarius: "silicea",
  capricorn:   "calc_phos",
  aquarius:    "nat_mur",
  pisces:      "ferr_phos",
};

function getSaltForSign(sign) {
  if (sign == null) return null;
  var key = String(sign).trim().toLowerCase();
  return ZODIAC_SALT_MAP[key] || null;
}

function _hash32(str) {
  var h = 0x811c9dc5;
  var s = String(str || "");
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function deriveFallbackSalts(seed) {
  var s = String(seed == null ? "" : seed);
  if (!s) return null;
  var n = CELL_SALTS.length;
  var pIdx = _hash32("primary:" + s) % n;
  var mIdx = _hash32("moon:"    + s) % n;
  var aIdx = _hash32("asc:"     + s) % n;
  if (mIdx === pIdx) mIdx = (mIdx + 1) % n;
  if (aIdx === pIdx) aIdx = (aIdx + 1) % n;
  if (aIdx === mIdx) aIdx = (aIdx + 1) % n;
  if (aIdx === pIdx) aIdx = (aIdx + 1) % n;
  return [
    { saltId: CELL_SALTS[pIdx].id, weight: 1.0, kind: "primary"   },
    { saltId: CELL_SALTS[mIdx].id, weight: 0.6, kind: "secondary" },
    { saltId: CELL_SALTS[aIdx].id, weight: 0.4, kind: "secondary" },
  ];
}

function assignSaltsFromBirth(input) {
  var inp = input || {};
  var vedic = inp.vedic || {};
  var pSign = inp.sun  || vedic.sun  || null;
  var mSign = inp.moon || vedic.moon || null;
  var aSign = inp.rising || inp.ascendant || vedic.ascendant || null;

  var primaryId = getSaltForSign(pSign);
  var moonId    = getSaltForSign(mSign);
  var ascId     = getSaltForSign(aSign);

  if (!primaryId && !moonId && !ascId) {
    return inp.seed ? deriveFallbackSalts(inp.seed) : null;
  }

  var picks = [];
  function tryAdd(id, weight, kind) {
    if (!id) return;
    for (var i = 0; i < picks.length; i++) if (picks[i].saltId === id) return;
    picks.push({ saltId: id, weight: weight, kind: kind });
  }

  var primaryActual = primaryId || moonId || ascId;
  tryAdd(primaryActual, 1.0, "primary");
  if (primaryActual !== moonId) tryAdd(moonId, 0.6, "secondary");
  if (primaryActual !== ascId)  tryAdd(ascId,  0.4, "secondary");

  if (picks.length < 3 && inp.seed) {
    var fb = deriveFallbackSalts(inp.seed) || [];
    for (var j = 0; j < fb.length && picks.length < 3; j++) {
      var weight = picks.length === 1 ? 0.6 : 0.4;
      tryAdd(fb[j].saltId, weight, "secondary");
    }
  }
  return picks.length ? picks : null;
}

module.exports = {
  CELL_SALTS,
  getCellSalt,
  getSaltGeometryProfile,
  getPersonSaltView,
  ZODIAC_SALT_MAP,
  getSaltForSign,
  deriveFallbackSalts,
  assignSaltsFromBirth,
};
