# CommonUnity

Personal OS — Compass, Studio, Tuner, Nexus, **Field**, and (planned) Home / Page builder.

## Layout

| Path | Stack | Purpose |
|---|---|---|
| `server.py`, `index.html`, `studio.html`, `homepage.html`, `manifesto.html` | FastAPI + static | Root marketing + Compass + Studio + AI endpoints |
| `tuner/` | Node 20 + Vite + React + SQLite (Drizzle) | Sound healing app — frequencies, sessions, intake |
| `field/` | Node 20 + Express + SQLite | **The cOMmons** — public commons / Living Profiles (Phase 1). Folder and routes kept as `/field` for backward compat; the visible brand is **cOMmons**. |
| `sdk/` | TS/JS | Shared utilities — Gene Keys (`genekeys.ts`), Sigil (`sigil.js`) |

See `field/README.md` for the Field service and `tuner/SYNTHESIS_ENGINE.md` for Tuner.

## Admin system quality (pre-beta instrumentation)

The private `/admin` control room includes lightweight, dependency-free health
and readiness instrumentation. It runs in-process (stdlib only) so it adds no
deployment churn.

- **`GET /api/admin/health`** (admin-gated) — active, bounded checks with a
  per-check `status` (`healthy` / `degraded` / `unconfigured` / `unknown`) and
  `duration_ms`:
  - `app` — runtime is responding.
  - `database` — read **and** write probe against the admin SQLite DB (round-trips
    a value through a `health_probe` table), plus a persistence hint based on
    `COMMONUNITY_ADMIN_DB_PATH` / `/app/data`.
  - `routes` — readiness of important local routes by verifying their backing
    asset is present and readable. Gated routes are flagged (a public fetch would
    return the beta gate, not the asset); optional modules absent from a deploy
    (e.g. `/threshold`) read as `unconfigured`, not a failure.
  - `dns` — resolves `commonunity.io` with a timeout.
  - `anthropic` / `resend` / `beta_tokens` — presence of optional config
    (booleans only, never values).

  The response also carries deployment `version` (commit/branch from
  `RAILWAY_GIT_*` env vars, a committed `VERSION` file, or local `.git`), a
  `generated_at` timestamp, `total_duration_ms`, and a `config` readiness block
  with human-readable `warnings`. No secrets or raw exception messages are ever
  included.

- **`GET /api/admin/post-beta-tasks`** (admin-gated) — serves
  [`post_beta_tasks.json`](post_beta_tasks.json), a source-controlled, read-only
  list of deferred operational hardening work. Each task has a stable `id`,
  `title`, `rationale`, `phase`, `status`, and `completion_criteria`. The shape
  is designed to later evolve into editable admin tasks without changing the API.

Both surfaces render in the admin **Infrastructure** tab (live health summary +
deployment version, config warnings, and the post-beta task list).

**Deployment note:** admin SQLite durability depends on
`COMMONUNITY_ADMIN_DB_PATH` (or `/app/data/...`) pointing at a persistent Railway
volume; the `database` health check surfaces a `degraded` warning if the path
looks ephemeral.

Tests: `python -m unittest test_system_health -v` (stdlib `unittest` +
FastAPI `TestClient`, no new dependencies).

## Docs

- [`docs/home-design-grammar.md`](docs/home-design-grammar.md) — hOMe Design Grammar: the source of truth for the public hOMe doorway (Minimum Viable Digital Self), public/internal language rules, and stUdio builder implications.
