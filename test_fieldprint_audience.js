/* FieldPrint audience + evidence context — pure model-layer regression tests.
   Run: node --test test_fieldprint_audience.js   (Node 20+, no dependencies)

   Extracts the shipped pure helpers cuAudienceContext / cuEvidenceContext from
   studio.html (no copy) and verifies:
   - The global audience Spark question and builder field are present and worded
     exactly as agreed.
   - cuAudienceContext strips the composed-note scaffolding ("> <prompt>") from
     each Spark answer and sends the person's answer once under a canonical
     statement key (audience_statement / arrival_statement) — never duplicating
     one combined answer across the specific facet keys. It uses the most-recent
     capture and stays empty when nothing was answered.
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

const NAMES = ['cuCleanCaptureText', 'cuAudienceContext', 'cuEvidenceContext'];
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

// ── cuCleanCaptureText ───────────────────────────────────────────────────────
// A real Spark capture stores the composed note "> <prompt>\n\n<answer>", so its
// excerpt carries the question as a leading blockquote. `cap()` models that.
function cap(prompt, answer) {
  return { at: 't', prompt: prompt, excerpt: '> ' + prompt + '\n\n' + answer };
}

test('cuCleanCaptureText strips the leading blockquote prompt scaffolding', () => {
  const prompt = 'Who do you most hope will find you here?';
  const raw = '> ' + prompt + '\n\nIndependent makers who value craft.';
  assert.strictEqual(
    M.cuCleanCaptureText(raw, prompt),
    'Independent makers who value craft.',
    'only the person\'s answer survives — no question text, no leading quote');
});

test('cuCleanCaptureText drops an unquoted leading copy of the prompt too', () => {
  const prompt = 'What should a visitor feel?';
  const raw = prompt + '\n\nCalm, and that this is real.';
  assert.strictEqual(M.cuCleanCaptureText(raw, prompt), 'Calm, and that this is real.');
});

test('cuCleanCaptureText leaves a clean answer untouched', () => {
  assert.strictEqual(M.cuCleanCaptureText('Just the answer.', 'unrelated prompt'), 'Just the answer.');
  assert.strictEqual(M.cuCleanCaptureText('', 'p'), '');
  assert.strictEqual(M.cuCleanCaptureText(null, null), '');
});

// ── cuAudienceContext ────────────────────────────────────────────────────────
test('cuAudienceContext sends one canonical statement per Spark answer, scaffolding stripped', () => {
  const st = { builder: { captures: {
    audience: [cap('Who do you most hope will find you here, and what connection would you welcome?',
                   'Practitioners in early recovery who want honest guidance.')],
    threshold: [cap('When someone arrives, what should they feel, know, and do?',
                    'Land calm, understand this is a real practice, book a first call.')],
  } } };
  const ctx = M.cuAudienceContext(st);
  // Canonical statements only — the person's answer, once, question text stripped.
  assert.strictEqual(ctx.audience_statement, 'Practitioners in early recovery who want honest guidance.');
  assert.strictEqual(ctx.arrival_statement, 'Land calm, understand this is a real practice, book a first call.');
  assert.ok(!ctx.audience_statement.includes('Who do you most hope'), 'no question scaffolding leaks');
  // The specific facet keys are NOT populated by duplicating one combined answer.
  assert.deepStrictEqual(Object.keys(ctx).sort(), ['arrival_statement', 'audience_statement']);
  ['people_to_reach', 'connection_welcomed',
   'visitor_should_understand', 'visitor_should_feel', 'visitor_should_do'
  ].forEach((k) => assert.ok(!(k in ctx), k + ' must not be duplicated from a combined answer'));
});

test('cuAudienceContext does not duplicate one answer across keys', () => {
  const st = { builder: { captures: {
    audience: [cap('who prompt', 'Only this one line.')],
  } } };
  const ctx = M.cuAudienceContext(st);
  // Exactly one key, one occurrence — no fan-out into who/connection facets.
  assert.deepStrictEqual(ctx, { audience_statement: 'Only this one line.' });
  assert.strictEqual(JSON.stringify(ctx).split('Only this one line.').length - 1, 1,
    'the answer is transmitted exactly once');
});

test('cuAudienceContext uses the most-recent capture and skips empties', () => {
  const st = { builder: { captures: {
    audience: [cap('who prompt', 'old answer'), cap('who prompt', 'newest answer')],
  } } };
  const ctx = M.cuAudienceContext(st);
  assert.strictEqual(ctx.audience_statement, 'newest answer', 'latest excerpt wins');
  assert.ok(!('arrival_statement' in ctx), 'no threshold answer → no arrival_statement');
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
  assert.deepStrictEqual(ev.documents, [], 'no profile.documents → empty list');
});

test('cuEvidenceContext surfaces a document summary as safe extracted evidence', () => {
  const st = { compassData: { profile: {
    documents: [{ type: 'cv', name: 'profile-cv.pdf',
                  summary: 'Product development across three startups.',
                  // Raw/private byte fields must be ignored entirely.
                  content: 'RAW SEALED FILE BYTES', data: 'MORE RAW BYTES' }],
  } } };
  const ev = M.cuEvidenceContext(st);
  assert.strictEqual(ev.documents.length, 1);
  assert.strictEqual(ev.documents[0].text, 'Product development across three startups.',
    'the derived summary is used as the document text');
  assert.strictEqual(ev.documents[0].label, 'profile-cv.pdf');
  assert.strictEqual(ev.documents[0].source, 'cv');
  const raw = JSON.stringify(ev);
  assert.ok(!raw.includes('RAW SEALED FILE BYTES'), 'raw content bytes are never forwarded');
  assert.ok(!raw.includes('MORE RAW BYTES'), 'arbitrary raw fields are never forwarded');
});

test('cuEvidenceContext falls back to extracted text and skips empty documents', () => {
  const st = { compassData: { profile: {
    documents: [
      { text: 'Already extracted body.', name: 'a.txt' },  // summary absent → text used
      { name: 'empty.pdf' },                                // no text/summary → skipped
      'not-an-object',                                       // non-object → skipped
    ],
  } } };
  const ev = M.cuEvidenceContext(st);
  assert.strictEqual(ev.documents.length, 1);
  assert.strictEqual(ev.documents[0].text, 'Already extracted body.');
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
    builder: { captures: { audience: [cap('who prompt', 'who')], threshold: [cap('arrival prompt', 'arrival')] } },
  };
  const before = JSON.stringify(st);
  M.cuAudienceContext(st);
  M.cuEvidenceContext(st);
  assert.strictEqual(JSON.stringify(st), before, 'state is unchanged after building context');
});
