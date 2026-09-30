"""M1.1-A: a cadeia do estudo sobre um export do capturador (pipeline/avaliar_captura.py)."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from pipeline import avaliar_captura as av

RAIZ = Path(__file__).resolve().parents[1]
LEITURAS = RAIZ / "tests" / "fixtures" / "leitura" / "v1"
CONTEXTO = json.loads((RAIZ / "tests" / "fixtures" / "m1f" / "contexto-sintetico.json").read_text(encoding="utf-8"))


def export(nome, mexe=None):
    d = json.loads((LEITURAS / (nome + ".json")).read_text(encoding="utf-8"))
    if mexe:
        mexe(d)
    return json.dumps(d, ensure_ascii=False).encode("utf-8")


class Cadeia(unittest.TestCase):
    def test_export_do_capturador_passa_e_encaixe_fica_sem_avaliar(self):
        r = av.avaliar(export("capturador-aberturas-mobile"), "C0")
        self.assertTrue(r["m1_0"]["ok"] and r["m1_a"]["ok"] and r["consumidor"]["ok"])
        self.assertEqual(r["complexidade"], {"comodos": 2, "portas": 1, "janelas": 1, "revision": 13})
        self.assertEqual(r["encaixe"], "nao-avaliado")
        self.assertNotIn("maquete", r)

    def test_medida_real_fora_da_grade_e_registrada_com_o_quanto_erra(self):
        def larga(d):
            d["rooms"][0]["widthMm"] = 3430                   # 3,43 m, como na planta
        r = av.avaliar(export("comodo-unico", larga), "C1")
        self.assertTrue(r["m1_0"]["ok"] and r["m1_a"]["ok"])
        self.assertEqual([e["code"] for e in r["consumidor"]["errors"]], ["FORA_DA_GRADE"])
        self.assertEqual(r["consumidor"]["foraDaGrade"],
                         [{"path": "/rooms/0/widthMm", "comodo": "sala", "valorMm": 3430,
                           "restoMm": 30, "ateGradeMm": 20}])

    def test_recusas_do_m1_0_param_a_cadeia(self):
        r = av.avaliar(export("geometria-nao-suportada"), "C2")
        self.assertEqual([e["code"] for e in r["m1_0"]["errors"]], ["UNSUPPORTED_GEOMETRY"])
        self.assertNotIn("m1_a", r)
        r = av.avaliar(b'{"id": "a", "id": "b"}', "C3")
        self.assertEqual([e["code"] for e in r["m1_0"]["errors"]], ["INVALID_JSON"])

    def test_com_contexto_avalia_encaixe_e_gera_a_maquete(self):
        ctx = copy.deepcopy(CONTEXTO)
        ctx["lote"]["predio"].update(largura_m=5, profundidade_m=5)
        r = av.avaliar(export("capturador-aberturas-mobile"), "C4", ctx)
        self.assertEqual([e["code"] for e in r["encaixe"]["errors"]], ["CONTEXTO_NAO_COMPORTA"])
        tmp = Path(tempfile.mkdtemp(prefix="m1-1a-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        r = av.avaliar(export("capturador-aberturas-mobile"), "C4", CONTEXTO, tmp / "maquete")
        self.assertTrue(r["encaixe"]["ok"] and r["maquete"]["ok"])
        self.assertEqual(r["maquete"]["relatorio"]["entrada"]["contentSha256"], r["m1_a"]["contentSha256"])
        self.assertTrue((tmp / "maquete" / "maquete.html").is_file())
        self.assertIn("M1-F consumidor: aceita", av.resumo(r))


if __name__ == "__main__":
    unittest.main()
