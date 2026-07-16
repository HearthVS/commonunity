"""Regression: /inspire-layer2 must support the FieldPrint editor's text fields.

The FieldPrint developmental editor offers Nexus "Inspire" on Heading,
Introduction and Closing in addition to the original Theme / Summary. This
guards that the endpoint's field-instruction map and system prompt name all of
them, so a suggestion request for those fields gets a purpose-built instruction
rather than the generic fallback.

Run: python3 -m unittest test_inspire_layer2_fields
"""
import ast
import unittest
from pathlib import Path

SERVER = Path(__file__).with_name("server.py").read_text(encoding="utf-8")


def _field_instructions_keys():
    """Statically read the keys of the field_instructions dict literal inside
    the inspire_layer2 handler, without importing the module or calling the AI."""
    tree = ast.parse(SERVER)
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            tgt = node.targets[0]
            if isinstance(tgt, ast.Name) and tgt.id == "field_instructions" \
                    and isinstance(node.value, ast.Dict):
                return {k.value for k in node.value.keys if isinstance(k, ast.Constant)}
    return set()


class InspireLayer2Fields(unittest.TestCase):
    def test_field_instructions_cover_all_editor_fields(self):
        keys = _field_instructions_keys()
        for field in ("theme", "summary", "insight", "heading", "intro", "closing"):
            self.assertIn(field, keys, f"field_instructions missing '{field}'")

    def test_system_prompt_names_the_new_fields(self):
        for token in ("HEADING", "INTRODUCTION", "CLOSING"):
            self.assertIn(token, SERVER, f"INSPIRE_L2_SYSTEM should describe {token}")


if __name__ == "__main__":
    unittest.main()
