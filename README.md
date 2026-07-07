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

## Docs

- [`docs/home-design-grammar.md`](docs/home-design-grammar.md) — hOMe Design Grammar: the source of truth for the public hOMe doorway (Minimum Viable Digital Self), public/internal language rules, and stUdio builder implications.
