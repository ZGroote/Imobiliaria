"""Confere layout estreito, mapa preservado, retorno e cache de navegação."""
import importlib.util
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
ROOT=EXP.parents[1]
OUT=EXP/'evidencias'/'navegacao'
URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=OUT)
    args=parser.parse_args();out=args.saida
    spec=importlib.util.spec_from_file_location('baseline_qa',ROOT/'experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py')
    baseline=importlib.util.module_from_spec(spec);spec.loader.exec_module(baseline)
    out.mkdir(parents=True,exist_ok=True)
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING','physicalMobile':False,
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
        ['viewer.js','transfers.js','transfer-worker.js','mapa-retorno.js','maquete-liv-ipanema.html','mapa-liv-ipanema-5km.html']},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            for width,height in [(320,740),(768,1024),(1440,900)]:
                case={'viewport':[width,height],'errors':[]};report['cases'].append(case)
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width==320,has_touch=width==320)
                page=context.new_page();page.on('pageerror',lambda error,c=case:c['errors'].append(str(error)))
                page.goto(URL);page.wait_for_function('__livViewer.ready',timeout=120000)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
                boxes=page.locator('[data-mode],[data-view],#floor,#capture,#typology').evaluate_all('(nodes)=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height};})')
                assert all(b['x']>=0 and b['right']<=width+1 and b['height']>=44 for b in boxes),boxes
                page.locator('#floor').select_option('8')
                before=page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
                page.locator('.map-link').click();page.wait_for_url('**/mapa-liv-ipanema-5km.html')
                page.wait_for_function('window.__livMapAdapter?.ready',timeout=120000)
                frame=page.frames[-1];frame.wait_for_function('window.__livNearby?.ready',timeout=120000)
                assert page.locator('#transferStatus').is_hidden()
                page.screenshot(path=str(out/f'mapa-{width}.png'),full_page=True)
                baseline.check_ui(frame.evaluate(baseline.UI))
                assert frame.evaluate('__livMapa.raio')==5000
                case['mapReturnURL']=frame.locator('#livMapaBar a').get_attribute('href')
                assert case['mapReturnURL']==URL
                page.go_back();page.wait_for_function('__livViewer.ready&&__livViewer.frame',timeout=120000)
                after=page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
                assert after['floor']==8 and after['view']==before['view'],after
                assert sum(abs(a-b) for a,b in zip(before['camera']['position'],after['camera']['position']))<.01
                case['browserBackRestored']=True
                page.screenshot(path=str(out/f'maquete-{width}.png'),full_page=True)
                page.locator('.map-link').click();page.wait_for_function('window.__livMapAdapter?.ready',timeout=120000)
                page.frames[-1].locator('#livMapaBar a').click()
                page.wait_for_url('**/liv-experimental-2026-10-14/maquete-liv-ipanema.html')
                page.wait_for_function('__livViewer.ready',timeout=120000)
                assert page.evaluate('__livViewer.frame.contentWindow.__livProva.meshes.length')==56
                assert not case['errors'],case
                case['returnToNewViewer']=True;case['status']='PASS';context.close()
            browser.close()
        # Decode the actual downloads; a PNG signature alone cannot rule out an empty capture.
        captures=[]
        for directory in ['integracao-final','prova-webgpu-responsive']:
            for path in (EXP/'evidencias'/directory).glob('*.png'):
                if 'layout' in path.name or 'maquete' in path.name:continue
                with Image.open(path) as image:
                    image.load();assert image.format=='PNG' and min(image.size)>=200,path
                    variance=max(ImageStat.Stat(image.convert('RGB')).var)
                    assert variance>10,path
                    captures.append({'file':str(path.relative_to(EXP)),'size':image.size,'maxRgbVariance':variance})
        report['decodedPNGs']=captures;report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (out/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'cases':len(report['cases']),'output':str(out)}))


if __name__=='__main__':main()
