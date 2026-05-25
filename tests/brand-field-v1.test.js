const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.py');
const thresholdJs = read('threshold/threshold.js');
const thresholdCss = read('threshold/threshold.css');
const betaGate = read('beta_gate.html');
const compass = read('index.html');

assert(server.includes('brand_versions'), 'backend should persist brand versions');
assert(server.includes('/api/brand/manifest'), 'backend should expose a public brand manifest');
assert(server.includes('_active_brand_version'), 'invite email should be able to read active brand version');
assert(server.includes('email_png_path'), 'email-safe asset path should be part of brand versions');
assert(server.includes("status = 'active'"), 'brand activation should enforce active status');

for (const [name, source] of [
  ['threshold JS', thresholdJs],
  ['beta gate', betaGate],
  ['cOMpass app', compass],
]) {
  assert(source.includes('/api/brand/manifest'), `${name} should read the brand manifest`);
  assert(source.includes('--brand-logo-north'), `${name} should bind logo colors through CSS variables`);
  assert(!source.includes('fill="#b8a878"'), `${name} should not hardcode the old north logo color`);
  assert(!source.includes('fill="#7c8fc4"'), `${name} should not hardcode the old east logo color`);
  assert(!source.includes('fill="#6aaa8c"'), `${name} should not hardcode the old south logo color`);
  assert(!source.includes('fill="#c47c8f"'), `${name} should not hardcode the old west logo color`);
}

assert(betaGate.includes('id="brand-gate-logo"'), 'beta gate logo container should be targetable');
assert(betaGate.includes('manifest.logo_svg'), 'beta gate should replace the fallback logo with manifest logo_svg');
assert(betaGate.includes('logo.innerHTML = logoSvg'), 'beta gate should render the active control-panel logo SVG');

assert(thresholdCss.includes('--brand-logo-east: #4f5f8f'), 'threshold default palette should use muted indigo');
assert(betaGate.includes('--brand-logo-west: #b4787e'), 'beta gate default palette should use rose clay');
assert(compass.includes('--brand-logo-south: #6f9a84'), 'cOMpass default palette should use living sage');

console.log('brand field v1 static checks passed');
