// Cell Salts assignment — sign → salt + deterministic fallback.
//   Run: node tests/cell-salts-assignment.test.js
//
// Acceptance checks:
//   - Each of the 12 tropical signs maps to its canonical Schüssler salt.
//   - Sign matching is case- and whitespace-insensitive.
//   - Sun → primary, Moon → secondary, Rising/Ascendant → secondary.
//   - Duplicate signs (sun==moon etc.) don't yield duplicate salt picks.
//   - When no sign info is present, deriveFallbackSalts emits 3 distinct
//     deterministic picks from the same seed (same seed → same salts).
//   - assignSaltsFromBirth always emits at least one salt (primary) when
//     given any usable sign OR a seed, and emits null only when both
//     are absent.

'use strict';
const assert = require('node:assert/strict');
const {
  CELL_SALTS,
  ZODIAC_SALT_MAP,
  getSaltForSign,
  deriveFallbackSalts,
  assignSaltsFromBirth,
} = require('../sdk/cell_salts.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.message); failed++; }
}

console.log('cell salts: zodiac → salt mapping');

test('all 12 signs map to canonical Schüssler salts', () => {
  const expected = {
    Aries: 'kali_phos', Taurus: 'nat_sulph', Gemini: 'kali_mur',
    Cancer: 'calc_fluor', Leo: 'mag_phos', Virgo: 'kali_sulph',
    Libra: 'nat_phos', Scorpio: 'calc_sulph', Sagittarius: 'silicea',
    Capricorn: 'calc_phos', Aquarius: 'nat_mur', Pisces: 'ferr_phos',
  };
  for (const [sign, salt] of Object.entries(expected)) {
    assert.equal(getSaltForSign(sign), salt, sign + ' → ' + salt);
  }
});

test('sign matching is case + whitespace insensitive', () => {
  assert.equal(getSaltForSign('aries'),   'kali_phos');
  assert.equal(getSaltForSign('ARIES'),   'kali_phos');
  assert.equal(getSaltForSign(' Aries '), 'kali_phos');
  assert.equal(getSaltForSign('AqUaRiUs'),'nat_mur');
});

test('unknown / blank signs return null', () => {
  assert.equal(getSaltForSign(null),       null);
  assert.equal(getSaltForSign(''),         null);
  assert.equal(getSaltForSign('Ophiuchus'),null);
});

test('ZODIAC_SALT_MAP covers all 12 keys and every salt is in CELL_SALTS', () => {
  const keys = Object.keys(ZODIAC_SALT_MAP);
  assert.equal(keys.length, 12);
  const ids = new Set(CELL_SALTS.map(s => s.id));
  for (const k of keys) {
    assert.ok(ids.has(ZODIAC_SALT_MAP[k]), 'salt id present for ' + k);
  }
});

console.log('cell salts: deterministic seed fallback');

test('same seed → same fallback salts; 3 distinct picks', () => {
  const a = deriveFallbackSalts('Sample|1985-06-21|14:32|Lisbon, PT');
  const b = deriveFallbackSalts('Sample|1985-06-21|14:32|Lisbon, PT');
  assert.deepEqual(a, b, 'identical seed produces identical SaltConfig[]');
  assert.equal(a.length, 3);
  const ids = a.map(s => s.saltId);
  assert.equal(new Set(ids).size, 3, '3 distinct salt ids');
  assert.equal(a[0].weight, 1.0);
  assert.equal(a[1].weight, 0.6);
  assert.equal(a[2].weight, 0.4);
});

test('different seeds yield different primary (at least sometimes)', () => {
  const samples = ['seed:A','seed:B','seed:C','seed:D','seed:E','seed:F'];
  const primaries = new Set(samples.map(s => deriveFallbackSalts(s)[0].saltId));
  assert.ok(primaries.size >= 2, 'hash spreads primary across multiple salts');
});

test('blank / nullish seed → null', () => {
  assert.equal(deriveFallbackSalts(''),       null);
  assert.equal(deriveFallbackSalts(null),     null);
  assert.equal(deriveFallbackSalts(undefined),null);
});

console.log('cell salts: assignSaltsFromBirth');

test('full tropical chart → primary=sun, secondaries=moon & rising', () => {
  const out = assignSaltsFromBirth({ sun: 'Gemini', moon: 'Cancer', rising: 'Leo' });
  assert.deepEqual(out, [
    { saltId: 'kali_mur',   weight: 1.0, kind: 'primary'   }, // Gemini
    { saltId: 'calc_fluor', weight: 0.6, kind: 'secondary' }, // Cancer
    { saltId: 'mag_phos',   weight: 0.4, kind: 'secondary' }, // Leo
  ]);
});

test('vedic.ascendant is used as rising fallback', () => {
  const out = assignSaltsFromBirth({
    sun: 'Pisces', moon: 'Libra',
    vedic: { sun: 'Aquarius', moon: 'Virgo', ascendant: 'Capricorn' }
  });
  assert.equal(out[0].saltId, 'ferr_phos', 'tropical sun wins over vedic');
  assert.equal(out[1].saltId, 'nat_phos',  'moon = Libra → nat_phos');
  assert.equal(out[2].saltId, 'calc_phos', 'rising falls back to vedic ascendant');
});

test('vedic-only chart still assigns salts', () => {
  const out = assignSaltsFromBirth({
    vedic: { sun: 'Taurus', moon: 'Scorpio', ascendant: 'Pisces' }
  });
  assert.equal(out[0].saltId, 'nat_sulph');
  assert.equal(out[1].saltId, 'calc_sulph');
  assert.equal(out[2].saltId, 'ferr_phos');
});

test('duplicate signs do not produce duplicate salts; seed backfills gap', () => {
  const out = assignSaltsFromBirth({
    sun: 'Aries', moon: 'Aries', rising: 'Aries',
    seed: 'fresh-flow|1992-04-11|07:00|Porto'
  });
  const ids = out.map(s => s.saltId);
  assert.equal(out[0].saltId, 'kali_phos', 'primary = Aries → kali_phos');
  assert.equal(new Set(ids).size, ids.length, 'no duplicate salts in picks');
  assert.ok(out.length >= 1 && out.length <= 3);
});

test('no signs but seed → deterministic fallback (1 primary + 2 secondaries)', () => {
  const out = assignSaltsFromBirth({ seed: 'no-chart|1990-01-01' });
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map(s => s.saltId)).size, 3);
  // Re-run yields same shape.
  const again = assignSaltsFromBirth({ seed: 'no-chart|1990-01-01' });
  assert.deepEqual(out, again);
});

test('no signs and no seed → null', () => {
  assert.equal(assignSaltsFromBirth({}), null);
  assert.equal(assignSaltsFromBirth(null), null);
});

test('only-sun input still emits primary, then seed-backfilled secondaries', () => {
  const out = assignSaltsFromBirth({ sun: 'Virgo', seed: 'sun-only|1985-09-10' });
  assert.equal(out[0].saltId, 'kali_sulph');
  assert.ok(out.length >= 1);
  // Secondaries should not collide with the primary.
  for (let i = 1; i < out.length; i++) {
    assert.notEqual(out[i].saltId, 'kali_sulph');
  }
});

test('deterministic: same input → same SaltConfig[]', () => {
  const inp = { sun: 'Leo', moon: 'Cancer', rising: 'Sagittarius', seed: 's' };
  const a = assignSaltsFromBirth(inp);
  const b = assignSaltsFromBirth(inp);
  assert.deepEqual(a, b);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
