"""#46: o v16-moveis é a variante padrão, e o v15 fica disponível só explicitamente.

O `BuildConfig` usava o `V_PADRAO` para duas coisas diferentes:

- onde mora a fonte;
- qual componente `v15/...` dos caminhos das cidades se troca pelo da variante.

Trocar só a constante teria mandado o v16-moveis ler `renderizador/` e parado de remapear as
cidades. Agora a fonte é da variante e o layout dos caminhos é `BASE_CAMINHO_SAIDA`. Estes
testes provam os dois, e que cada ponto de entrada (QA, publicação, pipeline e sondas)
herda o padrão novo sem `MAPA_V`.
"""
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
        cfg = resolve(environ={})
        self.assertEqual((cfg.slug, cfg.versao), ('sao-carlos', 'v16-moveis'))
        self.assertEqual(cfg.fonte, V16)

    def test_v15_continua_explicito(self):
        self.assertEqual(resolve(versao='v15', environ={}).fonte, RAIZ / 'renderizador')
        self.assertEqual(resolve(environ={'MAPA_V': 'v15'}).fonte, RAIZ / 'renderizador')
        self.assertEqual(resolve(versao='v16-moveis', environ={'MAPA_V': 'v15'}).fonte, V16)

    def test_fonte_e_layout_nao_seguem_o_padrao(self):
        """Com qualquer padrão, a fonte é a da variante e o `v15/` dos JSON é remapeado."""
        cid = Mock()
        cid.caminho.return_value = str(RAIZ / 'v15/sao-carlos-v15-aberto.html')
        for padrao in ('v15', 'v16-moveis'):
            with patch.object(config, 'V_PADRAO', padrao):
                v15 = resolve(versao='v15', environ={})
                v16 = resolve(versao='v16-moveis', environ={})
                self.assertEqual(v15.fonte, RAIZ / 'renderizador', padrao)
                self.assertEqual(v16.fonte, V16, padrao)
                self.assertEqual(v15.saida('html_saida', cid),
                                 RAIZ / 'v15/sao-carlos-v15-aberto.html', padrao)
                self.assertEqual(v16.saida('html_saida', cid),
                                 RAIZ / 'v16-moveis/sao-carlos-v16-moveis-aberto.html', padrao)


class SaidaDasCidades(unittest.TestCase):
    def declarado(self, slug):
        p = RAIZ / 'padrao' / 'cidades' / (slug + '.json')
        return json.loads(p.read_text(encoding='utf-8'))['fontes']

    def test_sao_seis_cidades_e_cinco_declaram_v15(self):
        slugs = sorted(p.stem for p in (RAIZ / 'padrao' / 'cidades').glob('*.json'))
        self.assertEqual(slugs, sorted(CINCO + ('ribeirao-preto-oficial',)))
        com_v15 = [s for s in slugs if self.declarado(s)['html_saida'].startswith('v15/')]
        self.assertEqual(com_v15, sorted(CINCO))

    def test_as_cinco_saem_em_v16_moveis_por_padrao(self):
        for slug in CINCO:
            padrao, v15 = resolve(slug, environ={}), resolve(slug, 'v15', environ={})
            cid = padrao.cidade()
            self.assertEqual(padrao.saida('html_saida', cid),
                             RAIZ / 'v16-moveis' / (slug + '-v16-moveis-aberto.html'), slug)
            self.assertEqual(padrao.saida('html_comprimido', cid),
                             RAIZ / 'v16-moveis' / (slug + '-v16-moveis.html'), slug)
            # `--variante v15` continua saindo exatamente onde o JSON declara.
            d = self.declarado(slug)
            self.assertEqual(v15.saida('html_saida', cid), RAIZ / d['html_saida'], slug)
            self.assertEqual(v15.saida('html_comprimido', cid), RAIZ / d['html_comprimido'], slug)

    def test_ribeirao_oficial_continua_no_scratch(self):
        for versao in ('v16-moveis', 'v15'):
            cfg = resolve('ribeirao-preto-oficial', versao, environ={})
            self.assertEqual(cfg.saida('html_saida'),
                             RAIZ / '_run_cadastro_oficial/diagnostico-aberto.html', versao)
            self.assertEqual(cfg.saida('html_comprimido'),
                             RAIZ / '_run_cadastro_oficial/diagnostico.html', versao)


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
            with self.assertRaises(Para):
                rodar_qa.main()
        return vistos[0]

    def test_qa_sem_variante_mede_v16_moveis(self):
        mapa_v, pagina = self.qa()
        self.assertIsNone(mapa_v)
        self.assertEqual(pagina, RAIZ / 'v16-moveis/sao-carlos-v16-moveis-aberto.html')

    def test_qa_com_variante_v15(self):
        mapa_v, pagina = self.qa('--variante', 'v15')
        self.assertEqual(mapa_v, 'v15')
        self.assertEqual(pagina, RAIZ / 'v15/sao-carlos-v15-aberto.html')

    def publicar(self, *args):
        g = runpy.run_path(str(RAIZ / 'pipeline/publicar.py'))['main'].__globals__
        pedidos = []

        def espiao(slug=None, versao=None, *a, **k):
            pedidos.append(resolve(slug, versao))
            raise Para

        with patch.dict(os.environ, sem_variante(), clear=True), \
                patch.dict(g, {'resolve': espiao}), \
                patch.object(sys, 'argv', ['publicar.py', 'sao-carlos', *args]):
            with self.assertRaises(Para):
                g['main']()
        return pedidos[0]

    def test_publicar_sem_variante_e_v16_moveis(self):
        cfg = self.publicar()
        self.assertEqual(cfg.versao, 'v16-moveis')
        self.assertEqual(cfg.saida('html_comprimido'), RAIZ / 'v16-moveis/sao-carlos-v16-moveis.html')

    def test_publicar_com_variante_v15(self):
        self.assertEqual(self.publicar('--variante', 'v15').versao, 'v15')

    def roda_python(self, codigo, mapa_v=None):
        env = sem_variante()
        if mapa_v:
            env['MAPA_V'] = mapa_v
        r = subprocess.run([sys.executable, '-c', codigo], cwd=RAIZ, env=env,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout.split()

    def test_pipeline_herda_o_padrao(self):
        """`rodar.py` importado sem virar `__main__`: a etapa 8 monta o v16-moveis."""
        codigo = ("import runpy; g = runpy.run_path('pipeline/rodar.py', run_name='inspecao'); "
                  "print(g['CONFIG'].versao); print(g['F']('html_saida'))")
        versao, pagina = self.roda_python(codigo)
        self.assertEqual(versao, 'v16-moveis')
        self.assertEqual(Path(pagina), RAIZ / 'v16-moveis/sao-carlos-v16-moveis-aberto.html')
        self.assertEqual(self.roda_python(codigo, 'v15')[0], 'v15')

    def test_sondas_herdam_o_padrao(self):
        """As sondas acham a página por `RAIZ/VERSAO`, com o `VERSAO` de `pipeline.montar`."""
        codigo = 'from pipeline.montar import VERSAO; print(VERSAO)'
        self.assertEqual(self.roda_python(codigo), ['v16-moveis'])
        self.assertEqual(self.roda_python(codigo, 'v15'), ['v15'])


if __name__ == '__main__':
    unittest.main()
