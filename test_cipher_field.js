/* Cipher Field overlay — unit tests for the pure, DOM-free generator.
   Run: node --test test_cipher_field.js   (Node 20+, no dependencies) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const CF = require('./fieldprint-cipher-field.js');

const FIELD_A = { roles: { root: 'oklch(0.55 0.1 260)', expression: 'oklch(0.6 0.1 80)', radiance: 'oklch(0.55 0.1 318)' }, hue: 80, seed: 'om-field|1234' };
const FIELD_B = { roles: { root: 'oklch(0.5 0.1 20)', expression: 'oklch(0.6 0.1 140)', radiance: 'oklch(0.55 0.1 300)' }, hue: 210, seed: 'om-field|5678' };

test('overlay generation is deterministic for the same field', () => {
  assert.strictEqual(CF.buildOverlaySvg(FIELD_A), CF.buildOverlaySvg(FIELD_A));
  assert.strictEqual(CF.buildOverlaySvg(FIELD_B), CF.buildOverlaySvg(FIELD_B));
});

test('different fields produce different overlays', () => {
  assert.notStrictEqual(CF.buildOverlaySvg(FIELD_A), CF.buildOverlaySvg(FIELD_B));
});

test('overlay is well-formed, face-safe SVG', () => {
  const svg = CF.buildOverlaySvg(FIELD_A);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, /mask="url\(#cf-mask\)"/, 'face-safe mask must wrap the geometry');
  assert.match(svg, /preserveAspectRatio="xMidYMid slice"/, 'must cover without distortion');
});

test('overlay leaks no sensitive source material', () => {
  const svg = CF.buildOverlaySvg(FIELD_A).toLowerCase();
  // No free text, no gate/axis data attributes, no birth/gene-key vocabulary.
  assert.doesNotMatch(svg, /<text/);
  assert.doesNotMatch(svg, /data-gate|data-axis|data-radiance-gate/);
  assert.doesNotMatch(svg, /gate|gene|birth|line-?\d|hexagram|activation/);
});

test('a hostile colour token cannot be injected into markup', () => {
  const svg = CF.buildOverlaySvg({ roles: { root: '"><script>alert(1)</script>', expression: 'red', radiance: 'blue' }, hue: 80, seed: 's' });
  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /alert\(1\)/);
});

test('missing / partial field falls back safely and stays deterministic', () => {
  assert.strictEqual(CF.buildOverlaySvg(), CF.buildOverlaySvg());
  assert.strictEqual(CF.buildOverlaySvg({}), CF.buildOverlaySvg({}));
  assert.match(CF.buildOverlaySvg({}), /^<svg /);
});

test('opacity curve is restrained and monotonic', () => {
  assert.strictEqual(CF.overlayOpacity(0), 0.1);
  assert.strictEqual(CF.overlayOpacity(1), 0.5);
  assert.ok(CF.overlayOpacity(0.5) > CF.overlayOpacity(0));
  assert.ok(CF.overlayOpacity(1) < 1, 'never a heavy filter over a face');
  // clamps out-of-range input
  assert.strictEqual(CF.overlayOpacity(5), 0.5);
  assert.strictEqual(CF.overlayOpacity(-5), 0.1);
});

test('default recipe is off (backward-compatible default)', () => {
  const d = CF.defaultRecipe();
  assert.strictEqual(d.treatment, 'off');
  assert.strictEqual(d.version, CF.VERSION);
  assert.strictEqual(CF.isOn(d), false);
});

test('recipe normalizes and round-trips without loss', () => {
  const on = { treatment: 'cipher-field', version: 1, intensity: 0.72, palette: 'om-dawn' };
  const n = CF.normalizeRecipe(on);
  assert.deepStrictEqual(n, on);
  assert.strictEqual(CF.isOn(n), true);
});

test('absent recipe (pre-overlay draft) normalizes to off', () => {
  assert.strictEqual(CF.normalizeRecipe(undefined).treatment, 'off');
  assert.strictEqual(CF.normalizeRecipe(null).treatment, 'off');
  assert.strictEqual(CF.normalizeRecipe({}).treatment, 'off');
});

test('unknown future treatment collapses to off (no unrenderable overlay)', () => {
  const n = CF.normalizeRecipe({ treatment: 'digital-vista-3d', intensity: 0.9 });
  assert.strictEqual(n.treatment, 'off');
  assert.strictEqual(n.intensity, 0.9, 'other recipe fields are preserved for a future workflow');
});

test('recipe intensity is clamped to 0..1', () => {
  assert.strictEqual(CF.normalizeRecipe({ treatment: 'cipher-field', intensity: 9 }).intensity, 1);
  assert.strictEqual(CF.normalizeRecipe({ treatment: 'cipher-field', intensity: -9 }).intensity, 0);
});
