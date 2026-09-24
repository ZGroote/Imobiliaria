"""Build imutavel de um imovel (B2): o ID e o conteudo, e o tour muda de pasta sem quebrar.

O build mora em `publicacao/builds/<imovel>/<build>/`, com
`<build> = sha256(tour.html + maquete.html)[:12]`. Estes testes nao montam a cidade:
travam o contrato em volta da montagem -- o ID, o prefixo dos tiles de quintal e a
cabeca do tour.
"""
import hashlib
import runpy
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from pipeline import imovel  # noqa: E402

B = runpy.run_path(str(RAIZ / 'pipeline/build_imovel.py'))
URL = 'https://imobilaria-deccb-imoveis.web.app/imovel/monte-dos-cedros-37'
UNIDADE = {'id': 'monte-dos-cedros-37', 'ficha': {'empreendimento': 'Monte dos Cedros'}}


class BuildIdTests(unittest.TestCase):
    def test_id_is_12_hex_and_deterministic(self):
        a = B['build_id'](b'<tour>', b'<maquete>')
        self.assertRegex(a, r'^[0-9a-f]{12}$')
        self.assertEqual(a, B['build_id'](b'<tour>', b'<maquete>'))
        self.assertEqual(a, hashlib.sha256(b'<tour><maquete>').hexdigest()[:12])

    def test_changing_the_tour_changes_the_id(self):
        self.assertNotEqual(B['build_id'](b'<tour>', b'<maquete>'),
                            B['build_id'](b'<tour 2>', b'<maquete>'))

    def test_changing_the_miniature_changes_the_id(self):
        self.assertNotEqual(B['build_id'](b'<tour>', b'<maquete>'),
                            B['build_id'](b'<tour>', b'<maquete 2>'))


class TilePrefixTests(unittest.TestCase):
    # O tour do build nao mora ao lado dos tiles: servido em /imovel/<id>, o prefixo
    # relativo do mapa buscaria /imovel/quintais/..., que nao existe.
    def test_map_relative_prefix_becomes_site_absolute(self):
        self.assertEqual(B['prefixo_publico']('./quintais/d9ef5bf4b34f/'),
                         '/quintais/d9ef5bf4b34f/')

    def test_absolute_or_parent_prefix_is_rejected(self):
        for ruim in ('/quintais/d9ef5bf4b34f/', '../quintais/d9ef5bf4b34f/',
                     './quintais/../../fora/', 'C:/quintais/', 'https://outro.site/quintais/',
                     '', './'):
            with self.subTest(prefixo=ruim), self.assertRaises(ValueError):
                B['prefixo_publico'](ruim)


class HeadTests(unittest.TestCase):
    def test_canonical_url_gives_og_url_and_no_invented_og_image(self):
        cabeca = imovel._cabeca(UNIDADE, '', url=URL)
        self.assertIn('<meta property="og:url" content="%s">' % URL, cabeca)
        self.assertNotIn('og:image', cabeca)
        # N4: a `base` sozinha tambem nao fabrica mais preview-<id>.jpg...
        self.assertNotIn('og:image', imovel._cabeca(UNIDADE, 'https://imobilaria-deccb.web.app/mapa'))
        # ...e imagem fornecida de verdade entra.
        self.assertIn('<meta property="og:image" content="https://x.web.app/p.jpg">',
                      imovel._cabeca(UNIDADE, '', url=URL, imagem='https://x.web.app/p.jpg'))


if __name__ == '__main__':
    unittest.main()
