// Focused tests for the unified Studio Project identity/read path for hOMe.
//
// Spark is the reusable creative Muse of stUdio; hOMe is the first
// reference project. This slice gives hOMe one shared project identity
// read by both the Muse layer and the existing Personal Home preview:
// a project header (label + readiness + draft status) above the
// seeded-field band / four-room threshold, and an openStudioProject
// read path that routes 'home' into the *existing* preview — never a
// second work surface.
//
// studio.html is a single ~1MB app with canvas / LLM / DOM deps and no
// bundler, so (as with muse-projects.test.mjs) we:
//   1. extract the real MUSE_PROJECTS block verbatim (between sentinel
//      comments) and exercise the new pure helpers against the shipped
//      source; and
//   2. statically assert the render/open wiring holds.
//
// Run: node tests/studio-project-identity-home.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioPath = join(__dirname, '..', 'studio.html');
const html = readFileSync(studioPath, 'utf8');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// ── Extract the MUSE abstraction verbatim and load it ──────────────
const START = '// <MUSE_PROJECTS_START>';
const END = '// <MUSE_PROJECTS_END>';
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END);
assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
  'MUSE_PROJECTS sentinel block must exist in studio.html');
const bodyStart = html.indexOf('\n', startIdx) + 1;
const museSrc = html.slice(bodyStart, endIdx);

const loadMuse = new Function(
  museSrc +
  '\nreturn { MUSE_PROJECTS, museProjectByKey, studioProjectLabel,' +
  ' studioProjectHeaderModel };'
);
const M = loadMuse();

console.log('Studio project identity (hOMe) unit tests');

// The project is resolvable by its stable namespace key, decoupled from
// the raw builder key.
test('museProjectByKey resolves hOMe by its project namespace, not builder', () => {
  const p = M.museProjectByKey('home');
  assert.ok(p, 'home must resolve to a project');
  assert.equal(p.project, 'home');
  assert.equal(p.builder, 'website');
  // Resolving by the raw builder key must NOT work — the key is 'home'.
  assert.equal(M.museProjectByKey('website'), null);
});

// Label comes from MUSE_PROJECTS metadata, never the raw builder string.
test('studioProjectLabel reads the hOMe label from MUSE_PROJECTS metadata', () => {
  assert.equal(M.studioProjectLabel('home'), M.MUSE_PROJECTS.website.label);
  assert.equal(M.studioProjectLabel('home'), 'hOMe');
  // Must not surface the internal builder key as a user-facing label.
  assert.notEqual(M.studioProjectLabel('home'), 'website');
});

// Fail-safe on unknown / missing project keys.
test('project helpers fail safe on unknown keys', () => {
  for (const k of [null, undefined, '', 'nope', 'profile']) {
    assert.equal(M.museProjectByKey(k), null);
    assert.equal(M.studioProjectLabel(k), '');
    assert.equal(M.studioProjectHeaderModel(k, null), null);
  }
});

// The header model uses MUSE_PROJECTS/home metadata and marks draft state.
test('studioProjectHeaderModel uses hOMe metadata + draft/preview status', () => {
  const h = M.studioProjectHeaderModel('home', null);
  assert.equal(h.project, 'home');
  assert.equal(h.label, M.MUSE_PROJECTS.website.label); // metadata, not literal
  assert.notEqual(h.label, 'website');                  // never the builder key
  // Draft / preview status must be explicit (not published).
  assert.match(h.status, /draft/i);
  assert.match(h.status, /not published/i);
  // Muse / Spark authorship + "first project" framing must be present.
  assert.match(h.eyebrow + ' ' + h.note, /Spark/);
  assert.match(h.note, /Muse/);
  assert.match(h.note, /first stUdio project/i);
});

// Readiness/seed state flows in from phSeedReadiness-shaped input.
test('studioProjectHeaderModel reflects phSeedReadiness seed state', () => {
  const seeded = M.studioProjectHeaderModel('home',
    { drafted: 3, total: 4, awaiting: 1, stage: 'seeded' });
  assert.equal(seeded.stage, 'seeded');
  assert.match(seeded.readinessLabel, /3 \/ 4 rooms drafted/);

  const full = M.studioProjectHeaderModel('home',
    { drafted: 4, total: 4, awaiting: 0, stage: 'fully-seeded' });
  assert.equal(full.stage, 'fully-seeded');
  assert.match(full.readinessLabel, /4 \/ 4 rooms drafted/);

  // Null seed → awaiting-seed default, no fabricated counts.
  const empty = M.studioProjectHeaderModel('home', null);
  assert.equal(empty.stage, 'awaiting-seed');
  assert.match(empty.readinessLabel, /Awaiting/i);
});

console.log('\nStatic wiring assertions');

// The renderer wraps the pure model + real readiness, and never hardcodes
// the label — it flows through the metadata-driven model.
test('renderStudioProjectHeader wraps studioProjectHeaderModel + phSeedReadiness', () => {
  assert.match(html, /function renderStudioProjectHeader\(projectKey, model\) \{/);
  assert.match(html, /seed = phSeedReadiness\(model\)/);
  assert.match(html, /studioProjectHeaderModel\(projectKey, seed\)/);
  // The label is rendered from the model (h.label), not a literal 'hOMe'.
  assert.match(html, /studio-project-name">' \+ lpEscape\(h\.label\)/);
});

// The preview renders the project header above the rooms nav + threshold —
// one identity around the existing preview, not a new surface.
test('renderWebsitePreview renders the project header above the existing preview', () => {
  assert.match(html, /renderStudioProjectHeader\('home', model\)/);
  const headerCall = html.indexOf("renderStudioProjectHeader('home', model)");
  const navBuild = html.indexOf('ph-rooms-nav is-v3');
  assert.ok(headerCall !== -1 && navBuild !== -1 && headerCall < navBuild,
    'project header must be emitted before the rooms nav');
});

// openStudioProject is a READ path into an existing surface — no new modal.
// The primary home surface is now the Fieldprint v5 field experience, with the
// old Workbench + website preview kept as internal fallbacks.
test('openStudioProject routes home to an existing surface, no second surface', () => {
  const fnIdx = html.indexOf('function openStudioProject(projectKey)');
  assert.ok(fnIdx !== -1, 'openStudioProject must exist');
  const fnBody = html.slice(fnIdx, fnIdx + 1300);
  assert.match(fnBody, /museProjectByKey\(projectKey\)/);
  // Primary route is the Fieldprint v5 surface; preview remains a fallback.
  assert.match(fnBody, /openFieldprintV5\(\)/);
  assert.match(fnBody, /openWebsitePreview\(\)/);
  // Must not spin up a separate surface inline (new modal / element).
  assert.doesNotMatch(fnBody, /createElement/);
  assert.doesNotMatch(fnBody, /new .*Modal/);
});

// The project layer is exposed on window.CommonUnity.builder (PR #136 pattern).
test('project helpers are exposed on window.CommonUnity.builder', () => {
  assert.match(html, /openStudioProject:\s*openStudioProject/);
  assert.match(html, /renderStudioProjectHeader:\s*renderStudioProjectHeader/);
  assert.match(html, /studioProjectHeaderModel:\s*studioProjectHeaderModel/);
  assert.match(html, /museProjectByKey:\s*museProjectByKey/);
  assert.match(html, /window\.openStudioProject = openStudioProject/);
});

console.log('\n' + passed + ' checks passed.');
