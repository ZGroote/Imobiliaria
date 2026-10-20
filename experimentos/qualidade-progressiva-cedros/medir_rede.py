"""Mede a abertura do Cedros LEVE x PREMIUM com rede emulada, no Chrome headless com a GPU real.

    python experimentos/qualidade-progressiva-cedros/medir_rede.py [--rodadas 3] [--perfis a,b] [--foto]

Serve localmente os MESMOS bytes que o Hosting entrega: o PREMIUM e baixado do ar ja em brotli e
conferido contra a fonte local por SHA-256; o LEVE (que nao esta no ar) e comprimido aqui no nivel
de brotli que reproduz o tamanho do PREMIUM no ar. A rede e emulada por CDP
(Network.emulateNetworkConditions), a CPU por Emulation.setCPUThrottlingRate; a GPU nao e
emulada -- e sempre a desta maquina. Escreve medicao-rede.json ao lado deste arquivo.
"""
import argparse, hashlib, json, statistics, sys, tempfile, threading, time, urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

import brotli
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
MIN = AQUI.parents[1] / 'v1.5' / 'miniaturas'
AR = 'https://imobilaria-deccb-miniaturas.web.app/'
REV = 'assets/cedros/62549ac12936f290/'
PAGINA = 'maquete-monte-dos-cedros-37.html'
# Cedros PBR (experimentos/cedros-pbr-2026-10-04): LEVE + acabamentos do guia, servido como o Hosting serviria.
# --site nome=pasta acrescenta outras variantes servidas do disco do mesmo jeito.
SITES = {'pbr': AQUI.parents[1] / 'publicacao' / 'piloto-qualidade-visual-2026-10-04' / 'cedros-v4' / 'site'}
# latencia somada a cada requisicao (ms), descida e subida (bytes/s), fator de lentidao da CPU
PERFIS = {
    'referencia': (0, None, None, 1),
    '4g-bom': (70, 20e6 / 8, 5e6 / 8, 1),
    '4g-fraco': (150, 5e6 / 8, 1.5e6 / 8, 1),
    'celular-lighthouse': (562.5, 1474.56 * 1024 / 8, 675 * 1024 / 8, 4),  # o "Slow 4G" + CPU 4x do Lighthouse
}
TIPO = {'.html': 'text/html; charset=utf-8', '.json': 'application/json', '.gz': 'application/gzip',
        '.js': 'text/javascript', '.webp': 'image/webp'}

# Injetado antes de qualquer script da pagina. Conta draw call na tela (framebuffer nulo -- o PMREM e
# a sombra desenham fora dela), estima a memoria de textura/buffer viva pelo formato declarado, cronometra
# as chamadas de upload de textura e anota as transicoes de BK (bake por vertice), __exteriorV3 e __bakeV3.
INSTR = r"""(() => {
  if (window.__m) return;
  const M = window.__m = {t: {}, ev: [], estado: {}, raf: [], quadros: [], longas: [], drawsTela: 0,
    tex: 0, texPico: 0, buf: 0, bufPico: 0, texMs: 0, texGrandes: [], heapPico: 0};
  const agora = () => performance.now();
  M.marca = k => { if (M.t[k] === undefined) M.t[k] = agora(); };
  const BPP = {0x8058:4, 0x8C43:4, 0x8051:4, 0x8C41:4, 0x881A:8, 0x8814:16, 0x881B:8, 0x8815:16, 0x88F0:4,
    0x81A6:4, 0x8CAC:4, 0x81A5:2, 0x8229:1, 0x822B:2, 0x822D:2, 0x822E:4, 0x8C3A:4, 0x8D62:2, 0x8056:2, 0x8057:2};
  const CANAIS = {0x1908:4, 0x1907:4, 0x190A:2, 0x1909:1, 0x1906:1, 0x1903:1, 0x8227:2, 0x1902:4, 0x84F9:4};
  const TAM = t => (t === 0x1406 || t === 0x1405) ? 4 : (t === 0x140B || t === 0x8D61 || t === 0x1403) ? 2 : 1;
  const bpp = (fi, f, ty) => BPP[fi] || (CANAIS[fi] || CANAIS[f] || 4) * TAM(ty);
  const alvo = t => (t >= 0x8515 && t <= 0x851A) ? 0x8513 : t;
  const S = gl => gl.__s || (gl.__s = {unit: 0x84C0, tex: {}, buf: {}, fb: null});
  const texDe = (gl, tg) => S(gl).tex[S(gl).unit + ':' + alvo(tg)];
  const poe = (gl, tg, chave, bytes, info) => {
    const T = texDe(gl, tg); if (!T) return;
    const lv = T.__lv || (T.__lv = {}); M.tex += bytes - (lv[chave] || 0); lv[chave] = bytes;
    if (M.tex > M.texPico) M.texPico = M.tex;
    if (bytes >= 4 << 20) M.texGrandes.push({t: Math.round(agora()), ...info, mib: +(bytes / 1048576).toFixed(1)});
  };
  const embrulha = (nome, f) => {
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      const P = C && C.prototype; if (!P || !P[nome]) continue;
      const o = P[nome]; P[nome] = function (...a) { return f.call(this, o, a); };
    }
  };
  const cronometra = (gl, o, a) => { const t0 = agora(); const r = o.apply(gl, a); M.texMs += agora() - t0; return r; };
  embrulha('activeTexture', function (o, a) { S(this).unit = a[0]; return o.apply(this, a); });
  embrulha('bindTexture', function (o, a) { S(this).tex[S(this).unit + ':' + a[0]] = a[1]; return o.apply(this, a); });
  embrulha('bindBuffer', function (o, a) { S(this).buf[a[0]] = a[1]; return o.apply(this, a); });
  embrulha('bindFramebuffer', function (o, a) { if (a[0] !== 0x8CA8) S(this).fb = a[1]; return o.apply(this, a); });
  embrulha('texStorage2D', function (o, a) {
    const [tg, n, fi, w, h] = a; let px = 0;
    for (let l = 0; l < n; l++) px += Math.max(1, w >> l) * Math.max(1, h >> l);
    poe(this, tg, 's', px * bpp(fi) * (tg === 0x8513 ? 6 : 1), {w, h, niveis: n, fi: fi.toString(16), via: 'texStorage2D'});
    return o.apply(this, a);
  });
  embrulha('texImage2D', function (o, a) {
    let w, h, f, ty;
    if (a.length >= 8) { w = a[3]; h = a[4]; f = a[6]; ty = a[7]; }
    else { const s = a[5] || {}; w = s.width || s.videoWidth || 0; h = s.height || s.videoHeight || 0; f = a[3]; ty = a[4]; }
    poe(this, a[0], a[0] + ':' + a[1], w * h * bpp(a[2], f, ty), {w, h, fi: a[2].toString(16), via: 'texImage2D'});
    return cronometra(this, o, a);
  });
  embrulha('texImage3D', function (o, a) {
    const [tg, l, fi, w, h, d, , f, ty] = a;
    poe(this, tg, tg + ':' + l, w * h * d * bpp(fi, f, ty), {w, h, d, via: 'texImage3D'});
    return cronometra(this, o, a);
  });
  embrulha('texStorage3D', function (o, a) {
    const [tg, n, fi, w, h, d] = a; let px = 0;
    for (let l = 0; l < n; l++) px += Math.max(1, w >> l) * Math.max(1, h >> l) * d;
    poe(this, tg, 's', px * bpp(fi), {w, h, d, via: 'texStorage3D'}); return o.apply(this, a);
  });
  embrulha('compressedTexImage2D', function (o, a) {
    poe(this, a[0], a[0] + ':' + a[1], (a[6] && a[6].byteLength) || 0, {w: a[3], h: a[4], via: 'compressed'});
    return cronometra(this, o, a);
  });
  for (const n of ['texSubImage2D', 'texSubImage3D']) embrulha(n, function (o, a) { return cronometra(this, o, a); });
  embrulha('generateMipmap', function (o, a) {
    const T = texDe(this, a[0]);
    if (T && T.__lv && !T.__lv.s) {  // com texStorage os niveis ja foram contados
      let base = 0; for (const k in T.__lv) if (k.endsWith(':0')) base += T.__lv[k];
      poe(this, a[0], 'mip', Math.round(base / 3), {via: 'generateMipmap'});
    }
    return o.apply(this, a);
  });
  embrulha('deleteTexture', function (o, a) {
    const T = a[0]; if (T && T.__lv) { for (const k in T.__lv) M.tex -= T.__lv[k]; T.__lv = null; }
    return o.apply(this, a);
  });
  embrulha('bufferData', function (o, a) {
    const B = S(this).buf[a[0]], b = typeof a[1] === 'number' ? a[1] : (a[1] ? a[1].byteLength : 0);
    if (B) { M.buf += b - (B.__b || 0); B.__b = b; if (M.buf > M.bufPico) M.bufPico = M.buf; }
    return o.apply(this, a);
  });
  embrulha('deleteBuffer', function (o, a) { const B = a[0]; if (B && B.__b) { M.buf -= B.__b; B.__b = 0; } return o.apply(this, a); });
  for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'])
    embrulha(n, function (o, a) { if (!S(this).fb) { M.drawsTela++; M.marca('quadro1'); } return o.apply(this, a); });
  // BK fica no escopo da pagina; as duas variantes publicam LightBake em globalThis antes de cria-lo.
  let LB;
  Object.defineProperty(window, 'LightBake', {configurable: true, get: () => LB,
    set: v => { LB = Object.freeze({...v, create: (...a) => (M.BK = v.create(...a))}); }});
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) M.longas.push([Math.round(e.startTime), Math.round(e.duration)]); })
      .observe({type: 'longtask', buffered: true});
  } catch (e) {}
  let ult = 0, ultHeap = 0, ultPbr = 0;
  const tick = () => {
    const t = agora(); M.raf.push(Math.round(t));
    if (M.drawsTela !== ult) { M.quadros.push([Math.round(t), M.drawsTela - ult]); ult = M.drawsTela; }
    if (performance.memory && t - ultHeap > 100) { ultHeap = t; M.heapPico = Math.max(M.heapPico, performance.memory.usedJSHeapSize); }
    const ev = (k, v) => { if (M.estado[k] !== v) { M.estado[k] = v; M.ev.push([Math.round(t), k, v]); } };
    const fase = o => o.ready ? 'pronto' : o.error ? 'erro: ' + o.error : o.started ? 'baixando' : 'parado';
    if (M.BK && M.BK.BAKE) ev('bake', !!M.BK.BAKE.fila);
    if (window.__exteriorV3) ev('exLuz', fase(window.__exteriorV3));
    if (window.__bakeV3) ev('inLuz', fase(window.__bakeV3));
    if (window.__pilotoVisual && t - ultPbr > 100) {
      ultPbr = t; const s = __pilotoVisual.snapshot();
      ev('pbrMapas', s.loadedMaps); ev('pbr', s.failures.length ? 'erro' : s.installed ? 'pronto' : 'parado');
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();"""


def sha(b):
    return hashlib.sha256(b).hexdigest()


def prepara(cache, variantes):
    """Baixa do ar os bytes brotli do PREMIUM (uma vez), confere com a fonte e comprime o LEVE (e o PBR)."""
    for rel in [PAGINA] + [REV + f for f in ('exterior-uv.json', 'exterior-luz.rgbm.gz', 'interior-uv.json', 'interior-luz.rgbm.gz')]:
        dst = cache / 'premium' / (rel + '.br')
        if not dst.exists():
            r = urllib.request.urlopen(urllib.request.Request(AR + rel, headers={'Accept-Encoding': 'br'}))
            if r.headers.get('Content-Encoding') != 'br':
                sys.exit(f'{rel}: o Hosting nao devolveu brotli')
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(r.read())
        if sha(brotli.decompress(dst.read_bytes())) != sha((MIN / 'publicado-atual' / rel).read_bytes()):
            sys.exit(f'{rel}: o que esta no ar nao e a fonte local; a medicao seria de outra coisa')
    no_ar = (cache / 'premium' / (PAGINA + '.br')).stat().st_size
    html_p = (MIN / 'publicado-atual' / PAGINA).read_bytes()
    q = min(range(4, 12), key=lambda q: abs(len(brotli.compress(html_p, quality=q)) - no_ar))
    leve = cache / 'leve' / (PAGINA + '.br')
    leve.parent.mkdir(parents=True, exist_ok=True)
    leve.write_bytes(brotli.compress((MIN / 'publicado' / PAGINA).read_bytes(), quality=q))
    for v in variantes:  # o Hosting comprime tudo, inclusive WebP; sempre refeito, o site muda a cada montagem
        if v not in SITES:
            continue
        for f in SITES[v].rglob('*'):
            if f.is_file() and f.suffix in ('.html', '.js', '.webp'):
                dst = cache / v / (f.relative_to(SITES[v]).as_posix() + '.br')
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(brotli.compress(f.read_bytes(), quality=q))
    return q


def servidor(cache, faltou):
    class H(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def do_GET(self):
            f = cache / (self.path.split('?')[0].lstrip('/') + '.br')
            if not f.is_file():
                faltou.append(self.path)
                self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers()
                return
            b = f.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', TIPO.get(f.suffixes[-2] if len(f.suffixes) > 1 else '', 'application/octet-stream'))
            self.send_header('Content-Encoding', 'br')
            self.send_header('Content-Length', str(len(b)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(b)

        def log_message(self, *a):
            pass

    s = ThreadingHTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


BANCO = """() => { const r = __maq.ren, gl = r.getContext(), px = new Uint8Array(4), ts = [];
  const um = () => { r.render(__maq.cena, __maq.cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (let i = 0; i < 5; i++) um();
  for (let i = 0; i < 60; i++) { const t0 = performance.now(); um(); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  return {p50: +ts[30].toFixed(2), p95: +ts[57].toFixed(2), draws: r.info.render.calls, tri: r.info.render.triangles,
          texturas: r.info.memory.textures, geometrias: r.info.memory.geometries}; }"""


def roda(pw, url, perfil, foto=None):
    lat, desce, sobe, cpu = PERFIS[perfil]
    nav = pw.chromium.launch(channel='chrome', headless=True, args=['--enable-precise-memory-info'])
    try:
        ctx = nav.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
        pg = ctx.new_page()
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)[:300]))
        pg.on('console', lambda m: m.type == 'error' and erros.append(m.text[:300]))
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Network.enable')
        cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
        if desce:
            cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': lat, 'downloadThroughput': desce, 'uploadThroughput': sobe})
        if cpu > 1:
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        pg.add_init_script(INSTR)
        pg.goto(url, wait_until='commit', timeout=0)

        def espera(cond, limite=300):
            t0 = time.time()
            while time.time() - t0 < limite:
                s = pg.evaluate('() => window.__m ? {t: __m.t, e: __m.estado, agora: performance.now()} : null')
                if s and cond(s['t'], s['e'], s['agora']):
                    return
                time.sleep(0.1)
            raise TimeoutError(f'{url} {perfil}: {s}')

        # Exterior pronto: primeiro quadro na tela, atlas do PREMIUM aplicado (ou falho) e o bake por vertice parado.
        espera(lambda t, e, a: 'quadro1' in t)
        foto and pg.screenshot(path=foto + '-1-primeiro-quadro.png')
        espera(lambda t, e, a: e.get('exLuz') not in ('parado', 'baixando') and not e.get('bake') and a - t['quadro1'] > 1500)
        foto and pg.screenshot(path=foto + '-2-exterior.png')
        time.sleep(1)
        banco_ext = pg.evaluate(BANCO)
        pg.evaluate("() => { __m.marca('clique'); document.querySelector('#modos button[data-modo=visita]').click(); }")
        espera(lambda t, e, a: e.get('inLuz') not in ('parado', 'baixando') and e.get('pbr') != 'parado'
               and not e.get('bake') and a - t['clique'] > 1500)
        foto and pg.screenshot(path=foto + '-3-interior.png')
        time.sleep(1.5)
        banco_int = pg.evaluate(BANCO)
        d = json.loads(pg.evaluate("""() => { const n = performance.getEntriesByType('navigation')[0];
          return JSON.stringify({m: __m, nav: {resp: n.responseEnd, dcl: n.domContentLoadedEventEnd, rede: n.transferSize},
            res: performance.getEntriesByType('resource').map(e => ({u: e.name.split('/').pop(), ini: e.startTime, fim: e.responseEnd, rede: e.transferSize}))}); }"""))
        d['erros'] = erros
        d['banco'] = {'exterior': banco_ext, 'interior': banco_int}
        return d
    finally:
        nav.close()


def resume(d):
    m, nav, res = d['m'], d['nav'], d['res']
    t, ev, cl = m['t'], m['ev'], m['t']['clique']

    def quando(k, v, depois=0.0):
        return next((x[0] for x in ev if x[1] == k and x[2] == v and x[0] >= depois), None)

    ext = quando('exLuz', 'pronto')
    ini = quando('bake', True)
    ini = ini if ini is not None and ini < cl else None  # nas duas, o bake por vertice so arma ao entrar na visita
    bake = quando('bake', False, ini) if ini is not None else None
    ini2 = quando('bake', True, cl)
    bake2 = quando('bake', False, ini2) if ini2 is not None else None
    luz_in = quando('inLuz', 'pronto', cl)
    pbr_in = quando('pbr', 'pronto')  # pode instalar antes do clique so se a planta ja existir
    mapas = quando('pbrMapas', 15)
    quadro_in = next((q[0] for q in m['quadros'] if q[0] > cl), None)
    pronto_in = luz_in or max((x for x in (bake2, pbr_in) if x is not None), default=None) or quadro_in
    fim_ext = max(x for x in (ext, bake, t['quadro1']) if x is not None)
    gaps = [(b, b - a) for a, b in zip(m['raf'], m['raf'][1:])]
    fim = (pronto_in or cl) + 500

    def pior(a, b):
        return max((g for f, g in gaps if a < f <= b), default=None)

    def bloqueio(a, b):
        return sum(max(0, dur - 50) for st, dur in m['longas'] if a <= st < b)

    s = lambda x: None if x is None else round(x / 1000, 2)
    mb = lambda x: round(x / 1e6, 2)
    return {
        'html_s': s(nav['resp']),
        'primeiro_quadro_s': s(t['quadro1']),
        'draws_primeiro_quadro': m['quadros'][0][1],
        'draws_estavel': statistics.median(q[1] for q in m['quadros'][-30:]),
        'luz_exterior_s': s(ext),
        'bake_vertice_s': s(bake),
        'exterior_pronto_s': s(fim_ext),
        'rede_abrir_mb': mb(nav['rede'] + sum(r['rede'] for r in res if r['ini'] < cl)),
        'interior_1o_quadro_s': s(quadro_in - cl) if quadro_in else None,
        'interior_pronto_s': s(pronto_in - cl) if pronto_in else None,
        'rede_interior_mb': mb(sum(r['rede'] for r in res if r['ini'] >= cl)),
        'textura_pico_mib': round(m['texPico'] / 2**20, 1),
        'buffer_pico_mib': round(m['bufPico'] / 2**20, 1),
        'heap_pico_mib': round(m['heapPico'] / 2**20, 1),
        'upload_textura_ms': round(m['texMs']),
        'pior_travada_exterior_ms': pior(t['quadro1'], cl),
        'pior_travada_interior_ms': pior(cl, fim),
        'bloqueio_exterior_ms': bloqueio(t['quadro1'], cl),
        'bloqueio_interior_ms': bloqueio(cl, fim),
        'mapas_pbr_s': s(mapas),
        'acabamento_pbr_s': s(pbr_in - cl) if pbr_in else None,
        'quadro_ext_p50_ms': d['banco']['exterior']['p50'], 'quadro_ext_p95_ms': d['banco']['exterior']['p95'],
        'quadro_int_p50_ms': d['banco']['interior']['p50'], 'quadro_int_p95_ms': d['banco']['interior']['p95'],
        'draws_interior': d['banco']['interior']['draws'], 'tri_interior': d['banco']['interior']['tri'],
        'texturas_interior': d['banco']['interior']['texturas'],
        'erros': len(d['erros']),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rodadas', type=int, default=3)
    ap.add_argument('--perfis', default=','.join(PERFIS))
    ap.add_argument('--foto', action='store_true', help='uma rodada extra por variante, sem rede limitada, so pra print')
    ap.add_argument('--cache', default=str(Path(tempfile.gettempdir()) / 'cedros-rede'))
    ap.add_argument('--variantes', default='leve,premium')
    ap.add_argument('--saida', default=str(AQUI / 'medicao-rede.json'))
    ap.add_argument('--site', action='append', default=[], help='nome=pasta do site, relativa a raiz do repositorio')
    a = ap.parse_args()
    SITES.update((n, AQUI.parents[1] / d) for n, d in (x.split('=', 1) for x in a.site))
    cache = Path(a.cache)
    variantes = a.variantes.split(',')
    q = prepara(cache, variantes)
    faltou = []
    srv = servidor(cache, faltou)
    base = f'http://127.0.0.1:{srv.server_port}/'
    perfis = a.perfis.split(',')
    cru, linhas = [], {}
    with sync_playwright() as pw:
        if a.foto:
            for v in variantes:
                roda(pw, base + f'{v}/{PAGINA}', 'referencia', foto=str(Path(a.saida).parent / f'foto-{v}'))
        for r in range(a.rodadas):  # intercalado: deriva de clock/termica cai igual nas duas variantes
            for p in perfis:
                for v in variantes:
                    d = roda(pw, base + f'{v}/{PAGINA}', p)
                    x = resume(d)
                    print(f'[{r + 1}/{a.rodadas}] {p:20} {v:8} quadro1={x["primeiro_quadro_s"]}s exterior={x["exterior_pronto_s"]}s '
                          f'interior={x["interior_pronto_s"]}s erros={x["erros"]}', flush=True)
                    cru.append({'rodada': r, 'perfil': p, 'variante': v, 'resumo': x, 'erros': d['erros'],
                                'eventos': d['m']['ev'], 'texturas_grandes': d['m']['texGrandes'], 'recursos': d['res']})
                    linhas.setdefault((p, v), []).append(x)
    srv.shutdown()
    medianas = {f'{p}/{v}': {k: (statistics.median(r[k] for r in rs) if all(isinstance(r[k], (int, float)) for r in rs) else [r[k] for r in rs])
                             for k in rs[0]} for (p, v), rs in linhas.items()}
    saida = {'data': time.strftime('%Y-%m-%d %H:%M'), 'variantes': variantes, 'perfis': {p: PERFIS[p] for p in perfis}, 'brotli_leve_qualidade': q,
             'viewport': '1280x720 dpr1', '404': sorted(set(faltou)), 'medianas': medianas, 'rodadas': cru}
    Path(a.saida).write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(medianas, ensure_ascii=False, indent=1))
    if faltou:
        print('404:', sorted(set(faltou)))


if __name__ == '__main__':
    main()
