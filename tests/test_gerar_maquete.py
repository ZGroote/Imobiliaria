# -*- coding: utf-8 -*-
"""Testes da geração direta da Maquete 3D LEVE a partir de leitura do Capturador."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from pipeline import gerar_maquete

RAIZ = Path(__file__).resolve().parents[1]
EXEMPLO_C1 = RAIZ / "tests" / "fixtures" / "leitura" / "v1" / "capturador-aberturas-mobile.json"
EXEMPLO_GEOM = RAIZ / "tests" / "fixtures" / "leitura" / "v1" / "exemplo-geometrico.json"


class TestGerarMaquete(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="test-maquete-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_destino_ocupado_preserva_arquivos_mesmo_com_entrada_invalida(self):
        destino = self.tmp / "existente"
        destino.mkdir()
        arquivo = destino / "preservar.txt"
        arquivo.write_text("original", encoding="utf-8")
        with self.assertRaises(gerar_maquete.e2e.Recusa):
            gerar_maquete.gerar_maquete_da_leitura({}, {"propertyId": "teste", "agencyId": "agA"}, destino=destino)
        self.assertEqual(arquivo.read_text(encoding="utf-8"), "original")

    def test_sem_contexto_exige_demo_explicita(self):
        leitura = json.loads(EXEMPLO_GEOM.read_text(encoding="utf-8"))
        with self.assertRaises(gerar_maquete.e2e.Recusa) as cm:
            gerar_maquete.gerar_maquete_da_leitura(leitura)
        self.assertEqual(cm.exception.errors[0]["code"], "CONTEXTO_OBRIGATORIO")

    def test_demo_nao_aceita_contexto_declarado(self):
        leitura = json.loads(EXEMPLO_GEOM.read_text(encoding="utf-8"))
        contexto = json.loads((RAIZ / "tests/fixtures/m1f/contexto-sintetico.json").read_text(encoding="utf-8"))
        with self.assertRaises(gerar_maquete.e2e.Recusa) as cm:
            gerar_maquete.gerar_maquete_da_leitura(leitura, contexto, demo=True)
        self.assertEqual(cm.exception.errors[0]["code"], "CONTEXTO_INVALIDO")

    def test_sintetizar_contexto_calcula_proporcoes(self):
        leitura = json.loads(EXEMPLO_C1.read_text(encoding="utf-8"))
        ctx = gerar_maquete.sintetizar_contexto(leitura, caso="teste-c1")
        self.assertEqual(ctx["schema"], 1)
        self.assertEqual(ctx["propertyId"], "teste-c1")
        self.assertIn("predio", ctx["lote"])
        predio = ctx["lote"]["predio"]
        self.assertGreaterEqual(predio["largura_m"], 9.5)
        self.assertGreaterEqual(predio["profundidade_m"], 6.5)
        self.assertEqual(predio["pavimentos"], 1)
        self.assertNotIn("quartos", ctx["ficha"])
        self.assertNotIn("vagas", ctx["ficha"])

    def test_gerar_maquete_c1_sucesso(self):
        leitura = json.loads(EXEMPLO_C1.read_text(encoding="utf-8"))
        html, rel = gerar_maquete.gerar_maquete_da_leitura(leitura, caso="c1-unit", demo=True)
        self.assertIn("<!doctype html>", html[:100].lower())
        self.assertIn("THREE.", html)
        self.assertIn("FloorPlan", html)
        self.assertGreater(len(html), 1_500_000)
        self.assertEqual(rel["geometria"]["conferida"], True)
        self.assertEqual(rel["geometria"]["comodos"], 2)
        self.assertEqual(rel["geometria"]["portas"], 1)

    def test_gerar_maquete_com_destino(self):
        leitura = json.loads(EXEMPLO_GEOM.read_text(encoding="utf-8"))
        destino = self.tmp / "maquete_geom"
        html, rel = gerar_maquete.gerar_maquete_da_leitura(leitura, caso="geom-unit", destino=destino, demo=True)
        self.assertTrue((destino / "maquete.html").exists())
        self.assertTrue((destino / "relatorio.json").exists())
        self.assertEqual(rel["geometria"]["comodos"], 8)
        self.assertEqual(rel["geometria"]["portas"], 7)

    def test_cli_gerar_maquete_json(self):
        r = subprocess.run(
            [sys.executable, "-m", "pipeline.gerar_maquete", str(EXEMPLO_C1), "--json", "--demo"],
            cwd=str(RAIZ), capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONUTF8": "1"}
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        data = json.loads(r.stdout)
        self.assertTrue(data.get("ok"))
        self.assertGreater(data.get("bytes", 0), 1_500_000)
        self.assertEqual(data["relatorio"]["geometria"]["conferida"], True)

    def test_contexto_e_companion_moveis_preservam_identidade_e_hash_final(self):
        import hashlib
        leitura = json.loads(EXEMPLO_GEOM.read_text(encoding="utf-8"))
        ctx = json.loads((RAIZ / "tests/fixtures/m1f/contexto-sintetico.json").read_text(encoding="utf-8"))
        original = json.loads(json.dumps(ctx))
        moveis = {"_gerado_por": "capturador-2d", "moveis": [{"tipo": "sofa", "p": [2, 2], "rot": 1, "w": 1.9, "h": 0.8, "d": 0.9}]}
        html, rel = gerar_maquete.gerar_maquete_da_leitura(leitura, ctx, destino=self.tmp / "contexto", moveis=moveis)
        unid = json.loads((self.tmp / "contexto/unidade.json").read_text(encoding="utf-8"))
        self.assertEqual(unid["id"], ctx["propertyId"])
        self.assertEqual(unid["ficha"], ctx["ficha"])
        self.assertEqual(unid["planta"]["moveis"], moveis["moveis"])
        self.assertEqual(ctx, original)
        self.assertEqual(rel["artefato"]["sha256"], hashlib.sha256(html.encode("utf-8")).hexdigest())

    def test_falha_na_promocao_nao_deixa_artefato_parcial(self):
        leitura = json.loads(EXEMPLO_GEOM.read_text(encoding="utf-8"))
        destino = self.tmp / "falha"
        with patch.object(Path, "rename", side_effect=OSError("falha simulada")):
            with self.assertRaises(OSError):
                gerar_maquete.gerar_maquete_da_leitura(leitura, destino=destino, demo=True)
        self.assertFalse(destino.exists())
        self.assertEqual(list(self.tmp.iterdir()), [])

    def test_cli_recusa_json_ambiguo_e_contexto_movel_invalido(self):
        text = EXEMPLO_GEOM.read_text(encoding="utf-8")
        ambiguous = text.replace('"revision":', '"revision": 999, "revision":', 1)
        proc = subprocess.run([sys.executable, "-m", "pipeline.gerar_maquete", "-", "--demo", "--json"], input=ambiguous, encoding="utf-8", capture_output=True)
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(json.loads(proc.stdout)["errors"][0]["code"], "INVALID_JSON")
        with self.assertRaises(gerar_maquete.e2e.Recusa):
            gerar_maquete.gerar_maquete_da_leitura(json.loads(text), demo=True, moveis=[{"tipo": "sofa", "p": [2, 2], "rot": 0, "w": float("nan"), "h": 1, "d": 1}])


if __name__ == "__main__":
    unittest.main()
