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
  assembler.py   the authenticated assembler, plus Phase 3 seams
  relevance.py   what The Work retrieves, and why (pure, no I/O)
  prompts.py     shared sovereignty foundation + the Work action contract
  work.py        the one room wired to grounded_v1
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
studio_context_work_grounded               detail="gene_key_and_line sources=2"
studio_context_work_clarification          detail="clarification_required sources=0"
studio_context_work_grounding_unavailable  detail=<outcome> <reason>
studio_context_work_fallback_legacy        detail=<outcome> <reason>
```

## Operational checks

Before activating `grounded_v1`:

1. `GET /api/admin/studio-context-sources` → `ok: true`, `present: 64`. The
   activate endpoint enforces this too and refuses with 422 otherwise.
   `GET /api/admin/studio-context-work` additionally reports Line-corpus
   readiness, which activation does *not* enforce.
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

## The Work pipeline (Phase 2)

One room, one route: `POST /inspire-layer2` with `point == "work"`, under
`grounded_v1`. `studio_context/work.py` owns the whole behavioural change and
`server.py` grew ~30 lines: one optional payload field (`cipher_id`), the
`Request` object on the handler, and one branch that asks for a plan.

```python
plan = studio_context.work.route_inspire_layer2(req, request, ...) or {}
```

`route_inspire_layer2` returns `None` — leave everything alone — unless the mode
is `grounded_v1` *and* `payload.point` is exactly `"work"`. The match is exact
because the rest of the app already looks `point` up in dicts keyed by the
lowercase token, so `"WORK "` is an unknown room and must keep doing whatever
legacy did with it. Otherwise it returns a plan carrying exactly one of:

| plan key | meaning | what the route streams |
|---|---|---|
| `system` + `user` | grounded assembly | model output, plus `grounding` on `done` |
| `reply` | a clarification, model never called | the clarification as a `chunk` |
| `error` | audited grounding refusal (`fail_closed`) | an `error` event |
| `legacy` | audited fallback (`fallback_legacy`) | the legacy prompt, plus `grounding` |

### Behaviour matrix

| Mode | Room / endpoint | Path |
|---|---|---|
| `legacy` | any | unchanged, `grounding` absent, `done` is exactly `{"done": true}` |
| `grounded_v1` | `/inspire-layer2` `point="work"` | grounded Work pipeline |
| `grounded_v1` | `point` in `lens`, `field`, `call` | unchanged legacy prompt |
| `grounded_v1` | unknown / empty / mis-cased `point` | unchanged legacy prompt |
| `grounded_v1` | `/inspire-arrival`, `/generate`, `/search`, everything else | unchanged |

Model and reasoning-effort selection are resolved by their own subsystem in
every row of that table. The context mode never reads or writes them.

### What counts as trusted context

Assembled from `store.groundable_records(room="work")` for the authenticated
caller only — accepted, unsealed, member-owned rows, ordered by
`assembler.select_relevant` and capped at 12 records, 1200 chars of essence and
1200 of reflection each. Never trusted as orientation: client transcript text,
AI proposals that were never accepted, rejected records, sealed material,
another member's rows, and operational traces.

A client may still *point at* a Gene Key with `gk_num`, but the pointer is
corroborated against the caller's own accepted records before it is honoured; an
uncorroborated or malformed pointer is noted in the trace and ignored.
`gk_shadow` / `gk_gift` / `gk_siddhi` are dropped outright — canonical text comes
only from the corpus.

### Relevance outcomes

`relevance.decide()` is pure and I/O-free: it reads only the words the member
typed this turn (`session_notes` and their own Q&A answers) — never uploads,
audience fields, or prior AI output, so an instruction hidden in an uploaded
document cannot steer retrieval.

| Outcome | When | Retrieves |
|---|---|---|
| `none` | a real request, no accepted orientation to draw on | nothing |
| `personal_only` | ordinary drafting or implementation work | accepted records |
| `gene_key` | explicit source request, or a recurring-pattern signal | records + Shadow/Gift/Siddhi for the owned key |
| `gene_key_and_line` | as above *and* a line signal or an owned line with a recurring pattern | the above + the Line passage |
| `clarification_required` | explicit source request with no owned key; a pattern signal with no context; a thin request with no accepted essence | nothing; the model is not called |

Source selection is minimal and justified by construction: only keys the member
already owns, only the bands of those keys, and the Line passage only when the
decision asked for it. Never all 64 transcripts, never all four rooms.

The signal regexes are deliberately narrow. Bare "shadow", "gift", "stuck" and
"tension" do not fire, because "drop shadow", "gift card" and "stuck header" are
ordinary commercial copy — a false positive here means unwanted symbolism in a
product description, which is exactly the failure this room must not have.

### Prompt assembly

`prompts.compose_work_prompt()` builds a system prompt of
`SOVEREIGNTY_FOUNDATION` + `WORK_ACTION_CONTRACT`
(`studio-grounded-foundation-v1` / `studio-grounded-work-v1`), and a user
message of four named, closed fences:

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
orientation and must not construct one. The action contract turns orientation
into products, services, offers, practices, experiments and contributions, in
proposal language, with no identity or destiny claims.

Outputs remain proposals. Nothing generated here is written back as an accepted
record; promotion still requires the member's explicit accept.

### Response metadata

Additive and optional. The client reads `chunk` and `error` and ignores
everything else, so the existing schema and UI are unaffected. Under
`grounded_v1` for The Work, the `done` (or `error`) event carries:

```json
{"done": true, "grounding": {
  "mode": "grounded_v1", "room": "work",
  "pipeline": "studio-grounded-work-v1",
  "prompt_versions": ["studio-grounded-foundation-v1", "studio-grounded-work-v1"],
  "status": "grounded", "relevance": "gene_key_and_line",
  "relevance_reason": "recurring_pattern_with_owned_line",
  "used_personal_context": true, "used_canonical_sources": true,
  "canonical_source_ids": ["gk:44@a145340f011b", "line:work:3@402964b64b04"],
  "source_versions": ["gkc1-bce5f5696b3bb18f", "gklc1-eb2b3f46da747a12"]}}
```

In `legacy` mode the event is exactly `{"done": true}`, byte for byte as before.

### Trace example

The internal trace is `ContextTrace.redacted()` plus the relevance decision —
ids, counts and outcomes, never text:

```json
{
  "mode": "grounded_v1", "room": "work", "status": "grounded",
  "source_version": "gkc1-bce5f5696b3bb18f",
  "record_ids": ["sctx_ac36553949bb9c47e7efb37645e69b1d"],
  "canonical_source_ids": ["gk:44@a145340f011b", "line:work:3@402964b64b04"],
  "excluded_reasons": [],
  "counts": {"records": 1, "canonical_sources": 2, "excluded": 0,
             "by_provenance_class": {"member_authored": 1}},
  "relevance": {"outcome": "gene_key_and_line",
                "reason": "recurring_pattern_with_owned_line",
                "gene_keys": [44], "line": 3,
                "signals": {"explicit_source_request": false,
                            "recurring_pattern": true,
                            "line_reference": false,
                            "substantive_request": true}},
  "used_personal_context": true, "used_canonical_sources": true,
  "at": "2026-07-27T10:03:33+00:00"
}
```

The last 25 of these are held in a per-process ring buffer for the admin
surface. Raw sealed values, essence/reflection text and prompt content are never
written to it, to the audit `detail`, or to logs.

### Grounding unavailable

If the corpus is missing or malformed — or if anything in the trust layer raises
unexpectedly — the request takes the Phase 1 failure policy, never a quiet
ungrounded answer:

- `fail_closed` (default) → an `error` event whose text is
  `work.GROUNDING_UNAVAILABLE_MESSAGE`, with `status: "grounding_unavailable"`.
- `fallback_legacy` → the legacy prompt runs, with
  `status: "fallback_legacy"` and a `fallback_reason`.

Both are audited. Neither ever reports `status: "grounded"` or claims source ids
it did not read.

### Admin / debug surface

`GET /api/admin/studio-context-work` (admin cookie, 401 otherwise) →
`work.debug_state()`: whether the pipeline is active, the mode and failure
policy, pipeline and prompt versions, which rooms are grounded and which are
not, Gene Key and Line corpus readiness, the outcome vocabulary, pending
corpora, and the redacted recent activity. Content-free by construction — the
tests assert that no essence, reflection, sealed value, cipher id or canonical
prose appears anywhere in the payload.

The Infrastructure tab renders two rows inside the existing "stUdio context
mode" panel:

```
Grounded rooms       work: grounded · call, field, lens: legacy · lines 6/6
Last Work response   grounded · relevance gene_key · personal yes · sources 2 · <ts>
```

### Manual validation checklist

1. In `legacy`, open The Work and generate a summary. Note the output and
   confirm the network `done` event has no `grounding` key.
2. `GET /api/admin/studio-context-sources` → `ok: true`, `present: 64`.
3. Activate `grounded_v1` (Infrastructure tab, confirm step). Check
   `/api/admin/studio-context-work` shows `active: true` and `lines 6/6`.
4. As a member with **no** accepted records, generate in The Work: the copy must
   not claim to know anything about them, and `used_personal_context` is `false`.
5. Accept an orientation record with a Gene Key, then generate ordinary product
   copy: `relevance` is `personal_only` and `used_canonical_sources` is `false`.
6. Ask "go deeper into my Gene Key here": `relevance` is `gene_key`,
   `canonical_source_ids` names the key the member owns, and the copy does not
   declare an identity.
7. Ask for a Gene Key while owning none: a clarification is streamed and the
   model is never called.
8. Generate in Lens, Field and Call: output style unchanged, no `grounding` key.
9. Confirm the Nexus model and reasoning effort are what they were before step 3.
10. Roll back to legacy. Repeat step 1 and confirm the output path is identical.

### Known limitations

- One room and one route. Lens, Field, Call, `/inspire-arrival`, `/generate` and
  `/search` still build prompts from client-submitted material.
- Relevance is lexical, not semantic. It is tuned to under-retrieve: an
  unusually phrased request for source material will land on `personal_only`
  rather than guess. Adding vocabulary is a one-line change with a table test.
- Recent activity is a per-process, in-memory ring buffer of 25. It is not
  durable and not shared across workers; the `events` table is the durable
  record.
- Line retrieval uses the single line the member's records carry. Multiple owned
  keys retrieve each key's bands, but only one line.
- The Yoga Sutra corpus is not implemented. `relevance.EXTENSION_CORPORA` names
  it and `debug_state()` reports it as pending; nothing retrieves it.

## What Phase 3 plugs into

Explicitly **not** in this PR: the Yoga Sutra corpus, Digit, the CommonUnity
router, and the other three rooms. The seams are in place:

- `assembler.register_corpus(name, loader)` — a second canonical corpus
  implements the same contract as `canonical.py`: validated ids, per-item
  checksums, a corpus version, and a structured error on missing/malformed
  material.
- `relevance.EXTENSION_CORPORA` — the declared, unimplemented extension point.
  A Sutra outcome joins `OUTCOMES` and the table test grows a row.
- `work.py` is room-shaped, not Work-shaped, apart from `WORK_ACTION_CONTRACT`
  and `ROOM`. A second room is a second contract plus a second routing line, not
  a second pipeline.

## Tests

- `tests/studio-context-corpus.test.py` — corpus completeness, schema, source
  integrity, checksum/version stability, path safety.
- `tests/studio-context-modes.test.py` — defaults, activation, rollback,
  invalid/stale values, independence from model selection, admin auth.
- `tests/studio-context-records.test.py` — migration, ownership isolation,
  sealed exclusion, provenance transitions, idempotency, no auto-promotion of
  AI output, trace redaction, failure/fallback policy, legacy parity.
- `tests/studio-context-work.test.py` — the Work pilot: routing (only `work`,
  only `grounded_v1`, Lens/Field/Call/unknown/Arrival untouched), the
  table-driven relevance suite, clarification instead of interpretation, no
  invented orientation, client transcript override, uncorroborated and traversal
  key pointers, injection inside uploaded material, forged block markers,
  exclusion of rejected/proposed/sealed/cross-member records, both failure
  policies against a broken Gene Key corpus and a broken Line corpus, the
  legacy → grounded → legacy round trip, independence from model/effort
  selection, and admin-surface privacy and auth gating.

Also relevant: `test_inspire_layer2_fields`, `test_fieldprint_audience_nexus`,
`test_nexus_model`, `test_nexus_model_management`, `test_arrival_portrait` — the
legacy Nexus behaviour the Work pilot must not disturb.

Run: `python3 tests/studio-context-corpus.test.py` (etc.), or via `pytest`.
