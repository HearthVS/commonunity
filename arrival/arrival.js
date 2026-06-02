/* arrival/arrival.js
 *
 * Arrival chamber — the FIRST page inside cOMpass, shown once right after
 * the threshold completes. It is intentionally NOT part of the threshold
 * flow: the threshold stays a simple naming ritual and hands off here, and
 * this page hands off into the working cOMpass view.
 *
 * Responsibilities:
 *   • Read (never write) the OM Cipher contract for palette + first name.
 *   • Apply the inherited cipher palette so the chamber matches cOMpass.
 *   • Present the orientation, then two NON-EXCLUSIVE begin paths:
 *       1. Request a one-on-one orientation with Markus (POST to server).
 *       2. Begin a solo session now (route into the working compass view).
 *   • Show the solo-session instructions.
 *
 * Routing contract:
 *   • Solo begin → /compass?threshold=done&enter=compass (the same handoff
 *     URL the threshold used before this chamber existed).
 */
'use strict';

(function () {
  var Contract = window.OmCipherContract;
  var root = document.getElementById('arrival-root');
  if (!root) return;

  // Where the working cOMpass view lives. Kept identical to the threshold's
  // historical handoff target so the anti-flash + auto-open path in
  // index.html keeps working unchanged.
  var COMPASS_ENTRY = '/compass?threshold=done&enter=compass';

  // ---- Small DOM helper ---------------------------------------------------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // ---- Palette inheritance ------------------------------------------------
  // Mirror index.html#initThresholdContract's palette application so the
  // arrival chamber wears the same colours the user will see in cOMpass.
  function applyPalette(contract) {
    var palette = (contract && contract.om_cipher && contract.om_cipher.palette) || {};
    var rootEl = document.documentElement;
    var accent = palette.seasonal_accent || palette.accent || palette.accent_color || palette.tertiary || '';
    if (palette.primary) {
      rootEl.style.setProperty('--cipher-primary', palette.primary);
    }
    if (palette.secondary) rootEl.style.setProperty('--cipher-secondary', palette.secondary);
    if (accent) rootEl.style.setProperty('--cipher-accent', accent);
  }

  function firstNameFrom(contract) {
    var full = (contract && contract.identity && contract.identity.full_name) || '';
    return full.trim().split(/\s+/)[0] || '';
  }

  // ---- Canonical cOMpass logo --------------------------------------------
  // The faceted-diamond / four-sided compass used beside the `cOMpass`
  // wordmark in index.html and theatrically in the threshold (threshold.js
  // compassLogoSvg + .compass-mark). The markup is copied verbatim so the
  // arrival chamber reads as the same product; the .compass-mark* aura/ring
  // styles + the --brand-logo-* palette tokens both come from the
  // /threshold/threshold.css this page already loads.
  var _compassLogoSeq = 0;
  function compassLogoSvg() {
    var u = 'arr-cmp-' + (++_compassLogoSeq);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<defs>' +
        '<radialGradient id="' + u + '-aura" cx="50%" cy="50%" r="50%">' +
          '<stop offset="55%" stop-color="#818cf8" stop-opacity="0"/>' +
          '<stop offset="78%" stop-color="var(--brand-logo-east, #4f5f8f)" stop-opacity="0.18"/>' +
          '<stop offset="100%" stop-color="var(--brand-logo-center, #f7ead2)" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<radialGradient id="' + u + '-glow" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0%" stop-color="var(--brand-logo-center, #f7ead2)" stop-opacity="0.9"/>' +
          '<stop offset="25%" stop-color="var(--brand-logo-north, #d6b36a)" stop-opacity="0.5"/>' +
          '<stop offset="55%" stop-color="var(--brand-logo-east, #4f5f8f)" stop-opacity="0.2"/>' +
          '<stop offset="100%" stop-color="var(--brand-logo-east, #4f5f8f)" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="' + u + '-fold" color-interpolation-filters="sRGB" x="-6%" y="-6%" width="112%" height="112%">' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>' +
          '<feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 28 -12" result="t"/>' +
          '<feComposite in="SourceGraphic" in2="t" operator="atop"/>' +
        '</filter>' +
      '</defs>' +
      '<circle cx="50" cy="50" r="50" fill="url(#' + u + '-aura)"/>' +
      '<g filter="url(#' + u + '-fold)">' +
        '<polygon points="50,5 95,50 5,50 50,43" fill="var(--brand-logo-north, #d6b36a)" fill-opacity="0.72"/>' +
        '<polygon points="95,50 50,95 50,5 57,50" fill="var(--brand-logo-east, #4f5f8f)" fill-opacity="0.68"/>' +
        '<polygon points="50,95 5,50 95,50 50,57" fill="var(--brand-logo-south, #6f9a84)" fill-opacity="0.65"/>' +
        '<polygon points="5,50 50,5 50,95 43,50" fill="var(--brand-logo-west, #b4787e)" fill-opacity="0.65"/>' +
      '</g>' +
      '<g opacity="0.5">' +
        '<polygon points="50,22 72,43 28,43 50,38" fill="var(--brand-logo-inner-north, #f1d99d)" fill-opacity="0.45"/>' +
        '<polygon points="72,57 57,72 57,28 62,50" fill="var(--brand-logo-inner-east, #91a0c9)" fill-opacity="0.4"/>' +
        '<polygon points="50,78 28,57 72,57 50,62" fill="var(--brand-logo-inner-south, #a6c9b1)" fill-opacity="0.4"/>' +
        '<polygon points="28,43 43,28 43,72 38,50" fill="var(--brand-logo-inner-west, #d6a0a2)" fill-opacity="0.38"/>' +
      '</g>' +
      '<circle cx="50" cy="50" r="15" fill="url(#' + u + '-glow)"/>' +
      '<circle cx="50" cy="50" r="1.5" fill="var(--brand-logo-center, #f7ead2)" fill-opacity="0.9"/>';
    return svg;
  }

  function compassMark() {
    var wrap = el('div', { class: 'compass-mark', role: 'img', 'aria-label': 'cOMpass logo' }, [
      el('span', { class: 'compass-mark-aura', 'aria-hidden': 'true' }),
      el('span', { class: 'compass-mark-ring', 'aria-hidden': 'true' })
    ]);
    var svg = compassLogoSvg();
    svg.setAttribute('class', 'compass-mark-svg');
    wrap.appendChild(svg);
    return wrap;
  }

  // ---- Orientation copy ---------------------------------------------------
  // Lightly edited from Markus's source for readability + UI fit. The word
  // "orient" is emphasised once where the etymological turn is introduced.
  var ORIENTATION = [
    'Most of us were taught that to “orient” means to find north: to fix ourselves on magnetic north, the top of the map, and with it the subtle belief that North knows best, that West knows best.',
    'That orientation has shaped our habits and hierarchies. It appears in maps that stretch the northern hemisphere and shrink places like Africa. It appears in stories that elevate certain cultures while making others small. And it appears in a way of navigating that quietly distorts what we see as real, valuable, and important.',
    'Originally, though, to orient was to turn toward the East: toward the rising light, and to let that light recalibrate our bearings, our choices, and our sense of possibility.',
    'The cOMpass exists for this re-orientation. It is here to help you shift from an inherited, north-bound compass to an inner compass tuned to light, frequency, and the universal laws that run deeper than the chaos of our current world.',
    'As one of the first pioneers of CommonUnity, you are here to help feel, test, and anchor this new way of orienting, so that unity can become practical, grounded, and common.'
  ];

  var SOLO_STEPS = [
    'Read your first Gene Key hexagram. If you have the Gene Keys book, begin there. If you prefer to read inside cOMpass, open the Hexagram Reader and check your magic-link email for the reader passcode.',
    'Notice what feels alive, challenging, surprising, or personally relevant.',
    'Add your own session notes.',
    'Answer the facilitation questions.',
    'Begin adding your contemplations as they arise.',
    'Chat with Nexus if you want reflective support. Nexus is the CommonUnity reflection companion, here to help you clarify and deepen your contemplations without replacing your own inner authority.',
    'Stop when the session feels complete. You can return later and continue.'
  ];

  // ---- One-on-one request -------------------------------------------------
  function buildOneOnOneCard() {
    var stateBox = el('div', {
      class: 'arrival-request-state',
      role: 'status',
      'aria-live': 'polite'
    });
    var errBox = el('div', { class: 'arrival-request-error' });

    var btn = el('button', {
      class: 'threshold-btn threshold-btn-primary',
      type: 'button'
    }, ['Request guided orientation']);

    btn.addEventListener('click', function () {
      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = 'Sending…';
      errBox.textContent = '';
      var contract = safeRead();
      fetch('/api/orientation-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (contract && contract.identity && contract.identity.full_name) || '',
          birth_date: (contract && contract.identity && contract.identity.birth_date) || ''
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('bad status');
        btn.style.display = 'none';
        stateBox.textContent =
          'Guided orientation requested. Markus will reach out personally. ' +
          'You can still begin your first solo session while you wait.';
        stateBox.classList.add('is-visible');
        try { window.localStorage.setItem('commonunity_oneonone_requested_v1', '1'); } catch (_) {}
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = original;
        errBox.textContent = 'Could not send the request just now. Please try again.';
      });
    });

    var card = el('div', { class: 'arrival-path-card arrival-path-card-guided' }, [
      el('span', { class: 'arrival-path-badge' }, ['Guided']),
      el('h3', null, ['Request guided orientation']),
      el('p', null, [
        'If you would like Markus to personally guide you through your first ' +
        'cOMpass orientation, let him know here. The guided path can unfold ' +
        'over four sessions, exploring the laws of awareness, clarity, ' +
        'balance, and creation while integrating other practices and ' +
        'traditions. Markus will reach out directly to arrange what is ' +
        'appropriate.'
      ]),
      el('p', { class: 'arrival-path-note' }, [
        'These guided sessions are normally offered as paid facilitation; ' +
        'first beta requests are arranged personally.'
      ]),
      btn,
      stateBox,
      errBox
    ]);

    // If a request was already sent in a prior visit, reflect that state.
    try {
      if (window.localStorage.getItem('commonunity_oneonone_requested_v1') === '1') {
        btn.style.display = 'none';
        stateBox.textContent =
          'Guided orientation requested. Markus will reach out personally. ' +
          'You can still begin your first solo session while you wait.';
        stateBox.classList.add('is-visible');
      }
    } catch (_) {}

    return card;
  }

  // The solo card is informational/preparation only — it does NOT navigate
  // into cOMpass. The single solo handoff lives in the footer below the
  // numbered steps, so everyone reads the steps before entering once.
  function buildSoloCard() {
    return el('div', { class: 'arrival-path-card arrival-path-card-solo' }, [
      el('span', { class: 'arrival-path-badge arrival-path-badge-solo' }, ['Solo']),
      el('h3', null, ['Begin your first solo session']),
      el('p', null, [
        'If you would like to begin now, start by reading your first Gene ' +
        'Key hexagram. Your solo path is outlined below so you can enter ' +
        'cOMpass with a clear first step.'
      ]),
      el('div', { class: 'arrival-path-cue' }, ['Review the solo steps below ↓'])
    ]);
  }

  function buildInstructions() {
    var list = el('ol', { class: 'arrival-instructions' });
    SOLO_STEPS.forEach(function (step) {
      list.appendChild(el('li', null, [step]));
    });
    return list;
  }

  // ---- Handoff ------------------------------------------------------------
  var _handoffStarted = false;
  function handoffToCompass() {
    if (_handoffStarted) return;
    _handoffStarted = true;
    window.location.href = COMPASS_ENTRY;
  }

  function safeRead() {
    try { return Contract && Contract.read ? Contract.read() : null; }
    catch (_) { return null; }
  }

  // ---- Render -------------------------------------------------------------
  function render() {
    var contract = safeRead();
    applyPalette(contract);
    try { root.classList.add('is-om-field'); } catch (_) {}

    var name = firstNameFrom(contract);
    var card = el('div', { class: 'arrival-card' });

    card.appendChild(compassMark());
    card.appendChild(el('h1', { class: 'arrival-title' }, ['Welcome to cOMpass']));
    card.appendChild(el('p', { class: 'arrival-lede' }, [
      name ? (name + ', this is the beginning of your orientation.')
           : 'This is the beginning of your orientation.'
    ]));
    card.appendChild(el('div', { class: 'arrival-divider' }));

    var orientation = el('div', { class: 'arrival-orientation' });
    ORIENTATION.forEach(function (para) {
      orientation.appendChild(el('p', null, [para]));
    });
    card.appendChild(orientation);

    // Begin your orientation — the two non-exclusive paths.
    card.appendChild(el('div', { class: 'arrival-section-label' }, ['Begin your orientation']));
    card.appendChild(el('p', { class: 'arrival-section-intro' }, [
      'You can begin in two ways. You may request a personal one-on-one ' +
      'orientation with Markus, and you may also begin your first solo ' +
      'cOMpass session now. These are not separate paths. If you request a ' +
      'one-on-one, you can still begin on your own while you wait.'
    ]));

    var paths = el('div', { class: 'arrival-paths' });
    paths.appendChild(buildOneOnOneCard());
    paths.appendChild(buildSoloCard());
    card.appendChild(paths);

    // Solo session instructions — visible on the page so the user knows
    // exactly what a first solo session involves before committing.
    card.appendChild(el('h2', { class: 'arrival-section-title', style: 'margin-top:clamp(1.8rem,4vw,2.6rem);' },
      ['Your first solo session']));
    card.appendChild(buildInstructions());

    // Local-first trust note, accurate to the implementation and aligned with
    // the in-cOMpass Nexus consent step. Your contemplations + notes stay in
    // this browser; the one time data leaves is when you chat with Nexus, which
    // sends that message + context to Claude to compose a reflection.
    card.appendChild(el('p', { class: 'arrival-trust-note' }, [
      'Trust note: your cOMpass contemplations and notes stay on your own ' +
      'computer, in this browser — this is part of CommonUnity’s local-first ' +
      'trust architecture. The one time anything leaves is when you choose to ' +
      'chat with Nexus, which sends your message and the relevant cOMpass ' +
      'context to Claude to compose a reflection. cOMpass will tell you this ' +
      'before your first Nexus message.'
    ]));

    var soloFooter = el('div', { class: 'arrival-solo-footer' });
    var soloBtn = el('button', {
      class: 'threshold-btn threshold-btn-primary',
      type: 'button',
      style: 'flex:0 0 auto;min-width:220px;'
    }, ['Begin solo session']);
    soloBtn.addEventListener('click', handoffToCompass);
    soloFooter.appendChild(soloBtn);
    card.appendChild(soloFooter);

    root.innerHTML = '';
    root.appendChild(card);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
