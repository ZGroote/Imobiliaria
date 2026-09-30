"""Contrato M1-0: fixtures sintéticas, sem Blender, UI ou dados de clientes."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from pipeline.validar_leitura import validar, SCHEMA
from jsonschema import Draft202012Validator

FIXTURES = Path(__file__).parent / "fixtures" / "leitura" / "v1"


def fixture(nome="apartamento-simples"):
    return json.loads((FIXTURES / (nome + ".json")).read_text(encoding="utf-8"))


class ContratoLeituraTest(unittest.TestCase):
    def codigos(self, documento):
        return {erro["code"] for erro in validar(documento)}

    def test_schema_valido(self):
        Draft202012Validator.check_schema(SCHEMA)

    def test_fixtures_validas(self):
        for nome in ("comodo-unico", "dois-adjacentes", "abertura-valida", "apartamento-simples"):
            with self.subTest(nome=nome):
                self.assertEqual(validar(fixture(nome)), [])

    def test_fixtures_invalidas(self):
        for nome, codigo in {
            "sobreposicao": "ROOM_OVERLAP",
            "dimensao-invalida": "INVALID_DIMENSION",
            "desconectado": "DISCONNECTED_ROOM",
            "geometria-nao-suportada": "UNSUPPORTED_GEOMETRY",
            "abertura-invalida": "INVALID_OPENING",
            "relacao-inconsistente": "INCONSISTENT_RELATION",
        }.items():
            with self.subTest(nome=nome):
                self.assertIn(codigo, self.codigos(fixture(nome)))

    def test_unidade_versao_e_cadastro_nao_sao_implicitos(self):
        for campo, valor, codigo in (
            ("unit", "m", "INVALID_UNIT"),
            ("schemaVersion", "2.0.0", "UNSUPPORTED_VERSION"),
            ("propertyId", "imovel-1", "INVALID_STRUCTURE"),
        ):
            doc = fixture()
            doc[campo] = valor
            with self.subTest(campo=campo):
                self.assertIn(codigo, self.codigos(doc))

    def test_nao_aceita_booleano_fracao_nan_ou_infinito_como_medida(self):
        for valor in (True, 4.5, float("nan"), float("inf"), -1, 1000001):
            doc = fixture("comodo-unico")
            doc["rooms"][0]["widthMm"] = valor
            with self.subTest(valor=valor):
                self.assertIn("INVALID_DIMENSION", self.codigos(doc))

    def test_medidas_sao_mm_sem_conversao_ou_arredondamento(self):
        for valor in (4, 400, 4000):
            doc = fixture("comodo-unico")
            doc["rooms"][0]["widthMm"] = valor
            anterior = copy.deepcopy(doc)
            self.assertEqual(validar(doc), [])
            self.assertEqual(doc, anterior)

    def test_ids_duplicados_e_referencias_inexistentes(self):
        doc = fixture()
        doc["rooms"][1]["id"] = doc["rooms"][0]["id"]
        self.assertIn("DUPLICATE_ID", self.codigos(doc))
        doc = fixture()
        doc["rooms"][1]["walls"]["west"] = "sala-east"
        self.assertIn("DUPLICATE_ID", self.codigos(doc))
        doc = fixture()
        doc["rooms"][0]["provenance"]["referenceIds"] = ["ausente"]
        self.assertIn("UNKNOWN_REFERENCE", self.codigos(doc))

    def test_cv_e_derivados_nao_sao_declaracoes(self):
        for valor in ("cv", "derived"):
            doc = fixture()
            doc["rooms"][0]["provenance"]["kind"] = valor
            self.assertIn("INVALID_PROVENANCE", self.codigos(doc))

    def test_contato_apenas_no_vertice_nao_conecta(self):
        doc = fixture("dois-adjacentes")
        doc["rooms"][1]["yMm"] = 3000
        self.assertIn("DISCONNECTED_ROOM", self.codigos(doc))

    def test_relacoes_completas_e_sem_duplicacao(self):
        doc = fixture("dois-adjacentes")
        doc["relations"] = []
        self.assertIn("INCONSISTENT_RELATION", self.codigos(doc))
        doc = fixture("dois-adjacentes")
        extra = copy.deepcopy(doc["relations"][0])
        extra.update(id="outra", wallA=extra["wallB"], wallB=extra["wallA"])
        doc["relations"].append(extra)
        self.assertIn("INCONSISTENT_RELATION", self.codigos(doc))

    def test_abertura_compartilhada_exige_par_e_limites_em_ambos_lados(self):
        doc = fixture("abertura-valida")
        del doc["openings"][0]["pairedWallId"]
        self.assertIn("INVALID_OPENING", self.codigos(doc))
        doc = fixture("abertura-valida")
        doc["rooms"][1].update(yMm=1500, depthMm=1500)
        self.assertIn("INVALID_OPENING", self.codigos(doc))

    def test_abertura_externa_nao_pode_inventar_par(self):
        doc = fixture()
        doc["openings"][2]["pairedWallId"] = "quarto-south"
        self.assertIn("INVALID_OPENING", self.codigos(doc))

    def test_aberturas_sobrepostas_inclusive_pelo_outro_lado(self):
        doc = fixture("abertura-valida")
        outra = copy.deepcopy(doc["openings"][0])
        outra.update(id="duplicada", wallId="quarto-west", pairedWallId="sala-east")
        doc["openings"].append(outra)
        self.assertIn("OPENING_OVERLAP", self.codigos(doc))

    def test_altura_peitoril_e_porta(self):
        for campo, valor in (("heightMm", 2800), ("sillMm", 100)):
            doc = fixture("abertura-valida")
            doc["openings"][0][campo] = valor
            self.assertIn("INVALID_OPENING", self.codigos(doc))

    def test_adjacencia_parcial_com_offset_local_em_cada_lado(self):
        doc = fixture("abertura-valida")
        doc["rooms"][1].update(yMm=1000, depthMm=2000)
        self.assertEqual(validar(doc), [])
        abertura = doc["openings"][0]
        abertura.update(wallId="quarto-west", pairedWallId="sala-east", offsetMm=0)
        self.assertEqual(validar(doc), [])

    def test_aberturas_podem_encostar_sem_sobrepor(self):
        doc = fixture("abertura-valida")
        outra = copy.deepcopy(doc["openings"][0])
        outra.update(id="porta-2", offsetMm=1800)
        doc["openings"].append(outra)
        self.assertEqual(validar(doc), [])

    def test_parede_desconhecida_e_relacao_consigo_mesma(self):
        doc = fixture("abertura-valida")
        doc["openings"][0]["wallId"] = "ausente"
        self.assertIn("INVALID_OPENING", self.codigos(doc))
        doc = fixture("dois-adjacentes")
        doc["relations"][0]["wallB"] = "sala-east"
        self.assertIn("INCONSISTENT_RELATION", self.codigos(doc))

    def test_nao_aceita_campos_obrigatorios_ausentes_ou_raiz_invalida(self):
        for campo in ("schemaVersion", "unit", "geometry", "provenance", "rooms"):
            doc = fixture()
            del doc[campo]
            with self.subTest(campo=campo):
                self.assertTrue(validar(doc))
        for doc in (None, [], True, 42, {}, {"rooms": []}):
            with self.subTest(doc=doc):
                self.assertTrue(validar(doc))

    def test_validacao_nao_importa_cv_blender_ou_fabrica(self):
        script = (
            "import sys; from pipeline.validar_leitura import validar; "
            "assert not any(m in sys.modules for m in "
            "('bpy', 'cv2', 'numpy', 'pipeline.extrair_planta', 'pipeline.fonte_leve'))"
        )
        resultado = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
        self.assertEqual(resultado.returncode, 0, resultado.stderr)

    def test_erros_deterministicos_e_sem_mutacao(self):
        doc = fixture("sobreposicao")
        anterior = copy.deepcopy(doc)
        resultado = validar(doc)
        self.assertEqual(resultado, validar(doc))
        self.assertEqual(doc, anterior)
        for erro in resultado:
            self.assertEqual(set(erro), {"code", "path", "message"})
            self.assertTrue(erro["message"])

    def test_diagnostico_independe_da_ordem_das_chaves_json(self):
        doc = fixture("comodo-unico")
        doc["rooms"][0]["walls"]["east"] = "sala-south"
        reordenado = copy.deepcopy(doc)
        paredes = reordenado["rooms"][0]["walls"]
        reordenado["rooms"][0]["walls"] = dict(reversed(list(paredes.items())))
        self.assertEqual(validar(doc), validar(reordenado))

    def test_cli_valido_invalido_e_json_ambiguo(self):
        for nome, exit_code in (("apartamento-simples", 0), ("sobreposicao", 2)):
            resultado = subprocess.run(
                [sys.executable, "-m", "pipeline.validar_leitura", str(FIXTURES / (nome + ".json"))],
                capture_output=True, text=True, encoding="utf-8",
            )
            self.assertEqual(resultado.returncode, exit_code, resultado.stderr)
            self.assertEqual(json.loads(resultado.stdout)["valid"], exit_code == 0)
        with tempfile.TemporaryDirectory() as pasta:
            arquivo = Path(pasta) / "leitura.json"
            for texto in ('{"id":"a","id":"b"}', '{"x":NaN}', '{'):
                arquivo.write_text(texto, encoding="utf-8")
                resultado = subprocess.run(
                    [sys.executable, "-m", "pipeline.validar_leitura", str(arquivo)],
                    capture_output=True, text=True, encoding="utf-8",
                )
                self.assertEqual(resultado.returncode, 2, resultado.stderr)
                self.assertEqual(json.loads(resultado.stdout)["errors"][0]["code"], "INVALID_JSON")


if __name__ == "__main__":
    unittest.main()
