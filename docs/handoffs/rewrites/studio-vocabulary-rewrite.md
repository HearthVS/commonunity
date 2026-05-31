# Studio Vocabulary Rewrite — Refinements Plan

Status: Draft v0.1 · Refinements draft for revision area 2 (Studio vocabulary). Pairs with the audit on PR #53 and the governance spec on PR #54.

This document is **pause-for-founder-pick**. Every item below shows *before / after candidate(s) / rationale / Charter or Golden-Thread anchor*. No edits to `studio.html` happen until the founder picks per item. Where multiple candidates are offered, the founder selects one (or proposes a fourth). Where a single candidate is offered, the founder confirms or sends back.

Scope: `studio.html` at the repo root. **Out of scope:** `tuner/client/public/studio.html` (sound-healing register stays as-is, by founder instruction).

---

## Working contract recap

- Small PR, one revision area.
- Audit-then-rewrite — audit landed in PR #53, this is the rewrite.
- Each refinement cites a Charter rule or Golden-Thread module.
- Founder picks per item before any HTML edits land.
- Decision-log entry on merge.
- Legacy module / class / id names (e.g. `lp-hero-slot.is-sigil`, `sw-tile.s-lens`, `vibe-pill`) are **not** touched. Only user-facing strings.

---

## Item 1 · Sigil → Cipher (Conflict 10)

**Founder instruction (verbatim, prior session):** *"i prefer for Sigil to not be used - Cipher is the better term for consistency"*

**Charter / Golden-Thread anchor:** OM Cipher module (`docs/foundation/om-cipher.md`) — Cipher is the canonical name for the symbolic key. *Sigil* survives only in legacy CSS / SDK module names.

### Surfaces to change in `studio.html`

User-facing strings only. Class names, ids, SDK calls, code comments untouched.

| # | Line(s) | Current | Proposed |
|---|---------|---------|----------|
| 1.1 | 11152 | "The Compass-sealed pattern your **sigil**, mantra, and field signature are drawn from." | "The Compass-sealed pattern your **Cipher**, mantra, and field signature are drawn from." |
| 1.2 | 11154 | "Open the section to view your **sigil**, gematria source-pattern, Bhramari resonance, and the locked Cipher Foundation inputs." | "Open the section to view your **Cipher**, gematria source-pattern, Bhramari resonance, and the locked Cipher Foundation inputs." |
| 1.3 | 13719 | "They are not primary inputs to the current **sigil** or emergent cipher name" | "They are not primary inputs to the current **Cipher** or emergent cipher name" *(NB: this leaves "emergent cipher name" lowercase — that is the live, evolving descriptor; capital-C Cipher is the seal.)* |
| 1.4 | 13752 | (hidden lede, same as 11152) | Same substitution as 1.1. |
| 1.5 | 13756 | `aria-label="Digital key · sigil"` | `aria-label="Digital key · Cipher"` |
| 1.6 | 13757 | `title="Digital key / sigil — symbolic face of the digital self"` | `title="Digital key / Cipher — symbolic face of the digital self"` |
| 1.7 | 13759 | `<span class="lp-hero-slot-label">Digital key<br>· sigil</span>` | `<span class="lp-hero-slot-label">Digital key<br>· Cipher</span>` |
| 1.8 | 15315 | `aria-label="Personal sigil for [name]"` | `aria-label="Personal Cipher for [name]"` |
| 1.9 | 15328 | SVG text label `"DIGITAL KEY · SIGIL"` | `"DIGITAL KEY · CIPHER"` |
| 1.10 | 16756 | `title="Room sigil — atmospheric face"` | `title="Room Cipher — atmospheric face"` |
| 1.11 | 16812 | `title="Home sigil — symbolic face of the home"` | `title="Home Cipher — symbolic face of the home"` |
| 1.12 | 16814 | `<span class="lp-hero-slot-label">Home<br>sigil</span>` | `<span class="lp-hero-slot-label">Home<br>Cipher</span>` |
| 1.13 | 11564 (`desc`) | "Image upload + **sigil** generation arrive in a later pass." | "Image upload + **Cipher** generation arrive in a later pass." |
| 1.14 | 11567 (`label`) | `'Digital key · sigil'` | `'Digital key · Cipher'` |
| 1.15 | 11568 (`prompt`) | "A symbolic mark — **sigil** or key — that signs your digital self." | "A symbolic mark — **Cipher** or key — that signs your digital self." |
| 1.16 | 11607 (`label`) | `'Home · sigil'` | `'Home · Cipher'` |
| 1.17 | 11608 (`prompt`) | "Symbolic **sigil** for the Personal Home — the mark that signs the threshold." | "Symbolic **Cipher** for the Personal Home — the mark that signs the threshold." |
| 1.18 | 11609 (`desc`) | "Visual identity placeholder. **Sigil** generation arrives later." | "Visual identity placeholder. **Cipher** generation arrives later." |

*Note:* the `id` values (`'digital-key-sigil'`, `'home-sigil'`) and any `aliases` arrays referencing those ids are **not** changed — they are persistence keys that round-trip with exports.

### What stays as *sigil*
- All CSS class names: `.lp-hero-slot.is-sigil`, `.lp-field-imprints-sigil`, `.oc-sigil-stage`, `.oc-sigil-slot`, `.oc-sigil-caption`, `.lp-id-slot.is-sigil`, `.cu-sigil-rendered`.
- All keyframe names: `lp-sigil-pulse`.
- All data-attributes: `data-cu-sigil-handle`, `data-cu-om-cipher-sigil`, `data-cu-om-cipher-sigil-form`, `cu-sigil-salt-layer` (lines 15281, 15386, 16061, 16062).
- All JS variable names: e.g. `var sigil = PH_ROOM_SIGIL[key]…` (line 16711, 16757) — internal binding.
- All JS comments and HTML comments (e.g. lines 4209, 4477, 5966, 5973, 11142, 11440).
- Field-schema IDs: `'digital-key-sigil'`, `'home-sigil'` — persistence keys.
- SDK module name `sdk/sigil.js` (out of scope; not in `studio.html`).

### Candidates
Founder instruction is direct — one candidate (capital-C *Cipher*). Confirm or send back.

---

## Item 2 · Status pills and "Unlocks when…" (Conflict 11)

**Surfaces:**
- Line 11489: `os: ['Locked', 'Unlocked', 'Seeding', 'Active', 'Evolving']` — the canonical status set.
- Line 11651: studio lede ends with *"Unlocks when Living Profile and Personal Home are ready, a project is alive, Field Notes are flowing, and a review rhythm is chosen."*
- Lines 11832, 11841, 11843, 11853: status assignment logic.

### The audit's concern
*Locked / Unlocked* implies a gating model — "the system decides when you can use this." That posture sits in tension with §6 of the Charter (sanctuary clause / no judgement) and the four-layer architecture's consume → live → serve arc (PR #50), which is supposed to be readiness-aware, not gated.

### Candidates

**Candidate A — Keep the words, soften the framing.**
- Pills unchanged: Locked / Unlocked / Seeding / Active / Evolving.
- Line 11651 rephrased: *"Unfolds as Living Profile and Personal Home settle, a project comes alive, Field Notes begin to flow, and a review rhythm finds you."*
- Rationale: keeps the developed status taxonomy in code, replaces the most user-facing "Unlocks when…" sentence with a sensing verb.

**Candidate B — Replace Locked / Unlocked with Resting / Ready.**
- Pills become: Resting / Ready / Seeding / Active / Evolving.
- Line 11651: *"Comes into reach as Living Profile and Personal Home settle, a project comes alive, Field Notes are flowing, and a review rhythm is chosen."*
- Rationale: cleaner with sanctuary clause — nothing is "locked" against the member; some rooms are simply at rest until conditions are met.
- Cost: changes the status taxonomy in code as well as UI. Requires sweep across all five status references.

**Candidate C — Keep Locked / Unlocked but reframe in tooltip / help copy.**
- Pills unchanged.
- Add a one-line tooltip on the pill stack explaining: *"Status reflects readiness, not permission. Every room is yours; some come into focus as the field around them is set."*
- Rationale: minimum surface change, maximum semantic carry.

### Recommended
Candidate B if the developer instinct says the status names are still light-touch in the codebase; Candidate C if the names are now widely referenced. Founder picks.

---

## Item 3 · Lens subtitle (Conflict 13)

**Surface:** Line 7682.

**Current:** `subtitle: 'the way you are here to perceive'`

**Audit concern:** *"the way you are here to perceive"* phrases perception as a destined role. That tilts toward purpose / fate language, which sits in tension with §11.4 of the Charter (avoid claims about a person's path or design).

The audit also notes the same room is described elsewhere in lighter language:
- Line 7387: *"The Lens · interpretation, how you see and the lessons you carry."*
- Line 11461: *"Interpretation · how you see, learn, the lessons you carry."*
- Line 11526 (prompt): *"How you see, learn, interpret. The way your attention moves."*

### Candidates

**Candidate A** — *"interpretation · how you see and what you learn"*
**Candidate B** — *"how attention moves, what it gathers"*
**Candidate C** — *"the way you take in and make sense of things"*

All three replace destiny / role framing with descriptive framing. Founder picks (or proposes a fourth).

**Charter / Golden-Thread anchor:** Charter §11.4 (no path / role claims at conversation level); the existing in-file descriptors at 7387, 11461, 11526 set the descriptive register.

---

## Item 4 · Direction vs Room coherence (Conflict 14)

The four spaces are referred to by **two interchangeable terms** in `studio.html`: *room* (the dominant term, used in nav, tiles, mirror, presets) and *direction* (used in Nexus copy, Notepad copy, Archive copy, and an empty-state).

**Surfaces using *direction*:**
- 8848 — `<p class="archive-empty">No material yet for this direction in your Compass session.</p>`
- 11100 — *"the point where the threads of this direction converge"*
- 11101 — *"the particular direction this room holds"*
- 11103 — *"It speaks from the frequency of this direction"*
- 11117 — *"anything that wants to move through you in this direction"*
- 11166 — *"The Archive holds everything that belongs to this direction"*
- 11168 — *"your relationship with this direction"*

### The audit's concern
Two words for the same thing. Either both are intentional (room = the spatial / atmospheric surface; direction = the orientation it embodies) and should be **named** somewhere, or one should win.

### Candidates

**Candidate A — Rooms only.**
Sweep *direction* → *room* in all seven sites. Internal consistency wins.

**Candidate B — Both, but glossed.**
Keep both. Add one line to the four-layer architecture doc (or the Personal Home overlay) defining: *Rooms are the four spaces; directions are the orientations they embody. The Work is a room; what The Work points toward is its direction.* Then the seven sites above remain valid because they refer to the orientation, not the space.

**Candidate C — Keep both, no gloss, accept as register.**
The double term is part of the texture. *Direction* lands more like atmosphere, *room* lands more like architecture. Founder lets it stand.

### Recommended
Candidate A is cleanest; Candidate B is most accurate to the underlying intention if "direction" is doing real work (it appears to be, in the Nexus copy at 11100–11103). Founder picks.

**Charter / Golden-Thread anchor:** four-layer architecture doc (PR #50) — the four rooms / four directions distinction would belong there if Candidate B is picked.

---

## Item 5 · Carry-forward · "Minimum viable digital self" (from Conflict 6)

**Surface:** Line 11131 — *"Level 1 · Threshold. A minimum viable digital self — the threshold card others meet you through. Drafted locally from your Compass material and Field Notes."*

**Status:** *Authentic digital self* is retained (founder-introduced, holds the "how digital can I be?" question — confirmed in this session). The phrase-level edge is **"minimum viable"** — borrowed from startup vocabulary (MVP), which clashes register with everything around it.

### Candidates

**Candidate A** — *"A first-pass digital self — the threshold card others meet you through."*
**Candidate B** — *"A starting digital self — the threshold card others meet you through."*
**Candidate C** — *"A threshold-level digital self — the card others meet you through."* *(absorbs "threshold card" into the noun)*
**Candidate D** — Leave as-is. *"Minimum viable"* is a recognised shorthand and the section is technical enough to carry it.

Founder picks.

**Charter / Golden-Thread anchor:** Charter §7 (avoid startup register at frame level where it competes with the project's own register). Note: §7 scope clarification (frame vs conversation) is itself flagged for a Charter amendment PR, separate from this rewrite.

---

## Item 6 · Carry-forward · *Trust architecture* cross-surface check (from Conflict 8)

**Status:** *Trust architecture* is retained as founder-introduced (confirmed in this session). The carry-forward question is **cross-surface coherence with PR #52** (Trust messaging rewrite).

### What to verify
1. PR #52 lands a particular phrasing for trust architecture on the public surface.
2. `studio.html` may use the same phrasing, a divergent phrasing, or be silent.

### Action
Before refinements land, do a one-line check in `studio.html`:

```
grep -n "trust architecture" studio.html
```

If present, align with the phrasing chosen in PR #52. If absent, no action.

This is a **pre-commit check**, not an edit. Result reported below before founder picks land.

---

## Item 7 · Conflict 1 · Set Your Vibe — founder decision

**Surfaces:**
- Line 1538 — CSS comment `── Set Your Vibe panel ──`
- Line 6962 — HTML comment `<!-- Set Your Vibe panel -->`
- Line 6966 — visible title attribute `title="About Set Your Vibe"`

**Audit's concern:** *Vibe* is an informal register marker. The panel itself is a serious one — sound preset + colour preset for the room. The audit flagged it as the loudest register clash in the file.

**But:** the founder is sensitive to "language used becoming so flat as to be neutral or boring." *Vibe* is alive, plain, and unintimidating — register-positive in that sense.

### Candidates

**Candidate A — Retain.** *Set Your Vibe* stays. Founder confirms it earns its place.

**Candidate B — Tune the Room.** Aligns with *room* / *Tuner* / *frequency* register. Slightly more formal but stays sensorial.

**Candidate C — Set the Room.** Plainer. Sits closer to *room* as the architectural term.

**Candidate D — Set the Mood.** Closest in feel to *vibe* without using the word.

### Recommended
Founder decision. *Tune the Room* (B) is the most coherent with the rest of the studio register (frequency, tuner, room as architectural unit). *Set Your Vibe* (A) is the warmest. The audit has no preference between them — it only flagged the gap.

**Charter / Golden-Thread anchor:** Charter §7 (register coherence at frame level).

---

## Pre-commit check results (run 28 May 2026)

```
grep -n "trust architecture" studio.html
7378:          own voice. Honesty over performance — this is the trust architecture.
11133:      <p>Nothing here is published. Honesty over performance — this is the trust architecture.</p>
```

Two sites. Both use *trust architecture* as a clause-final term anchored to *honesty over performance*. PR #52 should be checked for matching phrasing before this PR lands; if PR #52 uses a divergent construction, founder decides whether to align studio.html or treat as parallel uses.

```
grep -n "minimum viable" studio.html
11131:      <p>Level 1 · Threshold. A minimum viable digital self — the threshold card others meet you through.</p>
```

One site only — confirmed scope for Item 5.

**Sigil sweep** (user-facing only, filters applied for CSS / data-attrs / comments / IDs):
18 user-facing sites — matches Items 1.1 through 1.18 above. No over- or under-match against the rewrite plan after the schema additions.

---

## Pre-commit checks (run before founder edits land)

```bash
grep -n "trust architecture" studio.html
grep -n "minimum viable" studio.html
grep -niE "\b(sigil)\b" studio.html | grep -viE "is-sigil|sigil-stage|sigil-slot|sigil-caption|lp-sigil|cu-sigil-rendered|sigil-rendered|sigil-engine|sdk/sigil|sigil\.js|//.*sigil|<!--.*sigil"
```

The third line should match the 12 user-facing sigil sites in Item 1, plus or minus the comment / CSS filters. Any over- or under-match needs to be resolved before edits.

---

## After founder picks land

Sequence:

1. Apply edits in `studio.html` per item.
2. Run pre-commit checks again — confirm no remaining mismatch.
3. Add decision-log entry summarising founder picks per item.
4. Commit message: `Studio vocabulary refinements — sigil→Cipher, [other founder picks]`.
5. Push, open PR against `main`.
6. PR body references PR #53 (audit) and PR #54 (governance spec) as the trail.

The Charter amendment PR (Sanskrit exemption §3, §7 scope, §5–§6 frame-vs-conversation, voice-samples §195, glossary entry for *co-emergence*) follows after this PR lands, as a separate small PR.
