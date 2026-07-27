# stUdio context modes — legacy and grounded_v1

Phase 1 of the stUdio Nexus grounding work. It establishes the server-side
context architecture, its trust boundaries and its rollback path **without
changing what production does**. No generation endpoint behaves differently
until an operator explicitly activates `grounded_v1`.

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
behaviour. This PR does not touch `build_system_prompt`, `build_user_prompt`,
`build_point_section`, or any generation route. In `legacy` mode no code in
`studio_context` runs on a generation request at all, which is what makes the
parity guarantee cheap to hold and cheap to test.

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
  assembler.py   the authenticated assembler, plus Phase 2 seams
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
```

## Operational checks

Before activating `grounded_v1`:

1. `GET /api/admin/studio-context-sources` → `ok: true`, `present: 64`. The
   activate endpoint enforces this too and refuses with 422 otherwise.
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

Rollback loses nothing. The mode is a read-time switch — orientation records,
acceptances and provenance survive a switch in either direction, and switching
back to `grounded_v1` finds them intact. The test suite asserts round-trip
switching with no data loss.

## What Phase 2 plugs into

Explicitly **not** in this PR: the Work-room retrieval/relevance behaviour, the
Yoga Sutra corpus, Digit, and the CommonUnity router. The seams are in place:

- `assembler.select_relevant(records, room, budget)` — Phase 1 selects by
  recency over the already-ownership-filtered set. The relevance pilot replaces
  this function body; the trust checks around it do not move.
- `assembler.register_corpus(name, loader)` — a second canonical corpus
  (Yoga Sutras) implements the same contract as `canonical.py`: validated ids,
  per-item checksums, a corpus version, and a structured error on
  missing/malformed material. `assemble()` then cites both corpora in one trace.
- Wiring grounded context into generation is a Phase 2 decision. Phase 1
  deliberately stops at `/api/studio/context-preview` so that response quality
  cannot change by accident.

## Tests

- `tests/studio-context-corpus.test.py` — corpus completeness, schema, source
  integrity, checksum/version stability, path safety.
- `tests/studio-context-modes.test.py` — defaults, activation, rollback,
  invalid/stale values, independence from model selection, admin auth.
- `tests/studio-context-records.test.py` — migration, ownership isolation,
  sealed exclusion, provenance transitions, idempotency, no auto-promotion of
  AI output, trace redaction, failure/fallback policy, legacy parity.

Run: `python3 tests/studio-context-corpus.test.py` (etc.), or via `pytest`.
