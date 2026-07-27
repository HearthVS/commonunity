"""Canonical Gene Key source service.

Authoritative Gene Key / Line material is read server-side from the tracked
corpus at `data/hexagrams/gk_01..64.json`. In grounded mode this is the *only*
accepted origin for canonical material: client-submitted transcript text is
never promoted to canonical, no matter what the browser claims.

Every load is validated (key range, schema, non-empty bands) and fingerprinted
(per-file sha256 + a corpus-wide version) so an assembled context can name the
exact source revision it used. A corpus that fails validation raises
`CanonicalSourceError` rather than degrading to partial material.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import threading
from typing import Any

CORPUS_DIRNAME = pathlib.Path("data") / "hexagrams"

MIN_GENE_KEY = 1
MAX_GENE_KEY = 64
MIN_LINE = 1
MAX_LINE = 6

# Bands present in every Gene Key entry. Extra top-level keys (a few entries
# carry an `intro`) are tolerated; these are the ones grounding depends on.
REQUIRED_BANDS = ("shadow", "gift", "siddhi")
REQUIRED_BAND_FIELDS = ("subtitle", "content")
REQUIRED_TOP_LEVEL = ("number", "title") + REQUIRED_BANDS

_CACHE_LOCK = threading.Lock()
_cache: dict[str, Any] = {"root": None, "entries": {}, "version": None}


class CanonicalSourceError(Exception):
    """Raised when canonical material is missing, malformed, or out of range."""


def corpus_root(root: pathlib.Path | str | None = None) -> pathlib.Path:
    """Absolute path to the corpus directory."""
    if root is not None:
        return pathlib.Path(root).resolve()
    return (pathlib.Path(__file__).resolve().parent.parent / CORPUS_DIRNAME).resolve()


def validate_gene_key(number: Any) -> int:
    """Coerce and range-check a Gene Key number. Rejects anything that is not a
    plain integer 1..64 — this is also the path-safety gate, because the file
    path is built from the validated integer and never from caller text."""
    if isinstance(number, bool) or not isinstance(number, (int, str)):
        raise CanonicalSourceError(f"invalid gene key: {number!r}")
    try:
        value = int(str(number).strip())
    except (TypeError, ValueError):
        raise CanonicalSourceError(f"invalid gene key: {number!r}") from None
    if not MIN_GENE_KEY <= value <= MAX_GENE_KEY:
        raise CanonicalSourceError(
            f"gene key out of range: {value} (expected {MIN_GENE_KEY}..{MAX_GENE_KEY})"
        )
    return value


def validate_line(line: Any) -> int:
    """Coerce and range-check a Gene Key line (1..6)."""
    if isinstance(line, bool) or not isinstance(line, (int, str)):
        raise CanonicalSourceError(f"invalid line: {line!r}")
    try:
        value = int(str(line).strip())
    except (TypeError, ValueError):
        raise CanonicalSourceError(f"invalid line: {line!r}") from None
    if not MIN_LINE <= value <= MAX_LINE:
        raise CanonicalSourceError(
            f"line out of range: {value} (expected {MIN_LINE}..{MAX_LINE})"
        )
    return value


def source_path(number: Any, root: pathlib.Path | str | None = None) -> pathlib.Path:
    """Resolved path for a Gene Key file.

    The filename is derived from the validated integer, so traversal sequences
    can never reach the filesystem. The resolved path is additionally asserted
    to sit directly inside the corpus directory, which also catches a symlinked
    entry pointing outside the tracked corpus.
    """
    value = validate_gene_key(number)
    base = corpus_root(root)
    path = (base / f"gk_{value:02d}.json").resolve()
    if path.parent != base:
        raise CanonicalSourceError(f"canonical source escapes corpus root: gk {value}")
    return path


def _validate_document(number: int, doc: Any, path: pathlib.Path) -> dict:
    if not isinstance(doc, dict):
        raise CanonicalSourceError(f"malformed canonical source (not an object): {path.name}")
    missing = [key for key in REQUIRED_TOP_LEVEL if key not in doc]
    if missing:
        raise CanonicalSourceError(
            f"malformed canonical source {path.name}: missing {', '.join(missing)}"
        )
    if doc.get("number") != number:
        raise CanonicalSourceError(
            f"canonical source {path.name} declares number {doc.get('number')!r}, expected {number}"
        )
    if not str(doc.get("title", "")).strip():
        raise CanonicalSourceError(f"canonical source {path.name}: empty title")
    for band in REQUIRED_BANDS:
        body = doc.get(band)
        if not isinstance(body, dict):
            raise CanonicalSourceError(f"canonical source {path.name}: band '{band}' is not an object")
        for field in REQUIRED_BAND_FIELDS:
            if not str(body.get(field, "")).strip():
                raise CanonicalSourceError(
                    f"canonical source {path.name}: band '{band}' missing '{field}'"
                )
    return doc


def load_gene_key(number: Any, root: pathlib.Path | str | None = None) -> dict:
    """Load, validate and fingerprint one canonical Gene Key entry.

    Returns a dict carrying the source material plus `source_id`, `checksum`
    and `source_version` so downstream traces can cite an exact revision.
    """
    value = validate_gene_key(number)
    base = corpus_root(root)
    with _CACHE_LOCK:
        if _cache["root"] == base and value in _cache["entries"]:
            return _cache["entries"][value]

    path = source_path(value, base)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        raise CanonicalSourceError(f"canonical source missing: {path.name}") from None
    except OSError as exc:
        raise CanonicalSourceError(f"canonical source unreadable: {path.name} ({exc})") from None

    try:
        doc = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CanonicalSourceError(f"malformed canonical source {path.name}: {exc}") from None

    doc = _validate_document(value, doc, path)
    checksum = hashlib.sha256(raw).hexdigest()
    entry = {
        "gene_key": value,
        "title": str(doc["title"]).strip(),
        "programming_partner": str(doc.get("programming_partner", "")).strip(),
        "codon_ring": str(doc.get("codon_ring", "")).strip(),
        "physiology": str(doc.get("physiology", "")).strip(),
        "amino_acid": str(doc.get("amino_acid", "")).strip(),
        "bands": {
            band: {
                "subtitle": str(doc[band].get("subtitle", "")).strip(),
                "subtitle_title": str(doc[band].get("subtitle_title", "")).strip(),
                "content": str(doc[band].get("content", "")),
            }
            for band in REQUIRED_BANDS
        },
        "checksum": checksum,
        "source_id": f"gk:{value:02d}@{checksum[:12]}",
    }

    with _CACHE_LOCK:
        if _cache["root"] != base:
            _cache["root"] = base
            _cache["entries"] = {}
            _cache["version"] = None
        _cache["entries"][value] = entry
    return entry


def corpus_version(root: pathlib.Path | str | None = None) -> str:
    """Stable fingerprint of the whole corpus.

    Derived from the ordered per-file checksums, so any edit to any entry
    changes the version and every trace written afterwards is distinguishable
    from one written against the previous revision.
    """
    base = corpus_root(root)
    with _CACHE_LOCK:
        if _cache["root"] == base and _cache["version"]:
            return _cache["version"]

    digest = hashlib.sha256()
    for value in range(MIN_GENE_KEY, MAX_GENE_KEY + 1):
        digest.update(load_gene_key(value, base)["checksum"].encode("ascii"))
    version = f"gkc1-{digest.hexdigest()[:16]}"

    with _CACHE_LOCK:
        if _cache["root"] == base:
            _cache["version"] = version
    return version


def verify_corpus(root: pathlib.Path | str | None = None) -> dict:
    """Operational readiness check for the whole corpus.

    Never raises: returns a structured report so an admin surface or a health
    probe can show *why* grounded mode would be unavailable.
    """
    base = corpus_root(root)
    problems: list[str] = []
    present = 0
    for value in range(MIN_GENE_KEY, MAX_GENE_KEY + 1):
        try:
            load_gene_key(value, base)
            present += 1
        except CanonicalSourceError as exc:
            problems.append(str(exc))
    report = {
        "root": str(base),
        "expected": MAX_GENE_KEY - MIN_GENE_KEY + 1,
        "present": present,
        "ok": not problems,
        "problems": problems[:16],
    }
    report["source_version"] = corpus_version(base) if report["ok"] else ""
    return report


def reset_cache() -> None:
    """Drop the in-memory corpus cache (tests and corpus hot-swaps)."""
    with _CACHE_LOCK:
        _cache["root"] = None
        _cache["entries"] = {}
        _cache["version"] = None
