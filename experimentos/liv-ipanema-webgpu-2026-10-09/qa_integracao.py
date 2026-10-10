"""QA do fluxo de quatro modos; usa GPU desktop e toque em viewport emulado."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html'


def ready(page,mode):
    page.wait_for_function('m=>__livViewer.ready&&__livViewer.mode===m',arg=mode,timeout=120000)
    assert page.locator('iframe').count()==(0 if mode=='planta2d' else 1)


def drag(page,locator,mobile):
    locator.scroll_into_view_if_needed()
    rect=locator.bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2
    if mobile:
        session=page.context.new_cdp_session(page)
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for i in range(1,7):
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+70*i/6,'y':y+12*i/6}]})
            page.wait_for_timeout(30)
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()
    else:
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+70,y+12,steps=6);page.mouse.up()
    page.wait_for_timeout(250)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias'/'integracao')
    parser.add_argument('--ciclos',type=int,default=3)
    parser.add_argument('--perfil',choices=['todos','desktop-webgpu','desktop-webgl','toque'],default='todos')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING','physicalMobile':False,
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
            ['viewer.js','renderer.js','transfers.js','transfer-worker.js','maquete-liv-ipanema.html']},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            profiles={'desktop-webgpu':(1440,900,'webgpu'),'desktop-webgl':(1440,900,'webgl'),'toque':(390,844,'auto')}
            cases=profiles.values() if args.perfil=='todos' else [profiles[args.perfil]]
            for width,height,backend in cases:
                case={'viewport':[width,height],'backendRequested':backend,'errors':[],'httpFailures':[],'modes':{},'cycles':0}
                report['cases'].append(case)
                context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width==390,has_touch=width==390,accept_downloads=True)
                context.add_init_script("const media=window.matchMedia;window.__touchDetection=[];window.matchMedia=function(query){const result=media.call(this,query);if(query.includes('coarse'))window.__touchDetection.push({query,matches:result.matches,atMs:performance.now()});return result;};")
                page=context.new_page()
                page.on('pageerror',lambda e,c=case:c['errors'].append(str(e)))
                page.on('response',lambda r,c=case:c['httpFailures'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
                page.goto(URL+'?backend='+backend,wait_until='load',timeout=120000);ready(page,'maquete')
                assert page.evaluate('__livViewer.frame.contentWindow.__livProva.meshes.length')==56
                case['backend']=page.evaluate('__livViewer.backend')
                for view in ['perspectiva','fachada','aerea','portaria','implantacao']:
                    page.locator('[data-view="'+view+'"]').click()
                page.locator('[data-view="perspectiva"]').click()
                page.locator('#floor').select_option('8')
                assert page.evaluate('__livViewer.frame.contentWindow.__livProva.getState().floor')==8
                page.screenshot(path=str(args.saida/f'{backend}-{width}-maquete.png'),full_page=width!=390)
                for mode in ['planta2d','planta3d','visita']:
                    page.locator('[data-mode="'+mode+'"]').click();ready(page,mode)
                    assert page.locator('#interiorNote').is_visible()
                    if mode=='planta2d':
                        assert page.locator('#stage img').is_visible()
                        assert page.evaluate('__livViewer.frame===null')
                        with page.expect_download(timeout=15000) as info:page.locator('#capture').click()
                        path=args.saida/f'{backend}-{width}-{mode}.png';info.value.save_as(path)
                        assert path.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
                        case['modes'][mode]={'standaloneImage':True,'no3DRenderer':True}
                        page.screenshot(path=str(args.saida/f'{backend}-{width}-{mode}-layout.png'),full_page=width!=390)
                        page.locator('[data-mode="maquete"]').click();ready(page,'maquete')
                        continue
                    frame=page.frames[-1]
                    details=frame.evaluate('''()=>{const m=__livInterior;return {mode:m.mode,
                        ready:m.ready,typology:m.typology,backend:m.backend,state:m.getState(),
                        coarseNow:matchMedia('(pointer:coarse)').matches};}''')
                    case['modes'][mode]=details
                    assert details['mode']==mode and details['ready'] and details['typology']=='canto',details
                    assert details['backend']==case['backend'],details
                    # Detailed navigation, touch and two-layout checks live in qa_interiores.py.
                    with page.expect_download(timeout=15000) as info:page.locator('#capture').click()
                    path=args.saida/f'{backend}-{width}-{mode}.png';info.value.save_as(path)
                    assert path.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
                    case['modes'][mode]=details
                    page.screenshot(path=str(args.saida/f'{backend}-{width}-{mode}-layout.png'),full_page=width!=390)
                    page.locator('[data-mode="maquete"]').click();ready(page,'maquete')
                    assert page.evaluate('__livViewer.frame.contentWindow.__livProva.meshes.filter(m=>m.visible).length')==56
                    assert page.evaluate('__livViewer.frame.contentWindow.__livProva.getState().floor')==8
                session=context.new_cdp_session(page);session.send('Performance.enable')
                case['memorySamples']=[]
                for cycle in range(args.ciclos+1):
                    if cycle%5==0 or cycle==args.ciclos:
                        session.send('HeapProfiler.collectGarbage')
                        metrics={m['name']:m['value'] for m in session.send('Performance.getMetrics')['metrics']}
                        case['memorySamples'].append({'cycle':cycle,'hostJsHeapBytes':metrics.get('JSHeapUsedSize'),
                            'documents':metrics.get('Documents'),'nodes':metrics.get('Nodes')})
                    if cycle==args.ciclos:break
                    page.locator('[data-mode="planta3d"]').click();ready(page,'planta3d')
                    page.locator('[data-mode="maquete"]').click();ready(page,'maquete');case['cycles']+=1
                session.detach()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
                case['activeFrames']=page.locator('iframe').count()
                assert not case['errors'] and not case['httpFailures'],case
                context.close()
            # Recovery when neither 3D backend is available: standalone local plant.
            context=browser.new_context(viewport={'width':390,'height':844})
            context.add_init_script("Object.defineProperty(navigator,'gpu',{get:()=>undefined});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl'||t==='webgl2'?null:get.call(this,t,...a);};")
            page=context.new_page();page.goto(URL,wait_until='load',timeout=120000)
            page.wait_for_function('__livViewer.error',timeout=120000)
            page.locator('#fallback').click()
            page.wait_for_function('__livViewer.ready&&__livViewer.mode==="planta2d"',timeout=15000)
            assert page.locator('iframe').count()==0 and page.locator('#stage img').is_visible()
            report['fallback2D']='PASS';page.screenshot(path=str(args.saida/'fallback2d.png'),full_page=True)
            context.close();browser.close()
        report['status']='PASS'
    except Exception as exc:
        report['status']='FAIL';report['failure']=str(exc);raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'cases':len(report['cases']),'output':str(args.saida)}))


if __name__=='__main__':main()
