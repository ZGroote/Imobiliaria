"""Confere a entrada Conecta sem rede ou mudanças no Hosting real."""
import base64
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree

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
            self.assertTrue((root / 'payload/favicon.ico').is_file(), 'O navegador pede /favicon.ico na raiz.')
            self.assertIn('payload/favicon.ico', record['files'])
            index = (root / 'payload/index.html').read_text(encoding='utf-8')
            self.assertIn('<meta property="og:image" content="https://conectaimoveis3d.com.br/institucional/assets/compartilhar.png">', index)
            self.assertTrue((root / 'payload/institucional/assets/compartilhar.png').is_file())
            self.assertEqual((root / 'payload/robots.txt').read_text(encoding='utf-8'),
                             'User-agent: *\nAllow: /\n\nSitemap: https://conectaimoveis3d.com.br/sitemap.xml\n')
            self.assertIn('payload/robots.txt', record['files'])
            config = json.loads((root / 'firebase.json').read_text(encoding='utf-8'))['hosting']
            self.assertEqual(config['site'], 'imobilaria-deccb-miniaturas')
            self.assertFalse(config['cleanUrls'])
            self.assertEqual((root / 'backup-antes-fachada-20261023/index.html').read_text(encoding='utf-8'), 'entrada anterior')

    def test_buscas_publicas_liberadas_sem_alterar_preview_ou_protecoes(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as directory:
            root = Path(directory)
            self.fixture(root)
            conecta.prepare(root)
            for pagina in conecta.PAGINAS:
                robots = 'noindex, follow' if pagina == '404' else 'index, follow'
                public = (root / 'payload' / f'{pagina}.html').read_text(encoding='utf-8')
                self.assertIn(f'<meta name="robots" content="{robots}">', public)
                preview = (root / 'fachada-build' / f'{pagina}.html').read_text(encoding='utf-8')
                self.assertIn('<meta name="robots" content="noindex, nofollow">', preview)
            self.assertIn('Disallow: /', (root / 'fachada-build/robots.txt').read_text(encoding='utf-8'))
            config = json.loads((root / 'firebase.json').read_text(encoding='utf-8'))['hosting']
            for rule in config['headers'][1:]:
                headers = {header['key']: header['value'] for header in rule['headers']}
                self.assertNotIn('X-Robots-Tag', headers)
                self.assertEqual(headers['X-Frame-Options'], 'DENY')
                self.assertIn("default-src 'self'", headers['Content-Security-Policy'])
            # A página não pode depender de um CSS separado: ele vai embutido e o CSP libera o hash exato.
            index = (root / 'payload/index.html').read_bytes().replace(b'\r\n', b'\n').decode('utf-8')
            estilo = index.split('<style>', 1)[1].split('</style>', 1)[0]
            self.assertNotIn('rel="stylesheet"', index)
            digest = "'sha256-" + base64.b64encode(hashlib.sha256(estilo.encode('utf-8')).digest()).decode() + "'"
            self.assertIn(f"style-src 'self' {digest};", headers['Content-Security-Policy'])

    def test_descoberta_e_canonicos_usam_so_o_dominio_proprio(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as directory:
            root = Path(directory)
            self.fixture(root)
            record = conecta.prepare(root)
            sitemap = ElementTree.parse(root / 'payload/sitemap.xml')
            urls = [element.text for element in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
            expected = ['https://conectaimoveis3d.com.br/', *(
                f'https://conectaimoveis3d.com.br/{pagina}.html' for pagina in conecta.PAGINAS if pagina not in ('index', '404')),
                'https://conectaimoveis3d.com.br/maquetes/liv/']
            self.assertEqual(urls, expected)
            for pagina, url in [('index.html', expected[0]), ('planos.html', expected[1]),
                                ('maquetes/liv/index.html', expected[-1])]:
                text = (root / 'payload' / pagina).read_text(encoding='utf-8')
                self.assertEqual(text.count('<link rel="canonical"'), 1)
                self.assertIn(f'<link rel="canonical" href="{url}">', text)
            verification = (root / 'payload' / conecta.VERIFICATION_FILE).read_bytes()
            self.assertEqual(verification, (conecta.SOURCE / conecta.VERIFICATION_FILE).read_bytes())
            self.assertIn('payload/sitemap.xml', record['files'])
            self.assertIn('payload/' + conecta.VERIFICATION_FILE, record['files'])


if __name__ == '__main__':
    unittest.main()
