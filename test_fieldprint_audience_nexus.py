"""FieldPrint audience + evidence contract and Nexus FieldPrint Prompt v1.

Guards the server side of the audience/evidence pass:
  • the /inspire-layer2 request accepts the agreed audience + evidence contracts;
  • the versioned prompt names FieldPrint / hOMepage / the digital self and the
    non-negotiable "do not invent" safeguard;
  • the audience block folds one Spark answer across several facets (no
    fabricated distinctions) and the evidence block surfaces only voluntarily
    provided profile material — never sealed raw OM Cipher inputs;
  • the admin prompt surface is read-only and admin-gated;
  • a live /inspire-layer2 request carries the audience + evidence context into
    the model message while never sending the frozen cOMpass baseline.

No real API calls — the Anthropic streaming client is monkeypatched.
Run:  python3 -m unittest test_fieldprint_audience_nexus -v
"""
import ast
import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DB = os.path.join(tempfile.gettempdir(), "commonunity_audience_test.sqlite3")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]
SERVER_SRC = Path(server.__file__).read_text(encoding="utf-8")


def _auth_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _request_model_fields():
    tree = ast.parse(SERVER_SRC)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "InspireLayer2Request":
            return {n.target.id for n in node.body if isinstance(n, ast.AnnAssign)
                    and isinstance(n.target, ast.Name)}
    return set()


class RequestContractTests(unittest.TestCase):
    def test_request_accepts_audience_and_evidence(self):
        fields = _request_model_fields()
        self.assertIn("audience", fields)
        self.assertIn("evidence", fields)

    def test_prompt_is_versioned(self):
        self.assertEqual(server.NEXUS_FIELDPRINT_PROMPT_VERSION, "nexus-fieldprint-prompt-v1")
        self.assertIn(server.NEXUS_FIELDPRINT_PROMPT_VERSION, server.INSPIRE_L2_SYSTEM)

    def test_prompt_names_fieldprint_and_safeguards(self):
        p = server.INSPIRE_L2_SYSTEM.lower()
        self.assertIn("fieldprint", p)
        self.assertIn("homepage", p)
        self.assertIn("minimum viable digital self", p)
        self.assertIn("do not invent", p)
        # audience guidance without brand manufacture
        self.assertIn("brand", p)
        self.assertIn("authenticity", p)


class AudienceBlockTests(unittest.TestCase):
    def test_empty_audience_is_blank(self):
        self.assertEqual(server._inspire_audience_block({}), "")
        self.assertEqual(server._inspire_audience_block(None), "")
        self.assertEqual(server._inspire_audience_block({"people_to_reach": ""}), "")

    def test_folds_consecutive_identical_values(self):
        # One Spark answer maps to three visitor facets; they must fold into a
        # single line rather than repeat the sentence three times.
        block = server._inspire_audience_block({
            "people_to_reach": "New parents nearby.",
            "connection_welcomed": "New parents nearby.",
            "visitor_should_understand": "This is a calm, real practice.",
            "visitor_should_feel": "This is a calm, real practice.",
            "visitor_should_do": "This is a calm, real practice.",
        })
        self.assertEqual(block.count("New parents nearby."), 1)
        self.assertEqual(block.count("This is a calm, real practice."), 1)
        self.assertIn("owner-stated", block)
        self.assertIn("do not invent", block.lower())

    def test_distinct_values_are_separate_lines(self):
        block = server._inspire_audience_block({
            "people_to_reach": "A",
            "connection_welcomed": "B",
        })
        self.assertIn("A", block)
        self.assertIn("B", block)


class EvidenceBlockTests(unittest.TestCase):
    def test_empty_evidence_is_blank(self):
        self.assertEqual(server._inspire_evidence_block({}), "")
        self.assertEqual(server._inspire_evidence_block(None), "")

    def test_surfaces_work_and_education(self):
        block = server._inspire_evidence_block({
            "work_background": "Led programmes.",
            "education": "BA, Leeds.",
        })
        self.assertIn("Led programmes.", block)
        self.assertIn("BA, Leeds.", block)
        self.assertIn("voluntarily", block.lower())

    def test_documents_list_included_but_bounded(self):
        docs = [{"label": f"Doc{i}", "text": f"body{i}"} for i in range(10)]
        block = server._inspire_evidence_block({"documents": docs})
        # Only the first five documents are surfaced.
        self.assertIn("Doc0", block)
        self.assertIn("Doc4", block)
        self.assertNotIn("Doc5", block)

    def test_truncates_long_work_background(self):
        block = server._inspire_evidence_block({"work_background": "x" * 5000})
        # 1500-char cap plus the label prefix.
        self.assertLess(len(block), 1700)


class AdminPromptSurfaceTests(unittest.TestCase):
    def test_requires_admin(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/nexus-prompt").status_code, 401)

    def test_read_only_state_shape(self):
        c = _auth_client()
        d = c.get("/api/admin/nexus-prompt").json()
        self.assertEqual(d["version"], "nexus-fieldprint-prompt-v1")
        self.assertFalse(d["editable"], "prompt surface must be read-only")
        self.assertIn("editing_deferred", d)
        self.assertIn("system_prompt", d)
        self.assertEqual(
            d["audience_contract"],
            ["people_to_reach", "connection_welcomed",
             "visitor_should_understand", "visitor_should_feel", "visitor_should_do"],
        )

    def test_no_secret_leakage(self):
        c = _auth_client()
        raw = c.get("/api/admin/nexus-prompt").text
        self.assertNotIn("sk-test-key-should-not-leak", raw)
        self.assertNotIn(ADMIN_CODE, raw)


class _FakeStream:
    def __init__(self):
        self.text_stream = ["A ", "line."]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class InspireLayer2PayloadTests(unittest.TestCase):
    """A live request must carry audience + evidence into the model message and
    never send the frozen cOMpass baseline (it is not part of the contract)."""

    def setUp(self):
        self.captured = {}
        self._orig_stream = server.client.messages.stream

        def _fake_stream(**kwargs):
            self.captured.clear()
            self.captured.update(kwargs)
            return _FakeStream()

        server.client.messages.stream = _fake_stream
        self.c = TestClient(server.app)

    def tearDown(self):
        server.client.messages.stream = self._orig_stream

    def _run(self, body):
        with self.c.stream("POST", "/inspire-layer2", json=body) as r:
            self.assertEqual(r.status_code, 200)
            for _ in r.iter_lines():
                pass
        return self.captured["messages"][0]["content"]

    def test_audience_and_evidence_reach_the_model(self):
        msg = self._run({
            "point": "work", "field": "summary",
            "audience": {
                "people_to_reach": "Early-career designers.",
                "connection_welcomed": "Early-career designers.",
                "visitor_should_understand": "I mentor with honesty.",
                "visitor_should_feel": "I mentor with honesty.",
                "visitor_should_do": "I mentor with honesty.",
            },
            "evidence": {
                "work_background": "Twelve years in product design.",
                "education": "BDes, RCA.",
            },
        })
        self.assertIn("Early-career designers.", msg)
        self.assertIn("I mentor with honesty.", msg)
        self.assertIn("Twelve years in product design.", msg)
        self.assertIn("BDes, RCA.", msg)
        self.assertIn("The Work", msg)  # room contract echoed

    def test_no_baseline_field_accepted(self):
        # The endpoint has no baseline parameter; anything extra is ignored by
        # pydantic and can never reach the model message.
        msg = self._run({
            "point": "lens", "field": "theme",
            "compassBaseline": {"points": {"lens": {"raw": "SEALED BASELINE"}}},
            "evidence": {"work_background": "public background"},
        })
        self.assertNotIn("SEALED BASELINE", msg)
        self.assertIn("public background", msg)

    def test_works_with_no_audience_or_evidence(self):
        msg = self._run({"point": "call", "field": "heading"})
        self.assertIn("The Call", msg)


if __name__ == "__main__":
    unittest.main()
