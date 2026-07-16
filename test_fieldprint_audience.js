/* FieldPrint audience + evidence context — pure model-layer regression tests.
   Run: node --test test_fieldprint_audience.js   (Node 20+, no dependencies)

   Extracts the shipped pure helpers cuAudienceContext / cuEvidenceContext from
   studio.html (no copy) and verifies:
   - The global audience Spark question and builder field are present and worded
     exactly as agreed.
   - cuAudienceContext maps the two Spark answers (audience, threshold) onto the
     five-key Nexus contract, uses the most-recent capture, and stays empty when
     nothing was answered.
   - cuEvidenceContext surfaces only voluntarily-provided profile evidence
     (work_background, education), never the frozen cOMpass baseline, and
     flattens both array and string shapes.
   - Building context never mutates the state it reads (no baseline mutation). */
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

const NAMES = ['cuAudienceContext', 'cuEvidenceContext'];
const M = new Function(NAMES.map(extractFn).join('\n') + '\nreturn {' + NAMES.join(',') + '};')();

// ── Source presence: the one global audience question, worded as agreed ──────
const AUDIENCE_Q = 'Who do you most hope will find you here, and what kind of connection would you welcome with them?';

test('SPARK_LIBRARY carries the global audience prompt on the profile builder', () => {
  assert.ok(HTML.includes("id: 'sp-profile-audience'"), 'audience Spark entry exists');
  assert.ok(HTML.includes(AUDIENCE_Q), 'audience Spark uses the agreed wording');
  // It is a profile (Level-1, global) builder target, not per-room website/os.
  const i = HTML.indexOf("id: 'sp-profile-audience'");
  const line = HTML.slice(i, HTML.indexOf('\n', i));
  assert.ok(line.includes("builder: 'profile'"), 'audience Spark is global (profile layer)');
  assert.ok(line.includes("target: 'audience'"), 'audience Spark targets the audience field');
});

test('BUILDER_STANDARD.profile has the audience field', () => {
  assert.ok(HTML.includes("id: 'audience'"), 'audience builder field exists');
  assert.ok(HTML.includes('Audience · who this is for'), 'audience field is labelled');
});

// ── cuAudienceContext ────────────────────────────────────────────────────────
function cap(excerpt) { return { at: 't', prompt: 'p', excerpt: excerpt }; }

test('cuAudienceContext maps two Spark answers onto the five-key contract', () => {
  const st = { builder: { captures: {
    audience: [cap('Practitioners in early recovery who want honest guidance.')],
    threshold: [cap('Land calm, understand this is a real practice, book a first call.')],
  } } };
  const ctx = M.cuAudienceContext(st);
  assert.strictEqual(ctx.people_to_reach, 'Practitioners in early recovery who want honest guidance.');
  assert.strictEqual(ctx.connection_welcomed, ctx.people_to_reach, 'the audience answer covers who + connection');
  assert.strictEqual(ctx.visitor_should_understand, 'Land calm, understand this is a real practice, book a first call.');
  assert.strictEqual(ctx.visitor_should_feel, ctx.visitor_should_understand);
  assert.strictEqual(ctx.visitor_should_do, ctx.visitor_should_understand);
  // Exactly the five agreed keys, nothing invented.
  assert.deepStrictEqual(Object.keys(ctx).sort(), [
    'connection_welcomed', 'people_to_reach',
    'visitor_should_do', 'visitor_should_feel', 'visitor_should_understand',
  ]);
});

test('cuAudienceContext uses the most-recent capture and skips empties', () => {
  const st = { builder: { captures: {
    audience: [cap('old answer'), cap('newest answer')],
  } } };
  const ctx = M.cuAudienceContext(st);
  assert.strictEqual(ctx.people_to_reach, 'newest answer', 'latest excerpt wins');
  assert.ok(!('visitor_should_feel' in ctx), 'no threshold answer → no visitor_* keys');
});

test('cuAudienceContext is empty when nothing is answered', () => {
  assert.deepStrictEqual(M.cuAudienceContext({}), {});
  assert.deepStrictEqual(M.cuAudienceContext({ builder: { captures: {} } }), {});
  assert.deepStrictEqual(M.cuAudienceContext(null), {});
});

// ── cuEvidenceContext ────────────────────────────────────────────────────────
test('cuEvidenceContext surfaces voluntarily-provided profile evidence only', () => {
  const st = { compassData: { profile: {
    work_background: 'Ten years leading community programmes.',
    education: 'BA Anthropology, Leeds.',
  } } };
  const ev = M.cuEvidenceContext(st);
  assert.strictEqual(ev.work_background, 'Ten years leading community programmes.');
  assert.strictEqual(ev.education, 'BA Anthropology, Leeds.');
  assert.deepStrictEqual(ev.documents, [], 'documents reserved for future uploads');
});

test('cuEvidenceContext flattens array-shaped work/education', () => {
  const st = { compassData: { profile: {
    work_background: [{ role: 'Facilitator', company: 'Hearth' }, 'Independent coach'],
    education: [{ degree: 'MSc', institution: 'UCL' }],
  } } };
  const ev = M.cuEvidenceContext(st);
  assert.ok(ev.work_background.includes('Facilitator, Hearth'));
  assert.ok(ev.work_background.includes('Independent coach'));
  assert.ok(ev.education.includes('MSc, UCL'));
});

test('cuEvidenceContext never reads the frozen cOMpass baseline', () => {
  const st = {
    compassBaseline: { profile: { work_background: 'BASELINE SECRET' } },
    compassData: { profile: { work_background: 'draft-provided background' } },
  };
  const ev = M.cuEvidenceContext(st);
  assert.strictEqual(ev.work_background, 'draft-provided background');
  assert.ok(!JSON.stringify(ev).includes('BASELINE SECRET'), 'baseline is never a source of evidence');
});

// ── No mutation of the read state ────────────────────────────────────────────
test('building context does not mutate the state it reads', () => {
  const st = {
    compassBaseline: { profile: { work_background: 'orig' } },
    compassData: { profile: { work_background: 'wb', education: 'ed' } },
    builder: { captures: { audience: [cap('who')], threshold: [cap('arrival')] } },
  };
  const before = JSON.stringify(st);
  M.cuAudienceContext(st);
  M.cuEvidenceContext(st);
  assert.strictEqual(JSON.stringify(st), before, 'state is unchanged after building context');
});
