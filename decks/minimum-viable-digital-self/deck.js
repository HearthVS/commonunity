/* ============================================================
   CommonUnity Philosophy Deck — navigation & modes
   Vanilla JS, no dependencies. Static, no backend.
   ============================================================ */
(function () {
  "use strict";

  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  const deck = document.getElementById("deck");

  const els = {
    curNum: document.getElementById("curNum"),
    totNum: document.getElementById("totNum"),
    progressFill: document.getElementById("progressFill"),
    partLabel: document.getElementById("partLabel"),
    overview: document.getElementById("overview"),
    thumbs: document.getElementById("thumbs"),
    notes: document.getElementById("notes"),
    noteBody: document.getElementById("noteBody"),
    noteTime: document.getElementById("noteTime"),
    help: document.getElementById("help"),
  };

  let index = 0;
  let notesOpen = false;

  els.totNum.textContent = total;

  /* ---------- Extract speaker notes from <template class="note"> ---------- */
  const notesData = slides.map((s) => {
    const tpl = s.querySelector("template.note");
    return {
      html: tpl ? tpl.innerHTML.trim() : "",
      time: s.getAttribute("data-time") || "",
    };
  });

  /* ---------- Core: show a slide ---------- */
  function show(i, updateHash) {
    i = Math.max(0, Math.min(total - 1, i));
    if (slides[index]) slides[index].classList.remove("is-active");
    index = i;
    const slide = slides[index];
    slide.classList.add("is-active");
    slide.scrollTop = 0;

    // chrome
    els.curNum.textContent = index + 1;
    els.progressFill.style.width = ((index + 1) / total) * 100 + "%";
    els.partLabel.textContent = slide.getAttribute("data-part") || "";

    // notes
    els.noteBody.innerHTML = notesData[index].html || "<em>No notes for this slide.</em>";
    els.noteTime.textContent = notesData[index].time ? "Cue " + notesData[index].time : "";

    // overview current marker
    Array.from(els.thumbs.children).forEach((t, ti) =>
      t.classList.toggle("is-current", ti === index)
    );

    if (updateHash !== false) {
      history.replaceState(null, "", "#slide-" + (index + 1));
    }
  }

  function next() { show(index + 1); }
  function prev() { show(index - 1); }

  /* ---------- Deep-link hash ---------- */
  function fromHash() {
    const m = /^#slide-(\d+)$/.exec(location.hash);
    if (m) {
      const n = parseInt(m[1], 10) - 1;
      if (n >= 0 && n < total) return n;
    }
    return 0;
  }
  window.addEventListener("hashchange", () => {
    const n = fromHash();
    if (n !== index) show(n, false);
  });

  /* ---------- Overview / index mode ---------- */
  function buildThumbs() {
    slides.forEach((s, i) => {
      const heading = s.querySelector("h1, h2, .pull, .question, .definition .gloss");
      const title = heading ? heading.textContent.trim().replace(/\s+/g, " ") : "Slide " + (i + 1);
      const part = s.getAttribute("data-part") || "";
      const btn = document.createElement("button");
      btn.className = "thumb";
      btn.setAttribute("aria-label", "Go to slide " + (i + 1) + ": " + title);
      btn.innerHTML =
        '<span class="tn">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="tt">' + title + "</span>" +
        '<span class="tp">' + part + "</span>";
      btn.addEventListener("click", () => {
        closeOverview();
        show(i);
      });
      els.thumbs.appendChild(btn);
    });
  }
  function openOverview() {
    els.overview.classList.add("is-open");
    document.getElementById("btnOverview").classList.add("is-on");
  }
  function closeOverview() {
    els.overview.classList.remove("is-open");
    document.getElementById("btnOverview").classList.remove("is-on");
  }
  function toggleOverview() {
    els.overview.classList.contains("is-open") ? closeOverview() : openOverview();
  }

  /* ---------- Presenter notes drawer ---------- */
  function toggleNotes() {
    notesOpen = !notesOpen;
    els.notes.classList.toggle("is-open", notesOpen);
    document.getElementById("btnNotes").classList.toggle("is-on", notesOpen);
  }

  /* ---------- Help overlay ---------- */
  function toggleHelp() {
    els.help.classList.toggle("is-open");
  }
  function closeHelp() {
    els.help.classList.remove("is-open");
  }

  /* ---------- Keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    const k = e.key;

    // Escape closes overlays first
    if (k === "Escape") {
      if (els.help.classList.contains("is-open")) return closeHelp();
      if (els.overview.classList.contains("is-open")) return closeOverview();
      if (notesOpen) return toggleNotes();
      return;
    }

    // Don't hijack when typing (none here, but safe)
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (k) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); show(0); break;
      case "End":
        e.preventDefault(); show(total - 1); break;
      case "o": case "O":
        e.preventDefault(); toggleOverview(); break;
      case "n": case "N":
        e.preventDefault(); toggleNotes(); break;
      case "?":
        e.preventDefault(); toggleHelp(); break;
      default:
        // number keys 1-9 jump (handy for rehearsal)
        if (/^[1-9]$/.test(k)) { e.preventDefault(); show(parseInt(k, 10) - 1); }
    }
  });

  /* ---------- Buttons ---------- */
  document.getElementById("btnNext").addEventListener("click", next);
  document.getElementById("btnPrev").addEventListener("click", prev);
  document.getElementById("btnOverview").addEventListener("click", toggleOverview);
  document.getElementById("btnCloseOverview").addEventListener("click", closeOverview);
  document.getElementById("btnNotes").addEventListener("click", toggleNotes);
  document.getElementById("btnHelp").addEventListener("click", toggleHelp);
  els.help.addEventListener("click", (e) => { if (e.target === els.help) closeHelp(); });

  /* ---------- Touch swipe ---------- */
  let tsX = 0, tsY = 0, tracking = false;
  deck.addEventListener("touchstart", (e) => {
    tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  deck.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - tsX;
    const dy = e.changedTouches[0].clientY - tsY;
    // horizontal swipe, and not a vertical scroll gesture
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      dx < 0 ? next() : prev();
    }
  }, { passive: true });

  /* ---------- Init ---------- */
  buildThumbs();
  show(fromHash(), false);
  // ensure hash reflects starting slide
  history.replaceState(null, "", "#slide-" + (index + 1));
})();
