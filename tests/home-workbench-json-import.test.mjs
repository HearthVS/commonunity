// Tests for the hOMe Workbench "Load JSON" import + per-section image model.
//
// Two layers, matching the sibling home-*.test.mjs conventions:
//   1. Pure-function unit tests — the visitor-safe normalizer is extracted
//      verbatim from the HOME_WORKBENCH_IMPORT sentinel block and exercised
//      directly (no jsdom; studio.html is a single ~1MB app).
//   2. Source-contract string assertions — the markup + DOM wiring for the
//      Load JSON control, the import review panel, and the per-section image
//      controls, which live in DOM code that can't be eval'd in isolation.
//
// Run: node tests/home-workbench-json-import.test.mjs

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

// ── Load the pure normalizer verbatim from studio.html ──────────────
const { phWorkbenchNormalizeFieldJson } = new Function(
  extractBlock('// <HOME_WORKBENCH_IMPORT_START>', '// <HOME_WORKBENCH_IMPORT_END>') +
  '\nreturn { phWorkbenchNormalizeFieldJson };'
)();

console.log('hOMe Workbench · Load JSON + per-section images');

// A realistic Field / cOMpass export carrying the four public points plus
// om_cipher visual data AND private birth fields (which must NOT be imported).
function sampleField() {
  return {
    version: 'studio-v1',
    person: 'Ronan Vale',
    compassData: {
      companion: 'Ronan Vale',
      dob: '1988-05-04',
      tob: '14:20',
      pob: 'Cork, Ireland',
      gk_profile: { life_path: 7, gates: [25, 51] },
      profile: { first_name: 'Ronan', birth_coordinates: { latitude: 51.9 } },
      points: {
        work: {
          web_heading: 'Instruments for attention',
          web_intro: 'I build small tools that help people notice what matters.',
          highlights: ['Field notebooks', 'Quiet software'],
          web_closing: 'Come see what is on the bench.',
          summary: 'Maker of attentional instruments.',
          insights: ['Craft over scale']
        },
        lens: {
          web_intro: 'I read the world through pattern and pause.',
          summary: 'Pattern-first perception.'
        },
        field: {
          web_heading: 'What keeps me alive',
          highlights: ['Long walks', 'Old friends']
        },
        call: {
          web_intro: 'To leave the field more legible than I found it.'
        }
      }
    },
    om_cipher: {
      layer4: { palette: ['#2a1f3d', '#c9a15a', '#e8e2d0'], hue: 268 },
      layer6: { svg: '<svg><path d="M0 0h4"/></svg>' },
      cipherIdentity: { seal: 'ronan-025b43fa' }
    }
  };
}

test('maps points.work/lens/field/call into the four public sections', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  assert.equal(n.ok, true);
  assert.deepEqual(n.detectedSections, ['work', 'lens', 'field', 'call']);
});

test('prefers web_heading / web_intro / highlights / web_closing for public copy', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  const w = n.sections.work;
  assert.equal(w.heading, 'Instruments for attention');
  assert.equal(w.intro, 'I build small tools that help people notice what matters.');
  assert.deepEqual(w.highlights, ['Field notebooks', 'Quiet software']);
  assert.equal(w.closing, 'Come see what is on the bench.');
  assert.deepEqual(w.insights, ['Craft over scale']);
});

test('falls back to summary/raw for intro when web_intro is absent', () => {
  const n = phWorkbenchNormalizeFieldJson({
    points: { lens: { summary: 'From the summary field.' } }
  });
  assert.equal(n.sections.lens.intro, 'From the summary field.');
});

test('reads om_cipher.layer4 palette + hue for a palette suggestion', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  assert.deepEqual(n.palette, ['#2a1f3d', '#c9a15a', '#e8e2d0']);
  assert.equal(n.hue, 268);
});

test('reads om_cipher.layer6.svg as the Cipher texture source', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  assert.match(n.cipherSvg, /^<svg>/);
});

test('privacy firewall: private birth/mechanic fields are detected and flagged', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  assert.equal(n.privacy, 'private-fields-detected');
  for (const k of ['dob', 'tob', 'pob', 'gk_profile', 'birth_coordinates']) {
    assert.ok(n.privateFields.includes(k), 'expected private field flagged: ' + k);
  }
  assert.ok(n.warnings.some(w => /NOT imported/.test(w)));
});

test('privacy firewall: private fields never leak into the public section copy', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  const blob = JSON.stringify(n.sections);
  assert.doesNotMatch(blob, /1988|14:20|Cork|life_path|gates/i);
});

test('cipherIdentity is retained as internal metadata, not public copy', () => {
  const n = phWorkbenchNormalizeFieldJson(sampleField());
  assert.ok(n.cipherIdentity && n.cipherIdentity.seal === 'ronan-025b43fa');
  assert.doesNotMatch(JSON.stringify(n.sections), /ronan-025b43fa/);
});

test('rejects non-Field JSON (no points / compassData)', () => {
  const n = phWorkbenchNormalizeFieldJson({ hello: 'world' });
  assert.equal(n.ok, false);
});

test('a clean file (no private fields) reports privacy: clean', () => {
  const n = phWorkbenchNormalizeFieldJson({
    points: { work: { web_intro: 'Just public copy.' } }
  });
  assert.equal(n.privacy, 'clean');
  assert.deepEqual(n.detectedSections, ['work']);
});

// ── Source-contract: Load JSON control + review UX ──────────────────

test('the Workbench topbar exposes a first-class Load JSON control', () => {
  assert.match(html, /id="home-workbench-import-open"/);
  assert.match(html, /Load Field JSON/);
  assert.match(html, /id="home-workbench-import-input"[^>]*accept="\.json/);
});

test('an import review region exists in the work column', () => {
  assert.match(html, /id="home-workbench-import-review"/);
});

test('the Load JSON input is wired to parse + import + review', () => {
  const idx = html.indexOf('home-workbench-import-input');
  assert.ok(idx !== -1);
  // The wiring reads the file, JSON.parses it, and calls the importer.
  assert.match(html, /phWorkbenchImportFieldJson\(raw\)/);
  assert.match(html, /phWorkbenchRenderImportReview/);
});

test('import writes only visitor-safe fields into state.compassData.points', () => {
  const idx = html.indexOf('function phWorkbenchImportFieldJson');
  assert.ok(idx !== -1, 'phWorkbenchImportFieldJson must exist');
  const body = html.slice(idx, idx + 1800);
  assert.match(body, /pt\.web_heading = sec\.heading/);
  assert.match(body, /pt\.web_intro\s*=\s*sec\.intro/);
  assert.match(body, /pt\.highlights\s*=\s*sec\.highlights/);
  assert.match(body, /saveState/);
});

// ── Source-contract: per-section image controls + tagging hooks ─────

test('per-section image controls render upload/replace/remove + role + alt', () => {
  assert.match(html, /id="hw-section-image-input"/);
  assert.match(html, /id="hw-section-image-remove"/);
  assert.match(html, /id="hw-section-image-role"/);
  assert.match(html, /id="hw-section-image-alt"/);
});

test('the work column renders + wires the section image control', () => {
  assert.match(html, /phWorkbenchRenderSectionImage\(key\)/);
  assert.match(html, /phWorkbenchWireSectionImage\(key\)/);
});

test('Studio Window model carries display role, alt, and tagging hooks', () => {
  assert.match(html, /STUDIO_WINDOW_IMAGE_ROLES\s*=\s*\['inset',\s*'full-bleed',\s*'background',\s*'artifact',\s*'hero'\]/);
  assert.match(html, /STUDIO_WINDOW_TAG_VOCAB/);
  // The required tagging vocabulary hooks are all present.
  for (const tag of ['homepage', 'hero', 'background', 'what-i-make',
    'how-i-perceive', 'what-keeps-me-alive', 'what-im-here-for', 'public', 'private']) {
    assert.ok(html.includes("'" + tag + "'"), 'tag vocab must include: ' + tag);
  }
});

test('studioWindowAdd persists role/alt/tags additively', () => {
  const idx = html.indexOf('function studioWindowAdd');
  assert.ok(idx !== -1);
  const body = html.slice(idx, idx + 1300);
  assert.match(body, /role:\s*normalizeStudioWindowRole/);
  assert.match(body, /alt:/);
  assert.match(body, /tags:/);
  assert.match(body, /visibility:\s*normalizeStudioWindowVisibility/);
});

test('setters exist for role + alt on room images', () => {
  assert.match(html, /function studioWindowSetRole/);
  assert.match(html, /function studioWindowSetAlt/);
});

test('rendered Studio Window image prefers user alt text', () => {
  const idx = html.indexOf('function renderStudioWindow(mode)');
  assert.ok(idx !== -1);
  const body = html.slice(idx, idx + 1400);
  assert.match(body, /it\.alt/);
});

test('the Front door profile photo editor is preserved (not replaced)', () => {
  // Regression guard: the per-section image work must not remove the Front
  // door profile-photo editor wiring.
  assert.match(html, /wireProfileImageControls\('ph-profile-image-input',\s*'ph-profile-image-remove'\)/);
});

console.log('\n' + passed + ' checks passed.');
