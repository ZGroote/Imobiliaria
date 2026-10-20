"""Seleção de iluminação e portões de identidade dos bakes consumidos."""
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
        if (EXP/'interior-cornice.js').is_file():paths.add('interior-cornice.js')
        for relative in paths:
            target = self.root/relative;target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(EXP/relative, target)
        self.middle = self.root/'interiores/meio'
        # Lighting-mode tests keep their own fixture state after the real catalog advances.
        with patch.object(pack,'EXP',self.root):pack.generate('meio',middle_lighting='dynamic')

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
    def setUp(self):
        super().setUp()
        # A small, internally qualified fixture tests each gate independently.
        # Never rewrite hashes in the actual authoring/bake artifacts.
        catalog_path = self.root/'interiores/catalogo.json'
        catalog = json.loads(catalog_path.read_bytes())
        unit_bytes = (self.middle/'unidade.json').read_bytes()
        unit = json.loads(unit_bytes)
        recipe_bytes = (self.middle/'recipe.json').read_bytes()
        code = (self.root/'interior-renderer.js').read_text(encoding='utf-8')
        factory = code[code.index('function nativeFactory('):code.index('function bindFrozenFurniture(')]
        mappings = [{'id': f'movel-{i}', 'index': i, 'slots': [i]}
                    for i in range(len(unit['planta']['moveis']))]
        source = {'schema': 'liv-interior-scene-v1', 'unitId': unit['id'],
                  'unitSHA256': pack.digest(unit_bytes),
                  'objects': [{'slot': i, 'furnitureId': m['id']} for i, m in enumerate(mappings)],
                  'metadata': {'nativeRecipeSHA256': pack.digest(recipe_bytes),
                               'nativeAssetsSHA256': {key: asset['sha256'] for key, asset in catalog['shared'].items()},
                               'nativeFactorySHA256': pack.digest(factory.encode()),
                               'nativeDependencySHA256': {name: pack.digest((self.root/name).read_bytes())
                                                          for name in ['interior-cornice.js'] if (self.root/name).is_file()},
                               'source2DSHA256': pack.digest((self.root/'plantas2d/meio.jpg').read_bytes()),
                               'furnitureSlots': mappings}}
        source_bytes = pack.encoded(source)
        compact_bytes = pack.encoded({'unitId': unit['id'], 'unitSHA256': pack.digest(unit_bytes),
                                      'sourceSHA256': pack.digest(source_bytes)})
        approval_bytes = pack.encoded({'approved': True, 'unitSHA256': pack.digest(unit_bytes),
                                       'sourceSHA256': pack.digest(source_bytes)})
        atlas = bytes(range(256))
        light = {'unitId': unit['id'], 'unitSHA256': pack.digest(unit_bytes),
                 'sourceSHA256': pack.digest(source_bytes), 'geometrySHA256': pack.digest(compact_bytes),
                 'geometryApproved': True, 'ready': True, 'colorPass': False,
                 'approvalSHA256': pack.digest(approval_bytes), 'textureSHA256': pack.digest(atlas),
                 'width': 8, 'height': 8}
        (self.middle/'source.json').write_bytes(source_bytes)
        (self.middle/'bake/geometry-compact.json').write_bytes(compact_bytes)
        (self.middle/'bake/approval.json').write_bytes(approval_bytes)
        (self.middle/'bake/manifest.json').write_bytes(pack.encoded(light))
        (self.middle/'bake/irradiance.rgbm.gz').write_bytes(gzip.compress(atlas, mtime=0))
        catalog['tipologias']['meio']['lighting'] = 'approved-rgbm'
        catalog_path.write_bytes(pack.encoded(catalog))

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

    def test_aprovacao_integra_de_outra_cena_nao_aprova_o_meio(self):
        path=self.middle/'bake/approval.json';approval=json.loads(path.read_bytes())
        approval['sourceSHA256']='0'*64;approval_bytes=pack.encoded(approval);path.write_bytes(approval_bytes)
        manifest=self.middle/'bake/manifest.json';light=json.loads(manifest.read_bytes())
        light['approvalSHA256']=pack.digest(approval_bytes);manifest.write_bytes(pack.encoded(light))
        self.rejected_before_writes()

    def test_fabrica_alterada_exige_nova_exportacao(self):
        path = self.root/'interior-renderer.js'
        code = path.read_text(encoding='utf-8').replace('function nativeFactory(materials,library){',
            'function nativeFactory(materials,library){\n/* alteração da fábrica no ensaio */')
        path.write_text(code, encoding='utf-8');self.rejected_before_writes()

    def test_dependencia_nativa_alterada_exige_nova_exportacao(self):
        # A changed imported helper must invalidate an otherwise qualified export.
        (self.root/'interior-cornice.js').write_text('export const cornice = 1;',encoding='utf8')
        before=self.snapshot()
        with patch.object(pack,'EXP',self.root),self.assertRaisesRegex(ValueError,'native dependencies'):
            pack.generate('meio')
        self.assertEqual(before,self.snapshot())

    def test_bake_selecionado_ausente_nao_regride_silenciosamente_para_dinamico(self):
        (self.middle/'bake/manifest.json').unlink()
        before = self.snapshot()
        with patch.object(pack, 'EXP', self.root), self.assertRaises(FileNotFoundError):
            pack.generate('meio')
        self.assertEqual(before, self.snapshot())

    def test_mudanca_explicita_para_dinamico_remove_dependencias_do_bake(self):
        (self.middle/'bake/manifest.json').write_bytes(b'bake indisponivel')
        with patch.object(pack, 'EXP', self.root):
            catalog = pack.generate('meio', middle_lighting='dynamic')
        middle = catalog['tipologias']['meio']
        self.assertEqual(middle['lighting'], 'dynamic')
        self.assertEqual(middle['geometryKind'], 'native-factories')
        self.assertEqual(set(middle['files']), {'unit', 'recipe'})


class DynamicMeioTests(_PackageCase):
    def setUp(self):
        super().setUp()
        path=self.middle/'bake/manifest.json';light=json.loads(path.read_bytes())
        light['unitSHA256']='0'*64;path.write_bytes(pack.encoded(light))

    def test_dinamico_atual_preserva_modo_e_ignora_bake_obsoleto(self):
        self.assertNotEqual(json.loads((self.middle/'bake/manifest.json').read_bytes())['unitSHA256'],
                            pack.digest((self.middle/'unidade.json').read_bytes()))
        with patch.object(pack, 'EXP', self.root):
            first = pack.generate('meio');before = self.snapshot();second = pack.generate('meio')
        self.assertEqual(first, second)
        self.assertEqual(before, self.snapshot())
        self.assertEqual(second['tipologias']['meio']['lighting'], 'dynamic')
        self.assertEqual(second['tipologias']['meio']['geometryKind'], 'native-factories')
        self.assertEqual(set(second['tipologias']['meio']['files']), {'unit', 'recipe'})

    def test_bake_obsoleto_explicitamente_selecionado_e_rejeitado(self):
        before = self.snapshot()
        with patch.object(pack, 'EXP', self.root), self.assertRaisesRegex(ValueError, 'identity/approval'):
            pack.generate('meio', middle_lighting='approved-rgbm')
        self.assertEqual(before, self.snapshot())

    def test_artefatos_de_bake_inuteis_podem_estar_ausentes(self):
        for path in (self.middle/'bake').iterdir():
            path.unlink()
        (self.middle/'source.json').unlink()
        with patch.object(pack, 'EXP', self.root):
            catalog = pack.generate('meio', middle_lighting='dynamic')
        self.assertEqual(catalog['tipologias']['meio']['lighting'], 'dynamic')


class CornerRepairTests(_PackageCase):
    def setUp(self):
        super().setUp()
        catalog = json.loads((EXP/'interiores/catalogo.json').read_bytes())
        paths = {'interiores/canto/source.json', 'interiores/canto/bake/manifest.json',
                 'interiores/canto/bake/geometry-compact.json', 'interiores/canto/bake/approval.json',
                 'interiores/canto/bake/irradiance.rgbm.gz'}
        paths.update(a['path'] for a in catalog['tipologias']['canto']['files'].values())
        source_metadata=json.loads((EXP/'interiores/canto/source.json').read_bytes())['metadata']
        if source_metadata.get('continuousCorniceRepair'):
            paths.add('interiores/canto/'+source_metadata['continuousCorniceRepair']['geometryQA']['path'])
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

    def test_canto_nao_revalida_bake_de_meio_fora_do_escopo(self):
        path = self.root/'interiores/catalogo.json'
        catalog = json.loads(path.read_bytes())
        catalog['tipologias']['meio']['lighting'] = 'approved-rgbm'
        path.write_bytes(pack.encoded(catalog))
        (self.middle/'bake/manifest.json').write_bytes(b'bake indisponivel')
        before = {str(p.relative_to(self.middle)): p.read_bytes() for p in self.middle.rglob('*') if p.is_file()}
        with patch.object(pack, 'EXP', self.root):
            result = pack.generate('canto')
        self.assertEqual(result['tipologias']['meio'], catalog['tipologias']['meio'])
        self.assertEqual(before, {str(p.relative_to(self.middle)): p.read_bytes() for p in self.middle.rglob('*') if p.is_file()})

    def test_duas_tipologias_preservam_canto_aprovado_e_meio_dinamico(self):
        with patch.object(pack, 'EXP', self.root):
            catalog = pack.generate()
        self.assertEqual(catalog['tipologias']['canto']['lighting'], 'approved-rgbm')
        self.assertEqual(catalog['tipologias']['meio']['lighting'], 'dynamic')

    def test_aprovacao_canto_antiga_rejeitada_antes_de_gravar(self):
        path=self.root/'interiores/canto/bake/approval.json';data=json.loads(path.read_bytes())
        data['sourceSHA256']='0'*64;path.write_bytes(pack.encoded(data));self.rejected_before_writes()

    def test_receita_uniao_canto_alterada_rejeitada_antes_de_gravar(self):
        path=self.root/'interiores/canto/source.json';data=json.loads(path.read_bytes())
        sources=data['metadata']['moldingRepair']['sources'];sources[next(iter(sources))]='0'*64
        path.write_bytes(pack.encoded(data));self.rejected_before_writes()

    def test_rodateto_continuo_exige_linhagem_do_canto_aprovado(self):
        path=self.root/'interiores/canto/source.json';data=json.loads(path.read_bytes())
        data['metadata']['continuousCorniceRepair']={'parentSourceSHA256':'0'*64,
            'unitSHA256':data['unitSHA256'],'rawUnitPreserved':True,'sources':{}}
        path.write_bytes(pack.encoded(data));before=self.snapshot()
        with patch.object(pack,'EXP',self.root),self.assertRaisesRegex(ValueError,'approved parent/unit/helper'):
            pack.generate('canto')
        self.assertEqual(before,self.snapshot())


if __name__ == '__main__':
    unittest.main()
