// Focused tests for the public hOMe language firewall
// (docs/home-design-grammar.md roadmap #1: "Codify the language
// firewall"). The public hOMe render/publish output must never surface
// CommonUnity's internal process/source language — Compass, Living
// Profile, Nexus, Field Observations, Spark, the fixed Work/Lens/Field/
// Call taxonomy, or provenance/source metadata.
//
// studio.html is a single ~1MB app with canvas / LLM / DOM dependencies
// and no bundler, so (like tests/muse-projects.test.mjs) we do not boot
// the page in jsdom. Instead we:
//   1. extract the real HOME_LANGUAGE_FIREWALL block verbatim from
//      studio.html (between sentinel comments) and exercise it, so the
//      unit tests run against the shipped source, not a copy; and
//   2. statically assert the surrounding wiring (exposure on
//      window.CommonUnity.builder) still holds.
//
// Run: node tests/home-language-firewall.test.mjs

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

// ── Extract the firewall block verbatim and load it ────────────────
const START = '// <HOME_LANGUAGE_FIREWALL_START>';
const END = '// <HOME_LANGUAGE_FIREWALL_END>';
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END);
assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
  'HOME_LANGUAGE_FIREWALL sentinel block must exist in studio.html');
const bodyStart = html.indexOf('\n', startIdx) + 1;
const src = html.slice(bodyStart, endIdx);

const load = new Function(
  src + '\nreturn { validatePublicHomeLanguage, HOME_FIREWALL };'
);
const { validatePublicHomeLanguage: validate } = load();

console.log('hOMe language firewall unit tests');

// ── Catches branded / internal terms ───────────────────────────────
test('flags each branded internal term in public text', () => {
  const cases = [
    ['Sourced from your Compass reading.', 'Compass'],
    ['This is your Living Profile.', 'Living Profile'],
    ['Explore the Nexus of your work.', 'Nexus'],
    ['Pulled from Field Observations.', 'Field Observations'],
    ['A Spark to get you started.', 'Spark'],
    ['Your OM Cipher palette.', 'OM Cipher']
  ];
  for (const [text, term] of cases) {
    const r = validate(text);
    assert.equal(r.ok, false, 'should flag: ' + text);
    assert.ok(r.violations.some((v) => v.term === term),
      'expected violation term ' + term + ' for: ' + text);
  }
});

// singular "Field Observation" is also caught
test('flags singular Field Observation', () => {
  const r = validate('Kept as a Field Observation.');
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.type === 'branded'));
});

// ── Catches provenance / source patterns ────────────────────────────
test('flags provenance / source / confidence / origin patterns', () => {
  const cases = [
    'sourced from an earlier note',
    'source: journal',
    'provenance: internal',
    'confidence score: 0.82',
    'this content came from your reflection',
    'origin: engine'
  ];
  for (const text of cases) {
    const r = validate(text);
    assert.equal(r.ok, false, 'should flag provenance: ' + text);
    assert.ok(r.violations.some((v) => v.type === 'provenance'),
      'expected provenance violation for: ' + text);
  }
});

// ── Catches the fixed taxonomy when chained as labels ───────────────
test('flags the fixed Work / Lens / Field / Call taxonomy chain', () => {
  const r = validate('Work / Lens / Field / Call');
  assert.equal(r.ok, false);
  const v = r.violations.find((x) => x.type === 'taxonomy');
  assert.ok(v, 'expected a taxonomy violation');
  assert.equal(v.term, 'Work/Lens/Field/Call');
});

test('flags a partial taxonomy chain (3+ dimensions joined)', () => {
  assert.equal(validate('Work · Lens · Field').ok, false);
  assert.equal(validate('work | lens | call').ok, false);
});

// ── Does NOT falsely block ordinary public words ────────────────────
test('does not flag ordinary use of work / field / call / lens', () => {
  const clean = [
    'I work with my hands and love the outdoors.',
    'Come visit me in the field where I grow herbs.',
    'Feel free to call me anytime.',
    'I shot this through a wide-angle lens.',
    'A place for my craft, my rhythms, and what I am here for.',
    'My work is my calling; the field is my studio.'
  ];
  for (const text of clean) {
    const r = validate(text);
    assert.equal(r.ok, true, 'should NOT flag ordinary copy: ' + text +
      ' — got ' + JSON.stringify(r.violations));
    assert.deepEqual(r.violations, []);
  }
});

// two ordinary dimension words in prose (not a chain) stay clean
test('two dimension words in a sentence are not a taxonomy chain', () => {
  const r = validate('My work in the field keeps me grounded.');
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

// ── Catches fixed taxonomy rendered as a UI label (model input) ─────
test('flags an exact dimension word used as a section label', () => {
  const model = {
    sections: [
      { label: 'Work', body: 'I build furniture by hand.' },
      { label: 'What keeps me going', body: 'Long walks and good coffee.' }
    ]
  };
  const r = validate(model);
  assert.equal(r.ok, false);
  const v = r.violations.find((x) => x.type === 'taxonomy-label');
  assert.ok(v, 'expected a taxonomy-label violation');
  assert.equal(v.term, 'Work');
  assert.match(v.location, /sections\[0\]\.label/);
});

test('warm custom labels are not flagged even if body uses the words', () => {
  const model = {
    sections: [
      { label: 'What I make', body: 'My daily work is pottery.' },
      { label: 'Where I am headed', body: 'A call to build community.' }
    ]
  };
  const r = validate(model);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

// ── Structured violation data ───────────────────────────────────────
test('returns structured violations with term/type/context/location', () => {
  const model = { heading: 'Sourced from your Compass' };
  const r = validate(model);
  assert.equal(r.ok, false);
  const v = r.violations[0];
  assert.ok(typeof v.term === 'string' && v.term.length);
  assert.ok(typeof v.type === 'string' && v.type.length);
  assert.ok(typeof v.context === 'string');
  assert.equal(v.location, 'heading');
});

test('a fully clean public model returns { ok: true, violations: [] }', () => {
  const model = {
    heading: 'Hi, I am Mara',
    intro: 'A gardener and teacher in the Pacific Northwest.',
    sections: [
      { label: 'What I make', body: 'Seasonal workshops and field guides.' },
      { label: 'What I am here for', body: 'Helping people grow their own food.' }
    ]
  };
  const r = validate(model);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  assert.deepEqual(r.violations, []);
});

// ── Fail-safe on odd inputs ─────────────────────────────────────────
test('fails safe (ok:true) on empty / null / non-string leaves', () => {
  for (const input of ['', null, undefined, 0, false, {}, []]) {
    const r = validate(input);
    assert.equal(r.ok, true, 'expected clean for ' + JSON.stringify(input));
  }
});

test('walks nested arrays and objects', () => {
  const model = { rooms: [{ blocks: [{ text: 'from the Nexus' }] }] };
  const r = validate(model);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.term === 'Nexus'));
  assert.match(r.violations[0].location, /rooms\[0\]\.blocks\[0\]\.text/);
});

console.log('\nStatic wiring assertions');

// The firewall is exposed on the builder namespace under both names.
test('validatePublicHomeLanguage is exposed on window.CommonUnity.builder', () => {
  assert.match(html, /validatePublicHomeLanguage:\s*validatePublicHomeLanguage/);
  assert.match(html, /homeLanguageFirewall:\s*validatePublicHomeLanguage/);
});

// A non-blocking readiness label helper is wired.
test('publicCopyReviewLabel readiness helper is wired and non-blocking', () => {
  assert.match(html, /publicCopyReviewLabel:\s*function/);
  assert.match(html, /Public copy needs review/);
});

// The module-level entry point delegates to the firewall.
test('validatePublicHomeLanguage delegates to HOME_FIREWALL.validate', () => {
  assert.match(html,
    /function validatePublicHomeLanguage\(modelOrText\)\s*\{\s*return HOME_FIREWALL\.validate\(modelOrText\);/);
});

console.log('\n' + passed + ' checks passed.');
