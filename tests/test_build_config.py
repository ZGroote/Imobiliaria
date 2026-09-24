import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock

from pipeline.build.config import RAIZ, resolve


class BuildConfigurationTests(unittest.TestCase):
    def test_defaults_and_explicit_precedence(self):
        self.assertEqual(resolve(environ={}).versao, 'v15')
        cfg = resolve('araraquara', 'v16-moveis',
                      environ={'CIDADE': 'sao-carlos', 'MAPA_V': 'v15'})
        self.assertEqual((cfg.slug, cfg.versao), ('araraquara', 'v16-moveis'))
        self.assertEqual(cfg.fonte, RAIZ / 'v1.5' / 'renderizador-v16-moveis')

    def test_every_declared_variant_has_its_folder(self):
        """`v16` era declarado e tinha pasta; saiu dos dois lugares ao mesmo tempo.
        Declarar variante sem pasta faz o montador ler diretório inexistente."""
        from pipeline.build.config import VARIANTES
        self.assertEqual(VARIANTES, ('v15', 'v16-moveis'))
        for v in VARIANTES:
            self.assertTrue(resolve(versao=v).fonte.is_dir(), v)
        self.assertFalse((RAIZ / 'renderizador-v16').exists(),
                         'o galho intermediário voltou')

    def test_output_and_isolated_destination(self):
        cid = Mock()
        cid.caminho.return_value = str(RAIZ / 'v15/ribeirao-preto-v15-aberto.html')
        self.assertEqual(resolve(versao='v16-moveis').saida('html_saida', cid),
                         RAIZ / 'v16-moveis/ribeirao-preto-v16-moveis-aberto.html')
        self.assertEqual(resolve(destino='isolado').saida('html_saida', cid),
                         Path('isolado').resolve() / 'ribeirao-preto-v15-aberto.html')

    def test_invalid_variant_cannot_be_a_path(self):
        with self.assertRaisesRegex(ValueError, 'variante desconhecida'):
            resolve(versao='../outro')

    def test_qa_and_builder_target_the_same_variant(self):
        cfg = resolve('sao-carlos', 'v16-moveis')
        cid = cfg.cidade_para_qa()
        self.assertEqual(Path(cid.caminho('html_saida')), cfg.saida('html_saida'))
        self.assertEqual(cid.caminho('city_saida'), cfg.cidade().caminho('city_saida'))

    def test_import_does_not_load_city_or_interpret_foreign_arguments(self):
        script = """
import sys
sys.argv = ['outro-programa', 'titulo com espacos', '--opcao']
from unittest.mock import patch
with patch('padrao.cidade.carrega', side_effect=AssertionError('city loaded')):
    from pipeline.montar import VERSAO
    assert VERSAO == 'v16-moveis'
"""
        result = subprocess.run([sys.executable, '-c', script], cwd=RAIZ,
                                env=dict(os.environ, MAPA_V='v16-moveis'),
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
