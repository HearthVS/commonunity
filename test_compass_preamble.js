/* cOMpass raw-only Work → canonical Summary: producer finalizer + Studio legacy
   upgrade + view-model. Run: node --test test_compass_preamble.js (Node 20+).

   Guards the production defect where the "Work" (Life's Work) room shipped
   raw-only — no web_heading/summary/theme/etc — so the FieldPrint editor showed
   every structured field blank while Source Material was collapsed. The durable
   fix is a deterministic, no-fabrication promotion of the clean pre-transcript
   synthesised preamble into an EMPTY Summary, applied at TWO sources:

     A. the cOMpass producer/export (index.html: cuFinalizeCompassPoints), so
        future exports carry a canonical field for Work under its own key; and
     B. the Studio legacy import upgrade (studio.html: cuUpgradeCompassDraft),
        so existing raw-only files gain a Summary on import — draft only, the
        frozen Level 1 baseline is never touched, idempotent/versioned.

   Transcript blocks (`--- From transcript: … ---`) and `[Guide:]` facilitation
   notes always remain source-only; nothing is fabricated. When a room has raw
   but no promotable preamble, the view-model offers a reviewed "Structure with
   Nexus" pass instead. The SHIPPED functions are extracted (no copies). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const STUDIO = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');
const INDEX = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFrom(src, name) {
  let start = src.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' must exist');
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// ── The observed Work fixture: a clean synthesised preamble, then transcript
//    blocks with a [Guide:] note (VESNA N.txt), exactly as the client assembles
//    raw via `\n\n--- From transcript: <file> ---\n`. ────────────────────────
const PREAMBLE =
  "Vesna's real work is holding space for others to arrive at their own clarity. " +
  "She is a steady, grounding presence who helps people feel safe enough to be " +
  "honest with themselves and move toward what genuinely matters to them.";
const WORK_RAW = [
  PREAMBLE,
  '',
  '--- From transcript: VESNA N.txt ---',
  '[Guide: opened by asking what work feels effortless]',
  'Me: I think what I do best is listen and reflect back what I hear.',
  'Them: And when does that feel most alive for you?',
  'Me: When someone finally exhales and sees themselves clearly.',
].join('\n');

// Studio (Part B) sandbox.
const studioFactory = new Function(
  ['cuFpStr', 'cuFpList', 'cuCompassPreamble', 'cuUpgradeCompassDraft', 'cuMigrateLevel2Draft']
    .map((n) => extractFrom(STUDIO, n)).join('\n') +
  '\nreturn { pre: cuCompassPreamble, upgrade: cuUpgradeCompassDraft, migrate: cuMigrateLevel2Draft, str: cuFpStr };'
);
const S = studioFactory();

// Producer (Part A) sandbox.
const indexFactory = new Function(
  ['cuCompassPreamble', 'cuFinalizeCompassPoints']
    .map((n) => extractFrom(INDEX, n)).join('\n') +
  '\nreturn { pre: cuCompassPreamble, finalize: cuFinalizeCompassPoints };'
);
const I = indexFactory();

// View-model sandbox (mirrors test_lde_context_view.js wiring).
const viewFactory = new Function('ROOMS',
  ['cuFpStr', 'cuFpList', 'cuNormalizeFieldprintPoint', 'cuFieldprintHasStructured', 'cuFieldprintFields']
    .map((n) => extractFrom(STUDIO, n)).join('\n') + '\n' +
  extractFrom(STUDIO, 'buildProjectContextView') + '\nreturn buildProjectContextView;');
const buildView = viewFactory(['work', 'lens', 'field', 'call']);
const LDE = 'living-digital-expression';
const ROOM_META = { work: { title: 'The Work', gkLabel: "Life's Work" }, lens: { title: 'The Lens' } };
const view = (room, compass) => buildView(LDE, LDE, room, compass, ROOM_META);

const clone = (o) => JSON.parse(JSON.stringify(o));
const NO_LEAK = (s) => {
  assert.ok(!/From transcript:/i.test(s), 'no transcript marker leaks into a field');
  assert.ok(!/\[Guide:/i.test(s), 'no [Guide:] note leaks into a field');
  assert.ok(!/Them:|Me:/.test(s), 'no transcript dialogue leaks into a field');
};

// ── Deterministic parser ─────────────────────────────────────────────────────
test('preamble parser promotes the clean pre-transcript paragraph, drops markers/guide', () => {
  const pre = S.pre(WORK_RAW);
  assert.match(pre, /holding space for others/);
  NO_LEAK(pre);
  assert.strictEqual(pre, PREAMBLE, 'exactly the synthesised paragraph, nothing after the marker');
});

test('parser refuses to promote when separation is not explicit or content is thin', () => {
  assert.strictEqual(S.pre('Just a short note.'), '', 'no transcript marker → never promote');
  assert.strictEqual(S.pre('Only six words before the marker here.\n--- From transcript: x ---\nMe: hi'),
    '', 'a too-thin preamble is not substantive enough to promote');
  assert.strictEqual(S.pre(''), '');
  assert.strictEqual(S.pre(null), '');
});

test('a preamble that is itself guide-laden is NOT promoted (stays source-only)', () => {
  const raw = '[Guide: this whole preamble is a facilitation note that runs long enough to pass the word count test easily]\n--- From transcript: x ---\nMe: hi';
  assert.strictEqual(S.pre(raw), '', 'guide-only preamble contributes nothing publishable');
});

test('the producer and Studio parsers agree byte-for-byte (no drift)', () => {
  assert.strictEqual(I.pre(WORK_RAW), S.pre(WORK_RAW));
  assert.strictEqual(I.pre('Only six words before the marker here.\n--- From transcript: x ---\n'),
    S.pre('Only six words before the marker here.\n--- From transcript: x ---\n'));
});

// ── Part A: producer/export finalizer ────────────────────────────────────────
test('producer: raw-only Work gets a canonical Summary under the exact `work` key', () => {
  const points = {
    work: { gk_num: 5, gk_line: 5, raw: WORK_RAW },
    lens: { summary: 'Curated lens summary that already exists.', web_intro: 'Lens intro.' },
  };
  const out = I.finalize(points);
  assert.strictEqual(out.work.summary, PREAMBLE, 'Work summary promoted under the `work` key');
  NO_LEAK(out.work.summary);
  assert.strictEqual(out.work.raw, WORK_RAW, 'raw is preserved verbatim (source material intact)');
  assert.strictEqual(out.lens.summary, 'Curated lens summary that already exists.',
    'a room that already has a curated summary is never overwritten');
});

test('producer finalizer is pure (does not mutate live points) and idempotent', () => {
  const points = { work: { raw: WORK_RAW } };
  const once = I.finalize(points);
  assert.strictEqual(points.work.summary, undefined, 'live input is not mutated');
  const twice = I.finalize(clone(once));
  assert.deepStrictEqual(twice, once, 'running the finalizer again changes nothing');
});

// ── Part B: Studio legacy import upgrade (draft only, baseline untouched) ─────
test('legacy upgrade promotes preamble into the DRAFT summary, leaves baseline frozen/unchanged', () => {
  const source = { points: { work: { raw: WORK_RAW }, lens: { summary: 'Lens curated.' } } };
  const draft = clone(source);
  const baseline = clone(source);
  Object.freeze(baseline); Object.freeze(baseline.points); Object.freeze(baseline.points.work);
  const meta = {};

  const upgraded = S.upgrade(draft, meta, ['work', 'lens', 'field', 'call']);

  assert.deepStrictEqual(upgraded, ['work'], 'only Work (raw-only, no summary) is upgraded');
  assert.strictEqual(draft.points.work.summary, PREAMBLE, 'draft Work summary promoted');
  NO_LEAK(draft.points.work.summary);
  assert.strictEqual(draft.points.lens.summary, 'Lens curated.', 'lens draft untouched');
  // Baseline is the immutable Level 1 record — never gains the promoted summary.
  assert.strictEqual(baseline.points.work.summary, undefined, 'baseline Work stays raw-only');
  // Provenance recorded as the person's own material, flagged as an upgrade.
  assert.strictEqual(meta.work.summary.origin, 'manual');
  assert.strictEqual(meta.work.summary.upgraded, 'preamble');
});

test('legacy upgrade is idempotent — a second pass promotes nothing and preserves content', () => {
  const draft = { points: { work: { raw: WORK_RAW } } };
  const meta = {};
  const first = S.upgrade(draft, meta, ['work']);
  assert.deepStrictEqual(first, ['work']);
  const promoted = draft.points.work.summary;
  const second = S.upgrade(draft, meta, ['work']);
  assert.deepStrictEqual(second, [], 'nothing re-migrated on a second pass');
  assert.strictEqual(draft.points.work.summary, promoted, 'existing summary preserved verbatim');
});

test('legacy upgrade never touches a room that already has a summary', () => {
  const draft = { points: { work: { raw: WORK_RAW, summary: 'A summary the person wrote.' } } };
  const meta = {};
  const upgraded = S.upgrade(draft, meta, ['work']);
  assert.deepStrictEqual(upgraded, []);
  assert.strictEqual(draft.points.work.summary, 'A summary the person wrote.');
});

// ── View-model: promoted content shows; unpromotable raw offers Nexus ─────────
test('after promotion, the Work editor shows the Summary and no longer flags structuring', () => {
  const compass = { points: { work: { gk_num: 5, gk_line: 5, raw: WORK_RAW, summary: PREAMBLE } } };
  const v = view('work', compass);
  assert.strictEqual(v.mode, 'editor');
  const byKey = Object.fromEntries(v.fields.map((f) => [f.key, f]));
  assert.strictEqual(byKey.summary.value, PREAMBLE, 'promoted summary is rendered');
  NO_LEAK(byKey.summary.value);
  assert.strictEqual(v.hasStructured, true);
  assert.strictEqual(v.needsStructuring, false, 'no CTA once a structured field exists');
});

test('raw with no promotable preamble → all fields blank, prominent Structure-with-Nexus offered', () => {
  const rawNoPreamble = '--- From transcript: x.txt ---\n[Guide: notes]\nMe: only transcript, no synthesis.';
  const compass = { points: { work: { gk_num: 5, gk_line: 5, raw: rawNoPreamble } } };
  const v = view('work', compass);
  assert.strictEqual(v.hasStructured, false, 'nothing fabricated from a transcript-only raw');
  assert.strictEqual(v.needsStructuring, true, 'offers the reviewed Nexus structuring pass');
  v.fields.forEach((f) => {
    const val = f.kind === 'list' ? (f.items || []).join('') : (f.value || '');
    assert.strictEqual(val, '', f.key + ' stays empty (no brittle string-splitting)');
  });
  assert.match(v.rawSource, /only transcript/, 'raw remains available as source material');
});

// ── One-time versioned migration of an already-established Level 2 state ──────
//    (the production case: a document created before preamble promotion, sitting
//    in localStorage with a blank raw-only Work). cuMigrateLevel2Draft runs the
//    upgrade on the DRAFT only, stamps level2.upgrade so it never repeats.
const L2STATE = (workPoint, upgrade) => ({
  level2: Object.assign({ version: 'studio-level2-v1' }, upgrade ? { upgrade: upgrade } : {}),
  compassData: { points: { work: clone(workPoint), lens: { summary: 'Lens curated.' } } },
  compassBaseline: Object.freeze({ points: Object.freeze({ work: Object.freeze(clone(workPoint)) }) }),
  compassDraftMeta: { points: {} },
});

test('existing Level 2 with blank raw-only Work is upgraded exactly once', () => {
  const st = L2STATE({ gk_num: 5, gk_line: 5, raw: WORK_RAW });
  const upgraded = S.migrate(st);
  assert.deepStrictEqual(upgraded, ['work'], 'only Work (raw-only, no summary) migrates');
  assert.strictEqual(st.compassData.points.work.summary, PREAMBLE, 'draft Work summary promoted');
  NO_LEAK(st.compassData.points.work.summary);
  assert.strictEqual(st.level2.upgrade, 'preamble-v1', 'state is stamped as migrated');
  assert.strictEqual(st.compassData.points.lens.summary, 'Lens curated.', 'curated lens untouched');
  // Baseline is the frozen Level 1 record — never gains the promoted summary.
  assert.strictEqual(st.compassBaseline.points.work.summary, undefined, 'baseline stays raw-only');
  assert.strictEqual(st.compassDraftMeta.points.work.summary.upgraded, 'preamble', 'provenance recorded');
});

test('a Level 2 room that already has a summary is preserved by the migration', () => {
  const st = L2STATE({ raw: WORK_RAW, summary: 'A summary the person wrote.' });
  const upgraded = S.migrate(st);
  assert.deepStrictEqual(upgraded, [], 'nothing migrated when a summary already exists');
  assert.strictEqual(st.compassData.points.work.summary, 'A summary the person wrote.', 'edited summary preserved');
  assert.strictEqual(st.level2.upgrade, 'preamble-v1', 'still stamped so it is not re-checked');
});

test('the migration is a strict no-op on a second load (idempotent across refresh)', () => {
  const st = L2STATE({ gk_num: 5, gk_line: 5, raw: WORK_RAW });
  S.migrate(st);
  const afterFirst = clone(st.compassData);
  const second = S.migrate(st);
  assert.deepStrictEqual(second, [], 'already-stamped state migrates nothing');
  assert.deepStrictEqual(st.compassData, afterFirst, 'draft unchanged on the second pass');
});

test('transcript-only Work stays blank after migration but is still stamped (CTA remains)', () => {
  const rawNoPreamble = '--- From transcript: x.txt ---\n[Guide: notes]\nMe: only transcript, no synthesis.';
  const st = L2STATE({ gk_num: 5, gk_line: 5, raw: rawNoPreamble });
  const upgraded = S.migrate(st);
  assert.deepStrictEqual(upgraded, [], 'nothing fabricated from a transcript-only raw');
  assert.strictEqual(st.compassData.points.work.summary, undefined, 'Work summary stays empty');
  assert.strictEqual(st.level2.upgrade, 'preamble-v1', 'stamped so we never re-check');
  // The Nexus CTA is driven by hasStructured, not the stamp: still offered.
  const v = view('work', st.compassData);
  assert.strictEqual(v.hasStructured, false);
  assert.strictEqual(v.needsStructuring, true, 'Structure-with-Nexus CTA still shown');
});

test('migration is inert on legacy / non-Level-2 state (never touches it)', () => {
  assert.deepStrictEqual(S.migrate(null), []);
  assert.deepStrictEqual(S.migrate({}), [], 'no level2 → no-op');
  assert.deepStrictEqual(S.migrate({ level2: { version: 'studio-v0' }, compassData: { points: {} } }), [],
    'wrong version → no-op');
});
