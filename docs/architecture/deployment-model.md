# Deployment Model

Status: v0.1. Snapshot at the time of writing; verify against Railway and `handoffs/next-thread-handoff.md` for current truth.

## Hosting and edge

CommonUnity is hosted on **Railway** (project: `balanced-illumination`, environment: `production`). The workspace is on the Railway Pro plan; the upgrade unblocked outbound SMTP.

The stack across the three providers is:

| Provider | Role |
| --- | --- |
| **GoDaddy** | Domain **registrar** for `commonunity.io` and holder of the email (MX/SPF/DKIM/DMARC) records. DNS is handled here via forwarding to the edge (see DNS below). |
| **Cloudflare** | **Active** at the edge (DNS / proxy layer) in front of the Railway services. |
| **Railway** | Application **hosting** — the running services and their custom-domain bindings. |

The provider stack (Railway + Cloudflare + GitHub) matches the 2026-05-16 decision-log entry. The GoDaddy-CNAME-directly-to-Railway arrangement described in earlier snapshots is superseded: Cloudflare now sits at the edge, with GoDaddy retained as registrar and DNS forwarder.

## Services

| Service | Role | Service ID | Deploys from |
| --- | --- | --- | --- |
| Main CommonUnity | Studio + root | `2a5f091f-fbc8-44e2-89a2-a48780531e22` | `main` |
| cOMmons | Field surface | `20df4da0-9e34-412c-8427-ee048309a185` | `field-phase-1` |

## Live URLs

- Main Studio/root: `https://commonunity-production.up.railway.app`
- Studio route: `https://commonunity-production.up.railway.app/studio`
- cOMmons: `https://commons-production-8914.up.railway.app/field`

## Future canonical domains

- `https://www.commonunity.io` — main CommonUnity service
- `https://commons.commonunity.io` — cOMmons
- `https://commonunity.io` — forwards to `https://www.commonunity.io`

## DNS

The domain `commonunity.io` is registered at **GoDaddy**; the DNS/edge layer is **Cloudflare**, which fronts the Railway services. Custom domains are bound in Railway for:

- `commonunity.io` → main service
- `www.commonunity.io` → main service
- `commons.commonunity.io` → cOMmons

The earlier arrangement pointed GoDaddy CNAMEs directly at Railway hostnames:

```text
www      → 231xfgkz.up.railway.app
commons  → 2c4ikjdp.up.railway.app
```

This is now historical. With Cloudflare active at the edge, the exact live records (which hostnames are proxied through Cloudflare vs. forwarded from GoDaddy, and their targets) should be **verified in the Cloudflare and GoDaddy dashboards** before being relied upon — they are not reproduced here to avoid recording stale values. The apex `@` could not be set as a CNAME in GoDaddy; the accepted approach remains: use `www.commonunity.io` as canonical and forward the apex.

**Do not touch** MX, SPF, DKIM, DMARC, or other email records — these support GoDaddy email and must remain intact.

## SMTP (cOMmons magic-link auth)

Confirmed working after the Railway Pro upgrade.

| Variable | Value |
| --- | --- |
| `SMTP_HOST` | `smtpout.secureserver.net` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `om@commonunity.io` |
| `SMTP_FROM` | `om@commonunity.io` |

Magic-link delivery confirmed via Railway logs (`mail delivered`).

## CORS

cOMmons accepts:

- `https://commonunity.io`
- `https://www.commonunity.io`
- `https://commons.commonunity.io`

## Runtime notes

- `Procfile`, `nixpacks.toml`, `railway.json`, `runtime.txt`, and `requirements.txt` define the runtime contract at repo root.
- cOMmons currently uses SQLite as its data store.
- Three beta cOMmons profiles seeded: Markus, Eda, Vesna.

## Operational rules

- Do not expose secrets or tokens in commits or docs.
- Keep GoDaddy email for the remainder of the prepaid period.
- Keep Railway as beta hosting for now.
- Treat the architecture brief and the next-thread handoff as primary sources of truth; reconcile this doc with them on every milestone.
