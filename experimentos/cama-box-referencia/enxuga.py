"""Pagina base mais leve, derivada sem tocar no gerador (como o montar do Cedros PBR).

Tres cortes, cada um conferido:
  1. `__luzue` (atlas de luz do Unreal, 89 KB na rede): so e lido com ?luz=ue. Vai vazio.
  2. `__moveis` (biblioteca de moveis inteira, 98 KB na rede): fica so o que a pagina PEDE.
     Quem pede e descoberto rodando a pagina original com a biblioteca embrulhada num Proxy
     e passando por Predio, Planta 3D e Visita -- nao por lista escrita a mao. Peca que falta
     some CALADA (`geoDaLib` devolve null), entao `confere()` compara triangulo por movel.
  3. three.min.js sai do HTML pra um arquivo proprio: a 1a visita paga o mesmo; a 2a e as
     outras unidades nao baixam de novo (cache).

    python enxuga.py --usadas        # roda a pagina original e grava pecas-usadas.json
"""
import functools, json, re, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]

PROXY = r"""(() => {
  const P = JSON.parse; window.__pecasPedidas = {};
  JSON.parse = function (t, ...r) {
    const d = P.call(this, t, ...r);
    if (typeof t === 'string' && t.startsWith('{"unidade":"cm"') && d && d.pecas) {
      d.pecas = new Proxy(d.pecas, { get(o, k) {
        if (typeof k === 'string' && k in o) {
          const s = new Error().stack || '';
          // o laco de init (`for k in pecas`) le toda peca com nome de catalogo: nao conta
          if (!/MOVEIS_LIB/.test(s.split('\n').slice(2, 4).join(' ')) || /geoDaLib|Param|instancia/.test(s))
            window.__pecasPedidas[k] = (window.__pecasPedidas[k] || 0) + 1;
        }
        return o[k]; } });
    }
    return d;
  };
})();"""
CONTA = """() => { const h = __maq.planta(); if (!h) return null; const out = {};
  for (const o of h.children) { const it = o.userData && o.userData.registroMovel; if (!o.userData || !o.userData.movel || !it) continue;
    let t = 0; o.traverse(m => { if (m.isMesh && m.visible !== false && m.geometry) { const g = m.geometry;
      t += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    const k = it.tipo + '@' + [o.position.x, o.position.z].map(v => v.toFixed(2)).join(','); out[k] = Math.round(t); }
  return out; }"""


def servidor():
    class H(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    s = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=str(RAIZ)))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def percorre(rel, init=None, q=''):
    """Abre a pagina, passa por Planta 3D e Visita; devolve pedidas e triangulos por movel."""
    from playwright.sync_api import sync_playwright
    srv = servidor()
    try:
        with sync_playwright() as pw:
            nav = pw.chromium.launch(channel='chrome', headless=True)
            pg = nav.new_page(viewport={'width': 1280, 'height': 720})
            erros = []
            pg.on('pageerror', lambda e: erros.append(str(e)[:200]))
            pg.on('console', lambda m: m.type == 'error' and erros.append(m.text[:200]))
            if init:
                pg.add_init_script(init)
            pg.goto(f'http://127.0.0.1:{srv.server_port}/{rel}{q}')
            pg.wait_for_function('window.__maq && __maq.ren.info.render.frame > 2', timeout=120000)
            for modo in ('planta3d', 'visita'):
                pg.evaluate(f"document.querySelector('#modos button[data-modo={modo}]').click()")
                time.sleep(4)
            tri = pg.evaluate(CONTA)
            ped = pg.evaluate('() => window.__pecasPedidas || null')
            nav.close()
            return {'pedidas': ped, 'tri': tri, 'erros': erros}
    finally:
        srv.shutdown()


def deriva(html, usadas):
    """HTML enxuto + texto do three.min.js externo."""
    s = html
    a = s.find('<script id="__luzue" type="application/json">')
    b = s.find('</script>', a)
    if a < 0 or b < 0:
        raise SystemExit('sem __luzue: template mudou')
    s = s[:a] + '<script id="__luzue" type="application/json">{}' + s[b:]
    a = s.find('<script id="__moveis" type="application/json">')
    i, b = s.find('>', a) + 1, s.find('</script>', a)
    d = json.loads(s[i:b])
    falta = set(usadas) - set(d['pecas'])
    if falta:
        raise SystemExit(f'pecas usadas que nao existem: {falta}')
    d['pecas'] = {k: v for k, v in d['pecas'].items() if k in usadas}
    s = s[:i] + json.dumps(d, separators=(',', ':')).replace('<', '\\u003c') + s[b:]
    m = re.search(r'<script>(var THREE=\(\(\)=>\{.*?)</script>', s, re.S)
    if not m:
        raise SystemExit('three.min.js embutido nao encontrado')
    three = m.group(1)
    s = s[:m.start()] + '<script src="three.min.js"></script>' + s[m.end():]
    # preload no <head>: sem isso o three separado vira uma ida e volta A MAIS depois do HTML
    # (medido: celular lento 5,7 -> 5,9 s). Com ele, o three baixa junto com o HTML.
    h = s.find('<head>')
    if h < 0:
        raise SystemExit('sem <head>')
    s = s[:h + 6] + '<link rel="preload" href="three.min.js" as="script">' + s[h + 6:]
    return s, three


if __name__ == '__main__' and '--usadas' in sys.argv:
    r = percorre('v1.5/miniaturas/publicado/maquete-monte-dos-cedros-37.html', PROXY)
    print(json.dumps({'pedidas': r['pedidas'], 'moveis': len(r['tri'] or {}), 'erros': r['erros']}, indent=1))
    (AQUI / 'pecas-usadas.json').write_text(json.dumps(r, indent=1), encoding='utf-8')
