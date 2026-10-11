"""Portões do bake próprio e preservação do pacote quando uma entrada falha."""
import gzip
import hashlib
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

EXP = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('liv_pacote_interiores', EXP/'gerar_pacote_interiores.py')
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)


class _PackageCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='.liv-reproducao-interiores-', dir=EXP)
        self.root = Path(self.temp.name).resolve()
        self.assertTrue(self.root.is_relative_to(EXP.resolve()))
        catalog = json.loads((EXP/'interiores/catalogo.json').read_bytes())
        paths = {'interiores/catalogo.json', 'interior-renderer.js', 'plantas2d/meio.jpg',
                 'interiores/meio/source.json', 'interiores/meio/bake/manifest.json',
                 'interiores/meio/bake/geometry-compact.json', 'interiores/meio/bake/irradiance.rgbm.gz',
                 'interiores/meio/bake/approval.json'}
        paths.update(a['path'] for a in catalog['shared'].values())
        paths.update(a['path'] for a in catalog['tipologias']['meio']['files'].values())
        for relative in paths:
            target = self.root/relative;target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(EXP/relative, target)
        self.middle = self.root/'interiores/meio'

    def tearDown(self):
        self.assertTrue(self.root.is_relative_to(EXP.resolve()))
        self.temp.cleanup()

    def snapshot(self):
        return {str(p.relative_to(self.root)): (hashlib.sha256(p.read_bytes()).hexdigest(), p.stat().st_mtime_ns)
                for p in self.root.rglob('*') if p.is_file()}

    def rejected_before_writes(self):
        before = self.snapshot()
        with patch.object(pack, 'EXP', self.root), self.assertRaises(ValueError):
            pack.generate('meio')
        self.assertEqual(before, self.snapshot(), 'Uma entrada rejeitada alterou o pacote existente.')

class BakeMeioTests(_PackageCase):
    def test_repeticao_conserva_bytes_e_mtimes(self):
        with patch.object(pack, 'EXP', self.root):
            first = pack.generate('meio');before = self.snapshot();second = pack.generate('meio')
        self.assertEqual(first, second)
        self.assertEqual(before, self.snapshot())
        self.assertEqual(second['tipologias']['meio']['lighting'], 'approved-rgbm')

    def test_fonte_de_outra_unidade_rejeitada_antes_de_gravar(self):
        path = self.middle/'source.json';data = json.loads(path.read_bytes());data['unitSHA256'] = '0'*64
        path.write_bytes(pack.encoded(data));self.rejected_before_writes()

    def test_geometria_uv_do_canto_nao_entra_no_meio(self):
        catalog = json.loads((EXP/'interiores/catalogo.json').read_bytes())
        source = EXP/catalog['tipologias']['canto']['files']['compact']['path']
        (self.middle/'bake/geometry-compact.json').write_bytes(gzip.decompress(source.read_bytes()))
        self.rejected_before_writes()

    def test_atlas_comprimido_valido_mas_alterado_rejeitado(self):
        path = self.middle/'bake/irradiance.rgbm.gz';raw = bytearray(gzip.decompress(path.read_bytes()));raw[123] ^= 1
        path.write_bytes(gzip.compress(raw, mtime=0));self.rejected_before_writes()

    def test_fabrica_alterada_exige_nova_exportacao(self):
        path = self.root/'interior-renderer.js'
        code = path.read_text(encoding='utf-8').replace('function nativeFactory(materials,library){',
            'function nativeFactory(materials,library){\n/* alteração da fábrica no ensaio */')
        path.write_text(code, encoding='utf-8');self.rejected_before_writes()


class CornerRepairTests(_PackageCase):
    def setUp(self):
        super().setUp()
        catalog = json.loads((EXP/'interiores/catalogo.json').read_bytes())
        paths = {'interiores/canto/source.json', 'interiores/canto/bake/manifest.json',
                 'interiores/canto/bake/geometry-compact.json', 'interiores/canto/bake/approval.json',
                 'interiores/canto/bake/irradiance.rgbm.gz'}
        paths.update(a['path'] for a in catalog['tipologias']['canto']['files'].values())
        for relative in paths:
            target=self.root/relative;target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(EXP/relative,target)

    def rejected_before_writes(self):
        before=self.snapshot()
        with patch.object(pack,'EXP',self.root),self.assertRaises(ValueError):
            pack.generate('canto')
        self.assertEqual(before,self.snapshot())

    def test_uniao_canto_reproduz_pacote_sem_alterar_meio(self):
        middle=json.loads((self.root/'interiores/catalogo.json').read_bytes())['tipologias']['meio']
        with patch.object(pack,'EXP',self.root):
            first=pack.generate('canto');before=self.snapshot();second=pack.generate('canto')
        self.assertEqual(first,second);self.assertEqual(before,self.snapshot())
        self.assertEqual(second['tipologias']['meio'],middle)
        self.assertEqual(second['tipologias']['canto']['sourceSHA256'],
                         hashlib.sha256((self.root/'interiores/canto/source.json').read_bytes()).hexdigest())

    def test_aprovacao_canto_antiga_rejeitada_antes_de_gravar(self):
        path=self.root/'interiores/canto/bake/approval.json';data=json.loads(path.read_bytes())
        data['sourceSHA256']='0'*64;path.write_bytes(pack.encoded(data));self.rejected_before_writes()

    def test_receita_uniao_canto_alterada_rejeitada_antes_de_gravar(self):
        path=self.root/'interiores/canto/source.json';data=json.loads(path.read_bytes())
        sources=data['metadata']['moldingRepair']['sources'];sources[next(iter(sources))]='0'*64
        path.write_bytes(pack.encoded(data));self.rejected_before_writes()


if __name__ == '__main__':
    unittest.main()
