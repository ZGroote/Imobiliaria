"""Cover the actual unbuilt parcel with ground; fit separate metre-scale amenities."""
import json,math,sys,hashlib
from pathlib import Path
import shapely
from shapely.geometry import Polygon,LineString,Point,shape,box
from shapely.ops import transform,unary_union
from shapely.affinity import rotate
from shapely.strtree import STRtree
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from padrao.cidade import carrega
from pipeline.encaixar_casas_lotes import paths,rectangle
from ocupacao import lotes_ocupados
OUT=Path(__file__).resolve().parent;cid=carrega('sao-carlos')
city=json.loads(Path(cid.caminho('city_saida')).read_text(encoding='utf-8'))
houses=json.loads((ROOT/'modelos_urbanos/v1/mapa-casas.json').read_text())['assets']
buildings=json.loads((ROOT/'modelos_urbanos/v1/integracao/encaixes-sao-carlos.json').read_text())['placements']
components=json.loads((OUT/'componentes.json').read_text());assets=components['assets']
source=[Polygon(r) for _,r in paths(city['b'],2,city.get('q',10))]
obstacles=[p for p in source if p.is_valid]
floor_obstacles=[p for i,p in enumerate(source) if p.is_valid and str(i) not in buildings]
obstacles += [rectangle(x,z,t,houses[ai]['size'][0],houses[ai]['size'][2]) for ai,x,z,t in buildings.values()]
floor_obstacles += [rectangle(x,z,t,houses[ai]['size'][0],houses[ai]['size'][2]) for ai,x,z,t in buildings.values()]
roads=[LineString(r).buffer(cid.meia_largura(cid.tipo_da_via(meta[0]))+.15,cap_style=3,join_style=2) for meta,r in paths(city['r'],2,city.get('q',10)) if len(r)>1]
protected=[]
for path in (ROOT/'plantas_fornecidas').glob('*/unidade.json'):
    u=json.loads(path.read_text(encoding='utf-8'));lot=u.get('lote',{})
    if u.get('cidade')!=cid.slug or lot.get('lat') is None:continue
    b=lot.get('predio',{});blocks=b.get('blocos') or [b]
    radius=max(math.hypot(v.get('du',0),v.get('dv',0))+math.hypot(v.get('largura_m',b.get('largura_m',20)),v.get('profundidade_m',b.get('profundidade_m',20)))/2+5 for v in blocks)
    protected.append(Point(*cid.geo_para_mapa(lot['lon'],lot['lat'])).buffer(radius))
obstacles+=roads+protected;tree=STRtree(obstacles)
floor_obstacles+=roads+protected;floor_tree=STRtree(floor_obstacles)
lots=[]
for ft in json.loads(Path(cid.caminho('lotes')).read_text(encoding='utf-8'))['features']:
    p=transform(cid.geo_para_mapa,shape(ft['geometry']))
    if p.geom_type=='Polygon' and p.is_valid and 25<p.area<5000:lots.append(p)
occupied=lotes_ocupados(city,lots,buildings,houses)
lt=STRtree(lots);orientations={}
for ai,x,z,t in buildings.values():
    for j in lt.query(Point(x,z)):
        if lots[j].covers(Point(x,z)):orientations.setdefault(int(j),t)
colors=dict(grass='688448',cement='A9AAA2',deck='927556',paver='B9B2A4',clay='B87154',gravel='9C9685')
records=[];checks=[];usage=[0]*40;total_free=total_ground=0;prop_count=0
reuse={p['lot']:p['props'] for p in json.loads((OUT/'terrenos.json').read_text())['parcels']} if '--rebuild-ground' in sys.argv else None
for li,lot in enumerate(lots):
    # Vacant parcels keep the map's original vegetation/earth, without amenities.
    if li not in occupied:continue
    nearby=[obstacles[j] for j in tree.query(lot) if obstacles[j].intersects(lot)]
    # No invented small platform: the full cadastral polygon minus built/road areas.
    floor_nearby=[floor_obstacles[j] for j in floor_tree.query(lot) if floor_obstacles[j].intersects(lot)]
    free=lot.difference(unary_union(floor_nearby))
    if free.is_empty or free.area<4:continue
    c=lot.centroid;x,z=c.x,c.y
    t=orientations.get(li)
    if t is None:
        rr=list(lot.minimum_rotated_rectangle.exterior.coords);a,b=max(zip(rr,rr[1:]),key=lambda ab:Point(ab[0]).distance(Point(ab[1])))
        t=math.atan2(-(b[1]-a[1]),b[0]-a[0])
    seed=int(hashlib.sha256(str(li).encode()).hexdigest()[:8],16);style=seed%40
    layout=components['layouts'][style];local=rotate(free,math.degrees(t),origin=(x,z));x0,z0,x1,z1=local.bounds
    surface=layout['surface'];zones=[(free,surface)]
    if surface in ('mixed','deck'):
        patio=rotate(box(x0-1,z0-1,x1+1,z0+(z1-z0)*.32),-math.degrees(t),origin=(x,z))
        zones=[(free.intersection(patio),'cement' if surface=='mixed' else 'deck'),(free.difference(patio),'grass')]
    triangles=[];coverage=[]
    for geom,material in zones:
        if geom.is_empty:continue
        for tri in shapely.constrained_delaunay_triangles(geom).geoms:
            coords=[[round(xx,3),round(zz,3)] for xx,zz in list(tri.exterior.coords)[:3]]
            q=Polygon(coords)
            if q.area<1e-7:continue
            triangles.append([colors[material],*[v for pt in coords for v in pt]]);coverage.append(q)
    if not triangles:continue
    ground=unary_union(coverage);error=ground.symmetric_difference(free).area
    # Rounding to millimetres may change only a narrow boundary strip.
    assert error<max(.12,free.length*.0015),(li,error)
    safe=free.difference(unary_union(nearby)).buffer(-.5,join_style=2);fitted=[];envelopes=[]
    if reuse is not None:fitted=reuse.get(li,[])
    for slot,pi in ([] if reuse is not None else enumerate(layout['parts'])):
        a=assets[pi];kind=layout['kinds'][slot];w,d=a['size'][0],a['size'][2];sx=sz=1
        if kind=='pool' and free.area>100:sx=max(1,3.2/w);sz=max(1,5.5/d);w*=sx;d*=sz
        # Spread objects through the free yard instead of clustering on a tiny slab.
        tx=x0+(x1-x0)*(.22 if slot%2==0 else .78);tz=z0+(z1-z0)*(.23 if slot<2 else .77)
        points=[(x0+(x1-x0)*fx,z0+(z1-z0)*fz) for fx in (.12,.25,.4,.5,.6,.75,.88) for fz in (.12,.25,.4,.5,.6,.75,.88)]
        points.sort(key=lambda p:math.hypot(p[0]-tx,p[1]-tz))
        for px,pz in points:
            wx=round(x+(px-x)*math.cos(t)+(pz-z)*math.sin(t),3);wz=round(z-(px-x)*math.sin(t)+(pz-z)*math.cos(t),3)
            envelope=rectangle(wx,wz,t,w,d)
            if not safe.covers(envelope) or any(envelope.distance(e)<.65 for e in envelopes):continue
            fitted.append([65+pi,wx,wz,t,sx,sz]);envelopes.append(envelope);break
    usage[style]+=1;prop_count+=len(fitted);total_free+=free.area;total_ground+=ground.area
    records.append(dict(lot=li,x=round(x,3),z=round(z,3),style=style,ground=triangles,props=fitted))
    checks.append(dict(lot=li,freeArea=round(free.area,3),groundArea=round(ground.area,3),boundaryError=round(error,6),props=len(fitted)))
    if len(records)%5000==0:print('PARCELS',len(records),flush=True)
assert all(usage)
(OUT/'terrenos.json').write_text(json.dumps(dict(version=2,parcels=records),separators=(',',':')))
report=dict(parcels=len(records),types=40,props=prop_count,freeArea=total_free,groundArea=total_ground,maxBoundaryError=max(v['boundaryError'] for v in checks),checks=checks,passed=True)
(OUT/'validacao-terrenos.json').write_text(json.dumps(report,separators=(',',':')))
print(json.dumps({k:v for k,v in report.items() if k!='checks'}),flush=True)
