# -*- coding: utf-8 -*-
"""M2.3: um único entrypoint Blender resolve a família LEVE pelo propertyId."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

RAIZ = Path(__file__).resolve().parents[1]
SCRIPT = RAIZ / "v1.5" / "miniaturas" / "modelar_imovel.py"


def carregar():
    spec = importlib.util.spec_from_file_location("modelar_imovel_m23", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class DispatcherLeveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.M = carregar()
        cls.codigo = SCRIPT.read_text(encoding="utf-8")

    def test_dispatcher_nao_importa_blender_nem_toca_na_cena(self):
        self.assertNotIn("import bpy", self.codigo)
        self.assertNotIn("bpy.", self.codigo)
        self.assertNotIn("subprocess", self.codigo)

    def test_ids_de_imovel_nao_ficam_no_dispatcher(self):
        for uid in (
            "monte-dos-cedros-37",
            "monte-das-colinas-39",
            "wish-castanheiras-58",
        ):
            with self.subTest(uid=uid):
                self.assertNotIn(uid, self.codigo)

    def test_cedros_resolve_para_montes(self):
        profile, target = self.M.resolver("monte-dos-cedros-37")
        self.assertEqual(profile, "montes-mrv-v1")
        self.assertEqual(target.name, "modelar_montes.py")

    def test_colinas_resolve_para_montes(self):
        profile, target = self.M.resolver("monte-das-colinas-39")
        self.assertEqual(profile, "montes-mrv-v1")
        self.assertEqual(target.name, "modelar_montes.py")

    def test_castanheiras_resolve_para_seu_gerador(self):
        profile, target = self.M.resolver("wish-castanheiras-58")
        self.assertEqual(profile, "castanheiras-ebm-v1")
        self.assertEqual(target.name, "modelar_castanheiras.py")

    def test_cli_exige_separador_e_property_id(self):
        with self.assertRaisesRegex(SystemExit, "uso:"):
            self.M.property_id(["blender", "--python", "modelar_imovel.py"])
        with self.assertRaisesRegex(SystemExit, "propertyId ausente"):
            self.M.property_id(["blender", "--", ""])
        self.assertEqual(
            self.M.property_id(["blender", "--", "abc-123"]),
            "abc-123",
        )

    def test_perfil_sem_gerador_falha_fechado(self):
        with patch.object(
            self.M,
            "normalizar",
            return_value={"style": {"profile": "familia-nova-v1"}},
        ):
            with self.assertRaisesRegex(SystemExit, "sem gerador Blender"):
                self.M.resolver("qualquer")

    def test_main_delega_no_mesmo_processo_sem_mudar_sys_argv(self):
        argv = ["blender", "--background", "--", "monte-dos-cedros-37"]
        observado = {}

        def fake_run_path(path, run_name):
            observado["path"] = Path(path).name
            observado["run_name"] = run_name
            observado["argv"] = list(sys.argv)

        with patch.object(sys, "argv", argv), \
             patch.object(self.M.runpy, "run_path", side_effect=fake_run_path):
            self.M.main()

        self.assertEqual(observado["path"], "modelar_montes.py")
        self.assertEqual(observado["run_name"], "__main__")
        self.assertEqual(observado["argv"], argv)

    def test_geradores_de_familia_continuam_existindo(self):
        for nome in ("modelar_montes.py", "modelar_castanheiras.py"):
            with self.subTest(nome=nome):
                self.assertTrue((SCRIPT.parent / nome).is_file())


if __name__ == "__main__":
    unittest.main()
