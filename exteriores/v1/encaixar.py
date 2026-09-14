"""Place illustrative yards only in verified free parcel space, at full scale."""
import sys,json,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from padrao.cidade import carrega
from pipeline.encaixar_casas_lotes import paths,rectangle
from shapely.geometry import Polygon,LineString,shape,Point
from shapely.ops import transform,unary_union
from shapely.strtree import STRtree
from shapely.affinity import rotate

cid=carrega('sao-carlos');OUT=Path(__file__).resolve().parent
city=json.loads(Path(cid.caminho('city_saida')).read_text(encoding='utf-8'))
houses=json.loads((ROOT/'modelos_urbanos/v1/mapa-casas.json').read_text())['assets']
placements=json.loads((ROOT/'modelos_urbanos/v1/integracao/encaixes-sao-carlos.json').read_text())['placements']
assets=json.loads((OUT/'mapa-exteriores.json').read_text())['assets']
yards=[(i,a) for i,a in enumerate(assets) if a['category']=='quintais']
source=[Polygon(r) for _,r in paths(city['b'],2,city.get('q',10))]
# Both possible building representations are obstacles; procedural fallback is safe too.
obstacles=[p.buffer(.45,join_style=2) for p in source if p.is_valid]
obstacles += [rectangle(x,z,t,houses[ai]['size'][0],houses[ai]['size'][2]).buffer(.35,join_style=2) for ai,x,z,t in placements.values()]
bt=STRtree(obstacles)
lots=[]
for ft in json.loads(Path(cid.caminho('lotes')).read_text(encoding='utf-8'))['features']:
    p=transform(cid.geo_para_mapa,shape(ft['geometry']))
    if p.geom_type=='Polygon' and p.is_valid and 65<p.area<1800:lots.append(p)
lt=STRtree(lots)
walls=[];x=z=0;raw=json.loads(Path(cid.caminho('muros')).read_text())
for i in range(0,len(raw),4):
    x+=raw[i];z+=raw[i+1]
    if raw[i+2] or raw[i+3]:walls.append(LineString([(x/10,z/10),((x+raw[i+2])/10,(z+raw[i+3])/10)]).buffer(.42,cap_style=3))
wt=STRtree(walls)
roads=[LineString(r).buffer(cid.meia_largura(cid.tipo_da_via(meta[0]))+.65,cap_style=3,join_style=2) for meta,r in paths(city['r'],2,city.get('q',10)) if len(r)>1]
rt=STRtree(roads)
accepted=[];footprints=[];used=set();usage={a['id']:0 for _,a in yards};grid={};attempts=0
def cells(p):
    x0,z0,x1,z1=p.bounds
    return [(x,z) for x in range(math.floor(x0/50),math.floor(x1/50)+1) for z in range(math.floor(z0/50),math.floor(z1/50)+1)]
for bid,value in sorted(placements.items(),key=lambda v:int(v[0])):
    ai,x,z,t=value;matches=[int(j) for j in lt.query(Point(x,z)) if lots[j].covers(Point(x,z))]
    if len(matches)!=1 or matches[0] in used:continue
    li=matches[0];used.add(li);lot=lots[li];attempts+=1
    nearby=[obstacles[j] for j in bt.query(lot)]+[walls[j] for j in wt.query(lot)]+[roads[j] for j in rt.query(lot)]
    nearby += [footprints[j].buffer(.2) for j in {j for cell in cells(lot) for j in grid.get(cell,[])}]
    free=lot.buffer(-.48,join_style=2).difference(unary_union(nearby))
    if free.is_empty or free.area<20:continue
    # rectangle() uses right=(cos t,-sin t), front=(sin t,cos t).
    local=rotate(free,math.degrees(t),origin=(x,z));x0,y0,x1,y1=local.bounds
    seed=int(hashlib.sha256(bid.encode()).hexdigest()[:8],16)
    options=sorted(yards,key=lambda v:(usage[v[1]['id']]//80,(v[0]+seed)%40))
    chosen=None;tested={}
    for index,a in options:
        w,d=a['size'][0],a['size'][2];key=(w,d)
        if key not in tested:
            tested[key]=None
            if x1-x0<w or y1-y0<d:continue
            # Back of house first; also handles side yards and irregular parcels.
            ys=[y0+d/2+.015,(y0+y1)/2,y1-d/2-.015]
            xs=[(x0+x1)/2,x0+w/2+.015,x1-w/2-.015]
            for yy in ys:
                for xx in xs:
                    px=x+(xx-x)*math.cos(t)+(yy-z)*math.sin(t)
                    pz=z-(xx-x)*math.sin(t)+(yy-z)*math.cos(t)
                    box=rectangle(px,pz,t,w,d)
                    if free.covers(box):tested[key]=(round(px,3),round(pz,3),box);break
                if tested[key]:break
        if tested[key]:chosen=(index,a,*tested[key]);break
    if not chosen:continue
    index,a,px,pz,box=chosen
    # Re-check quantized placement, the exact values embedded in the map.
    box=rectangle(px,pz,t,a['size'][0],a['size'][2])
    if not free.covers(box):continue
    usage[a['id']]+=1;idx=len(footprints);footprints.append(box)
    for cell in cells(box):grid.setdefault(cell,[]).append(idx)
    accepted.append([index,px,pz,t])
    if len(accepted)%1000==0:print('YARDS',len(accepted),flush=True)
assert accepted and all(usage.values()),usage
report={'placements':len(accepted),'models_used':sum(v>0 for v in usage.values()),'usage':usage,'checked_lots':attempts,'scale':1,'clearance_lot_m':.48,'clearance_wall_m':.42,'clearance_source_building_m':.45,'clearance_urban_building_m':.35,'illustrative':True}
(OUT/'encaixes.json').write_text(json.dumps({'version':1,'placements':accepted},separators=(',',':')))
(OUT/'validacao-encaixes.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
