// Text size for every page: a small "Aa" control in the top bar with a four-step slider,
// remembered on this device. Without a choice, it follows the iPhone's own text size
// (Dynamic Type), so people who already set bigger text get it here too.
// Self-contained on purpose, so other Joint Idea apps can include it as is: it needs a
// header to sit in (.topbar, or any element given as data-textsize-host) and scales the
// page's content through the --text-scale custom property (see styles.css).
window.TextSize = (() => {
  const STEPS = [1, 1.15, 1.3, 1.5];
  const KEY = 'jointidea-text-size';
  const root = document.documentElement;

  const stored = () => { try { const v = localStorage.getItem(KEY); return v === null ? null : Number(v); } catch { return null; } };
  const store = (i) => { try { localStorage.setItem(KEY, String(i)); } catch { /* storage blocked */ } };

  // The iPhone's text size, read through Safari's system body font (17px at the default size).
  function systemStep() {
    if (!window.CSS || !CSS.supports('font', '-apple-system-body')) return 0;
    const probe = document.createElement('span');
    probe.style.cssText = 'font: -apple-system-body; position: absolute; visibility: hidden';
    document.body.appendChild(probe);
    const scale = parseFloat(getComputedStyle(probe).fontSize) / 17;
    probe.remove();
    let best = 0;
    STEPS.forEach((s, i) => { if (Math.abs(s - scale) < Math.abs(STEPS[best] - scale)) best = i; });
    return best;
  }

  let step = 0;
  function apply(i) {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    root.style.setProperty('--text-scale', STEPS[step]);
    root.classList.toggle('text-scaled', step > 0);
    document.querySelectorAll('.textsize-range').forEach((r) => { r.value = step; r.setAttribute('aria-valuetext', `${Math.round(STEPS[step] * 100)}%`); });
  }

  let button = null, panel = null;
  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  function open() {
    if (!panel) return;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.querySelector('input').focus();
  }

  function mount() {
    const host = document.querySelector('[data-textsize-host]') || document.querySelector('.topbar');
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.className = 'textsize';
    wrap.innerHTML = `
      <button type="button" class="textsize-btn" aria-expanded="false" aria-controls="textsize-panel" aria-label="Text size"><span>A</span><span>a</span></button>
      <div class="textsize-panel" id="textsize-panel" role="dialog" aria-label="Text size" hidden>
        <p class="textsize-label">Text size</p>
        <div class="textsize-row">
          <span class="textsize-a small" aria-hidden="true">A</span>
          <input class="textsize-range" type="range" min="0" max="${STEPS.length - 1}" step="1" aria-label="Text size">
          <span class="textsize-a large" aria-hidden="true">A</span>
        </div>
      </div>`;
    host.appendChild(wrap);
    button = wrap.querySelector('.textsize-btn');
    panel = wrap.querySelector('.textsize-panel');
    button.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden ? open() : close(); });
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.querySelector('input').addEventListener('input', (e) => { apply(Number(e.target.value)); store(step); });
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function start() {
    mount();
    const saved = stored();
    apply(saved === null ? systemStep() : saved);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();

  return { open, set: (i) => { apply(i); store(step); } };
})();
