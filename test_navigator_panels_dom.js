/* Navigator panel visibility — REAL browser regression test.

   Reported: with MESSAGES selected, the whole Help mode stayed painted below the
   Messages empty state — the intro line, the starter chips, the "what would help
   you find your way?" textarea and the Ask Navigator button — so two modes were
   on screen at once and a half-typed question sat there between uses.

   Two reasons this needs a real browser rather than string matching:

     1. The bug was pure cascade. setMode() did add .cu-hidden; the section
        ignored it because `#cu-comm-help { display: grid }` (0,1,0,0) outranks
        `.cu-comm-section.cu-hidden { display: none }` (0,0,2,0). Only a real
        style resolution can prove which declaration wins, and only a real
        browser proves the flex/min-height/overflow rules on .cu-comm-section
        do not resurrect a hidden panel.

     2. "Visible" here means laid out, not merely scrolled into view. These
        assertions check resolved `display` plus getClientRects(), which is
        indifferent to where the panel's internal scroll happens to sit.

   The Navigator is one self-contained block at the end of index.html (markup,
   its <style>, its <script>), so the block is mounted on its own. That runs the
   real cascade and the real controller without booting all of cOMpass, which
   needs a session and the beta gate. fetch is stubbed, so no network and no
   server: the test is hermetic.

   playwright-core + a chromium build are NOT repo dependencies, so the suite
   SKIPS rather than fails when they are unavailable.

   Run: node --test test_navigator_panels_dom.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function resolveDeps() {
  const coreCandidates = [
    process.env.PLAYWRIGHT_CORE,
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
const SKIP = deps ? false : 'playwright-core/chromium not available in this environment';

const DESKTOP = { width: 1600, height: 900 };
const NARROW = { width: 390, height: 844 };  // the reporter's viewport class

// A 1x1 PNG — enough for the attachment path to accept and preview a file.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

function navigatorFragment() {
  const start = HTML.indexOf('<div id="cu-navigator">');
  assert.ok(start > -1, 'Navigator markup must exist in index.html');
  const end = HTML.lastIndexOf('</script>');
  assert.ok(end > start, 'Navigator script must follow its markup');
  const frag = HTML.slice(start, end + '</script>'.length);
  // Guard the slice: if the block is ever moved or split, fail loudly here
  // rather than silently testing an empty page.
  for (const marker of ['<style>', 'id="cu-comm-tabs"', 'function setMode',
                        'id="cu-comm-help"', 'id="cu-fb-form"']) {
    assert.ok(frag.includes(marker), `Navigator fragment must contain ${marker}`);
  }
  return frag;
}

const FRAGMENT = navigatorFragment();

// Stubbed backends. `messages` seeds /api/messages so read/poll behaviour can be
// observed; every call is recorded on window.__calls.
function stubFetch(seed) {
  window.__calls = [];
  window.fetch = async (url, opts) => {
    const u = String(url);
    window.__calls.push({ url: u, method: (opts && opts.method) || 'GET' });
    const json = async () => {
      // Matches the real /api/messages envelope, not a bare array.
      if (u.includes('/api/messages')) return { messages: seed.messages };
      if (u.includes('/api/navigator/help')) return seed.help;
      return {};
    };
    return { ok: true, status: 200, json };
  };
}

async function withNavigator(opts, fn) {
  const { chromium, exe } = deps;
  const viewport = (opts && opts.viewport) || DESKTOP;
  const seed = {
    messages: (opts && opts.messages) || [],
    help: (opts && opts.help) || {
      answer: 'The Work is where you name what is actually being asked of you.',
      next_action: 'Open The Lens',
      kind: 'partial',
    },
  };
  const browser = await chromium.launch(exe
    ? { executablePath: exe, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    await page.addInitScript(stubFetch, seed);
    await page.goto('about:blank');
    // #screen-compass stands in for the room the Help context reads from.
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
      '<div id="screen-compass"></div>' + FRAGMENT + '</body></html>',
      { waitUntil: 'load' });
    await page.waitForSelector('#cu-fb-trigger');
    await fn(page);
    assert.deepStrictEqual(errors, [], 'Navigator must not throw in the page');
  } finally {
    await browser.close();
  }
}

const SECTION_IDS = ['cu-comm-messages', 'cu-comm-help', 'cu-fb-form', 'cu-fb-success'];

// One snapshot of everything these tests care about, read from resolved style
// and real geometry rather than from class names.
function readState(ids) {
  const painted = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    return getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
  };
  const paintedSel = (sel) => {
    const el = document.querySelector(sel);
    return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
  };
  const active = document.querySelector('.cu-comm-tab--active');
  return {
    mode: active ? active.getAttribute('data-comm-tab') : null,
    selectedTabs: Array.from(document.querySelectorAll('.cu-comm-tab'))
      .filter((t) => t.getAttribute('aria-selected') === 'true')
      .map((t) => t.getAttribute('data-comm-tab')),
    painted: ids.filter(painted),
    displays: ids.map((id) => [id, getComputedStyle(document.getElementById(id)).display]),
    help: {
      input: document.getElementById('cu-help-input').value,
      question: document.getElementById('cu-help-q').textContent,
      answer: document.getElementById('cu-help-a').textContent,
      notePainted: painted('cu-help-note'),
      threadPainted: painted('cu-help-thread'),
      actions: document.getElementById('cu-help-actions').children.length,
      starters: Array.from(document.getElementById('cu-help-starters').children)
        .map((b) => b.textContent),
      askPainted: painted('cu-help-send'),
      introPainted: paintedSel('.cu-help-intro'),
      textareaPainted: painted('cu-help-input'),
      chipsPainted: paintedSel('.cu-help-starters button'),
    },
    feedback: {
      message: document.getElementById('cu-fb-message').value,
      name: document.getElementById('cu-fb-name').value,
      app: document.getElementById('cu-fb-app').value,
      type: (document.querySelector('input[name="fb-type"]:checked') || {}).value || null,
      shotCardPainted: painted('cu-shot-card'),
      shotName: document.getElementById('cu-shot-name').textContent,
    },
  };
}

const state = (page) => page.evaluate(readState, SECTION_IDS);
const openNavigator = (page) => page.click('#cu-fb-trigger');
const toMode = async (page, mode) => {
  await page.click(`#cu-tab-${mode}`);
  await page.evaluate(() => new Promise(requestAnimationFrame));
};

// ── Exactly one tabpanel at a time ───────────────────────────────────────────

for (const [label, viewport] of [['desktop 1600x900', DESKTOP], ['narrow 390x844', NARROW]]) {
  test(`only the selected mode is painted — ${label}`, { skip: SKIP }, async () => {
    await withNavigator({ viewport }, async (page) => {
      await openNavigator(page);
      for (const [mode, expected] of [['messages', 'cu-comm-messages'],
                                      ['help', 'cu-comm-help'],
                                      ['feedback', 'cu-fb-form']]) {
        await toMode(page, mode);
        const s = await state(page);
        assert.strictEqual(s.mode, mode);
        assert.deepStrictEqual(s.selectedTabs, [mode], 'exactly one tab may be selected');
        assert.deepStrictEqual(s.painted, [expected],
          `${mode} must paint only #${expected}, got ${JSON.stringify(s.displays)}`);
      }
    });
  });
}

test('Messages shows no Help affordances at all — the reported symptom',
  { skip: SKIP }, async () => {
    await withNavigator({ viewport: NARROW }, async (page) => {
      await openNavigator(page);
      await toMode(page, 'messages');
      const { help } = await state(page);
      // Each of these was visible under the Messages empty state in the report.
      assert.strictEqual(help.introPainted, false, 'Help intro must not paint');
      assert.strictEqual(help.chipsPainted, false, 'starter chips must not paint');
      assert.strictEqual(help.textareaPainted, false, 'the question textarea must not paint');
      assert.strictEqual(help.askPainted, false, 'the Ask Navigator button must not paint');
    });
  });

test('hiding a panel survives the flex rules that make it scroll',
  { skip: SKIP }, async () => {
    await withNavigator({}, async (page) => {
      await openNavigator(page);
      await toMode(page, 'messages');
      const resolved = await page.evaluate(() => {
        const el = document.getElementById('cu-comm-help');
        const cs = getComputedStyle(el);
        return { display: cs.display, overflowY: cs.overflowY, minHeight: cs.minHeight,
                 height: el.getBoundingClientRect().height };
      });
      // .cu-comm-section still carries flex:1 1 auto / min-height:0 / overflow-y
      // for the internal scroll; none of that may reintroduce a box.
      assert.strictEqual(resolved.display, 'none',
        'the sizing rules must not override the hiding rule');
      assert.strictEqual(resolved.height, 0, 'a hidden panel must occupy no height');
    });
  });

test('the panel never renders two modes stacked, at any width', { skip: SKIP }, async () => {
  await withNavigator({ viewport: NARROW }, async (page) => {
    await openNavigator(page);
    for (const mode of ['messages', 'help', 'feedback', 'messages']) {
      await toMode(page, mode);
      const boxes = await page.evaluate((ids) => ids
        .map((id) => document.getElementById(id))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => el.id), SECTION_IDS);
      assert.strictEqual(boxes.length, 1,
        `${mode} rendered ${boxes.length} panels: ${boxes.join(', ')}`);
    }
  });
});

// ── Help opens clean on re-entry ─────────────────────────────────────────────

test('re-entering Help clears the question, answer, note and handoff actions',
  { skip: SKIP }, async () => {
    await withNavigator({}, async (page) => {
      await openNavigator(page);
      await toMode(page, 'help');
      await page.fill('#cu-help-input', 'What is The Work?');
      await page.click('#cu-help-send');
      await page.waitForFunction(() =>
        document.getElementById('cu-help-a').textContent.includes('The Work is where'));

      const asked = await state(page);
      assert.strictEqual(asked.help.threadPainted, true, 'the answer must show first');
      assert.strictEqual(asked.help.notePainted, true, 'the next-step note must show first');
      assert.ok(asked.help.actions > 0, 'handoff actions must exist first');

      await toMode(page, 'messages');
      await toMode(page, 'help');

      const back = await state(page);
      assert.strictEqual(back.help.input, '', 'the question input must be empty');
      assert.strictEqual(back.help.question, '', 'the previous question must be gone');
      assert.strictEqual(back.help.answer, '', 'the previous answer must be gone');
      assert.strictEqual(back.help.threadPainted, false, 'the thread must be closed');
      assert.strictEqual(back.help.notePainted, false, 'the note must be re-hidden');
      assert.strictEqual(back.help.actions, 0, 'handoff actions must not persist');
      assert.strictEqual(back.help.askPainted, true, 'Help must be back on a clean prompt');
    });
  });

test('an unsent Help question does not survive a tab switch', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'help');
    await page.fill('#cu-help-input', 'half-typed thought');
    await toMode(page, 'feedback');
    await toMode(page, 'help');
    const s = await state(page);
    assert.strictEqual(s.help.input, '', 'the text box must not stay open between uses');
  });
});

test('closing Navigator on Help reopens it clean', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'help');
    await page.fill('#cu-help-input', 'something I abandoned');
    await page.click('#cu-fb-close');
    await openNavigator(page);
    const s = await state(page);
    assert.strictEqual(s.mode, 'help', 'the session mode is still remembered');
    assert.strictEqual(s.help.input, '', 'but the abandoned composition is not');
  });
});

test('the reset keeps the contextual starter prompts', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'help');
    const first = (await state(page)).help.starters;
    assert.ok(first.length >= 3, `expected starter prompts, got ${JSON.stringify(first)}`);
    await page.fill('#cu-help-input', 'anything');
    await toMode(page, 'messages');
    await toMode(page, 'help');
    const after = (await state(page)).help.starters;
    assert.deepStrictEqual(after, first, 'starters are contextual and must be re-offered');
    assert.strictEqual((await state(page)).help.chipsPainted, true);
  });
});

test('a starter chip still asks, and the answer still renders', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'help');
    await page.click('#cu-help-starters button');
    await page.waitForFunction(() =>
      document.getElementById('cu-help-a').textContent.includes('The Work is where'));
    const s = await state(page);
    assert.strictEqual(s.help.threadPainted, true);
    assert.ok(s.help.question.length > 0, 'the asked question must be echoed');
    const calls = await page.evaluate(() => window.__calls.map((c) => c.url));
    assert.ok(calls.some((u) => u.includes('/api/navigator/help')),
      'Help must still reach its own bounded endpoint');
    assert.ok(!calls.some((u) => u.includes('rose-mirror')), 'and never the Nexus persona');
  });
});

// ── Feedback drafts are not transient ────────────────────────────────────────

test('a Feedback draft survives switching tabs', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'feedback');
    await page.fill('#cu-fb-message', 'The room labels felt unclear on arrival.');
    await page.fill('#cu-fb-name', 'Wren');
    await page.selectOption('#cu-fb-app', 'studio');
    await page.check('input[name="fb-type"][value="bug"]');
    await page.setInputFiles('#cu-shot-input', {
      name: 'evidence.png', mimeType: 'image/png', buffer: PNG_1PX,
    });
    await page.waitForFunction(() =>
      document.getElementById('cu-shot-card').getClientRects().length > 0);

    await toMode(page, 'messages');
    await toMode(page, 'help');
    await toMode(page, 'feedback');

    const { feedback } = await state(page);
    assert.strictEqual(feedback.message, 'The room labels felt unclear on arrival.',
      'losing typed feedback to a tab switch is the accidental loss this guards');
    assert.strictEqual(feedback.name, 'Wren');
    assert.strictEqual(feedback.app, 'studio');
    assert.strictEqual(feedback.type, 'bug');
    assert.strictEqual(feedback.shotCardPainted, true, 'the attachment must survive too');
    assert.match(feedback.shotName, /evidence\.png/);
  });
});

test('a Feedback draft survives closing and reopening Navigator', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'feedback');
    await page.fill('#cu-fb-message', 'Half-written, deliberately kept.');
    await page.click('#cu-fb-close');
    await openNavigator(page);
    const { feedback } = await state(page);
    assert.strictEqual(feedback.message, 'Half-written, deliberately kept.');
  });
});

test('Cancel closes without silently discarding the draft', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'feedback');
    await page.fill('#cu-fb-message', 'Cancelled by mistake.');
    await page.click('#cu-fb-cancel');
    assert.strictEqual(
      await page.evaluate(() => document.getElementById('cu-fb-panel').classList.contains('cu-hidden')),
      true, 'Cancel must close the panel');
    await openNavigator(page);
    assert.strictEqual((await state(page)).feedback.message, 'Cancelled by mistake.');
  });
});

test('a confirmed send is still the thing that clears the draft', { skip: SKIP }, async () => {
  await withNavigator({}, async (page) => {
    await openNavigator(page);
    await toMode(page, 'feedback');
    await page.fill('#cu-fb-message', 'Sent for real.');
    await page.click('#cu-fb-submit');
    await page.waitForFunction(() =>
      document.getElementById('cu-fb-success').getClientRects().length > 0);
    const s = await state(page);
    assert.deepStrictEqual(s.painted, ['cu-fb-success'],
      'the confirmation replaces the form rather than stacking under it');
    assert.strictEqual(s.feedback.message, '', 'success clears the draft');
    const calls = await page.evaluate(() => window.__calls);
    assert.ok(calls.some((c) => c.url.includes('/api/feedback') && c.method === 'POST'));
  });
});

// ── Messages behaviour is untouched ──────────────────────────────────────────

test('unread Messages still open first and still mark read', { skip: SKIP }, async () => {
  const messages = [{ id: 7, subject: 'A note', body: 'Hello', kind: 'direct',
                      read: false, created_at: '2026-07-20T10:00:00Z' }];
  await withNavigator({ messages }, async (page) => {
    await page.waitForFunction(() =>
      document.getElementById('cu-comm-dot') &&
      !document.getElementById('cu-comm-dot').classList.contains('cu-hidden'));
    await openNavigator(page);
    const s = await state(page);
    assert.strictEqual(s.mode, 'messages', 'unread relational activity opens first');
    assert.deepStrictEqual(s.painted, ['cu-comm-messages']);
    // scheduleMarkRead waits 1.2s before confirming the read receipt.
    await page.waitForFunction(
      () => window.__calls.some((c) => /\/api\/messages\/7\/read$/.test(c.url)),
      null, { timeout: 5000 });
  });
});
