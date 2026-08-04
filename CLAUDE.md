# CLAUDE.md — Operating Agreement for Claude Code in CommonUnity

This file is the operating agreement for AI-assisted development in this repository. It is authoritative for *how* Claude Code works here. It does not restate product or architecture content — that lives in `/docs`.

## 1. Source of truth

- **GitHub `/docs` is the canonical source of truth.** Anything that must remain true across threads, sessions, and contributors lives there. See [`docs/README.md`](docs/README.md).
- The authoritative architecture brief is [`docs/foundation/commonunity-architecture-v0.2.md`](docs/foundation/commonunity-architecture-v0.2.md). The four-layer model is [`docs/foundation/four-layer-architecture.md`](docs/foundation/four-layer-architecture.md).
- Notion is a drafting workspace, not source of truth. Railway is observational (the live system), summarised in [`docs/architecture/deployment-model.md`](docs/architecture/deployment-model.md).
- When a fact changes, update the relevant `/docs` file **and** add a line to [`docs/governance/decision-log.md`](docs/governance/decision-log.md).

## 2. Repository and services

This is a monorepo. Root of the repo is `/Users/markuslehto/commonunity` (the `data/` subdirectory is reference data only).

| Service | Path | Stack | Deploys from branch |
| --- | --- | --- | --- |
| Main CommonUnity (root + Studio + Nexus AI) | repo root (`server.py`, `studio.html`, …) | FastAPI + static | **`main`** |
| cOMmons (public Living Profiles) | `field/` | Node + Express + SQLite | **`field-phase-1`** |
| Tuner (sound healing) | `tuner/` | Node + Vite + React + SQLite | (its own Railway service) |

Hosting is **Railway** (project `balanced-illumination`, env `production`), fronted by **Cloudflare** at the edge, with **GoDaddy** as domain registrar / DNS forwarder. Do not touch GoDaddy email records (MX/SPF/DKIM/DMARC).

## 3. Deploy branches

- The root CommonUnity service deploys from **`main`**.
- The cOMmons service deploys from **`field-phase-1`**.
- Do all work on a **feature branch** and open a PR. Do not commit directly to `main` or `field-phase-1`.
- Do not improvise deployment paths (manual Railway pushes, force-deploys) unless explicitly approved for that task.

## 4. Definition of done

A task is **not** complete because code merged. It is complete when:

1. the change is merged into the correct deploy branch (§3),
2. the established Railway auto-deploy has run for that branch,
3. **the exact merged commit is verified live** on the appropriate Railway URL / health endpoint, and
4. for any new or redefined surface, the milestone integrity audit has been run (see §7).

If a step could not be completed (e.g. no deploy access in this session), say so plainly and hand off the remaining steps — do not report the task as done.

## 5. Operating mode

- Claude Code operates here in **internal builder mode only** — it builds CommonUnity itself, for the maintainer and trusted internal operators. It is not the user-facing DIGIT experience.
- There is a planned distinction between this internal builder mode and a future **user-facing DIGIT mode** (narrower, curated, no raw code/build capabilities by default). This file governs the internal mode. Do not blur the two.

## 6. Scope discipline for AI-initiated changes

- Prefer **narrow, reviewable, reversible** slices over broad refactors. One coherent change per PR.
- **Do not launch broad code audits** unless truly necessary; the maintainer is credit-conscious. State an explicit scope and acceptance criteria before large inspection passes.
- **Reuse before rebuild.** Extend existing routing, components, storage, and deployment rather than inventing parallel systems.
- **Do not rename core CommonUnity concepts** (stUdio, Nexus, DIGIT, Cipher/sigil, Fieldprint, Personal hOMepage, cOMmons, the four rooms, Compass, Om Cipher, Living Profile) casually. Renames require an explicit decision-log entry.
- **Confirm before consequential or hard-to-reverse actions**: schema/data changes, deletions, destructive git operations, deploys, anything outward-facing.
- **Never commit secrets, tokens, or keys** — not in code and not in `/docs`. Public URLs and service names are fine.
- Use `/docs` files and handoffs for long structured work rather than pasting everything into chat.

## 7. Governance

- New or redefined surfaces and significant scope changes run the **milestone integrity audit** ([`docs/governance/audit-rituals.md`](docs/governance/audit-rituals.md)) before merge, recorded via [`docs/governance/integrity-review-template.md`](docs/governance/integrity-review-template.md).
- Every significant decision gets a one-line entry in [`docs/governance/decision-log.md`](docs/governance/decision-log.md).
