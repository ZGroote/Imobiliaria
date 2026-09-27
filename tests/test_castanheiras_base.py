# -*- coding: utf-8 -*-
"""M2.2a: Castanheiras reutiliza a infraestrutura Blender comum sem mudar seu contrato."""
import ast
from pathlib import Path
import unittest

RAIZ = Path(__file__).resolve().parents[1]
SCRIPT = RAIZ / "v1.5" / "miniaturas" / "modelar_castanheiras.py"
BASE = RAIZ / "v1.5" / "miniaturas" / "blender_maquete_base.py"
README = RAIZ / "v1.5" / "miniaturas" / "README.md"


class CastanheirasBaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.codigo = SCRIPT.read_text(encoding="utf-8")
        cls.arvore = ast.parse(cls.codigo)

    def test_script_continua_python_valido_sem_importar_bpy_no_ci(self):
        ast.parse(self.codigo)

    def test_reutiliza_material_box_flush_e_mats_da_base(self):
        self.assertIn(
            "from blender_maquete_base import material, box, flush, MATS",
            self.codigo,
        )
        funcoes = {
            n.name for n in ast.walk(self.arvore) if isinstance(n, ast.FunctionDef)
        }
        self.assertNotIn("material", funcoes)
        self.assertNotIn("box", funcoes)
        self.assertNotIn("flush", funcoes)
        self.assertNotIn("MATS={}", self.codigo)
        self.assertNotIn("buckets={}", self.codigo)

    def test_copies_exportacao_e_render_ainda_sao_proprios(self):
        self.assertIn("def copies(", self.codigo)
        self.assertIn("asset={'source':'Blender '", self.codigo)
        self.assertIn("group['instances'].append({'p':", self.codigo)
        self.assertIn("world=bpy.data.worlds.new('Entardecer')", self.codigo)
        self.assertNotIn("from blender_maquete_base import exportar", self.codigo)
        self.assertNotIn("from blender_maquete_base import renderizar", self.codigo)

    def test_referencia_visual_local_e_opcional_mas_placeholder_permanece(self):
        self.assertIn("ref_path=ROOT/style['referenceImage']", self.codigo)
        self.assertIn(
            "ref=bpy.data.objects.new('REF-perspectiva-fornecida',None)",
            self.codigo,
        )
        self.assertIn("if ref_path.is_file():", self.codigo)
        self.assertIn("REFERENCE_OPTIONAL_MISSING", self.codigo)
        self.assertIn("ref.empty_display_type='PLAIN_AXES'", self.codigo)

    def test_checks_versionados_sao_calculados_pelo_script(self):
        for trecho in (
            "pavimentos_e_lajes_duas_torres=all(",
            "geometria_finita=all(",
            "normais_e_uv=all(",
            "glb_valido=glb_path.stat().st_size>=12",
            "'pavimentos_e_lajes_duas_torres':pavimentos_e_lajes_duas_torres",
            "'geometria_finita':geometria_finita",
            "'normais_e_uv':normais_e_uv",
            "'glb_valido':glb_valido",
        ):
            with self.subTest(trecho=trecho):
                self.assertIn(trecho, self.codigo)

    def test_base_comum_mantem_as_primitivas_que_castanheiras_importa(self):
        base = BASE.read_text(encoding="utf-8")
        arvore = ast.parse(base)
        funcoes = {
            n.name for n in ast.walk(arvore) if isinstance(n, ast.FunctionDef)
        }
        self.assertLessEqual({"material", "box", "flush"}, funcoes)
        self.assertIn("MATS={}", base)

    def test_readme_propaga_excecao_python_do_blender(self):
        doc = README.read_text(encoding="utf-8")
        self.assertIn(
            "--python-exit-code 1 --python v1.5/miniaturas/modelar_castanheiras.py",
            doc,
        )


if __name__ == "__main__":
    unittest.main()
