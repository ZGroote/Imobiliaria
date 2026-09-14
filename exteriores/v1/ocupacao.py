"""Associate residential buildings with parcels; touching neighbours do not qualify."""
from shapely.geometry import Polygon
from shapely.strtree import STRtree
from pipeline.encaixar_casas_lotes import paths, rectangle


def lotes_ocupados(city, lots, placements, assets):
    tree = STRtree(lots)
    occupied = set()
    named = set(city.get('bm', [])[::3])
    for i, (meta, ring) in enumerate(paths(city['b'], 2, city.get('q', 10))):
        placement = placements.get(str(i))
        if placement is not None:
            ai, x, z, theta = placement
            footprint = rectangle(x, z, theta, assets[ai]['size'][0], assets[ai]['size'][2])
        else:
            signed = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring, ring[1:]+ring[:1]))
            if meta[0] != 1 or i in named or signed <= 0:
                continue
            footprint = Polygon(ring)
        if not footprint.is_valid or footprint.area < 20:
            continue
        center = footprint.centroid
        matches = [int(j) for j in tree.query(center) if lots[j].covers(center)
                   and lots[j].intersection(footprint).area >= footprint.area * .97]
        if len(matches) == 1:
            occupied.add(matches[0])
    return occupied
