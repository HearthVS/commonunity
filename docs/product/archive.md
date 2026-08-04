# Archive (and AI Ambience)

Status: v0.1 canonical. Distilled from [`../source-material/ai-ambience-design-direction.pdf`](../source-material/ai-ambience-design-direction.pdf) (+ `.txt`). Substantially **already in flight** in code — see *Implementation status* below.

> Core shift the source names: CommonUnity is not trying to become a more capable AI app. It is trying to become **a human orientation system in a world where intelligence becomes ambient.** The question is no longer *"what can Nexus process?"* but *"what should intelligence touch, what should simply be remembered, and what should remain held?"*

## The four surfaces

| Surface | Role |
| --- | --- |
| **cOMpass** | **orients** the field — threshold, direction, identity, consent, inner alignment |
| **stUdio** | **works** the field — turns fragments into forms, reflections into artifacts, questions into maps |
| **Archive** | **remembers** the field — preserves continuity without forcing everything into the present |
| **Field Recorder** | **captures** the field — catches phrases, sounds, photos, dreams, sensations, fragments before they know what they want to become *(net-new surface; future — see below)* |

## Archive is not a feed

Archive is **continuity**, not a drawer of files, a searchable dumping ground, or a productivity inbox. Its purpose is to let material be stored, retrieved, revisited, and **re-understood across time** — protecting depth, not creating another attention surface.

- **Quiet by default** — does not visually compete with Field Observations or Nexus.
- **Remember, do not demand** — holds material without constantly asking the user to act.
- **Temporal depth** — supports revisiting and re-understanding, not just sorting by file type.
- **Consentful activation** — material becomes active only when selected, opened, prepared, or invited into Nexus.
- **No feed behaviour** — no endless scroll, novelty bias, unread badges, or engagement-style signals.

## The material state loop

Material moves through explicit, consentful states. These are not only data states — they are **experiential** states; each changes the human relationship to the material.

```
Capture → Held → Prepared → Offered → Worked → Returned
```

1. **Held** — captured and remembered. Not processed, not interpreted, not in Nexus. *(Preserves agency: memory without action.)*
2. **Prepared** — text extracted, audio transcribed, or image described. Still not interpreted; the human can review, edit, discard, or keep. *(Clarity without interpretation.)*
3. **Offered** — the user intentionally selects material and offers it to Nexus. Nexus sees it because it was invited. *(Marks consent.)*
4. **Worked** — Nexus has reflected, interpreted, mapped, or transformed it into an artifact/insight/map/next action. *(Intelligence enters relationship.)*
5. **Returned** — the worked material returns to Archive as continuity; the system remembers what happened without forcing it into the active field forever. *(Continuity after the active moment.)*

This loop — *Capture → Hold → Prepare → Offer → Work → Return* — is the CommonUnity alternative to *Upload → Process → Chat*. Some material is meant to remain held; some prepared; some interpreted; some released.

## AI ambience — present, not dominant

The right ambience is neither hidden automation nor a noisy assistant. Nexus (and DIGIT) should feel like an **ambient intelligence that becomes available when invited.**

- **Good ambience:** *"I am here when you are ready." · "This can be held without being processed." · "This can be prepared before interpretation." · "This can remain private." · "You can ask me to look when the time is right."*
- **Bad ambience:** *"I summarised this for you automatically." · "I found patterns in everything you uploaded." · "Here are suggestions before you asked." · "Your archive is full of tasks." · "Everything is available to AI by default."*

## Preparation is not interpretation

- **Preparation** (no AI needed): PDF text extraction, audio transcription, OCR, file-type detection, basic cleanup.
- **Interpretation** (Nexus / DIGIT): *what pattern is here? what is this asking of me? how does this relate to my room? what wants to become artifact? what should be shared, held, or forgotten?*

The UI must **name what actually happened** — "Text extracted," "Audio transcribed," "Image described," "Material offered," "Pattern reflected," "Artifact generated" — never a flat "AI processed this."

## The Archive action layer is an invitation, not a toolbar

Instead of *"What do you want to do with these files?"*, the CommonUnity framing is **"How would you like to meet this material?"** (or *"What kind of attention does this need?"*). Actions group by depth:

- **Remember** — keep held, add note/context, group into bundle, mark private, mark not-for-processing.
- **Prepare** — extract text, transcribe audio, describe image, clean formatting, create review text.
- **Offer to Nexus** — bring selected text forward, ask Nexus to reflect / map patterns / turn into artifact / say what kind of attention this needs.
- **Release** — hide from active room, archive quietly, delete, mark "not for processing."

Selection is framed as **choosing what enters the field** — "**Bring forward**" is the canonical phrase. This makes Archive an *ethical interface*, not a file manager.

## Nexus (and DIGIT) relation to Archive

Nexus does **not** "scan the Archive." It **meets what is offered.** It may know Archive exists and *ask for consent* — *"I can work with material from your Archive if you choose what to bring forward." · "This PDF has been extracted. Would you like me to reflect on it?"* The boundary:

> **Archive remembers. User chooses. Nexus interprets.**

This applies equally to **DIGIT** — it composes from material the user has brought forward, never from a silent scan. It is the Archive-side expression of [`../governance/external-ai-boundary.md`](../governance/external-ai-boundary.md).

## Design principle — intelligence present, not dominant

Every stUdio/Archive decision should pass:

- Does this make AI **louder**, or help the human **hear clearly**?
- Does this **preserve** attention, or **harvest** it?
- Does this **deepen continuity**, or merely **accumulate** data?
- Does this **invite participation**, or **automate discernment away**?
- Does this respect what should remain **private, sacred, unresolved, or unprocessed**?

*"CommonUnity should not make AI louder. It should make the human field more legible, more sovereign, and more alive."*

## Implementation status (as of 2026-08-04)

This model is **not greenfield** — it is substantially implemented in two open PRs. Reconcile with them before building further:

- **[#98](https://github.com/HearthVS/commonunity/pull/98)** — Archive selection model; standard **PDF text extraction with no AI** (`pypdf`, member-scoped `field_observation_extractions`); intentional **"Bring selected text to Nexus"** that is *populate-only* (never auto-sends, never calls the model). Realises the *Prepared* and *Offered* states and the preparation-vs-interpretation boundary.
- **[#102](https://github.com/HearthVS/commonunity/pull/102)** — Field Observations as the central surface with depth modes **Now · Remembered · Prepared · Offered · Worked**; Archive as a compact **memory index** with live counts; the language reframing (*"How would you like to meet this material?"*, *"Bring forward" / "Offer to Nexus"*). Populate-only Nexus handoff preserved.

**Naming reconciliation:** #102's *Remembered* = this doc's **Held**; *Now* = the capture surface (pre-Held). **Not yet built:** the **Returned** state (worked material flowing back to Archive as continuity — a P1 item), and the **Field Recorder** mobile capture surface (P2). An internal "protocol families" lens (diagnostic / holding / preparation / offering / reflective / generative / return) may be carried in code/metadata, not shown in the UI.

---

Related: [`./studio.md`](./studio.md), [`../governance/external-ai-boundary.md`](../governance/external-ai-boundary.md), [`../foundation/ai-roles.md`](../foundation/ai-roles.md), [`../handoffs/digit-build-brief.md`](../handoffs/digit-build-brief.md). Full source: [`../source-material/ai-ambience-design-direction.pdf`](../source-material/ai-ambience-design-direction.pdf).
