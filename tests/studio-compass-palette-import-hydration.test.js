// Regression test: importing a cOMpass/Studio JSON hydrates the OM Cipher
// palette contract so Studio's --cipher-* tokens and the "Use cOMpass palette"
// reset reflect the just-imported palette.
//
// Before this fix, processCompassImport stored compassData but never wrote the
// commonunity_om_cipher_v1 contract, so the palette reader + reset kept seeing
// stale/absent localStorage after an import. We extract the self-contained
// helpers from studio.html and run them against a fake window + localStorage,
// exercising the two palette shapes a real export can carry:
//   • canonical object shape   { primary, secondary, seasonal_accent }
//   • engine list shape        { palette: [p, s, a], primary_hue, ... }

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "studio.html"), "utf8");

function extractFn(name) {
  const sig = `function ${name}(`;
  const s = html.indexOf(sig);
  assert.ok(s > 0, `${name} not found`);
  let i = html.indexOf("{", s);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(s, i);
}

// Pull the read/normalise/hydrate trio. initOmCipherPalette is heavy (touches
// document.documentElement); we inject a no-op stub so hydrate() only exercises
// the localStorage contract write, which is what we assert on.
const src =
  `const OM_CIPHER_CONTRACT_KEY = 'commonunity_om_cipher_v1';\n` +
  `function initOmCipherPalette() { /* stubbed in test */ }\n` +
  extractFn("readOmCipherContract") + "\n" +
  extractFn("paletteObjectFromAny") + "\n" +
  extractFn("normalizeImportedStudioOrCompassJson") + "\n" +
  extractFn("hydrateCipherPaletteFromImport") + "\n" +
  "return { readOmCipherContract, paletteObjectFromAny, " +
  "normalizeImportedStudioOrCompassJson, hydrateCipherPaletteFromImport, " +
  "_dump: () => window.localStorage._store['commonunity_om_cipher_v1'] };";

function makeEnv(initial) {
  const store = {};
  if (initial != null) {
    store["commonunity_om_cipher_v1"] =
      typeof initial === "string" ? initial : JSON.stringify(initial);
  }
  const fakeWindow = {
    localStorage: {
      _store: store,
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; },
      setItem(k, v) { this._store[k] = String(v); },
    },
  };
  const fn = new Function("window", src);
  return fn(fakeWindow);
}

let passed = 0, failed = 0;
function test(name, body) {
  try { body(); console.log("  ✓", name); passed++; }
  catch (e) { console.error("  ✗", name, "\n   ", e.stack || e.message); failed++; }
}

console.log("studio compass palette import hydration — object-shape palette");

test("hydrates a completed contract from an object-shape om_cipher palette", () => {
  const env = makeEnv(null);
  const ok = env.hydrateCipherPaletteFromImport({
    palette: {
      primary: "oklch(0.62 0.16 30)",
      secondary: "oklch(0.72 0.07 210)",
      seasonal_accent: "oklch(0.74 0.13 50)",
    },
  });
  assert.equal(ok, true);
  const c = env.readOmCipherContract();
  assert.ok(c, "contract is present and marked completed");
  assert.equal(c.threshold.completed, true);
  assert.equal(c.om_cipher.palette.primary, "oklch(0.62 0.16 30)");
  assert.equal(c.om_cipher.palette.secondary, "oklch(0.72 0.07 210)");
  assert.equal(c.om_cipher.palette.seasonal_accent, "oklch(0.74 0.13 50)");
});

console.log("\nstudio compass palette import hydration — engine list-shape palette");

test("hydrates from the engine list-shape om_cipher block", () => {
  const env = makeEnv(null);
  // sdk/om_cipher.js om_cipher_block carries palette as a list.
  const ok = env.hydrateCipherPaletteFromImport({
    palette: ["oklch(0.55 0.227 72)", "oklch(0.55 0.227 252)", "oklch(0.50 0.204 102)"],
    primary_hue: 72,
    secondary_hue: 252,
  });
  assert.equal(ok, true);
  const pal = env.readOmCipherContract().om_cipher.palette;
  assert.equal(pal.primary, "oklch(0.55 0.227 72)");
  assert.equal(pal.secondary, "oklch(0.55 0.227 252)");
  assert.equal(pal.seasonal_accent, "oklch(0.50 0.204 102)");
});

console.log("\nstudio compass palette import hydration — merge + guard semantics");

test("preserves existing non-palette contract fields when merging", () => {
  const env = makeEnv({
    threshold: { completed: true, foo: "bar" },
    om_cipher: {
      cipher_identity: { cipher_id: "abc123" },
      palette: { primary: "oklch(0.5 0.1 10)", schema_version: 2, source: "om_cipher_palette_v2" },
    },
  });
  env.hydrateCipherPaletteFromImport({
    palette: { primary: "oklch(0.62 0.16 30)", secondary: "oklch(0.72 0.07 210)", seasonal_accent: "oklch(0.74 0.13 50)" },
  });
  const c = env.readOmCipherContract();
  assert.equal(c.threshold.foo, "bar", "non-palette threshold fields preserved");
  assert.equal(c.om_cipher.cipher_identity.cipher_id, "abc123", "identity preserved");
  assert.equal(c.om_cipher.palette.schema_version, 2, "palette metadata preserved");
  assert.equal(c.om_cipher.palette.primary, "oklch(0.62 0.16 30)", "palette colours overwritten");
  assert.equal(c.om_cipher.palette.seasonal_accent, "oklch(0.74 0.13 50)");
});

test("no-ops when the import carries no usable palette", () => {
  const env = makeEnv(null);
  assert.equal(env.hydrateCipherPaletteFromImport(null), false);
  assert.equal(env.hydrateCipherPaletteFromImport({}), false);
  assert.equal(env.hydrateCipherPaletteFromImport({ palette: { secondary: "oklch(0.7 0.1 10)" } }), false,
    "needs a primary to hydrate");
  assert.equal(env._dump(), undefined, "nothing written to localStorage");
});

console.log("\nstudio compass palette import hydration — normalizer surfaces om_cipher");

test("normalizer surfaces om_cipher from a Studio export wrapper", () => {
  const env = makeEnv(null);
  const norm = env.normalizeImportedStudioOrCompassJson({
    version: "studio-1",
    compassData: { points: { work: {} } },
    om_cipher: { palette: { primary: "oklch(0.62 0.16 30)" } },
  });
  assert.ok(norm, "wrapper recognised");
  assert.ok(norm.omCipher && norm.omCipher.palette, "om_cipher surfaced");
});

test("normalizer surfaces om_cipher from a raw Compass session", () => {
  const env = makeEnv(null);
  const norm = env.normalizeImportedStudioOrCompassJson({
    points: { work: {} },
    companion: "Ada",
    om_cipher: { palette: ["oklch(0.55 0.227 72)", "", ""] },
  });
  assert.ok(norm, "raw session recognised");
  assert.ok(norm.omCipher && Array.isArray(norm.omCipher.palette), "om_cipher surfaced");
});

test("end-to-end: normalize → hydrate from a raw cOMpass session export", () => {
  const env = makeEnv(null);
  const norm = env.normalizeImportedStudioOrCompassJson({
    points: { work: {} },
    om_cipher: { palette: { primary: "oklch(0.62 0.16 99)", secondary: "", seasonal_accent: "" } },
  });
  const ok = env.hydrateCipherPaletteFromImport(norm.omCipher);
  assert.equal(ok, true);
  assert.equal(env.readOmCipherContract().om_cipher.palette.primary, "oklch(0.62 0.16 99)");
});

console.log("\n" + (failed === 0 ? "✅ all passed" : "❌ " + failed + " failed") +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
