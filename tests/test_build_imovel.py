"""Build imutavel de um imovel (B2): o ID e o conteudo, e o tour muda de pasta sem quebrar.

O build mora em `publicacao/builds/<imovel>/<build>/`, com
`<build> = sha256(tour.html + maquete.html)[:12]`. Estes testes nao montam a cidade:
travam o contrato em volta da montagem -- o ID, o prefixo dos tiles de quintal e a
cabeca do tour.
"""
import hashlib
import json
import re
import runpy
import shutil
import subprocess
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


class VitrineTests(unittest.TestCase):
    """O tour e a maquete do build levam o vitrine_ao_vivo.js, chamado com o slug do imovel."""

    def test_script_goes_before_the_last_body_close_with_the_slug(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'tour.html'
            p.write_text('<html><body><p>a</p><script>"</body>"</script></body></html>', encoding='utf-8')
            B['com_vitrine'](p, 'monte-dos-cedros-37')
            html = p.read_text(encoding='utf-8')
            self.assertIn('function vitrineAoVivo(', html)
            self.assertIn('vitrineAoVivo("monte-dos-cedros-37");\n</script>\n</body></html>', html)
            self.assertEqual(html.count('vitrineAoVivo("'), 1)

    def test_page_without_body_close_gets_the_script_at_the_end(self):
        # O tour que o montar.py gera nao abre nem fecha <body> (o navegador cria os dois): o script
        # vai no fim do documento, que tambem e depois do que a pagina monta. Antes disso, o build de
        # todo tour falhava aqui (20/10/2026).
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'tour.html'
            p.write_text('<meta charset="utf-8">\n<div id="ficha"></div>\n<script>boot();</script>\n', encoding='utf-8')
            B['com_vitrine'](p, 'x')
            html = p.read_text(encoding='utf-8')
            self.assertTrue(html.startswith('<meta charset="utf-8">\n<div id="ficha"></div>\n<script>boot();</script>\n<script>\n'))
            self.assertTrue(html.endswith('vitrineAoVivo("x");\n</script>\n'))
            self.assertEqual(html.count('vitrineAoVivo("'), 1)

    def test_pointer_call_carries_the_destination(self):
        self.assertIn('vitrineAoVivo("x", "/b/x/abc/tour.html");', B['script_vitrine']('x', '/b/x/abc/tour.html'))

    def test_the_motor_page_gets_it_as_a_module_after_casa_js(self):
        # Como modulo, ela so roda depois do casa.js, que preenche a ficha (#fPreco); como script comum
        # ela podia procurar o preco antes de ele existir.
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'maquete.html'
            shutil.copyfile(RAIZ / 'maquete/motor/maquete.html', p)
            B['com_vitrine'](p, 'x', modulo=True)
            html = p.read_text(encoding='utf-8')
            casa = html.index('<script type="module" src="casa.js"></script>')
            vitrine = html.index('<script type="module">\n')
            self.assertLess(casa, vitrine)
            self.assertTrue(html.endswith('vitrineAoVivo("x");\n</script>\n'))
            self.assertEqual(html.count('<script>'), 0, 'nenhum script comum')


class MaqueteGeralBuildTests(unittest.TestCase):
    """MG-5: o build schema 2 e a pasta do motor com os dados do imovel."""

    def test_the_v2_id_is_the_content_of_every_file(self):
        shas = {'tour.html': 'a' * 64, 'dados/maquete.js': 'b' * 64, 'casa.js': 'c' * 64}
        lista = 'casa.js %s\ndados/maquete.js %s\ntour.html %s\n' % ('c' * 64, 'b' * 64, 'a' * 64)
        self.assertEqual(B['build_id_v2'](shas), hashlib.sha256(lista.encode()).hexdigest()[:12])
        self.assertEqual(B['build_id_v2'](dict(reversed(list(shas.items())))), B['build_id_v2'](shas),
                         'a ordem em que os arquivos aparecem nao muda o build')
        for mudanca in ({'casa.js': 'd' * 64}, {'outro.js': 'e' * 64}):
            self.assertNotEqual(B['build_id_v2']({**shas, **mudanca}), B['build_id_v2'](shas))
        sem_um = dict(shas)
        del sem_um['casa.js']
        self.assertNotEqual(B['build_id_v2'](sem_um), B['build_id_v2'](shas))

    def test_the_build_carries_what_the_motor_pages_load_and_nothing_else(self):
        if not (RAIZ / 'maquete/motor/node_modules/three').is_dir():
            self.skipTest('sem npm ci --prefix maquete/motor')
        motor = B['arquivos_do_motor']()
        esperado = {'maquete.html', 'casa.js', 'planta-desenho.js', 'floor-plan.js', 'edicoes.js', 'prova-rgbm.html',
                    'renderer.js', 'decodificar-worker.js', 'material-rgbm.js', 'ambiente.js',
                    'assets-ambiente/manifest.json', 'assets-ambiente/ambiente.f16.gz',
                    'node_modules/three/build/three.webgpu.js', 'node_modules/three/build/three.core.js',
                    'node_modules/three/build/three.tsl.js', 'node_modules/three/examples/jsm/controls/OrbitControls.js'}
        self.assertLessEqual(esperado, set(motor))
        # nem os dados (vem do exportador), nem teste, gerador, conferencia ou a pagina do predio
        self.assertEqual([n for n in motor if n.startswith(('dados/', 'pacote-casa/')) or n.startswith(('test_', 'qa_', 'gerar_'))
                          or n in ('viewer.js', 'interior.html', 'README.md', 'package.json')], [])
        self.assertTrue(all(p.is_file() and p.is_relative_to(RAIZ / 'maquete/motor') for p in motor.values()))

    def test_text_goes_with_lf_and_binary_as_is(self):
        with tempfile.TemporaryDirectory() as tmp:
            texto, binario = Path(tmp) / 'a.js', Path(tmp) / 'b.gz'
            texto.write_bytes(b'a\r\nb\n')
            binario.write_bytes(b'\x1f\x8b\r\n')
            self.assertEqual(B['bytes_publicados'](texto), b'a\nb\n')
            self.assertEqual(B['bytes_publicados'](binario), b'\x1f\x8b\r\n')


class NaoPublicarTests(unittest.TestCase):
    # mirra-114: origem e autorizacao dos dados nao confirmadas (dados-privados.md). A trava e no
    # build, antes de qualquer leitura: sem build nao ha preview nem live.
    def test_blocked_unit_is_refused_before_anything_is_built(self):
        with tempfile.TemporaryDirectory() as pasta:
            with self.assertRaisesRegex(ValueError, 'mirra-114 nao se publica ate confirmar a origem'):
                B['construir']('mirra-114', builds=Path(pasta))
            self.assertEqual(list(Path(pasta).iterdir()), [])

    def test_only_mirra_is_blocked(self):
        # Nenhum imovel do piloto fica travado por engano.
        piloto = json.loads((RAIZ / 'tasks/v1.0/piloto.json').read_text(encoding='utf-8'))
        self.assertEqual(set(B['NAO_PUBLICAR']), {'mirra-114'})
        self.assertFalse(set(piloto['imoveis']) & set(B['NAO_PUBLICAR']))


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


def _url_semeada(busca, ancora):
    """Roda o <script> do _snippet() com location/history falsos; devolve o replaceState()."""
    if not shutil.which('node'):
        raise unittest.SkipTest('sem node neste ambiente')
    script = re.search(r'<script>(.*?)</script>', imovel._snippet(-22.0, -47.9, '/', 'x'), re.S).group(1)
    js = ("const vm=require('vm');let u=null;"
          "const ctx={location:{pathname:'/b/x/y/tour.html',search:%s,hash:%s},URLSearchParams,"
          "history:{replaceState:(a,b,c)=>{u=c}},addEventListener:()=>{}};"
          "vm.createContext(ctx);vm.runInContext(%s,ctx);process.stdout.write(JSON.stringify(u))") % (
        json.dumps(busca), json.dumps(ancora), json.dumps(script))
    return json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)


class RelocatableTourTests(unittest.TestCase):
    def test_relocated_tour_keeps_its_tiles_and_the_url_fragment(self):
        # O tour enquadra o lote pondo ?em=... na URL; a ancora (#...) de quem chegou fica.
        semeada = _url_semeada('?teste=1', '#x')
        self.assertTrue(semeada.startswith('/b/x/y/tour.html?teste=1&em='), semeada)
        self.assertTrue(semeada.endswith('#x'), semeada)
        self.assertFalse(_url_semeada('', '').endswith('#'))
        self.assertIsNone(_url_semeada('?em=-22,-47', '#x'), 'com posicao no link, nada e reescrito')
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
