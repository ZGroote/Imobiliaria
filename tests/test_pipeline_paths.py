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
            '4': ('pipeline/juntar_lotes.py', 'v7/pipeline/juntar_lotes.py')}


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

    def test_the_moved_step_keeps_its_own_entry_point(self):
        for canonico, _ in MIGRADAS.values():
            fonte = (RAIZ / canonico).read_text(encoding='utf-8')
            self.assertIn("if __name__ ==", fonte, '%s tem que rodar sozinho' % canonico)


if __name__ == '__main__':
    unittest.main()
