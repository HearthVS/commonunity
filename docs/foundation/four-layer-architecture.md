# Four-Layer Architecture

Status: v0.1. Foundation document. Internal-precision; not member-facing as a model, though several of its terms (Cipher, stUdio) are already in member-facing surfaces.

This document names the canonical four-layer model of CommonUnity. It is the structural complement to [`./om-field-golden-thread.md`](./om-field-golden-thread.md) — the Golden Thread is the *horizon*; the four layers are the *architecture* through which the horizon meets a person.

Every feature, every doc, every piece of copy belongs to one of these four layers. When work cannot be placed in a layer, the work is probably premature or misshaped.

---

## The four layers

### 1. OM Field / Golden Thread

The universal, timeless field. The Yoga Sutras of Patanjali are named as a primary articulation of this field; other timeless sources may be added by explicit decision (see [`../governance/decision-log.md`](../governance/decision-log.md)).

This layer is **impersonal**. It does not belong to CommonUnity, to any teacher, to any tradition exclusively. CommonUnity points at it; it does not contain it.

- Lives in: the orientation, the tone of Nexus, the Charter, the audit framework.
- Surfaced to members as: *nothing directly*. The field is implicit in everything; never named as doctrine.

See [`./om-field-golden-thread.md`](./om-field-golden-thread.md).

### 2. Orientation

The maps and lenses that show how the field folds into a person's unique pattern. Orientation is what makes the field **personal without making it identity**.

Current lenses inside Orientation:

- **OM Cipher** — the canonical engine and the personal glyph (see below; the Cipher *is* the sigil).
- **Gene Keys** — the 64-key symbolic vocabulary.
- **Human Design** — complementary symbolic system.
- **Compass** — the facilitated relational practice that walks a member through their first turns of clearer seeing.
- **Tissue salts** — twelve archetypal crystal geometries derived rationally from birthdate; lives *inside* the OM Cipher rendering, not as a separate lens (see §"Tissue salts inside the Cipher" below).

Lenses can be added to Orientation by explicit decision. The test for inclusion: does the lens **refract the field** through a person's pattern without claiming to *be* the field, and does it integrate cleanly into the Cipher engine or sit beside it without contradiction?

- Lives in: Compass intake, the Cipher rendering, the Living Profile.
- Surfaced to members as: their personal Cipher and its readable layers.

### 3. stUdio

The user's inner workspace — *"YOU"*. The room where a person brings their inner landscape into form through sketches, notes, reflections, sound, and practice.

stUdio is the only layer where the relationship is between the **member and their own work**. The system holds the room; the member does the work.

- Lives in: `studio.html`, the threshold ritual, the Bhramari capture.
- Surfaced to members as: Studio.

See [`../product/studio.md`](../product/studio.md).

### 4. Cipher

The personal glyph that crystallises a member's relationship with the field at a given time.

The Cipher is the visible expression of the Orientation layer. It is what a member can point at and say *"this is the pattern, as it stands."* It is not who they are.

**Naming note for contributors:** Some internal modules and earlier docs use the word *"sigil"* (e.g. `sdk/sigil.js`, `field/src/sigil.js`, the `cell-salts-sigil-layer.test.js`). *Sigil* and *Cipher* refer to the same thing: the glyph rendered for a person. The canonical word, in this document and in all member-facing surfaces, is **Cipher**. Internal engine module names may continue to use *sigil* for historical reasons; no rename is required.

- Lives in: the OM Cipher rendering engine.
- Surfaced to members as: their Cipher, on cOMmons cover, Personal Home, and inside Studio.

See [`./om-cipher.md`](./om-cipher.md) and [`../product/om-cipher.md`](../product/om-cipher.md).

---

## How the layers relate

The layers are not a stack the user climbs. They are **concentric**:

- Field is everywhere, always.
- Orientation is how the field becomes legible *to this person*.
- stUdio is where the person works *with what becomes legible*.
- Cipher is the symbol that *holds the shape of the work at a given moment*.

A member never has to know about the four layers. Contributors do.

When a design question arises about where a piece of work belongs, the answer is one of these four. If two layers could plausibly hold it, the work is probably doing two things and should be separated.

---

## Tissue salts inside the Cipher

The twelve Schuessler tissue salts are now an Orientation lens **inside the OM Cipher**, not a separate lens parallel to Gene Keys.

- They are derived rationally from birthdate.
- Each salt carries an archetypal crystal geometry (symmetry, bond motif, node density) which the Cipher engine projects as a faint inner layer under the OM halo and Compass.
- Implementation: `sdk/cell_salts.js`, `field/src/cell_salts.js`, with assignment, Compass payload flow, panel rendering, and Cipher-layer tests covered in `tests/cell-salts-*.test.js`. The module names use *cell salts* for historical SDK naming; the canonical word in docs and member-facing surfaces is **tissue salts**.
- Member-facing treatment: a toggle area inside the OM Cipher panel. The member reads it and becomes aware of it as *another rational layer determined from birth details* — described in plain, symbolic, somatic language.
- Future use: tissue salts may inform resonance-based connection between members. For now, the contribution stops at the personal Cipher rendering and the readable explanation.

The framing in copy is **symbolic, somatic, contemplative**. Not medical guidance. The style of the writing carries this; no disclaimer is required. The code's own header comment reads *"Symbolic / somatic / contemplative. NOT medical advice."* — that is the register, internalised.

---

## Sanctuary

CommonUnity is a sanctuary. This is named here because it is a structural commitment, not a feature.

- A member can bring their reflections, contradictions, and unfinished thinking into the system without fear that what they say will be used against them.
- Reflections live in the member's own personal storage. They are not harvested for external models or external optimisation.
- Nexus treats what a member shares the way a confessional treats what is spoken: held, not extracted; useful to the member's path, not to any other purpose.
- The implication for copy: trust messaging does not need to *reassure* the member about extraction. It needs to *describe the conditions of the sanctuary* in plain terms. The member is the one who decides what stays and what goes.

This is the positive frame that the trust messaging rewrite (see [`../handoffs/audits/trust-messaging-audit.md`](../handoffs/audits/trust-messaging-audit.md)) calibrates against.

---

## The arc: consume → live → serve

CommonUnity is for people coming **from** a long history of *consuming wisdom* — books, talks, courses, retreats, frameworks — and arriving at the question whose old methods cannot answer it: *who am I?*

The product is structured around an arc:

1. **Consume.** What a member has done already. CommonUnity does not add more of this. It does not push content, lectures, or doctrine. The Sutras are framework, not curriculum (see [`./om-field-golden-thread.md`](./om-field-golden-thread.md) §5).
2. **Live.** What stUdio is for. The inner work becomes form. Practice, reflection, embodiment. The path is the practice, not the reading about the practice.
3. **Serve.** What cOMmons becomes. Once a member has seen enough, they have something to give. Service is not a feature — it is what living the work for long enough quietly produces. cOMmons is built to honour this without forcing it.

The arc is **not a funnel**. Members do not "graduate" from one stage to the next. The three states cycle through a life; CommonUnity makes room for all three.

This is the philosophical reason the Cipher exists once and is the same across surfaces: the same person at all three stages is recognised by the same pattern.

---

## What this document is not

- **Not a UI map.** The surfaces (Studio, cOMmons, Personal Home, Threshold) are mapped in [`../architecture/app-map.md`](../architecture/app-map.md). This document is the layer *underneath* the app map.
- **Not a feature roadmap.** Features still belong to milestones; this is the framework that decides whether a feature is well-placed.
- **Not member-facing as a model.** A member never reads *"there are four layers."* They read their Cipher, walk their Compass, work in their Studio, and feel the field. The four-layer language is for contributors.

---

## How this document is used

- **By the audit ritual** in [`../governance/audit-rituals.md`](../governance/audit-rituals.md): every piece of work must place cleanly in one layer. The eight limbs are then walked against that placement.
- **By the product team**: when scoping a feature, name the layer first. Then ask the Golden Thread questions. Then walk the eight limbs.
- **By the trust messaging rewrite and the other five revision areas**: the sanctuary clause and the consume → live → serve arc are the positive frames the rewrites calibrate against, alongside the Charter.

---

See also:
- [`./om-field-golden-thread.md`](./om-field-golden-thread.md) — the field this architecture serves.
- [`./nexus-guidance-charter.md`](./nexus-guidance-charter.md) — how Nexus behaves inside this architecture.
- [`./codex-golden-thread.md`](./codex-golden-thread.md) — compressed codex entry.
- [`./philosophical-principles.md`](./philosophical-principles.md) — orienting commitments.
- [`./adapted-8-limbs.md`](./adapted-8-limbs.md) — decision and audit framework.
- [`./om-cipher.md`](./om-cipher.md) and [`../product/om-cipher.md`](../product/om-cipher.md) — the canonical engine and the member-facing surface.
- [`../handoffs/audits/trust-messaging-audit.md`](../handoffs/audits/trust-messaging-audit.md) — the first revision area, calibrated against this document.
