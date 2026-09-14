import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from receita import validar, validar_referencias
from analisar_fotos import analisar

PART = dict(nome='parede frontal', tipo='caixa', centro=[0, 1.5, 3], tamanho=[5, 3, .2], rotacao_graus=0,
            cor='#AABBCC', vertices=[], triangulos=[], referencias=['fachada.jpg'], estimado=True)


def recipe():
    return dict(versao=1, titulo='Imóvel', observacoes=['Profundidade estimada; fachada observada.'], partes=[copy.deepcopy(PART)])


class ReceitaTests(unittest.TestCase):
    def test_valid_geometry_and_refs(self):
        validar_referencias(validar(recipe()), {'fotos': [{'arquivo': 'fotos/fachada.jpg'}]})

    def test_wrong_property_reference_rejected(self):
        with self.assertRaisesRegex(ValueError, 'inexistente'):
            validar_referencias(recipe(), {'fotos': [{'arquivo': 'fotos/outra.jpg'}]})

    def test_invalid_geometry_is_not_executed(self):
        for key, value in [('centro', [0, float('nan'), 0]), ('tamanho', [2, -3, 4]),
                           ('tipo', '__import__("os").system'), ('rotacao_graus', float('inf'))]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                data = recipe(); data['partes'][0][key] = value; validar(data)

    def test_broken_triangle_rejected(self):
        data = recipe(); p = data['partes'][0]
        p.update(tipo='malha', vertices=[[0, 0, 0], [1, 0, 0], [0, 1, 0]], triangulos=[[0, 1, 8]])
        with self.assertRaisesRegex(ValueError, 'índices'):
            validar(data)

    def test_absent_facade_retains_explanation_and_every_photo(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root / 'fotos').mkdir()
            fotos = []
            for i in range(30):
                relative = f'fotos/foto-{i:02d}.jpg'; (root / relative).write_bytes(b'fixture')
                fotos.append({'arquivo': relative})
            def fake_run(cmd, **kwargs):
                self.assertFalse(kwargs['shell'])
                self.assertEqual(cmd.count('--image'), 30, 'do not sample away the only facade')
                out = Path(cmd[cmd.index('--output-last-message') + 1])
                out.write_text(json.dumps(dict(versao=1, titulo='Sem fachada', observacoes=['Somente interiores nas fotos.'], partes=[])), encoding='utf-8')
                return subprocess.CompletedProcess(cmd, 0)
            with patch('analisar_fotos.subprocess.run', side_effect=fake_run):
                with self.assertRaisesRegex(RuntimeError, 'Somente interiores'):
                    analisar({'fotos': fotos}, root, codex='codex-fixture')
            self.assertFalse((root / 'receita.json').exists())

    def test_cached_images_must_match_hash(self):
        path = Path(__file__).resolve().parents[1] / 'processar_anuncio.py'
        spec = importlib.util.spec_from_file_location('processar_anuncio_test', path)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve(); (root / 'foto.jpg').write_bytes(b'original')
            manifest = {'url': 'https://example.com/1', 'fotos': [{'arquivo': 'foto.jpg', 'sha256': hashlib.sha256(b'original').hexdigest()}]}
            self.assertEqual(module.assinatura(manifest, root)['url'], manifest['url'])
            (root / 'foto.jpg').write_bytes(b'alterada')
            with self.assertRaisesRegex(ValueError, 'alterada'):
                module.assinatura(manifest, root)

    def test_stale_proposal_is_not_reused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root / 'fachada.jpg').write_bytes(b'fixture')
            (root / 'receita.proposta.json').write_text(json.dumps(recipe()), encoding='utf-8')
            with patch('analisar_fotos.subprocess.run', return_value=subprocess.CompletedProcess([], 0)):
                with self.assertRaisesRegex(RuntimeError, 'não terminou'):
                    analisar({'fotos': [{'arquivo': 'fachada.jpg'}]}, root, codex='codex-fixture')
            self.assertFalse((root / 'receita.json').exists())


if __name__ == '__main__':
    unittest.main()
