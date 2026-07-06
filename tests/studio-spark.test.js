'use strict';

// Focused static tests for the Studio Spark card (studio.html).
//
// studio.html is a single-file app with no build/test harness, so these
// tests assert directly over the rendered markup, CSS, and the renderSpark
// source. They guard the two regressions fixed alongside them:
//   1. Spark pills must wrap inside the card, never overflow the panel.
//   2. The primary pills must show user-facing copy, not internal routing
//      metadata ("Movement ·", "Arc ·", "For · Personal Home · …").
//
// Run with:  node --test tests/

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'studio.html'),
  'utf8'
);

// Pull a CSS rule body out of the stylesheet by selector.
function cssBlock(selector) {
  const idx = html.indexOf(selector + ' {');
  assert.ok(idx !== -1, `expected CSS selector "${selector}" to exist`);
  const start = html.indexOf('{', idx);
  const end = html.indexOf('}', start);
  return html.slice(start + 1, end);
}

// Isolate the renderSpark function source so assertions target the
// primary-pill render path, not unrelated matches elsewhere in the file.
function renderSparkSource() {
  const start = html.indexOf('function renderSpark(');
  assert.ok(start !== -1, 'expected renderSpark to exist');
  // Grab a generous window; renderSpark is short.
  return html.slice(start, start + 1200);
}

test('spark-tag pills wrap and never use nowrap (overflow fix)', () => {
  const block = cssBlock('.spark-tag');
  assert.doesNotMatch(
    block,
    /white-space:\s*nowrap/,
    '.spark-tag must not force nowrap — that caused pill overflow'
  );
  assert.match(block, /overflow-wrap:\s*anywhere/);
  assert.match(block, /max-width:\s*100%/);
});

test('spark-meta row wraps its pills', () => {
  const block = cssBlock('.spark-meta');
  assert.match(block, /flex-wrap:\s*wrap/);
});

test('primary pills default to user-facing labels, not internal ones', () => {
  const metaStart = html.indexOf('id="spark-meta"');
  const metaEnd = html.indexOf('</div>', metaStart);
  const meta = html.slice(metaStart, metaEnd);
  assert.match(meta, /Focus · —/);
  assert.match(meta, /Tending · —/);
  assert.match(meta, /Tends · —/);
  assert.doesNotMatch(meta, /Movement · —/);
  assert.doesNotMatch(meta, /Arc · —/);
  assert.doesNotMatch(meta, /For · —/);
});

test('renderSpark sets user-facing pill copy', () => {
  const src = renderSparkSource();
  assert.match(src, /movementEl\.textContent\s*=\s*'Focus · '/);
  assert.match(src, /arcEl\.textContent\s*=\s*'Tending · ' \+ humanArc/);
  assert.match(src, /targetEl\.textContent\s*=\s*'Tends · ' \+ sparkTargetCue/);
});

test('renderSpark no longer emits internal-control labels in primary pills', () => {
  const src = renderSparkSource();
  assert.doesNotMatch(src, /'Movement · '/);
  assert.doesNotMatch(src, /'Arc · '/);
  // The long "For · " + builderFieldLabel pill was the overflowing one.
  assert.doesNotMatch(src, /'For · ' \+ builderFieldLabel/);
});

test('humanArc spells out the raw arrow glyph', () => {
  assert.match(
    html,
    /function humanArc\(arc\)\s*\{[^}]*replace\(\/\\s\*→\\s\*\/g,\s*' to '\)/,
    'humanArc must convert "Shadow → Gift" to "Shadow to Gift"'
  );
});

test('internal routing lives behind progressive disclosure', () => {
  assert.match(html, /<details class="spark-routing" id="spark-routing" hidden>/);
  assert.match(html, /<summary class="spark-routing-summary">Spark details<\/summary>/);
  // The full internal routing string (builder track + section + target id)
  // is written into the collapsed details body, not a primary pill.
  const src = renderSparkSource();
  assert.match(
    src,
    /routingBodyEl\.textContent\s*=\s*builderFieldLabel\(s\)[^;]*s\.target/
  );
});
