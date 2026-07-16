/* Field Observations workspace tabs — static wiring regression tests.
   Run: node --test test_fo_view_tabs.js   (Node 20+, no dependencies)

   Guards the invariant that a selected workspace tab can never render a blank
   panel: the switcher resolves a tab's panel via getElementById('fo-view-' +
   dataset.foView), so every tab's data-fo-view slug MUST have a tabpanel with
   the id 'fo-view-<slug>', and the tab's aria-controls MUST point to it. A
   mismatch (e.g. panel id 'fo-view-lde' for slug 'living-digital-expression')
   makes panelFor() return null, leaving the panel hidden — a blank surface. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const HTML = fs.readFileSync(require('node:path').join(__dirname, 'studio.html'), 'utf8');

// Extract the workspace tablist block (role="tablist" aria-label="Field Observations workspace").
function tablistBlock() {
  const start = HTML.indexOf('id="fo-view-tabs"');
  assert.ok(start > -1, 'fo-view-tabs tablist must exist');
  const openDiv = HTML.lastIndexOf('<div', start);
  const end = HTML.indexOf('</div>', start);
  return HTML.slice(openDiv, end);
}

function workspaceTabs() {
  const block = tablistBlock();
  const tabs = [];
  const re = /<button\b[^>]*\bdata-fo-view="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(block))) {
    const tag = m[0];
    const slug = m[1];
    const ac = /\baria-controls="([^"]+)"/.exec(tag);
    tabs.push({ slug, ariaControls: ac ? ac[1] : null, tag });
  }
  return tabs;
}

function hasPanelWithId(id) {
  return new RegExp('id="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*role="tabpanel"').test(HTML) ||
         new RegExp('role="tabpanel"[^>]*id="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(HTML);
}

test('workspace tablist has at least the base view and one project', () => {
  const tabs = workspaceTabs();
  assert.ok(tabs.length >= 2, 'expected base + project tabs');
  assert.ok(tabs.some((t) => t.slug === 'observations'), 'base observations tab present');
  assert.ok(tabs.some((t) => t.slug === 'living-digital-expression'), 'LDE tab present');
});

test('every tab slug maps to a real fo-view-<slug> tabpanel (no blank panel)', () => {
  for (const t of workspaceTabs()) {
    const expectedId = 'fo-view-' + t.slug;
    assert.ok(
      hasPanelWithId(expectedId),
      `tab data-fo-view="${t.slug}" requires a tabpanel id="${expectedId}"; ` +
      `panelFor() resolves by this id, so a mismatch renders a blank panel`
    );
  }
});

test('every tab aria-controls points to its own fo-view-<slug> panel', () => {
  for (const t of workspaceTabs()) {
    const expectedId = 'fo-view-' + t.slug;
    assert.strictEqual(
      t.ariaControls, expectedId,
      `tab data-fo-view="${t.slug}" must have aria-controls="${expectedId}" (got "${t.ariaControls}")`
    );
  }
});
