# -*- coding: utf-8 -*-
"""Resolvedor único dos artefatos LEVE: fonte normalizada -> caminhos locais."""
from pathlib import Path
import unittest

from pipeline import artefatos_leve, fonte_leve

RAIZ = Path(__file__).resolve().parents[1]


class ArtefatosLeveTests(unittest.TestCase):
    def test_tres_fixtures_resolvem_por_slug_da_fonte(self):
        casos = {
            "monte-dos-cedros-37": ("montes-mrv-v1", "monte-dos-cedros"),
            "monte-das-colinas-39": ("montes-mrv-v1", "monte-das-colinas"),
            "wish-castanheiras-58": ("castanheiras-ebm-v1", "castanheiras"),
        }
        for uid, (profile, slug) in casos.items():
            with self.subTest(uid=uid):
                r = artefatos_leve.resolver(uid)
                self.assertEqual(r["propertyId"], uid)
                self.assertEqual(r["profile"], profile)
                self.assertEqual(r["slug"], slug)
                self.assertEqual(r["dir"].name, slug + "_blender")
                self.assertEqual(r["modelo"], r["dir"] / "modelo.json")
                self.assertEqual(r["glb"], r["dir"] / (slug + ".glb"))
                self.assertEqual(r["validacao"], r["dir"] / "validacao.json")

    def test_raiz_de_saida_e_injetavel_sem_mudar_slug(self):
        root = Path("X:/fabrica-temporaria")
        r = artefatos_leve.resolver("monte-das-colinas-39", root=root)
        self.assertEqual(r["dir"], root / "monte-das-colinas_blender")
        self.assertEqual(r["modelo"], root / "monte-das-colinas_blender/modelo.json")

    def test_imovel_sem_perfil_falha_com_o_mesmo_contrato_da_fonte(self):
        with self.assertRaisesRegex(fonte_leve.FonteLeveErro, "sem perfil LEVE"):
            artefatos_leve.resolver("__sem-perfil__")

    def test_resolvedor_nao_conhece_ids_de_imoveis(self):
        codigo = Path(artefatos_leve.__file__).read_text(encoding="utf-8")
        for uid in (
            "monte-dos-cedros-37",
            "monte-das-colinas-39",
            "wish-castanheiras-58",
        ):
            with self.subTest(uid=uid):
                self.assertNotIn(uid, codigo)

    def test_consumidores_nao_reintroduzem_mapa_de_ids(self):
        pagina = (RAIZ / "v1.5/miniaturas/pagina_maquete.py").read_text(encoding="utf-8")
        build = (RAIZ / "pipeline/build_imovel.py").read_text(encoding="utf-8")
        fabrica = (RAIZ / "pipeline/fabrica_miniaturas.py").read_text(encoding="utf-8")
        self.assertNotIn("MODELOS_BLENDER", pagina)
        self.assertNotIn("MODELOS_BLENDER", build)
        self.assertIn("artefatos_leve.resolver", pagina)
        self.assertIn("artefatos_leve.resolver", build)
        self.assertIn("artefatos_leve.resolver", fabrica)


if __name__ == "__main__":
    unittest.main()
