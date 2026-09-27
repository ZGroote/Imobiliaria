import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline import testa_duplo_clique as probe


class TargetTests(unittest.TestCase):
    def test_missing_requested_city_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'another-v16-moveis.html').write_text('')
            with patch.object(probe, 'PASTA', directory), \
                 patch.object(probe, 'VERSAO', 'v16-moveis'), \
                 patch.object(probe.os.path, 'exists', return_value=True), \
                 patch.object(probe.sys, 'argv', ['testa_duplo_clique.py', 'missing']), \
                 patch.object(probe, 'testa') as test_page, \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(probe.main(), 2)
                test_page.assert_not_called()
                self.assertIn('nenhuma pagina encontrada', output.getvalue())


if __name__ == '__main__':
    unittest.main()
