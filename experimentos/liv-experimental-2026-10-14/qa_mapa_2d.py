"""Valida mapa real, filtros, retorno e falha de rede em desktop e celular."""
import json
import os
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent/'evidencias/mapa-2d'
ENTRY = '/experimentos/liv-experimental-2026-10-14/mapa-liv-ipanema-5km.html'
LARA_ENTRY = os.environ.get('LARA_MAP_ENTRY', '/experimentos/laranjeiras-2026-10-30/site/mapa-liv-ipanema-5km.html')


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    reports = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome', headless=True)
            for width, height in [(1440,900), (390,844), (320,568), (780,280)]:
                print(f'Validando {width}x{height}', flush=True)
                context = browser.new_context(viewport={'width':width,'height':height})
                page = context.new_page();errors=[];requests=[]
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type=='error' else None)
                page.on('request', lambda request: requests.append(request.url))
                page.goto(origin+ENTRY+'?geometria=entrada&unidades=edificio&estoque=liv-ipanema&hora=15')
                page.wait_for_function('window.__livMapAdapter?.ready', timeout=40000)
                assert page.evaluate('window.__livMapAdapter.model?.geometryVerified'), page.frames[1].locator('#map-status').inner_text()
                assert page.evaluate('window.__livMapAdapter.model.properties.length')==2
                frame = page.frame_locator('#map')
                inner = page.frames[1]
                inner.wait_for_function("window.__livMap2D.map.isSourceLoaded('satellite')", timeout=30000)
                frame.locator('.liv-property').wait_for(state='visible')
                label=inner.locator('.liv-property').bounding_box()
                ground=inner.evaluate('window.__livMap2D.map.project(window.__livMap2D.marker.getLngLat()).y')
                assert label['y']+label['height']<ground-10, 'Nome deve flutuar acima do prédio'
                before=inner.evaluate('({bearing:window.__livMap2D.map.getBearing(),pitch:window.__livMap2D.map.getPitch()})')
                x,y=width*.4,height*.65
                page.mouse.move(x,y);page.mouse.down(button='right');page.mouse.move(x+60,y-20,steps=6);page.mouse.up(button='right')
                after=inner.evaluate('({bearing:window.__livMap2D.map.getBearing(),pitch:window.__livMap2D.map.getPitch()})')
                assert after['bearing']<before['bearing']-30 and after['pitch']>before['pitch']+5, 'Arraste direito para cima deve aumentar a inclinação'
                raised=inner.locator('.liv-property').bounding_box()
                assert raised['y']<label['y']-1, 'Ao arrastar para cima, o topo do prédio deve subir na tela'
                frame.locator('#center').click()
                frame.locator('#pins').click()
                assert inner.evaluate('window.__livNearby.pins') is False
                assert frame.locator('.liv-property').is_visible()
                frame.locator('#pins').click()
                frame.locator('#filters').click()
                frame.locator('#category').select_option('farmacia')
                assert inner.evaluate('window.__livNearby.total') > 0
                frame.locator('#search').fill('zzzinexistente')
                assert frame.get_by_text('Nenhum local encontrado.', exact=False).is_visible()
                frame.locator('#search').fill('')
                frame.locator('#results button').first.click()
                assert frame.locator('.maplibregl-popup').is_visible()
                frame.locator('.maplibregl-popup-close-button').click()
                frame.locator('#center').click()
                inner.wait_for_function('window.__livMap2D.map.getCenter().distanceTo(window.__livMap2D.marker.getLngLat())<1')
                href=frame.locator('#return').get_attribute('href')
                assert 'estoque=liv-ipanema' in href and 'geometria=entrada' in href and 'hora=15' in href
                assert not any('/quintais/' in u for u in requests)
                assert frame.locator('.maplibregl-canvas').is_visible()
                assert not errors, errors
                frame.locator('#filters').click()
                frame.locator('#category').select_option('')
                frame.locator('#close-filters').click()
                assert inner.evaluate('window.__livMap2D.map.getPitch()')>40
                frame.locator('#view-angle').click()
                assert inner.evaluate('window.__livMap2D.map.getPitch()')==0
                frame.locator('#view-angle').click()
                assert inner.evaluate('window.__livMap2D.map.getPitch()')>40
                morning=inner.evaluate("window.__livMap2D.setTime(9,'2026-11-01')")
                if width==1440:
                    inner.wait_for_function('window.__livMap2D.map.loaded()')
                    page.screenshot(path=str(OUT/'mapa-manha.png'))
                afternoon=inner.evaluate("window.__livMap2D.setTime(15,'2026-11-01')")
                assert morning['directionGeo'][0]>0 and afternoon['directionGeo'][0]<0
                inner.wait_for_function('window.__livMap2D.map.loaded()')
                page.screenshot(path=str(OUT/f'mapa-{width}.png'))
                if width==1440:
                    inner.evaluate("window.__livMap2D.setTime(6.5,'2026-11-01');window.__livMap2D.map.jumpTo({bearing:60,pitch:70,zoom:18})")
                    inner.wait_for_function('window.__livMap2D.map.loaded()')
                    page.screenshot(path=str(OUT/'fachada-oposta-60.png'))
                    inner.evaluate('window.__livMap2D.map.jumpTo({bearing:240})')
                    inner.wait_for_function('window.__livMap2D.map.loaded()')
                    page.screenshot(path=str(OUT/'fachada-oposta-240.png'))
                    inner.evaluate('window.__livMap2D.map.jumpTo({bearing:-20,pitch:55,zoom:17.6})')
                    inner.evaluate("window.__livMap2D.setTime(0,'2026-11-01')")
                    inner.wait_for_function('window.__livMap2D.map.loaded()')
                    assert inner.evaluate('window.__livMapSolar.night')==1
                    assert inner.evaluate("window.__livMap2D.map.getPaintProperty('satellite','raster-brightness-max')")<.3
                    page.screenshot(path=str(OUT/'mapa-noite.png'))
                reports.append({'width':width,'height':height,'nearby':inner.evaluate('window.__livNearby'),'errors':errors,'pitch':inner.evaluate('window.__livMap2D.map.getPitch()')})
                context.close()
            for width,height in [(1440,900),(390,844)]:
                context=browser.new_context(viewport={'width':width,'height':height});page=context.new_page()
                errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                page.goto(origin+LARA_ENTRY+'?hora=15')
                page.wait_for_function('window.__livMapAdapter?.ready',timeout=40000)
                assert page.evaluate('window.__livMapAdapter.model?.propertyId')=='parque-das-laranjeiras'
                assert page.evaluate('window.__livMapAdapter.model.properties.length')==2
                inner=page.frames[1]
                inner.locator('.liv-property').wait_for(state='visible')
                assert inner.locator('.liv-property').inner_text()=='Parque das Laranjeiras'
                assert inner.locator('#livMapaBar strong').inner_text()=='Parque das Laranjeiras'
                assert 'maquete-laranjeiras.html' in inner.locator('#return').get_attribute('href')
                assert inner.evaluate('window.__livMap2D.map.getCenter().distanceTo(window.__livMap2D.marker.getLngLat())')<1
                positions=inner.evaluate('window.__livMap2D.building.metadata.properties.map(p=>{const v=window.__livMap2D.map.project([p.center[1],p.center[0]]);return {id:p.id,x:v.x,y:v.y};})')
                assert all(0<v['x']<width and 0<v['y']<height for v in positions),positions
                inner.wait_for_function("window.__livMap2D.map.isSourceLoaded('satellite')")
                assert not errors,errors
                page.screenshot(path=str(OUT/f'laranjeiras-{width}.png'))
                reports.append({'focus':'parque-das-laranjeiras','width':width,'positions':positions,'errors':errors})
                context.close()
            context=browser.new_context();page=context.new_page()
            page.route('**/World_Imagery/**',lambda route:route.abort())
            page.goto(origin+ENTRY);page.wait_for_function('window.__livMapAdapter?.ready')
            inner=page.frames[1]
            inner.get_by_text('Imagem de satélite indisponível.',exact=False).wait_for()
            assert inner.locator('.liv-property').is_visible()
            context.close()
            context=browser.new_context();page=context.new_page()
            page.route('**/embedded-map-test.html',lambda route:route.fulfill(content_type='text/html',body=f'<iframe id="embedded" style="width:100vw;height:100vh" src="{ENTRY}?embed=1&prewarm=1&geometria=entrada"></iframe><script>window.addEventListener("message",event=>{{if(event.data.type==="liv-map-return")window.returned=true;}})</script>'))
            page.goto(origin+'/embedded-map-test.html')
            outer=page.frame_locator('#embedded')
            page.wait_for_function("document.querySelector('#embedded').contentWindow.__livMapAdapter?.ready")
            assert page.evaluate("document.querySelector('#embedded').contentWindow.__livMapAdapter.active") is False
            page.evaluate("document.querySelector('#embedded').contentWindow.__livMapAdapter.setActive(true)")
            inner=page.frames[2]
            inner.evaluate("window.__livMap2D.setTime(17,'2026-11-01')")
            page.wait_for_function("document.querySelector('#embedded').contentWindow.__livMapAdapter.returnURL.includes('hora=17')")
            outer.frame_locator('#map').locator('#return').click()
            page.wait_for_function('window.returned===true')
            context.close();browser.close()
    finally:
        server.shutdown()
    (OUT/'runtime.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'status':'PASS','viewports':len(reports),'evidence':str(OUT)}))


if __name__ == '__main__':
    main()
