# cOMpass Onboarding Threshold (bolt-on module)

A modular, independently updatable surface that owns the first-touch ritual
for new cOMpass users.

The threshold is intentionally **bolted on**, not fused into the rest of the
Compass UI. The rest of CommonUnity (Compass, Studio, Tuner, Field) only
sees this module through one thing: the **OM Cipher contract** in
`localStorage`. That contract is the stable connection layer between apps.

## Files in this module

| File | Purpose |
|---|---|
| `threshold.html` | Standalone page for the threshold flow, served at `/threshold` |
| `threshold.css`  | Scoped styles + progressive palette CSS variables |
| `threshold.js`   | Six-state machine + screen renderers + handoff writer |
| `contract.js`    | OM Cipher contract — shape, read, write, version flag |
| `README.md`      | This file |

## The OM Cipher contract

Storage key: `commonunity_om_cipher_v1` (declared in `contract.js`).

```json
{
  "contract_version": 1,
  "identity": {
    "full_name": "",
    "birth_date": "",
    "birth_time": "",
    "birth_place": ""
  },
  "name_narrative": {
    "essay": "",
    "generated_at": "",
    "version": 1,
    "source": "onboarding_threshold"
  },
  "om_cipher": {
    "palette": {
      "primary": "",
      "secondary": "",
      "seasonal_accent": "",
      "version": 1,
      "source": "om_cipher_v1"
    }
  },
  "threshold": {
    "completed": true,
    "completed_at": "",
    "version": 1,
    "source": "onboarding_threshold_v2"
  }
}
```

**Rule:** the threshold module is the only writer of this contract. Other
apps read only. Add new semantic blocks additively; never rename or
repurpose existing keys.

## Six-state flow

1. **name-threshold** — collects full name + birth date.
2. **interim-chamber** — atmospheric pause while essay generates.
3. **name-essay** — 300-400 word reflection, presented as an asset.
4. **reflection** — five contemplative questions (read-only).
5. **identity-completion** — birth time + birth place.
6. **prepared-setup** — hand off to existing Compass setup (`/?threshold=done`).

## Generation seams

- **Name essay**: posts to `POST /api/threshold/name-essay` with
  `{ full_name, birth_date }`. The server endpoint reuses the same
  Anthropic client and Sonnet model as Inspire/Nexus, with a prompt cue
  tuned specifically for this feature (calm/intimate voice, sacred but
  not solemn, no mechanistic language).

  If the endpoint is unreachable, the chamber surfaces a respectful
  retry/continue path and a hand-written fallback essay is stored so
  the user's experience never dead-ends.

- **Palette**: tries `window.OmCipher.generate()` from `sdk/om_cipher.js`
  first. If the SDK is unavailable or its output doesn't include a
  palette, the module computes a narrow deterministic MVP palette from
  name + birth date (`source: 'threshold_provisional_mvp_v1'`). The
  palette is recomputed at the Identity Completion step with the full
  identity bundle.

## Replay

The naming ritual is replayable. To enter it again after first completion:

- Navigate to `/threshold?replay=1`, or
- Use the glowing replay icon next to the cOMpass title (added to
  `index.html`, opens `/threshold?replay=1` in a new tab).

First-time users (no contract present) are sent through automatically by
the welcome overlay in `index.html`.

## Integration touch-points in the rest of the repo

The threshold module is bolt-on. Outside this directory, only the
following minimal touch-points exist:

- `server.py`
  - Adds `GET /threshold` route (serves `threshold.html`).
  - Adds `GET /threshold/{file}` route (serves css/js).
  - Adds `POST /api/threshold/name-essay` endpoint.
- `index.html`
  - On welcome overlay "Begin", first-time users with no
    `commonunity_om_cipher_v1` contract are redirected to `/threshold`.
  - On setup screen, if a contract is present, the manual atmosphere
    chooser is hidden and `dob`/`tob`/`pob`/`companion-name` are
    prepopulated (the threshold collects the user's own identity, which
    is the OM Cipher subject — i.e. the companion, not the guide); a
    compact palette explanation appears in its place.
  - On Compass title, a small replay icon links to `/threshold?replay=1`.

The threshold module can be evolved freely without touching the rest of
the codebase, as long as the contract shape remains stable.
