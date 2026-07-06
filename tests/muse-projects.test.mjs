// Focused tests for the Muse project abstraction (Spark as the reusable
// creative Muse of stUdio; hOMe as the first reference project).
//
// studio.html is a single ~1MB app with canvas / LLM / DOM dependencies
// and no bundler or test harness, so we do not boot the whole page in
// jsdom here (see the README note printed at the end for why full
// browser QA is deferred). Instead we:
//   1. extract the real MUSE_PROJECTS block + helpers verbatim from
//      studio.html (between sentinel comments) and exercise them, so the
//      unit tests run against the shipped source, not a copy; and
//   2. statically assert the surrounding wiring (CTA de-hardcoding,
//      threshold heading/intro flow from PR #135, spark library) still
//      holds.
//
// Run: node tests/muse-projects.test.mjs

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
// Start from the newline after the START marker line (the marker line may
// carry a trailing comment), and stop before the END marker.
const bodyStart = html.indexOf('\n', startIdx) + 1;
const museSrc = html.slice(bodyStart, endIdx);

const loadMuse = new Function(
  museSrc +
  '\nreturn { MUSE_PROJECTS, sparkProject, sparkProjectKey, sparkIsHome,' +
  ' sparkProjectLabel, sparkProjectActionLabel, sparkProjectSecondary };'
);
const M = loadMuse();

// Fixtures mirroring real SPARK_LIBRARY entries.
const homeThresholdSpark = { builder: 'website', section: 'work', target: 'threshold' };
const homeFieldSpark     = { builder: 'website', section: 'field', target: 'visual-tone' };
const profileSpark       = { builder: 'profile', section: 'lens', target: 'essence-line' };
const osSpark            = { builder: 'os', section: 'call', target: 'project-active' };

console.log('MUSE project helper unit tests');

// hOMe/website Sparks are recognized as hOMe project Muse prompts.
test('website Sparks map to the hOMe project namespace', () => {
  assert.equal(M.sparkProjectKey(homeThresholdSpark), 'home');
  assert.equal(M.sparkIsHome(homeThresholdSpark), true);
  assert.equal(M.sparkProjectLabel(homeThresholdSpark), 'hOMe');
});

// Primary CTA is builder/project-native, not Field Observations.
test('primary CTA is project-native (Shape / Tune this hOMe)', () => {
  assert.equal(M.sparkProjectActionLabel(homeThresholdSpark), 'Shape this hOMe');
  assert.equal(M.sparkProjectActionLabel(homeFieldSpark), 'Tune this hOMe');
  // The project action must never route the primary path to Field Observations.
  assert.doesNotMatch(M.sparkProjectActionLabel(homeThresholdSpark), /Field Observation/i);
});

// Field Observations remains a subtle secondary, not the headline.
test('secondary copy keeps Field Observations as a footnote', () => {
  assert.match(M.sparkProjectSecondary(homeThresholdSpark), /Field Observations/);
  assert.equal(M.sparkProjectSecondary(profileSpark), '');
});

// Profile / OS Sparks keep non-hOMe behavior.
test('profile and OS Sparks are self-directed (non-hOMe)', () => {
  for (const s of [profileSpark, osSpark]) {
    assert.equal(M.sparkProjectKey(s), null);
    assert.equal(M.sparkIsHome(s), false);
    assert.equal(M.sparkProjectLabel(s), '');
    assert.equal(M.sparkProjectActionLabel(s), '');
    assert.equal(M.sparkProjectSecondary(s), '');
  }
});

// Fail-safe on missing / malformed metadata.
test('helpers fail safe on missing spark metadata', () => {
  for (const s of [null, undefined, {}, { builder: 'nope' }]) {
    assert.equal(M.sparkProjectKey(s), null);
    assert.equal(M.sparkIsHome(s), false);
    assert.equal(M.sparkProjectActionLabel(s), '');
  }
});

// The abstraction is more than a rename of `builder === 'website'`:
// the project namespace is a distinct value from the internal builder key.
test('project namespace is decoupled from the builder key', () => {
  const entry = M.MUSE_PROJECTS.website;
  assert.equal(entry.builder, 'website');
  assert.equal(entry.project, 'home');
  assert.notEqual(entry.project, entry.builder,
    'project namespace must not equal the raw builder key');
  assert.equal(M.sparkProjectKey({ builder: 'website' }), 'home');
});

console.log('\nStatic wiring assertions');

// CTAs no longer branch on the hardcoded builder string.
test('sparkComposeLabel/composeInFieldNotes use project helpers, not builder===website', () => {
  assert.match(html, /function sparkComposeLabel\(spark\) \{\s*return sparkProjectActionLabel\(spark\)/);
  assert.match(html, /if \(sparkIsHome\(currentSpark\)\)/);
  // No stray `builder === 'website'` CTA checks remain in the widget copy.
  assert.doesNotMatch(html, /currentSpark\.builder === 'website'/);
  assert.doesNotMatch(html, /spark\.builder === 'website'/);
});

// Threshold heading + intro wiring from PR #135 still feeds the hero.
test('threshold heading/intro capture still wires into the hOMe hero', () => {
  assert.match(html, /var capThreshold\s*=\s*lpCaptureText\('threshold'\)/);
  assert.match(html, /var capThresholdIntro\s*=\s*lpCaptureText\('home-threshold-intro'\)/);
  // capThreshold is the first source for the hero heading.
  assert.match(html, /var heroHeading = lpFirst\(\s*capThreshold/);
  // capThresholdIntro is preferred for the hero intro.
  assert.match(html, /intro:\s*capThresholdIntro \|\|/);
  // The threshold view renders heading + intro into the hero.
  assert.match(html, /var heading = hero\.heading/);
  assert.match(html, /ph-hero-intro/);
});

// The Spark library + builder standard still carry the hOMe threshold fields.
test('spark library and builder standard retain hOMe threshold fields', () => {
  assert.match(html, /id: 'sp-site-threshold',[\s\S]*?builder: 'website', target: 'threshold'/);
  assert.match(html, /id: 'sp-site-threshold-intro',[\s\S]*?target: 'home-threshold-intro'/);
  assert.match(html, /\{ id: 'threshold',\s*section: 'work'/);
  assert.match(html, /\{ id: 'home-threshold-intro', section: 'work'/);
});

console.log('\n' + passed + ' checks passed.');
