/**
 * CommonUnity SDK — Tissue Salt Layer (cell salts)
 * ==================================================
 * CANONICAL SOURCE. Lives in sdk/cell_salts.ts.
 * A vanilla JS mirror at sdk/cell_salts.js keeps the Compass/Studio
 * runtime path working (the page uses CommonJS-style globals via
 * window.cuCellSalts). Keep the two in sync.
 *
 * The tissue salt layer is symbolic / somatic / contemplative.
 * It is NOT medical advice and never reads as a diagnosis.
 *
 * The twelve Schuessler tissue salts each carry an archetypal
 * crystal geometry (symmetry, bond motif, intersection density)
 * that the Sigil engine projects as a faint geometry layer
 * underneath the existing OM halo and Compass rings.
 */

export type CellSaltId =
  | "calc_fluor"
  | "calc_phos"
  | "calc_sulph"
  | "ferr_phos"
  | "kali_mur"
  | "kali_phos"
  | "kali_sulph"
  | "mag_phos"
  | "nat_mur"
  | "nat_phos"
  | "nat_sulph"
  | "silicea";

export type SymmetryType = "cubic" | "hexagonal" | "orthorhombic" | "network";
export type BondMotif = "paired" | "cross" | "ring" | "branching";
export type NodeDensity = "sparse" | "medium" | "dense";

export interface CellSalt {
  id: CellSaltId;
  name: string;
  formula: string;
  primarySymmetry: SymmetryType;
  bondMotif: BondMotif;
  nodeDensity: NodeDensity;
  shortBodyZone: string;
  shortTheme: string;
}

export const CELL_SALTS: CellSalt[] = [
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

export interface SaltConfig {
  saltId: CellSaltId;
  weight: number;
}

export interface SaltGeometryProfile {
  symmetry: SymmetryType;
  bondMotif: BondMotif;
  nodeDensity: NodeDensity;
  saltId: CellSaltId;
}

const SALT_INDEX: Record<CellSaltId, CellSalt> = CELL_SALTS.reduce(
  (acc, s) => { acc[s.id] = s; return acc; },
  {} as Record<CellSaltId, CellSalt>,
);

export function getCellSalt(id: CellSaltId | string | null | undefined): CellSalt | null {
  if (!id) return null;
  return SALT_INDEX[id as CellSaltId] || null;
}

/**
 * Derive the geometry profile from a SaltConfig[]. The primary salt is
 * always salts[0]; secondaries are accepted/passed through but do not
 * yet contribute to geometry (they will drive future color/motif accents).
 *
 * Returns null if there is no usable primary salt.
 */
export function getSaltGeometryProfile(
  salts: SaltConfig[] | null | undefined,
): SaltGeometryProfile | null {
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

export interface PersonSaltView {
  primary: CellSalt | null;
  secondary: CellSalt[];
}

/**
 * Derive a UI-ready view from a SaltConfig[]: primary = salts[0],
 * secondaries = salts[1] and salts[2] when present.
 */
export function getPersonSaltView(
  salts: SaltConfig[] | null | undefined,
): PersonSaltView {
  if (!salts || !salts.length) return { primary: null, secondary: [] };
  const primary = getCellSalt(salts[0]?.saltId);
  const secondary: CellSalt[] = [];
  for (let i = 1; i < Math.min(salts.length, 3); i++) {
    const s = getCellSalt(salts[i]?.saltId);
    if (s) secondary.push(s);
  }
  return { primary, secondary };
}

// ── Sign → salt assignment (Schüssler/Carey-style tropical zodiac) ─────
//
// Symbolic / contemplative. NOT medical.

export type ZodiacSign =
  | "aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo"
  | "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces";

export const ZODIAC_SALT_MAP: Record<ZodiacSign, CellSaltId> = {
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

export function getSaltForSign(sign: string | null | undefined): CellSaltId | null {
  if (!sign) return null;
  const key = String(sign).trim().toLowerCase() as ZodiacSign;
  return (ZODIAC_SALT_MAP as Record<string, CellSaltId>)[key] || null;
}

function _hash32(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function deriveFallbackSalts(seed: string | null | undefined): SaltConfig[] | null {
  const s = String(seed == null ? "" : seed);
  if (!s) return null;
  const n = CELL_SALTS.length;
  let pIdx = _hash32("primary:" + s) % n;
  let mIdx = _hash32("moon:"    + s) % n;
  let aIdx = _hash32("asc:"     + s) % n;
  if (mIdx === pIdx) mIdx = (mIdx + 1) % n;
  if (aIdx === pIdx) aIdx = (aIdx + 1) % n;
  if (aIdx === mIdx) aIdx = (aIdx + 1) % n;
  if (aIdx === pIdx) aIdx = (aIdx + 1) % n;
  return [
    { saltId: CELL_SALTS[pIdx].id, weight: 1.0 },
    { saltId: CELL_SALTS[mIdx].id, weight: 0.6 },
    { saltId: CELL_SALTS[aIdx].id, weight: 0.4 },
  ];
}

export interface SaltAssignmentInput {
  sun?: string | null;
  moon?: string | null;
  rising?: string | null;
  ascendant?: string | null;
  vedic?: { sun?: string | null; moon?: string | null; ascendant?: string | null };
  seed?: string | null;
}

export function assignSaltsFromBirth(input: SaltAssignmentInput | null | undefined): SaltConfig[] | null {
  const inp = input || {};
  const vedic = inp.vedic || {};
  const pSign = inp.sun  || vedic.sun  || null;
  const mSign = inp.moon || vedic.moon || null;
  const aSign = inp.rising || inp.ascendant || vedic.ascendant || null;

  const primaryId = getSaltForSign(pSign);
  const moonId    = getSaltForSign(mSign);
  const ascId     = getSaltForSign(aSign);

  if (!primaryId && !moonId && !ascId) {
    return inp.seed ? deriveFallbackSalts(inp.seed) : null;
  }

  const picks: SaltConfig[] = [];
  const tryAdd = (id: CellSaltId | null, weight: number) => {
    if (!id) return;
    if (picks.some(p => p.saltId === id)) return;
    picks.push({ saltId: id, weight });
  };

  const primaryActual = primaryId || moonId || ascId;
  tryAdd(primaryActual, 1.0);
  if (primaryActual !== moonId) tryAdd(moonId, 0.6);
  if (primaryActual !== ascId)  tryAdd(ascId,  0.4);

  if (picks.length < 3 && inp.seed) {
    const fb = deriveFallbackSalts(inp.seed) || [];
    for (const f of fb) {
      if (picks.length >= 3) break;
      tryAdd(f.saltId, picks.length === 1 ? 0.6 : 0.4);
    }
  }
  return picks.length ? picks : null;
}
