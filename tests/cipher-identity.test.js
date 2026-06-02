/* cipher-identity · regression test
 *
 * Trust architecture, layer 2: the pseudonymous OM Cipher operational identity
 * and the versioned, decoupled visual Cipher. The contract under test:
 *   • threshold/contract.js exposes deriveCipherIdentity + ensureCipherIdentity
 *   • the STABLE identity is cipher_id + unity_code + unity_point, plus an
 *     active_cipher_version_id pointer; unity_code/unity_point take the form
 *     UC-<g>.<l> / "Unity Point <g>.<l>" once a gate is known
 *   • the visual Cipher is versioned in cipher_visual.versions[]; the first
 *     entry is a Beta Cipher (stage:'beta', method:'legacy_generator',
 *     status:'active') and is decoupled from the stable identity
 *   • cipher_id is stable across re-derive; the active version derives from the
 *     identity seed (full_name+birth_date), NOT email/legal-name alone
 *   • cOMpass + Studio send the Unity Point (not the full/first name) to the AI,
 *     and the AI payloads carry NO visual-version field (decoupled)
 *   • server carries the cipher fields, prompt references the operational
 *     identity, and golden_thread gains the cipher columns (idempotent ALTER)
 *
 *   Run: node tests/cipher-identity.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const Contract = require(path.join(root, 'threshold', 'contract.js'));
const index = read('index.html');
const studio = read('studio.html');
const server = read('server.py');

let pass = 0;
function ok(cond, label) {
  assert(cond, label);
  console.log('  ok  ' + label);
  pass++;
}

console.log('1. contract exposes the cipher-identity helpers');
ok(typeof Contract.deriveCipherIdentity === 'function', 'deriveCipherIdentity is exported');
ok(typeof Contract.ensureCipherIdentity === 'function', 'ensureCipherIdentity is exported');
ok(typeof Contract.cipherIdHex === 'function', 'cipherIdHex is exported');

console.log('\n2. backfill produces a stable identity + a beta visual Cipher (no gate yet)');
const base = {
  contract_version: 1,
  identity: { full_name: 'Ada Lovelace', birth_date: '1815-12-10' },
  om_cipher: { palette: { primary: 'x', secondary: 'y', seasonal_accent: 'z', schema_version: 2, source: 'om_cipher_palette_v2' } },
  threshold: { completed: true }
};
const e1 = Contract.ensureCipherIdentity(base);
ok(e1.changed === true, 'ensureCipherIdentity reports a change when no identity exists');
const id1 = e1.contract.om_cipher.cipher_identity;
ok(/^cipher_[0-9a-f]{24}$/.test(id1.cipher_id), 'cipher_id is cipher_<24 hex>');
ok(id1.sigil_id === undefined, 'sigil_id is no longer a core identity field');
ok(/^cv_[0-9a-f]{16}$/.test(id1.active_cipher_version_id),
   'active_cipher_version_id points at a visual version (cv_<16 hex>)');
ok(id1.unity_code === '' && id1.unity_point === '', 'unity_code/unity_point blank until a gate is known');
ok(id1.version === 'v1' && id1.source === 'om_cipher_identity_v1', 'version + source stamped');

console.log('\n2b. the visual Cipher is versioned and the first entry is a Beta Cipher');
const visual1 = e1.contract.om_cipher.cipher_visual;
ok(visual1 && Array.isArray(visual1.versions) && visual1.versions.length === 1,
   'cipher_visual.versions[] holds exactly one version on first backfill');
const v1 = visual1.versions[0];
ok(v1.version_id === id1.active_cipher_version_id,
   'active_cipher_version_id resolves to the version in the array');
ok(v1.stage === 'beta', "first version stage is 'beta'");
ok(v1.method === 'legacy_generator', "first version method is 'legacy_generator'");
ok(v1.status === 'active', "first version status is 'active'");
ok(/^sigil_[0-9a-f]{16}$/.test(v1.seed_ref),
   'seed_ref keeps the internal generator linkage (legacy term, implementation detail)');

console.log('\n3. unity_code / unity_point format from the primary gate');
const e2 = Contract.ensureCipherIdentity(e1.contract, { gate: 22, line: 5 });
const id2 = e2.contract.om_cipher.cipher_identity;
ok(id2.unity_code === 'UC-22.5', 'unity_code is UC-22.5');
ok(id2.unity_point === 'Unity Point 22.5', 'unity_point is "Unity Point 22.5"');

console.log('\n4. the stable identity + active version pointer are stable across re-derive');
ok(id2.cipher_id === id1.cipher_id, 'cipher_id is preserved when a gate arrives');
ok(id2.active_cipher_version_id === id1.active_cipher_version_id,
   'active_cipher_version_id is preserved when a gate arrives');
ok(e2.contract.om_cipher.cipher_visual.versions.length === 1,
   'no new visual version is spawned by a gate change (identity vs visual are decoupled)');

console.log('\n5. the active version derives from the identity seed, not email/legal-name alone');
function activeVersion(contract) {
  const ensured = Contract.ensureCipherIdentity(contract).contract;
  return ensured.om_cipher.cipher_visual.versions[0];
}
const samePerson = activeVersion({ identity: { full_name: 'Ada Lovelace', birth_date: '1815-12-10' } });
const refPerson  = activeVersion({ identity: { full_name: 'Ada Lovelace', birth_date: '1815-12-10' } });
ok(samePerson.version_id === refPerson.version_id,
   'identical identity seeds produce the same visual version_id (deterministic)');
ok(samePerson.seed_ref === refPerson.seed_ref,
   'identical identity seeds produce the same internal seed_ref');
const otherDob = activeVersion({ identity: { full_name: 'Ada Lovelace', birth_date: '1900-01-01' } });
ok(otherDob.version_id !== samePerson.version_id,
   'a different birth_date yields a different version_id (seed uses identity, not name alone)');
// cipher_id is random per derive when none is supplied (not identity-derived).
const c1 = Contract.deriveCipherIdentity({ identity: { full_name: 'Ada Lovelace', birth_date: '1815-12-10' } });
const c2 = Contract.deriveCipherIdentity({ identity: { full_name: 'Ada Lovelace', birth_date: '1815-12-10' } });
ok(c1.cipher_id !== c2.cipher_id,
   'cipher_id is random per fresh derive (not derived from identity)');

console.log('\n5b. legacy sigil_id migrates into active_cipher_version_id (no data loss)');
const legacyShape = {
  contract_version: 1,
  identity: { full_name: 'Ada Lovelace', birth_date: '1815-12-10' },
  om_cipher: {
    palette: { primary: 'x', secondary: 'y', seasonal_accent: 'z', schema_version: 2, source: 'om_cipher_palette_v2' },
    cipher_identity: {
      cipher_id: 'cipher_aaaaaaaaaaaaaaaaaaaaaaaa',
      unity_code: '', unity_point: '',
      sigil_id: 'sigil_0123456789abcdef',
      version: 'v1', source: 'om_cipher_identity_v1'
    }
  },
  threshold: { completed: true }
};
const migratedLegacy = Contract.ensureCipherIdentity(legacyShape).contract.om_cipher.cipher_identity;
ok(migratedLegacy.active_cipher_version_id === 'sigil_0123456789abcdef',
   'a pre-existing sigil_id becomes the active_cipher_version_id (stable handle preserved)');
ok(migratedLegacy.cipher_id === 'cipher_aaaaaaaaaaaaaaaaaaaaaaaa',
   'the stable cipher_id is preserved through the migration');

console.log('\n6. migrateContract backfills the cipher identity for existing contracts');
const legacy = {
  contract_version: 1,
  identity: { full_name: 'Grace Hopper', birth_date: '1906-12-09' },
  om_cipher: { palette: { primary: 'a', secondary: 'b', seasonal_accent: 'c', schema_version: 2, source: 'om_cipher_palette_v2' } },
  threshold: { completed: true }
};
const m = Contract.migrateContract(legacy);
ok(m.migrated === true, 'migrateContract reports migrated when cipher identity is missing');
ok(/^cipher_/.test(m.contract.om_cipher.cipher_identity.cipher_id),
   'migrated contract carries a cipher_id');
// Idempotent: a second migrate finds nothing to change.
const m2 = Contract.migrateContract(m.contract);
ok(m2.migrated === false, 'migrateContract is idempotent once the identity exists');

console.log('\n7. cOMpass sends the Unity Point (not name) to the AI');
ok(/function compassCipherIdentity\(\)/.test(index), 'compassCipherIdentity helper exists');
ok(/function compassNexusAddress\(\)/.test(index), 'compassNexusAddress helper exists');
const roseSend = (index.match(/fetch\(`\$\{API_BASE\}\/rose-mirror`[\s\S]*?golden_thread:/) || [''])[0];
ok(/companion: compassNexusAddress\(\)/.test(roseSend), '/rose-mirror sends compassNexusAddress()');
ok(/unity_code:/.test(roseSend) && /cipher_id:/.test(roseSend), '/rose-mirror carries unity_code + cipher_id');
ok(!/companion: state\.companion/.test(roseSend), 'no raw full name in the /rose-mirror payload');
ok(!/active_cipher_version|cipher_visual/.test(roseSend),
   '/rose-mirror is NOT coupled to the visual Cipher version (stable identity only)');
// Golden Thread save carries the cipher fields.
const gtSave = (index.match(/async function compassSaveGoldenThread[\s\S]*?\}\);/) || [''])[0];
ok(/cipher_id:/.test(gtSave) && /unity_point:/.test(gtSave),
   'compassSaveGoldenThread writes cipher_id + unity_point alongside the key');

console.log('\n8. Studio sends the Unity Point (not name) to the AI');
ok(/function studioCipherIdentity\(\)/.test(studio), 'studioCipherIdentity helper exists');
ok(/function studioNexusAddress\(\)/.test(studio), 'studioNexusAddress helper exists');
ok((studio.match(/companion: studioNexusAddress\(\)/g) || []).length >= 2,
   'both Studio AI payloads send studioNexusAddress()');
ok((studio.match(/unity_code: \(studioCipherIdentity\(\) \|\| \{\}\)\.unity_code/g) || []).length >= 2,
   'both Studio AI payloads carry unity_code');

console.log('\n9. server carries the cipher fields + names the operational identity');
ok(/class RoseMirrorRequest[\s\S]*?unity_code: str = ""[\s\S]*?cipher_id: str = ""/.test(server),
   'RoseMirrorRequest gains unity_code + cipher_id');
ok(/class RoseRoomOpeningRequest[\s\S]*?unity_code: str = ""[\s\S]*?cipher_id: str = ""/.test(server),
   'RoseRoomOpeningRequest gains unity_code + cipher_id');
ok(/pseudonymous OM Cipher operating identity|pseudonymous OM Cipher operating label/.test(server),
   'server documents companion as the pseudonymous operating identity');
ok(/their Unity Point|Unity Point/.test(server),
   'server prompt references the Unity Point');

console.log('\n10. golden_thread gains the cipher columns (idempotent ALTER)');
ok(/cipher_id TEXT NOT NULL DEFAULT ''/.test(server) &&
   /unity_point TEXT NOT NULL DEFAULT ''/.test(server),
   'golden_thread CREATE includes cipher_id + unity_point');
ok(/PRAGMA table_info\(golden_thread\)/.test(server),
   'a PRAGMA table_info guard exists for the ALTER backfill');
ok(/ALTER TABLE golden_thread ADD COLUMN cipher_id/.test(server) &&
   /ALTER TABLE golden_thread ADD COLUMN unity_point/.test(server),
   'idempotent ALTER TABLE adds the columns to existing DBs');
ok(/INSERT INTO golden_thread \(timestamp, companion, source_app, content, note, invite_token, cipher_id, unity_point\)/.test(server),
   'the INSERT writes the cipher columns');

console.log(`\n${pass} passed`);
