/* Beta hub announcement linkification (beta/beta.js + beta/beta.css).
 * Run: node --test tests/beta-announce-linkify.test.js   (Node 20+, no deps)
 *
 * The private beta hub renders admin-authored announcement bodies in
 * messageItem(). Plain-text http/https URLs must become clickable <a> elements
 * built from DOM nodes (never innerHTML, never HTML-parsed body text), so no
 * admin input can inject markup and only http/https ever becomes a link
 * ("javascript:" stays inert text). These tests execute the real el /
 * splitTrailingPunct / linkifyInto helpers extracted from beta/beta.js against a
 * minimal DOM shim, and statically assert the rendering wiring + link styling.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const JS = fs.readFileSync(path.join(root, 'beta', 'beta.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'beta', 'beta.css'), 'utf8');

// Extract a named function's full source via brace matching.
function extractFunction(name) {
  const decl = 'function ' + name + '(';
  const start = JS.indexOf(decl);
  assert.ok(start > -1, `expected ${name} in beta/beta.js`);
  const braceStart = JS.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < JS.length; i++) {
    const c = JS[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return JS.slice(start, i + 1); }
  }
  throw new Error(`unterminated function ${name}`);
}

// Minimal DOM shim: enough for el()/linkifyInto() (createElement, className,
// setAttribute, appendChild, createTextNode, textContent aggregation).
function makeDoc() {
  function element(tag) {
    return {
      tag, nodeType: 1, className: '', attrs: {}, childNodes: [],
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener() {},
      appendChild(c) { this.childNodes.push(c); return c; },
      get textContent() {
        return this.childNodes.map(n => n.nodeType === 3 ? n.textContent : n.textContent).join('');
      },
    };
  }
  return {
    createElement: element,
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
  };
}

const shimDoc = makeDoc();
const src = [
  extractFunction('el'),
  extractFunction('splitTrailingPunct'),
  extractFunction('linkifyInto'),
  'return { el, splitTrailingPunct, linkifyInto };',
].join('\n');
// eslint-disable-next-line no-new-func
const helpers = new Function('document', src)(shimDoc);

function renderBody(text) {
  const p = helpers.el('p', { class: 'beta-announce-body' });
  helpers.linkifyInto(p, text);
  return p;
}
const anchors = (p) => p.childNodes.filter(n => n.nodeType === 1 && n.tag === 'a');

test('a single URL becomes an anchor with safe attributes', () => {
  const p = renderBody('See https://example.com for details');
  const a = anchors(p);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].attrs.href, 'https://example.com');
  assert.strictEqual(a[0].attrs.target, '_blank');
  assert.strictEqual(a[0].attrs.rel, 'noopener noreferrer');
  assert.strictEqual(a[0].className, 'beta-announce-link');
  assert.strictEqual(a[0].textContent, 'https://example.com');
  assert.strictEqual(p.textContent, 'See https://example.com for details');
});

test('http and https both linkify; multiple URLs each become anchors', () => {
  const p = renderBody('a http://one.test b https://two.test c');
  const a = anchors(p);
  assert.strictEqual(a.length, 2);
  assert.deepStrictEqual(a.map(x => x.attrs.href), ['http://one.test', 'https://two.test']);
});

test('trailing punctuation is not swallowed into the URL', () => {
  const dot = renderBody('Visit https://example.com.');
  assert.strictEqual(anchors(dot)[0].attrs.href, 'https://example.com');
  assert.strictEqual(dot.textContent, 'Visit https://example.com.');

  const comma = renderBody('Links https://a.test, and more');
  assert.strictEqual(anchors(comma)[0].attrs.href, 'https://a.test');

  const paren = renderBody('(see https://a.test)');
  assert.strictEqual(anchors(paren)[0].attrs.href, 'https://a.test');
  assert.strictEqual(paren.textContent, '(see https://a.test)');
});

test('balanced parentheses inside a URL are preserved', () => {
  const p = renderBody('https://en.wikipedia.org/wiki/Foo_(bar) end');
  assert.strictEqual(anchors(p)[0].attrs.href, 'https://en.wikipedia.org/wiki/Foo_(bar)');
});

test('line breaks and surrounding text survive as text nodes', () => {
  const p = renderBody('line one\nhttps://a.test\nline three');
  assert.strictEqual(anchors(p).length, 1);
  assert.strictEqual(p.textContent, 'line one\nhttps://a.test\nline three');
});

test('javascript: is NOT linkified and stays inert text', () => {
  const p = renderBody('do not click javascript:alert(1) please');
  assert.strictEqual(anchors(p).length, 0);
  assert.strictEqual(p.textContent, 'do not click javascript:alert(1) please');
});

test('HTML in the body is never parsed — it is added as a text node', () => {
  const p = renderBody('<img src=x onerror=alert(1)> https://a.test');
  // The only element child is the real anchor; the "<img...>" is plain text.
  assert.strictEqual(anchors(p).length, 1);
  const textOnly = p.childNodes.filter(n => n.nodeType === 3).map(n => n.textContent).join('');
  assert.ok(textOnly.includes('<img src=x onerror=alert(1)>'));
});

test('renderer wiring + link styling are present in source', () => {
  // messageItem builds the body through linkifyInto (DOM), not raw text/innerHTML.
  assert.match(JS, /linkifyInto\(el\(\s*'p',\s*\{\s*class:\s*'beta-announce-body'\s*\}\s*\),\s*m\.body\)/);
  // Only http/https are matched.
  assert.match(JS, /https\?:\\\/\\\/\[\^\\s<\]\+/);
  // Long-URL wrapping for mobile + a keyboard focus affordance.
  assert.match(CSS, /\.beta-announce-link\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(CSS, /\.beta-announce-link\s*\{[^}]*word-break:\s*break-word/);
  assert.match(CSS, /\.beta-announce-link:focus-visible\s*\{[^}]*outline/);
});
