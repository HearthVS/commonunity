/* sacred-mode · Sacred Mode beta behavioural + parity tests
 * ============================================================
 * Sacred Mode is a changed state of an existing writing surface — Session
 * Notes in cOMpass, Field Notes in stUdio. When ON, the text is local-only
 * / in-memory: it must NOT reach the normal notes state, Nexus payloads,
 * Golden Thread, the JSON export, or admin endpoints. The only ways out are
 * the deliberate "Save as TXT" and "Offer to Nexus" actions.
 *
 * This suite exercises the shared module (sdk/sacred-mode.js) under a tiny
 * DOM stub (no jsdom needed) and runs static assertions over index.html and
 * studio.html to prove both surfaces wire the SAME module, labels, controls,
 * and host-side privacy guards.
 *
 *   Run: node tests/sacred-mode.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const studioSrc = fs.readFileSync(path.join(root, 'studio.html'), 'utf8');
const moduleSrc = fs.readFileSync(path.join(root, 'sdk', 'sacred-mode.js'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

// ── Minimal DOM stub so the IIFE can run under Node ──────────────────────
function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    attrs: {},
    _listeners: {},
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    hidden: false,
    checked: false,
    innerHTML: '',
    parentElement: null,
    nextSibling: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    insertBefore(c) { this.children.unshift(c); c.parentElement = this; return c; },
    querySelector() { return null; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    dispatch(ev) { (this._listeners[ev] || []).forEach(fn => fn({})); },
    focus() {},
    closest() { return null; }
  };
}

const downloads = [];
global.window = {};
global.document = {
  createElement: makeEl,
  body: makeEl('body')
};
global.Blob = function (parts) { this.parts = parts; };
global.URL = {
  createObjectURL() { return 'blob:stub'; },
  revokeObjectURL() {}
};
// Capture the download instead of touching the real DOM.
const realAppend = global.document.body.appendChild.bind(global.document.body);
global.document.body.appendChild = function (el) {
  if (el.tagName === 'A' && el.download != null) {
    el.click = function () { downloads.push({ name: el.download, href: el.href }); };
  }
  return realAppend(el);
};

// Load the module (defines window.CommonUnitySacred).
(function () { eval(moduleSrc); })();
const SACRED = global.window.CommonUnitySacred;

console.log('1. module loads + exposes shared API');
ok('window.CommonUnitySacred is defined', !!SACRED);
ok('exposes COPY, isActive, attach, sacredFilename, downloadTxt',
   SACRED && SACRED.COPY && typeof SACRED.isActive === 'function' &&
   typeof SACRED.attach === 'function' && typeof SACRED.sacredFilename === 'function' &&
   typeof SACRED.downloadTxt === 'function');

console.log('\n2. Save as TXT — filename + content');
const fname = SACRED.sacredFilename();
ok('filename matches commonunity-sacred-note-YYYY-MM-DD-HHMM.txt',
   /^commonunity-sacred-note-\d{4}-\d{2}-\d{2}-\d{4}\.txt$/.test(fname));
ok('filename carries no name / cipher / gene-key tokens',
   !/cipher|gene|\bgk\b/i.test(fname) && !/unity-/.test(fname.replace('commonunity-', '')));

// Build a wired surface to test the actions end-to-end.
function wireSurface(surfaceId, offerSink) {
  const textarea = makeEl('textarea');
  const chamber = makeEl('div');
  const toggle = makeEl('input'); toggle.checked = false;
  const controls = makeEl('div');
  const confirmCalls = [];
  let confirmReturn = true;
  const ctrl = SACRED.attach({
    surfaceId,
    textarea, chamberEl: chamber, toggleEl: toggle, controlsEl: controls,
    confirmFn: (m) => { confirmCalls.push(m); return confirmReturn; },
    offerToNexus: (t) => offerSink.push(t),
    toast: () => {}
  });
  return {
    textarea, chamber, toggle, controls, ctrl, confirmCalls,
    setConfirm: (v) => { confirmReturn = v; }
  };
}

console.log('\n3. enter/exit toggles active state + chamber class');
const offers = [];
const s = wireSurface('test:surface', offers);
ok('not active before toggle', SACRED.isActive('test:surface') === false);
s.toggle.checked = true;
s.toggle.dispatch('change');
ok('active after toggle on', SACRED.isActive('test:surface') === true);
ok('chamber gets .sacred-chamber-active', s.chamber.classList.contains('sacred-chamber-active'));
ok('textarea gets .sacred-textarea-active', s.textarea.classList.contains('sacred-textarea-active'));
ok('controls revealed', s.controls.hidden === false);
ok('toggle aria-pressed true', s.toggle.getAttribute('aria-pressed') === 'true');

console.log('\n4. sacred text stays in the chamber buffer, normal value restored on exit');
s.textarea.value = 'a held prayer';
// Toggling OFF restores the (empty) normal snapshot, not the sacred text.
s.toggle.checked = false;
s.toggle.dispatch('change');
ok('not active after toggle off', SACRED.isActive('test:surface') === false);
ok('normal value restored (sacred text not bled into normal field)',
   s.textarea.value === '');
ok('chamber class removed', !s.chamber.classList.contains('sacred-chamber-active'));
// Re-entering restores the in-memory sacred buffer within the same page life.
s.toggle.checked = true;
s.toggle.dispatch('change');
ok('re-entering restores in-memory sacred buffer', s.textarea.value === 'a held prayer');

console.log('\n5. Offer to Nexus — confirm + offers only the field text, no auto-save');
// Re-grab the action buttons directly from controls.
function actionButtons(controls) {
  const row = controls.children[controls.children.length - 1];
  return row.children; // [save, offer, release]
}
let btns = actionButtons(s.controls);
ok('three actions rendered (Save/Offer/Release)', btns.length === 3);
// No selection → offers full field text after confirm.
s.textarea.selectionStart = 0; s.textarea.selectionEnd = 0;
s.setConfirm(true);
btns[1].dispatch('click'); // Offer
ok('offer fired with full field text', offers[offers.length - 1] === 'a held prayer');
ok('offer asked for confirmation', s.confirmCalls.some(m => /offer/i.test(m)));

console.log('\n6. Offer to Nexus — selection sends ONLY the selection');
s.textarea.value = 'keep this · OFFER ONLY THIS';
s.textarea.selectionStart = 11; s.textarea.selectionEnd = 'keep this · OFFER ONLY THIS'.length;
const before = offers.length;
s.setConfirm(true);
btns[1].dispatch('click');
ok('only the selected substring is offered',
   offers[offers.length - 1] === s.textarea.value.slice(11));
ok('an offer was recorded', offers.length === before + 1);

console.log('\n7. Offer cancelled at confirm sends nothing');
const beforeCancel = offers.length;
s.setConfirm(false);
btns[1].dispatch('click');
ok('cancelled offer sends nothing', offers.length === beforeCancel);

console.log('\n8. Release clears the field only after confirmation');
s.textarea.value = 'release me';
s.setConfirm(false);
btns[2].dispatch('click'); // Release, declined
ok('declined release keeps text', s.textarea.value === 'release me');
s.setConfirm(true);
btns[2].dispatch('click'); // Release, confirmed
ok('confirmed release clears text', s.textarea.value === '');

console.log('\n9. Save as TXT triggers a download with the field content');
s.textarea.value = 'save this prayer';
const dlBefore = downloads.length;
btns[0].dispatch('click'); // Save as TXT
ok('a .txt download was triggered', downloads.length === dlBefore + 1);
ok('downloaded filename is the sacred pattern',
   /^commonunity-sacred-note-\d{4}-\d{2}-\d{2}-\d{4}\.txt$/.test(downloads[downloads.length - 1].name));

console.log('\n10. host integration — cOMpass (index.html)');
ok('loads the shared module', /<script src="\/sdk\/sacred-mode\.js"><\/script>/.test(indexSrc));
ok('calls initSacredMode() during init', /initSacredMode\(\);/.test(indexSrc));
ok('attaches per room with surfaceId compass:<point>',
   /surfaceId:\s*'compass:'\s*\+\s*point/.test(indexSrc));
ok('bindDataKeys input guard skips state write while sacred for raw notes',
   /CommonUnitySacred\.isActive\('compass:'\s*\+\s*point\)/.test(indexSrc) &&
   /field === 'raw'/.test(indexSrc));

console.log('\n11. host integration — stUdio (studio.html)');
ok('loads the shared module', /<script src="\/sdk\/sacred-mode\.js"><\/script>/.test(studioSrc));
ok('calls initStudioSacredMode() during init', /initStudioSacredMode\(\);/.test(studioSrc));
ok('attaches Field Notes with surfaceId studio:field-notes',
   /surfaceId:\s*'studio:field-notes'/.test(studioSrc));
ok('saveWorkbenchEntry refuses to write entries while sacred',
   /CommonUnitySacred\.isActive\('studio:field-notes'\)/.test(studioSrc) &&
   /function saveWorkbenchEntry/.test(studioSrc));

console.log('\n12. label / control parity — both surfaces use the SAME module copy');
// Neither host hardcodes the toggle label; both pull it from the module.
ok('cOMpass toggle text comes from CommonUnitySacred.COPY.TOGGLE_LABEL',
   /CommonUnitySacred\.COPY\.TOGGLE_LABEL/.test(indexSrc));
ok('stUdio toggle text comes from CommonUnitySacred.COPY.TOGGLE_LABEL',
   /CommonUnitySacred\.COPY\.TOGGLE_LABEL/.test(studioSrc));
ok('module copy is the agreed aspirational, non-warning language',
   SACRED.COPY.HELD_TAGLINE === 'Sacred Mode · held, not offered' &&
   /Local-only\. Not sent to Nexus/.test(SACRED.COPY.LOCAL_ONLY) &&
   SACRED.COPY.ACTION_SAVE_TXT === 'Save as TXT' &&
   SACRED.COPY.ACTION_RELEASE === 'Release' &&
   SACRED.COPY.ACTION_OFFER === 'Offer to Nexus');
ok('no warning words in the sacred copy',
   !/warning|danger|locked|alert|caution/i.test(JSON.stringify(SACRED.COPY)));

console.log('\n13. privacy — sacred text is never persisted by the module itself');
// Strip comments so we only inspect executable code, not the design notes.
const moduleCode = moduleSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
ok('module never calls localStorage.setItem', !/localStorage\s*\.\s*setItem/.test(moduleCode));
ok('module never calls sessionStorage.setItem', !/sessionStorage\s*\.\s*setItem/.test(moduleCode));
ok('module never touches any *Storage API in code', !/\b(local|session)Storage\b/.test(moduleCode));
ok('module documents in-memory-only buffer', /in-memory/.test(moduleSrc));

if (failed) { console.error(`\n${failed} assertion(s) FAILED`); process.exit(1); }
console.log('\nAll Sacred Mode assertions passed.');
