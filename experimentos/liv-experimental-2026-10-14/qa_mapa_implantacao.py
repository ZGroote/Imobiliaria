"""Compara a implantação com o pacote v4, em câmeras iguais e perfis descartáveis."""
import json
import math
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
EXP=Path(__file__).resolve().parent
OUT=EXP/'evidencias/mapa-sem-preenchimento'
ROOT='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/'
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report={'status':'RUNNING','recordedAt':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,'cases':[],
            'mapRuntimeSHA256':hashlib.sha256((EXP/'mapa-runtime/mapa-liv-ipanema-5km.html').read_bytes()).hexdigest()}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            for name,prefix in [('antes','entregas/liv-avaliacao-20261011-v4/site/'),('depois','')]:
                context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
                page=context.new_page();errors=[];failures=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('response',lambda r:failures.append([r.status,r.url]) if r.status>=400 else None)
                page.goto(ROOT+prefix+'mapa-liv-ipanema-5km.html?geometria=entrada&unidades=edificio',timeout=120000)
                page.wait_for_function('window.__livMapAdapter?.ready',timeout=150000)
                frame=page.locator('#map').element_handle().content_frame()
                frame.wait_for_function('''window.__int?.exteriors&&(()=>{const s=__int.exteriors.stats();return s.loadedTiles>0&&s.pendingTiles===0&&s.placedYards>0&&s.tileErrors===0;})()''',timeout=120000)
                frame.evaluate('''()=>{window.__livMapFlight=(window.__livMapFlight||0)+1;__int.target.set(-3280,0,-3160);__int.sph.radius=420;__int.sph.phi=.42;__int.sph.theta=-.88;}''')
                page.wait_for_timeout(700)
                data=frame.evaluate('''()=>({model:__livModel.metadata,position:__livModel.object.position.toArray(),scale:__livModel.object.scale.toArray(),rotation:__livModel.object.rotation.y,terrain:__int.livTerrain.diagnostics(),tiles:__int.exteriors.stats(),parcel:window.LivMapPlacement?.stats(),parcelObjects:window.__livParcel?.group.children.map(o=>o.name),render:{calls:__int.renderer.info.render.calls,triangles:__int.renderer.info.render.triangles}})''')
                page.screenshot(path=str(OUT/(name+'.png')))
                assert not errors and not failures,(errors,failures)
                assert abs(data['rotation']-data['terrain']['rotationRadians'])<1e-12
                assert math.dist([data['position'][0],data['position'][2]],data['terrain']['center'])<1e-10
                data.update(name=name,errors=errors,httpFailures=failures,status='PASS');report['cases'].append(data)
                context.close()
            browser.close()
        before,after=report['cases'];assert abs(after['rotation']-before['rotation']-math.pi)<1e-12
        for record in report['cases']:assert record['model']['assetSHA256']=='4947fee3d6eba10af3619493663a04a3fb478086a0953ae646f685b09e84ba01'
        assert math.dist(before['position'],after['position'])>100
        report['sameGeometry']=True;report['halfTurn']=True;report['oppositeSideOfAvenue']=True
        assert after['parcel']['excludedBuildings']>0 and after['parcel']['excludedYards']>0 and after['parcel']['clippedWalls']>0
        assert before['scale']==after['scale']==[1,1,1]
        assert after['parcelObjects']==['liv-acesso-avenida']
        report['siteFit']='Approximate registration of the user satellite outline; original model scale retained.'
        report['scope']='Model rotation/relocation, small entrance access and exclusion of old context; no parcel fill or border.'
        report['status']='PASS'
    except Exception as e:report['status']='FAIL';report['failure']=repr(e);raise
    finally:(OUT/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({'status':report['status'],'cases':len(report['cases'])}),flush=True)
if __name__=='__main__':main()
