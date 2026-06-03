const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.py');
const admin = read('admin.html');

assert(server.includes('_ADMIN_CODE_ENV = "ADMIN_ACCESS_CODE"'), 'admin code env should be declared');
assert(server.includes('_ADMIN_DB_ENV = "COMMONUNITY_ADMIN_DB_PATH"'), 'admin DB path env should be declared');
assert(server.includes('CREATE TABLE IF NOT EXISTS invites'), 'invites table should exist');
assert(server.includes('CREATE TABLE IF NOT EXISTS events'), 'events table should exist');
assert(server.includes('CREATE TABLE IF NOT EXISTS brand_versions'), 'brand versions table should exist');
assert(server.includes('@app.get("/api/brand/manifest")'), 'public brand manifest API should exist');
assert(server.includes('@app.get("/api/admin/brand/versions")'), 'admin brand version list API should exist');
assert(server.includes('@app.post("/api/admin/brand/versions")'), 'admin brand version create API should exist');
assert(server.includes('@app.post("/api/admin/brand/versions/{version_id}/activate")'), 'admin brand activation API should exist');
assert(server.includes('brand_field_v1'), 'brand manifest version should be exposed');
assert(server.includes('OM Field Pearl v1'), 'default non-primary brand version should be seeded');
assert(server.includes('#4f5f8f'), 'default logo palette should use muted indigo, not primary blue');
assert(server.includes('@app.get("/admin")'), '/admin page route should exist');
assert(server.includes('@app.post("/api/admin/login")'), 'admin login API should exist');
assert(server.includes('@app.get("/api/admin/invites")'), 'invite list API should exist');
assert(server.includes('@app.post("/api/admin/invites")'), 'invite create API should exist');
assert(server.includes('@app.post("/api/admin/invites/{invite_id}/revoke")'), 'invite revoke API should exist');
assert(server.includes('@app.post("/api/admin/invites/{invite_id}/send")'), 'invite send email API should exist');
assert(server.includes('@app.get("/api/admin/metrics")'), 'admin metrics API should exist');
assert(server.includes('SMTP_HOST'), 'SMTP host env should be supported');
assert(server.includes('SMTP_FROM'), 'SMTP from env should be supported');
assert(server.includes('COMMONUNITY_PUBLIC_BASE_URL'), 'public base URL env should be supported for invite links');
assert(server.includes('COMMONUNITY_INVITE_BASE_URL'), 'invite-specific base URL env should be supported for magic links');
assert(server.includes('https://commonunity.io'), 'branded CommonUnity domain should be the default invite base');
assert(server.includes('https://commonunity-production.up.railway.app'), 'Railway production invite base should be HTTPS');
assert(server.includes('@app.get("/invite/{token}")'), 'path-based email invite route should exist');
assert(server.includes("/invite/{quote(token, safe='')}"), 'email magic links should use the path-based invite route');
assert(server.includes('COMMONUNITY_FORCE_PUBLIC_BASE_URL'), 'public base URL override should be explicit so emails default to the current admin origin');
assert(server.includes('invite_email_sent'), 'invite email sent event should be recorded');
assert(server.includes('EmailMessage'), 'invite email should use stdlib email message');
assert(server.includes('add_alternative'), 'invite email should include an HTML version');
assert(server.includes('The threshold is open.'), 'invite email should include branded opening copy');
assert(server.includes('Begin the threshold'), 'invite email should include a clear CTA');
assert(server.includes('compass-email-mark.png'), 'invite email should use the cOMpass email-safe PNG mark');
assert(server.includes('email_template_version'), 'admin status should expose the invite email template version');
assert(server.includes('compass_png_branded_invite_v4'), 'admin status should expose the branded invite template version');
assert(server.includes('SMTP_FROM'), 'invite email should require explicit sender identity');
assert(!server.includes('>cOM</div>'), 'invite email should not use the placeholder cOM/OM text logo');
assert(!server.includes('transform:rotate(45deg);background:linear-gradient'), 'invite email should not synthesize a CSS diamond logo');
assert(server.includes('_lookup_active_invite(token.strip())'), 'stored invites should be accepted by beta token validation');
assert(server.includes('_set_invite_cookie(response, request, invite.strip())'), 'magic link should preserve invite context in cookie');
assert(server.includes('target = request.url.path'), 'magic links should return to the requested doorway, including /threshold');
assert(server.includes('threshold_completed'), 'threshold completion event should be tracked');
assert(server.includes('compass_entered'), 'cOMpass entry event should be tracked');

assert(admin.includes('CommonUnity Control Room'), 'admin page should have branded title');
assert(admin.includes('Hold the threshold.'), 'admin page should use branded motivational language');
assert(admin.includes('Navigation dashboard'), 'admin page should expose a top navigation dashboard');
assert(admin.includes('admin-live-links'), 'admin page should render live navigation links');
assert(admin.includes('space-status'), 'admin page should render system status cards');
assert(admin.includes('Check spaces'), 'admin page should let the user refresh space status');
assert(admin.includes("['Threshold', '/threshold'"), 'admin dashboard should link to the threshold');
assert(admin.includes("'/compass'"), 'admin dashboard should link to cOMpass');
assert(admin.includes("['Studio', '/studio'"), 'admin dashboard should link to Studio');
assert(admin.includes("['Tuner', '/tuner'"), 'admin dashboard should link to Tuner');
assert(admin.includes("['Beta gate', '/beta'"), 'admin dashboard should link to beta access');
assert(admin.includes("optionalApi('/health')"), 'admin dashboard should check app health');
assert(admin.includes("optionalApi('/api/beta/status')"), 'admin dashboard should check beta access status');
assert(admin.includes('/api/admin/login'), 'admin page should call login API');
assert(admin.includes('/api/admin/invites'), 'admin page should call invite API');
assert(admin.includes('/send'), 'admin page should call invite send API');
assert(admin.includes('Send email'), 'admin page should include send email action');
// After PR #74 the raw token is masked out of the list payload, so the panel no
// longer builds the magic link itself; the Copy link button reveals the live
// link via the server reveal endpoint instead.
assert(admin.includes('/link'), 'Copy link should fetch the live magic link from the reveal endpoint');
assert(admin.includes('data-copy-link'), 'invite rows should wire a Copy link action to the reveal endpoint');
assert(admin.includes('Generate magic link'), 'admin page should include invite CTA');

// Copy link must degrade gracefully: a shared clipboard helper that falls back
// off the async Clipboard API (only present in secure contexts) and, failing
// that, surfaces the link in a visible field — never a button that claims
// success while copying nothing.
assert(admin.includes('copyTextToClipboard'), 'admin page should use a shared clipboard helper');
assert(admin.includes("document.execCommand") && admin.includes("'copy'"),
  'clipboard helper should fall back to execCommand copy when the async Clipboard API is unavailable');
assert(admin.includes('isSecureContext'),
  'clipboard helper should only trust the async Clipboard API in a secure context');
assert(admin.includes('showManualCopy') && admin.includes('manual-copy'),
  'admin page should offer a visible manual-copy fallback when clipboard access is blocked');
assert(admin.includes('Brand Field'), 'admin page should include the Brand Field section');
assert(admin.includes('/api/admin/brand/versions'), 'admin page should call brand version APIs');
assert(admin.includes('Save as draft'), 'admin page should support brand drafts');
assert(admin.includes('Set active'), 'admin page should support activating a brand version');
assert(!admin.includes('COMMONUNITY_BETA_CODE</code>'), 'admin should not encourage exposing beta code');

console.log('admin control panel static checks passed');
