# Visual asset map

A snapshot of where visual assets currently live in this repository, what
each folder is for, and which folder is authoritative for each kind of
asset. Pair this with `assets/brand/README.md`, which is the canonical
source-of-truth statement for brand assets.

This is documentation, not configuration. It does not change build or
deployment behavior.

---

## Brand rule (non-negotiable)

The CommonUnity logo must always appear as **transparent artwork resting
directly on the surrounding field** — never inside a background plate, badge,
card, colored container, border, shadow, or rounded frame. The canonical
UI/product asset is **`primary-logo-transparent.svg`**; the plate-bearing
`primary-logo.svg` / `primary-logo-light.svg` are legacy/special-purpose and
must not be used on live surfaces. The full MUST/MUST NOT statement lives in
`assets/brand/README.md` and is enforced by `tests/test_brand_logo_rule.py`.

---

## Quick answer

- **Brand logos / marks / favicons** → source of truth is `assets/brand/`.
  Mirrored to `tuner/assets/brand/`. Inlined inside `homepage.html` and
  `manifesto.html` (and their tuner copies) as `<symbol id="logo-lockup">`
  and `#logo-mark`.
- **Marketing-page HTML** → source of truth is the repo root
  (`homepage.html`, `manifesto.html`, `studio.html`). Mirrored to
  `tuner/client/public/` for the Tuner deployment.
- **Tuner instrument images / audio** → source of truth is
  `tuner/assets/images/` and `tuner/assets/audio/` (Tuner-specific, no root
  mirror).
- **Misc audio (e.g. birdsong)** → root `audio/`.
- **Working / attached design inputs** → `tuner/attached_assets/` (raw
  reference imagery; not served as production assets).

---

## Folder inventory

### `assets/brand/` — **source of truth for brand**
- `primary-logo-transparent.svg` — **canonical wordmark for UI/product**;
  gold-OM lockup with no background plate (rests on the field)
- `primary-logo.svg` — legacy/special-purpose; same lockup with a baked-in
  dark background plate — do not use on live surfaces
- `primary-logo-light.svg` — legacy/special-purpose light-background variant
- `mark.svg` — compact OM mark
- `mono-mark.svg` — single-color mark; used as Safari `mask-icon`
- `favicon.svg` — brand favicon (SVG)

Served by `server.py` at `/assets/brand/*` via a `StaticFiles` mount on
`assets/brand`. Referenced by `homepage.html` and `manifesto.html` as
`/assets/brand/favicon.svg` (`<link rel="icon">`) and
`/assets/brand/mono-mark.svg` (`<link rel="mask-icon">`).

### `tuner/assets/brand/` — **deployment mirror**
Byte-identical copy of `assets/brand/`. Exists because
`tuner/server/static.ts` mounts `process.cwd()/assets` at `/assets`; when
the Tuner runs from the `tuner/` working directory, this folder is what
gets exposed at `/assets/brand`. Edit `assets/brand/` first, then copy.

### `tuner/assets/audio/` — **Tuner instrument audio**
Tuning-fork and bowl recordings (`BELL-771.mp3`, `BOWL-*.mp3`, `TF-*.mp3`).
No root mirror; only the Tuner deployment serves these.

### `tuner/assets/images/` — **Tuner instrument imagery**
Per-instrument PNG + WebP renders (`<KEY>_main.png`, `<KEY>_main.webp`).
Filenames match the audio keys 1:1. No root mirror.

### `tuner/attached_assets/` — **design reference inputs**
Raw reference photos / scans used during design (`biofield-imbalances.jpg`,
`biofield-trigger-points.jpg`). Not production assets. Aliased as `@assets`
in `tuner/vite.config.ts` for client-side imports during development.

### `tuner/client/public/` — **Tuner static-served HTML + favicons**
- `homepage.html`, `manifesto.html`, `studio.html` — mirrors of the root
  files; served by the Tuner Express app at `/home`, `/manifesto`,
  `/studio`. Sync these whenever the root copies change.
- `og-image.png` — OG/social card (1200-wide). Currently only present
  here; if reused by the Python deployment, mirror to a future
  `assets/social/og-image.png` and update references.
- `favicon.png`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-512.png`,
  `apple-touch-icon.png` — raster favicons used by the Tuner-specific
  `index.html`.

### `audio/` (repo root) — **non-Tuner audio**
`birdsong.mp3` only. Used by the marketing pages / Studio.

### `favicon.svg` (repo root) — **legacy favicon**
Served by `server.py` at `/favicon.svg`. The brand SVG favicon is at
`assets/brand/favicon.svg` and is the one referenced by `homepage.html`
and `manifesto.html`.

---

## Inline SVG consumers

Two HTML files embed the brand lockup as inline `<symbol>` definitions
rather than loading `primary-logo.svg`. These are **inline mirrors** of the
brand lockup and must be synced manually when the lockup changes.

| File | Inline symbol IDs |
|---|---|
| `homepage.html` | `#logo-lockup`, `#logo-mark`, `#g-compass`, `#g-studio`, `#g-tuner` |
| `manifesto.html` | `#logo-lockup` |
| `tuner/client/public/homepage.html` | same as root `homepage.html` |
| `tuner/client/public/manifesto.html` | same as root `manifesto.html` |

The lockup geometry is documented in `assets/brand/README.md` under
"Inline SVG consumers." A future refactor can replace these with
`<img src="/assets/brand/primary-logo.svg">` or `<use href>` references to
an external sprite sheet, eliminating the inline duplication.

---

## Update workflow at a glance

1. Edit `assets/brand/<file>.svg` (source of truth).
2. Copy to `tuner/assets/brand/<file>.svg` (deployment mirror).
3. If the lockup geometry changed, update the inline `<symbol>` blocks in
   the four HTML files listed above.
4. Verify `/home`, `/manifesto`, `/studio` render correctly in the browser.
5. Commit source + mirrors + inline updates together.

See `assets/brand/README.md` for the full rationale and the naming
conventions for new asset categories.
