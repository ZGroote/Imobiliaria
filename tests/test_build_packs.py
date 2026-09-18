import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pipeline.build import pacotes
from pipeline.build.config import resolve


def _config(existentes):
    """Config de mentira: so responde quais peças o renderizador tem."""
    class Fonte:
        def __truediv__(self, nome):
            return SimpleNamespace(exists=lambda nome=nome: nome in existentes)
    return SimpleNamespace(fonte=Fonte())


class PackTests(unittest.TestCase):
    def test_absent_renderer_pieces_produce_no_block(self):
        vazio = _config(set())
        cid = SimpleNamespace(slug='sao-carlos')
        self.assertIsNone(pacotes.urbanos(vazio))
        self.assertIsNone(pacotes.exteriores(vazio, cid))
        self.assertIsNone(pacotes.cadastrados(vazio, cid))
        # sem `urban-models.js` a cidade sai como entrou, sem abrir lote nem muro
        texto = '{"q":10,"b":[]}'
        self.assertEqual(pacotes.com_encaixes(vazio, cid, texto), texto)

    def test_urban_library_merges_the_compact_assets(self):
        cfg = _config({'urban-models.js'})
        with patch.object(pacotes, '_texto', return_value='{"assets":[1,2]}'), \
             patch.object(pacotes, '_json', return_value={'assets': [3]}):
            dados = json.loads(pacotes.urbanos(cfg))
        self.assertEqual(dados['assets'], [1, 2, 3])

    def test_only_sao_carlos_carries_the_measured_outdoor_cadastre(self):
        cfg = _config({'exterior-details.js'})
        arquivos = {'mapa-exteriores.json': {'version': 1},
                    'encaixes.json': {'placements': [{'lot': 7}]},
                    'componentes.json': {'assets': ['muro']},
                    'terrenos-manifesto.json': {'keys': ['t1'], 'parcels': 3, 'size': 160,
                                                'palette': ['#123456']},
                    'atlas-distante.json': {'tiles': 2}}
        def fake_json(caminho):
            return arquivos[str(caminho).replace('\\', '/').rsplit('/', 1)[-1]]
        for slug, encaixes, parcelas in [('sao-carlos', 1, 3), ('araraquara', 0, 0)]:
            with patch.object(pacotes, '_json', side_effect=fake_json), \
                 patch('builtins.open', unittest.mock.mock_open(read_data=b'\x89PNG')):
                pacote = json.loads(pacotes.exteriores(cfg, SimpleNamespace(slug=slug)))
            self.assertEqual(len(pacote['placements']), encaixes, slug)
            self.assertEqual(pacote['parcelTiles']['parcels'], parcelas, slug)
            self.assertEqual(pacote['palette'], ['#123456'], slug)
            self.assertTrue(pacote['aerial']['image'].startswith('data:image/png;base64,'), slug)

    def test_listing_studies_fall_back_to_an_empty_list(self):
        cfg = _config({'listing-models.js'})
        if pacotes.CADASTRADOS.exists():
            with patch.object(pacotes, '_texto', return_value='{"assets":[{"id":"x"}]}'):
                self.assertIn('"id":"x"',
                              pacotes.cadastrados(cfg, SimpleNamespace(slug='sao-carlos')))
        self.assertEqual(json.loads(pacotes.cadastrados(cfg, SimpleNamespace(slug='araraquara'))),
                         {'assets': []})

    def test_the_real_variant_declares_the_three_packs(self):
        cfg = resolve('sao-carlos', 'v16-moveis')
        self.assertTrue(pacotes.usa_urbanos(cfg))
        self.assertIsNotNone(pacotes.cadastrados(cfg, cfg.cidade()))

    def test_placements_come_from_the_prepared_artifact(self):
        """A montagem não refaz o encaixe: ela lê o arquivo preparado, quando ele vale."""
        cfg = resolve('sao-carlos', 'v16-moveis')
        cid = cfg.cidade()
        artefato = pacotes.URBANOS / 'integracao' / ('encaixes-' + cid.slug + '.json')
        if not artefato.exists():
            self.skipTest('sem artefato de encaixe preparado')
        guardado = json.loads(artefato.read_text(encoding='utf-8'))
        with patch('pipeline.encaixar_casas_lotes.compile_placements') as fake:
            fake.return_value = guardado['placements']
            texto = pacotes.com_encaixes(cfg, cid, '{"q":10,"b":[]}')
        self.assertEqual(json.loads(texto)['urbanLots'], guardado['placements'])
        self.assertGreater(len(guardado['placements']), 0)


if __name__ == '__main__':
    unittest.main()
