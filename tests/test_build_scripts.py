import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

from pipeline.build.scripts import programa


class ScriptCompositionTests(unittest.TestCase):
    def test_order_and_missing_script(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            cfg = SimpleNamespace(fonte=root)
            (root / 'modules.json').write_text(json.dumps(['part.js', 'app.js']))
            (root / 'part.js').write_text('const value = 4;')
            (root / 'app.js').write_text('console.log(value);')
            self.assertEqual(programa(cfg), 'const value = 4;\nconsole.log(value);')
            (root / 'part.js').unlink()
            with self.assertRaises(FileNotFoundError):
                programa(cfg)

    def test_rejects_duplicate_and_escape(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for names in [['app.js', 'app.js'], ['../outside.js', 'app.js'], ['x.js']]:
                (root / 'modules.json').write_text(json.dumps(names))
                with self.assertRaises(ValueError):
                    programa(SimpleNamespace(fonte=root))
