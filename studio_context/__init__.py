"""stUdio context foundation — reversible server-side grounding.

Phase 1 establishes the architecture and its trust boundaries without changing
what production does. Two modes exist:

  legacy      — the behaviour that shipped before this package. Production
                default. No code path in this package runs for it.
  grounded_v1 — versioned server-side assembly from authenticated member-owned
                records plus the canonical Gene Key corpus.

See docs/architecture/studio-context-modes.md for the data model, trust
boundaries, activation and rollback procedure.

Layout:
  runtime.py     host bindings (db, settings, auth) — no import of server.py
  canonical.py   authoritative Gene Key corpus: validation, checksums, versions
  provenance.py  provenance classes, acceptance states, transition rules
  modes.py       mode resolution, activation, rollback, failure policy
  store.py       personal orientation records: schema, ownership, idempotency
  trace.py       privacy-safe assembly trace and redaction
  assembler.py   the authenticated assembler and Phase 2 extension seams
  relevance.py   what The Work should retrieve, and why
  prompts.py     shared sovereignty foundation + the Work action contract
  work.py        the one room wired to grounded_v1
  api.py         FastAPI router (admin mode control + member primitives)
"""

from . import (
    assembler,
    canonical,
    modes,
    prompts,
    provenance,
    relevance,
    runtime,
    store,
    trace,
    work,
)
from .runtime import configure, is_configured

__all__ = [
    "assembler",
    "canonical",
    "configure",
    "is_configured",
    "modes",
    "prompts",
    "provenance",
    "relevance",
    "runtime",
    "store",
    "trace",
    "work",
]
