/* nexus-activity-signal · CommonUnity wordless Nexus activity signal
 *
 * One signal, two surfaces. When a member sends a message to Nexus in stUdio
 * or in cOMpass, the panel outline breathes and the existing Nexus mark
 * appears with three points at the response origin. The moment real text
 * arrives the mark leaves and the outline settles. Completion and failure both
 * land in the same resting state.
 *
 * What this suite is actually protecting:
 *   • the signal is wordless — no new visible status text anywhere
 *   • it never outlives its request (the "permanent glow" failure)
 *   • it never doubles up (the "two indicators" failure)
 *   • it is the same module in both apps, not two lookalikes
 *   • it is not the microphone's listening state
 *   • it degrades to something static, not nothing, under reduced motion
 *
 * Sections:
 *   1. the shared module exists and is loaded by both apps
 *   2. the mark reuses the existing Nexus geometry, not a new logo
 *   3. CSS — three states, reduced motion, screen-reader-only status
 *   4. stUdio wiring — begin on submit, firstToken, done, fail
 *   5. cOMpass wiring — same lifecycle, local indicator retired
 *   6. wordlessness — no visible status words introduced
 *   7. the microphone's listening state stays separate
 *   8. behavioural — the lifecycle run against a minimal DOM
 *
 *   Run: node tests/nexus-activity-signal.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const studio = read('studio.html');
const index = read('index.html');
const js = read('sdk/nexus-activity.js');
const css = read('sdk/nexus-activity.css');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

// ---------------------------------------------------------------------------
console.log('1. One shared module, loaded by both surfaces');
// ---------------------------------------------------------------------------
ok('the module publishes a single global',
   /global\.CommonUnityNexusActivity = \{/.test(js));
ok('it exposes begin / reset / isActive',
   /begin: begin/.test(js) && /reset: reset/.test(js) && /isActive: isActive/.test(js));

for (const [app, html] of [['stUdio', studio], ['cOMpass', index]]) {
  ok(`${app} loads the shared stylesheet`,
     /<link rel="stylesheet" href="\/sdk\/nexus-activity\.css">/.test(html));
  ok(`${app} loads the shared script`,
     /<script src="\/sdk\/nexus-activity\.js"><\/script>/.test(html));
  ok(`${app} marks its Nexus panel as the activity field`,
     /class="[^"]*nexus-activity-field"[^>]*id="nexus-activity-field"/.test(html));
  ok(`${app} degrades safely if the module has not loaded`,
     /if \(!api\) return \{ firstToken\(\) \{\}, done\(\) \{\}, fail\(\) \{\} \};/.test(html));
}

// ---------------------------------------------------------------------------
console.log('\n2. The mark is the existing Nexus mark, not a new one');
// ---------------------------------------------------------------------------
// Same 12-point vector-equilibrium geometry and interlocking hexagram as the
// stUdio orb (#nexus-svg) and the cOMpass orb glyph. Reuse, not invention.
ok('the shared glyph keeps the 64x64 Nexus viewBox', /viewBox="0 0 64 64"/.test(js));
ok('it keeps the twelve radial vectors',
   (js.match(/<line x1="32" y1="32"/g) || []).length === 12);
ok('it keeps both hexagram triangles',
   /polygon points="32,10 52,44 12,44"/.test(js) &&
   /polygon points="32,54 12,20 52,20"/.test(js));
ok('it keeps the zero point at centre',
   /<circle cx="32" cy="32" r="3" fill="var\(--nexus-activity-color\)"/.test(js));
ok('the glyph is hidden from assistive tech (the status region speaks instead)',
   /aria-hidden="true" focusable="false"/.test(js));
ok('there are exactly three points',
   /'<i><\/i><i><\/i><i><\/i>'/.test(js));

// ---------------------------------------------------------------------------
console.log('\n3. CSS — three states, reduced motion, sr-only status');
// ---------------------------------------------------------------------------
ok('working state breathes the outline',
   /\.nexus-activity-field\.is-nexus-working \{[\s\S]*?animation: nexus-activity-breath/.test(css));
ok('the breath is slow (>= 3s), not a blink',
   /--nexus-activity-breath: (\d+(?:\.\d+)?)s/.test(css) &&
   parseFloat(css.match(/--nexus-activity-breath: (\d+(?:\.\d+)?)s/)[1]) >= 3);
ok('settling state stops the animation once text is primary',
   /\.nexus-activity-field\.is-nexus-settling \{[\s\S]*?animation: none/.test(css));
ok('colour comes from the existing warm field variable, not a new neon token',
   /--nexus-activity-color: var\(--rose-color, #c4b5fd\)/.test(css));
ok('the three points animate softly',
   /\.nexus-activity-points i \{[\s\S]*?animation: nexus-activity-point/.test(css));

const reduced = (css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/) || [''])[0];
ok('reduced motion is honoured', !!reduced);
ok('reduced motion stops the outline breathing but strengthens it',
   /\.nexus-activity-field\.is-nexus-working \{[\s\S]*?animation: none/.test(reduced) &&
   /border-color: color-mix\(in srgb, var\(--nexus-activity-color\) 48%/.test(reduced));
ok('reduced motion leaves the glyph static and still visible',
   /\.nexus-activity-glyph \{[\s\S]*?animation: none;[\s\S]*?opacity: 0\.85/.test(reduced));
ok('reduced motion leaves the points static and still visible',
   /\.nexus-activity-points i \{[\s\S]*?animation: none;[\s\S]*?opacity: 0\.65/.test(reduced));

ok('the status region is visually hidden, not display:none',
   /\.nexus-activity-status \{[\s\S]*?clip-path: inset\(50%\)/.test(css) &&
   !/\.nexus-activity-status \{[\s\S]*?display: none/.test(css));
ok('the status region is a polite live region',
   /node\.setAttribute\('role', 'status'\)/.test(js) &&
   /node\.setAttribute\('aria-live', 'polite'\)/.test(js));

// ---------------------------------------------------------------------------
console.log('\n4. stUdio wiring');
// ---------------------------------------------------------------------------
const studioSend = (studio.match(/async function sendMirrorMessage\(\)[\s\S]*?\n\}\n/) || [''])[0];
ok('sendMirrorMessage() is found', !!studioSend);
ok('the signal starts on submit',
   /const activity = studioNexusActivityBegin\(\);/.test(studioSend));
ok('the signal starts after the message is posted, before the request',
   studioSend.indexOf('studioNexusActivityBegin') > studioSend.indexOf("appendMirrorMessage('user', msg)") &&
   studioSend.indexOf('studioNexusActivityBegin') < studioSend.indexOf('await fetch'));
ok('the first streamed chunk transitions the signal',
   /if \(d\.chunk\) \{ activity\.firstToken\(\);/.test(studioSend));
ok('completion returns to rest', /activity\.done\(\);/.test(studioSend));
ok('an upstream error stops the signal',
   /else if \(d\.error && !text\) \{ activity\.fail\(\);/.test(studioSend));
ok('a mid-stream network drop stops the signal',
   /\}\)\.catch\(\(\) => \{[\s\S]*?activity\.fail\(\);/.test(studioSend));
ok('a failed request stops the signal',
   /\} catch\(e\) \{\s*\n\s*activity\.fail\(\);/.test(studioSend));
ok('the field and the response origin are distinct elements',
   /field: document\.getElementById\('nexus-activity-field'\)/.test(studio) &&
   /origin: document\.getElementById\('mirror-conversation'\)/.test(studio));
ok('rerendering the transcript clears any stale signal',
   /conv\.querySelectorAll\('\.mirror-message'\)\.forEach\(m => m\.remove\(\)\);[\s\S]{0,400}CommonUnityNexusActivity\.reset/.test(studio));

// ---------------------------------------------------------------------------
console.log('\n5. cOMpass wiring');
// ---------------------------------------------------------------------------
const compassSend = (index.match(/async function sendCompassNexusMessage\(\)[\s\S]*?\n\}\n/) || [''])[0];
ok('sendCompassNexusMessage() is found', !!compassSend);
ok('the signal starts on submit',
   /const activity = compassNexusActivityBegin\(\);/.test(compassSend));
ok('the first streamed chunk transitions the signal',
   /if \(d\.chunk\) \{ activity\.firstToken\(\);/.test(compassSend));
ok('completion returns to rest', /activity\.done\(\);/.test(compassSend));
ok('an upstream error stops the signal',
   /else if \(d\.error && !text\) \{ activity\.fail\(\);/.test(compassSend));
ok('a mid-stream network drop stops the signal',
   /\}\)\.catch\(\(\) => \{[\s\S]*?activity\.fail\(\);/.test(compassSend));
ok('a failed request stops the signal',
   /\} catch \(e\) \{\s*\n\s*activity\.fail\(\);/.test(compassSend));
ok('the Nexus bubble is no longer seeded with markup',
   /<div class="compass-nexus-bubble"><\/div>`/.test(compassSend));
ok('the app-local three-dot indicator is retired in favour of the standard',
   !/compass-nexus-typing/.test(index));
ok('reopening the panel clears any signal restored from storage',
   /CommonUnityNexusActivity\.reset\(document\.getElementById\('nexus-activity-field'\)\)/.test(index));

// ---------------------------------------------------------------------------
console.log('\n6. Wordless — no visible status text is introduced');
// ---------------------------------------------------------------------------
// The words below may exist elsewhere in these files for unrelated reasons.
// What must not exist is a *rendered* activity label: the shared markup is a
// glyph and three empty <i> elements, and nothing else.
ok('the mark renders no text nodes at all',
   !/mark\.textContent/.test(js) && !/points\.textContent/.test(js));
ok('the CSS paints no generated text',
   !/content:\s*["']/.test(css));
// Strip comments before looking for words: an explanatory comment is not a
// label the member can read.
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const word of ['Thinking', 'Attending', 'Listening', 'Please wait']) {
  ok(`no rendered "${word}" label is introduced`,
     !new RegExp(word, 'i').test(jsCode));
}
ok('the only language lives in the screen-reader status region',
   /announce\(field, STATUS_WORKING\)/.test(js) &&
   /var STATUS_WORKING = 'Nexus is preparing a response\.'/.test(js));
ok('cOMpass no longer carries the old visible-adjacent "thinking" label',
   !/aria-label="Nexus is thinking"/.test(index));

// ---------------------------------------------------------------------------
console.log('\n7. The microphone is a different event');
// ---------------------------------------------------------------------------
ok('the shared module never touches a listening/recording class',
   !/is-listening/.test(jsCode) && !/recording/.test(jsCode) &&
   !/mic-dot/.test(jsCode) && !/voice-btn/.test(jsCode));
ok('the shared CSS never styles a listening/recording state',
   !/is-listening/.test(css) && !/\.recording/.test(css) && !/mic-dot/.test(css));
ok('stUdio keeps its own voice-recording state class',
   /\.voice-btn\.recording \{/.test(studio));
ok('cOMpass keeps its own mic-recording state class',
   /\.btn-mic\.recording \{/.test(index));

// ---------------------------------------------------------------------------
console.log('\n8. Behavioural — the lifecycle against a minimal DOM');
// ---------------------------------------------------------------------------
// A deliberately small DOM: only what the module actually uses. Enough to
// prove the state machine, without pulling in a browser.
function makeDom() {
  function node(tag) {
    const el = {
      tagName: tag, children: [], parentNode: null, attrs: {},
      _classes: new Set(), _text: '', scrollTop: 0, scrollHeight: 100,
      get className() { return [...el._classes].join(' '); },
      set className(v) { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      get textContent() { return el._text; },
      set textContent(v) { el._text = String(v); },
      set innerHTML(v) { el._html = String(v); },
      get innerHTML() { return el._html || ''; },
      setAttribute(k, v) { el.attrs[k] = v; },
      getAttribute(k) { return el.attrs[k]; },
      appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
      removeChild(c) {
        const i = el.children.indexOf(c);
        if (i >= 0) { el.children.splice(i, 1); c.parentNode = null; }
        return c;
      },
      querySelectorAll(sel) {
        const cls = sel.replace(/^\./, '');
        const out = [];
        (function walk(n) {
          for (const c of n.children) { if (c._classes.has(cls)) out.push(c); walk(c); }
        })(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; }
    };
    el.classList = {
      add: (...c) => c.forEach((x) => el._classes.add(x)),
      remove: (...c) => c.forEach((x) => el._classes.delete(x)),
      contains: (c) => el._classes.has(c)
    };
    return el;
  }
  return { createElement: node, node };
}

const dom = makeDom();
const sandbox = { document: dom, window: {} };
sandbox.window = sandbox;
new Function('window', 'document', js)(sandbox, dom);
const NA = sandbox.CommonUnityNexusActivity;
ok('the module installs onto the host global', !!NA);

const WORKING = 'is-nexus-working';
const SETTLING = 'is-nexus-settling';
const marks = (f) => f.querySelectorAll('.nexus-activity-mark').length;
const status = (f) => (f.querySelector('.nexus-activity-status') || {}).textContent;

function freshField() {
  const field = dom.node('div');
  const origin = dom.node('div');
  field.appendChild(origin);
  return { field, origin };
}

// start on submit
let { field, origin } = freshField();
let run = NA.begin({ field, origin });
ok('begin: the field enters the working state', field.classList.contains(WORKING));
ok('begin: exactly one mark appears at the response origin',
   marks(field) === 1 && origin.children.some((c) => c._classes.has('nexus-activity-mark')));
ok('begin: the screen reader is told work has started',
   /preparing a response/.test(status(field)));
ok('begin: the field reports itself active', NA.isActive(field) === true);

// transition on first token
run.firstToken();
ok('firstToken: the mark is removed', marks(field) === 0);
ok('firstToken: the breathing state ends', !field.classList.contains(WORKING));
ok('firstToken: the outline settles rather than vanishing',
   field.classList.contains(SETTLING));
ok('firstToken: the screen reader is told text is arriving',
   /is responding/.test(status(field)));

// stop on done
run.done();
ok('done: every activity class is gone',
   !field.classList.contains(WORKING) && !field.classList.contains(SETTLING));
ok('done: no mark is left behind', marks(field) === 0);
ok('done: the field is no longer active', NA.isActive(field) === false);

// a done() with no text at all (a repaired blank turn) still rests
({ field, origin } = freshField());
run = NA.begin({ field, origin });
run.done();
ok('a turn that streamed nothing still returns to rest',
   marks(field) === 0 && !field.classList.contains(WORKING) &&
   !field.classList.contains(SETTLING));

// stop on error, with no residue
({ field, origin } = freshField());
run = NA.begin({ field, origin });
run.fail();
ok('fail: no glow is left on the field',
   !field.classList.contains(WORKING) && !field.classList.contains(SETTLING));
ok('fail: no mark is left behind', marks(field) === 0);
ok('fail: the screen reader is told the response did not complete',
   /could not complete/.test(status(field)));

// failing mid-stream, after text has already arrived
({ field, origin } = freshField());
run = NA.begin({ field, origin });
run.firstToken();
run.fail();
ok('a mid-stream failure clears the settled outline too',
   !field.classList.contains(SETTLING) && marks(field) === 0);

// no duplicate indicators on rapid consecutive requests
({ field, origin } = freshField());
const first = NA.begin({ field, origin });
const second = NA.begin({ field, origin });
ok('a second request does not add a second mark', marks(field) === 1);
ok('a second request re-enters the working state', field.classList.contains(WORKING));
first.done();
ok('the superseded request cannot tear down the live one',
   marks(field) === 1 && field.classList.contains(WORKING) && NA.isActive(field));
first.firstToken();
ok('the superseded request cannot transition the live one',
   field.classList.contains(WORKING) && !field.classList.contains(SETTLING));
second.done();
ok('the live request still completes cleanly',
   marks(field) === 0 && !field.classList.contains(WORKING) && !NA.isActive(field));

// cancellation
({ field, origin } = freshField());
run = NA.begin({ field, origin });
run.cancel();
ok('cancel: the field returns to rest',
   marks(field) === 0 && !field.classList.contains(WORKING) && !NA.isActive(field));
ok('cancel: the status region is cleared rather than announcing an error',
   status(field) === '');

// late callbacks after a hard reset (a room switch, a rehydrated transcript)
({ field, origin } = freshField());
run = NA.begin({ field, origin });
NA.reset(field);
ok('reset: the signal is cleared even mid-request',
   marks(field) === 0 && !field.classList.contains(WORKING) && !NA.isActive(field));
run.firstToken();
run.done();
ok('reset: a late callback from the abandoned request changes nothing',
   marks(field) === 0 && !field.classList.contains(WORKING) &&
   !field.classList.contains(SETTLING));
ok('reset on an untouched field is harmless',
   (NA.reset(dom.node('div')), true));

// ---------------------------------------------------------------------------
if (failed) {
  console.error(`\n${failed} failing assertion(s).`);
  process.exit(1);
}
console.log('\nOK: the CommonUnity Nexus activity signal behaves in both surfaces.');
