// Focused regression test for the Studio Om Cipher browser bridge.
//
// We evaluate just the small inline IIFE that defines window.cuOmCipherDisplay
// against a fake `window`. The full Studio HTML is too heavy to JSDOM here;
// the bridge is intentionally self-contained for exactly this reason.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "studio.html"), "utf8");

// Extract the bridge IIFE block by anchor comments — keeps the test robust
// to surrounding edits.
const startMarker = "Om Cipher v1 — browser bridge";
const endMarker   = "window.cuOmCipherDisplay = function";
const start = html.indexOf(startMarker);
assert.ok(start > 0, "browser-bridge block not found in studio.html");
// The IIFE definition + window.cuOmCipherDisplay assignment must both be present.
assert.ok(html.indexOf(endMarker, start) > start, "window.cuOmCipherDisplay assignment not found");

// Pull the (function () { ... })(); wrapping. The bridge starts at the
// line after the closing comment block — find the first "(function ()".
const iifeStart = html.indexOf("(function () {", start);
assert.ok(iifeStart > 0, "IIFE start not found");
// Find the matching "})()" that closes this IIFE — first one after iifeStart.
const iifeEnd = html.indexOf("})();", iifeStart);
assert.ok(iifeEnd > iifeStart, "IIFE end not found");
const iifeSrc = html.slice(iifeStart, iifeEnd + "})();".length);

// Fake window + evaluate.
const fakeWindow = {};
const fn = new Function("window", iifeSrc + "; return window.cuOmCipherDisplay;");
const cuOmCipherDisplay = fn(fakeWindow);
assert.equal(typeof cuOmCipherDisplay, "function", "bridge must export cuOmCipherDisplay");

let passed = 0, failed = 0;
function test(name, body) {
  try { body(); console.log("  ✓", name); passed++; }
  catch (e) { console.error("  ✗", name, "\n   ", e.stack || e.message); failed++; }
}

console.log("om_cipher studio bridge — flag gating");

test("returns null when CU_OM_CIPHER_ENABLED is unset", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = false;
  const r = cuOmCipherDisplay({ birthdate: "1988-04-23", compass: { work: { gk_num: "34", gk_line: "5" } } });
  assert.equal(r, null);
});

test("returns Activation Sequence label when flag is on", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = false;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: { work: { gk_num: "34", gk_line: "5" } },
    frequency_signature: { dominant_hz: 136.1 },
  });
  assert.equal(r.digital_root, 8);
  assert.equal(r.gk_primary.gate, 34);
  assert.equal(r.gk_primary.line, 5);
  assert.equal(r.gk_primary.label, "Fixer");
  assert.equal(r.bhramari_semitone, null, "Bhramari off → no semitone");
  assert.ok(r.label.includes("Root 8"));
  // Only work has a line; pair fragment surfaces just the work label.
  assert.ok(r.label.includes("Challenge 5: Fixer"));
  assert.ok(!r.label.includes("Resonance"));
});

test("includes semitone when Bhramari flag is on and dominant_hz present", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = true;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: { work: { gk_num: "34", gk_line: "5" } },
    frequency_signature: { dominant_hz: 136.1 },
  });
  assert.equal(r.bhramari_semitone, "C#3");
  assert.ok(r.label.includes("Resonance C#3"));
});

test("graceful fallback: no compass, no Bhramari → still derives root", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = true;
  const r = cuOmCipherDisplay({ birthdate: "1988-04-23" });
  assert.equal(r.digital_root, 8);
  assert.equal(r.gk_primary, null);
  assert.equal(r.label, "Root 8");
});

test("graceful fallback: empty payload → null", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  const r = cuOmCipherDisplay({});
  assert.equal(r, null);
});

test("preserves master numbers (11/22/33)", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = false;
  // 9909-09-02 → 9+9+0+9+0+9+0+2 = 38 → 11
  const r = cuOmCipherDisplay({ birthdate: "9909-09-02" });
  assert.equal(r.digital_root, 11);
});

console.log("\nom_cipher studio bridge — Activation Sequence pairs");

test("Challenge pair (work/lens) renders single label when lines match (line 2)", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = false;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: {
      work: { gk_num: "34", gk_line: "2" },
      lens: { gk_num: "11", gk_line: "2" },
    },
  });
  // Work line 2 = Dancer; Lens (Evolution) line 2 = Passion & Relationships.
  assert.ok(r.label.includes("Challenge 2: Dancer / Passion & Relationships"), r.label);
});

test("Stability pair (field/call) renders single label when lines match (line 4)", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: {
      field: { gk_num: "21", gk_line: "4" },
      call:  { gk_num: "57", gk_line: "4" },
    },
  });
  // Field (Radiance) line 4 = Friendship; Call line 4 = Breath.
  assert.ok(r.label.includes("Stability 4: Friendship / Breath"), r.label);
});

test("Full Activation Sequence (user case: work/lens line 2, field/call line 4)", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = true;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: {
      work:  { gk_num: "34", gk_line: "2" },
      lens:  { gk_num: "11", gk_line: "2" },
      field: { gk_num: "21", gk_line: "4" },
      call:  { gk_num: "57", gk_line: "4" },
    },
    frequency_signature: { dominant_hz: 136.1 },
  });
  // Expect: Root 8 · Challenge 2: Dancer / Passion & Relationships · Stability 4: Friendship / Breath · Resonance C#3
  assert.ok(r.label.includes("Root 8"));
  assert.ok(r.label.includes("Challenge 2: Dancer / Passion & Relationships"));
  assert.ok(r.label.includes("Stability 4: Friendship / Breath"));
  assert.ok(r.label.includes("Resonance C#3"));
  assert.equal(r.gk_all.work.label, "Dancer");
  assert.equal(r.gk_all.lens.label, "Passion & Relationships");
  assert.equal(r.gk_all.field.label, "Friendship");
  assert.equal(r.gk_all.call.label, "Breath");
});

test("Mismatched lines render per-slot labels (no pretense of pair unity)", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: {
      work: { gk_num: "34", gk_line: "5" }, // Fixer
      lens: { gk_num: "11", gk_line: "2" }, // Passion & Relationships
    },
  });
  assert.ok(r.label.includes("Challenge 5: Fixer / 2: Passion & Relationships"), r.label);
});

test("Missing line on one half of the pair still surfaces the other", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    compass: {
      work: { gk_num: "34", gk_line: "2" },
      lens: { gk_num: "11" }, // no line
    },
  });
  assert.ok(r.label.includes("Challenge 2: Dancer"), r.label);
  assert.ok(!r.label.includes("Passion & Relationships"));
});

test("Manual Hz feeds resonance display via frequency_signature.dominant_hz", () => {
  fakeWindow.CU_OM_CIPHER_ENABLED = true;
  fakeWindow.CU_BHRAMARI_CAPTURE_ENABLED = true;
  // 220 Hz → A3
  const r = cuOmCipherDisplay({
    birthdate: "1988-04-23",
    frequency_signature: { dominant_hz: 220 },
  });
  assert.equal(r.bhramari_semitone, "A3");
  assert.ok(r.label.includes("Resonance A3"));
});

console.log("\n" + (failed === 0 ? "✅ all passed" : "❌ " + failed + " failed") +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
