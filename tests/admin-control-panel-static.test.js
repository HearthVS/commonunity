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
assert(server.includes('compass_png_path_invite_v3'), 'admin status should expose the path-based invite template version');
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
assert(admin.includes('/api/admin/login'), 'admin page should call login API');
assert(admin.includes('/api/admin/invites'), 'admin page should call invite API');
assert(admin.includes('/send'), 'admin page should call invite send API');
assert(admin.includes('Send email'), 'admin page should include send email action');
assert(admin.includes('/threshold?invite='), 'admin page should generate threshold magic links');
assert(admin.includes('Generate magic link'), 'admin page should include invite CTA');
assert(!admin.includes('COMMONUNITY_BETA_CODE</code>'), 'admin should not encourage exposing beta code');

console.log('admin control panel static checks passed');
