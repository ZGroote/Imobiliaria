import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('conecta', ROOT / 'conecta/preparar.py')
conecta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conecta)


class PublicacaoPublicaTests(unittest.TestCase):
    def test_repetir_preparo_mantem_html_fora_do_hosting_estatico_e_preserva_outras_rotas(self):
        (ROOT / 'tmp').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp') as directory:
            root = Path(directory)
            classic = root / 'payload/liv-classico/maquete-liv-ipanema.html'
            classic.parent.mkdir(parents=True)
            classic.write_text('<html><head></head><body>Maquete</body></html>', encoding='utf-8')
            config = {'hosting': {'site': 'imobilaria-deccb-miniaturas', 'public': 'payload',
                      'ignore': ['**/.*'], 'rewrites': [{'source': '/outra-rota', 'destination': '/index.html'}]}}
            (root / 'firebase.json').write_text(json.dumps(config), encoding='utf-8')
            first = conecta.prepare(root)
            self.assertEqual(conecta.prepare(root), first)
            hosting = json.loads((root / 'firebase.json').read_text(encoding='utf-8'))['hosting']
            self.assertEqual(hosting['rewrites'][-1], config['hosting']['rewrites'][0])
            for prefix in ['maquetes/liv', 'liv-classico', 'liv-novo', 'b/liv-ipanema']:
                self.assertIn(prefix + '/**/*.html', hosting['ignore'])
                rules = [r for r in hosting['rewrites'] if r['source'] == '/' + prefix + '{,/**}']
                self.assertEqual(len(rules), 1)
                self.assertEqual(rules[0]['function'], {'functionId': 'conectaTracking', 'region': 'southamerica-east1'})
            self.assertTrue(classic.exists(), 'O original continua disponível para compilar a função.')


if __name__ == '__main__':
    unittest.main()
