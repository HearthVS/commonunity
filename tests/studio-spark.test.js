'use strict';

// Focused static tests for the Studio Spark card (studio.html).
//
// studio.html is a single-file app with no build/test harness, so these
// tests assert directly over the rendered markup, CSS, and the renderSpark
// source. They guard this product slice:
//   1. Spark pills must wrap inside the card, never overflow the panel.
//   2. The primary card leads with ONE creator-friendly cue ("For your
//      hOMe · …"), not the abstract taxonomy pills (Focus/Tending/Tends)
//      or internal routing metadata ("Movement ·", "Arc ·", "For · …").
//   3. The movement/arc taxonomy survives only inside the collapsed
//      "Spark details", never as a primary pill.
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

test('primary card drops the abstract taxonomy pills for one creator cue', () => {
  const metaStart = html.indexOf('id="spark-meta"');
  const metaEnd = html.indexOf('</div>', metaStart);
  const meta = html.slice(metaStart, metaEnd);
  // The old abstract taxonomy pills are gone from the primary card.
  assert.doesNotMatch(meta, /Focus · —/);
  assert.doesNotMatch(meta, /Tending · —/);
  assert.doesNotMatch(meta, /Tends · —/);
  assert.doesNotMatch(meta, /Movement · —/);
  assert.doesNotMatch(meta, /Arc · —/);
  assert.doesNotMatch(meta, /For · —/);
  // A single, creator-friendly, project-native cue leads instead.
  assert.match(meta, /For your hOMe · —/);
  // Only one primary pill remains.
  assert.strictEqual((meta.match(/spark-tag/g) || []).length, 1);
});

test('renderSpark leads with the creator-friendly project cue', () => {
  const src = renderSparkSource();
  assert.match(src, /targetEl\.textContent\s*=\s*sparkPrimaryCue\(s\)/,
    'the primary pill copy comes from sparkPrimaryCue');
  // The Awaiting readiness suffix from PR #121 is preserved.
  assert.match(src, /awaitingHere \? ' · Awaiting' : ''/);
});

test('renderSpark no longer emits the abstract taxonomy pill labels', () => {
  const src = renderSparkSource();
  assert.doesNotMatch(src, /'Focus · '/);
  assert.doesNotMatch(src, /'Tending · '/);
  assert.doesNotMatch(src, /'Tends · '/);
  assert.doesNotMatch(src, /'Movement · '/);
  assert.doesNotMatch(src, /'Arc · '/);
  // The long "For · " + builderFieldLabel pill was the overflowing one.
  assert.doesNotMatch(src, /'For · ' \+ builderFieldLabel/);
});

test('sparkPrimaryCue is project-native and avoids the abstract labels', () => {
  const start = html.indexOf('function sparkPrimaryCue(');
  assert.ok(start !== -1, 'expected sparkPrimaryCue to exist');
  const fn = html.slice(start, start + 400);
  // hOMe/website Sparks read as "For your hOMe · …" via sparkProjectLabel.
  assert.match(fn, /sparkProjectLabel\(spark\)/);
  assert.match(fn, /'For your '/);
  // Self-directed Sparks (Living Profile / OS) fall back to "Shapes · …".
  assert.match(fn, /'Shapes · '/);
  // None of the retired taxonomy labels reappear here.
  assert.doesNotMatch(fn, /Focus|Tending|Tends/);
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
  // The movement/arc taxonomy now survives only here, behind disclosure.
  assert.match(src, /routingBodyEl\.textContent[^;]*s\.movement/);
  assert.match(src, /routingBodyEl\.textContent[^;]*humanArc\(s\.arc\)/);
});
