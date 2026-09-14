"""Independent acceptance pass on final, quantized yard placements."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from padrao.cidade import carrega
from pipeline.encaixar_casas_lotes import paths,rectangle
from shapely.geometry import Polygon,LineString,shape
from shapely.ops import transform
from shapely.strtree import STRtree
cid=carrega('sao-carlos');out=Path(__file__).resolve().parent
city=json.loads(Path(cid.caminho('city_saida')).read_text(encoding='utf-8'))
source=[Polygon(r) for _,r in paths(city['b'],2,city.get('q',10))];source=[p for p in source if p.is_valid]
houses=json.loads((ROOT/'modelos_urbanos/v1/mapa-casas.json').read_text())['assets']
hp=json.loads((ROOT/'modelos_urbanos/v1/integracao/encaixes-sao-carlos.json').read_text())['placements']
source += [rectangle(x,z,t,houses[i]['size'][0],houses[i]['size'][2]) for i,x,z,t in hp.values()]
st=STRtree(source)
lots=[transform(cid.geo_para_mapa,shape(f['geometry'])) for f in json.loads(Path(cid.caminho('lotes')).read_text())['features']]
lots=[p for p in lots if p.is_valid];lt=STRtree(lots)
raw=json.loads(Path(cid.caminho('muros')).read_text());walls=[];x=z=0
for i in range(0,len(raw),4):
 x+=raw[i];z+=raw[i+1]
 if raw[i+2] or raw[i+3]:walls.append(LineString([(x/10,z/10),((x+raw[i+2])/10,(z+raw[i+3])/10)]).buffer(.2,cap_style=3))
wt=STRtree(walls)
roads=[LineString(r).buffer(cid.meia_largura(cid.tipo_da_via(meta[0]))+.3,cap_style=3,join_style=2) for meta,r in paths(city['r'],2,city.get('q',10)) if len(r)>1];rt=STRtree(roads)
assets=json.loads((out/'mapa-exteriores.json').read_text())['assets'];ps=json.loads((out/'encaixes.json').read_text())['placements']
boxes=[rectangle(x,z,t,assets[i]['size'][0],assets[i]['size'][2]) for i,x,z,t in ps];yt=STRtree(boxes)
errors=[]
for i,p in enumerate(boxes):
 if not any(lots[j].covers(p) for j in lt.query(p)):errors.append([i,'outside lot'])
 for name,tree,items in [('building',st,source),('wall',wt,walls),('road',rt,roads)]:
  if any(p.intersection(items[j]).area>1e-7 for j in tree.query(p)):errors.append([i,name])
 if any(j<i and p.intersection(boxes[j]).area>1e-7 for j in yt.query(p)):errors.append([i,'yard overlap'])
report={'checked':len(boxes),'models_used':len(set(p[0] for p in ps)),'collisions':errors,'passed':not errors}
(out/'validacao-espacial-final.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
assert not errors
