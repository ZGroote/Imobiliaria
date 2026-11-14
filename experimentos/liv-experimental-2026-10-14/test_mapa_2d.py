import base64
import hashlib
import json
import re
import unittest
import zlib

import preparar_mapa_2d
import gerar_manifesto_transferencias


class Map2DTest(unittest.TestCase):
    def test_preserva_catalogo_completo_e_categorias(self):
        root = preparar_mapa_2d.ROOT
        source = (root/'site-baseline/mapa-liv-ipanema-5km.html').read_text(encoding='utf8')
        packed = re.search(r'id="__poidata">([\s\S]*?)</script>', source)[1]
        original = json.loads(zlib.decompress(base64.b64decode(packed), -15))
        data = json.loads(preparar_mapa_2d.build())
        self.assertEqual(data['pois'], original)
        self.assertEqual(len(data['categories']), 21)
        self.assertEqual(data['property']['id'], 'liv-ipanema')
        lat, lon = data['property']['center']
        self.assertTrue(-21.99 < lat < -21.98)
        self.assertTrue(-47.93 < lon < -47.92)
        self.assertEqual((root/'mapa-pois.json').read_bytes(), preparar_mapa_2d.build())

    def test_fila_mapa_so_contem_modelos_do_liv_sem_cidade_3d(self):
        manifest = gerar_manifesto_transferencias.build()
        files = [f for f in manifest['files'] if f['group'] == 'map']
        self.assertTrue(any(f['path'] == 'mapa-pois.json' for f in files))
        self.assertFalse(any(f['path'].endswith('.bin') for f in files))
        properties = json.loads((preparar_mapa_2d.ROOT/'mapa-pois.json').read_bytes())['properties']
        self.assertEqual({p['id'] for p in properties}, {'liv-ipanema', 'parque-das-laranjeiras'})
        self.assertEqual({f['path'] for f in files if f['path'].endswith('.glb')}, {m['url'] for p in properties for m in p['models'].values()})
        lara = next(p for p in properties if p['id'] == 'parque-das-laranjeiras')
        self.assertTrue(-21.991 < lara['center'][0] < -21.989)
        self.assertTrue(-47.926 < lara['center'][1] < -47.924)
        self.assertLess(sum(f['bytes'] for f in files if not f['path'].endswith('.glb')), 2200000)
        expected = json.loads((preparar_mapa_2d.ROOT/'mapa-2d-manifest.json').read_bytes())['files']
        for file in files:
            content = (preparar_mapa_2d.ROOT/file['path']).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), expected[file['path']]['sha256'])


if __name__ == '__main__':
    unittest.main()
