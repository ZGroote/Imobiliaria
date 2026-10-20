"""A pasta que vai ao Cloud Build (deploy/contexto.py) tem tudo o que cada serviço usa.

Sem Docker aqui, o teste roda o próprio trabalho dentro da pasta montada: a prévia 3D inteira
(Python + a sonda em Node) para as leituras, e a carga dos módulos para os dois serviços. Se a
lista de deploy/contexto.py esquecer um arquivo, quebra aqui antes de quebrar no Cloud Run.
"""
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest

RAIZ = Path(__file__).resolve().parents[1]
C = runpy.run_path(str(RAIZ / 'deploy/contexto.py'))
FIXTURES = RAIZ / 'tests/fixtures'


class ContextoTests(unittest.TestCase):
    def test_pasta_ocupada_e_servico_desconhecido_sao_recusados(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'x').write_text('ocupado', encoding='utf-8')
            with self.assertRaises(ValueError):
                C['montar']('rastreabilidade', tmp)
            with self.assertRaises(ValueError):
                C['montar']('outro', Path(tmp) / 'novo')

    def test_rastreabilidade_leva_so_o_servidor_e_carrega(self):
        if not shutil.which('node'):
            raise unittest.SkipTest('sem node')
        with tempfile.TemporaryDirectory() as tmp:
            r = C['montar']('rastreabilidade', Path(tmp) / 'ctx')
            ctx = Path(r['destino'])
            self.assertTrue((ctx / 'Dockerfile').is_file())
            self.assertLess(r['bytes'], 300_000, 'só o servidor e o lock, nada do repositório')
            # firebase-admin só é importado ao iniciar; o resto tem de carregar sem ele
            subprocess.run(['node', '--input-type=module', '-e',
                            "await import('./rastreabilidade/servidor.mjs');await import('./rastreabilidade/modelo.mjs')"],
                           cwd=ctx, check=True, capture_output=True)

    def test_leituras_gera_a_previa_dentro_da_pasta_montada(self):
        if not shutil.which('node'):
            raise unittest.SkipTest('sem node')
        with tempfile.TemporaryDirectory() as tmp:
            r = C['montar']('leituras', Path(tmp) / 'ctx')
            ctx = Path(r['destino'])
            self.assertLess(r['bytes'], 20_000_000, 'sem os 62 MB de v1.5/miniaturas')
            # o modelo TypeScript do editor carrega sem o resto do painel
            subprocess.run(['node', '--input-type=module', '-e',
                            "await import('./painel/src/components/construtor-planta/editorDocument.ts')"],
                           cwd=ctx, check=True, capture_output=True)
            destino = Path(tmp) / 'previa'
            p = subprocess.run([sys.executable, '-m', 'pipeline.gerar_maquete',
                                str(FIXTURES / 'leitura/v1/exemplo-geometrico.json'),
                                '--contexto', str(FIXTURES / 'm1f/contexto-sintetico.json'),
                                '--destino', str(destino), '--json'],
                               cwd=ctx, capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(p.returncode, 0, p.stderr[-2000:])
            self.assertTrue(json.loads(p.stdout.strip().splitlines()[-1]))
            self.assertTrue(any(destino.rglob('*.html')))


if __name__ == '__main__':
    unittest.main()
