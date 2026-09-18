"""Caminhos canônicos das etapas: o runner chama `pipeline/`, e o caminho antigo
continua funcionando por um invocador que não guarda lógica nenhuma."""
import ast
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# etapa migrada -> (caminho canônico, invocador antigo)
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
            '0d': ('pipeline/plantas/rodar_tudo.py', 'v7/pipeline/rodar_tudo.py')}

# Ferramenta de planta: tinha DUAS cópias idênticas (plantas_pipeline/ e v7/pipeline/) e
# agora tem uma fonte só, com invocador em cada caminho antigo. `plantas_pipeline/` segue
# sendo a pasta de DADO da caixa de ferramentas -- recortes, saída e casamento de nomes.
FERRAMENTAS = {'pipeline/plantas/rodar_tudo.py':
               ['plantas_pipeline/rodar_tudo.py', 'v7/pipeline/rodar_tudo.py']}
for _n in ('vetorizar_planta', 'georreferenciar_planta', 'ler_escala', 'rodar_escalas',
           'casar_nomes', 'conferir_encaixe', 'overlay_planta', 'mapa_qa'):
    FERRAMENTAS['pipeline/plantas/%s.py' % _n] = ['plantas_pipeline/%s.py' % _n]


class PipelinePathTests(unittest.TestCase):
    def test_the_runner_calls_the_canonical_path(self):
        fonte = (RAIZ / 'pipeline/rodar.py').read_text(encoding='utf-8')
        for etapa, (canonico, antigo) in MIGRADAS.items():
            self.assertIn('"%s"' % canonico, fonte, etapa)
            self.assertNotIn('"%s"' % antigo, fonte, etapa)

    def test_the_old_path_only_delegates(self):
        for canonico, antigo in MIGRADAS.values():
            arvore = ast.parse((RAIZ / antigo).read_text(encoding='utf-8'))
            nomes = {n.__class__.__name__ for n in arvore.body}
            self.assertFalse(nomes & {'FunctionDef', 'ClassDef', 'For', 'While', 'If'},
                             '%s virou invocador; não pode ter lógica' % antigo)
            self.assertIn(Path(canonico).name, (RAIZ / antigo).read_text(encoding='utf-8'))
            self.assertTrue((RAIZ / canonico).exists())

    def test_each_plant_tool_has_a_single_source(self):
        for canonico, antigos in FERRAMENTAS.items():
            self.assertTrue((RAIZ / canonico).exists(), canonico)
            for antigo in antigos:
                fonte = (RAIZ / antigo).read_text(encoding='utf-8')
                self.assertIn('runpy.run_path', fonte, antigo)
                self.assertLess(len(fonte.splitlines()), 15,
                                '%s tem que ser invocador, não cópia' % antigo)

    def test_the_plant_tools_derive_the_root_from_their_own_file(self):
        """Tinham o caminho absoluto da máquina de quem escreveu escrito no código."""
        for canonico in FERRAMENTAS:
            fonte = (RAIZ / canonico).read_text(encoding='utf-8')
            self.assertNotIn('C:/Users', fonte, canonico)

    def test_the_wrapper_runs_the_step_as_a_program(self):
        """Parte das etapas é script de linha reta: o trabalho acontece no import, sem
        `if __name__`. Por isso o invocador usa `run_name="__main__"` -- ele serve aos
        dois estilos, e é o que mantém o caminho antigo com o mesmo efeito de antes."""
        for canonico, antigo in MIGRADAS.values():
            fonte = (RAIZ / antigo).read_text(encoding='utf-8')
            self.assertIn('run_name="__main__"', fonte, antigo)
            self.assertIn('runpy.run_path', fonte, antigo)


if __name__ == '__main__':
    unittest.main()
