"""Regressão visual com privacidade real, canvas interno e controles desobstruídos.

Use --assert-fixed para validar os invariantes. O pacote local preservado fornece
a implementação real de Analytics; sua UI permanece presente com métricas recusadas.
"""
import argparse
import io
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent / 'evidencias/orientacao'
SOURCE_ENTRY = '/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html'
PAYLOAD_ENTRY = '/publicacao/liv-duplo-20261017/payload/liv-classico/maquete-liv-ipanema.html'
ANALYTICS = '/publicacao/liv-duplo-20261017/payload/analytics/classico.mjs'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == SOURCE_ENTRY:
            data = (ROOT / SOURCE_ENTRY.lstrip('/')).read_text(encoding='utf-8')
            data = data.replace('</body>', f'<script type="module" src="{ANALYTICS}"></script></body>')
            encoded = data.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
        else:
            super().do_GET()

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass


MEASURE = r'''()=>{
  const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const visible=e=>e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
  const clip=(r,c)=>({x:Math.max(r.x,c.x),y:Math.max(r.y,c.y),right:Math.min(r.right,c.right),bottom:Math.min(r.bottom,c.bottom)});
  const targetInfo=e=>{const r=box(e),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {id:e.id||e.dataset.mode||e.textContent.trim(),rect:r,centerHit:hit?.id||hit?.tagName||null,clickable:e===hit||e.contains(hit)};};
  const panel=document.getElementById('projectPanel'),p=box(panel),toggle=document.getElementById('toggleProjectPanel'),t=box(toggle);
  const buttons=[...document.querySelectorAll('.project-action-row button,.project-action-row a,.interior-navbar button,.interior-navbar select,.back-to-list')].filter(visible);
  const overlaps=[];
  for(const b of buttons){const r=box(b),intersection=clip(clip(r,t),p),w=intersection.right-intersection.x,h=intersection.bottom-intersection.y;if(w>1&&h>1)overlaps.push({button:b.id||b.dataset.mode||b.textContent.trim(),width:w,height:h});}
  const targets=buttons.filter(b=>{const r=box(b);return r.x+r.width/2>=p.x&&r.x+r.width/2<=p.right&&r.y+r.height/2>=p.y&&r.y+r.height/2<=p.bottom;}).map(targetInfo);
  const persistent=[...document.querySelectorAll('.project-action-row button,.project-action-row a,.interior-navbar button,.interior-navbar select,#availabilityFilter select,#btnApartmentInfo')].filter(visible).map(targetInfo);
  const globalControls=[...document.querySelectorAll('.orientation-options button,#siteHomeLink,#liv-analytics-privacy,[data-whatsapp-floating=true],.liv-clock-toggle')].filter(visible).map(targetInfo);
  const details=document.getElementById('projectPanelDetails'),summary=['selectedApartmentTitle','selectedApartmentSale'].map(id=>{const e=document.getElementById(id);return {id,text:e?.textContent,rect:box(e),visible:visible(e)};});
  const toolbar=document.querySelector('.stage-toolbar'),clock=document.querySelector('.liv-clock'),filter=document.getElementById('availabilityFilter');
  const iframe=document.querySelector('#stage iframe:not([data-parked=true])');
  let childLayout=null;
  try{const w=iframe?.contentWindow,d=w?.document,c=d?.querySelector('canvas'),s=d?.getElementById('stage');if(w&&c)childLayout={frame:box(iframe),innerWidth:w.innerWidth,innerHeight:w.innerHeight,canvas:box(c),stage:box(s),canvasComputed:{height:getComputedStyle(c).height,minHeight:getComputedStyle(c).minHeight},stageComputed:s?{height:getComputedStyle(s).height,minHeight:getComputedStyle(s).minHeight}:null,panelSpace:getComputedStyle(s||c).getPropertyValue('--panel-space')};}catch{}
  let projection=null;
  try{
    const w=iframe?.contentWindow,api=w?.__livProva||w?.__livInterior,camera=api?.camera;
    const bounds=api?.data?.visibleBounds|| (api?.framing?.bounds?{min:api.framing.bounds[0],max:api.framing.bounds[1]}:null);
    if(camera&&bounds){camera.updateMatrixWorld();const points=[];for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){const q=camera.position.clone().set(x,y,z).project(camera);points.push([q.x,q.y,q.z]);}projection={bounds,range:{minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))},camera:api.getState?.().camera,autoFrame:api.getState?.().camera?.autoFrame};}
  }catch(error){projection={error:String(error)};}
  let towerProjection=null;
  try{
    const api=iframe?.contentWindow?.__livProva,camera=api?.camera;let bounds=null,count=0;
    api?.scene?.traverse(mesh=>{if(!mesh.geometry||mesh.userData.tower!==0)return;count++;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const part=mesh.geometry.boundingBox.clone().setFromObject(mesh);if(bounds)bounds.union(part);else bounds=part;});
    const logo=api?.scene?.getObjectByName(api.roofLogo||'Letreiro Conecta na cobertura');
    if(bounds&&logo)bounds.union(bounds.clone().setFromObject(logo));
    if(bounds&&camera){camera.updateMatrixWorld();const points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=camera.position.clone().set(x,y,z).project(camera);points.push([p.x,p.y,p.z]);}towerProjection={count,roofIncluded:Boolean(logo),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},range:{minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))}};}
  }catch(error){towerProjection={error:String(error)};}
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},mode:__livViewer.mode,selected:__livViewer.selectedUnitId,typology:__livViewer.typology,collapsed:panel.dataset.collapsed,
    stage:box(document.getElementById('stage')),panel:p,orientation:box(document.getElementById('orientationControls')),experience:box(document.getElementById('experienceBar')),
    privacy:box(document.getElementById('liv-analytics-privacy')),privacyChoice:window.__livAnalytics?.getState?.().choice,bottomPadding:getComputedStyle(document.body).paddingBottom,
    toggle:targetInfo(toggle),targets,persistent,globalControls,summary,details:box(details),detailsScroll:details.scrollTop,toggleOverlaps:overlaps,toolbar:box(toolbar),clock:box(clock),filter:box(filter),projection,towerProjection,childLayout,panelScroll:{top:panel.scrollTop,height:panel.scrollHeight,client:panel.clientHeight}};
}'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', default='verificacao-real')
    parser.add_argument('--source', choices=['payload', 'source', 'online'], default='source')
    parser.add_argument('--exterior-only', action='store_true')
    parser.add_argument('--assert-fixed', action='store_true')
    args = parser.parse_args()
    output = QA / args.phase
    output.mkdir(parents=True, exist_ok=True)
    report = {'source': args.source, 'phase': args.phase, 'errors': [], 'cases': [], 'blockedAnalytics': []}
    server = None
    if args.source == 'online':
        url = 'https://conectaimoveis3d.com.br/maquetes/liv/?backend=webgl'
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        path = SOURCE_ENTRY if args.source == 'source' else PAYLOAD_ENTRY
        url = f'http://127.0.0.1:{server.server_port}' + path + '?backend=webgl'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1.8)
            # Mantém os controles de privacidade reais; só a opção recusada é restaurada.
            context.add_init_script("localStorage.setItem('liv.analytics.choice.v1','no');")
            for pattern in ['**/*google-analytics.com/**', '**/*googletagmanager.com/**']:
                context.route(pattern, lambda route: (report['blockedAnalytics'].append(route.request.url.split('?')[0]), route.abort())[1])
            page = context.new_page()
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            print('Abrindo ' + args.source, flush=True)
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function('window.__livViewer?.ready', timeout=120000)
            page.wait_for_function("__livViewer.relationStatus==='fornecido'", timeout=30000)
            if args.assert_fixed:
                page.wait_for_function('Boolean(__livViewer.frame?.contentWindow?.__livProva?.roofLogo)',timeout=30000)
            page.wait_for_selector('#liv-analytics-privacy')
            print('Maquete pronta; privacidade real presente.', flush=True)

            def capture(label, width=800, height=300):
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_timeout(250)
                data = page.evaluate(MEASURE)
                data['label'] = label
                report['cases'].append(data)
                page.screenshot(path=str(output / f'{label}-{width}x{height}.png'))
                (output / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
                print(f"{label}: {width}x{height}, palco={data['stage']['width']:.0f}x{data['stage']['height']:.0f}, overlaps={len(data['toggleOverlaps'])}, corte={data['projection']['range'] if data['projection'] and 'range' in data['projection'] else None}", flush=True)
                if args.assert_fixed:
                    assert data['toggle']['clickable'], (label, 'toggle inacessível', data['toggle'])
                    assert not data['toggleOverlaps'], (label, 'toggle sobre as ações', data['toggleOverlaps'])
                    assert all(t['clickable'] for t in data['targets']), (label, 'centro de ação coberto', data['targets'])
                    if data['childLayout']:
                        assert data['childLayout']['canvas']['height'] <= data['childLayout']['frame']['height'] + 1, (label, 'canvas cortado pelo iframe', data['childLayout'])
                    if width > height:
                        assert data['stage']['height'] >= height * .65, (label, 'área visual menor que65%', data['stage'])
                        assert data['panel']['width'] <= 217, (label, 'painel muito largo', data['panel'])
                        assert data['bottomPadding'] == '0px', (label, 'rodapé vazio continua reservado', data['bottomPadding'])
                        for target in data['persistent']:
                            r,p=target['rect'],data['panel']
                            assert r['x'] >= p['x']-1 and r['right'] <= p['right']+1 and r['y'] >= p['y']-1 and r['bottom'] <= p['bottom']+1, (label,'ação persistente fora do painel',target)
                            assert target['clickable'] and r['height'] >= 44, (label,'ação persistente coberta ou pequena',target)
                        if data['selected'] and data['collapsed']=='false' and data['detailsScroll']==0:
                            for item in data['summary']:
                                assert item['visible'] and item['text'] and item['rect']['y']>=data['details']['y']-1 and item['rect']['bottom']<=data['details']['bottom']+1, (label,'nome ou preço oculto',item,data['details'])
                    assert all(t['clickable'] for t in data['globalControls']), (label,'controle global coberto',data['globalControls'])
                    framed = data['towerProjection'] if data['mode'] == 'maquete' else data['projection'] if data['mode'] == 'planta3d' else None
                    if framed and 'range' in framed:
                        assert all(abs(v) <= 1.01 for v in framed['range'].values()), (label, 'volume cortado', framed)

            def toggle(collapse):
                actual = page.locator('#projectPanel').get_attribute('data-collapsed') == 'true'
                if actual != collapse:
                    page.locator('#toggleProjectPanel').click()
                    page.wait_for_timeout(100)

            capture('maquete-inicial-retrato', 390, 844)
            capture('maquete-inicial-paisagem')
            if args.assert_fixed:
                solar=page.locator('.liv-clock-toggle')
                solar.click()
                assert solar.get_attribute('aria-expanded')=='true'
                slider=page.locator('#livHour');assert slider.is_visible()
                old=float(slider.input_value());slider.focus();slider.press('ArrowUp')
                assert float(slider.input_value())!=old
                slider.press('ArrowDown');assert abs(float(slider.input_value())-old)<.001
                solar.click();assert solar.get_attribute('aria-expanded')=='false' and not slider.is_visible()
                page.locator('#liv-analytics-privacy').click()
                consent=page.locator('#liv-analytics-consent');assert consent.is_visible()
                consent.get_by_role('button',name='Fechar',exact=True).click()
                assert consent.is_hidden() and page.evaluate('getComputedStyle(document.body).paddingBottom')=='0px'
                report['solarAndPrivacyControls']='PASS'
                capture('maquete-inicial-curta',568,280)
            toggle(True)
            capture('maquete-inicial-minimizada')
            toggle(False)
            page.set_viewport_size({'width': 390, 'height': 844})
            page.locator('#availableUnitList button').first.click()
            capture('maquete-selecionada-retrato', 390, 844)
            capture('maquete-selecionada-paisagem')
            if args.assert_fixed:
                capture('maquete-selecionada-curta',568,280)
            if args.assert_fixed:
                exterior=next(f for f in page.frames if f.parent_frame==page.main_frame and f.evaluate('Boolean(window.__livProva)'))
                page.set_viewport_size({'width':800,'height':300});page.wait_for_timeout(150)
                rect=exterior.locator('canvas').bounding_box()
                page.mouse.move(rect['x']+20,rect['y']+20);page.mouse.down()
                page.mouse.move(rect['x']+52,rect['y']+22,steps=5);page.mouse.up()
                before=exterior.evaluate('({position:__livProva.camera.position.toArray(),target:__livProva.controls.target.toArray(),preset:__livProva.camera.userData.viewName})')
                assert before['preset'] is None
                page.set_viewport_size({'width':568,'height':280});page.wait_for_timeout(150)
                after=exterior.evaluate('({position:__livProva.camera.position.toArray(),target:__livProva.controls.target.toArray()})')
                assert all(abs(a-b)<1e-7 for key in ['position','target'] for a,b in zip(before[key],after[key])),('órbita manual alterada',before,after)
                report['manualExteriorPreserved']='PASS'
                page.evaluate('()=>__livViewer.showUnitSide(__livViewer.units.units.find(u=>u.id===__livViewer.selectedUnitId).side)')
                page.set_viewport_size({'width':800,'height':300})
            page.locator('#projectPanelDetails').evaluate('e=>e.scrollTop=e.scrollHeight')
            capture('maquete-selecionada-rolada')
            page.locator('#projectPanelDetails').evaluate('e=>e.scrollTop=0')
            for mode in ([] if args.exterior_only else ['planta2d', 'planta3d', 'visita']):
                page.set_viewport_size({'width': 390, 'height': 844})
                toggle(False)
                if mode == 'planta2d':
                    page.locator('#selectedApartmentActions [data-unit-open="planta2d"]').click()
                else:
                    page.locator(f'#viewModes [data-mode="{mode}"]').click()
                page.wait_for_function('m=>__livViewer.ready&&__livViewer.mode===m', arg=mode, timeout=60000)
                capture(mode + '-retrato', 390, 844)
                capture(mode + '-paisagem')
                if args.assert_fixed:
                    capture(mode + '-curta',568,280)
                page.locator('#projectPanelDetails').evaluate('e=>e.scrollTop=e.scrollHeight')
                capture(mode + '-rolada')
                page.locator('#projectPanelDetails').evaluate('e=>e.scrollTop=0')
                toggle(True)
                capture(mode + '-minimizada')
                page.locator('#projectPanel').evaluate('e=>e.scrollTop=e.scrollHeight')
                capture(mode + '-minimizada-rolada')
                page.locator('#projectPanel').evaluate('e=>e.scrollTop=0')
                capture(mode + '-minimizada-curta', 780, 280)
                toggle(False)
                if mode == 'planta3d':
                    page.set_viewport_size({'width': 390, 'height': 844})
                    frame = next(frame for frame in page.frames if frame.parent_frame == page.main_frame and frame.evaluate('Boolean(window.__livInterior)'))
                    canvas = frame.locator('canvas').bounding_box()
                    x, y = canvas['x'] + canvas['width'] * .35, canvas['y'] + canvas['height'] * .45
                    page.mouse.move(x, y)
                    page.mouse.down()
                    page.mouse.move(x + 3, y + 1, steps=3)
                    page.mouse.up()
                    capture('planta3d-apos-gesto-retrato', 390, 844)
                    capture('planta3d-apos-gesto-paisagem')
            assert not report['errors'], report['errors']
            report['status'] = 'PASS' if args.assert_fixed else 'OBSERVED'
            browser.close()
    finally:
        (output / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        if server:
            server.shutdown()
    print(f"Registrados {len(report['cases'])} estados; inspecione runtime.json e capturas.", flush=True)


if __name__ == '__main__':
    main()
