"""WGS84/SIRGAS2000 (lon, lat) -> UTM 23S (EPSG:31983), em Python puro.

O pyproj do projeto mora no site do usuario e some com `python -I`, por isso a
conversao vai aqui (serie de Kruger, erro < 1 mm dentro do fuso).
"""
import math

_A = 6378137.0
_F = 1 / 298.257222101  # GRS80 (SIRGAS2000); diferenca pro WGS84 e irrelevante aqui
_K0 = 0.9996
_LON0 = math.radians(-45.0)  # meridiano central do fuso 23
_n = _F / (2 - _F)
_AA = _A / (1 + _n) * (1 + _n**2 / 4 + _n**4 / 64)
_ALFA = (_n / 2 - 2 * _n**2 / 3 + 5 * _n**3 / 16, 13 * _n**2 / 48 - 3 * _n**3 / 5, 61 * _n**3 / 240)
_C = 2 * math.sqrt(_n) / (1 + _n)


def para_utm23s(lon, lat):
    fi, dl = math.radians(lat), math.radians(lon) - _LON0
    t = math.sinh(math.atanh(math.sin(fi)) - _C * math.atanh(_C * math.sin(fi)))
    xi, eta = math.atan2(t, math.cos(dl)), math.atanh(math.sin(dl) / math.sqrt(1 + t * t))
    e = eta + sum(a * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, a in enumerate(_ALFA, 1))
    n = xi + sum(a * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, a in enumerate(_ALFA, 1))
    return 500000.0 + _K0 * _AA * e, 10000000.0 + _K0 * _AA * n
