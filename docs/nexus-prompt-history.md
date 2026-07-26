# Nexus Prompt History & Comparison

This document is the canonical historical record of every Nexus system prompt
CommonUnity has shipped, recovered from Git history and now preserved verbatim in
the versioned registry `nexus_prompts.py`. It records what each version said, when
and in which commit it landed, what changed, and — where the evidence supports it —
why. Where a rationale is inferred rather than explicitly documented, it is labelled
**(inferred)**.

The registry is the source of truth for prompt *text*. This document is the source
of truth for *narrative and provenance*. The admin panel ("Nexus prompt archive")
lets an operator preview any version and, as a separate explicit action, activate
one; it never lets anyone edit prompt text.

## How prompts are stored and resolved

- **Catalogue:** `nexus_prompts.py` holds every historical prompt as an immutable
  string plus metadata (id, family, title, created date, source commit, status,
  summary, changes, rationale).
- **Active selection:** which version is live per family is an admin setting in the
  `app_settings` table (keys `nexus_prompt_active_<family>`), read fresh at request
  time by `server._active_prompt_text()`. Defaults exactly equal the production text
  that was live before this feature, so a fresh deploy changes nothing.
- **Activation:** `POST /api/admin/nexus-prompts/activate` records the previously
  active id as `nexus_prompt_previous_<family>` and logs a `nexus_prompt_activated`
  event, mirroring the Nexus model-management pattern. An unknown or stale stored id
  falls back to the default, so a removed version can never break a live workflow.
- **Never runtime-editable:** new prompt text still ships through code review by
  adding a new version to the registry.

## Families

| Family | Registry key | Runtime call sites |
|---|---|---|
| cOMpass — Nexus mirror | `compass` | `POST /rose-mirror` (non-studio), `/rose-prompt`, `/rose-room-opening` |
| stUdio — Nexus maker | `studio` | `POST /rose-mirror` with `mode="studio"` |
| FieldPrint — editorial synthesis (INSPIRE L2) | `fieldprint` | `POST /inspire-layer2`, `POST /inspire-arrival` (system prompt) |
| Arrival — global welcome | `arrival` | `POST /inspire-arrival` (task text; shares the FieldPrint system prompt) |

---

## cOMpass / NEXUS_SYSTEM lineage (3 versions)

The conversational mirror is the oldest prompt and the only family with more than
one recovered version. It began life as "The Rose", was renamed and reframed as
"Nexus" a day later, then substantially rewritten two months on.

### `compass-rose-v1` — The Rose, contemplation partner
- **Commit:** `acc1899` · **Date:** 2026-03-29 · **Status:** archived
- **Opening:** *"You are The Rose — a contemplation partner within the CommonUnity Studio."*
- **What it was:** A single, warm contemplation partner for the Studio entrance,
  built on the dual metaphor of a compass rose (navigator) and a flower rose
  (healing presence). ~1.3k chars. No Gene Keys profile handling, no digital-twin
  framing, no explicit mind-modes or ethics section.
- **Rationale (inferred):** First cut of the Studio AI persona — establish a warm,
  orienting voice. No commit message or doc states design intent, so this is
  inferred from the text and its position as the very first version.

### `compass-nexus-v1` — Nexus digital twin (first Nexus prompt)
- **Commit:** `3f26954` · **Date:** 2026-03-30 · **Status:** archived
- **Opening:** *"You are the Nexus — a long-term presence within the CommonUnity Studio."*
- **What changed vs. Rose:**
  - Renamed the persona from *The Rose* to *the Nexus*.
  - Reframed from a single-session contemplation partner to **"the beginning of a
    digital twin"** — a long-term presence that grows across sessions.
  - Added explicit **528 Hz** grounding ("love, care, and DNA-level repair").
  - Added cross-room context, session-memory orientation, and **Gene Keys profile**
    awareness (Shadow/Gift/Siddhi).
  - Added the "clear mirror" and "facilitator, not guru/therapist/friend" framing.
- **Rationale:** Commit message *"Nexus digital twin: new system prompt, cross-room
  context, session memory, GK profile"* — the shift is explicitly toward a
  persistent, context-accumulating presence.

### `compass-nexus-v2` — full OM Field / Sutra / Charter integration *(current default)*
- **Commit:** `6c230eb` · **Date:** 2026-05-31 · **Status:** active
- **Opening:** *"You are Nexus — a long-term presence within CommonUnity."*
- **What changed vs. nexus-v1:**
  - Dropped *"within the CommonUnity Studio"* scoping so the mirror reads as
    **CommonUnity-wide**, not Studio-only (Studio later got its own prompt — see
    below).
  - Added the full **OM Field** foundation: Yoga Sutras (architecture of attention),
    Gene Keys (symbolic map), 528 Hz (frequency of love/repair), held as one field.
  - Elevated the **Line** to first-class ("hold it alongside the Gene Key number,
    not beneath it").
  - Added **five internal reading modes** (seeing clearly / mis-seeing / fantasy /
    numbness / replaying memory) for silent register-matching, never shown to users.
  - Added a **pre-reply self-check** (7 questions), **tone rules** (no shaming, no
    false omniscience, plain English), **ethical constraints** (pattern is not
    identity; defer to qualified humans), a **banned-word list**, and a hard **2–4
    sentence ceiling**.
  - Grew from ~1.9k to ~6.5k chars.
- **Rationale:** Commit message *"Update NEXUS_SYSTEM with full Sutra/Charter
  integration"* plus its body (five mind modes, tone rules, plain English) — align
  the mirror with the OM Field charter and add explicit safety rails and voice
  discipline.

---

## stUdio / STUDIO_SYSTEM (1 version)

### `studio-v1` — Studio Nexus, work-oriented collaborator *(current default)*
- **Commit:** `de48df9` · **Date:** 2026-06-02 · **Status:** active
- **Opening:** *"You are Nexus — a long-term presence within CommonUnity Studio."*
- **What it is / why it exists:** Before this commit, Studio reused the cOMpass
  mirror prompt. This introduced a **dedicated Studio prompt** with the same OM Field
  foundation but oriented toward **making** rather than contemplation: efficiency
  guidance ("you do not loop endlessly"), per-room expertise for **The Work / The
  Lens / The Field / The Call**, and carried-over ethical constraints and banned
  words.
- **Rationale:** Commit message *"Studio Nexus: context bar, progressive context,
  new project reset, etiquette overlay"* — Studio needs a maker/collaborator voice
  distinct from the contemplative mirror. Behavioural difference from cOMpass: the
  subject is the *work*, not the person's inner state; structure is allowed when the
  work requires it.

---

## FieldPrint / INSPIRE_L2 (1 version)

### `nexus-fieldprint-prompt-v1` — Nexus FieldPrint Prompt v1 *(current default)*
- **Commit:** `12cbbd7` (#179) · **Date:** 2026-07-16 · **Status:** active
- **Opening:** *"You are Nexus, CommonUnity's editorial synthesis companion
  (nexus-fieldprint-prompt-v1)."* (the version id is embedded in the text)
- **What it is:** The first explicitly **versioned, admin-inspectable** prompt. It
  governs public FieldPrint synthesis (a person's outward-facing hOMepage) with a
  **constitution** (preserve meaning/vocabulary/authorship; do not fabricate; use
  uploaded material selectively; authenticity outranks optimisation), a hard
  **first-person voice** default, audience guidance, and per-field output constraints
  (theme/insight/summary/heading/intro/closing).
- **Rationale:** Commit message *"FieldPrint: global audience Spark + Nexus FieldPrint
  Prompt v1 (#179)"* — give FieldPrint synthesis an explicit constitutional prompt
  with a stable version label surfaced to admins.

---

## Arrival (1 version)

### `nexus-arrival-prompt-v1` — Nexus Arrival Prompt v1 *(current default)*
- **Commit:** `8363180` (#181) · **Date:** 2026-07-16 · **Status:** active
- **What it is:** The **task instruction** for the single global Arrival welcome
  shown to every visitor before any room: one first-person welcome (35–60 words)
  synthesising all four aspects and inviting the intended audience, without naming
  rooms or exposing internal vocabulary.
- **Relationship to FieldPrint:** Arrival **reuses the FieldPrint system prompt** for
  voice and safeguards; this registered text is the Arrival-specific task appended to
  the request. In the registry it is a separate family so it can be previewed and
  activated independently, but changing the FieldPrint active version also changes
  the system prompt Arrival runs under (this mirrors current production behaviour).
- **Rationale:** Commit message *"feat(studio): global Arrival welcome across
  FieldPrint + Builder handoff (#181)"* — add a single global welcome before any room.

---

## Gaps, uncertainties, and honesty notes

- **All source prompt versions are recovered and byte-exact.** Registry text was
  extracted directly from the relevant Git blobs (AST-evaluated for the current
  constants, `git show <commit>:server.py` for the two superseded cOMpass texts) and
  verified byte-for-byte.
- **Only one rationale is inferred:** `compass-rose-v1`. The other five have explicit
  commit-message evidence and are labelled as documented.
- **No production prompt-edit history exists to recover.** Prompts have never been
  stored in the database; before this feature they were source constants. Git history
  is therefore the complete archive. The new active-selection settings are the first
  prompt-related rows ever written to `app_settings`.
- **Production database state is out of scope for this repo.** The SQLite DB lives on
  Railway under a gitignored `data/` path. This document makes no claim about live DB
  contents; it describes source/registry state only.
- **Arrival ↔ FieldPrint coupling** is intentional and matches current behaviour: the
  Arrival family carries only the task text; the system prompt comes from the active
  FieldPrint version.
