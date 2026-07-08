// Regression tests for the post-Visitor-design-pass bugfix (PR: visitor
// bugfix). Three bugs shipped after PR #161 and are covered here so we
// never regress them:
//
//   Bug A — Fullscreen "Preview as visitor" rendered a blank surface: the
//           workbench grid had no explicit row template, so the preview
//           column's tall .phpub content pushed the row past the viewport
//           and .home-workbench's overflow:hidden clipped everything. Fix:
//           .hw-body pins its row to minmax(0, 1fr) and .hw-preview-col
//           carries height:100% + overflow:hidden so the inner
//           .hw-preview-frame's overflow:auto actually scrolls.
//
//   Bug B — The Living Profile uploader writes the visitor portrait to
//           state.identityMedia.profileImage.src, but the content seed
//           only read profile.profile_image_data / profile_image. So an
//           uploaded photo never reached the visitor hero. Fix: the seed
//           now accepts an identityMedia argument and phHomeSourceSeeds
//           threads it through; the three call-sites in the app pass
//           state.identityMedia. Front-door threshold preview also reads
//           the same slot so the "PROFILE PHOTO" tile reflects reality.
//
//   Bug C — Editing a Room label ("How I perceive", etc.) in the
//           Workbench saved the value to state.compassData.points[key]
//           .web_label but the section object returned by wpPointSection
//           never carried it forward, so phPublicRoomLabel(sec) fell back
//           to the default and the input re-hydrated to the old text on
//           the very next render. Fix: wpPointSection now returns
//           sec.label = String(p.web_label || '').trim().
//
// Run: node tests/home-visitor-bugfix.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioPath = join(__dirname, '..', 'studio.html');
const html = readFileSync(studioPath, 'utf8');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function extractBlock(startSentinel, endSentinel) {
  const startIdx = html.indexOf(startSentinel);
  const endIdx = html.indexOf(endSentinel);
  assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'sentinel block must exist: ' + startSentinel);
  const bodyStart = html.indexOf('\n', startIdx) + 1;
  return html.slice(bodyStart, endIdx);
}

// ── Load the source-seed block verbatim so Bug B is exercised on the
//    real shipped code, not a copy. ─────────────────────────────────
const { phCompassContentSeed, phHomeSourceSeeds } = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>', '// <HOME_SOURCE_SEEDS_END>') +
  '\nreturn { phCompassContentSeed, phHomeSourceSeeds };'
)();

console.log('Visitor bugfix regression tests');

// ── Bug B — identity photo plumbs from state.identityMedia ──────────
test('content seed reads state.identityMedia.profileImage.src as the primary photo', () => {
  const compass = { profile: { first_name: 'Ada', last_name: 'Lovelace' }, points: {} };
  const identityMedia = {
    profileImage: { src: 'data:image/jpeg;base64,AAA=', createdAt: '2026-07-08T00:00:00Z' }
  };
  const seed = phCompassContentSeed(compass, identityMedia);
  assert.equal(seed.photo, 'data:image/jpeg;base64,AAA=',
    'seed.photo must come from identityMedia.profileImage.src when present');
});

test('identityMedia photo wins over compass profile fallbacks', () => {
  const compass = {
    profile: {
      first_name: 'Ada',
      profile_image_data: 'data:image/jpeg;base64,OLD=',
      profile_image: 'https://old.example/portrait.jpg'
    },
    points: {}
  };
  const identityMedia = { profileImage: { src: 'data:image/jpeg;base64,NEW=' } };
  const seed = phCompassContentSeed(compass, identityMedia);
  assert.equal(seed.photo, 'data:image/jpeg;base64,NEW=',
    'identityMedia is the authoritative slot the Living Profile uploader writes');
});

test('content seed still falls back to compass profile.profile_image_data when identityMedia is empty', () => {
  const compass = {
    profile: { first_name: 'Ada', profile_image_data: 'data:image/jpeg;base64,COMPASS=' },
    points: {}
  };
  for (const im of [null, undefined, {}, { profileImage: null }, { profileImage: { src: '' } }]) {
    const seed = phCompassContentSeed(compass, im);
    assert.equal(seed.photo, 'data:image/jpeg;base64,COMPASS=',
      'compass profile field still works when the uploader slot is empty: ' + JSON.stringify(im));
  }
});

test('phHomeSourceSeeds threads identityMedia through to the content seed', () => {
  const seeds = phHomeSourceSeeds({
    compassData: { profile: { first_name: 'Ada' }, points: {} },
    identityMedia: { profileImage: { src: 'data:image/png;base64,BB=' } }
  });
  assert.equal(seeds.content.photo, 'data:image/png;base64,BB=');
});

test('phHomeSourceSeeds is safe when identityMedia is absent (no photo, no throw)', () => {
  const seeds = phHomeSourceSeeds({
    compassData: { profile: { first_name: 'Ada' }, points: {} }
  });
  assert.equal(seeds.content.photo, '',
    'no photo is expected when neither uploader nor compass carry one');
});

// ── Bug B wiring — the app passes state.identityMedia into the seed ─
test('buildWebsitePreview passes state.identityMedia into phHomeSourceSeeds', () => {
  // We assert on the shipped source so the wiring can never silently drop.
  // The three critical fragments together prove the plumbing round-trips:
  //   1. buildWebsitePreview names identityMedia when constructing the seeds
  //   2. it reads from window.state.identityMedia (not a stale field)
  //   3. phHomeSourceSeeds forwards the argument to phCompassContentSeed
  assert.match(html, /phHomeSourceSeeds\(\{[\s\S]{0,600}identityMedia:\s*\(window\.state && window\.state\.identityMedia\)/,
    'buildWebsitePreview must pass window.state.identityMedia into phHomeSourceSeeds');
  assert.match(html, /content:\s*phCompassContentSeed\(input\.compassData,\s*input\.identityMedia\)/,
    'phHomeSourceSeeds must forward identityMedia into phCompassContentSeed');
});

test('front-door threshold draft reads state.identityMedia.profileImage.src for the profile photo tile', () => {
  // phWorkbenchThresholdDraft builds the Front-door "PROFILE PHOTO" tile.
  // The fix reads the same slot the uploader writes so the tile can't say
  // "No profile photo yet" while a photo is actually stored.
  assert.match(html,
    /window\.state && window\.state\.identityMedia[\s\S]{0,400}im\.profileImage[\s\S]{0,200}profile\.profile_image_data/,
    'phWorkbenchThresholdDraft must consult identityMedia before compass profile fields');
});

// ── Bug C — custom Room label survives Save → refresh round-trip ────
test('wpPointSection returns sec.label from point.web_label so custom room labels stick', () => {
  // The Workbench Save writes state.compassData.points[key].web_label; the
  // shared model must carry that value back onto sec.label, so
  // phPublicRoomLabel(sec) returns the custom label and the input re-hydrates
  // to what the person typed instead of the fallback ("How I perceive", etc.).
  // We match the returned-object literal fragment in wpPointSection.
  assert.match(html, /var customLabel = String\(p\.web_label \|\| ''\)\.trim\(\);/,
    'wpPointSection must compute a customLabel from point.web_label');
  assert.match(html, /label:\s*customLabel,[\s\S]{0,120}source:\s*cap \?/,
    'wpPointSection must include label:customLabel in its returned section object');
});

// ── Bug A — fullscreen preview scroll chain is bounded ──────────────
test('.hw-body pins grid-template-rows so the preview column cannot push past the viewport', () => {
  assert.match(html, /\.hw-body \{[\s\S]{0,400}grid-template-rows:\s*minmax\(0,\s*1fr\)/,
    '.hw-body must set grid-template-rows: minmax(0, 1fr) to bound the row height');
});

test('.hw-preview-col is height:100%; overflow:hidden so the inner frame can scroll', () => {
  // Fixed .home-workbench root + tall .phpub child = viewport-clipped content
  // unless the preview column establishes a bounded flex parent for its
  // inner .hw-preview-frame (which carries overflow:auto).
  assert.match(html,
    /\.hw-preview-col \{[\s\S]{0,400}height:\s*100%;[\s\S]{0,120}overflow:\s*hidden/,
    '.hw-preview-col must be height:100% + overflow:hidden');
});

test('.hw-preview-frame still owns overflow:auto (the actual scroll container)', () => {
  assert.match(html, /\.hw-preview-frame \{[\s\S]{0,200}overflow:\s*auto/,
    '.hw-preview-frame keeps overflow:auto — the preview column bounds it, the frame scrolls');
});

// ── Bug A followup 1 — fullscreen preview must appear on medium widths ─
// The 1120px breakpoint originally hid .hw-preview-col by default and only
// re-revealed it under .is-preview-open. Fullscreen (.is-preview-fullscreen)
// was not covered, so on any laptop viewport under 1120px the fullscreen
// "Preview as visitor" mode rendered a fully blank body — the column was
// display:none. The fix must also expose the preview column (and collapse
// the other two grid tracks) when is-preview-fullscreen is on.
test('the 1120px breakpoint also reveals the preview column under is-preview-fullscreen', () => {
  assert.match(html,
    /@media \(max-width: 1120px\)[\s\S]{0,900}\.home-workbench\.is-preview-fullscreen \.hw-preview-col \{[^}]*display: flex[^}]*\}/,
    'is-preview-fullscreen must set .hw-preview-col to display:flex inside the 1120px media query');
  assert.match(html,
    /@media \(max-width: 1120px\)[\s\S]{0,900}\.home-workbench\.is-preview-fullscreen \.hw-body \{ grid-template-columns: 0 0 minmax\(0, 1fr\); \}/,
    'is-preview-fullscreen must collapse the other two grid tracks inside the 1120px media query');
});

// ── Bug A followup 2 — portrait hero split must be container-based ─────
// The two-column portrait hero originally fired on `@media (min-width:
// 780px)`, i.e. based on viewport width. Inside the workbench preview
// column the viewport was > 780px but the .phpub surface was only
// ~450–500px, so the grid rule fired anyway and crushed the two columns,
// visibly overlapping the hero title with the intro copy and photo. The
// fix promotes .phpub to a size container and switches the split rules to
// @container queries so the layout keys off the actual surface width.
// ── Bug A followup 3 — fullscreen preview must pin into grid track 3 ──
// When the .hw-rooms-col and .hw-work-col are display:none in fullscreen
// mode, they are removed from the CSS grid entirely. The lone remaining
// .hw-preview-col then auto-flows into track 1 (which is 0px wide),
// leaving the preview rendered at width 0 — what the user saw as a
// fully blank body. The fix must explicitly pin .hw-preview-col into
// grid track 3 (the 1fr track) when is-preview-fullscreen is on.
test('is-preview-fullscreen pins .hw-preview-col into grid track 3', () => {
  // Base rule (matches at all widths).
  assert.match(html,
    /\.home-workbench\.is-preview-fullscreen \.hw-preview-col \{[\s\S]{0,200}grid-column:\s*3\s*\/\s*4/,
    'is-preview-fullscreen must pin the preview column into grid track 3');
});

test('.phpub establishes a size container so hero layout keys off surface width, not viewport', () => {
  assert.match(html, /\.phpub \{[\s\S]{0,600}container-type:\s*inline-size;/,
    '.phpub must set container-type: inline-size');
  assert.match(html, /\.phpub \{[\s\S]{0,600}container-name:\s*phpub;/,
    '.phpub must name the container "phpub" so the queries are unambiguous');
});

test('portrait hero split uses @container phpub (min-width: 780px), not a viewport @media', () => {
  assert.match(html, /@container phpub \(min-width: 780px\)/,
    'two-column portrait hero rule must be a container query');
  assert.match(html, /@container phpub \(max-width: 779px\)/,
    'narrow-container stacked pass must also be a container query so it applies inside the workbench preview column');
  // Belt-and-braces: the old viewport @media wrapping the portrait grid
  // must not have been left behind (it would double-fire on wide viewports
  // and reintroduce the overlap regression).
  assert.doesNotMatch(html,
    /@media \(min-width: 780px\) \{\s*\.phpub-hero:has\(> \.phpub-figure\[data-imagery="portrait"\]\)/,
    'the old @media (min-width: 780px) portrait grid must be gone');
});

console.log('\n' + passed + ' checks passed.');
