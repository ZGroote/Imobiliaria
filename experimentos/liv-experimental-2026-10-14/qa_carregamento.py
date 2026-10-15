"""Exercita espera com progresso, inatividade e uma abertura sob Slow 4G emulada."""
import argparse
import functools
import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
ROOT=EXP.parents[1]
REL='experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html?backend=webgl'
ACCELERATE="""(()=>{
 if(top!==self)return;
 const original=performance.now.bind(performance);let previous=original(),offset=0;
 Object.defineProperty(performance,'now',{value:()=>{
   const actual=original(),progress=window.__livViewer?.frame?.contentWindow?.__livProva?.progress;
   if(progress?.phase==='download')offset+=(actual-previous)*49;
   previous=actual;return actual+offset;
 }});
})()"""


class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

    def handle(self):
        try:super().handle()
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass

    def do_GET(self):
        name=urlsplit(self.path).path
        if not name.endswith('.gz'):return super().do_GET()
        target=Path(self.translate_path(self.path))
        if not target.is_file():return super().do_GET()
        behavior=self.server.behavior
        self.send_response(200);self.send_header('Content-Type','application/gzip')
        self.send_header('Content-Length',str(target.stat().st_size));self.end_headers()
        try:
            self.wfile.flush()
            if behavior=='stall' and name.endswith('irradiance.rgbm.gz'):time.sleep(3)
            with target.open('rb') as stream:
                while chunk:=stream.read(512*1024):
                    self.wfile.write(chunk);self.wfile.flush();time.sleep(.12)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sem-4g',action='store_true',help='Executa somente os casos determinísticos.')
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias'/'carregamento-progressivo')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING','physicalMobile':False,
        'limits':'Casos determinísticos aceleram somente o relógio do parent durante download. Slow 4G usa CDP e relógio normal, servidor local sem compressão HTTP. Não mede celular físico ou melhoria de FPS.',
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
                       ['viewer.js','renderer.js','maquete-liv-ipanema.html','transfers.js','transfer-worker.js','qa_carregamento.py']},'cases':[]}
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    server.behavior='steady';thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            for behavior in ['steady','stall']:
                server.behavior=behavior
                case={'behavior':behavior,'acceleratedParentClock':True,'errors':[]};report['cases'].append(case)
                ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
                page=ctx.new_page();page.add_init_script(ACCELERATE)
                page.on('pageerror',lambda e,c=case:c['errors'].append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/'+REL,wait_until='commit',timeout=30000)
                if behavior=='steady':
                    page.wait_for_function('window.__livViewer?.loadingProgress?.phase==="download"',timeout=30000)
                    page.locator('[data-mode="maquete"]').click()
                    assert not page.evaluate('__livViewer.ready') and page.locator('#loading').is_visible()
                    assert page.locator('#capture').is_disabled()
                    case['repeatedMaqueteDuringDownload']='PASS'
                page.wait_for_function('window.__livViewer?.ready||window.__livViewer?.error',timeout=45000)
                case['final']=page.evaluate('({ready:__livViewer.ready,error:__livViewer.error,clockMs:performance.now(),progress:__livViewer.loadingProgress,iframes:document.querySelectorAll("iframe").length})')
                if behavior=='steady':
                    assert case['final']['ready'] and not case['final']['error'],case
                    assert case['final']['clockMs']>90000,case
                else:
                    assert not case['final']['ready'] and 'demorou' in case['final']['error'],case
                    assert case['final']['iframes']==0 and page.locator('#fallback').is_visible(),case
                    page.locator('#fallback').click();page.wait_for_function('__livViewer.ready&&__livViewer.mode==="planta2d"',timeout=10000)
                    case['fallback2D']='PASS'
                assert not case['errors'],case;case['status']='PASS';ctx.close()
            ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto('http://127.0.0.1:8790/'+REL,wait_until='load',timeout=30000)
            page.wait_for_function('window.__livViewer',timeout=30000)
            page.evaluate("__livViewer.setMode('planta3d');__livViewer.setMode('visita');void 0")
            page.wait_for_function('__livViewer.ready||__livViewer.error',timeout=60000)
            result=page.evaluate('({ready:__livViewer.ready,error:__livViewer.error,mode:__livViewer.mode,iframes:document.querySelectorAll("iframe").length})')
            assert result['ready'] and not result['error'] and result['mode']=='visita' and result['iframes']==1 and not errors,result
            report['cases'].append({'behavior':'interior-to-tour-before-ready','status':'PASS','final':result});ctx.close()
            if not args.sem_4g:
                case={'behavior':'slow4g','acceleratedParentClock':False,'network':{'latencyMs':150,'downloadBitsPerSecond':1600000},'errors':[]}
                report['cases'].append(case)
                ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
                page=ctx.new_page();page.on('pageerror',lambda e:case['errors'].append(str(e)))
                cdp=ctx.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
                cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':200000,'uploadThroughput':93750})
                page.goto('http://127.0.0.1:8790/'+REL,wait_until='commit',timeout=300000)
                page.wait_for_function('window.__livViewer?.ready||window.__livViewer?.error',timeout=300000,polling=250)
                case['final']=page.evaluate('({ready:__livViewer.ready,error:__livViewer.error,readyMs:performance.now(),progress:__livViewer.loadingProgress})')
                assert case['final']['ready'] and not case['final']['error'] and not case['errors'],case
                page.screenshot(path=str(args.saida/'slow4g-pronto.png'),full_page=True)
                case['status']='PASS';ctx.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        server.shutdown();server.server_close()
        (args.saida/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'output':str(args.saida)}))


if __name__=='__main__':main()
