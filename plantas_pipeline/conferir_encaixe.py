import json,sys
from PIL import Image,ImageDraw
from shapely.geometry import shape
from shapely.ops import unary_union,transform as sht
from pyproj import Transformer
F=Transformer.from_crs("EPSG:4326","EPSG:29193",always_xy=True)
def toutm(x,y,z=None): return F.transform(x,y)
P="C:/Users/respawn/Desktop/imobiliaria/"
geo=json.load(open(sys.argv[1]))
lotes=[sht(toutm,shape(f['geometry'])) for f in geo['features']]
lo=json.load(open(P+'loteamentos_saocarlos_oficial.geojson',encoding='utf-8'))
alvo=unary_union([sht(toutm,shape(f['geometry'])) for f in lo['features'] if sys.argv[2].upper() in (f['properties'].get('nome') or '').upper()])
q=json.load(open(P+'quadras_saocarlos.geojson',encoding='utf-8'))
qs=[sht(toutm,shape(f['geometry'])) for f in q['features'] if sht(toutm,shape(f['geometry'])).representative_point().within(alvo)]
minx,miny,maxx,maxy=alvo.bounds; pad=60; minx-=pad;miny-=pad;maxx+=pad;maxy+=pad
W=1500;H=int(W*(maxy-miny)/(maxx-minx))
im=Image.new('RGB',(W,H),(255,255,255));dr=ImageDraw.Draw(im,'RGBA')
sx=lambda x:(x-minx)/(maxx-minx)*W; sy=lambda y:(maxy-y)/(maxy-miny)*H
for g in qs:
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
        dr.polygon([(sx(x),sy(y)) for x,y in p.exterior.coords],fill=(120,170,255,120),outline=(0,60,180))
for g in lotes:
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
        try: dr.polygon([(sx(x),sy(y)) for x,y in p.exterior.coords],outline=(200,0,0))
        except: pass
im.save(sys.argv[3]); print('ok',im.size,'| quadras oficiais',len(qs),'| lotes',len(lotes))
