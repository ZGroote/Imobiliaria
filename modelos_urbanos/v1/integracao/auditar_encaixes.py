"""Confere todos os encaixes contra fontes, muros e outros encaixes."""
import json
import sys
from pathlib import Path
from shapely.geometry import Polygon, LineString, shape
from shapely.ops import transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from padrao.cidade import carrega
from pipeline.encaixar_casas_lotes import paths, rectangle

cid = carrega('sao-carlos')
data = json.loads((Path(__file__).parent/'encaixes-sao-carlos.json').read_text())
city = json.loads(Path(cid.caminho('city_saida')).read_text(encoding='utf-8'))
assets = json.loads((ROOT/'modelos_urbanos/v1/mapa-casas.json').read_text())['assets']
original = [Polygon(r) for _,r in paths(city['b'],2,city['q'])]
original_tree = STRtree(original)
lots = [transform(cid.geo_para_mapa,shape(f['geometry'])) for f in
        json.loads(Path(data['source']).read_text())['features']]
lot_tree = STRtree(lots)
raw = json.loads(Path(cid.caminho('muros')).read_text())
walls = []; x = z = 0
for i in range(0,len(raw),4):
    x += raw[i]; z += raw[i+1]
    walls.append(LineString([(x/10,z/10),((x+raw[i+2])/10,(z+raw[i+3])/10)]))
wall_tree = STRtree(walls)
boxes = []; ids = []; bad = dict(lot=0,wall=0,building=0,models=0)
for key, (ai,x,z,theta) in data['placements'].items():
    i = int(key); a = assets[ai]
    box = rectangle(x,z,theta,a['size'][0],a['size'][2])
    boxes.append(box); ids.append(i)
    bad['lot'] += not any(lots[j].covers(box) for j in lot_tree.query(box))
    bad['wall'] += len(wall_tree.query(box,predicate='intersects')) > 0
    bad['building'] += any(int(j)!=i and box.intersection(original[j]).area>.001
                           for j in original_tree.query(box,predicate='intersects'))
tree = STRtree(boxes)
for i,box in enumerate(boxes):
    bad['models'] += any(int(j)>i and box.intersection(boxes[j]).area>.001
                         for j in tree.query(box,predicate='intersects'))
report = dict(placements=len(boxes),bad=bad,scale=1,
              mean_envelope_m2=round(sum(p.area for p in boxes)/max(1,len(boxes)),2))
print(json.dumps(report))
(Path(__file__).parent/'validacao-encaixes.json').write_text(json.dumps(report,indent=2))
assert boxes and not any(bad.values()), report
