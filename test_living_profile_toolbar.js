/* Living Profile placement — static wiring regression tests.
   Run: node --test test_living_profile_toolbar.js   (Node 20+, no dependencies)

   Guards the invariant that the main Studio toolbar (the room header) no
   longer shows the Living Profile pill, while the entrance screen keeps its
   Living Profile access. Fieldprint is the current priority, so the toolbar
   pill was removed for dashboard de-crowding; entrance access must remain so
   no functionality is lost. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

// Extract the room header block (the main Studio toolbar) so assertions about
// the toolbar cannot be satisfied by markup elsewhere on the screen.
function roomHeaderBlock() {
  const start = HTML.indexOf('<div class="room-header">');
  assert.ok(start > -1, 'room-header (main Studio toolbar) must exist');
  // Room selector frame marks the end of the header controls we care about.
  const end = HTML.indexOf('<!-- Room selector frame -->', start);
  assert.ok(end > start, 'room selector frame must follow the room header');
  return HTML.slice(start, end);
}

function entranceScreenBlock() {
  const start = HTML.indexOf('id="screen-entrance"');
  assert.ok(start > -1, 'screen-entrance must exist');
  const end = HTML.indexOf('<!-- /screen-entrance -->', start);
  assert.ok(end > start, 'screen-entrance must be closed');
  return HTML.slice(start, end);
}

test('main toolbar does not render a Living Profile pill', () => {
  const header = roomHeaderBlock();
  assert.ok(
    !/studio-path-living-profile-header/.test(header),
    'the Living Profile toolbar button (id="studio-path-living-profile-header") must not be in the room header'
  );
  assert.ok(
    !/studio-path-lp-btn/.test(header),
    'the Living Profile pill class (studio-path-lp-btn) must not be in the room header'
  );
});

test('Living Profile toolbar button id is fully removed and unwired', () => {
  assert.ok(
    !HTML.includes('studio-path-living-profile-header'),
    'the toolbar Living Profile button id must not appear anywhere (markup or JS wiring)'
  );
});

test('entrance screen still exposes Living Profile access', () => {
  const entrance = entranceScreenBlock();
  assert.ok(
    /id="living-profile-open-entrance"/.test(entrance),
    'entrance screen must keep the "Preview Living Profile" CTA (id="living-profile-open-entrance")'
  );
  assert.ok(
    /Preview Living Profile/.test(entrance),
    'entrance screen must keep the visible "Preview Living Profile" label'
  );
});

test('entrance Living Profile CTA stays wired to openLivingProfile', () => {
  assert.ok(
    /getElementById\('living-profile-open-entrance'\)/.test(HTML) &&
      /lpEntranceBtn\.addEventListener\('click', openLivingProfile\)/.test(HTML),
    'entrance Living Profile CTA must remain wired to openLivingProfile'
  );
});
