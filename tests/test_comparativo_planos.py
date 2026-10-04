"""Regressões da identidade do experimento e da distinção disco/rede."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PASTA = ROOT / 'experimentos' / 'comparativo-planos-3d'
spec = importlib.util.spec_from_file_location('comparativo', PASTA / 'gerar_planos_comparativo.py')
comparativo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparativo)


class ComparativoTests(unittest.TestCase):
    def preparar(self, pasta):
        fonte = pasta / 'plano-a.html'
        fonte.write_text('<html><head><title>Casa sintética</title></head><body>Maquete</body></html>', encoding='utf-8')
        assets = pasta / 'assets_planob'
        assets.mkdir()
        refs = set(re.findall(r"loader\.load\(assetPath \+ '([^']+)'", comparativo.js_planob_override))
        for ref in refs:
            (assets / ref).write_bytes(b'asset de teste')
        return fonte, refs

    def test_regeneration_is_stable_and_final_manifest_hashes_actual_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            pasta = Path(tmp)
            fonte, _ = self.preparar(pasta)
            comparativo.gerar(fonte, pasta)
            antes = {p.name: p.read_bytes() for p in pasta.glob('*') if p.is_file()}
            comparativo.gerar(fonte, pasta)
            self.assertEqual(antes, {p.name: p.read_bytes() for p in pasta.glob('*') if p.is_file()})
            manifesto = json.loads((pasta / 'manifest.json').read_text(encoding='utf-8'))
            for item in manifesto['arquivos']:
                dado = (pasta / item['arquivo']).read_bytes()
                self.assertEqual(item['bytes'], len(dado))
                self.assertEqual(item['sha256'], hashlib.sha256(dado).hexdigest())
            self.assertFalse(manifesto['geometria_reverificada'])

    def test_missing_asset_refuses_before_rewriting_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            pasta = Path(tmp)
            fonte, refs = self.preparar(pasta)
            antes = fonte.read_bytes()
            (pasta / 'assets_planob' / sorted(refs)[0]).unlink()
            with self.assertRaisesRegex(ValueError, 'Asset ausente'):
                comparativo.gerar(fonte, pasta)
            self.assertEqual(fonte.read_bytes(), antes)
            self.assertFalse((pasta / 'plano-b.html').exists())

    def test_current_demo_has_real_file_identity_and_no_invented_runtime_metrics(self):
        atual = comparativo.medir(PASTA)
        salvo = json.loads((PASTA / 'metricas_comparativo.json').read_text(encoding='utf-8'))
        self.assertEqual(atual, salvo)
        self.assertEqual(len(atual['planos']['b']['assets_referenciados_no_codigo']), 9)
        self.assertEqual(len(atual['inventario_assets']), 11)
        self.assertTrue(all(x == 'NÃO MEDIDO' for x in atual['nao_medido'].values()))
        for item in json.loads((PASTA / 'manifest.json').read_text(encoding='utf-8'))['arquivos']:
            dado = (PASTA / item['arquivo']).read_bytes()
            self.assertEqual(item['sha256'], hashlib.sha256(dado).hexdigest())
        pagina = (PASTA / 'comparativo.html').read_text(encoding='utf-8')
        self.assertNotIn('99,8%', pagina)
        self.assertNotIn('60 FPS', pagina)
        self.assertIn('NÃO MEDIDO', pagina)


if __name__ == '__main__':
    unittest.main()
