// Focused tests for the hOMe Workbench shell (the primary hOMe work
// surface introduced by feat/home-workbench-shell). Follows the same
// pattern as tests/home-language-firewall.test.mjs and
// tests/muse-projects.test.mjs: studio.html is a ~1MB single-file SPA
// with canvas / DOM / LLM dependencies and no bundler, so we do not
// boot the page in jsdom. Instead we:
//   1. Statically assert the entry-point CTA + Workbench markup exist
//      in studio.html (three columns, key element ids, aria wiring).
//   2. Extract the HOME_WORKBENCH_JS sentinel block verbatim and
//      evaluate it in a hand-rolled stub environment so we can exercise
//      the pure functions (phWorkbenchSaveActiveSection routes through
//      phWriteRoomCapture; phWorkbenchPullSource appends to draftBody
//      instead of clobbering; phWorkbenchRefreshPreview uses the
//      firewall-guarded phPublicHomeModel → phRenderPublicHome path).
//   3. Statically assert exposure on window and language-firewall
//      wiring is intact.
//
// Run: node tests/home-workbench-shell.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioPath = join(__dirname, '..', 'studio.html');
const html = readFileSync(studioPath, 'utf8');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('hOMe Workbench — static markup assertions');

// ── Entry-point CTA on the entrance rail ────────────────────────────
test('entry-point CTA #home-workbench-open-entrance exists with the right copy', () => {
  assert.match(html, /id="home-workbench-open-entrance"/,
    'entry CTA must have id="home-workbench-open-entrance"');
  assert.match(html, /Open hOMe Workbench/,
    'entry CTA must show "Open hOMe Workbench" copy');
});

test('entry-point CTA is NOT hidden inside the collapsed Studio Path <details>', () => {
  // The Workbench is the *primary* hOMe entry per the handoff. Burying
  // it inside the entrance <details class="studio-path-trail"> panel
  // (which is collapsed by default) means members can't find it. The
  // button must live in the entrance rail proper, ABOVE that <details>.
  const btnIdx = html.indexOf('id="home-workbench-open-entrance"');
  const detailsIdx = html.indexOf('id="entrance-studio-path"');
  assert.ok(btnIdx !== -1, 'entry CTA must exist in the DOM');
  assert.ok(detailsIdx !== -1, 'the entrance Studio Path <details> must exist');
  assert.ok(btnIdx < detailsIdx,
    'the Workbench entry CTA must appear BEFORE the Studio Path <details> ' +
    'block so it is visible without expanding the panel');
});

test('entry-point CTA uses the primary (first-class rail) variant', () => {
  assert.match(html,
    /class="hw-entry-cta hw-entry-cta-primary" id="home-workbench-open-entrance"/,
    'the entrance CTA must carry the .hw-entry-cta-primary class so it ' +
    'reads as a first-class rail action, not a tucked-away link');
});

test('legacy "Preview Personal Home" modal button is preserved as fallback', () => {
  // Guardrail: we demoted, but did not remove, the old modal path.
  // The public API window.openWebsitePreview must still be reachable.
  assert.match(html, /window\.openWebsitePreview\s*=/,
    'window.openWebsitePreview must remain exposed for the fallback flow');
  assert.match(html, /id="home-workbench-open-legacy-modal"/,
    'transitional legacy-modal link must exist inside the Workbench');
});

// ── Workbench shell markup ─────────────────────────────────────────
test('#home-workbench root exists as a modal dialog with aria wiring', () => {
  assert.match(html,
    /<div id="home-workbench"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*hidden/,
    '#home-workbench must be role=dialog aria-modal=true and start hidden');
  assert.match(html, /aria-labelledby="home-workbench-title"/,
    '#home-workbench must be labelled by home-workbench-title');
});

test('Workbench has the three-column body: rooms / work / preview', () => {
  assert.match(html, /class="hw-rooms-col"/, 'rooms column must exist');
  assert.match(html, /class="hw-work-col"/, 'work column must exist');
  assert.match(html, /class="hw-preview-col"/, 'preview column must exist');
});

test('Rooms sidebar exposes a tablist for the four hidden dimensions', () => {
  assert.match(html,
    /id="home-workbench-rooms"[^>]*role="tablist"/,
    '#home-workbench-rooms must be role=tablist');
});

test('Work column exposes editor + save/revert actions + source drawer', () => {
  assert.match(html, /id="home-workbench-work-title"/);
  assert.match(html, /id="home-workbench-work-body"/);
  assert.match(html, /id="home-workbench-save"[^>]*>Save/);
  assert.match(html, /id="home-workbench-cancel"/);
  assert.match(html, /id="home-workbench-source-drawer"/);
  assert.match(html, /id="home-workbench-source-toggle"[^>]*aria-expanded/);
  assert.match(html, /id="home-workbench-source-body"[^>]*role="region"/);
});

test('Preview column exposes a live-region visitor frame + refresh action', () => {
  assert.match(html,
    /id="home-workbench-preview-frame"[^>]*aria-live="polite"/,
    'preview frame must be aria-live=polite so screen readers hear updates');
  assert.match(html, /id="home-workbench-preview-refresh"/);
});

test('Topbar exposes hide/show preview + full-screen visitor toggles', () => {
  assert.match(html, /id="home-workbench-preview-toggle"[^>]*aria-pressed/);
  assert.match(html, /id="home-workbench-preview-fullscreen"[^>]*aria-pressed/);
  assert.match(html, /id="home-workbench-close"[^>]*aria-label="Close hOMe Workbench"/);
});

test('Topbar exposes seed-readiness progress + status', () => {
  assert.match(html, /id="home-workbench-progress-fill"/);
  assert.match(html, /id="home-workbench-progress-label"/);
  assert.match(html, /id="home-workbench-status"/);
  assert.match(html, /id="home-workbench-status-label"/);
});

// ── Public API exposure ────────────────────────────────────────────
test('Workbench API is exposed on window', () => {
  assert.match(html, /window\.openHomeWorkbench\s*=\s*openHomeWorkbench/);
  assert.match(html, /window\.closeHomeWorkbench\s*=\s*closeHomeWorkbench/);
  assert.match(html, /window\.phWorkbenchRefreshAll\s*=\s*phWorkbenchRefreshAll/);
  assert.match(html, /window\.phWorkbenchRefreshPreview\s*=\s*phWorkbenchRefreshPreview/);
  assert.match(html, /window\.phWorkbenchSaveActiveSection\s*=\s*phWorkbenchSaveActiveSection/);
});

test('openStudioProject("home") routes to the Workbench (with modal fallback)', () => {
  // The "View hOMe draft" link in the Muse widget footer (and any other
  // internal caller that opens the hOMe project) reaches the hOMe surface
  // through openStudioProject('home'). That path must now open the
  // Workbench, falling back to the old modal only when the Workbench
  // isn't available.
  const fnStart = html.indexOf('function openStudioProject');
  assert.ok(fnStart !== -1, 'openStudioProject must exist');
  const fnBody = html.slice(fnStart, fnStart + 1500);
  assert.match(fnBody, /window\.openHomeWorkbench/,
    'openStudioProject must prefer window.openHomeWorkbench for the ' +
    'website (hOMe) builder');
  // The workbench call must come BEFORE the openWebsitePreview fallback.
  const hwIdx = fnBody.indexOf('window.openHomeWorkbench');
  const legacyIdx = fnBody.indexOf('openWebsitePreview()');
  assert.ok(hwIdx !== -1 && legacyIdx !== -1 && hwIdx < legacyIdx,
    'Workbench must be tried BEFORE the legacy modal fallback');
});

// ── Extract the JS block verbatim and exercise the pure functions ──
console.log('\nhOMe Workbench — behavioural unit tests');

const START = '// <HOME_WORKBENCH_JS_START>';
const END = '// <HOME_WORKBENCH_JS_END>';
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END);
assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
  'HOME_WORKBENCH_JS sentinel block must exist in studio.html');
const bodyStart = html.indexOf('\n', startIdx) + 1;
const src = html.slice(bodyStart, endIdx);

// The Workbench module references several helpers from the enclosing
// closure (phPublicHomeModel, phRenderPublicHome, phWriteRoomCapture,
// buildWebsitePreview, phSeedReadiness, saveState, lpEscape). We inject
// stubs and shared spies BEFORE the block runs, so calls to those
// helpers are observable and deterministic.

function makeEnv() {
  const spies = {
    writeCalls: [],
    saveStateCalls: 0,
    lastPublicModel: null,
    lastRender: null
  };

  // Minimal document stub for the wire path — we don't exercise DOM
  // interaction here; wireHomeWorkbench() is not called. We only need
  // getElementById to return null for the drawer/textarea look-ups
  // inside phWorkbenchPullSource so it falls through predictably.
  const documentStub = {
    getElementById() { return null; },
    addEventListener() {},
    body: { style: {} }
  };
  const windowStub = {
    addEventListener() {},
    setTimeout() { return 0; },
    clearTimeout() {}
  };

  const state = {
    builder: { captures: {} },
    compassData: { points: {} }
  };
  // The save function reads window.state directly for the label write.
  windowStub.state = state;

  const scope = {
    document: documentStub,
    window: windowStub,
    state,
    // Helpers pulled from the outer closure:
    phPublicHomeModel(model) {
      spies.lastPublicModel = model;
      return { heading: 'Hi', intro: '', sections: (model && model.sections) || [] };
    },
    phRenderPublicHome(publicModel) {
      spies.lastRender = publicModel;
      return '<div class="phpub">rendered</div>';
    },
    phWriteRoomCapture(key, text) {
      spies.writeCalls.push({ key, text });
      state.builder.captures['site-' + key] = {
        at: 1, prompt: '', excerpt: text, builder: 'personal-home'
      };
      return true;
    },
    buildWebsitePreview() {
      return {
        name: 'Test',
        sections: [
          { key: 'work', label: 'What I make', body: 'wood' },
          { key: 'lens', label: 'How I perceive', body: '' },
          { key: 'field', label: 'What keeps me alive', body: '' },
          { key: 'call', label: "What I'm here for", body: '' }
        ],
        counts: {},
        transcripts: [],
        sourceSeeds: {}
      };
    },
    phSeedReadiness() {
      return { drafted: 1, awaiting: 3, total: 4, stage: 'seeded' };
    },
    saveState() { spies.saveStateCalls += 1; },
    lpEscape(s) { return String(s == null ? '' : s); },
    lpCaptureText() { return ''; },
    lpFirst() { return ''; },
    wpPointSection() { return { key: 'work', label: 'What I make', body: '' }; },
    phPublicRoomLabel(key, sec) { return (sec && sec.label) || key; },
    phRoomCaptureId(key) { return 'site-' + key; },
    phPublicVisualIdentity() { return { palette: {}, motifs: [] }; },
    phHomeSourceSeeds: { cOMpass: [], omCipher: [] }
  };

  // Compile the block inside a fresh function whose parameters are
  // the scope keys. Return the internal functions/state we want to
  // observe.
  const keys = Object.keys(scope);
  const values = keys.map((k) => scope[k]);
  const body = src +
    '\nreturn {' +
    ' HW_ROOM_KEYS,' +
    ' phWorkbenchState,' +
    ' phWorkbenchSaveActiveSection,' +
    ' phWorkbenchPullSource,' +
    ' phWorkbenchRefreshPreview,' +
    ' phWorkbenchSourceItems' +
    '};';
  const fn = new Function(...keys, body);
  const api = fn(...values);
  return { api, spies, state };
}

test('phWorkbenchSaveActiveSection routes body writes through phWriteRoomCapture', () => {
  const { api, spies } = makeEnv();
  api.phWorkbenchState.activeRoom = 'work';
  api.phWorkbenchState.draftBody = 'I build furniture by hand.';
  api.phWorkbenchState.draftLabel = '';
  const wrote = api.phWorkbenchSaveActiveSection();
  assert.equal(wrote, true, 'save should return true when body was written');
  assert.equal(spies.writeCalls.length, 1,
    'phWriteRoomCapture should be called exactly once');
  assert.deepEqual(spies.writeCalls[0],
    { key: 'work', text: 'I build furniture by hand.' });
  assert.equal(api.phWorkbenchState.dirty, false,
    'dirty flag must clear after a successful save');
});

test('phWorkbenchSaveActiveSection persists a custom room label onto compassData', () => {
  const { api, spies, state } = makeEnv();
  api.phWorkbenchState.activeRoom = 'lens';
  api.phWorkbenchState.draftBody = 'Through the lens of curiosity.';
  api.phWorkbenchState.draftLabel = 'How I look at things';
  api.phWorkbenchSaveActiveSection();
  assert.equal(state.compassData.points.lens.web_label,
    'How I look at things',
    'the custom label must land on compassData.points.<key>.web_label');
  assert.ok(spies.saveStateCalls >= 1,
    'saveState() must be called when a new label is persisted');
});

test('phWorkbenchSaveActiveSection skips write when body is empty', () => {
  const { api, spies } = makeEnv();
  api.phWorkbenchState.activeRoom = 'work';
  api.phWorkbenchState.draftBody = '   ';
  api.phWorkbenchState.draftLabel = '';
  const wrote = api.phWorkbenchSaveActiveSection();
  assert.equal(wrote, false, 'save must return false when nothing was written');
  assert.equal(spies.writeCalls.length, 0,
    'phWriteRoomCapture must NOT be called for empty drafts');
});

test('phWorkbenchRefreshPreview goes through phPublicHomeModel → phRenderPublicHome', () => {
  // Refresh returns early because getElementById() returns null in the
  // stub — but we can still verify the firewall-guarded call chain by
  // asserting the source string itself uses these helpers in order.
  assert.match(src,
    /phPublicHomeModel\([^)]*\)[\s\S]*phRenderPublicHome\(/,
    'refresh must compose phRenderPublicHome(phPublicHomeModel(...))');
});

test('phWorkbenchRefreshAll is invoked after every save', () => {
  // Static: the save function must call refreshAll so the preview
  // column re-paints. This is the "Tune the room → immediately
  // reflects in preview" bug fix.
  assert.match(src,
    /function phWorkbenchSaveActiveSection\([^)]*\)[\s\S]*?phWorkbenchRefreshAll\(\)/,
    'save must call phWorkbenchRefreshAll to re-paint rooms + preview');
});

test('phWorkbenchPullSource is defined as an append-only helper', () => {
  // Static: verify the function never assigns raw draftBody = item.excerpt
  // (that would clobber the existing draft). It must combine the two.
  assert.match(src,
    /phWorkbenchState\.draftBody\s*=\s*current\s*\+/,
    'pull-in must APPEND to the existing draft (current + item.excerpt)');
  assert.match(src,
    /phWorkbenchState\.dirty\s*=\s*true/,
    'pull-in must mark the draft dirty so the next Save persists it');
});

// ── Static guards on the firewall path ─────────────────────────────
console.log('\nStatic wiring assertions');

test('preview column is rendered through the firewall-guarded model path', () => {
  // The visitor preview must NOT render straight from buildWebsitePreview.
  // It must run through phPublicHomeModel (which strips internal terms)
  // and phRenderPublicHome (which never surfaces branded vocabulary).
  const refreshBlock = src.slice(
    src.indexOf('function phWorkbenchRefreshPreview'),
    src.indexOf('function phWorkbenchRenderTopbar')
  );
  assert.match(refreshBlock, /phPublicHomeModel\(/,
    'refreshPreview must call phPublicHomeModel');
  assert.match(refreshBlock, /phRenderPublicHome\(/,
    'refreshPreview must call phRenderPublicHome');
  assert.doesNotMatch(refreshBlock, /Compass|Living Profile|Nexus|Field Observations|Spark|OM Cipher/,
    'refreshPreview must not surface branded internal terminology');
});

test('Workbench does not expose any branded internal terms in visible copy', () => {
  const shellStart = html.indexOf('HOME_WORKBENCH_SHELL_START');
  const shellEnd = html.indexOf('HOME_WORKBENCH_SHELL_END');
  assert.ok(shellStart !== -1 && shellEnd > shellStart);
  const shell = html.slice(shellStart, shellEnd);
  // The shell may reference internal terms in COMMENTS (which live
  // above the markup) — restrict the check to the actual dialog body.
  const dialogStart = shell.indexOf('<div id="home-workbench"');
  assert.ok(dialogStart !== -1, 'workbench dialog root must be present');
  const dialog = shell.slice(dialogStart);
  const banned = ['Compass', 'Living Profile', 'Nexus', 'OM Cipher'];
  for (const term of banned) {
    assert.ok(!dialog.includes(term),
      'visible dialog copy must not contain the internal term: ' + term);
  }
});

console.log('\n' + passed + ' checks passed.');
