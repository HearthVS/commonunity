/* Gene Keys Path legend — static DOM/wiring regression tests for Round 7
   issue 2. No jsdom in this repo, so we assert over studio.html's markup and
   script the same way the other stUdio DOM tests do (see test_fo_view_tabs.js).

   Guards:
   - The info button beside the Gene Keys legend opens a dedicated
     "Gene Keys Path" overlay (Gene Key / Line / Shadow / Gift / Siddhi), NOT
     the Archive overlay, and never feeds Archive content/count.
   - The legend is collapsible with the SAME affordance + aria wiring as the
     Archive drawer, but independent (own class target + own storage key).
   - The Archive drawer itself is untouched and independently collapsible.

   Run: node --test test_genekeys_path.js   (Node 20+, no dependencies) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

// Isolate the Gene Keys legend card (ends where the Archive drawer begins).
function contextCardBlock() {
  const start = HTML.indexOf('id="room-context-card"');
  assert.ok(start > -1, 'room-context-card must exist');
  const open = HTML.lastIndexOf('<div', start);
  const end = HTML.indexOf('class="archive-drawer"', start);
  assert.ok(end > -1, 'archive drawer must follow the legend');
  return HTML.slice(open, end);
}

// Isolate an overlay element by id.
function overlayBlock(id) {
  const start = HTML.indexOf('id="' + id + '"');
  if (start < 0) return null;
  const open = HTML.lastIndexOf('<div', start);
  // Overlays are siblings; slice to the next overlay or the closing script.
  const nextOverlay = HTML.indexOf('class="studio-info-overlay"', start + 1);
  const bound = nextOverlay > -1 ? nextOverlay : HTML.length;
  return HTML.slice(open, bound);
}

/* ---- Info button + overlay content ------------------------------------- */

test('Gene Keys legend info button opens the Gene Keys Path overlay, not the Archive overlay', () => {
  const card = contextCardBlock();
  const infoBtn = /<button[^>]*class="studio-info-btn"[^>]*>/.exec(card);
  assert.ok(infoBtn, 'legend has an info button');
  assert.match(infoBtn[0], /data-info="info-genekeys-path-overlay"/,
    'info button targets the Gene Keys Path overlay');
  assert.doesNotMatch(infoBtn[0], /info-archive-overlay/,
    'info button must NOT reuse the Archive overlay');
  assert.match(infoBtn[0], /aria-label="About the Gene Keys Path"/, 'accessible name present');
});

test('Gene Keys Path overlay exists, is titled "Gene Keys Path", and explains the frequency path', () => {
  const ov = overlayBlock('info-genekeys-path-overlay');
  assert.ok(ov, 'info-genekeys-path-overlay must exist');
  assert.match(ov, /studio-info-popup-title">\s*Gene Keys Path\s*</, 'titled Gene Keys Path');
  for (const term of ['Gene Key', 'Line', 'Shadow', 'Gift', 'Siddhi']) {
    assert.ok(ov.includes(term), `overlay explains ${term}`);
  }
  assert.match(ov, /data-close="info-genekeys-path-overlay"/, 'has its own close control');
});

test('Gene Keys Path overlay does not feed Archive content or an Archive count', () => {
  const ov = overlayBlock('info-genekeys-path-overlay');
  // Archive-overlay signature copy must not leak in.
  assert.doesNotMatch(ov, /The Archive holds everything/, 'no Archive body copy');
  assert.doesNotMatch(ov, /Compass material includes/, 'no Archive body copy');
  assert.doesNotMatch(ov, /archive-total-count|archive-count-/, 'no Archive count wiring');
});

/* ---- Collapse affordance + aria wiring --------------------------------- */

test('Gene Keys Path legend has a collapse toggle with full aria wiring', () => {
  const card = contextCardBlock();
  const toggle = /<button[^>]*id="genekeys-path-toggle"[^>]*>/.exec(card);
  assert.ok(toggle, 'genekeys-path-toggle button exists');
  assert.match(toggle[0], /type="button"/, 'button semantics');
  assert.match(toggle[0], /aria-expanded="(true|false)"/, 'aria-expanded present');
  assert.match(toggle[0], /aria-controls="room-sgs"/, 'aria-controls points at the legend body');
  // Uses the same chevron/title affordance classes as the Archive drawer.
  assert.match(card, /class="archive-drawer-chevron"/, 'shares the chevron affordance');
  assert.match(card, /class="archive-drawer-title">\s*Gene Keys Path\s*</, 'shares the title affordance');
});

test('collapse CSS hides the legend body and rotates the chevron, scoped to the card', () => {
  assert.match(HTML, /\.room-context-card\.is-collapsed \.room-sgs \{ display: none; \}/,
    'collapsing the card hides #room-sgs');
  assert.match(HTML, /\.room-context-card\.is-collapsed \.archive-drawer-chevron \{ transform: rotate\(-90deg\); \}/,
    'collapsing the card rotates the chevron');
});

test('initGeneKeysPathCollapse is defined, wired, and uses an independent storage key', () => {
  assert.match(HTML, /function initGeneKeysPathCollapse\(\)/, 'init function defined');
  assert.match(HTML, /initGeneKeysPathCollapse\(\);/, 'init function called on load');
  const fn = HTML.slice(HTML.indexOf('function initGeneKeysPathCollapse'),
                        HTML.indexOf('function initGeneKeysPathCollapse') + 900);
  assert.match(fn, /'studioGeneKeysPathCollapsed'/, 'own storage key');
  assert.doesNotMatch(fn, /studioArchiveCollapsed/, 'does not touch the Archive key');
  assert.match(fn, /toggle\.setAttribute\('aria-expanded'/, 'keeps aria-expanded in sync on toggle');
  assert.match(fn, /classList\.toggle\('is-collapsed'/, 'toggles the collapse class');
});

/* ---- Archive drawer remains unchanged + independent -------------------- */

test('Archive drawer is untouched and independently collapsible', () => {
  // Archive info button still opens the Archive overlay.
  assert.match(HTML, /class="studio-info-btn" data-info="info-archive-overlay" title="About the Archive"/,
    'Archive info button unchanged');
  // Archive toggle keeps its own aria-controls target.
  assert.match(HTML, /id="archive-drawer-toggle"[^>]*aria-controls="archive-drawer-body"/,
    'Archive toggle controls its own body');
  // Archive overlay content preserved.
  const ov = overlayBlock('info-archive-overlay');
  assert.ok(ov && /The Archive holds everything/.test(ov), 'Archive overlay copy intact');
  // Independent storage key still present in initArchiveCollapse.
  assert.match(HTML, /'studioArchiveCollapsed'/, 'Archive keeps its own storage key');
});
