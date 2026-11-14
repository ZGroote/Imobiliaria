"""Amostra as quinas no atlas e registra antes/depois no renderer real."""
import argparse
import base64
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
from playwright.sync_api import sync_playwright

OWN=Path(__file__).resolve().parent
EXP=OWN.parent
ROOT=OWN.parents[2]
LIGHT=OWN/'variante/luz'
BEFORE=LIGHT/'antes-quinas'
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
VIEWS={
    'nucleo-frente':([7,33,34],[-6.2,33,6.2],24),
    'nucleo-fundos':([7,33,-34],[-6.2,33,-5.7],24),
    'recuo-cinza':([19,34,25],[5.5,34,5.37],24),
    'cabeceira-direita':([44,34,2],[23.4,34,0],28),
    'cabeceira-esquerda':([-44,34,-2],[-23.3,34,0],28),
    'cobertura':([30,65,44],[-3,49,0],40),
}


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def sample(image,uv):
    point=uv*np.array([image.shape[1],image.shape[0]])-.5
    origin=np.floor(point).astype(int);fraction=point-origin
    value=np.zeros(image.shape[2],float)
    for y in range(2):
        for x in range(2):
            offset=np.clip(origin+[x,y],[0,0],[image.shape[1]-1,image.shape[0]-1])
            weight=(fraction[0] if x else 1-fraction[0])*(fraction[1] if y else 1-fraction[1])
            value+=image[offset[1],offset[0]]*weight
    return value


def probe_atlas(directory,model_path):
    model=json.loads(model_path.read_text());compact=json.loads((directory/'geometry-compact.json').read_text())
    manifest=json.loads((directory/'manifest.json').read_text())
    assert manifest['sourceSHA256']==compact['sourceSHA256']==sha(model_path)
    encoded=gzip.decompress((directory/'irradiance.rgbm.gz').read_bytes())
    assert hashlib.sha256(encoded).hexdigest()==manifest['textureSHA256']
    assert sha(directory/'geometry-compact.json')==manifest['geometrySHA256']
    image=np.frombuffer(encoded,dtype=np.uint8).reshape(manifest['height'],manifest['width'],4)
    # Filter RGBM channels first, then decode, matching the renderer's texture()
    # and multiplication. Decoding each texel before filtering differs at seams.
    probes=[]
    for floor in range(17):
        for x in [-8.0136+.08,-4.3884-.08]:
            for height in [.50,1.70,2.55]:
                lights=[]
                for batch in compact['groups']:
                    if batch['tower']!=0 or not batch['geometry'].startswith('panos-'):continue
                    group=model['groups'][batch['groupIndex']]
                    inst=next((i for i in batch['instances'] if i['floor']==floor),None)
                    if inst is None:continue
                    geo=model['geometries'][batch['geometry']]
                    indices=np.array(batch['indices']).reshape(-1,3)
                    tris=np.array(geo['position']).reshape(-1,3)[indices]
                    normal=np.array(geo['normal']).reshape(-1,3)[indices].mean(1)
                    candidates=np.flatnonzero((normal[:,2]>.999)&np.all(abs(tris[:,:,2]-7.48974)<1e-4,axis=1))
                    uv=np.frombuffer(base64.b64decode(inst['uv1U16']),dtype='<u2').reshape(-1,3,2)/65535
                    for index in candidates:
                        t=tris[index,:,:2]
                        matrix=np.column_stack([t[1]-t[0],t[2]-t[0]])
                        if abs(np.linalg.det(matrix))<1e-9:continue
                        weights=np.linalg.solve(matrix,np.array([x,height])-t[0])
                        bary=np.r_[1-weights.sum(),weights]
                        if bary.min() < -1e-8:continue
                        value=sample(image,bary@uv[index])/255
                        lights.append(float((value[:3]*value[3]*manifest['range']).mean()))
                assert lights,(floor,x,height)
                probes.append({'floor':floor,'x':x,'height':height,'faces':len(lights),'radianceMin':min(lights),
                               'radianceMax':max(lights)})
    return {'sourceSHA256':manifest['sourceSHA256'],'atlasSHA256':manifest['textureSHA256'],
            'samples':probes,'nearBlackSamples':sum(p['radianceMin']<.04 for p in probes),
            'minimumRadiance':min(p['radianceMin'] for p in probes),
            'ambiguousSurfaceSamples':sum(p['faces']>1 for p in probes)}


def capture(page,path):
    page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    data=page.evaluate('__livProva.capture(false)')
    path.write_bytes(base64.b64decode(data.split(',')[1]))


def run(browser,backend,edition,out):
    context=browser.new_context(viewport={'width':1200,'height':1000},device_scale_factor=1)
    if edition=='antes':
        def route_earlier(route):
            name=Path(urlparse(route.request.url).path).name
            files={'manifest.json':'assets-manifest.json','scene.json.gz':'scene.json.gz','irradiance.rgbm.gz':'irradiance.rgbm.gz'}
            if name in files:
                route.fulfill(path=str(BEFORE/files[name]),content_type='application/json' if name=='manifest.json' else 'application/octet-stream')
            else:route.continue_()
        context.route('**/modelo/variante/assets/*',route_earlier)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.goto(URL+f'prova-rgbm.html?backend={backend}&geometria=contorno&embed=1')
        page.wait_for_function('window.__livProva?.ready||window.__livProva?.error',timeout=180000)
        assert page.evaluate('__livProva.ready'),page.evaluate('__livProva.error')
        result=page.evaluate('''()=>({backend:__livProva.backend,source:__livProva.data.sourceModelSHA256,
          atlas:__livProva.data.rgbm.textureSHA256,
          wallMaterialMaps:__livProva.materials.filter(m=>['MAT-bege','MAT-cinza'].includes(m.name)).map(m=>({name:m.name,map:!!m.map,bumpMap:!!m.bumpMap}))})''')
        assert result['backend']==backend
        assert all(not m['map'] and not m['bumpMap'] for m in result['wallMaterialMaps'])
        for name,(position,target,fov) in VIEWS.items():
            page.evaluate('''s=>__livProva.restoreState({view:'livre',floor:-1,camera:{type:'PerspectiveCamera',
              fov:s.fov,near:.2,far:900,zoom:1,position:s.position,target:s.target}})''',
              {'position':position,'target':target,'fov':fov})
            capture(page,out/f'{backend}-{edition}-{name}.png')
        assert not errors,errors
        result.update(edition=edition,status='PASS',views=list(VIEWS),consoleErrors=errors)
        return result
    finally:
        page.evaluate('window.__livProva?.dispose?.()');context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/quinas-luz')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    before=probe_atlas(BEFORE,BEFORE/'modelo.json')
    after=probe_atlas(LIGHT,OWN/'variante/modelo.json')
    assert before['nearBlackSamples']>0,'O diagnóstico não reproduziu as quinas negras'
    assert after['nearBlackSamples']==0,after
    assert after['ambiguousSurfaceSamples']==0,after
    files=[Path(__file__),OWN/'qa_paredes.py',OWN/'unir_paredes.py',OWN/'modelar_exterior.py',
           OWN/'variante/modelo.json',OWN/'variante/assets/manifest.json',LIGHT/'manifest.json',LIGHT/'geometry-compact.json',
           BEFORE/'modelo.json',BEFORE/'assets-manifest.json',BEFORE/'manifest.json',EXP/'renderer.js',EXP/'material-rgbm.js']
    report={'schema':'liv-corner-light-qa-v1','status':'RUNNING','atUtc':datetime.now(timezone.utc).isoformat(),
            'scope':'102 amostras nas duas quinas do núcleo frontal; inspeção visual em seis câmeras por backend.',
            'physicalMobile':False,'before':before,'after':after,'cases':[],
            'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in files}}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            report['browserVersion']=browser.version
            for backend in ['webgpu','webgl']:
                for edition in ['antes','depois']:
                    case=run(browser,backend,edition,args.saida)
                    proof=before if edition=='antes' else after
                    assert case['source']==proof['sourceSHA256'] and case['atlas']==proof['atlasSHA256']
                    report['cases'].append(case);print(backend+' '+edition+': PASS',flush=True)
            browser.close()
        report['status']='PASS'
    except Exception as e:
        report.update(status='FAIL',failure=str(e));raise
    finally:
        (args.saida/'luz.json').write_text(json.dumps(report,indent=2),encoding='utf8')
        print(json.dumps({'status':report['status'],'beforeNearBlack':before['nearBlackSamples'],
                          'afterNearBlack':after['nearBlackSamples'],'afterMinimum':after['minimumRadiance']}),flush=True)


if __name__=='__main__':main()
