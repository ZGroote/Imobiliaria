"""Provas do payload dos tiles, não apenas da imagem renderizada."""
import base64
import gzip
import json
from pathlib import Path
import unittest

from recorte_regional import RecorteRegional
from tiles_circulares import encoded, integers, recortar_tiles

PASTA = Path(__file__).resolve().parent


class TileTests(unittest.TestCase):
    def fixture(self, name, parcels):
        base = PASTA/'qa-tiles'/name
        source, target = base/'source', base/'target'
        (source/'quintais/base').mkdir(parents=True,exist_ok=True)
        (source/'quintais/base/0_0.bin').write_bytes(gzip.compress(json.dumps(parcels).encode(),mtime=0))
        cut = RecorteRegional([0,0],100)
        cut._building_geometries = []
        pack = {'assets':[{'size':[4,4,4]} for _ in range(65)],
                'props':[{'size':[4,4,4]}],'quantization':1000,
                'aerial':{'spans':[6]},'parcelTiles':{'prefix':'quintais/base/','keys':['0_0'],'size':160}}
        report = recortar_tiles(pack,source,target,cut)
        outputs = [json.loads(gzip.decompress((target/pack['parcelTiles']['prefix']/(k+'.bin')).read_bytes()))
                   for k in pack['parcelTiles']['keys']]
        return pack,report,[p for group in outputs for p in group]

    @staticmethod
    def parcel(x,z,gp,pp=(),color=3):
        return {'lot':7,'x':x,'z':z,'style':0,'gp':encoded(gp),
                'gc':base64.b64encode(bytes([color]*(len(gp)//6))).decode(),'pp':encoded(pp)}

    def test_crossing_triangle_reanchored_colors_preserved_and_every_vertex_inside(self):
        p = self.parcel(120,0,[-30000,0,0,0,-20000,10000])
        _,report,out = self.fixture('crossing',[p])
        self.assertEqual(len(out),1)
        self.assertLessEqual(report['max_raio_m'],100)
        self.assertLessEqual(out[0]['x']**2+out[0]['z']**2,10000)
        self.assertTrue(all(v==3 for v in base64.b64decode(out[0]['gc'])))
        gp=integers(out[0]['gp'])
        self.assertEqual(len(gp)//6,len(base64.b64decode(out[0]['gc'])))
        for i in range(0,len(gp),2):
            self.assertLessEqual((out[0]['x']+gp[i]/1000)**2+(out[0]['z']+gp[i+1]/1000)**2,10000.00001)

    def test_prop_is_absolute_and_sprite_full_volume_must_be_inside(self):
        p=self.parcel(120,0,[-30000,0,0,0,-20000,10000],
            [65,95000,0,0,1000000,1000000,65,99000,0,0,1000000,1000000])
        _,report,out=self.fixture('props',[p])
        self.assertEqual(report['props_antes'],2)
        self.assertEqual(report['props_depois'],1)
        self.assertEqual(integers(out[0]['pp']),[65,95000,0,0,1000000,1000000])

    def test_empty_outside_tile_is_not_published_or_catalogued(self):
        p=self.parcel(250,0,[0,0,10000,0,0,10000])
        pack,report,out=self.fixture('outside',[p])
        self.assertEqual(out,[])
        self.assertEqual(pack['parcelTiles']['keys'],[])
        self.assertEqual(report['arquivos'],0)

    def test_fully_inside_coordinates_and_color_do_not_change(self):
        p=self.parcel(10,10,[0,0,10000,0,0,10000],color=2)
        _,_,out=self.fixture('inside',[p])
        self.assertEqual(integers(out[0]['gp']),integers(p['gp']))
        self.assertEqual(out[0]['gc'],p['gc'])
        self.assertEqual([out[0]['x'],out[0]['z']],[10,10])


if __name__=='__main__':
    unittest.main()
