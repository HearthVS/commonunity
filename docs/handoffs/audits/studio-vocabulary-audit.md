# Studio Vocabulary Audit — Revision Area 2

Status: v0.1. Audit only. **No rewrite in this document.** The rewrite is a separate, later step.

This audit is the second of six revision passes against the Golden Thread framework (see [`../../foundation/om-field-golden-thread.md`](../../foundation/om-field-golden-thread.md), [`../../foundation/nexus-guidance-charter.md`](../../foundation/nexus-guidance-charter.md), and [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md)). It surfaces, with line numbers and rule citations, where the current Studio member-facing vocabulary conflicts with the Charter, the four Golden Thread modules, and the four-layer architecture.

For the working pattern, see the trust messaging audit ([`./trust-messaging-audit.md`](./trust-messaging-audit.md)) and its rewrite ([`../rewrites/trust-messaging-rewrite.md`](../rewrites/trust-messaging-rewrite.md)). Patterns and frames named there are not re-derived here — they are referenced.

---

## 1. Where Studio vocabulary lives

Member-facing Studio vocabulary is concentrated in `studio.html`. Density is uneven; six surfaces carry most of the trust-and-tone-shaping language:

| Surface | Role | Density |
| --- | --- | --- |
| Entrance subtitle and Studio Path trail (~L6747–6783) | Public-facing greeting, three-level framing | High. Identity and arc claims sit here first. |
| Entrance seed panel (~L6786–6845) | Compass calculator and "Activate my profile" CTA | Medium. Activation verb is the issue. |
| Room screen — `vibe-panel`, `Set Your Vibe` (~L6963–7136) | Sound + Colour environmental controls | High. *Vibe*, *Sacred Tones*, frequency tooltips, ON AIR pill. |
| Room screen — Field Notes + The Nexus (~L7165–7298) | Primary writing surface and assistant panel | Mostly clean. *"This space is yours"* is a tonal anchor. |
| Studio Path / Living Profile / Personal Home / Studio Window modals (~L7358–7517) | Three-level builder framing and previews | High. *Authentic digital self*, *co-emerge*, *trust architecture* echo trust-messaging conflicts. |
| Info popups overlay set (~L11077–11172) | Didactic in-app explainers for each surface | High. *Sacred*, *frequency*, *sigil*, *gematria*, *minimum viable digital self*. (*Chakra* appears here too but is retained — see Conflict 4.) |
| `BUILDER_STANDARD` ledes and field prompts (~L11485–11727) | The L1/L2/L3 builder spec, surfaced through the Studio Path readiness modal | High. *Authentic self-representation*, *co-emerge with AI*, *Unlocks when…*, *frequency you transmit*. |

Two surfaces are not in scope here even though they share the *Studio* name:

- **`tuner/client/public/studio.html`** appears to be a deployed snapshot of an older Studio (different version meta; differs from the root `studio.html`). It carries some of the same strings. Auditing it requires first deciding whether it is the same surface or a parallel — that decision is logged for follow-up rather than re-litigated here.
- **`docs/product/studio.md`** is an internal product stub, not member-facing. Its language (*"manifest Unity in practice"*) is flagged for completeness in §5 below but is not in scope for the rewrite.

---

## 2. Strings inventory

The full list of vocabulary-shaping strings currently shown to members in `studio.html`. Line numbers refer to the canonical file at the head of the `audit-studio-vocabulary` branch.

### Entrance

| Line | String | Surface role |
| --- | --- | --- |
| 6747 | "Studio is where your *Compass* becomes form." | Subtitle below wordmark |
| 6752 | "Studio Path · three levels" | Trail eyebrow |
| 6756 | "Living Profile — your real-time presence, calling card, and Studio doorway." | L1 trail line |
| 6760 | "Personal Home — your four-room bridge to the wider web (Work · Lens · Field · Call)." | L2 trail line |
| 6764 | "Personal OS — your inner studio for becoming, creating, and co-emerging with AI." | L3 trail line |
| 6767–6781 | "Open Studio Path / Preview Living Profile / Preview Personal Home / Edit Studio Window" | Trail CTAs |
| 6795 | "What shall I call you?" | Name field placeholder |
| 6801 | "When did you take your first breath?" | Birthdate toggle |
| 6819 | "Activate my profile" | Calculator submit button |
| 6822–6839 | "Life's Work / Evolution / Radiance / Purpose" + "The Work / Lens / Field / Call" | Gene Keys result labels |
| 6849 | "Choose your room" | Room chooser label |

### Room screen — header

| Line | String | Surface role |
| --- | --- | --- |
| 6948 | "ON AIR" + timer | Session pill |
| 6954 | "Choose Your Room" | Room selector frame label |
| 6956–6959 | "The Work / The Lens / The Field / The Call" | Room pills |
| 6965 | "Set Your Vibe" | Environmental panel title |
| 7006 | "Sacred Tones" | Sound dropdown section |
| 7008 | "111 Hz — cell regeneration, endorphins" | Sound preset tooltip |
| 7009 | "528 Hz — love frequency, DNA repair" | Sound preset tooltip |
| 7017 | "Planetary Octave · Planetware" | Sound dropdown section |
| 7019–7025 | "Earth Day · Root chakra / Moon synodic · Sacral / Sun · Solar Plexus / Earth Year / Om · Heart / Mercury · Throat / Venus · Third Eye / Platonic Year · Crown" | Planetary tooltips with chakra mapping |
| 7033 | "Binaural Beats" | Sound dropdown section |
| 7035–7040 | "Delta · Deep sleep / Theta · Meditation / Alpha · Relaxed focus / Beta · Alert / Gamma · Peak / Schumann · Earth resonance" | Brainwave preset tooltips |

### Room screen — body

| Line | String | Surface role |
| --- | --- | --- |
| 7145 | "Archive" | Left panel header |
| 7170 | "Field Notes" | Centre panel header |
| 7181 | "Write freely. Reflections, questions, fragments, intentions. This space is yours. / Or — Save to Field Notes is the Save button above. Saved Field Notes become available to Nexus." | Notepad placeholder |
| 7183 | "Saved. This Field Note is now available to Nexus for reflection, and for shaping your Living Profile, Personal Home, and Personal OS." | Save confirmation |
| 7212 | "The Nexus" | Right panel header |
| 7274 | "hold the centre to open" | Orb hint |
| 7278 | "what nexus knows ▾" | Memory toggle |
| 7285 | "The Nexus is present. When you are ready, knock." | Mirror intro |
| 7291 | "enter the nexus…" | Mirror input placeholder |

### Modals — Studio Path, Living Profile, Personal Home, Studio Window

| Line | String | Surface role |
| --- | --- | --- |
| 7368 | "Studio Path · v0.2" | Eyebrow |
| 7369 | "Three levels of *your authentic digital self.*" | Modal title |
| 7370–7378 | Lede: "Studio builds three things, in order — Living Profile…, then Personal Home…, then Personal OS…You feed them by working in the four rooms…Honesty over performance — this is the trust architecture." | Studio Path lede |
| 7385–7389 | "Four streams feed three levels — a deepening sequence. The Work · surface, what you do now. The Lens · interpretation, how you see and the lessons you carry. The Field · radiance, communities you thrive with. The Call · essence, what is asking and how others can support." | Studio Path footnote |
| 7408 | "Living *Profile*" | Living Profile modal title |
| 7415–7416 | "Drafted locally from Compass import + Field Notes captures. The doorway into your wider Personal Home — that is Level 2." | Living Profile footnote |
| 7473 | "Personal Home · v0.3 · Level 2 · Preview only, not published" | Personal Home eyebrow |
| 7474 | "Compass points you *home.*" | Personal Home modal title |
| 7476–7477 | "Your digital home, built around The Work, The Lens, The Field, and The Call. Step across the threshold; choose a room to enter." | Personal Home lede |
| 7484–7485 | "Drafted locally from Compass import + Field Notes captures. Preview only — nothing published." | Personal Home footnote |
| 7501 | "Studio Window · v0.1 · shopfront" | Studio Window eyebrow |
| 7502 | "A glimpse *through the studio window.*" | Studio Window modal title |
| 7503–7507 | "Up to four still images, each tagged to one of your four rooms. If this picture were hanging on the wall of a real home — which room does it belong in?" | Studio Window lede |
| 7524–7525 | "Import Compass Session / Upload a Compass session JSON file to seed your Studio rooms with your existing material — notes, insights, Gene Keys, and Q&A responses." | Import modal copy |

### Per-room subtitles (`ROOM_META`)

| Line | String | Surface role |
| --- | --- | --- |
| 7681 | The Work — "the work that finds you" — Life's Work | Room subtitle |
| 7682 | The Lens — "the way you are here to perceive" — Evolution | Room subtitle |
| 7683 | The Field — "your fertile ground" — Radiance | Room subtitle |
| 7684 | The Call — "the music within you" — Purpose | Room subtitle |

### Nexus opening prompts (`ROSE_OPENING_PROMPTS`, ~L7687–7695)

The eight rotation prompts the Nexus opens with when a member knocks. Generally clean and Charter-aligned. One outlier — see Conflict 9.

### Info popups (~L11077–11172)

| Line | String | Surface role |
| --- | --- | --- |
| 11081 | "Space Tuner" | Sound + Colour overlay title |
| 11085–11088 | Space Tuner body — "the right frequency can open a state…tuned to specific states — from deep rest (Delta) through meditation (Theta) and focused clarity (Alpha) up to peak performance (Gamma). Chakra presets align tone with different centres of the body. These are not background music. They are tuning instruments…The Studio aims to become a personal OS — an interface that learns and adapts to the conditions under which you do your best thinking. Tune it to where you are, not where you think you should be." | Sound + Colour explainer |
| 11096 | "The Nexus" | Nexus overlay title |
| 11100–11104 | Nexus body — "Not an assistant, not an oracle — a field of resonance that holds what you bring and returns questions from the frequency of where you are…In physics, a nexus is a node where multiple flows meet…It does not generate answers. It generates the questions that only you can answer…To activate it, hold your attention on the centre until it opens…It speaks from the frequency of this direction, not from a general position. In The Work it asks about what finds you. In The Field it asks about what sustains you. In The Call it asks about what wants to move through you. You do not consult it. You meet it." | Nexus explainer |
| 11116–11119 | Notepad body — "This is your primary writing surface — a space for free, unstructured expression. No format required. No audience in mind…The Notepad receives everything without editing…Entries are private, timestamped, and remain in your Archive for as long as you need them." | Notepad explainer |
| 11131–11133 | Living Profile body — "Level 1 · Threshold. A minimum viable digital self — the threshold card others meet you through…three layers: a foundation (the cosmic ground you stand on — birth, place, design), a compass (The Work, Lens, Field, Call), and a doorway (how others might engage). Nothing here is published. Honesty over performance — this is the trust architecture." | Living Profile explainer |
| 11152–11154 | OM Cipher body — "The Compass-sealed pattern your sigil, mantra, and field signature are drawn from. Distinct from Living Profile — this is the source code…Open the section to view your sigil, gematria source-pattern, Bhramari resonance, and the locked Cipher Foundation inputs. To correct source data, re-seal in Compass." | OM Cipher explainer |
| 11166–11169 | Archive body — "The Archive holds everything that belongs to this direction — material from your Compass session above, and your saved Studio entries below…Together they form a living record of your relationship with this direction…where you can expand on it, respond to it, or simply let it speak to where you are now." | Archive explainer |

### `BUILDER_STANDARD` ledes and field prompts (~L11485–11727)

| Line | String | Surface role |
| --- | --- | --- |
| 11488–11489 | Status levels — "Seeded / Drafting / Ready for review / Ready to publish / Published" (track) and "Locked / Unlocked / Seeding / Active / Evolving" (OS) | Builder track / OS status pills |
| 11496–11497 | Living Profile tagline + lede — "Level 1 · Your real-time community presence" / "Your digital calling card and Studio doorway — a clear, honest signpost built from who you actually are, not platform templates. Shows at a glance who you are and how to engage now. The first level of authentic self-representation." | L1 spec copy |
| 11536–11537 | Field-summary prompt + desc — "What holds you, what you radiate, the frequency you transmit." / "The qualities people most often feel in your presence; what your work transmits before words." | L1 builder field |
| 11567–11569 | Digital key · sigil field — "A symbolic mark — sigil or key — that signs your digital self." | L1 builder field (placeholder) |
| 11584–11585 | Personal Home tagline + lede — "Level 2 · Outward-facing bridge to the wider web" / "A four-room digital home around The Work, The Lens, The Field, and The Call — a relational plexus between this field and the wider internet. Preview only, not published." | L2 spec copy |
| 11607–11609 | Home · sigil field — "Symbolic sigil for the Personal Home — the mark that signs the threshold. Placeholder slot. Sigil generation arrives later." | L2 builder field (placeholder) |
| 11650–11651 | Personal OS tagline + lede — "Level 3 · Expanded home · inner studio for becoming" / "The inner studio where you create, learn, serve, and co-emerge with AI — supporting products, services, skills, radiance, clearer purpose, capacity, and reach. Technology serving human emergence, not replacement. Unlocks when Living Profile and Personal Home are ready, a project is alive, Field Notes are flowing, and a review rhythm is chosen." | L3 spec copy |
| 11677 | OS foundation field — "AI collaboration mode · Nexus / How does Nexus / AI sit in your studio? Sparring partner, scribe, sense-maker, witness?" | L3 builder field (planned) |

The SPARK_LIBRARY prompts (~L11691–11726) are generally Charter-aligned — they ask questions in the shape preferred by Charter §8, use plain English, and rest on the consume → live → serve register. They are flagged in §3 only where individual lines pull off-centre.

---

## 3. Conflicts surfaced

Sixteen items were surfaced in the first pass. Following the 28 May 2026 direction on Sanskrit, **Conflict 4 (*chakra*) is reclassified as retained** and is no longer a conflict to resolve in the rewrite — leaving fifteen active items. Numbering is preserved so cross-references and the §8 step list don't drift.

Each conflict names:
- **Where** (file + line),
- **The string**,
- **Why it conflicts** (Charter rule or Golden Thread module),
- **Severity** — `high` = directly contradicts a hard rule, `medium` = posture is off but recoverable in tone, `low` = small wording artifact.

### Conflict 1 — "Set Your Vibe" — imperative + banned-vocab family

- **Where:** `studio.html:6965` (panel title), repeated in info overlay title at `11081` (*Space Tuner*).
- **String:** *"Set Your Vibe"*.
- **Why it conflicts:**
  - Charter §3 (Tone rules): *match the user's register but not their charge.* *Vibe* is in the same family as the banned vocabulary explicitly named in voice samples §195 (*aligned, manifest, abundance, high vibe, frequency*). *High vibe* is named; *vibe* alone carries the same charge.
  - Charter §1 (Intention): *guidance should tend to reduce confusion, not increase stimulation.* The imperative *"Set Your"* invites a performance action, not a settling one.
  - Title-case `Set Your Vibe` against the sentence-case style most of Studio's headers use is also inconsistent; that is a cosmetic, not a Charter, issue.
- **Severity:** medium. The control itself is well-designed — sound and colour as part of the working surface, not decoration (the overlay text says exactly this). The label just imports a register the rest of the system avoids.

### Conflict 2 — "Sacred Tones" — borrowed sanctity

- **Where:** `studio.html:7006` (sound dropdown section).
- **String:** *"Sacred Tones"*.
- **Why it conflicts:**
  - Charter §7 (Working with subtle capacities): *avoid superlatives.* This is the same Conflict 5 the trust-messaging rewrite resolved on the manifesto (*"sacred infrastructure"* → *"a practice, not a commodity"*). The same word is doing the same work here.
  - The trust-messaging rewrite established that *sacred* is the strongest superlative available; calling a 528 Hz / 111 Hz preset *sacred* applies it to a system-level claim about tones.
- **Severity:** medium. The category needs a name; *sacred* is the wrong one.

### Conflict 3 — Frequency tooltips assert health claims

- **Where:** `studio.html:7008–7009` (and to a lesser degree the planetary tooltips at `7019–7025`).
- **Strings:** *"111 Hz — cell regeneration, endorphins"*, *"528 Hz — love frequency, DNA repair"*.
- **Why it conflicts:**
  - Charter §4 (Ethical constraints): *never glorify subtle capacities ("powers," "rare types," "high resonance"). When such capacities are named, immediately attach responsibility and service.* The tooltips name capacities (*DNA repair*, *cell regeneration*) without grounding, qualification, or alternative reading.
  - Charter §4: *never route a user away from medical, legal, or safety help they need.* The tooltips read as factual physiological claims rather than as labels on a sound preset.
  - Charter §3: *no jargon the user did not introduce first.* *Love frequency* is jargon imported from another conversation.
  - Voice samples §195: *frequency (as a noun)* is banned vocabulary unless the user introduced it; the tooltip introduces it.
  - The Tuner page (the practitioner bench) is where claims of this kind can be discussed with proper context. Studio is for the member doing their own work; the tooltip pretends to certainty Studio does not own.
- **Severity:** high. These are unsupported medical-adjacent claims rendered as titles, not aspirations.

### Conflict 4 — *Chakra* in member-facing copy *(reclassified — retained)*

- **Where:** `studio.html:11086` (Space Tuner overlay) and tooltips at `7019–7025` (*Root chakra*, *Sacral*, *Solar Plexus*, *Heart*, *Throat*, *Third Eye*, *Crown*).
- **Strings:** *"Chakra presets align tone with different centres of the body"* and the seven planetary tooltips that include chakra names.
- **Status:** **Retained.** Per project direction (28 May 2026), *chakra* is exempt from the no-Sanskrit rule — it is widely understood internationally and earns its place by helping explain rather than obscuring. The same exemption extends, case by case, to other Sanskrit terms that are similarly load-bearing for comprehension; not a blanket allow.
- **What this means for the rewrite:**
  - The seven body-locator names (*Root, Sacral, Solar Plexus, Heart, Throat, Third Eye, Crown*) stay.
  - *Chakra* itself stays in the Space Tuner overlay copy.
  - Charter §3 wording (*"No Sanskrit"*) should be amended in a small follow-up edit to read closer to *"No Sanskrit by default; exceptions for terms that are internationally understood and load-bearing for comprehension — currently: chakra. Add others by explicit decision."* Flagged here, not landed in this PR.
- **Severity:** n/a — no longer a conflict to resolve. Kept in the numbered list for traceability of the reclassification.

### Conflict 5 — "Activate my profile" — activation language

- **Where:** `studio.html:6819` (calculator submit button); echoed at `11102` (*"To activate it, hold your attention on the centre until it opens"*).
- **String:** *"Activate my profile"* (button) and *"To activate it"* (Nexus overlay).
- **Why it conflicts:**
  - Charter §4: *never make a person's pattern sound like destiny, fate, or a fixed identity. Pattern is observed; it is not the person.* *Activate* implies the profile is dormant and a button turns it on — a small but persistent identity claim.
  - The Compass intake is described in [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) §Orientation as a *sealing* operation, not an activation one. The vocabulary already exists internally — *seal*, *render*, *reveal* — and it does not import the activation register.
  - The Nexus overlay use of *activate* is gentler (*"To activate it, hold your attention…"*) but inherits the same charge.
- **Severity:** medium. Two surfaces; one label.

### Conflict 6 — "Three levels of *your authentic digital self*" — identity claim

- **Where:** `studio.html:7369` (Studio Path modal title); reinforced by `6750`, `11497` (*"the first level of authentic self-representation"*), and `11131` (*"A minimum viable digital self"*).
- **Strings:** *"Three levels of your authentic digital self"*, *"authentic self-representation"*, *"minimum viable digital self"*, *"digital calling card"*.
- **Why it conflicts:**
  - Charter §4: pattern is observed; it is not the person. The framing *"your authentic digital self"* names a thing the member possesses (*self*) and modifies it with a truth claim (*authentic*) — exactly the move the Charter resists in pattern outputs.
  - Charter §6 (Working with pattern outputs): *prefer "this profile shows…" or "one reading of this pattern is…" over "you are…".* *"Your authentic digital self"* is a category claim about who the member is.
  - Golden Thread Module D (Freedom from identification): the deepest meaning here is that the user is *not* the profile. *Authentic* glues them together.
  - *"Minimum viable digital self"* additionally imports startup vocabulary into spiritual register; *digital self* is the noun, *MVP* is the modifier.
  - The L1 lede already contains the cleaner reading: *"built from who you actually are, not platform templates."* The cleaner phrase can do the work without *authentic*.
- **Severity:** high. This is the framing label for the entire builder.

### Conflict 7 — "Co-emerge with AI" / "Technology serving human emergence" — invented mystic-tech vocabulary

- **Where:** `studio.html:6764` (entrance trail L3 line); `7374` (Studio Path lede); `11651` (BUILDER_STANDARD `os` lede).
- **Strings:** *"co-emerge with AI"*, *"co-emerging with AI"*, *"Technology serving human emergence, not replacement"*.
- **Why it conflicts:**
  - Charter §3: *no jargon the user did not introduce first.* *Co-emerge / co-emerging* is invented mystic-tech compound vocabulary; it does not sit inside any of the four Golden Thread modules or the four-layer architecture.
  - The consume → live → serve arc in [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) §"The arc" names the three movements precisely. *Co-emerge* is not a fourth movement and confuses the arc by introducing one. The L3 spec inherits this — *"create, learn, serve, and co-emerge with AI"* mixes the arc's *serve* with two non-arc verbs (*learn*, *co-emerge*).
  - *Human emergence* is the same jargon family at the next level up.
- **Severity:** medium. The L3 surface is genuinely about AI collaboration; the vocabulary for it needs replacing, not removing.

### Conflict 8 — "Honesty over performance — this is the trust architecture"

- **Where:** `studio.html:7378` (Studio Path lede); repeated verbatim at `11133` (Living Profile overlay).
- **String:** *"Honesty over performance — this is the trust architecture."*
- **Why it conflicts:**
  - This is the same *trust architecture* phrase the trust messaging rewrite retired on `manifesto.html:960` (Conflict 6 of the trust audit). The vocabulary has been judged against the Charter once; it is unchanged here.
  - *"Honesty over performance"* itself is clean and earns its place. The tail (*— this is the trust architecture*) is the part that needs the same treatment the manifesto entry received.
  - Charter §5 (Identity and relationship): the tail re-centres the system as the trust-supplier.
- **Severity:** medium. Two surfaces share the line; the head survives, the tail does not.

### Conflict 9 — *Frequency* as a noun, generically

- **Where:** Multiple. Most visible at:
  - `studio.html:11536` (L1 builder field-summary prompt: *"the frequency you transmit"*),
  - `studio.html:11100` (Nexus overlay: *"returns questions from the frequency of where you are"*),
  - `studio.html:11103` (Nexus overlay: *"It speaks from the frequency of this direction"*),
  - `studio.html:7694` (Nexus opening prompt: *"Where is your energy going that it perhaps shouldn't be?"* — *energy* as a noun is in the same banned family).
- **Why it conflicts:**
  - Voice samples §195 lists, verbatim: *no reply uses…energy (as a noun), vibration, aligned, manifest, abundance, high vibe, or frequency (except where the user introduced it).* The Charter applies the same rule to all member-facing surfaces in Studio.
  - The Tuner page is the place where *frequency* has a precise technical meaning (Hz). Carrying it into Studio's intimate surfaces — the Nexus and the L1 field-summary prompt — uses the word in its loose mystical sense, which the Charter prefers to avoid.
- **Severity:** medium. The word is doing different work in different places; the rewrite will have to disentangle the technical from the mystical use.

### Conflict 10 — *Sigil* persists in member-facing UI

- **Where:** `studio.html:11148` (OM Cipher overlay title's body), `11152` (*"your sigil, mantra, and field signature"*), `11154` (*"view your sigil, gematria source-pattern, Bhramari resonance…"*), `11567–11569` (L1 builder field *Digital key · sigil*), `11607–11609` (L2 builder field *Home · sigil*).
- **String:** *"sigil"* used as the canonical member-facing word for the Cipher's visible mark.
- **Why it conflicts:**
  - Direct user instruction: *Sigil = Cipher (don't use sigil); sigil retained only in legacy module names like `sdk/sigil.js`.* All five lines above are member-facing surfaces, not SDK module names.
  - This is not a Charter rule conflict but a canonical-vocabulary one. The trust-messaging rewrite carried forward the *Key → Cipher* migration as its own revision area; this audit is where that migration formally belongs, because the densest *sigil* usage is in Studio.
  - *Gematria* in the same OM Cipher overlay (`11154`) is a related issue: Hebrew-Kabbalistic vocabulary the user did not introduce. Charter §3 covers it. Worth deciding alongside *sigil*.
- **Severity:** high (against user instruction, not against Charter alone).

### Conflict 11 — Status pill gamification (*Locked / Unlocked / Active / Evolving*, *Unlocks when…*)

- **Where:** `studio.html:11489` (`BUILDER_STANDARD.statusLevels.os`), `11651` (Personal OS lede: *"Unlocks when…"*).
- **Strings:** *"Locked / Unlocked / Seeding / Active / Evolving"* (OS status pills), *"Unlocks when Living Profile and Personal Home are ready, a project is alive, Field Notes are flowing, and a review rhythm is chosen"* (Personal OS readiness gate).
- **Why it conflicts:**
  - Charter §1: *guidance should tend to reduce confusion, not increase stimulation.* *Unlocks when* is achievement-gating language imported from game UIs and SaaS upsell flows. It produces small charges of motivation, not stillness.
  - The companion track pills (`11488`: *Seeded / Drafting / Ready for review / Ready to publish / Published*) are utility labels and pass cleanly; the OS pills (*Locked / Unlocked / Active / Evolving*) introduce a different register.
  - The consume → live → serve arc is *explicitly not a funnel*; members do not graduate. *"Unlocks"* turns the arc into a funnel.
- **Severity:** medium. The criteria are well-chosen; the verb is wrong.

### Conflict 12 — *"ON AIR"* — broadcast metaphor against Charter §1

- **Where:** `studio.html:6946–6950` (session pill).
- **String:** *"ON AIR"* + session timer.
- **Why it conflicts:**
  - Charter §1: *reduce stimulation.* *ON AIR* imports a broadcast register — radio, live performance — that puts the member on stage. The lede of the trust audit's tonal anchor work (*"held, not extracted"*) sits opposite to this.
  - The Studio Path modal itself explicitly says *"Honesty over performance"* (Conflict 8 tail aside, the head is good). The *ON AIR* pill quietly reasserts performance.
  - The timer is useful; the framing is the issue.
- **Severity:** low. Small pill, but it is visually persistent in the room header.

### Conflict 13 — Per-room subtitle *"the way you are here to perceive"* (Lens) — destiny tilt

- **Where:** `studio.html:7682` (`ROOM_META.lens.subtitle`).
- **String:** *"the way you are here to perceive"*.
- **Why it conflicts:**
  - Charter §4: *never make a person's pattern sound like destiny, fate, or a fixed identity.* *"Here to perceive"* names a purpose the member was sent for; it is the gentlest possible destiny claim and still a destiny claim.
  - The other three subtitles do not have this issue — *the work that finds you* (Work), *your fertile ground* (Field), and *the music within you* (Call) describe conditions rather than missions.
- **Severity:** low. One word's worth of tilt.

### Conflict 14 — *"This direction"* vs. *"this room"* — coherence

- **Where:** `studio.html:11166–11169` (Archive overlay uses *"this direction"* three times to mean *this room*); also `11103` (Nexus overlay: *"the frequency of this direction"*).
- **String:** *"this direction"* as a synonym for *this room*.
- **Why it conflicts:**
  - Not a Charter conflict — a coherence one. The four-layer architecture and the rest of `studio.html` use *room* consistently. Switching to *direction* in two overlays makes the same surface seem to be talking about two different things.
  - The Personal Home modal also calls them *rooms* (*"choose a room to enter"*), as does the Studio Path footnote and the `room-pill` selector.
  - Either commit to *direction* (which carries a felt-sense quality the Compass-as-direction-finder framing supports) or stay with *room* throughout. Mixing the two reads as careless.
- **Severity:** low. Pick one.

### Conflict 15 — Studio Path lede tail re-centres the system

- **Where:** `studio.html:7378` (the Studio Path modal lede, last sentence).
- **String:** *"Imported Compass material is reviewed first; Sparks fill the gaps in your own voice. Honesty over performance — this is the trust architecture."*
- **Why it conflicts:**
  - This is the composite of Conflicts 6 (identity claim in the title above) and 8 (trust-architecture tail). It is flagged separately because the lede is *the* explainer for the Studio Path; the rewrite should treat the whole paragraph as one unit, not three sentences edited in isolation.
- **Severity:** medium. Treat as a paragraph rewrite.

### Conflict 16 — *"co-emerge with AI"* duplicated across three surfaces without a canonical source

- **Where:** `studio.html:6764` (entrance trail), `7374` (Studio Path lede), `11651` (BUILDER_STANDARD `os` lede).
- **String:** see Conflict 7.
- **Why it conflicts (separately listed):**
  - The same off-key phrase appears in three places. This is flagged not as a new conflict but as a **drift signal**: when one phrase recurs across surfaces with no canonical source, the rewrite must replace it everywhere at once or it will re-grow.
- **Severity:** procedural, not severity-rated. Logged for the rewrite plan.

---

## 4. What survives the audit cleanly

The Studio surface is mostly working. Several strings are doing exactly what the Charter and Golden Thread frames want:

- **`studio.html:7181`** — Notepad placeholder: *"Write freely. Reflections, questions, fragments, intentions. **This space is yours.** … Saved Field Notes become available to Nexus."* Sanctuary register. Survives.
- **`studio.html:7183`** — Save confirmation: *"Saved. This Field Note is now available to Nexus for reflection, and for shaping your Living Profile, Personal Home, and Personal OS."* Plain, operational, names what happens. Survives.
- **`studio.html:7274`** — *"hold the centre to open"* — matches the *"held"* register from `beta_gate.html` and the trust rewrite's *"Holds the path"*. Survives.
- **`studio.html:7285`** — *"The Nexus is present. When you are ready, knock."* This is the tonal anchor for Studio in the way `beta_gate.html` is for the public surfaces. Survives.
- **`studio.html:7474`** — *"Compass points you home."* — Personal Home modal title. Survives.
- **`studio.html:7476–7477`** — *"Step across the threshold; choose a room to enter."* — Survives.
- **`studio.html:11100`** (first sentence only) — *"Not an assistant, not an oracle — a field of resonance that holds what you bring…"* — *holds* lands cleanly. The clause that follows (*…and returns questions from the frequency of where you are*) is where Conflict 9 enters.
- **`studio.html:11104`** — *"You do not consult it. You meet it."* Borderline anthropomorphic (Charter §5 risk by inversion) but survives as written; the inversion *names* a relational move rather than asking the user to feel one.
- **`studio.html:11116–11119`** — Notepad overlay body. Survives in full.
- **The SPARK_LIBRARY prompts at `~11691–11726`** — generally survive. The handful that touch *"emerge through you"* sit inside Gene Keys *Purpose* / *Call* territory and remain coherent within the user's permission for GK vocabulary in Compass/stUdio. They do not need rewriting in this pass.
- **`ROSE_OPENING_PROMPTS` (`~L7687–7695`)** — seven of eight survive cleanly. The eighth (*"Where is your energy going…"*) is Conflict 9.
- **`ROOM_META` subtitles** for Work, Field, Call (lines 7681, 7683, 7684) survive. Only Lens (Conflict 13) tilts.

These survivors are the calibration set for the rewrite: anything the rewrite proposes should sit beside these strings without standing out as louder, brighter, or more eager.

---

## 5. Patterns underneath the conflicts

Three patterns recur. Naming them helps the rewrite stay disciplined.

1. **Imported registers that don't sit inside the foundation.** *Sacred*, *frequency* (loose), *vibe*, *gematria*, *co-emerge*. These come from neighbouring conversations — wellness marketing, esoteric studies, AI-collaboration discourse — and arrive without grounding. The trust audit's *"defensive vocabulary imported from elsewhere"* pattern shows up here as *mystic/wellness vocabulary imported from elsewhere*. Same structural issue, different register. (*Chakra* sits in a different category — see Conflict 4: load-bearing Sanskrit retained by explicit decision.)

2. **Identity-shaped claims as default framing.** *Authentic digital self*, *digital self*, *minimum viable digital self*, *the way you are here to perceive*. The Studio is the layer where the member *does their work*, but the framing repeatedly names *who they are*. The Charter's pattern-is-observed-not-the-person rule (§6) gets stretched.

3. **Achievement / activation register.** *Activate my profile*, *Unlocks when…*, *Locked / Unlocked / Active / Evolving*, *ON AIR*. Studio's gentleness is undermined in small places by small motivational pulses. The arc is not a funnel; the language sometimes treats it as one.

A fourth, lesser pattern: **vocabulary drift without a canonical source** (Conflict 16). *Co-emerge*, *trust architecture*, *authentic*, *sigil* all appear in multiple surfaces. The fix needs to be made at all instances in one PR, not piecemeal.

---

## 6. Positive frames the rewrite calibrates against

These are the same three frames the trust audit named (sanctuary, four-layer architecture, consume → live → serve), specialised to Studio.

### Frame A — Studio is the stUdio layer of the four-layer architecture

From [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) §stUdio:

> **stUdio** is the room where the member does their own work, not where the system performs for them.

**Implication for the rewrite:**
- Studio's framing copy should describe what *the member does in Studio*, not what *Studio does for the member*. *Activate* and *Unlocks* both invert this.
- The room metaphor is doing real work — keep it, keep it consistent (Conflict 14), and let it carry the structural framing without needing *digital self* glosses.

### Frame B — Sanctuary

From [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) §Sanctuary:

> A member can bring their reflections, contradictions, and unfinished thinking into the system without fear that what they say will be used against them. Reflections live in the member's own personal storage. They are not harvested for external models or external optimisation.

**Implication for the rewrite:**
- Studio is where the densest member-shared material lives (Field Notes, voice notes, Nexus conversation). The sanctuary frame is already operational here — *"This space is yours"* is the cleanest sentence in the system. The rewrite extends that register elsewhere, especially in the Studio Path lede and the info overlays.

### Frame C — Consume → live → serve (with Studio = *live*)

From [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) §"The arc":

> **Live.** What stUdio is for. The inner work becomes form. Practice, reflection, embodiment. The path is the practice, not the reading about the practice.

**Implication for the rewrite:**
- Studio is the *live* surface; that fact can do the work that *authentic* / *co-emerge* / *emergence* are currently doing.
- The L3 (Personal OS) lede should be reframed around the arc rather than around *co-emerge with AI*; the AI collaboration is the *form* the live work takes, not a fourth movement.
- The *Unlocks when…* phrasing can be replaced by language that names what is in place when L3 becomes useful, rather than language that gates progress.

---

## 7. What stays untouched (out of audit scope)

- **The Gene Keys vocabulary** — *Life's Work, Evolution, Radiance, Purpose, Shadow → Gift, movement names.* User instruction: Gene Keys remain at core of Compass and stUdio. The Spark library's use of Gene Keys movement / arc taxonomy survives in full.
- **The room names** — *The Work, The Lens, The Field, The Call.* These are the canonical four; they survive.
- **`tuner/client/public/studio.html`** — out of scope until the question of *is this the same Studio or a parallel one?* is resolved. Logged for follow-up.
- **`docs/product/studio.md`** — internal doc; *"manifest Unity in practice"* on L9 imports banned vocabulary, but the doc is contributor-facing. Flagged for incidental cleanup, not for this revision area.
- **The four-layer architecture's use of *"stUdio"* (lowercase t, capital U) in foundation docs** — this is internal-precision typography; member-facing surfaces continue to use *Studio*. No conflict.
- **The Tuner's existing frequency vocabulary** — Tuner is the practitioner bench where frequency-as-Hz is precise; this audit does not touch Tuner.

---

## 8. Proposed approach to the rewrite

(Approach only. The actual rewrite is a separate PR, pending your approval of this audit.)

1. **Anchor the voice on the Studio surfaces that already work** — the Notepad placeholder (`7181`), the Save confirmation (`7183`), the Nexus knock line (`7285`), the *Compass points you home* modal title (`7474`), and the *Step across the threshold* lede (`7476`). Whatever replaces the failing strings should sit beside these without standing out as louder.

2. **Treat Conflicts 6 + 8 + 15 as one paragraph rewrite.** *Three levels of your authentic digital self* + *trust architecture* + the Studio Path lede are interlocked. Rewrite the modal title and lede together; do not patch sentences in isolation.

3. **Decide the *sigil → Cipher* migration here** (Conflict 10). This audit names it; the rewrite executes it across all five Studio surfaces in the same PR. Carry the same decision into the L1 *Digital key · sigil* and L2 *Home · sigil* field labels in `BUILDER_STANDARD`. Note: this completes the carry-forward from the trust-messaging rewrite.

4. **Replace *vibe* and *sacred* with plain descriptors** (Conflicts 1, 2). The control is fine; the labels are the problem. *Set Your Vibe* → a label that names what the panel does (atmosphere, sound + light, room conditions). *Sacred Tones* → a sound category name that describes the tones, not their status.

5. **Pull *frequency* tooltips back to factual labels** (Conflict 3). The Hz numbers are factual; the *cell regeneration*, *DNA repair*, *love frequency* claims are not. Replace with neutral descriptors or remove the descriptive tail entirely. This is a Charter §4 hard-edge — *never route a user away from medical help they need* — and must not be deferred.

6. **~~Remove Sanskrit from member-facing tooltips~~** *(Conflict 4 — no longer in scope.)* *Chakra* and the seven body-locator names are retained per 28 May 2026 direction. A small Charter §3 wording amendment is flagged separately. Step number kept so subsequent step references don't drift.

7. **Replace *Activate* and *Unlocks*** (Conflicts 5, 11). *Activate my profile* → a verb that names what happens (the calculator runs against birth data and seals the Cipher). *Unlocks when…* → a phrasing that names what is in place, not what is unlocked.

8. **Reframe the L3 (Personal OS) lede around the arc, not around *co-emerge*** (Conflict 7). The L3 surface is the *live* layer becoming visible enough to *serve*. The AI collaboration is the medium, not a new movement.

9. **Resolve *direction* vs. *room*** (Conflict 14). One choice; applied everywhere. *Room* is dominant elsewhere in `studio.html` and is the four-layer-architecture-aligned word.

10. **Reframe *ON AIR*** (Conflict 12). Keep the timer, drop the broadcast metaphor. The pill can mark *session active* or *studio open* without the performance vocabulary.

11. **Cross-check each rewritten string against the seven-point self-check** in `nexus-guidance-charter.md` **and** against the three positive frames in §6 above. If a sentence fails any of the seven, or does not sit cleanly inside one of the three frames, rewrite. The same gate the trust-messaging rewrite used.

12. **Touch all instances of a duplicated phrase in a single PR** (Conflict 16 procedural note). *Co-emerge*, *authentic*, *trust architecture*, *sigil* all appear in multiple surfaces. The PR must replace every instance; otherwise the next person reading one of the survivors will reintroduce the phrase elsewhere.

---

## 9. What this audit is not

- **Not a UX critique of Studio's interaction design.** The Studio Path modal, the Nexus orb, the Field Notes / Nexus split, the four-room model — all sit well inside the architecture. The audit is about the *words* on those surfaces.
- **Not a Gene Keys positioning pass.** That is revision area 3 ([`../audits/`](../audits/) will hold it). The audit here uses Gene Keys vocabulary as-is.
- **Not a Tuner audit.** Sound, colour, and the *Space Tuner* info overlay are inside Studio's vocabulary surface; the Tuner page itself is separate work.
- **Not a public-copy audit.** Revision area 4 covers the public surfaces; this audit names Studio strings only, even where the same string also appears publicly (e.g. the persona-card carry-forward from trust messaging).
- **Not a recommendation to retire the Studio Path / L1 → L2 → L3 framework.** The framework is sound; the *framing* of it is what needs work.

---

## 10. Next step

If you approve this audit:

- I open a separate PR titled *Studio vocabulary rewrite — revision area 2* with proposed replacement strings as a diff, citing the Charter rule that drove each non-obvious change.
- Each string is replaced in `studio.html`. `tuner/client/public/studio.html` stays untouched pending the *is this the same surface?* decision.
- The *sigil → Cipher* migration lands in the same PR (Conflict 10).
- The medical-adjacent claims at `7008–7009` are addressed in the same PR, not deferred (Conflict 3 is the only Charter §4 hard-edge in this audit).
- No other surfaces are touched in that PR.

If you want changes to the audit first, mark them inline in this document on the PR.

---

See also:

- [`./trust-messaging-audit.md`](./trust-messaging-audit.md) and [`../rewrites/trust-messaging-rewrite.md`](../rewrites/trust-messaging-rewrite.md) — revision area 1, completed; sets the working pattern.
- [`../../foundation/om-field-golden-thread.md`](../../foundation/om-field-golden-thread.md) — the four modules.
- [`../../foundation/nexus-guidance-charter.md`](../../foundation/nexus-guidance-charter.md) — Charter §1, §3, §4, §5, §6, §7, §11 cited above.
- [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) — sanctuary, stUdio layer, and consume → live → serve arc.
- [`../../foundation/nexus-voice-samples.md`](../../foundation/nexus-voice-samples.md) — banned vocabulary list (§195) cited in Conflicts 1, 3, 9.
- [`../../foundation/adapted-8-limbs.md`](../../foundation/adapted-8-limbs.md) — internal-precision document.
