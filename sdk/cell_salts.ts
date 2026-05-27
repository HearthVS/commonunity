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
