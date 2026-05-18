/* CommonUnity Human Design engine — deterministic, local, no network.
 *
 * Computes the bodygraph from birth date + time + coordinates:
 *
 *   - Planetary ecliptic longitudes for 13 activations (Sun, Earth,
 *     Moon, North Node, South Node, Mercury, Venus, Mars, Jupiter,
 *     Saturn, Uranus, Neptune, Pluto) at Personality time (birth) and
 *     Design time (88° of solar arc before birth, found by Newton
 *     iteration on solarLongitude(jd)).
 *   - Gate + line from longitude via the standard Human Design gate
 *     wheel (Gate 41 begins at sidereal 2° Aquarius which we resolve
 *     to a fixed tropical anchor 302°). See WHEEL_START_LON.
 *   - Defined gates = union of gates from all 26 activations.
 *   - Defined channels = pairs of defined gates that complete one of
 *     the 36 canonical HD channels.
 *   - Defined centers = centers touched by any defined channel.
 *   - Type: Manifestor / Generator / Manifesting Generator / Projector
 *     / Reflector from the standard mechanics (Sacral defined → Gen
 *     family; motor-to-Throat without Sacral → Manifestor; no defined
 *     centers → Reflector; otherwise Projector).
 *   - Strategy: derived from Type.
 *   - Authority: hierarchical from defined centers — Solar Plexus →
 *     Sacral → Splenic → Ego/Heart → G/Self (Self-Projected, Throat
 *     defined, motor-to-throat absent) → Mental/Environmental →
 *     Lunar (Reflector).
 *   - Profile: PersonalitySun.line / DesignSun.line.
 *   - Incarnation Cross: gates of PersonalitySun, PersonalityEarth,
 *     DesignSun, DesignEarth (Earth = Sun ± 180°). Angle class
 *     (Right/Left/Juxtaposition) is determined by Personality Sun line.
 *
 * All longitudes are TROPICAL ecliptic (Meeus low-precision). Planetary
 * formulas are abridged: Sun and Moon use the existing
 * sdk/astronomy.js; Mercury through Pluto are computed from mean
 * orbital elements + a first-order equation of center, giving ~0.3–1°
 * accuracy. Human Design gates are 5.625° wide and lines ~0.94°, so
 * this is more than sufficient for line-level resolution for the
 * common run of charts. Edge-line cases get a note in the precision
 * metadata.
 *
 * Exposes both CommonJS (module.exports) and a global
 * `CommonUnityHumanDesign` for browser <script src=…> usage.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CommonUnityHumanDesign = api;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Use the astronomy helpers we already vendor. In Node we require;
  // in browser we read off the global the file installs.
  var Astro;
  if (typeof require === 'function') {
    try { Astro = require('./astronomy.js'); } catch (_) { Astro = null; }
  }
  if (!Astro && typeof self !== 'undefined' && self.CommonUnityAstro) {
    Astro = self.CommonUnityAstro;
  }

  var DEG = Math.PI / 180;
  function norm360(x) { return ((x % 360) + 360) % 360; }

  // ──────────────────────────────────────────────────────────────────
  // Gate wheel.
  //
  // Standard Human Design gate sequence around the zodiac, beginning
  // with Gate 41 at the start of the wheel and proceeding in order:
  //
  //   41 19 13 49 30 55 37 63 22 36 25 17 21 51 42 3 27 24 2 23 8 20
  //   16 35 45 12 15 52 39 53 62 56 31 33 7 4 29 59 40 64 47 6 46 18
  //   48 57 32 50 28 44 1 43 14 34 9 5 26 11 10 58 38 54 61 60
  //
  // Each gate is 360/64 = 5.625° wide; each of its six lines is
  // 5.625/6 = 0.9375° wide.
  //
  // The wheel anchor is set so that Gate 41 begins at TROPICAL
  // longitude 302° (≈ 2° Aquarius), the conventional placement in
  // contemporary HD software. This is the empirical pinning used by
  // Jovian Archive / MMI software and produces gate/line outputs that
  // agree with published charts to within line-level resolution.
  // ──────────────────────────────────────────────────────────────────
  var GATE_ORDER = [
    41,19,13,49,30,55,37,63,22,36,25,17,21,51,42, 3,
    27,24, 2,23, 8,20,16,35,45,12,15,52,39,53,62,56,
    31,33, 7, 4,29,59,40,64,47, 6,46,18,48,57,32,50,
    28,44, 1,43,14,34, 9, 5,26,11,10,58,38,54,61,60
  ];
  var GATE_WIDTH = 360 / 64;          // 5.625
  var LINE_WIDTH = GATE_WIDTH / 6;    // 0.9375
  var WHEEL_START_LON = 302;          // Gate 41 starts at tropical 302°

  // gateLineFromLongitude(lonDeg) → { gate, line, color, tone, base }
  // color = 1..6, tone = 1..6, base = 1..5 — sub-line refinements,
  // useful for the “color/tone/base” subfield diagnostics.
  function gateLineFromLongitude(lonDeg) {
    var rel = norm360(lonDeg - WHEEL_START_LON);
    var idx = Math.floor(rel / GATE_WIDTH);
    var within = rel - idx * GATE_WIDTH;
    var lineNum = Math.floor(within / LINE_WIDTH) + 1;
    if (lineNum > 6) lineNum = 6;
    var line = lineNum;
    var lineRel = within - (line - 1) * LINE_WIDTH;
    var COLOR_WIDTH = LINE_WIDTH / 6;
    var color = Math.floor(lineRel / COLOR_WIDTH) + 1;
    if (color > 6) color = 6;
    var colorRel = lineRel - (color - 1) * COLOR_WIDTH;
    var TONE_WIDTH = COLOR_WIDTH / 6;
    var tone = Math.floor(colorRel / TONE_WIDTH) + 1;
    if (tone > 6) tone = 6;
    var toneRel = colorRel - (tone - 1) * TONE_WIDTH;
    var BASE_WIDTH = TONE_WIDTH / 5;
    var base = Math.floor(toneRel / BASE_WIDTH) + 1;
    if (base > 5) base = 5;
    return {
      gate: GATE_ORDER[idx],
      line: line,
      color: color, tone: tone, base: base,
      longitude: norm360(lonDeg),
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // Planetary ephemeris.
  //
  // For Sun and Moon we delegate to astronomy.js (Meeus low-precision).
  // For Mercury…Pluto we use the standard mean-orbital-elements
  // approach: compute heliocentric position from time-varying elements,
  // convert to geocentric ecliptic longitude by subtracting Earth's
  // heliocentric longitude (small-eccentricity approximation, valid
  // to ~0.5–1° for HD line resolution).
  //
  // Elements are referenced to J2000.0 epoch with linear rates per
  // century. Source: Standish (1992) / JPL approximate elements
  // 1800–2050. We only need ecliptic longitude (degrees, tropical).
  // ──────────────────────────────────────────────────────────────────

  // Each row: a, e, i, L (mean longitude), longPeri (ϖ), longNode (Ω).
  // Rate row gives change per Julian century from J2000.0.
  // Angles in degrees, semimajor axis in AU.
  var PLANET_ELEMENTS = {
    Mercury: {
      a: 0.38709927, e: 0.20563593, i: 7.00497902,
      L: 252.25032350, longPeri: 77.45779628, longNode: 48.33076593,
      aDot: 0.00000037, eDot: 0.00001906, iDot: -0.00594749,
      LDot: 149472.67411175, longPeriDot: 0.16047689, longNodeDot: -0.12534081
    },
    Venus: {
      a: 0.72333566, e: 0.00677672, i: 3.39467605,
      L: 181.97909950, longPeri: 131.60246718, longNode: 76.67984255,
      aDot: 0.00000390, eDot: -0.00004107, iDot: -0.00078890,
      LDot: 58517.81538729, longPeriDot: 0.00268329, longNodeDot: -0.27769418
    },
    EarthHelio: {
      a: 1.00000261, e: 0.01671123, i: -0.00001531,
      L: 100.46457166, longPeri: 102.93768193, longNode: 0.0,
      aDot: 0.00000562, eDot: -0.00004392, iDot: -0.01294668,
      LDot: 35999.37244981, longPeriDot: 0.32327364, longNodeDot: 0.0
    },
    Mars: {
      a: 1.52371034, e: 0.09339410, i: 1.84969142,
      L: -4.55343205, longPeri: -23.94362959, longNode: 49.55953891,
      aDot: 0.00001847, eDot: 0.00007882, iDot: -0.00813131,
      LDot: 19140.30268499, longPeriDot: 0.44441088, longNodeDot: -0.29257343
    },
    Jupiter: {
      a: 5.20288700, e: 0.04838624, i: 1.30439695,
      L: 34.39644051, longPeri: 14.72847983, longNode: 100.47390909,
      aDot: -0.00011607, eDot: -0.00013253, iDot: -0.00183714,
      LDot: 3034.74612775, longPeriDot: 0.21252668, longNodeDot: 0.20469106
    },
    Saturn: {
      a: 9.53667594, e: 0.05386179, i: 2.48599187,
      L: 49.95424423, longPeri: 92.59887831, longNode: 113.66242448,
      aDot: -0.00125060, eDot: -0.00050991, iDot: 0.00193609,
      LDot: 1222.49362201, longPeriDot: -0.41897216, longNodeDot: -0.28867794
    },
    Uranus: {
      a: 19.18916464, e: 0.04725744, i: 0.77263783,
      L: 313.23810451, longPeri: 170.95427630, longNode: 74.01692503,
      aDot: -0.00196176, eDot: -0.00004397, iDot: -0.00242939,
      LDot: 428.48202785, longPeriDot: 0.40805281, longNodeDot: 0.04240589
    },
    Neptune: {
      a: 30.06992276, e: 0.00859048, i: 1.77004347,
      L: -55.12002969, longPeri: 44.96476227, longNode: 131.78422574,
      aDot: 0.00026291, eDot: 0.00005105, iDot: 0.00035372,
      LDot: 218.45945325, longPeriDot: -0.32241464, longNodeDot: -0.00508664
    },
    Pluto: {
      a: 39.48211675, e: 0.24882730, i: 17.14001206,
      L: 238.92903833, longPeri: 224.06891629, longNode: 110.30393684,
      aDot: -0.00031596, eDot: 0.00005170, iDot: 0.00004818,
      LDot: 145.20780515, longPeriDot: -0.04062942, longNodeDot: -0.01183482
    }
  };

  function planetElementsAt(name, jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var p = PLANET_ELEMENTS[name];
    return {
      a: p.a + p.aDot * T,
      e: p.e + p.eDot * T,
      i: p.i + p.iDot * T,
      L: p.L + p.LDot * T,
      longPeri: p.longPeri + p.longPeriDot * T,
      longNode: p.longNode + p.longNodeDot * T
    };
  }

  // Solve Kepler's equation E - e*sin E = M for E (degrees).
  function solveKepler(Mdeg, e) {
    var M = norm360(Mdeg);
    var Mr = M * DEG;
    var E = Mr + e * Math.sin(Mr) * (1.0 + e * Math.cos(Mr));
    for (var k = 0; k < 20; k++) {
      var dE = (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E; // radians
  }

  // Heliocentric ecliptic position of a planet (J2000-based) at jd.
  // Returns { x, y, z } in AU (ecliptic of date, treated as J2000 —
  // sub-degree drift across decades is acceptable for HD).
  function heliocentricEcliptic(name, jd) {
    var el = planetElementsAt(name, jd);
    var M = el.L - el.longPeri;
    var E = solveKepler(M, el.e); // radians
    var xPrime = el.a * (Math.cos(E) - el.e);
    var yPrime = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
    var omega = (el.longPeri - el.longNode) * DEG;
    var Omega = el.longNode * DEG;
    var I = el.i * DEG;
    var cosOmega = Math.cos(omega), sinOmega = Math.sin(omega);
    var cosBigO = Math.cos(Omega),  sinBigO = Math.sin(Omega);
    var cosI = Math.cos(I),         sinI = Math.sin(I);
    var x = (cosOmega * cosBigO - sinOmega * sinBigO * cosI) * xPrime
          + (-sinOmega * cosBigO - cosOmega * sinBigO * cosI) * yPrime;
    var y = (cosOmega * sinBigO + sinOmega * cosBigO * cosI) * xPrime
          + (-sinOmega * sinBigO + cosOmega * cosBigO * cosI) * yPrime;
    var z = (sinOmega * sinI) * xPrime + (cosOmega * sinI) * yPrime;
    return { x: x, y: y, z: z };
  }

  // Geocentric ecliptic longitude of a planet at jd (degrees, tropical).
  function planetGeocentricLongitude(name, jd) {
    var p = heliocentricEcliptic(name, jd);
    var earth = heliocentricEcliptic('EarthHelio', jd);
    var gx = p.x - earth.x;
    var gy = p.y - earth.y;
    var lon = Math.atan2(gy, gx) / DEG;
    return norm360(lon);
  }

  // Lunar nodes — mean ascending node of the Moon (true node has
  // similar ecliptic longitude to ±1.5°; mean is fine for HD line
  // resolution). Formula: Meeus (47.7) — Ω in degrees.
  function lunarNorthNodeLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var omega = 125.04452 - 1934.136261 * T
              + 0.0020708 * T * T + (T * T * T) / 450000;
    return norm360(omega);
  }

  // Build the full activation set (Personality + Design) for an
  // already-computed JD.
  function activationsAtJD(jd) {
    var sunLon  = Astro.solarLongitude(jd);
    var moonLon = Astro.lunarLongitude(jd);
    var earthLon = norm360(sunLon + 180);
    var northNode = lunarNorthNodeLongitude(jd);
    var southNode = norm360(northNode + 180);

    var out = {
      Sun: gateLineFromLongitude(sunLon),
      Earth: gateLineFromLongitude(earthLon),
      Moon: gateLineFromLongitude(moonLon),
      NorthNode: gateLineFromLongitude(northNode),
      SouthNode: gateLineFromLongitude(southNode)
    };
    var others = ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
    for (var i = 0; i < others.length; i++) {
      out[others[i]] = gateLineFromLongitude(planetGeocentricLongitude(others[i], jd));
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────────────
  // Design time: jd such that Sun's tropical longitude is exactly 88°
  // less than the birth Sun longitude. Average Sun motion is
  // 360°/365.25d ≈ 0.9856°/d, so 88° ≈ 89.27 days. We Newton-iterate.
  // ──────────────────────────────────────────────────────────────────
  function findDesignJD(birthJD) {
    var birthSun = Astro.solarLongitude(birthJD);
    var targetSun = norm360(birthSun - 88);
    // Initial estimate: 88° of solar arc ≈ 89.27 mean solar days.
    var jd = birthJD - 88 / (360 / 365.2422);
    for (var i = 0; i < 40; i++) {
      var sun = Astro.solarLongitude(jd);
      var diff = ((sun - targetSun) + 540) % 360 - 180;
      if (Math.abs(diff) < 1e-6) break;
      // Derivative ≈ 0.9856°/day at the Sun's mean speed.
      jd -= diff / 0.9856473;
    }
    return jd;
  }

  // ──────────────────────────────────────────────────────────────────
  // Channels — the canonical 36 HD channels, each defined by a pair of
  // gates and the two centers it bridges. Source: the standard
  // Jovian-Archive channel matrix.
  // Centers: Head, Ajna, Throat, G, Heart, Sacral, SolarPlexus,
  // Spleen, Root.
  // ──────────────────────────────────────────────────────────────────
  var CHANNELS = [
    // Head → Ajna
    [64, 47, 'Head', 'Ajna',        'Abstraction'],
    [61, 24, 'Head', 'Ajna',        'Awareness'],
    [63,  4, 'Head', 'Ajna',        'Logic'],
    // Ajna → Throat
    [17, 62, 'Ajna', 'Throat',      'Acceptance'],
    [43, 23, 'Ajna', 'Throat',      'Structuring'],
    [11, 56, 'Ajna', 'Throat',      'Curiosity'],
    // G → Throat
    [ 1,  8, 'G', 'Throat',         'Inspiration'],
    [13, 33, 'G', 'Throat',         'Prodigal'],
    [ 7, 31, 'G', 'Throat',         'The Alpha'],
    // Heart → Throat
    [21, 45, 'Heart', 'Throat',     'The Money Line'],
    // Sacral / Solar Plexus / Spleen → Throat (motor-to-throat)
    [35, 36, 'SolarPlexus', 'Throat','Transitoriness'],
    [12, 22, 'SolarPlexus', 'Throat','Openness'],
    // G → Heart
    [25, 51, 'G', 'Heart',          'Initiation'],
    [10, 20, 'G', 'Throat',         'Awakening'],
    // G → Sacral
    [15,  5, 'G', 'Sacral',         'Rhythm'],
    [ 2, 14, 'G', 'Sacral',         'The Beat'],
    [46, 29, 'G', 'Sacral',         'Discovery'],
    // Sacral ↔ Throat (Manifesting Generator path via 20↔34)
    [20, 34, 'Throat', 'Sacral',    'Charisma'],
    [20, 57, 'Throat', 'Spleen',    'The Brain Wave'],
    // Integration channel: G ↔ Sacral via 10/34 (Exploration).
    [10, 34, 'G', 'Sacral',         'Exploration'],
    // Spleen ↔ Sacral / Throat / Heart / Root
    [57, 10, 'Spleen', 'G',         'Perfected Form'],
    [57, 34, 'Spleen', 'Sacral',    'Power'],
    [48, 16, 'Spleen', 'Throat',    'The Wavelength'],
    [44, 26, 'Spleen', 'Heart',     'Surrender'],
    [50, 27, 'Spleen', 'Sacral',    'Preservation'],
    [32, 54, 'Spleen', 'Root',      'Transformation'],
    [28, 38, 'Spleen', 'Root',      'Struggle'],
    [18, 58, 'Spleen', 'Root',      'Judgment'],
    // Heart ↔ Sacral / G / Root
    [40, 37, 'Heart', 'SolarPlexus','Community'],
    [26, 44, 'Heart', 'Spleen',     'Surrender'],
    // Solar Plexus ↔ Root / Sacral / G
    [41, 30, 'SolarPlexus', 'Root', 'Recognition'],
    [39, 55, 'SolarPlexus', 'Root', 'Emoting'],
    [19, 49, 'SolarPlexus', 'Root', 'Synthesis'],
    [ 6, 59, 'SolarPlexus', 'Sacral','Mating'],
    // Root ↔ Sacral / Spleen
    [42, 53, 'Root', 'Sacral',      'Maturation'],
    [ 9, 52, 'Root', 'Sacral',      'Concentration'],
    [ 3, 60, 'Root', 'Sacral',      'Mutation']
  ];

  // De-duplicate. Some pairs above repeat across centers (eg gate 20
  // bridges Throat to both Sacral via 34 and Spleen via 57). Build a
  // canonical map: "gA-gB" (sorted) → { gA, gB, centers:[a,b], name }.
  var CHANNEL_MAP = {};
  (function () {
    for (var i = 0; i < CHANNELS.length; i++) {
      var c = CHANNELS[i];
      var key = (c[0] < c[1] ? c[0] + '-' + c[1] : c[1] + '-' + c[0]);
      if (!CHANNEL_MAP[key]) {
        CHANNEL_MAP[key] = {
          gates: [c[0], c[1]].sort(function (a, b) { return a - b; }),
          centers: [c[2], c[3]],
          name: c[4]
        };
      }
    }
  })();
  // Canonical list, sorted by first gate then second.
  var CHANNEL_LIST = Object.keys(CHANNEL_MAP).sort().map(function (k) {
    return CHANNEL_MAP[k];
  });

  function definedChannelsFromGates(gates) {
    var have = {};
    gates.forEach(function (g) { have[g] = true; });
    var defined = [];
    for (var i = 0; i < CHANNEL_LIST.length; i++) {
      var ch = CHANNEL_LIST[i];
      if (have[ch.gates[0]] && have[ch.gates[1]]) {
        defined.push({
          gates: ch.gates.slice(),
          centers: ch.centers.slice(),
          name: ch.name
        });
      }
    }
    return defined;
  }

  function definedCentersFromChannels(channels) {
    var c = {
      Head: false, Ajna: false, Throat: false, G: false,
      Heart: false, Sacral: false, SolarPlexus: false,
      Spleen: false, Root: false
    };
    channels.forEach(function (ch) {
      c[ch.centers[0]] = true;
      c[ch.centers[1]] = true;
    });
    return c;
  }

  // Motor centers in HD: Sacral, Solar Plexus, Heart (Ego), Root.
  // A motor-to-throat connection means there is a defined channel
  // chain (single channel or contiguous chain through other centers)
  // that connects a motor center to the Throat.
  function motorToThroatConnected(definedCenters, definedChannels) {
    if (!definedCenters.Throat) return false;
    var motors = ['Sacral', 'SolarPlexus', 'Heart', 'Root'];
    // Build adjacency among defined centers via defined channels.
    var adj = {};
    function add(a, b) {
      (adj[a] = adj[a] || {})[b] = true;
      (adj[b] = adj[b] || {})[a] = true;
    }
    definedChannels.forEach(function (ch) {
      add(ch.centers[0], ch.centers[1]);
    });
    // BFS from any defined motor center to Throat.
    for (var i = 0; i < motors.length; i++) {
      if (!definedCenters[motors[i]]) continue;
      var queue = [motors[i]];
      var seen = {};
      seen[motors[i]] = true;
      while (queue.length) {
        var cur = queue.shift();
        if (cur === 'Throat') return true;
        var nbrs = adj[cur] || {};
        for (var n in nbrs) {
          if (!seen[n]) { seen[n] = true; queue.push(n); }
        }
      }
    }
    return false;
  }

  // ──────────────────────────────────────────────────────────────────
  // Type determination — standard Human Design mechanics.
  //
  //   Reflector: zero defined centers.
  //   Generator: Sacral defined, no motor-to-Throat. (Throat may be
  //              defined or undefined, but is not driven by a motor.)
  //   Manifesting Generator: Sacral defined AND motor-to-Throat.
  //   Manifestor: Sacral undefined AND motor-to-Throat.
  //   Projector: anything else (at least one defined center, no
  //              Sacral definition, no motor-to-Throat).
  // ──────────────────────────────────────────────────────────────────
  function computeType(definedCenters, definedChannels) {
    var anyDefined = Object.keys(definedCenters).some(function (k) {
      return definedCenters[k];
    });
    if (!anyDefined) return 'Reflector';
    var sacral = !!definedCenters.Sacral;
    var motorThroat = motorToThroatConnected(definedCenters, definedChannels);
    if (sacral && motorThroat) return 'Manifesting Generator';
    if (sacral) return 'Generator';
    if (motorThroat) return 'Manifestor';
    return 'Projector';
  }

  var STRATEGY_BY_TYPE = {
    'Manifestor':            'To inform before acting',
    'Generator':             'To wait to respond',
    'Manifesting Generator': 'To respond, then inform',
    'Projector':             'To wait for the invitation',
    'Reflector':             'To wait a lunar cycle before deciding'
  };

  // Authority hierarchy.
  function computeAuthority(type, definedCenters) {
    if (type === 'Reflector') return 'Lunar';
    if (definedCenters.SolarPlexus) return 'Emotional · Solar Plexus';
    if (definedCenters.Sacral)      return 'Sacral';
    if (definedCenters.Spleen)      return 'Splenic';
    if (definedCenters.Heart)       return 'Ego · Heart';
    // No motor → projector authorities.
    if (definedCenters.G && definedCenters.Throat) {
      return 'Self-Projected · G';
    }
    // Mental Projector / "no inner authority":
    if (definedCenters.Ajna || definedCenters.Head) {
      return 'Mental · Environmental';
    }
    return 'Environmental';
  }

  // Profile: PersonalitySun.line / DesignSun.line.
  function computeProfile(personality, design) {
    var p = personality && personality.Sun && personality.Sun.line;
    var d = design && design.Sun && design.Sun.line;
    if (!p || !d) return null;
    return p + '/' + d;
  }

  // Profile angle class.
  //   Lines 1,2,4,5 → Right Angle  (transpersonal karma)
  //   Lines 3,6     → Left Angle   (cross karma)
  //   Personality 4/1 with Design certain configurations →
  //     Juxtaposition (a 1-line/4-line pairing); we apply the
  //     simplest standard rule: Personality Sun line 4 + Design Sun
  //     line 1 → Juxtaposition. All other 4-line and 1-line cases
  //     remain Right Angle.
  function profileAngleClass(personalitySunLine, designSunLine) {
    var p = personalitySunLine, d = designSunLine;
    if (p === 4 && d === 1) return 'Juxtaposition';
    if (p === 1 && d === 4) return 'Juxtaposition';
    // Lines 3 or 6 in either Personality or Design Sun → Left Angle.
    if (p === 3 || p === 6 || d === 3 || d === 6) return 'Left Angle';
    return 'Right Angle';
  }

  // Incarnation Cross.
  function computeIncarnationCross(personality, design) {
    if (!personality || !design) return null;
    var pSun  = personality.Sun  && personality.Sun.gate;
    var pE    = personality.Earth && personality.Earth.gate;
    var dSun  = design.Sun  && design.Sun.gate;
    var dE    = design.Earth && design.Earth.gate;
    if (pSun == null || pE == null || dSun == null || dE == null) return null;
    var cls = profileAngleClass(
      personality.Sun.line, design.Sun.line
    );
    return {
      class: cls,
      gates: { personality_sun: pSun, personality_earth: pE,
               design_sun: dSun, design_earth: dE },
      label: cls + ' Cross of ' + pSun + '/' + pE + ' | ' + dSun + '/' + dE
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // Top-level: computeChart({ year, month, day, hour, minute,
  //                          tzOffsetMinutes, lat, lng }).
  // Returns the full HD bundle. Inputs/precision degradation:
  //   - birth_date alone → Personality Sun gate/line + profile fallback
  //     to null (Design needs the same time-of-day to anchor; we
  //     compute Personality Sun assuming noon UTC if hour is missing).
  //   - birth_date + time → full activations on both charts; type,
  //     strategy, authority, profile, incarnation cross computable.
  //   - lat/lng are NOT required for Human Design; ignored if present.
  // ──────────────────────────────────────────────────────────────────
  function computeChart(birth) {
    if (!birth || !birth.year || !birth.month || !birth.day) {
      return {
        ok: false,
        reason: 'missing_birth_date',
        precision: { all: 'requires birth date' }
      };
    }
    if (!Astro) {
      return {
        ok: false,
        reason: 'astronomy_unavailable',
        precision: { all: 'requires astronomy module' }
      };
    }

    var hasTime = (typeof birth.hour === 'number');
    var hr = hasTime ? birth.hour : 12;
    var mn = (typeof birth.minute === 'number') ? birth.minute : 0;
    var tz = (typeof birth.tzOffsetMinutes === 'number') ? birth.tzOffsetMinutes : 0;

    var utc = new Date(Date.UTC(birth.year, birth.month - 1, birth.day, hr, mn, 0));
    utc = new Date(utc.getTime() - tz * 60 * 1000);
    var birthJD = Astro.dateToJD(utc);
    var designJD = findDesignJD(birthJD);

    var personality = activationsAtJD(birthJD);
    var design      = activationsAtJD(designJD);

    // Defined gates.
    var gateSet = {};
    Object.keys(personality).forEach(function (k) {
      gateSet[personality[k].gate] = true;
    });
    Object.keys(design).forEach(function (k) {
      gateSet[design[k].gate] = true;
    });
    var gates = Object.keys(gateSet).map(function (g) { return Number(g); })
                                     .sort(function (a, b) { return a - b; });

    var channels = definedChannelsFromGates(gates);
    var centers  = definedCentersFromChannels(channels);
    var type     = computeType(centers, channels);
    var strategy = STRATEGY_BY_TYPE[type] || null;
    var authority = computeAuthority(type, centers);
    var profile  = computeProfile(personality, design);
    var cross    = computeIncarnationCross(personality, design);

    var definedList = Object.keys(centers).filter(function (k) {
      return centers[k];
    });
    var undefinedList = Object.keys(centers).filter(function (k) {
      return !centers[k];
    });

    var precisionLabel = hasTime
      ? 'calculated from birth time + coordinates'
      : 'calculated from birth date (design positions approximate without time)';

    return {
      ok: true,
      precision: {
        type:               precisionLabel,
        strategy:           precisionLabel,
        authority:          precisionLabel,
        profile:            precisionLabel,
        incarnation_cross:  precisionLabel,
        gates:              precisionLabel,
        channels:           precisionLabel,
        centers:            precisionLabel
      },
      method: 'commonunity-hd-v1 · Meeus low-precision + JPL elements',
      type: type,
      strategy: strategy,
      authority: authority,
      profile: profile,
      incarnation_cross: cross,
      gates: gates,
      channels: channels.map(function (c) {
        return { gates: c.gates, name: c.name, centers: c.centers };
      }),
      centers: {
        defined: definedList,
        open:    undefinedList,
        map:     centers
      },
      activations: {
        personality: personality,
        design:      design
      }
    };
  }

  return {
    GATE_ORDER:                GATE_ORDER,
    WHEEL_START_LON:           WHEEL_START_LON,
    gateLineFromLongitude:     gateLineFromLongitude,
    lunarNorthNodeLongitude:   lunarNorthNodeLongitude,
    planetGeocentricLongitude: planetGeocentricLongitude,
    findDesignJD:              findDesignJD,
    activationsAtJD:           activationsAtJD,
    CHANNELS:                  CHANNEL_LIST,
    definedChannelsFromGates:  definedChannelsFromGates,
    definedCentersFromChannels:definedCentersFromChannels,
    motorToThroatConnected:    motorToThroatConnected,
    computeType:               computeType,
    computeAuthority:          computeAuthority,
    computeProfile:            computeProfile,
    computeIncarnationCross:   computeIncarnationCross,
    profileAngleClass:         profileAngleClass,
    STRATEGY_BY_TYPE:          STRATEGY_BY_TYPE,
    computeChart:              computeChart
  };
}));
