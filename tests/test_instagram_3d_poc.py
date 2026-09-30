import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "experiments" / "instagram-3d-poc" / "build_poc.py"
spec = importlib.util.spec_from_file_location("instagram_3d_poc", MODULE_PATH)
poc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(poc)

BASE = """<!doctype html><html><head><title>x</title></head><body>
<canvas id="c"></canvas>
<nav id="modos">
<button data-modo="planta3d" aria-pressed="false">Planta 3D</button>
<button data-modo="visita" aria-pressed="false">Visita 3D</button>
</nav>
</body></html>"""


class Instagram3DPocTest(unittest.TestCase):
    def test_injeta_casca_sem_alterar_o_html_base_fora_dos_dois_pontos(self):
        out = poc.inject_poc(BASE)
        self.assertIn(poc.POC_MARKER, out)
        self.assertIn('classList.add("instagram-3d-poc")', out)
        self.assertIn('button[data-modo="planta3d"]', out)
        self.assertIn('button[data-modo="visita"]', out)
        self.assertIn("webglcontextlost", out)
        self.assertIn("orientationchange", out)
        self.assertIn("visibilitychange", out)
        self.assertIn(BASE.split("</head>")[0], out)

    def test_recusa_artefato_incompativel(self):
        with self.assertRaisesRegex(ValueError, "artefato incompatível"):
            poc.inject_poc("<html><head></head><body></body></html>")

    def test_recusa_injecao_dupla(self):
        once = poc.inject_poc(BASE)
        with self.assertRaisesRegex(ValueError, "já contém"):
            poc.inject_poc(once)

    def test_geracao_forca_modo_leve_e_nao_publica(self):
        with tempfile.TemporaryDirectory() as td:
            repo = Path(td)
            generator = repo / "v1.5" / "miniaturas" / "pagina_maquete.py"
            generator.parent.mkdir(parents=True)
            generator.write_text("# stub", encoding="utf-8")
            target = repo / "out.html"
            with mock.patch.object(poc.subprocess, "run") as run:
                poc.generate_source(repo, "monte-dos-cedros-37", target)
            cmd = run.call_args.args[0]
            self.assertEqual(cmd[cmd.index("--modo") + 1], "leve")
            self.assertEqual(cmd[cmd.index("--unidade") + 1], "monte-dos-cedros-37")
            self.assertNotIn("firebase", " ".join(cmd).lower())
            self.assertNotIn("deploy", " ".join(cmd).lower())
            self.assertTrue(run.call_args.kwargs["check"])

    def test_build_com_source_escreve_so_a_saida(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "source.html"
            output = root / "dist" / "index.html"
            source.write_text(BASE, encoding="utf-8")
            info = poc.build(root, output, source, "monte-dos-cedros-37")
            self.assertTrue(output.is_file())
            self.assertEqual(info["mode"], "leve")
            self.assertEqual(info["property"], "monte-dos-cedros-37")
            self.assertEqual(len(info["sha256"]), 64)
            self.assertEqual(source.read_text(encoding="utf-8"), BASE)


if __name__ == "__main__":
    unittest.main()
