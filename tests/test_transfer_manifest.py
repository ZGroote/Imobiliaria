import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from pipeline.transfer_manifest import build


class TransferManifestTest(unittest.TestCase):
    def test_pacote_usa_horarios_e_biblioteca_sem_antecipar_todos_os_downloads(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def put(path, data=b"fixture"):
                file = root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(data)
                return {"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            def save(path, value):
                return put(path, json.dumps(value).encode())
            source = put("interiores/canto/source.gz")
            unit = put("interiores/canto/unidade.json")
            atlas = put("interiores/canto/irradiance.rgbm.gz")
            runtime = put("interiores/shared/runtime.js")
            key = put("interiores/canto/luz-horario/06.rgbm.gz")
            key["probes"] = put("interiores/canto/luz-horario/06-sondas.bin.gz")
            night = put("interiores/canto/luz-horario/noite.rgbm.gz")
            save("interiores/canto/luz-horario/manifest.json", {"keys": [key], "night": night})
            save("interiores/catalogo.json", {"schema": "liv-interior-catalog-v1", "shared": {"runtime": runtime},
                "tipologias": {"canto": {"files": {"unit": unit, "source": source, "atlas": atlas}}}})
            furniture = put("interiores/melhorias/sofa.glb")
            save("interiores/melhorias/catalogo.json", {"assets": [furniture]})
            put("plantas2d/canto.jpg")
            files = {f["path"]: f for f in build(root)["files"]}
            self.assertNotIn(atlas["path"], files)
            self.assertIn(key["path"], files)
            self.assertIn(key["probes"]["path"], files)
            self.assertIn(furniture["path"], files)
            self.assertFalse(files[furniture["path"]]["background"])
            self.assertNotIn("background", files["plantas2d/canto.jpg"])
            (root / furniture["path"]).write_bytes(b"corrompido")
            with self.assertRaisesRegex(ValueError, "diferente de seu catálogo"):
                build(root)


    def test_cena_preparada_substitui_fonte_e_uvs_na_fila(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def put(path, data=b"fixture"):
                file = root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(data)
                return {"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            def save(path, value):
                return put(path, json.dumps(value).encode())
            prepared = put("interiores/canto/scene-runtime.bin.gz")
            unit = put("interiores/canto/unidade.json")
            runtime = put("interiores/shared/runtime.js")
            save("interiores/catalogo.json", {"schema": "liv-interior-catalog-v1", "shared": {"runtime": runtime},
                "tipologias": {"canto": {"files": {"unit": unit, "runtimeScene": prepared,
                    "source": {"path": "interiores/canto/source.json.gz", "bytes": 1, "sha256": "0" * 64},
                    "compact": {"path": "interiores/canto/geometry-compact.json.gz", "bytes": 1, "sha256": "0" * 64}}}}})
            save("interiores/melhorias/catalogo.json", {"assets": []})
            files = {f["path"]: f for f in build(root)["files"]}
            self.assertIn(prepared["path"], files)
            self.assertNotIn("interiores/canto/source.json.gz", files)
            self.assertNotIn("interiores/canto/geometry-compact.json.gz", files)
            (root / prepared["path"]).write_bytes(b"corrompido")
            with self.assertRaisesRegex(ValueError, "diferente de seu catálogo"):
                build(root)


if __name__ == "__main__":
    unittest.main()
