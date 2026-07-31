/* cOMpass Layer 2 "Core Theme" — multi-line, auto-expanding field.

   Reported: the Core Theme control in The Work → Layer 2 — Synthesis was a
   single-line <input>, so a themed sentence longer than the field width was
   clipped mid-word with no way to see the rest (screenshot: "…and offer the
   piece that" running off the right edge). Long themes arrive routinely from
   Inspire and from restored sessions, so the field has to start two lines tall
   and grow with its content.

   No jsdom in this repo, so the markup and CSS are asserted over index.html the
   same way the other cOMpass DOM tests do, and the SHIPPED autosizeField() is
   extracted and exercised against a stub element (no copies).

   Run: node --test test_compass_theme_multiline.js   (Node 20+, no deps) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const POINTS = ['work', 'lens', 'field', 'call'];

function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' must exist');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

function stubField({ scrollHeight = 0, autosize = true, tagName = 'TEXTAREA' } = {}) {
  const style = {
    height: '',
    removeProperty(prop) { if (prop === 'height') style.height = ''; }
  };
  return { tagName, dataset: autosize ? { autosize: '' } : {}, style, scrollHeight };
}

const autosizeField = new Function(
  extractFn(HTML, 'autosizeField') + '; return autosizeField;'
)();

test('every Core Theme field is a two-line textarea, not a single-line input', () => {
  for (const point of POINTS) {
    assert.ok(
      !new RegExp(`<input[^>]*data-key="${point}\\.theme"`).test(HTML),
      `${point}.theme must no longer be an <input> (it truncates long themes)`
    );
    const m = HTML.match(new RegExp(`<textarea[^>]*data-key="${point}\\.theme"[^>]*>`));
    assert.ok(m, `${point}.theme must be a <textarea>`);
    const tag = m[0];
    assert.match(tag, /class="layer-input"/, `${point}.theme keeps the .layer-input skin`);
    assert.match(tag, /rows="2"/, `${point}.theme shows at least two lines`);
    assert.match(tag, /data-autosize/, `${point}.theme opts into autosizeField()`);
    assert.match(tag, /placeholder="The essential thread…"/, `${point}.theme keeps its placeholder`);
  }
});

test('Inspire stays wired to the Core Theme field', () => {
  for (const point of POINTS) {
    const i = HTML.indexOf(`data-key="${point}.theme"`);
    const btn = HTML.indexOf(`data-inspire-l2="${point}.theme"`, i);
    assert.ok(btn > i && btn - i < 400, `${point}.theme keeps its Inspire button`);
  }
  // Accept fills the field and dispatches input, which is what drives autosize.
  assert.match(
    HTML,
    /const el = document\.querySelector\(`\[data-key="\$\{point\}\.theme"\]`\);\s*\n\s*if \(el\) \{ el\.value = text; el\.dispatchEvent\(new Event\('input'\)\); \}/,
    'Inspire accept must still set the value and dispatch input'
  );
});

test('CSS keeps two lines while the layer panel is hidden', () => {
  const rule = HTML.match(/textarea\.layer-input \{[^}]*\}/);
  assert.ok(rule, 'textarea.layer-input rule must exist');
  assert.match(rule[0], /min-height:\s*calc\(2 \* 1\.7em/, 'min-height covers two lines');
  assert.match(rule[0], /overflow:\s*hidden/, 'no scrollbar on the grown field');
});

test('autosizeField grows the field to its content height', () => {
  const el = stubField({ scrollHeight: 96 });
  autosizeField(el);
  assert.strictEqual(el.style.height, '96px');
});

test('autosizeField leaves the CSS min-height alone when the panel is hidden', () => {
  const el = stubField({ scrollHeight: 0 });
  el.style.height = '120px';
  autosizeField(el);
  assert.strictEqual(el.style.height, '', 'hidden panels measure 0 — fall back to CSS');
});

test('autosizeField never touches fields that did not opt in', () => {
  for (const el of [stubField({ scrollHeight: 400, autosize: false }),
                    stubField({ scrollHeight: 400, tagName: 'INPUT' })]) {
    autosizeField(el);
    assert.strictEqual(el.style.height, '', 'other layer fields keep their own sizing');
  }
});

test('autosize runs on typing, on restore and when a hidden panel is revealed', () => {
  const bind = extractFn(HTML, 'bindDataKeys');
  assert.match(bind, /el\.value = state\.points\[point\]\[field\] \|\| '';\s*\n\s*autosizeField\(el\);/,
    'initial paint sizes the field');
  assert.match(bind, /el\.addEventListener\('input', \(\) => \{\s*\n\s*autosizeField\(el\);/,
    'typing resizes the field');

  const restores = HTML.match(
    /el\.value = state\.points\[point\]\[field\];\s*\n\s*autosizeField\(el\);/g
  ) || [];
  assert.strictEqual(restores.length, 3, 'all three state→DOM refresh loops resize');

  assert.match(extractFn(HTML, 'initLayerTabs'), /autosizeAllFields\(panel\)/,
    'switching to Layer 2 sizes fields that could not be measured while hidden');
  assert.match(extractFn(HTML, 'initCompassTabs'), /autosizeAllFields\(card\)/,
    'switching rooms sizes the newly visible card');
});
