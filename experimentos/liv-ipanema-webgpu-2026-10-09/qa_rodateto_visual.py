"""Inspeciona a moldura unida na cena real do Tour, em WebGPU e WebGL2."""
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from qa_interiores import CHROME

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/interior.html'
VIEWS = {
    'suite': ([-3.5,2.25,-2.0],[-4.16,2.63,-2.735]),
    'sala': ([.4,2.25,2.1],[1.045,2.63,3.035]),
    'banho': ([-2.85,2.25,1.65],[-3.27,2.63,.815]),
}


def main():
    out=EXP/'evidencias/rodateto-visual';out.mkdir(parents=True,exist_ok=True)
    report={'schema':'liv-molding-runtime-images-v1','status':'RUNNING',
            'atUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,'cases':[],
            'scope':'Diagnostic Tour cameras at 2.25 m for inspecting ceiling joins; normal visitor height unchanged'}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            report['browserVersion']=browser.version
            for backend in ['webgpu','webgl']:
                context=browser.new_context(viewport={'width':1200,'height':900})
                page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                try:
                    page.goto(URL+f'?tipologia=canto&backend={backend}&modo=visita')
                    page.wait_for_function('()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready;}',timeout=120000)
                    state=page.evaluate('''async()=>{
                      const a=__livInterior;a.setMode('visita');await a.renderer.setAnimationLoop(null);await a.capture();
                      const meshes=[];a.scene.traverse(o=>{if(o.isMesh&&o.name==='rodateto')meshes.push(o);});
                      if(meshes.length!==1||meshes[0].userData.livSlot!==19)throw Error('Moldura duplicada ou slot incompatível.');
                      const m=meshes[0];return {state:a.getState(),molding:{count:meshes.length,triangles:m.geometry.attributes.position.count/3,
                        matrix:m.matrixWorld.toArray(),roughness:m.material.roughness,map:!!m.material.map}};
                    }''')
                    assert state['state']['backend']==backend and state['state']['lighting']['bakedActive']
                    assert state['state']['ceiling']['visible'] and state['state']['mode']=='visita'
                    assert state['molding']['triangles']==1464 and not state['molding']['map']
                    assert abs(state['molding']['roughness']-.88)<1e-8
                    case={'backend':backend,'initial':state,'images':[]};report['cases'].append(case)
                    for name,(position,target) in VIEWS.items():
                        data=page.evaluate('''async view=>{
                          const a=__livInterior;a.camera.position.fromArray(view.position);a.camera.lookAt(...view.target);
                          a.camera.fov=55;a.camera.updateProjectionMatrix();await new Promise(requestAnimationFrame);return a.capture();
                        }''',{'position':position,'target':target})
                        path=out/f'{backend}-{name}.png';path.write_bytes(base64.b64decode(data.split(',')[1]))
                        case['images'].append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
                    assert not errors,errors
                    case.update(status='PASS',errors=errors)
                    print(backend+': PASS',flush=True)
                finally:
                    page.evaluate('window.__livInterior?.dispose?.()');context.close()
            browser.close()
        paths=[Path(__file__),EXP/'interior-renderer.js',EXP/'interior-cutaway.js',EXP/'interiores/catalogo.json',
               EXP/'interiores/canto/light.json',EXP/'interiores/canto/source.json']
        report.update(status='PASS',sources={p.relative_to(EXP).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})
    finally:
        (out/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf8')


if __name__=='__main__':main()
