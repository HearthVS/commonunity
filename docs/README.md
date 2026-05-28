# CommonUnity Documentation

This `/docs` tree is the living archive of the CommonUnity SDK and product system. It captures the philosophical foundation, the architecture, the product layers, and the governance rituals that hold the system in integrity as it grows.

> CommonUnity is a developmental ecosystem for helping a person translate their source pattern into lived creation, public expression, and relational unity.

## How the documentation system works

Three surfaces, one source of truth.

| Surface | Role | Use it for |
| --- | --- | --- |
| **GitHub** (`HearthVS/commonunity`) | Source of truth | Canonical docs, versioned history, decisions, code. Anything authoritative lives here under `/docs`. |
| **Notion** | Human workspace | Drafting, discussion, facilitation notes, working sessions, Compass intake material that has not yet been distilled. Notion is where thinking happens; GitHub is where it lands. |
| **Railway** | Deployment / runtime reference | The live system. URLs, service IDs, environment configuration, deployment state. Treated as observational — `docs/architecture/deployment-model.md` summarises what is true on Railway today. |

The rule of thumb: **if it must remain true across threads, sessions, and contributors, write it down in `/docs`.** Notion drafts and Railway state can move; GitHub is the stable ground.

## Map of /docs

```text
/docs
  README.md                              ← you are here
  /foundation                            ← philosophy, principles, the seed pattern
    commonunity-architecture-v0.2.md     ← canonical architecture brief (authoritative)
    philosophical-principles.md
    adapted-8-limbs.md                   ← decision + audit framework
    om-field.md
    om-field-golden-thread.md            ← Sutra-rooted framework for the OM Field
    four-layer-architecture.md           ← Field → Orientation → stUdio → Cipher (added in PR #50)
    nexus-guidance-charter.md            ← behavioural rules for Nexus
    codex-golden-thread.md               ← compressed codex entry, primary retrieval
    om-cipher.md                         ← foundational framing of the cipher
  /architecture                          ← how the system is built
    system-map.md                        ← layers and their relationships
    app-map.md                           ← surfaces (Studio, cOMmons, Personal Home, ...)
    data-model.md                        ← Om Cipher + Living Profile + Field data
    deployment-model.md                  ← Railway, domains, services, SMTP
  /product                               ← member-facing layers
    compass.md
    om-cipher.md                         ← product surface of the cipher
    om-cipher-v1-implementation-plan.md  ← canonical v1 build plan (incl. Bhramari)
    living-profile.md
    studio.md
    commons.md
    personal-homepage.md
  /governance                            ← keeping the system honest
    decision-log.md
    audit-rituals.md                     ← milestone integrity audit via adapted 8 limbs
    milestone-checklist.md
    integrity-review-template.md
  /handoffs                              ← thread-to-thread continuity
    next-thread-handoff.md
```

## The canonical reading order

If you have never read these docs before, read in this order:

1. `foundation/commonunity-architecture-v0.2.md` — the authoritative architecture brief. Everything else is a refraction of this.
2. `foundation/philosophical-principles.md` — the orienting commitments.
3. `foundation/adapted-8-limbs.md` — the framework used to decide what to build and to audit what was built.
4. `architecture/system-map.md` — how the five layers fit together.
5. `product/*` — each member-facing surface, in the order of the member journey.
6. `governance/audit-rituals.md` — how we keep the system aligned.

## Status and stability

| Folder | Status |
| --- | --- |
| `foundation/commonunity-architecture-v0.2.md` | **Canonical.** Treat as source of truth. |
| `handoffs/next-thread-handoff.md` | **Canonical for current state.** Snapshot of live URLs, services, recent commits. |
| Everything else | **v0.1 stubs.** Meaningful but incomplete. Point back to the architecture brief when in doubt. |

Stubs are intentional. The architecture brief is rich enough that we did not want to fabricate detail elsewhere. Stubs name the surface, state what is known, and link to the canonical doc.

## Conventions

- Write in plain Markdown. No emojis unless the surface itself uses them.
- Cross-link liberally with relative paths.
- When a fact changes, update the doc and add a line to `governance/decision-log.md`.
- When a new surface or major direction is added, run the milestone integrity audit (`governance/audit-rituals.md`) before merging.
- Do not put secrets, tokens, or keys in `/docs`. Names of services and public URLs are fine; credentials are not.

## Audience

These docs are written for:

- **The system steward** (current maintainer) holding continuity across threads.
- **Future contributors** picking up the work cold.
- **Facilitators** who run Compass sessions and need to understand what the software does with the source-data they help produce.
- **Members**, when a section is explicitly marked as member-facing.

If a doc cannot be understood by someone in one of these four roles without further context, it needs to be rewritten.
