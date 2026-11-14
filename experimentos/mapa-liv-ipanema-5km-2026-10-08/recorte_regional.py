"""Pacote regional estrito: geometria interna e amostras raster esparsas.

As coordenadas continuam na origem municipal. O poligono de corte e inscrito
no circulo, com erro de borda inferior a cinco centimetros. Bibliotecas locais
reutilizaveis nao sao feicoes geograficas; placements exigem envelope interno.
"""
import base64
import json
import math
import struct

from shapely import constrained_delaunay_triangles, make_valid
from shapely.geometry import LineString, Polygon
from shapely.prepared import prep

from pipeline.recorte import Recorte


FORMATO = "regional-raster-sparse-v2"


class RecorteRegional(Recorte):
    def __init__(self, centro, raio, unidade=None, cid=None, prefixo_tiles=None,
                 halo_cells=0, geometry_inset_m=0.15, building_inset_m=2.0):
        super().__init__(centro, raio, unidade, cid, prefixo_tiles)
        if not math.isfinite(self.raio) or self.raio <= 0:
            raise ValueError("raio regional deve ser positivo e finito")
        if not all(math.isfinite(v) for v in centro):
            raise ValueError("centro regional deve ser finito")
        if not isinstance(halo_cells, int) or halo_cells < 0:
            raise ValueError("halo legado deve ser inteiro nao negativo")
        # Accepted only for callers of v1; sparse v2 always exports zero halo.
        self.halo_cells = halo_cells
        # Kept for generator compatibility; strict rasters never extend to bounds.
        self.geometry_bounds = None
        self.rasters = {}
        self.circle_sides = max(720, math.ceil(math.pi / math.acos(
            1 - min(0.049 / self.raio, 1))))
        self.boundary_error_m = self.raio * (1 - math.cos(math.pi / self.circle_sides))
        if not all(math.isfinite(v) and v >= 0 for v in (geometry_inset_m, building_inset_m)):
            raise ValueError("margem interna invalida")
        if geometry_inset_m >= self.raio:
            raise ValueError("margem interna maior que o raio")
        self.geometry_inset_m = geometry_inset_m
        self.building_inset_m = building_inset_m
        def circle(radius):
            if radius <= 0:
                return Polygon()
            return Polygon([(self.cx + radius * math.cos(i * 2 * math.pi / self.circle_sides),
                             self.cz + radius * math.sin(i * 2 * math.pi / self.circle_sides))
                            for i in range(self.circle_sides)])
        self._inner_radius = (self.raio - geometry_inset_m) * math.cos(math.pi / self.circle_sides)
        self.circle = circle(self.raio - geometry_inset_m)
        self._prepared_circle = prep(self.circle)
        self._building_circle = circle(self.raio - building_inset_m)
        self._prepared_building_circle = prep(self._building_circle)
        self._urban_source_assets = None
        self._asset_cache = {}
        self._building_geometries = None
        self._ground_mask = None
        self.ground_buffer_m = None
        self.liv_center = (self.cx + 8, self.cz - 6)
        self.relatorio["strict_policy"] = {
            "circle_sides": self.circle_sides, "boundary_error_m": self.boundary_error_m,
            "geometry_inset_m": geometry_inset_m, "building_inset_m": building_inset_m,
            "version": "strict-circle-v3", "ground_policy": "continuous-circle",
        }

    def aplica(self, ident, texto):
        # O legado mantem estes tres blocos inteiros. O override e local a este
        # experimento, sem alterar INTEIROS nem os outros geradores.
        if ident not in ("__poidata", "__elevdata", "__vegetacao"):
            return super().aplica(ident, texto)
        saida = getattr(self, ident.lstrip("_"))(texto)
        self.relatorio[ident] = (len(texto.encode("utf-8")), len(saida.encode("utf-8")))
        return saida

    def poidata(self, texto):
        dados = json.loads(texto)
        if not isinstance(dados, list):
            raise ValueError("POIs devem ser uma lista")
        if self._cid is None:
            raise ValueError("POIs exigem a projecao da cidade")
        ficam = []
        for poi in dados:
            lat, lon = poi.get("lat"), poi.get("lon")
            if lat is None or lon is None:
                continue
            if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lat, lon)):
                raise ValueError("POI com coordenadas invalidas")
            if self.dentro(*self._geo(lon, lat)):
                ficam.append(poi)
        self.relatorio["pois"] = (len(dados), len(ficam))
        return json.dumps(ficam, ensure_ascii=False, separators=(",", ":"))

    def prepare_assets(self, urban_models):
        """Read model envelopes before serializing urbanLots in citydata."""
        pack = json.loads(urban_models) if isinstance(urban_models, str) else urban_models
        self._urban_source_assets = pack.get("assets") or []

    def _asset_bounds(self, asset, quantization):
        key = (asset.get("p"), tuple(asset.get("size") or ()), quantization)
        if key not in self._asset_cache:
            if "p" in asset:
                raw = base64.b64decode(asset["p"], validate=True)
                if len(raw) % 6:
                    raise ValueError("asset com buffer de posicao invalido")
                values = struct.unpack("<" + "h" * (len(raw) // 2), raw)
                xs, zs = values[::3], values[2::3]
                if not xs:
                    raise ValueError("asset sem vertices")
                bounds = [min(xs) / quantization, min(zs) / quantization,
                          max(xs) / quantization, max(zs) / quantization]
            else:
                # Synthetic tests / metadata-only assets; production uses p above.
                size = asset.get("size")
                if not size or len(size) != 3 or not all(math.isfinite(v) and v > 0 for v in size):
                    raise ValueError("asset sem envelope metrico")
                bounds = [-size[0] / 2, -size[2] / 2, size[0] / 2, size[2] / 2]
            self._asset_cache[key] = bounds
        return self._asset_cache[key]

    def placement_inside(self, asset, x, z, theta, sx=1, sz=1, quantization=100):
        if not all(math.isfinite(v) for v in (x, z, theta, sx, sz, quantization)) or quantization <= 0:
            raise ValueError("placement invalido")
        x0, z0, x1, z1 = self._asset_bounds(asset, quantization)
        co, si = math.cos(theta), math.sin(theta)
        return all(self.dentro(x + co * u * sx + si * v * sz,
                              z - si * u * sx + co * v * sz)
                   for u, v in ((x0, z0), (x0, z1), (x1, z1), (x1, z0)))

    def _ground(self):
        if self._ground_mask is None:
            self._ground_mask = self.circle
            self._prepared_ground = self._prepared_circle
        return self._ground_mask

    @staticmethod
    def _polygons(geometry):
        if geometry.is_empty:
            return []
        if geometry.geom_type == "Polygon":
            return [geometry]
        if hasattr(geometry, "geoms"):
            return [p for part in geometry.geoms for p in RecorteRegional._polygons(part)]
        return []

    def _clip_geometry(self, geometry, ground=False, buildings=False):
        boundary = self._building_circle if buildings else self.circle
        prepared = self._prepared_building_circle if buildings else self._prepared_circle
        if geometry.is_empty or not prepared.intersects(geometry):
            return []
        if not geometry.is_valid:
            geometry = make_valid(geometry)
        result = geometry if prepared.covers(geometry) else geometry.intersection(boundary)
        if ground:
            mask = self._ground()
            result = result if self._prepared_ground.covers(result) else result.intersection(mask)
        return [p for p in self._polygons(result) if p.area > 1e-10]

    def _polygon_parts(self, points, ground=False, buildings=False):
        if len(points) < 3:
            return []
        parts = self._clip_geometry(Polygon(points), ground, buildings)
        rings = []
        for polygon in parts:
            if polygon.interiors:
                rings.extend([list(t.exterior.coords)[:-1]
                              for t in constrained_delaunay_triangles(polygon).geoms])
            else:
                rings.append(list(polygon.exterior.coords)[:-1])
        def signed_area(ring):
            return sum(x * zz - xx * z for (x, z), (xx, zz) in zip(ring, ring[1:] + ring[:1]))
        original_sign = signed_area(list(points))
        return [ring if signed_area(ring) * original_sign >= 0 else list(reversed(ring)) for ring in rings]

    @staticmethod
    def _number(value):
        # Reconstructing a source integer through meters introduces binary
        # residue. Remove only numerical noise, never quantize clipped points.
        nearest = round(value)
        return int(nearest) if abs(value - nearest) < 1e-7 else value

    @staticmethod
    def _encode(points, q):
        values, previous = [], (0, 0)
        for x, z in points:
            current = (x * q, z * q)
            values.extend([RecorteRegional._number(current[0] - previous[0]),
                           RecorteRegional._number(current[1] - previous[1])])
            previous = current
        return values

    @staticmethod
    def _decode(values, start, n, factor):
        x = z = 0
        points = []
        for i in range(start, start + n * 2, 2):
            x += values[i] * factor
            z += values[i + 1] * factor
            points.append((x, z))
        return points

    def citydata(self, texto):
        original = json.loads(texto)
        c = json.loads(texto)
        q = float(c.get("q", 10))
        if not math.isfinite(q) or q <= 0:
            raise ValueError("quantizacao da cidade invalida")
        records, i = [], 0
        b = c["b"]
        while i < len(b):
            color, height, n = b[i:i + 3]
            points = self._decode(b, i + 3, n, 1 / q)
            records.append((color, height, points))
            i += 3 + 2 * n
        lots = c.get("urbanLots") or {}
        if lots and self._urban_source_assets is None:
            raise RuntimeError("citydata com urbanLots exige prepare_assets antes do recorte")
        built, blocks, sources, old_to_new, geometries = [], [], [], {}, []
        groups = c.get("bl") or [0, 0, 0, 0, len(records)]
        for k in range(0, len(groups), 5):
            first, count = groups[k + 3:k + 5]
            block_start, block_points = len(sources), []
            for old in range(first, first + count):
                color, height, points = records[old]
                for ring in self._polygon_parts(points, buildings=True):
                    new = len(sources)
                    sources.append(old)
                    old_to_new.setdefault(old, []).append(new)
                    built.extend([color, height, len(ring)] + self._encode(ring, q))
                    block_points.extend(ring)
                    geometries.append(Polygon(ring))
            if block_points:
                cx = sum(p[0] for p in block_points) / len(block_points)
                cz = sum(p[1] for p in block_points) / len(block_points)
                radius = max(math.hypot(x - cx, z - cz) for x, z in block_points)
                blocks.extend([cx * q, cz * q, radius * q, block_start, len(sources) - block_start])
        used, kept_lots = set(), {}
        for old_string, value in lots.items():
            old = int(old_string)
            if old not in old_to_new:
                continue
            model, x, z, theta = value
            if model < 0 or model >= len(self._urban_source_assets):
                raise ValueError("urbanLot aponta para asset inexistente")
            if self.placement_inside(self._urban_source_assets[model], x, z, theta):
                # A split footprint belongs to one original building; mount its
                # verified model once, not once per clipped connected component.
                kept_lots[str(old_to_new[old][0])] = list(value)
                used.add(model)
        self._urbanos_manter = self._com_piso(used, lots)
        remap = {old: new for new, old in enumerate(self._urbanos_manter)}
        for value in kept_lots.values():
            value[0] = remap[value[0]]
        bm = []
        for j in range(0, len(c.get("bm") or []), 3):
            old, name, address = c["bm"][j:j + 3]
            for new in old_to_new.get(old, []):
                bm.extend([new, name, address])
        c["b"], c["bl"], c["bm"] = built, blocks, bm
        if c.get("fa") is not None:
            c["fa"] = [c["fa"][old] for old in sources]
        if "urbanLots" in c:
            c["urbanLots"] = kept_lots
        self._building_geometries = geometries
        self._ground_mask = None
        c["r"] = self._vias(c.get("r") or [], q, 1)
        c["g"] = self._chaos(c.get("g") or [], q, 1)
        # Remove names belonging only to buildings/roads outside the package.
        used_names = set(c["bm"][1::3]) | set(c["bm"][2::3])
        j = 0
        while j < len(c["r"]):
            used_names.add(c["r"][j + 1])
            j += 3 + c["r"][j + 2] * 2
        name_indices = sorted(n for n in used_names if 0 <= n < len(c.get("names") or []))
        name_remap = {old: new for new, old in enumerate(name_indices)}
        c["names"] = [c["names"][n] for n in name_indices]
        for j in range(0, len(c["bm"]), 3):
            c["bm"][j + 1] = name_remap.get(c["bm"][j + 1], -1)
            c["bm"][j + 2] = name_remap.get(c["bm"][j + 2], -1)
        j = 0
        while j < len(c["r"]):
            c["r"][j + 1] = name_remap.get(c["r"][j + 1], -1)
            j += 3 + c["r"][j + 2] * 2
        # Geometry intentionally changes. Check metadata through explicit source
        # indices, rather than the legacy gate's unchanged-first-vertex identity.
        j = 0
        for new, old in enumerate(sources):
            assert built[j:j + 2] == list(records[old][:2]), "cor/altura do predio alteradas"
            if original.get("fa") is not None:
                assert c["fa"][new] == original["fa"][old], "fa do predio alterada"
            j += 3 + built[j + 2] * 2
        self._strict_city = c
        self._source_indices = sources
        self.relatorio["predios"] = (len(records), len(sources))
        self.relatorio["quarteiroes"] = (len(groups) // 5, len(blocks) // 5)
        self.relatorio["urbanLots"] = (len(lots), len(kept_lots))
        return json.dumps(c, ensure_ascii=False, separators=(",", ":"))

    def urbanModels(self, texto):
        if self._urbanos_manter is None:
            raise RuntimeError("urbanModels exige citydata antes")
        pack = json.loads(texto)
        assets = pack.get("assets") or []
        if self._urban_source_assets is not None and assets != self._urban_source_assets:
            raise ValueError("biblioteca urbana mudou depois de prepare_assets")
        pack = self._corta_modelos(pack)
        return json.dumps(pack, separators=(",", ":"))

    def _vias(self, values, Q, escala):
        out, i, before, after = [], 0, 0, 0
        while i < len(values):
            kind, name, n = values[i:i + 3]
            points = self._decode(values, i + 3, n, escala / Q)
            i += 3 + 2 * n
            before += 1
            fragments = []
            for a, b in zip(points, points[1:]):
                segment = self.clip_segment(a, b)
                if not segment:
                    continue
                a, b = segment
                if fragments and math.dist(fragments[-1][-1], a) < 1e-8:
                    fragments[-1].append(b)
                else:
                    fragments.append([a, b])
            for fragment in fragments:
                out.extend([kind, name, len(fragment)] + self._encode(fragment, Q / escala))
                after += 1
        self.relatorio["roads"] = (before, after)
        return out

    def _chaos(self, values, Q, escala):
        out, i, before, after = [], 0, 0, 0
        while i < len(values):
            n = values[i]
            points = self._decode(values, i + 1, n, escala / Q)
            i += 1 + 2 * n
            before += 1
            for ring in self._polygon_parts(points, ground=True):
                out.extend([len(ring)] + self._encode(ring, Q / escala))
                after += 1
        self.relatorio["ground_polygons"] = (before, after)
        return out

    def clip_segment(self, a, b):
        """Return a clipped full line segment, or None. Coordinates are meters."""
        if math.dist(a, b) <= 1e-10:
            return None
        if all(math.hypot(x - self.cx, z - self.cz) <= self._inner_radius for x, z in (a, b)):
            return [a, b]
        line = LineString([a, b])
        if not self._prepared_circle.intersects(line):
            return None
        result = line.intersection(self.circle)
        if result.geom_type != "LineString" or result.length <= 1e-10:
            return None
        return [tuple(result.coords[0]), tuple(result.coords[-1])]

    def _segmentos(self, texto, passo):
        values = json.loads(texto)
        if not isinstance(values, list) or len(values) % passo:
            raise ValueError("segmentos delta invalidos")
        out, x, z, previous = [], 0, 0, (0, 0)
        for i in range(0, len(values), passo):
            x += values[i]
            z += values[i + 1]
            if passo == 4:
                a, b = (x / 10, z / 10), ((x + values[i + 2]) / 10, (z + values[i + 3]) / 10)
            else:
                angle, width = values[i + 2] / 255 * 2 * math.pi, values[i + 3] / 10
                dx, dz = math.cos(angle) * width / 2, -math.sin(angle) * width / 2
                a, b = (x / 10 - dx, z / 10 - dz), (x / 10 + dx, z / 10 + dz)
            clipped = self.clip_segment(a, b)
            if clipped is None:
                continue
            whole = clipped == [a, b]
            a, b = clipped
            if whole:
                current = (x, z)
                payload = values[i + 2:i + passo]
            elif passo == 4:
                current = (a[0] * 10, a[1] * 10)
                payload = [(b[0] - a[0]) * 10, (b[1] - a[1]) * 10]
            else:
                current = ((a[0] + b[0]) * 5, (a[1] + b[1]) * 5)
                payload = [values[i + 2], math.dist(a, b) * 10, values[i + 4]]
            out.extend(self._number(v) for v in
                       [current[0] - previous[0], current[1] - previous[1]] + payload)
            previous = current
        self.relatorio["walls" if passo == 4 else "gates"] = (len(values) // passo, len(out) // passo)
        return json.dumps(out, separators=(",", ":"))

    def exteriorModels(self, texto):
        pack = json.loads(texto)
        placements = pack.get("placements") or []
        assets, quantization = pack.get("assets") or [], pack.get("quantization", 100)
        kept = []
        for placement in placements:
            model, x, z, theta = placement[:4]
            if not 0 <= model < len(assets):
                raise ValueError("placement exterior sem asset")
            if self.placement_inside(assets[model], x, z, theta, quantization=quantization):
                kept.append(placement)
        pack["placements"] = kept
        tiles = pack.get("parcelTiles") or {}
        size = tiles.get("size", 640)
        keys = []
        original_key_count = len(tiles.get("keys") or [])
        for key in tiles.get("keys") or []:
            i, j = map(int, key.split("_"))
            box = Polygon([(i * size, j * size), ((i + 1) * size, j * size),
                           ((i + 1) * size, (j + 1) * size), (i * size, (j + 1) * size)])
            if self._prepared_circle.intersects(box):
                keys.append(key)
        if tiles:
            tiles["keys"] = keys
            if self.prefixo_tiles:
                tiles["prefix"] = self.prefixo_tiles
        self.relatorio["exteriorModels/placements"] = (len(placements), len(kept))
        self.relatorio["parcelTiles"] = (original_key_count, len(keys))
        return json.dumps(pack, separators=(",", ":"))

    def _triangulo_intersecta(self, pontos):
        raio2 = self.raio * self.raio
        if any((x - self.cx) ** 2 + (z - self.cz) ** 2 <= raio2 for x, z in pontos):
            return True
        sinais = []
        for (ax, az), (bx, bz) in zip(pontos, pontos[1:] + pontos[:1]):
            dx, dz = bx - ax, bz - az
            comprimento2 = dx * dx + dz * dz
            if comprimento2:
                t = max(0.0, min(1.0, ((self.cx - ax) * dx + (self.cz - az) * dz)
                                 / comprimento2))
                if (ax + t * dx - self.cx) ** 2 + (az + t * dz - self.cz) ** 2 <= raio2:
                    return True
            sinais.append(dx * (self.cz - az) - dz * (self.cx - ax))
        # A circle wholly inside a large triangle has no vertices or edges inside.
        # Degenerate triangles are already covered by the segment tests above.
        (ax, az), (bx, bz), (cx, cz) = pontos
        area2 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
        return area2 != 0 and (all(v >= 0 for v in sinais) or all(v <= 0 for v in sinais))

    def clip_triangle(self, points, ground=False):
        """Return triangles clipped to the strict region, preserving winding."""
        if len(points) != 3:
            raise ValueError("triangulo exige tres pontos")
        (ax, az), (bx, bz), (cx, cz) = points
        area2 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
        if abs(area2) < 1e-12:
            return []
        if not self._triangulo_intersecta(list(points)):
            return []
        geom = Polygon(points)
        if self._prepared_circle.covers(geom):
            if not ground or self._prepared_ground_if_ready(geom):
                return [list(points)]
        parts = self._clip_geometry(geom, ground)
        result = []
        for polygon in parts:
            if ground or polygon.interiors:
                candidates = [list(t.exterior.coords)[:-1]
                              for t in constrained_delaunay_triangles(polygon).geoms]
            else:
                ring = list(polygon.exterior.coords)[:-1]
                candidates = [[ring[0], ring[j], ring[j + 1]] for j in range(1, len(ring) - 1)]
            for triangle in candidates:
                a, b, c = triangle
                sign = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
                if abs(sign) < 1e-10:
                    continue
                if sign * area2 < 0:
                    triangle = [a, c, b]
                result.append(triangle)
        return result

    def _prepared_ground_if_ready(self, geometry):
        self._ground()
        return self._prepared_ground.covers(geometry)

    def grounddata(self, texto):
        return self._triangulos(texto, ground=True)

    def _triangulos(self, texto, ground=False):
        valores = json.loads(texto)
        if not isinstance(valores, list) or len(valores) % 6:
            raise ValueError("triangulos devem conter seis coordenadas por registro")
        saida = []
        for i in range(0, len(valores), 6):
            triangulo = valores[i:i + 6]
            pontos = list(zip(triangulo[::2], triangulo[1::2]))
            for clipped in self.clip_triangle(pontos, ground):
                saida.extend(v for point in clipped for v in point)
        self.relatorio["ground_triangles" if ground else "street_triangles"] = (len(valores) // 6, len(saida) // 6)
        return json.dumps(saida, separators=(",", ":"))

    def _janela(self, n, half):
        if not isinstance(n, int) or n < 2 or not math.isfinite(half) or half <= 0:
            raise ValueError("grade raster invalida")
        # The requested circle must fit the source grid; coverage is never invented.
        x0, z0 = self.cx - self.raio, self.cz - self.raio
        x1, z1 = self.cx + self.raio, self.cz + self.raio
        if min(x0, z0) < -half or max(x1, z1) > half:
            raise ValueError("circulo regional ultrapassa a cobertura raster")
        step = 2 * half / (n - 1)
        col0 = max(0, math.ceil((x0 + half) / step))
        row0 = max(0, math.ceil((z0 + half) / step))
        col1 = min(n - 1, math.floor((x1 + half) / step))
        row1 = min(n - 1, math.floor((z1 + half) / step))
        return {
            "row0": row0, "col0": col0,
            "width": col1 - col0 + 1, "height": row1 - row0 + 1,
            "bounds_m": {"x0": -half + col0 * step, "z0": -half + row0 * step,
                         "x1": -half + col1 * step, "z1": -half + row1 * step},
        }

    def _compacta(self, valores, n, half, kind):
        if len(valores) != n * n:
            raise ValueError("numero de celulas incoerente com a grade raster")
        w = self._janela(n, half)
        cortados, indices = [], []
        for row in range(w["row0"], w["row0"] + w["height"]):
            for col in range(w["col0"], w["col0"] + w["width"]):
                x = -half + col * 2 * half / (n - 1)
                z = -half + row * 2 * half / (n - 1)
                if self.dentro(x, z):
                    index = row * n + col
                    indices.append(index)
                    cortados.append(valores[index])
        if not indices:
            raise ValueError("circulo regional nao contem amostras raster")
        info = {
            "format": FORMATO, "kind": kind,
            "source_grid": {"n": n, "half_m": half},
            "indices": indices,
            "center_m": {"x": self.cx, "z": self.cz}, "radius_m": self.raio,
            "outside": "masked", "edge_policy": "nearest-inside",
        }
        self.rasters[kind] = {**info, "source_cells": n * n,
                              "exported_cells": len(cortados),
                              "runtime_cells": n * n}
        self.relatorio[kind + "/cells"] = (n * n, len(cortados))
        return info, cortados

    def vegetacao(self, texto):
        dados = json.loads(texto)
        if dados == [] or dados == {}:
            return texto
        n, half = dados["n"], float(dados["half_m"])
        valores = base64.b64decode(dados["ndvi_b64"], validate=True)
        info, cortados = self._compacta(valores, n, half, "ndvi")
        # Cena/data and municipal grid remain metadata. Bytes correspond only
        # to the listed inside indices; no outside values or halo are exported.
        dados.update(info)
        dados["ndvi_b64"] = base64.b64encode(bytes(cortados)).decode("ascii")
        return json.dumps(dados, ensure_ascii=False, separators=(",", ":"))

    def elevdata(self, texto):
        valores = json.loads(texto)
        if valores == []:
            return texto
        if self._cid is None:
            raise ValueError("relevo exige a configuracao da grade da cidade")
        grade = self._cid._d["relevo_grade"]
        if not isinstance(valores, list) or not all(
                isinstance(v, (int, float)) and math.isfinite(v) for v in valores):
            raise ValueError("relevo deve ser uma lista de numeros finitos")
        info, cortados = self._compacta(valores, grade["n"], float(grade["half_m"]), "elevation")
        info["values"] = cortados
        return json.dumps(info, ensure_ascii=False, separators=(",", ":"))
