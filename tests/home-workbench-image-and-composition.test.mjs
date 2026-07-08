// Source-contract tests for two hOMe Workbench wiring guarantees that the
// pure-function tests can't cover (they live in DOM-wiring code, not in a
// sentinel-extractable pure block):
//
//   1. The Front door "Profile photo" tile is a LIVE inline editor, not a dead
//      "coming next" button. It renders the shared upload / replace / remove /
//      reposition controls (the same helpers the Living Profile hero uses) with
//      the 'ph' prefix, and wires them.
//   2. The Workbench exposes a composition mode bar (a small curated set of
//      whole-page compositions) that persists to state.homeComposition and
//      repaints the live preview.
//
// These are string-shape assertions over studio.html — cheap regression
// guards against the button silently reverting to inert.
//
// Run: node tests/home-workbench-image-and-composition.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'studio.html'), 'utf8');

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log('  ok - ' + name); }

console.log('hOMe Workbench image editor + composition controls');

// ── (1) Front door photo editor is live ─────────────────────────────

test('Front door photo tile renders a real file input with the ph- prefix', () => {
  assert.match(html, /id="ph-profile-image-input"/);
});

test('Front door photo tile offers replace + remove + adjust controls', () => {
  assert.match(html, /id="ph-profile-image-remove"/);
  assert.match(html, /id="ph-profile-image-adjust"/);
});

test('Front door wires the shared image controls (upload/remove + fit)', () => {
  assert.match(html, /wireProfileImageControls\('ph-profile-image-input',\s*'ph-profile-image-remove'\)/);
  assert.match(html, /wireProfileImageFitControls\('ph'\)/);
});

test('the dead "coming next" photo route hint is gone', () => {
  assert.doesNotMatch(html, /Uploading a new profile photo from the Front door is coming next/);
});

test('image edits repaint the Workbench via refreshIdentityMediaSurfaces', () => {
  // refreshIdentityMediaSurfaces must now also refresh the open Workbench so an
  // upload/replace/remove shows immediately in the Front door + live preview.
  const idx = html.indexOf('function refreshIdentityMediaSurfaces');
  assert.ok(idx !== -1, 'refreshIdentityMediaSurfaces must exist');
  const body = html.slice(idx, idx + 1200);
  assert.match(body, /home-workbench/);
  assert.match(body, /phWorkbenchRefreshAll/);
});

// ── (2) Composition controls ────────────────────────────────────────

test('the Workbench shell hosts a composition control group', () => {
  assert.match(html, /id="home-workbench-composition"/);
  assert.match(html, /role="group"/);
});

test('composition controls are keyboard-accessible buttons with aria-pressed', () => {
  const idx = html.indexOf('function phWorkbenchRenderComposition');
  assert.ok(idx !== -1, 'phWorkbenchRenderComposition must exist');
  const body = html.slice(idx, idx + 1400);
  assert.match(body, /<button type="button"/);
  assert.match(body, /aria-pressed="/);
  assert.match(body, /data-hw-composition="/);
});

test('the curated composition modes are offered', () => {
  assert.match(html, /'editorial-about'/);
  assert.match(html, /'cinematic-profile'/);
  assert.match(html, /'purpose-advisory'/);
});

test('choosing a mode persists to state.homeComposition and repaints preview', () => {
  const idx = html.indexOf('function phWorkbenchSetComposition');
  assert.ok(idx !== -1, 'phWorkbenchSetComposition must exist');
  const body = html.slice(idx, idx + 900);
  assert.match(body, /state\.homeComposition\s*=/);
  assert.match(body, /saveState/);
  assert.match(body, /phWorkbenchRefreshPreview/);
});

test('buildWebsitePreview plumbs the chosen composition into the model', () => {
  assert.match(html, /composition:\s*\(window\.state && window\.state\.homeComposition\)/);
});

test('composition is part of the default persisted state (migration-safe)', () => {
  assert.match(html, /homeComposition:\s*null/);
});

console.log('\n' + passed + ' checks passed.');
