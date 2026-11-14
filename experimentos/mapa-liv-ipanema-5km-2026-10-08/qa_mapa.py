"""QA real da versão estrita: maquete completa e mapa limitado a 5 km."""
from pathlib import Path
import argparse
import json
from urllib.parse import urljoin, urlsplit
from playwright.sync_api import sync_playwright

PASTA = Path(__file__).resolve().parent

MINI = """()=>{const ms=__maq.predio.children.filter(o=>o.isMesh);return {
 mode:__maq.modo(),total:ms.length,visible:ms.filter(o=>o.visible).length,site:ms.filter(o=>o.userData.tower!==0).length,
 modes:document.querySelectorAll('#modos [data-modo]').length,cameras:document.querySelectorAll('#livCameras button').length,
 controls:['verConjunto','livCameras','livAndar','livFoto'].filter(id=>document.getElementById(id)),
 link:document.getElementById('verMapa')?.getAttribute('href'),linkText:document.getElementById('verMapa')?.textContent.trim(),lightReady:!!window.__livLightmap?.ready};}"""

UI = """()=>{const box=id=>{const e=typeof id==='string'?document.getElementById(id):id;if(!e)return null;
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};};
 return {viewport:[innerWidth,innerHeight],bar:box('livMapaBar'),compass:box('compass'),minimap:box('minimapa'),nearbyPanel:box('livProximos'),
 hidden:['panel','houses','hsheet','usheet','mobileNav','mobileHint','etapas','isair','hud','livLocalizacao','mOpcoes','tRelief'].map(id=>({id,box:box(id)})),
 compare:!!document.getElementById('livComparar'),compareLinks:[...document.querySelectorAll('a[href]')].filter(e=>e.getAttribute('href').includes('mapa-completo')).length,
 text:document.getElementById('livMapaBar')?.innerText,contract:window.__livMapInterface,
 actions:[...document.querySelectorAll('#livMapaBar a,#livMapaBar button')].map(e=>({text:e.innerText,box:box(e)})),
 search:[...document.querySelectorAll('input:not([type=hidden]),[role=search]')].map(e=>({id:e.id,box:box(e),insideNearby:!!e.closest('#livProximos')})).filter(e=>e.box?.visible)};}"""

# Ignore a capacidade reservada: só drawRange/index e InstancedMesh.count
# representam primitivas e instâncias ativas. Toda posição é levada a world.
GEOMETRY = """()=>{const I=__int,T=THREE,c=__livMapa.centro,radius=__livMapa.raio;
 I.scene.updateMatrixWorld(true);const cache=new Map(),m=new T.Matrix4(),world=new T.Matrix4();
 const out={objects:0,terrainObjects:0,instanceObjects:0,instances:0,vertices:0,maxRadius:0,worst:null,violations:[],categories:{}};
 function family(o){const names=[];for(let p=o;p;p=p.parent)names.push(p.name||'');
  const group=names.find(n=>/^(arvores|portoes|sombras)$/.test(n));if(group)return group;
  if(/^(urban-|exterior-|quintais-)/.test(o.name))return o.name.split('-')[0];
  const g=o.geometry,u=g?.userData||{};return u.terrain||u.chaoDetalhe||u.ground||g?.attributes.aVia?'terrain':null;}
 function indices(g){let v=cache.get(g.uuid);if(v)return v;const p=g.attributes.position,idx=g.index,total=idx?idx.count:p.count;
  const start=Math.max(0,g.drawRange.start||0),end=Math.min(total,start+g.drawRange.count),used=new Set();
  for(let i=start;i<end;i++)used.add(idx?idx.getX(i):i);v=Array.from(used);cache.set(g.uuid,v);return v;}
 function inspect(o,matrix,slot){const p=o.geometry.attributes.position,e=matrix.elements;
  for(const i of indices(o.geometry)){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wx=e[0]*x+e[4]*y+e[8]*z+e[12],wz=e[2]*x+e[6]*y+e[10]*z+e[14],d=Math.hypot(wx-c[0],wz-c[1]);out.vertices++;
   if(d>out.maxRadius){out.maxRadius=d;out.worst={name:o.name,slot,index:i,x:wx,z:wz};}
   if(d>radius+.002&&out.violations.length<10)out.violations.push({name:o.name,slot,index:i,radius:d,x:wx,z:wz});}}
 I.scene.traverse(o=>{if(!o.geometry?.attributes.position)return;for(let p=o;p;p=p.parent)if(!p.visible)return;
  const category=family(o);if(!category)return;out.objects++;out.categories[category]=(out.categories[category]||0)+1;if(category==='terrain')out.terrainObjects++;
  if(o.isInstancedMesh){out.instanceObjects++;out.instances+=o.count;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);world.multiplyMatrices(o.matrixWorld,m);inspect(o,world,i);}}
  else inspect(o,o.matrixWorld,null);});return out;}"""


def overlap(a,b):
    return bool(a and b and a['visible'] and b['visible'] and a['x']<b['x']+b['w'] and b['x']<a['x']+a['w'] and a['y']<b['y']+b['h'] and b['y']<a['y']+a['h'])


def check_ui(d):
    assert d['contract'] and d['contract']['completeOnly'], d
    assert not d['compare'] and not d['compareLinks'], d
    assert d['search'] and all(s['insideNearby'] for s in d['search']), d
    assert all(not e['box'] or not e['box']['visible'] for e in d['hidden']), d
    w,h=d['viewport']
    for name in ('bar','compass','minimap','nearbyPanel'):
        b=d[name]
        assert b and b['visible'] and b['x']>=0 and b['y']>=0 and b['x']+b['w']<=w+1 and b['y']+b['h']<=h+1, (name,d)
    assert not overlap(d['bar'],d['compass']) and not overlap(d['bar'],d['minimap']) and not overlap(d['compass'],d['minimap']), d
    assert not any(overlap(d['nearbyPanel'],d[key]) for key in ('bar','compass','minimap')), d
    assert 'Centralizar' in d['text'] and 'LIV Ipanema' in d['text'], d
    assert all(a['box'] and a['box']['h']>=40 for a in d['actions']), d


def check_geometry(d,require_content=True):
    if require_content:
        assert d['terrainObjects']>0 and d['instanceObjects']>0 and d['vertices']>0, d
    assert not d['violations'] and d['maxRadius']<=5000.002, d


def check_requests(requests,map_url,meta):
    clean=lambda u:urlsplit(u)._replace(query='',fragment='').geturl()
    tiles={urljoin(map_url,meta['prefix']+k+'.bin') for k in meta['keys']}
    allowed=tiles|{clean(map_url),urljoin(map_url,'liv-ipanema.glb'),urljoin(map_url,'favicon.ico')}
    unknown=[u for u in requests if not u.startswith(('data:','blob:')) and clean(u) not in allowed]
    assert not unknown, {'requestsForaContrato':unknown}
    assert not any('mapa-completo' in u or 'open-elevation' in u.lower() or 'openelevation' in u.lower() or '/cid/' in u.lower() for u in requests), requests
    return {'tilesPermitidos':len(tiles),'tilesBaixados':len({clean(u) for u in requests}&tiles),'requests':len(requests),'foraContrato':unknown}


def check_nearby(page,output):
    page.wait_for_function('window.__livNearby?.ready',timeout=30000)
    catalog=page.evaluate('()=>LivNearby.createCatalog(__int.nearby.catalog(),__livMapa.centro,5000)')
    assert catalog and all(p['distance']<=5000 for p in catalog)
    assert [p['distance'] for p in catalog]==sorted(p['distance'] for p in catalog)
    category='farmacia' if any(p['c']=='farmacia' for p in catalog) else catalog[0]['c']
    expected=[p for p in catalog if p['c']==category]
    page.locator('#livProximosCategory').select_option(category)
    assert page.evaluate('__livNearby.total')==len(expected)
    page.locator('#livProximosList button').first.click()
    page.wait_for_timeout(1700)
    selected=page.evaluate('__livNearby.selectedId')
    assert selected==expected[0]['id']
    target=page.evaluate('__int.target.toArray()')
    assert abs(target[0]-expected[0]['x'])<2 and abs(target[2]-expected[0]['z'])<2, (target,expected[0])
    assert page.locator('#livProximosSelection').is_visible()
    page.screenshot(path=str(output))
    page.locator('#livProximosQuery').fill('lugar que nao existe zzz987')
    assert page.evaluate('__livNearby.total')==0 and page.locator('#livProximosEmpty').is_visible()
    page.locator('#livProximosClear').click()
    page.locator('#livProximosQuery').fill(expected[0]['n'])
    assert page.evaluate('__livNearby.total')>0
    page.locator('#livProximosQuery').press('Enter')
    assert page.evaluate('__livNearby.selectedId') is not None
    page.locator('#livProximosClear').click()
    assert page.evaluate('__livNearby.total')==len(catalog)
    page.locator('#livProximosQuery').press('Escape')
    assert not page.evaluate('__livNearby.expanded')
    page.locator('#livProximosToggle').click()
    assert page.evaluate('__livNearby.expanded')
    return {'catalogCount':len(catalog),'category':category,'categoryCount':len(expected),'selectedId':selected,'max_distance_m':max(p['distance'] for p in catalog),'emptyState':True,'keyboard':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',default='http://127.0.0.1:8788')
    parser.add_argument('--saida',type=Path,default=PASTA/'qa-local-v3')
    parser.add_argument('--somente-mapa',action='store_true')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    base=args.base_url.rstrip('/')+'/';map_url=urljoin(base,'mapa-liv-ipanema-5km.html')
    result={'base':base,'versao':'strict-circle-v3','status':'RUNNING','cenarios':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--enable-unsafe-swiftshader'])
            for name,viewport in [('desktop',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
                context=browser.new_context(viewport=viewport,device_scale_factor=1);page=context.new_page()
                errors,warnings,failed,requests=[],[],[],[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda m:warnings.append(m.text) if m.type in ('error','warning') else None)
                page.on('response',lambda r:failed.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
                page.on('request',lambda r:requests.append(r.url))
                sc={'name':name,'errors':errors,'warnings':warnings,'httpFailures':failed,'requests':requests,'dados':{}};result['cenarios'].append(sc);d=sc['dados']
                if not args.somente_mapa:
                    page.goto(urljoin(base,'maquete-liv-ipanema.html'),wait_until='load',timeout=120000)
                    page.wait_for_function('window.__liv && window.__maq && window.__livLightmap?.ready',timeout=120000)
                    mini=page.evaluate(MINI)
                    assert mini['total']==mini['visible']==56 and mini['site']==43, mini
                    assert mini['modes']==4 and 'verConjunto' not in mini['controls'], mini
                    assert mini['mode']=='maquete' and mini['link']=='mapa-liv-ipanema-5km.html', mini
                    assert mini['linkText']=='O que tem por perto?', mini
                    page.evaluate('__liv.setConjunto(false,true)');assert page.evaluate(MINI)['visible']==56
                    d['miniatura']=mini;page.screenshot(path=str(args.saida/(name+'-miniatura.png')))
                    map_start=len(requests);page.locator('#verMapa').click();page.wait_for_url('**/mapa-liv-ipanema-5km.html*',timeout=120000)
                else:
                    map_start=len(requests);page.goto(map_url,wait_until='load',timeout=120000)
                page.wait_for_function('window.__livMapa && window.__int?.scene && window.__livModel && window.__livMapInterface',timeout=120000)
                page.wait_for_function('__int.livTerrain.amount()>=.999',timeout=30000);page.wait_for_timeout(3500)
                d.update(page.evaluate("""()=>{const json=id=>JSON.parse(document.getElementById(id).textContent);return {
                 centro:__livMapa.centro,raio:__livMapa.raio,target:__int.target.toArray(),raster:window.__regionalRaster,maquete:__livModel.metadata,
                 circle:window.LivCircle?.diagnostics(),background:!!window.__gTerreno,ground:window.__livCircularGround,tiles:json('__exteriorModels').parcelTiles,pois:json('__poidata').length,
                 listings:{imoveis:json('__imoveis'),unidades:json('__unidades'),luz:json('__luzue'),assets:json('__listingModels').assets.length},
                 nav:performance.getEntriesByType('navigation').map(n=>({encoded:n.encodedBodySize,decoded:n.decodedBodySize,transfer:n.transferSize,load_ms:n.loadEventEnd})),
                 resources:performance.getEntriesByType('resource').map(r=>({url:r.name,encoded:r.encodedBodySize,transfer:r.transferSize}))};}"""))
                assert d['raio']==5000 and d['background'], d
                assert d['ground']['policy']=='continuous-circle' and d['ground']['max_radius_m']<=5000, d['ground']
                assert d['ground']['area_m2']>=3.141592653589793*5000**2*.99995, d['ground']
                assert d['circle'] and d['circle']['radius']==5000 and d['circle']['geometries']>0, d['circle']
                assert d['listings']=={'imoveis':[],'unidades':[],'luz':{},'assets':0}, d['listings']
                assert set(d['raster'])=={'ndvi','elevation'}, d['raster']
                for raster in d['raster'].values():
                    assert raster['format']=='regional-raster-sparse-v2' and raster['outside']=='not-transmitted', raster
                    assert raster['max_sample_radius_m']<=5000 and raster['exported_cells']<raster['runtime_cells'], raster
                model=d['maquete'];assert model['sourceMeshes']==1825 and model['instancedBatches']==87 and model['fallbackMeshes']==0 and model['units']=='meters', model
                assert abs(d['target'][0]-d['centro'][0])<15 and abs(d['target'][2]-d['centro'][1])<15, d['target']
                d['interface']=page.evaluate(UI);check_ui(d['interface'])
                d['geometriaInicial']=page.evaluate(GEOMETRY);check_geometry(d['geometriaInicial'])
                page.screenshot(path=str(args.saida/(name+'-mapa.png')))
                d['busca']=check_nearby(page,args.saida/(name+'-busca-categoria.png'))
                page.locator('#livProximosToggle').click()
                page.locator('#livFocar').click();page.wait_for_timeout(1800);assert page.evaluate('__livModel.object.visible')
                relief=page.evaluate("""()=>{const t=__int.livTerrain,m=__livModel,p=m.object.position,anchor=t.sample(p.x,p.z);return {
                 amount:t.amount(),anchor,heights:m.footprintWorld.map(v=>t.sample(v[0],v[2])),floor:p.y,clearance:m.metadata.floorClearanceMeters,
                 outsideDelta:t.sample(p.x+250,p.z+250)-t.sampleOriginal(p.x+250,p.z+250),diagnostics:t.diagnostics()};}""")
                assert abs(relief['amount']-1)<.001 and abs(relief['floor']-relief['anchor']-relief['clearance'])<.03, relief
                assert max(abs(h-relief['anchor']) for h in relief['heights'])<.01 and abs(relief['outsideDelta'])<.00001, relief
                d['relevo']=relief;page.screenshot(path=str(args.saida/(name+'-maquete-relevo.png')));d['sondas']=[]
                for label,distance in [('borda',4950),('fora',5500)]:
                    page.evaluate('d=>{const c=__livMapa.centro;__int.target.set(c[0]+d,0,c[1]);__int.sph.radius=650;__int.sph.phi=.9;__int.sph.theta=0}',distance)
                    page.wait_for_timeout(3200);geometry=page.evaluate(GEOMETRY);check_geometry(geometry,require_content=False)
                    assert page.evaluate('__int.livTerrain.amount()')>=.999
                    d['sondas'].append({'name':label,'targetDistance':distance,'geometria':geometry})
                    page.screenshot(path=str(args.saida/(name+'-'+label+'.png')))
                page.evaluate('()=>{const c=__livMapa.centro;__int.target.set(c[0],0,c[1]);__int.sph.radius=11000;__int.sph.phi=.2;__int.sph.theta=0}')
                page.wait_for_timeout(3200);d['geometriaRaioCompleto']=page.evaluate(GEOMETRY);check_geometry(d['geometriaRaioCompleto'],require_content=False)
                page.screenshot(path=str(args.saida/(name+'-raio-completo.png')))
                d['rede']=check_requests(requests[map_start:],map_url,d['tiles'])
                assert not errors and not failed, {'errors':errors,'httpFailures':failed}
                context.close()
            browser.close()
        result['status']='PASS'
    except Exception as e:
        result['status']='FAIL';result['failure']=str(e);raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':result['status'],'saida':str(args.saida),'cenarios':[c['name'] for c in result['cenarios']]}))

if __name__=='__main__':main()
