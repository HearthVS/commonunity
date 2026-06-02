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

  // ---- cOMpass mark (small, decorative) -----------------------------------
  // A simple gold ring echo of the threshold's compass mark. Kept minimal
  // and self-contained so the arrival module has no coupling to threshold.js.
  function compassMark() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '56');
    svg.setAttribute('height', '56');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<circle cx="50" cy="50" r="34" fill="none" stroke="var(--cipher-primary)" stroke-opacity="0.55" stroke-width="1.5"/>' +
      '<circle cx="50" cy="50" r="22" fill="none" stroke="var(--cipher-accent)" stroke-opacity="0.5" stroke-width="1"/>' +
      '<circle cx="50" cy="50" r="2.4" fill="var(--brand-logo-center, #f7ead2)"/>' +
      '<path d="M50 14 L54 46 L50 50 L46 46 Z" fill="var(--cipher-accent)" fill-opacity="0.85"/>';
    return el('div', { class: 'arrival-mark-wrap' }, [svg]);
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
    }, ['Request one-on-one']);

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
          'One-on-one requested. Markus will reach out personally. ' +
          'You can still begin your first solo session while you wait.';
        stateBox.classList.add('is-visible');
        try { window.localStorage.setItem('commonunity_oneonone_requested_v1', '1'); } catch (_) {}
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = original;
        errBox.textContent = 'Could not send the request just now. Please try again.';
      });
    });

    var card = el('div', { class: 'arrival-path-card' }, [
      el('h3', null, ['Request one-on-one orientation']),
      el('p', null, [
        'If you would like Markus to personally guide you through your first ' +
        'cOMpass session, let him know here. He will reach out to arrange a ' +
        'time directly.'
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
          'One-on-one requested. Markus will reach out personally. ' +
          'You can still begin your first solo session while you wait.';
        stateBox.classList.add('is-visible');
      }
    } catch (_) {}

    return card;
  }

  function buildSoloCard(onBegin) {
    var btn = el('button', {
      class: 'threshold-btn threshold-btn-ghost',
      type: 'button'
    }, ['Begin solo session']);
    btn.addEventListener('click', onBegin);

    return el('div', { class: 'arrival-path-card' }, [
      el('h3', null, ['Begin your first solo session']),
      el('p', null, [
        'If you would like to begin now, start with your first Gene Key ' +
        'hexagram. Read slowly, take notes, and let the first contemplation ' +
        'open naturally.'
      ]),
      btn
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
    paths.appendChild(buildSoloCard(handoffToCompass));
    card.appendChild(paths);

    // Solo session instructions — visible on the page so the user knows
    // exactly what a first solo session involves before committing.
    card.appendChild(el('h2', { class: 'arrival-section-title', style: 'margin-top:clamp(1.8rem,4vw,2.6rem);' },
      ['Your first solo session']));
    card.appendChild(buildInstructions());

    // Local-first trust note. Accurate to the implementation: your cOMpass
    // contemplations + session notes are kept in this browser (localStorage),
    // not in a CommonUnity account. (Nexus replies still require sending your
    // message to be answered — so the note speaks to your cOMpass data, not a
    // blanket "nothing ever leaves your device" claim.)
    card.appendChild(el('p', { class: 'arrival-trust-note' }, [
      'Trust note: your cOMpass contemplations and notes stay on your own ' +
      'computer, in this browser. This is part of CommonUnity’s ' +
      'local-first trust architecture.'
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
