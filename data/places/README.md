# Vendored city / timezone dataset

`city_timezones.json` is the cityMap.json from
**[city-timezones](https://github.com/kevinroberts/city-timezones)** by
Kevin Roberts (MIT-licensed), version 1.3.4.

The dataset is ~1.9 MB JSON, ~7,300 cities worldwide. Each row carries:

```
{ city, city_ascii, lat, lng, pop, country, iso2, iso3, province, timezone }
```

`timezone` is an IANA zone name (e.g. `America/Toronto`). We translate
that to a standard-time UTC offset via the static
`IANA_STANDARD_OFFSETS` table inside `sdk/place_gazetteer.js`.

We vendor the dataset (rather than depending on the npm package at
runtime) so deployments do not need a Node `node_modules` install and
the file can be served as a static asset. The dataset is loaded on
demand:

  - Node: read from disk via `require('fs')` in
    `sdk/place_gazetteer.js`.
  - Browser: fetched once and cached via
    `CommonUnityPlaces.preload(url)` (the OM Cipher modal preloads at
    boot).

To update the dataset, run:

    npm install city-timezones
    cp node_modules/city-timezones/data/cityMap.json data/places/city_timezones.json

and bump the version note above.
