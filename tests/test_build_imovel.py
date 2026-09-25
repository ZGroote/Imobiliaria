"""Build imutavel de um imovel (B2): o ID e o conteudo, e o tour muda de pasta sem quebrar.

O build mora em `publicacao/builds/<imovel>/<build>/`, com
`<build> = sha256(tour.html + maquete.html)[:12]`. Estes testes nao montam a cidade:
travam o contrato em volta da montagem -- o ID, o prefixo dos tiles de quintal e a
cabeca do tour.
"""
import hashlib
import json
import runpy
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from pipeline import imovel, recorte  # noqa: E402

B = runpy.run_path(str(RAIZ / 'pipeline/build_imovel.py'))
URL = 'https://imobilaria-deccb-imoveis.web.app/imovel/monte-dos-cedros-37'
UNIDADE = {'id': 'monte-dos-cedros-37', 'ficha': {'empreendimento': 'Monte dos Cedros'}}


class BuildIdTests(unittest.TestCase):
    def test_id_is_12_hex_and_deterministic(self):
        a = B['build_id'](b'<tour>', b'<maquete>')
        self.assertRegex(a, r'^[0-9a-f]{12}$')
        self.assertEqual(a, B['build_id'](b'<tour>', b'<maquete>'))
        self.assertEqual(a, hashlib.sha256(b'<tour><maquete>').hexdigest()[:12])
        # O ID nao pode depender da plataforma: os HTMLs viram LF antes do hash, e
        # canonicalizar de novo nao muda nada.
        with tempfile.TemporaryDirectory() as tmp:
            html = Path(tmp) / 'tour.html'
            html.write_bytes(b'a\r\nb\rc\n')
            B['canonicaliza_html'](html)
            self.assertEqual(html.read_bytes(), b'a\nb\nc\n')
            B['canonicaliza_html'](html)
            self.assertEqual(html.read_bytes(), b'a\nb\nc\n')

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


class RelocatableTourTests(unittest.TestCase):
    def test_tile_prefix_is_rewritten_only_when_asked(self):
        pacote = json.dumps({'assets': [{'id': i} for i in range(recorte.EXTERIOR_EXATO)],
                             'placements': [],
                             'parcelTiles': {'prefix': './quintais/h/', 'size': 640,
                                             'keys': ['0_0', '9_9']}})
        novo = recorte.Recorte((0, 0), 100, prefixo_tiles='/quintais/h/').exteriorModels(pacote)
        # o filtro das chaves continua: so o tile que o raio alcanca fica
        self.assertEqual(json.loads(novo)['parcelTiles'],
                         {'prefix': '/quintais/h/', 'size': 640, 'keys': ['0_0']})
        velho = recorte.Recorte((0, 0), 100).exteriorModels(pacote)
        self.assertEqual(json.loads(velho)['parcelTiles']['prefix'], './quintais/h/')


class MiniatureSourcesTests(unittest.TestCase):
    # Fonte que determinou os bytes e ficou fora do manifesto e provenance falsa.
    def test_every_pilot_miniature_source_is_tracked(self):
        mini = 'v1.5/miniaturas/'
        esperado = {
            'monte-dos-cedros-37': {'pagina_maquete.py', 'padrao_atual.py',
                                    'padrao-atual/anterior/v2.html',
                                    'padrao-atual/piloto-v3/lightmap.rgbm.gz',
                                    'padrao-atual/exterior-v3/geometry-compact.json'},
            'wish-castanheiras-58': {'pagina_maquete.py', 'caminhada.js', 'castanheiras.js',
                                     'castanheiras_blender/modelo.json'},
            'monte-das-colinas-39': {'pagina_maquete.py', 'caminhada.js', 'castanheiras.js',
                                     'monte-das-colinas_blender/modelo.json'},
        }
        for uid, arquivos in esperado.items():
            fontes = B['fontes_da_maquete'](uid)
            with self.subTest(imovel=uid):
                rel = {Path(p).resolve().relative_to(RAIZ).as_posix() for p in fontes}
                self.assertLessEqual({mini + a for a in arquivos}, rel)
                # caminho errado viraria `null` no manifesto, calado
                self.assertEqual([p for p in fontes if not Path(p).is_file()], [])


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
