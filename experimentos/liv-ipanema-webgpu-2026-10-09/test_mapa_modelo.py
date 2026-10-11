"""Contrato GLB/autoria, preservação regional e reprodução do mapa adaptado."""
import base64
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import re
import unittest
import zlib

import preparar_mapa

EXP = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('registrar_mapa', EXP / 'modelo/registrar_mapa.py')
registry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registry)


class MapModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = json.loads((EXP / 'modelo/variante/modelo.json').read_bytes())
        cls.glb = (EXP / 'modelo/variante/liv-contorno.glb').read_bytes()

    def test_real_glb_matches_all_geometry_and_instances(self):
        result = registry.check(self.glb, self.model)
        self.assertEqual((result['meshes'], result['instances']), (88, 1826))

    def test_previous_building_is_rejected(self):
        with self.assertRaises(AssertionError):
            registry.check((EXP / 'site-baseline/liv-ipanema.glb').read_bytes(), self.model)

    def test_entrance_glb_matches_its_own_authoring_and_rejects_previous_gate(self):
        folder=EXP/'modelo/entrada/candidato'
        model=json.loads((folder/'modelo.json').read_bytes())
        result=registry.check((folder/'liv-contorno.glb').read_bytes(),model)
        self.assertEqual((result['meshes'],result['instances'],result['materials']),(97,1815,54))
        with self.assertRaises(AssertionError):
            registry.check(self.glb,model)

    def test_changed_geometry_is_rejected(self):
        changed = deepcopy(self.model)
        changed['geometries']['cobertura-bege']['position'][0] += .1
        with self.assertRaises(AssertionError):
            registry.check(self.glb, changed)

    def test_changed_placement_is_rejected(self):
        changed = deepcopy(self.model)
        changed['groups'][0]['instances'][0]['matrix'][12] += .1
        with self.assertRaises(AssertionError):
            registry.check(self.glb, changed)

    def test_changed_material_is_rejected(self):
        changed = deepcopy(self.model)
        changed['materials']['MAT-bege']['roughness'] = .1
        with self.assertRaises(AssertionError):
            registry.check(self.glb, changed)

    def test_regional_blocks_and_application_are_preserved(self):
        original = (EXP / 'site-baseline/mapa-liv-ipanema-5km.html').read_text('utf8')
        output, manifest = preparar_mapa.build()
        adapted = output.decode('utf8')
        blocks = lambda html: {attrs: text for attrs, text in re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>', html)
                               if 'id="__app"' not in attrs and 'data-zip=' in attrs}
        self.assertEqual(blocks(original), blocks(adapted))
        app = zlib.decompress(base64.b64decode(re.search(preparar_mapa.APP_PATTERN, adapted)[2]), -15).decode('utf8')
        old_app = zlib.decompress(base64.b64decode(re.search(preparar_mapa.APP_PATTERN, original)[2]), -15).decode('utf8')
        prefix, rest = app.split('\n' + old_app[:80], 1)
        restored = (old_app[:80] + rest).replace('LivVerifiedMap.load(', "new THREE.GLTFLoader().load('liv-ipanema.glb',")
        restored = restored.replace('\n          Object.assign(model.metadata,gltf.scene.userData.livMapAsset);', '')
        restored = restored.replace('\n  const livFlight = window.__livMapFlight = (window.__livMapFlight || 0) + 1;', '')
        restored = restored.replace('\n    if (livFlight !== window.__livMapFlight) return;', '')
        restored = restored.replace('\n            window.__livMapFlight = (window.__livMapFlight || 0) + 1;', '')
        self.assertEqual(restored, old_app)
        self.assertIn("location.hash === '#contorno'", prefix)
        self.assertEqual(manifest['models']['contorno']['sourceModelSHA256'], registry.sha((EXP/'modelo/variante/modelo.json').read_bytes()))

    def test_repeated_build_does_not_change_bytes_or_files(self):
        before = {p:p.stat().st_mtime_ns for p in [EXP/'mapa-runtime/mapa-liv-ipanema-5km.html', EXP/'mapa-runtime/manifest.json']}
        first = preparar_mapa.write()
        self.assertEqual(preparar_mapa.write(), first)
        self.assertEqual(before, {p:p.stat().st_mtime_ns for p in before})


if __name__ == '__main__':
    unittest.main()
