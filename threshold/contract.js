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
        // cipher_identity is added lazily by ensureCipherIdentity (below) once
        // a contract exists — it is not part of the empty shape so that older
        // contracts and the empty contract converge on the same backfill path.
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

  // ---- Pseudonymous OM Cipher identity ------------------------------------
  //
  // The OM Cipher operational identity is deliberately separate from the
  // real-world contact identity (identity.full_name / birth_date). It is what
  // CommonUnity apps and AI companions (Nexus/Claude) reference instead of a
  // legal or familiar name. The STABLE identity is three fields:
  //
  //   cipher_id   — random, stable, non-identifying technical key. Generated
  //                 once and persisted; NEVER derived from email/legal name.
  //   unity_code  — functional pattern code from the primary gate/line
  //                 (e.g. "UC-22.5"). Derived from OM Cipher structure, never
  //                 from contact identity. Empty until a gate is known.
  //   unity_point — human-readable operating label ("Unity Point 22.5").
  //
  // The VISUAL Cipher is intentionally decoupled from the stable identity. The
  // currently generated Cipher is only the first, beta expression — not the
  // final identity. So the contract carries a versioned visual Cipher block
  // (cipher_visual.versions[]) and the stable identity points at the active one
  // via active_cipher_version_id. A user can later gain a Full / Living Cipher
  // version without losing any cOMpass / Nexus / Golden Thread data, because all
  // of that attaches to the stable identity (cipher_id / unity_point), never to
  // a specific visual version.
  //
  // Each visual version records how it was produced (stage/method/status) and
  // may carry an internal seed/hash reference linking it to the generator
  // output. Product/user-facing language calls this the "Cipher"; the legacy
  // generator term ("sigil") survives only as an internal implementation
  // reference inside a version's `seed_ref`.

  const CIPHER_IDENTITY_SOURCE = 'om_cipher_identity_v1';
  const CIPHER_IDENTITY_VERSION = 'v1';

  // Stable, non-cryptographic hex hash (FNV-1a-ish). Used to derive stable IDs
  // (version id, internal seed ref) deterministically and offline.
  function _hashHex(str, len) {
    str = String(str == null ? '' : str);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    // Expand to the requested length by re-hashing with a salt counter.
    let out = (h >>> 0).toString(16).padStart(8, '0');
    let salt = 1;
    while (out.length < len) {
      let g = (h ^ (salt * 0x9e3779b9)) >>> 0;
      for (let i = 0; i < str.length; i++) {
        g ^= str.charCodeAt(i);
        g = (g + ((g << 1) + (g << 4) + (g << 7) + (g << 8) + (g << 24))) >>> 0;
      }
      out += (g >>> 0).toString(16).padStart(8, '0');
      salt++;
    }
    return out.slice(0, len);
  }

  // Random hex of n chars. Prefers crypto.getRandomValues; falls back to
  // Math.random so the helper stays usable in Node test contexts.
  function cipherIdHex(n) {
    n = n || 24;
    const bytes = Math.ceil(n / 2);
    let hex = '';
    try {
      const g = (typeof window !== 'undefined' && window.crypto) ||
                (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
      if (g && g.getRandomValues) {
        const arr = new Uint8Array(bytes);
        g.getRandomValues(arr);
        for (let i = 0; i < arr.length; i++) hex += arr[i].toString(16).padStart(2, '0');
        return hex.slice(0, n);
      }
    } catch (_) { /* fall through */ }
    while (hex.length < n) hex += Math.floor(Math.random() * 16).toString(16);
    return hex.slice(0, n);
  }

  // The current visual Cipher is produced by the legacy generator (sdk/om_cipher.js).
  // We treat it as the first, BETA expression of the identity — versioned, never
  // final. Naming the method accurately keeps room for a future Full / Living
  // Cipher method without renaming or breaking this one.
  const CIPHER_VISUAL_SCHEMA_VERSION = 1;
  const BETA_CIPHER_METHOD = 'legacy_generator';

  // Pure: derive the active visual Cipher version (the first, beta expression).
  // The version id is stable for a given identity seed, so re-derives converge.
  // `seed_ref` is an INTERNAL implementation pointer to the generator output
  // (the legacy "sigil" seed) — it is not the stable identity and not used by
  // Nexus / Golden Thread.
  function deriveCipherVisualVersion(contract, existingVersion) {
    const identity = (contract && contract.identity) || {};
    const seed = (identity.full_name || '') + '|' + (identity.birth_date || '');
    const prev = existingVersion || {};
    const version_id = prev.version_id || ('cv_' + _hashHex(seed || 'cipher', 16));
    return {
      version_id: version_id,
      stage: prev.stage || 'beta',
      method: prev.method || BETA_CIPHER_METHOD,
      status: prev.status || 'active',
      // Internal generator linkage. Legacy term retained here on purpose so the
      // beta version can be matched to the existing generator output; product
      // copy never surfaces this field.
      seed_ref: prev.seed_ref || ('sigil_' + _hashHex(seed || version_id, 16)),
      schema_version: CIPHER_VISUAL_SCHEMA_VERSION,
      created_via: prev.created_via || CIPHER_IDENTITY_SOURCE
    };
  }

  // Pure: derive a cipher_identity object from a contract + optional gate/line.
  // Preserves an existing cipher_id (stability is the whole point). Recomputes
  // unity_code / unity_point whenever a gate is supplied; leaves them blank
  // otherwise. active_cipher_version_id points at the active visual version.
  function deriveCipherIdentity(contract, opts) {
    opts = opts || {};
    const existing = (contract && contract.om_cipher && contract.om_cipher.cipher_identity) || {};

    const cipher_id = existing.cipher_id || ('cipher_' + cipherIdHex(24));

    const activeVersion = deriveCipherVisualVersion(contract, _activeCipherVersion(contract));
    // Migrate the legacy sigil_id (if any) into the active version pointer so
    // existing contracts keep a stable handle without exposing sigil as core.
    const active_cipher_version_id =
      existing.active_cipher_version_id || existing.sigil_id || activeVersion.version_id;

    let gate = opts.gate;
    let line = opts.line;
    // Allow re-deriving from a previously stored gate/line if none supplied.
    if ((gate == null || gate === '') && existing.unity_code) {
      const m = /^UC-(\d+)\.(\d+)$/.exec(existing.unity_code);
      if (m) { gate = m[1]; line = m[2]; }
    }
    const gNum = parseInt(gate, 10);
    const lNum = parseInt(line, 10);
    const hasGate = Number.isFinite(gNum) && gNum > 0;

    let unity_code = '';
    let unity_point = '';
    if (hasGate) {
      const lineStr = Number.isFinite(lNum) && lNum > 0 ? ('.' + lNum) : '';
      unity_code = 'UC-' + gNum + lineStr;
      unity_point = 'Unity Point ' + gNum + lineStr;
    } else if (existing.unity_code) {
      unity_code = existing.unity_code;
      unity_point = existing.unity_point || '';
    }

    return {
      cipher_id: cipher_id,
      unity_code: unity_code,
      unity_point: unity_point,
      active_cipher_version_id: active_cipher_version_id,
      version: CIPHER_IDENTITY_VERSION,
      source: CIPHER_IDENTITY_SOURCE
    };
  }

  // Read the current active visual version from a contract, if any.
  function _activeCipherVersion(contract) {
    const visual = contract && contract.om_cipher && contract.om_cipher.cipher_visual;
    const versions = (visual && Array.isArray(visual.versions)) ? visual.versions : [];
    if (!versions.length) return null;
    const id = contract.om_cipher.cipher_identity &&
      contract.om_cipher.cipher_identity.active_cipher_version_id;
    if (id) {
      const match = versions.filter(function (v) { return v && v.version_id === id; })[0];
      if (match) return match;
    }
    return versions.filter(function (v) { return v && v.status === 'active'; })[0] || versions[0];
  }

  // Backfill / upgrade the cipher identity AND the versioned visual Cipher on a
  // contract. Returns { contract, changed }. Never overwrites the real-world
  // identity block. `changed` is true when anything was created or changed
  // (e.g. a gate became available), so callers can persist conditionally.
  function ensureCipherIdentity(contract, opts) {
    if (!contract || typeof contract !== 'object') {
      return { contract: contract, changed: false };
    }
    const prevIdentity = (contract.om_cipher && contract.om_cipher.cipher_identity) || null;
    const prevVisual = (contract.om_cipher && contract.om_cipher.cipher_visual) || null;

    const nextVersion = deriveCipherVisualVersion(contract, _activeCipherVersion(contract));
    const nextIdentity = deriveCipherIdentity(contract, opts);

    const prevActive = _activeCipherVersion(contract);
    const visualChanged = !prevVisual ||
      !Array.isArray(prevVisual.versions) ||
      !prevActive ||
      prevActive.version_id !== nextVersion.version_id ||
      prevActive.stage !== nextVersion.stage ||
      prevActive.method !== nextVersion.method ||
      prevActive.status !== nextVersion.status ||
      prevActive.seed_ref !== nextVersion.seed_ref ||
      prevActive.schema_version !== nextVersion.schema_version;

    const identityChanged = !prevIdentity ||
      prevIdentity.cipher_id !== nextIdentity.cipher_id ||
      prevIdentity.unity_code !== nextIdentity.unity_code ||
      prevIdentity.unity_point !== nextIdentity.unity_point ||
      prevIdentity.active_cipher_version_id !== nextIdentity.active_cipher_version_id ||
      prevIdentity.version !== nextIdentity.version ||
      prevIdentity.source !== nextIdentity.source;

    if (!identityChanged && !visualChanged) {
      return { contract: contract, changed: false };
    }

    const out = Object.assign({}, contract);
    out.om_cipher = Object.assign({}, contract.om_cipher || {});
    out.om_cipher.cipher_identity = nextIdentity;

    // Rebuild the versions array: replace the active version in place, keep any
    // other (e.g. future Full / Living) versions untouched.
    const existingVersions = (prevVisual && Array.isArray(prevVisual.versions))
      ? prevVisual.versions.slice() : [];
    const idx = existingVersions.findIndex(function (v) {
      return v && v.version_id === nextVersion.version_id;
    });
    if (idx >= 0) existingVersions[idx] = nextVersion;
    else existingVersions.push(nextVersion);

    out.om_cipher.cipher_visual = Object.assign({}, prevVisual || {}, {
      versions: existingVersions,
      schema_version: CIPHER_VISUAL_SCHEMA_VERSION
    });

    return { contract: out, changed: true };
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
  //
  // Legacy aliases. Old writers stored the accent under several names
  // (`accent`, `accent_color`, `tertiary`) — and the current cOMpass
  // self-heal read path falls back through that chain. If we only
  // overwrite `seasonal_accent`, the stale alias values stay in JSON
  // and survive into export / re-import. After recomputing, mirror the
  // new `seasonal_accent` into `accent` (kept for back-compat with the
  // existing fallback chain) and drop `accent_color` / `tertiary`,
  // which only existed as legacy palette aliases.

  function normalizeLegacyAliases(palette) {
    if (!palette || typeof palette !== 'object') return palette;
    if (palette.seasonal_accent) {
      palette.accent = palette.seasonal_accent;
    }
    delete palette.accent_color;
    delete palette.tertiary;
    return palette;
  }

  function migrateContract(contract) {
    if (!contract || typeof contract !== 'object') {
      return { contract, migrated: false };
    }

    // Backfill the pseudonymous cipher_identity for existing contracts. No
    // gate is available here, so cipher_id + sigil_id are created and
    // unity_code/unity_point are filled in later by cOMpass once the primary
    // gate is known. This runs independently of the palette migration so a
    // contract with a current palette still gets its identity backfilled.
    if (!isLegacyPalette(contract)) {
      const ensured = ensureCipherIdentity(contract);
      return { contract: ensured.contract, migrated: ensured.changed };
    }
    // Legacy palette path also backfills the cipher identity; this branch
    // always persists (migrated: true) so the backfill rides along.
    contract = ensureCipherIdentity(contract).contract;

    const identity = contract.identity || {};
    const hasIdentity = !!(identity.full_name || identity.birth_date);

    const next = Object.assign({}, contract);
    next.om_cipher = Object.assign({}, contract.om_cipher || {});

    if (hasIdentity) {
      const fresh = computePaletteFromIdentity(identity);
      const merged = Object.assign(
        {},
        contract.om_cipher && contract.om_cipher.palette ? contract.om_cipher.palette : {},
        fresh,
        { generated_by: 'legacy_migration', migrated_at: new Date().toISOString() }
      );
      next.om_cipher.palette = normalizeLegacyAliases(merged);
    } else {
      // No identity to recompute from. Don't overwrite colours, just
      // stamp the schema so future reads stop trying. Threshold writer
      // will replace the whole block once identity is captured.
      const palette = Object.assign({}, (contract.om_cipher && contract.om_cipher.palette) || {});
      palette.schema_version = PALETTE_SCHEMA_VERSION;
      palette.source = palette.source || PALETTE_SOURCE_CURRENT;
      palette.generated_by = 'legacy_migration_no_identity';
      next.om_cipher.palette = normalizeLegacyAliases(palette);
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
    migrateContract,
    cipherIdHex,
    deriveCipherIdentity,
    deriveCipherVisualVersion,
    ensureCipherIdentity
  };
});
