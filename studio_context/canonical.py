"""Canonical Gene Key source service.

Authoritative Gene Key / Line material is read server-side from the tracked
corpora at `data/hexagrams/gk_01..64.json` (the Shadow/Gift/Siddhi spectrum)
and `data/lines/<room>_lines.json` (the six Line passages, per room). In
grounded mode these are the *only* accepted origins for canonical material:
client-submitted transcript text is never promoted to canonical, no matter
what the browser claims.

Every load is validated (key range, schema, non-empty bands) and fingerprinted
(per-file sha256 + a corpus-wide version) so an assembled context can name the
exact source revision it used. A corpus that fails validation raises
`CanonicalSourceError` rather than degrading to partial material.

Both corpora are read one entry at a time. A grounded assembly that needs
Gene Key 44 line 3 in The Work reads `gk_44.json` and `work_lines.json` — not
all 64 transcripts, and not the other three rooms' line files.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import threading
from typing import Any

CORPUS_DIRNAME = pathlib.Path("data") / "hexagrams"
LINE_CORPUS_DIRNAME = pathlib.Path("data") / "lines"

MIN_GENE_KEY = 1
MAX_GENE_KEY = 64
MIN_LINE = 1
MAX_LINE = 6

# Rooms that have a canonical Line corpus. A room name is validated against
# this tuple before it reaches a filename, so no caller string is ever
# interpolated into a path.
LINE_ROOMS = ("work", "lens", "field", "call")

REQUIRED_LINE_FIELDS = ("line", "title", "content")

# Bands present in every Gene Key entry. Extra top-level keys (a few entries
# carry an `intro`) are tolerated; these are the ones grounding depends on.
REQUIRED_BANDS = ("shadow", "gift", "siddhi")
REQUIRED_BAND_FIELDS = ("subtitle", "content")
REQUIRED_TOP_LEVEL = ("number", "title") + REQUIRED_BANDS

_CACHE_LOCK = threading.Lock()
_cache: dict[str, Any] = {"root": None, "entries": {}, "version": None}
# Line corpus keeps its own cache so the Gene Key cache's root-invalidation
# behaviour is untouched. Keyed by (root, room) -> parsed file payload.
_line_cache: dict[tuple, Any] = {}


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


# ── Line corpus (per room) ───────────────────────────────────────────────────
# The Line passages live per room rather than per Gene Key: `work_lines.json`
# describes what each of the six lines means for a person's Life's Work. A
# grounded Work assembly therefore reads exactly one file and exactly one of
# its six entries.


def line_corpus_root(root: pathlib.Path | str | None = None) -> pathlib.Path:
    if root is not None:
        return pathlib.Path(root).resolve()
    return (pathlib.Path(__file__).resolve().parent.parent / LINE_CORPUS_DIRNAME).resolve()


def validate_line_room(room: Any) -> str:
    """Coerce and allowlist a room name. This is the path-safety gate for the
    line corpus: only a name from `LINE_ROOMS` can ever become a filename."""
    if not isinstance(room, str):
        raise CanonicalSourceError(f"invalid line room: {room!r}")
    normalized = room.strip().lower()
    if normalized not in LINE_ROOMS:
        raise CanonicalSourceError(
            f"unknown line room: {room!r} (expected one of {', '.join(LINE_ROOMS)})"
        )
    return normalized


def line_source_path(room: Any, root: pathlib.Path | str | None = None) -> pathlib.Path:
    value = validate_line_room(room)
    base = line_corpus_root(root)
    path = (base / f"{value}_lines.json").resolve()
    if path.parent != base:
        raise CanonicalSourceError(f"line corpus escapes root: {value}")
    return path


def _read_line_file(room: str, base: pathlib.Path) -> dict:
    """Parse, validate and fingerprint one room's line file.

    Validation mirrors the Gene Key loader: all six lines present exactly once,
    each with a non-empty title and content, or a structured error.
    """
    cache_key = (str(base), room)
    with _CACHE_LOCK:
        cached = _line_cache.get(cache_key)
    if cached is not None:
        return cached

    path = line_source_path(room, base)
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        raise CanonicalSourceError(f"line corpus missing: {path.name}") from None
    except OSError as exc:
        raise CanonicalSourceError(f"line corpus unreadable: {path.name} ({exc})") from None

    try:
        doc = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CanonicalSourceError(f"malformed line corpus {path.name}: {exc}") from None
    if not isinstance(doc, list):
        raise CanonicalSourceError(f"malformed line corpus (not a list): {path.name}")

    file_checksum = hashlib.sha256(raw).hexdigest()
    entries: dict[int, dict] = {}
    for item in doc:
        if not isinstance(item, dict):
            raise CanonicalSourceError(f"malformed line corpus {path.name}: entry is not an object")
        missing = [field for field in REQUIRED_LINE_FIELDS if not str(item.get(field, "")).strip()]
        if missing:
            raise CanonicalSourceError(
                f"malformed line corpus {path.name}: entry missing {', '.join(missing)}"
            )
        number = validate_line(item["line"])
        if number in entries:
            raise CanonicalSourceError(f"line corpus {path.name}: duplicate line {number}")
        payload = {
            "room": room,
            "room_label": str(item.get("point_label", "")).strip(),
            "line": number,
            "title": str(item["title"]).strip(),
            "keynote": str(item.get("keynote", "")).strip(),
            "content": str(item["content"]),
        }
        checksum = hashlib.sha256(
            json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()
        payload["checksum"] = checksum
        payload["source_id"] = f"line:{room}:{number}@{checksum[:12]}"
        entries[number] = payload

    expected = set(range(MIN_LINE, MAX_LINE + 1))
    if set(entries) != expected:
        raise CanonicalSourceError(
            f"line corpus {path.name}: expected lines {MIN_LINE}..{MAX_LINE}, "
            f"found {sorted(entries) or 'none'}"
        )

    parsed = {
        "room": room,
        "entries": entries,
        "checksum": file_checksum,
        "source_version": f"gklc1-{file_checksum[:16]}",
    }
    with _CACHE_LOCK:
        _line_cache[cache_key] = parsed
    return parsed


def load_room_line(room: Any, line: Any, root: pathlib.Path | str | None = None) -> dict:
    """Load, validate and fingerprint one Line passage for one room."""
    value = validate_line_room(room)
    number = validate_line(line)
    parsed = _read_line_file(value, line_corpus_root(root))
    entry = dict(parsed["entries"][number])
    entry["source_version"] = parsed["source_version"]
    return entry


def line_corpus_version(room: Any, root: pathlib.Path | str | None = None) -> str:
    return _read_line_file(validate_line_room(room), line_corpus_root(root))["source_version"]


def verify_line_corpus(room: Any, root: pathlib.Path | str | None = None) -> dict:
    """Readiness report for one room's line corpus. Never raises."""
    try:
        value = validate_line_room(room)
    except CanonicalSourceError as exc:
        return {"room": str(room), "ok": False, "present": 0, "expected": MAX_LINE,
                "problems": [str(exc)], "source_version": ""}
    base = line_corpus_root(root)
    try:
        parsed = _read_line_file(value, base)
    except CanonicalSourceError as exc:
        return {"room": value, "ok": False, "present": 0, "expected": MAX_LINE,
                "problems": [str(exc)], "source_version": ""}
    return {
        "room": value,
        "ok": True,
        "present": len(parsed["entries"]),
        "expected": MAX_LINE,
        "problems": [],
        "source_version": parsed["source_version"],
    }


def reset_cache() -> None:
    """Drop the in-memory corpus caches (tests and corpus hot-swaps)."""
    with _CACHE_LOCK:
        _cache["root"] = None
        _cache["entries"] = {}
        _cache["version"] = None
        _line_cache.clear()
