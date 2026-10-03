import json
import os
import tempfile
import unittest

from PIL import Image, ImageDraw

from pipeline import croqui
from pipeline import extrair_planta


class CroquiTest(unittest.TestCase):
    def _imagem(self, pasta):
        p = os.path.join(pasta, "croqui.png")
        im = Image.new("L", (300, 220), 255)
        d = ImageDraw.Draw(im)
        # Dois comodos retangulares lado a lado, traco propositalmente grosso.
        for off in range(-2, 3):
            d.line((30 + off, 30, 30 + off, 190), fill=0)
            d.line((150 + off, 30, 150 + off, 190), fill=0)
            d.line((270 + off, 30, 270 + off, 190), fill=0)
            d.line((30, 30 + off, 270, 30 + off), fill=0)
            d.line((30, 190 + off, 270, 190 + off), fill=0)
        im.save(p)
        return p

    def test_analise_detecta_paredes_comodos_e_escala_conhecida(self):
        with tempfile.TemporaryDirectory() as td:
            img = self._imagem(td)
            saida = os.path.join(td, "intermediario.json")
            obj = croqui.analisar(img, (30, 30, 150, 30), 3.0, saida)
            self.assertAlmostEqual(obj["escala"]["px_por_m"], 40.0)
            self.assertGreaterEqual(len(obj["paredes_detectadas"]["verticais"]), 3)
            self.assertGreaterEqual(len(obj["paredes_detectadas"]["horizontais"]), 2)
            self.assertEqual(len(obj["comodos"]), 2)
            self.assertTrue(all(c["confirmado"] is False for c in obj["comodos"]))
            self.assertEqual(obj["status"], "revisao_obrigatoria")

    def test_exportacao_exige_revisao_e_nome(self):
        with tempfile.TemporaryDirectory() as td:
            img = self._imagem(td)
            interm = os.path.join(td, "intermediario.json")
            obj = croqui.analisar(img, (30, 30, 150, 30), 3.0, interm)
            with self.assertRaises(ValueError):
                croqui.exportar(interm, "teste")

            obj["comodos"][0]["confirmado"] = True
            with open(interm, "w", encoding="utf-8") as fp:
                json.dump(obj, fp)
            with self.assertRaises(ValueError):
                croqui.exportar(interm, "teste")

            obj["comodos"][0]["nome"] = "Sala"
            with open(interm, "w", encoding="utf-8") as fp:
                json.dump(obj, fp)
            leitura = croqui.exportar(interm, "teste")
            self.assertEqual(leitura["id"], "teste")
            self.assertEqual(leitura["escala_px_por_m"], 40.0)
            self.assertEqual([c["nome"] for c in leitura["comodos"]], ["Sala"])

    def test_extrator_preserva_escala_conhecida_sem_area_rotulada(self):
        leitura = {
            "escala_px_por_m": 40.0,
            "escala_origem": "croqui:medida_fornecida",
            "comodos": [
                {"nome": "Sala", "px": [0, 0, 120, 160]},
                {"nome": "Quarto", "px": [120, 0, 240, 160]},
            ],
        }
        comodos, rel, escala, _, recuo, _ = extrair_planta.montar(leitura)
        self.assertEqual(escala, 40.0)
        self.assertEqual(recuo, 0)
        self.assertEqual([c["area"] for c in comodos], [12.0, 12.0])
        self.assertTrue(all(r["rotulada"] is None for r in rel))


if __name__ == "__main__":
    unittest.main()
