/* CommonUnity astronomy helpers — deterministic, local, no network.
 *
 * What we compute:
 *   - solarLongitude(jd)      ecliptic longitude of the Sun (Meeus low-precision)
 *   - lunarLongitude(jd)      ecliptic longitude of the Moon (Meeus chapter 47, abridged)
 *   - greenwichSiderealTime   GMST in degrees (Meeus 12.4)
 *   - ascendantLongitude(jd, lat, lng)  tropical Rising / Ascendant (Meeus 13.4 inverse)
 *   - lahiriAyanamsha(jd)     Lahiri ayanamsha — approximate linear model anchored on
 *                             the conventional value 23.85° on J2000 + 50.29″/yr
 *                             precession (within ~0.05° of Swiss Ephemeris Lahiri
 *                             over 20th–21st centuries; labelled approximate).
 *   - tropicalSignFromLon(lon)   1 of 12 tropical signs
 *
 * Inputs are UTC. The browser side is responsible for converting
 * local birth time + a timezone offset to UTC and passing into here.
 *
 * Exposes both CommonJS (module.exports) and a global
 * `CommonUnityAstro` for browser <script src=…> usage, mirroring
 * sdk/genekeys.js.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CommonUnityAstro = api;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEG = Math.PI / 180;

  function norm360(x) { return ((x % 360) + 360) % 360; }

  // Convert a Date (UTC-based) to Julian Day.
  function dateToJD(date) {
    var year  = date.getUTCFullYear();
    var month = date.getUTCMonth() + 1;
    var day   = date.getUTCDate();
    var hourFrac = (date.getUTCHours()
                  + date.getUTCMinutes() / 60
                  + date.getUTCSeconds() / 3600) / 24;
    if (month <= 2) { year -= 1; month += 12; }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716))
         + Math.floor(30.6001 * (month + 1))
         + day + hourFrac + B - 1524.5;
  }

  // Sun longitude — Meeus chapter 25 low-precision formula.
  function solarLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    L0 = norm360(L0);
    var M  = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var Mr = norm360(M) * DEG;
    var C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
           + 0.000289 * Math.sin(3 * Mr);
    var trueLon = L0 + C;
    var omega = norm360(125.04452 - 1934.136261 * T);
    var apparent = trueLon - 0.00569 - 0.00478 * Math.sin(omega * DEG);
    return norm360(apparent);
  }

  // Moon longitude — abridged Meeus chapter 47.
  // We use the dominant periodic terms (>~ 0.1° amplitude) which gives
  // accuracy of roughly ±0.3° — more than sufficient for sign / nakshatra
  // assignment used by the OM Cipher identity panel.
  function lunarLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var Lp = 218.3164477 + 481267.88123421 * T
           - 0.0015786 * T * T + (T * T * T) / 538841
           - (T * T * T * T) / 65194000;
    var D  = 297.8501921 + 445267.1114034 * T
           - 0.0018819 * T * T + (T * T * T) / 545868
           - (T * T * T * T) / 113065000;
    var M  = 357.5291092 + 35999.0502909 * T
           - 0.0001536 * T * T + (T * T * T) / 24490000;
    var Mp = 134.9633964 + 477198.8675055 * T
           + 0.0087414 * T * T + (T * T * T) / 69699
           - (T * T * T * T) / 14712000;
    var F  = 93.2720950  + 483202.0175233 * T
           - 0.0036539 * T * T - (T * T * T) / 3526000
           + (T * T * T * T) / 863310000;

    var E = 1 - 0.002516 * T - 0.0000074 * T * T;
    var E2 = E * E;

    Lp = norm360(Lp);
    var Dr  = norm360(D)  * DEG;
    var Mr  = norm360(M)  * DEG;
    var Mpr = norm360(Mp) * DEG;
    var Fr  = norm360(F)  * DEG;

    // Periodic terms (subset of Meeus Table 47.A — amplitude in millionths of a degree)
    // Each row: [D, M, Mp, F, amplitude]
    var terms = [
      [0, 0, 1, 0,  6288774],
      [2, 0,-1, 0,  1274027],
      [2, 0, 0, 0,   658314],
      [0, 0, 2, 0,   213618],
      [0, 1, 0, 0,  -185116],
      [0, 0, 0, 2,  -114332],
      [2, 0,-2, 0,    58793],
      [2,-1,-1, 0,    57066],
      [2, 0, 1, 0,    53322],
      [2,-1, 0, 0,    45758],
      [0, 1,-1, 0,   -40923],
      [1, 0, 0, 0,   -34720],
      [0, 1, 1, 0,   -30383],
      [2, 0, 0,-2,    15327],
      [0, 0, 1, 2,   -12528],
      [0, 0, 1,-2,    10980],
      [4, 0,-1, 0,    10675],
      [0, 0, 3, 0,    10034],
      [4, 0,-2, 0,     8548],
      [2, 1,-1, 0,    -7888],
      [2, 1, 0, 0,    -6766],
      [1, 0,-1, 0,    -5163],
      [1, 1, 0, 0,     4987],
      [2,-1, 1, 0,     4036],
      [2, 0, 2, 0,     3994],
      [4, 0, 0, 0,     3861],
      [2, 0,-3, 0,     3665]
    ];

    var sum = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var arg = t[0] * Dr + t[1] * Mr + t[2] * Mpr + t[3] * Fr;
      var eFactor = 1;
      if (t[1] === 1 || t[1] === -1) eFactor = E;
      else if (t[1] === 2 || t[1] === -2) eFactor = E2;
      sum += eFactor * t[4] * Math.sin(arg);
    }

    var lon = Lp + sum / 1e6;
    return norm360(lon);
  }

  // Obliquity of the ecliptic (degrees) — Meeus 22.2.
  function obliquity(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var seconds = 21.448 - 46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T;
    return 23 + (26 + seconds / 60) / 60;
  }

  // Greenwich Mean Sidereal Time in degrees (Meeus 12.4).
  function greenwichSiderealTime(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var gmst = 280.46061837
             + 360.98564736629 * (jd - 2451545.0)
             + 0.000387933 * T * T
             - (T * T * T) / 38710000;
    return norm360(gmst);
  }

  // Tropical Ascendant (Rising) longitude — Meeus 13.4 / standard inverse.
  //
  //   tan(λ) = -cos(LST) /  ( sin(ε)*tan(φ) + cos(ε)*sin(LST) )
  //
  // Returns degrees [0,360). Resolves quadrant and asserts that λ is on
  // the eastern half of the ecliptic relative to MC (the rising sign is
  // always 0–180° ahead of the MC).
  function ascendantLongitude(jd, latDeg, lngDeg) {
    var gmst = greenwichSiderealTime(jd);
    var lst  = norm360(gmst + lngDeg);     // local sidereal time, degrees
    var eps  = obliquity(jd) * DEG;
    var phi  = latDeg * DEG;
    var lstR = lst * DEG;

    var y = -Math.cos(lstR);
    var x = Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(lstR);
    var asc = Math.atan2(y, x) / DEG;
    asc = norm360(asc);

    // Quadrant fix — ascendant must lie within 180° east of the MC.
    // MC longitude (RA-based):
    var mc = Math.atan2(Math.sin(lstR), Math.cos(lstR) * Math.cos(eps)) / DEG;
    mc = norm360(mc);
    var delta = norm360(asc - mc);
    if (delta < 1 || delta > 359) {
      // degenerate — push by 180°
      asc = norm360(asc + 180);
    } else if (delta > 180) {
      asc = norm360(asc + 180);
    }
    return asc;
  }

  var SIGNS = [
    'Aries','Taurus','Gemini','Cancer',
    'Leo','Virgo','Libra','Scorpio',
    'Sagittarius','Capricorn','Aquarius','Pisces'
  ];
  function tropicalSignFromLon(lon) {
    var n = norm360(lon);
    return SIGNS[Math.floor(n / 30) % 12];
  }

  // Lahiri ayanamsha — linear approximation pinned to the canonical
  // value 23°51′ at J2000.0 with 50.2902″/yr precession. Within ~0.05°
  // of full Swiss-Ephemeris Lahiri across the 20th and 21st centuries.
  // Documented as approximate; UI labels the Vedic outputs accordingly.
  function lahiriAyanamsha(jd) {
    var yearsFromJ2000 = (jd - 2451545.0) / 365.25;
    var degPerYear = 50.2902 / 3600;
    return 23.85 + yearsFromJ2000 * degPerYear;
  }

  var NAKSHATRAS = [
    'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
    'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
    'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
    'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha',
    'Purva Bhadrapada','Uttara Bhadrapada','Revati'
  ];
  var NAK_SIZE = 360 / 27; // 13°20′

  function nakshatra(siderealLon) {
    var n = norm360(siderealLon);
    var idx = Math.floor(n / NAK_SIZE);
    var pos = n - idx * NAK_SIZE;
    var pada = Math.min(Math.floor(pos / (NAK_SIZE / 4)) + 1, 4);
    return { name: NAKSHATRAS[idx], pada: pada };
  }

  // Compute the full identity-engine astronomy bundle from birth inputs.
  // birth: { year, month, day, hour, minute, tzOffsetMinutes, lat, lng }
  //   tzOffsetMinutes: minutes east of UTC (e.g. New York EST = -300, IST = +330)
  //   lat/lng/tz: optional; absence cleanly degrades — sun is always derivable.
  function computeIdentityChart(birth) {
    var out = {
      ok: true,
      tropical: { sun: '', moon: '', rising: '' },
      vedic:    { sun: '', moon: '', ascendant: '', nakshatra: '' },
      longitudes: {},
      precision: {
        sun:   'derived',
        moon:  'requires-time',
        rising:'requires-time-and-coords',
        sidereal_ayanamsha: 'lahiri-approx'
      }
    };
    if (!birth || !birth.year || !birth.month || !birth.day) {
      out.ok = false;
      return out;
    }
    var hr = (typeof birth.hour === 'number')   ? birth.hour   : 12;
    var mn = (typeof birth.minute === 'number') ? birth.minute : 0;
    var tz = (typeof birth.tzOffsetMinutes === 'number') ? birth.tzOffsetMinutes : 0;

    // Convert local wall clock to UTC by subtracting tz offset.
    var utc = new Date(Date.UTC(birth.year, birth.month - 1, birth.day, hr, mn, 0));
    utc = new Date(utc.getTime() - tz * 60 * 1000);
    var jd = dateToJD(utc);

    var sunLon  = solarLongitude(jd);
    var moonLon = lunarLongitude(jd);
    out.longitudes.sun  = sunLon;
    out.longitudes.moon = moonLon;
    out.tropical.sun  = tropicalSignFromLon(sunLon);

    var hasTime = (typeof birth.hour === 'number');
    if (hasTime) {
      out.tropical.moon = tropicalSignFromLon(moonLon);
      out.precision.moon = 'derived';
    }

    var hasCoords = (typeof birth.lat === 'number'
                  && typeof birth.lng === 'number'
                  && isFinite(birth.lat)
                  && isFinite(birth.lng));
    if (hasTime && hasCoords) {
      var ascLon = ascendantLongitude(jd, birth.lat, birth.lng);
      out.longitudes.ascendant = ascLon;
      out.tropical.rising = tropicalSignFromLon(ascLon);
      out.precision.rising = 'derived';
    }

    var aya = lahiriAyanamsha(jd);
    out.longitudes.ayanamsha = aya;
    var sidSun  = norm360(sunLon  - aya);
    var sidMoon = norm360(moonLon - aya);
    out.vedic.sun = tropicalSignFromLon(sidSun);
    out.longitudes.sidereal_sun  = sidSun;
    out.longitudes.sidereal_moon = sidMoon;
    if (hasTime) {
      var moonNak = nakshatra(sidMoon);
      out.vedic.moon = tropicalSignFromLon(sidMoon)
                     + ' · ' + moonNak.name
                     + ' pada ' + moonNak.pada;
      out.vedic.nakshatra = moonNak.name;
    }
    if (hasTime && hasCoords) {
      var sidAsc = norm360(out.longitudes.ascendant - aya);
      out.longitudes.sidereal_ascendant = sidAsc;
      var ascNak = nakshatra(sidAsc);
      out.vedic.ascendant = tropicalSignFromLon(sidAsc)
                          + ' · ' + ascNak.name
                          + ' pada ' + ascNak.pada;
    }

    return out;
  }

  return {
    dateToJD:              dateToJD,
    solarLongitude:        solarLongitude,
    lunarLongitude:        lunarLongitude,
    obliquity:             obliquity,
    greenwichSiderealTime: greenwichSiderealTime,
    ascendantLongitude:    ascendantLongitude,
    lahiriAyanamsha:       lahiriAyanamsha,
    tropicalSignFromLon:   tropicalSignFromLon,
    nakshatra:             nakshatra,
    computeIdentityChart:  computeIdentityChart,
    SIGNS:                 SIGNS,
    NAKSHATRAS:            NAKSHATRAS
  };
}));
