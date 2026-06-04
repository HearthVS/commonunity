/* sacred-mode.js · CommonUnity Sacred Mode (beta)
 * ============================================================
 * Sacred Mode is a *changed state* of an existing writing surface —
 * not a separate privacy tool. It is shared verbatim between cOMpass
 * (Session Notes) and stUdio (Field Notes) so the toggle, copy, and
 * controls look and behave identically in both places.
 *
 * Core promise (when Sacred Mode is ON):
 *   - The text is local-only / in-memory. It is NEVER auto-persisted
 *     to the host app's normal notes state, localStorage key, or JSON
 *     export, and is NEVER auto-sent to Nexus / external AI / Golden
 *     Thread / admin endpoints / context bundles.
 *   - The only ways text leaves the chamber are deliberate, user-driven
 *     boundary crossings: "Save as TXT" (browser download) and
 *     "Offer to Nexus" (confirmed, sends only what was offered).
 *   - "Release" deliberately clears the chamber after confirmation.
 *
 * The host app integrates by:
 *   1. Reading SACRED.isActive(surfaceId) before reading a textarea's
 *      value for any normal (non-sacred) persistence / payload path. If
 *      sacred is active for that surface, the host must treat the field
 *      as empty for normal purposes.
 *   2. Calling SACRED.attach(...) once per writing surface to wire the
 *      toggle, chamber treatment, and actions.
 *
 * Design note on persistence: while ON, the sacred text lives only in a
 * closure-scoped buffer (and the live textarea). It is intentionally not
 * written to localStorage or sessionStorage. If the tab is closed or
 * reloaded, unsaved sacred text is gone by design — "held, not offered".
 */
(function (global) {
  'use strict';

  // ── Shared copy. Identical strings in cOMpass and stUdio. Tests assert
  //    both surfaces import these from here so the language can never drift.
  var COPY = {
    TOGGLE_LABEL: 'Sacred Mode',
    TOGGLE_ON_ARIA: 'Sacred Mode is on. Writing is held, not offered.',
    TOGGLE_OFF_ARIA: 'Sacred Mode is off. Notes behave normally.',
    HELD_TAGLINE: 'Sacred Mode · held, not offered',
    LOCAL_ONLY: 'Local-only. Not sent to Nexus or external AI unless you choose to offer it.',
    SAVE_HINT: 'Save as TXT if you choose to keep it.',
    ACTION_SAVE_TXT: 'Save as TXT',
    ACTION_RELEASE: 'Release',
    ACTION_OFFER: 'Offer to Nexus',
    CONFIRM_RELEASE: 'Release this sacred writing? It will be cleared from the field. This cannot be undone.',
    CONFIRM_OFFER_SELECTION: 'Offer the selected text to Nexus? Only the selection will cross the boundary.',
    CONFIRM_OFFER_ALL: 'Offer this sacred writing to Nexus? It will cross the boundary and be sent for reflection.',
    NOTHING_TO_OFFER: 'There is nothing held to offer yet.',
    NOTHING_TO_SAVE: 'There is nothing held to save yet.'
  };

  // Suggested filename for Save as TXT. No name / cipher / gene key — the
  // chamber leaves no identifying trace in the filename.
  function sacredFilename() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var stamp = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
                '-' + p(d.getHours()) + p(d.getMinutes());
    return 'commonunity-sacred-note-' + stamp + '.txt';
  }

  // Per-surface active-state registry. Host apps read this before any
  // normal (non-sacred) read of the surface's textarea.
  var ACTIVE = Object.create(null);

  function isActive(surfaceId) {
    return !!ACTIVE[surfaceId];
  }

  // Trigger a browser download of plain text as a .txt file.
  function downloadTxt(text, filename) {
    try {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || sacredFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick so the click has resolved.
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 0);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Read the user's current selection if it falls inside the textarea,
  // else null. Used by Offer to Nexus to send only the selected text.
  function selectedTextIn(textarea) {
    if (!textarea) return null;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return textarea.value.slice(start, end);
    }
    return null;
  }

  /**
   * Attach Sacred Mode to one writing surface.
   *
   * opts:
   *   surfaceId   {string}  unique id, used by isActive() (e.g. "compass:work", "studio:field-notes")
   *   textarea    {Element} the writing surface textarea
   *   chamberEl   {Element} element that receives the .sacred-chamber-active class (the peripheral container to dim/blur)
   *   toggleEl    {Element} the checkbox/button that turns Sacred Mode on/off
   *   controlsEl  {Element} container into which the action buttons + copy are rendered
   *   onEnter     {fn}      optional, called when entering sacred (host can snapshot/clear normal field)
   *   onExit      {fn}      optional, called when leaving sacred
   *   offerToNexus{fn}      required for Offer; (text) => Promise|void. Host sends ONLY this text to Nexus.
   *   toast       {fn}      optional, (msg) => void for user feedback
   *   confirmFn   {fn}      optional, (msg) => bool. Defaults to window.confirm.
   */
  function attach(opts) {
    opts = opts || {};
    var surfaceId = opts.surfaceId;
    var textarea = opts.textarea;
    var chamberEl = opts.chamberEl || (textarea && textarea.parentElement);
    var toggleEl = opts.toggleEl;
    var controlsEl = opts.controlsEl;
    var confirmFn = opts.confirmFn || function (m) { return global.confirm(m); };
    var toast = opts.toast || function () {};
    if (!surfaceId || !textarea || !toggleEl) return null;

    // The host's normal value, stashed while sacred is active so we can
    // restore the ordinary note when the user leaves Sacred Mode.
    var normalSnapshot = '';
    // The in-memory sacred buffer. Lives only here (and in the live
    // textarea). Never persisted.
    var sacredBuffer = '';

    function renderControls() {
      if (!controlsEl) return;
      controlsEl.innerHTML = '';
      var tagline = document.createElement('p');
      tagline.className = 'sacred-tagline';
      tagline.textContent = COPY.HELD_TAGLINE;
      var local = document.createElement('p');
      local.className = 'sacred-subcopy';
      local.textContent = COPY.LOCAL_ONLY;
      var saveHint = document.createElement('p');
      saveHint.className = 'sacred-subcopy sacred-subcopy-hint';
      saveHint.textContent = COPY.SAVE_HINT;

      var row = document.createElement('div');
      row.className = 'sacred-actions';

      var saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'sacred-action sacred-action-save';
      saveBtn.textContent = COPY.ACTION_SAVE_TXT;
      saveBtn.addEventListener('click', doSaveTxt);

      var offerBtn = document.createElement('button');
      offerBtn.type = 'button';
      offerBtn.className = 'sacred-action sacred-action-offer';
      offerBtn.textContent = COPY.ACTION_OFFER;
      offerBtn.addEventListener('click', doOffer);

      var releaseBtn = document.createElement('button');
      releaseBtn.type = 'button';
      releaseBtn.className = 'sacred-action sacred-action-release';
      releaseBtn.textContent = COPY.ACTION_RELEASE;
      releaseBtn.addEventListener('click', doRelease);

      row.appendChild(saveBtn);
      row.appendChild(offerBtn);
      row.appendChild(releaseBtn);

      controlsEl.appendChild(tagline);
      controlsEl.appendChild(local);
      controlsEl.appendChild(saveHint);
      controlsEl.appendChild(row);
    }

    function currentSacredText() {
      // Live textarea is the source of truth while sacred; mirror to buffer.
      sacredBuffer = textarea.value;
      return sacredBuffer;
    }

    function doSaveTxt() {
      var text = currentSacredText();
      if (!text.trim()) { toast(COPY.NOTHING_TO_SAVE); return; }
      downloadTxt(text, sacredFilename());
    }

    function doRelease() {
      if (!confirmFn(COPY.CONFIRM_RELEASE)) return;
      sacredBuffer = '';
      textarea.value = '';
      textarea.focus();
    }

    function doOffer() {
      var selection = selectedTextIn(textarea);
      var full = currentSacredText();
      var offering = selection != null ? selection : full;
      if (!offering || !offering.trim()) { toast(COPY.NOTHING_TO_OFFER); return; }
      var msg = selection != null ? COPY.CONFIRM_OFFER_SELECTION : COPY.CONFIRM_OFFER_ALL;
      if (!confirmFn(msg)) return;
      // Hand ONLY the offered text to the host. The host must not read the
      // textarea itself for this — it sends exactly what we pass. After
      // offering we do NOT auto-save the sacred text anywhere.
      if (typeof opts.offerToNexus === 'function') {
        opts.offerToNexus(offering);
      }
    }

    function enter() {
      if (ACTIVE[surfaceId]) return;
      ACTIVE[surfaceId] = true;
      // Snapshot + clear the host's normal value so nothing from the
      // ordinary note leaks into the chamber, and the chamber's text never
      // lands in the normal field.
      normalSnapshot = textarea.value;
      if (typeof opts.onEnter === 'function') opts.onEnter(normalSnapshot);
      textarea.value = sacredBuffer;
      if (chamberEl) chamberEl.classList.add('sacred-chamber-active');
      textarea.classList.add('sacred-textarea-active');
      if (controlsEl) controlsEl.hidden = false;
      toggleEl.setAttribute('aria-label', COPY.TOGGLE_ON_ARIA);
      toggleEl.setAttribute('aria-pressed', 'true');
      if ('checked' in toggleEl) toggleEl.checked = true;
      textarea.focus();
    }

    function exit() {
      if (!ACTIVE[surfaceId]) return;
      // Preserve whatever is in the chamber in the in-memory buffer (so
      // toggling off then on again does not lose unsaved sacred text within
      // the same page life) but do NOT persist it anywhere.
      sacredBuffer = textarea.value;
      ACTIVE[surfaceId] = false;
      textarea.value = normalSnapshot;
      if (chamberEl) chamberEl.classList.remove('sacred-chamber-active');
      textarea.classList.remove('sacred-textarea-active');
      if (controlsEl) controlsEl.hidden = true;
      toggleEl.setAttribute('aria-label', COPY.TOGGLE_OFF_ARIA);
      toggleEl.setAttribute('aria-pressed', 'false');
      if ('checked' in toggleEl) toggleEl.checked = false;
      if (typeof opts.onExit === 'function') opts.onExit(normalSnapshot);
    }

    function setActive(on) { on ? enter() : exit(); }

    toggleEl.addEventListener('change', function () {
      if ('checked' in toggleEl) setActive(!!toggleEl.checked);
      else setActive(!ACTIVE[surfaceId]);
    });
    toggleEl.addEventListener('click', function () {
      // For non-checkbox toggles (e.g. <button>), drive from current state.
      if (!('checked' in toggleEl)) setActive(!ACTIVE[surfaceId]);
    });

    renderControls();
    if (controlsEl) controlsEl.hidden = true;
    toggleEl.setAttribute('aria-label', COPY.TOGGLE_OFF_ARIA);
    toggleEl.setAttribute('aria-pressed', 'false');

    return {
      surfaceId: surfaceId,
      enter: enter,
      exit: exit,
      isActive: function () { return isActive(surfaceId); },
      getSacredText: currentSacredText
    };
  }

  global.CommonUnitySacred = {
    COPY: COPY,
    isActive: isActive,
    attach: attach,
    sacredFilename: sacredFilename,
    downloadTxt: downloadTxt
  };
})(typeof window !== 'undefined' ? window : this);
