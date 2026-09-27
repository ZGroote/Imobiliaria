# -*- coding: utf-8 -*-
"""M2.1a: a fonte LEVE dos Montes vira dados, sem Blender."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pipeline import fonte_leve as F


class MontesNormalizacaoTests(unittest.TestCase):
    def test_cedros_preserva_parametros_do_gerador_atual(self):
        r = F.normalizar("monte-dos-cedros-37")
        self.assertEqual(r["style"]["profile"], "montes-mrv-v1")
        self.assertEqual(r["style"]["variant"], "torres-altas")
        self.assertEqual((r["building"]["floors"], r["building"]["width"], r["building"]["depth"]),
                         (15, 34, 14))
        self.assertEqual(r["building"]["floorHeight"], 3.15)
        self.assertEqual([(b["du"], b["dv"]) for b in r["building"]["towers"]],
                         [(0, 0), (44, 1)])
        self.assertEqual(r["building"]["principalTower"], 0)
        self.assertEqual((r["building"]["portaria"]["du"], r["building"]["portaria"]["dv"]),
                         (22, 15))
        self.assertEqual(r["style"]["recess"], 1.7)
        self.assertEqual(r["style"]["balconyCenters"], [-2.1, 2.1])
        self.assertEqual(r["style"]["balconyWidth"], 2.55)
        self.assertEqual(r["style"]["materials"]["moldura"]["color"], [107, 117, 92])
        self.assertEqual(r["style"]["molduraMode"], "split-highrise")
        self.assertFalse(r["style"]["longFacadeBands"])
        self.assertEqual(r["render"], {
            "target": [22, -1, 22],
            "distance": [-95, -100, 70],
            "ortho": 110,
        })
        self.assertEqual(r["style"]["referenceImage"], "referencias/cedros-fachada.jpg")
        self.assertEqual(r["metadata"]["scope"], "duas torres")
        self.assertEqual(len(r["style"]["materials"]), 12)

    def test_colinas_preserva_parametros_do_gerador_atual(self):
        r = F.normalizar("monte-das-colinas-39")
        self.assertEqual(r["style"]["profile"], "montes-mrv-v1")
        self.assertEqual(r["style"]["variant"], "blocos-baixos")
        self.assertEqual((r["building"]["floors"], r["building"]["width"], r["building"]["depth"]),
                         (4, 32, 12))
        self.assertEqual([(b["du"], b["dv"]) for b in r["building"]["towers"]],
                         [(0, 0), (-38, 0), (0, 28), (-38, 28)])
        self.assertEqual(r["building"]["principalTower"], 0)
        self.assertEqual((r["building"]["portaria"]["du"], r["building"]["portaria"]["dv"]),
                         (-19, -14))
        self.assertEqual(r["style"]["balconyWidth"], 2.25)
        self.assertEqual(r["style"]["materials"]["moldura"]["color"], [135, 130, 115])
        self.assertEqual(r["style"]["molduraMode"], "full-lowrise")
        self.assertTrue(r["style"]["longFacadeBands"])
        self.assertEqual(r["render"], {
            "target": [-19, -14, 6],
            "distance": [-95, -100, 70],
            "ortho": 104,
        })
        self.assertEqual(r["style"]["referenceImage"], "referencias/colinas-portaria.jpg")

    def test_fatos_do_predio_vem_do_cadastro_e_nao_do_codigo(self):
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            (raiz / "plantas_fornecidas/x-1").mkdir(parents=True)
            (raiz / "perfis").mkdir()
            cadastro = {
                "lote": {"predio": {
                    "pavimentos": 9, "largura_m": 41, "profundidade_m": 17,
                    "blocos": [
                        {"principal": True, "du": 7, "dv": 8, "sacadas": {"por_face": 1}},
                        {"du": 18, "dv": 19, "sacadas": {"por_face": 1}},
                        {"du": 3, "dv": 4, "classe": 2},
                    ],
                }}
            }
            (raiz / "plantas_fornecidas/x-1/unidade.json").write_text(
                json.dumps(cadastro), encoding="utf-8")
            perfil = {
                "schema": 1, "profile": "p",
                "common": {
                    "floorHeight": 3.15, "recess": 1.7, "balconyCenters": [-2.1, 2.1],
                    "renderDistance": [-1, -2, 3], "reference": "r", "uncertainty": "u",
                    "materials": {},
                },
                "variants": {"v": {
                    "balconyWidth": 2.0, "molduraColor": [1, 2, 3],
                    "molduraMode": "m", "longFacadeBands": False,
                    "referenceImage": "r.jpg", "renderTarget": [1, 2, 3],
                    "renderOrtho": 10, "scope": "s",
                }},
            }
            (raiz / "perfis/p.json").write_text(json.dumps(perfil), encoding="utf-8")
            mapa = {"schema": 1, "properties": {
                "x-1": {"profile": "p", "variant": "v", "slug": "x"}}}
            (raiz / "perfis/imoveis.json").write_text(json.dumps(mapa), encoding="utf-8")
            with patch.object(F, "RAIZ", raiz), patch.object(F, "PERFIS", raiz / "perfis"), \
                 patch.object(F, "MAPA", raiz / "perfis/imoveis.json"):
                r = F.normalizar("x-1")
            self.assertEqual((r["building"]["floors"], r["building"]["width"],
                              r["building"]["depth"]), (9, 41, 17))
            self.assertEqual([(b["du"], b["dv"]) for b in r["building"]["towers"]],
                             [(7, 8), (18, 19)])
            self.assertEqual((r["building"]["portaria"]["du"],
                              r["building"]["portaria"]["dv"]), (3, 4))

    def test_ids_dos_montes_ficam_no_mapa_de_dados_nao_no_modulo(self):
        codigo = Path(F.__file__).read_text(encoding="utf-8")
        self.assertNotIn("monte-dos-cedros-37", codigo)
        self.assertNotIn("monte-das-colinas-39", codigo)

    def test_normalizacao_nao_vaza_ficha_url_ou_fonte_comercial(self):
        for uid in ("monte-dos-cedros-37", "monte-das-colinas-39"):
            bruto = F.canonical(uid)
            self.assertNotIn("mariaaires", bruto.lower())
            self.assertNotIn('"url"', bruto)
            self.assertNotIn('"ficha"', bruto)

    def test_serializacao_e_deterministica(self):
        self.assertEqual(F.canonical("monte-dos-cedros-37"),
                         F.canonical("monte-dos-cedros-37"))

    def test_castanheiras_ainda_e_explicitamente_nao_suportado(self):
        with self.assertRaisesRegex(F.FonteLeveErro, "sem perfil LEVE declarado"):
            F.normalizar("wish-castanheiras-58")


class ContratoTests(unittest.TestCase):
    def test_mapa_aponta_so_para_perfis_existentes(self):
        mapa = json.loads(F.MAPA.read_text(encoding="utf-8"))
        for uid, cfg in mapa["properties"].items():
            with self.subTest(uid):
                self.assertTrue((F.PERFIS / (cfg["profile"] + ".json")).is_file())

    def test_um_principal_e_uma_portaria_sao_obrigatorios(self):
        original = F._json
        def fake(path):
            data = original(path)
            if str(path).replace("\\", "/").endswith(
                    "plantas_fornecidas/monte-dos-cedros-37/unidade.json"):
                data["lote"]["predio"]["blocos"] = [
                    {"du": 0, "dv": 0, "sacadas": {"por_face": 1}},
                    {"du": 1, "dv": 1, "classe": 2},
                ]
            return data
        with patch.object(F, "_json", side_effect=fake):
            with self.assertRaisesRegex(F.FonteLeveErro, "bloco principal"):
                F.normalizar("monte-dos-cedros-37")


if __name__ == "__main__":
    unittest.main()
