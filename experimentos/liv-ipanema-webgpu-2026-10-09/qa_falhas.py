"""Exercita recuperação de recursos, ausência de GPU e perda de contexto no Chrome real."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
OUT=EXP/'evidencias'/'recuperacao'
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html'


def ready(page,mode='maquete'):
    page.wait_for_function('m=>__livViewer.ready&&__livViewer.mode===m',arg=mode,timeout=120000)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=OUT)
    args=parser.parse_args();output=args.saida
    output.mkdir(parents=True,exist_ok=True)
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING','cases':[],
            'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest()
              for name in ['qa_falhas.py','renderer.js','viewer.js','exterior-finishes.js','cameras.js',
                           'maquete-liv-ipanema.html','prova-rgbm.html','assets-prova/manifest.json']}}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            cases=[('sem-webgpu',"Object.defineProperty(navigator,'gpu',{get:()=>undefined});",None),
                   ('inicializacao-webgpu',"if(navigator.gpu){const get=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=async(...args)=>{const adapter=await get(...args);if(adapter)adapter.requestDevice=()=>Promise.reject(Error('Falha de inicialização injetada pelo QA'));return adapter;};}",None),
                   ('webgpu-obrigatorio-ausente',"Object.defineProperty(navigator,'gpu',{get:()=>undefined});",'webgpu'),
                   ('atlas-http',None,'webgl'),('atlas-corrompido',None,'webgl'),
                   ('contexto-webgl',None,'webgl'),('contexto-webgpu-simulado',None,'webgpu'),
                   ('planta-http',None,'webgl'),('troca-rapida',None,'webgl')]
            for name,init,backend in cases:
                case={'name':name,'errors':[]};report['cases'].append(case)
                context=browser.new_context(viewport={'width':1280,'height':800})
                if init:context.add_init_script(init)
                page=context.new_page();page.on('pageerror',lambda error,c=case:c['errors'].append(str(error)))
                route='**/irradiance.rgbm.gz*'
                if name=='atlas-http':context.route(route,lambda r:r.fulfill(status=503,body='QA: indisponível'))
                if name=='atlas-corrompido':context.route(route,lambda r:r.fulfill(status=200,body=b'QA: bytes divergentes'))
                page.goto(URL+('?backend='+backend if backend else ''),wait_until='load',timeout=120000)
                if name in ['webgpu-obrigatorio-ausente','atlas-http','atlas-corrompido']:
                    page.wait_for_function('__livViewer.error',timeout=120000)
                    case['handledError']=page.evaluate('__livViewer.error')
                    assert page.locator('#fallback').is_visible()
                    if name=='webgpu-obrigatorio-ausente':
                        page.locator('#fallback').click();ready(page,'planta2d')
                        assert page.locator('iframe').count()==0
                    else:
                        context.unroute(route);page.locator('#retry').click();ready(page)
                else:
                    ready(page)
                    case['backend']=page.evaluate('__livViewer.backend')
                    if name in ['sem-webgpu','inicializacao-webgpu']:assert case['backend']=='webgl'
                    if name.startswith('contexto-'):
                        page.locator('#floor').select_option('8')
                        if name=='contexto-webgl':
                            page.evaluate("__livViewer.frame.contentWindow.__livProva.renderer.backend.getContext().getExtension('WEBGL_lose_context').loseContext()")
                            case['injection']='WEBGL_lose_context real'
                        else:
                            page.evaluate("__livViewer.frame.contentWindow.__livProva.renderer.onDeviceLost({api:'WebGPU',reason:'unknown',message:'QA: callback de perda de dispositivo'})")
                            case['injection']='callback simulado; não perda física do dispositivo'
                        page.wait_for_function('__livViewer.error',timeout=15000)
                        assert not page.evaluate('__livViewer.ready') and page.locator('#retry').is_visible()
                        page.locator('#retry').click();ready(page)
                        assert page.evaluate('__livViewer.frame.contentWindow.__livProva.getState().floor')==8
                    if name=='planta-http':
                        context.route('**/plantas2d/canto.jpg',lambda r:r.fulfill(status=503,body='QA: indisponível'))
                        page.locator('[data-mode="planta2d"]').click()
                        page.wait_for_function('__livViewer.error',timeout=15000)
                        context.unroute('**/plantas2d/canto.jpg');page.locator('#retry').click();ready(page,'planta2d')
                    if name=='troca-rapida':
                        page.evaluate("__livViewer.setMode('planta3d');__livViewer.setMode('planta2d');__livViewer.setMode('maquete')")
                        ready(page);assert page.locator('iframe').count()==1
                assert not case['errors'],case
                case['status']='PASS';context.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (output/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'cases':len(report['cases']),'output':str(output)}))


if __name__=='__main__':main()
