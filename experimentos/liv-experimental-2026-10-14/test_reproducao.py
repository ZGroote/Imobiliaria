"""Regressões de identidade de fonte/publicação e integridade do pacote."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

EXP = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("liv_pacote", EXP / "preparar_pacote.py")
pacote = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pacote)
historico = pacote.carregar_preparador()


class IdentidadeFonteTests(unittest.TestCase):
    def setUp(self):
        self.fonte = b"fonte original antes da minificacao"
        self.publicado = b"minificado"
        self.release = {"htmlSHA256": historico.sha(self.publicado),
                        "htmlBytes": len(self.publicado), "minificada": True,
                        "htmlOriginalSHA256": historico.sha(self.fonte)}

    def test_fonte_registrada_aceita_sem_usar_tamanho_minificado(self):
        self.assertEqual(historico.verificar_origem(self.fonte, self.release),
                         {"tipo": "fonte", **pacote.identidade(self.fonte)})

    def test_publicacao_exige_hash_e_tamanho(self):
        self.assertEqual(historico.verificar_origem(self.publicado, self.release)["tipo"], "publicacao")
        self.release["htmlBytes"] += 1
        with self.assertRaises(ValueError):
            historico.verificar_origem(self.publicado, self.release)

    def test_fonte_alterada_rejeitada(self):
        with self.assertRaises(ValueError):
            historico.verificar_origem(self.fonte + b" ", self.release)

    def test_hash_original_nao_e_alternativa_generica(self):
        self.release["minificada"] = False
        with self.assertRaises(ValueError):
            historico.verificar_origem(self.fonte, self.release)

    def test_tamanho_original_quando_registrado_tambem_e_exigido(self):
        self.release["htmlOriginalBytes"] = len(self.fonte) - 1
        with self.assertRaises(ValueError):
            historico.verificar_origem(self.fonte, self.release)

    def test_fonte_invalida_falha_antes_de_preparar_qualquer_arquivo(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            origem = raiz / "fonte"
            (origem / "publicacao").mkdir(parents=True)
            (origem / "publicacao/publicacao.json").write_text(json.dumps(self.release), "utf8")
            (origem / historico.MINIATURA_NOME).write_bytes(self.fonte + b" alterada")
            mapa = raiz / "mapa.html"
            mapa.write_bytes(b"mapa")
            destino = raiz / "site"
            with patch.object(historico, "LIV", origem), self.assertRaises(ValueError):
                historico.preparar(mapa, destino, [])
            self.assertFalse(destino.exists())


class PacoteTests(unittest.TestCase):
    def test_falha_na_montagem_preserva_destino_e_repeticao_recupera(self):
        # Integração com os artefatos reais: falha na segunda escrita do staging,
        # recuperação e repetição sem regravar um pacote final já aprovado.
        with tempfile.TemporaryDirectory(prefix="teste-reproducao-", dir=EXP) as pasta:
            raiz = Path(pasta)
            destino = raiz / "site-baseline"
            gravar_original = historico.gravar
            chamadas = 0

            def falhar_segunda_escrita(caminho, data):
                nonlocal chamadas
                chamadas += 1
                if chamadas == 2:
                    raise OSError("falha de escrita injetada")
                return gravar_original(caminho, data)

            def estado():
                return {arquivo.relative_to(destino).as_posix():
                        (pacote.identidade(arquivo.read_bytes()), arquivo.stat().st_mtime_ns)
                        for arquivo in destino.rglob("*") if arquivo.is_file()}

            with patch.object(pacote, "EXP", raiz), patch.object(pacote, "carregar_preparador", return_value=historico):
                with patch.object(historico, "gravar", side_effect=falhar_segunda_escrita), self.assertRaisesRegex(OSError, "injetada"):
                    pacote.preparar(destino)
                self.assertFalse(destino.exists())
                self.assertEqual(list(raiz.iterdir()), [])
                pacote.preparar(destino)
                aprovado = estado()
                self.assertEqual(len(aprovado), 126)
                chamadas = 0
                with patch.object(historico, "gravar", side_effect=falhar_segunda_escrita), self.assertRaisesRegex(OSError, "injetada"):
                    pacote.preparar(destino)
                self.assertEqual(estado(), aprovado)
                pacote.preparar(destino)
                self.assertEqual(estado(), aprovado)
                self.assertFalse(list(raiz.glob(".liv-reproducao-*")))

    def test_payload_corrompido_e_extra_rejeitados(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            arquivo = raiz / "mapa.html"
            arquivo.write_bytes(b"mapa regional")
            esperado = {"mapa.html": pacote.identidade(arquivo.read_bytes())}
            pacote.verificar_arquivos(raiz, esperado)
            arquivo.write_bytes(b"mapa adulterado")
            with self.assertRaisesRegex(ValueError, "Identidade divergente"):
                pacote.verificar_arquivos(raiz, esperado)
            arquivo.write_bytes(b"mapa regional")
            (raiz / "cidade-completa.html").write_bytes(b"nao previsto")
            with self.assertRaisesRegex(ValueError, "Conjunto de arquivos divergente"):
                pacote.verificar_arquivos(raiz, esperado)

    def test_caminho_fora_do_pacote_rejeitado(self):
        with self.assertRaises(ValueError):
            pacote.caminho_relativo("../origem.html")

    def test_destino_historico_rejeitado_antes_da_escrita(self):
        with self.assertRaisesRegex(ValueError, "destino"):
            pacote.preparar(pacote.MAPA / "site-v3")


if __name__ == "__main__":
    unittest.main()
