import json
import unittest

from pipeline.urban_v2_kit import build_pack_json


class UrbanV2KitTest(unittest.TestCase):
    def test_varied_lightweight_city_house_kit(self):
        raw=build_pack_json()
        pack=json.loads(raw)
        self.assertEqual(pack["version"],1)
        self.assertEqual(pack["lod"],1)
        self.assertTrue(pack["illustrative"])
        self.assertGreaterEqual(len(pack["assets"]),24)
        self.assertLess(len(raw.encode("utf-8")),400_000)
        cats={a["category"] for a in pack["assets"]}
        self.assertEqual(cats,{"casas","sobrados"})
        sizes={tuple(round(v,1) for v in a["size"]) for a in pack["assets"]}
        self.assertGreaterEqual(len(sizes),20)
        widths=[a["size"][0] for a in pack["assets"] if a["category"]=="casas"]
        depths=[a["size"][2] for a in pack["assets"] if a["category"]=="casas"]
        self.assertGreater(max(widths),10)
        self.assertGreater(max(depths),13)
        for a in pack["assets"]:
            self.assertTrue(a["p"] and a["n"] and a["c"] and a["i"])
            self.assertTrue(a["groups"])


if __name__=="__main__":
    unittest.main()
