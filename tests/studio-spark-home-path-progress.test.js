'use strict';

// Focused tests for the Spark → hOMe path *progress* slice.
//
// PR #142 gave the hOMe Spark panel an explicit CTA and a compact path cue
// ("hOMe path: Answer Sparks → Review draft → Publish"). A new user still
// felt the panel was a loop rather than movement, because the cue never
// showed how far the draft had actually come. This slice appends concrete,
// model-derived progress ("2 of 4 rooms drafted") to the cue for hOMe
// Sparks only, reusing the existing seeded-field coverage rule
// (phSeedReadiness: a room is drafted when its section source !== 'empty').
//
// studio.html is a single-file app with no build step, so we (1) extract
// the real progress helpers and exercise them against a mocked preview
// model, and (2) statically assert the renderSpark wiring so the cue stays
// hOMe-only and preserves the plain path text.
//
// Run with:  node --test tests/studio-spark-home-path-progress.test.js

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

// Extract a named function body verbatim from the source, from its
// declaration to the matching closing brace, so the tests run against the
// shipped implementation rather than a copy.
function extractFn(name) {
  const marker = 'function ' + name + '(';
  const start = html.indexOf(marker);
  assert.ok(start !== -1, `expected to find function ${name}`);
  let depth = 0;
  let i = html.indexOf('{', start);
  const bodyStart = i;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth += 1;
    else if (html[i] === '}') {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  return html.slice(start, i);
}

// Load the real progress helpers with a controllable window mock.
function loadProgress(model) {
  const src = extractFn('phDraftProgress') + '\n' + extractFn('phProgressLabel');
  const factory = new Function(
    'window',
    src + '\nreturn { phDraftProgress: phDraftProgress, phProgressLabel: phProgressLabel };'
  );
  const win = { buildPersonalHomePreview: model === undefined ? undefined : () => model };
  return factory(win);
}

// A model with `drafted` of the four rooms having non-empty source.
function modelWithDrafted(drafted) {
  const rooms = ['work', 'lens', 'field', 'call'];
  const sections = {};
  rooms.forEach((k, idx) => {
    sections[k] = { source: idx < drafted ? (idx % 2 ? 'mixed' : 'captured') : 'empty' };
  });
  return { sections: sections };
}

// ── 1) Progress derives from the existing model / coverage rule ────────
test('phDraftProgress counts the four rooms with non-empty source', () => {
  const P = loadProgress(modelWithDrafted(2));
  assert.deepEqual(P.phDraftProgress(), { drafted: 2, total: 4 });
  assert.deepEqual(loadProgress(modelWithDrafted(0)).phDraftProgress(), { drafted: 0, total: 4 });
  assert.deepEqual(loadProgress(modelWithDrafted(4)).phDraftProgress(), { drafted: 4, total: 4 });
});

test('phDraftProgress uses the same rooms and coverage rule as phSeedReadiness', () => {
  // The seeded-field readiness model counts a room as drafted when its
  // section source is anything other than 'empty'. Progress must agree.
  assert.match(html, /var PH_SEED_ROOMS = \['work', 'lens', 'field', 'call'\];/);
  const fn = extractFn('phDraftProgress');
  assert.match(fn, /\['work', 'lens', 'field', 'call'\]/,
    'progress reads the same four rooms as the seeded-field model');
  assert.match(fn, /source !== 'empty'/,
    'a room counts as drafted when its source is not empty (captured/mixed/compass)');
  assert.match(fn, /window\.buildPersonalHomePreview/,
    'progress derives from the exposed preview model, not a new store');
});

// ── 2) Concrete, motivating copy ───────────────────────────────────────
test('phProgressLabel renders concise "N of 4 rooms drafted"', () => {
  assert.equal(loadProgress(modelWithDrafted(2)).phProgressLabel(), '2 of 4 rooms drafted');
  assert.equal(loadProgress(modelWithDrafted(4)).phProgressLabel(), '4 of 4 rooms drafted');
});

test('phProgressLabel gives a motivating, non-confusing zero state', () => {
  const label = loadProgress(modelWithDrafted(0)).phProgressLabel();
  assert.match(label, /0 of 4 rooms drafted/);
  assert.match(label, /start with one room/i);
});

test('phProgressLabel is empty when the preview model is unavailable', () => {
  // No progress suffix when the model cannot be read — the cue then falls
  // back to the plain path text (fail-safe, never throws).
  assert.equal(loadProgress(undefined).phProgressLabel(), '');
  assert.equal(loadProgress(null).phProgressLabel(), '');
  assert.equal(loadProgress({}).phProgressLabel(), '');
});

// ── 3) renderSpark appends progress to the hOMe path cue only ──────────
test('renderSpark appends progress to the cue only when there is a project path', () => {
  const render = slice('function renderSpark(', 2600);
  // Base cue text still comes from the pure project path helper.
  assert.match(render, /var pathText = sparkProjectPath\(s\)/,
    'the base path cue is still the project path (plain-only path preserved)');
  // Progress is only appended when a project path exists — self-directed
  // Sparks return '' and therefore get no progress and stay hidden.
  assert.match(render, /if \(pathText\) \{[\s\S]*?phProgressLabel\(\)/,
    'progress is appended only when the Spark has a project path');
  assert.match(render, /pathText \+= ' · ' \+ progress/,
    'progress is joined onto the path with a middot separator');
  assert.match(render, /pathCueEl\.hidden = !pathText/,
    'the cue stays hidden for self-directed (non-hOMe) Sparks');
});

// ── 4) Reduced-density panel + existing orientation preserved ──────────
test('the plain hOMe path text is still present as the base cue', () => {
  const project = slice('var MUSE_PROJECTS = {', 1500);
  assert.match(project, /path:\s*'hOMe path: Answer Sparks → Review draft → Publish'/,
    'the concise Answer → Review → Publish path is unchanged');
});

test('the explicit hOMe draft link and CTAs from PR #142 are preserved', () => {
  assert.match(html, />View hOMe draft</, 'the direct hOMe draft link is kept');
  assert.match(html, /Add answer to hOMe draft/, 'the explicit add CTA is kept');
  assert.match(html, /Update your hOMe draft/, 'the explicit update CTA is kept');
});
