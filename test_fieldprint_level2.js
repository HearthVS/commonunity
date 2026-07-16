/* FieldPrint Level 2 — pure model-layer regression tests.
   Run: node --test test_fieldprint_level2.js   (Node 20+, no dependencies)

   Extracts the shipped pure helpers from studio.html (no copy) and verifies:
   - Level 1 immutability: baseline is deep-frozen and never aliases the draft,
     so editing the draft cannot mutate the baseline the comparison reads.
   - Import discrimination: raw cOMpass vs legacy studio-v1 vs new Level 2.
   - The shared normalizer keeps `raw` separate from summary/intro.
   - Baseline-vs-draft comparison: per-field unchanged/edited/added/removed,
     word-level add/remove counts, Nexus-assisted counting, and honest
     "unavailable" when there is no true baseline. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

function extractFn(name) {
  const start = HTML.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' must exist in studio.html');
  let i = HTML.indexOf('{', start);
  let depth = 0;
  for (; i < HTML.length; i++) {
    const c = HTML[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return HTML.slice(start, i);
}

// Load all pure helpers together into one sandbox (they call each other).
const NAMES = [
  'cuFieldprintFields', 'cuL2DeepClone', 'cuL2DeepFreeze', 'cuFpStr', 'cuFpList',
  'cuNormalizeFieldprintPoint', 'cuFieldprintHasStructured', 'cuClassifyStudioImport',
  'cuInitLevel2FromCompass', 'cuWordDiff', 'cuCompareTextField', 'cuCompareListField',
  'cuComparePoint', 'cuCompareCompass',
];
const src = NAMES.map(extractFn).join('\n') +
  '\nreturn {' + NAMES.join(',') + '};';
const M = new Function(src)();

const ROOM_META = {
  work:  { title: 'The Work', gkLabel: "Life's Work" },
  lens:  { title: 'The Lens', gkLabel: 'Evolution' },
  field: { title: 'The Field', gkLabel: 'Radiance' },
  call:  { title: 'The Call',  gkLabel: 'Purpose' },
};

test('classifier distinguishes compass / studio-v1 / level2', () => {
  assert.strictEqual(M.cuClassifyStudioImport({ points: { work: {} } }), 'compass');
  assert.strictEqual(M.cuClassifyStudioImport({ version: 'studio-v1', compassData: { points: {} } }), 'studio-v1');
  assert.strictEqual(M.cuClassifyStudioImport({ compassData: { points: {} } }), 'studio-v1');
  assert.strictEqual(M.cuClassifyStudioImport({ version: 'studio-level2-v1', compassBaseline: { points: {} }, compassData: { points: {} } }), 'level2');
  assert.strictEqual(M.cuClassifyStudioImport({ compassBaseline: { points: {} } }), 'level2');
  assert.strictEqual(M.cuClassifyStudioImport({}), null);
  assert.strictEqual(M.cuClassifyStudioImport(null), null);
});

test('Level 2 init: baseline is frozen and never aliases the draft', () => {
  const compass = { points: { work: { summary: 'original', highlights: ['a'] } } };
  const l2 = M.cuInitLevel2FromCompass(compass);
  assert.notStrictEqual(l2.baseline, l2.draft, 'baseline and draft are separate objects');
  assert.notStrictEqual(l2.baseline.points.work, l2.draft.points.work, 'nested objects are not aliased');
  assert.ok(Object.isFrozen(l2.baseline), 'baseline root frozen');
  assert.ok(Object.isFrozen(l2.baseline.points.work), 'baseline nested frozen');
  // Mutating the draft must not reach the baseline.
  l2.draft.points.work.summary = 'edited';
  l2.draft.points.work.highlights.push('b');
  assert.strictEqual(l2.baseline.points.work.summary, 'original');
  assert.deepStrictEqual(l2.baseline.points.work.highlights, ['a']);
  // Attempting to write the frozen baseline is a silent no-op (non-strict fn body).
  try { l2.baseline.points.work.summary = 'hacked'; } catch (_) {}
  assert.strictEqual(l2.baseline.points.work.summary, 'original');
});

test('normalizer keeps raw separate from summary/intro', () => {
  const norm = M.cuNormalizeFieldprintPoint({ raw: 'transcript body', gk_num: 5 });
  assert.strictEqual(norm.rawSource, 'transcript body');
  assert.strictEqual(norm.summary, '', 'raw is NOT poured into summary');
  assert.strictEqual(norm.web_intro, '', 'raw is NOT poured into intro');
  assert.strictEqual(M.cuFieldprintHasStructured(norm), false, 'raw-only point has no structured content');
});

test('normalizer reads object-shaped highlights/insights', () => {
  const norm = M.cuNormalizeFieldprintPoint({
    highlights: [{ text: 'one' }, 'two', { label: 'three' }],
    insights: [{ title: 'i1' }],
  });
  assert.deepStrictEqual(norm.highlights, ['one', 'two', 'three']);
  assert.deepStrictEqual(norm.insights, ['i1']);
  assert.strictEqual(M.cuFieldprintHasStructured(norm), true);
});

test('text field comparison classifies unchanged/edited/added/removed with word counts', () => {
  assert.strictEqual(M.cuCompareTextField('same', 'same').status, 'unchanged');
  assert.strictEqual(M.cuCompareTextField('', 'now here').status, 'added');
  assert.strictEqual(M.cuCompareTextField('was here', '').status, 'removed');
  const edited = M.cuCompareTextField('the quick brown fox', 'the slow brown fox jumps');
  assert.strictEqual(edited.status, 'edited');
  assert.strictEqual(edited.wordsRemoved, 1, 'quick removed');
  assert.strictEqual(edited.wordsAdded, 2, 'slow + jumps added');
});

test('list field comparison counts item add/remove', () => {
  const r = M.cuCompareListField(['a', 'b'], ['b', 'c', 'd']);
  assert.strictEqual(r.status, 'edited');
  assert.strictEqual(r.itemsAdded, 2, 'c and d added');
  assert.strictEqual(r.itemsRemoved, 1, 'a removed');
  assert.strictEqual(M.cuCompareListField([], []).status, 'unchanged');
  assert.strictEqual(M.cuCompareListField([], ['x']).status, 'added');
  assert.strictEqual(M.cuCompareListField(['x'], []).status, 'removed');
});

test('full comparison rolls up fields changed, words, and Nexus-assisted', () => {
  const baseline = { points: {
    work: { summary: 'original work summary', web_heading: 'H' },
    lens: { theme: 'a lens theme' },
    field: {}, call: {},
  } };
  const draft = { points: {
    work: { summary: 'a brand new work summary text', web_heading: 'H' },
    lens: { theme: 'a lens theme' },
    field: {}, call: {},
  } };
  const meta = { points: { work: { summary: { origin: 'nexus' } } } };
  const result = M.cuCompareCompass(baseline, draft, ['work', 'lens', 'field', 'call'], meta, ROOM_META);
  assert.strictEqual(result.available, true);
  assert.strictEqual(result.fieldsTotal, 28, '7 fields * 4 rooms');
  assert.strictEqual(result.fieldsChanged, 1, 'only work.summary changed');
  assert.strictEqual(result.nexusAssisted, 1, 'the changed field was Nexus-assisted');
  const work = result.rooms.find((r) => r.room === 'work');
  const summaryField = work.fields.find((f) => f.key === 'summary');
  assert.strictEqual(summaryField.status, 'edited');
  assert.ok(summaryField.wordsAdded > 0);
});

test('comparison is honest when no baseline exists (legacy session)', () => {
  const r = M.cuCompareCompass(null, { points: { work: {} } }, ['work'], null, ROOM_META);
  assert.strictEqual(r.available, false, 'no baseline → unavailable, never fabricated 0%');
});

// ── Import/export lifecycle (studioApplyLevel2Import operates on a `state`) ──
// Build a sandbox exposing the shipped studioApplyLevel2Import over a mock
// state, wired to the same pure helpers it depends on.
function importSandbox() {
  const deps = ['cuL2DeepClone', 'cuL2DeepFreeze', 'cuInitLevel2FromCompass', 'cuFieldprintFields'].map(extractFn).join('\n');
  const body = deps + '\n' + extractFn('studioApplyLevel2Import') +
    '\nlet state = { compassData: null, compassBaseline: null, compassDraftMeta: { points: {} }, level2: null };' +
    '\nreturn { apply: function (raw, draft, kind) { studioApplyLevel2Import(raw, draft, kind); return state; } };';
  return new Function(body)();
}

test('fresh cOMpass import initialises a Level 2 doc with frozen baseline', () => {
  const sb = importSandbox();
  const compass = { companion: 'Ada', points: { work: { summary: 'orig' } } };
  const st = sb.apply(compass, compass, 'compass');
  assert.ok(Object.isFrozen(st.compassBaseline), 'baseline frozen');
  assert.notStrictEqual(st.compassBaseline, st.compassData, 'baseline != draft');
  assert.strictEqual(st.compassBaseline.points.work.summary, 'orig');
  assert.strictEqual(st.level2.version, 'studio-level2-v1');
  st.compassData.points.work.summary = 'evolved';
  assert.strictEqual(st.compassBaseline.points.work.summary, 'orig', 'draft edit never touches baseline');
});

test('Level 2 export/reimport round-trip restores baseline + draft + provenance', () => {
  const sb1 = importSandbox();
  const compass = { companion: 'Ada', points: { work: { summary: 'orig' } } };
  const st1 = sb1.apply(compass, compass, 'compass');
  // Evolve the draft + tag provenance, then serialise a Level 2 envelope.
  st1.compassData.points.work.summary = 'evolved summary';
  st1.compassDraftMeta.points.work = { summary: { origin: 'manual', updatedAt: 'now' } };
  const envelope = {
    version: 'studio-level2-v1',
    compassData: st1.compassData,
    compassBaseline: st1.compassBaseline,
    compassDraftMeta: st1.compassDraftMeta,
    level2: st1.level2,
  };
  const roundTripped = JSON.parse(JSON.stringify(envelope));
  assert.strictEqual(M.cuClassifyStudioImport(roundTripped), 'level2');
  const sb2 = importSandbox();
  const st2 = sb2.apply(roundTripped, roundTripped.compassData, 'level2');
  assert.strictEqual(st2.compassBaseline.points.work.summary, 'orig', 'baseline preserved through save+load');
  assert.strictEqual(st2.compassData.points.work.summary, 'evolved summary', 'draft preserved');
  assert.strictEqual(st2.compassDraftMeta.points.work.summary.origin, 'manual', 'provenance preserved');
  assert.ok(Object.isFrozen(st2.compassBaseline), 're-imported baseline is frozen again');
});

test('legacy studio-v1 import loads honestly with no baseline', () => {
  const sb = importSandbox();
  const legacy = { version: 'studio-v1', compassData: { points: { work: { summary: 's' } } } };
  const st = sb.apply(legacy, legacy.compassData, 'studio-v1');
  assert.strictEqual(st.compassBaseline, null, 'no fabricated baseline');
  assert.deepStrictEqual(st.compassDraftMeta, { points: {} });
  const cmp = M.cuCompareCompass(st.compassBaseline, st.compassData, ['work'], st.compassDraftMeta, ROOM_META);
  assert.strictEqual(cmp.available, false, 'legacy session → comparison unavailable');
});
