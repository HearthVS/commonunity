/* threshold/contract.js
 *
 * OM Cipher universal connection contract — the stable handoff surface
 * that every CommonUnity app (cOMpass, Studio, Tuner, Field) can read.
 *
 * This file is intentionally small and stable. Apps depend on the shape
 * declared here. The threshold module writes; other apps read.
 *
 * If new semantic blocks are added later, add them additively. Never
 * rename or repurpose an existing block — that breaks downstream readers.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OmCipherContract = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const CONTRACT_STORAGE_KEY = 'commonunity_om_cipher_v1';
  const CONTRACT_VERSION = 1;

  // Palette schema version. Bumped whenever palette generation changes
  // in a way that older stored palettes should be recomputed. v2 marks
  // palettes produced by the current deterministic generator. Anything
  // without this field, or with a lower number, is treated as legacy
  // and recomputed on read.
  const PALETTE_SCHEMA_VERSION = 2;
  const PALETTE_SOURCE_CURRENT = 'om_cipher_palette_v2';

  function emptyContract() {
    return {
      contract_version: CONTRACT_VERSION,
      identity: {
        full_name: '',
        birth_date: '',
        birth_time: '',
        birth_place: ''
      },
      name_narrative: {
        essay: '',
        generated_at: '',
        version: 1,
        source: 'onboarding_threshold'
      },
      om_cipher: {
        palette: {
          primary: '',
          secondary: '',
          seasonal_accent: '',
          version: 1,
          schema_version: PALETTE_SCHEMA_VERSION,
          source: PALETTE_SOURCE_CURRENT
        }
      },
      threshold: {
        completed: false,
        completed_at: '',
        version: 1,
        source: 'onboarding_threshold_v2'
      }
    };
  }

  // ---- Deterministic palette generator ------------------------------------
  //
  // Single source of truth, shared by the threshold writer (via the
  // window-exported helper below) and by the migration path. Mirrors
  // the formulas in threshold.js#provisionalPaletteFromIdentity so a
  // recompute of a legacy contract lands on the same colours the user
  // would see if they regenerated today.

  function computePaletteFromIdentity(identity) {
    identity = identity || {};
    function hash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    }
    const seed = (identity.full_name || '') + '|' + (identity.birth_date || '');
    const hueBase = hash(seed) % 360;
    const primary = `oklch(0.62 0.16 ${hueBase})`;
    const secondaryHue = (hueBase + 180) % 360;
    const secondary = `oklch(0.72 0.07 ${secondaryHue})`;
    let seasonalHue = (hueBase + 60) % 360;
    if (identity.birth_date) {
      const m = parseInt(String(identity.birth_date).slice(5, 7), 10);
      if (!Number.isNaN(m)) {
        const seasonal = [250, 250, 120, 120, 120, 50, 50, 50, 25, 25, 25, 250];
        seasonalHue = seasonal[Math.min(Math.max(m - 1, 0), 11)];
      }
    }
    const seasonal_accent = `oklch(0.74 0.13 ${seasonalHue})`;
    return {
      primary,
      secondary,
      seasonal_accent,
      version: 1,
      schema_version: PALETTE_SCHEMA_VERSION,
      source: PALETTE_SOURCE_CURRENT
    };
  }

  // ---- Legacy palette detection -------------------------------------------
  //
  // A palette is "legacy" if any of these hold:
  //   • the om_cipher / palette block is missing
  //   • any of primary / secondary / seasonal_accent is missing or empty
  //   • the palette has no schema_version, or a schema_version older
  //     than PALETTE_SCHEMA_VERSION
  //   • the source field is missing or names a known legacy source
  //
  // Conservative on purpose: when in doubt, recompute. The recompute is
  // deterministic from identity, so it is safe to run repeatedly.

  const LEGACY_PALETTE_SOURCES = new Set([
    '',
    'om_cipher_v1',
    'threshold_provisional_mvp_v1',
    'manual',
    'legacy'
  ]);

  function isLegacyPalette(contract) {
    if (!contract || typeof contract !== 'object') return false;
    const palette = contract.om_cipher && contract.om_cipher.palette;
    if (!palette || typeof palette !== 'object') return true;
    if (!palette.primary || !palette.secondary || !palette.seasonal_accent) {
      return true;
    }
    const schema = Number(palette.schema_version);
    if (!Number.isFinite(schema) || schema < PALETTE_SCHEMA_VERSION) {
      return true;
    }
    if (typeof palette.source !== 'string' || LEGACY_PALETTE_SOURCES.has(palette.source)) {
      return true;
    }
    return false;
  }

  // ---- Contract migration -------------------------------------------------
  //
  // Returns { contract, migrated }. When `migrated` is true, the caller
  // should persist the new contract so future reads skip this work.
  //
  // Preserves identity, name_narrative, threshold, and any other top-level
  // blocks. Only the palette is recomputed. If the contract has no
  // identity to compute from, we still stamp the schema_version so we
  // don't loop, but we leave the existing palette in place — the
  // threshold flow will regenerate as soon as identity is collected.

  function migrateContract(contract) {
    if (!contract || typeof contract !== 'object') {
      return { contract, migrated: false };
    }
    if (!isLegacyPalette(contract)) {
      return { contract, migrated: false };
    }

    const identity = contract.identity || {};
    const hasIdentity = !!(identity.full_name || identity.birth_date);

    const next = Object.assign({}, contract);
    next.om_cipher = Object.assign({}, contract.om_cipher || {});

    if (hasIdentity) {
      const fresh = computePaletteFromIdentity(identity);
      next.om_cipher.palette = Object.assign(
        {},
        contract.om_cipher && contract.om_cipher.palette ? contract.om_cipher.palette : {},
        fresh,
        { generated_by: 'legacy_migration', migrated_at: new Date().toISOString() }
      );
    } else {
      // No identity to recompute from. Don't overwrite colours, just
      // stamp the schema so future reads stop trying. Threshold writer
      // will replace the whole block once identity is captured.
      const palette = Object.assign({}, (contract.om_cipher && contract.om_cipher.palette) || {});
      palette.schema_version = PALETTE_SCHEMA_VERSION;
      palette.source = palette.source || PALETTE_SOURCE_CURRENT;
      palette.generated_by = 'legacy_migration_no_identity';
      next.om_cipher.palette = palette;
    }

    return { contract: next, migrated: true };
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(CONTRACT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const result = migrateContract(parsed);
      if (result.migrated) {
        try {
          window.localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(result.contract));
        } catch (_) { /* persistence is best-effort */ }
      }
      return result.contract;
    } catch (_) {
      return null;
    }
  }

  function write(contract) {
    try {
      window.localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(contract));
      return true;
    } catch (_) {
      return false;
    }
  }

  function isThresholdCompleted() {
    const c = read();
    return !!(c && c.threshold && c.threshold.completed);
  }

  return {
    CONTRACT_STORAGE_KEY,
    CONTRACT_VERSION,
    PALETTE_SCHEMA_VERSION,
    PALETTE_SOURCE_CURRENT,
    emptyContract,
    read,
    write,
    isThresholdCompleted,
    computePaletteFromIdentity,
    isLegacyPalette,
    migrateContract
  };
});
