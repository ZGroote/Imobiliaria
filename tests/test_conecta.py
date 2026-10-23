"""Confere a entrada Conecta sem rede ou mudanças no Hosting real."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('conecta', ROOT / 'conecta/preparar.py')
conecta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conecta)


class ConectaTests(unittest.TestCase):
    def fixture(self, root, site='imobilaria-deccb-miniaturas'):
        (root / 'payload/liv-classico').mkdir(parents=True)
        (root / 'payload/liv-novo').mkdir()
        classic = '<html><head></head><body><a href="#stage">Pular</a><script src="viewer.bundle.js"></script></body></html>'
        (root / 'payload/liv-classico/maquete-liv-ipanema.html').write_text(classic, encoding='utf-8')
        (root / 'payload/liv-novo/index.html').write_text('LIV novo preservado', encoding='utf-8')
        (root / 'payload/index.html').write_text('entrada anterior', encoding='utf-8')
        (root / 'firebase.json').write_text(json.dumps({'hosting': {
            'site': site, 'public': 'payload', 'headers': [{'source': '**', 'headers': []}],
            'redirects': [{'source': '/antigo', 'destination': '/outro', 'type': 301}]}}), encoding='utf-8')
        return classic

    def test_alias_preserva_assets_e_paginas_existentes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            classic = self.fixture(root)
            conecta.prepare(root)
            self.assertEqual((root / 'payload/liv-classico/maquete-liv-ipanema.html').read_text(encoding='utf-8'), classic)
            self.assertEqual((root / 'payload/liv-novo/index.html').read_text(encoding='utf-8'), 'LIV novo preservado')
            alias = (root / 'payload/maquetes/liv/index.html').read_text(encoding='utf-8')
            self.assertIn('<base href="/liv-classico/">', alias)
            self.assertIn('href="/maquetes/liv/#stage"', alias)
            self.assertIn('src="viewer.bundle.js"', alias)

    def test_login_usa_painel_existente_e_repeticao_preserva_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            first = conecta.prepare(root)
            self.assertEqual(conecta.prepare(root), first)
            config = json.loads((root / 'firebase.json').read_text(encoding='utf-8'))['hosting']
            self.assertEqual(config['headers'], [{'source': '**', 'headers': []}])
            self.assertEqual(len(config['redirects']), 3)
            self.assertTrue(all(rule['destination'] == conecta.PANEL_LOGIN for rule in config['redirects'][:2]))
            self.assertEqual((root / 'backup-antes-conecta-20261022/index.html').read_text(encoding='utf-8'), 'entrada anterior')

    def test_recusa_publicar_em_outro_produto(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, site='outro-produto')
            with self.assertRaises(ValueError):
                conecta.prepare(root)
            self.assertEqual((root / 'payload/index.html').read_text(encoding='utf-8'), 'entrada anterior')


if __name__ == '__main__':
    unittest.main()
