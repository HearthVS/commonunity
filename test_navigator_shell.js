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

// Navigator lives in one shared partial now (navigator.html), loaded by every
// beta surface that hosts it — cOMpass and stUdio. The markup, styles and
// controller are the same text that used to sit inline at the end of index.html,
// so these static assertions read the partial directly.
const HTML = fs.readFileSync(path.join(__dirname, 'navigator.html'), 'utf8');

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

test('only the mobile breakpoint collapses the NAVIGATOR label', () => {
  // Beta discoverability: laptops and the ~1385px stUdio width must keep the
  // labelled pill, so no wider media query may visually hide .cu-nav-label.
  for (const [, width, body] of HTML.matchAll(/@media \(max-width: (\d+)px\)( \{[\s\S]*?\n\})/g)) {
    if (/\.cu-nav-label \{/.test(body)) {
      assert.strictEqual(width, '720',
        `.cu-nav-label may only collapse at the mobile breakpoint, not ${width}px`);
    }
  }
});

// ── Viewport-safe panel height ───────────────────────────────────────────────
//
// Regression: at 1600x900 the open panel measured top=369 bottom=989 against a
// 900px viewport, so a grounded Help answer pushed the response and its actions
// below the fold. A viewport-relative cap is not sufficient on its own — it has
// to subtract where the panel actually starts.

test('the vertical offset has a single source of truth', () => {
  const nav = block('#cu-navigator {', '}');
  assert.match(nav, /--navigator-top:/, 'the offset must be a custom property');
  assert.match(nav, /top:\s*var\(--navigator-top\)/,
    'placement must consume the property, not duplicate the value');
});

test('every breakpoint that moves Navigator keeps the panel cap in sync', () => {
  // A breakpoint overriding `top` with a literal would desync the panel's
  // max-height from where the panel actually starts — the original bug.
  const overrides = HTML.match(/#cu-navigator \{[^}]*\}/g) || [];
  for (const rule of overrides.slice(1)) {
    // `[;{\s]top:` so --navigator-top: does not count as a `top` declaration.
    if (/[;{\s]top:/.test(rule)) {
      assert.match(rule, /[;{\s]top:\s*auto/,
        'a breakpoint may only release `top` (mobile), never set a literal offset');
    }
  }
  assert.match(HTML, /@media \(max-height: 620px\)\s*\{\s*#cu-navigator \{[^}]*--navigator-top:/,
    'the short-viewport breakpoint must move the property, not `top`');
});

test('panel max-height subtracts its own offset plus a safe margin', () => {
  const panel = block('#cu-fb-panel {', '}');
  const mh = /max-height:\s*([^;]+);/.exec(panel);
  assert.ok(mh, '#cu-fb-panel must cap its height');
  const expr = mh[1];
  assert.match(expr, /100dvh/, 'the cap must be viewport-relative');
  assert.match(expr, /var\(--navigator-top\)/,
    'the cap must subtract where the panel starts, or it overflows the viewport');
  const margin = /-\s*(\d+)px/.exec(expr);
  assert.ok(margin && Number(margin[1]) > 0, 'the cap must leave a safe bottom margin');
});

test('the mobile panel caps against its own bottom anchor', () => {
  const mob = (HTML.match(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/) || [])[0];
  assert.ok(mob, 'mobile breakpoint must exist');
  const panel = /#cu-fb-panel \{[\s\S]*?\}/.exec(mob)[0];
  assert.match(panel, /bottom:\s*104px/);
  const mh = /max-height:\s*([^;]+);/.exec(panel);
  assert.ok(mh, 'the mobile panel must re-cap its height');
  // --navigator-top is `auto` at this breakpoint, so reusing it would break.
  assert.doesNotMatch(mh[1], /var\(--navigator-top\)/,
    'bottom-anchored panel must subtract its own offset, not --navigator-top');
  assert.match(mh[1], /100dvh/);
});

test('an expanded answer scrolls inside the panel instead of clipping', () => {
  const sec = block('.cu-comm-section {', '}');
  assert.match(sec, /overflow-y:\s*auto/);
  // Without min-height:0 a flex item refuses to shrink below its content, so
  // the section grows past the panel cap and `overflow: hidden` clips it.
  assert.match(sec, /min-height:\s*0/,
    'min-height:0 is what makes the internal scroll actually engage');
  assert.match(sec, /flex:\s*1 1 auto/, 'the section must be the flexible row');
  assert.match(block('#cu-fb-panel {', '}'), /flex-direction:\s*column/);
});

// ── Panel surface legibility ─────────────────────────────────────────────────
//
// Regression: at 390x844 the panel read as too translucent and underlying
// cOMpass copy competed with Navigator's own text.

test('the panel surface is near-opaque and blurs what sits behind it', () => {
  const panel = block('#cu-fb-panel {', '}');
  const base = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)(?=[;\s]*$|;)/m.exec(panel)
            || /,\s*rgba\([\d\s,]+?([\d.]+)\)\s*;/.exec(panel);
  const alpha = Number((/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)\s*;/.exec(panel) || [])[1]);
  assert.ok(alpha >= 0.98, `panel base alpha must be >= 0.98 (found ${alpha})`);
  assert.match(panel, /backdrop-filter:\s*blur\(/, 'blur keeps the Nexus-family softness');
  assert.match(panel, /-webkit-backdrop-filter:\s*blur\(/, 'Safari needs the prefixed pair');
  assert.ok(base, 'panel must declare an explicit surface colour');
});

test('the mobile panel is fully opaque', () => {
  const mob = (HTML.match(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/) || [])[0];
  const panel = /#cu-fb-panel \{[\s\S]*?\}/.exec(mob)[0];
  const bg = /background:\s*([^;]+);/.exec(panel);
  assert.ok(bg, 'the mobile panel must restate its surface');
  assert.doesNotMatch(bg[1].replace(/rgba\([^)]*0\.0?\d+\)/g, ''), /rgba\([^)]*,\s*0?\.\d+\)\s*$/,
    'the mobile base layer must not be translucent');
  assert.match(bg[1], /#[0-9a-f]{6}\s*$/i, 'the mobile base layer must be an opaque hex');
});

test('the amber treatment survives the stronger surface', () => {
  const panel = block('#cu-fb-panel {', '}');
  assert.match(panel, /var\(--navigator-accent\)/, 'border must stay amber-derived');
  assert.match(panel, /var\(--navigator-glow-rest\)/, 'resting glow must be preserved');
  const mob = (HTML.match(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/) || [])[0];
  const mp = /#cu-fb-panel \{[\s\S]*?\}/.exec(mob)[0];
  assert.match(mp, /var\(--navigator-accent\)/, 'mobile border must stay amber-derived');
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

// ── One visible mode at a time ───────────────────────────────────────────────
//
// Regression: with Messages selected, the whole Help mode stayed painted below
// the Messages empty state — intro, starter chips, textarea and Ask Navigator.
// Cause was specificity, not JS: setMode() correctly added .cu-hidden, but
// `#cu-comm-help { display: grid }` (0,1,0,0) outranks
// `.cu-comm-section.cu-hidden { display: none }` (0,0,2,0), so the section kept
// its grid display. #cu-fb-form and #cu-fb-success had escaped it only because
// each carried its own ID-scoped `.cu-hidden` duplicate.

const SECTION_IDS = ['cu-comm-messages', 'cu-comm-help', 'cu-fb-form', 'cu-fb-success'];

// All declarations for `sel { ... }`, in source order.
function rulesFor(sel) {
  const re = new RegExp(sel.replace(/[.#*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const out = [];
  let m;
  while ((m = re.exec(HTML))) out.push(m[1]);
  return out;
}

test('the hidden utility outranks the sections own ID-scoped display rules', () => {
  const util = rulesFor('.cu-comm-section.cu-hidden');
  assert.strictEqual(util.length, 1, 'exactly one hiding rule for Navigator sections');
  assert.match(util[0], /display:\s*none\s*!important/,
    'a two-class utility loses to an ID selector — hiding must be !important or ' +
    'a section keeps the display its own #id rule gives it');
});

test('every section that an ID rule gives a display to is still hideable', () => {
  // This is the trap the regression fell into: adding `display` to a section
  // under its ID is a normal layout change, and must stay safe to make.
  let covered = 0;
  for (const id of SECTION_IDS) {
    for (const body of rulesFor('#' + id)) {
      if (!/(^|;)\s*display:/.test(body)) continue;
      covered++;
      assert.doesNotMatch(body, /display:[^;]*!important/,
        `#${id} must not force its display, or .cu-hidden can never win`);
    }
  }
  assert.ok(covered > 0, 'expected at least one ID-scoped display rule to guard against');
});

test('flex sizing rules never resurrect a hidden section', () => {
  // `.cu-comm-section` sets flex/min-height for the internal scroll. Those must
  // not carry their own `display`, and must not be !important either — both
  // would beat or tie the hiding rule.
  const base = rulesFor('.cu-comm-section');
  assert.ok(base.length, '.cu-comm-section must exist');
  for (const body of base) {
    assert.doesNotMatch(body, /(^|;)\s*display:/,
      'the flex/scroll rule must not set display; .cu-hidden owns visibility');
    assert.doesNotMatch(body, /!important/,
      'no !important in the sizing rule — it would tie with the hiding rule');
  }
});

test('no section keeps a redundant per-ID hiding duplicate', () => {
  // Dead rules imply the utility is not authoritative and invite the next
  // section to be added without one — which is exactly how Help was missed.
  for (const id of SECTION_IDS) {
    assert.strictEqual(rulesFor('#' + id + '.cu-hidden').length, 0,
      `#${id}.cu-hidden is redundant now the utility is authoritative`);
  }
});

test('exactly one tabpanel is unhidden in the delivered markup', () => {
  const open = SECTION_IDS.filter((id) => !/\bcu-hidden\b/.test(panelTag(id)));
  assert.deepStrictEqual(open, ['cu-comm-messages'],
    'only the initially selected tab may render unhidden');
  const selected = tabs().find((t) => t.selected === 'true');
  assert.strictEqual(selected.controls, 'cu-comm-messages',
    'the unhidden panel must be the one the selected tab controls');
});

test('every tabpanel is in the map setMode toggles', () => {
  // A tabpanel missing from SECTIONS would never be hidden by a mode change.
  const map = /const SECTIONS = \{([^}]*)\}/.exec(HTML);
  assert.ok(map, 'setMode must resolve modes through a SECTIONS map');
  for (const t of tabs()) {
    assert.match(map[1], new RegExp(`\\b${t.mode}\\s*:`),
      `mode "${t.mode}" must be in SECTIONS or its panel never hides`);
  }
  assert.match(block('function setMode', '\n  }'), /SECTIONS\)\.forEach/);
  assert.match(block('function setMode', '\n  }'), /successSection\.classList\.add\('cu-hidden'\)/,
    'the success state is not a tab and must be hidden on every mode change');
});

// ── Help opens clean; Feedback keeps its draft ───────────────────────────────

test('Help clears its transient state but keeps the contextual starters', () => {
  const reset = block('function resetHelp', '\n  }');
  assert.match(reset, /helpInput\.value = ''/, 'the half-typed question must go');
  assert.match(reset, /helpQ\.textContent = ''/, 'the previous question must go');
  assert.match(reset, /helpA\.textContent = ''/, 'the previous answer must go');
  assert.match(reset, /helpNote[\s\S]*cu-hidden/, 'progress/next-step note must be re-hidden');
  assert.match(reset, /helpActions\.innerHTML = ''/, 'handoff buttons must not persist');
  assert.match(reset, /helpThread\.classList\.add\('cu-hidden'\)/, 'the thread must close');
  assert.doesNotMatch(reset, /helpStarters/,
    'starters are contextual, not transient — they must survive the reset');
  assert.doesNotMatch(reset, /helpPending/,
    'resetting must not clear the in-flight guard, or a duplicate ask could fire');
});

test('leaving Help resets it, so re-entry is never a stale composition', () => {
  const setMode = block('function setMode', '\n  }');
  assert.match(setMode, /which !== 'help' && currentMode\(\) === 'help'.*resetHelp\(\)/,
    'switching away from Help must reset it');
  // currentMode() reads the tab classes, so the check has to precede the loop
  // that moves them — otherwise it always sees the incoming mode.
  assert.ok(setMode.indexOf('resetHelp()') < setMode.indexOf('tabs.forEach'),
    'the reset check must run before the tabs are updated');
  assert.match(block('function closePanel', '\n  }'),
    /currentMode\(\) === 'help'.*resetHelp\(\)/,
    'closing Navigator on Help must also reset it');
  // Entry still re-derives the starters for the room the user is now in.
  assert.match(setMode, /if \(which === 'help'\) renderHelpStarters\(\)/);
});

test('switching tabs or closing never discards a Feedback draft', () => {
  for (const [name, fn] of [['setMode', block('function setMode', '\n  }')],
                            ['closePanel', block('function closePanel', '\n  }')]]) {
    assert.doesNotMatch(fn, /form\.reset\(\)/,
      `${name} must not reset the Feedback form — drafts survive navigation`);
    assert.doesNotMatch(fn, /cu-fb-message/,
      `${name} must not touch the Feedback message field`);
    assert.doesNotMatch(fn, /\bshot\b\s*=\s*null/,
      `${name} must not drop the Feedback attachment`);
  }
  // The draft clears only where it always did: a confirmed success.
  const submit = HTML.slice(HTML.indexOf("form.addEventListener('submit'"));
  assert.match(submit.slice(0, 3000), /if \(res\.ok\)[\s\S]{0,200}form\.reset\(\)/,
    'form.reset() must stay behind the success branch');
  // Cancel closes; it does not wipe. Closing is not a discard.
  assert.match(HTML, /cancelBtn\.addEventListener\('click', \(\) => closePanel\(\)\)/);
});
