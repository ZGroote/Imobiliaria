"""O schema companion referencia contratos normativos sem depender da rede."""
import json
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from pipeline.validar_leitura import SCHEMAS


class SchemaEditor(unittest.TestCase):
    def test_schema_referencias_e_leituras_10_11(self):
        root = Path(__file__).resolve().parents[1]
        schema = json.loads((root / "schemas/editor-state/1.0.0.schema.json").read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        registry = Registry().with_resources((doc["$id"], Resource.from_contents(doc)) for doc in SCHEMAS.values())
        validator = Draft202012Validator(schema, registry=registry)
        for version, name in (("1.0.0", "capturador-aberturas-mobile.json"), ("1.1.0", "sala-em-l.json")):
            leitura = json.loads((root / "tests/fixtures/leitura/v1" / name).read_text(encoding="utf-8"))
            self.assertEqual(leitura["schemaVersion"], version)
            state = {"schemaVersion": "1.0.0", "activeFloor": 0,
                     "floors": [{"floor": 0, "leitura": leitura, "furniture": []}]}
            validator.validate(state)
            state["floors"][0]["leitura"]["schemaVersion"] = "9.9.9"
            self.assertFalse(validator.is_valid(state))


if __name__ == "__main__":
    unittest.main()
