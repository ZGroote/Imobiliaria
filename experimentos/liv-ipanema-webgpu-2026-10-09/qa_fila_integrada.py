"""Exercise the real LIV files, initial priority, preemption, cache and quota fallback."""
import argparse
import hashlib
import json
import mimetypes
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote

from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
OUT=EXP/'evidencias'/'fila-integrada'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
TOUR='site-baseline/maquete-liv-ipanema.html'


class Fixture:
    def __init__(self):
        self.records=[];self.gates={};self.storage_failure=False;self.lock=threading.Lock()
    def count(self,path):
        with self.lock:return sum(r['path']==path for r in self.records)
    def hold(self,path):
        gate=threading.Event();self.gates[path]=gate;return gate
    def body(self,path):
        body=(EXP/path).read_bytes()
        if path=='transfer-worker.js' and self.storage_failure:
            # Fault injection affects this fixture origin only; production stays unchanged.
            body=b"Cache.prototype.put=()=>Promise.reject(new DOMException('Fixture quota','QuotaExceededError'));\n"+body
        return body


def serve(fixture):
    class Handler(BaseHTTPRequestHandler):
        protocol_version='HTTP/1.1'
        def log_message(self,*_):pass
        def handle(self):
            try:super().handle()
            except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
        def do_GET(self):
            path=unquote(urlsplit(self.path).path).lstrip('/')
            target=(EXP/path).resolve()
            if not target.is_relative_to(EXP) or not target.is_file():self.send_error(404);return
            body=fixture.body(path)
            row={'path':path,'at':time.monotonic(),'sent':0,'complete':False,'aborted':False}
            with fixture.lock:fixture.records.append(row)
            self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(path)[0] or 'application/octet-stream')
            self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers()
            try:
                self.wfile.write(body[:1024]);self.wfile.flush();row['sent']=min(1024,len(body))
                gate=fixture.gates.get(path)
                if gate:gate.wait(60)
                for offset in range(1024,len(body),256*1024):
                    chunk=body[offset:offset+256*1024];self.wfile.write(chunk);self.wfile.flush();row['sent']+=len(chunk)
                row['complete']=True
            except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):row['aborted']=True
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True
    threading.Thread(target=server.serve_forever,daemon=True).start()
    return server


def wait_for(predicate,message,seconds=15):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        if predicate():return
        time.sleep(.025)
    raise AssertionError(message)


def ready(page,mode):
    page.wait_for_function('mode=>window.__livViewer?.ready&&__livViewer.mode===mode',arg=mode,timeout=120000)
    assert page.locator('iframe').count()==(0 if mode=='planta2d' else 1)


def run(out):
    out.mkdir(parents=True,exist_ok=True)
    fixture=Fixture();server=serve(fixture);url=f'http://127.0.0.1:{server.server_port}/maquete-liv-ipanema.html'
    manifest=json.loads((EXP/'transfer-manifest.json').read_text(encoding='utf-8'))
    # The atlas filename follows the source-verified runtime manifest.
    runtime=json.loads((EXP/'assets-prova'/'manifest.json').read_text(encoding='utf-8'))
    atlas_path=next('assets-prova/'+path for path in runtime['files'] if path.endswith('.rgbm.gz'))
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
      'manifestVersion':manifest['version'],'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest()
      for name in ['transfer-worker.js','transfers.js','viewer.js','mapa-retorno.js','transfer-manifest.json','maquete-liv-ipanema.html','mapa-liv-ipanema-5km.html']},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            context=browser.new_context(viewport={'width':1440,'height':900});page=context.new_page();errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            atlas=fixture.hold(atlas_path);tour=fixture.hold(TOUR)
            page.goto(url,wait_until='domcontentloaded')
            wait_for(lambda:fixture.count(atlas_path)>0,'Initial atlas did not start.')
            secondary=[file['path'] for file in manifest['files']]
            assert all(fixture.count(path)==0 for path in secondary),'Secondary transfer preceded usable initial scene.'
            assert not page.evaluate('__livViewer.ready')
            atlas.set();ready(page,'maquete')
            wait_for(lambda:fixture.count(TOUR)==1,'Automatic Tour prefetch did not start.')
            assert page.locator('iframe').count()==1
            assert page.evaluate('__livViewer.frame.contentWindow.__livProva.ready')
            page.wait_for_function('__livTransfers.getState().active?.group==="tour"')
            page.locator('[data-mode="planta2d"]').click();ready(page,'planta2d')
            wait_for(lambda:fixture.count(TOUR)==2,'Interrupted Tour did not restart after selected plant.')
            assert fixture.count('plantas2d/canto.jpg')==1,'Plant foreground duplicated its background transfer.'
            assert page.locator('iframe').count()==0,'Background preparation created a hidden renderer.'
            tour.set()
            page.wait_for_function('Object.values(__livTransfers.getState().groups).every(g=>g.cached===g.total)&&__livTransfers.getState().ready',timeout=120000)
            count_before={path:fixture.count(path) for path in secondary}
            assert all(count_before[path]==(2 if path==TOUR else 1) for path in secondary),count_before
            page.locator('[data-mode="visita"]').click();ready(page,'visita')
            frame=page.frames[-1];identity=frame.evaluate('window.__qaFrameIdentity=Math.random()')
            page.locator('[data-mode="planta3d"]').click();ready(page,'planta3d')
            assert page.frames[-1].evaluate('__qaFrameIdentity')==identity
            assert fixture.count(TOUR)==2,'Cached Tour re-downloaded.'
            page.locator('[data-mode="maquete"]').click();ready(page,'maquete')
            page.locator('#floor').select_option('8')
            page.locator('.map-link').click();page.wait_for_function('window.__livMapAdapter?.ready',timeout=120000)
            page.frames[-1].wait_for_function('window.__livNearby?.ready',timeout=120000)
            assert page.locator('#transferStatus').is_hidden(),'Preparation overlay covers the ready map controls.'
            assert all(fixture.count(path)==count_before[path] for path in secondary),'Native map requests missed the verified cache.'
            page.frames[-1].locator('#livMapaBar a').click();ready(page,'maquete')
            assert page.evaluate('__livViewer.floor')==8
            assert not errors,errors
            page.screenshot(path=str(out/'fila-maquete.png'),full_page=True)
            report['cases'].append({'name':'real-priority-cache','status':'PASS','initialSceneFirst':True,
              'preemptedTourRequests':2,'all124Cached':True,'cachedNativeMapNoNetwork':True,
              'sameInteriorReused':True,'noHiddenScene':True,'errors':errors})
            context.close()

            # Cold map selected while Tour is being prefetched. Native detail
            # demands cannot interrupt the HTML + GLB prerequisites.
            fixture.gates.clear();tour=fixture.hold(TOUR)
            model=fixture.hold('site-baseline/liv-ipanema.glb')
            before_model=fixture.count('site-baseline/liv-ipanema.glb')
            tiles=[file['path'] for file in manifest['files'] if file['group']=='map' and not file['essential']]
            before_tiles={path:fixture.count(path) for path in tiles}
            context=browser.new_context(viewport={'width':768,'height':1024});page=context.new_page()
            errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(url);ready(page,'maquete')
            page.wait_for_function('__livTransfers.getState().active?.group==="tour"')
            page.locator('.map-link').click()
            page.wait_for_function('window.__livMapAdapter?.ready',timeout=120000)
            wait_for(lambda:fixture.count('site-baseline/liv-ipanema.glb')==before_model+1,'Cold map model did not start.')
            assert all(fixture.count(path)==before_tiles[path] for path in tiles),'Detail tile preceded required GLB.'
            assert page.locator('#transferStatus').is_hidden()
            model.set()
            page.frames[-1].wait_for_function('window.__livNearby?.ready',timeout=120000)
            page.wait_for_function('__livTransfers.getState().groups.map.cached===122',timeout=120000)
            assert fixture.count('site-baseline/liv-ipanema.glb')==before_model+1
            assert all(fixture.count(path)==before_tiles[path]+1 for path in tiles),'Cold map repeated native/background tile requests.'
            assert not errors,errors
            report['cases'].append({'name':'cold-map-priority','status':'PASS','modelBefore120Tiles':True,
              'nativeAndBackgroundDeduplicated':True,'errors':errors})
            context.close();tour.set()

            # A separate browser context has no cache and exercises valid foreground
            # delivery despite a deliberate CacheStorage quota failure in the worker.
            fixture.storage_failure=True;fixture.gates.clear()
            context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(url);ready(page,'maquete')
            page.locator('[data-mode="visita"]').click();ready(page,'visita')
            queue=page.evaluate('__livTransfers.getState()')
            assert queue['storageFailed'] and queue['groups']['tour']['downloadFailed']==0,queue
            assert page.locator('#transferStatus').is_visible()
            page.locator('[data-mode="planta2d"]').click();ready(page,'planta2d')
            assert not errors,errors
            page.screenshot(path=str(out/'quota-planta2d.png'),full_page=True)
            report['cases'].append({'name':'quota-foreground','status':'PASS','storageFailed':True,
              'tourOpenedWithoutCache':True,'plantOpenedWithoutCache':True,'errors':errors})
            context.close()

            fixture.storage_failure=False
            context=browser.new_context(viewport={'width':390,'height':844})
            context.add_init_script("Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined});")
            page=context.new_page();page.goto(url);ready(page,'maquete')
            page.locator('[data-mode="planta2d"]').click();ready(page,'planta2d')
            assert page.evaluate('__livTransfers.getState().unavailable')
            report['cases'].append({'name':'unsupported-worker','status':'PASS','nativePlantOpened':True})
            context.close();browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=repr(error);raise
    finally:
        for gate in fixture.gates.values():gate.set()
        server.shutdown();server.server_close()
        report['httpRequests']=fixture.records
        (out/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'cases':len(report['cases']),'output':str(out)}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,default=OUT)
    run(parser.parse_args().saida)
