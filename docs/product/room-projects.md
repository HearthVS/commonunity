# Projects in the rooms — proposal

_Status: proposal, 2026-10-10. Not a decision yet. Builds on [`rooms-and-digit.md`](./rooms-and-digit.md) ("stUdio is the workspace", "deeper, not wider", "the rooms are the connective tissue") and [`digit.md`](./digit.md)._

## The idea

A person's ongoing pieces of work should live **inside the four rooms of stUdio**, as projects they can see, return to, and pick up with Digit — not in separate tools, folders, or apps elsewhere.

## Where it came from

While building other things, the maintainer started a personal side project: cleaning up a portfolio of a couple of dozen domain names (which to keep, redirect, sell, or let lapse; renewals coming due; what each name currently does). To keep it going across sessions, three things had to be made by hand outside CommonUnity:

1. **A place you can see** — a folder pinned in the file manager and a session pinned in the sidebar, so the work reminds you it exists.
2. **A record that carries the context** — a short handoff note (where things stand, open questions, next steps) that the next working session reads first.
3. **Artifacts** — a spreadsheet inventory, with the person's own decisions in clearly marked columns.

The maintainer's reaction was that this kind of work belongs in stUdio, using the rooms already built. This note records that.

## How it maps onto stUdio

| Made by hand | In stUdio |
|---|---|
| A visible folder / pinned session | A **project card** in a room, visible whenever you enter it |
| The handoff note | The project's **record**: status, open questions, next steps, decisions taken. Digit reads it on arrival |
| The spreadsheet | The project's **artifacts**, downloadable, with the person's decisions kept apart from Digit's suggestions |
| "Renewals due in November" | **Dates** on the card (due, renew, follow up) |
| Checks run during the work (lookups, research, building the table) | **Room verbs** Digit can use for that project |

The domain clean-up would sit in **The Work** (building, business). The same shape fits every room:

- **The Lens** — a long piece of writing, a course being studied.
- **The Work** — a business task, an asset clean-up, a launch.
- **The Field** — a practice or relationship being tended over time.
- **The Call** — a mission statement or vocation question worked on over weeks.

## Principles it must keep

- **The record belongs to the person.** Continuity comes from a record the person can read, edit, and carry (a natural fit for the CommonUnity Key), not from hidden AI memory. This keeps `rooms-and-digit.md`'s rule intact: Digit has no enduring memory across projects; the rooms — and the records in them — hold the arc.
- **Suggestions and decisions stay separate.** Digit proposes; the person decides, and the record shows which is which.
- **Room verbs, not raw build powers.** Member-facing Digit gets bounded verbs per room ("look these up", "make a table", "draft the listing"), never shell, code, or infrastructure access. This is the internal-builder vs member-facing DIGIT line in [`CLAUDE.md`](../../CLAUDE.md) §5.
- **Private by default.** A project's record and artifacts are private to the person unless they choose to surface something on hOMe through the Workbench.

## Open questions

1. Is a project a new object, or a section of a room (the existing room/section abstraction)?
2. Where do records and artifacts live — server-side, in the Key, or both (Key as the portable copy)?
3. How do dates surface — on the card only, or as reminders?
4. Which room verbs come first, and which room opens first? (Build order is still open per `rooms-and-digit.md`.)
5. Can one project span rooms, or does it always have a home room?

## Next step

Discuss and decide before any build. If accepted, record the decision in [`../governance/decision-log.md`](../governance/decision-log.md) and run the milestone integrity audit when the first room gets projects.
