# CommonUnity brand assets — source of truth

This folder (`assets/brand/`) is the **source of truth** for CommonUnity brand
visual assets. If you are adding, changing, or replacing a logo / mark /
favicon, **edit the file here first**, then sync the deployment mirrors and
inline copies described below.

The principle: brand assets live where the designer can find and edit them.
The garage stays open — parts visible, named clearly, and documented.

---

## The CommonUnity brand rule (MUST / MUST NOT)

This is a **permanent CommonUnity brand requirement**. It is not per-page
styling; it governs every first-party product/site surface, now and in future
work, and applies automatically without needing to be restated.

> **MUST:** The CommonUnity logo (the COMMONUNITY OM wordmark lockup) must
> always appear as **transparent artwork resting directly on the surrounding
> field** — the atmospheric background of whatever surface it sits on shows
> through it.
>
> **MUST NOT:** The logo must **never** be placed inside, or rendered with, a
> background plate, badge, card, colored container, border, drop shadow,
> rounded frame, or any other enclosing/boxed treatment — whether baked into
> the SVG (a background `<rect>`) or added in CSS (`background`,
> `border`, `box-shadow`, `border-radius`, or a wrapping "plate" element).

**The canonical asset for all UI/product use is
[`primary-logo-transparent.svg`](primary-logo-transparent.svg)** — it carries
no background plate. Use it (or the transparent inline lockup with the same
geometry) anywhere the wordmark appears on a product or marketing surface.

`primary-logo.svg` and `primary-logo-light.svg` bake a solid background `<rect>`
into the artwork. They are **legacy / special-purpose only** (e.g. generating a
standalone raster where a known solid backdrop is required). **Do not** use them
on live UI/product surfaces — doing so reintroduces the boxed "navy badge" look
that this rule forbids (see PRs #184 / #185). Reach for the transparent variant
instead.

This rule is enforced by regression tests in `tests/test_brand_logo_rule.py`
(the transparent asset must stay plate-free, the framed variants must not leak
onto first-party surfaces, and first-party wordmark CSS must not recreate a
frame). If you are intentionally changing brand policy, update this section and
those tests together.

---

## Files in this folder

| File | What it is | Where it's served |
|---|---|---|
| `primary-logo-transparent.svg` | **Canonical wordmark for all UI/product use.** Gold-OM COMMONUNITY lockup with **no background plate**, for placing directly on the surrounding field. | `/assets/brand/primary-logo-transparent.svg` |
| `primary-logo.svg` | **Legacy / special-purpose.** Same lockup but with a baked-in dark background `<rect>`. Do **not** use on live UI/product surfaces — use the transparent variant. | `/assets/brand/primary-logo.svg` |
| `primary-logo-light.svg` | **Legacy / special-purpose.** Lockup variant with a light background plate baked in; same restriction as `primary-logo.svg`. | `/assets/brand/primary-logo-light.svg` |
| `mark.svg` | Compact OM mark (favicon-size lockup of OM letters + crescent + bindu) | `/assets/brand/mark.svg` |
| `compass-mark-transparent.svg` | **Canonical small cOMpass mark for UI use.** Faceted OM-field diamond, transparent (no background plate) — the plate-free variant of the root `favicon.svg`. Use beside the `cOMpass` name on product surfaces. | `/assets/brand/compass-mark-transparent.svg` |
| `studio-mark-transparent.svg` | **Canonical small stUdio mark for UI use.** U-vessel holding the glow, transparent (no background plate) — the plate-free variant of the root `favicon-studio.svg`. Use beside the `stUdio` name on product surfaces. | `/assets/brand/studio-mark-transparent.svg` |
| `mono-mark.svg` | Single-color version of the mark, used as Safari `mask-icon` | `/assets/brand/mono-mark.svg` |
| `favicon.svg` | Brand favicon (SVG) | `/assets/brand/favicon.svg` |

The root `favicon.svg` (at the repo root) is the legacy favicon served by
`server.py` at `/favicon.svg`. The brand favicon at `/assets/brand/favicon.svg`
is the one referenced by `homepage.html` and `manifesto.html`.

---

## How `/assets/brand/` is served

Two deployments serve the same `/assets/brand/...` URL space, each from their
own copy:

1. **Python / FastAPI deployment (`server.py`)** mounts `assets/brand/` at
   `/assets/brand` (see `server.py` near the `_brand_dir` mount).
2. **Tuner / Express deployment (`tuner/server/static.ts`)** mounts
   `process.cwd()/assets` at `/assets`. When the Tuner process is started from
   the `tuner/` directory, that resolves to `tuner/assets/`, so
   `tuner/assets/brand/` becomes `/assets/brand` for that deployment.

Both deployments expose the same URL paths, but each reads from its own
folder on disk. That is why a mirror exists.

---

## Deployment mirrors (NOT sources of truth)

These folders are **mirrors of `assets/brand/`** and exist only because the
Tuner deployment serves files from its own working directory. Do not edit
them directly — sync them from `assets/brand/` after every change.

- `tuner/assets/brand/` — mirror, served by the Tuner Express app at
  `/assets/brand` when the Tuner is the active deployment.

To sync after editing source:

```sh
# From repo root, after editing assets/brand/<file>.svg
cp assets/brand/*.svg tuner/assets/brand/
```

(Or copy individual files. The contents must match byte-for-byte; otherwise
the two deployments will render different brand assets.)

---

## Inline SVG consumers (must be synced manually)

The marketing pages currently embed the lockup as **inline `<symbol>`
definitions** rather than loading `primary-logo.svg`. They are duplicated
representations of the same artwork and must be kept in sync until a future
refactor replaces them with `<img>` or `<use href="/assets/brand/...">`
references.

| File | Symbol IDs | What's inline |
|---|---|---|
| `homepage.html` | `#logo-lockup`, `#logo-mark`, plus glyph symbols (`#g-compass`, `#g-studio`, `#g-tuner`) | Full lockup + compact OM mark, defined in the `<svg width="0" height="0">` defs block near the top of `<body>` |
| `manifesto.html` | `#logo-lockup` | Full lockup, in the `<svg width="0" height="0">` defs block near the top of `<body>` |

The inline lockup geometry currently mirrors `primary-logo.svg`:
- viewBox `-30 0 760 132`
- text: `Josefin Sans 600 / 80px / +6 tracking`, anchored at `x=350 y=108`
- gold OM tspan, cream C/MONUNITY tspans
- crescent path centered on `x=122`
- bindu diamond centered on `x=122`
- `om-glow` Gaussian-blur filter applied to OM, crescent, bindu

These inline copies in **`tuner/client/public/homepage.html`** and
**`tuner/client/public/manifesto.html`** are mirrors of the root files and
must be synced the same way as brand SVGs.

---

## How to update brand assets safely

Follow this order so the source-of-truth folder always leads and no mirror
ever drifts ahead of it.

1. **Edit the source.** Update the relevant file in `assets/brand/`.
2. **Sync the deployment mirror.** Copy the changed file(s) into
   `tuner/assets/brand/` so the Tuner deployment serves the same bytes.
3. **Sync inline SVGs (only if logo geometry changed).** Update the inline
   `<symbol id="logo-lockup">` (and `#logo-mark` where present) in:
   - `homepage.html`
   - `manifesto.html`
   - `tuner/client/public/homepage.html`
   - `tuner/client/public/manifesto.html`
4. **Verify visually.** Open `/home` and `/manifesto` in the browser and
   confirm the lockup still renders correctly — header, hero, footer.
5. **Commit all synced files in one commit** so mirrors never lag the source
   in git history.

If you only change a non-inline asset (e.g. `favicon.svg`, `mono-mark.svg`),
step 3 is not needed.

---

## Naming conventions for future assets

Keep filenames descriptive, lowercase, and hyphen-separated. Group by
purpose, not by page.

- **Brand (this folder):** `primary-logo.svg`, `primary-logo-light.svg`,
  `mark.svg`, `mono-mark.svg`, `favicon.svg`, `wordmark.svg`,
  `wordmark-light.svg`. Variants append a qualifier:
  `primary-logo-light.svg`, `mark-mono.svg`.
- **Page imagery (future `assets/images/`):** describe subject, not page.
  `practice-room.webp`, not `homepage-hero.webp`.
- **OG / social (future `assets/social/`):** `og-image.png`,
  `og-image-manifesto.png`, `twitter-card.png`. Use 1200×630 for OG, 1200×600
  for Twitter, PNG (or WebP with PNG fallback).
- **App-specific assets:** keep under the app folder (e.g.
  `tuner/assets/images/`, `tuner/assets/audio/`). Brand assets used by an
  app should mirror from `assets/brand/`, never be redrawn locally.
- **Source design notes (future `assets/_source/` or `docs/brand/`):**
  Figma exports, working files, color tokens, motion specs. Prefix internal
  files with `_` so they sort to the top and signal "not for production
  serving."

---

## Why duplication exists

Two deployments (Python landing-page server, Tuner Express server) each
serve their own filesystem. We accept the duplication so that either can be
deployed standalone. This README + `docs/brand/asset-map.md` are the
contract that keeps the mirrors honest. A future refactor could collapse
the duplication by serving brand assets from a single CDN path or by making
one deployment proxy to the other; until then, sync explicitly.
