from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pipeline.build.config import resolve
from pipeline.build.manifest import entradas, assinatura, snapshot


class ManifestTests(unittest.TestCase):
    def test_variant_sources_and_optional_inputs(self):
        cfg = resolve('sao-carlos', 'v16-moveis')
        files = entradas(cfg)
        self.assertIn(cfg.fonte / 'exterior-details.js', files)
        self.assertIn(cfg.fonte / 'listing-models.js', files)
        self.assertIn(cfg.fonte / 'modules.json', files)
        self.assertFalse(any(p.as_posix().endswith('/renderizador/app.js') for p in files))

    def test_add_modify_remove_optional_file(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / 'optional.json'
            absent = snapshot([p])
            p.write_text('one')
            present = snapshot([p])
            p.write_text('two')
            changed = snapshot([p])
            p.unlink()
            self.assertNotEqual(absent, present)
            self.assertNotEqual(present, changed)
            self.assertEqual(absent, snapshot([p]))

    def test_new_module_and_variant_invalidate_signature(self):
        cfg = resolve('sao-carlos', 'v16-moveis')
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / 'new.js'
            p.write_text('first')
            with patch('pipeline.build.manifest.entradas', return_value=[]):
                before = assinatura(cfg)
                other_variant = assinatura(resolve('sao-carlos', 'v15'))
            with patch('pipeline.build.manifest.entradas', return_value=[p]):
                after = assinatura(cfg)
            self.assertNotEqual(before, after)
            self.assertNotEqual(before, other_variant)

    def test_runner_build_stamp_requires_matching_content(self):
        import pipeline.rodar as runner
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'app.js'
            output = Path(folder) / 'map.html'
            source.write_text('first')
            output.write_text('page')
            with patch.object(runner, 'ESTADO', str(Path(folder) / 'state.json')), \
                 patch('pipeline.build.manifest.entradas', return_value=[source]):
                self.assertEqual(runner.estado('8', [str(source)], [str(output)]), 'velho')
                runner.anota('8', [str(source)], [str(output)])
                self.assertEqual(runner.estado('8', [str(source)], [str(output)]), 'fresco')
                source.write_text('other')
                self.assertEqual(runner.estado('8', [str(source)], [str(output)]), 'velho')
                output.unlink()
                self.assertEqual(runner.estado('8', [str(source)], [str(output)]), 'FALTA')


if __name__ == '__main__':
    unittest.main()
