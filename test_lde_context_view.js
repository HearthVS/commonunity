/* Living Digital Expression context view-model — regression tests.
   Run: node --test test_lde_context_view.js   (Node 20+, no dependencies)

   Extracts the pure buildProjectContextView() from studio.html (no copy) and
   verifies readable-content extraction across the real cOMpass field shapes.

   Regression guarded: the Life's Work / "The Work" room whose body lives only
   in `raw` (and/or whose highlights are objects) previously resolved its
   provenance but rendered "no readable content". The extractor must read the
   same field shapes phCompassContentSeed/dimSeed already read in this file:
   web_heading, web_intro|summary|raw body, web_closing, theme, and
   string-or-object highlights/insights. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

// Pull the function source out of studio.html by brace-matching from its
// declaration, so we test the shipped code rather than a duplicate.
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

// buildProjectContextView closes over a module-level ROOMS const; provide it.
const factory = new Function(
  'ROOMS',
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

test('Life\'s Work with body only in `raw` renders content (regression)', () => {
  const compass = { points: { work: { gk_num: 5, gk_line: 5, raw: 'The real Life\'s Work reflection text.' } } };
  const v = view('work', compass);
  assert.strictEqual(v.mode, 'content', 'raw-only body must resolve to content, not no-point');
  assert.ok(v.canSave, 'content mode is saveable');
  const summary = v.fields.find((f) => f.label === 'Summary');
  assert.ok(summary && /Life's Work reflection/.test(summary.value), 'raw surfaces as the Summary body');
  assert.ok(/Life's Work reflection/.test(v.payloadText), 'raw flows into the save payload');
});

test('object-shaped highlights are read, not discarded (regression)', () => {
  const compass = { points: { work: { gk_num: 5, gk_line: 5,
    highlights: [{ text: 'first insight' }, 'second insight', { label: 'third' }] } } };
  const v = view('work', compass);
  assert.strictEqual(v.mode, 'content');
  const hl = v.fields.find((f) => f.label === 'Highlights');
  assert.deepStrictEqual(hl.items, ['first insight', 'second insight', 'third']);
});

test('web_heading and insights surface as readable fields', () => {
  const compass = { points: { work: { gk_num: 5, gk_line: 5,
    web_heading: 'My heading', insights: [{ title: 'an insight' }] } } };
  const v = view('work', compass);
  assert.ok(v.fields.some((f) => f.label === 'Heading' && f.value === 'My heading'));
  assert.ok(v.fields.some((f) => f.label === 'Insights' && f.items[0] === 'an insight'));
});

test('curated rooms still render summary + intro unchanged (no regression)', () => {
  const compass = { points: { lens: { gk_num: 12, gk_line: 3,
    summary: 'S text', web_intro: 'I text', web_closing: 'C text', theme: 'T' } } };
  const v = view('lens', compass);
  assert.strictEqual(v.mode, 'content');
  const labels = v.fields.map((f) => f.label);
  assert.deepStrictEqual(labels, ['Summary', 'Intro', 'Theme', 'Closing']);
  // raw fallback must NOT fire when curated copy exists
  const compass2 = { points: { lens: { summary: 'S', web_intro: 'I', raw: 'RAW' } } };
  assert.ok(!/RAW/.test(view('lens', compass2).payloadText), 'raw is body fallback only');
});

test('truly empty point still yields honest no-point empty state', () => {
  const v = view('work', { points: { work: { gk_num: 5, gk_line: 5 } } });
  assert.strictEqual(v.mode, 'no-point');
  assert.ok(v.visible && !v.canSave && v.empty);
});

test('provenance resolves independently of body fields', () => {
  const v = view('work', { points: { work: { gk_num: 5, gk_line: 5, raw: 'x' } } });
  assert.match(v.source, /Life's Work 5\.5/);
});
