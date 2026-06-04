/* compass-notes-splitter · regression test
 *
 * cOMpass UX refinement: the Hexagram Reader and Field Notes used to sit
 * in a fixed flex split, which left the notes cramped when the reader was
 * idle. They now share a resizable grid with a draggable gutter between
 * them (mirroring the Studio room splitter). Dragging the gutter narrower
 * hands the freed space to the Field Notes; the reader unlock/passcode
 * controls stay intact, and the gutter is hidden on the stacked mobile
 * layout.
 *
 * Static checks run everywhere. A jsdom block exercises the drag / keyboard
 * / clamp behavior when jsdom is available, and skips cleanly otherwise.
 *
 *   Run: node tests/compass-notes-splitter.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('1. label rename — "Read Gene Key" → "Hexagram Reader"');
// The redundant top-toolbar button was later removed (see
// compass-ui-cleanup.test.js); the embedded locked-panel labels are the
// surviving "Hexagram Reader" labels.
ok('each reader\'s locked label reads "Hexagram Reader"',
   (src.match(/hex-reader-locked-label[\s\S]{0,80}Hexagram Reader/g) || []).length === 4);
ok('no stale "Read Gene Key" label remains anywhere',
   !/Read Gene Key/.test(src));

console.log('\n2. splitter markup — one gutter per .notes-with-reader');
const wrappers = (src.match(/class="notes-with-reader"/g) || []).length;
ok('four .notes-with-reader wrappers (one per room)', wrappers === 4);
const splitters = (src.match(/class="notes-splitter"/g) || []).length;
ok('four .notes-splitter gutters (one per wrapper)', splitters === 4);
ok('splitter advertises role="separator" + vertical orientation',
   /class="notes-splitter" role="separator" aria-orientation="vertical"/.test(src));
ok('splitter is keyboard-focusable (tabindex)',
   /class="notes-splitter"[\s\S]{0,160}tabindex="0"/.test(src));
ok('splitter advertises aria-valuemin/max/now',
   /class="notes-splitter"[\s\S]{0,220}aria-valuemin="240"[\s\S]{0,80}aria-valuemax="720"[\s\S]{0,80}aria-valuenow="380"/.test(src));
ok('splitter carries an accessible label',
   /class="notes-splitter"[\s\S]{0,160}aria-label="Resize Hexagram Reader and Field Notes"/.test(src));

console.log('\n3. structure preserved — reader, gutter, notes in order');
// In each wrapper, the reader precedes the gutter which precedes the notes.
const order = /data-hex-reader="work"[\s\S]*?class="notes-splitter"[\s\S]*?data-key="work\.raw"/.test(src);
ok('order is hex-reader → notes-splitter → notes-col (work room)', order);
ok('reader unlock control still present (not hidden by the resize work)',
   (src.match(/class="hex-reader-unlock-btn" data-hex-action="unlock-show"/g) || []).length === 4);
ok('reader passcode input still present + type="password"',
   (src.match(/type="password" class="hex-reader-code-input"/g) || []).length === 4);

console.log('\n4. CSS — resizable grid driven by --hex-reader-width');
ok('.notes-with-reader is a grid',
   /\.notes-with-reader\s*\{[\s\S]*?display:\s*grid/.test(src));
ok('grid-template-columns reads var(--hex-reader-width)',
   /grid-template-columns:\s*var\(--hex-reader-width\)/.test(src));
ok('.notes-splitter has cursor: col-resize',
   /\.notes-splitter\s*\{[\s\S]*?cursor:\s*col-resize/.test(src));

console.log('\n5. CSS — mobile fallback (stacked, no draggable gutter)');
ok('.notes-with-reader collapses to one column ≤ 860px',
   /@media \(max-width: 860px\)[\s\S]*?\.notes-with-reader\s*\{[\s\S]*?grid-template-columns:\s*1fr/.test(src));
ok('.notes-splitter is hidden ≤ 860px',
   /@media \(max-width: 860px\)[\s\S]*?\.notes-splitter\s*\{[\s\S]*?display:\s*none/.test(src));

console.log('\n6. JS — pointer + keyboard + persistence + re-clamp');
ok('localStorage key is cu.compass.hexReaderWidth',
   /STORAGE_KEY\s*=\s*'cu\.compass\.hexReaderWidth'/.test(src));
ok('pointer down/move/up handlers wired on the splitter',
   /splitter\.addEventListener\('pointerdown'/.test(src) &&
   /splitter\.addEventListener\('pointermove'/.test(src) &&
   /splitter\.addEventListener\('pointerup'/.test(src));
ok('keydown handler wired for keyboard accessibility',
   /splitter\.addEventListener\('keydown'/.test(src));
ok('ArrowLeft shrinks reader (gives notes room); ArrowRight grows reader',
   /ArrowRight'\)\s*next = current \+ step/.test(src) &&
   /ArrowLeft'\)\s*next = current - step/.test(src));
ok('reader minimum width is 240px (prevents collapse)',
   /MIN_READER\s*=\s*240/.test(src));
ok('Field Notes minimum width is 280px (clamp keeps it usable)',
   /MIN_NOTES\s*=\s*280/.test(src));
ok('window resize re-clamps each container',
   /window\.addEventListener\('resize'[\s\S]{0,400}applyWidth\(currentReaderPx\(container\)/.test(src));
ok('initNotesSplitters is called from initHexReaders',
   /initNotesSplitters\(\);/.test(src) && /function initNotesSplitters\(/.test(src));

// ---------------------------------------------------------------------------
// 7) Dynamic — drive the IIFE-like initNotesSplitters in jsdom.
// ---------------------------------------------------------------------------
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (_) {
  try { JSDOM = require('/tmp/node_modules/jsdom').JSDOM; }
  catch (e) { JSDOM = null; }
}

if (!JSDOM) {
  console.log('\n7. dynamic splitter behavior — SKIPPED (jsdom not installed)');
} else {
  console.log('\n7. dynamic splitter behavior (jsdom)');

  // Extract the initNotesSplitters function body and run it against a
  // minimal DOM that mirrors a single .notes-with-reader grid.
  const fnMatch = src.match(/function initNotesSplitters\(\)[\s\S]*?\n\}/);
  ok('extracted initNotesSplitters source', !!fnMatch);

  if (fnMatch) {
    const dom = new JSDOM(
      '<!doctype html><html><head><style>' +
        '.notes-with-reader { display: grid; --hex-reader-width: 380px; }' +
      '</style></head><body>' +
        '<div class="notes-with-reader" id="wrap">' +
          '<div class="hex-reader" id="reader" style="width:380px;"></div>' +
          '<div class="notes-splitter" id="splitter" role="separator" ' +
            'aria-orientation="vertical" tabindex="0" ' +
            'aria-valuemin="240" aria-valuemax="720" aria-valuenow="380"></div>' +
          '<div class="notes-col" id="notes"></div>' +
        '</div>' +
      '</body></html>',
      { pretendToBeVisual: true, url: 'http://localhost/', runScripts: 'outside-only' }
    );
    const win = dom.window;
    const doc = win.document;

    const wrap = doc.getElementById('wrap');
    let readerWidth = 380;
    wrap.getBoundingClientRect = function () {
      return { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, x: 0, y: 0 };
    };
    const readerEl = doc.getElementById('reader');
    readerEl.getBoundingClientRect = function () {
      return { left: 0, top: 0, right: readerWidth, bottom: 800, width: readerWidth, height: 800, x: 0, y: 0 };
    };
    win.matchMedia = function () { return { matches: false }; }; // desktop

    // Make the extracted fn available and invoke it.
    try {
      win.eval(fnMatch[0] + '\nwindow.__initNotesSplitters = initNotesSplitters;');
      win.__initNotesSplitters();
      ok('initNotesSplitters runs inside jsdom without throwing', true);
    } catch (e) {
      ok('initNotesSplitters runs inside jsdom without throwing: ' + e.message, false);
    }

    const splitterEl = doc.getElementById('splitter');
    function fire(target, type, props) {
      const ev = new win.Event(type, { bubbles: true, cancelable: true });
      Object.keys(props || {}).forEach(function (k) { ev[k] = props[k]; });
      target.dispatchEvent(ev);
      return ev;
    }

    // Drag the gutter LEFT to x=300 → reader width should clamp to ~300px.
    fire(splitterEl, 'pointerdown', { pointerId: 1, button: 0, clientX: 380 });
    fire(splitterEl, 'pointermove', { pointerId: 1, clientX: 300 });
    const afterDrag = parseFloat(wrap.style.getPropertyValue('--hex-reader-width'));
    ok('dragging the gutter left narrows the reader (~300px, got ' + afterDrag + ')',
       afterDrag >= 295 && afterDrag <= 305);

    // Persist on pointerup.
    readerWidth = afterDrag;
    fire(splitterEl, 'pointerup', { pointerId: 1 });
    const stored = win.localStorage.getItem('cu.compass.hexReaderWidth');
    ok('pointerup persists the width to localStorage (got ' + stored + ')',
       stored && parseFloat(stored) >= 295 && parseFloat(stored) <= 305);

    // clamp() must never let the reader drop below MIN_READER (240).
    const api = win.CommonUnity && win.CommonUnity.notesSplitter;
    ok('window.CommonUnity.notesSplitter API exposed', !!api);
    if (api) {
      ok('clamp floors the reader at MIN_READER=240 (got ' + api.clamp(50, wrap) + ')',
         api.clamp(50, wrap) === 240);
      // On a 600px container, max reader = 600 - 280 - 18 = 302.
      wrap.getBoundingClientRect = function () {
        return { left: 0, top: 0, right: 600, bottom: 800, width: 600, height: 800, x: 0, y: 0 };
      };
      ok('clamp caps the reader so notes keep ≥280px (got ' + api.clamp(999, wrap) + ')',
         api.clamp(999, wrap) === 302);
    }
  }
}

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: cOMpass notes splitter regressions pass.');
}
