/* Global Arrival handoff — flattening + non-destructive hero prefill tests.
   Run: node --test test_fieldprint_arrival.js   (Node 20+, no dependencies)

   Verifies the Arrival end of the "Send to FieldPrint Builder" bridge:
   - studio.html handoffRowsToSections(): handoff rows → flat Builder section
     objects keyed by section key, one flat field map per section.
   - fieldprint.js applyPrefill(sections, arrival): the Arrival welcome becomes
     the Builder hero identity sentence (tagline) ONLY when a non-empty message
     is explicitly sent, and never disturbs portrait, palette, framing, images,
     layout, or unsent section fields. The CTA has no Builder slot yet and is
     carried forward-compatibly by the Studio value, not rendered here. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');
const FPJS = fs.readFileSync(path.join(__dirname, 'fieldprint.js'), 'utf8');

function extractFrom(src, name) {
  const start = src.indexOf('function ' + name + '(');
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

function rowsToSectionsFactory() {
  return new Function(
    extractFrom(HTML, 'handoffRowsToSections') + '\nreturn handoffRowsToSections;')();
}

function applyPrefillFactory(state) {
  return new Function('state',
    extractFrom(FPJS, 'applyPrefill') + '\nreturn applyPrefill;')(state);
}

function mockSection(key, over) {
  return Object.assign({
    key: key, sig: key, eyebrow: 'EB', title: 'T', body: 'B', role: 'root',
    imgRole: 'inset', enter: 'Enter', narrative: 'N',
    artifacts: [{ tag: 'Signal', title: 'old', note: '' }],
    prompt: 'P', image: { src: 'x', role: 'hero' },
  }, over || {});
}

test('handoffRowsToSections flattens each row into a keyed section map', () => {
  const rows = [
    { room: 'work', secKey: 'make', fields: [
      { key: 'title', value: 'Head' }, { key: 'narrative', value: 'Summ' },
    ] },
    { room: 'lens', secKey: 'perceive', fields: [
      { key: 'body', value: 'Intro' },
    ] },
  ];
  const sections = rowsToSectionsFactory()(rows);
  assert.deepStrictEqual(sections, [
    { key: 'make', title: 'Head', narrative: 'Summ' },
    { key: 'perceive', body: 'Intro' },
  ]);
});

test('arrival message becomes the Builder hero tagline, framing preserved', () => {
  const state = {
    name: 'Vesna', tagline: 'old identity line', role: 'root',
    sections: [mockSection('make'), mockSection('perceive')],
  };
  const applyPrefill = applyPrefillFactory(state);
  const applied = applyPrefill(
    [{ key: 'make', title: 'New Title' }],
    { message: 'I build calm tools for quiet communities.', cta: 'Come in' });
  // arrival tagline + one section field applied.
  assert.strictEqual(applied, 2);
  assert.strictEqual(state.tagline, 'I build calm tools for quiet communities.');
  assert.strictEqual(state.sections[0].title, 'New Title');
  // Non-arrival framing untouched.
  assert.strictEqual(state.name, 'Vesna', 'person name untouched');
  assert.strictEqual(state.sections[0].body, 'B', 'unsent field untouched');
  assert.deepStrictEqual(state.sections[0].image, { src: 'x', role: 'hero' },
    'section image untouched');
  assert.strictEqual(state.sections[1].title, 'T', 'other section untouched');
});

test('empty / whitespace arrival never overwrites the existing tagline', () => {
  for (const arrival of [undefined, null, {}, { message: '' }, { message: '   ' },
                         { cta: 'Enter' }]) {
    const state = { tagline: 'kept identity', sections: [mockSection('make')] };
    const applyPrefill = applyPrefillFactory(state);
    applyPrefill([], arrival);
    assert.strictEqual(state.tagline, 'kept identity',
      'blank arrival must not clear the hero tagline: ' + JSON.stringify(arrival));
  }
});

test('arrival applies even when no sections are sent', () => {
  const state = { tagline: 'old', sections: [mockSection('make')] };
  const applyPrefill = applyPrefillFactory(state);
  const applied = applyPrefill([], { message: 'A fresh welcome, in my voice.' });
  assert.strictEqual(applied, 1);
  assert.strictEqual(state.tagline, 'A fresh welcome, in my voice.');
  assert.strictEqual(state.sections[0].title, 'T', 'sections untouched');
});

test('applyPrefill still works with no arrival argument (back-compat)', () => {
  const state = { tagline: 'kept', sections: [mockSection('make')] };
  const applyPrefill = applyPrefillFactory(state);
  const applied = applyPrefill([{ key: 'make', title: 'X' }]);
  assert.strictEqual(applied, 1);
  assert.strictEqual(state.sections[0].title, 'X');
  assert.strictEqual(state.tagline, 'kept', 'no arrival arg → tagline untouched');
});
