const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.py');
const homepage = read('homepage.html');
const threshold = read('threshold/threshold.js');
const index = read('index.html');
const betaGate = read('beta_gate.html');

assert(server.includes('@app.get("/")'), 'root route should exist');
assert(server.includes('homepage.html'), 'root route should serve homepage.html');
assert(server.includes('@app.get("/compass")'), '/compass route should exist');
assert(server.includes('@app.get("/studio")'), '/studio route should exist');
assert(server.includes('@app.get("/tuner")'), '/tuner route should exist');
assert(server.includes('@app.get("/commons")'), '/commons route should exist');
assert(server.includes('COMMONUNITY_BETA_CODE'), 'shared beta code env should be supported');
assert(server.includes('COMMONUNITY_MAGIC_LINK_TOKENS'), 'magic link token env should be supported');
assert(server.includes('commonunity_beta_access'), 'beta access cookie should be used');

assert(betaGate.includes('action="/api/beta/unlock"'), 'beta gate should post to unlock endpoint');
assert(betaGate.includes('name="next"'), 'beta gate should preserve private app destination');
assert(betaGate.includes('Private beta'), 'beta gate should clearly identify private beta access');

assert(threshold.includes('/compass?threshold=done&enter=compass'), 'threshold should hand off to /compass');
assert(index.includes("path !== '/' && path !== '/index.html' && path !== '/compass'"), 'cOMpass gate should recognize /compass');
assert(index.includes('/compass?threshold=done&enter=compass'), 'index comments/guard should document /compass handoff');

assert(!homepage.includes('commonunity-production.up.railway.app'), 'homepage should not link to raw Railway app URL');
assert(!homepage.includes('ideal-trust-production'), 'homepage should not link to raw Tuner Railway app URL');
assert(homepage.includes('href="/compass"'), 'homepage should link to same-domain /compass');
assert(homepage.includes('href="/studio"'), 'homepage should link to same-domain /studio');
assert(homepage.includes('href="/tuner"'), 'homepage should link to same-domain /tuner');
assert(homepage.includes('href="/commons"'), 'homepage should link to same-domain /commons');
assert(homepage.includes('action="/api/waitlist"'), 'waitlist should post same-domain');

console.log('domain/private beta route checks passed');
