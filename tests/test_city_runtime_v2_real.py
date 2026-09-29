import json, tempfile, unittest
from pathlib import Path
from pipeline.city_runtime_v2 import compile_city

class RuntimeV2RealCityTest(unittest.TestCase):
    def test_compile_repository_city_and_report_metrics(self):
        src=Path("sao-carlos/sao-carlos-v7.city.json")
        self.assertTrue(src.exists())
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/"compiled"
            idx=compile_city(src,out,city_id="sao-carlos")
            sizes=[c["bytes"] for c in idx["chunks"]]
            self.assertGreater(len(sizes),0)
            self.assertTrue(all(s>0 for s in sizes))
            ordered=sorted(sizes)
            def pct(p): return ordered[min(len(ordered)-1,int((len(ordered)-1)*p))]
            print("RUNTIME_V2_BENCH",json.dumps({
              "source_bytes":src.stat().st_size,
              "index_bytes":(out/"index.json").stat().st_size,
              "context_bytes":(out/"context.json").stat().st_size,
              "chunks":len(sizes),
              "chunk_total_bytes":sum(sizes),
              "chunk_p50_bytes":pct(.50),
              "chunk_p90_bytes":pct(.90),
              "chunk_p99_bytes":pct(.99),
              "chunk_max_bytes":max(sizes),
              "buildings":sum(c["buildings"] for c in idx["chunks"]),\n              "city_id":idx["cityId"]
            },sort_keys=True))

if __name__=="__main__": unittest.main()
