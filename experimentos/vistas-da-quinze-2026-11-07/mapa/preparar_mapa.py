"""Mapa 2D próprio do Vistas da Quinze: o runtime do mapa do LIV (cópia) com os estabelecimentos do entorno e o modelo.

Os dados do LIV/Laranjeiras/Mooca não mudam: tudo sai em site/ do Vistas da Quinze (cópia do preparar_mapa.py do Mooca).
- Estabelecimentos: sao-carlos/poidata.json (OSM + Overture, etapa 0g) num raio de 5 km; sem ele, OpenStreetMap (Overpass) do conjunto, com as categorias da etapa 0f do
  pipeline (pipeline/fontes/pois.py) + mercado, farmácia e saúde, que lá vêm de outra consulta.
  O bruto fica em mapa/osm-pois.json (fora do git); --baixar refaz a consulta.
- Runtime: mapa-2d.js/css, mapa-runtime/mapa-2d.html, mapa-edificio.bundle.js e vendor/maplibre copiados do LIV;
  só o empreendimento padrão e os textos mudam.
python experimentos/vistas-da-quinze-2026-11-07/mapa/preparar_mapa.py [--baixar]
"""
import hashlib
import json
import math
import shutil
import sys
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
EXP = AQUI.parent
ROOT = EXP.parents[1]
LIV = ROOT/'experimentos'/'liv-experimental-2026-10-14'
SITE = EXP/'site'
sys.path.insert(0, str(ROOT))
from pipeline.fontes.pois import categoria as categoria_0f, norm  # noqa: E402

ID, NOME = 'vistas-da-quinze', 'Vistas da Quinze'
RAIO_M = 5000
BRUTO = AQUI/'osm-pois.json'


def centro():
    md = json.loads((EXP/'modelo'/'modelo.json').read_bytes())['metadata']
    (lat0, lon0), (ox, oz) = md['ancoraGeo'], md['origemM']      # origem da cena = centro do conjunto
    return [round(lat0-oz/111320, 7), round(lon0+ox/(111320*math.cos(math.radians(lat0))), 7)]


def baixar(c):
    q = f'''[out:json][timeout:180];
(nwr(around:{RAIO_M},{c[0]},{c[1]})["name"][~"^(amenity|shop|leisure|tourism|office|healthcare)$"~"."];);
out center tags;'''
    req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(),
                                 headers={'User-Agent': 'imobiliaria-mapa/1.0'})
    BRUTO.write_bytes(urllib.request.urlopen(req, timeout=300).read())


def categoria(t):
    nome = norm(t.get('name'))
    if nome.startswith(('upa ', 'ama ')) or ' upa ' in f' {nome} ':
        return 'upa'
    if 'unimed' in nome:
        return 'unimed'
    if nome.startswith('ubs ') or 'unidade basica' in nome:
        return 'ubs'
    a, s = t.get('amenity'), t.get('shop')
    if a == 'hospital' or t.get('healthcare') == 'hospital':
        return 'hospital'
    if a == 'pharmacy' or s == 'chemist' and 'drog' in nome:
        return 'farmacia'
    if s == 'supermarket':
        return 'supermercado'
    if s == 'wholesale':
        return 'atacado'
    if s in ('convenience', 'greengrocer'):
        return 'mercado'
    return categoria_0f(t)


def metros(a, b):
    dy = (a[0]-b[0])*111320
    dx = (a[1]-b[1])*111320*math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


CIDADE = ROOT/'sao-carlos'/'poidata.json'   # OSM + Overture Places da cidade (etapa 0g): 8.208 contra ~800 do OSM


def pois(c, categorias):
    if CIDADE.exists():   # São Carlos já tem a lista boa, a mesma do mapa da cidade
        return [p for p in json.loads(CIDADE.read_bytes()) if p['c'] in categorias and metros(c, [p['lat'], p['lon']]) <= RAIO_M]
    els = json.loads(BRUTO.read_bytes())['elements']
    vistos, out = set(), []
    for e in els:
        t = e.get('tags', {})
        cat = categoria(t)
        lat = e.get('lat', (e.get('center') or {}).get('lat'))
        lon = e.get('lon', (e.get('center') or {}).get('lon'))
        if cat not in categorias or lat is None or metros(c, [lat, lon]) > RAIO_M:
            continue
        k = (norm(t['name']), round(lat, 4), round(lon, 4))
        if k in vistos:
            continue
        vistos.add(k)
        rua, num = t.get('addr:street'), t.get('addr:housenumber')
        out.append({'n': t['name'], 'c': cat, 'lat': round(lat, 6), 'lon': round(lon, 6),
                    'a': (rua+(', '+num if num else '')) if rua else None,
                    'h': t.get('opening_hours'), 't': t.get('phone'), 'w': t.get('website')})
    return out


def copiar_runtime():
    for rel in ['mapa-2d.css', 'mapa-edificio.bundle.js', 'vendor/maplibre/maplibre-gl.js',
                'vendor/maplibre/maplibre-gl.css', 'vendor/maplibre/LICENSE.txt']:
        (SITE/rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(LIV/rel, SITE/rel)

    def trocar(rel, pares):
        s = (LIV/rel).read_text(encoding='utf-8')
        for a, b in pares:
            if s.count(a) < 1:
                raise SystemExit(f'{rel}: não achei {a[:60]!r} (o mapa do LIV mudou)')
            s = s.replace(a, b)
        (SITE/rel).parent.mkdir(parents=True, exist_ok=True)
        (SITE/rel).write_text(s, encoding='utf-8')
    trocar('mapa-2d.js', [("data.property.id!=='liv-ipanema'", f"data.property.id!=='{ID}'"),
                          (".get('empreendimento')||'liv-ipanema'", f".get('empreendimento')||'{ID}'")])
    trocar('mapa-runtime/mapa-2d.html', [('<title>LIV Ipanema — mapa do entorno</title>', f'<title>{NOME} — mapa do entorno</title>'),
                                         ('do entorno do LIV Ipanema"', 'do entorno do Vistas da Quinze"'),
                                         ('<strong>LIV Ipanema</strong>', f'<strong>{NOME}</strong>'),
                                         ('href="../maquete-liv-ipanema.html"', 'href="../maquete-vistas.html"'),
                                         ('Centralizar LIV', 'Centralizar')])
    trocar('mapa-retorno.js', [
        ("destination=new URL('./maquete-liv-ipanema.html',location.href);", "destination=new URL('./maquete-vistas.html',location.href);"),
        ("||new URLSearchParams(location.search).get('empreendimento')||'liv-ipanema';", f"||'{ID}';"),
        ("if(!['liv-ipanema','parque-das-laranjeiras'].includes(focusId))", f"if(focusId!=='{ID}')"),
        ("if(focusId==='parque-das-laranjeiras')destination.href=new URL('./maquete-laranjeiras.html',location.href).href;\n", ''),
        ("const focusName=focusId==='parque-das-laranjeiras'?'Parque das Laranjeiras':'LIV Ipanema';", f"const focusName='{NOME}';"),
    ])


def main():
    c = centro()
    if '--baixar' in sys.argv or (not BRUTO.exists() and not CIDADE.exists()):
        baixar(c)
    liv = json.loads((LIV/'mapa-pois.json').read_bytes())
    glb = (EXP/'modelo'/'vistas-mapa.glb').read_bytes()   # mapa/exportar_glb_mapa.py: sem chão nem ruas
    (SITE/'mapa-modelos').mkdir(parents=True, exist_ok=True)
    (SITE/'mapa-modelos/vistas.glb').write_bytes(glb)
    copiar_runtime()
    asset = {'edition': 'base', 'url': 'mapa-modelos/vistas.glb', 'bytes': len(glb), 'sha256': hashlib.sha256(glb).hexdigest()}
    prop = {'id': ID, 'name': NOME, 'center': c, 'rotation': 0.0, 'models': {'base': asset}, 'viewer': None}
    lista = pois(c, liv['categories'])
    data = {'schema': 'liv-map-2d-v1', 'rendererSHA256': hashlib.sha256((SITE/'mapa-edificio.bundle.js').read_bytes()).hexdigest(),
            'models': {'base': asset}, 'property': prop, 'properties': [prop], 'categories': liv['categories'], 'pois': lista,
            'source': {'pois': 'OpenStreetMap (ODbL) + Overture Places (CDLA-Permissive-2.0), raio de 5 km', 'model': 'modelo/vistas-mapa.glb'}}
    (SITE/'mapa-pois.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    por = {}
    for p in lista:
        por[p['c']] = por.get(p['c'], 0)+1
    print(json.dumps({'centro': c, 'pois': len(lista), 'porCategoria': por}, ensure_ascii=False))


if __name__ == '__main__':
    main()
