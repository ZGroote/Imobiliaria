import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
import montar_entrega as package


class Delivery(unittest.TestCase):
    def test_versioned_html_resources_keep_the_local_module_graph(self):
        source='<script src="mapa-retorno.js?rev=cache"></script><link href="viewer-ui.css?rev=2"><script src="viewer.js"></script>'
        self.assertEqual(package.HTML_RESOURCE.findall(source),['mapa-retorno.js','viewer-ui.css','viewer.js'])

    def test_versioned_imports_inventory_the_unversioned_files_and_their_dependencies(self):
        with tempfile.TemporaryDirectory(prefix='liv-inventory-test-') as temporary:
            root=Path(temporary).resolve()
            def write(name,content):
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(content if isinstance(content,str) else json.dumps(content),encoding='utf8')
            write('index.html','<script src="viewer.js?rev=medidas"></script>')
            write('viewer.js',"import {typology} from './tipologias.js?rev=medidas';\n"
                  "import {createPlan2D} from './planta2d.js?rev=medidas#api';\n"
                  "import('./opcionais.js#revision');")
            write('tipologias.js','export const typology={};')
            write('planta2d.js',"import {schedule} from './frame-scheduler.js?rev=2';\nexport const createPlan2D={};")
            write('frame-scheduler.js','export const schedule={};')
            write('opcionais.js',"import('./planta2d.js?rev=outra');")
            for name in ['transfer-worker.js','node_modules/three/build/three.tsl.js','node_modules/three/LICENSE',
                         'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js',
                         'node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
                         'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm',
                         'node_modules/three/examples/jsm/libs/basis/basis_transcoder.js',
                         'node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm']:
                write(name,'fixture')
            for directory,units in [('assets-prova','unidades.json'),
                                    ('modelo/variante/assets','modelo/unidades-contorno.json'),
                                    ('modelo/entrada/candidato/assets','modelo/entrada/unidades-entrada.json')]:
                write(directory+'/manifest.json',{'schema':'liv-proof-manifest-v1','files':{}});write(units,{})
            write('assets-ambiente/fixture.bin','ambiente')
            write('assets-ambiente/manifest.json',{'file':{'name':'fixture.bin',**package.identity(b'ambiente')}})
            write('assets-materiais/manifest.json',{'schema':'liv-pbr-fixture-v1','files':{}})
            transfer={'schema':'liv-transfer-manifest-v1','files':[]}
            canonical=json.dumps(transfer,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
            write('transfer-manifest.json',{**transfer,'version':package.identity(canonical)['sha256']})
            for name in ['comercial.json','vinculos.json','estoque-config.json','estoque-demo-config.json',
                         'mapa-runtime/manifest.json','mapa-parcela.json']:
                write(name,{})
            write('sales.js','fixture');write('estoque-build.json',{'schema':'liv-sales-bundle-v1',
                  'file':{'path':'sales.js',**package.identity(b'fixture')}})
            write('site-baseline/modelo.glb','web geometry')
            write('site-baseline/modelo.blend','local authoring source')
            write('manifesto.json',{'arquivos':{
                'modelo.glb':package.identity(b'web geometry'),
                'modelo.blend':package.identity(b'local authoring source')}})
            with patch.object(package,'PAGES',['index.html']):files=package.inventory(root)
            for name in ['viewer.js','tipologias.js','planta2d.js','frame-scheduler.js','opcionais.js']:
                self.assertEqual(files[name],package.identity((root/name).read_bytes()))
            self.assertTrue(all('?' not in name and '#' not in name for name in files))
            self.assertIn('site-baseline/modelo.glb',files)
            self.assertNotIn('site-baseline/modelo.blend',files)
            self.assertFalse((root/'entregas').exists())

    def test_unknown_paths(self):
        for name in ['../fora', '/raiz', 'C:/fora', 'ok/../fora', 'ok\\fora', 'a?query', '']:
            with self.assertRaises(ValueError): package.local_path(name)
        self.assertEqual(package.local_path('assets/cena.gz'), 'assets/cena.gz')

    def test_failure_preserves_existing_release_and_atomic_staging(self):
        with tempfile.TemporaryDirectory(prefix='liv-delivery-test-') as temporary:
            root=Path(temporary).resolve()
            self.assertTrue(root.name.startswith('liv-delivery-test-'))
            (root/'comercial.json').write_text('{"status":"ausente"}',encoding='utf8')
            (root/'vinculos.json').write_text('{"status":"ausente"}',encoding='utf8')
            (root/'estoque-config.json').write_text('{"propertyId":null}',encoding='utf8')
            (root/'viewer.js').write_bytes(b'primeira versao')
            inventory={'viewer.js':package.identity((root/'viewer.js').read_bytes())}
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value=inventory):
                created=package.build('liv-teste',root);self.assertFalse(created['reused'])
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value=dict(inventory)):
                self.assertTrue(package.build('liv-teste',root)['reused'])
            target=root/'entregas/liv-teste/site'
            (target/'desconhecido.txt').write_bytes(b'preservar')
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value=dict(inventory)):
                with self.assertRaises(ValueError):package.build('liv-teste',root)
            self.assertEqual((target/'desconhecido.txt').read_bytes(),b'preservar')
            # Fail after inventory validation but before promotion: no new target.
            bad={'viewer.js':{'bytes':9,'sha256':'0'*64}}
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value=bad):
                with self.assertRaises(ValueError):package.build('liv-falha',root)
            self.assertFalse((root/'entregas/liv-falha').exists())
            self.assertFalse(any(p.name.startswith('.liv-entrega-') for p in (root/'entregas').iterdir()))

    def test_metadata_cannot_claim_physical_qualification_on_reuse(self):
        with tempfile.TemporaryDirectory(prefix='liv-delivery-test-') as temporary:
            root=Path(temporary).resolve();self.assertTrue(root.name.startswith('liv-delivery-test-'))
            (root/'comercial.json').write_text('{"status":"ausente"}',encoding='utf8')
            (root/'vinculos.json').write_text('{"status":"ausente"}',encoding='utf8')
            (root/'estoque-config.json').write_text('{"propertyId":null}',encoding='utf8')
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value={}):package.build('liv-meta',root)
            manifest=root/'entregas/liv-meta/site/entrega-manifest.json'
            data=json.loads(manifest.read_bytes());data['physicalMobileQualified']=True
            manifest.write_text(json.dumps(data),encoding='utf8')
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value={}):
                with self.assertRaises(ValueError):package.build('liv-meta',root)

    def test_archive_reuse_and_corruption_do_not_replace_existing_files(self):
        with tempfile.TemporaryDirectory(prefix='liv-delivery-test-') as temporary:
            root=Path(temporary).resolve();self.assertTrue(root.name.startswith('liv-delivery-test-'))
            for name in ['comercial.json','vinculos.json']:(root/name).write_text('{"status":"ausente"}',encoding='utf8')
            (root/'estoque-config.json').write_text('{"propertyId":null}',encoding='utf8')
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value={}):
                result=package.build('liv-zip-teste',root)
            first=package.archive(result);self.assertEqual(package.archive(result),first)
            path=Path(first['path']);self.assertEqual(path.parent,root/'entregas')
            path.write_bytes(b'corrompido')
            with self.assertRaises(zipfile.BadZipFile):package.archive(result)
            self.assertEqual(path.read_bytes(),b'corrompido')


if __name__=='__main__':unittest.main()
