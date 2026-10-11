import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
import montar_entrega as package


class Delivery(unittest.TestCase):
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
            with patch.object(package,'review_inventory',return_value={}),patch.object(package,'inventory',return_value={}):
                result=package.build('liv-zip-teste',root)
            first=package.archive(result);self.assertEqual(package.archive(result),first)
            path=Path(first['path']);self.assertEqual(path.parent,root/'entregas')
            path.write_bytes(b'corrompido')
            with self.assertRaises(zipfile.BadZipFile):package.archive(result)
            self.assertEqual(path.read_bytes(),b'corrompido')


if __name__=='__main__':unittest.main()
