"""Fontes privadas fora do git: o manifesto é a autoridade, e o downloader não entrega arquivo errado.

tools/artefatos-privados.json diz onde cada fonte mora (repositório privado, release e asset), e
qual o tamanho e o sha256 dela. tools/baixar_artefatos.py recupera e confere. Estes testes não
usam rede: o download é trocado por uma função que escreve bytes escolhidos.

Enquanto a fonte ainda está versionada, o manifesto tem de bater com o blob do git. É isso que
garante que a âncora foi tirada do arquivo certo.
"""
import hashlib
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('baixar_artefatos', RAIZ / 'tools/baixar_artefatos.py')
BA = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BA)


def entrada(dados, destino='fontes/x.json'):
    return {'destino': destino, 'release': 'r', 'asset': 'x.json', 'bytes': len(dados),
            'sha256': hashlib.sha256(dados).hexdigest()}


def baixador(dados):
    """Um `baixar` falso, que escreve `dados` onde o gh escreveria. Conta as chamadas."""
    chamadas = []

    def baixar(repo, a, pasta):
        chamadas.append(a['asset'])
        caminho = Path(pasta) / a['asset']
        caminho.write_bytes(dados)
        return caminho
    return baixar, chamadas


class ManifestoTests(unittest.TestCase):
    def test_manifest_is_well_formed(self):
        m = BA.carrega()
        self.assertEqual(m['repositorio'], 'ZGroote/imobiliaria-artefatos')
        destinos = [a['destino'] for a in m['artefatos']]
        self.assertEqual(len(destinos), len(set(destinos)))
        for a in m['artefatos']:
            with self.subTest(destino=a['destino']):
                self.assertRegex(a['sha256'], r'^[0-9a-f]{64}$')
                self.assertIsInstance(a['bytes'], int)
                self.assertGreater(a['bytes'], 0)
                self.assertTrue(a['release'] and a['asset'] and a['data'])

    def test_manifest_matches_the_versioned_blob_while_it_is_still_in_git(self):
        m = BA.carrega()
        verificados = 0
        for a in m['artefatos']:
            ls = subprocess.run(['git', 'ls-files', '-s', '--', a['destino']], cwd=RAIZ,
                                capture_output=True, text=True, check=True).stdout.split()
            if not ls:
                continue            # já saiu do git: a âncora passa a ser só o manifesto
            dados = subprocess.run(['git', 'cat-file', 'blob', ls[1]], cwd=RAIZ,
                                   capture_output=True, check=True).stdout
            with self.subTest(destino=a['destino']):
                self.assertEqual(len(dados), a['bytes'])
                self.assertEqual(hashlib.sha256(dados).hexdigest(), a['sha256'])
            verificados += 1
        self.assertEqual(verificados, 2, 'hoje os dois source.json ainda estão no git')

    def test_destination_cannot_escape_the_repository(self):
        with tempfile.TemporaryDirectory() as t:
            for ruim in ('../fora.json', '/abs/x.json', 'a/../../x.json', 'a\\b.json'):
                p = Path(t) / 'm.json'
                p.write_text('{"schema": 1, "repositorio": "r", "artefatos": [{"destino": "%s"}]}'
                             % ruim.replace('\\', '\\\\'), encoding='utf-8')
                with self.subTest(destino=ruim), self.assertRaises(BA.Recusado):
                    BA.carrega(p)


class RecuperacaoTests(unittest.TestCase):
    def test_good_download_lands_in_place(self):
        dados = b'{"fonte": 1}'
        baixar, chamadas = baixador(dados)
        with tempfile.TemporaryDirectory() as raiz:
            self.assertEqual(BA.recupera(entrada(dados), 'r', raiz, baixar), 'baixado')
            self.assertEqual((Path(raiz) / 'fontes/x.json').read_bytes(), dados)
            self.assertEqual(chamadas, ['x.json'])
            self.assertEqual(sorted(p.name for p in (Path(raiz) / 'fontes').iterdir()), ['x.json'])

    def test_wrong_bytes_never_reach_the_destination(self):
        esperado = b'{"fonte": 1}'
        for ruim in (b'{"fonte": 2}', b'{"fonte": 1} '):     # mesmo tamanho; um byte a mais
            baixar, _ = baixador(ruim)
            with tempfile.TemporaryDirectory() as raiz, self.subTest(ruim=ruim):
                with self.assertRaises(BA.Recusado):
                    BA.recupera(entrada(esperado), 'r', raiz, baixar)
                self.assertFalse((Path(raiz) / 'fontes/x.json').exists())
                self.assertEqual(list((Path(raiz) / 'fontes').iterdir()), [])  # temporário apagado

    def test_matching_local_file_is_not_downloaded_again(self):
        dados = b'{"fonte": 1}'
        baixar, chamadas = baixador(b'nunca')
        with tempfile.TemporaryDirectory() as raiz:
            (Path(raiz) / 'fontes').mkdir()
            (Path(raiz) / 'fontes/x.json').write_bytes(dados)
            self.assertEqual(BA.recupera(entrada(dados), 'r', raiz, baixar), 'já estava')
            self.assertEqual(chamadas, [])

    def test_different_local_file_is_refused_and_kept(self):
        local = b'{"geometria": "nova"}'
        baixar, chamadas = baixador(b'{"fonte": 1}')
        with tempfile.TemporaryDirectory() as raiz:
            (Path(raiz) / 'fontes').mkdir()
            (Path(raiz) / 'fontes/x.json').write_bytes(local)
            with self.assertRaisesRegex(BA.Recusado, 'não será sobrescrito'):
                BA.recupera(entrada(b'{"fonte": 1}'), 'r', raiz, baixar)
            self.assertEqual((Path(raiz) / 'fontes/x.json').read_bytes(), local)
            self.assertEqual(chamadas, [])

    def test_check_mode_confirms_the_versioned_files(self):
        self.assertEqual(BA.main(['--conferir']), 0)


if __name__ == '__main__':
    unittest.main()
