"""M1-A: derivação nominal, sem cadastro nem geração produtiva."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from jsonschema import Draft202012Validator
from pipeline import normalizar_planta as n
from pipeline import validar_leitura

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests/fixtures/leitura/v1"


def leitura(nome="apartamento-simples"):
    return json.loads((FIXTURES / (nome + ".json")).read_text(encoding="utf-8"))


class NormalizadorTest(unittest.TestCase):
    def test_schema_e_casos_validos(self):
        Draft202012Validator.check_schema(n.SCHEMA)
        for nome in ("comodo-unico", "dois-adjacentes", "abertura-valida", "apartamento-simples", "exemplo-geometrico"):
            with self.subTest(nome=nome):
                resultado = n.normalizar(leitura(nome))
                Draft202012Validator(n.SCHEMA).validate(resultado)

    def test_primeira_etapa_e_validador_sem_reparo(self):
        doc = leitura("sobreposicao")
        anterior = copy.deepcopy(doc)
        with patch.object(validar_leitura, "validar", wraps=validar_leitura.validar) as gate:
            with self.assertRaises(n.LeituraInvalida) as caught:
                n.normalizar(doc)
            gate.assert_called_once_with(doc)
        self.assertEqual(caught.exception.errors, validar_leitura.validar(doc))
        self.assertEqual(doc, anterior)

    def test_todas_fixtures_invalidas_bloqueiam(self):
        for nome in ("sobreposicao", "dimensao-invalida", "desconectado",
                     "geometria-nao-suportada", "abertura-invalida", "relacao-inconsistente"):
            with self.subTest(nome=nome), self.assertRaises(n.LeituraInvalida):
                n.normalizar(leitura(nome))

    def test_determinismo_e_independencia_de_chaves(self):
        doc = leitura()
        outro = json.loads(json.dumps(doc, sort_keys=True))
        self.assertEqual(n.serializar(n.normalizar(doc)), n.serializar(n.normalizar(outro)))
        self.assertEqual(n.serializar(n.normalizar(doc)), n.serializar(n.normalizar(doc)))
        outro["rooms"][0]["widthMm"] = 4000.0
        self.assertEqual(n.serializar(n.normalizar(doc)), n.serializar(n.normalizar(outro)))

    def test_entrada_e_saida_nao_compartilham_mutaveis(self):
        doc = leitura()
        anterior = copy.deepcopy(doc)
        out = n.normalizar(doc)
        self.assertEqual(doc, anterior)
        out["references"][0]["description"] = "editado"
        out["planta"]["comodos"][0]["walls"]["east"] = "editado"
        out["provenance"]["declared"]["referenceIds"].append("editado")
        self.assertEqual(doc, anterior)

    def test_mm_m_e_meio_milimetro_sem_snap_ou_meia_parede(self):
        doc = leitura("comodo-unico")
        doc["rooms"][0].update(xMm=-123, yMm=17, widthMm=4001, depthMm=3007)
        doc["openings"] = [{
            "id": "janela", "kind": "window", "wallId": "sala-south",
            "offsetMm": 121, "widthMm": 801, "heightMm": 901, "sillMm": 1003,
            "provenance": {"kind": "declared", "referenceIds": []},
        }]
        out = n.normalizar(doc)["planta"]
        self.assertEqual(out["comodos"][0]["poly"],
                         [[-.123, .017], [3.878, .017], [3.878, 3.024], [-.123, 3.024]])
        self.assertEqual(out["janelas"][0]["p"], [.3985, .017])
        self.assertEqual(out["janelas"][0]["largura"], .801)
        self.assertEqual((out["janelas"][0]["y0"], out["janelas"][0]["y1"]), (1.003, 1.904))

    def test_abertura_interna_unica_e_janela_externa(self):
        out = n.normalizar(leitura())["planta"]
        self.assertEqual(len(out["portas"]), 2)
        porta = next(p for p in out["portas"] if p["id"] == "porta-1")
        self.assertEqual(porta["p"], [4, 1.4])
        self.assertEqual(porta["pairedWallId"], "quarto-west")
        self.assertEqual((porta["y0"], porta["y1"]), (0, 2.1))
        self.assertNotIn("pairedWallId", out["janelas"][0])
        self.assertEqual(out["janelas"][0]["p"], [1.6, 0])

    def test_adjacencia_parcial_offsets_dos_dois_lados(self):
        doc = leitura("abertura-valida")
        doc["rooms"][1].update(yMm=1000, depthMm=2000)
        out = n.normalizar(doc)
        self.assertEqual(out["planta"]["portas"][0]["p"], [4, 1.4])
        doc["openings"][0].update(wallId="quarto-west", pairedWallId="sala-east", offsetMm=0)
        outro = n.normalizar(doc)
        self.assertEqual(out["planta"]["portas"][0]["p"], outro["planta"]["portas"][0]["p"])
        self.assertEqual(out["relations"], outro["relations"])

    def test_uniao_l_nao_vira_bounding_box(self):
        out = n.normalizar(leitura())["planta"]
        self.assertEqual(len(out["comodos"]), 3)
        self.assertEqual(next(c for c in out["comodos"] if c["id"] == "cozinha")["poly"],
                         [[0, 3], [4, 3], [4, 5], [0, 5]])

    def test_source_revision_provenance_e_hash_do_conteudo(self):
        doc = leitura()
        doc["revision"] = 7
        out = n.normalizar(doc)
        self.assertEqual({k: out["source"][k] for k in ("id", "revision", "schemaVersion")},
                         {"id": doc["id"], "revision": 7, "schemaVersion": "1.0.0"})
        self.assertEqual(out["source"]["sha256"],
                         hashlib.sha256(n.serializar(doc)).hexdigest())
        self.assertEqual(out["provenance"], {"kind": "derived", "declared": doc["provenance"]})
        self.assertEqual(out["references"], doc["references"])
        for c in out["planta"]["comodos"]:
            original = next(r for r in doc["rooms"] if r["id"] == c["id"])
            self.assertEqual(c["provenance"]["declared"], original["provenance"])
        anterior = out["source"]["sha256"]
        doc["revision"] = 8
        self.assertNotEqual(anterior, n.normalizar(doc)["source"]["sha256"])

    def test_schema_recusa_cadastro_e_semantica_construtiva(self):
        out = n.normalizar(leitura())
        for campo in ("propertyId", "agencyId", "lote", "predio", "ficha", "profile"):
            errado = copy.deepcopy(out)
            errado[campo] = {}
            self.assertFalse(Draft202012Validator(n.SCHEMA).is_valid(errado), campo)
        out["measurementBasis"] = "finished-clear"
        self.assertFalse(Draft202012Validator(n.SCHEMA).is_valid(out))

    def test_medida_livre_nao_e_reinterpretada(self):
        doc = leitura()
        doc["measurementBasis"] = "finished-clear"
        with self.assertRaises(n.LeituraInvalida):
            n.normalizar(doc)

    def test_cli_invalida_nao_emite_planta(self):
        with tempfile.TemporaryDirectory() as pasta:
            path = Path(pasta) / "leitura.json"
            for texto, codigo in ((json.dumps(leitura("sobreposicao")), "ROOM_OVERLAP"),
                                   ('{"id":"a","id":"b"}', "INVALID_JSON"),
                                   ('{"x":NaN}', "INVALID_JSON")):
                path.write_text(texto, encoding="utf-8")
                anterior = path.read_bytes()
                result = subprocess.run([sys.executable, "-m", "pipeline.normalizar_planta", str(path)],
                                        capture_output=True)
                self.assertEqual(result.returncode, 2)
                out = json.loads(result.stdout)
                self.assertFalse(out["valid"])
                self.assertNotIn("planta", out)
                self.assertIn(codigo, {e["code"] for e in out["errors"]})
                self.assertEqual(path.read_bytes(), anterior)

    def test_cli_sem_mutacao_e_sem_imports_de_producao(self):
        path = FIXTURES / "apartamento-simples.json"
        anterior = path.read_bytes()
        result = subprocess.run([sys.executable, "-m", "pipeline.normalizar_planta", str(path)],
                                capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, n.serializar(n.normalizar(leitura())))
        self.assertEqual(path.read_bytes(), anterior)
        script = (
            "import sys; from pipeline.normalizar_planta import normalizar; "
            "assert not any(m in sys.modules for m in "
            "('bpy','cv2','numpy','pipeline.extrair_planta','pipeline.fonte_leve'))"
        )
        self.assertEqual(subprocess.run([sys.executable, "-c", script]).returncode, 0)


if __name__ == "__main__":
    unittest.main()
