// Focused tests for warm, human public hOMe dimension labels
// (docs/home-design-grammar.md roadmap #2: "Refactor default labels").
// The four hidden dimensions (work/lens/field/call) are builder/source
// architecture. The visitor-facing hOMe must never *default* to the fixed
// taxonomy labels ("The Work / The Lens / The Field / The Call"); instead
// it defaults to warm, human placeholders, and always prefers a custom
// label the person set. Internal stUdio surfaces keep the internal names.
//
// studio.html is a single ~1MB app with canvas / LLM / DOM dependencies
// and no bundler, so (like tests/home-language-firewall.test.mjs) we do
// not boot the page in jsdom. Instead we:
//   1. extract the real HOME_PUBLIC_LABELS block verbatim from studio.html
//      (between sentinel comments) and exercise it, so the tests run
//      against the shipped source, not a copy;
//   2. extract the HOME_LANGUAGE_FIREWALL block and run it against a
//      representative public model built from the public labels; and
//   3. statically assert the render wiring + preserved internal mapping.
//
// Run: node tests/home-public-labels.test.mjs

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

function extractBlock(startSentinel, endSentinel) {
  const startIdx = html.indexOf(startSentinel);
  const endIdx = html.indexOf(endSentinel);
  assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'sentinel block must exist: ' + startSentinel);
  const bodyStart = html.indexOf('\n', startIdx) + 1;
  return html.slice(bodyStart, endIdx);
}

// ── Load the public-label helpers verbatim ──────────────────────────
const labelSrc = extractBlock(
  '// <HOME_PUBLIC_LABELS_START>',
  '// <HOME_PUBLIC_LABELS_END>'
);
const {
  PH_PUBLIC_ROOM_LABELS,
  PH_PUBLIC_ROOM_EYEBROWS,
  phPublicRoomLabel,
  phPublicRoomEyebrow
} = new Function(
  labelSrc +
  '\nreturn { PH_PUBLIC_ROOM_LABELS, PH_PUBLIC_ROOM_EYEBROWS,' +
  ' phPublicRoomLabel, phPublicRoomEyebrow };'
)();

// ── Load the firewall verbatim (for requirement #5) ─────────────────
const fwSrc = extractBlock(
  '// <HOME_LANGUAGE_FIREWALL_START>',
  '// <HOME_LANGUAGE_FIREWALL_END>'
);
const { validatePublicHomeLanguage: validate } = new Function(
  fwSrc + '\nreturn { validatePublicHomeLanguage };'
)();

const DIMS = ['work', 'lens', 'field', 'call'];
const RAW_LABELS = ['The Work', 'The Lens', 'The Field', 'The Call'];

console.log('hOMe public dimension label tests');

// ── Public defaults are warm human labels ───────────────────────────
test('public label defaults are warm, human copy for each dimension', () => {
  assert.equal(PH_PUBLIC_ROOM_LABELS.work,  'What I make');
  assert.equal(PH_PUBLIC_ROOM_LABELS.lens,  'How I perceive');
  assert.equal(PH_PUBLIC_ROOM_LABELS.field, 'What keeps me alive');
  assert.equal(PH_PUBLIC_ROOM_LABELS.call,  'What I’m here for');
});

test('phPublicRoomLabel returns the warm default when no custom label', () => {
  assert.equal(phPublicRoomLabel('work'),  'What I make');
  assert.equal(phPublicRoomLabel('lens', {}), 'How I perceive');
  assert.equal(phPublicRoomLabel('field', { label: '' }), 'What keeps me alive');
  assert.equal(phPublicRoomLabel('call', { label: '   ' }), 'What I’m here for');
});

// ── Raw fixed taxonomy labels are never the public default ───────────
test('raw fixed labels are not used by default in public hOMe output', () => {
  for (const key of DIMS) {
    const label = phPublicRoomLabel(key);
    assert.ok(!RAW_LABELS.includes(label),
      'public default for ' + key + ' must not be a fixed taxonomy label: ' + label);
    assert.ok(!/^the (work|lens|field|call)$/i.test(label),
      'public default for ' + key + ' must not read as "The X": ' + label);
  }
  for (const key of DIMS) {
    const eye = phPublicRoomEyebrow(key);
    assert.ok(!/\bthe (work|lens|field|call)\b/i.test(eye),
      'public eyebrow for ' + key + ' must not name the fixed taxonomy: ' + eye);
  }
});

// ── Custom labels are respected ─────────────────────────────────────
test('a custom label set by the person wins over the default', () => {
  assert.equal(phPublicRoomLabel('work', { label: 'My studio' }), 'My studio');
  assert.equal(phPublicRoomLabel('call', { label: 'Work with me' }), 'Work with me');
  // whitespace is trimmed, not treated as content
  assert.equal(phPublicRoomLabel('lens', { label: '  Perspective  ' }), 'Perspective');
});

test('a custom eyebrow set by the person wins over the default', () => {
  assert.equal(phPublicRoomEyebrow('field', { eyebrow: 'Roots & rhythms' }), 'Roots & rhythms');
  // falls back to the warm eyebrow default otherwise
  assert.equal(phPublicRoomEyebrow('field', {}), PH_PUBLIC_ROOM_EYEBROWS.field);
});

// ── Language firewall passes on default public output (req #5) ───────
test('language firewall does not flag default public label output', () => {
  // A representative public model assembled from the public label layer —
  // exactly what the visitor-facing render defaults to.
  const model = {
    name: 'Mara Ellison',
    sections: DIMS.map((key) => ({
      label:   phPublicRoomLabel(key),
      eyebrow: phPublicRoomEyebrow(key),
      heading: phPublicRoomLabel(key),
      body:    'A short, honest paragraph in the person’s own voice.'
    }))
  };
  const r = validate(model);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  assert.deepEqual(r.violations, []);
});

test('language firewall is clean on every individual public label + eyebrow', () => {
  for (const key of DIMS) {
    const l = validate({ label: phPublicRoomLabel(key) });
    assert.equal(l.ok, true, 'label flagged for ' + key + ': ' + JSON.stringify(l.violations));
    const e = validate(phPublicRoomEyebrow(key));
    assert.equal(e.ok, true, 'eyebrow flagged for ' + key + ': ' + JSON.stringify(e.violations));
  }
});

console.log('\nStatic wiring + preserved-internal assertions');

// ── The visitor render reads from the public label layer ────────────
test('phRenderRoom uses the public label + eyebrow helpers', () => {
  assert.match(html, /var label\s*=\s*phPublicRoomLabel\(key, sec\)/);
  assert.match(html, /ph-room-eyebrow[^]*?phPublicRoomEyebrow\(key, sec\)/);
});

test('phRenderThreshold doorways use the public label + eyebrow helpers', () => {
  assert.match(html, /ph-doorway-eye[^]*?phPublicRoomEyebrow\(k, sec\)/);
  assert.match(html, /ph-doorway-name[^]*?phPublicRoomLabel\(k, sec\)/);
});

// ── Internal builder dimension mapping remains intact ───────────────
test('internal phRoomFullName mapping still resolves to the internal names', () => {
  assert.match(html,
    /function phRoomFullName\(key\)\s*\{[^]*?work:\s*'The Work',\s*lens:\s*'The Lens',\s*field:\s*'The Field',\s*call:\s*'The Call'/);
});

test('internal FOURFOLD builder standard still names the four dimensions', () => {
  assert.match(html, /var FOURFOLD = \{[^]*?work:\s*\{\s*name:\s*'The Work'/);
});

console.log('\n' + passed + ' checks passed.');
