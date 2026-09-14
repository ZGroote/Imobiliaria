"""Exclude illustrative yards from the complete envelope of manually supplied developments."""
import json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from padrao.cidade import carrega
cid=carrega('sao-carlos');out=Path(__file__).resolve().parent
protected=[]
for path in (ROOT/'plantas_fornecidas').glob('*/unidade.json'):
    u=json.loads(path.read_text(encoding='utf-8'));lot=u.get('lote',{})
    if u.get('cidade')!=cid.slug or lot.get('lat') is None:continue
    building=lot.get('predio',{});blocks=building.get('blocos') or [building]
    radius=max(math.hypot(b.get('du',0),b.get('dv',0))+math.hypot(b.get('largura_m',building.get('largura_m',20)),b.get('profundidade_m',building.get('profundidade_m',20)))/2+5 for b in blocks)
    x,z=cid.geo_para_mapa(lot['lon'],lot['lat']);protected.append((x,z,radius))
data=json.loads((out/'encaixes.json').read_text());before=len(data['placements'])
assets=json.loads((out/'mapa-exteriores.json').read_text())['assets']
data['placements']=[p for p in data['placements'] if all(math.hypot(p[1]-x,p[2]-z)>r+math.hypot(assets[p[0]]['size'][0],assets[p[0]]['size'][2])/2 for x,z,r in protected)]
report=json.loads((out/'validacao-encaixes.json').read_text());report.update(placements=len(data['placements']),protected_developments=len(protected),removed_near_developments=before-len(data['placements']))
usage={a['id']:0 for a in assets if a['category']=='quintais'}
for p in data['placements']:usage[assets[p[0]]['id']]+=1
assert all(usage.values());report['usage']=usage
(out/'encaixes.json').write_text(json.dumps(data,separators=(',',':')))
(out/'validacao-encaixes.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'protected':len(protected),'removed':before-len(data['placements']),'placements':len(data['placements'])}))
