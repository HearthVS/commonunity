/**
 * CommonUnity Key — Canonical Schema
 * ===================================
 * The Key is a portable JSON file that travels with the user.
 * It is the identity carrier for the entire CommonUnity ecosystem.
 *
 * Design principles:
 *   - Decentralised: no central server holds this data. The user owns it.
 *   - Portable: works on USB stick, local drive, phone, encrypted cloud.
 *   - Additive: each app writes only its own section; other sections untouched.
 *   - Offline-first: all apps function without internet using only the key.
 *   - Schema-versioned: migrations are incremental, never destructive.
 *
 * File naming convention: {name}-commonunity-{date}.json
 * e.g.  markus-commonunity-2026-05-04.json
 *
 * Each app exports and imports using this schema. Sections are optional —
 * a key from a Tuner-only user will have no compass or studio section.
 */

// ─── Schema version ───────────────────────────────────────────────────────────

export const KEY_SCHEMA_VERSION = "1.0.0";

// ─── Gene Keys profile (calculated once, shared across all apps) ──────────────

export interface GeneKeysActivation {
  gate: number;       // 1–64
  line: number;       // 1–6
  longitude: number;  // solar longitude in degrees (for verification)
}

export interface GeneKeysProfile {
  /** Natal Sun — Life's Work sphere */
  lifesWork: GeneKeysActivation;
  /** Natal Sun − 88° — Radiance sphere (Venus Sequence primary) */
  radiance: GeneKeysActivation;
  /** Natal Earth (Sun + 180°) — Evolution sphere */
  evolution: GeneKeysActivation;
  /** Radiance Earth (Radiance + 180°) — Purpose sphere */
  purpose: GeneKeysActivation;
  /** Birth data used for calculation */
  birthDate: string;        // YYYY-MM-DD
  birthTime?: string;       // HH:MM UTC (optional — improves line precision)
  birthPlace?: string;      // human-readable, for reference only
  /** Verification: which app performed the calculation */
  calculatedBy: "compass" | "tuner" | "studio";
  calculatedAt: string;     // ISO 8601
  /** Schema of the calculation engine used */
  engineVersion: string;    // e.g. "v2.0" — matches SYNTHESIS_ENGINE.md
}

// ─── Compass section ──────────────────────────────────────────────────────────

export interface CompassKey {
  /** User's display name / companion name */
  companion?: string;
  /** Primary guide selected */
  guide?: string;
  /** UI theme preference */
  theme?: string;
  /** Saved tradition/lineage preference */
  tradition?: string;
  /** Compass session history (lightweight — gate/line + date) */
  sessions?: Array<{
    date: string;
    notes?: string;
  }>;
}

// ─── Studio section ───────────────────────────────────────────────────────────

export interface StudioKey {
  /** User's instrument inventory (ids from the inventory atlas) */
  instruments?: string[];
  /** Preferred tuning standard */
  tuningStandard?: "432" | "440" | "528";
  /** Session preferences */
  preferences?: Record<string, unknown>;
}

// ─── Tuner section ────────────────────────────────────────────────────────────

/** A single client profile as exported from Tuner */
export interface TunerClientProfile {
  clientName?: string;
  clientEmail?: string;
  practitionerName?: string;
  sessionDate?: string;
  dominantDosha?: string;
  dominantCenter?: string;
  suggestedChakraFocus?: string;
  recommendedProtocolId?: string;
  recommendedComfortTier?: number;
  intentionText?: string;
  contraindicationFlags?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  /** Full RadianceProfile synthesis — cached so it never needs recalculation */
  radianceProfile?: unknown;
  /** ISO timestamp of last update */
  updatedAt?: string;
}

export interface TunerKey {
  /** Practitioner's own profile (if this key belongs to a practitioner) */
  practitioner?: {
    name: string;
    email?: string;
  };
  /** Client profiles managed by this practitioner */
  clients?: TunerClientProfile[];
  /** If this key belongs to a client (not a practitioner), their own profile */
  ownProfile?: TunerClientProfile;
}

// ─── Root key structure ───────────────────────────────────────────────────────

export interface CommonUnityKey {
  /** Schema version — used for migrations */
  _schemaVersion: string;
  /** Export metadata */
  _exportedAt: string;        // ISO 8601
  _exportedBy: "compass" | "tuner" | "studio";
  /** Marker for validation */
  _commonUnityKey: true;

  /** Human-readable display name for this key */
  name?: string;

  /**
   * Gene Keys profile — calculated once, owned by the person.
   * Shared read-only across all apps.
   * A practitioner's key will NOT have this unless they've run their own profile.
   * A client's key WILL have this as the primary data.
   */
  geneKeys?: GeneKeysProfile;

  /** Per-app data sections */
  compass?: CompassKey;
  studio?: StudioKey;
  tuner?: TunerKey;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a minimal valid key skeleton */
export function createKey(exportedBy: CommonUnityKey["_exportedBy"], name?: string): CommonUnityKey {
  return {
    _schemaVersion: KEY_SCHEMA_VERSION,
    _exportedAt: new Date().toISOString(),
    _exportedBy: exportedBy,
    _commonUnityKey: true,
    name,
  };
}

/** Type guard — is this object a valid CommonUnity key? */
export function isCommonUnityKey(obj: unknown): obj is CommonUnityKey {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as CommonUnityKey)._commonUnityKey === true &&
    typeof (obj as CommonUnityKey)._schemaVersion === "string"
  );
}

/**
 * Merge a partial key update into an existing key.
 * Only the provided sections are updated; others are preserved.
 * This is the safe write pattern — apps never overwrite each other's sections.
 */
export function mergeKey(existing: CommonUnityKey, update: Partial<CommonUnityKey>): CommonUnityKey {
  return {
    ...existing,
    ...update,
    // Preserve all app sections unless explicitly overridden
    compass: update.compass ? { ...existing.compass, ...update.compass } : existing.compass,
    studio:  update.studio  ? { ...existing.studio,  ...update.studio  } : existing.studio,
    tuner:   update.tuner   ? { ...existing.tuner,   ...update.tuner   } : existing.tuner,
    geneKeys: update.geneKeys ?? existing.geneKeys,
    _exportedAt: new Date().toISOString(),
    _exportedBy: update._exportedBy ?? existing._exportedBy,
  };
}
