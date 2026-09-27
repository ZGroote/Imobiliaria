# -*- coding: utf-8 -*-
"""M2: fontes LEVE viram dados normalizados, sem Blender."""
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
            "detail": {
                "target": [0, 0, 24],
                "distance": [-50, -48, 32],
                "ortho": 82,
            },
        })
        self.assertEqual(r["style"]["referenceImage"], "referencias/cedros-fachada.jpg")
        self.assertEqual(r["metadata"]["scope"], "duas torres")
        self.assertEqual(list(r["style"]["materials"]), [
            "reboco", "concreto", "moldura", "painel", "metal", "vidro",
            "escuro", "telhado", "madeira", "folha", "vaso", "acesa",
        ])

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
            "detail": {
                "target": [0, 0, 10],
                "distance": [-50, -48, 32],
                "ortho": 44,
            },
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
                "schema": 1, "profile": "p", "normalizer": "montes-v1",
                "common": {
                    "floorHeight": 3.15, "recess": 1.7, "balconyCenters": [-2.1, 2.1],
                    "renderDistance": [-1, -2, 3], "detailDistance": [-4, -5, 6],
                    "reference": "r", "uncertainty": "u",
                    "materials": {
                        "moldura": {"color": None, "roughness": 0.9, "metalness": 0}
                    },
                },
                "variants": {"v": {
                    "balconyWidth": 2.0, "molduraColor": [1, 2, 3],
                    "molduraMode": "m", "longFacadeBands": False,
                    "referenceImage": "r.jpg", "renderTarget": [1, 2, 3],
                    "renderOrtho": 10, "detailTarget": [7, 8, 9], "detailOrtho": 11,
                    "scope": "s",
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

    def test_ids_dos_imoveis_ficam_no_mapa_de_dados_nao_no_modulo(self):
        codigo = Path(F.__file__).read_text(encoding="utf-8")
        for uid in ("monte-dos-cedros-37", "monte-das-colinas-39",
                    "wish-castanheiras-58"):
            with self.subTest(uid=uid):
                self.assertNotIn(uid, codigo)

    def test_normalizacao_nao_vaza_ficha_url_ou_fonte_comercial(self):
        for uid in ("monte-dos-cedros-37", "monte-das-colinas-39",
                    "wish-castanheiras-58"):
            bruto = F.canonical(uid)
            self.assertNotIn("mariaaires", bruto.lower())
            self.assertNotIn('"url"', bruto)
            self.assertNotIn('"ficha"', bruto)

    def test_serializacao_e_deterministica(self):
        self.assertEqual(F.canonical("monte-dos-cedros-37"),
                         F.canonical("monte-dos-cedros-37"))

class CastanheirasNormalizacaoTests(unittest.TestCase):
    def test_castanheiras_preserva_massa_implantacao_e_perfil(self):
        r = F.normalizar("wish-castanheiras-58")
        self.assertEqual(r["style"]["profile"], "castanheiras-ebm-v1")
        self.assertEqual(r["style"]["variant"], "duas-laminas")
        self.assertEqual(r["style"]["slug"], "castanheiras")
        self.assertEqual(
            (r["building"]["floors"], r["building"]["width"], r["building"]["depth"]),
            (22, 20.0, 15.0),
        )
        self.assertEqual(r["building"]["floorHeight"], 3.15)
        self.assertEqual(
            [(b["du"], b["dv"]) for b in r["building"]["towers"]],
            [(0, 0), (21.0, 3.5)],
        )
        self.assertEqual(r["building"]["principalTower"], 0)
        self.assertEqual(
            (r["building"]["portaria"]["du"], r["building"]["portaria"]["dv"],
             r["building"]["portaria"]["largura_m"],
             r["building"]["portaria"]["profundidade_m"]),
            (10.5, 11.0, 38, 8),
        )
        self.assertEqual(len(r["building"]["auxiliaryBlocks"]), 10)

    def test_castanheiras_preserva_decisoes_visuais_atuais(self):
        r = F.normalizar("wish-castanheiras-58")
        self.assertEqual(r["style"]["visualBalconyDepth"], 2.0)
        self.assertEqual(
            list(r["style"]["materials"]),
            ["reboco", "concreto", "esquadria", "vidro", "luz", "trelica",
             "recuo", "folhagem", "vaso", "cobertura"],
        )
        self.assertEqual(r["style"]["materials"]["reboco"]["color"], [204, 202, 194])
        self.assertEqual(r["style"]["materials"]["trelica"]["color"], [117, 86, 60])
        self.assertEqual(r["style"]["materials"]["luz"]["emission"], 0.7)
        self.assertEqual(r["style"]["referenceImage"], "referencias/castanheiras.png")
        self.assertEqual(r["style"]["facade"]["balconyCenters"], [-2.95, 2.95])
        self.assertEqual(r["style"]["facade"]["trellisCenters"], [-0.38, 0.38])
        self.assertEqual(r["style"]["facade"]["plantingFloors"], [2, 6, 10, 15, 19])
        self.assertEqual(r["style"]["facade"]["curtainVariants"], 4)
        self.assertEqual(r["style"]["facade"]["curtainCycle"], 5)

    def test_castanheiras_preserva_render_e_metadata_atuais(self):
        r = F.normalizar("wish-castanheiras-58")
        self.assertEqual(r["render"]["camera"], {
            "location": [-53, -120, 26],
            "target": [10, -2, 35],
            "lens": 55,
        })
        self.assertEqual(r["render"]["resolution"], [900, 1000])
        self.assertEqual(r["render"]["samples"], 24)
        self.assertEqual(r["render"]["referenceEmpty"], {
            "size": 75,
            "location": [-65, 0, 37],
        })
        self.assertEqual(r["metadata"]["reference"], "../referencias/castanheiras.png")
        self.assertEqual(r["metadata"]["back"], "aproximado por simetria")

    def test_sacada_visual_de_2m_nao_reescreve_avanco_medido_do_cadastro(self):
        r = F.normalizar("wish-castanheiras-58")
        self.assertEqual(r["style"]["visualBalconyDepth"], 2.0)
        self.assertEqual(
            [b["sacadas"]["avanco_m"] for b in r["building"]["towers"]],
            [1.3, 1.3],
        )

    def test_serializacao_castanheiras_e_deterministica(self):
        self.assertEqual(
            F.canonical("wish-castanheiras-58"),
            F.canonical("wish-castanheiras-58"),
        )


class ContratoTests(unittest.TestCase):
    def test_mapa_aponta_so_para_perfis_existentes(self):
        mapa = json.loads(F.MAPA.read_text(encoding="utf-8"))
        for uid, cfg in mapa["properties"].items():
            with self.subTest(uid):
                path = F.PERFIS / (cfg["profile"] + ".json")
                self.assertTrue(path.is_file())
                perfil = json.loads(path.read_text(encoding="utf-8"))
                self.assertIn(perfil["normalizer"], F.NORMALIZERS)

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
