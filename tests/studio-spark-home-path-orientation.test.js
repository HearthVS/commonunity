'use strict';

// Focused static tests for the Spark → hOMe path-orientation slice.
//
// A new user reported that "Shape this hOMe" meant nothing and that the
// panel never showed where they were on a path toward a real hOMe page,
// why to keep answering Sparks, or how Spark / Field Observations / Nexus
// / hOMe relate. This slice adds explicit outcome CTAs, a compact path
// cue, plain-language relationship microcopy in the guidance overlay, and
// a direct link to the hOMe draft — without re-densifying the panel.
//
// studio.html is a single-file app with no build step, so we assert over
// the rendered markup and the relevant JS source (same style as
// tests/studio-spark-muse-home.test.js).
//
// Run with:  node --test tests/studio-spark-home-path-orientation.test.js

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

// ── 1) Explicit outcome CTA, no vague "Shape this hOMe" ────────────────
test('the vague "Shape this hOMe" copy is gone from the app', () => {
  assert.doesNotMatch(html, /Shape this hOMe/,
    '"Shape this hOMe" must not appear anywhere in studio.html');
  assert.doesNotMatch(html, /Tune this hOMe/,
    'the paired "Tune this hOMe" vague copy is also gone');
});

test('hOMe CTA copy states the outcome (adds/updates the hOMe draft)', () => {
  const project = slice('var MUSE_PROJECTS = {', 1500);
  assert.match(project, /Add answer to hOMe draft/,
    'default hOMe Spark CTA states it adds the answer to the hOMe draft');
  assert.match(project, /Update your hOMe draft/,
    'a Spark tending an already-shaped room updates the hOMe draft');
});

// ── 2) Compact path/progress cue in the panel ──────────────────────────
test('the panel carries a compact hOMe path cue element', () => {
  // The cue element exists and is hidden by default (self-directed Sparks).
  const content = slice('<div class="om-widget-content">', 1000);
  assert.match(content, /id="spark-path-cue"/,
    'a dedicated compact path cue element sits in the Spark panel');
  assert.match(content, /class="spark-path-cue"[^>]*hidden/,
    'the path cue is hidden by default until a project Spark is drawn');
});

test('the path cue text answers "where am I / why keep going"', () => {
  const project = slice('var MUSE_PROJECTS = {', 1500);
  assert.match(project, /path:\s*'hOMe path: Answer Sparks → Review draft → Publish'/,
    'the hOMe project supplies a concise Answer → Review → Publish path');
});

test('renderSpark shows the path cue only for project (hOMe) Sparks', () => {
  const render = slice('function renderSpark(', 2600);
  assert.match(render, /sparkProjectPath\(s\)/,
    'renderSpark reads the compact path cue from the Spark project');
  assert.match(render, /pathCueEl\.hidden = !pathText/,
    'the cue is hidden when the Spark has no project path (self-directed)');
});

// ── 3) Relationship microcopy in the guidance overlay ──────────────────
test('the info overlay explains how Spark / Field / Nexus / hOMe relate', () => {
  const overlay = slice('id="info-spark-muse-overlay"', 2400);
  assert.match(overlay, /class="spark-relate"/,
    'the guidance overlay carries the relationship map list');
  // Each of the four pieces is named in plain language.
  assert.match(overlay, /<strong>Spark<\/strong> prompts gather/i,
    'Spark prompts gather creative answers');
  assert.match(overlay, /<strong>hOMe draft<\/strong>/i,
    'answers are added to the hOMe draft');
  assert.match(overlay, /<strong>Field Observations<\/strong>[^<]*source material/i,
    'Field Observations keeps source material');
  assert.match(overlay, /<strong>Nexus<\/strong> can deepen/i,
    'Nexus can deepen and return worked insight');
  // The path is spelled out once more in the overlay for orientation.
  assert.match(overlay, /Answer Sparks → Review your hOMe draft → Publish/,
    'the overlay names the full path so a new user sees the whole arc');
});

test('the relationship copy stays in the overlay, not the primary panel', () => {
  // Reduced-density state preserved: the long relationship copy must not
  // live in the always-visible threshold block.
  const threshold = slice('<div class="spark-threshold">', 1400);
  assert.doesNotMatch(threshold, /prompts gather your creative answers/i,
    'the relationship paragraph must not re-densify the primary panel');
});

// ── 4) Honest routing copy (both hOMe draft AND Field Observations) ────
test('secondary/toast copy is honest that the answer is kept in FO too', () => {
  const project = slice('var MUSE_PROJECTS = {', 1500);
  assert.match(project, /source material in Field Observations/i,
    'the secondary states the answer is kept as source material in FO');
  const fn = slice('function composeInFieldNotes(', 1200);
  assert.match(fn, /added to your ' \+ sparkProjectLabel\(currentSpark\) \+ ' draft/,
    'the toast states the answer is added to the hOMe draft');
});

// ── 5) Direct route to the hOMe draft from the same panel ──────────────
test('the panel offers a clearer, direct link to the hOMe draft', () => {
  const foot = slice('<p class="om-widget-foot">', 700);
  assert.match(foot, /id="builder-home-open"/,
    'a dedicated hOMe draft link button sits in the panel foot');
  assert.match(foot, />View hOMe draft</,
    'the link label names the destination (the hOMe draft)');
  // The existing Studio Path route is preserved alongside it.
  assert.match(foot, /Open Studio Path/,
    'the existing Studio Path route is preserved');
});

test('the hOMe draft link routes through openStudioProject(\'home\')', () => {
  // The click handler prefers the project-open path, falling back to the
  // Studio Path modal if the preview is unavailable.
  assert.match(html, /window\.openStudioProject\('home'\)/,
    'the hOMe link opens the project via openStudioProject(\'home\')');
});
