/* Announcement linkification — behavioural + static tests for the beta hub.
   Run: node --test test_announcement_linkify.js   (Node 20+, no dependencies)

   The participant Announcements feed renders admin-authored bodies. Plain-text
   http/https URLs must become clickable <a> elements WITHOUT ever rendering raw
   admin HTML: every non-URL run and every URL is HTML-escaped, and only
   http/https ever matches (so "javascript:" stays inert text). These tests
   extract the real escapeHtml/splitTrailingPunct/linkifyMessageBody helpers
   from index.html and exercise them, plus assert the link styling/security
   affordances are present in the markup/CSS. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Extract a named function's full source via brace matching, starting from the
// LAST occurrence of its declaration (the feed helpers live in the comm IIFE).
function extractFunction(name) {
  const decl = 'function ' + name + '(';
  const start = HTML.lastIndexOf(decl);
  assert.ok(start > -1, `expected ${name} to exist in index.html`);
  const braceStart = HTML.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < HTML.length; i++) {
    const c = HTML[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return HTML.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

// Build a sandbox exposing the three real helpers.
const src = [
  extractFunction('escapeHtml'),
  extractFunction('splitTrailingPunct'),
  extractFunction('linkifyMessageBody'),
  'return { escapeHtml, splitTrailingPunct, linkifyMessageBody };',
].join('\n');
// eslint-disable-next-line no-new-func
const { linkifyMessageBody } = new Function(src)();

test('single URL becomes a clickable link with safe attributes', () => {
  const out = linkifyMessageBody('See https://example.com for details');
  assert.match(out, /<a href="https:\/\/example\.com"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(out, /class="cu-msg-link"/);
  assert.match(out, /See /);
  assert.match(out, /for details/);
});

test('http and https both linkify; multiple URLs each become links', () => {
  const out = linkifyMessageBody('a http://one.test b https://two.test c');
  const links = out.match(/<a /g) || [];
  assert.strictEqual(links.length, 2, 'both URLs should be links');
  assert.match(out, /href="http:\/\/one\.test"/);
  assert.match(out, /href="https:\/\/two\.test"/);
});

test('trailing punctuation is not swallowed into the URL', () => {
  const dot = linkifyMessageBody('Visit https://example.com.');
  assert.match(dot, /href="https:\/\/example\.com"/);
  // The period stays as text outside the anchor.
  assert.match(dot, /<\/a>\./);

  const comma = linkifyMessageBody('Links https://a.test, and more');
  assert.match(comma, /href="https:\/\/a\.test"/);
  assert.match(comma, /<\/a>,/);

  const paren = linkifyMessageBody('(see https://a.test)');
  assert.match(paren, /href="https:\/\/a\.test"/);
  assert.match(paren, /<\/a>\)/);
});

test('balanced parentheses inside a URL are preserved', () => {
  const out = linkifyMessageBody('https://en.wikipedia.org/wiki/Foo_(bar) end');
  assert.match(out, /href="https:\/\/en\.wikipedia\.org\/wiki\/Foo_\(bar\)"/);
});

test('line breaks and surrounding text are preserved', () => {
  const out = linkifyMessageBody('line one\nhttps://a.test\nline three');
  assert.match(out, /line one\n/);
  assert.match(out, /\nline three/);
  assert.match(out, /href="https:\/\/a\.test"/);
});

test('javascript: URLs are NOT linkified and are escaped as inert text', () => {
  const out = linkifyMessageBody('do not click javascript:alert(1) please');
  assert.doesNotMatch(out, /<a /, 'no anchor should be produced');
  assert.doesNotMatch(out, /href="javascript:/i);
  // The literal text survives (parenthesis/quote escaping aside).
  assert.match(out, /javascript:alert\(1\)/);
});

test('HTML in the body is escaped, never rendered', () => {
  const out = linkifyMessageBody('<img src=x onerror=alert(1)> https://a.test');
  assert.doesNotMatch(out, /<img/);
  assert.match(out, /&lt;img/);
  // The real link is still produced.
  assert.match(out, /<a href="https:\/\/a\.test"/);
});

test('a URL containing a quote cannot break out of the href attribute', () => {
  const out = linkifyMessageBody('https://a.test/"onmouseover="x');
  // The double-quote is escaped, so the attribute stays intact.
  assert.doesNotMatch(out, /href="https:\/\/a\.test\/"onmouseover/);
  assert.match(out, /&quot;/);
});

test('feed markup uses the linkifier and defines link styling/affordances', () => {
  // The renderer must pass bodies through linkifyMessageBody (not raw escapeHtml).
  assert.match(HTML, /cu-msg-body">\$\{linkifyMessageBody\(/);
  // Long-URL wrapping for mobile + a keyboard focus affordance.
  assert.match(HTML, /\.cu-msg-link\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(HTML, /\.cu-msg-link\s*\{[^}]*word-break:\s*break-word/);
  assert.match(HTML, /\.cu-msg-link:focus-visible\s*\{[^}]*outline/);
});
