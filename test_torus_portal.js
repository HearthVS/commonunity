/* Entrance torus portal — animation lifecycle regression tests.
   Run: node --test test_torus_portal.js   (Node 20+, no dependencies)

   Guards the fix for the entrance-page torus that spun/re-rendered forever,
   burning GPU/CPU (fan spin-up, typing latency) even after the portal opened
   and the rooms populated the sidebar. The invariants:

     1. Before the portal opens the torus animates — its rAF draw loop keeps
        rescheduling itself and paints frames.
     2. The instant the portal opens (doors-open === rooms revealed) the loop
        is actually cancelled and never reschedules again — not merely frozen
        while background render work continues.
     3. Hover/torusResume cannot silently restart the loop once stopped.

   The torus code lives inline in studio.html, so we extract initTorusPortal()
   and execute it in a vm sandbox with a minimal DOM / rAF harness. A second
   group of static-wiring assertions guards the source-level hooks so the
   behaviour cannot regress by quietly removing them. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');

// ── Extract the initTorusPortal() function source by brace matching ─────────
function extractFn(src, signature) {
  const start = src.indexOf(signature);
  assert.ok(start > -1, `${signature} must exist in studio.html`);
  let depth = 0, i = src.indexOf('{', start);
  const bodyStart = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// ── Build a fresh sandbox + harness for one initTorusPortal() run ───────────
function makeHarness() {
  const rafQueue = new Map();
  let nextRaf = 1;
  const counters = { rafCalls: 0, cancels: 0, clears: 0 };

  function requestAnimationFrame(cb) {
    const id = nextRaf++;
    rafQueue.set(id, cb);
    counters.rafCalls++;
    return id;
  }
  function cancelAnimationFrame(id) {
    if (rafQueue.delete(id)) counters.cancels++;
  }
  // Run every currently-queued frame once; self-rescheduling callbacks land
  // back in the queue for the next flush.
  function flushFrame() {
    const due = [...rafQueue.entries()];
    rafQueue.clear();
    for (const [, cb] of due) cb(performanceNow());
  }
  let clock = 0;
  function performanceNow() { return (clock += 16); }

  // No-op 2D context: any method call is a no-op; drawing is only observed via
  // clearRect (counted) so we can tell whether a frame actually painted.
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'clearRect') return () => { counters.clears++; };
      if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
  });

  function makeClassList() {
    const set = new Set();
    return {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
    };
  }

  const canvas = {
    width: 0, height: 0, style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 420 }),
    classList: makeClassList(),
    addEventListener() {},
  };
  const portal = {
    classList: makeClassList(),
    _handlers: {},
    addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
  };
  const elements = { 'torus-canvas': canvas, 'portal': portal };

  const observers = [];
  class MutationObserver {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() {}
  }

  const timers = new Map();
  let nextTimer = 1;
  function setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; }
  function clearTimeout(id) { timers.delete(id); }

  const windowObj = { devicePixelRatio: 1, innerWidth: 1000 };
  const documentObj = {
    readyState: 'complete',
    getElementById: (id) => elements[id] || null,
    addEventListener() {},
  };

  const sandbox = {
    window: windowObj, document: documentObj,
    requestAnimationFrame, cancelAnimationFrame,
    setTimeout, clearTimeout,
    MutationObserver, Math, console,
  };
  vm.createContext(sandbox);

  const fnSrc = extractFn(HTML, 'function initTorusPortal()');
  vm.runInContext(fnSrc + '\ninitTorusPortal();', sandbox);

  return { counters, flushFrame, portal, observers, windowObj };
}

test('torus animates before the portal opens (rAF loop reschedules + paints)', () => {
  const h = makeHarness();
  const afterInit = h.counters.rafCalls;
  assert.ok(afterInit >= 1, 'draw loop must be scheduled on init');

  const clearsBefore = h.counters.clears;
  h.flushFrame();
  h.flushFrame();
  h.flushFrame();
  assert.ok(h.counters.rafCalls > afterInit, 'draw must keep rescheduling itself (live animation)');
  assert.ok(h.counters.clears > clearsBefore, 'draw must actually paint frames (clearRect) before open');
});

test('opening the portal cancels the loop and it never reschedules again', () => {
  const h = makeHarness();
  h.flushFrame();  // let the loop run a couple of live frames first
  h.flushFrame();

  // Rooms revealed: doors-open lands on the portal → observer fires.
  h.portal.classList.add('doors-open');
  assert.ok(h.observers.length >= 1, 'a MutationObserver must watch the portal');
  h.observers.forEach(o => o.cb([], o));

  const cancelsAfterStop = h.counters.cancels;
  assert.ok(cancelsAfterStop >= 1, 'the pending animation frame must be cancelled on open');

  const rafAfterStop = h.counters.rafCalls;
  const clearsAfterStop = h.counters.clears;
  // Drive several frames: nothing left queued should paint or reschedule.
  h.flushFrame();
  h.flushFrame();
  h.flushFrame();
  assert.strictEqual(h.counters.rafCalls, rafAfterStop,
    'no new animation frame may be scheduled after the portal opens');
  assert.strictEqual(h.counters.clears, clearsAfterStop,
    'no further rendering (clearRect) may happen after the portal opens');
});

test('torusResume cannot restart the loop once the portal has opened', () => {
  const h = makeHarness();
  h.flushFrame();
  h.portal.classList.add('doors-open');
  h.observers.forEach(o => o.cb([], o));
  h.flushFrame();

  const rafBefore = h.counters.rafCalls;
  assert.strictEqual(typeof h.windowObj.torusResume, 'function', 'torusResume must be exposed');
  h.windowObj.torusResume();
  h.flushFrame();
  h.flushFrame();
  assert.strictEqual(h.counters.rafCalls, rafBefore,
    'torusResume must be a no-op once stopped — the loop stays dead');
});

test('window.torusStop halts a running torus directly', () => {
  const h = makeHarness();
  h.flushFrame();
  assert.strictEqual(typeof h.windowObj.torusStop, 'function', 'torusStop must be exposed');
  h.windowObj.torusStop();
  const raf = h.counters.rafCalls;
  h.flushFrame();
  h.flushFrame();
  assert.strictEqual(h.counters.rafCalls, raf, 'torusStop must stop all further rescheduling');
});

// ── Static wiring guards (source-level, so hooks can't be silently dropped) ─
test('openPortal halts the torus when rooms populate the sidebar', () => {
  const start = HTML.indexOf('function openPortal()');
  assert.ok(start > -1, 'openPortal must exist');
  const body = extractFn(HTML, 'function openPortal()');
  assert.match(body, /window\.torusStop\(\)/,
    'openPortal must call window.torusStop() so the torus stops once rooms appear');
});

test('the ring-glow rAF loop stops rescheduling once the portal opens', () => {
  const body = extractFn(HTML, 'function animRingGlow()');
  assert.match(body, /if\s*\(\s*portalOpened\s*\)\s*\{[^}]*return/,
    'animRingGlow must bail out (stop rescheduling) once portalOpened is true');
});

test('the torus draw loop is a self-rescheduling rAF loop', () => {
  const body = extractFn(HTML, 'function draw()');
  assert.match(body, /rafId\s*=\s*requestAnimationFrame\(draw\)/,
    'draw must reschedule itself via requestAnimationFrame so it animates when live');
});
