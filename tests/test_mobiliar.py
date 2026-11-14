# -*- coding: utf-8 -*-
"""A ocupação do layout deve medir a mesma peça que o renderizador monta."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from pipeline import mobiliar


RAIZ = Path(__file__).resolve().parents[1]
PECAS = json.loads((RAIZ / "moveis" / "moveis_lib.json").read_text(encoding="utf-8"))["pecas"]


def sala(estilo_sofa=None):
    planta = {"comodos": [{"nome": "sala", "poly": [[0, 0], [4.5, 0], [4.5, 3.6], [0, 3.6]],
                           "area": 16.2}]}
    if estilo_sofa:
        planta["estilo_sofa"] = estilo_sofa
    return {"id": "2", "planta": planta}


def caixa_renderizada(m):
    sufixo = "_" + m["estilo"] if "sofa_mod_" + m.get("estilo", "") in PECAS else ""
    largura = max(m["w"], 2 * PECAS["sofa_braco" + sufixo]["b"][0] + 0.62)
    w, d = (largura, m["d"]) if m["rot"] % 2 == 0 else (m["d"], largura)
    x, y = m["p"]
    return (x - w / 2, y - d / 2, x + w / 2, y + d / 2)


class TestOcupacaoSofa(unittest.TestCase):
    def test_poltrona_nuvem_exporta_a_largura_real_e_cabe_na_sala(self):
        sofas = [m for m in mobiliar.mobilia(sala())[0] if m["tipo"] == "sofa"]
        self.assertEqual(len(sofas), 2)
        poltrona = min(sofas, key=lambda m: m["w"])
        self.assertEqual(poltrona["estilo"], "nuvem")
        self.assertAlmostEqual(poltrona["w"], 1.18)
        x0, y0, x1, y1 = caixa_renderizada(poltrona)
        self.assertGreaterEqual(x0, mobiliar.MEIA_PAREDE)
        self.assertGreaterEqual(y0, mobiliar.MEIA_PAREDE)
        self.assertLessEqual(x1, 4.5 - mobiliar.MEIA_PAREDE)
        self.assertLessEqual(y1, 3.6 - mobiliar.MEIA_PAREDE)

    def test_ocupacao_e_reserva_usam_as_medidas_da_geometria_final(self):
        comodos = []
        original = mobiliar.Comodo

        def registrar(*args, **kwargs):
            c = original(*args, **kwargs)
            comodos.append(c)
            return c

        with patch.object(mobiliar, "Comodo", side_effect=registrar):
            moveis = mobiliar.mobilia(sala())[0]
        c = comodos[0]
        for m in moveis:
            if m["tipo"] != "sofa":
                continue
            caixa = caixa_renderizada(m)
            self.assertTrue(any(all(abs(a - b) < 1e-6 for a, b in zip(caixa, ocupada))
                                for ocupada in c.postos), (m, c.postos))
            reserva = c.faixa(*m["p"], m["w"], m["d"], m["rot"], mobiliar.MIN["assento"])
            self.assertIn(reserva, c.reservas)

    def test_largura_minima_acompanha_cada_par_do_catalogo(self):
        for estilo in mobiliar.estilos_sofa() + ["nao-existe"]:
            with self.subTest(estilo=estilo):
                sofas = [m for m in mobiliar.mobilia(sala(estilo))[0] if m["tipo"] == "sofa"]
                self.assertEqual(len(sofas), 2)
                self.assertTrue(all(m["estilo"] == estilo for m in sofas))
                for m in sofas:
                    caixa = caixa_renderizada(m)
                    largura = caixa[2] - caixa[0] if m["rot"] % 2 == 0 else caixa[3] - caixa[1]
                    self.assertAlmostEqual(m["w"], largura)


if __name__ == "__main__":
    unittest.main()
