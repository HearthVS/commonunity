/* cOMpass header search box — must never open holding a value the user did not
   type. Run: node --test test_compass_search_autofill.js (Node 20+).

   Reported: in Companion View the search field showed the companion's first
   name ("Markus") after every hard reboot. Deleting it by hand did not stick —
   the next hard load brought it back. An earlier deployment showed the active
   Siddhi ("Bounteousness") the same way.

   The value never came from the app: #search-input is absent from `state`, from
   the persisted session JSON, from every identity-hydration path, and the page
   is served as static bytes. It was injected by the browser — from a saved
   autofill profile, or by restoring form state on reload / session restore —
   which is exactly why an in-page delete could not survive: that value lives in
   the browser's store, not the app's, so every fresh load re-injects it.

   Two things let it in:

     1. The box was form-less, like every other input on the page, so a browser
        parses it into one anonymous field group together with #guide-name,
        #companion-name, #dob, #tob, #pob and the profile given/family name
        fields — the fields identity hydration fills with the person's real
        name. A group holding name and birth fields is what makes a browser
        classify the unlabelled sibling as another name field. It also carried
        autocomplete="new-password", which declares it a credential field and
        opts out of nothing relevant.

     2. The runtime backstop was a race: clears at 0/250/1000ms after
        DOMContentLoaded. #screen-compass is display:none while the page boots,
        so the field is not even rendered while those fire, and anything landing
        after 1s stuck forever.

   So the guard here is event-driven, and the assertions below pin the bug path
   itself: a fill that lands late, a fill that arrives with input/change events,
   a restoration that arrives with no events at all, and the :-webkit-autofill
   animation tripwire. Plus the other half of the contract — the user's own
   typing is never erased, clearing by hand re-arms the guard, and identity
   hydration into the name/birth fields still works and still cannot reach the
   search box.

   playwright-core + a chromium build are NOT repo dependencies, so the browser
   suite SKIPS rather than fails when they are unavailable. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ── Extractors: everything under test is the SHIPPED source, never a copy ────
function extractFunction(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' must exist');
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

function extractSearchMarkup(src) {
  const start = src.indexOf('<form class="search-box" id="search-box"');
  assert.ok(start > -1, 'the search box must be its own <form>');
  const end = src.indexOf('</form>', start);
  assert.ok(end > -1, 'search form must be closed');
  return src.slice(start, end + '</form>'.length);
}

function extractSearchCss(src) {
  const start = src.indexOf('/* Search box');
  const end = src.indexOf('/* Search results panel */', start);
  assert.ok(start > -1 && end > start, 'search box CSS block must exist');
  return src.slice(start, end);
}

function scriptRegions(src) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out.join('\n');
}

const MARKUP = extractSearchMarkup(HTML);
const CSS = extractSearchCss(HTML);
const INIT_SEARCH = extractFunction(HTML, 'initSearch');
const SCRIPTS = scriptRegions(HTML);

// Fields identity hydration legitimately fills, all of them form-less — the
// group the search box used to be parsed into.
const IDENTITY_FIELD_IDS = ['guide-name', 'companion-name', 'dob', 'tob', 'pob',
  'profile-given-name', 'profile-family-name'];

// ── Markup contract ─────────────────────────────────────────────────────────
test('search box is isolated in its own single-field search form', () => {
  assert.match(MARKUP, /role="search"/, 'form should expose the search landmark');
  assert.match(MARKUP, /autocomplete="off"/, 'form should opt out of autofill');

  const inputs = MARKUP.match(/<input\b/g) || [];
  assert.strictEqual(inputs.length, 1,
    'the search form must hold exactly one field — a second field would rebuild ' +
    'the very group that let a name be classified into this box');

  for (const id of IDENTITY_FIELD_IDS) {
    assert.ok(!MARKUP.includes(`id="${id}"`),
      `${id} must stay outside the search form`);
  }
});

test('search input carries no seeded value and no credential semantics', () => {
  const tag = MARKUP.slice(MARKUP.indexOf('<input'), MARKUP.indexOf('>', MARKUP.indexOf('<input')) + 1);

  assert.ok(!/\bvalue\s*=/.test(tag), 'the field must never ship a value attribute');
  assert.ok(!/\bname\s*=/.test(tag), 'no name attribute — browser history must not key on it');
  assert.ok(!/autocomplete="new-password"/.test(tag),
    'new-password declares a credential field and opts out of nothing relevant');
  assert.match(tag, /autocomplete="off"/);
  assert.match(tag, /type="search"/);
  // Accessibility must survive the hardening.
  assert.match(tag, /aria-label="Search cOMpass"/);
  assert.ok(!/\breadonly\b/.test(tag) && !/\bdisabled\b/.test(tag),
    'the field stays operable — no readonly/disabled tricks');
  // Password managers.
  assert.match(tag, /data-1p-ignore/);
  assert.match(tag, /data-lpignore="true"/);
  assert.match(tag, /data-form-type="other"/);
});

test('the results Close button cannot submit the enclosing form', () => {
  assert.match(MARKUP, /<button type="button"[^>]*id="search-close"/,
    'a bare <button> inside a form defaults to submit');
});

// ── No app-side path can populate the field ─────────────────────────────────
test('only initSearch touches the search field in script code', () => {
  const hits = (SCRIPTS.match(/search-input/g) || []).length;
  assert.strictEqual(hits, 1,
    'exactly one script reference (initSearch) — anything else is a hydration ' +
    'path that could seed the box');
  assert.match(INIT_SEARCH, /getElementById\('search-input'\)/);
});

test('transient search state is never written to durable storage', () => {
  const stateStart = HTML.indexOf('const state = {');
  assert.ok(stateStart > -1, 'state literal must exist');
  const stateLiteral = HTML.slice(stateStart, HTML.indexOf('\n};', stateStart));
  assert.ok(!/search|query/i.test(stateLiteral),
    'the search query must not become part of persisted state');

  const save = extractFunction(HTML, 'saveToStorage');
  assert.match(save, /JSON\.stringify\(state\)/,
    'storage persists `state` only, so the query cannot ride along');
  assert.ok(!/search/i.test(save));
});

// ── Runtime guard contract ──────────────────────────────────────────────────
test('the guard is event-driven, not a timer race', () => {
  assert.ok(!/setTimeout\(\s*clearSearchInput/.test(INIT_SEARCH),
    'deferred clears lose to any fill that lands later, which is the reported bug');

  for (const evt of ['pageshow', 'beforeinput', 'paste', 'compositionstart',
                     'drop', 'input', 'change', 'animationstart', 'focus']) {
    assert.ok(INIT_SEARCH.includes(`'${evt}'`), `guard must listen for ${evt}`);
  }
  assert.match(INIT_SEARCH, /userTypedQuery/,
    'the guard needs a user-ownership latch to tell typing from injection');
});

test('the autofill tripwire keyframe and its listener agree on one name', () => {
  const cssName = /@keyframes\s+([\w-]+)/.exec(CSS);
  assert.ok(cssName, 'the :-webkit-autofill keyframe must exist');
  assert.match(CSS, new RegExp(`:-webkit-autofill\\s*\\{[^}]*animation:\\s*${cssName[1]}`),
    'the keyframe must be bound to :-webkit-autofill');
  assert.ok(INIT_SEARCH.includes(`'${cssName[1]}'`),
    `initSearch must listen for animationName ${cssName[1]}`);
});

// ── Identity surfaces must be untouched by this fix ─────────────────────────
test('identity hydration still fills the name and birth fields', () => {
  const applySession = extractFunction(HTML, 'cuApplySessionIdentity');
  assert.match(applySession, /getElementById\('companion-name'\)/);
  assert.match(applySession, /getElementById\('guide-name'\)/);

  const threshold = extractFunction(HTML, 'initThresholdContract');
  for (const id of ['companion-name', 'dob', 'tob', 'pob']) {
    assert.ok(threshold.includes(`getElementById('${id}')`),
      `threshold hydration must still fill #${id}`);
  }
});

// ── Real browser: the reported bug path ─────────────────────────────────────
function resolveDeps() {
  const coreCandidates = [
    process.env.PLAYWRIGHT_CORE,
    '/home/user/node_modules/playwright-core',
    '/tmp/node_modules/playwright-core',
    'playwright-core',
    'playwright',
  ].filter(Boolean);
  let chromium = null;
  for (const c of coreCandidates) {
    try { chromium = require(c).chromium; if (chromium) break; } catch (_) {}
  }
  if (!chromium) return null;
  const exeCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM,
    '/home/user/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
  ].filter(Boolean);
  let exe = null;
  for (const e of exeCandidates) { try { if (fs.existsSync(e)) { exe = e; break; } } catch (_) {} }
  return { chromium, exe };
}

const deps = resolveDeps();

// The header block is mounted on its own with the real CSS and the real
// initSearch, alongside the identity inputs it shares a page with. That runs
// the real cascade and the real guard without booting all of cOMpass, which
// needs a session and the beta gate. Hermetic: no network, no server.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
:root {
  --input-bg:#0d1526; --card:#131a2b; --text:#e8eaf0; --text-muted:#9aa3b5;
  --text-faint:#6b7280; --border:#2a3346; --setup-accent:#d6b36a;
  --radius-full:999px; --radius-md:8px; --radius-lg:12px; --transition:.2s;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-8:32px;
  --text-xs:11px; --text-sm:13px; --shadow-lg:none; --field:#6f9a84;
}
body { background: var(--input-bg); margin: 0; }
.compass-actions { display:flex; align-items:center; gap:16px; }
${CSS}
</style></head><body>
<div class="compass-actions">${MARKUP}</div>
<!-- The identity inputs the search box shares the page with. -->
<label for="guide-name">Guide Name</label>
<input class="field-input" id="guide-name" type="text" placeholder="Your name…" autocomplete="off">
<label for="companion-name">Companion Name</label>
<input class="field-input" id="companion-name" type="text" placeholder="Companion's name…" autocomplete="off">
<label for="dob">Date of Birth</label><input id="dob" type="date" autocomplete="off">
<label for="tob">Time of Birth</label><input id="tob" type="time" autocomplete="off">
<label for="pob">Place of Birth</label><input id="pob" type="text" placeholder="City, Country" autocomplete="off">
<script>
let searchTimer = null;
window.__ranQueries = [];
function runSearch(q) { window.__ranQueries.push(q); }
${INIT_SEARCH}
initSearch();

// Identity hydration, shaped exactly like cuApplySessionIdentity /
// initThresholdContract: server-authoritative names written into the setup
// fields after init has already run.
window.__hydrateIdentity = function () {
  document.getElementById('companion-name').value = 'Markus Lehto';
  document.getElementById('guide-name').value = 'Markus Lehto';
  document.getElementById('dob').value = '1979-03-14';
  document.getElementById('pob').value = 'Helsinki, Finland';
};
// A browser autofill: value set from outside, then input + change, the way
// Chrome announces a fill.
window.__browserFill = function (v) {
  const i = document.getElementById('search-input');
  i.value = v;
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new Event('change', { bubbles: true }));
};
// Form-state restoration: value appears with no events at all.
window.__silentRestore = function (v) {
  document.getElementById('search-input').value = v;
};
<\/script></body></html>`;

test('search box in a real browser', { skip: deps ? false : 'playwright-core/chromium unavailable' }, async (t) => {
  const browser = await deps.chromium.launch(
    deps.exe ? { executablePath: deps.exe } : {});
  const page = await browser.newPage();
  await page.setContent(PAGE);
  t.after(async () => { await browser.close(); });

  const value = () => page.inputValue('#search-input');

  await t.test('opens empty, and identity hydration cannot reach it', async () => {
    assert.strictEqual(await value(), '');
    await page.evaluate(() => window.__hydrateIdentity());
    assert.strictEqual(await value(), '',
      'hydrating the name and birth fields must leave the search box empty');
    assert.strictEqual(await page.inputValue('#companion-name'), 'Markus Lehto',
      'and must still fill the identity fields it owns');
  });

  await t.test('a fill landing long after load is erased', async () => {
    // 1200ms: past every clear the old timer-based version scheduled.
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__browserFill('Markus'));
    assert.strictEqual(await value(), '',
      'the reported bug: a late fill used to stick forever');
  });

  await t.test('a silent restoration is gone before the user can act on it', async () => {
    await page.evaluate(() => window.__silentRestore('Markus'));
    await page.focus('#search-input');
    assert.strictEqual(await value(), '');
    await page.evaluate(() => document.getElementById('search-input').blur());
  });

  await t.test('the :-webkit-autofill tripwire clears the field', async () => {
    const cleared = await page.evaluate(() => {
      const i = document.getElementById('search-input');
      i.value = 'Bounteousness';
      i.dispatchEvent(new AnimationEvent('animationstart',
        { animationName: 'cu-search-autofilled', bubbles: true }));
      return i.value;
    });
    assert.strictEqual(cleared, '');
  });

  await t.test('the user\'s own typing is never erased, and Enter searches in place', async () => {
    await page.click('#search-input');
    await page.type('#search-input', 'where am I compromising');
    assert.strictEqual(await value(), 'where am I compromising');

    await page.keyboard.press('Enter');
    assert.deepStrictEqual(
      await page.evaluate(() => window.__ranQueries), ['where am I compromising']);
    // Enter inside the form must not navigate away.
    assert.strictEqual(await page.evaluate(() => !!window.__ranQueries), true,
      'the page must still be the same document after Enter');
    assert.strictEqual(await value(), 'where am I compromising',
      'searching does not wipe the query');
  });

  await t.test('clearing by hand empties the box and re-arms the guard', async () => {
    await page.click('#search-input');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    assert.strictEqual(await value(), '');

    await page.evaluate(() => window.__browserFill('Markus'));
    assert.strictEqual(await value(), '',
      'after the user clears it, a fresh injection must not take hold');
  });

  await t.test('the form swap left the header layout and a11y intact', async () => {
    const box = await page.evaluate(() => {
      const f = document.getElementById('search-box');
      const cs = getComputedStyle(f);
      const i = document.getElementById('search-input');
      return {
        tag: f.tagName, role: f.getAttribute('role'), display: cs.display,
        margin: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].join(' '),
        visible: i.getClientRects().length > 0,
        label: i.getAttribute('aria-label'),
        readOnly: i.readOnly, disabled: i.disabled,
      };
    });
    assert.strictEqual(box.tag, 'FORM');
    assert.strictEqual(box.role, 'search');
    assert.strictEqual(box.display, 'flex');
    assert.strictEqual(box.margin, '0px 0px 0px 0px',
      'a <form> would otherwise add UA margin inside the header row');
    assert.strictEqual(box.visible, true);
    assert.strictEqual(box.label, 'Search cOMpass');
    assert.strictEqual(box.readOnly, false);
    assert.strictEqual(box.disabled, false);
  });
});
