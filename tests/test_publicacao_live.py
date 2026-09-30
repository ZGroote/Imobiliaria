"""Snapshot do site no ar (B4a): promover e reverter, 100% local.

O `site/` do live e remontado do zero a cada operacao, a partir de um estado explicito:

    index.html  404.html  estado.json
    imovel/<id>  maquete/<id>          ponteiros sem extensao
    b/<id>/<atual>/  b/<id>/<anterior>/
    quintais/<hash>/*.bin

Builds e tiles de mentira numa pasta temporaria; nada de rede nem de Firebase. Os scripts
dos ponteiros e do 404 sao executados de verdade no Node, com um `location` falso.
"""
import hashlib
import json
import re
import runpy
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
P = runpy.run_path(str(RAIZ / 'pipeline/publicar_imovel.py'))
SITE_PUBLICO = 'https://imobilaria-deccb-imoveis.web.app'
VAZIO = {'schema': 1, 'imoveis': {}}
H1, H2 = 'a1b2c3d4e5f6', 'f6e5d4c3b2a1'     # conjuntos de tiles: o de hoje e o de depois


def _sha(b):
    return hashlib.sha256(b).hexdigest()


def _destino(html, caminho, busca='', ancora=''):
    """Roda os <script> da pagina com um `location` falso; devolve o que foi pro replace()."""
    if not shutil.which('node'):
        raise unittest.SkipTest('sem node neste ambiente')
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    js = ("const vm=require('vm');let d=null;"
          "const ctx={location:{pathname:%s,search:%s,hash:%s,replace:u=>{d=u}}};"
          "vm.createContext(ctx);for(const s of %s)vm.runInContext(s,ctx);"
          "process.stdout.write(JSON.stringify(d))") % (
        json.dumps(caminho), json.dumps(busca), json.dumps(ancora), json.dumps(scripts))
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


class Cenario:
    """Imovel x com tres builds (A, B, C -- so o C tem imagem) e imovel y com um."""

    def __init__(self, tmp):
        self.raiz = Path(tmp)
        self.builds = self.raiz / 'builds'
        self.A, self.B, self.C = (self.cria('x', 1), self.cria('x', 2),
                                  self.cria('x', 3, imagem='https://exemplo.web.app/x.jpg'))
        self.Y = self.cria('y', 1)
        self.tiles = self.raiz / 'mapa'
        self.terrenos = self.raiz / 'terrenos-manifesto.json'
        self.poe_tiles(H1, ('0_0', '-1_2'))
        self.site = self.raiz / 'publicacao' / 'site'

    def poe_tiles(self, h, chaves):
        """Um conjunto novo de tiles; o manifesto dos terrenos passa a apontar para ele."""
        (self.tiles / 'quintais' / h).mkdir(parents=True)
        for k in chaves:
            (self.tiles / 'quintais' / h / (k + '.bin')).write_bytes(b'tile ' + (h + k).encode())
        self.terrenos.write_text(json.dumps({'prefix': './quintais/%s/' % h, 'keys': list(chaves)}),
                                 encoding='utf-8')

    def cria(self, imovel, n, imagem=None, tiles='/quintais/%s/' % H1):
        cabeca = ('<title>%s v%d</title>\n<meta name="description" content="descricao %s v%d">\n'
                  '<meta property="og:type" content="website">\n<meta property="og:title" content="%s v%d">\n'
                  '<meta property="og:url" content="%s/imovel/%s">\n') % (
            imovel, n, imovel, n, imovel, n, SITE_PUBLICO, imovel)
        if imagem:
            cabeca += '<meta property="og:image" content="%s">\n' % imagem
        tour = ('﻿<meta charset="utf-8">\n' + cabeca +
                '<script>/* a cidade inteira */</script>\n<canvas id="c"></canvas>\n').encode('utf-8')
        maquete = ('<title>maquete %s v%d</title><a id="verMapa" href="tour.html">Ver mapa</a>\n'
                   % (imovel, n)).encode('utf-8')
        build = _sha(tour + maquete)[:12]
        pasta = self.builds / imovel / build
        pasta.mkdir(parents=True)
        (pasta / 'tour.html').write_bytes(tour)
        (pasta / 'maquete.html').write_bytes(maquete)
        manifesto = {'schema': 1, 'imovel': imovel, 'build': build, 'tiles': tiles,
                     'arquivos': {'tour.html': {'bytes': len(tour), 'sha256': _sha(tour)},
                                  'maquete.html': {'bytes': len(maquete), 'sha256': _sha(maquete)}}}
        (pasta / 'manifest.json').write_text(json.dumps(manifesto, indent=2) + '\n', encoding='utf-8')
        return build

    def caminhos(self):
        return dict(builds=self.builds, tiles_origem=self.tiles, terrenos=self.terrenos, site=self.site)

    def aprovado(self, imovel, build):
        """O que o preview registra: o sha256 do manifest.json deste artefato."""
        return _sha((self.builds / imovel / build / 'manifest.json').read_bytes())

    def rematerializa(self, imovel, build):
        """O mesmo build gerado de novo: tour e maquete iguais, manifest com outra proveniencia."""
        m = self.builds / imovel / build / 'manifest.json'
        d = json.loads(m.read_text(encoding='utf-8'))
        d['gerado_em'] = 'outra vez'
        m.write_text(json.dumps(d, indent=2) + '\n', encoding='utf-8')

    def promove(self, imovel, build, estado, aprovado=None):
        return P['montar_live']('promover', imovel, build, estado,
                                manifest_aprovado=aprovado or self.aprovado(imovel, build), **self.caminhos())

    def reverte(self, imovel, estado):
        return P['montar_live']('reverter', imovel, None, estado, **self.caminhos())

    def estado(self):
        return json.loads((self.site / 'estado.json').read_text(encoding='utf-8'))

    def arvore(self):
        return sorted(p.relative_to(self.site).as_posix() for p in self.site.rglob('*') if p.is_file())

    def bytes_de(self, prefixos):
        return {a: (self.site / a).read_bytes() for a in self.arvore() if a.startswith(prefixos)}

    def texto(self, a):
        return (self.site / a).read_text(encoding='utf-8')

    def sobras(self):
        return sorted(p.name for p in self.site.parent.iterdir() if p.name != 'site')

    def no_ar(self, imovel):
        i = self.estado()['imoveis'][imovel]
        return i['atual'], i['anterior']


def _b(imovel, build):
    return ['b/%s/%s/%s' % (imovel, build, n) for n in ('tour.html', 'maquete.html', 'manifest.json')]


TILES = ['quintais/%s/-1_2.bin' % H1, 'quintais/%s/0_0.bin' % H1]


class LivePromotionTests(unittest.TestCase):
    def test_first_promotion_has_no_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            self.assertEqual(c.no_ar('x'), (c.A, None))
            self.assertEqual(c.arvore(), sorted(['404.html', 'estado.json', 'index.html', 'imovel/x',
                                                 'maquete/x'] + _b('x', c.A) + TILES))
            self.assertEqual(c.sobras(), [])

    def test_second_promotion_moves_current_to_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            c.promove('x', c.B, c.estado())
            self.assertEqual(c.no_ar('x'), (c.B, c.A))
            self.assertLessEqual(set(_b('x', c.A) + _b('x', c.B)), set(c.arvore()))

    def test_third_promotion_keeps_only_current_and_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            c.promove('x', c.B, c.estado())
            c.promove('x', c.C, c.estado())
            self.assertEqual(c.no_ar('x'), (c.C, c.B))
            self.assertEqual(sorted(a for a in c.arvore() if a.startswith('b/')),
                             sorted(_b('x', c.C) + _b('x', c.B)), 'o A sai do site')

    def test_rollback_swaps_current_and_previous_without_rebuilding(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            builds = {p: p.read_bytes() for p in c.builds.rglob('*') if p.is_file()}
            c.promove('x', c.A, VAZIO)
            c.promove('x', c.B, c.estado())
            c.reverte('x', c.estado())
            self.assertEqual(c.no_ar('x'), (c.A, c.B))
            self.assertEqual(_destino(c.texto('imovel/x'), '/imovel/x'), '/b/x/%s/tour.html' % c.A)
            for a in _b('x', c.A):
                self.assertEqual((c.site / a).read_bytes(),
                                 (c.builds / 'x' / c.A / a.rsplit('/', 1)[1]).read_bytes(), a)
            # nada foi gerado de novo: os builds continuam exatamente como estavam
            self.assertEqual({p: p.read_bytes() for p in c.builds.rglob('*') if p.is_file()}, builds)

            # Os quintais mudam: o build novo usa outro conjunto de tiles, e o build de rollback
            # continua precisando do dele -- que o manifesto dos terrenos de hoje nem cita.
            c.poe_tiles(H2, ('0_0',))
            D = c.cria('x', 4, tiles='/quintais/%s/' % H2)
            c.promove('x', D, c.estado())
            self.assertEqual(c.no_ar('x'), (D, c.A))
            quintais = sorted(a for a in c.arvore() if a.startswith('quintais/'))
            self.assertEqual(quintais, sorted(TILES + ['quintais/%s/0_0.bin' % H2]), 'os dois conjuntos')
            c.reverte('x', c.estado())
            self.assertEqual(c.no_ar('x'), (c.A, D))
            self.assertEqual(_destino(c.texto('imovel/x'), '/imovel/x'), '/b/x/%s/tour.html' % c.A)
            self.assertEqual(sorted(a for a in c.arvore() if a.startswith('quintais/')), quintais)
            # so /quintais/<12hex>/ entra: o conjunto e content-addressed
            fora = c.cria('x', 5, tiles='/quintais/../fora/')
            with self.assertRaises(ValueError):
                c.promove('x', fora, c.estado())
            # O conjunto antigo e content-addressed: ou so tiles validos, ou a operacao aborta.
            antes, velho = c.bytes_de(('',)), c.tiles / 'quintais' / H1
            for nome, poe, tira in (
                    ('lixo.txt', lambda: (velho / 'lixo.txt').write_bytes(b'x'),
                     lambda: (velho / 'lixo.txt').unlink()),
                    ('subpasta', lambda: (velho / 'sub').mkdir(), lambda: (velho / 'sub').rmdir()),
                    ('tile vazio', lambda: (velho / '9_9.bin').write_bytes(b''),
                     lambda: (velho / '9_9.bin').unlink())):
                with self.subTest(nome):
                    poe()
                    with self.assertRaises(ValueError):
                        c.reverte('x', c.estado())      # D volta a atual; A (tiles H1) fica anterior
                    self.assertEqual(c.bytes_de(('',)), antes, 'o site anterior continua inteiro')
                    self.assertEqual(c.sobras(), [])
                    tira()

    def test_rollback_without_previous_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            antes = c.bytes_de(('',))
            for imovel in ('x', 'y'):          # sem anterior; e imovel que nem esta no ar
                with self.subTest(imovel), self.assertRaises(ValueError):
                    c.reverte(imovel, c.estado())
            self.assertEqual(c.bytes_de(('',)), antes)
            self.assertEqual(c.sobras(), [])

    def test_promoting_x_keeps_y_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('y', c.Y, VAZIO)
            y = c.bytes_de(('b/y/', 'imovel/y', 'maquete/y'))
            y_estado = c.estado()['imoveis']['y']
            c.promove('x', c.A, c.estado())
            self.assertEqual(c.bytes_de(('b/y/', 'imovel/y', 'maquete/y')), y)
            self.assertEqual(c.estado()['imoveis']['y'], y_estado, 'o registro de y nao muda')
            indice = c.texto('index.html')
            self.assertIn('href="/imovel/x"', indice)
            self.assertIn('href="/imovel/y"', indice)

    def test_a_build_required_by_the_state_but_missing_locally_aborts(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            antes = c.bytes_de(('',))
            estado = c.estado()
            estado['imoveis']['y'] = {'atual': '0123456789ab', 'anterior': None, 'em': 'ontem'}
            with self.assertRaises(ValueError):
                c.promove('x', c.B, estado)
            self.assertEqual(c.bytes_de(('',)), antes, 'o site anterior continua inteiro')
            self.assertEqual(c.sobras(), [])

    def test_state_inventories_every_managed_file_but_itself(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('y', c.Y, VAZIO)
            c.promove('x', c.A, c.estado())
            c.promove('x', c.B, c.estado())
            arquivos = c.estado()['arquivos']
            self.assertEqual(sorted(arquivos), [a for a in c.arvore() if a != 'estado.json'])
            for a, h in arquivos.items():
                self.assertEqual(h, _sha((c.site / a).read_bytes()), a)
            self.assertFalse([a for a in arquivos if a.startswith(('__/', '/'))],
                             '/__/** e do Firebase, nao nosso')

    def test_pointers_go_to_the_current_build_keeping_search_and_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            for tipo, alvo in (('imovel', 'tour.html'), ('maquete', 'maquete.html')):
                with self.subTest(tipo):
                    html = c.texto('%s/x' % tipo)
                    self.assertEqual(_destino(html, '/%s/x' % tipo, '?teste=1', '#x'),
                                     '/b/x/%s/%s?teste=1#x' % (c.A, alvo))
                    # metadados do build aprovado, nao do cadastro; og:url e o ponteiro estavel
                    self.assertIn('<title>x v1</title>', html)
                    self.assertIn('<meta property="og:url" content="%s/%s/x">' % (SITE_PUBLICO, tipo), html)
                    self.assertEqual(html.count('og:url'), 1)
                    self.assertNotIn('og:image', html, 'o build A nao tem imagem')
                    self.assertIn('<noscript><a href="/b/x/%s/%s">' % (c.A, alvo), html)
            c.promove('x', c.C, c.estado())
            self.assertIn('<meta property="og:image" content="https://exemplo.web.app/x.jpg">',
                          c.texto('imovel/x'), 'a imagem do build aprovado viaja para o ponteiro')

    def test_promotion_requires_the_exact_approved_artifact(self):
        # Build once, promote the exact artifact: mesmo build, tour e maquete iguais, mas um
        # manifest de outra materializacao nao e o que foi aprovado no preview.
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            aprovado = c.aprovado('x', c.A)
            c.rematerializa('x', c.A)
            for nome, valor in (('manifest rematerializado', aprovado), ('sem aprovacao', None)):
                with self.subTest(nome), self.assertRaises(ValueError):
                    P['montar_live']('promover', 'x', c.A, VAZIO, manifest_aprovado=valor, **c.caminhos())
                self.assertFalse(c.site.exists(), 'nada foi montado')
            c.promove('x', c.A, VAZIO, aprovado=c.aprovado('x', c.A))
            self.assertEqual(c.no_ar('x'), (c.A, None))

    def test_builds_already_live_must_match_the_state_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            c.promove('x', c.B, c.estado())                  # no ar: atual B, anterior A
            antes = c.bytes_de(('',))
            c.rematerializa('x', c.A)                        # a copia local de A deixa de ser a do ar
            for nome, op in (('reverter para A', lambda: c.reverte('x', c.estado())),
                             ('promover y com A ainda no ar', lambda: c.promove('y', c.Y, c.estado()))):
                with self.subTest(nome), self.assertRaises(ValueError):
                    op()
                self.assertEqual(c.bytes_de(('',)), antes, 'o site anterior continua inteiro')
            self.assertEqual(c.sobras(), [])
            # promover C tira A do site: nada mais exige a copia local dele
            c.promove('x', c.C, c.estado())
            self.assertEqual(c.no_ar('x'), (c.C, c.B))

    def test_404_sends_old_build_links_to_the_pointer(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = Cenario(tmp)
            c.promove('x', c.A, VAZIO)
            html = c.texto('404.html')
            self.assertEqual(_destino(html, '/b/x/000000000000/tour.html', '?q=1', '#a'), '/imovel/x?q=1#a')
            self.assertIsNone(_destino(html, '/qualquer/outra'), 'fora de /b/ nao redireciona')
            self.assertIn('href="/"', html)


class NaoPublicarTests(unittest.TestCase):
    """Um build antigo valido nao autoriza a publicacao de uma unidade bloqueada."""

    def preparar(self, tmp):
        c = Cenario(tmp)
        c.promove('x', c.A, VAZIO)
        bloqueado = c.cria('mirra-114', 1)
        return c, bloqueado

    def recusa_sem_alterar_site(self, c, operacao):
        antes = c.bytes_de(('',))
        with self.assertRaisesRegex(ValueError, 'mirra-114 nao se publica ate confirmar a origem'):
            operacao()
        self.assertEqual(c.bytes_de(('',)), antes)
        self.assertEqual(c.sobras(), [])

    def estado_legado(self, c, atual, anterior=None):
        estado = c.estado()
        estado['imoveis']['mirra-114'] = {'atual': atual, 'anterior': anterior}
        for build in (atual, anterior):
            if build:
                for nome in ('tour.html', 'maquete.html', 'manifest.json'):
                    caminho = 'b/mirra-114/%s/%s' % (build, nome)
                    estado['arquivos'][caminho] = _sha((c.builds / 'mirra-114' / build / nome).read_bytes())
        return estado

    def test_blocked_existing_build_cannot_enter_preview(self):
        with tempfile.TemporaryDirectory() as tmp:
            c, build = self.preparar(tmp)
            self.recusa_sem_alterar_site(c, lambda: P['montar_preview']('mirra-114', build, **c.caminhos()))

    def test_blocked_existing_build_cannot_be_promoted_even_with_matching_approval(self):
        with tempfile.TemporaryDirectory() as tmp:
            c, build = self.preparar(tmp)
            self.recusa_sem_alterar_site(c, lambda: c.promove('mirra-114', build, c.estado()))

    def test_rollback_cannot_reintroduce_blocked_unit(self):
        with tempfile.TemporaryDirectory() as tmp:
            c, build = self.preparar(tmp)
            anterior = c.cria('mirra-114', 2)
            estado = self.estado_legado(c, build, anterior)
            self.recusa_sem_alterar_site(c, lambda: c.reverte('mirra-114', estado))

    def test_other_unit_promotion_cannot_carry_blocked_build_from_old_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            c, build = self.preparar(tmp)
            estado = self.estado_legado(c, build)
            self.recusa_sem_alterar_site(c, lambda: c.promove('y', c.Y, estado))


if __name__ == '__main__':
    unittest.main()
