/* stUdio shell atmosphere — REAL computed-style integration test (Round 7).

   The pure-palette + static-wiring guards in test_studio_shell_atmosphere.js
   prove the room tokens differ and that the shell rules consume them. They can
   NOT prove the browser actually paints a different, lighter field — a variable
   can be "set" and still never reach the painted layer (e.g. if the palette
   module fails to load, applyRoomAtmosphere no-ops and every room stays navy).
   That exact blind spot produced a batch of navy screenshots this round.

   This test closes it: it drives the ACTUAL studio.html DOM in headless
   chromium and reads getComputedStyle().backgroundColor / backgroundImage off
   the formerly-fixed shell layers (.notepad-surface = centre Field Observations
   backing, .rose-surface = right Nexus backing, .room-workbench = centre
   column). It asserts:

     1. The four rooms resolve to four DISTINCT computed backgrounds (the broad
        field differs per room, not merely a CSS var).
     2. The depth slider genuinely lightens the field: the light endpoint has a
        strictly higher luminance than the deep endpoint, on every layer.

   playwright-core + a chromium build are NOT repo dependencies, so when they are
   unavailable (e.g. plain CI) the whole suite SKIPS rather than fails. When the
   local Playwright cache is present it runs for real. Paths can be overridden
   with PLAYWRIGHT_CORE / PLAYWRIGHT_CHROMIUM env vars.

   Run: node --test test_studio_shell_atmosphere_dom.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = __dirname;
const PALETTE = fs.readFileSync(path.join(REPO, 'studio-palette.js'), 'utf8');
const SP = require('./studio-palette.js');

// Resolve playwright-core + a chromium executable; skip cleanly if absent.
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
  // If no explicit exe, let playwright try its own resolution (may still work).
  return { chromium, exe };
}

const deps = resolveDeps();
const SKIP = deps ? false : 'playwright-core/chromium not available in this environment';

// Parse a computed colour into a rough relative luminance in 0..1. Handles the
// three forms getComputedStyle emits for these layers: srgb color(), rgb[a](),
// and oklch() (the column gradient / --bg resolve to oklch). Enough to order
// light-vs-deep and gate a midtone. For gradients, the FIRST colour stop is used
// (the outer atmosphere), which is what dominates the visible field.
function luminance(str) {
  let m = str.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return _rgbLum(+m[1], +m[2], +m[3]);
  m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return _rgbLum(+m[1] / 255, +m[2] / 255, +m[3] / 255);
  m = str.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) {
    const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    return SP.oklchLuminance(L, +m[2], +m[3]);
  }
  return null;
}
function _rgbLum(r, g, b) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const LAYERS = ['.notepad-surface', '.rose-surface', '.room-workbench'];
const ROOMS = ['work', 'lens', 'field', 'call'];

// One browser session; collect computed styles for a matrix of room x depth.
async function collect() {
  const { chromium, exe } = deps;
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] }
                                            : { args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.addInitScript({ content: PALETTE });
    // Stub every non-file request so nothing hangs; never touch file://.
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://')) return route.continue();
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    });
    page.on('pageerror', () => {});
    await page.goto('file://' + path.join(REPO, 'studio.html'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    const read = async (room, depth) => page.evaluate(({ room, depth, LAYERS }) => {
      document.documentElement.setAttribute('data-theme', 'A');
      document.getElementById('screen-entrance')?.classList.remove('active');
      document.getElementById('screen-room').classList.add('active');
      // Enter first (resets sliders), then drive depth, then repaint.
      try { doEnterRoom(room, ROOM_META[room]); } catch (e) {}
      const el = document.getElementById('mood-dark'); if (el) el.value = String(depth);
      try { applyRoomAtmosphere(room); } catch (e) {}
      const out = { SP: typeof window.StudioPalette };
      for (const sel of LAYERS) {
        const n = document.querySelector(sel);
        out[sel] = n ? {
          bg: getComputedStyle(n).backgroundColor,
          img: getComputedStyle(n).backgroundImage,
        } : null;
      }
      return out;
    }, { room, depth, LAYERS });

    const data = { default: {}, light: {}, deep: {} };
    for (const room of ROOMS) {
      data.default[room] = await read(room, 50);
      data.light[room] = await read(room, 6);
      data.deep[room] = await read(room, 94);
    }
    return data;
  } finally {
    await browser.close();
  }
}

let DATA = null;
test.before(async () => { if (!SKIP) DATA = await collect(); });

test('the palette module actually loads in the studio DOM (guards a blind harness)', { skip: SKIP }, () => {
  // If StudioPalette is missing, applyRoomAtmosphere no-ops and the whole
  // premise of this suite is void — assert it explicitly.
  assert.strictEqual(DATA.default.work.SP, 'object', 'window.StudioPalette must be present');
});

test('each formerly-fixed shell layer resolves to a DISTINCT computed background per room', { skip: SKIP }, () => {
  for (const sel of LAYERS) {
    const seen = new Set();
    for (const room of ROOMS) {
      const layer = DATA.default[room][sel];
      assert.ok(layer, `${sel} exists in ${room}`);
      // The background carries the room hue either via backgroundColor
      // (notepad/rose surfaces, a color-mix of --card) or backgroundImage
      // (the column gradient). Fold both into the signature.
      seen.add(layer.bg + '|' + layer.img);
    }
    assert.strictEqual(seen.size, ROOMS.length,
      `${sel}: four rooms must paint four distinct fields (got ${seen.size})`);
  }
});

test('rooms differ from the fixed navy baseline (not just from each other)', { skip: SKIP }, () => {
  // The old fixed field was a cold navy (~rgb(17,24,39)); the warm rooms (work,
  // call) must read materially warmer (R > B) on the backing surfaces, proving
  // the hue reaches the paint rather than staying navy.
  const warmMustBeWarm = (room) => {
    const s = DATA.default[room]['.notepad-surface'].bg;
    const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i) ||
              s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    assert.ok(m, `${room} notepad bg parseable: ${s}`);
    const r = +m[1], b = +m[3];
    assert.ok(r > b, `${room}: warm room backing must be warmer than navy (R ${r} > B ${b})`);
  };
  warmMustBeWarm('work');
  warmMustBeWarm('call');
});

test('the depth slider genuinely lightens every shell layer (light L > deep L)', { skip: SKIP }, () => {
  for (const room of ROOMS) {
    for (const sel of LAYERS) {
      const light = DATA.light[room][sel];
      const deep = DATA.deep[room][sel];
      // Compare on backgroundColor when present & non-transparent, else the image.
      const lightStr = (light.bg && !/rgba?\(0, 0, 0, 0\)/.test(light.bg)) ? light.bg : light.img;
      const deepStr = (deep.bg && !/rgba?\(0, 0, 0, 0\)/.test(deep.bg)) ? deep.bg : deep.img;
      const lL = luminance(lightStr);
      const dL = luminance(deepStr);
      assert.ok(lL != null && dL != null, `${room} ${sel}: luminance parseable`);
      assert.ok(lL > dL + 0.05,
        `${room} ${sel}: light endpoint must be clearly lighter than deep (light ${lL.toFixed(3)} > deep ${dL.toFixed(3)})`);
    }
  }
});

test('the light endpoint reaches a genuine midtone, not merely less-dark', { skip: SKIP }, () => {
  // At least the raised backing surfaces must clear a real midtone luminance so
  // "lighter" is lighter at a glance (approved round6 palette behaviour).
  for (const room of ROOMS) {
    const s = DATA.light[room]['.notepad-surface'].bg;
    const L = luminance(s);
    assert.ok(L != null && L > 0.30,
      `${room}: light-endpoint centre backing must be a genuine midtone (L ${L && L.toFixed(3)} > 0.30)`);
  }
});
