"""Publicacao: a variante e explicita, e os tiles que a pagina VAI BUSCAR sao conferidos.

Os dois defeitos que estes testes travam:

1. `publicar.py` lia a variante so do ambiente e caia no padrao (`v15`). Publicar sem
   flag subia o renderizador ANTIGO em silencio -- a pagina do v15 existe e e achada,
   entao nada reclamava.
2. A pagina busca os tiles de quintal por `fetch` relativo a ela (ver
   `exterior-details.js`). Faltando, ela NAO quebra: tenta de novo com recuo
   exponencial e escreve aviso no console pra sempre, e os 64.769 quintais somem.
   Publicar assim e publicar uma perda silenciosa.
"""
import io
import json
import os
import runpy
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PUB = runpy.run_path(str(RAIZ / 'pipeline/publicar.py'))


class PublicarTests(unittest.TestCase):
    def test_the_variant_is_a_flag_not_just_the_environment(self):
        fonte = (RAIZ / 'pipeline/publicar.py').read_text(encoding='utf-8')
        self.assertIn('--variante', fonte)
        self.assertIn('resolve(slug, variante)', fonte)

    def test_a_complete_tile_set_passes(self):
        m, faltam = PUB['confere_tiles'](str(RAIZ / 'v16-moveis/publicado/mapa'))
        if m is None:
            self.skipTest('sem manifesto de quintais neste ambiente')
        self.assertEqual(faltam, [], 'tiles faltando no destino publicado')
        self.assertTrue(m['keys'], 'manifesto sem chave nenhuma')

    def test_a_missing_tile_is_reported_not_swallowed(self):
        import tempfile
        with io.open(str(RAIZ / 'exteriores/v1/terrenos-manifesto.json'),
                     encoding='utf-8') as arq:
            m = json.load(arq)
        with tempfile.TemporaryDirectory() as tmp:
            base = os.path.join(tmp, m['prefix'].lstrip('./').replace('/', os.sep))
            os.makedirs(base, exist_ok=True)
            # todos menos um: a conferencia tem que acusar exatamente o que falta
            for k in m['keys'][1:]:
                with io.open(os.path.join(base, k + '.bin'), 'wb') as arq:
                    arq.write(b'')
            _, faltam = PUB['confere_tiles'](tmp)
            self.assertEqual(faltam, [m['keys'][0]])

    def test_no_manifest_is_absence_not_approval(self):
        """Sem manifesto a conferencia devolve None -- e quem chama IMPRIME que nao
        conferiu, em vez de dizer 'ok'. Medicao ausente nunca conta como sucesso."""
        fonte = (RAIZ / 'pipeline/publicar.py').read_text(encoding='utf-8')
        self.assertIn('nada a conferir', fonte)


if __name__ == '__main__':
    unittest.main()
