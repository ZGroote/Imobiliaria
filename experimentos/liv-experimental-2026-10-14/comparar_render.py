"""Compara capturas RGBA originais, no mesmo canvas, sem editar as imagens."""
import base64
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
ROOT_URL = 'http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/'
VIEWS = ['perspectiva', 'fachada', 'aerea', 'portaria', 'implantacao']


def save_png(url, path):
    assert url.startswith('data:image/png;base64,')
    path.write_bytes(base64.b64decode(url.split(',', 1)[1]))


def difference(reference, candidate):
    a, b = np.asarray(Image.open(reference).convert('RGBA')), np.asarray(Image.open(candidate).convert('RGBA'))
    if a.shape != b.shape:
        raise ValueError('Dimensões diferentes: ' + str((a.shape, b.shape)))
    delta = np.abs(a.astype(np.float32) - b.astype(np.float32))
    foreground = (a[:, :, 3] > 200) | (b[:, :, 3] > 200)
    opaque_shared = (a[:, :, 3] > 250) & (b[:, :, 3] > 250)
    return {'size': list(a.shape[:2][::-1]), 'foregroundPixels': int(foreground.sum()),
            'foregroundRgbMAE255': float(delta[:, :, :3][foreground].mean()),
            'sharedOpaqueRgbMAE255': float(delta[:, :, :3][opaque_shared].mean()),
            'alphaMAE255': float(delta[:, :, 3].mean()),
            'foregroundRgbP95Delta255': float(np.percentile(delta[:, :, :3][foreground], 95))}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias'/'comparacao-render')
    output = parser.parse_args().saida
    output.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING',
              'method': 'Capturas PNG RGBA sem CSS, mesmo tamanho de canvas e vistas; sem redimensionar imagens.',
              'limits': 'Métrica descritiva, não nota automática de fidelidade. PBR/sombras/specular mudaram de r168 para r186.',
              'sourceSHA256': {name:hashlib.sha256((EXP/name).read_bytes()).hexdigest()
                              for name in ['renderer.js','material-rgbm.js']},
              'comparisons': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
            page = context.new_page()
            page.goto(ROOT_URL + 'site-baseline/maquete-liv-ipanema.html', wait_until='load', timeout=120000)
            page.wait_for_function('window.__maq && window.__livLightmap?.ready', timeout=120000)
            dimensions = page.locator('#c').evaluate('(c)=>({width:c.width,height:c.height})')
            report['canvas'] = dimensions
            for view in VIEWS:
                page.locator('[data-vista="' + view + '"]').click()
                page.wait_for_timeout(300)
                url = page.evaluate("()=>{const m=__maq;m.ren.render(m.cena,m.cam);return m.ren.domElement.toDataURL('image/png');}")
                save_png(url, output / ('base-' + view + '.png'))
            context.close()
            for backend in ['webgl', 'webgpu']:
                context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
                page = context.new_page()
                page.goto(ROOT_URL + 'prova-rgbm.html?backend=' + backend, wait_until='load', timeout=120000)
                page.wait_for_function('window.__livProva?.ready || window.__livProva?.error', timeout=120000)
                assert page.evaluate('window.__livProva.ready'), page.evaluate('window.__livProva.error')
                page.evaluate("d=>{const s=document.getElementById('stage');s.style.width=d.width+'px';s.style.height=d.height+'px';s.style.minHeight='0';}", dimensions)
                page.wait_for_timeout(300)
                for view in VIEWS:
                    page.evaluate('v=>window.__livProva.setView(v)', view)
                    page.wait_for_timeout(300)
                    save_png(page.evaluate('window.__livProva.capture(false)'), output / (backend + '-' + view + '.png'))
                    report['comparisons'].append({'backend': backend, 'view': view,
                        **difference(output / ('base-' + view + '.png'), output / (backend + '-' + view + '.png'))})
                context.close()
            browser.close()
        report['status'] = 'PASS'
    except Exception as exc:
        report['status'] = 'FAIL'
        report['failure'] = str(exc)
        raise
    finally:
        (output / 'comparacao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'comparisons': len(report['comparisons']), 'output': str(output)}))


if __name__ == '__main__':
    main()
