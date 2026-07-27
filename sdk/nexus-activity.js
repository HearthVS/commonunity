/* ============================================================
   CommonUnity Nexus activity signal — shared lifecycle
   ------------------------------------------------------------
   Every CommonUnity surface that streams a Nexus response uses
   this, so "Nexus is working" looks and behaves the same
   everywhere instead of being reinvented per app.

     var run = CommonUnityNexusActivity.begin({ field, origin });
     run.firstToken();   // first streamed text arrived
     run.done();         // stream finished
     run.fail(message);  // upstream/network/parse failure

   done() and fail() both land in the same resting state: no
   glow, no mark, no leftover node. That is the point — a glow
   that outlives its request is the failure mode this module
   exists to prevent.

   Only one run may own a field. begin() tears down whatever was
   there first, and a superseded run's methods become no-ops, so
   rapid consecutive sends and cancelled-then-resent requests
   cannot leave two indicators or a stale teardown racing a live
   one.

   Nothing here is visible language. The visible signal is the
   breathing outline plus the existing Nexus mark and its three
   points. Words exist only in an aria-live region for screen
   readers. Motion is CSS and is removed under
   prefers-reduced-motion (see nexus-activity.css).

   This module has no relationship to the microphone's listening
   state. Speech input and model work are different events and
   must stay visually distinguishable.
   ============================================================ */

(function (global) {
  'use strict';

  var FIELD_CLASS = 'nexus-activity-field';
  var WORKING_CLASS = 'is-nexus-working';
  var SETTLING_CLASS = 'is-nexus-settling';
  var MARK_CLASS = 'nexus-activity-mark';
  var STATUS_CLASS = 'nexus-activity-status';

  var STATUS_WORKING = 'Nexus is preparing a response.';
  var STATUS_RESPONDING = 'Nexus is responding.';
  var STATUS_DONE = 'Nexus has finished responding.';
  var STATUS_FAILED = 'Nexus could not complete the response.';

  // The existing Nexus mark: 12-point vector equilibrium, interlocking
  // hexagram, zero point at centre. Same geometry as the stUdio orb and
  // the cOMpass orb glyph, drawn small.
  var GLYPH_SVG =
    '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<circle cx="32" cy="32" r="29" stroke="color-mix(in srgb, var(--nexus-activity-color) 18%, transparent)" stroke-width="1.2"/>' +
    '<g stroke="color-mix(in srgb, var(--nexus-activity-color) 35%, transparent)" stroke-width="1">' +
    '<line x1="32" y1="32" x2="32" y2="4"/><line x1="32" y1="32" x2="46.8" y2="8"/>' +
    '<line x1="32" y1="32" x2="57" y2="20"/><line x1="32" y1="32" x2="60" y2="32"/>' +
    '<line x1="32" y1="32" x2="57" y2="44"/><line x1="32" y1="32" x2="46.8" y2="56"/>' +
    '<line x1="32" y1="32" x2="32" y2="60"/><line x1="32" y1="32" x2="17.2" y2="56"/>' +
    '<line x1="32" y1="32" x2="7" y2="44"/><line x1="32" y1="32" x2="4" y2="32"/>' +
    '<line x1="32" y1="32" x2="7" y2="20"/><line x1="32" y1="32" x2="17.2" y2="8"/></g>' +
    '<g fill="none">' +
    '<polygon points="32,10 52,44 12,44" stroke="color-mix(in srgb, var(--nexus-activity-color) 50%, transparent)" stroke-width="1.2"/>' +
    '<polygon points="32,54 12,20 52,20" stroke="color-mix(in srgb, var(--nexus-activity-color) 50%, transparent)" stroke-width="1.2"/></g>' +
    '<circle cx="32" cy="32" r="10" stroke="color-mix(in srgb, var(--nexus-activity-color) 30%, transparent)" stroke-width="1"/>' +
    '<circle cx="32" cy="32" r="3" fill="var(--nexus-activity-color)" fill-opacity="0.9"/>' +
    '</svg>';

  function resolve(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      try { return document.querySelector(target); } catch (_) { return null; }
    }
    return target;
  }

  function statusNode(field) {
    if (!field) return null;
    var node = field.querySelector('.' + STATUS_CLASS);
    if (!node) {
      node = document.createElement('span');
      node.className = STATUS_CLASS;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
      field.appendChild(node);
    }
    return node;
  }

  function announce(field, text) {
    var node = statusNode(field);
    if (node) node.textContent = text || '';
  }

  function buildMark() {
    var mark = document.createElement('div');
    mark.className = MARK_CLASS;
    mark.setAttribute('aria-hidden', 'true');
    var glyph = document.createElement('span');
    glyph.className = 'nexus-activity-glyph';
    glyph.innerHTML = GLYPH_SVG;
    var points = document.createElement('span');
    points.className = 'nexus-activity-points';
    points.innerHTML = '<i></i><i></i><i></i>';
    mark.appendChild(glyph);
    mark.appendChild(points);
    return mark;
  }

  // Remove every trace of activity from a field, whoever put it there.
  // Safe to call on a field that was never active, and safe to call
  // twice — both are ordinary during teardown and rehydration.
  function reset(target) {
    var field = resolve(target);
    if (!field) return;
    field.classList.remove(WORKING_CLASS, SETTLING_CLASS);
    var marks = field.querySelectorAll('.' + MARK_CLASS);
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].parentNode) marks[i].parentNode.removeChild(marks[i]);
    }
    announce(field, '');
    field.__nexusActivityRun = null;
  }

  function isActive(target) {
    var field = resolve(target);
    return !!(field && field.__nexusActivityRun);
  }

  function begin(options) {
    var opts = options || {};
    var field = resolve(opts.field);
    var origin = resolve(opts.origin) || field;

    // Whatever was running here is over the moment a new request starts.
    reset(field);

    var run = { field: field, mark: null, live: true };

    function owns() {
      return run.live && field && field.__nexusActivityRun === run;
    }

    if (field) {
      field.__nexusActivityRun = run;
      field.classList.add(FIELD_CLASS, WORKING_CLASS);
      announce(field, STATUS_WORKING);
    }
    if (origin) {
      run.mark = buildMark();
      origin.appendChild(run.mark);
      if (opts.scroll !== false) origin.scrollTop = origin.scrollHeight;
    }

    function dropMark() {
      if (run.mark && run.mark.parentNode) run.mark.parentNode.removeChild(run.mark);
      run.mark = null;
    }

    // First streamed text. The mark steps aside and the outline drops to a
    // steady lift so the words are the loudest thing in the panel.
    run.firstToken = function () {
      if (!owns()) return;
      dropMark();
      if (field) {
        field.classList.remove(WORKING_CLASS);
        field.classList.add(SETTLING_CLASS);
        announce(field, STATUS_RESPONDING);
      }
    };

    run.done = function () {
      if (!owns()) { dropMark(); return; }
      dropMark();
      if (field) {
        field.classList.remove(WORKING_CLASS, SETTLING_CLASS);
        announce(field, STATUS_DONE);
        field.__nexusActivityRun = null;
      }
      run.live = false;
    };

    // Errors and cancellations end in exactly the resting state a success
    // ends in. The visible error treatment is the host's own; this module
    // only guarantees it is not sitting underneath a glow.
    run.fail = function (message) {
      if (!owns()) { dropMark(); return; }
      dropMark();
      if (field) {
        field.classList.remove(WORKING_CLASS, SETTLING_CLASS);
        announce(field, message === undefined ? STATUS_FAILED : message);
        field.__nexusActivityRun = null;
      }
      run.live = false;
    };

    // A cancellation is not a failure. Same teardown, nothing announced —
    // the member already knows, they did it.
    run.cancel = function () { run.fail(''); };

    return run;
  }

  global.CommonUnityNexusActivity = {
    begin: begin,
    reset: reset,
    isActive: isActive,
    FIELD_CLASS: FIELD_CLASS,
    WORKING_CLASS: WORKING_CLASS,
    SETTLING_CLASS: SETTLING_CLASS,
    MARK_CLASS: MARK_CLASS,
    STATUS_CLASS: STATUS_CLASS
  };
})(typeof window !== 'undefined' ? window : globalThis);
