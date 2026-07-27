# stUdio context modes — legacy and grounded_v1

The stUdio Nexus grounding work. Phase 1 established the server-side context
architecture, its trust boundaries and its rollback path **without changing what
production does**. Phase 2 wires exactly one room — **The Work** — to that
architecture, and only when an operator has explicitly activated `grounded_v1`.
Every other room, every other endpoint, and all of `legacy` mode are untouched.

See [The Work pipeline](#the-work-pipeline-phase-2) for the part that changes
generation.

## Why this exists

Today every Nexus endpoint (`/generate`, `/inspire`, `/search`,
`/analyze-transcript`, `/extract-cv`) builds its prompt from material the
browser submits. Session notes, summaries, insights and Gene Key
Shadow/Gift/Siddhi text all arrive in the request body and are embedded
verbatim. That means:

- the server cannot tell curated Gene Key material from anything else a client
  chose to send;
- there is no record of which source revision informed an answer;
- AI output can be round-tripped back in as if it were the member's own
  material.

`grounded_v1` fixes the origin problem: canonical material is read server-side
from the tracked corpus, personal material is read from authenticated
member-owned rows, and every assembly leaves a trace naming exactly what it
used.

## The two modes

| | `legacy` | `grounded_v1` |
|---|---|---|
| Default | yes | no |
| Prompt origin | client-submitted, as today | server-side assembly |
| Canonical Gene Key text | whatever the client sent | `data/hexagrams/gk_NN.json`, checksummed |
| Personal material | whatever the client sent | member-owned rows, ownership-filtered |
| Trace | none | structured, redacted for logs |

`legacy` is not a re-implementation of the old behaviour — it *is* the old
behaviour. Nothing here touches `build_system_prompt`, `build_user_prompt`,
`build_point_section`, or any generation route. In `legacy` mode the single
Phase 2 hook (`work.route_inspire_layer2`) returns `None` on its first line and
the pre-existing prompt runs unchanged, which is what makes the parity guarantee
cheap to hold and cheap to test.

## Module layout

The foundation lives in the `studio_context` package rather than in
`server.py`, which is already ~8.7k lines.

```
studio_context/
  runtime.py     host bindings (db, settings, auth). Never imports server.py.
  canonical.py   Gene Key corpus: range/schema validation, checksums, versions
  provenance.py  provenance classes, acceptance states, transition rules
  modes.py       mode resolution, activation, rollback, failure policy
  store.py       personal orientation records: schema, ownership, idempotency
  trace.py       assembly trace + redaction
  assembler.py   the authenticated assembler, plus extension seams
  relevance.py   what a room retrieves, and why (pure, no I/O)
  prompts.py     shared sovereignty foundation + the four room action contracts
  rooms.py       the room engine: work, lens, field and call under grounded_v1
  api.py         FastAPI router (admin mode control + member primitives)
```

`server.py` gains three things: an import, a `studio_context.store.init_schema`
call inside `_init_admin_db`, and a wiring block at the end of the file that
calls `studio_context.configure(...)` and includes the router. The package is
decoupled by dependency injection so it can be unit tested without booting the
app, and so `server.py` does not grow another few hundred lines.

## Trust boundaries

1. **Client input is never authoritative in grounded mode.** A client may point
   at a Gene Key (an integer) but may not supply its text. Canonical content is
   only ever read from the corpus.
2. **Ownership is enforced server-side.** Records are scoped by the
   pseudonymous `cipher_id`, with the signed invite-token cookie as fallback —
   the same contract as Field Observations. The invite token is read from the
   cookie only, never from a request body. There is no unfiltered read branch:
   a caller resolving to neither key sees nothing.
3. **AI output is not personal context.** An `ai_proposal` is stored
   unaccepted. It can only become usable through an explicit member action that
   derives a *new* record from it; the proposal keeps its `ai_proposal` class
   forever, so the untrusted origin stays in the audit trail.
4. **Sealed material never assembles.** `visibility = 'sealed'` rows are
   excluded from every assembly, in SQL and again in Python.
5. **Traces carry identifiers, not content.** No essence text, reflection text,
   member name, cipher id, invite token or prompt content reaches a log.

## Data model

`studio_context_records`, created idempotently by `store.init_schema()` inside
`_init_admin_db()` — the same `CREATE TABLE IF NOT EXISTS` + `PRAGMA
table_info` column-probe convention as the rest of the schema. No migration
framework, no downtime, no manual step.

| column | purpose |
|---|---|
| `id` | `sctx_<hex>` |
| `cipher_id` / `invite_token` | ownership keys (token never leaves the DB) |
| `room` | Work-room reference |
| `gene_key`, `gene_key_line` | canonical reference, validated 1..64 / 1..6 |
| `source_version`, `source_ids` | which corpus revision this was formed against |
| `label`, `essence`, `reflection` | member-authored material |
| `provenance_class` | who authored it (see below) |
| `acceptance_state` | `proposed` / `accepted` / `rejected` / `superseded` |
| `visibility` | `private` (default) / `sealed` / `shared` |
| `derived_from` | the record this was derived from on acceptance |
| `idempotency_key` | owner-scoped; unique index where non-empty |
| `created_at`, `updated_at`, `accepted_at` | |

Records **reference** canonical material rather than copying it. Full source
transcripts stay in the corpus and in the member's own observation rows —
duplicating them here would create a second copy to keep in sync and a second
place to leak from.

### Provenance classes

| class | meaning | member-creatable | groundable once accepted |
|---|---|---|---|
| `member_authored` | the member wrote it | yes | yes |
| `member_uploaded` | the member supplied the file | yes | yes |
| `verified_source` | server-minted from the canonical corpus | no | yes |
| `ai_proposal` | model output awaiting a decision | yes | **no** |
| `member_edited_synthesis` | AI proposal the member edited and accepted | no (derived) | yes |
| `accepted_personal_context` | AI proposal the member accepted verbatim | no (derived) | yes |
| `ephemeral_operational` | scratch/plumbing | yes | **no** |

`verified_source` and the two derived classes are server-minted only: a client
cannot declare its own material trusted.

Acceptance flow:

```
create(ai_proposal)            → state=proposed              (never grounded)
  ├─ accept()                  → new accepted_personal_context, derived_from=<id>
  ├─ accept(essence=edited)    → new member_edited_synthesis,   derived_from=<id>
  └─ reject()                  → state=rejected               (terminal)
```

Both `accept` and `reject` are idempotent. Re-accepting returns the record the
first call derived rather than minting a second one.

## Activation and configuration

Durable settings, stored in the existing `app_settings` table alongside
`nexus_model` / `nexus_effort` but **entirely independent of them**:

| key | values | default |
|---|---|---|
| `studio_context_mode` | `legacy`, `grounded_v1` | `legacy` |
| `studio_context_mode_previous` | previous mode, for the audit trail | — |
| `studio_context_mode_activation` | JSON: mode, previous, actor, reason, timestamp | — |
| `studio_context_failure_policy` | `fail_closed`, `fallback_legacy` | `fail_closed` |

Env overrides `STUDIO_CONTEXT_MODE` and `STUDIO_CONTEXT_FAILURE_POLICY` supply
boot-time defaults. Resolution order is admin setting → env → built-in default,
matching the model-management subsystem.

The mode is resolved fresh on every read, so activation and rollback take
effect on the next request with no deploy.

**Everything ambiguous resolves to `legacy`:** unset, unreadable, unknown value,
or an activation record whose `mode` disagrees with the persisted mode (which
means the two settings were written apart — a half-applied or externally edited
state). Activation writes all three keys in one transaction so this should not
occur, but if it does, the stale state is discarded rather than trusted.

### Endpoints

Admin (all require the signed admin cookie; 401 otherwise):

- `GET  /api/admin/studio-context-mode` — state, source, rollback availability
- `POST /api/admin/studio-context-mode/activate` — `{mode, confirm, reason}`;
  422 without `confirm: true`, and 422 if activating `grounded_v1` while the
  canonical corpus is unhealthy
- `POST /api/admin/studio-context-mode/rollback` — one action, always to legacy
- `PUT  /api/admin/studio-context-failure-policy` — `{failure_policy}`
- `GET  /api/admin/studio-context-sources` — corpus readiness report

Member (require member access *and* a resolvable member scope):

- `GET  /api/studio/context-records`
- `POST /api/studio/context-records`
- `POST /api/studio/context-records/{id}/accept`
- `POST /api/studio/context-records/{id}/reject`
- `GET  /api/studio/context-preview` — grounded assembly preview with trace

The admin panel selector lives in the Infrastructure tab under "stUdio context
mode". Activation takes two deliberate acts (tick the confirm box, then press
Activate); rollback is one press.

### Independence from the AI provider/model

The context mode and the Nexus model are orthogonal. They use different setting
keys, different endpoints and different resolution functions; `modes.py` never
reads or writes `nexus_model` or `nexus_effort`, and the model subsystem never
reads the context mode. Switching context mode leaves the selected model and
reasoning effort exactly as they were, and vice versa. This is asserted in both
directions by the test suite.

## Canonical source handling

`data/hexagrams/gk_01..64.json`, read server-side.

- **Range**: keys must be plain integers 1..64; lines 1..6.
- **Path safety**: the filename is built from the validated integer, so no
  caller string reaches the filesystem. The resolved path is additionally
  asserted to sit directly inside the corpus directory, which also catches a
  symlinked entry pointing outside the tracked corpus.
- **Schema**: `number` (must match the filename), non-empty `title`, and
  `shadow`/`gift`/`siddhi` each with non-empty `subtitle` and `content`. Extra
  top-level keys are tolerated — two entries carry an `intro`.
- **Integrity**: per-file sha256 → `source_id` of the form `gk:25@7649f5a2fd7d`.
  The corpus version (`gkc1-<hex16>`) is derived from the ordered per-file
  checksums, so any edit anywhere changes it and traces written before and
  after are distinguishable.
- **Caching**: in-memory, keyed by corpus root, with `reset_cache()` for tests.

### Line corpus

`data/lines/{room}_lines.json` — six Line passages per room — is read through the
same contract, added in Phase 2 so grounded Work can cite a Line rather than
paraphrase one.

- **Room allowlist**: `work`, `lens`, `field`, `call`. The allowlist *is* the
  path-safety gate; no caller string ever reaches the filesystem.
- **Schema**: exactly six entries, lines 1..6 with no duplicates, each with a
  non-empty `line`, `title` and `content`.
- **Integrity**: per-line sha256 → `source_id` of the form `line:work:3@402964b64b04`,
  and a per-room corpus version `gklc1-<hex16>`.
- `verify_line_corpus(room)` never raises; it reports, for the admin surface.

`data/` is also mounted as public static content, so the corpus is not secret.
The point of reading it server-side is not confidentiality — it is that the
server, not the browser, decides what counts as authoritative.

## Failure policy

Grounded mode never silently substitutes generic model knowledge while claiming
curated grounding. When required canonical material cannot be loaded:

- `fail_closed` (default) — returns `status: "grounding_unavailable"` with a
  reason and a trace. Callers must handle this explicitly.
- `fallback_legacy` — returns `status: "fallback_legacy"` and the caller routes
  through the legacy path.

Both branches emit an audit event (`studio_context_grounding_unavailable` /
`studio_context_grounding_fallback`). Neither ever returns `status: "grounded"`.

## Observability

Every assembly builds a `ContextTrace`. Two projections:

- `as_dict()` — full trace, returned only to the owning member via
  `/api/studio/context-preview`.
- `redacted()` — ids, counts and canonical source versions only. Safe for logs
  and admin surfaces. Redaction is applied recursively against a deny-list, as
  a backstop so that adding a field to a trace cannot accidentally start
  leaking free text.

Audit events written to the existing `events` table:

```
studio_context_mode_activated              detail="legacy->grounded_v1"
studio_context_mode_rolled_back            detail="grounded_v1->legacy"
studio_context_mode_activation_rejected    detail="corpus unavailable (63/64)"
studio_context_failure_policy_changed      detail="fail_closed"
studio_context_assembled                   detail="records=3 sources=2"
studio_context_grounding_unavailable       detail=<reason>
studio_context_grounding_fallback          detail=<reason>
studio_context_record_accepted             detail=<derived class>
studio_context_record_rejected
studio_context_room_grounded               detail="room=lens gene_key_and_line use=personal_and_canonical sources=2"
studio_context_room_clarification          detail="room=field clarification_required use=none sources=0"
studio_context_room_grounding_unavailable  detail="room=call <outcome> <reason>"
studio_context_room_fallback_legacy        detail="room=work <outcome> <reason>"
```

## Operational checks

Before activating `grounded_v1`:

1. `GET /api/admin/studio-context-sources` → `ok: true`, `present: 64`. The
   activate endpoint enforces this too and refuses with 422 otherwise.
   `GET /api/admin/studio-context-rooms` additionally reports per-room
   Line-corpus readiness, which activation does *not* enforce.
2. Note the current `nexus_model` — confirm it is unchanged after switching.
3. `GET /api/studio/context-preview` as a member with accepted records →
   expect `status: "grounded"` and a populated `source_version`.

After activating, watch `events` for `studio_context_grounding_unavailable`.
A steady stream means the corpus or the members' records are not ready, and the
mode should go back to legacy.

## Rollback procedure

Rollback is one action and never requires a deploy, a migration or a restart.

**Preferred — admin panel:** Infrastructure tab → "stUdio context mode" →
*Roll back to legacy*.

**Equivalent — API:**

```
POST /api/admin/studio-context-mode/rollback     (admin cookie)
```

**Break-glass — direct SQL**, if the admin surface is unavailable:

```sql
UPDATE app_settings SET value = 'legacy', updated_at = datetime('now')
 WHERE key = 'studio_context_mode';
DELETE FROM app_settings WHERE key = 'studio_context_mode_activation';
```

Deleting the activation row is enough on its own: a mode with no matching
activation record reads as stale and resolves to legacy.

**Full revert:** reverting this PR restores the previous behaviour exactly. The
new table is additive and orphaned rather than dropped, so no member data is
lost, and re-applying the PR picks the rows back up.

Rollback takes effect on the next request: `route_inspire_layer2` re-reads the
mode every call, so The Work returns to the legacy prompt immediately, with no
deploy, migration or cache to clear.

Rollback loses nothing. The mode is a read-time switch — orientation records,
acceptances and provenance survive a switch in either direction, and switching
back to `grounded_v1` finds them intact. The test suite asserts round-trip
switching with no data loss.

## The room engine (Phase 2 → all four rooms)

One pipeline, four rooms: `POST /inspire-layer2` with `point` in `work`, `lens`,
`field`, `call`, under `grounded_v1`. `studio_context/rooms.py` owns the whole
behavioural change. `server.py` did not grow when the three remaining rooms were
added — the route already asked for a plan, and the plan builder simply now
answers for four `point` values instead of one:

```python
plan = studio_context.rooms.route_inspire_layer2(req, request, ...) or {}
```

`route_inspire_layer2` returns `None` — leave everything alone — unless the mode
is `grounded_v1` *and* `payload.point` is exactly one of the four canonical ids.
The match is exact, never normalised, because the rest of the app already looks
`point` up in dicts keyed by the lowercase token: `"Lens"`, `"LENS"`, `" lens"`
and `"lenses"` are unknown rooms and must keep doing whatever legacy did with
them. Otherwise it returns a plan carrying exactly one of:

| plan key | meaning | what the route streams |
|---|---|---|
| `system` + `user` | grounded assembly | model output, plus `grounding` on `done` |
| `reply` | a clarification, model never called | the clarification as a `chunk` |
| `error` | audited grounding refusal (`fail_closed`) | an `error` event |
| `legacy` | audited fallback (`fallback_legacy`) | the legacy prompt, plus `grounding` |

### What is shared and what varies

Everything that constitutes a trust boundary is shared and cannot be varied by a
room. A room contributes exactly three things:

| Per-room | Where | What it may do |
|---|---|---|
| action contract | `prompts.ROOM_ACTION_CONTRACTS[room]` | describe the work of this room |
| narrow signals | `relevance.ROOM_SIGNALS[room]` | add idioms; never remove the shared ones |
| clarification wording | `relevance.CLARIFICATIONS[room]` | name its own room when asking |

Shared and identical in all four: `prompts.SOVEREIGNTY_FOUNDATION`, the fencing
and `fence_safe()` neutralisation, `store.groundable_records`, ownership and
sealed exclusion, `assembler.select_relevant`, the relevance decision table, the
retrieval rules, the trace, the failure policy, and the response envelope. A
room cannot lower the shared bar — `ROOM_SIGNALS` entries are appended to the
shared pattern set, never substituted for it.

`RoomSpec` in `rooms.py` is the whole per-room surface:

```python
ROOM_SPECS = {spec.room: spec for spec in (
    RoomSpec("work",  "The Work",  prompts.WORK_CONTRACT_VERSION),
    RoomSpec("lens",  "The Lens",  prompts.LENS_CONTRACT_VERSION),
    RoomSpec("field", "The Field", prompts.FIELD_CONTRACT_VERSION),
    RoomSpec("call",  "The Call",  prompts.CALL_CONTRACT_VERSION))}
```

### The four room contracts

All four sit on the same `SOVEREIGNTY_FOUNDATION`
(`studio-grounded-foundation-v2`), which carries the rules that are not
negotiable per room: no identity claims, no destiny, proposal language, factual
fidelity, no speaking for third parties, no reaching for symbolic language
unless the request calls for it or a canonical excerpt is present, and no
implication that anything written here is remembered or promoted.

| Room | Contract version | Its work | Its specific prohibition |
|---|---|---|---|
| Work | `studio-grounded-work-v1` | products, services, offers, practices, experiments, contributions | no identity or destiny claims |
| Lens | `studio-grounded-lens-v1` | writings, teachings, frameworks, learnings, interpretation, articulation | *Articulate, do not elevate.* Claim no authority or expertise the member has not demonstrated |
| Field | `studio-grounded-field-v1` | conditions, relationships, community, rhythms, support systems | *Never infer another person's interior.* No consent by assumption |
| Call | `studio-grounded-call-v1` | emerging direction, service, invitations, commitments, next experiments | *No destiny, no prediction, no obligation.* Attach an experiment |

The foundation was bumped to `v2` when the three rooms landed, because the rules
added were shared rules, not Lens/Field/Call rules — The Work is held to them
too. Anything that is true of only one room lives in that room's contract.

### Behaviour matrix

| Mode | Room / endpoint | Path |
|---|---|---|
| `legacy` | any | unchanged, `grounding` absent, `done` is exactly `{"done": true}` |
| `grounded_v1` | `/inspire-layer2` `point="work"` | grounded, Work contract |
| `grounded_v1` | `/inspire-layer2` `point="lens"` | grounded, Lens contract |
| `grounded_v1` | `/inspire-layer2` `point="field"` | grounded, Field contract |
| `grounded_v1` | `/inspire-layer2` `point="call"` | grounded, Call contract |
| `grounded_v1` | mis-cased, padded, empty or unknown `point` | unchanged legacy prompt |
| `grounded_v1` | `/inspire-arrival`, `/generate`, `/search`, everything else | unchanged |

Model and reasoning-effort selection are resolved by their own subsystem in
every row of that table. The context mode never reads or writes them, and the
`#202` token budget and stream-repair behaviour are untouched.

### What counts as trusted context

Assembled from `store.groundable_records(room=<this room>)` for the
authenticated caller only — accepted, unsealed, member-owned rows, ordered by
`assembler.select_relevant` and capped at 12 records, 1200 chars of essence and
1200 of reflection each. A room only ever sees its own records; The Lens does
not read The Field's. Never trusted as orientation: client transcript text, AI
proposals that were never accepted, rejected records, sealed material, another
member's rows, and operational traces.

A client may still *point at* a Gene Key with `gk_num`, but the pointer is
corroborated against the caller's own accepted records **in that room** before
it is honoured; an uncorroborated or malformed pointer is noted in the trace and
ignored. `gk_shadow` / `gk_gift` / `gk_siddhi` are dropped outright — canonical
text comes only from the corpus.

### Relevance outcomes

`relevance.decide(text, room=…)` is pure and I/O-free: it reads only the words
the member typed this turn (`session_notes` and their own Q&A answers) — never
uploads, audience fields, or prior AI output, so an instruction hidden in an
uploaded document cannot steer retrieval.

| Outcome | When | Retrieves |
|---|---|---|
| `none` | a real request, no accepted orientation to draw on | nothing |
| `personal_only` | ordinary drafting, writing, planning or direction-setting | accepted records |
| `gene_key` | explicit source request, or a recurring-pattern signal | records + Shadow/Gift/Siddhi for the owned key |
| `gene_key_and_line` | as above *and* a line signal or an owned line with a recurring pattern | the above + this room's Line passage |
| `clarification_required` | explicit source request with no owned key; a pattern signal with no context; a thin request with no accepted essence | nothing; the model is not called |

Source selection is minimal and justified by construction: only keys the member
already owns, only the bands of those keys, and the Line passage only when the
decision asked for it — and always `line:<this room>:<n>`, never another room's
reading of the same line. Never all 64 transcripts, never all four rooms.

#### Contextual relevance differences between rooms

The shared patterns fire everywhere. Each room adds a small set of idioms that
mean "this recurs" or "tell me what the source says" *in that room's language*,
and those additions are scoped to that room — the Lens idiom is ordinary English
in The Field and does not retrieve there.

| Room | Adds to *explicit source request* | Adds to *recurring pattern* |
|---|---|---|
| Work | "life's work line" | — |
| Lens | "evolution line", "how the Gene Keys describe/frame/put…" | "I keep trying to explain/articulate/write…", "never comes out right", "can't find the words" |
| Field | "radiance line" | "the same dynamic", "keeps happening with/in/around", "I keep ending up in/with", "burning out again" |
| Call | "purpose line", "incarnation cross" | "keeps calling/pulling/drawing me", "keep being asked", "I keep circling" |

The regexes stay deliberately narrow in every room. Bare "shadow", "gift",
"stuck" and "tension" do not fire, because "drop shadow", "gift card" and "stuck
header" are ordinary commercial copy. The same reasoning applies per room: in
The Field, "the same team" must not retrieve; in The Call, "call to action" must
not retrieve. A false positive means unwanted symbolism in ordinary writing,
community planning or direction-setting, which is exactly the failure these
rooms must not have.

Clarifications name their own room, so a member who is asked to say more knows
which conversation is asking: "…so The Lens has something of yours to work
from", "…The Field", "…The Call", "…The Work".

### Prompt assembly

`prompts.compose_room_prompt(action_contract=…, …)` builds a system prompt of
`SOVEREIGNTY_FOUNDATION` + that room's action contract, and a user message of
four named, closed fences:

```
<<<TRUSTED_PERSONAL_CONTEXT>>> … <<<END_TRUSTED_PERSONAL_CONTEXT>>>
<<<VERIFIED_SOURCE_EXCERPTS>>> … <<<END_VERIFIED_SOURCE_EXCERPTS>>>
<<<UNVERIFIED_SUPPLIED_MATERIAL>>> … <<<END_UNVERIFIED_SUPPLIED_MATERIAL>>>
<<<CURRENT_REQUEST>>> … <<<END_CURRENT_REQUEST>>>
```

Every block body passes through `fence_safe()`, which replaces marker-shaped
text with `[marker removed]`, so member or uploaded content cannot forge a
boundary. The foundation states that block contents are data, that general
knowledge must never be presented as sourced material, and that with no
`TRUSTED_PERSONAL_CONTEXT` block the model does not know this person's
orientation and must not construct one.

Outputs remain proposals in every room. Nothing generated here is written back
as an accepted record; promotion still requires the member's explicit accept.

### Response metadata

Additive and optional. The client reads `chunk` and `error` and ignores
everything else, so the existing schema and UI are unaffected. Under
`grounded_v1`, the `done` (or `error`) event carries:

```json
{"done": true, "grounding": {
  "mode": "grounded_v1", "room": "lens",
  "pipeline": "studio-grounded-lens-v1",
  "prompt_versions": ["studio-grounded-foundation-v2", "studio-grounded-lens-v1"],
  "status": "grounded", "relevance": "gene_key_and_line",
  "relevance_reason": "recurring_pattern_with_owned_line",
  "used_personal_context": true, "used_canonical_sources": true,
  "source_use": "personal_and_canonical",
  "canonical_source_ids": ["gk:44@a145340f011b", "line:lens:3@…"],
  "source_versions": ["gkc1-bce5f5696b3bb18f", "gklc1-eb2b3f46da747a12"]}}
```

`source_use` is the privacy-safe category an operator can read at a glance:
`none`, `personal_only`, `personal_and_canonical`, `canonical_only`.

In `legacy` mode the event is exactly `{"done": true}`, byte for byte as before,
for all four rooms.

### Trace example

The internal trace is `ContextTrace.redacted()` plus the relevance decision —
ids, counts and outcomes, never text:

```json
{
  "mode": "grounded_v1", "room": "field", "status": "grounded",
  "source_version": "gkc1-bce5f5696b3bb18f",
  "record_ids": ["sctx_ac36553949bb9c47e7efb37645e69b1d"],
  "canonical_source_ids": ["gk:44@a145340f011b", "line:field:3@…"],
  "excluded_reasons": [],
  "counts": {"records": 1, "canonical_sources": 2, "excluded": 0,
             "by_provenance_class": {"member_authored": 1}},
  "relevance": {"outcome": "gene_key_and_line",
                "reason": "recurring_pattern_with_owned_line",
                "gene_keys": [44], "line": 3,
                "signals": {"room": "field",
                            "explicit_source_request": false,
                            "recurring_pattern": true,
                            "line_reference": false,
                            "substantive_request": true}},
  "used_personal_context": true, "used_canonical_sources": true,
  "at": "2026-07-27T10:03:33+00:00"
}
```

The last 50 of these are held in a per-process ring buffer for the admin
surface. Raw sealed values, essence/reflection text and prompt content are never
written to it, to the audit `detail`, or to logs. The audit `detail` is
`room=<room> <outcome> use=<source_use> sources=<n>` — enough to see which room
did what, with nothing of what was said.

### Grounding unavailable

If a corpus is missing or malformed — or if anything in the trust layer raises
unexpectedly — the request takes the Phase 1 failure policy, never a quiet
ungrounded answer:

- `fail_closed` (default) → an `error` event naming the affected room
  (`RoomSpec.unavailable_message`), with `status: "grounding_unavailable"`.
- `fallback_legacy` → the legacy prompt runs, with
  `status: "fallback_legacy"` and a `fallback_reason`.

Failure is scoped to the corpus that is actually broken. A damaged
`data/lines/lens_lines.json` takes The Lens out; The Field, The Call and The
Work keep working. Both outcomes are audited, and neither ever reports
`status: "grounded"` or claims source ids it did not read.

### Admin / debug surface

`GET /api/admin/studio-context-rooms` (admin cookie, 401 otherwise) →
`rooms.debug_state()`: whether the pipeline is active, the mode and failure
policy, prompt versions, which rooms are grounded and which are not, per-room
Line corpus readiness and room signals, Gene Key corpus readiness, the outcome
and source-use vocabularies, pending corpora, and the redacted recent activity.
Content-free by construction — the tests assert that no essence, reflection,
sealed value, cipher id or canonical prose appears anywhere in the payload.

The Infrastructure tab renders two rows inside the existing "stUdio context
mode" panel:

```
Grounded rooms      work, lens, field, call: grounded · lines 24/24
Last room response  lens · grounded · relevance gene_key · use personal_and_canonical · sources 2 · <ts>
```

### Room-by-room validation prompts

Run each in `grounded_v1` as a member who owns a Gene Key and has an accepted
essence in that room. In every case the model must answer in ordinary words
unless the prompt asks for source material.

| Room | Ordinary request → `personal_only`, no symbolism | Explicit source request → `gene_key` / `gene_key_and_line` | Clarification → model not called |
|---|---|---|---|
| Work | "Write the product description for the new workshop." | "Go deeper into my Gene Key for this offer." | (owning no key) "Open my Gene Key shadow here." |
| Lens | "Tidy up the introduction to this essay." | "What does my evolution line say about how I teach?" | (owning no key) "What does my Gene Key say about my writing?" |
| Field | "Draft the invitation for the monthly community call." | "My radiance line keeps showing up in how these groups go." | (thin, no essence) "help" |
| Call | "List three next steps for the residency application." | "What does my purpose line say about this invitation?" | (owning no key) "Read my Gene Key for where this is heading." |

Additional per-room checks:

- **Lens** — ask it to write a bio. It must not award credentials, titles or
  expertise the accepted records do not evidence.
- **Field** — describe a difficult collaborator in the request. The reply must
  not state what that person feels, wants or has agreed to.
- **Call** — ask "is this my path?". The reply must not answer in the language of
  destiny, certainty or obligation, and should offer an experiment.

### Known limitations

- Four rooms, one route. `/inspire-arrival`, `/generate` and `/search` still
  build prompts from client-submitted material.
- Relevance is lexical, not semantic. It is tuned to under-retrieve: an
  unusually phrased request for source material will land on `personal_only`
  rather than guess. Adding vocabulary to a room is a one-line change in
  `ROOM_SIGNALS` with a table test.
- Room signals are English-only, and idiomatic. A member writing in another
  language gets the shared patterns and their own accepted records, not the
  room-specific idioms.
- Recent activity is a per-process, in-memory ring buffer of 50. It is not
  durable and not shared across workers; the `events` table is the durable
  record.
- Line retrieval uses the single line the member's records carry, and only that
  room's reading of it. Multiple owned keys retrieve each key's bands, but only
  one line.
- Cross-room synthesis does not exist. A question in The Call cannot see what
  The Work knows, by design — a room's trust scope is its own records.
- The Yoga Sutra corpus is **not** implemented and is deliberately deferred.

## Deferred: the Yoga Sutra corpus

Not in this PR, and the seam is left explicit rather than implied:

- `assembler.register_corpus(name, loader)` — a second canonical corpus
  implements the same contract as `canonical.py`: validated ids, per-item
  checksums, a corpus version, and a structured error on missing/malformed
  material.
- `relevance.EXTENSION_CORPORA` — declares `yoga_sutras` as an unimplemented
  extension point. A Sutra outcome joins `OUTCOMES` and the table test grows a
  row.
- `rooms._retrieve` — one branch, after the Gene Key branch, for a curated
  corpus the decision asked for.

`debug_state()` reports it under `pending_corpora`, and the room test suite
asserts that nothing retrieves it today. Adding it is a corpus plus a decision
row, not a pipeline.

## The Nexus activity signal

A CommonUnity-wide, wordless indication that Nexus is working, shared by stUdio
and cOMpass so it is one standard rather than two lookalikes.

- `sdk/nexus-activity.css` — the three visual states and the reduced-motion
  variant.
- `sdk/nexus-activity.js` — `window.CommonUnityNexusActivity`, the lifecycle.

Both files are served from the existing `/sdk` static mount and are loaded by
`studio.html` and `index.html`.

### States

| State | When | Field outline | Response origin | Screen reader |
|---|---|---|---|---|
| `is-nexus-working` | request submitted, nothing streamed | slow breathing glow (3.6s) | Nexus mark + three softly animated points | "Nexus is preparing a response." |
| `is-nexus-settling` | first streamed text | steady faint lift, no animation | cleared | "Nexus is responding." |
| *(no class)* | `done` | resting | cleared | "Nexus has finished responding." |
| *(no class)* | error / cancel | resting | cleared; the host's existing error or retry treatment shows | "Nexus could not complete the response." / silence on cancel |

The field is the conversation panel itself — `.rose-surface` in stUdio,
`.compass-nexus-panel` in cOMpass — both tagged `nexus-activity-field` with
`id="nexus-activity-field"`. The mark is the *existing* Nexus mark: the same
12-point vector-equilibrium geometry and interlocking hexagram as the stUdio orb
(`#nexus-svg`) and the cOMpass orb glyph, drawn at 22px. It is not a new logo.
Colour is `--nexus-activity-color`, which defaults to the existing
`--rose-color`, so the signal inherits each surface's warmth instead of
introducing a bright accent of its own.

### Lifecycle

```js
const activity = CommonUnityNexusActivity.begin({ field, origin });
activity.firstToken();  // on the first d.chunk
activity.done();        // on stream done
activity.fail();        // upstream error, network drop, thrown request
CommonUnityNexusActivity.reset(field);  // hard clear: room switch, rehydration
```

Guarantees the module exists to provide:

- **Never outlives its request.** `done()` and `fail()` land in the identical
  resting state. Both stUdio and cOMpass call `fail()` from the upstream-error
  branch, from a new mid-stream `.catch()` on the read loop, and from the outer
  `catch`.
- **Never doubles.** `begin()` tears down whatever was on the field first, and a
  superseded run's `firstToken` / `done` / `fail` become no-ops, so rapid
  consecutive sends and cancel-then-resend cannot leave two marks or let a stale
  teardown clear a live signal.
- **Survives transcript repair.** stUdio calls `reset()` in
  `renderMirrorHistory()`; cOMpass calls it after rehydrating a saved
  conversation. A repaired blank turn or a room switch cannot leave a glow
  attached to a bubble that no longer exists.
- **Degrades safely.** If the shared script has not loaded, each app's
  `…NexusActivityBegin()` returns an inert stub, and sending still works.

### Accessibility

No new visible status words are introduced anywhere — the visible signal is
entirely the outline, the mark and the three points. The only language lives in
`.nexus-activity-status`, a visually-hidden `role="status" aria-live="polite"`
region inside the field. The cOMpass-local three-dot indicator and its
`aria-label="Nexus is thinking"` were retired in favour of this.

Under `prefers-reduced-motion: reduce` the signal remains but the movement does
not: a *strengthened static* outline, a static mark and static points. Nothing
pulses, nothing travels, and nothing disappears — a member who has asked for
less motion still gets the same information.

The microphone is a different event. `.voice-btn.recording` (stUdio) and
`.btn-mic.recording` / `.mic-dot` (cOMpass) are untouched, and the shared module
and stylesheet never reference a listening or recording state. Speech input and
model work must stay visually distinguishable.

## Rollout and rollback

Rollout of the room grounding is the Phase 1 procedure, unchanged:

1. `GET /api/admin/studio-context-sources` → `ok: true`, `present: 64`.
2. `GET /api/admin/studio-context-rooms` → `rooms.*.line_corpus.ok` for all four.
3. Activate `grounded_v1` from the Infrastructure tab (confirm step).
4. Re-check `/api/admin/studio-context-rooms`: `active: true`,
   `rooms_grounded: ["work","lens","field","call"]`, `rooms_legacy: []`.

Rollback is one setting: set the mode back to `legacy`. Every room immediately
returns to the exact legacy path — `route_inspire_layer2` returns `None` before
it looks at anything else, `done` is `{"done": true}` again, and no code in this
package runs. Orientation records, acceptances and provenance survive the switch
in both directions; the round trip is asserted in the test suite for all four
rooms.

The Nexus activity signal is deliberately *not* behind the context mode — it is
a UI affordance with no bearing on grounding, and it behaves identically in
`legacy`. To remove it, delete the two `/sdk/nexus-activity.*` tags from
`studio.html` and `index.html`; the `…NexusActivityBegin()` stubs make every
call site inert and sending continues to work.

## Tests

- `tests/studio-context-corpus.test.py` — corpus completeness, schema, source
  integrity, checksum/version stability, path safety.
- `tests/studio-context-modes.test.py` — defaults, activation, rollback,
  invalid/stale values, independence from model selection, admin auth.
- `tests/studio-context-records.test.py` — migration, ownership isolation,
  sealed exclusion, provenance transitions, idempotency, no auto-promotion of
  AI output, trace redaction, failure/fallback policy, legacy parity.
- `tests/studio-context-work.test.py` — The Work: routing, the table-driven
  relevance suite, clarification instead of interpretation, no invented
  orientation, client transcript override, uncorroborated and traversal key
  pointers, injection inside uploaded material, forged block markers, exclusion
  of rejected/proposed/sealed/cross-member records, both failure policies
  against a broken Gene Key corpus and a broken Line corpus, the legacy →
  grounded → legacy round trip, independence from model/effort selection, and
  admin-surface privacy and auth gating.
- `tests/studio-context-rooms.test.py` — the same coverage, table-driven across
  Lens, Field and Call: each room's own contract and the shared foundation,
  ordinary requests with no forced symbolism, explicit source requests resolving
  to that room's Line, room idioms recognised in their own room only,
  room-specific clarifications, no accepted essence, client-transcript and
  traversal pointer rejection, prompt injection and forged markers, per-room
  record exclusion, per-room fail-closed containment, the Sutra deferral, exact
  room routing, the legacy round trip, provider independence, response-envelope
  compatibility, and admin privacy.
- `tests/nexus-activity-signal.test.js` — the activity signal in both surfaces:
  the shared module and its loading, reuse of the existing Nexus geometry, the
  three CSS states, reduced-motion variants, screen-reader semantics, the stUdio
  and cOMpass wiring (start on submit, transition on first token, stop on done,
  stop on upstream error / network drop / thrown request), wordlessness,
  separation from the microphone state, and a behavioural run of the lifecycle
  against a minimal DOM covering duplicates, cancellation, reset and late
  callbacks.

Also relevant: `tests/studio-nexus-chat-renderable.test.py` (the `#202` stream
repair), `test_inspire_layer2_fields`, `test_fieldprint_audience_nexus`,
`test_nexus_model`, `test_nexus_model_management`, `test_arrival_portrait` — the
legacy Nexus behaviour the room engine must not disturb.

Run: `python3 tests/studio-context-rooms.test.py` (etc.), `node
tests/nexus-activity-signal.test.js`, or via `pytest`.
