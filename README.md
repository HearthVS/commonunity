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

## Shared files ("Library")

Self-service file hosting from the admin panel. An authenticated admin uploads a
file once in the **Library** tab and immediately receives a stable public share
link — no code change or deploy required.

The Library holds two kinds of entry, both surfaced under the same
`https://commonunity.io/share/<slug>` alias space:
- **Files** — bytes uploaded and hosted here (see below).
- **Links** — an alias for an already-hosted URL (e.g. a deck at
  `https://commonunity.io/decks/…/`). Use **Add existing link** to give it a
  short slug/title without re-uploading anything; the alias issues a temporary
  redirect to the target.

**Config (env vars)**

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `COMMONUNITY_SHARED_FILES_PATH` | optional | see below | Directory for uploaded bytes. Point this at the Railway persistent volume. |
| `COMMONUNITY_SHARED_FILES_MAX_BYTES` | optional | `26214400` (25 MB) | Per-file upload size limit. |

Storage path resolution when `COMMONUNITY_SHARED_FILES_PATH` is unset:
1. If `COMMONUNITY_ADMIN_DB_PATH` is set (production), files are stored in
   `shared_files/` next to the admin DB — i.e. on the same persistent volume.
2. Otherwise (local dev) files go to `shared_files_store/` in the repo root,
   which is deliberately **outside** `data/` so they are never exposed by the
   `/data` static mount.

**Railway requirement:** uploaded bytes must live on the mounted persistent
volume, or they are lost on redeploy. Set `COMMONUNITY_SHARED_FILES_PATH` to a
path on the same volume as `COMMONUNITY_ADMIN_DB_PATH` (e.g. `/data/shared_files`),
or rely on the default which co-locates them with the admin DB. Metadata lives in
the existing admin SQLite DB (`shared_files` table), so it is durable with the
rest of admin state.

**Supported formats** (allowlist — everything else is rejected with 415):
`.html/.htm`, `.pdf`, `.png/.jpg/.jpeg/.webp/.gif/.svg`, `.txt/.md`,
`.docx/.pptx/.xlsx`, `.zip`. Empty files and files above the size limit are
rejected (400 / 413).

**Public URL:** `https://commonunity.io/share/<slug>`. The slug is derived from
the custom slug, else the title, else the filename; collisions get a `-2`, `-3`
suffix. PDFs, images and text render inline; office documents and ZIP download.
Deactivating an item makes the URL 404 without deleting bytes; deleting removes
the bytes and permanently disables the URL.

**Link entries:** created via **Add existing link** (or `POST
/api/admin/shared-links` with `{target_url, title?, slug?}`). Only `http`/`https`
targets are accepted — `javascript:`, `data:`, `file:`, URLs with embedded
credentials, control characters, and malformed or overlong (>2048 char) URLs are
rejected (400). Links carry no bytes: `/share/<slug>` returns a **307 temporary
redirect** to the validated target with `Referrer-Policy: no-referrer` and
`Cache-Control: no-store`. Validation-at-creation (scheme allowlist, no control
chars) prevents any response-header/response-splitting injection into
`Location`. Slugs share one namespace with files (a link cannot claim a slug a
file already holds — it gets a `-2` suffix). Deactivate/reactivate/delete behave
the same as files, except delete only removes metadata (there are no bytes). The
list labels each row as **LINK** or **FILE** and shows the destination host/path.

**Security model:**
- Bytes are written under randomized internal filenames (the uploaded name is
  never trusted on disk) and read back through a path-containment check, so a
  crafted slug cannot traverse out of the store.
- The store is kept out of every `StaticFiles` mount; files are reachable only
  through the header-controlled `/share/<slug>` route.
- All responses set `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`.
- HTML and SVG (the script-capable formats) are served with a
  `Content-Security-Policy: sandbox …` that **omits** `allow-same-origin`,
  forcing the document into a unique opaque origin. It can present freely
  (scripts, forms, popups) but cannot read commonunity.io admin/beta cookies,
  localStorage, or make credentialed same-origin API calls. `frame-ancestors
  'none'` + `X-Frame-Options: DENY` block clickjacking.

**Residual risk:** the sandbox gives uploaded HTML an opaque origin but it is
still served from the `commonunity.io` host. This blocks cookie/storage/API
access (verified by tests) but shares the registrable domain. For stronger
isolation of untrusted HTML, serve the `/share` route from a dedicated
`share.commonunity.io` (or a separate sandbox domain) in the future so it cannot
share any origin state with the app at all.

Tests: `python -m unittest test_shared_files -v` (auth gating, HTML/PDF upload +
link generation, byte serving, isolation headers, disallowed/empty/oversized
rejection, slug collisions, traversal resistance, list, deactivate/delete
lifecycle, link creation + alias redirect, generated slugs, file/link slug
collision, invalid scheme/credential/malformed URL rejection, link lifecycle,
and health/admin regressions).

## Private beta hub (`/beta`)

A CommonUnity-level (not cOMpass) private beta space entered through a protected
magic link. A participant opens their link, crosses a calm OM-field threshold
(name + email), and is admitted into a quiet shared hub — Welcome, Path,
Announcements, and Library / Sharings — all behind the same `/beta` route.

It is built entirely on the **existing** invite/beta infrastructure — no new
auth system, storage, or parallel routing:

- **Magic link:** `https://commonunity.io/beta?invite=<token>`. Handled by
  `serve_beta`, which validates the token, sets the signed `commonunity_beta_access`
  + `commonunity_invite_token` cookies, records the open, and redirects to a
  clean `/beta`. Mirrors the existing `/studio?invite=<token>` handoff. Operators
  get this link from the admin panel: it is returned as `beta_link` by
  `POST /api/admin/invites` and `GET /api/admin/invites/{id}/link`, alongside the
  existing cOMpass `magic_link`.
- **Threshold vs hub:** the same `/beta` route serves the CommonUnity beta
  surface (`beta/beta.html`, which reuses `threshold/threshold.css`). `beta.js`
  asks `GET /api/beta/session` — resolved **server-side** from the signed invite
  cookie — and shows the name/email threshold until the participant is admitted,
  then the hub. A caller with no valid invitation falls through to the historical
  shared-code gate, so the hub never bypasses a threshold.
- **Admission / data capture:** `POST /api/beta/admit` requires a valid invite
  cookie (server-side check, never client-only), captures the participant's own
  name + email onto their existing `invites` row, and stamps `beta_admitted_at`.
  Minimal data only. A `beta_admitted` event is recorded with the invite linkage
  but **no** contact identity in the shared feed (same privacy model as the rest
  of the invite lifecycle).
- **Hub sections:** *Announcements* reuse the participant `GET /api/messages`
  feed (scoped to the invite cookie); *Library / Sharings* reuse the admin
  Library store read-only via `GET /api/beta/library` (admission-gated, lists
  active `shared_files` as their public `/share/<slug>` aliases); *Path* links
  into the CommonUnity apps the beta cookie already unlocks.

**Config (env vars)** — all pre-existing, nothing new:

| Var | Required | Purpose |
| --- | --- | --- |
| `ADMIN_COOKIE_SECRET` (or `ADMIN_ACCESS_CODE`) | yes | Signs the invite/beta cookies (`_sign_value`). Without it, cookies cannot be issued. |
| `COMMONUNITY_ADMIN_DB_PATH` | prod | SQLite path for the `invites` store (magic-link tokens + admission records). Point at the Railway persistent volume. |
| `COMMONUNITY_MAGIC_LINK_TOKENS` | optional | CSV of static tokens accepted as valid invitations without a DB row (view-only; cannot self-admit). |
| `COMMONUNITY_INVITE_BASE_URL` | optional | Overrides the base used when building the `beta_link` in admin/email. |

**Operator flow:** open `/admin`, create an invite (name required), copy the
returned `beta_link`, and send it. The participant opens it, enters their name +
email, and lands in the hub. Admission records (name, email, timestamp) are
visible in the admin invites tab.

Tests: `python -m pytest tests/test_beta_hub.py -v` (link shape, invalid/missing
link → gate, valid handoff, session state, name/email validation + capture,
admission gating, refresh/direct hub access, member-gated library, asset
allowlist).

## Nexus model & response depth

All Nexus / Studio / generation endpoints share a single active model resolved
fresh per request by `server._nexus_model()`. There is **no user-facing model or
mode selector** — the model is an admin-controlled operational decision, not a
per-request option. Every Anthropic request sends
`output_config={"effort": <level>}` so the model's reasoning depth is
deterministic rather than implicit.

### Model management (admin-only, future-proof)

The active model is managed from the admin **Infrastructure** tab — no code
change and no repo-wide model upgrade is needed to move to a newer model.

- **Resolution order:** admin-selected model (durable in `app_settings`) →
  `NEXUS_MODEL` env default → safe built-in fallback `claude-sonnet-5`
  (`server._NEXUS_MODEL`). Selection survives restarts/deploys with the rest of
  the admin SQLite DB. `claude-sonnet-5` stays active by default.
- **Discovery:** candidates come from the account itself via the SDK Models API
  (`client.models.list()`, SDK 0.116.0 — the documented first-party path, so no
  hard-coded catalog goes stale). Pagination is walked explicitly and bounded;
  discovery is cached ~60s. Auth / network / no-credential failures are reported
  gracefully (coarse code only, never a raw body) and never raise.
- **Validation before activation:** a candidate is checked with a tiny Messages
  request using the project's live `output_config.effort` shape and a minimal
  token budget, plus a minimal streaming probe. Results are classified as
  `success`, `unavailable_model`, `incompatible`, `auth_error`, `rate_limited`,
  `transient`, `credentials_unavailable`, or `invalid_candidate`. No secrets or
  raw error bodies are exposed.
- **Safety:** a new model appearing in discovery **never** activates on its own.
  Only an admin can validate and activate. Activation happens **only** after a
  successful validation (arbitrary untested activation → `422`); a failed
  validation leaves the active model unchanged. A manual model-id fallback is
  accepted only when discovery is unavailable and is still validated first.
- **Atomic activation & rollback:** activation records the prior active model as
  *previous known-good*, then sets the candidate active, in one DB transaction.
  Subsequent requests use the new model; in-flight requests are unchanged.
  One-click rollback swaps back atomically (admin-authenticated).

Endpoints (all admin-gated):

- **`GET /api/admin/nexus-model`** — active model, selection `source`
  (`admin`/`env`/`default`), safe `fallback`, `previous_known_good`,
  `last_validation` (result/time), and `rollback_available`.
- **`GET /api/admin/nexus-model/available?refresh=true`** — account-discovered
  models (cached; `refresh=true` forces a fetch).
- **`POST /api/admin/nexus-model/validate`** `{"model": "..."}` — validate a
  candidate without activating; persists the last validation result.
- **`POST /api/admin/nexus-model/activate`** `{"model": "..."}` — validate then
  atomically activate; `422` if validation fails.
- **`POST /api/admin/nexus-model/rollback`** — atomic rollback to the previous
  known-good model; `409` if none recorded.

The authenticated `/api/admin/health` `config.nexus` block also carries
`model_source`, `model_fallback`, `previous_known_good`, `rollback_available`,
and the last validation summary. Anonymous endpoints never expose model
internals.

**Railway env var (optional):** `NEXUS_MODEL` sets the boot-time default model
if no admin selection is stored. If unset it falls back to `claude-sonnet-5`; an
admin activation always wins. No env change is required.

Tests: `python -m unittest test_nexus_model_management -v`.

### Response depth (reasoning effort)

- **Effort levels:** `low` (fastest), `medium`, `high` (deepest — product
  default). Higher effort improves quality but increases latency and cost.
- **`GET /api/admin/nexus-effort`** (admin-gated) — returns the non-secret active
  configuration: active `model`, active `effort`, which layer is authoritative
  (`source`: `admin` / `env` / `default`), available `levels`, and the
  `env_default`.
- **`PUT /api/admin/nexus-effort`** (admin-gated) — sets the global effort
  override (`{"effort": "low|medium|high"}`, validated → `422` otherwise). The
  value is persisted durably in the admin SQLite `app_settings` table, so it
  survives restarts/redeploys. Changes apply to **subsequent** Nexus requests,
  never to a reply already streaming. The model is not changeable here.
- Resolution order: admin override (if set) → `NEXUS_EFFORT` env var → `high`.
- **Short-output endpoints** (opening lines, seed prompts, brief syntheses) keep
  their brevity through the prompt, not a tight token ceiling. They share
  `_NEXUS_SHORT_MAX_TOKENS` (1024) so `high`-effort reasoning has headroom and
  cannot consume the budget before any visible text is produced — the previous
  100/120/200 ceilings could blank/truncate these streamed replies at `high`.
- The control renders in the admin **Infrastructure** tab as "Nexus response
  depth", and the active model/effort also appears in the `/api/admin/health`
  `config.nexus` block.

**Railway env var (optional):** `NEXUS_EFFORT` sets the boot-time default
(`low` / `medium` / `high`). If unset or invalid it falls back to `high`; an
admin override always wins over it. No env change is *required* — the default is
already `high`.

Tests: `python -m unittest test_nexus_model -v`.

**Deployment note:** admin SQLite durability depends on
`COMMONUNITY_ADMIN_DB_PATH` (or `/app/data/...`) pointing at a persistent Railway
volume; the `database` health check surfaces a `degraded` warning if the path
looks ephemeral.

Tests: `python -m unittest test_system_health -v` (stdlib `unittest` +
FastAPI `TestClient`, no new dependencies).

## Arrival Portrait (Fieldprint builder)

The Fieldprint builder (`fieldprint.html` / `.js` / `.css`, embedded in stUdio)
lets a person use their selfie as the hOMe Arrival Portrait. Presentation is
non-destructive — only public-safe settings are persisted (never birth data,
Gene Keys or mechanics), so a page can be re-framed at any time.

- **Presentation** — `Arrival treatment` chooses framed (`contained`, the
  backward-compatible default) through `full-bleed`, which fills the hero region
  edge-to-edge with `object-fit: cover` (aspect preserved, no distortion).
- **Framing** — focal X/Y plus a restrained `Zoom` (100–200%) scale from the
  focal point so a face can be centred on desktop and mobile. Focal is a single
  responsive point (no separate mobile crop in this beta).
- **Cipher Field** — the one optional overlay treatment. A deterministic,
  privacy-safe SVG (root/expression/radiance palette + field hue + a stable
  seed) rendered by [`fieldprint-cipher-field.js`](fieldprint-cipher-field.js):
  a translucent field with torus-derived contour rings, drawn with a built-in
  face-safe centre mask and `soft-light` blend. One `Intensity` control (0–100%)
  plus an Off/Reset state. No engine, no birth data, no network, no
  generative-AI call — it is a pure function of public field primitives.
- **Persistence** — the builder's `snapshot()` (localStorage meta + IndexedDB
  image blobs) stores `hero.zoom` and a versioned `hero.overlay` recipe
  (`{ treatment, version, intensity, palette }`). The recipe is additive: the
  draft schema is unchanged, so existing saved pages load untouched, and a
  future stUdio Digital Vista workflow can re-open and extend the recipe without
  a migration.

Tests: `node --test test_cipher_field.js` (deterministic generation, privacy,
recipe round-trip) and `python -m unittest test_arrival_portrait -v`
(route, backward-compat defaults, persistence shape, builder wiring).

## Docs

- [`docs/home-design-grammar.md`](docs/home-design-grammar.md) — hOMe Design Grammar: the source of truth for the public hOMe doorway (Minimum Viable Digital Self), public/internal language rules, and stUdio builder implications.
