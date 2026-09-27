"""Fontes privadas fora do git: o manifesto é a autoridade, e o downloader não entrega arquivo errado.

tools/artefatos-privados.json diz onde cada fonte mora (repositório privado, release e asset), e
qual o tamanho e o sha256 dela. tools/baixar_artefatos.py recupera e confere. Estes testes não
usam rede: o download é trocado por uma função que escreve bytes escolhidos.

As fontes saíram do git em 27/09/2026, depois da recuperação provada ponta a ponta. O contrato
agora é o inverso de antes:

- os destinos não são versionados e estão no `.gitignore`, para que uma fonte recuperada não
  suje o status nem volte num commit por engano;
- o manifesto continua sendo a âncora.

Enquanto elas estavam no git, este teste conferia o manifesto contra o blob versionado; a prova
está em tasks/higiene-repositorio/arquivos-grandes.md.
"""
import hashlib
import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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

    def test_destinations_are_not_versioned_and_are_ignored(self):
        m = BA.carrega()
        self.assertEqual(len(m['artefatos']), 2)
        for a in m['artefatos']:
            with self.subTest(destino=a['destino']):
                ls = subprocess.run(['git', 'ls-files', '--', a['destino']], cwd=RAIZ,
                                    capture_output=True, text=True, check=True).stdout
                self.assertEqual(ls, '', 'a fonte voltou a ser versionada')
                ignorado = subprocess.run(['git', 'check-ignore', '-q', '--no-index', a['destino']],
                                          cwd=RAIZ)
                self.assertEqual(ignorado.returncode, 0, 'o destino não está no .gitignore')

    # Caminhos que escapam em POSIX, no Windows (drive absoluto, drive relativo, raiz do drive) e
    # por UNC. `C:/fora.json` é o que passava quando a validação era só POSIX.
    RUINS = ('../fora.json', '/abs/x.json', 'a/../../x.json', 'a\\b.json', '',
             'C:/fora.json', 'C:\\fora.json', 'C:fora.json', 'c:/Windows/x.json',
             '\\\\srv\\share\\x.json', '//srv/share/x.json', '\\fora.json')

    def test_destination_cannot_escape_the_repository(self):
        with tempfile.TemporaryDirectory() as t:
            for ruim in self.RUINS:
                p = Path(t) / 'm.json'
                p.write_text(json.dumps({'schema': 1, 'repositorio': 'r',
                                         'artefatos': [{'destino': ruim}]}), encoding='utf-8')
                with self.subTest(destino=ruim), self.assertRaises(BA.Recusado):
                    BA.carrega(p)

    def test_recovery_refuses_an_escaping_destination_before_downloading(self):
        baixar, chamadas = baixador(b'x')
        with tempfile.TemporaryDirectory() as raiz:
            for ruim in self.RUINS:
                with self.subTest(destino=ruim), self.assertRaises(BA.Recusado):
                    BA.recupera(entrada(b'x', destino=ruim), 'r', raiz, baixar)
        self.assertEqual(chamadas, [])

    def test_a_normal_destination_resolves_under_the_root(self):
        with tempfile.TemporaryDirectory() as raiz:
            alvo = BA.dentro(raiz, 'v1.5/miniaturas/padrao-atual/piloto-v3/source.json')
            self.assertIn(Path(raiz).resolve(), alvo.parents)


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

    def conferir_com(self, local):
        """`--conferir` num repositório falso: um manifesto e, se houver, o arquivo local."""
        dados = b'{"fonte": 1}'
        with tempfile.TemporaryDirectory() as raiz:
            manifesto = Path(raiz) / 'm.json'
            manifesto.write_text(json.dumps({'schema': 1, 'repositorio': 'r',
                                             'artefatos': [entrada(dados)]}), encoding='utf-8')
            if local is not None:
                (Path(raiz) / 'fontes').mkdir()
                (Path(raiz) / 'fontes/x.json').write_bytes(local)
            carrega = BA.carrega
            with mock.patch.object(BA, 'RAIZ', Path(raiz)), \
                 mock.patch.object(BA, 'carrega', lambda: carrega(manifesto)), \
                 mock.patch('sys.stdout', io.StringIO()), mock.patch('sys.stderr', io.StringIO()):
                return BA.main(['--conferir'])

    def test_check_mode_passes_only_for_the_exact_file(self):
        self.assertEqual(self.conferir_com(b'{"fonte": 1}'), 0)
        self.assertEqual(self.conferir_com(None), 1)               # ausente
        self.assertEqual(self.conferir_com(b'{"fonte": 2}'), 1)    # outro conteúdo


if __name__ == '__main__':
    unittest.main()
