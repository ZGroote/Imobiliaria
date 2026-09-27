# -*- coding: utf-8 -*-
"""M2.2c: o gerador Castanheiras consome a fonte LEVE normalizada."""
import ast
from pathlib import Path
import unittest

RAIZ = Path(__file__).resolve().parents[1]
SCRIPT = RAIZ / "v1.5" / "miniaturas" / "modelar_castanheiras.py"
README = RAIZ / "v1.5" / "miniaturas" / "README.md"


class CastanheirasFonteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.codigo = SCRIPT.read_text(encoding="utf-8")
        cls.arvore = ast.parse(cls.codigo)

    def test_script_continua_python_valido_sem_importar_bpy_no_ci(self):
        ast.parse(self.codigo)

    def test_consume_a_fonte_normalizada(self):
        self.assertIn("from pipeline.fonte_leve import normalizar", self.codigo)
        self.assertIn("fonte=normalizar(uid)", self.codigo)
        for trecho in (
            "building['floorHeight']",
            "building['floors']",
            "building['width']",
            "building['depth']",
            "building['towers']",
            "building['portaria']",
            "style['materials'].items()",
            "style['facade']",
            "style['referenceImage']",
            "render['camera']",
            "render['resolution']",
            "render['samples']",
            "render['referenceEmpty']",
            "metadata['reference']",
            "metadata['back']",
        ):
            with self.subTest(trecho=trecho):
                self.assertIn(trecho, self.codigo)

    def test_nao_restam_fatos_do_imovel_duplicados_no_python(self):
        proibidos = (
            "LV=3.15",
            "[(0,0),(21,-3.5)]",
            "range(22)",
            "range(23)",
            "material('reboco',(204,202,194)",
            "material('concreto',(221,219,210)",
            "box('reboco',10.5,1.55,11,38,3.1,8)",
            "cam.location=(-53,-120,26)",
            "scene.render.resolution_x=900",
            "scene.cycles.samples=24",
            "ROOT/'referencias/castanheiras.png'",
        )
        for trecho in proibidos:
            with self.subTest(trecho=trecho):
                self.assertNotIn(trecho, self.codigo)

    def test_id_do_imovel_nao_fica_no_gerador(self):
        self.assertNotIn("wish-castanheiras-58", self.codigo)

    def test_cli_exige_property_id_sem_default_oculto(self):
        self.assertIn("if '--' not in sys.argv", self.codigo)
        self.assertIn("<propertyId>", self.codigo)
        self.assertNotIn("else 'wish-castanheiras-58'", self.codigo)

    def test_implantacao_converte_eixo_do_cadastro_sem_lista_literal(self):
        self.assertIn(
            "towers=[(b.get('du',0),-b.get('dv',0)) for b in building['towers']]",
            self.codigo,
        )
        self.assertIn("for tower,(dx,dy) in enumerate(towers):", self.codigo)

    def test_formato_de_exportacao_castanheiras_continua_proprio(self):
        self.assertIn("group['instances'].append({'p':", self.codigo)
        self.assertIn("'s':[ob.scale.x,ob.scale.z,ob.scale.y]", self.codigo)
        self.assertNotIn("from blender_maquete_base import exportar", self.codigo)
        self.assertNotIn("from blender_maquete_base import renderizar", self.codigo)

    def test_report_usa_fonte_normalizada(self):
        self.assertIn("'towers':len(towers)", self.codigo)
        self.assertIn("'floors_per_tower':N", self.codigo)
        self.assertIn("'balcony_depth_m':style['visualBalconyDepth']", self.codigo)
        self.assertIn("'reference':metadata['reference']", self.codigo)
        self.assertIn("'back':metadata['back']", self.codigo)

    def test_readme_usa_property_id_no_entrypoint_unico(self):
        doc = README.read_text(encoding="utf-8")
        self.assertIn(
            "modelar_imovel.py -- wish-castanheiras-58",
            doc,
        )
        self.assertNotIn(
            "modelar_castanheiras.py -- wish-castanheiras-58",
            doc,
        )


if __name__ == "__main__":
    unittest.main()
