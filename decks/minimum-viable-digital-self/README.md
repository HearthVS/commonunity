# CommonUnity — Philosophy Deck v1

**CommonUnity Pitch Doc v1** — the first reusable philosophy deck. Immediate use: Markus Lehto's 45-minute *Unplugged Forum* seminar, 16 July 2026. Later reuse: the philosophical opening of a full pitch deck, and an on-site explainer.

Self-contained static HTML/CSS/JS. No backend, no build step, no framework.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | All 26 slides + chrome (toolbar, nav, overview, notes drawer, help). Slide copy + speaker notes live here. |
| `styles.css` | Design system (twilight palette, type, components) + responsive + `@media print`. |
| `deck.js` | Navigation and modes. Vanilla JS, no dependencies. |
| `assets/` | Canonical CommonUnity logo SVGs (master wordmark, OM mark, favicon) + on-navy variants. |
| `qa/` | Screenshots from visual QA (gitignored). |

## Slide sequence (26 slides, six parts)

- **I · Opening** — 1 Title/landing (both questions + canonical logo) · 2 HEARTH (word-field intro) · 3 Ambient intelligence
- **II · The Condition** — 4 Passive acceptance (Accept button) · 5 Accidental digital selves (ladder) · 6 The Threshold / healthy membrane · 7 Fragmented apps / consolidated power · 8 Internet of content → value · 9 The logic of more · 10 Fake / fragmented self
- **III · Orientation** — 11 Support toward wisdom · 12 Feed or Hearth · 13 Eight limbs / practical unity · 14 How much data is enough · 15 Honest data / trust architecture · 16 Sources of orientation
- **IV · CommonUnity** — 17 Going deeper, not wider · 18 Orientation before onboarding · 19 Speed of trust · 20 Living Expression System
- **V · Practice** — 21 Personal Threshold exercise · 22 Breakout (2 questions) · 23 Synthesis / Q&A
- **VI · Invitation** — 24 Mission · 25 A place in its emergence · 26 Closing (canonical logo)

The two headline questions are exact and must stay verbatim: **"How digital can I become?"** and **"What is my minimum viable digital self?"**

Timing: notes support ~45 min of presentation + a 10–15 min breakout and open Q&amp;A.

## Navigation & features

- **Keyboard**: `←/→`, `Space`, `PgUp/PgDn`, `Home/End`, number keys `1–9` jump, `O` overview, `N` presenter notes, `?` help, `Esc` close overlays.
- **Pointer**: bottom-right prev/next; top-right toolbar (overview, notes, help).
- **Touch**: horizontal swipe to move between slides.
- **Deep links**: each slide is `#slide-N`; hash updates as you navigate and is restored on load.
- **Overview mode** (`O`): grid of all slides with titles/parts; click to jump; current slide highlighted.
- **Presenter notes** (`N`): bottom drawer with per-slide notes + timing cue. **Never shown in audience mode** — notes are stored in a `<template class="note">` inside each slide and only rendered into the drawer on demand.
- **Print** (`Cmd/Ctrl-P` in a real browser): `@media print` lays out **one slide per page**, hides all chrome, and switches to a light print theme.
- **Reduced motion**: `prefers-reduced-motion` disables entrance/atmosphere motion.
- **Responsive**: projector/desktop and mobile (≤720px stacks two-column contrasts; larger touch targets).

## Design world

- Deep twilight / midnight navy background with a fixed radial atmospheric field + faint starfield.
- Warm gold (`--gold #d8b26a`) used sparingly for accent, emphasis, and the peak of the ladder.
- Off-white / soft-gray text. Editorial serif headings (**Zodiak**, Fontshare) + clean sans body (**General Sans**, Fontshare).
- Large negative space, restrained frames/glow. Every visual element encodes meaning — no stock imagery, clip art, decorative cards, or dashboards.
- **Canonical CommonUnity logo** (the repo/manifesto master wordmark: uppercase COMMONUNITY, gold OM emphasis, gold arc + diamond/bindu, Josefin Sans lockup + glow) shown prominently on the title (slide 1) and closing (slide 26). Inlined from `assets/` with its opaque background rect stripped so it sits on the twilight field; **not recreated or re-typeset**. Josefin Sans is loaded from Google Fonts solely for this lockup. Chrome brand uses the authentic gold arc + bindu motif from the same master mark; favicon uses the canonical OM `favicon.svg`.

## Final Opus pass (v1.2 — 26-slide content revision)

A final premium content pass onto the original Opus graphic baseline (commit `e536cee`). The immutable graphic/interaction system — twilight world, Zodiak/General Sans typography, negative space, contrast/ladder/system/prompts primitives, keyboard/touch/overview/notes/hash/print behavior — was preserved. Content was rewritten to the approved 26-slide narrative (`commonunity_final_opus_pass_brief.md`).

Key changes:

- **Title stays slide 1** (both seminar questions + canonical logo + "Markus Lehto · Unplugged Forum · 16 July 2026"); **HEARTH is slide 2.** The title page was never removed.
- **Canonical logo** inlined on slides 1 and 26; generic circular deck mark and invented lowercase wordmark removed.
- **New layout primitives** (reusing the existing design language): `.hearth` word-field constellation (HEARTH/EARTH/HEART/ART/EAR/HEAR/WARMTH/FIRE/SPARK/LIFE/BELONGING), `.ambient-word` atmospheric word, `.accept-btn`/`.accept-scale` (6→9→12h→nearly every waking hour), `.vtable` two-column comparisons, `.fragments` chips, `.flow` orientation sequence, `.morelist` (logic of more), `.limbs` (eight limbs), `.checklist`, `.pathways` (live/build/sustain).
- **Canonical language preserved:** MVDS definition; "We already have digital selves. Most are accidental."; "healthy membrane" (not boundary); Hearth Venture Studio; **stUdio = practical venture builder** (corrected from "visual/Digital Vista"); Feed vs Hearth; "You can only build at the speed of trust"; "Align the inner. Shape the outer."; "Unity cannot be built in isolation." / "Help make unity common."
- **Deferred decisions left as documented, non-broken insertion points** (`.deferred` chip): (1) public Substack URL for "When AI Becomes Air" (slide 3); (2) final participation/contact destination (slide 26). No private/localhost/Railway/QR links; no payment mechanism; provisional CTA wording only.
- **Speaker notes fully rewritten** for ~45 min + breakout/Q&A in the reflective-founder voice; AI framed only as "powerful non-human collaborator"/"mirror"; the digital condition presented as consequence, not moral blame.

QA (baseline-compared): 26 slides, no console errors; no `.slide__inner` overflow at desktop (1440×900) or mobile (390×844); Josefin Sans confirmed loaded (canonical logo renders); overview builds 26 thumbs; notes drawer + keyboard (arrows/Home/End) + counter (=26) functional; print media → slides block/static, chrome hidden, logo present.

## Source-informed revision (v1.1 — superseded by v1.2 above)

The deck was revised against the recovered CommonUnity sourcebook (prior Substack/essay drafts, the voice brief, and the beta living-design contemplation) so it reads as continuous with established thinking rather than freshly invented. The 25-slide structure was preserved. Guiding rule: **integrate selectively and minimally, preferring speaker notes over crowding the slides.**

Decisions made:

- **On-slide copy kept sparse.** Only two on-slide touches: slide 3 now reads “ambient intelligence may *affect* human intelligence even more deeply than social media *affected* attention” (matches the source phrasing); slide 18 lists “profit-seeking extraction” in the Ahimsa refusal (one word, more faithful to the canonical list). Everything else new lives in notes.
- **Speaker notes 11–20 strengthened** with the relational / spiritual / product-governance frame:
  - 11 — AI as *field*, requiring “new disciplines of trust, prompting, pausing, and self-remembering”; the householder-yogi framing.
  - 12 — yoga product governance made explicit: Asana (steady, easeful relationship) / Pranayama (rhythm + pause) / Pratyahara (sacred local-only Private Mode); respect for the user's direct relationship with “Akash, God, or source”; “some truths should remain sacred and undigitized.”
  - 13 — the Hearth's vocabulary of *offering, witnessing, returning* (vs posting/engagement/content).
  - 14–16 — discernment (“what must remain human, local, relational, embodied, or sacred”), “doorways, not self-marketing,” and the *output vs coherence* distinction / non-totalizing self.
  - 17–20 — building as spiritual practice; the full canonical Ahimsa refusal; AI as *mirror and collaborator, never author*; the Living Expression System as helping people “progressively shape a coherent digital home… across fragmented apps” into an “increasingly unified system”; Nexus “ambient rather than dominant.”
- **A few exact prior lines used as anchors** (not a quote collage): “If you do not author your digital expression, others will assemble you from fragments” (slide 3 notes); “from residue, to signal, to authorship, to stewardship” (slide 4 notes); “not everything should be digitized; what is digitized should be coherent” (slide 14 notes); “the difference between output and coherence” (slides 7, 16 notes).
- **“Emotion is signal, not instruction”** placed only where it organically strengthens the practice — the Threshold-question notes (slide 6) — not wedged into a slide.
- **AI framing guardrails honored:** never magic, savior, demon, human, or merely neutral — consistently “a powerful non-human collaborator” / “a mirror.”
- **Fieldprint / sensitive source data:** kept abstract and restrained; no sigil/cipher source material exposed on-slide.

Re-QA'd after revision: 25 slides, no console errors; no overflow at desktop (1440×900) or mobile (390×844); notes drawer scrolls (`overflow-y:auto; max-height:378px`, longest note ~325px); overview / notes / help / arrow nav all functional; print CSS verified (inactive slides → block/static/break-after:page, chrome hidden).

## Conventions for future incremental edits

**Copy remains open to further revision** as the sourcebook evolves. Editing is designed to be low-risk:

1. **Each slide is a self-contained `<section class="slide" id="slide-N">`** with `data-part` (footer part label) and `data-time` (presenter timing cue). To reorder, move the whole `<section>`; counts/overview/hash update automatically from DOM order.
2. **Speaker notes** live in `<template class="note">…</template>` at the end of each slide. Edit them there; they render into the notes drawer and never appear on-slide. Keep the closing `<em>~N min.</em>` timing hint.
3. **On-slide text** is plain HTML inside `.slide__inner`. Use existing helper classes rather than inline styles where possible:
   - `.eyebrow` (gold kicker), `h1`/`h2` (serif headings), `.lead` / `.kicker` / `.body` (sans copy).
   - `.gold` (gold text), `.serif-em` (italic gold serif for key terms).
   - Components: `.contrast` (two-column, needs 3 children: side / `.contrast__divider` / side), `.ladder`, `.tensions`, `.wordlist`, `.grid2` + `.item`, `.definition`, `.system` + `.layer`, `.prompts`, `.steps`, `.pull`, `.beta-line`.
4. **Adding/removing a slide**: copy an existing `<section>`, give it the next `id="slide-N"`, renumber following slides' ids, and keep the `#slide-N` scheme contiguous. The `data-part` string drives the footer label and overview grouping.
5. **Established language to preserve verbatim** (canonical CommonUnity):
   - *minimum viable digital self* = "the smallest coherent digital presence that preserves agency, humanity, and usefulness."
   - "We already have digital selves. Most are accidental."
   - Hearth = belonging, reciprocity, memory, care, mutual presence. Feed = extraction, performance, acceleration, adversarial attention.
   - Support (memory, coordination, pattern) vs. never-substitute (authorship, meaning, consent, relational truth); Private Mode / pratyahara; Ahimsa.
   - Ladder: Data → Profile → Persona → Self. Four functions, Five tests as listed.
   - Architecture (use sparingly): Nexus (continuity), the Lens (verbal), stUdio / Digital Vista (visual), DIGIT (hands/craft), Fieldprint (public homepage); prefer "Living Expression System" over "personal operating system."
   - Final slide: beta invitation, "build together," earned and non-promotional.
6. **No external claims / citations** — this is a philosophy + internal-project deck. Do not introduce facts requiring web sources.

## Local preview

```bash
cd commonunity-pitch-v1
python3 -m http.server 8099
# open http://127.0.0.1:8099/
```

Deployment is handled by the main agent (do not deploy from here).
