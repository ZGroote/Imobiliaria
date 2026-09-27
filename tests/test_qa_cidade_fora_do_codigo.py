"""O portão "cidade fora do código" olha a fonte da variante que está no QA.

Até o #45 ele varria fixo `renderizador/` (v15): o `npm run qa`, que é do v16-moveis, media o
código de outra árvore. Agora ele lê `config.fonte`, resolvida como o `rodar_qa` resolve:
`--variante` vira `MAPA_V`, e sem ela vale o padrão.

As mutações rodam numa raiz temporária com as duas árvores, então a coordenada plantada
nunca toca o repositório.
"""
import os
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from padrao import qa  # noqa: E402
from pipeline.build import config  # noqa: E402

# O centro de São Carlos: "%.5f" dá -22.01725 e -47.89080, e o portão também procura -47.8908.
CID = SimpleNamespace(slug='sao-carlos', clat=-22.01725, clon=-47.8908)
PROIBIDA = 'const CENTER = {lat: -22.01725, lon: -47.8908};\n'
V16 = Path('v1.5', 'renderizador-v16-moveis')


def portao(variante, raiz=None):
    """Roda o portão com a variante vinda do ambiente, como o `rodar_qa --variante` deixa."""
    env = {k: v for k, v in os.environ.items() if k != 'MAPA_V'}
    if variante:
        env['MAPA_V'] = variante
    with ExitStack() as pilha:
        pilha.enter_context(patch.dict(os.environ, env, clear=True))
        if raiz is not None:
            pilha.enter_context(patch.object(config, 'RAIZ', Path(raiz)))
        return qa.portao_cidade_fora_do_codigo(CID)


def escreve(raiz, rel, texto):
    p = Path(raiz, rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(texto, encoding='utf-8')


class ArvoreInspecionada(unittest.TestCase):
    """Na árvore real: qual pasta o portão percorre."""

    def percorridas(self, variante):
        with patch('os.walk', wraps=os.walk) as espiao:
            p = portao(variante)
        return [Path(c.args[0]) for c in espiao.call_args_list], p

    def test_qa_do_v16_moveis_olha_a_fonte_do_v16_moveis(self):
        raizes, p = self.percorridas('v16-moveis')
        self.assertEqual(raizes, [RAIZ / V16])
        self.assertIn('v1.5/renderizador-v16-moveis', p.detalhe)

    def test_qa_do_v15_continua_olhando_renderizador(self):
        raizes, p = self.percorridas(None)
        self.assertEqual(raizes, [RAIZ / 'renderizador'])
        self.assertIn('renderizador', p.detalhe)
        raizes, _ = self.percorridas('v15')
        self.assertEqual(raizes, [RAIZ / 'renderizador'])


class Mutacao(unittest.TestCase):
    """Numa raiz temporária: a coordenada plantada numa árvore só reprova a variante dela."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.raiz = self._tmp.name
        escreve(self.raiz, 'renderizador/app.js', 'const a = 1;\n')
        escreve(self.raiz, V16 / 'app.js', 'const a = 1;\n')
        # lib/ é three.js e earcut: fica de fora do portão, também na árvore modular.
        escreve(self.raiz, V16 / 'lib' / 'three.min.js', PROIBIDA)

    def tearDown(self):
        self._tmp.cleanup()

    def test_arvores_limpas_passam(self):
        for variante in ('v16-moveis', 'v15'):
            p = portao(variante, self.raiz)
            self.assertTrue(p.passou, (variante, p.detalhe))
            self.assertEqual(p.valor, 0)

    def test_coordenada_so_no_v16_reprova_o_qa_do_v16(self):
        escreve(self.raiz, V16 / 'world' / 'terrain.js', 'const x = 0;\n' + PROIBIDA)
        p = portao('v16-moveis', self.raiz)
        self.assertFalse(p.passou)
        self.assertEqual(p.valor, 1)
        self.assertIn('v1.5/renderizador-v16-moveis: world/terrain.js:2', p.detalhe)
        self.assertTrue(portao('v15', self.raiz).passou)

    def test_o_qa_do_v16_nao_depende_do_v15(self):
        escreve(self.raiz, V16 / 'world' / 'terrain.js', PROIBIDA)
        Path(self.raiz, 'renderizador', 'app.js').unlink()
        Path(self.raiz, 'renderizador').rmdir()
        p = portao('v16-moveis', self.raiz)
        self.assertIs(p.passou, False, p.detalhe)
        self.assertEqual(p.valor, 1)

    def test_coordenada_so_no_v15_nao_reprova_o_v16(self):
        escreve(self.raiz, 'renderizador/app.js', PROIBIDA)
        self.assertFalse(portao('v15', self.raiz).passou)
        self.assertTrue(portao('v16-moveis', self.raiz).passou)

    def test_comentario_continua_permitido(self):
        escreve(self.raiz, V16 / 'app.js', '// o centro era ' + PROIBIDA)
        self.assertTrue(portao('v16-moveis', self.raiz).passou)


if __name__ == '__main__':
    unittest.main()
