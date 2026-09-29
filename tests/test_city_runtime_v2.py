import json, tempfile, unittest
from pathlib import Path
from pipeline.city_runtime_v2 import compile_city

class RuntimeV2CompilerTest(unittest.TestCase):
    def test_city_agnostic_index_and_independent_chunks(self):
        city={"v":7,"c":[1.25,-2.5],"q":10,"names":["A","Rua X"],
              "b":[1,30,3,0,0,20,0,0,20, 2,50,3,100,0,20,0,0,20],
              "bm":[0,0,1],"bl":[7,7,20,0,1,107,7,20,1,1],"r":[],"g":[]}
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); src=root/"arbitrary-city.json"; src.write_text(json.dumps(city),encoding="utf-8")
            idx=compile_city(src,root/"out")
            self.assertEqual(idx["center"],city["c"])
            self.assertEqual(len(idx["chunks"]),2)
            self.assertNotIn("sao",json.dumps(idx).lower())
            a=json.loads((root/"out/chunks/000000.json").read_text(encoding="utf-8"))
            b=json.loads((root/"out/chunks/000001.json").read_text(encoding="utf-8"))
            self.assertEqual(a["b"],city["b"][:9]); self.assertEqual(b["b"],city["b"][9:])
            self.assertEqual(a["bm"],[0,0,1]); self.assertEqual(b["bm"],[])

if __name__=="__main__": unittest.main()
