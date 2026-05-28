# Vocabulary Governance — Admin-Panel Spec

Status: v0.1. Product spec. Founder-initiated 28 May 2026, after three passes of reclassification on the Studio vocabulary audit (PR #53) made the underlying mechanism explicit.

A one-page spec for the *living vocabulary surface* — an admin-panel feature that turns ongoing vocabulary maintenance from a periodic audit-and-rewrite cycle into a continuous, queue-driven, founder-decided governance flow. Foundation as floor, not ceiling. Charter as a default the project overrides by use.

---

## 1. Why this exists

CommonUnity is doing something new. Some terms in active use — *co-emergence*, *trust architecture*, *authentic digital self*, *Cipher*, *OM Field* — are founder-introduced; they do load-bearing work no existing word does cleanly. Others (*sacred*, *chakra*, *frequency*, *energy*, *ON AIR*) are retained from neighbouring traditions because they earn their place. Others still (*sigil*, *vibe* in some surfaces, *Unlocks when…*) are flagged as candidates for refinement.

Three observations make the case for governance:

1. **Vocabulary is alive.** Some terms become canonical over time; some drift; some get replaced. A static Charter cannot represent this.
2. **Decisions are recurring.** The same string can be re-flagged by an audit, a contributor, or a member at different points in time. Without a memory, each re-flag re-litigates the same decision.
3. **Founder voice is the source.** The Charter is not authored by committee. New terms enter through founder decision; retentions are founder decisions; refinements are founder decisions. The admin panel is the surface where those decisions are made and recorded.

The current alternative — pull requests against the Charter doc every time vocabulary shifts — works but is heavy. The audit-and-rewrite cycle (PRs #49, #52, #53) caught a lot in one pass and surfaced the pattern, but it is not the daily rhythm. The admin panel is.

---

## 2. What it is

A single admin-panel page — provisionally `/admin/vocabulary` — that displays a queue of flagged strings and provides a founder decision interface for each one.

**Core promise:** every string flagged anywhere in the system arrives here. Every decision the founder makes is durable, machine-readable, and writes both to a decision log and (where applicable) to the Charter / voice-samples / golden-thread foundation docs.

Not a content-management system. Not a CMS for editing the live site. The page does not edit strings directly — it produces *decisions* about strings, which are then applied by the audit-and-rewrite cycle (or, eventually, by automated PR drafts the founder reviews).

---

## 3. Sources of flags

The queue is fed by multiple inputs, all writing into the same data shape:

1. **Audit flags.** Items surfaced by a vocabulary audit (like Studio audit PR #53). Each item arrives with: file + line, the string, the Charter rule or pattern that flagged it, the audit author (agent), and the audit date. Existing audits become flag sources retroactively.

2. **Nexus self-check failures.** From Charter §11, the Nexus runs a seven-point self-check before each reply. When a draft reply fails the check on a vocabulary basis, the failing phrase and the failed check arrive in the queue (anonymised; the underlying conversation does not). This is the *system catching itself*; it is rare but high-signal.

3. **Member flags.** A small *"this doesn't sit right"* affordance on member-facing surfaces — likely a long-press or a context menu item — lets a member flag a string they encounter. The flag carries the string, the surface, and an optional one-sentence reason. Member identity is preserved internally (for follow-up) but not displayed in the queue by default.

4. **Contributor flags.** Anyone with admin/contributor access can flag a string from inside the admin panel itself, with a typed reason. This covers the case of a contributor noticing something during ordinary work.

5. **Drift detection (future).** A periodic scan can compare the current set of member-facing strings against the decision log; new strings that match a previously-retired pattern (e.g. *sacred X*, *vibe Y*, *unlocks Z*) get auto-flagged. v1 does this manually via audit; later automation lands here.

All five sources write to the same `vocabulary_flags` table / collection.

---

## 4. What each flag carries

```ts
type VocabularyFlag = {
  id: string;                    // ULID
  string: string;                // the verbatim string being flagged
  surfaces: Array<{              // every place it appears
    file: string;                // e.g. "studio.html"
    line: number;
    surface_name: string;        // e.g. "Studio Path modal lede"
  }>;
  source: "audit" | "nexus_self_check" | "member" | "contributor" | "drift_detection";
  source_ref: string;            // PR number, audit doc, member ID, etc.
  flagged_at: ISO8601;
  flagged_reason: string;        // Charter rule, pattern name, or free text
  proposed_alternatives: Array<{
    candidate: string;
    rationale: string;
    author: string;              // who proposed it
  }>;
  related_flags: Array<string>;  // ids of related items (e.g. same word in other surfaces)
  scope_hint: "single_surface" | "multi_surface" | "global";
  status: "open" | "in_review" | "decided" | "deferred";
};
```

---

## 5. The decision interface

When the founder opens a flag, they see:

- The string, with surface previews (rendered HTML where possible) showing it in context.
- The flag source and reason.
- Proposed alternatives, if any.
- **History** — every prior flag and decision on the same string or related family (e.g. *sigil* shows the trajectory *sigil → Key → Cipher*).
- A short Charter / Golden Thread cross-reference: which rules might apply, with the *frame-vs-conversation* scope distinction noted (Charter rules about pattern-language apply to Nexus replies, not framing copy).
- Four decision buttons:

```ts
type VocabularyDecision =
  | { kind: "retain"; rationale: string; scope: Scope; charter_amendment?: CharterEdit }
  | { kind: "refine"; replacement: string; rationale: string; scope: Scope; surfaces_to_update: Array<Surface> }
  | { kind: "remove"; rationale: string; scope: Scope; surfaces_to_update: Array<Surface> }
  | { kind: "hold"; until: ISO8601 | "indefinite"; rationale: string };

type Scope =
  | { kind: "single_surface"; surface: Surface }
  | { kind: "multi_surface"; surfaces: Array<Surface> }
  | { kind: "global"; exceptions: Array<Surface> };

type CharterEdit = {
  doc: "charter" | "voice_samples" | "golden_thread" | "four_layer_architecture";
  section: string;                    // e.g. "§3 Tone rules"
  proposed_diff: string;              // unified diff or before/after
  rationale: string;
};
```

Four decision kinds map exactly to the five resolution kinds from the audit cycle (with *replace word* and *replace phrase* collapsed into *refine*; *reframe paragraph* handled by the refinements PR cycle, not the queue).

---

## 6. What happens after a decision

1. **Decision is logged.** Writes to `docs/governance/decision-log.md` automatically — same format as current manual entries, but produced from structured data.

2. **Foundation doc is proposed for edit.** If the decision included a `charter_amendment`, the system drafts a small PR against the relevant foundation doc with the proposed diff. The founder reviews and merges; the doc is not edited silently.

3. **Surfaces are queued for update.** For *refine* / *remove* decisions with `surfaces_to_update`, a refinements PR is drafted (initially by hand, later automatically) that applies the change. The PR cites the decision id.

4. **Related flags are notified.** Other open flags on the same string are auto-resolved with a pointer to the canonical decision.

5. **Future flags are pre-warned.** When the same string is flagged again, the queue shows the prior decision and the founder can confirm-with-one-click or revise.

---

## 7. Data model

Two collections / tables.

**`vocabulary_flags`** — defined in §4. One row per flag.

**`vocabulary_decisions`** — one row per founder decision. Keyed by string + scope.

```ts
type VocabularyDecisionRecord = {
  id: string;                          // ULID
  string: string;
  decision: VocabularyDecision;
  founder_id: string;
  decided_at: ISO8601;
  flag_ids: Array<string>;             // every flag this decision resolves
  decision_log_entry_id: string;       // pointer into decision-log.md
  charter_pr_number?: number;          // if a Charter edit was proposed
  refinements_pr_number?: number;      // if surfaces were updated
  superseded_by?: string;              // if a later decision replaced this one
};
```

The two together give the *vocabulary trajectory* for any string: every flag it received, every decision made about it, every Charter edit it produced, every surface it shows up on.

---

## 8. Where it lives

- **Admin route.** `/admin/vocabulary` — admin-only, scoped to founder + designated contributors.
- **Data.** Two new collections in the existing storage layer. Same backup / sanctuary commitments as the rest of the system: data lives in member's own personal storage where applicable (member-flag identities), or in the project's governance store (everything else). No external optimisation.
- **Foundation docs.** Decisions write to `docs/governance/decision-log.md` and propose edits to `docs/foundation/*`. The foundation docs remain the source of truth for what the Charter currently says; the decision log remains the source of truth for how it got there.

---

## 9. v1 scope

The minimum useful version:

1. **The two tables.** `vocabulary_flags` and `vocabulary_decisions` defined and seeded with the items from PRs #49, #52, #53. Even without a UI, having the data makes the next audit lighter.
2. **A flagging affordance** in the admin panel — typed input, picks file + line + string. Manual for v1; member-facing affordance lands in v1.1.
3. **The decision interface** as described in §5.
4. **Automatic decision-log entry generation** — every decision writes a one-line entry above the marker in `decision-log.md`.

Deferred to v1.1+:

- Member-facing *"this doesn't sit right"* affordance.
- Nexus self-check integration (requires the Nexus to be wired into Charter §11 in code).
- Drift detection.
- Automated refinements-PR drafting.
- A Charter-edit-proposal flow that opens PRs without the founder hand-writing diffs.

---

## 10. Why this fits the architecture

The four-layer architecture names *Consume → Live → Serve*. Vocabulary governance fits the *Serve* layer: it is where the founder's lived vocabulary work becomes form that other contributors and the system itself can rely on. The Charter is the *Consume* layer for new contributors (they read it to understand the project); Studio is the *Live* layer (the work happens there); the admin panel is the *Serve* layer for vocabulary — it is where the founder's living decisions become legible to everyone else.

It also sits inside Sanctuary: member-flagged strings carry no penalty, no judgement of the member, and no public surface for member identity. The flagging affordance is *"this doesn't sit right for me"*, not *"this is wrong"*. The founder reads the flag without seeing the flagger by default; member identity is available only when the founder explicitly chooses to follow up.

And it sits inside the *foundation as floor, not ceiling* principle that the Studio audit reclassifications made explicit. The Charter is not the rulebook the panel enforces; the Charter is the *current state* of the founder's vocabulary commitments, updated by the decisions the panel produces. The relationship is bottom-up, not top-down.

---

## 11. Open questions for v1

1. **Scope language.** Should *Scope* be three kinds (single / multi / global) or more nuanced? The cross-surface divergence between PR #52 (manifesto) and Studio (PR #53) for *trust architecture* shows that *global* sometimes needs explicit exceptions per surface. Current spec handles this with `exceptions` in the global scope; may need finer granularity.

2. **Member-flag throttling.** If member flags arrive at high volume, how do they get prioritised? Simple option: founder triages by sampling; complex option: a lightweight clustering step groups similar flags before the founder sees them.

3. **Versioning of decisions.** The `superseded_by` field handles linear replacement. Branching (different decisions for different periods) is not modelled in v1; the assumption is that vocabulary trajectory is mostly linear with occasional reversal.

4. **Granularity of Charter edits.** A retain decision might or might not propose a Charter amendment. Today the audit flags them ad hoc; the panel could either prompt the founder per-decision or let them stack and propose a bundle. v1: ad hoc; v1.1: bundle option.

5. **Audit-doc relationship.** Does the audit-and-rewrite PR cycle continue, or do periodic audits fold into the panel queue entirely? Current view: audits remain useful for large surfaces and big revisions (revision areas 3–6 of the current sequence); the panel handles ongoing maintenance between audits. Both coexist.

---

## 12. Relationship to current audits

- **PR #49** (trust-messaging audit), **PR #52** (trust-messaging rewrite), **PR #53** (Studio vocabulary audit) are all *retroactive flag sources*. Their items can be backfilled into `vocabulary_flags` once the table exists; the decisions made in their PRs can be backfilled into `vocabulary_decisions`. This is the v1 seed data.

- The pending **Studio refinements PR** (revision area 2) will be the *first PR that cites decision ids from the panel* — even though the panel UI doesn't exist yet, the decisions can be created as records first, then cited.

- **Revision areas 3 through 6** (Gene Keys positioning, public copy, onboarding/Compass, Nexus default prompts) continue as planned, with the option to fold individual items into the panel queue rather than full audit-then-rewrite cycles if the panel is ready.

---

## 13. Next step

If this spec is approved as a v0.1 direction:

1. Land the spec as-is on `main` (this PR).
2. Schedule v1 implementation alongside the existing Compass / Studio work. Estimate not made yet; depends on storage layer decisions.
3. Backfill the seed data from PRs #49, #52, #53 once the tables exist.

If the spec needs changes, mark them inline on the PR. The spec is intentionally short — additions are welcome.

---

See also:

- [`../governance/decision-log.md`](../governance/decision-log.md) — current decision log; vocabulary governance writes here automatically once live.
- [`../foundation/nexus-guidance-charter.md`](../foundation/nexus-guidance-charter.md) — Charter; the foundation doc that vocabulary decisions propose edits against.
- [`../foundation/nexus-voice-samples.md`](../foundation/nexus-voice-samples.md) — voice samples and the §195 banned-vocabulary list; targets of frequent amendments.
- [`../foundation/four-layer-architecture.md`](../foundation/four-layer-architecture.md) — Sanctuary, Consume → Live → Serve. Vocabulary governance sits in *Serve* with Sanctuary protections.
- [`../handoffs/audits/studio-vocabulary-audit.md`](../handoffs/audits/studio-vocabulary-audit.md) — PR #53, the audit whose three-pass reclassification made this spec necessary.
