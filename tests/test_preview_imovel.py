"""Montagem do preview de um imovel (B3a): `publicacao/site/` e exatamente o proximo deploy.

No preview o site leva so o build conferido e os tiles de quintal:

    site/b/<id>/<build>/{tour.html, maquete.html, manifest.json}
    site/quintais/<hash>/*.bin

Estes testes usam um build e tiles de mentira numa pasta temporaria: travam o contrato
da montagem sem montar a cidade.
"""
import hashlib
import json
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest import mock

RAIZ = Path(__file__).resolve().parents[1]
P = runpy.run_path(str(RAIZ / 'pipeline/publicar_imovel.py'))
ID = 'monte-dos-cedros-37'


def _sha(b):
    return hashlib.sha256(b).hexdigest()


class Cenario:
    """builds/<ID>/<build>/, tiles em mapa/quintais/abc/ e o manifesto dos terrenos."""

    def __init__(self, tmp):
        self.raiz = Path(tmp)
        tour, maquete = b'<tour>\n', b'<maquete href="tour.html">\n'
        self.build = _sha(tour + maquete)[:12]
        self.origem = self.raiz / 'builds' / ID / self.build
        self.origem.mkdir(parents=True)
        (self.origem / 'tour.html').write_bytes(tour)
        (self.origem / 'maquete.html').write_bytes(maquete)
        manifesto = {'schema': 1, 'imovel': ID, 'build': self.build, 'tiles': '/quintais/abc/',
                     'arquivos': {'tour.html': {'bytes': len(tour), 'sha256': _sha(tour)},
                                  'maquete.html': {'bytes': len(maquete), 'sha256': _sha(maquete)}}}
        (self.origem / 'manifest.json').write_text(json.dumps(manifesto, indent=2) + '\n', encoding='utf-8')
        self.tiles = self.raiz / 'mapa'
        (self.tiles / 'quintais/abc').mkdir(parents=True)
        for k in ('0_0', '-1_2'):
            (self.tiles / 'quintais/abc' / (k + '.bin')).write_bytes(b'tile ' + k.encode())
        self.terrenos = self.raiz / 'terrenos-manifesto.json'
        self.terrenos.write_text(json.dumps({'prefix': './quintais/abc/', 'keys': ['0_0', '-1_2']}),
                                 encoding='utf-8')
        self.site = self.raiz / 'publicacao' / 'site'

    def monta(self):
        return P['montar_preview'](ID, self.build, builds=self.raiz / 'builds', tiles_origem=self.tiles,
                                   terrenos=self.terrenos, site=self.site)

    def arvore(self):
        return sorted(p.relative_to(self.site).as_posix() for p in self.site.rglob('*') if p.is_file())

    def sobras(self):
        return sorted(p.name for p in self.site.parent.iterdir() if p.name != 'site')


class PreviewTests(unittest.TestCase):
    def test_preview_is_exactly_the_checked_build_and_the_tiles(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            r = c.monta()
            b = 'b/%s/%s/' % (ID, c.build)
            self.assertEqual(c.arvore(), sorted([b + 'tour.html', b + 'maquete.html', b + 'manifest.json',
                                                 'quintais/abc/0_0.bin', 'quintais/abc/-1_2.bin']))
            for n in ('tour.html', 'maquete.html', 'manifest.json'):
                self.assertEqual((c.site / b / n).read_bytes(), (c.origem / n).read_bytes(), n)
            self.assertEqual((r['build'], r['tour'], r['tiles']),
                             (c.build, '/' + b + 'tour.html', '/quintais/abc/'))
            self.assertEqual(c.sobras(), [], 'nenhuma pasta temporaria fica para tras')

    def test_site_is_replaced_whole_never_updated_in_place(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            (c.site / 'b/outro-imovel/aaaaaaaaaaaa').mkdir(parents=True)
            (c.site / 'b/outro-imovel/aaaaaaaaaaaa/tour.html').write_bytes(b'velho')
            (c.site / 'index.html').write_bytes(b'lixo de uma montagem anterior')
            c.monta()
            self.assertFalse(any('outro-imovel' in a or a == 'index.html' for a in c.arvore()), c.arvore())
            self.assertEqual(c.sobras(), [])

    def test_a_build_that_does_not_match_its_manifest_is_refused(self):
        estragos = {
            'tour alterado': lambda c: (c.origem / 'tour.html').write_bytes(b'<outro tour>\n'),
            'manifest de outro imovel': lambda c: (c.origem / 'manifest.json').write_text(
                (c.origem / 'manifest.json').read_text(encoding='utf-8').replace(ID, 'outro-1'),
                encoding='utf-8'),
            'tiles de outro conjunto': lambda c: c.terrenos.write_text(
                json.dumps({'prefix': './quintais/xyz/', 'keys': ['0_0']}), encoding='utf-8'),
        }
        for nome, estraga in estragos.items():
            with self.subTest(nome), tempfile.TemporaryDirectory() as tmp:
                c = Cenario(tmp)
                c.monta()
                antes = c.arvore()
                estraga(c)
                with self.assertRaises(ValueError):
                    c.monta()
                self.assertEqual(c.arvore(), antes, 'o site anterior continua inteiro')
                self.assertEqual(c.sobras(), [])

    def test_if_the_new_site_fails_to_enter_the_previous_one_comes_back(self):
        # A janela da troca: o site anterior ja saiu de lado e o novo nao consegue entrar.
        # Ele tem que voltar, e nenhuma pasta temporaria pode ficar para tras.
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.monta()
            # marca que so o site ANTERIOR tem: se ela sumir, quem ficou foi o novo (ou nada)
            (c.site / 'marca-do-anterior').write_bytes(b'x')
            antes = {a: (c.site / a).read_bytes() for a in c.arvore()}
            renomeia = Path.rename

            def falha_na_entrada(origem, alvo):
                if Path(alvo) == c.site and not origem.name.startswith('.site-anterior-'):
                    raise OSError('falha injetada: o novo site nao entra')
                return renomeia(origem, alvo)

            with mock.patch.object(Path, 'rename', falha_na_entrada), self.assertRaises(OSError):
                c.monta()
            self.assertEqual({a: (c.site / a).read_bytes() for a in c.arvore()}, antes)
            self.assertEqual(c.sobras(), [])

    def test_a_missing_or_empty_tile_is_refused(self):
        for nome, estraga in {'ausente': Path.unlink,
                              'vazio': lambda p: p.write_bytes(b'')}.items():
            with self.subTest(nome), tempfile.TemporaryDirectory() as tmp:
                c = Cenario(tmp)
                estraga(c.tiles / 'quintais/abc/-1_2.bin')
                with self.assertRaises(ValueError):
                    c.monta()
                self.assertFalse(c.site.exists(), 'sem montagem valida, nao ha site')
                self.assertEqual(c.sobras(), [])


if __name__ == '__main__':
    unittest.main()
