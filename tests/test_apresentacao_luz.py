"""Confere a correção de iluminação efetivamente empacotada na demonstração."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'experimentos/apresentacao-2026-11-01/site/demo'
APPROVED = ROOT / 'publicacao/correcao-vergas-20261101/payload/liv-classico'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def sampler(source):
    start = source.index('export function createTimeIrradiance(')
    end = source.index('// Equal RGBM', start)
    body = source[start:end]
    # A demonstração usa o renderer NodeMaterial nos dois backends. A revisão
    # publicada também oferece um renderer clássico, que não faz parte dela.
    body = re.sub(r'\s*if\(classicBackend\)return classicAtlas\([^\n]+\);', '', body)
    return re.sub(r'\s+', '', re.sub(r'//[^\n]*', '', body))


class ApresentacaoLuz(unittest.TestCase):
    def test_manifestos_preservam_vinculos_da_geometria_anonimizada(self):
        catalog = read_json(DEMO / 'interiores/catalogo.json')
        for key in ('canto', 'meio'):
            with self.subTest(tipologia=key):
                record = catalog['tipologias'][key]
                path = Path(f'interiores/{key}/luz-horario/manifest.json')
                manifest = read_json(DEMO / path)
                approved = read_json(APPROVED / path)
                self.assertEqual(manifest['wallDenoise'], 'surface-plane-v1')
                self.assertEqual(manifest['sourceSHA256'], record['sourceSHA256'])
                self.assertEqual(manifest['geometrySHA256'], record['files']['compact']['decodedSHA256'])
                for field in ('width', 'height', 'range', 'encoding', 'targets', 'hours'):
                    self.assertEqual(manifest[field], approved[field], field)

    def test_os_30_atlas_sao_os_binarios_corrigidos_e_conferem_com_o_manifesto(self):
        count = 0
        for key in ('canto', 'meio'):
            path = Path(f'interiores/{key}/luz-horario/manifest.json')
            manifest = read_json(DEMO / path)
            approved = read_json(APPROVED / path)
            actual_entries = [*manifest['keys'], manifest['night']]
            approved_entries = [*approved['keys'], approved['night']]
            self.assertEqual(len(actual_entries), len(approved_entries))
            for entry, expected in zip(actual_entries, approved_entries):
                with self.subTest(tipologia=key, atlas=entry['path']):
                    for field in ('path', 'bytes', 'sha256', 'decodedBytes', 'decodedSHA256'):
                        self.assertEqual(entry[field], expected[field], field)
                    packed = (DEMO / entry['path']).read_bytes()
                    self.assertEqual(len(packed), entry['bytes'])
                    self.assertEqual(digest(packed), entry['sha256'])
                    decoded = gzip.decompress(packed)
                    self.assertEqual(len(decoded), entry['decodedBytes'])
                    self.assertEqual(digest(decoded), entry['decodedSHA256'])
                    count += 1
        self.assertEqual(count, 30)

    def test_material_usa_o_mesmo_filtro_rgbm_aprovado(self):
        material = (DEMO / 'material-rgbm.js').read_text(encoding='utf-8')
        approved = (APPROVED / 'material-rgbm.js').read_text(encoding='utf-8')
        self.assertEqual(sampler(material), sampler(approved))
        loader = (DEMO / 'interior-luz-horario.js').read_text(encoding='utf-8')
        self.assertIn('NearestFilter', loader)
        self.assertRegex(loader, r'createTimeIrradiance\(\{[^}]*width[^}]*height')


if __name__ == '__main__':
    unittest.main()
