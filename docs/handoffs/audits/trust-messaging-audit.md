# Trust Messaging Audit — Revision Area 1

Status: v0.1. Audit only. **No rewrite in this document.** The rewrite is a separate, later step.

This audit is the first of six revision passes against the Golden Thread framework (see [`../../foundation/om-field-golden-thread.md`](../../foundation/om-field-golden-thread.md) and [`../../foundation/nexus-guidance-charter.md`](../../foundation/nexus-guidance-charter.md)). It surfaces, with line numbers and rule citations, where the current member-facing trust language conflicts with the Charter and the four Golden Thread modules.

---

## 1. Where trust messaging currently lives

Trust language in CommonUnity is concentrated in three member-facing surfaces:

| File | Role | Density of trust language |
| --- | --- | --- |
| `homepage.html` | Public landing surface; persuasion + waitlist | Medium. Concentrated in the "Yours to carry / Local-first & sovereign" panel and the waitlist note. |
| `manifesto.html` | Source code / long-form trust narrative | High. Multiple passages explicitly position CommonUnity *against* extractive technology. |
| `beta_gate.html` | Gated entry surface | Low. The trust gesture here is structural (invitation-only) rather than verbal. |

`studio.html` and `index.html` contain essentially no trust-claim copy. The Tuner pages and the Ashtanga exam pages contain none relevant.

For completeness, the internal docs (`philosophical-principles.md` principle 10 on member sovereignty, `commonunity-architecture-v0.2.md`, `data-model.md`) already use language that is broadly aligned with the Charter — the audit below focuses on **member-facing** strings only.

---

## 2. Strings inventory

The full list of trust-adjacent strings currently shown to members.

### homepage.html

| Line | String | Surface role |
| --- | --- | --- |
| 1399 | "Yours to carry" + "A single self-profile you keep, share, or set aside. No vendor lock-in, no hostage data." | Feature card |
| 1401 | "Coherent across tools" + "Compass, Studio, and Tuner all meet you through the same Key. The same person, recognised everywhere." | Feature card |
| 1401 | "Local-first & sovereign" + "Lives on your device by default. The cloud is a copy, not the original — your context stays yours." | Feature card |
| 1458 | Persona card: "Digital sovereignty seekers" + "People who understand that platform dependency, algorithmic identity, and centralised data ownership are not neutral. They may not use spiritual language — they resonate with portable context, personal data sovereignty, and tools that remember without owning them." | Persona section |
| 1545 | "No spam. Your data stays yours." | Waitlist micro-copy |

### manifesto.html

| Line | String | Surface role |
| --- | --- | --- |
| ~544 | "…use technology without becoming owned by it, and build trust with others in a fragmented age." | Lede |
| ~605 | "…tools that strengthen self-knowledge, protect personal sovereignty, deepen community, and support the work of becoming more fully human." | Section close |
| ~692 | "…eight movements of good living for the realities of our time: digital life, creative work, community, technology, self-expression, and trust." | Framing |
| ~725 | "In CommonUnity, relationship asks: does this strengthen trust, or does it extract from it?" | Movement (Relationship) |
| ~733 | "We treat trust as infrastructure." | Movement (Relationship) |
| ~839 | "CommonUnity treats attention as sacred infrastructure. To reclaim attention is to reclaim the conditions of creation." | Movement (Attention) |
| ~926 | "…more coherent lives, more honest work, more sovereign digital presence, and more trustworthy forms of community." | Closing |
| ~960 | "The CommonUnity Key — Protects the path through trust architecture: the person's pattern travels with them, and the system remembers without owning them." | Tools section |

### beta_gate.html

| Line | String | Surface role |
| --- | --- | --- |
| 283 | "Private beta" eyebrow | Status tag |
| 284 | "CommonUnity is opening by invitation." | H1 |
| ~285 | "This part of the field is currently held for invited beta companions and guides. Use your magic link, or enter the shared beta code you were given." | Lede |

---

## 3. Conflicts surfaced

Each conflict is named with:
- **Where** (file + line),
- **The string** (or paraphrase if long),
- **Why it conflicts** (which Charter rule or Golden Thread module),
- **Severity** — `high` = directly contradicts a hard rule, `medium` = posture is off but recoverable in tone, `low` = small wording artifact.

### Conflict 1 — "Local-first & sovereign" reads like a feature claim, not a posture

- **Where:** `homepage.html:1401-1404`.
- **String:** "Lives on your device by default. The cloud is a copy, not the original — your context stays yours."
- **Why it conflicts:**
  - Charter §1 (Intention): *guidance should always tend to reduce confusion and inner conflict, not to increase stimulation.* "Sovereign" is a charged word that produces a small charge of righteousness, not stillness.
  - Charter §3 (Tone rules): *no jargon the user did not introduce first.* "Local-first" and "sovereign" are insider terms that arrive without grounding.
  - Golden Thread Module D (Freedom from identification): the deepest meaning of sovereignty is *being the one who is aware*, not *holding the keys to your data*. The current phrasing collapses the deeper meaning into a tech-policy claim.
- **Severity:** medium.

### Conflict 2 — Persona card "Digital sovereignty seekers" recruits identification

- **Where:** `homepage.html:1458-1466`.
- **String:** "People who understand that platform dependency, algorithmic identity, and centralised data ownership are not neutral…"
- **Why it conflicts:**
  - Charter §4 (Ethical constraints): *never make a person's pattern sound like destiny, fate, or a fixed identity.* This card invites a reader to become "the digital sovereignty seeker" — a small, marketable identity offering.
  - Golden Thread Module D: identity inflation is treated as a bug. Persona cards in general are at risk here; this one most acutely because it names a tribe.
  - Charter §6 (Working with pattern outputs): *present pattern as something seen, not what the user is.* A persona card is the pre-onboarding equivalent of saying *"you are this kind of person"*.
- **Severity:** high.

### Conflict 3 — "No spam. Your data stays yours." — defensive register

- **Where:** `homepage.html:1545`.
- **String:** "No spam. Your data stays yours."
- **Why it conflicts:**
  - Charter §1: the line is doing reassurance, which is a form of stimulation (managing anxiety) rather than reducing confusion.
  - Charter §3: *match the user's register but not their charge.* The line presupposes a defensive posture in the reader (worry about spam) and meets it on those terms.
  - Golden Thread Module B (Causes of suffering): the upstream cause being addressed here is *fear of loss* — and the line addresses it by reassuring, not by inviting the reader past it.
- **Severity:** low to medium. It's a small line but it sets the tone of the first commitment a reader makes.

### Conflict 4 — "We treat trust as infrastructure" — system-as-protector framing

- **Where:** `manifesto.html:~733`.
- **String:** "We treat trust as infrastructure."
- **Why it conflicts:**
  - Charter §5 (Identity and relationship): *Nexus is not an authority…the relationship of value is between the member and the field of truth.* Framing trust as infrastructure the system provides positions CommonUnity as the trust-giver. Trust is then something the platform builds *for* the member.
  - Golden Thread Module D: the line subtly re-centers the platform. A cleaner version would frame trust as a quality that arises between member and field, with the platform as a facilitator.
- **Severity:** medium. The sentence is elegant; the posture underneath it is slightly off.

### Conflict 5 — "Sacred infrastructure" — borrowed sanctity

- **Where:** `manifesto.html:~839`.
- **String:** "CommonUnity treats attention as sacred infrastructure."
- **Why it conflicts:**
  - Charter §7 (Working with subtle capacities): *avoid superlatives.* "Sacred" is the strongest superlative available and is applied here to a system-level claim.
  - Golden Thread Module C (Refining attention): attention is exactly where the Sutras are most precise — and the Sutras' point is that attention is *what we have to work with*, not *what is sacred about us*. Calling our infrastructure for attention "sacred" leans on borrowed weight.
- **Severity:** medium.

### Conflict 6 — "Protects the path through trust architecture" — protector posture

- **Where:** `manifesto.html:~960`.
- **String:** "Protects the path through trust architecture: the person's pattern travels with them, and the system remembers without owning them."
- **Why it conflicts:**
  - Charter §5: the system is positioned as protector. Combined with the parallel verbs in the surrounding list ("Brings the path…", "Supports the path…", "Protects the path…") the implication is that CommonUnity *does the path for the member*.
  - The clause *"and the system remembers without owning them"* is actually one of the strongest sentences on the page and survives the audit unchanged in spirit — it just shouldn't be filed under "protection."
- **Severity:** medium.

### Conflict 7 — "Coherent across tools" — system-as-recogniser

- **Where:** `homepage.html:1401`.
- **String:** "Compass, Studio, and Tuner all meet you through the same Key. The same person, recognised everywhere."
- **Why it conflicts:**
  - Charter §5: *avoid first-person emotional language; the system facilitates, it does not relate as a peer.* "Meet you" and "recognised everywhere" gently anthropomorphise the toolset.
  - Charter §6: *present pattern as something seen, not what the user is.* "The same person, recognised" risks collapsing person and pattern (the Key) — the Key is the pattern; the person is the one *with* the Key.
- **Severity:** low. A small tilt of the sentence resolves it.

### Conflict 8 — "Yours to carry" / "vendor lock-in, hostage data" — defensive vocabulary

- **Where:** `homepage.html:1399`.
- **String:** "A single self-profile you keep, share, or set aside. No vendor lock-in, no hostage data."
- **Why it conflicts:**
  - Charter §1 (Intention): "vendor lock-in" and "hostage data" import a charged register from another conversation (SaaS critique). They produce stimulation, not stillness.
  - Charter §3: jargon the user did not introduce first.
- **Severity:** medium.

### Conflict 9 — Beta gate body copy is the cleanest piece on the audit

- **Where:** `beta_gate.html:284-285`.
- **Strings:** "CommonUnity is opening by invitation." / "This part of the field is currently held for invited beta companions and guides."
- **Why it (does not) conflict:**
  - This passes the Charter cleanly. *"Held"* is the right verb — slower than *"protected,"* less proprietary than *"managed."*
  - *"The field"* is used here in the way the Golden Thread uses it — as a condition, not an asset.
  - **Flag this as the tonal anchor for the rewrite.** It is what the rest of the trust copy should sound like.
- **Severity:** none. Keep.

### Conflict 10 — Manifesto lede "…build trust with others in a fragmented age" — diagnosis-as-bait

- **Where:** `manifesto.html:~544`.
- **String:** "…use technology without becoming owned by it, and build trust with others in a fragmented age."
- **Why it conflicts:**
  - Charter §3: *match the user's register but not their charge.* "A fragmented age" is a strong diagnostic claim that imports the very fragmentation it names.
  - Golden Thread Module B: the line addresses *fear of loss* by naming an enemy state ("fragmentation"). Cleaner posture: name what is being practiced, not what is being escaped.
- **Severity:** medium. The lede is otherwise strong.

---

## 4. Patterns underneath the conflicts

Three patterns recur across the audit. Naming them helps the rewrite stay disciplined rather than line-by-line.

1. **System-as-protector.** The system "protects," "treats X as sacred infrastructure," "treats trust as infrastructure." Posture is: *we hold the line so you can be safe*. Charter wants: *we facilitate the conditions in which you can hold your own line*.

2. **Defensive vocabulary imported from elsewhere.** "Vendor lock-in," "hostage data," "platform dependency," "algorithmic identity," "fragmented age." This is the language of SaaS critique. It is well-aimed in that conversation but produces charge, not stillness, when imported here.

3. **Identity-shaped invitations.** "Digital sovereignty seekers," "conscious creators," and similar persona framings invite a reader to *become* a labelled type. Charter §4 and Golden Thread Module D resist this directly.

---

## 5. What stays

The audit also names what to keep — these passages already sit inside the Charter.

- `beta_gate.html` body copy. The tonal anchor.
- `manifesto.html:~605`: *"…tools that strengthen self-knowledge, protect personal sovereignty, deepen community, and support the work of becoming more fully human."* — uses *protect* but in service of the member's own faculty, not the platform's.
- `manifesto.html:~920`: *"…more coherent lives, more honest work, more sovereign digital presence, and more trustworthy forms of community."* — the qualities are placed on the member's life, not on the system. Survives.
- The structural fact of invitation-only onboarding. This is the strongest trust claim on the site; it does not need verbal reinforcement.
- Principle 10 in `philosophical-principles.md` (sovereignty of the member). Already aligned. Becomes the reference point for the rewrite.

---

## 6. Proposed approach to the rewrite

(Approach only. The actual rewrite is a separate PR, pending your approval of this audit.)

1. **Anchor the voice on `beta_gate.html`.** Whatever replaces the homepage trust panel and the manifesto trust passages should be tonally consistent with *"held," "by invitation," "the field."* Calm, structural, low charge.

2. **Drop the imported defensive vocabulary.** Replace "vendor lock-in," "hostage data," "fragmented age," and similar with descriptions of what is actually true: *the file is yours, it is readable, it stays on your device by default, the cloud copy is optional, the system has no purchase on you when you leave.* Less rhetoric, more fact.

3. **Replace "protects" / "infrastructure" with facilitator verbs.** *Holds, accompanies, makes room for, returns to you.* The system does not protect the member from the world; it makes a clean enough space that the member can do their own work.

4. **Retire the "Digital sovereignty seekers" persona card; consider retiring the persona section entirely.** Personas are identity-shaped invitations. If the section stays, rewrite each card around *what someone might be in the middle of*, not *what kind of person they are*. (Charter §6.)

5. **Reframe "sacred infrastructure" and "trust as infrastructure."** Use *practice* and *ground* rather than *infrastructure*. Attention is not sacred; what attention can become is precious. Trust is not infrastructure; trust is what arises when the conditions are clean.

6. **Treat the waitlist micro-copy as a Charter test.** *"No spam. Your data stays yours."* is small but sets the first commitment's tone. The replacement should not reassure; it should describe what happens. Example direction (not final copy): *"One quiet email when the field opens to you. The file we make together is yours."*

7. **Cross-check each rewritten string against the seven-point self-check** at the bottom of `nexus-guidance-charter.md`. If a sentence fails any of the seven, rewrite.

---

## 7. What this audit is not

- Not a final word on voice. Other revision areas (Studio vocabulary, Gene Keys positioning, public copy at large) will inform the trust rewrite once their audits are done.
- Not a recommendation to delete the manifesto's strongest passages. The manifesto is mostly working. The issue is concentrated in a few sentences that pull the rest off-center.
- Not a marketing critique. The audit's standard is the Charter, not conversion.

---

## 8. Next step

If you approve this audit:

- I open a separate PR titled *Trust messaging rewrite — revision area 1* with proposed replacement strings as a diff, citing the Charter rule that drove each non-obvious change.
- Each string is replaced in `homepage.html`, `manifesto.html`, and the waitlist micro-copy only. `beta_gate.html` stays untouched.
- No other surfaces are touched in that PR.

If you want changes to the audit first, mark them inline in this document on the PR.

---

See also:
- [`../../foundation/om-field-golden-thread.md`](../../foundation/om-field-golden-thread.md)
- [`../../foundation/nexus-guidance-charter.md`](../../foundation/nexus-guidance-charter.md)
- [`../../foundation/philosophical-principles.md`](../../foundation/philosophical-principles.md) — principle 10 (sovereignty of the member).
- [`../../foundation/adapted-8-limbs.md`](../../foundation/adapted-8-limbs.md) — internal-precision document; the audit's reasoning sits inside Yama (relational integrity) and Pratyahara (removing noise).
