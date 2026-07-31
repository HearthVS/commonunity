# Vendored city / timezone dataset

`city_timezones.json` is a union of two sources:

  - the cityMap.json from
    **[city-timezones](https://github.com/kevinroberts/city-timezones)** by
    Kevin Roberts (MIT-licensed), version 1.3.4 — 7,329 rows, kept
    verbatim; and
  - the **[GeoNames](https://download.geonames.org/export/dump/)**
    `cities15000` tier (CC BY 4.0) — 14,398 rows for cities the first
    source did not cover.

Together, ~21,700 cities worldwide, ~3.9 MB JSON (~0.7 MB gzipped). Each
row carries:

```
{ city, city_ascii?, lat, lng, pop, country, iso2, iso3?, province,
  timezone, state_ansi?, geonameid? }
```

`timezone` is an IANA zone name (e.g. `America/Toronto`). We translate
that to a standard-time UTC offset via the static
`IANA_STANDARD_OFFSETS` table inside `sdk/place_gazetteer.js` — every
zone in the dataset must have an entry there, which
`tests/place-gazetteer.test.js` enforces.

`geonameid` is present only on the GeoNames rows and becomes the
canonical `place_id`, so a chosen place keeps its identity when the
dataset is refreshed. Rows from the original vendoring have no GeoNames
id and keep the id derived from their name and coordinates, which is
what places chosen before the merge were stored under.

The merge is deliberately additive. GeoNames names some settlements
differently — its Sudbury, Ontario is "Greater Sudbury" — so replacing
the older rows outright would have quietly moved birth places people had
already saved.

We vendor the dataset (rather than depending on the npm package at
runtime) so deployments do not need a Node `node_modules` install and
the file can be served as a static asset. The dataset is loaded on
demand:

  - Node: read from disk via `require('fs')` in
    `sdk/place_gazetteer.js`.
  - Browser: fetched once and cached via
    `CommonUnityPlaces.preload(url)` (cOMpass and the threshold both
    preload at boot).

Both `/sdk` and `/data` are served with `max-age=14400` behind a CDN, so
the browser URLs carry a `?v=` key. Bump it in **both** `index.html` and
`threshold/threshold.html` whenever this file or the gazetteer changes,
or warm clients will pair new markup with a stale dataset.

To refresh the GeoNames layer, download `cities15000.zip`,
`admin1CodesASCII.txt` and `countryInfo.txt` from
<https://download.geonames.org/export/dump/>, unzip into one directory,
and run:

    node data/places/build_city_timezones.js <that-directory>

The script appends only cities the file does not already have (matched
by name+country, or within ~25 km in the same country), so re-running it
is safe.
