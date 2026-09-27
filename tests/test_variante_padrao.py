"""A variante viva é o v16-moveis: padrão desde o #46, e a única desde o #49.

O `BuildConfig` usava o `V_PADRAO` para duas coisas diferentes:

- onde mora a fonte;
- qual componente `v15/...` dos caminhos das cidades se troca pelo da variante.

O #46 separou as duas: a fonte é da variante, e o layout dos caminhos é `BASE_CAMINHO_SAIDA`.
O #49 tirou o v15 de `VARIANTES` junto com a árvore `renderizador/`. O `v15` que sobra em
`BASE_CAMINHO_SAIDA` **não é variante**: é só o layout histórico que cinco JSON de cidade
ainda declaram. Estes testes provam os dois lados, e que cada ponto de entrada (QA,
publicação, montagem, pipeline e sondas) herda o v16-moveis e recusa o v15 por nome.
"""
import contextlib
import io
import json
import os
import runpy
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from pipeline.build import config  # noqa: E402
from pipeline.build.config import resolve  # noqa: E402

V16 = RAIZ / 'v1.5' / 'renderizador-v16-moveis'
CINCO = ('araraquara', 'ribeirao-preto', 'sao-carlos', 'sao-jose-do-rio-preto', 'sorocaba')


def sem_variante():
    """O ambiente de quem não pediu variante nem cidade."""
    return {k: v for k, v in os.environ.items() if k not in ('MAPA_V', 'CIDADE')}


class Para(Exception):
    """Interrompe o ponto de entrada logo depois de resolver a variante."""


class PadraoEFonte(unittest.TestCase):
    def test_sem_argumento_e_v16_moveis(self):
        self.assertEqual(config.V_PADRAO, 'v16-moveis')
        self.assertEqual(config.VARIANTES, ('v16-moveis',))
        cfg = resolve(environ={})
        self.assertEqual((cfg.slug, cfg.versao), ('sao-carlos', 'v16-moveis'))
        self.assertEqual(cfg.fonte, V16)

    def test_v15_e_variante_desconhecida(self):
        with self.assertRaisesRegex(ValueError, 'variante desconhecida: v15'):
            resolve(versao='v15', environ={})
        with self.assertRaisesRegex(ValueError, 'variante desconhecida: v15'):
            resolve(environ={'MAPA_V': 'v15'})
        # A variante explícita continua vencendo o ambiente.
        self.assertEqual(resolve(versao='v16-moveis', environ={'MAPA_V': 'v15'}).fonte, V16)

    def test_o_v15_do_layout_nao_e_variante(self):
        """`BASE_CAMINHO_SAIDA` continua `v15` e continua remapeando, sem ser variante."""
        self.assertEqual(config.BASE_CAMINHO_SAIDA, 'v15')
        self.assertNotIn(config.BASE_CAMINHO_SAIDA, config.VARIANTES)
        cid = Mock()
        cid.caminho.return_value = str(RAIZ / 'v15/sao-carlos-v15-aberto.html')
        self.assertEqual(resolve(environ={}).saida('html_saida', cid),
                         RAIZ / 'v16-moveis/sao-carlos-v16-moveis-aberto.html')
        for v in config.VARIANTES:
            self.assertEqual(resolve(versao=v, environ={}).fonte,
                             RAIZ / 'v1.5' / ('renderizador-' + v))


class SaidaDasCidades(unittest.TestCase):
    def declarado(self, slug):
        p = RAIZ / 'padrao' / 'cidades' / (slug + '.json')
        return json.loads(p.read_text(encoding='utf-8'))['fontes']

    def test_sao_seis_cidades_e_cinco_declaram_v15(self):
        slugs = sorted(p.stem for p in (RAIZ / 'padrao' / 'cidades').glob('*.json'))
        self.assertEqual(slugs, sorted(CINCO + ('ribeirao-preto-oficial',)))
        com_v15 = [s for s in slugs if self.declarado(s)['html_saida'].startswith('v15/')]
        self.assertEqual(com_v15, sorted(CINCO))

    def test_as_cinco_que_declaram_v15_saem_em_v16_moveis(self):
        """O ponto que não pode confundir: o JSON diz `v15/`, a saída é do v16-moveis."""
        for slug in CINCO:
            d = self.declarado(slug)
            self.assertEqual(d['html_saida'], 'v15/%s-v15-aberto.html' % slug)
            self.assertEqual(d['html_comprimido'], 'v15/%s-v15.html' % slug)
            cfg = resolve(slug, environ={})
            cid = cfg.cidade()
            self.assertEqual(cfg.saida('html_saida', cid),
                             RAIZ / 'v16-moveis' / (slug + '-v16-moveis-aberto.html'), slug)
            self.assertEqual(cfg.saida('html_comprimido', cid),
                             RAIZ / 'v16-moveis' / (slug + '-v16-moveis.html'), slug)

    def test_ribeirao_oficial_continua_no_scratch(self):
        cfg = resolve('ribeirao-preto-oficial', environ={})
        self.assertEqual(cfg.saida('html_saida'),
                         RAIZ / '_run_cadastro_oficial/diagnostico-aberto.html')
        self.assertEqual(cfg.saida('html_comprimido'),
                         RAIZ / '_run_cadastro_oficial/diagnostico.html')


class PontosDeEntrada(unittest.TestCase):
    """Cada um é interrompido logo depois de resolver a variante: nada é montado nem gravado."""

    def qa(self, *args):
        from padrao import rodar_qa
        vistos = []

        def roda(cid, comportamento=True):
            vistos.append((os.environ.get('MAPA_V'), Path(cid.caminho('html_saida'))))
            raise Para

        with patch.dict(os.environ, sem_variante(), clear=True), \
                patch.object(rodar_qa.qa, 'roda', roda), \
                patch.object(sys, 'argv', ['rodar_qa.py', 'sao-carlos', '--rapido', *args]):
            with self.assertRaises((Para, SystemExit)) as fim:
                rodar_qa.main()
        return vistos, fim.exception

    def test_qa_sem_variante_mede_v16_moveis(self):
        vistos, _ = self.qa()
        self.assertEqual(vistos, [(None, RAIZ / 'v16-moveis/sao-carlos-v16-moveis-aberto.html')])

    def test_qa_recusa_o_v15(self):
        vistos, fim = self.qa('--variante', 'v15')
        self.assertIsInstance(fim, SystemExit)
        self.assertIn('variante desconhecida: v15', str(fim.code))
        self.assertEqual(vistos, [], 'o QA nao pode chegar a medir nada')

    def publicar(self, *args, espiao=True):
        g = runpy.run_path(str(RAIZ / 'pipeline/publicar.py'))['main'].__globals__
        pedidos = []

        def resolve_espiao(slug=None, versao=None, *a, **k):
            pedidos.append(resolve(slug, versao))
            raise Para

        saida = io.StringIO()
        with patch.dict(os.environ, sem_variante(), clear=True), \
                patch.dict(g, {'resolve': resolve_espiao} if espiao else {}), \
                patch.object(sys, 'argv', ['publicar.py', 'sao-carlos', *args]), \
                contextlib.redirect_stdout(saida):
            if espiao:
                with self.assertRaises(Para):
                    g['main']()
                return pedidos[0]
            return g['main'](), saida.getvalue()

    def test_publicar_sem_variante_e_v16_moveis(self):
        cfg = self.publicar()
        self.assertEqual(cfg.versao, 'v16-moveis')
        self.assertEqual(cfg.saida('html_comprimido'), RAIZ / 'v16-moveis/sao-carlos-v16-moveis.html')

    def test_publicar_recusa_o_v15(self):
        codigo, texto = self.publicar('--variante', 'v15', espiao=False)
        self.assertEqual(codigo, 2)
        self.assertIn('variante desconhecida: v15', texto)

    def test_montar_recusa_o_v15(self):
        from pipeline import montar
        erro = io.StringIO()
        with patch.dict(os.environ, sem_variante(), clear=True), \
                patch.object(montar, 'monta', side_effect=AssertionError('montou')), \
                contextlib.redirect_stderr(erro):
            with self.assertRaises(SystemExit) as fim:
                montar.main(['sao-carlos', '--variante', 'v15'])
        self.assertEqual(fim.exception.code, 2)
        self.assertIn('variante desconhecida: v15', erro.getvalue())

    def roda_python(self, codigo, mapa_v=None):
        env = sem_variante()
        if mapa_v:
            env['MAPA_V'] = mapa_v
        return subprocess.run([sys.executable, '-c', codigo], cwd=RAIZ, env=env,
                              capture_output=True, text=True)

    def test_pipeline_herda_o_padrao_e_recusa_o_v15(self):
        """`rodar.py` importado sem virar `__main__`: a etapa 8 monta o v16-moveis."""
        codigo = ("import runpy; g = runpy.run_path('pipeline/rodar.py', run_name='inspecao'); "
                  "print(g['CONFIG'].versao); print(g['F']('html_saida'))")
        r = self.roda_python(codigo)
        self.assertEqual(r.returncode, 0, r.stderr)
        versao, pagina = r.stdout.split()
        self.assertEqual(versao, 'v16-moveis')
        self.assertEqual(Path(pagina), RAIZ / 'v16-moveis/sao-carlos-v16-moveis-aberto.html')
        r = self.roda_python(codigo, 'v15')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('variante desconhecida: v15', r.stderr)

    def test_sondas_herdam_o_padrao_e_recusam_o_v15(self):
        """As sondas acham a página por `RAIZ/VERSAO`. Um `MAPA_V=v15` esquecido não pode
        mandá-las medir a pasta `v15/` que ainda existe no disco de quem montou antes."""
        codigo = 'from pipeline.montar import VERSAO; print(VERSAO)'
        r = self.roda_python(codigo)
        self.assertEqual((r.returncode, r.stdout.split()), (0, ['v16-moveis']), r.stderr)
        r = self.roda_python(codigo, 'v15')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('variante desconhecida: v15', r.stderr)


if __name__ == '__main__':
    unittest.main()
