"""Testa os modos reais da miniatura LIV e a entrada do mapa regional."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

PASTA = Path(__file__).resolve().parent
STATE = """()=>{const m=__maq,ms=m.predio.children.filter(o=>o.isMesh),p=m.planta();
 const img=document.querySelector('#p2d image');return {mode:m.modo(),total:ms.length,
 visible:ms.filter(o=>o.visible).length,siteVisible:ms.filter(o=>o.userData.tower!==0&&o.visible).length,
 exteriorVisible:m.predio.visible,plantVisible:!!p?.visible,
 plantMeshes:p?[...(()=>{const a=[];p.traverse(o=>{if(o.isMesh)a.push(o)});return a})()].length:0,
 officialImage:!!img?.getAttribute('href')?.startsWith('data:image/'),
 viewBox:document.getElementById('p2d').getAttribute('viewBox'),
 camera:m.cam.position.toArray(),orbit:{theta:m.orb.th,phi:m.orb.ph,radius:m.orb.r},
 fp:{x:m.FP.x,z:m.FP.z,yaw:m.FP.yaw,pitch:m.FP.pitch},
 modes:[...document.querySelectorAll('#modos button[data-modo]')].map(e=>e.dataset.modo),
 pressed:[...document.querySelectorAll('#modos button[aria-pressed=true]')].map(e=>e.dataset.modo),
 cameras:document.querySelectorAll('#livCameras [data-vista]').length,
 towerButton:!!document.getElementById('verConjunto'),lightReady:!!window.__livLightmap?.ready,
 mapLabel:document.getElementById('verMapa').textContent,
 mapAccessibleLabel:document.getElementById('verMapa').getAttribute('aria-label'),
 mapHref:document.getElementById('verMapa').getAttribute('href')};}"""


def completa(state):
    assert state['mode'] == 'maquete' and state['exteriorVisible'], state
    assert state['total'] == state['visible'] == 56 and state['siteVisible'] == 43, state
    assert state['modes'] == ['maquete', 'planta2d', 'planta3d', 'visita'], state
    assert state['pressed'] == ['maquete'] and not state['towerButton'], state


def drag(page, mobile, element='#c', dx=60, dy=10):
    page.locator(element).scroll_into_view_if_needed()
    rect = page.locator(element).bounding_box()
    x, y = rect['x'] + rect['width'] * .5, rect['y'] + rect['height'] * .5
    if mobile:
        session = page.context.new_cdp_session(page)
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for i in range(1, 6):
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx*i/5, 'y': y + dy*i/5}]})
            page.wait_for_timeout(30)
        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        session.detach()
    else:
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + dx, y + dy, steps=6)
        page.mouse.up()
    page.wait_for_timeout(250)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8788')
    parser.add_argument('--saida', type=Path, default=PASTA / 'qa-miniatura-modos')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    base = args.base_url.rstrip('/')
    result = {'base': base, 'status': 'RUNNING', 'cenarios': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                                         headless=True, args=['--enable-unsafe-swiftshader'])
            for name, mobile, viewport in [('desktop', False, {'width': 1440, 'height': 900}),
                                           ('mobile', True, {'width': 390, 'height': 844})]:
                context = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
                page = context.new_page()
                errors, failed = [], []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.on('response', lambda r: failed.append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
                case = {'name': name, 'estados': {}, 'errors': errors, 'httpFailures': failed}
                result['cenarios'].append(case)
                page.goto(base + '/maquete-liv-ipanema.html', wait_until='load', timeout=120000)
                page.wait_for_function('window.__maq && window.__liv && window.__livLightmap?.ready', timeout=120000)
                initial = page.evaluate(STATE)
                completa(initial)
                assert initial['cameras'] == 5 and initial['lightReady'], initial
                assert initial['mapLabel'] == initial['mapAccessibleLabel'] == 'O que tem por perto?', initial
                assert initial['mapHref'] == 'mapa-liv-ipanema-5km.html', initial
                case['estados']['inicial'] = initial
                page.locator('#cena').scroll_into_view_if_needed()
                page.screenshot(path=str(args.saida / (name + '-maquete.png')), full_page=True)

                def modo(target):
                    page.locator('#modos button[data-modo="' + target + '"]').click()
                    page.wait_for_function('m=>__maq.modo()===m', arg=target)
                    page.wait_for_timeout(300)

                def retorno(label):
                    modo('maquete')
                    state = page.evaluate(STATE)
                    completa(state)
                    case['estados'][label] = state

                modo('planta2d')
                assert page.locator('#p2d').is_visible()
                plant2d = page.evaluate(STATE)
                assert plant2d['officialImage'] and not plant2d['exteriorVisible'] and plant2d['pressed'] == ['planta2d'], plant2d
                case['estados']['planta2d'] = plant2d
                page.locator('#cena').scroll_into_view_if_needed()
                page.screenshot(path=str(args.saida / (name + '-planta2d.png')), full_page=True)
                retorno('voltaDaPlanta2d')

                modo('planta3d')
                plant3d = page.evaluate(STATE)
                assert plant3d['plantVisible'] and plant3d['plantMeshes'] > 0 and not plant3d['exteriorVisible'], plant3d
                assert page.locator('#fGirar').is_visible() and page.locator('#fMover').is_visible()
                drag(page, mobile)
                after = page.evaluate(STATE)
                assert abs(after['orbit']['theta'] - plant3d['orbit']['theta']) > .01, after
                page.locator('#fMover').click()
                assert page.locator('#fMover').get_attribute('aria-pressed') == 'true'
                page.locator('#fGirar').click()
                assert page.locator('#fGirar').get_attribute('aria-pressed') == 'true'
                case['estados']['planta3d'] = after
                page.screenshot(path=str(args.saida / (name + '-planta3d.png')), full_page=True)
                retorno('voltaDaPlanta3d')

                modo('visita')
                tour = page.evaluate(STATE)
                assert tour['plantVisible'] and tour['plantMeshes'] > 0 and not tour['exteriorVisible'], tour
                assert page.evaluate('__maq.livre(__maq.FP.x,__maq.FP.z)')
                if mobile:
                    assert page.locator('#joy').is_visible()
                drag(page, mobile)
                after = page.evaluate(STATE)
                assert abs(after['fp']['yaw'] - tour['fp']['yaw']) > .01, after
                case['estados']['tour3d'] = after
                page.screenshot(path=str(args.saida / (name + '-tour3d.png')), full_page=True)
                retorno('voltaDoTour3d')

                # Toda câmera externa mantém torre e implantação visíveis.
                for view in ('perspectiva', 'fachada', 'aerea', 'portaria', 'implantacao'):
                    page.locator('#livCameras button[data-vista="' + view + '"]').click()
                    page.wait_for_timeout(200)
                    state = page.evaluate(STATE)
                    completa(state)
                    case['estados']['camera-' + view] = state
                page.evaluate('__liv.setConjunto(false,true)')
                completa(page.evaluate(STATE))
                page.locator('#livCameras button[data-vista="perspectiva"]').click()
                page.screenshot(path=str(args.saida / (name + '-retorno-completo.png')), full_page=True)

                # Nome acessível e navegação real para a entrada do mapa.
                page.get_by_role('link', name='O que tem por perto?', exact=True).click()
                page.wait_for_url('**/mapa-liv-ipanema-5km.html*', timeout=120000)
                page.wait_for_function('window.__livMapa && window.__int?.scene', timeout=120000)
                case['mapaURL'] = page.url
                assert not errors and not failed, {'errors': errors, 'httpFailures': failed}
                context.close()
            browser.close()
        result['status'] = 'PASS'
    except Exception as exc:
        result['status'] = 'FAIL'
        result['failure'] = str(exc)
        raise
    finally:
        (args.saida / 'runtime.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'status': result['status'], 'saida': str(args.saida)}))


if __name__ == '__main__':
    main()
