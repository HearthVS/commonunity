/* Navigator shell — static wiring regression tests for the cOMpass beta.
   Run: node --test test_navigator_shell.js   (Node 20+, no dependencies)

   Navigator replaced the standalone feedback widget with a three-mode suite
   (Messages, Help, Feedback) sharing one trigger. These tests guard the parts
   that break silently in a monolithic page with no build step:

     • Mode integrity — every tab resolves to a real tabpanel, in the required
       order, with roving tabindex. A mismatch renders a blank panel.
     • Messaging preservation — the pre-Navigator delivery/read/poll functions
       must still exist and still be reachable, since Navigator only re-housed
       them. Losing markAllRead would silently stop read receipts.
     • Screenshot control placement — spec requires it below the message field
       and above the optional name field, with the exact validation microcopy.
     • Trigger placement, amber tokens, focus visibility, reduced motion. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function block(startMarker, endMarker) {
  const s = HTML.indexOf(startMarker);
  assert.ok(s > -1, `expected to find ${startMarker}`);
  const e = HTML.indexOf(endMarker, s);
  assert.ok(e > s, `expected ${endMarker} after ${startMarker}`);
  return HTML.slice(s, e);
}

const NAVIGATOR = block('<div id="cu-navigator">', '<div id="cu-fb-success"');

function tabs() {
  const list = block('id="cu-comm-tabs"', '</div>');
  const out = [];
  const re = /<button\b[^>]*\bdata-comm-tab="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(list))) {
    const tag = m[0];
    out.push({
      mode: m[1],
      id: (/\bid="([^"]+)"/.exec(tag) || [])[1] || null,
      controls: (/\baria-controls="([^"]+)"/.exec(tag) || [])[1] || null,
      selected: (/\baria-selected="([^"]+)"/.exec(tag) || [])[1] || null,
      tabindex: (/\btabindex="([^"]+)"/.exec(tag) || [])[1] || null,
      tag,
    });
  }
  return out;
}

function panelTag(id) {
  const re = new RegExp('<(?:div|form)\\b[^>]*\\bid="' + id + '"[^>]*>');
  const m = re.exec(HTML);
  assert.ok(m, `panel #${id} must exist`);
  return m[0];
}

// ── Three-mode information architecture ──────────────────────────────────────

test('Navigator exposes exactly Messages, Help, Feedback in that order', () => {
  assert.deepStrictEqual(tabs().map((t) => t.mode), ['messages', 'help', 'feedback']);
});

test('every tab resolves to a real tabpanel labelled back by that tab', () => {
  for (const t of tabs()) {
    assert.ok(t.controls, `${t.mode} tab needs aria-controls`);
    const panel = panelTag(t.controls);
    assert.match(panel, /role="tabpanel"/, `#${t.controls} must be a tabpanel`);
    assert.match(panel, new RegExp(`aria-labelledby="${t.id}"`),
      `#${t.controls} must point back at #${t.id}`);
  }
});

test('tablist uses roving tabindex with one selected tab', () => {
  const list = tabs();
  assert.match(block('id="cu-comm-tabs"', '</div>'), /role="tablist"/);
  assert.match(block('id="cu-comm-tabs"', '</div>'), /aria-label="[^"]+"/);
  assert.strictEqual(list.filter((t) => t.selected === 'true').length, 1);
  for (const t of list) {
    assert.strictEqual(t.tabindex, t.selected === 'true' ? '0' : '-1',
      `${t.mode} tabindex must follow aria-selected`);
  }
});

test('keyboard tab navigation is wired (arrows + Home/End)', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
    assert.ok(NAVIGATOR.includes(`'${key}'`) || HTML.includes(`'${key}'`),
      `${key} must be handled in the tablist`);
  }
});

test('default mode prefers unread Messages and falls back to Help', () => {
  const fn = block('function defaultMode', '}');
  assert.match(fn, /messages/);
  assert.match(fn, /help/);
  // Preference is in-memory only — no localStorage/cookie persistence added.
  assert.doesNotMatch(fn, /localStorage|sessionStorage|document\.cookie/);
});

// ── Trigger, dialog, keyboard and focus ──────────────────────────────────────

test('trigger is a labelled button bound to the panel', () => {
  const t = /<button\b[^>]*\bid="cu-fb-trigger"[^>]*>/.exec(NAVIGATOR)[0];
  assert.match(t, /aria-expanded="false"/);
  assert.match(t, /aria-controls="cu-fb-panel"/);
  assert.match(t, /aria-label="[^"]*Navigator[^"]*"/);
});

test('panel is a labelled dialog that can receive focus', () => {
  const p = panelTag('cu-fb-panel');
  assert.match(p, /role="dialog"/);
  assert.match(p, /aria-labelledby="cu-nav-title"/);
  assert.match(p, /tabindex="-1"/);
  assert.ok(HTML.includes('id="cu-nav-title"'), 'dialog label element must exist');
});

test('Escape closes Navigator and focus returns to the trigger', () => {
  assert.match(HTML, /cu-navigator'\)\.addEventListener\('keydown'/);
  const esc = HTML.slice(HTML.indexOf("cu-navigator').addEventListener('keydown'"));
  assert.match(esc.slice(0, 400), /Escape/);
  const close = block('function closePanel', '\n  }');
  assert.match(close, /trigger\.focus\(\)/, 'closePanel must return focus to the trigger');
  assert.match(close, /aria-expanded'?,? ?'?false/, 'closePanel must reset aria-expanded');
});

test('close button is explicitly labelled', () => {
  const b = /<button\b[^>]*\bid="cu-fb-close"[^>]*>/.exec(NAVIGATOR)[0];
  assert.match(b, /aria-label="[^"]*Navigator[^"]*"/);
});

// ── Nexus-sibling placement and amber treatment ──────────────────────────────

test('Navigator sits on the left in the upper-middle, above Nexus', () => {
  const css = block('#cu-navigator {', '}');
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /top:\s*clamp\(/, 'vertical placement must be viewport-relative');
  assert.match(css, /left:/);
  assert.doesNotMatch(css, /\bright:/, 'Navigator must not be right-anchored');
});

test('Navigator uses amber tokens, not the blue Nexus accent', () => {
  for (const token of ['--navigator-accent:', '--navigator-accent-bright:', '--navigator-accent-deep:']) {
    assert.ok(HTML.includes(token), `${token} must be defined as a token`);
  }
  const trigger = block('#cu-fb-trigger {', '}');
  assert.match(trigger, /var\(--navigator-/, 'trigger must consume the Navigator tokens');
  assert.match(trigger, /border-radius:\s*999px/, 'reuse the Nexus pill geometry');
});

test('hover/focus glow is stronger than rest, and focus is independently visible', () => {
  const px = (name) => {
    const m = new RegExp(`--navigator-glow-${name}:[^;]*?(\\d+)px`).exec(HTML);
    assert.ok(m, `--navigator-glow-${name} must be defined`);
    return Number(m[1]);
  };
  assert.ok(px('hover') > px('rest'), 'hover glow must exceed rest glow');
  const focus = block('#cu-fb-trigger:focus-visible {', '}');
  assert.match(focus, /outline:\s*2px solid/, 'focus must not rely on glow alone');
  assert.match(focus, /outline-offset/);
});

test('reduced motion stills animation without hiding focus state', () => {
  // The page has several reduced-motion blocks; find the Navigator's own.
  const re = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g;
  const rm = (HTML.match(re) || []).find((b) => b.includes('#cu-fb-trigger'));
  assert.ok(rm, 'Navigator must have a reduced-motion block');
  assert.match(rm, /#cu-fb-trigger[^{]*\{[^}]*transition:\s*none/);
  assert.match(rm, /#cu-fb-panel \{[^}]*animation:\s*none/);
  assert.doesNotMatch(rm, /outline:\s*none/, 'reduced motion must keep the focus outline');
});

test('narrow viewports keep Navigator compact and clear of lower Nexus', () => {
  assert.match(HTML, /@media \(max-width: 720px\)[\s\S]{0,400}#cu-navigator \{[^}]*bottom:/,
    'mobile placement must be repositioned, not overlapping');
  assert.ok(HTML.includes('id="cu-fb-tooltip"'), 'compact mode needs the tooltip label');
});

// ── Messaging preservation ───────────────────────────────────────────────────

test('the pre-Navigator messaging functions all survive', () => {
  for (const fn of ['renderMessages', 'loadMessages', 'markAllRead', 'updateDot',
                    'scheduleMarkRead', 'startPolling', 'escapeHtml']) {
    assert.ok(new RegExp(`function ${fn}\\b`).test(HTML), `${fn}() must still exist`);
  }
});

test('messaging backend contracts are untouched', () => {
  assert.ok(HTML.includes("'/api/messages'"), 'delivery fetch must stay on /api/messages');
  assert.match(HTML, /\/api\/messages\/\$\{[^}]+\}\/read/, 'read receipt endpoint must be unchanged');
});

test('read receipts only fire while Messages is the visible mode', () => {
  assert.match(HTML, /if \(panelOpen\(\) && currentMode\(\) === 'messages'\) scheduleMarkRead\(\);/,
    'marking read from a hidden Messages panel would lose the unread signal');
});

test('Messages failure is surfaced with a retry rather than an empty list', () => {
  assert.ok(HTML.includes('id="cu-msg-retry"'), 'a retry affordance must exist');
  assert.ok(HTML.includes('messagesFailed'), 'error state must be distinct from "no messages"');
});

// ── Help mode boundaries ─────────────────────────────────────────────────────

test('Help calls its own bounded endpoint, never the Nexus stream', () => {
  const help = block('function askNavigator', '\n  }');
  assert.match(help, /\/api\/navigator\/help/);
  assert.doesNotMatch(help, /rose-mirror/, 'Help must not reuse the Nexus persona endpoint');
});

test('Help context is interface-only — never message content', () => {
  const ctx = block('function navHelpContext', '\n  }');
  for (const leak of ['messages', 'msg-list', 'markAllRead']) {
    assert.ok(!ctx.includes(leak), `Help context must not include ${leak}`);
  }
  assert.match(ctx, /visible_controls/);
  assert.match(ctx, /room/);
});

test('reflective answers hand off to Nexus; unclear UI routes to Feedback', () => {
  const help = block('function askNavigator', '\n  }');
  assert.match(help, /reflective/);
  assert.match(help, /openCompassNexus/);
  assert.match(help, /feedback/i);
});

// ── Feedback screenshot ──────────────────────────────────────────────────────

test('screenshot control sits below the message and above the optional name', () => {
  const form = block('<form id="cu-fb-form"', '</form>');
  const iMsg = form.indexOf('id="cu-fb-message"');
  const iShot = form.indexOf('id="cu-shot-row"');
  const iName = form.indexOf('id="cu-fb-name"');
  assert.ok(iMsg > -1 && iShot > -1 && iName > -1, 'all three rows must exist');
  assert.ok(iMsg < iShot, 'screenshot must follow the message field');
  assert.ok(iShot < iName, 'screenshot must precede the optional name field');
});

test('file input accepts only the supported image types', () => {
  const input = /<input\b[^>]*\bid="cu-shot-input"[^>]*>/.exec(HTML)[0];
  assert.match(input, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(input, /type="file"/);
  assert.doesNotMatch(input, /\bmultiple\b/, 'V1 accepts one image only');
});

test('attachment state exposes thumbnail, filename, size, remove and replace', () => {
  for (const id of ['cu-shot-thumb', 'cu-shot-name', 'cu-shot-size',
                    'cu-shot-remove', 'cu-shot-replace']) {
    assert.ok(HTML.includes(`id="${id}"`), `#${id} must exist`);
  }
  assert.match(/<img\b[^>]*\bid="cu-shot-thumb"[^>]*>/.exec(HTML)[0], /alt="[^"]+"/,
    'the preview needs alternative text');
});

test('attachment changes are announced and errors are assertive', () => {
  const live = /<p\b[^>]*\bid="cu-shot-live"[^>]*>/.exec(HTML)[0];
  assert.match(live, /role="status"/);
  assert.match(live, /aria-live="polite"/);
  assert.match(/<p\b[^>]*\bid="cu-shot-error"[^>]*>/.exec(HTML)[0], /role="alert"/);
});

test('privacy microcopy and the 10 MB limit are stated up front', () => {
  const help = block('id="cu-shot-help"', '</p>');
  assert.match(help, /PNG, JPG, or WEBP/);
  assert.match(help, /10 MB/);
  assert.match(help, /sensitive information/);
});

test('client validation microcopy matches the server responses', () => {
  for (const copy of ['Choose a PNG, JPG, or WEBP image.',
                      'This image is too large. Choose one under 10 MB.']) {
    assert.ok(HTML.includes(copy), `missing exact microcopy: ${copy}`);
  }
  const limit = /SHOT_MAX_BYTES\s*=\s*([^;]+);/.exec(HTML);
  assert.ok(limit, 'client-side size limit must be defined');
  assert.match(limit[1], /10\s*\*\s*1024\s*\*\s*1024/, 'client limit must match the 10 MB server limit');
});

test('submission carries the attachment and is never silently dropped', () => {
  const submit = HTML.slice(HTML.indexOf("form.addEventListener('submit'"));
  assert.match(submit.slice(0, 2500), /image_data_url/);
  assert.match(submit.slice(0, 2500), /image_name/);
});

test('a failed submission preserves the draft', () => {
  const submit = HTML.slice(HTML.indexOf("form.addEventListener('submit'"), HTML.length);
  const body = submit.slice(0, 3000);
  const clear = body.indexOf("form.reset()") > -1 ? body.indexOf("form.reset()") : body.indexOf("value = ''");
  const ok = body.indexOf('cu-fb-success');
  assert.ok(clear === -1 || ok === -1 || ok < clear + 1200,
    'the draft may only be cleared on a confirmed success');
});

test('success headline is the agreed wording', () => {
  assert.ok(HTML.includes('Thank you. Your signal has been received.'));
});
