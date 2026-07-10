// Fieldprint v5 — visitor-output tests.
//
// These are the tests that would have caught the live regression the user
// reported: "the builder has the import JSON function, but the website itself
// is back to the old version." The Load JSON import wrote builder state, but
// the *visitor-facing* render (phPublicHomeModel → phRenderPublicHome, the
// same seam the Workbench preview and the fullscreen 'Preview as visitor'
// toggle consume) did not reflect the imported copy, the Cipher field, the
// per-section image roles, or the clickable room destinations.
//
// Like the sibling home-*.test.mjs, studio.html is a single ~1MB app with no
// bundler, so we extract the real source blocks verbatim and exercise the
// shipped code wired together exactly as it sits in the running builder scope.
//
// Run: node tests/home-fieldprint-visitor-output.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'studio.html'), 'utf8');

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log('  ok - ' + name); }

function extractBlock(startSentinel, endSentinel) {
  const startIdx = html.indexOf(startSentinel);
  const endIdx = html.indexOf(endSentinel);
  assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'sentinel block must exist: ' + startSentinel);
  const bodyStart = html.indexOf('\n', startIdx) + 1;
  return html.slice(bodyStart, endIdx);
}

const { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage } = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',          '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>',     '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',         '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',      '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_VISUAL_IDENTITY_START>','// <HOME_PUBLIC_VISUAL_IDENTITY_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',          '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',         '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage };'
)();

console.log('Fieldprint v5 · visitor output after import');

const PUBLIC_LABELS = ['What I make', 'How I perceive', 'What keeps me alive', 'What I’m here for'];

// state.compassData exactly as the Load JSON importer leaves it: public copy on
// points.*, atmosphere on _importMeta, and private birth/mechanic fields still
// on the object (they must NEVER reach the visitor render).
function importedState() {
  return {
    compassData: {
      companion: 'Ronan Vale',
      // Private — must not leak into visitor output:
      dob: '1988-05-04', tob: '14:20', pob: 'Cork, Ireland',
      gk_profile: { life_path: 7, gates: [25, 51] },
      qa_answers: ['a private raw answer about my childhood'],
      profile: {
        first_name: 'Ronan', last_name: 'Vale',
        email: 'ronan@example.com', website: 'https://ronan.example',
        birth_coordinates: { latitude: 51.9, longitude: -8.4 }
      },
      _importMeta: {
        palette: ['#2a1f3d', '#c9a15a', '#e8e2d0'], hue: 268,
        // A layer6-style mark carrying a stray <text> node with private-looking
        // content — the scrub must strip it so nothing readable survives.
        cipherSvg: '<svg viewBox="0 0 10 10"><path d="M0 0h4v4H0z"/><text x="1" y="9">1988 Cork life_path</text></svg>',
        cipherIdentity: { seal: 'ronan-025b43fa' }
      },
      points: {
        work: {
          web_heading: 'Instruments for attention',
          web_intro: 'I build small tools that help people notice what matters.',
          highlights: ['Field notebooks', 'Quiet software'],
          web_closing: 'Come see what is on the bench.',
          summary: 'A maker of attentional instruments.',
          insights: ['Craft over scale', 'Slow tools last longer']
        },
        lens: {
          web_intro: 'I read the world through pattern and pause.',
          summary: 'Pattern-first perception.'
        },
        field: {
          web_heading: 'What keeps me alive',
          highlights: ['Long walks', 'Old friends'],
          summary: 'Restored by coastline and company.'
        },
        call: { web_intro: 'To leave the field more legible than I found it.' }
      }
    }
  };
}

// ── Imported copy reaches the visitor output (the reported bug) ──────
test('imported section copy appears in the public model, not just editor state', () => {
  const model = phPublicHomeModel(importedState());
  const work = model.rooms[0];
  assert.equal(work.heading, 'Instruments for attention');
  assert.equal(work.body, 'I build small tools that help people notice what matters.');
  assert.deepEqual(work.highlights, ['Field notebooks', 'Quiet software']);
  assert.equal(work.summary, 'A maker of attentional instruments.');
  assert.deepEqual(work.insights, ['Craft over scale', 'Slow tools last longer']);
  assert.equal(work.closing, 'Come see what is on the bench.');
});

test('imported copy is rendered into the visitor HTML', () => {
  const out = phRenderPublicHome(phPublicHomeModel(importedState()));
  assert.match(out, /Instruments for attention/);
  assert.match(out, /I build small tools that help people notice what matters\./);
  assert.match(out, /Field notebooks/);
  assert.match(out, /A maker of attentional instruments\./); // summary → destination
  assert.match(out, /Slow tools last longer/);               // insight → destination
});

// ── Cipher / Fieldprint visual field ────────────────────────────────
test('a continuous Cipher field with an inside-crop texture is emitted', () => {
  const model = phPublicHomeModel(importedState());
  assert.ok(model.cipher && model.cipher.present, 'model should carry a present cipher');
  assert.ok(model.cipher.svg && model.cipher.svg.indexOf('<svg') !== -1);
  assert.ok(model.cipher.crop.scale >= 320 && model.cipher.crop.scale <= 540);

  const out = phRenderPublicHome(model);
  assert.match(out, /class="phpub-fieldbg"/);
  assert.match(out, /data-has-cipher="true"/);
  assert.match(out, /phpub-cipher-weave/);
  assert.match(out, /data-mode="inside"/);            // zoomed single-mark crop
  assert.match(out, /--phpub-cipher-scale:/);          // seed-derived zoom
  assert.ok(!/centered-sigil|class="phpub-sigil"/.test(out), 'no literal centred sigil');
});

test('the Cipher field still renders (palette-only) with no imported svg', () => {
  const st = importedState();
  delete st.compassData._importMeta.cipherSvg;
  const out = phRenderPublicHome(phPublicHomeModel(st));
  assert.match(out, /class="phpub-fieldbg"/);
  assert.match(out, /data-mode="palette"/);
});

// ── Clickable room destinations + navigation ────────────────────────
test('four room destinations exist, addressable by :target', () => {
  const out = phRenderPublicHome(phPublicHomeModel(importedState()));
  for (let i = 1; i <= 4; i++) {
    assert.ok(out.includes('id="phpub-dest-' + i + '"'), 'missing destination ' + i);
  }
  assert.ok(!/id="phpub-dest-5"/.test(out), 'should be exactly four rooms');
});

test('overview rooms offer a Step-inside link to each destination', () => {
  const out = phRenderPublicHome(phPublicHomeModel(importedState()));
  assert.match(out, /class="phpub-room-enter" href="#phpub-dest-1"/);
  assert.match(out, /Step inside/);
});

test('each destination carries Back + Previous/Next + a room rail with public labels', () => {
  const out = phRenderPublicHome(phPublicHomeModel(importedState()));
  assert.match(out, /Back to the field/);
  assert.match(out, /rel="prev"/);
  assert.match(out, /rel="next"/);
  assert.match(out, /class="phpub-room-rail"/);
  assert.match(out, /aria-current="page"/);
  PUBLIC_LABELS.forEach((label) => {
    assert.ok(out.includes(label), 'missing public label in output: ' + label);
  });
});

test('room detail shows expanded public-safe depth (summary/insights/highlights)', () => {
  const out = phRenderPublicHome(phPublicHomeModel(importedState()));
  assert.match(out, /class="phpub-dest-summary"/);
  assert.match(out, /class="phpub-dest-insights"/);
  assert.match(out, /class="phpub-dest-highlights"/);
});

// ── Per-section image roles influence visitor output ────────────────
function previewWithImages() {
  return {
    name: 'Ronan Vale',
    sections: {
      hero: { heading: 'Instruments for attention', intro: 'A small home for careful tools.', source: 'compass' },
      work: { heading: 'Instruments for attention', intro: 'I build small tools.', highlights: ['Notebooks'],
              summary: 'Maker.', insights: ['Craft over scale'],
              image: { src: 'data:image/png;base64,AAAA', role: 'full-bleed', alt: 'The workbench' }, source: 'compass' },
      lens: { heading: '', intro: 'Pattern and pause.',
              image: { src: 'https://cdn.example/lens.jpg', role: 'background', alt: '' }, source: 'compass' },
      field: { heading: '', intro: 'Coast and company.',
               image: { src: 'data:image/jpeg;base64,BBBB', role: 'inset', alt: 'A quiet shore' }, source: 'compass' },
      call: { heading: '', intro: 'Leave the field legible.', source: 'empty' },
      invitation: { body: 'Come by.', contact: [], source: 'compass' }
    },
    cipher: { svg: '<svg><path d="M0 0h4"/></svg>', hue: 200, palette: ['#123456', '#abcdef'] }
  };
}

test('image display roles flow into the model and drive render hooks', () => {
  const model = phPublicHomeModel(previewWithImages());
  assert.equal(model.rooms[0].image.role, 'full-bleed');
  assert.equal(model.rooms[1].image.role, 'background');
  assert.equal(model.rooms[2].image.role, 'inset');

  const out = phRenderPublicHome(model);
  assert.match(out, /data-role="full-bleed"/);
  assert.match(out, /data-room-media="full-bleed"/);
  assert.match(out, /data-room-media="background"/);
  assert.match(out, /class="phpub-dest-bg"/);          // background layer
  assert.match(out, /data-role="inset"/);
  assert.match(out, /alt="The workbench"/);            // user alt text honoured
});

test('a malformed / unsafe image src is dropped (no markup injection)', () => {
  const input = previewWithImages();
  input.sections.work.image = { src: 'javascript:alert(1)', role: 'inset', alt: 'x' };
  const model = phPublicHomeModel(input);
  assert.equal(model.rooms[0].image, null);
});

// ── Privacy firewall over the real visitor output ───────────────────
test('private birth/mechanic/raw fields never appear in the visitor HTML', () => {
  const out = phRenderPublicHome(phPublicHomeModel(importedState()));
  [/1988/, /14:20/, /Cork/, /life_path/i, /gk_profile/i, /\bgates\b/i,
   /qa_answers/i, /childhood/i, /51\.9/, /-8\.4/, /birth_coordinates/i,
   /ronan-025b43fa/].forEach((re) => {
    assert.ok(!re.test(out), 'private data leaked into visitor output: ' + re);
  });
});

test('the imported Cipher svg text node is scrubbed (no readable leak in the field)', () => {
  const model = phPublicHomeModel(importedState());
  assert.ok(!/<text/i.test(model.cipher.svg), 'text node must be stripped from the mark');
  assert.ok(!/1988|Cork|life_path/.test(model.cipher.svg));
});

test('the assembled model and rendered output pass the language firewall', () => {
  const model = phPublicHomeModel(importedState());
  assert.equal(model.language.ok, true, JSON.stringify(model.language.violations));
  const out = phRenderPublicHome(model);
  assert.equal(validatePublicHomeLanguage(out).ok, true);
});

// ── Existing surfaces preserved ─────────────────────────────────────
test('in-place room editing (Tune this room) is still wired', () => {
  assert.match(html, /data-ph-tune-open="/);
  assert.match(html, /data-ph-tune-save="/);
});

test('Front door profile-photo editor controls are still wired', () => {
  assert.match(html, /wireProfileImageControls\('ph-profile-image-input',\s*'ph-profile-image-remove'\)/);
});

test('the visitor render is still fed by buildWebsitePreview → model → render', () => {
  assert.match(html, /var model = buildWebsitePreview\(\);/);
  assert.match(html, /var publicModel = phPublicHomeModel\(model\);/);
  assert.match(html, /phRenderPublicHome\(publicModel\)/);
});

test('buildWebsitePreview attaches per-section images and the cipher source', () => {
  assert.match(html, /function wpRoomImage\(key\)/);
  assert.match(html, /image:\s*\(typeof wpRoomImage === 'function'\)/);
  assert.match(html, /cipher:\s*\{/);
});

console.log('\n' + passed + ' checks passed.');
