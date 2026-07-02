// Regression test for the Studio "cOMpass palette → default colour" bridge.
//
// Studio inherits the person's cOMpass palette by applying the contract's exact
// OKLCH colours to the --cipher-* / --setup-accent CSS variables (see
// initOmCipherPalette + the early bootstrap). The mood-lighting "Hue" slider is
// a *relative* hue-rotate filter, NOT an absolute colour, so the faithful
// default holds the hue at the neutral baseline 220 (zero rotation) and lets
// the palette-bound tokens show through. PR #81 incorrectly fed the palette's
// absolute OKLCH hue into that slider, rotating the page away from the real
// palette; this test pins the corrected behaviour.
//
// We extract the small, self-contained helpers from studio.html and evaluate
// them against a fake window + localStorage. The full Studio HTML is too heavy
// to JSDOM here, mirroring om-cipher-studio-bridge.

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

const src =
  `const OM_CIPHER_CONTRACT_KEY = 'commonunity_om_cipher_v1';\n` +
  extractFn("readOmCipherContract") + "\n" +
  extractFn("paletteObjectFromAny") + "\n" +
  extractFn("cipherPaletteObject") + "\n" +
  extractFn("hasCipherPalette") + "\n" +
  extractFn("cipherDefaultHue") + "\n" +
  extractFn("cipherDefaultVibe") + "\n" +
  "return { readOmCipherContract, paletteObjectFromAny, cipherPaletteObject, " +
  "hasCipherPalette, cipherDefaultHue, cipherDefaultVibe };";

function makeEnv(stored) {
  const fakeWindow = {
    localStorage: {
      _v: stored == null ? null : (typeof stored === "string" ? stored : JSON.stringify(stored)),
      getItem(k) { return k === "commonunity_om_cipher_v1" ? this._v : null; },
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

// Canonical cOMpass contract palette shape (threshold/contract.js +
// index.html computePaletteFromIdentity): object with primary/secondary/
// seasonal_accent as OKLCH strings.
const completedContract = (primary, secondary, seasonal_accent) => ({
  threshold: { completed: true },
  om_cipher: { palette: { primary, secondary: secondary || "", seasonal_accent: seasonal_accent || "" } },
});

// Real-world cOMpass palette primary lightness/chroma values, to make sure the
// helpers tolerate the actual contract shape (oklch(0.62 0.16 H), etc.).
const REAL_PRIMARY = "oklch(0.62 0.16 30)";
const REAL_SECONDARY = "oklch(0.72 0.07 210)";
const REAL_SEASONAL = "oklch(0.74 0.13 50)";

console.log("studio cipher default palette — palette object normalisation");

test("normalises the canonical object-shape contract palette", () => {
  const env = makeEnv(completedContract(REAL_PRIMARY, REAL_SECONDARY, REAL_SEASONAL));
  const pal = env.cipherPaletteObject();
  assert.equal(pal.primary, REAL_PRIMARY);
  assert.equal(pal.secondary, REAL_SECONDARY);
  assert.equal(pal.seasonal_accent, REAL_SEASONAL);
});

test("normalises the engine list-shape palette to the object shape", () => {
  // sdk/om_cipher.js exports { palette: [primary, secondary, accent], ... }
  const env = makeEnv(null);
  const pal = env.paletteObjectFromAny({
    palette: ["oklch(0.55 0.227 72)", "oklch(0.55 0.227 252)", "oklch(0.50 0.204 102)"],
    primary_hue: 72,
  });
  assert.equal(pal.primary, "oklch(0.55 0.227 72)");
  assert.equal(pal.secondary, "oklch(0.55 0.227 252)");
  assert.equal(pal.seasonal_accent, "oklch(0.50 0.204 102)");
});

test("accepts legacy `accent` alias when seasonal_accent is absent", () => {
  const env = makeEnv(null);
  const pal = env.paletteObjectFromAny({ primary: REAL_PRIMARY, accent: REAL_SEASONAL });
  assert.equal(pal.seasonal_accent, REAL_SEASONAL);
});

test("paletteObjectFromAny returns null for empty/garbage input", () => {
  const env = makeEnv(null);
  assert.equal(env.paletteObjectFromAny(null), null);
  assert.equal(env.paletteObjectFromAny({}), null);
});

console.log("\nstudio cipher default palette — palette presence");

test("hasCipherPalette is true for a completed contract with a primary", () => {
  const env = makeEnv(completedContract(REAL_PRIMARY, REAL_SECONDARY, REAL_SEASONAL));
  assert.equal(env.hasCipherPalette(), true);
});

test("hasCipherPalette is false when no contract is stored", () => {
  assert.equal(makeEnv(null).hasCipherPalette(), false);
});

test("hasCipherPalette is false when contract is not completed (read-only guard)", () => {
  const env = makeEnv({ threshold: { completed: false }, om_cipher: { palette: { primary: REAL_PRIMARY } } });
  assert.equal(env.hasCipherPalette(), false);
});

test("hasCipherPalette is false for malformed JSON without throwing", () => {
  assert.equal(makeEnv("{not valid json").hasCipherPalette(), false);
});

console.log("\nstudio cipher default palette — default vibe is palette-faithful (neutral hue)");

test("default vibe holds hue at neutral 220 when a palette IS present", () => {
  // Correct behaviour: the real palette is carried by the --cipher-* CSS vars,
  // so the hue-rotate filter must stay at zero (slider 220). The arbitrary
  // OKLCH-hue rotation from PR #81 is gone.
  const env = makeEnv(completedContract(REAL_PRIMARY, REAL_SECONDARY, REAL_SEASONAL));
  const v = env.cipherDefaultVibe();
  assert.equal(v.hue, 220);
  assert.equal(v.glow, 50);
  assert.equal(v.dark, 50);
  assert.equal(v.warm, 0);
  assert.equal(v.space, 7);
  assert.equal(v.text, 75);
});

test("default vibe is the same neutral baseline when NO palette is present", () => {
  const v = makeEnv(null).cipherDefaultVibe();
  assert.equal(v.hue, 220);
  assert.equal(v.glow, 50);
  assert.equal(v.space, 7);
});

test("cipherDefaultHue still reports the palette primary hue (diagnostic only)", () => {
  // Retained for diagnostics; no longer drives the slider.
  const env = makeEnv(completedContract("oklch(0.62 0.16 280)"));
  assert.equal(env.cipherDefaultHue(), 280);
  assert.equal(makeEnv(null).cipherDefaultHue(), null);
});

console.log("\nstudio cipher default palette — UI control + wiring presence");

test("'Use cOMpass palette' control exists in the colour dropdown", () => {
  assert.ok(html.includes('id="colour-cipher-default-btn"'), "button id present");
  assert.ok(html.includes("Use cOMpass palette"), "user-friendly label present");
});

test("reset handler re-syncs palette tokens then applies the default vibe", () => {
  const wiring = html.indexOf("cipherDefaultBtn.addEventListener");
  assert.ok(wiring > 0, "click handler wired");
  const handlerSlice = html.slice(wiring, wiring + 600);
  assert.ok(handlerSlice.includes("initOmCipherPalette()"), "re-syncs --cipher-* tokens on reset");
  assert.ok(handlerSlice.includes("cipherDefaultVibe()"), "applies cipherDefaultVibe");
});

test("room restore re-syncs palette + applies cipher default when no saved vibe", () => {
  // doEnterRoom else-branch: initOmCipherPalette() then applyVibeState(cipherDefaultVibe()).
  const idx = html.indexOf("if (savedVibe) applyVibeState(savedVibe);");
  assert.ok(idx > 0, "savedVibe restore present");
  const slice = html.slice(idx, idx + 500);
  assert.ok(slice.includes("initOmCipherPalette()"), "re-syncs palette in the no-saved-vibe branch");
  assert.ok(slice.includes("applyVibeState(cipherDefaultVibe())"), "applies cipher default vibe");
});

console.log("\n" + (failed === 0 ? "✅ all passed" : "❌ " + failed + " failed") +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
