import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock

from pipeline.build.config import RAIZ, resolve


class BuildConfigurationTests(unittest.TestCase):
    def test_defaults_and_explicit_precedence(self):
        self.assertEqual(resolve(environ={}).versao, 'v16-moveis')
        cfg = resolve('araraquara', 'v16-moveis',
                      environ={'CIDADE': 'sao-carlos', 'MAPA_V': 'outra-variante'})
        self.assertEqual((cfg.slug, cfg.versao), ('araraquara', 'v16-moveis'))
        self.assertEqual(cfg.fonte, RAIZ / 'v1.5' / 'renderizador-v16-moveis')

    def test_every_declared_variant_has_its_folder(self):
        """`v16` era declarado e tinha pasta; saiu dos dois lugares ao mesmo tempo, como
        o v15 no #49. Declarar variante sem pasta faz o montador ler diretório inexistente."""
        from pipeline.build.config import VARIANTES
        self.assertEqual(VARIANTES, ('v16-moveis',))
        for v in VARIANTES:
            self.assertTrue(resolve(versao=v).fonte.is_dir(), v)
        self.assertFalse((RAIZ / 'renderizador-v16').exists(),
                         'o galho intermediário voltou')

    def test_output_and_isolated_destination(self):
        cid = Mock()
        cid.caminho.return_value = str(RAIZ / 'v15/ribeirao-preto-v15-aberto.html')
        self.assertEqual(resolve(versao='v16-moveis').saida('html_saida', cid),
                         RAIZ / 'v16-moveis/ribeirao-preto-v16-moveis-aberto.html')
        self.assertEqual(resolve(destino='isolado', environ={}).saida('html_saida', cid),
                         Path('isolado').resolve() / 'ribeirao-preto-v16-moveis-aberto.html')

    def test_invalid_variant_cannot_be_a_path(self):
        with self.assertRaisesRegex(ValueError, 'variante desconhecida'):
            resolve(versao='../outro')

    def test_retired_variants_are_unknown(self):
        """O v17 e o v18 saíram no #48, e o v15 no #49: pedir qualquer um é erro, não fallback."""
        for velha in ('v15', 'v17', 'v18'):
            with self.assertRaisesRegex(ValueError, 'variante desconhecida: %s' % velha):
                resolve(versao=velha, environ={})
            with self.assertRaisesRegex(ValueError, 'variante desconhecida: %s' % velha):
                resolve(environ={'MAPA_V': velha})

    def test_qa_and_builder_target_the_same_variant(self):
        cfg = resolve('sao-carlos', 'v16-moveis')
        cid = cfg.cidade_para_qa()
        self.assertEqual(Path(cid.caminho('html_saida')), cfg.saida('html_saida'))
        self.assertEqual(cid.caminho('city_saida'), cfg.cidade().caminho('city_saida'))

    def test_import_does_not_load_city_or_interpret_foreign_arguments(self):
        """Importar não lê cidade, não interpreta argumento e não valida o ambiente: com
        `MAPA_V=v15` o import passa, e quem decide é a flag ou o `resolve()` de quem roda.
        Nem `config` nem `montar` exportam mais o `VERSAO` global (#49)."""
        script = """
import sys
sys.argv = ['outro-programa', 'titulo com espacos', '--opcao']
from unittest.mock import patch
with patch('padrao.cidade.carrega', side_effect=AssertionError('city loaded')):
    import pipeline.montar as montar
    from pipeline.build import config
    assert not hasattr(montar, 'VERSAO') and not hasattr(config, 'VERSAO')
"""
        result = subprocess.run([sys.executable, '-c', script], cwd=RAIZ,
                                env=dict(os.environ, MAPA_V='v15'),
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
