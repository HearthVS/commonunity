/* Navigator in stUdio — static wiring regression tests.
   Run: node --test test_navigator_studio.js   (Node 20+, no dependencies)

   stUdio used to carry its own two-mode cOMmunication widget (Messages +
   Feedback, bottom-right, no Help, no screenshot). It now mounts the same
   shared Navigator partial cOMpass mounts, so the things that can break
   silently in a no-build monolith are:

     • stUdio actually mounts it, and the old duplicate is gone — otherwise two
       widgets fight over the same #cu-fb-* ids.
     • It keeps pointing at the existing messaging / feedback / help endpoints;
       nothing here forks the backend contracts.
     • Help sent from stUdio carries stUdio context and no cOMpass-room
       guidance, so an answer can't drift into "which of the four rooms".
     • Exactly one tab panel ships visible, and the rule that hides the rest
       still outranks the per-panel display rules. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const NAV = fs.readFileSync(path.join(__dirname, 'navigator.html'), 'utf8');
const STUDIO = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');
const COMPASS = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ── Presence in stUdio ───────────────────────────────────────────────────────

test('stUdio mounts the shared Navigator partial', () => {
  assert.match(STUDIO, /fetch\('\/navigator\.html'/,
    'stUdio must load the shared partial, not its own copy');
  // Scripts inserted through innerHTML never run; the loader has to re-create
  // them or Navigator mounts as inert markup.
  assert.match(STUDIO, /createElement\('script'\)/,
    "the partial's controller must be re-created as a real script element");
  assert.match(COMPASS, /fetch\('\/navigator\.html'/,
    'cOMpass must mount the same partial, so there is one implementation');
});

test('the old stUdio two-mode widget is gone', () => {
  for (const marker of ['id="cu-feedback-widget"', 'id="cu-fb-trigger"', 'id="cu-comm-tabs"']) {
    assert.ok(!STUDIO.includes(marker),
      `stUdio must not still declare ${marker} — duplicate ids would collide`);
  }
});

test('Navigator is placed upper-left in stUdio, clear of the room header', () => {
  const rule = /#cu-navigator\.cu-nav--studio \{([^}]*)\}/.exec(NAV);
  assert.ok(rule, 'stUdio needs its own placement rule on the shared partial');
  assert.match(rule[1], /--navigator-top:/,
    'the offset must move through the property so the panel cap stays in sync');
  assert.doesNotMatch(rule[1], /[;{\s]top:/, 'a literal top would desync the panel cap');
  assert.match(rule[1], /left:/, 'stUdio placement is left-anchored like cOMpass');
  assert.match(NAV, /classList\.add\('cu-nav--studio'\)/,
    'the modifier must be applied from the detected surface');
  // Nexus keeps the lower-right / mirror track: Navigator must not move there.
  assert.doesNotMatch(rule[1], /right:/, 'Navigator must never sit where Nexus lives');
});

// ── Existing contracts, not new ones ─────────────────────────────────────────

test('Navigator still points at the existing backend contracts', () => {
  for (const endpoint of ["'/api/messages'", '/api/messages/${', "'/api/feedback'", "'/api/navigator/help'"]) {
    assert.ok(NAV.includes(endpoint), `${endpoint} must stay the endpoint in use`);
  }
  const apis = Array.from(new Set(NAV.match(/\/api\/[a-z0-9/{}$.\-]*/g) || []));
  const allowed = ['/api/messages', '/api/messages/${m.id}/read', '/api/feedback', '/api/navigator/help'];
  for (const api of apis) {
    assert.ok(allowed.includes(api), `unexpected new endpoint: ${api}`);
  }
});

test('feedback from stUdio identifies itself through the existing app field', () => {
  assert.match(NAV, /'\/studio':\s*'studio'/, 'the route map must resolve /studio to the studio app');
  assert.match(NAV, /appSelect\.value = detectedApp/,
    'the existing app field must be preselected from the route');
  assert.match(NAV, /app:\s*appSelect\.value/,
    'submission must send the existing app field, not a new one');
  assert.match(NAV, /<option value="studio">/, 'stUdio must be an option on the shared form');
  assert.match(NAV, /image_data_url/, 'the single-screenshot flow must come along unchanged');
});

// ── stUdio context, not cOMpass-room guidance ────────────────────────────────

test('Help sends the surface it was asked from', () => {
  assert.match(NAV, /location\.pathname\.startsWith\('\/studio'\)\s*\?\s*'studio'\s*:\s*'compass'/,
    'the surface must be derived from the route, so hosts configure nothing');
  const ctx = /function navHelpContext\(\)[\s\S]*?\n  \}/.exec(NAV);
  assert.ok(ctx, 'navHelpContext() must exist');
  assert.match(ctx[0], /surface: NAV_SURFACE/, 'the request must carry the surface');
  assert.match(ctx[0], /visible_controls/, 'bounded interface context is still sent');
  for (const leak of ['messages', 'msg-list', 'markAllRead', 'mirror-conversation']) {
    assert.ok(!ctx[0].includes(leak), `Help context must not include ${leak}`);
  }
});

test('stUdio never reports a cOMpass room or layer', () => {
  const room = /function navActiveRoom\(\)[\s\S]*?\n  \}/.exec(NAV)[0];
  const layer = /function navActiveLayer\(\)[\s\S]*?\n  \}/.exec(NAV)[0];
  assert.match(room, /IN_STUDIO\) return ''/, 'a stUdio question must carry no room');
  assert.match(layer, /IN_STUDIO\) return ''/, 'a stUdio question must carry no layer');
  const starters = /function renderHelpStarters\(\)[\s\S]*?\n  \}/.exec(NAV)[0];
  assert.match(starters, /IN_STUDIO/, 'starters must be surface-specific');
  assert.match(starters, /stUdio/, 'stUdio starters must orient to stUdio');
});

test('the stUdio control ids Help reports exist in stUdio and in the registry', () => {
  const controls = /function navVisibleControls\(\)[\s\S]*?\n  \}/.exec(NAV)[0];
  const server = fs.readFileSync(path.join(__dirname, 'server.py'), 'utf8');
  const pairs = [
    ['#room-switcher', 'studio-room-switcher'],
    ['#fo-view-tabs', 'studio-fo-view-tabs'],
    ['#btn-studio-save', 'studio-save-load'],
    ['#mirror-input', 'studio-nexus-mirror'],
  ];
  for (const [selector, id] of pairs) {
    assert.ok(controls.includes(id), `${id} must be reported from stUdio`);
    assert.ok(STUDIO.includes(`id="${selector.slice(1)}"`),
      `${selector} must actually exist in stUdio, or the context lies`);
    // The server allow-lists control ids; an unknown id is silently dropped.
    assert.ok(server.includes(`"id": "${id}"`), `${id} must be in the Navigator registry`);
  }
});

test('the reflective handoff reaches Nexus where stUdio keeps it', () => {
  const ask = /async function askNavigator[\s\S]*?\n  \}/.exec(NAV)[0];
  assert.match(ask, /IN_STUDIO[\s\S]*mirror-input/,
    'in stUdio the handoff must reveal the mirror composer');
  assert.match(ask, /openCompassNexus/, 'the cOMpass handoff must be untouched');
  // The question is never transferred for them, on either surface.
  assert.doesNotMatch(ask, /mirror\.value\s*=/, 'the question must stay with the person');
});

// ── One visible panel ────────────────────────────────────────────────────────

test('exactly one tab panel ships visible, and the rest stay hidden', () => {
  const panels = ['cu-comm-messages', 'cu-comm-help', 'cu-fb-form', 'cu-fb-success'];
  const visible = panels.filter((id) => {
    const tag = new RegExp(`<(?:div|form)\\b[^>]*\\bid="${id}"[^>]*>`).exec(NAV);
    assert.ok(tag, `#${id} must exist`);
    return !/\bcu-hidden\b/.test(tag[0]);
  });
  assert.deepStrictEqual(visible, ['cu-comm-messages'],
    'only the panel of the selected tab may ship visible');
  // The hiding rule has to outrank the per-panel display rules, or a hidden
  // panel paints anyway — the bug this suite exists for.
  assert.match(NAV, /\.cu-comm-section\.cu-hidden \{ display: none !important; \}/,
    'the hidden rule must win over #id display rules');
  assert.match(NAV, /Object\.entries\(SECTIONS\)\.forEach\(\(\[key, el\]\) => el\.classList\.toggle\('cu-hidden', key !== which\)\)/,
    'switching modes must hide every section that is not the chosen one');
});
