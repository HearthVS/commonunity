// Smoke test for the OM Cipher legacy palette migration.
//
// Confirms that contracts from older versions — those carrying the
// previous palette source/version or missing fields entirely — are
// upgraded on read: the legacy colours are replaced by the current
// deterministic generator's output, identity / name narrative /
// threshold blocks are preserved, and the persisted contract carries
// the new schema metadata so cOMpass renders the upgraded palette.
//
// Run: node tests/om-cipher-legacy-palette-migration.test.js

const assert = require('node:assert/strict');

const Contract = require('../threshold/contract.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

// Minimal in-memory localStorage so contract.read()/write() can run
// under node. contract.js calls window.localStorage; we shim window
// onto globalThis before requiring it would matter, but since the UMD
// factory captures `window` via the wrapper, we install it lazily on
// the per-test object that exercises read/write.
function makeStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    _dump() { return Object.fromEntries(map); }
  };
}

// Re-require contract.js inside a sandbox so it binds to our shimmed
// window. The UMD wrapper exports via module.exports when present, so
// we need a fresh require that *doesn't* hit the module cache version
// already bound to commonjs. Easiest: clear the cache.
function loadContractWithWindow(storage) {
  const path = require.resolve('../threshold/contract.js');
  delete require.cache[path];
  global.window = { localStorage: storage };
  const C = require('../threshold/contract.js');
  return C;
}

// ---- Fixtures -----------------------------------------------------------
//
// Three representative legacy contracts. Each shape reflects a real
// older write path:
//   • Markus  — full v1 contract with the previous `om_cipher_v1` source
//   • Eda     — completed contract whose palette block is missing
//                fields entirely (older import path)
//   • Vesna   — provisional-MVP source string from a pre-handoff draft

const fixtures = {
  markus: {
    contract_version: 1,
    identity: {
      full_name: 'Markus Lehto',
      birth_date: '1979-03-14',
      birth_time: '08:42',
      birth_place: 'Helsinki, Finland'
    },
    name_narrative: {
      essay: 'Markus, the sound of your name...',
      generated_at: '2025-11-02T10:11:12.000Z',
      version: 1,
      source: 'onboarding_threshold'
    },
    om_cipher: {
      palette: {
        primary: 'oklch(0.55 0.20 30)',       // legacy red-ish
        secondary: 'oklch(0.60 0.10 210)',
        seasonal_accent: 'oklch(0.70 0.12 90)',
        // Stale legacy accent alias from the previous writer. After
        // migration this must not retain its old hex — it must mirror
        // the freshly computed seasonal_accent (or be dropped).
        accent: '#abcdef',
        version: 1,
        source: 'om_cipher_v1'                // legacy source tag
      }
    },
    threshold: {
      completed: true,
      completed_at: '2025-11-02T10:14:00.000Z',
      version: 1,
      source: 'onboarding_threshold_v2'
    }
  },

  eda: {
    contract_version: 1,
    identity: {
      full_name: 'Eda Sahin',
      birth_date: '1992-07-22',
      birth_time: '',
      birth_place: 'Istanbul, Türkiye'
    },
    name_narrative: {
      essay: 'Eda, your name has carried...',
      generated_at: '2025-09-18T08:00:00.000Z',
      version: 1,
      source: 'onboarding_threshold'
    },
    om_cipher: {
      // Missing required fields entirely — must be detected as legacy.
      palette: {
        primary: 'oklch(0.50 0.15 0)',
        // secondary missing
        // seasonal_accent missing
        // Stale legacy alias variants that older importers wrote.
        accent_color: '#deadbe',
        tertiary: 'oklch(0.40 0.10 0)',
        version: 1
      }
    },
    threshold: {
      completed: true,
      completed_at: '2025-09-18T08:02:00.000Z',
      version: 1,
      source: 'onboarding_threshold_v2'
    }
  },

  vesna: {
    contract_version: 1,
    identity: {
      full_name: 'Vesna Novak',
      birth_date: '1985-12-03',
      birth_time: '21:10',
      birth_place: 'Ljubljana, Slovenia'
    },
    name_narrative: {
      essay: 'Vesna, the name you carry...',
      generated_at: '2025-12-10T19:00:00.000Z',
      version: 1,
      source: 'onboarding_threshold'
    },
    om_cipher: {
      palette: {
        primary: 'oklch(0.62 0.16 199)',
        secondary: 'oklch(0.72 0.07 19)',
        seasonal_accent: 'oklch(0.74 0.13 250)',
        // Stale alias and tertiary from provisional-MVP write path.
        accent: '#012345',
        tertiary: '#fedcba',
        version: 1,
        source: 'threshold_provisional_mvp_v1' // legacy provisional source
      }
    },
    threshold: {
      completed: true,
      completed_at: '2025-12-10T19:01:30.000Z',
      version: 1,
      source: 'onboarding_threshold_v2'
    }
  }
};

console.log('om_cipher legacy palette migration');

// ---- Deterministic generator -------------------------------------------

test('computePaletteFromIdentity is deterministic per (name,date)', () => {
  const a = Contract.computePaletteFromIdentity({ full_name: 'Markus Lehto', birth_date: '1979-03-14' });
  const b = Contract.computePaletteFromIdentity({ full_name: 'Markus Lehto', birth_date: '1979-03-14' });
  assert.deepEqual(a, b);
  assert.equal(a.schema_version, Contract.PALETTE_SCHEMA_VERSION);
  assert.equal(a.source, Contract.PALETTE_SOURCE_CURRENT);
});

test('different identities yield different primary hues', () => {
  const m = Contract.computePaletteFromIdentity({ full_name: 'Markus Lehto', birth_date: '1979-03-14' });
  const e = Contract.computePaletteFromIdentity({ full_name: 'Eda Sahin',   birth_date: '1992-07-22' });
  const v = Contract.computePaletteFromIdentity({ full_name: 'Vesna Novak', birth_date: '1985-12-03' });
  assert.notEqual(m.primary, e.primary);
  assert.notEqual(e.primary, v.primary);
  assert.notEqual(m.primary, v.primary);
});

// ---- Legacy detection ---------------------------------------------------

test('isLegacyPalette flags legacy source tag', () => {
  assert.equal(Contract.isLegacyPalette(fixtures.markus), true);
});

test('isLegacyPalette flags missing fields', () => {
  assert.equal(Contract.isLegacyPalette(fixtures.eda), true);
});

test('isLegacyPalette flags provisional source', () => {
  assert.equal(Contract.isLegacyPalette(fixtures.vesna), true);
});

test('isLegacyPalette returns false for current palette', () => {
  const fresh = JSON.parse(JSON.stringify(fixtures.markus));
  const p = Contract.computePaletteFromIdentity(fresh.identity);
  fresh.om_cipher.palette = Object.assign(p, { schema_version: Contract.PALETTE_SCHEMA_VERSION, source: Contract.PALETTE_SOURCE_CURRENT });
  assert.equal(Contract.isLegacyPalette(fresh), false);
});

// ---- Migration round-trip per fixture -----------------------------------

function runMigration(name, fixture) {
  const before = JSON.parse(JSON.stringify(fixture));
  const { contract: after, migrated } = Contract.migrateContract(before);

  test(`${name}: migration is signaled`, () => {
    assert.equal(migrated, true);
  });

  test(`${name}: identity preserved verbatim`, () => {
    assert.deepEqual(after.identity, fixture.identity);
  });

  test(`${name}: name_narrative preserved verbatim`, () => {
    assert.deepEqual(after.name_narrative, fixture.name_narrative);
  });

  test(`${name}: threshold completion preserved`, () => {
    assert.equal(after.threshold.completed, true);
    assert.equal(after.threshold.completed_at, fixture.threshold.completed_at);
  });

  test(`${name}: palette schema stamped current`, () => {
    assert.equal(after.om_cipher.palette.schema_version, Contract.PALETTE_SCHEMA_VERSION);
    assert.equal(after.om_cipher.palette.source, Contract.PALETTE_SOURCE_CURRENT);
    assert.equal(after.om_cipher.palette.generated_by, 'legacy_migration');
  });

  test(`${name}: legacy primary colour is overridden`, () => {
    const oldPrimary = fixture.om_cipher.palette.primary || '';
    const newPrimary = after.om_cipher.palette.primary;
    assert.ok(newPrimary && newPrimary.length > 0, 'new primary must be set');
    if (oldPrimary) {
      // Old fixtures use intentionally different hues from what the
      // generator produces, so the override must be a real change.
      assert.notEqual(newPrimary, oldPrimary, 'primary must change vs legacy');
    }
  });

  test(`${name}: palette matches generator from identity`, () => {
    const expected = Contract.computePaletteFromIdentity(fixture.identity);
    assert.equal(after.om_cipher.palette.primary,         expected.primary);
    assert.equal(after.om_cipher.palette.secondary,       expected.secondary);
    assert.equal(after.om_cipher.palette.seasonal_accent, expected.seasonal_accent);
  });

  test(`${name}: accent resolves (non-empty seasonal_accent)`, () => {
    assert.ok(after.om_cipher.palette.seasonal_accent.length > 0);
  });

  test(`${name}: stale legacy accent alias does not survive`, () => {
    const oldAccent       = fixture.om_cipher.palette.accent || '';
    const oldAccentColor  = fixture.om_cipher.palette.accent_color || '';
    const oldTertiary     = fixture.om_cipher.palette.tertiary || '';
    const p = after.om_cipher.palette;
    // accent_color / tertiary were only ever legacy palette aliases —
    // they must be dropped so they don't carry stale colour values.
    assert.equal(p.accent_color, undefined, 'accent_color must be removed');
    assert.equal(p.tertiary,     undefined, 'tertiary must be removed');
    // accent is kept for back-compat with the cOMpass read fallback,
    // but it must mirror the freshly computed seasonal_accent — never
    // the legacy value.
    if (p.accent !== undefined) {
      assert.equal(p.accent, p.seasonal_accent,
        'accent must mirror current seasonal_accent, not stale legacy value');
      if (oldAccent) {
        assert.notEqual(p.accent, oldAccent,
          'accent must not retain the pre-migration legacy value');
      }
    }
    if (oldAccentColor) {
      assert.notEqual(p.accent, oldAccentColor);
    }
    if (oldTertiary) {
      assert.notEqual(p.accent, oldTertiary);
    }
  });

  test(`${name}: active CSS-friendly fields are populated`, () => {
    const p = after.om_cipher.palette;
    assert.ok(p.primary         && p.primary.length         > 0, 'primary populated');
    assert.ok(p.secondary       && p.secondary.length       > 0, 'secondary populated');
    assert.ok(p.seasonal_accent && p.seasonal_accent.length > 0, 'seasonal_accent populated');
  });

  test(`${name}: second pass is idempotent (no further migration)`, () => {
    const second = Contract.migrateContract(after);
    assert.equal(second.migrated, false);
  });
}

runMigration('markus', fixtures.markus);
runMigration('eda',    fixtures.eda);
runMigration('vesna',  fixtures.vesna);

// ---- read() persists the upgrade to localStorage ------------------------

test('read() upgrades stored legacy contract and persists it', () => {
  const storage = makeStorage();
  storage.setItem('commonunity_om_cipher_v1', JSON.stringify(fixtures.markus));
  const C = loadContractWithWindow(storage);
  const got = C.read();
  assert.equal(got.om_cipher.palette.schema_version, C.PALETTE_SCHEMA_VERSION);
  assert.equal(got.om_cipher.palette.source, C.PALETTE_SOURCE_CURRENT);
  const reread = JSON.parse(storage.getItem('commonunity_om_cipher_v1'));
  assert.equal(reread.om_cipher.palette.schema_version, C.PALETTE_SCHEMA_VERSION);
  assert.equal(reread.om_cipher.palette.source, C.PALETTE_SOURCE_CURRENT);
  // Identity preserved through round-trip.
  assert.equal(reread.identity.full_name, 'Markus Lehto');
  // Stale legacy accent alias from the fixture must not survive in
  // the persisted JSON — must mirror the new seasonal_accent.
  assert.notEqual(reread.om_cipher.palette.accent, '#abcdef');
  assert.equal(reread.om_cipher.palette.accent, reread.om_cipher.palette.seasonal_accent);
});

test('read() leaves a fully-current contract untouched', () => {
  const storage = makeStorage();
  const C = loadContractWithWindow(storage);
  const current = C.emptyContract();
  current.identity.full_name = 'Markus Lehto';
  current.identity.birth_date = '1979-03-14';
  const p = C.computePaletteFromIdentity(current.identity);
  current.om_cipher.palette = p;
  current.threshold.completed = true;
  // A fully-current contract also carries the cipher identity + versioned
  // visual Cipher now; pre-seed both via ensureCipherIdentity so read() has
  // nothing to backfill (palette OR cipher identity OR visual version).
  const seeded = C.ensureCipherIdentity(current).contract;
  storage.setItem('commonunity_om_cipher_v1', JSON.stringify(seeded));
  const beforeRaw = storage.getItem('commonunity_om_cipher_v1');
  const got = C.read();
  assert.equal(C.isLegacyPalette(got), false);
  // No spurious rewrite for already-current contracts.
  const afterRaw = storage.getItem('commonunity_om_cipher_v1');
  assert.equal(afterRaw, beforeRaw);
});

test('read() backfills the cipher identity once for a current-palette contract', () => {
  const storage = makeStorage();
  const C = loadContractWithWindow(storage);
  const current = C.emptyContract();
  current.identity.full_name = 'Ada Lovelace';
  current.identity.birth_date = '1815-12-10';
  current.om_cipher.palette = C.computePaletteFromIdentity(current.identity);
  current.threshold.completed = true;
  // No cipher_identity yet — an existing pre-layer-2 user.
  storage.setItem('commonunity_om_cipher_v1', JSON.stringify(current));
  const got = C.read();
  assert.ok(got.om_cipher.cipher_identity, 'cipher identity is backfilled on read');
  assert.ok(/^cipher_/.test(got.om_cipher.cipher_identity.cipher_id), 'cipher_id stamped');
  // Idempotent: a second read does not rewrite storage again.
  const afterFirst = storage.getItem('commonunity_om_cipher_v1');
  C.read();
  assert.equal(storage.getItem('commonunity_om_cipher_v1'), afterFirst);
});

// ---- Tear down ----------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
