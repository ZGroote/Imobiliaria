"""Abre o Tour do Meio num Chromium do Playwright, põe a câmera em cada ponto e grava estado + print.
python sonda_tour.py <url-do-interior.html> <pasta-saida>"""
import json, sys, os
from playwright.sync_api import sync_playwright

URL, SAIDA = sys.argv[1], sys.argv[2]; os.makedirs(SAIDA, exist_ok=True)
PONTOS = [("sala", -1.475, -0.75, 0), ("corr-oeste", -0.4, -0.7, 270), ("corr-0.1", 0.1, -0.7, 270),
          ("corr-0.425", 0.425, -0.9, 270), ("corr-1.375", 1.375, -0.6, 90), ("suite", 2.425, -0.6, 180),
          ("quarto", 0.225, 0.35, 90), ("banho-suite", 1.375, 0.35, 90), ("banho-social", 1.075, -1.85, 270),
          ("varanda", -2.275, 1.95, 270)]
IR = """([x, y, g]) => { const s = window.__livInterior, st = s.getState();
  return s.restoreState({...st, furniture: [], camera: {position: [x, 1.62, -y], yaw: g * Math.PI / 180 - Math.PI / 2, pitch: 0}}); }"""
with sync_playwright() as p:
    nav = p.chromium.launch(headless=True, args=["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"])
    pg = nav.new_page(viewport={"width": 1280, "height": 720})
    erros = []; pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
    pg.goto(URL); pg.wait_for_function("window.__livInterior?.ready", timeout=120000)
    pg.wait_for_function("window.__livInterior.splat?.getState?.().viewer?.ready", timeout=180000)
    res = {"backend": pg.evaluate("window.__livInterior.backend")}
    for nome, x, y, g in PONTOS:
        pg.evaluate(IR, [x, y, g]); pg.wait_for_timeout(2500)
        # o primeiro quadro de um modelo novo espera a ordenação: dá mais tempo se ainda não apresentou
        pg.wait_for_function("(() => { const s = window.__livInterior.splat.getState(); return !s.ligado || s.viewer?.presented; })()", timeout=60000)
        pg.wait_for_timeout(1500)
        st = pg.evaluate("(() => { const s = window.__livInterior.splat.getState(); return {comodo: s.comodo, ligado: s.ligado, modelo: s.viewer?.presented}; })()")
        res[nome] = st; pg.screenshot(path=os.path.join(SAIDA, f"{nome}.jpg"), type="jpeg", quality=70)
        print(nome, st, flush=True)
    res["erros"] = erros
    json.dump(res, open(os.path.join(SAIDA, "estado.json"), "w"), ensure_ascii=False, indent=1)
    nav.close()
print("erros:", erros)
