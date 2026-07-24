/* stUdio shell text-contrast — REAL painted-pixel integration test (Round 8).

   Round 7 recolours the whole #screen-room shell per room and per depth. Several
   instructional labels inside the shell used a fixed colour or a compounding
   `opacity` stacked on an already-faint token, so once the surface lightened
   (worst at the light depth endpoint) they fell below WCAG AA (4.5:1). Round 8
   swaps those to the adaptive scoped tokens (--text / --text-muted) that
   applyRoomAtmosphere re-solves per room/depth. This test guards that fix.

   Two traps make cheaper audits lie, so both are avoided here:

     1. color-mix/var staleness — getComputedStyle on a property consuming
        color-mix(..var(--card)..) can return a STALE colour if depth is driven
        synchronously with no intervening paint. We drive the depth slider with a
        real `input` event and flush a requestAnimationFrame paint between steps.

     2. effBg misses the atmosphere gradient — compositing only background-color
        up the ancestor chain omits background-image:var(--bg-gradient) and falls
        through to the navy <body>, wildly under-counting contrast behind
        translucent panels. Authoritative method used here: paint the label's own
        text transparent, screenshot the element, decode the PNG, and sample the
        real painted pixel underneath as the surface.

   playwright-core + a chromium build are NOT repo dependencies, so when they are
   unavailable the whole suite SKIPS rather than fails. PNG decode uses only the
   built-in node:zlib (inline decoder below) — no external image dependency.

   Run: node --test test_studio_shell_contrast_dom.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const REPO = __dirname;
const PALETTE = fs.readFileSync(path.join(REPO, 'studio-palette.js'), 'utf8');

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

/* ── Inline PNG decoder (node:zlib only) ───────────────────────────────────
   Playwright screenshots are 8-bit PNGs (colour type 2 RGB or 6 RGBA). Parse
   the IHDR, concatenate IDAT, inflate, then reverse the per-scanline filters.
   Returns { width, height, channels, data:Uint8Array } in row-major order. */
function decodePNG(buf) {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) throw new Error('not a PNG');
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const dataStart = off + 8;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }
    off = dataStart + len + 4; // skip data + CRC
  }
  if (bitDepth !== 8) throw new Error('unsupported bit depth ' + bitDepth);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : null;
  if (!channels) throw new Error('unsupported colour type ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let rpos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rpos++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rpos++];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= channels && y > 0) ? out[(y - 1) * stride + x - channels] : 0;
      let recon;
      switch (filter) {
        case 0: recon = v; break;
        case 1: recon = v + a; break;
        case 2: recon = v + b; break;
        case 3: recon = v + ((a + b) >> 1); break;
        case 4: recon = v + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + filter);
      }
      out[y * stride + x] = recon & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

// Average an odd NxN block of pixels around the image centre → [r,g,b] 0..255.
function centrePixel(png, n = 3) {
  const { width, height, channels, data } = png;
  const cx = width >> 1, cy = height >> 1, half = n >> 1;
  let r = 0, g = 0, b = 0, count = 0;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (y * width + x) * channels;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
  }
  return [r / count, g / count, b / count];
}

// Convert an OKLCH triple to sRGB [r,g,b] 0..255. Chromium resolves the room's
// adaptive --text-muted / --text tokens to oklch(), so this branch is essential.
function oklchToRGB(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const enc = (c) => {
    c = Math.max(0, Math.min(1, c));
    return (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
  };
  return [enc(r), enc(g), enc(bb)];
}

// Parse a computed CSS colour into [r,g,b] 0..255. Handles rgb()/rgba(),
// color(srgb r g b), oklch() and hex; text tokens resolve to one of these.
function parseColor(str) {
  let m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  m = str.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255];
  m = str.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) {
    const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    return oklchToRGB(L, +m[2], +m[3]);
  }
  m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) { const h = parseInt(m[1], 16); return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
  return null;
}

function relLum([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg, bg) {
  const a = relLum(fg), b = relLum(bg);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

// Representative real selectors fixed in Round 8. `pseudo` reads the placeholder
// colour; `hideText` blanks the label's own text so the screenshot exposes the
// real painted surface behind it.
const TARGETS = [
  { name: 'mirror-rose-intro',      sel: '#mirror-intro' },
  { name: 'mirror-intro knot hint', sel: '#mirror-intro span' },
  { name: 'nexus-knock-hint',       sel: '#nexus-knock-hint' },
  { name: 'archive-drawer-title',   sel: '.archive-drawer-title' },
  { name: 'archive-section-label',  sel: '.archive-section-label' },
  { name: 'fo-media-dropzone-text', sel: '.fo-media-dropzone-text' },
  { name: 'fo-media-dropzone-hint', sel: '.fo-media-dropzone-hint' },
  { name: 'notepad placeholder',    sel: '#workbench-input', pseudo: '::placeholder' },
  { name: 'room-pill inactive',     sel: '.room-pill:not(.active)' },
  { name: 'room-pill active',       sel: '.room-pill.active' },
];

// room → { room, depth } sampled at its characteristic depth (light band = 6).
const SCENES = [
  { key: 'work',  room: 'work',  depth: 50 },
  { key: 'lens',  room: 'lens',  depth: 50 },
  { key: 'field', room: 'field', depth: 6 },
  { key: 'call',  room: 'call',  depth: 94 },
];

async function measure() {
  const { chromium, exe } = deps;
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] }
                                            : { args: ['--no-sandbox'] });
  const results = {}; // scene.key -> [{name, contrast, fg, bg, weight, hasGlow}]
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript({ content: PALETTE });
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://')) return route.continue();
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    });
    page.on('pageerror', () => {});
    await page.goto('file://' + path.join(REPO, 'studio.html'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    // Production-faithful enter: activate the room, then step the depth slider
    // with a real input event and flush a paint so every var/color-mix property
    // re-resolves (avoids the color-mix staleness trap).
    const enter = async (room, depth) => {
      await page.evaluate(({ room }) => {
        document.documentElement.setAttribute('data-theme', 'A');
        document.getElementById('screen-entrance')?.classList.remove('active');
        document.getElementById('screen-room').classList.add('active');
        try { doEnterRoom(room, ROOM_META[room]); } catch (e) {}
      }, { room });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
      // Step toward target depth in a few real input events, then re-solve the
      // atmosphere explicitly (the input listener may be unwired under file://)
      // and flush a paint so every var/color-mix property re-resolves.
      await page.evaluate(async ({ room, depth }) => {
        const el = document.getElementById('mood-dark');
        if (!el) return;
        const start = parseInt(el.value, 10) || 50;
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          const v = Math.round(start + (depth - start) * (i / steps));
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => requestAnimationFrame(() => r()));
        }
        el.value = String(depth);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        try { applyRoomAtmosphere(room); } catch (e) {}
      }, { room, depth });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    };

    const ensureVisible = async (sel) => page.evaluate((sel) => {
      const base = sel.replace(/::.*$/, '').replace(/:not\([^)]*\)/g, '');
      const el = document.querySelector(sel.includes('::') ? base : sel);
      if (!el) return false;
      let n = el;
      while (n && n !== document.body) {
        n.classList.remove('hidden', 'nexus-dormant-hidden', 'is-collapsed');
        n.style.setProperty('visibility', 'visible', 'important');
        n.style.setProperty('opacity', '1', 'important');
        if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');
        n = n.parentElement;
      }
      el.scrollIntoView({ block: 'center' });
      return true;
    }, sel);

    for (const scene of SCENES) {
      await enter(scene.room, scene.depth);
      const rows = [];
      for (const t of TARGETS) {
        const present = await ensureVisible(t.sel);
        if (!present) continue;
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

        // Read the real text colour + weight/glow BEFORE blanking the text.
        const info = await page.evaluate(({ sel, pseudo }) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el, pseudo || undefined);
          const box = el.getBoundingClientRect();
          return {
            color: cs.color,
            weight: getComputedStyle(el).fontWeight,
            shadow: getComputedStyle(el).boxShadow,
            w: box.width, h: box.height,
          };
        }, { sel: t.sel, pseudo: t.pseudo });
        if (!info || info.w < 2 || info.h < 2) continue;

        // Blank the label's own text so the screenshot exposes the painted
        // surface behind it, then shoot just the element box.
        await page.evaluate(({ sel, pseudo }) => {
          const el = document.querySelector(sel);
          if (!el) return;
          const id = '__contrast_blank__';
          document.getElementById(id)?.remove();
          const st = document.createElement('style');
          st.id = id;
          if (pseudo) {
            st.textContent = `${sel}${pseudo}{color:transparent !important;}`;
          } else {
            el.setAttribute('data-blank', '1');
            st.textContent = `[data-blank="1"]{color:transparent !important;text-shadow:none !important;}`;
          }
          document.head.appendChild(st);
        }, { sel: t.sel, pseudo: t.pseudo });
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

        const handle = await page.$(t.sel);
        if (!handle) continue;
        let buf;
        try { buf = await handle.screenshot({ type: 'png' }); }
        catch (_) { continue; }

        // Restore.
        await page.evaluate(({ sel }) => {
          document.getElementById('__contrast_blank__')?.remove();
          document.querySelector(sel)?.removeAttribute('data-blank');
        }, { sel: t.sel });

        const png = decodePNG(buf);
        const bg = centrePixel(png, 3);
        const fg = parseColor(info.color);
        if (!fg) continue;
        rows.push({
          name: t.name,
          contrast: contrast(fg, bg),
          fg, bg,
          weight: parseInt(info.weight, 10) || 400,
          hasGlow: info.shadow && info.shadow !== 'none',
        });
      }
      results[scene.key] = rows;
    }
    return results;
  } finally {
    await browser.close();
  }
}

let RESULTS = null;
test.before(async () => { if (!SKIP) RESULTS = await measure(); }, { timeout: 120000 });

test('every scene measured a representative set of shell labels (harness not vacuous)', { skip: SKIP }, () => {
  for (const scene of SCENES) {
    const rows = RESULTS[scene.key] || [];
    assert.ok(rows.length >= 8,
      `${scene.key}: expected >= 8 shell labels measured, got ${rows.length}`);
  }
});

test('all shell instructional labels clear WCAG AA (4.5:1) on their real painted surface', { skip: SKIP }, () => {
  for (const scene of SCENES) {
    for (const row of RESULTS[scene.key]) {
      assert.ok(row.contrast >= 4.5,
        `${scene.key} / ${row.name}: contrast ${row.contrast.toFixed(2)}:1 below AA ` +
        `(fg ${row.fg.map(Math.round)} on bg ${row.bg.map(Math.round)})`);
    }
  }
});

test('light-band nav (inactive room-pill @ Field 6) stays legible', { skip: SKIP }, () => {
  const rows = RESULTS.field || [];
  const pill = rows.find(r => r.name === 'room-pill inactive');
  assert.ok(pill, 'inactive room-pill measured at Field light band');
  assert.ok(pill.contrast >= 4.5,
    `inactive nav on light band ${pill.contrast.toFixed(2)}:1 below AA`);
});

test('active room-pill is distinguished by weight + glow, not colour alone', { skip: SKIP }, () => {
  for (const scene of SCENES) {
    const rows = RESULTS[scene.key] || [];
    const active = rows.find(r => r.name === 'room-pill active');
    const inactive = rows.find(r => r.name === 'room-pill inactive');
    if (!active || !inactive) continue;
    assert.ok(active.weight > inactive.weight,
      `${scene.key}: active pill must be heavier (active ${active.weight} > inactive ${inactive.weight})`);
    assert.ok(active.hasGlow,
      `${scene.key}: active pill must carry a box-shadow glow`);
  }
});
