// Regression test for the Studio "cOMpass palette → default vibe" bridge.
//
// The Studio derives its default colour (mood-lighting Hue) from the OM Cipher
// contract palette so the Studio opens consistent with the palette the person
// chose in cOMpass. We extract the small, self-contained helper trio from
// studio.html and evaluate it against a fake window + localStorage. The full
// Studio HTML is too heavy to JSDOM here, mirroring om-cipher-studio-bridge.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "studio.html"), "utf8");

// Anchor extraction: the contract reader + the two cipher-default helpers.
// We slice from the OM_CIPHER_CONTRACT_KEY declaration through the end of
// cipherDefaultVibe(), then expose the helpers via a returned object.
const startMarker = "const OM_CIPHER_CONTRACT_KEY";
const endMarker = "function cipherDefaultVibe()";
const start = html.indexOf(startMarker);
assert.ok(start > 0, "OM_CIPHER_CONTRACT_KEY block not found in studio.html");
const vibeIdx = html.indexOf(endMarker, start);
assert.ok(vibeIdx > start, "cipherDefaultVibe not found in studio.html");
// Find the closing brace of cipherDefaultVibe — the next "\n}" after its body.
const vibeBodyStart = html.indexOf("{", vibeIdx);
const vibeEnd = html.indexOf("\n}", vibeBodyStart);
assert.ok(vibeEnd > vibeBodyStart, "cipherDefaultVibe end not found");

// We only need: readOmCipherContract, cipherDefaultHue, cipherDefaultVibe.
// Slice the contract reader (it sits between startMarker and the palette
// applier) plus the two helpers, dropping the intervening unrelated funcs by
// re-extracting just the function definitions we care about.
function extractFn(name) {
  const sig = `function ${name}(`;
  const s = html.indexOf(sig);
  assert.ok(s > 0, `${name} not found`);
  // naive matching-brace scan
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
  extractFn("cipherDefaultHue") + "\n" +
  extractFn("cipherDefaultVibe") + "\n" +
  "return { readOmCipherContract, cipherDefaultHue, cipherDefaultVibe };";

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

console.log("studio cipher default palette — hue derivation");

const completedContract = (primary) => ({
  threshold: { completed: true },
  om_cipher: { palette: { primary, secondary: "", seasonal_accent: "" } },
});

test("derives hue from an OKLCH primary", () => {
  const env = makeEnv(completedContract("oklch(0.55 0.227 280)"));
  assert.equal(env.cipherDefaultHue(), 280);
});

test("derives hue from an OKLCH primary with percent lightness", () => {
  const env = makeEnv(completedContract("oklch(55% 0.227 42)"));
  assert.equal(env.cipherDefaultHue(), 42);
});

test("normalises hue into 0–360", () => {
  const env = makeEnv(completedContract("oklch(0.55 0.227 400)"));
  assert.equal(env.cipherDefaultHue(), 40);
});

test("falls back to hsl() form", () => {
  const env = makeEnv(completedContract("hsl(120, 50%, 40%)"));
  assert.equal(env.cipherDefaultHue(), 120);
});

test("falls back to secondary/accent when primary missing", () => {
  const env = makeEnv({
    threshold: { completed: true },
    om_cipher: { palette: { primary: "", secondary: "oklch(0.72 0.07 100)", seasonal_accent: "" } },
  });
  assert.equal(env.cipherDefaultHue(), 100);
});

test("returns null when no contract is stored", () => {
  const env = makeEnv(null);
  assert.equal(env.cipherDefaultHue(), null);
});

test("returns null when contract is not completed (read-only guard)", () => {
  const env = makeEnv({ threshold: { completed: false }, om_cipher: { palette: { primary: "oklch(0.55 0.227 280)" } } });
  assert.equal(env.cipherDefaultHue(), null);
});

test("returns null for malformed JSON without throwing", () => {
  const env = makeEnv("{not valid json");
  assert.equal(env.cipherDefaultHue(), null);
});

console.log("\nstudio cipher default palette — default vibe object");

test("vibe hue tracks the cipher palette, other dims stay neutral", () => {
  const env = makeEnv(completedContract("oklch(0.55 0.227 280)"));
  const v = env.cipherDefaultVibe();
  assert.equal(v.hue, 280);
  assert.equal(v.glow, 50);
  assert.equal(v.dark, 50);
  assert.equal(v.warm, 0);
  assert.equal(v.space, 7);
  assert.equal(v.text, 75);
});

test("vibe falls back to baseline hue 220 when no palette", () => {
  const env = makeEnv(null);
  const v = env.cipherDefaultVibe();
  assert.equal(v.hue, 220);
  assert.equal(v.glow, 50);
  assert.equal(v.space, 7);
});

console.log("\nstudio cipher default palette — UI control + wiring presence");

test("'Use cOMpass palette' control exists in the colour dropdown", () => {
  assert.ok(html.includes('id="colour-cipher-default-btn"'), "button id present");
  assert.ok(html.includes("Use cOMpass palette"), "user-friendly label present");
});

test("control is wired to apply the cipher default vibe", () => {
  const i = html.indexOf("colour-cipher-default-btn");
  const wiring = html.indexOf("cipherDefaultBtn.addEventListener");
  assert.ok(wiring > 0, "click handler wired");
  assert.ok(html.indexOf("cipherDefaultVibe()", wiring) > wiring, "handler applies cipherDefaultVibe");
});

test("room restore applies the cipher default when no saved vibe exists", () => {
  assert.ok(html.includes("else applyVibeState(cipherDefaultVibe());"),
    "doEnterRoom falls back to cipher default vibe");
});

console.log("\n" + (failed === 0 ? "✅ all passed" : "❌ " + failed + " failed") +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
