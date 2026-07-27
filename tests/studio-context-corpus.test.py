#!/usr/bin/env python3
"""Canonical Gene Key corpus — completeness, schema, integrity, path safety.

In grounded mode the corpus at data/hexagrams/gk_01..64.json is the only
accepted origin for authoritative Gene Key material. These tests defend the
properties the rest of the trust layer assumes:

  * all 64 entries exist, parse, and declare the number their filename claims
  * every entry carries non-empty shadow / gift / siddhi subtitle + content
  * checksums and the corpus version are stable and content-derived
  * a Gene Key reference is a validated integer, so no caller string ever
    reaches the filesystem (traversal, absolute paths, symlink escape)
  * a missing or malformed entry raises CanonicalSourceError rather than
    yielding partial material

Run: python3 tests/studio-context-corpus.test.py
"""
import json
import os
import pathlib
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from studio_context import canonical  # noqa: E402

passed = 0


def ok(cond, label):
    global passed
    if not cond:
        raise AssertionError("FAILED: " + label)
    print("  ok  " + label)
    passed += 1


def raises(exc, fn, label):
    try:
        fn()
    except exc:
        ok(True, label)
        return
    except Exception as other:  # pragma: no cover - diagnostic path
        raise AssertionError(f"FAILED: {label} (raised {type(other).__name__}: {other})")
    raise AssertionError(f"FAILED: {label} (no exception)")


print("\n── corpus completeness ──")
report = canonical.verify_corpus()
ok(report["ok"], f"corpus verifies clean ({report['problems'][:1]})")
ok(report["expected"] == 64, "corpus expects 64 entries")
ok(report["present"] == 64, "all 64 entries present and valid")
ok(report["source_version"].startswith("gkc1-"), "verify reports a corpus version")

for number in range(1, 65):
    entry = canonical.load_gene_key(number)
    assert entry["gene_key"] == number, f"gk {number} number mismatch"
    assert entry["title"].strip(), f"gk {number} empty title"
    for band in ("shadow", "gift", "siddhi"):
        assert entry["bands"][band]["subtitle"].strip(), f"gk {number} {band} subtitle"
        assert entry["bands"][band]["content"].strip(), f"gk {number} {band} content"
    assert len(entry["checksum"]) == 64, f"gk {number} checksum length"
    assert entry["source_id"].startswith(f"gk:{number:02d}@"), f"gk {number} source id"
ok(True, "all 64 entries carry title, three non-empty bands, checksum, source id")

print("\n── source integrity ──")
version = canonical.corpus_version()
ok(version == canonical.corpus_version(), "corpus version is stable across calls")
ok(version.startswith("gkc1-") and len(version) == 21, f"corpus version is namespaced: {version}")

canonical.reset_cache()
ok(canonical.corpus_version() == version, "corpus version survives a cache reset")

gk25 = canonical.load_gene_key(25)
ok(canonical.load_gene_key("25")["source_id"] == gk25["source_id"],
   "string and int keys resolve to the same entry")
ok(gk25["source_id"].endswith(gk25["checksum"][:12]),
   "source id embeds the file checksum")
ok(len({canonical.load_gene_key(n)["checksum"] for n in range(1, 65)}) == 64,
   "every entry has a distinct checksum")

print("\n── key and line validation ──")
ok(canonical.validate_gene_key(1) == 1, "gene key 1 accepted")
ok(canonical.validate_gene_key(64) == 64, "gene key 64 accepted")
ok(canonical.validate_gene_key(" 7 ") == 7, "whitespace-padded key accepted")
for bad in (0, 65, -1, 1000, "abc", "", None, 1.5, True, [25]):
    raises(canonical.CanonicalSourceError,
           lambda b=bad: canonical.validate_gene_key(b),
           f"gene key rejected: {bad!r}")
ok(canonical.validate_line(6) == 6, "line 6 accepted")
for bad in (0, 7, -1, "x", None):
    raises(canonical.CanonicalSourceError,
           lambda b=bad: canonical.validate_line(b),
           f"line rejected: {bad!r}")

print("\n── path safety ──")
base = canonical.corpus_root()
ok(canonical.source_path(3).parent == base, "resolved path stays inside the corpus root")
ok(canonical.source_path(3).name == "gk_03.json", "filename is derived from the padded integer")
for hostile in ("../../etc/passwd", "/etc/passwd", "01/../../secret", "gk_01.json",
                "..", "%2e%2e%2fetc", "1; rm -rf /"):
    raises(canonical.CanonicalSourceError,
           lambda h=hostile: canonical.source_path(h),
           f"path traversal rejected: {hostile!r}")

# A symlinked entry pointing outside the corpus must not be readable, even
# though its name looks legitimate.
_sym_dir = tempfile.mkdtemp(prefix="sc_corpus_sym_")
try:
    outside = pathlib.Path(_sym_dir) / "outside.json"
    outside.write_text(json.dumps({"number": 1, "title": "x"}), encoding="utf-8")
    corpus = pathlib.Path(_sym_dir) / "corpus"
    corpus.mkdir()
    try:
        (corpus / "gk_01.json").symlink_to(outside)
        raises(canonical.CanonicalSourceError,
               lambda: canonical.source_path(1, corpus),
               "symlink escaping the corpus root is rejected")
    except OSError:
        ok(True, "symlink escape check skipped (symlinks unavailable)")
finally:
    shutil.rmtree(_sym_dir, ignore_errors=True)

print("\n── missing and malformed sources ──")
_tmp_root = tempfile.mkdtemp(prefix="sc_corpus_")
try:
    tmp = pathlib.Path(_tmp_root)
    canonical.reset_cache()
    raises(canonical.CanonicalSourceError,
           lambda: canonical.load_gene_key(1, tmp),
           "missing entry raises rather than returning empty material")

    (tmp / "gk_01.json").write_text("{not json", encoding="utf-8")
    canonical.reset_cache()
    raises(canonical.CanonicalSourceError,
           lambda: canonical.load_gene_key(1, tmp),
           "unparseable entry raises")

    (tmp / "gk_01.json").write_text(json.dumps({"number": 1, "title": "t"}), encoding="utf-8")
    canonical.reset_cache()
    raises(canonical.CanonicalSourceError,
           lambda: canonical.load_gene_key(1, tmp),
           "entry missing the shadow/gift/siddhi bands raises")

    band = {"subtitle": "S", "subtitle_title": "T", "content": "C"}
    (tmp / "gk_01.json").write_text(
        json.dumps({"number": 2, "title": "t", "shadow": band, "gift": band, "siddhi": band}),
        encoding="utf-8",
    )
    canonical.reset_cache()
    raises(canonical.CanonicalSourceError,
           lambda: canonical.load_gene_key(1, tmp),
           "entry whose declared number disagrees with its filename raises")

    empty_band = {"subtitle": "S", "subtitle_title": "T", "content": "   "}
    (tmp / "gk_01.json").write_text(
        json.dumps({"number": 1, "title": "t", "shadow": band, "gift": band, "siddhi": empty_band}),
        encoding="utf-8",
    )
    canonical.reset_cache()
    raises(canonical.CanonicalSourceError,
           lambda: canonical.load_gene_key(1, tmp),
           "entry with an empty band content raises")

    canonical.reset_cache()
    partial = canonical.verify_corpus(tmp)
    ok(not partial["ok"], "verify_corpus reports an unhealthy corpus rather than raising")
    ok(partial["present"] == 0, "verify_corpus counts zero valid entries")
    ok(partial["source_version"] == "", "no corpus version is published for an unhealthy corpus")
    ok(len(partial["problems"]) > 0, "verify_corpus explains why the corpus is unhealthy")
finally:
    shutil.rmtree(_tmp_root, ignore_errors=True)
    canonical.reset_cache()

# The real corpus is still fine after all that cache churn.
ok(canonical.verify_corpus()["ok"], "real corpus still verifies after cache resets")
ok(canonical.corpus_version() == version, "real corpus version unchanged")


def test_studio_context_corpus():
    """pytest entry point — the module body is the suite."""
    assert passed > 0


print(f"\n{passed} passed")
