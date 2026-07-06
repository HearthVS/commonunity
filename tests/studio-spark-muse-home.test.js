'use strict';

// Static tests for reframing Studio Spark as the stUdio Muse and making
// hOMe-targeted Spark actions read as builder-native (studio.html).
//
// studio.html is a single-file app with no build step, so these tests
// assert directly over the rendered markup and the relevant JS source.
//
// They guard this product slice:
//   1. Spark is positioned as the creative muse of stUdio, with hOMe as
//      the first project/creation path — and is NOT called the builder.
//   2. The primary CTA for hOMe/website Sparks is builder-native
//      ("Shape this hOMe" / "Tune this hOMe"), never "Field Observations".
//   3. Field Observations survives only as a subtle secondary path.
//   4. The threshold capture feeds the hero *heading* (not the intro),
//      and home-threshold-intro feeds the intro — the prior bug where the
//      captured threshold could never become the hero heading is fixed.
//
// Run with:  node --test tests/studio-spark-muse-home.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'studio.html'),
  'utf8'
);

function slice(anchor, len) {
  const i = html.indexOf(anchor);
  assert.ok(i !== -1, `expected to find "${anchor}"`);
  return html.slice(i, i + len);
}

// ── 1) Muse framing + hOMe-as-first-project ───────────────────────────
// The full Muse orientation copy now opens on demand behind the site's
// standard glowing info (i) affordance (.studio-info-btn +
// .studio-info-overlay), replacing the weak "+ About Spark Muse" text
// disclosure. The stUdio Muse framing eyebrow stays in the primary state.
test('threshold copy positions Spark as the stUdio Muse', () => {
  const block = slice('<div class="spark-threshold">', 1200);
  assert.match(block, /stUdio Muse/,
    'threshold eyebrow carries the stUdio Muse framing');
  // The full muse-of-stUdio copy now lives in the guidance overlay.
  const overlay = slice('id="info-spark-muse-overlay"', 1200);
  assert.match(overlay, /muse of stUdio/i,
    'guidance overlay names Spark as the creative muse of stUdio');
});

test('the guidance uses the standard glowing info affordance, not "+ About" text', () => {
  const block = slice('<div class="spark-threshold">', 1200);
  // The weak text disclosure is gone from the primary markup…
  assert.doesNotMatch(block, /<details class="spark-about">/,
    'the old spark-about <details> disclosure is removed');
  assert.doesNotMatch(html, /\+ About Spark Muse/,
    'no literal "+ About Spark Muse" text row remains in the markup');
  // …replaced by the standard glowing info (i) button targeting the shared
  // popup, so Spark guidance reads consistently with the rest of the site.
  assert.match(block, /class="studio-info-btn spark-muse-info-btn"/,
    'primary state uses the standard glowing info (i) affordance');
  assert.match(block, /data-info="info-spark-muse-overlay"/,
    'the info button opens the Spark Muse guidance overlay');
  // Accessible: real button semantics via aria-label, keyboard-operable.
  assert.match(block, /aria-label="About Spark Muse[^"]*"/,
    'the info affordance carries an accessible label');
  // A newcomer-friendly cue invites expansion without re-densifying copy.
  assert.match(block, /class="spark-guide-cue"/,
    'a compact newcomer guidance cue wraps the affordance');
  assert.match(block, /New here\?/,
    'the cue carries newcomer-friendly microcopy');
});

test('the long Muse copy lives in the collapsed guidance overlay, not primary', () => {
  const block = slice('<div class="spark-threshold">', 1200);
  // The long lede is not primary repeated real-estate.
  assert.doesNotMatch(block, /creative muse of stUdio/,
    'the full Muse paragraph is not primary visible copy');
  // The overlay is collapsed by default (no `open` class) so repeated
  // users are not shown the full explainer on every draw.
  const overlay = slice('<div class="studio-info-overlay" id="info-spark-muse-overlay">', 200);
  assert.doesNotMatch(overlay, /class="studio-info-overlay open"/,
    'the guidance overlay is collapsed (not open) by default');
  const overlayBody = slice('id="info-spark-muse-overlay"', 1200);
  assert.match(overlayBody, /class="spark-threshold-lede"/,
    'the long Muse lede lives inside the guidance overlay');
  assert.match(overlayBody, /creative muse of stUdio/,
    'the full Muse paragraph is inside the overlay');
});

test('threshold copy frames hOMe as the first project/creation', () => {
  const overlay = slice('id="info-spark-muse-overlay"', 1200);
  assert.match(overlay, /hOMe is the first project/i,
    'copy names hOMe as the first project Spark helps shape');
  // Preserve the existing #119/#120 milestone contract.
  assert.match(overlay, /first creation in Studio/);
});

test('a compact one-line room legend remains in the primary state', () => {
  const line = slice('<p class="spark-orient-line"', 300);
  ['Work', 'Lens', 'Field', 'Call'].forEach(function (room) {
    assert.match(line, new RegExp('>' + room + '<'),
      'compact legend names the "' + room + '" room');
  });
});

test('Spark is never called the builder itself', () => {
  const block = slice('<div class="spark-threshold">', 1400);
  const foot = slice('<p class="om-widget-foot">', 600);
  [block, foot].forEach(function (s) {
    assert.doesNotMatch(s, /Spark is the builder/i,
      'Spark must be framed as the muse, not the builder itself');
  });
});

test('foot copy carries muse framing and keeps the secondary FO path', () => {
  const foot = slice('<p class="om-widget-foot">', 600);
  assert.match(foot, /stUdio Muse/, 'foot names Spark as the stUdio Muse');
  assert.match(foot, /shape your hOMe directly/i,
    'foot states hOMe Sparks shape hOMe directly (builder-native primary)');
  // Field Observations remains, but as a secondary ("also rest").
  assert.match(foot, /also rest in Field Observations/i,
    'Field Observations survives as a subtle secondary, not the headline');
  assert.match(foot, /Nexus/, 'Nexus availability note preserved');
});

// ── 2) Builder-native primary CTA for hOMe/website Sparks ──────────────
test('default compose button no longer says Field Observations', () => {
  const btn = slice('id="spark-compose"', 120);
  assert.doesNotMatch(btn, /Field Observations/,
    'the primary CTA default must not read as a Field Observations detour');
  assert.match(btn, /Shape this hOMe/, 'default CTA is builder-native');
});

test('sparkComposeLabel returns hOMe-native copy for website Sparks', () => {
  const fn = slice('function sparkComposeLabel(', 200);
  // The label is now driven by the MUSE_PROJECTS project-native action
  // (via sparkProjectActionLabel), with the Field Observations copy as
  // the self-directed fallback — no inline builder branch.
  assert.match(fn, /sparkProjectActionLabel\(spark\)/,
    'label is chosen from the Spark project (MUSE_PROJECTS)');
  assert.match(fn, /Compose in Field Observations/,
    'non-hOMe Sparks (profile / os) keep the compose-into-FO copy');
  // The hOMe-native CTA copy lives in the MUSE_PROJECTS website entry.
  const project = slice('var MUSE_PROJECTS = {', 900);
  assert.match(project, /Shape this hOMe/);
  assert.match(project, /Tune this hOMe/);
});

test('renderSpark applies the dynamic compose label', () => {
  const render = slice('function renderSpark(', 1400);
  assert.match(render, /composeBtn\.textContent\s*=\s*sparkComposeLabel\(s\)/,
    'renderSpark must set the compose CTA from sparkComposeLabel');
});

test('compose toast for hOMe Sparks leads with shaping hOMe, FO secondary', () => {
  const fn = slice('function composeInFieldNotes(', 1200);
  // Toast branches on whether the Spark shapes a hOMe project, and its
  // copy is composed from the MUSE_PROJECTS helpers rather than inline
  // literals (PR #137 refactor).
  assert.match(fn, /sparkIsHome\(currentSpark\)/,
    'toast branches on the hOMe project target');
  assert.match(fn, /'Shaping your ' \+ sparkProjectLabel\(currentSpark\)/,
    'hOMe toast leads with shaping the project (hOMe)');
  assert.match(fn, /sparkProjectSecondary\(currentSpark\)/,
    'hOMe toast keeps the project secondary (Field Observations) copy');
  // The secondary copy itself still names Field Observations.
  const project = slice('var MUSE_PROJECTS = {', 900);
  assert.match(project, /also rests in Field Observations/i,
    'Field Observations survives as a subtle secondary in the project entry');
});

// ── 3) Capture still routes to state.builder.captures[target] ──────────
test('captureFromSave still writes to state.builder.captures[target]', () => {
  const fn = slice('function captureFromSave(', 1400);
  assert.match(fn, /b\.captures\[target\.fieldId\]/,
    'saved Spark answers still update state.builder.captures[target]');
});

// ── 4) Threshold capture -> hero heading bug fix ───────────────────────
test('threshold capture feeds the hero heading, not the intro', () => {
  const fn = slice('function buildWebsitePreview(', 1600);
  // The old bug blanked the capture out of the heading with `capThreshold && ''`.
  assert.doesNotMatch(fn, /capThreshold && ''/,
    'the capThreshold-blanking bug must be gone');
  // Heading now prefers the threshold capture first.
  assert.match(fn, /heroHeading = lpFirst\(\s*capThreshold,/,
    'hero heading prefers the captured threshold text');
  // Intro now reads the dedicated home-threshold-intro capture.
  assert.match(fn, /capThresholdIntro = lpCaptureText\('home-threshold-intro'\)/,
    'hero intro reads the home-threshold-intro capture');
  assert.match(fn, /intro:\s*capThresholdIntro \|\|/,
    'hero intro prefers the home-threshold-intro capture');
});
