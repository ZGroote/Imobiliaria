import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from shapely.geometry import box
from ocupacao import lotes_ocupados


def city_with(poly, kind=1):
    points = list(poly.exterior.coords)[:-1]
    data = [kind, 40, len(points)]
    x = z = 0
    for a, b in points:
        nx, nz = round(a*10), round(b*10)
        data += [nx-x, nz-z]
        x, z = nx, nz
    return {'b': data, 'q': 10}


lots = [box(0, 0, 20, 30), box(20, 0, 40, 30)]
assert lotes_ocupados({'b': []}, lots, {}, []) == set()
assert lotes_ocupados(city_with(box(2, 2, 10, 12)), lots, {}, []) == {0}
# A neighbouring building sharing a boundary cannot furnish the vacant lot.
assert lotes_ocupados(city_with(box(20, 2, 30, 12)), lots, {}, []) == {1}
assert lotes_ocupados(city_with(box(16, 2, 24, 12)), lots, {}, []) == set()
assert lotes_ocupados(city_with(box(2, 2, 10, 12), 2), lots, {}, []) == set()
assert lotes_ocupados(city_with(box(2, 2, 3, 12)), lots, {}, []) == set()
city = city_with(box(2, 2, 10, 12))
city['bm'] = [0, 'public building', 0]
assert lotes_ocupados(city, lots, {}, []) == set()
# Replaced houses use their rendered position, not their previous footprint.
assert lotes_ocupados(city, lots, {'0': [0, 30, 15, 0]}, [{'size': [8, 5, 10]}]) == {1}
print('PASS: vacant, occupied, boundary, overlap, non-residential, small footprint, named and replaced buildings')
