/* FieldPrint Builder handoff — pure mapping + non-destructive prefill tests.
   Run: node --test test_fieldprint_handoff.js   (Node 20+, no dependencies)

   Verifies the two ends of the "Send to FieldPrint Builder" bridge:
   - studio.html buildHandoffSections(): FieldPrint fields → Builder section
     content, keyed by section key, with Theme intentionally omitted (no slot).
   - fieldprint.js applyPrefill(): merges ONLY the named fields of matching
     sections and leaves hero framing / role / image / unselected fields alone. */
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

const ROOM_META = {
  work:  { title: 'The Work' }, lens: { title: 'The Lens' },
  field: { title: 'The Field' }, call: { title: 'The Call' },
};

function handoffFactory(state) {
  const deps = ['cuFpStr', 'cuFpList', 'cuNormalizeFieldprintPoint']
    .map((n) => extractFrom(HTML, n)).join('\n');
  const body = deps + '\n' + extractFrom(HTML, 'buildHandoffSections') +
    '\nreturn buildHandoffSections;';
  return new Function('ROOMS', 'ROOM_META', 'window', body)(
    ['work', 'lens', 'field', 'call'], ROOM_META, { state: state });
}

test('handoff maps FieldPrint fields to Builder section keys, omitting Theme', () => {
  const state = { compassData: { points: {
    work: { web_heading: 'Head', web_intro: 'Intro', summary: 'Summ', web_closing: 'Close',
            theme: 'Themey', highlights: ['h1'], insights: ['i1'] },
  } } };
  const rows = handoffFactory(state)();
  const work = rows.find((r) => r.room === 'work');
  assert.strictEqual(work.secKey, 'make', 'work → make section');
  const byKey = Object.fromEntries(work.fields.map((f) => [f.key, f]));
  assert.strictEqual(byKey.title.value, 'Head');
  assert.strictEqual(byKey.body.value, 'Intro');
  assert.strictEqual(byKey.narrative.value, 'Summ');
  assert.strictEqual(byKey.prompt.value, 'Close');
  assert.ok(!('theme' in byKey), 'Theme has no Builder slot and is omitted');
  const arts = byKey.artifacts.value;
  assert.deepStrictEqual(arts.map((a) => a.tag), ['Signal', 'Insight']);
  assert.deepStrictEqual(arts.map((a) => a.title), ['h1', 'i1']);
});

test('a raw-only Work point produces no handoff row and never leaks raw text', () => {
  const RAW = '--- From transcript... [Guide: hi] this is the raw reflection';
  const state = { compassData: { points: {
    // Only `raw` present — no structured publishable fields.
    work: { gk_num: 5, gk_line: 5, raw: RAW },
    // A sibling room with real content proves selection, not a global empty.
    lens: { summary: 'real summary' },
  } } };
  const rows = handoffFactory(state)();
  assert.ok(!rows.some((r) => r.room === 'work'),
    'raw-only Work has no structured fields → no handoff row');
  assert.ok(!JSON.stringify(rows).includes(RAW),
    'the raw transcript text never appears anywhere in the handoff payload');
  assert.ok(!/transcript|Guide:/.test(JSON.stringify(rows)),
    'no transcript/raw markers leak into the payload');
});

test('rooms map to make/perceive/alive/here and empty fields are dropped', () => {
  const state = { compassData: { points: {
    work: {}, lens: { summary: 'only summary' }, field: {}, call: {},
  } } };
  const rows = handoffFactory(state)();
  // work/field/call have nothing → no rows; lens has one field.
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].secKey, 'perceive');
  assert.deepStrictEqual(rows[0].fields.map((f) => f.key), ['narrative']);
});

function applyPrefillFactory(state) {
  return new Function('state',
    extractFrom(FPJS, 'applyPrefill') + '\nreturn applyPrefill;')(state);
}

function mockSection(key, over) {
  return Object.assign({
    key: key, sig: key, eyebrow: 'EB', title: 'T', body: 'B', role: 'root',
    imgRole: 'inset', enter: 'Enter', narrative: 'N', artifacts: [{ tag: 'Signal', title: 'old', note: '' }],
    prompt: 'P', image: { src: 'x', role: 'hero' },
  }, over || {});
}

test('prefill applies only named fields and preserves framing/role/image', () => {
  const state = { sections: [mockSection('make'), mockSection('perceive')] };
  const applyPrefill = applyPrefillFactory(state);
  const applied = applyPrefill([
    { key: 'make', title: 'New Title', narrative: 'New Narrative' },
  ]);
  assert.strictEqual(applied, 2, 'title + narrative applied');
  const make = state.sections[0];
  assert.strictEqual(make.title, 'New Title');
  assert.strictEqual(make.narrative, 'New Narrative');
  // Untouched fields preserved.
  assert.strictEqual(make.body, 'B', 'unselected body untouched');
  assert.strictEqual(make.eyebrow, 'EB');
  assert.strictEqual(make.role, 'root', 'palette role preserved');
  assert.deepStrictEqual(make.image, { src: 'x', role: 'hero' }, 'image preserved');
  // Other section entirely untouched.
  assert.strictEqual(state.sections[1].title, 'T');
});

test('prefill rebuilds artifacts list when provided, ignoring empty entries', () => {
  const state = { sections: [mockSection('alive')] };
  const applyPrefill = applyPrefillFactory(state);
  applyPrefill([{ key: 'alive', artifacts: [
    { tag: 'Insight', title: 'kept', note: 'n' }, { title: '' }, null,
  ] }]);
  assert.deepStrictEqual(state.sections[0].artifacts, [{ tag: 'Insight', title: 'kept', note: 'n' }]);
});

test('prefill ignores unknown section keys and counts nothing', () => {
  const state = { sections: [mockSection('make')] };
  const applyPrefill = applyPrefillFactory(state);
  assert.strictEqual(applyPrefill([{ key: 'nope', title: 'x' }]), 0);
  assert.strictEqual(state.sections[0].title, 'T', 'no match → no change');
});
