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
    @classmethod
    def setUpClass(cls):
        cls.temporarios = ROOT / 'fachada/public'
        cls.temporarios.mkdir(parents=True, exist_ok=True)

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
        with tempfile.TemporaryDirectory(dir=self.temporarios) as directory:
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
        with tempfile.TemporaryDirectory(dir=self.temporarios) as directory:
            root = Path(directory)
            self.fixture(root)
            first = conecta.prepare(root)
            self.assertEqual(conecta.prepare(root), first)
            config = json.loads((root / 'firebase.json').read_text(encoding='utf-8'))['hosting']
            self.assertEqual(config['headers'][0], {'source': '**', 'headers': []})
            self.assertEqual([rule['source'] for rule in config['headers'][1:]], conecta.INSTITUTIONAL_ROUTES)
            self.assertEqual(len(config['redirects']), 3)
            self.assertTrue(all(rule['destination'] == conecta.PANEL_LOGIN for rule in config['redirects'][:2]))
            self.assertEqual(conecta.PANEL_LOGIN, 'https://painel.conectaimoveis3d.com.br/login')
            self.assertEqual((root / 'backup-antes-conecta-20261022/index.html').read_text(encoding='utf-8'), 'entrada anterior')

    def test_recusa_publicar_em_outro_produto(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as directory:
            root = Path(directory)
            self.fixture(root, site='outro-produto')
            with self.assertRaises(ValueError):
                conecta.prepare(root)
            self.assertEqual((root / 'payload/index.html').read_text(encoding='utf-8'), 'entrada anterior')

    def test_fachada_mantem_dominio_rotas_e_recursos_isolados(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'payload/acesso.html').write_text('runtime existente', encoding='utf-8')
            record = conecta.prepare(root)
            self.assertEqual(record['domain'], 'conectaimoveis3d.com.br')
            self.assertEqual((root / 'payload/acesso.html').read_text(encoding='utf-8'), 'runtime existente')
            for pagina in conecta.PAGINAS:
                text = (root / 'payload' / f'{pagina}.html').read_text(encoding='utf-8')
                self.assertIn('Conecta Imóveis 3D', text)
                self.assertIn('href="/painel"', text)
                self.assertIn('href="/maquetes/liv/"', text)
                self.assertIn('src="/institucional/assets/site.js"', text)
            self.assertTrue((root / 'payload/institucional/assets/site.js').is_file())
            self.assertFalse((root / 'payload/robots.txt').exists(), 'O robots da fachada não pode bloquear os produtos.')
            config = json.loads((root / 'firebase.json').read_text(encoding='utf-8'))['hosting']
            self.assertEqual(config['site'], 'imobilaria-deccb-miniaturas')
            self.assertFalse(config['cleanUrls'])
            self.assertEqual((root / 'backup-antes-fachada-20261023/index.html').read_text(encoding='utf-8'), 'entrada anterior')


if __name__ == '__main__':
    unittest.main()
