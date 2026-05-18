// Markus QA baseline — frozen reference vector for the canonical Om Cipher
// engine. The expected values come from the v1 implementation plan; if the
// engine ever drifts, this test fails loudly with the actual vs expected
// values so the divergence is visible rather than silently shipped.
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-markus-baseline.test.js
const assert = require("node:assert/strict");

process.env.OM_CIPHER_ENABLED = "true";

const om = require("../sdk/om_cipher.js");

const MARKUS = {
  birth_date: "1973-11-18",
  birth_time: "03:21",
  birth_place: { lat: 46.4917, lng: -80.9930, city: "Sudbury", country: "Canada" },
  legal_name: "Markus Lehto",
  preferred_name: "Markus",
};

const EXPECTED = {
  life_path: 22,
  life_path_is_master: true,
  expression: 8,
  soul_urge: 6,
  // Personality displays the master 11 (gematria 29 → 11 → 2). The
  // canonical seed below still uses the single-digit 2 (`PE:2`) so the
  // sealed seed stays stable; the visible Source-Pattern card reads 11.
  personality: 11,
  personality_is_master: true,
  lunar_phase: 6,
  solar_quarter: 3,
  temporal_gate: 1,
  seed_string: "LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1",
  seed_sha256:  "58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784",
  sigil_points: 11,
  primary_hue: 72,
  secondary_hue: 252,
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓", name); passed++; }
  catch (e) { console.error("  ✗", name, "\n   ", e.stack || e.message); failed++; }
}

const r = om.generate(MARKUS, { featureFlag: true });
console.log("om_cipher — Markus baseline (1973-11-18 / 03:21 / Markus Lehto)");

test("Life Path 22 (Master Builder) — preserved, not reduced to 4", () => {
  assert.equal(r.metadata.life_path.value, EXPECTED.life_path);
  assert.equal(r.metadata.life_path.is_master, EXPECTED.life_path_is_master);
});

test("Expression 8", () => assert.equal(r.metadata.expression.value, EXPECTED.expression));
test("Soul Urge 6",   () => assert.equal(r.metadata.soul_urge.value,   EXPECTED.soul_urge));
test("Personality 11 (master preserved in display)", () => {
  assert.equal(r.metadata.personality.value,     EXPECTED.personality);
  assert.equal(r.metadata.personality.is_master, EXPECTED.personality_is_master);
});

test("Lunar Phase 6",   () => assert.equal(r.metadata.lunar_phase.value,   EXPECTED.lunar_phase));
test("Solar Quarter 3", () => assert.equal(r.metadata.solar_quarter.value, EXPECTED.solar_quarter));
test("Temporal Gate 1", () => assert.equal(r.metadata.temporal_gate.value, EXPECTED.temporal_gate));

test("Seed string is `LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1`", () => {
  assert.equal(r.seed_string, EXPECTED.seed_string);
});

test("SHA-256 seed matches frozen reference", () => {
  assert.equal(r.seed, EXPECTED.seed_sha256);
});

test("Sigil point count is 11 (birth_time present)", () => {
  assert.equal(r.metadata.sigil_points, EXPECTED.sigil_points);
});

test("Primary hue 72, secondary hue 252", () => {
  assert.equal(r.palette.primary_hue,   EXPECTED.primary_hue);
  assert.equal(r.palette.secondary_hue, EXPECTED.secondary_hue);
});

console.log("\nom_cipher — null birth_time degrades cleanly");

test("birth_time=null → 9 points, temporal_gate value null, TG absent from seed", () => {
  const rn = om.generate({ ...MARKUS, birth_time: null }, { featureFlag: true });
  assert.equal(rn.metadata.sigil_points, 9);
  assert.equal(rn.metadata.temporal_gate.value, null);
  assert.ok(!rn.seed_string.includes("TG:"), `seed_string contained TG: → ${rn.seed_string}`);
});

console.log("\nom_cipher — master-number preservation on Life Path");

test("Life Path master 11 preserved", () => {
  // 1+9+9+2 = 21; 0+2 = 2; 2+9 = 11 (master) — pick a date that lands on 11:
  // day 29 → 11; month 12 → 3; year 1988 → 26 → 8; sum 11+3+8 = 22 → 22 master.
  // Better: day 2 → 2; month 9 → 9; year 1989 → 27 → 9; sum 2+9+9 = 20 → 2 (not master).
  // Build a 11: day 29 → 11; month 1 → 1; year 1998 → 27 → 9; sum 11+1+9 = 21 → 3.
  // Try day 9 (9) + month 8 (8) + year 1980 (1+9+8+0=18→9) = 26 → 8.
  // Use day 9 + month 4 + year 1979 (1+9+7+9=26→8) = 9+4+8 = 21 → 3.
  // Try day 9 + month 5 + year 1978 (1+9+7+8=25→7) = 9+5+7 = 21.
  // For a master 11: day 4 + month 7 + year 1981 (1+9+8+1=19→10→1) = 4+7+1 = 12.
  // Direct: day 6 + month 2 + year 1983 (1+9+8+3=21→3) = 6+2+3=11 → master 11!
  const r11 = om.generate({ birth_date: "1983-02-06", legal_name: "Test User" }, { featureFlag: true });
  assert.equal(r11.metadata.life_path.value, 11, "should preserve 11");
  assert.equal(r11.metadata.life_path.is_master, true);
});

test("Life Path master 33 preserved", () => {
  // Need day + month + year reductions summing to 33.
  // year 1989 (1+9+8+9=27 → 9); month 11 (11 master kept); day 13 (1+3=4) → 9+11+4 = 24.
  // year 1979 (1+9+7+9=26 → 8); month 11 (11); day 14 (5) → 8+11+5 = 24.
  // year 1987 (1+9+8+7=25 → 7); month 11 (11); day 15 (6) → 7+11+6 = 24.
  // For 33 we need sum that reduces to 33 — i.e. raw sum 33 directly preserved.
  // year 1986 (1+9+8+6=24 → 6); month 11 (11); day 16 (7) → 6+11+7 = 24.
  // year 1976 (1+9+7+6=23 → 5); month 11 (11); day 17 (8) → 5+11+8 = 24.
  // year 1996 (1+9+9+6=25 → 7); month 22? month max 12. So month 11.
  // For raw=33 directly: rDay + rMonth + rYear = 33.
  // Try day 31 (3+1=4); month 11 (11); year 1979 (1+9+7+9=26→8) → 4+11+8 = 23.
  // day 29 (11); month 11 (11); year 1989 (1+9+8+9=27→9) → 11+11+9 = 31.
  // day 29 (11); month 11 (11); year 1988 (1+9+8+8=26→8) → 11+11+8 = 30.
  // day 29 (11); month 11 (11); year 1990 (1+9+9+0=19→10→1) → 11+11+1 = 23.
  // day 29 (11); month 11 (11); year 1992 (1+9+9+2=21→3) → 11+11+3 = 25.
  // day 22 (22); month 11 (11); year ____ where reduced=0? impossible (year≥1000 sums to ≥1).
  // day 22 (22); month 2 (2); year sum 9? e.g. 1980 (1+9+8+0=18→9). 22+2+9 = 33!
  const r33 = om.generate({ birth_date: "1980-02-22", legal_name: "Test User" }, { featureFlag: true });
  assert.equal(r33.metadata.life_path.value, 33, "should preserve 33");
  assert.equal(r33.metadata.life_path.is_master, true);
});

console.log("\nom_cipher — non-ASCII name normalization (NFC)");

test("non-ASCII letters normalize and produce stable seed", () => {
  // "Mărkus" with combining é — should normalize to NFC. Non-A-Z letters
  // are stripped (so the accent is lost) but the seed remains stable
  // across different input encodings of the same normalized form.
  const composed   = om.generate({ ...MARKUS, legal_name: "Märkus Lehto" }, { featureFlag: true });
  const decomposed = om.generate({ ...MARKUS, legal_name: "Märkus Lehto" }, { featureFlag: true });
  assert.equal(composed.seed, decomposed.seed, "NFC normalisation must collapse equivalent forms");
});

console.log("\n" + (failed === 0 ? "✅ all passed" : "❌ " + failed + " failed") +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
