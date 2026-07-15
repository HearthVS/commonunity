# Decks

Self-contained static pitch/presentation decks, each served as its own site.

## Layout

```
decks/
  <stable-slug>/
    index.html      # deck entry point (references assets relatively)
    styles.css
    deck.js
    assets/         # logos, favicon, images
```

## Serving

`server.py` mounts this folder at `/decks` with `StaticFiles(html=True)`, so a
deck at `decks/<slug>/index.html` is reachable at:

```
https://commonunity.app/decks/<slug>/
```

The trailing slash matters: it makes the deck's relative asset paths
(`assets/...`, `styles.css`, `deck.js`) resolve against the deck folder. A
request without the trailing slash is redirected to add one.

## Adding a deck

1. Create `decks/<stable-slug>/` and drop the deck's static files in.
2. Keep all internal references relative (no leading `/`).
3. No server change is needed — the `/decks` mount serves every subfolder.

## Current decks

- [`minimum-viable-digital-self`](minimum-viable-digital-self/) — CommonUnity pitch deck (26 slides). Canonical baseline; unchanged.
- [`minimum-viable-digital-self-session-2026-07-16`](minimum-viable-digital-self-session-2026-07-16/) — 17-slide session cut of the canonical deck for the 16 July 2026 Unplugged Forum seminar. Derived from the baseline above, which remains unchanged.
