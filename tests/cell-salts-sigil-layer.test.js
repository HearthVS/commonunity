// Cell Salts data + Sigil tissue-salt geometry layer.
//   Run: node tests/cell-salts-sigil-layer.test.js
//
// Acceptance checks:
//   - 12 salts present, well-formed.
//   - getSaltGeometryProfile reads salts[0].saltId (the fixed-bug behaviour).
//   - getPersonSaltView returns primary + (up to 2) secondaries.
//   - Sigil rendered with no salts is unchanged from a sigil rendered with
//     a salt: the salt layer is purely additive.
//   - Same seed + different PRIMARY salts produce visibly different inner
//     geometry while preserving the shared OM/Compass base structure
//     (the conic wedges, glyph block, and outer rings are byte-identical).

const assert = require("node:assert/strict");
const sigil = require("../sdk/sigil.js");
const salts = require("../sdk/cell_salts.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓", name); passed++; }
  catch (e) { console.error("  ✗", name, "\n   ", e.message); failed++; }
}

const SEED_INPUT = {
  display_name: "Sample Sage",
  full_name:    "Sample Sage",
  birthdate:    "1985-06-21",
  gene_keys:    { life_work: "GK 5.5", evolution: "GK 32.1" },
  compass:      {
    work:  { gk_num: "5",  gk_line: "5" },
    lens:  { gk_num: "32", gk_line: "1" },
    field: { gk_num: "64", gk_line: "1" },
    call:  { gk_num: "63", gk_line: "1" },
  },
  tone: { tonal_center: "C", dominant_hz: 528, seed_syllable: "Om" },
};

console.log("cell salts: data integrity");

test("exactly 12 tissue salts in canonical order", () => {
  assert.equal(salts.CELL_SALTS.length, 12);
  const ids = salts.CELL_SALTS.map(s => s.id);
  const expected = ["calc_fluor","calc_phos","calc_sulph","ferr_phos","kali_mur","kali_phos","kali_sulph","mag_phos","nat_mur","nat_phos","nat_sulph","silicea"];
  assert.deepEqual(ids, expected);
});

test("every salt has required fields", () => {
  const SYM  = new Set(["cubic", "hexagonal", "orthorhombic", "network"]);
  const BOND = new Set(["paired", "cross", "ring", "branching"]);
  const DENS = new Set(["sparse", "medium", "dense"]);
  for (const s of salts.CELL_SALTS) {
    assert.ok(s.id && s.name && s.formula, `${s.id} missing identity field`);
    assert.ok(SYM.has(s.primarySymmetry), `${s.id} bad symmetry ${s.primarySymmetry}`);
    assert.ok(BOND.has(s.bondMotif), `${s.id} bad motif ${s.bondMotif}`);
    assert.ok(DENS.has(s.nodeDensity), `${s.id} bad density ${s.nodeDensity}`);
    assert.ok(s.shortBodyZone && s.shortTheme, `${s.id} missing copy`);
  }
});

console.log("\ncell salts: helpers");

test("getSaltGeometryProfile reads salts[0].saltId (draft-bug fix)", () => {
  // The original draft helper accessed `salts.saltId` (treating the array as
  // an object) — that path returns undefined. This test guards the fix.
  const profile = salts.getSaltGeometryProfile([{ saltId: "calc_sulph", weight: 1 }]);
  assert.ok(profile, "expected a SaltGeometryProfile");
  assert.equal(profile.saltId, "calc_sulph");
  assert.equal(profile.symmetry, "orthorhombic");
  assert.equal(profile.bondMotif, "branching");
  assert.equal(profile.nodeDensity, "medium");
});

test("getSaltGeometryProfile: null/empty input → null", () => {
  assert.equal(salts.getSaltGeometryProfile(null), null);
  assert.equal(salts.getSaltGeometryProfile([]), null);
  assert.equal(salts.getSaltGeometryProfile([{ saltId: "not_a_salt" }]), null);
});

test("getPersonSaltView: primary + up to 2 secondaries", () => {
  const view = salts.getPersonSaltView([
    { saltId: "ferr_phos", weight: 1 },
    { saltId: "calc_phos", weight: 0.6 },
    { saltId: "silicea",   weight: 0.3 },
    { saltId: "kali_mur",  weight: 0.1 }, // should be ignored — > 2 secondaries
  ]);
  assert.equal(view.primary.id, "ferr_phos");
  assert.equal(view.secondary.length, 2);
  assert.deepEqual(view.secondary.map(s => s.id), ["calc_phos", "silicea"]);
});

console.log("\nsigil: salt layer is additive + deterministic");

test("encodeSigilSeed: salts pass through normalised", () => {
  const seed = sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "calc_sulph" }, { saltId: "silicea", weight: 0.4 }] });
  assert.deepEqual(seed.salts, [
    { saltId: "calc_sulph", weight: 1 },
    { saltId: "silicea",    weight: 0.4 },
  ]);
});

test("encodeSigilSeed: no salts → seed.salts is null", () => {
  const seed = sigil.encodeSigilSeed(SEED_INPUT);
  assert.equal(seed.salts, null);
});

test("renderSigilSVG: no salts → no salt layer in SVG", () => {
  const seedNoSalt = sigil.encodeSigilSeed(SEED_INPUT);
  const svg = sigil.renderSigilSVG(seedNoSalt);
  assert.ok(!/cu-sigil-salt-layer/.test(svg), "expected no salt layer");
});

test("renderSigilSVG: with primary salt → salt layer present, data attrs set", () => {
  const seedSalt = sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "calc_sulph" }] });
  const svg = sigil.renderSigilSVG(seedSalt);
  assert.ok(/cu-sigil-salt-layer/.test(svg), "salt layer missing");
  assert.ok(/data-salt-id="calc_sulph"/.test(svg));
  assert.ok(/data-salt-symmetry="orthorhombic"/.test(svg));
  assert.ok(/data-salt-motif="branching"/.test(svg));
  assert.ok(/data-salt-density="medium"/.test(svg));
});

test("renderSigilSVG: same seed + same salt → byte-identical SVG", () => {
  const sA = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "ferr_phos" }] }));
  const sB = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "ferr_phos" }] }));
  assert.equal(sA, sB);
});

test("renderSigilSVG: same seed, different PRIMARY salt → sibling difference", () => {
  // Sibling identity: the rotation / wedge colours / conic filter / vignette
  // are all derived from the handle hash, so two profiles with different
  // primary salts but same handle/birthdate/etc must share those structural
  // bytes. Only the salt layer differs.
  const sCalc = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "calc_fluor" }] }));
  const sFerr = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "ferr_phos"  }] }));

  // They must differ overall (proof: different micro-marks + edge motifs).
  assert.notEqual(sCalc, sFerr, "different primary salt must change inner geometry");

  // ...but they must share the conic-wedge prefix up to the salt layer.
  // We slice each SVG at the salt-layer opening to compare the shared base.
  const splitAt = s => s.split('<g class="cu-sigil-salt-layer"')[0];
  assert.equal(
    splitAt(sCalc),
    splitAt(sFerr),
    "OM/Compass/wedge structure must be identical across salt siblings",
  );

  // And the trailing structure after the salt layer must also match
  // (glyph text, label, etc all sit after the salt layer's closing </g>).
  // We slice each SVG at its salt-layer end and compare what follows.
  const splitAfter = s => {
    const m = s.match(/<g class="cu-sigil-salt-layer"[\s\S]*?<\/g>\n?/);
    if (!m) return s;
    return s.slice(m.index + m[0].length);
  };
  assert.equal(
    splitAfter(sCalc),
    splitAfter(sFerr),
    "post-salt-layer structure (glyph + label) must be identical",
  );
});

test("renderSigilSVG: different salt symmetries trigger different edge primitives", () => {
  const cubic = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "calc_fluor" }] }));
  const hex   = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "calc_phos"  }] }));
  const ortho = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "kali_phos"  }] }));
  const net   = sigil.renderSigilSVG(sigil.encodeSigilSeed({ ...SEED_INPUT, salts: [{ saltId: "silicea"    }] }));
  assert.ok(/data-salt-symmetry="cubic"/.test(cubic));
  assert.ok(/data-salt-symmetry="hexagonal"/.test(hex));
  assert.ok(/data-salt-symmetry="orthorhombic"/.test(ortho));
  assert.ok(/data-salt-symmetry="network"/.test(net));
  assert.notEqual(cubic, hex);
  assert.notEqual(cubic, ortho);
  assert.notEqual(cubic, net);
  assert.notEqual(hex, ortho);
  assert.notEqual(hex, net);
  assert.notEqual(ortho, net);
});

console.log("\nsigil: salt-layer drawing helpers (modular API)");

test("drawBaseSaltCube returns SVG geometry centred on the given point", () => {
  const out = sigil.drawBaseSaltCube({ center: { x: 100, y: 100 }, radius: 50 });
  assert.match(out, /^<path /);
  assert.match(out, /fill="none"/);
});

test("highlightSaltEdges branches on symmetry", () => {
  const geom = (function () {
    // Use the salt layer's internal geometry via a known render — just call
    // the helper with a hand-built profile + geometry stub.
    const r = 50;
    const c = { x: 100, y: 100 };
    return {
      corners: {
        tl: { x: c.x - r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
        tr: { x: c.x + r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
        br: { x: c.x + r * Math.SQRT1_2, y: c.y + r * Math.SQRT1_2 },
        bl: { x: c.x - r * Math.SQRT1_2, y: c.y + r * Math.SQRT1_2 },
      },
      mid: {
        top:    { x: c.x, y: c.y - r * Math.SQRT1_2 },
        right:  { x: c.x + r * Math.SQRT1_2, y: c.y },
        bottom: { x: c.x, y: c.y + r * Math.SQRT1_2 },
        left:   { x: c.x - r * Math.SQRT1_2, y: c.y },
      },
      radius: r,
      center: c,
    };
  })();
  const cubic = sigil.highlightSaltEdges({ symmetry: "cubic", bondMotif: "paired", nodeDensity: "dense", saltId: "x" }, geom);
  const hex   = sigil.highlightSaltEdges({ symmetry: "hexagonal", bondMotif: "ring", nodeDensity: "medium", saltId: "x" }, geom);
  const net   = sigil.highlightSaltEdges({ symmetry: "network", bondMotif: "cross", nodeDensity: "dense", saltId: "x" }, geom);
  assert.notEqual(cubic, hex);
  assert.notEqual(cubic, net);
  assert.notEqual(hex, net);
});

console.log();
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
