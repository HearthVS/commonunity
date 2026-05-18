/* CommonUnity place gazetteer — deterministic local resolver for
 * birth-place strings → { latitude, longitude, tzOffsetMinutes, iana }.
 *
 * Backing dataset: a vendored copy of `city-timezones` (Kevin Roberts,
 * MIT — https://github.com/kevinroberts/city-timezones), ~7,300 cities
 * worldwide with city / lat / lng / iso2 / iso3 / province / timezone
 * (IANA name). The dataset lives at `data/places/city_timezones.json`;
 * see `data/places/README.md` for provenance.
 *
 * Resolution strategy (no runtime network calls):
 *
 *   1. Accept either a free-form string ("Sudbury ontario canada",
 *      "Sudbury, Ontario, Canada") or a structured shape
 *      `{ city, province?, state?, country? }`.
 *   2. Tokenise + ASCII-fold + lowercase. Try the full slug, then
 *      progressively drop trailing tokens, then leading tokens. For
 *      ambiguous matches (e.g. "Springfield"), prefer the row whose
 *      province and/or country token also appears in the original
 *      query; otherwise prefer the largest population.
 *   3. Translate the IANA `timezone` field to a UTC offset (minutes
 *      east of UTC, standard time, NO DST) via the curated
 *      `IANA_STANDARD_OFFSETS` table inside this module. The HD engine
 *      works off a sealed birth instant; users who know their birth
 *      was in DST can override `birth_tz_offset_minutes` directly.
 *
 * Loading model:
 *
 *   - Node: the vendored JSON is required synchronously the first
 *     time `resolve()` is called.
 *   - Browser: the JSON must be preloaded once via
 *     `CommonUnityPlaces.preload(url)`. While preload is in flight or
 *     unloaded, an EMERGENCY_INLINE table (Markus's Sudbury entry plus
 *     a handful of common cities) covers the most-tested paths so the
 *     OM Cipher modal still resolves Sudbury immediately on import.
 *
 * Exposes both CommonJS (module.exports) and a global
 * `CommonUnityPlaces` for browser <script src=…> usage.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CommonUnityPlaces = api;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────
  // IANA → standard-time UTC offset (minutes east of UTC).
  //
  // We intentionally use STANDARD (non-DST) offsets so the result is
  // deterministic without a runtime DST database. A user born during
  // local DST can override `birth_tz_offset_minutes` directly in the
  // OM Cipher modal.
  //
  // Coverage: every IANA zone that appears in the vendored
  // city_timezones.json dataset. (Generated from `Set(rows.timezone)`
  // and folded into a hand-maintained constant; new zones should be
  // added here when the dataset is updated.)
  // ──────────────────────────────────────────────────────────────────
  var IANA_STANDARD_OFFSETS = {
    // Africa
    'Africa/Abidjan':            0,
    'Africa/Accra':              0,
    'Africa/Addis_Ababa':      180,
    'Africa/Algiers':           60,
    'Africa/Asmara':           180,
    'Africa/Bamako':             0,
    'Africa/Bangui':            60,
    'Africa/Banjul':             0,
    'Africa/Bissau':             0,
    'Africa/Blantyre':         120,
    'Africa/Brazzaville':       60,
    'Africa/Bujumbura':        120,
    'Africa/Cairo':            120,
    'Africa/Casablanca':         0,
    'Africa/Ceuta':             60,
    'Africa/Conakry':            0,
    'Africa/Dakar':              0,
    'Africa/Dar_es_Salaam':    180,
    'Africa/Djibouti':         180,
    'Africa/Douala':            60,
    'Africa/El_Aaiun':           0,
    'Africa/Freetown':           0,
    'Africa/Gaborone':         120,
    'Africa/Harare':           120,
    'Africa/Johannesburg':     120,
    'Africa/Juba':             180,
    'Africa/Kampala':          180,
    'Africa/Khartoum':         120,
    'Africa/Kigali':           120,
    'Africa/Kinshasa':          60,
    'Africa/Lagos':             60,
    'Africa/Libreville':        60,
    'Africa/Lome':               0,
    'Africa/Luanda':            60,
    'Africa/Lubumbashi':       120,
    'Africa/Lusaka':           120,
    'Africa/Malabo':            60,
    'Africa/Maputo':           120,
    'Africa/Maseru':           120,
    'Africa/Mbabane':          120,
    'Africa/Mogadishu':        180,
    'Africa/Monrovia':           0,
    'Africa/Nairobi':          180,
    'Africa/Ndjamena':          60,
    'Africa/Niamey':            60,
    'Africa/Nouakchott':         0,
    'Africa/Ouagadougou':        0,
    'Africa/Porto-Novo':        60,
    'Africa/Sao_Tome':           0,
    'Africa/Tripoli':          120,
    'Africa/Tunis':             60,
    'Africa/Windhoek':         120,
    // America
    'America/Adak':           -600,
    'America/Anchorage':      -540,
    'America/Anguilla':       -240,
    'America/Antigua':        -240,
    'America/Araguaina':      -180,
    'America/Argentina/Buenos_Aires': -180,
    'America/Argentina/Catamarca':    -180,
    'America/Argentina/Cordoba':      -180,
    'America/Argentina/Jujuy':        -180,
    'America/Argentina/La_Rioja':     -180,
    'America/Argentina/Mendoza':      -180,
    'America/Argentina/Rio_Gallegos': -180,
    'America/Argentina/Salta':        -180,
    'America/Argentina/San_Juan':     -180,
    'America/Argentina/San_Luis':     -180,
    'America/Argentina/Tucuman':      -180,
    'America/Argentina/Ushuaia':      -180,
    'America/Aruba':          -240,
    'America/Asuncion':       -240,
    'America/Atikokan':       -300,
    'America/Bahia':          -180,
    'America/Bahia_Banderas': -360,
    'America/Barbados':       -240,
    'America/Belem':          -180,
    'America/Belize':         -360,
    'America/Blanc-Sablon':   -240,
    'America/Boa_Vista':      -240,
    'America/Bogota':         -300,
    'America/Boise':          -420,
    'America/Cambridge_Bay':  -420,
    'America/Campo_Grande':   -240,
    'America/Cancun':         -300,
    'America/Caracas':        -240,
    'America/Cayenne':        -180,
    'America/Cayman':         -300,
    'America/Chicago':        -360,
    'America/Chihuahua':      -420,
    'America/Costa_Rica':     -360,
    'America/Creston':        -420,
    'America/Cuiaba':         -240,
    'America/Curacao':        -240,
    'America/Danmarkshavn':      0,
    'America/Dawson':         -480,
    'America/Dawson_Creek':   -420,
    'America/Denver':         -420,
    'America/Detroit':        -300,
    'America/Dominica':       -240,
    'America/Edmonton':       -420,
    'America/Eirunepe':       -300,
    'America/El_Salvador':    -360,
    'America/Fortaleza':      -180,
    'America/Glace_Bay':      -240,
    'America/Godthab':        -180,
    'America/Goose_Bay':      -240,
    'America/Grand_Turk':     -300,
    'America/Grenada':        -240,
    'America/Guadeloupe':     -240,
    'America/Guatemala':      -360,
    'America/Guayaquil':      -300,
    'America/Guyana':         -240,
    'America/Halifax':        -240,
    'America/Havana':         -300,
    'America/Hermosillo':     -420,
    'America/Indiana/Indianapolis': -300,
    'America/Indiana/Knox':         -360,
    'America/Indiana/Marengo':      -300,
    'America/Indiana/Petersburg':   -300,
    'America/Indiana/Tell_City':    -360,
    'America/Indiana/Vevay':        -300,
    'America/Indiana/Vincennes':    -300,
    'America/Indiana/Winamac':      -300,
    'America/Inuvik':         -420,
    'America/Iqaluit':        -300,
    'America/Jamaica':        -300,
    'America/Juneau':         -540,
    'America/Kentucky/Louisville':  -300,
    'America/Kentucky/Monticello':  -300,
    'America/Kralendijk':     -240,
    'America/La_Paz':         -240,
    'America/Lima':           -300,
    'America/Los_Angeles':    -480,
    'America/Lower_Princes':  -240,
    'America/Maceio':         -180,
    'America/Managua':        -360,
    'America/Manaus':         -240,
    'America/Marigot':        -240,
    'America/Martinique':     -240,
    'America/Matamoros':      -360,
    'America/Mazatlan':       -420,
    'America/Menominee':      -360,
    'America/Merida':         -360,
    'America/Metlakatla':     -540,
    'America/Mexico_City':    -360,
    'America/Miquelon':       -180,
    'America/Moncton':        -240,
    'America/Monterrey':      -360,
    'America/Montevideo':     -180,
    'America/Montserrat':     -240,
    'America/Nassau':         -300,
    'America/New_York':       -300,
    'America/Nipigon':        -300,
    'America/Nome':           -540,
    'America/Noronha':        -120,
    'America/North_Dakota/Beulah':   -360,
    'America/North_Dakota/Center':   -360,
    'America/North_Dakota/New_Salem':-360,
    'America/Ojinaga':        -420,
    'America/Panama':         -300,
    'America/Pangnirtung':    -300,
    'America/Paramaribo':     -180,
    'America/Phoenix':        -420,
    'America/Port-au-Prince': -300,
    'America/Port_of_Spain':  -240,
    'America/Porto_Velho':    -240,
    'America/Puerto_Rico':    -240,
    'America/Punta_Arenas':   -180,
    'America/Rainy_River':    -360,
    'America/Rankin_Inlet':   -360,
    'America/Recife':         -180,
    'America/Regina':         -360,
    'America/Resolute':       -360,
    'America/Rio_Branco':     -300,
    'America/Santarem':       -180,
    'America/Santiago':       -240,
    'America/Santo_Domingo':  -240,
    'America/Sao_Paulo':      -180,
    'America/Scoresbysund':   -120,
    'America/Sitka':          -540,
    'America/St_Barthelemy':  -240,
    'America/St_Johns':       -210,
    'America/St_Kitts':       -240,
    'America/St_Lucia':       -240,
    'America/St_Thomas':      -240,
    'America/St_Vincent':     -240,
    'America/Swift_Current':  -360,
    'America/Tegucigalpa':    -360,
    'America/Thule':          -240,
    'America/Thunder_Bay':    -300,
    'America/Tijuana':        -480,
    'America/Toronto':        -300,
    'America/Tortola':        -240,
    'America/Vancouver':      -480,
    'America/Whitehorse':     -480,
    'America/Winnipeg':       -360,
    'America/Yakutat':        -540,
    'America/Yellowknife':    -420,
    // Antarctica / Arctic
    'Antarctica/Casey':          480,
    'Antarctica/Davis':          420,
    'Antarctica/DumontDUrville': 600,
    'Antarctica/Macquarie':      660,
    'Antarctica/Mawson':         300,
    'Antarctica/McMurdo':        720,
    'Antarctica/Palmer':        -180,
    'Antarctica/Rothera':       -180,
    'Antarctica/Syowa':          180,
    'Antarctica/Troll':            0,
    'Antarctica/Vostok':         360,
    'Arctic/Longyearbyen':        60,
    // Asia
    'Asia/Aden':         180,
    'Asia/Almaty':       360,
    'Asia/Amman':        120,
    'Asia/Anadyr':       720,
    'Asia/Aqtau':        300,
    'Asia/Aqtobe':       300,
    'Asia/Ashgabat':     300,
    'Asia/Atyrau':       300,
    'Asia/Baghdad':      180,
    'Asia/Bahrain':      180,
    'Asia/Baku':         240,
    'Asia/Bangkok':      420,
    'Asia/Barnaul':      420,
    'Asia/Beirut':       120,
    'Asia/Bishkek':      360,
    'Asia/Brunei':       480,
    'Asia/Chita':        540,
    'Asia/Choibalsan':   480,
    'Asia/Colombo':      330,
    'Asia/Damascus':     120,
    'Asia/Dhaka':        360,
    'Asia/Dili':         540,
    'Asia/Dubai':        240,
    'Asia/Dushanbe':     300,
    'Asia/Famagusta':    120,
    'Asia/Gaza':         120,
    'Asia/Hebron':       120,
    'Asia/Ho_Chi_Minh':  420,
    'Asia/Hong_Kong':    480,
    'Asia/Hovd':         420,
    'Asia/Irkutsk':      480,
    'Asia/Jakarta':      420,
    'Asia/Jayapura':     540,
    'Asia/Jerusalem':    120,
    'Asia/Kabul':        270,
    'Asia/Kamchatka':    720,
    'Asia/Karachi':      300,
    'Asia/Kathmandu':    345,
    'Asia/Khandyga':     540,
    'Asia/Kolkata':      330,
    'Asia/Krasnoyarsk':  420,
    'Asia/Kuala_Lumpur': 480,
    'Asia/Kuching':      480,
    'Asia/Kuwait':       180,
    'Asia/Macau':        480,
    'Asia/Magadan':      660,
    'Asia/Makassar':     480,
    'Asia/Manila':       480,
    'Asia/Muscat':       240,
    'Asia/Nicosia':      120,
    'Asia/Novokuznetsk': 420,
    'Asia/Novosibirsk':  420,
    'Asia/Omsk':         360,
    'Asia/Oral':         300,
    'Asia/Phnom_Penh':   420,
    'Asia/Pontianak':    420,
    'Asia/Pyongyang':    540,
    'Asia/Qatar':        180,
    'Asia/Qyzylorda':    300,
    'Asia/Riyadh':       180,
    'Asia/Sakhalin':     660,
    'Asia/Samarkand':    300,
    'Asia/Seoul':        540,
    'Asia/Shanghai':     480,
    'Asia/Singapore':    480,
    'Asia/Srednekolymsk':660,
    'Asia/Taipei':       480,
    'Asia/Tashkent':     300,
    'Asia/Tbilisi':      240,
    'Asia/Tehran':       210,
    'Asia/Thimphu':      360,
    'Asia/Tokyo':        540,
    'Asia/Tomsk':        420,
    'Asia/Ulaanbaatar':  480,
    'Asia/Urumqi':       360,
    'Asia/Ust-Nera':     600,
    'Asia/Vientiane':    420,
    'Asia/Vladivostok':  600,
    'Asia/Yakutsk':      540,
    'Asia/Yangon':       390,
    'Asia/Yekaterinburg':300,
    'Asia/Yerevan':      240,
    // Atlantic
    'Atlantic/Azores':         -60,
    'Atlantic/Bermuda':       -240,
    'Atlantic/Canary':           0,
    'Atlantic/Cape_Verde':     -60,
    'Atlantic/Faroe':            0,
    'Atlantic/Madeira':          0,
    'Atlantic/Reykjavik':        0,
    'Atlantic/South_Georgia': -120,
    'Atlantic/St_Helena':        0,
    'Atlantic/Stanley':       -180,
    // Australia
    'Australia/Adelaide':    570,
    'Australia/Brisbane':    600,
    'Australia/Broken_Hill': 570,
    'Australia/Darwin':      570,
    'Australia/Eucla':       525,
    'Australia/Hobart':      600,
    'Australia/Lindeman':    600,
    'Australia/Lord_Howe':   630,
    'Australia/Melbourne':   600,
    'Australia/Perth':       480,
    'Australia/Sydney':      600,
    // Europe
    'Europe/Amsterdam':    60,
    'Europe/Andorra':      60,
    'Europe/Astrakhan':   240,
    'Europe/Athens':      120,
    'Europe/Belgrade':     60,
    'Europe/Berlin':       60,
    'Europe/Bratislava':   60,
    'Europe/Brussels':     60,
    'Europe/Bucharest':   120,
    'Europe/Budapest':     60,
    'Europe/Busingen':     60,
    'Europe/Chisinau':    120,
    'Europe/Copenhagen':   60,
    'Europe/Dublin':        0,
    'Europe/Gibraltar':    60,
    'Europe/Guernsey':      0,
    'Europe/Helsinki':    120,
    'Europe/Isle_of_Man':   0,
    'Europe/Istanbul':    180,
    'Europe/Jersey':        0,
    'Europe/Kaliningrad': 120,
    'Europe/Kiev':        120,
    'Europe/Kirov':       180,
    'Europe/Lisbon':        0,
    'Europe/Ljubljana':    60,
    'Europe/London':        0,
    'Europe/Luxembourg':   60,
    'Europe/Madrid':       60,
    'Europe/Malta':        60,
    'Europe/Mariehamn':   120,
    'Europe/Minsk':       180,
    'Europe/Monaco':       60,
    'Europe/Moscow':      180,
    'Europe/Oslo':         60,
    'Europe/Paris':        60,
    'Europe/Podgorica':    60,
    'Europe/Prague':       60,
    'Europe/Riga':        120,
    'Europe/Rome':         60,
    'Europe/Samara':      240,
    'Europe/San_Marino':   60,
    'Europe/Sarajevo':     60,
    'Europe/Saratov':     240,
    'Europe/Simferopol':  180,
    'Europe/Skopje':       60,
    'Europe/Sofia':       120,
    'Europe/Stockholm':    60,
    'Europe/Tallinn':     120,
    'Europe/Tirane':       60,
    'Europe/Ulyanovsk':   240,
    'Europe/Uzhgorod':    120,
    'Europe/Vaduz':        60,
    'Europe/Vatican':      60,
    'Europe/Vienna':       60,
    'Europe/Vilnius':     120,
    'Europe/Volgograd':   180,
    'Europe/Warsaw':       60,
    'Europe/Zagreb':       60,
    'Europe/Zaporozhye':  120,
    'Europe/Zurich':       60,
    // Indian Ocean
    'Indian/Antananarivo': 180,
    'Indian/Chagos':       360,
    'Indian/Christmas':    420,
    'Indian/Cocos':        390,
    'Indian/Comoro':       180,
    'Indian/Kerguelen':    300,
    'Indian/Mahe':         240,
    'Indian/Maldives':     300,
    'Indian/Mauritius':    240,
    'Indian/Mayotte':      180,
    'Indian/Reunion':      240,
    // Pacific
    'Pacific/Apia':                780,
    'Pacific/Auckland':            720,
    'Pacific/Bougainville':        660,
    'Pacific/Chatham':            765,
    'Pacific/Chuuk':              600,
    'Pacific/Easter':            -360,
    'Pacific/Efate':              660,
    'Pacific/Enderbury':          780,
    'Pacific/Fakaofo':            780,
    'Pacific/Fiji':               720,
    'Pacific/Funafuti':           720,
    'Pacific/Galapagos':         -360,
    'Pacific/Gambier':           -540,
    'Pacific/Guadalcanal':        660,
    'Pacific/Guam':               600,
    'Pacific/Honolulu':          -600,
    'Pacific/Kiritimati':         840,
    'Pacific/Kosrae':             660,
    'Pacific/Kwajalein':          720,
    'Pacific/Majuro':             720,
    'Pacific/Marquesas':         -570,
    'Pacific/Midway':            -660,
    'Pacific/Nauru':              720,
    'Pacific/Niue':              -660,
    'Pacific/Norfolk':            660,
    'Pacific/Noumea':             660,
    'Pacific/Pago_Pago':         -660,
    'Pacific/Palau':              540,
    'Pacific/Pitcairn':          -480,
    'Pacific/Pohnpei':            660,
    'Pacific/Port_Moresby':       600,
    'Pacific/Rarotonga':         -600,
    'Pacific/Saipan':             600,
    'Pacific/Tahiti':            -600,
    'Pacific/Tarawa':             720,
    'Pacific/Tongatapu':          780,
    'Pacific/Wake':               720,
    'Pacific/Wallis':             720,
    // Plain UTC
    'UTC':                         0,
    'Etc/UTC':                     0,
    'Etc/GMT':                     0,
    // Legacy / aliased zones that appear in the vendored dataset.
    // Each redirects to its canonical successor's standard offset.
    'America/Montreal':         -300, // == America/Toronto
    'America/Coral_Harbour':    -300, // == America/Atikokan
    'America/Fort_Nelson':      -420, // == America/Vancouver mountain
    'Asia/Chongqing':            480, // == Asia/Shanghai
    'Asia/Harbin':               480, // == Asia/Shanghai
    'Asia/Kashgar':              480, // == Asia/Urumqi family in dataset
    'Asia/Rangoon':              390, // == Asia/Yangon
    'Europe/Kyiv':               120  // == Europe/Kiev
  };

  // Emergency inline subset — used while the full dataset is loading
  // in the browser (or if loading fails). Tiny on purpose; the full
  // ~7,300-city dataset is in data/places/city_timezones.json.
  var EMERGENCY_INLINE = [
    { city: 'Sudbury',     country: 'Canada', iso2: 'CA', province: 'Ontario',         lat: 46.4917,  lng: -80.9930, timezone: 'America/Toronto' },
    { city: 'Toronto',     country: 'Canada', iso2: 'CA', province: 'Ontario',         lat: 43.6532,  lng: -79.3832, timezone: 'America/Toronto' },
    { city: 'Montreal',    country: 'Canada', iso2: 'CA', province: 'Quebec',          lat: 45.5019,  lng: -73.5674, timezone: 'America/Toronto' },
    { city: 'Vancouver',   country: 'Canada', iso2: 'CA', province: 'British Columbia',lat: 49.2827,  lng: -123.1207,timezone: 'America/Vancouver' },
    { city: 'New York',    country: 'United States of America', iso2: 'US', province: 'New York',   lat: 40.7128,  lng: -74.0060, timezone: 'America/New_York' },
    { city: 'Los Angeles', country: 'United States of America', iso2: 'US', province: 'California', lat: 34.0522,  lng: -118.2437,timezone: 'America/Los_Angeles' },
    { city: 'London',      country: 'United Kingdom', iso2: 'GB', province: 'England', lat: 51.5074,  lng: -0.1278,  timezone: 'Europe/London' },
    { city: 'Berlin',      country: 'Germany',  iso2: 'DE',                            lat: 52.5200,  lng: 13.4050,  timezone: 'Europe/Berlin' },
    { city: 'Paris',       country: 'France',   iso2: 'FR',                            lat: 48.8566,  lng:  2.3522,  timezone: 'Europe/Paris' },
    { city: 'Helsinki',    country: 'Finland',  iso2: 'FI',                            lat: 60.1699,  lng: 24.9384,  timezone: 'Europe/Helsinki' },
    { city: 'Stockholm',   country: 'Sweden',   iso2: 'SE',                            lat: 59.3293,  lng: 18.0686,  timezone: 'Europe/Stockholm' },
    { city: 'Mumbai',      country: 'India',    iso2: 'IN',                            lat: 19.0760,  lng: 72.8777,  timezone: 'Asia/Kolkata' },
    { city: 'Denpasar',    country: 'Indonesia',iso2: 'ID',                            lat: -8.6500,  lng: 115.2167, timezone: 'Asia/Makassar' }
  ];

  // The loaded full dataset. Starts as the emergency subset; replaced
  // by the full dataset when `_setCities` is called.
  var _CITIES = EMERGENCY_INLINE.slice();

  // Slug: NFD-fold, lowercase, drop non-alphanumeric runs to spaces.
  function slug(s) {
    if (!s) return '';
    return String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Build / rebuild the alias index.
  var ALIAS_INDEX = {};

  function strSafe(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' && isFinite(v) && v > 0) return String(v);
    return '';
  }

  function indexRow(row) {
    if (!row || typeof row !== 'object') return;
    var citySlug = slug(strSafe(row.city_ascii) || strSafe(row.city));
    if (!citySlug) return;
    function push(key) {
      if (!key) return;
      if (!ALIAS_INDEX[key]) ALIAS_INDEX[key] = [];
      ALIAS_INDEX[key].push(row);
    }
    var province = slug(strSafe(row.province));
    var country  = slug(strSafe(row.country));
    var iso2     = strSafe(row.iso2).toLowerCase();
    var stateAnsi = strSafe(row.state_ansi).toLowerCase();
    push(citySlug);
    if (province) push(citySlug + ' ' + province);
    if (country)  push(citySlug + ' ' + country);
    if (province && country) push(citySlug + ' ' + province + ' ' + country);
    if (iso2)     push(citySlug + ' ' + iso2);
    // US: tolerate state ANSI (CA, NY etc.).
    if (stateAnsi) push(citySlug + ' ' + stateAnsi);
  }

  function rebuildIndex() {
    ALIAS_INDEX = {};
    for (var i = 0; i < _CITIES.length; i++) {
      try { indexRow(_CITIES[i]); } catch (_) { /* skip malformed row */ }
    }
  }
  rebuildIndex();

  function _setCities(rows) {
    if (!Array.isArray(rows) || !rows.length) return false;
    _CITIES = rows;
    rebuildIndex();
    return true;
  }

  // Eager Node load — try the vendored JSON from disk synchronously.
  // Browser require() throws; we catch and rely on preload().
  (function tryNodeLoad() {
    if (typeof require !== 'function') return;
    try {
      var fs   = require('fs');
      var path = require('path');
      var p    = path.resolve(__dirname, '..', 'data', 'places', 'city_timezones.json');
      var raw  = fs.readFileSync(p, 'utf8');
      var arr  = JSON.parse(raw);
      _setCities(arr);
    } catch (_) { /* browser path or file missing — fall back to emergency subset */ }
  })();

  // Browser preload — call once at boot.
  function preload(url) {
    if (typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('preload status ' + r.status);
        return r.json();
      })
      .then(function (arr) { return _setCities(arr); })
      .catch(function () { return false; });
  }

  // Score a candidate row against query tokens; higher = better.
  function scoreRow(row, queryTokens) {
    var s = 0;
    // Exact province / iso2 / country token in query is a strong signal.
    if (row.province && queryTokens.indexOf(slug(row.province)) >= 0) s += 100;
    if (row.iso2     && queryTokens.indexOf(row.iso2.toLowerCase()) >= 0) s += 80;
    if (row.country  && queryTokens.indexOf(slug(row.country))  >= 0) s += 60;
    // Population as a tiebreaker.
    s += Math.log10(Math.max(1, Number(row.pop) || 1));
    return s;
  }

  // Resolve a place string. Returns
  //   { latitude, longitude, tzOffsetMinutes, iana, city, province,
  //     country, iso2, source }
  // or null if no row matches.
  function resolve(input) {
    if (input == null) return null;
    var raw = '';
    if (typeof input === 'object') {
      raw = [input.city, input.province || input.state, input.country]
              .filter(Boolean).join(' ');
      if (!raw && input.city) raw = input.city;
    } else {
      raw = String(input);
    }
    var s = slug(raw);
    if (!s) return null;
    var queryTokens = s.split(' ');

    function tryKey(k) {
      var rows = ALIAS_INDEX[k];
      if (!rows || !rows.length) return null;
      if (rows.length === 1) return rows[0];
      // Rank.
      var best = null, bestScore = -Infinity;
      for (var i = 0; i < rows.length; i++) {
        var sc = scoreRow(rows[i], queryTokens);
        if (sc > bestScore) { bestScore = sc; best = rows[i]; }
      }
      return best;
    }

    // 1. Try the full slug.
    var row = tryKey(s);
    // 2. Drop trailing tokens.
    if (!row) {
      var toks = queryTokens.slice();
      while (!row && toks.length > 1) {
        toks.pop();
        row = tryKey(toks.join(' '));
      }
    }
    // 3. Drop leading tokens.
    if (!row) {
      var toks2 = queryTokens.slice();
      while (!row && toks2.length > 1) {
        toks2.shift();
        row = tryKey(toks2.join(' '));
      }
    }
    if (!row) return null;

    var iana = row.timezone || row.iana || '';
    var tzOff = IANA_STANDARD_OFFSETS[iana];
    if (typeof tzOff !== 'number') tzOff = 0;

    return {
      latitude:        Number(row.lat),
      longitude:       Number(row.lng),
      tzOffsetMinutes: tzOff,
      iana:            iana,
      city:            row.city || row.city_ascii || '',
      province:        row.province || '',
      country:         row.country  || '',
      iso2:            row.iso2     || '',
      source:          (_CITIES.length > EMERGENCY_INLINE.length)
                          ? 'city-timezones · vendored'
                          : 'emergency-inline'
    };
  }

  return {
    slug:                  slug,
    resolve:               resolve,
    preload:               preload,
    _setCities:            _setCities,
    EMERGENCY_INLINE:      EMERGENCY_INLINE,
    IANA_STANDARD_OFFSETS: IANA_STANDARD_OFFSETS,
    get CITY_COUNT() { return _CITIES.length; }
  };
}));
