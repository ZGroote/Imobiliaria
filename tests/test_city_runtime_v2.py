import json, tempfile, unittest
from pathlib import Path
from pipeline.city_runtime_v2 import building_fingerprint, compile_city

class RuntimeV2CompilerTest(unittest.TestCase):
    def test_city_agnostic_index_context_ids_and_independent_chunks(self):
        city={"v":7,"c":[1.25,-2.5],"q":10,"names":["Casa","Rua X"],
              "b":[1,30,3,0,0,20,0,0,20, 2,50,3,100,0,20,0,0,20],
              "bm":[0,0,1],"fa":[90,180],"urbanLots":{"1":[3,5,-2,.5]},
              "bl":[7,7,20,0,1,107,7,20,1,1],
              "r":[6,1,2,0,0,100,0],"g":[3,0,0,20,0,0,20]}
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); src=root/"arbitrary-city.json"; src.write_text(json.dumps(city),encoding="utf-8")
            out=root/"out"; idx=compile_city(src,out,city_id="arbitrary")
            self.assertEqual(idx["cityId"],"arbitrary")
            self.assertEqual(idx["center"],city["c"])
            self.assertEqual(idx["buildingCount"],2)
            self.assertEqual(len(idx["chunks"]),2)
            self.assertNotIn("sao",json.dumps(idx).lower())
            ctx=json.loads((out/"context.json").read_text(encoding="utf-8"))
            self.assertEqual(ctx["r"],city["r"]); self.assertEqual(ctx["g"],city["g"])
            a=json.loads((out/"chunks/000000.json").read_text(encoding="utf-8"))
            b=json.loads((out/"chunks/000001.json").read_text(encoding="utf-8"))
            self.assertEqual(a["b"],city["b"][:9]); self.assertEqual(b["b"],city["b"][9:])
            self.assertEqual(a["bm"],[0,0,1]); self.assertEqual(a["names"],["Casa","Rua X"])
            self.assertEqual(a["fa"],[90]); self.assertEqual(b["fa"],[180])
            self.assertEqual(b["urbanLots"],{"0":[3,5,-2,.5]})
            self.assertEqual(len(a["bid"]),1); self.assertEqual(len(b["bid"]),1)
            self.assertNotEqual(a["bid"][0],b["bid"][0])
            self.assertEqual(idx["context"]["bytes"],(out/"context.json").stat().st_size)
            out2=root/"out2"; compile_city(src,out2,city_id="arbitrary")
            self.assertEqual(a["bid"],json.loads((out2/"chunks/000000.json").read_text())["bid"])

    def test_building_identity_ignores_height_class_start_vertex_and_winding(self):
        a=[1,30,4,0,0,20,0,0,20,-20,0]
        rotated=[3,99,4,20,0,0,20,-20,0,0,-20]
        reversed_ring=[2,10,4,0,0,0,20,20,0,0,-20]
        self.assertEqual(building_fingerprint(a,0),building_fingerprint(rotated,0))
        self.assertEqual(building_fingerprint(a,0),building_fingerprint(reversed_ring,0))

    def test_city_namespace_is_required_and_slug_like(self):
        city={"b":[],"bl":[]}
        with tempfile.TemporaryDirectory() as td:
            src=Path(td)/"x.json"; src.write_text(json.dumps(city))
            with self.assertRaises(ValueError):
                compile_city(src,Path(td)/"out",city_id="cidade:errada")

if __name__=="__main__": unittest.main()
