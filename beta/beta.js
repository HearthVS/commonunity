/* beta/beta.js
 *
 * CommonUnity private beta — client state machine.
 *
 * Three server-driven states, resolved from the signed invite cookie by
 * GET /api/beta/session (never a client-only check):
 *
 *   locked    — no valid invitation (defensive; the server normally gates
 *               this route, so a participant should not reach here).
 *   threshold — invited, not yet admitted: the CommonUnity beta threshold
 *               (name + email + one CTA).
 *   hub       — admitted: the private beta hub (Welcome, Path, Announcements,
 *               Library / Sharings).
 *
 * The module owns its own DOM under #threshold-root and reuses the cOMpass
 * threshold's CSS (field atmosphere, card system, inputs, buttons). It does
 * NOT run any per-person palette logic — the field is universal here.
 */

(function () {
  'use strict';

  var root = document.getElementById('threshold-root');
  if (!root) return;

  var WORDMARK = '/assets/brand/primary-logo-transparent.svg';
  var MARK = '/assets/brand/mark.svg';
  // Canonical small product marks (transparent, no background plate — the
  // plate-free variants of the root favicons). Reused, never redrawn.
  var COMPASS_MARK = '/assets/brand/compass-mark-transparent.svg';
  var STUDIO_MARK = '/assets/brand/studio-mark-transparent.svg';

  // ---- tiny DOM helper (same shape as threshold.js el()) ------------------
  function el(tag, opts) {
    var node = document.createElement(tag);
    if (opts) {
      for (var k in opts) {
        if (!Object.prototype.hasOwnProperty.call(opts, k)) continue;
        if (k === 'class') node.className = opts[k];
        else if (k === 'html') node.innerHTML = opts[k];
        else if (k.indexOf('on') === 0 && typeof opts[k] === 'function') node.addEventListener(k.slice(2), opts[k]);
        else if (opts[k] != null) node.setAttribute(k, opts[k]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  // Centralized fade-in for every screen transition, mirroring threshold.js.
  // prefers-reduced-motion is honoured at the CSS layer (.is-entering).
  function playEnter() {
    try {
      root.classList.remove('is-entering');
      void root.offsetWidth;
      root.classList.add('is-entering');
      setTimeout(function () { try { root.classList.remove('is-entering'); } catch (_) {} }, 900);
    } catch (_) {}
  }

  // A restrained, sensed luminosity: interactive elements carrying `.beta-glow`
  // track the pointer with a very soft radial highlight (CSS reads --gx/--gy).
  // Calm, not neon or gamified: no global cursor, no motion loop, disabled for
  // touch (no fine pointer) and for prefers-reduced-motion. Locked cards never
  // receive it, so the affordance only appears where something is actionable.
  function attachFieldGlow(scope) {
    try {
      var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!fine || reduced) return;
      scope.addEventListener('pointermove', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.beta-glow') : null;
        if (!t) return;
        var rect = t.getBoundingClientRect();
        t.style.setProperty('--gx', ((e.clientX - rect.left) / rect.width * 100) + '%');
        t.style.setProperty('--gy', ((e.clientY - rect.top) / rect.height * 100) + '%');
      }, { passive: true });
    } catch (_) {}
  }

  function wordmark() {
    var wrap = el('span', { class: 'beta-wordmark', role: 'img', 'aria-label': 'CommonUnity' });
    var img = document.createElement('img');
    img.src = WORDMARK;
    img.alt = 'CommonUnity';
    wrap.appendChild(img);
    return wrap;
  }

  function omMark() {
    var wrap = el('span', { class: 'beta-mark', 'aria-hidden': 'true' });
    var img = document.createElement('img');
    img.src = MARK;
    img.alt = '';
    wrap.appendChild(img);
    return wrap;
  }

  // ---- state: locked (invite-only) ---------------------------------------
  function renderLocked() {
    root.innerHTML = '';
    var card = el('div', { class: 'threshold-card is-chamber is-locked' });
    card.appendChild(omMark());
    card.appendChild(el('h1', { class: 'threshold-title' }, 'This space is invite-only'));
    card.appendChild(el('p', { class: 'threshold-line' },
      'The CommonUnity beta opens through a private link. If you were invited, please return using the link that was sent to you.'
    ));
    root.appendChild(card);
    playEnter();
  }

  // ---- state: threshold (name + email) -----------------------------------
  function renderThreshold() {
    root.innerHTML = '';
    root.classList.add('is-arrival');

    var card = el('div', { class: 'threshold-card is-arrival is-threshold' });
    card.appendChild(wordmark());
    card.appendChild(el('p', { class: 'beta-eyebrow' }, 'Private beta'));
    card.appendChild(el('h1', { class: 'threshold-title is-arrival-title' }, 'Enter the shared field'));
    card.appendChild(el('p', { class: 'threshold-line is-arrival-line' },
      'Welcome. You have been invited into the first CommonUnity beta — a small, shared space where the path and its materials are gathered while they are still forming.'
    ));
    card.appendChild(el('p', { class: 'threshold-line is-arrival-line' },
      'Leave your name and email to join the first beta group and receive access to the path and shared materials as they open.'
    ));

    var nameField = el('div', { class: 'threshold-field' },
      el('label', { for: 'beta-name' }, 'Your name'),
      el('input', { id: 'beta-name', type: 'text', autocomplete: 'name', 'aria-required': 'true' })
    );
    var emailField = el('div', { class: 'threshold-field' },
      el('label', { for: 'beta-email' }, 'Email'),
      el('input', { id: 'beta-email', type: 'email', autocomplete: 'email', inputmode: 'email', 'aria-required': 'true' })
    );
    card.appendChild(nameField);
    card.appendChild(emailField);

    var errBox = el('div', { class: 'threshold-error', id: 'beta-err', role: 'alert' });
    card.appendChild(errBox);

    var cta = el('button', { class: 'threshold-btn threshold-btn-primary', type: 'button' }, 'Enter the beta space');
    cta.addEventListener('click', function () { onAdmit(cta, errBox); });
    card.appendChild(el('div', { class: 'threshold-actions' }, cta));

    card.appendChild(el('p', { class: 'beta-context' },
      'You are joining the first beta group. We hold only your name and email so we can welcome you and share what opens next.'
    ));

    // Enter-to-submit from either field.
    [nameField, emailField].forEach(function (f) {
      var input = f.querySelector('input');
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); onAdmit(cta, errBox); }
      });
    });

    root.appendChild(card);
    setTimeout(function () { try { document.getElementById('beta-name').focus({ preventScroll: true }); } catch (_) {} }, 500);
    playEnter();
  }

  function validEmail(v) {
    if (!v || v.length < 6) return false;
    var at = v.indexOf('@');
    if (at < 1) return false;
    var domain = v.slice(at + 1);
    return domain.indexOf('.') > 0 && !/\s/.test(v);
  }

  function onAdmit(cta, errBox) {
    var name = (document.getElementById('beta-name').value || '').trim();
    var email = (document.getElementById('beta-email').value || '').trim();
    errBox.textContent = '';
    if (!name) { errBox.textContent = 'Your name is needed to enter.'; document.getElementById('beta-name').focus(); return; }
    if (!validEmail(email)) { errBox.textContent = 'A valid email is needed to enter.'; document.getElementById('beta-email').focus(); return; }

    cta.disabled = true;
    var original = cta.textContent;
    cta.textContent = 'Entering…';

    fetch('/api/beta/admit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (b) {
          throw new Error(b.detail || 'We could not admit you just now. Please try again.');
        });
      }
      return res.json();
    }).then(function (data) {
      root.classList.remove('is-arrival');
      renderHub((data && data.name) || name);
    }).catch(function (e) {
      cta.disabled = false;
      cta.textContent = original;
      errBox.textContent = e.message || 'Something went wrong. Please try again.';
    });
  }

  // ---- state: hub --------------------------------------------------------
  function renderHub(name) {
    root.innerHTML = '';
    root.setAttribute('data-palette-stage', '2');

    var hub = el('div', { class: 'beta-hub' });

    // Header / Welcome
    var header = el('div', { class: 'beta-hub-header' });
    header.appendChild(wordmark());
    var greetName = (name || '').trim();
    header.appendChild(el('h1', { class: 'beta-hub-greeting' },
      greetName ? ('Welcome, ' + greetName.split(' ')[0] + '.') : 'Welcome.'
    ));
    header.appendChild(el('p', { class: 'beta-hub-subline' },
      'You are inside the first CommonUnity beta — a shared room held quietly while the path takes shape. Take your time here.'
    ));
    hub.appendChild(header);

    // Welcome panel
    var welcome = el('div', { class: 'beta-panel' });
    welcome.appendChild(el('h2', { class: 'beta-panel-title' }, 'Welcome'));
    welcome.appendChild(el('p', {},
      'Thank you for being among the first. This space will grow gently: announcements, shared materials, and the opening of the path will appear here as they are ready. Nothing is demanded of you — return whenever it feels right.'
    ));
    hub.appendChild(welcome);

    // NOTE: The participant-facing personal "For you" area is intentionally NOT
    // rendered in this beta. Individual messages remain stored server-side and
    // are still returned by /api/messages (see loadMessages, which filters them
    // out of the shared feed) — the panel is dormant, not deleted, and can be
    // reactivated later without any backend/data change.

    // Announcements panel (async). Announcements and the Library are held higher
    // than the product entrances, which are still locked at this stage.
    var announce = el('div', { class: 'beta-panel' });
    announce.appendChild(el('h2', { class: 'beta-panel-title' }, 'Announcements'));
    var announceBody = el('div', { id: 'beta-announce' });
    announceBody.appendChild(el('p', { class: 'beta-empty' }, 'Loading…'));
    announce.appendChild(announceBody);
    hub.appendChild(announce);

    // Library / Sharings panel (async). The curated beta Library leads; a calm,
    // optional invitation to follow the wider conversation on Substack sits
    // beneath it, complementing (never replacing) the shared materials.
    var library = el('div', { class: 'beta-panel' });
    library.appendChild(el('h2', { class: 'beta-panel-title' }, 'Library & Sharings'));
    var libBody = el('div', { id: 'beta-library' });
    libBody.appendChild(el('p', { class: 'beta-empty' }, 'Loading…'));
    library.appendChild(libBody);
    library.appendChild(substackInvite());
    hub.appendChild(library);

    // Path panel — the CommonUnity spaces this beta will open into. They are
    // LOCKED at this stage: each product keeps its own separate magic-link /
    // threshold gate, so these are not navigational links and carry no bypass
    // URL or token. They sit last so announcements and the library lead.
    var path = el('div', { class: 'beta-panel' });
    path.appendChild(el('h2', { class: 'beta-panel-title' }, 'The path ahead'));
    path.appendChild(el('p', {},
      'The path opens into the CommonUnity spaces. They are being prepared and are locked for now — each opens through its own private invitation when it is ready.'
    ));
    var pathList = el('ul', { class: 'beta-path-list' });
    pathList.appendChild(lockedEntrance('cOMpass', COMPASS_MARK,
      'Your orientation — name, coordinates, and true north.'));
    pathList.appendChild(lockedEntrance('stUdio', STUDIO_MARK,
      'A quiet workshop for your living profile and fields.'));
    path.appendChild(pathList);
    hub.appendChild(path);

    hub.appendChild(el('p', { class: 'beta-hub-footer' },
      'CommonUnity private beta · a shared field, held with care.'
    ));

    root.appendChild(hub);
    playEnter();
    attachFieldGlow(hub);

    loadMessages(announceBody);
    loadLibrary(libBody);
  }

  // A restrained, optional invitation to follow the wider CommonUnity
  // conversation on Substack. It complements the curated beta Library and is
  // never required for participation. Opens externally in a new tab, safely,
  // with an accessible external-link affordance. A plain text link — no Substack
  // logo, per the transparent-asset brand rule.
  var SUBSTACK_URL = 'https://substack.com/@commonunityio';
  function substackInvite() {
    var wrap = el('div', { class: 'beta-substack' });
    wrap.appendChild(el('p', { class: 'beta-substack-lead' }, 'Follow the wider conversation.'));
    var a = el('a', {
      class: 'beta-substack-link beta-glow',
      href: SUBSTACK_URL,
      target: '_blank',
      rel: 'noopener noreferrer'
    });
    a.appendChild(el('span', {}, 'Subscribe to CommonUnity on Substack'));
    a.appendChild(el('span', { class: 'beta-ext-glyph', 'aria-hidden': 'true' }, '↗'));
    a.appendChild(el('span', { class: 'beta-visually-hidden' }, '(opens in a new tab)'));
    wrap.appendChild(a);
    return wrap;
  }

  // A locked product entrance. Deliberately NOT an <a>: it carries no href,
  // token, or bypass URL, so it can never let a participant skip the product's
  // own magic-link / threshold gate. The lock is communicated in text ("Locked")
  // and semantically (aria-disabled), never by colour alone.
  function lockedEntrance(title, markSrc, note) {
    var row = el('li', { class: 'beta-row beta-row-locked', 'aria-disabled': 'true' });

    var logo = el('span', { class: 'beta-row-logo', 'aria-hidden': 'true' });
    if (markSrc) {
      var img = document.createElement('img');
      img.src = markSrc;
      img.alt = '';
      logo.appendChild(img);
    }

    var main = el('div', { class: 'beta-row-main' },
      el('span', { class: 'beta-row-title' }, title),
      el('span', { class: 'beta-row-note' }, note)
    );

    var head = el('div', { class: 'beta-row-head' }, logo, main);
    row.appendChild(head);

    var tag = el('span', { class: 'beta-row-tag beta-row-lock' });
    tag.appendChild(el('span', { class: 'beta-lock-glyph', 'aria-hidden': 'true' }, '\u{1F512}'));
    tag.appendChild(el('span', { class: 'beta-lock-label' }, 'Locked'));
    row.appendChild(tag);

    return row;
  }

  // Render one message item (subject / body / date) into a list container.
  function messageItem(m) {
    var item = el('div', { class: 'beta-announce-item' });
    if (m.subject) item.appendChild(el('p', { class: 'beta-announce-subject' }, m.subject));
    if (m.body) item.appendChild(el('p', { class: 'beta-announce-body' }, m.body));
    if (m.created_at) item.appendChild(el('span', { class: 'beta-announce-date' }, formatDate(m.created_at)));
    return item;
  }

  // Fetch this participant's in-app messages (server-scoped to their own invite)
  // and render only the shared Announcements feed. Individual ("For you")
  // messages are deliberately filtered out and NOT shown in this beta — the
  // personal area is dormant. They remain stored and are still returned by the
  // API, so the panel can be reactivated later with no backend change. Newest
  // first is the server's order; the feed keeps it.
  function loadMessages(announceContainer) {
    fetch('/api/messages', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { messages: [] }; })
      .then(function (data) {
        var msgs = (data && data.messages) || [];
        var announcements = msgs.filter(function (m) { return m.kind !== 'individual'; });

        announceContainer.innerHTML = '';
        if (!announcements.length) {
          announceContainer.appendChild(el('p', { class: 'beta-empty' }, 'No announcements yet. This is where word from CommonUnity will arrive.'));
          return;
        }
        var list = el('div', { class: 'beta-announce-list' });
        announcements.forEach(function (m) { list.appendChild(messageItem(m)); });
        announceContainer.appendChild(list);
      })
      .catch(function () {
        announceContainer.innerHTML = '';
        announceContainer.appendChild(el('p', { class: 'beta-empty' }, 'Announcements are unavailable just now.'));
      });
  }

  function loadLibrary(container) {
    fetch('/api/beta/library', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (data) {
        container.innerHTML = '';
        var items = (data && data.items) || [];
        if (!items.length) {
          container.appendChild(el('p', { class: 'beta-empty' }, 'Shared materials will gather here as they are offered.'));
          return;
        }
        var list = el('ul', { class: 'beta-library-list' });
        items.forEach(function (it) {
          var a = el('a', { class: 'beta-row beta-glow', href: it.url, target: '_blank', rel: 'noopener' });
          a.appendChild(el('div', { class: 'beta-row-main' },
            el('span', { class: 'beta-row-title' }, it.title)
          ));
          a.appendChild(el('span', { class: 'beta-row-tag' }, (it.kind === 'link' ? 'Link' : (it.ext || 'File')).toUpperCase()));
          list.appendChild(a);
        });
        container.appendChild(list);
      })
      .catch(function () {
        container.innerHTML = '';
        container.appendChild(el('p', { class: 'beta-empty' }, 'The library is unavailable just now.'));
      });
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) { return ''; }
  }

  // ---- boot --------------------------------------------------------------
  function boot() {
    fetch('/api/beta/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { invited: false, admitted: false }; })
      .then(function (s) {
        if (!s || !s.invited) { renderLocked(); return; }
        if (s.admitted) { renderHub(s.name || ''); return; }
        renderThreshold();
      })
      .catch(function () { renderLocked(); });
  }

  boot();
})();
