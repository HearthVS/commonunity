/* threshold/threshold.js
 *
 * cOMpass onboarding threshold — bolt-on module.
 *
 * Seven-state flow:
 *   1. name-threshold
 *   2. interim-chamber
 *   3. name-essay
 *   4. reflection
 *   5. identity-completion
 *   6. welcome-landing   (soft landing chamber — "Welcome to your cOMpass")
 *   7. prepared-setup    (handed off to /  ?threshold=done&enter=compass)
 *
 * The module owns its own state machine and DOM. The only thing it
 * exposes to the rest of the codebase is the OM Cipher contract,
 * written to localStorage under OmCipherContract.CONTRACT_STORAGE_KEY.
 *
 * This file is intended to be independently updatable. Other apps
 * should not import from it; they should read the contract only.
 */

(function () {
  'use strict';

  const Contract = window.OmCipherContract;
  if (!Contract) {
    console.error('threshold: OmCipherContract not loaded');
    return;
  }

  const ONBOARDING_STEPS = [
    'name-threshold',
    'interim-chamber',
    'name-essay',
    'reflection',
    'identity-completion',
    'welcome-landing',
    'prepared-setup'
  ];

  // Progressive palette intensity per step. Brief: screen 1 neutral,
  // screen 2 subtle, screens 3-4 moderate, screens 5-7 established.
  const PALETTE_STAGE_BY_STEP = {
    'name-threshold': 0,
    'interim-chamber': 1,
    'name-essay': 2,
    'reflection': 2,
    'identity-completion': 3,
    'welcome-landing': 3,
    'prepared-setup': 3
  };

  // ---- Runtime state ------------------------------------------------------

  const state = {
    currentStep: 'name-threshold',
    identity: {
      full_name: '',
      birth_date: '',
      birth_time: '',
      birth_place: ''
    },
    nameNarrative: {
      status: 'idle',  // idle | pending | complete | error
      essay: '',
      generated_at: ''
    },
    palette: {
      status: 'idle',
      primary: '',
      secondary: '',
      seasonal_accent: ''
    }
  };

  // ---- Palette: deterministic MVP fallback --------------------------------
  //
  // Brief: "Use existing OM Cipher palette logic if functional; otherwise
  // add narrow deterministic MVP rules from available identity data."
  //
  // We try sdk/om_cipher.js first (window.OmCipher.generate). If it
  // returns palette colors, use them. Otherwise compute a small
  // deterministic palette from birth_date + name. This provisional path
  // is replaced once Identity Completion gives us full inputs.

  function provisionalPaletteFromIdentity(identity) {
    // Tiny deterministic hash from string.
    function hash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    }
    const seed = (identity.full_name || '') + '|' + (identity.birth_date || '');
    const hueBase = hash(seed) % 360;
    const primary = `oklch(0.62 0.16 ${hueBase})`;
    const secondaryHue = (hueBase + 180) % 360;
    const secondary = `oklch(0.72 0.07 ${secondaryHue})`;
    // Seasonal accent — from birth_date month if available.
    let seasonalHue = (hueBase + 60) % 360;
    if (identity.birth_date) {
      const m = parseInt(identity.birth_date.slice(5, 7), 10);
      if (!Number.isNaN(m)) {
        // Winter ~250, Spring ~120, Summer ~50, Autumn ~25
        const seasonal = [250, 250, 120, 120, 120, 50, 50, 50, 25, 25, 25, 250];
        seasonalHue = seasonal[Math.min(Math.max(m - 1, 0), 11)];
      }
    }
    const seasonal_accent = `oklch(0.74 0.13 ${seasonalHue})`;
    return {
      primary,
      secondary,
      seasonal_accent,
      source: 'threshold_provisional_mvp_v1'
    };
  }

  function tryGenerateOmCipherPalette(identity) {
    // Reuse the local sdk if it's been loaded onto window.
    try {
      if (window.OmCipher && typeof window.OmCipher.generate === 'function') {
        const out = window.OmCipher.generate({
          birth_date: identity.birth_date || '',
          legal_name: identity.full_name || '',
          preferred_name: identity.full_name || '',
          birth_time: identity.birth_time || '',
          birth_place: identity.birth_place ? { label: identity.birth_place } : undefined
        }, {});
        // The sdk returns palette as a 3-element oklch array under
        // out.palette or under out.colors.palette depending on version.
        const palette = (out && out.palette) || (out && out.colors && out.colors.palette);
        if (Array.isArray(palette) && palette.length >= 3) {
          return {
            primary: palette[0],
            secondary: palette[1],
            seasonal_accent: palette[2],
            source: 'om_cipher_v1'
          };
        }
      }
    } catch (e) {
      console.warn('threshold: om_cipher sdk generate failed, falling back', e);
    }
    return null;
  }

  function generatePalette(identity) {
    const real = tryGenerateOmCipherPalette(identity);
    if (real) return real;
    return provisionalPaletteFromIdentity(identity);
  }

  function applyPaletteToDom(palette) {
    if (!palette) return;
    const root = document.documentElement;
    if (palette.primary)         root.style.setProperty('--cipher-primary', palette.primary);
    if (palette.secondary)       root.style.setProperty('--cipher-secondary', palette.secondary);
    if (palette.seasonal_accent) root.style.setProperty('--cipher-accent', palette.seasonal_accent);
  }

  // ---- Essay generation ---------------------------------------------------
  //
  // Reuses the repo's existing /api endpoints by posting to a new,
  // narrow endpoint /api/threshold/name-essay (added in server.py).
  // The endpoint uses the same Anthropic client + model as Inspire /
  // Rose so we get consistent voice quality.
  //
  // If the endpoint is unreachable, we return a respectful fallback
  // essay built from the user's name. This preserves the threshold
  // experience without dead-ending.

  async function requestNameEssay(identity, signal) {
    const res = await fetch('/api/threshold/name-essay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: identity.full_name,
        birth_date: identity.birth_date
      }),
      signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('essay_endpoint_error:' + res.status + ':' + text.slice(0, 200));
    }
    const data = await res.json();
    if (!data || !data.essay) throw new Error('essay_empty_response');
    return data.essay;
  }

  function fallbackEssay(fullName) {
    const name = (fullName || '').trim().split(/\s+/)[0] || 'friend';
    return [
      `There is more in a name than what the world usually asks of it.`,
      ``,
      `${name}, the sound of your name was here before any of the categories that have collected around it. It was spoken before you understood it. It was carried in voices that loved you before you knew what love was, and in voices that called you across rooms when you were too young to answer for yourself. It moved through years of being learned, being mispronounced, being whispered, being sung.`,
      ``,
      `In the ordinary digital day, your name has been pressed down into a tag, a profile, a credential. It has been used to log you in. It has been used to address mail that does not know you. It has been spoken by systems that have never met you. None of that erases what your name actually is — but it can make the older layers harder to hear.`,
      ``,
      `Here, the name is met again. Not as a label, not as a username, but as a small, living thing that has moved alongside you. It has heard the rooms you grew up in. It has heard the work you have tried to do. It has heard the names you have called yourself in private when no one was listening.`,
      ``,
      `What you are arriving with is not only data. It is a vibration that has been carried, refined, and answered to. The threshold you are now crossing is one small place where that vibration is treated with the attention it has always deserved.`,
      ``,
      `Welcome, ${name}. The first reflection is yours.`
    ].join('\n');
  }

  // ---- Rendering ----------------------------------------------------------

  const root = document.getElementById('threshold-root');

  function setPaletteStage(step) {
    const stage = PALETTE_STAGE_BY_STEP[step] || 0;
    root.setAttribute('data-palette-stage', String(stage));
  }

  function go(step) {
    if (!ONBOARDING_STEPS.includes(step)) return;
    state.currentStep = step;
    setPaletteStage(step);
    render();
  }

  function render() {
    switch (state.currentStep) {
      case 'name-threshold':       renderNameThreshold(); break;
      case 'interim-chamber':      renderInterimChamber(); break;
      case 'name-essay':           renderNameEssay(); break;
      case 'reflection':           renderReflection(); break;
      case 'identity-completion':  renderIdentityCompletion(); break;
      case 'welcome-landing':      renderWelcomeLanding(); break;
      case 'prepared-setup':       renderPreparedSetup(); break;
      default: return;
    }
    // Centralized fade-in for every screen transition. The CSS
    // animation .is-entering plays once on each render so the
    // sequence reads as a journey rather than a slideshow. The
    // class is removed after the animation completes so re-renders
    // of the same step (focus/refresh) don't double-fade.
    // prefers-reduced-motion is honoured at the CSS layer.
    try {
      root.classList.remove('is-entering');
      // Force reflow so re-adding the class restarts the animation.
      // eslint-disable-next-line no-unused-expressions
      void root.offsetWidth;
      root.classList.add('is-entering');
      setTimeout(function () {
        try { root.classList.remove('is-entering'); } catch (_) {}
      }, 900);
    } catch (_) {}
  }

  function el(tag, opts, ...children) {
    const node = document.createElement(tag);
    if (opts) {
      for (const k in opts) {
        if (k === 'class') node.className = opts[k];
        else if (k === 'style') node.setAttribute('style', opts[k]);
        else if (k.startsWith('on') && typeof opts[k] === 'function') node.addEventListener(k.slice(2), opts[k]);
        else if (k === 'html') node.innerHTML = opts[k];
        else node.setAttribute(k, opts[k]);
      }
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  // The animated cOMpass logo — a faceted diamond / four-sided pyramid with
  // colored triangular facets and a soft inner glow. Matches the SVG used
  // beside the `cOMpass` wordmark in index.html (logo-mark / compass-logo-sm)
  // so the threshold reads as the same product, not a different surface.
  // Each instance gets a unique ID prefix because multiple may render on the
  // same screen (header chip + theatrical centerpiece).
  let _compassLogoSeq = 0;
  function compassLogoSvg() {
    const u = 'thr-cmp-' + (++_compassLogoSeq);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<defs>' +
        '<radialGradient id="' + u + '-aura" cx="50%" cy="50%" r="50%">' +
          '<stop offset="55%" stop-color="#818cf8" stop-opacity="0"/>' +
          '<stop offset="78%" stop-color="#a5b4fc" stop-opacity="0.18"/>' +
          '<stop offset="100%" stop-color="#c7d2fe" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<radialGradient id="' + u + '-glow" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0%" stop-color="#fef3c7" stop-opacity="0.9"/>' +
          '<stop offset="25%" stop-color="#fde68a" stop-opacity="0.5"/>' +
          '<stop offset="55%" stop-color="#c4b5fd" stop-opacity="0.2"/>' +
          '<stop offset="100%" stop-color="#312e81" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="' + u + '-fold" color-interpolation-filters="sRGB" x="-6%" y="-6%" width="112%" height="112%">' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>' +
          '<feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 28 -12" result="t"/>' +
          '<feComposite in="SourceGraphic" in2="t" operator="atop"/>' +
        '</filter>' +
      '</defs>' +
      '<circle cx="50" cy="50" r="50" fill="url(#' + u + '-aura)"/>' +
      '<g filter="url(#' + u + '-fold)">' +
        '<polygon points="50,5 95,50 5,50 50,43" fill="#b8a878" fill-opacity="0.72"/>' +
        '<polygon points="95,50 50,95 50,5 57,50" fill="#7c8fc4" fill-opacity="0.68"/>' +
        '<polygon points="50,95 5,50 95,50 50,57" fill="#6aaa8c" fill-opacity="0.65"/>' +
        '<polygon points="5,50 50,5 50,95 43,50" fill="#c47c8f" fill-opacity="0.65"/>' +
      '</g>' +
      '<g opacity="0.5">' +
        '<polygon points="50,22 72,43 28,43 50,38" fill="#e8d9a0" fill-opacity="0.45"/>' +
        '<polygon points="72,57 57,72 57,28 62,50" fill="#a8bce0" fill-opacity="0.4"/>' +
        '<polygon points="50,78 28,57 72,57 50,62" fill="#9dd4b4" fill-opacity="0.4"/>' +
        '<polygon points="28,43 43,28 43,72 38,50" fill="#dfa0b0" fill-opacity="0.38"/>' +
      '</g>' +
      '<circle cx="50" cy="50" r="15" fill="url(#' + u + '-glow)"/>' +
      '<circle cx="50" cy="50" r="1.5" fill="#fef9ee" fill-opacity="0.9"/>';
    return svg;
  }

  function brandHeader(label) {
    // Small inline cOMpass logo in the header chip — matches the same logo
    // used beside the `cOMpass` wordmark in the main app. Theatrical use of
    // the same logo is in the interim chamber via `compassMark()` below.
    const mark = el('span', { class: 'mark', 'aria-hidden': 'true' });
    mark.appendChild(compassLogoSvg());
    return el('div', { class: 'threshold-brand' },
      mark,
      el('span', null, label)
    );
  }

  // Large animated cOMpass logo for the interim chamber and the prepared-
  // setup handoff. Wraps the faceted-diamond logo in a soft palette-tinted
  // aura and a thin ring. Breathing motion is in CSS (mark-aura / mark-ring /
  // mark-breathe). Accessible name lives on the wrapper.
  function compassMark() {
    const wrap = el('div', { class: 'compass-mark', role: 'img', 'aria-label': 'cOMpass logo gathering' },
      el('span', { class: 'compass-mark-aura', 'aria-hidden': 'true' }),
      el('span', { class: 'compass-mark-ring', 'aria-hidden': 'true' })
    );
    const svg = compassLogoSvg();
    svg.setAttribute('class', 'compass-mark-svg');
    wrap.appendChild(svg);
    return wrap;
  }

  // ---- Screen 1: Name Threshold ------------------------------------------

  function renderNameThreshold() {
    root.innerHTML = '';
    // Practical screen — left-aligned, but framed by the field rather than
    // a hard modal card.
    const card = el('div', { class: 'threshold-card is-practical' });

    card.appendChild(brandHeader('cOMpass · Threshold'));
    card.appendChild(el('h1', { class: 'threshold-title' }, 'Before anything is asked of you, begin here.'));
    card.appendChild(el('p', { class: 'threshold-line' }, 'Begin with the name that has carried you here.'));

    const nameField = el('div', { class: 'threshold-field' },
      el('label', { for: 'th-full-name' }, 'Full name'),
      el('input', { id: 'th-full-name', type: 'text', autocomplete: 'name', value: state.identity.full_name })
    );
    const dateField = el('div', { class: 'threshold-field' },
      el('label', { for: 'th-birth-date' }, 'Birth date'),
      el('input', { id: 'th-birth-date', type: 'date', value: state.identity.birth_date })
    );
    card.appendChild(nameField);
    card.appendChild(dateField);

    card.appendChild(el('p', { class: 'threshold-helper' }, 'Your name and birth date are enough to begin.'));

    const errBox = el('div', { class: 'threshold-error', id: 'th-err' });
    card.appendChild(errBox);

    const beginBtn = el('button', { class: 'threshold-btn threshold-btn-primary' }, 'Begin');
    beginBtn.addEventListener('click', () => onSubmitName(errBox));

    card.appendChild(el('div', { class: 'threshold-actions' }, beginBtn));

    root.appendChild(card);

    // Focus first field for usability.
    setTimeout(() => document.getElementById('th-full-name').focus(), 0);
  }

  function onSubmitName(errBox) {
    const fullName = document.getElementById('th-full-name').value.trim();
    const birthDate = document.getElementById('th-birth-date').value.trim();
    if (!fullName) { errBox.textContent = 'Your full name is needed to begin.'; return; }
    if (!birthDate || isNaN(Date.parse(birthDate))) { errBox.textContent = 'A valid birth date is needed.'; return; }

    state.identity.full_name = fullName;
    state.identity.birth_date = birthDate;

    // Persist draft state so a refresh during the chamber doesn't lose
    // entered data. Draft uses a separate key from the final contract.
    persistDraft();

    // Kick off essay generation asynchronously. Move to chamber now.
    startEssayGeneration();

    // Provisional palette so the chamber already has subtle hints.
    state.palette.status = 'pending';
    const palette = generatePalette(state.identity);
    state.palette.primary = palette.primary;
    state.palette.secondary = palette.secondary;
    state.palette.seasonal_accent = palette.seasonal_accent;
    state.palette.status = 'complete';
    applyPaletteToDom(palette);

    go('interim-chamber');
  }

  // ---- Screen 2: Interim Chamber -----------------------------------------

  let essayController = null;
  let essayPromise = null;

  function startEssayGeneration() {
    if (essayController) essayController.abort();
    essayController = new AbortController();
    state.nameNarrative.status = 'pending';
    essayPromise = (async () => {
      try {
        const essay = await requestNameEssay(state.identity, essayController.signal);
        state.nameNarrative.essay = essay;
        state.nameNarrative.status = 'complete';
        state.nameNarrative.generated_at = new Date().toISOString();
        persistDraft();
        // If we're still in the chamber, advance.
        if (state.currentStep === 'interim-chamber') go('name-essay');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        console.warn('threshold: name essay generation failed', e);
        state.nameNarrative.status = 'error';
        // Update chamber UI to show fallback option.
        renderChamberFallback();
      }
    })();
  }

  function renderInterimChamber() {
    root.innerHTML = '';
    // Ceremonial screen — chamber drops most card chrome and becomes the
    // most theatrical moment in the flow: centered, spacious, mark-centered.
    const card = el('div', { class: 'threshold-card is-chamber chamber' });

    card.appendChild(brandHeader('cOMpass · Threshold'));

    // The animated cOMpass logo sits at the heart of the chamber.
    card.appendChild(compassMark());

    const firstName = (state.identity.full_name || '').trim().split(/\s+/)[0] || '';
    if (firstName) {
      card.appendChild(el('div', { class: 'chamber-eyebrow' }, 'A field gathers around'));
      card.appendChild(el('div', { class: 'chamber-name' }, firstName));
    }
    card.appendChild(el('p', { class: 'chamber-line' }, 'A first thread is being gathered. While this moment gathers itself around you, there is nothing to do here but remain.'));

    // Refined loading state — three slow breathing dots, palette-tinted.
    card.appendChild(el('div', { class: 'chamber-status', 'aria-hidden': 'true' },
      el('span', { class: 'dot' }),
      el('span', { class: 'dot' }),
      el('span', { class: 'dot' })
    ));

    const fallbackZone = el('div', { id: 'th-chamber-fallback' });
    card.appendChild(fallbackZone);

    root.appendChild(card);

    // If essay was already complete when we arrived (rare but possible),
    // advance immediately.
    if (state.nameNarrative.status === 'complete') {
      setTimeout(() => { if (state.currentStep === 'interim-chamber') go('name-essay'); }, 400);
    }

    // After ~25s, expose a polite "continue" path so a long generation
    // never traps the user.
    setTimeout(() => {
      if (state.currentStep !== 'interim-chamber') return;
      if (state.nameNarrative.status === 'complete') return;
      renderChamberSlowHint();
    }, 25000);
  }

  function renderChamberSlowHint() {
    const zone = document.getElementById('th-chamber-fallback');
    if (!zone) return;
    zone.innerHTML = '';
    zone.appendChild(el('p', { class: 'chamber-fallback' }, 'This first reflection is taking a little longer to arrive. Stay here a moment longer, or continue when ready.'));
    const continueBtn = el('button', { class: 'threshold-btn threshold-btn-ghost' }, 'Continue');
    continueBtn.addEventListener('click', () => {
      // Use fallback essay so the asset still exists.
      if (state.nameNarrative.status !== 'complete') {
        state.nameNarrative.essay = fallbackEssay(state.identity.full_name);
        state.nameNarrative.status = 'complete';
        state.nameNarrative.generated_at = new Date().toISOString();
        persistDraft();
      }
      go('name-essay');
    });
    zone.appendChild(el('div', { class: 'threshold-actions', style: 'justify-content:center' }, continueBtn));
  }

  function renderChamberFallback() {
    if (state.currentStep !== 'interim-chamber') return;
    const zone = document.getElementById('th-chamber-fallback');
    if (!zone) return;
    zone.innerHTML = '';
    zone.appendChild(el('p', { class: 'chamber-fallback' }, 'This first reflection is taking a little longer to arrive. You can try again, or continue with a gentle stand-in.'));
    const retryBtn = el('button', { class: 'threshold-btn threshold-btn-ghost' }, 'Try again');
    const continueBtn = el('button', { class: 'threshold-btn threshold-btn-primary' }, 'Continue');
    retryBtn.addEventListener('click', () => { startEssayGeneration(); zone.innerHTML = ''; });
    continueBtn.addEventListener('click', () => {
      state.nameNarrative.essay = fallbackEssay(state.identity.full_name);
      state.nameNarrative.status = 'complete';
      state.nameNarrative.generated_at = new Date().toISOString();
      persistDraft();
      go('name-essay');
    });
    zone.appendChild(el('div', { class: 'threshold-actions' }, retryBtn, continueBtn));
  }

  // ---- Screen 3: Story of Your Name --------------------------------------

  function renderNameEssay() {
    root.innerHTML = '';
    // Hybrid screen — chamber present but quieter; reading-oriented.
    const card = el('div', { class: 'threshold-card is-hybrid', style: 'position:relative;' });

    card.appendChild(brandHeader('cOMpass · Threshold'));
    // A quiet cOMpass logo in the corner anchors the story to the field.
    const essayMark = el('span', { class: 'essay-mark', 'aria-hidden': 'true' });
    essayMark.appendChild(compassLogoSvg());
    card.appendChild(essayMark);
    card.appendChild(el('h1', { class: 'essay-heading' }, 'The story of your name'));
    card.appendChild(el('p', { class: 'essay-subline' }, 'A first reflection'));

    const body = el('div', { class: 'essay-body' });
    const paragraphs = (state.nameNarrative.essay || '').split(/\n\s*\n/);
    for (const p of paragraphs) {
      if (!p.trim()) continue;
      body.appendChild(el('p', null, p.trim()));
    }
    card.appendChild(body);

    const next = el('button', { class: 'threshold-btn threshold-btn-primary' }, 'Continue');
    next.addEventListener('click', () => go('reflection'));
    card.appendChild(el('div', { class: 'threshold-actions' }, next));

    root.appendChild(card);
  }

  // ---- Screen 4: Reflection ----------------------------------------------

  const REFLECTION_QUESTIONS = [
    'What in your name feels inherited?',
    'What in it feels chosen?',
    'When have you felt most at home inside it?',
    'What has your name carried for you?',
    'What might it be asking of you now?'
  ];

  function renderReflection() {
    root.innerHTML = '';
    // Hybrid — contemplative spacing; prompts feel held, not surveyed.
    const card = el('div', { class: 'threshold-card is-hybrid' });

    card.appendChild(brandHeader('cOMpass · Threshold'));
    card.appendChild(el('h1', { class: 'reflection-heading' }, 'A few questions to carry'));

    const list = el('ul', { class: 'reflection-list' });
    for (const q of REFLECTION_QUESTIONS) {
      list.appendChild(el('li', null, q));
    }
    card.appendChild(list);

    const next = el('button', { class: 'threshold-btn threshold-btn-primary' }, 'Continue');
    next.addEventListener('click', () => go('identity-completion'));
    card.appendChild(el('div', { class: 'threshold-actions' }, next));

    root.appendChild(card);
  }

  // ---- Screen 5: Identity Completion -------------------------------------

  function renderIdentityCompletion() {
    root.innerHTML = '';
    // Practical, left-aligned — palette is well established by this stage.
    const card = el('div', { class: 'threshold-card is-practical' });

    card.appendChild(brandHeader('cOMpass · Threshold'));
    card.appendChild(el('h1', { class: 'threshold-title' }, 'Complete your orientation'));
    card.appendChild(el('p', { class: 'threshold-line' }, 'A little more precision helps the pattern come into focus.'));

    const timeField = el('div', { class: 'threshold-field' },
      el('label', { for: 'th-birth-time' }, 'Time of birth'),
      el('input', { id: 'th-birth-time', type: 'time', value: state.identity.birth_time })
    );
    const placeField = el('div', { class: 'threshold-field' },
      el('label', { for: 'th-birth-place' }, 'Place of birth'),
      el('input', { id: 'th-birth-place', type: 'text', placeholder: 'City, Country…', value: state.identity.birth_place })
    );
    card.appendChild(timeField);
    card.appendChild(placeField);

    card.appendChild(el('p', { class: 'threshold-helper' }, 'These details help refine the field that is being prepared for you.'));

    const errBox = el('div', { class: 'threshold-error', id: 'th-err2' });
    card.appendChild(errBox);

    const next = el('button', { class: 'threshold-btn threshold-btn-primary' }, 'Continue');
    next.addEventListener('click', () => onCompleteIdentity(errBox));
    card.appendChild(el('div', { class: 'threshold-actions' }, next));

    root.appendChild(card);
  }

  function onCompleteIdentity(errBox) {
    const t = document.getElementById('th-birth-time').value.trim();
    const p = document.getElementById('th-birth-place').value.trim();
    // Both optional per the brief — but recommended. Don't block.
    state.identity.birth_time = t;
    state.identity.birth_place = p;

    // Finalize palette now that we have full identity.
    const palette = generatePalette(state.identity);
    state.palette.primary = palette.primary;
    state.palette.secondary = palette.secondary;
    state.palette.seasonal_accent = palette.seasonal_accent;
    state.palette.status = 'complete';
    applyPaletteToDom(palette);

    // Write the final contract + complete flag.
    writeContract();

    // Move into the soft landing chamber. The handoff to cOMpass
    // happens after the welcome has been seen — never directly from
    // the identity form, so the user does not flash through the old
    // setup surface.
    go('welcome-landing');
  }

  // ---- Screen 6: Welcome Landing -----------------------------------------
  //
  // A soft landing chamber between identity completion and the cOMpass
  // companion view. Not a form, not the legacy setup page. The page
  // greets the person by their given name, holds them for a breath,
  // then fades into cOMpass. If the user prefers reduced motion, the
  // page does not auto-advance — they continue explicitly.

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) { return false; }
  }

  function welcomeStatement(firstName) {
    // A short reflective sentence linking name / digital self /
    // journey ahead. Tone: calm, intimate, restrained. We compose
    // from a few small variants so it does not read as boilerplate,
    // keyed deterministically off the name so it is stable per user.
    const name = (firstName || '').trim();
    const variants = name ? [
      `${name}, the field already knows the sound of your name. What you carry from here is yours to unfold.`,
      `${name}, this is the inside of your cOMpass. The journey ahead is met by the name you arrived with.`,
      `${name}, the threshold closes softly behind you. From here, your digital self walks at the pace of your own breath.`,
      `${name}, you are inside now. The compass turns with you — name, self, and journey held in the same field.`
    ] : [
      `The field already knows the sound of your name. What you carry from here is yours to unfold.`,
      `This is the inside of your cOMpass. The journey ahead is met by the self you arrived with.`,
      `The threshold closes softly behind you. From here, your digital self walks at the pace of your own breath.`
    ];
    // Stable per-user choice.
    let h = 0;
    for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0; }
    const idx = Math.abs(h) % variants.length;
    return variants[idx];
  }

  function renderWelcomeLanding() {
    root.innerHTML = '';
    const card = el('div', { class: 'threshold-card is-chamber is-welcome-landing' });

    card.appendChild(brandHeader('cOMpass · Threshold'));
    card.appendChild(compassMark());

    const firstName = (state.identity.full_name || '').trim().split(/\s+/)[0] || '';

    card.appendChild(el('h1', { class: 'welcome-title' }, 'Welcome to your cOMpass'));
    card.appendChild(el('p', { class: 'welcome-statement' }, welcomeStatement(firstName)));

    const reduced = prefersReducedMotion();

    // Accessible status line for assistive tech. The screen is
    // user-driven now — no timer — so the hint invites the press
    // rather than warning of an imminent transition.
    card.appendChild(el('p', { class: 'welcome-hint', role: 'status', 'aria-live': 'polite' },
      'Continue when you are ready.'
    ));

    // Explicit continue is the ONLY way forward — no auto-advance.
    // The user reads at their own pace; the threshold closes when
    // they choose. Clicking begins the fade-then-handoff (a clean
    // navigation under reduced motion).
    const enterBtn = el('button', {
      class: 'threshold-btn threshold-btn-ghost welcome-enter',
      type: 'button',
      'aria-label': 'Enter cOMpass'
    }, 'Enter cOMpass');
    enterBtn.addEventListener('click', () => beginWelcomeHandoff(reduced));
    card.appendChild(el('div', { class: 'threshold-actions', style: 'justify-content:center' }, enterBtn));

    root.appendChild(card);

    // Focus the continue button so keyboard users land on it
    // immediately and can press Enter/Space without a tab pass.
    try { setTimeout(function () { enterBtn.focus(); }, 0); } catch (_) {}
  }

  let _welcomeHandoffStarted = false;
  function beginWelcomeHandoff(reduced) {
    if (_welcomeHandoffStarted) return;
    if (state.currentStep !== 'welcome-landing') return;
    _welcomeHandoffStarted = true;
    const FADE_MS = reduced ? 350 : 1300;
    root.classList.add('is-fading-out');
    setTimeout(() => { handoffToCompass(); }, FADE_MS);
  }

  // ---- Screen 7: Prepared Setup (handoff) --------------------------------
  //
  // We do not re-implement the existing Compass setup page. We hand off
  // by navigating to '/?threshold=done', and index.html consumes the
  // OM Cipher contract on load.

  function renderPreparedSetup() {
    // Defensive — we usually navigate before reaching this render.
    // Ceremonial like the chamber; the mark holds the moment.
    root.innerHTML = '';
    const card = el('div', { class: 'threshold-card is-chamber' });
    card.appendChild(brandHeader('cOMpass · Threshold'));
    card.appendChild(compassMark());
    card.appendChild(el('h1', { class: 'threshold-title' }, 'Your field is being prepared.'));
    card.appendChild(el('p', { class: 'threshold-line' }, 'A moment, while your cOMpass opens.'));
    root.appendChild(card);
    handoffToCompass();
  }

  // The threshold collects the companion's (subject's) identity, not the
  // guide's. The legacy setup page is the guide/facilitator entry surface
  // (transcript import, manual session setup). The companion has nothing
  // further to fill in, so hand off directly into the companion cOMpass
  // view via enter=compass — index.html's contract hydration + auto-open
  // consumes the flag.
  function handoffToCompass() {
    setTimeout(() => { window.location.href = '/?threshold=done&enter=compass'; }, 250);
  }

  // ---- Persistence --------------------------------------------------------

  const DRAFT_KEY = 'commonunity_threshold_draft_v1';

  function persistDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        currentStep: state.currentStep,
        identity: state.identity,
        nameNarrative: state.nameNarrative,
        palette: state.palette
      }));
    } catch (_) {}
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !d.identity) return false;
      Object.assign(state.identity, d.identity);
      if (d.nameNarrative) Object.assign(state.nameNarrative, d.nameNarrative);
      if (d.palette) Object.assign(state.palette, d.palette);
      return true;
    } catch (_) { return false; }
  }

  function clearDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function writeContract() {
    const contract = Contract.emptyContract();
    contract.identity.full_name   = state.identity.full_name;
    contract.identity.birth_date  = state.identity.birth_date;
    contract.identity.birth_time  = state.identity.birth_time;
    contract.identity.birth_place = state.identity.birth_place;
    contract.name_narrative.essay         = state.nameNarrative.essay;
    contract.name_narrative.generated_at  = state.nameNarrative.generated_at || new Date().toISOString();
    contract.name_narrative.version       = 1;
    contract.name_narrative.source        = 'onboarding_threshold';
    contract.om_cipher.palette.primary         = state.palette.primary;
    contract.om_cipher.palette.secondary       = state.palette.secondary;
    contract.om_cipher.palette.seasonal_accent = state.palette.seasonal_accent;
    contract.om_cipher.palette.version         = 1;
    contract.om_cipher.palette.schema_version  = Contract.PALETTE_SCHEMA_VERSION;
    contract.om_cipher.palette.source          = Contract.PALETTE_SOURCE_CURRENT;
    contract.om_cipher.palette.generated_by    = 'onboarding_threshold';
    contract.threshold.completed     = true;
    contract.threshold.completed_at  = new Date().toISOString();
    contract.threshold.version       = 1;
    contract.threshold.source        = 'onboarding_threshold_v2';
    Contract.write(contract);
    clearDraft();
  }

  // ---- Boot ---------------------------------------------------------------

  function boot() {
    // If the contract already exists and threshold is done, allow replay
    // by passing ?replay=1 — otherwise bounce to Compass.
    const params = new URLSearchParams(window.location.search);
    if (Contract.isThresholdCompleted() && params.get('replay') !== '1') {
      window.location.replace('/');
      return;
    }
    loadDraft();
    setPaletteStage(state.currentStep);
    // Apply any existing palette draft so visuals are continuous.
    if (state.palette.primary) {
      applyPaletteToDom({
        primary: state.palette.primary,
        secondary: state.palette.secondary,
        seasonal_accent: state.palette.seasonal_accent
      });
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
