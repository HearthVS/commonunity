/* FieldPrint editor view-model — regression tests.
   Run: node --test test_lde_context_view.js   (Node 20+, no dependencies)

   Extracts the pure buildProjectContextView() from studio.html (no copy) and
   verifies the developmental editor view-model. This tab was intentionally
   reworked: instead of a read-only "content"/"no-point" card that poured `raw`
   into Summary, it is now a structured editor that renders the SAME seven
   editable fields for every room (Heading, Summary, Introduction, Theme,
   Closing, Highlights, Insights). `raw` is surfaced separately as rawSource and
   is NEVER poured into an editable field. */
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

// buildProjectContextView closes over ROOMS and the shared pure helpers.
const DEPS = ['cuFpStr', 'cuFpList', 'cuNormalizeFieldprintPoint',
  'cuFieldprintHasStructured', 'cuFieldprintFields'];
const factory = new Function(
  'ROOMS',
  DEPS.map(extractFn).join('\n') + '\n' +
  extractFn('buildProjectContextView') + '\nreturn buildProjectContextView;'
);
const buildProjectContextView = factory(['work', 'lens', 'field', 'call']);

const ROOM_META = {
  work:  { title: 'The Work', gkLabel: "Life's Work" },
  lens:  { title: 'The Lens', gkLabel: 'Evolution' },
  field: { title: 'The Field', gkLabel: 'Radiance' },
  call:  { title: 'The Call',  gkLabel: 'Purpose' },
};
const LDE = 'living-digital-expression';
const view = (room, compass) => buildProjectContextView(LDE, LDE, room, compass, ROOM_META);
const FIELD_LABELS = ['Heading', 'Summary', 'Introduction', 'Theme', 'Closing', 'Highlights', 'Insights'];

test('every room renders the same seven structured editable fields in order', () => {
  const compass = { points: { lens: { summary: 'S', web_intro: 'I', theme: 'T' } } };
  const v = view('lens', compass);
  assert.strictEqual(v.mode, 'editor');
  assert.strictEqual(v.canEdit, true);
  assert.deepStrictEqual(v.fields.map((f) => f.label), FIELD_LABELS);
  // Text vs list kinds are consistent.
  const byKey = Object.fromEntries(v.fields.map((f) => [f.key, f]));
  assert.strictEqual(byKey.highlights.kind, 'list');
  assert.strictEqual(byKey.insights.kind, 'list');
  assert.strictEqual(byKey.summary.kind, 'text');
});

test("Life's Work with body only in `raw` exposes rawSource, never in a field", () => {
  const compass = { points: { work: { gk_num: 5, gk_line: 5, raw: "The real Life's Work reflection text." } } };
  const v = view('work', compass);
  assert.strictEqual(v.mode, 'editor', 'raw-only point still opens the editor');
  assert.match(v.rawSource, /Life's Work reflection/, 'raw is surfaced as rawSource');
  assert.strictEqual(v.hasStructured, false, 'raw-only has no structured content yet');
  const summary = v.fields.find((f) => f.key === 'summary');
  const intro = v.fields.find((f) => f.key === 'web_intro');
  assert.strictEqual(summary.value, '', 'raw is NOT poured into Summary');
  assert.strictEqual(intro.value, '', 'raw is NOT poured into Introduction');
});

test('object-shaped highlights/insights are read into list items', () => {
  const compass = { points: { work: {
    highlights: [{ text: 'first insight' }, 'second insight', { label: 'third' }],
    insights: [{ title: 'an insight' }],
  } } };
  const v = view('work', compass);
  const hl = v.fields.find((f) => f.key === 'highlights');
  const ins = v.fields.find((f) => f.key === 'insights');
  assert.deepStrictEqual(hl.items, ['first insight', 'second insight', 'third']);
  assert.deepStrictEqual(ins.items, ['an insight']);
  assert.strictEqual(v.hasStructured, true);
});

test('curated room surfaces heading/summary/intro/theme/closing as field values', () => {
  const compass = { points: { lens: {
    web_heading: 'H', summary: 'S text', web_intro: 'I text', theme: 'T', web_closing: 'C text',
  } } };
  const v = view('lens', compass);
  const byKey = Object.fromEntries(v.fields.map((f) => [f.key, f]));
  assert.strictEqual(byKey.web_heading.value, 'H');
  assert.strictEqual(byKey.summary.value, 'S text');
  assert.strictEqual(byKey.web_intro.value, 'I text');
  assert.strictEqual(byKey.theme.value, 'T');
  assert.strictEqual(byKey.web_closing.value, 'C text');
});

test('eyebrow names the room; source carries Gene Key provenance', () => {
  const v = view('work', { points: { work: { gk_num: 5, gk_line: 5, raw: 'x' } } });
  assert.strictEqual(v.eyebrow, 'FieldPrint · The Work');
  assert.match(v.source, /Life's Work 5\.5/);
});

test('empty point still opens the editor with empty (editable) fields', () => {
  const v = view('work', { points: { work: { gk_num: 5, gk_line: 5 } } });
  assert.strictEqual(v.mode, 'editor', 'empty structured fields remain editable');
  assert.strictEqual(v.canEdit, true);
  assert.strictEqual(v.hasStructured, false);
  v.fields.forEach((f) => {
    if (f.kind === 'text') assert.strictEqual(f.value, '');
    else assert.deepStrictEqual(f.items, []);
  });
});

test('no open room → honest no-room empty state, not editable', () => {
  const v = view(null, { points: {} });
  assert.strictEqual(v.mode, 'no-room');
  assert.strictEqual(v.canEdit, false);
  assert.ok(v.empty && /Open a room/.test(v.empty));
});

test('no cOMpass imported → honest no-compass empty state', () => {
  const v = view('work', null);
  assert.strictEqual(v.mode, 'no-compass');
  assert.strictEqual(v.canEdit, false);
  assert.ok(v.empty && /No cOMpass data/.test(v.empty));
});

test('view is invisible for any non-FieldPrint project id', () => {
  assert.strictEqual(buildProjectContextView('other', LDE, 'work', { points: {} }, ROOM_META).visible, false);
});
