import base64
import unittest
import zlib

from pipeline.build.blocos import DADOS
from pipeline.build.html import blocos, comprime, confere


def pagina(extras=()):
    """Uma página com a mesma forma da real: blocos de dado, três scripts sem
    atributo (three, earcut, app), um estilo e o carimbo do HUD."""
    partes = ['<html><head><style>body{margin:0}</style>',
              '<script type="application/json" id="__cidade">{"slug":"x"}</script>']
    for ident, _ in DADOS:
        partes.append('<script type="application/json" id="%s">[%s]</script>' % (ident, ident))
    for ident in extras:
        partes.append('<script type="application/json" id="%s">{"%s":1}</script>' % (ident, ident))
    partes += ['<script>/* three */ var THREE={r:168};</script>',
               '<script>/* earcut */ var earcut=1;</script>',
               '<div class="sub" id="build" hidden>cidade / v1 / 2026-01-01 00:00</div>',
               '<script>/* app */ console.log(THREE, earcut);</script></html>']
    return ''.join(partes)


def inflado(texto, ident):
    i = texto.index('id="%s">' % ident) + len('id="%s">' % ident)
    j = texto.index('</script>', i)
    return zlib.decompress(base64.b64decode(texto[i:j]), -15).decode('utf-8')


class HtmlTests(unittest.TestCase):
    def test_every_block_is_packed_and_comes_back_whole(self):
        for extras in ([], ['__urbanModels', '__exteriorModels', '__listingModels']):
            texto = comprime(pagina(extras))
            for ident, _ in DADOS:
                self.assertEqual(inflado(texto, ident), '[%s]' % ident)
            for ident in extras:
                self.assertEqual(inflado(texto, ident), '{"%s":1}' % ident)
            self.assertIn('var THREE={r:168};', inflado(texto, '__three'))
            self.assertIn('var earcut=1;', inflado(texto, '__earcut'))
            self.assertIn('console.log(THREE, earcut);', inflado(texto, '__app'))
            # o bloco da cidade fica FORA: o app o lê antes de qualquer descompactação
            self.assertIn('<script type="application/json" id="__cidade">{"slug":"x"}</script>',
                          texto)
            self.assertNotIn('data-zip="json" id="__cidade"', texto)
            self.assertTrue(texto.rstrip().endswith('</script>'), 'o carregador vai no fim')
            self.assertIn('DecompressionStream("deflate-raw")', texto)

    def test_slim_runtime_v2_page_can_omit_monolithic_city_block(self):
        slim = pagina().replace('<script type="application/json" id="__citydata">[__citydata]</script>', '')
        packed = comprime(slim)
        self.assertNotIn('id="__citydata"', packed)
        self.assertIn('data-zip="json" id="__poidata"', packed)

    def test_a_page_without_the_three_anonymous_scripts_is_refused(self):
        with self.assertRaises(SystemExit):
            comprime(pagina().replace('<script>/* earcut */ var earcut=1;</script>', ''))

    def test_pieces_are_named_by_role_not_by_position(self):
        _, dentro = blocos(pagina())
        self.assertEqual(dentro['css'], 'body{margin:0}')
        self.assertIn('var THREE', dentro['lib:three'])
        self.assertIn('var earcut', dentro['lib:earcut'])
        self.assertIn('console.log', dentro['app'])
        # um bloco novo no meio não desloca os nomes dos outros
        _, com_extra = blocos(pagina(['__urbanModels']))
        self.assertEqual(com_extra['lib:three'], dentro['lib:three'])
        self.assertEqual(com_extra['app'], dentro['app'])

    def test_only_the_stamp_may_differ_between_two_assemblies(self):
        original = pagina()
        outro_dia = original.replace('2026-01-01 00:00', '2026-09-18 04:20')
        import tempfile, os
        with tempfile.TemporaryDirectory() as pasta:
            alvo = os.path.join(pasta, 'alvo.html')
            with open(alvo, 'w', encoding='utf-8', newline='') as f:
                f.write(original)
            self.assertEqual(confere(outro_dia, alvo), 0, 'só o carimbo mudou')
            mexido = outro_dia.replace('var earcut=1;', 'var earcut=2;')
            self.assertEqual(confere(mexido, alvo), 1, 'peça diferente reprova')


if __name__ == '__main__':
    unittest.main()
