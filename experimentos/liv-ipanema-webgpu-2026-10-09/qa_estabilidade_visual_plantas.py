"""Compara pixels antes/depois do reuso das duas plantas no renderer real."""
import argparse
import base64
import io
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
from qa_interiores import CHROME, interior_frame
from qa_cameras_interiores import scene_identity

EXP = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'

def capture(frame, path):
    raw = base64.b64decode(frame.evaluate('async()=>__livInterior.capture()').split(',', 1)[1])
    path.write_bytes(raw)
    return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=np.int16)

def main(args):
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'status':'RUNNING', 'url':args.url, 'cases':[]}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            for profile in args.backend:
                touch=profile=='toque';backend='auto' if touch else profile
                ctx = browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},
                    has_touch=touch,is_mobile=touch,device_scale_factor=3 if touch else 1)
                page = ctx.new_page(); errors = []
                if args.verificar and 'sourceSHA256' not in report:
                    report['sourceSHA256']={}
                    for name in ('interior-renderer.js','interior-cutaway.js','interior-wall-tops.js','interior-wall-top-contours.js'):
                        response=ctx.request.get(args.url.rsplit('/',1)[0]+'/'+name)
                        assert response.ok
                        report['sourceSHA256'][name]=hashlib.sha256(response.body()).hexdigest()
                page.on('pageerror', lambda e:errors.append(str(e)))
                page.goto(args.url+'?backend='+backend+'&geometria=entrada&unidades=edificio')
                page.wait_for_function('__livViewer?.ready', timeout=120000)
                page.evaluate("async()=>__livViewer.setMode('planta3d')")
                originals = {}; identities = {}
                case = {'profile':profile,'backend':backend,'touchEmulated':touch,'swaps':[], 'errors':errors}; report['cases'].append(case)
                for index, typology in enumerate(['canto','meio','canto','meio','canto','meio']):
                    page.evaluate('async t=>__livViewer.setTypology(t)',typology)
                    frame = interior_frame(page)
                    frame.evaluate('async()=>{await __livInterior.renderer.setAnimationLoop(null);}')
                    image = capture(frame,args.saida/f'{profile}-{index}-{typology}.png')
                    identity = scene_identity(frame)
                    camera = frame.evaluate('''()=>({state:__livInterior.getState(),near:__livInterior.camera.near,far:__livInterior.camera.far,
                      canvas:[__livInterior.renderer.domElement.width,__livInterior.renderer.domElement.height]})''')
                    row = {'typology':typology, 'camera':camera, 'changedPixels':0, 'maxDelta':0}
                    case['swaps'].append(row)
                    if args.verificar:
                        assert camera['state']['wallTopRepair']['unionArea']<camera['state']['wallTopRepair']['sourceArea']
                        assert camera['state']['wallTopRepair']['triangles']>0
                    if typology in originals:
                        diff = np.abs(image-originals[typology]); row.update(changedPixels=int(np.count_nonzero(diff.max(axis=2)>3)),maxDelta=int(diff.max()))
                        assert identity == identities[typology], 'A cena fonte mudou no reuso.'
                        if args.verificar:assert row['changedPixels']==0,row
                    else:
                        originals[typology]=image;identities[typology]=identity
                    print(json.dumps({'backend':backend,'index':index,'typology':typology,'changedPixels':row['changedPixels'],'maxDelta':row['maxDelta']}),flush=True)
                assert not errors,errors
                if args.verificar:
                    frame.evaluate('()=>__livInterior.rotateFurniture(__livInterior.getState().furniture[0].id)')
                    assert not frame.evaluate('__livInterior.getState().lighting.bakedActive')
                    frame.evaluate('__livInterior.resetFurniture()')
                    reset=capture(frame,args.saida/f'{profile}-meio-moveis-restaurados.png')
                    assert frame.evaluate('__livInterior.getState().lighting.bakedActive')
                    assert np.count_nonzero(np.abs(reset-originals['meio']).max(axis=2)>3)==0
                    case['furnitureResetPixelsStable']=True
                case['status']='PASS';ctx.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',failure=repr(error));raise
    finally:(args.saida/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--url',default=BASE+'maquete-liv-ipanema.html')
    p.add_argument('--backend',nargs='+',choices=['webgpu','webgl','toque'],default=['webgpu','webgl','toque'])
    p.add_argument('--verificar',action='store_true');p.add_argument('--saida',type=Path,required=True)
    main(p.parse_args())
