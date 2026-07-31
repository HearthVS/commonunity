/* stUdio entrance U mark — static guards.

   The entrance screen carries the stUdio U in the upper-left corner of the
   portal (Fieldprint) column. It is deliberately a quiet spatial signature:
   glyph-only, small, dimmed, static and inert. Every one of those properties
   is easy to erode by accident — swapping the <use> for the favicon file drags
   the rounded #0b1120 tile back in and turns the mark into a button-looking
   badge; dropping aria-hidden makes the page announce "CommonUnity Studio"
   twice (the sidebar wordmark already carries it).

   Run: node --test test_entrance_studio_mark.js   (Node 20+, no deps) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');
const FAVICON = fs.readFileSync(path.join(__dirname, 'favicon-studio.svg'), 'utf8');

// The <svg class="entrance-mark" ...> tag as authored in the entrance column.
const MARK_TAG = /<svg class="entrance-mark"[^>]*>[\s\S]*?<\/svg>/;
// The .entrance-mark base rule (first declaration block after the selector).
const MARK_RULE = /\.entrance-mark\s*\{([^}]*)\}/;
// The .entrance-mark override inside the <=600px entrance media query.
const MARK_RULE_MOBILE = /@media \(max-width: 600px\) \{\s*\.entrance-mark\s*\{([^}]*)\}/;

function px(block, prop) {
  const m = new RegExp(`(?:^|;|\\{)\\s*${prop}:\\s*([^;]+);`).exec(block);
  assert.ok(m, `${prop} is declared`);
  const n = /(\d+(?:\.\d+)?)px/.exec(m[1]);
  assert.ok(n, `${prop} resolves to a px value (got "${m[1].trim()}")`);
  return parseFloat(n[1]);
}

test('the mark renders inside the portal column, ahead of the portal', () => {
  const entranceLeft = HTML.indexOf('<div class="entrance-left">');
  const mark = HTML.indexOf('<svg class="entrance-mark"');
  const portal = HTML.indexOf('<div class="portal-wrap"');
  assert.ok(entranceLeft !== -1, '.entrance-left exists');
  assert.ok(mark > entranceLeft && mark < portal,
    'mark sits in .entrance-left before .portal-wrap, so the portal paints over it');
  // Not in the already-crowded right masthead.
  assert.ok(mark < HTML.indexOf('<div class="entrance-right"'),
    'mark is not in the right sidebar');
});

test('the mark reuses the U glyph without the favicon tile', () => {
  const tag = MARK_TAG.exec(HTML);
  assert.ok(tag, '.entrance-mark svg exists');
  assert.match(tag[0], /<use href="#studio-u-mark"\/?>/, 'draws the shared symbol');
  assert.doesNotMatch(tag[0], /favicon-studio\.svg/, 'no <img>/href to the tiled favicon');

  const symbol = /<symbol id="studio-u-mark"[\s\S]*?<\/symbol>/.exec(HTML);
  assert.ok(symbol, '#studio-u-mark symbol is defined');
  // Glyph-only: the vessel path is carried over verbatim, the tile is not.
  const vessel = /d="(M30 26 V52[^"]*)"/.exec(FAVICON);
  assert.ok(vessel, 'favicon still defines the U vessel path');
  assert.ok(symbol[0].includes(vessel[1]), 'symbol keeps the favicon U geometry in sync');
  assert.doesNotMatch(symbol[0], /<rect/, 'no rounded background tile');
  assert.doesNotMatch(symbol[0], /rx=/, 'no rounded background tile');
});

test('the mark stays a quiet signature, not a focal point', () => {
  const base = MARK_RULE.exec(HTML);
  assert.ok(base, '.entrance-mark rule exists');
  const b = base[1];

  assert.strictEqual(px(b, 'width'), px(b, 'height'), 'square');
  const size = px(b, 'width');
  assert.ok(size >= 28 && size <= 32, `desktop size ${size}px within 28–32px`);
  for (const side of ['top', 'left']) {
    const inset = px(b, side);
    assert.ok(inset >= 28 && inset <= 36, `desktop ${side} inset ${inset}px within 28–36px`);
  }
  const opacity = parseFloat(/opacity:\s*([\d.]+)/.exec(b)[1]);
  assert.ok(opacity >= 0.7 && opacity <= 0.8, `opacity ${opacity} within 0.70–0.80`);
  assert.match(b, /position:\s*absolute/, 'positioned in the corner of the column');
});

test('the mark shrinks and respects safe-area insets on narrow screens', () => {
  const mobile = MARK_RULE_MOBILE.exec(HTML);
  assert.ok(mobile, '.entrance-mark has a <=600px override');
  const m = mobile[1];

  const size = px(m, 'width');
  assert.strictEqual(size, px(m, 'height'), 'square');
  assert.ok(size >= 26 && size <= 28, `mobile size ${size}px within 26–28px`);
  for (const [side, inset] of [['top', 'top'], ['left', 'left']]) {
    const decl = new RegExp(`${side}:\\s*max\\(\\s*(\\d+)px,\\s*env\\(safe-area-inset-${inset}[^)]*\\)\\s*\\)`).exec(m);
    assert.ok(decl, `${side} is max(<px>, env(safe-area-inset-${inset}))`);
    const n = parseInt(decl[1], 10);
    assert.ok(n >= 20 && n <= 24, `mobile ${side} inset ${n}px within 20–24px`);
  }

  // The override must follow the base rule: the entrance media queries are
  // authored above the base selectors in this sheet, and equal specificity
  // means source order decides.
  assert.ok(HTML.indexOf(mobile[0]) > HTML.search(MARK_RULE),
    'mobile override is declared after the base rule');
});

test('the mark is inert and silent to assistive tech', () => {
  const tag = MARK_TAG.exec(HTML)[0];
  assert.match(tag, /aria-hidden="true"/, 'decorative — hidden from screen readers');
  assert.match(tag, /focusable="false"/, 'not a tab stop in legacy engines');
  assert.doesNotMatch(tag, /<a\b|<button\b|onclick|role="button"|tabindex/,
    'not interactive');
  assert.doesNotMatch(tag, /aria-label|<title>/,
    'no announcement — the sidebar wordmark already names the Studio');

  const base = MARK_RULE.exec(HTML)[1];
  assert.match(base, /pointer-events:\s*none/, 'never intercepts portal input');
  assert.doesNotMatch(base, /animation|transition/, 'no pulsing or looping motion');
  assert.doesNotMatch(base, /background|border|box-shadow/,
    'glyph-only — no button-like or tile-like treatment');
});
