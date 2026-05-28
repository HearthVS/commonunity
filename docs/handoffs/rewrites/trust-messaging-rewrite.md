# Trust Messaging Rewrite — Revision Area 1

Status: v0.1. Rewrite, with rationale, for each string flagged in [`../audits/trust-messaging-audit.md`](../audits/trust-messaging-audit.md) (v0.2). Companion to PR *Trust messaging rewrite — revision area 1*.

This document lists every string changed by the PR, the conflict it resolved, the Charter rule and Golden Thread module that drove the change, and the self-check pass. It exists so a future reader can see, for each new sentence, why it is the shape it is.

`beta_gate.html` is **not** touched — it remains the tonal anchor.

---

## Calibration summary

All replacements were drafted against, in this order:

1. **The seven-point self-check** at the bottom of [`../../foundation/nexus-guidance-charter.md`](../../foundation/nexus-guidance-charter.md) §11.
2. **The three positive frames** in [`../audits/trust-messaging-audit.md`](../audits/trust-messaging-audit.md) §4a — sanctuary, four-layer architecture, consume → live → serve.
3. **The voice samples** in [`../../foundation/nexus-voice-samples.md`](../../foundation/nexus-voice-samples.md) — register, length discipline, banned vocabulary.
4. **The tonal anchor** in `beta_gate.html` — *"held," "by invitation," "the field."*

The rewrite does not introduce any string that fails any of the seven self-check questions, that imports defensive vocabulary from SaaS critique, or that anthropomorphises the toolset.

---

## Strings replaced

### Homepage — Key features panel

#### 1. `homepage.html:1393-1395` — *Yours to carry*

| | Before | After |
| --- | --- | --- |
| Label | Yours to carry | Yours to carry |
| Body | A single self-profile you keep, share, or set aside. No vendor lock-in, no hostage data. | A single readable file: your context, kept or set aside on your terms. |

- **Resolves:** Conflict 8 (defensive vocabulary imported from SaaS critique).
- **Rule cited:** Charter §1 (Intention — reduce confusion, not stimulation); Charter §3 (Tone rules — no jargon the user did not introduce first).
- **Frame moved toward:** Sanctuary. *"Kept or set aside on your terms"* names what the member decides, not what the system promises not to do.
- **Note on the label.** *"Yours to carry"* survives because it describes posture (the member is the one carrying), not platform virtue.

#### 2. `homepage.html:1397-1398` — *One Key across surfaces*

| | Before | After |
| --- | --- | --- |
| Label | Coherent across tools | One Key across surfaces |
| Body | Compass, Studio, and Tuner all meet you through the same Key. The same person, recognised everywhere. | Compass, Studio, and Tuner all read the same Key. What is constant is the Key; the surfaces are where you work. |

- **Resolves:** Conflict 7 (system-as-recogniser anthropomorphism), Conflict 11 (the line was mixing four-layer roles).
- **Rule cited:** Charter §5 (Identity and relationship — the system facilitates; it does not relate as a peer); Charter §6 (Working with pattern outputs — pattern is something seen, not what the user is).
- **Module cited:** four-layer architecture — the **Cipher (Key)** is what is constant across surfaces; the surfaces themselves are not the seers. *"Read the same Key"* removes the anthropomorphism in *"meet you / recognised everywhere."*
- **Scope note.** The audit's deeper Conflict 11 reading — that Compass, Studio, and Tuner are not peer layers — is structural. Re-arranging the homepage's three-CTA spine is out of scope for trust messaging and is left for revision area 2 (Studio vocabulary) or revision area 4 (public copy). The minimum trust-messaging fix is to name what is constant rather than who is doing the recognising; that is what this edit does.
- **Vocabulary note.** *"Key"* is preserved here. The canonical name in foundation docs is **Cipher**, but the JSON schema rendered immediately above this card (`"schema": "commonunity-key/1.0"`) and the surrounding section heading use *Key*. Migrating *Key* → *Cipher* in member-facing surfaces is a deliberate separate revision area and is not done piecemeal in a trust pass.

#### 3. `homepage.html:1401-1402` — *Stays with you*

| | Before | After |
| --- | --- | --- |
| Label | Local-first & sovereign | Stays with you |
| Body | Lives on your device by default. The cloud is a copy, not the original — your context stays yours. | The file lives on your device by default. The cloud copy is optional and arrives only if you choose it. |

- **Resolves:** Conflict 1 (*"local-first"* and *"sovereign"* are insider terms; the line collapsed Golden Thread Module D into a tech-policy claim).
- **Rule cited:** Charter §1 (reduce charge); Charter §3 (no jargon the user did not introduce first).
- **Module cited:** Golden Thread Module D (Freedom from identification) — *sovereignty* in the deeper sense is *being the one who is aware*, not *holding the keys to your data*. The rewrite makes the technical claim without leaning on the deeper word.
- **Frame moved toward:** Sanctuary. The condition is described in plain terms; nothing reassures.

### Homepage — Persona section

#### 4. `homepage.html:1458-1466` — *Digital sovereignty seekers* card

| | Before | After |
| --- | --- | --- |
| Card | "Digital sovereignty seekers" — People who understand that platform dependency, algorithmic identity, and centralised data ownership are not neutral. They may not use spiritual language — they resonate with portable context, personal data sovereignty, and tools that remember without owning them. | *Removed.* |

- **Resolves:** Conflict 2 (high severity — identity-shaped invitation).
- **Rule cited:** Charter §4 (Ethical constraints — never make a person's pattern sound like destiny or a fixed identity); Charter §6 (pattern is something seen, not what the user is).
- **Module cited:** Golden Thread Module D (Freedom from identification). Persona cards offer a small marketable identity to step into; this card most acutely because it names a tribe.
- **Frame moved toward:** Consume → live → serve. The arc names *where someone is in the middle of something*, not *what kind of person they are*. A future revision area (4. public copy) may rewrite the remaining persona cards along the arc, or retire the section entirely.
- **Scope note.** Only the *Digital sovereignty seekers* card is removed here, because:
  1. It is the only one explicitly named in the audit;
  2. The other three (*Practitioners of inner work*, *Conscious creators*, *Community builders*) carry the same identity-card shape and probably need the same treatment, but doing them all in this PR exceeds the audit scope and crowds the review;
  3. Removing one card leaves a 3-card grid that the existing `practitioners-grid` CSS handles cleanly.
- **Carry-forward.** Logged in the decision log to revisit the remaining persona cards in revision area 4 (public copy).

### Homepage — Waitlist

#### 5. `homepage.html:1545` — Waitlist micro-copy

| | Before | After |
| --- | --- | --- |
| Note | No spam. Your data stays yours. | One quiet email at a time. The file we make together stays yours. |

- **Resolves:** Conflict 3 (defensive register; reassurance as stimulation).
- **Rule cited:** Charter §1 (the line was doing reassurance, which is a form of managing anxiety rather than reducing confusion); Charter §3 (match the user's register but not their charge — the old line presupposed worry about spam and met it on those terms).
- **Module cited:** Golden Thread Module B (Causes of suffering) — the upstream cause was *fear of loss*; the rewrite addresses it by describing the sanctuary, not by reassuring against intrusion.
- **Frame moved toward:** Sanctuary. *"The file we make together"* names what is actually happening — the member's first commitment is the beginning of a shared workpiece. *"Stays yours"* is preserved because it is plain, true, and short.
- **Anchor note.** *"One quiet email"* sits beside `beta_gate.html`'s *"held," "by invitation"* register without standing out as louder.

### Manifesto

#### 6. `manifesto.html:544` — Lede ending

| | Before | After |
| --- | --- | --- |
| Lede tail | …use technology without becoming owned by it, and build trust with others in a fragmented age. | …use technology without becoming owned by it, and build trust that is practised, not assumed. |

- **Resolves:** Conflict 10 (diagnosis-as-bait — *"a fragmented age"* names an enemy state and imports the fragmentation it names).
- **Rule cited:** Charter §3 (match the user's register but not their charge).
- **Module cited:** Golden Thread Module B — name what is being practised, not what is being escaped.
- **Frame moved toward:** Sanctuary, and the four modules' insistence that posture is practised, not declared.

#### 7. `manifesto.html:733` — *In practice* close on Relationship

| | Before | After |
| --- | --- | --- |
| Close | We treat trust as infrastructure. | Trust is what grows in the room; we make the room. |

- **Resolves:** Conflict 4 (system-as-trust-giver).
- **Rule cited:** Charter §5 (Nexus is not an authority; the relationship of value is between the member and the field of truth).
- **Module cited:** Golden Thread Module D — the line was subtly re-centering the platform. The rewrite returns the centre: trust arises in the room; CommonUnity is the room-maker, not the trust-supplier.
- **Frame moved toward:** Four-layer architecture — the **Field** is where trust ultimately rests, not the platform. *"We make the room"* names the platform's actual contribution.

#### 8. `manifesto.html:839` — Attention close

| | Before | After |
| --- | --- | --- |
| Close | CommonUnity treats attention as sacred infrastructure. To reclaim attention is to reclaim the conditions of creation. | CommonUnity treats attention as a practice, not a commodity. To return attention to oneself is to return the conditions of creation. |

- **Resolves:** Conflict 5 (*"sacred"* superlative; *"infrastructure"* claim; borrowed sanctity).
- **Rule cited:** Charter §7 (avoid superlatives).
- **Module cited:** Golden Thread Module C (Refining attention) — attention is *what we have to work with*, not *what is sacred about us*.
- **Frame moved toward:** the consume → live → serve arc names the second movement as *live* — practice is the cleanest noun for what attention becomes when it is treated rightly.
- **Verb note.** *"Reclaim"* was changed to *"return"* — *reclaim* carries a battle metaphor that re-imports the SaaS-critique charge. *"Return attention to oneself"* names the same act in stiller language.

#### 9. `manifesto.html:960` — Tools list, the Key entry

| | Before | After |
| --- | --- | --- |
| Entry | The CommonUnity Key — Protects the path through trust architecture: the person's pattern travels with them, and the system remembers without owning them. | The CommonUnity Key — Holds the path: the person's pattern travels with them, and the system remembers without owning them. |

- **Resolves:** Conflict 6 (protector posture; "trust architecture" as borrowed jargon).
- **Rule cited:** Charter §5 (the system facilitates; it does not protect *for* the member).
- **Module cited:** four-layer architecture — the system holds the room; it does not protect the path. The sentence already had its strongest clause (*"and the system remembers without owning them"*); the verb just needed to stop claiming custodial work.
- **Tonal anchor:** *"Holds"* matches `beta_gate.html`'s *"held."*
- **Parallel structure note.** The five-item tools list uses *Begins / Gives / Brings / Supports / Holds* — *Holds* fits the parallel verb shape without claiming protective authority.

---

## What this rewrite does **not** touch

Per audit scope and the working contract (one revision area per PR; pause for review):

- **`beta_gate.html` body copy** — the tonal anchor; stays untouched.
- **`manifesto.html:~605`** — *"…tools that strengthen self-knowledge, protect personal sovereignty, deepen community, and support the work of becoming more fully human."* — *protect* here serves the member's own faculty; it survives.
- **`manifesto.html:~920`** — *"…more coherent lives, more honest work, more sovereign digital presence, and more trustworthy forms of community."* — qualities placed on the member's life; survives.
- **The remaining three persona cards** on the homepage (*Practitioners of inner work*, *Conscious creators*, *Community builders*) — they share Conflict 2's pattern and are likely candidates for retirement or arc-shaped rewriting in revision area 4 (public copy). Carried forward via the decision log.
- **The CommonUnity *Key* → *Cipher* migration** — *Key* is the canonical word in member-facing surfaces today and *Cipher* is the canonical word in foundation docs. Reconciling that vocabulary is its own revision area, not a trust-messaging fix.
- **Homepage L1370-1371** — *"trust architecture for conscious technology"* — carries the same charge as Conflict 6 but was not flagged in the audit's strings inventory. Logged for inclusion in the audit v0.3 or in revision area 4.
- **Homepage L1432-1435** — *"split between inner truth and outer livelihood…fragmented digital world. Build your field, not just your profile."* — carries the same charge as Conflict 10. Logged for inclusion in the audit v0.3 or in revision area 4.
- **Homepage L1562 footer** — *"Your data stays yours."* — carries the same charge as Conflict 3. Logged for inclusion in the audit v0.3 or in revision area 4.

These were noticed during the rewrite pass and are listed here so the next audit refresh has them.

---

## Self-check, applied across the set

Run against the seven questions in Charter §11:

1. **Does this reduce confusion?** Each new line names a condition or a fact; none introduces a new abstraction.
2. **Have I told the user what to think, or invited them to look?** No new sentence tells the reader what to feel. *"Stays with you," "kept or set aside on your terms," "the file we make together"* describe what is true.
3. **Am I making myself the centre?** *"We make the room"* and *"holds the path"* deliberately place the platform alongside the member's work, not in front of it. *"Read the same Key"* removes the anthropomorphism that put the toolset in the seer position.
4. **Is there any shaming, flattery, or inflation?** No. The retired persona card was the strongest flattery vector on the page; it is gone.
5. **Could this be shorter without losing the gesture?** Every replacement is the same length or shorter than the original. The waitlist line is the only one that is comparable in length; the rest are tighter.
6. **Did I use Sanskrit, jargon, or doctrinal language?** *Local-first, sovereign, vendor lock-in, hostage data, sacred infrastructure, trust architecture, fragmented age* are all removed. No Sanskrit was ever a candidate here.
7. **Does this leave the user more sovereign?** The reader of the new copy is not invited into a tribe (persona card retired), not reassured against an enemy (no spam → quiet email), not told what the system protects them from (holds, not protects). The sovereignty is structural in the language, not declared as a feature.

The rewrite passes.

---

## Next

This is **revision area 1 of six**. After this PR is reviewed and merged:

- **2. Studio vocabulary** — the next audit.
- 3. Gene Keys positioning.
- 4. Public copy at large (including the carried-forward items above).
- 5. Onboarding / Compass intake.
- 6. Nexus default prompts.

Each pass follows the same shape: audit → rewrite-drop → one revision area per PR → cite Charter rule for each non-obvious change → pause for review.

---

See also:

- [`../audits/trust-messaging-audit.md`](../audits/trust-messaging-audit.md) — the audit this rewrite executes.
- [`../../foundation/nexus-guidance-charter.md`](../../foundation/nexus-guidance-charter.md) — the rules cited above.
- [`../../foundation/om-field-golden-thread.md`](../../foundation/om-field-golden-thread.md) — the four modules cited above.
- [`../../foundation/four-layer-architecture.md`](../../foundation/four-layer-architecture.md) — sanctuary clause and consume → live → serve arc.
- [`../../foundation/nexus-voice-samples.md`](../../foundation/nexus-voice-samples.md) — register the new strings sit beside.
