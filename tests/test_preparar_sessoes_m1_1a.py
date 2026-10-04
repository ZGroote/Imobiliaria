"""Riscos da preparação: fonte divergente, vazamento de rotas e falso aceite."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from tools import preparar_sessoes_m1_1a as preparo


class TestPreparacaoSessoes(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="test-sessoes-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.root = self.tmp / "fonte"
        self.root.mkdir()
        (self.root / "painel").mkdir()
        (self.root / "painel/package.json").write_text('{"name":"baseline"}', encoding="utf-8")
        for relativo in preparo.MODELO:
            path = self.root / relativo
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((preparo.RAIZ / relativo).read_bytes())
        (self.root / ".gitignore").write_text("painel/out/\n.env*\n", encoding="utf-8")
        self.git("init", "-q")
        self.git("add", ".")
        self.git("-c", "user.name=Teste", "-c", "user.email=teste.invalid", "commit", "-qm", "baseline")
        self.commit = preparo.git(self.root, "rev-parse", "HEAD")
        self.destino = self.tmp / "rodada"

    def git(self, *args):
        subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True)

    def build_falso(self, root, log):
        out = root / "painel/out"
        (out / "_next/static/chunks").mkdir(parents=True)
        (out / "capturador").mkdir()
        (out / "capturador.html").write_text('<script src="/_next/static/chunks/app.js"></script>', encoding="utf-8")
        (out / "capturador.txt").write_text("payload", encoding="utf-8")
        (out / "capturador/__next._full.txt").write_text("payload árvore", encoding="utf-8")
        (out / "_next/static/chunks/app.js").write_text("import('./dynamic.js')", encoding="utf-8")
        (out / "_next/static/chunks/dynamic.js").write_text("console.log('ok')", encoding="utf-8")
        for nome in ("index.html", "login.html", "admin.html"):
            (out / nome).write_text("rota fora do estudo", encoding="utf-8")
        log.write_text("build simulado", encoding="utf-8")

    def preparar(self, callback=None):
        with patch.object(preparo, "build", side_effect=callback or self.build_falso):
            return preparo.preparar(self.root, self.commit, self.destino)

    def test_cinco_fichas_vazias_e_site_sem_rotas_privadas(self):
        manifesto = self.preparar()
        self.assertEqual(manifesto["sessoesRealizadas"], 0)
        self.assertFalse(manifesto["physicalAccepted"])
        self.assertEqual(manifesto["baselineCommit"], self.commit)
        self.assertEqual(set(manifesto["site"]), {
            "capturador.html", "capturador.txt", "capturador/__next._full.txt",
            "_next/static/chunks/app.js", "_next/static/chunks/dynamic.js"})
        for caso in ("C1", "C2", "C3", "C4", "C5"):
            ficha = json.loads((self.destino / caso / "ficha.json").read_text(encoding="utf-8"))
            self.assertEqual(ficha["caso"], caso)
            self.assertEqual(ficha["baselineCommit"], self.commit)
            self.assertEqual(ficha["status"], "nao-iniciada")
            self.assertFalse(ficha["physicalAccepted"])
            self.assertTrue(all(v is None for v in ficha["temposMs"].values()))
            self.assertEqual(ficha["pavimentos"], [])
        preparo.verificar(self.destino)

    def test_destino_existente_nao_inicia_build_nem_altera_dado(self):
        self.destino.mkdir()
        arquivo = self.destino / "guardar.txt"
        arquivo.write_text("original", encoding="utf-8")
        with patch.object(preparo, "build") as build:
            with self.assertRaisesRegex(ValueError, "já existe"):
                preparo.preparar(self.root, self.commit, self.destino)
            build.assert_not_called()
        self.assertEqual(arquivo.read_text(encoding="utf-8"), "original")

    def test_baseline_diferente_recusa_antes_do_build(self):
        (self.root / "painel/package.json").write_text('{"name":"outra"}', encoding="utf-8")
        self.git("add", ".")
        self.git("-c", "user.name=Teste", "-c", "user.email=teste.invalid", "commit", "-qm", "outra")
        with self.assertRaisesRegex(ValueError, "baseline"):
            self.preparar()
        self.assertFalse(self.destino.exists())

    def test_destino_com_pontos_nao_pode_entrar_no_painel(self):
        (self.root / "fora").mkdir()
        destino = self.root / "fora/../painel/rodada"
        with patch.object(preparo, "build") as build:
            with self.assertRaisesRegex(ValueError, "fora do painel"):
                preparo.preparar(self.root, self.commit, destino)
            build.assert_not_called()

    def test_avaliador_nao_pode_usar_modelo_diferente_do_editor_congelado(self):
        path = self.root / preparo.MODELO[0]
        path.write_bytes(path.read_bytes() + b"\n// outra versao\n")
        self.git("add", ".")
        self.git("-c", "user.name=Teste", "-c", "user.email=teste.invalid", "commit", "-qm", "modelo diferente")
        self.commit = preparo.git(self.root, "rev-parse", "HEAD")
        with patch.object(preparo, "build") as build:
            with self.assertRaisesRegex(ValueError, "modelo do avaliador difere"):
                preparo.preparar(self.root, self.commit, self.destino)
            build.assert_not_called()

    def test_fonte_editada_e_env_local_recusadas(self):
        arquivo = self.root / "painel/package.json"
        arquivo.write_text("editado", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "alterações"):
            self.preparar()
        self.git("checkout", "--", "painel/package.json")
        (self.root / "painel/.env.local").write_text("NEXT_PUBLIC_FIREBASE_EMULATOR=1", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "configurações locais"):
            self.preparar()

    def test_fonte_mudando_durante_build_nao_publica_rodada(self):
        def mudar(root, log):
            self.build_falso(root, log)
            (root / "painel/package.json").write_text("editado durante build", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "alterações"):
            self.preparar(mudar)
        self.assertFalse(self.destino.exists())
        self.assertEqual(list(self.tmp.glob(".preparo-m1-1a-*")), [])

    def test_build_com_credencial_demo_ou_arquivo_extra_recusado(self):
        def contaminar(root, log):
            self.build_falso(root, log)
            (root / "painel/out/_next/static/chunks/app.js").write_text("private_key", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Padrão proibido"):
            self.preparar(contaminar)
        self.assertFalse(self.destino.exists())

    def test_verificar_detecta_asset_alterado_extra_e_ausente(self):
        self.preparar()
        asset = self.destino / "site/_next/static/chunks/app.js"
        original = asset.read_bytes()
        asset.write_bytes(b"alterado")
        with self.assertRaisesRegex(ValueError, "difere"):
            preparo.verificar(self.destino)
        asset.write_bytes(original)
        extra = self.destino / "site/login.html"
        extra.write_text("extra", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "difere"):
            preparo.verificar(self.destino)
        extra.unlink()
        asset.unlink()
        with self.assertRaisesRegex(ValueError, "difere"):
            preparo.verificar(self.destino)

    def test_fichas_editaveis_mas_baseline_invariavel(self):
        self.preparar()
        path = self.destino / "C1/ficha.json"
        ficha = json.loads(path.read_text(encoding="utf-8"))
        ficha["temposMs"]["primeiroToqueAteLeituraArquitetura"] = 1234
        preparo.escrever_json(path, ficha)
        preparo.verificar(self.destino)
        ficha["baselineCommit"] = "outra"
        preparo.escrever_json(path, ficha)
        with self.assertRaisesRegex(ValueError, "outra rodada"):
            preparo.verificar(self.destino)

    def test_manifesto_nao_pode_promover_aceite_fisico(self):
        self.preparar()
        path = self.destino / "manifesto.json"
        manifesto = json.loads(path.read_text(encoding="utf-8"))
        manifesto["physicalAccepted"] = True
        preparo.escrever_json(path, manifesto)
        with self.assertRaisesRegex(ValueError, "homologação"):
            preparo.verificar(self.destino)

    def test_template_com_medicao_preenchida_recusa_antes_do_build(self):
        ficha = json.loads(preparo.FICHA.read_text(encoding="utf-8"))
        ficha["temposMs"]["transferenciaAoPc"] = 1234
        path = self.tmp / "ficha.json"
        preparo.escrever_json(path, ficha)
        with patch.object(preparo, "FICHA", path), patch.object(preparo, "build") as build:
            with self.assertRaisesRegex(ValueError, "dados observados"):
                preparo.preparar(self.root, self.commit, self.destino)
            build.assert_not_called()

    def test_destino_ocupado_durante_build_e_preservado(self):
        def ocupar(root, log):
            self.build_falso(root, log)
            self.destino.mkdir()
            (self.destino / "guardar.txt").write_text("original", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "ocupado durante"):
            self.preparar(ocupar)
        self.assertEqual((self.destino / "guardar.txt").read_text(encoding="utf-8"), "original")


if __name__ == "__main__":
    unittest.main()
