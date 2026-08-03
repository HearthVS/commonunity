# Fieldprint and the Personal hOMepage

Status: v0.1. Canonical source: [`../foundation/commonunity-architecture-v0.2.md`](../foundation/commonunity-architecture-v0.2.md). Companion: [`./personal-homepage.md`](./personal-homepage.md).

This document draws one boundary that the current codebase leaves implicit: the boundary between the **private editing stage** and the **published public result**.

## The two stages

```text
stUdio → [ Fieldprint ] → publish → [ Personal hOMepage ] → cOMmons
          private edit             public result
```

### Fieldprint — the private edit/composition stage

**Fieldprint** is the last editing and composition stage *inside* stUdio. It is private, working, and revisable. It is where a member (and, later, DIGIT acting on the member's behalf) shapes the material — content, arrangement, the Cipher's placement — before anything is shown to the world.

- Private to the member.
- Editable, iterative, reversible.
- Lives inside stUdio (today: the homepage builder / "Website Preview" path in `homepage.html`).

### Personal hOMepage — the published public result

The **Personal hOMepage** is the published, public-facing result generated *from* the Fieldprint. It is the face the member shows the world — their public refraction of Om Cipher + Living Profile. Its content, structure, and current state are described in [`./personal-homepage.md`](./personal-homepage.md).

- Public.
- A generated output of the Fieldprint, not an independently edited surface.
- Sits between stUdio and cOMmons in the member journey.

## Why the boundary matters

Today the codebase conflates both stages under a single "Personal Home Page" / "Website Preview" path. Naming the boundary keeps two things clear:

1. **Edit vs. publish are different acts.** Work in the Fieldprint is private and safe to be unfinished; publishing to the Personal hOMepage is a deliberate, outward act.
2. **It gives DIGIT a precise home.** When DIGIT becomes a builder inside stUdio, its building and editing happen in the **Fieldprint**; *publishing* produces the **Personal hOMepage**. DIGIT does not silently publish — publishing remains a member-confirmed step. (Full DIGIT framing is deferred to a follow-up `docs/product/digit.md`; this doc only fixes the stage boundary.)

## Relationship to the four layers

In the [four-layer model](../foundation/four-layer-architecture.md): Fieldprint is an activity **within the stUdio layer**; the Cipher rendered on the Personal hOMepage is the **Cipher layer** made public. Fieldprint is where stUdio work is composed for publication; the Personal hOMepage is where the composed result meets the world.

## Open work

- Reflect the Fieldprint (private edit) vs Personal hOMepage (published) distinction in the stUdio homepage-builder surface, which currently presents them as one path.
- Follow-up `docs/product/digit.md` will define how DIGIT operates inside the Fieldprint (orient → plan → act → review → publish), with publishing as an explicit member-confirmed step.
