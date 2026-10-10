# App Map

Status: v0.1. Snapshot of the current deployed surfaces. For live infrastructure detail see [`./deployment-model.md`](./deployment-model.md) and [`../handoffs/next-thread-handoff.md`](../handoffs/next-thread-handoff.md).

## Deployed surfaces

| Surface | Route | Underlying layer | Notes |
| --- | --- | --- | --- |
| Root / Studio entry | `https://commonunity-production.up.railway.app/` | Studio | Future canonical: `https://www.commonunity.io` |
| Studio | `https://commonunity-production.up.railway.app/studio` | Studio | Main member workspace |
| cOMmons / Field | `https://commons-production-8914.up.railway.app/field` | cOMmons | Future canonical: `https://commons.commonunity.io` |

## Conceptual surfaces and where they live

| Conceptual surface | Status | Notes |
| --- | --- | --- |
| Compass intake | Human-facilitated, no dedicated app surface yet | Notes captured outside the app; flows into Cipher/Profile generation |
| Om Cipher | Wired but visually primitive | Canonical engine work pending; current visual still too OM-badge-like |
| Living Profile | Wired in Studio + cOMmons | Renders the sigil via Studio hooks; public projection via cOMmons |
| Studio rooms | Live at `/studio` | Threshold + multiple tool rooms |
| Personal Home Page | Wired (Website Preview path) | Built inside Studio |
| cOMmons Profile | Live | Public projection layer; magic-link auth |
| cOMmons Field directory | Stewards-only by intent | Default member interaction is resonance, not browse |
| `omcipher.com` standalone | Not yet built | Planned lighter web app — see architecture brief |
| iOS app | Not yet built | Future product — see architecture brief |

## Auth and access

- cOMmons uses magic-link auth via SMTP. Confirmed working after the Railway Pro upgrade. See [`./deployment-model.md`](./deployment-model.md).
- Studio does not have a separate auth boundary in the current build; member identity is established by Compass facilitation upstream.

## Repo-to-surface mapping

The repo currently colocates several surfaces:

| Path | What it powers |
| --- | --- |
| `studio.html` | Studio surface |
| `homepage.html` | Personal Home Page surface (Website Preview) |
| `index.html` | Root entry |
| `manifesto.html` | Public manifesto page |
| `server.py` | Server-side glue |
| `field/` | cOMmons-side assets/code (deployed separately via `field-phase-1`) |
| `sdk/` | Shared SDK utilities |
| `tuner/` | OM Tuner — standalone sound healing toolkit (omtuner.com), lightly linked to CommonUnity; Nexus is its AI |
| `ashtanga-*`, `surya-namaskar`, `hatha-*` | Practice modules referenced by Studio |

This colocation is historical; the canonical separation is by **layer** (per [`./system-map.md`](./system-map.md)), not by directory.
