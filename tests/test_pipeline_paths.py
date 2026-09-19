"""Caminhos canônicos das etapas: o runner chama `pipeline/`, e o caminho antigo
**não existe mais**.

Durante a modularização cada etapa foi copiada de `v4/`, `v7/pipeline/` ou `v8/` para
`pipeline/`, e o caminho antigo ficou para trás como invocador de nove linhas. Isso
mantinha meia migração de pé: quem procurasse a etapa achava dois arquivos, e o mais
antigo primeiro. Os invocadores saíram, junto com onze scripts que ninguém mais
chamava. O que eles faziam está em `pipeline/`; o código deles está no histórico do
Git, que é onde código aposentado deve morar.

As pastas `v3/`..`v12/` e `v16/` guardavam, além disso, o DADO de São Carlos e as
páginas montadas de cada geração. O dado foi para `sao-carlos/`, no padrão das outras
cidades, e as pastas foram para `_arquivo/`. Saída viva hoje é só `v15/` (V_PADRAO) e
`v16-moveis/` — e o nome não é o critério: `pipeline/build/config.py` deriva o caminho
da variante a partir do que a cidade declara.
"""
import ast
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# etapa -> (caminho canônico, caminho aposentado que não pode voltar)
MIGRADAS = {'0c': ('pipeline/city_base.py', 'v4/build_city_v4.py'),
            '6': ('pipeline/muros.py', 'v7/pipeline/gen_muros.py'),
            '6b': ('pipeline/portoes.py', 'v7/pipeline/gen_portoes.py'),
            '1b': ('pipeline/quadras_grafo.py', 'v7/pipeline/quadras_grafo.py'),
            '2': ('pipeline/quadras_miolo.py', 'v7/pipeline/quadras_miolo.py'),
            '3': ('pipeline/lotes_sinteticos.py', 'v7/pipeline/lotes_sinteticos.py'),
            '4': ('pipeline/juntar_lotes.py', 'v7/pipeline/juntar_lotes.py'),
            '5': ('pipeline/ocupacao.py', 'v7/pipeline/ocupacao.py'),
            '7': ('pipeline/city_final.py', 'v7/pipeline/build_v7_city.py'),
            '7b-chao': ('pipeline/chao.py', 'v7/pipeline/gen_chao.py'),
            '7b-ruas': ('pipeline/ruas.py', 'v7/pipeline/gen_ruas.py'),
            '0e-consolida': ('pipeline/consolidar.py', 'v7/pipeline/consolidar.py'),
            '0e-audita': ('pipeline/auditoria_tamanhos.py', 'v7/pipeline/auditoria_tamanhos.py'),
            '0e-filtra': ('pipeline/filtrar_confiaveis.py', 'v7/pipeline/filtrar_confiaveis.py'),
            '0d': ('pipeline/plantas/rodar_tudo.py', 'v7/pipeline/rodar_tudo.py'),
            '0d-relatorio': ('pipeline/plantas/relatorio.py', 'v7/pipeline/relatorio.py'),
            '0.9': ('pipeline/plantas/baixar_openplots.py', 'v7/pipeline/baixar_openplots.py')}

# Scripts que tinham lógica própria em `v4/`..`v8/` e que ninguém importava nem
# chamava -- as quatro gerações do montador de página, mais ferramentas de QA e de
# limpeza que já têm equivalente em `pipeline/`. Saíram inteiros.
APOSENTADOS = ['v4/make_v4.py', 'v4/assemble_block.js', 'v4/stream_block.js',
               'v5/make_v5.py', 'v6/make_v6.py',
               'v7/pipeline/make_v7.py', 'v7/pipeline/make_v7_html.py',
               'v7/pipeline/exporta_gabarito.py', 'v7/pipeline/qa_medir.py',
               'v7/pipeline/qa_shot.py', 'v8/pipeline/make_v8.py',
               'v8/pipeline/limpar_dados.py', 'v8/pipeline/qa_medir.py']

# Ferramenta de planta: tinha DUAS cópias idênticas (plantas_pipeline/ e v7/pipeline/).
# A de `v7/pipeline/` saiu; `plantas_pipeline/` segue sendo a pasta de DADO da caixa de
# ferramentas -- recortes, saída e casamento de nomes -- e mantém um invocador, porque
# é lá que se trabalha planta.
FERRAMENTAS = {'pipeline/plantas/rodar_tudo.py': ['plantas_pipeline/rodar_tudo.py']}
for _n in ('vetorizar_planta', 'georreferenciar_planta', 'ler_escala', 'rodar_escalas',
           'casar_nomes', 'conferir_encaixe', 'overlay_planta', 'mapa_qa'):
    FERRAMENTAS['pipeline/plantas/%s.py' % _n] = ['plantas_pipeline/%s.py' % _n]
FERRAMENTAS['pipeline/plantas/relatorio.py'] = ['plantas_pipeline/relatorio.py']
# O baixador nao tinha copia em `plantas_pipeline/`: o par era raiz x `v7/pipeline/`.
FERRAMENTAS['pipeline/plantas/baixar_openplots.py'] = ['baixar_openplots.py']
# A etapa 0e tinha uma TERCEIRA copia em `plantas_pipeline/`, anterior ao conserto que
# a fez ler o caminho do JSON da cidade: ela gravava na raiz enquanto o pipeline lia de
# v7/dados/, e o filtro seguinte devolvia zero lote confiavel sem erro nenhum.
for _n in ('auditoria_tamanhos', 'consolidar', 'filtrar_confiaveis'):
    FERRAMENTAS['pipeline/%s.py' % _n] = ['plantas_pipeline/%s.py' % _n]


class PipelinePathTests(unittest.TestCase):
    def test_the_runner_calls_the_canonical_path(self):
        fonte = (RAIZ / 'pipeline/rodar.py').read_text(encoding='utf-8')
        for etapa, (canonico, antigo) in MIGRADAS.items():
            self.assertIn('"%s"' % canonico, fonte, etapa)
            self.assertNotIn('"%s"' % antigo, fonte, etapa)

    def test_the_step_lives_only_at_the_canonical_path(self):
        for etapa, (canonico, antigo) in MIGRADAS.items():
            self.assertTrue((RAIZ / canonico).exists(), canonico)
            self.assertFalse((RAIZ / antigo).exists(),
                             '%s voltou: a etapa tem que existir só em %s'
                             % (antigo, canonico))

    def test_the_retired_scripts_are_not_back(self):
        for morto in APOSENTADOS:
            self.assertFalse((RAIZ / morto).exists(),
                             '%s não é chamado por ninguém; seu lugar é o histórico'
                             % morto)

    def test_only_the_live_variants_keep_a_version_folder(self):
        """Pasta com nome de geração na raiz é saída de variante viva, e nada mais.

        As outras foram para `_arquivo/` em 19/09/2026 e o dado que estava nelas para
        `sao-carlos/`. Uma voltando à raiz é sinal de que alguém a desarquivou sem
        querer -- e a de código já custou uma migração pela metade."""
        from pipeline.build.config import VARIANTES
        vivas = {'v15'} | {v for v in VARIANTES if v != 'v15'}
        for pasta in ('v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11',
                      'v12', 'v16'):
            self.assertNotIn(pasta, vivas)
            self.assertFalse((RAIZ / pasta).exists(),
                             '%s/ voltou para a raiz; o lugar dela é _arquivo/' % pasta)

    def test_each_plant_tool_has_a_single_source(self):
        for canonico, antigos in FERRAMENTAS.items():
            self.assertTrue((RAIZ / canonico).exists(), canonico)
            for antigo in antigos:
                fonte = (RAIZ / antigo).read_text(encoding='utf-8')
                self.assertIn('runpy.run_path', fonte, antigo)
                self.assertLess(len(fonte.splitlines()), 15,
                                '%s tem que ser invocador, não cópia' % antigo)
                arvore = ast.parse(fonte)
                nomes = {n.__class__.__name__ for n in arvore.body}
                self.assertFalse(nomes & {'FunctionDef', 'ClassDef', 'For', 'While'},
                                 '%s é invocador; não pode ter lógica' % antigo)
                self.assertIn('run_name="__main__"', fonte, antigo)

    def test_the_plant_tools_derive_the_root_from_their_own_file(self):
        """Tinham o caminho absoluto da máquina de quem escreveu escrito no código."""
        for canonico in FERRAMENTAS:
            fonte = (RAIZ / canonico).read_text(encoding='utf-8')
            self.assertNotIn('C:/Users', fonte, canonico)

    def test_the_downloader_writes_under_the_project_root(self):
        """As duas cópias byte a byte iguais tiravam `OUT` de `__file__`, então rodar a
        do `v7/pipeline/` baixava as 265 plantas para `v7/pipeline/plantas_openplots/` e
        a etapa 0.9 seguia achando a pasta vazia. Agora a âncora é a raiz."""
        import runpy
        alvo = runpy.run_path(str(RAIZ / 'pipeline/plantas/baixar_openplots.py'))
        self.assertEqual(Path(alvo['OUT']), RAIZ / 'plantas_openplots')
        self.assertEqual(Path(alvo['SRC_HTML']).parent, RAIZ / 'plantas_openplots')


if __name__ == '__main__':
    unittest.main()
