# -*- coding: utf-8 -*-
"""M2.1b: o gerador Blender dos Montes não decide mais por empreendimento."""
import ast
from pathlib import Path
import unittest

RAIZ = Path(__file__).resolve().parents[1]
SCRIPT = RAIZ / "v1.5" / "miniaturas" / "modelar_montes.py"
README = RAIZ / "v1.5" / "miniaturas" / "README.md"


class ModelarMontesFonteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.codigo = SCRIPT.read_text(encoding="utf-8")

    def test_script_continua_python_valido_sem_importar_bpy_no_ci(self):
        ast.parse(self.codigo)

    def test_consume_a_fonte_normalizada(self):
        self.assertIn("from pipeline.fonte_leve import normalizar", self.codigo)
        self.assertIn("fonte=normalizar(uid)", self.codigo)
        for trecho in (
            "building['width']",
            "building['depth']",
            "building['floors']",
            "building['floorHeight']",
            "building['towers']",
            "building['portaria']",
            "style['materials'].items()",
            "style['recess']",
            "style['balconyWidth']",
            "style['balconyCenters']",
            "style['molduraMode']",
            "style['longFacadeBands']",
            "style['referenceImage']",
            "render['target']",
            "render['distance']",
            "render['ortho']",
        ):
            with self.subTest(trecho=trecho):
                self.assertIn(trecho, self.codigo)

    def test_nao_restam_escolhas_por_cedros_ou_colinas_no_python(self):
        proibidos = (
            "kind=='cedros'",
            "kind=='colinas'",
            "kind in ('cedros','colinas')",
            "if kind",
            "(22,15) if",
            "(-19,-14)",
            "2.55 if",
            "2.25",
            "cedros-fachada.jpg' if",
            "colinas-portaria.jpg",
            "'duas torres' if",
        )
        for trecho in proibidos:
            with self.subTest(trecho=trecho):
                self.assertNotIn(trecho, self.codigo)

    def test_cli_nao_tem_imovel_default_oculto(self):
        self.assertIn("if '--' not in sys.argv", self.codigo)
        self.assertIn("<propertyId>", self.codigo)
        self.assertNotIn("else 'cedros'", self.codigo)

    def test_portaria_usa_posicao_do_cadastro_sem_mudar_desenho_visual(self):
        self.assertIn("gx=building['portaria'].get('du',0)", self.codigo)
        self.assertIn("gy=building['portaria'].get('dv',0)", self.codigo)
        # 8 x 4 é deliberadamente a regra visual aprovada nesta etapa.
        self.assertIn("box('reboco',gx,1.55,gy,8,3.1,4)", self.codigo)

    def test_readme_usa_property_id(self):
        doc = README.read_text(encoding="utf-8")
        self.assertIn("modelar_montes.py -- monte-dos-cedros-37", doc)
        self.assertIn("modelar_montes.py -- monte-das-colinas-39", doc)
        self.assertNotIn("modelar_montes.py -- cedros", doc)
        self.assertNotIn("modelar_montes.py -- colinas", doc)


if __name__ == "__main__":
    unittest.main()
