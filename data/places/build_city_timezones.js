/* Rebuild data/places/city_timezones.json from a GeoNames cities15000 dump.
 *
 * The file is a union, not a replacement: every row from the original
 * city-timezones vendoring is kept byte-identical, and GeoNames rows are
 * appended only where they add a city the old dataset did not have. That
 * keeps labels, coordinates and derived place ids stable for places people
 * have already chosen — GeoNames names some of them differently (its
 * Sudbury, Ontario is "Greater Sudbury"), so a straight replace would
 * silently move existing birth places.
 *
 * Usage:
 *   node data/places/build_city_timezones.js <geonames-dir>
 *
 * <geonames-dir> must contain cities15000.txt, admin1CodesASCII.txt and
 * countryInfo.txt from https://download.geonames.org/export/dump/.
 * Re-running against the produced file is a no-op: the appended rows
 * already satisfy the dedupe test.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node data/places/build_city_timezones.js <geonames-dir>');
  process.exit(1);
}

const OUT = path.join(__dirname, 'city_timezones.json');

// Same folding the gazetteer uses, so dedupe agrees with lookup.
function slug(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function readLines(name) {
  return fs.readFileSync(path.join(dir, name), 'utf8').split('\n');
}

const base = JSON.parse(fs.readFileSync(OUT, 'utf8'));

// admin1 code ("CA.08") -> region name ("Ontario").
const admin1 = new Map();
for (const line of readLines('admin1CodesASCII.txt')) {
  const f = line.split('\t');
  if (f.length >= 2) admin1.set(f[0], f[1]);
}

// iso2 -> country name. Prefer the name the existing dataset already uses
// so merged rows read the same ("United States of America", not GeoNames'
// "United States"); fall back to countryInfo for countries it never had.
const country = new Map();
for (const line of readLines('countryInfo.txt')) {
  if (line.startsWith('#')) continue;
  const f = line.split('\t');
  if (f.length >= 5 && f[0] && f[4]) country.set(f[0], f[4]);
}
for (const r of base) if (r.iso2 && r.country) country.set(r.iso2, r.country);

// Dedupe indexes over the existing rows: exact city+country, plus a
// coarse geographic bucket so a renamed city ("Greater Sudbury") is
// recognised as one we already carry.
const byName = new Set();
const byCell = new Map();
const cell = (lat, lng) => Math.round(lat * 4) + ':' + Math.round(lng * 4);
for (const r of base) {
  const s = slug(r.city_ascii || r.city);
  if (!s) continue;
  byName.add(s + '|' + (r.iso2 || ''));
  const lat = Number(r.lat), lng = Number(r.lng);
  if (!isFinite(lat) || !isFinite(lng)) continue;
  const key = (r.iso2 || '') + '|' + cell(lat, lng);
  if (!byCell.has(key)) byCell.set(key, []);
  byCell.get(key).push([lat, lng]);
}

// ~25 km, the radius within which two rows are the same settlement
// under a different name.
function nearExisting(iso2, lat, lng) {
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      const key = iso2 + '|' + (Math.round(lat * 4) + dLat) + ':' + (Math.round(lng * 4) + dLng);
      for (const [bLat, bLng] of byCell.get(key) || []) {
        const y = (lat - bLat) * 111;
        const x = (lng - bLng) * 111 * Math.cos((lat * Math.PI) / 180);
        if (Math.sqrt(x * x + y * y) < 25) return true;
      }
    }
  }
  return false;
}

const added = [];
let skipped = 0;
for (const line of readLines('cities15000.txt')) {
  const f = line.split('\t');
  if (f.length < 18) continue;
  const [id, name, ascii] = f;
  const lat = Number(f[4]), lng = Number(f[5]);
  const iso2 = f[8], a1 = f[10], pop = Number(f[14]), tz = f[17];
  if (!name || !iso2 || !isFinite(lat) || !isFinite(lng)) continue;

  const s = slug(ascii || name);
  if (!s) continue;
  if (byName.has(s + '|' + iso2) || nearExisting(iso2, lat, lng)) { skipped++; continue; }

  const row = {
    city: name,
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    pop: pop || 0,
    country: country.get(iso2) || '',
    iso2,
    province: admin1.get(iso2 + '.' + a1) || '',
    timezone: tz,
    geonameid: Number(id)
  };
  if (ascii && ascii !== name) row.city_ascii = ascii;
  // US admin1 codes are the state ANSI abbreviations the gazetteer
  // already accepts as a query token ("springfield il").
  if (iso2 === 'US' && /^[A-Z]{2}$/.test(a1)) row.state_ansi = a1;

  added.push(row);
  byName.add(s + '|' + iso2);
}

const out = base.concat(added);
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
console.log('base %d + geonames %d (skipped %d as already covered) = %d rows',
  base.length, added.length, skipped, out.length);
