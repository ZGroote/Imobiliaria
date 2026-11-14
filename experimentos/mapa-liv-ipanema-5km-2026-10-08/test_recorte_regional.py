"""Strict geographic export: clipping, source identities and sparse raster payloads."""
import base64
import importlib.util
import json
import math
from pathlib import Path
import sys
import unittest

from shapely.geometry import Polygon, Point

PASTA = Path(__file__).resolve().parent
RAIZ = PASTA.parents[1]
sys.path.insert(0, str(RAIZ))
spec = importlib.util.spec_from_file_location("recorte_regional", PASTA / "recorte_regional.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class CidadeTeste:
    _d = {"relevo_grade": {"n": 17, "half_m": 80}}

    def geo_para_mapa(self, lon, lat):
        return lon, -lat


def decode(values, start, n, q=10):
    return mod.RecorteRegional._decode(values, start, n, 1 / q)


def building(points, color=1, height=30):
    return [color, height, len(points)] + mod.RecorteRegional._encode(points, 10)


def empty_city(buildings=(), grounds=(), roads=()):
    b = [v for points in buildings for v in building(points)]
    return {"v": 1, "c": [0, 0], "q": 10, "names": [], "b": b,
            "bl": [0, 0, 10000, 0, len(buildings)] if buildings else [],
            "bm": [], "fa": [0] * len(buildings), "r": list(roads), "g": list(grounds)}


class RegionalTests(unittest.TestCase):
    def setUp(self):
        self.recorte = mod.RecorteRegional((3, -4), 20, cid=CidadeTeste())
        self.ndvi = [(i * 17) % 256 for i in range(17 * 17)]
        self.elev = [row * 13 + col * 7 for row in range(17) for col in range(17)]
        self.veg = {"n": 17, "half_m": 80, "cena": "fixture", "data": "2026-10-08",
                    "ndvi_b64": base64.b64encode(bytes(self.ndvi)).decode()}

    def assert_inside(self, recorte, points, inset=0):
        for x, z in points:
            self.assertLessEqual(math.hypot(x - recorte.cx, z - recorte.cz),
                                 recorte.raio - inset + 1e-8)

    def test_pois_on_boundary_preserve_attributes(self):
        pois = [{"n": "inside", "lat": 4, "lon": 3, "extra": "preserve"},
                {"n": "edge", "lat": 4, "lon": 23},
                {"n": "outside", "lat": 4, "lon": 23.001},
                {"n": "missing", "lat": None, "lon": 3}]
        result = json.loads(self.recorte.aplica("__poidata", json.dumps(pois)))
        self.assertEqual(result, pois[:2])
        self.assertEqual(self.recorte.relatorio["pois"], (4, 2))

    def test_crossing_triangle_has_no_external_vertices_and_preserves_intersection_area(self):
        r = mod.RecorteRegional((0, 0), 1, cid=CidadeTeste(), geometry_inset_m=0, building_inset_m=0)
        points = [(0.5, -2), (0.5, 2), (3, 2)]
        clipped = r.clip_triangle(points)
        self.assertTrue(clipped)
        self.assert_inside(r, [p for triangle in clipped for p in triangle])
        actual = sum(Polygon(triangle).area for triangle in clipped)
        expected = Polygon(points).intersection(r.circle).area
        self.assertAlmostEqual(actual, expected, places=10)
        # The source has clockwise winding, and every emitted triangle keeps it.
        def signed(t):
            a, b, c = t
            return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        self.assertTrue(all(signed(t) < 0 for t in clipped))

    def test_circle_inside_large_triangle_exports_only_inscribed_circle(self):
        r = mod.RecorteRegional((0, 0), 1, cid=CidadeTeste(), geometry_inset_m=0, building_inset_m=0)
        clipped = r.clip_triangle([(-10, -10), (10, -10), (0, 10)])
        self.assert_inside(r, [p for triangle in clipped for p in triangle])
        self.assertAlmostEqual(sum(Polygon(t).area for t in clipped), r.circle.area, places=10)
        self.assertGreaterEqual(r.circle_sides, 720)
        self.assertLess(r.boundary_error_m, 0.05)

    def test_inside_triangle_is_unchanged_outside_and_tangent_degenerate_are_empty(self):
        r = mod.RecorteRegional((0, 0), 1, geometry_inset_m=0, building_inset_m=0)
        points = [(0, 0), (.1, .1), (-.1, .1)]
        self.assertEqual(r.clip_triangle(points), [points])
        self.assertEqual(r.clip_triangle([(2, 2), (4, 2), (2, 4)]), [])
        self.assertEqual(r.clip_triangle([(1, -2), (1, 2), (3, 0)]), [])
        self.assertEqual(r.clip_triangle([(-2, 3), (0, 3), (2, 3)]), [])

    def test_5km_boundary_error_and_quantization_guard(self):
        r = mod.RecorteRegional((-3216.4283207855997, -3179.4802476268346), 5000)
        self.assertLess(r.boundary_error_m, .05)
        self.assertEqual(r.geometry_inset_m, .15)
        self.assertEqual(r.building_inset_m, 2)
        clipped = r.clip_triangle([(r.cx-7000, r.cz-7000), (r.cx+7000, r.cz-7000), (r.cx, r.cz+9000)])
        self.assert_inside(r, [p for triangle in clipped for p in triangle], .15)

    def test_sparse_rasters_export_exact_original_nodes_inside_circle_and_no_halo(self):
        for data, original_values, kind in [
                (json.loads(self.recorte.vegetacao(json.dumps(self.veg))), self.ndvi, "ndvi"),
                (json.loads(self.recorte.elevdata(json.dumps(self.elev))), self.elev, "elevation")]:
            values = list(base64.b64decode(data["ndvi_b64"])) if kind == "ndvi" else data["values"]
            self.assertEqual(data["format"], "regional-raster-sparse-v2")
            self.assertNotIn("window", data)
            self.assertNotIn("halo_cells", data)
            self.assertEqual(data["outside"], "masked")
            self.assertEqual(data["source_grid"], {"n": 17, "half_m": 80.0})
            expected = []
            for row in range(17):
                for col in range(17):
                    if math.hypot(-80 + col * 10 - 3, -80 + row * 10 + 4) <= 20:
                        expected.append(row * 17 + col)
            self.assertEqual(data["indices"], expected)
            self.assertEqual(values, [original_values[i] for i in expected])
        self.assertEqual(json.loads(self.recorte.vegetacao(json.dumps(self.veg)))["cena"], "fixture")

    def test_geometry_bounds_cannot_reintroduce_external_raster_samples(self):
        initial = json.loads(self.recorte.elevdata(json.dumps(self.elev)))
        self.recorte.geometry_bounds = [-9500, -9500, 9500, 9500]
        expanded = json.loads(self.recorte.elevdata(json.dumps(self.elev)))
        self.assertEqual(initial, expanded)

    def test_invalid_grid_and_missing_coverage_fail_explicitly(self):
        r = mod.RecorteRegional((75, 0), 20, cid=CidadeTeste())
        with self.assertRaisesRegex(ValueError, "cobertura"):
            r.vegetacao(json.dumps(self.veg))
        with self.assertRaisesRegex(ValueError, "celulas"):
            self.recorte.elevdata(json.dumps(self.elev[:-1]))

    def test_city_clips_buildings_and_remaps_metadata_and_model_identity(self):
        r = mod.RecorteRegional((0, 0), 20)
        assets = [{"id": "model-%d" % i, "size": [2, 3, 2]} for i in range(80)]
        r.prepare_assets({"assets": assets})
        source = empty_city([[(30, 0), (31, 0), (31, 1), (30, 1)],
                             [(17, -2), (22, -2), (22, 2), (17, 2)],
                             [(-2, -2), (2, -2), (2, 2), (-2, 2)]])
        source.update(names=["external", "edge", "centre", "external-address", "edge-address", "centre-address"],
                      bm=[0, 0, 3, 1, 1, 4, 2, 2, 5], fa=[10, 20, 30],
                      urbanLots={"0": [1, 30, 0, 0], "1": [70, 19.8, 0, 0], "2": [75, 0, 0, 0]})
        result = json.loads(r.citydata(json.dumps(source)))
        self.assertEqual(result["fa"], [20, 30])
        self.assertEqual(result["names"], ["edge", "centre", "edge-address", "centre-address"])
        self.assertEqual(result["bm"], [0, 0, 2, 1, 1, 3])
        self.assertEqual(list(result["urbanLots"]), ["1"])
        models = json.loads(r.urbanModels(json.dumps({"assets": assets})))
        slot = result["urbanLots"]["1"][0]
        self.assertEqual(models["assets"][slot]["id"], "model-75")
        self.assertGreaterEqual(len(models["assets"]), 40)
        i = 0
        while i < len(result["b"]):
            n = result["b"][i+2]
            self.assert_inside(r, decode(result["b"], i+3, n), 2)
            i += 3+n*2
        self.assertEqual(result["bl"][3:5], [0, 2])
        self.assertEqual(r.relatorio["predios"], (3, 2))

    def test_city_with_models_requires_envelopes_before_serialization(self):
        source = empty_city([[(-2, -2), (2, -2), (2, 2), (-2, 2)]])
        source["urbanLots"] = {"0": [0, 0, 0, 0]}
        with self.assertRaisesRegex(RuntimeError, "prepare_assets"):
            self.recorte.citydata(json.dumps(source))

    def test_concave_polygon_splits_into_multiple_records_without_filling_gap(self):
        r = mod.RecorteRegional((0, 0), 10, building_inset_m=0, geometry_inset_m=0)
        # The connecting top bar is outside the circle; two stems remain inside.
        points = [(-8, 0), (-6, 0), (-6, 12), (6, 12), (6, 0), (8, 0), (8, 14), (-8, 14)]
        parts = r._polygon_parts(points)
        self.assertEqual(len(parts), 2)
        self.assertAlmostEqual(sum(Polygon(p).area for p in parts),
                               Polygon(points).intersection(r.circle).area, places=9)

    def test_roads_cross_circle_even_without_inside_vertices_and_keep_attributes(self):
        r = mod.RecorteRegional((0, 0), 10, geometry_inset_m=0)
        encoded = [6, 4, 2] + r._encode([(-20, 0), (20, 0)], 10)
        clipped = r._vias(encoded, 10, 1)
        self.assertEqual(clipped[:3], [6, 4, 2])
        points = decode(clipped, 3, 2)
        self.assertAlmostEqual(points[0][0], -10)
        self.assertAlmostEqual(points[1][0], 10)
        self.assert_inside(r, points)

    def test_walls_and_gates_cut_endpoints_and_reencode_relative_to_retained_predecessor(self):
        r = mod.RecorteRegional((0, 0), 10, geometry_inset_m=0)
        walls = [-200, 0, 400, 0, 500, 0, 10, 0, -300, 50, 30, 0]
        output = json.loads(r.murosdata(json.dumps(walls)))
        self.assertEqual(len(output), 8)
        x = z = 0
        for i in range(0, len(output), 4):
            x += output[i]; z += output[i+1]
            self.assert_inside(r, [(x/10, z/10), ((x+output[i+2])/10, (z+output[i+3])/10)])
        gate = json.loads(r.portoes(json.dumps([90, 0, 0, 60, 3])))
        self.assertEqual(gate[2], 0)
        self.assertEqual(gate[4], 3)
        self.assertAlmostEqual(gate[0], 80)
        self.assertAlmostEqual(gate[3], 40)
        self.assert_inside(r, [(gate[0]/10-gate[3]/20, 0), (gate[0]/10+gate[3]/20, 0)])

    def test_exterior_placements_require_entire_rotated_asset_envelope_inside(self):
        r = mod.RecorteRegional((0, 0), 10)
        pack = {"assets": [{"id": "test", "size": [4, 2, 4]}],
                "placements": [[0, 0, 0, 0], [0, 9, 0, 0], [0, 8.5, 0, math.pi/4]],
                "parcelTiles": {"size": 10, "keys": ["0_0", "2_2"], "prefix": "before/"}}
        output = json.loads(r.exteriorModels(json.dumps(pack)))
        self.assertEqual(output["placements"], [[0, 0, 0, 0]])
        self.assertEqual(output["parcelTiles"]["keys"], ["0_0"])
        self.assertEqual(r.relatorio["parcelTiles"], (2, 1))

    def test_ground_preserves_empty_field_and_road_inside_circle(self):
        r = mod.RecorteRegional((0, 0), 1000)
        far = [(500, 500), (550, 500), (500, 550)]
        near = [(20, 20), (30, 20), (20, 30)]
        grounds = [3] + r._encode(far, 10) + [3] + r._encode(near, 10)
        city = empty_city([[(-5, -5), (5, -5), (5, 5), (-5, 5)]], grounds)
        result = json.loads(r.citydata(json.dumps(city)))
        self.assertEqual(len(result["g"]), 14)
        triangles = [v for t in [far, near] for p in t for v in p]
        ground = json.loads(r.grounddata(json.dumps(triangles)))
        road = json.loads(r.streetdata(json.dumps(triangles)))
        self.assertEqual(ground, triangles)
        self.assertEqual(road, triangles)
        self.assertEqual(r.relatorio["ground_triangles"], (2, 2))
        self.assertEqual(r.relatorio["ground_polygons"], (2, 2))
        self.assertEqual(r.relatorio["strict_policy"]["ground_policy"], "continuous-circle")

    def test_continuous_ground_covers_centre_without_nearby_buildings(self):
        r = mod.RecorteRegional((0, 0), 1000)
        # Four disconnected houses surround a sufficiently large empty centre.
        houses = [[(x-2, z-2), (x+2, z-2), (x+2, z+2), (x-2, z+2)]
                  for x, z in [(350, 0), (0, 350), (-350, 0), (0, -350)]]
        r.citydata(json.dumps(empty_city(houses)))
        original = [(-800, -800), (800, -800), (0, 900)]
        triangles = r.clip_triangle(original, ground=True)
        self.assertTrue(triangles)
        self.assertTrue(any(Polygon(t).covers(Point(0, 0)) for t in triangles))
        expected = Polygon(original).intersection(r._ground()).area
        self.assertAlmostEqual(sum(Polygon(t).area for t in triangles), expected, places=6)


if __name__ == "__main__":
    unittest.main()
