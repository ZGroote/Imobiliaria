# -*- coding: utf-8 -*-
"""Tira um print ENQUADRADO da pagina, pra ter foto de controle antes/depois.

Ate aqui cada teste headless carregava sua propria copia do mesmo ritual (Chrome
--headless=new, swiftshader, sonda que espera o streaming, `target`/`sph` pela porta
`window.__int`). Isso aqui e so esse ritual num lugar so, sem assercao nenhuma: pede uma
foto, recebe uma foto. Quem compara e o `compara_print.py`.

    python pipeline/foto.py --saida antes.png                       # centro, obliquo
    python pipeline/foto.py --lat -22.0175 --lon -47.8908 --raio 260 --phi 1.28
    python pipeline/foto.py --pagina v11/sao-carlos-v11-aberto.html --saida antes.png

`phi` e o angulo a partir do EIXO Y: 0,3 e quase de cima (planta), 1,45 e quase no nivel
da rua. `raio` e a distancia da camera ao alvo, em metros.
"""
import base64, io, json, os, shutil, socket, subprocess, sys, tempfile, threading, time

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO

# --- por que existe um servidor HTTP aqui ------------------------------------
# `--virtual-time-budget` adianta os temporizadores: um `setTimeout(8000)` do lado da
# pagina dispara em milissegundos de relogio de parede, e o print sai antes de o
# streaming montar um quarteirao (medido: 0 quarteiroes, 1 chamada de desenho, camera
# ainda na origem). Esperar "mais" nao adianta -- o que se pede a mais e tempo VIRTUAL.
#
# Mas a politica padrao do tempo virtual e `pauseIfNetworkFetchesPending`: enquanto
# houver requisicao de rede em voo, o relogio virtual PARA. Entao a sonda pede uma
# imagem a este servidor local, que segura a resposta pelo tempo real desejado. O
# relogio virtual congela, o rAF continua rodando em tempo real, a cidade monta, a
# imagem chega, o orcamento vence e o Chrome fotografa o que a gente queria ver.
PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def servidor_de_espera():
    """Sobe um HTTP local que responde `/espera?ms=N` depois de N ms REAIS."""
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            ms = 0
            if "ms=" in self.path:
                try: ms = min(120000, int(self.path.split("ms=")[1].split("&")[0]))
                except ValueError: ms = 0
            time.sleep(ms / 1000.0)
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(PIXEL)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(PIXEL)

        def log_message(self, *a): pass

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


SONDA = """
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('FOTO {"erro":"a cidade nao subiu"}'); return;
  }
  var I = window.__int, P = %(param)s;
  if (P.relevo) { var b = document.getElementById("tRelief"); if (b) b.click(); }
  (P.clicar || []).forEach(function (id) {
    var e = document.getElementById(id); if (e) e.click();
  });
  // O alvo primeiro: o streaming so busca os quarteiroes ao redor de onde a camera
  // parou, entao mover depois de esperar nao adianta -- espera-se DEPOIS de mover.
  I.target.set(P.x, 0, P.z);
  I.sph.set(P.raio, P.phi, P.theta);
  if (P.hud === 0) {
    var o = document.getElementById("overlay"); if (o) o.style.display = "none";
  }
  // Segura o relogio virtual pelo tempo REAL que a cidade precisa (ver
  // servidor_de_espera no foto.py). O print so sai quando esta imagem chegar.
  var im = new Image();
  im.onload = im.onerror = function () {
    console.log("FOTO " + JSON.stringify({
      alvo: [Math.round(I.target.x), Math.round(I.target.z)],
      camera: [Math.round(I.camera.position.x), Math.round(I.camera.position.y),
               Math.round(I.camera.position.z)],
      quarteiroes: I.vivos().size, chamadas: I.renderer.info.render.calls,
      tris: I.renderer.info.render.triangles
    }));
  };
  im.src = "http://127.0.0.1:" + P.porta + "/espera?ms=" + P.espera;
})(140);
</script>
"""


def foto(pagina, png, par, nivel="alto", quieto=False):
    srv, porta = servidor_de_espera()
    par = dict(par, porta=porta)
    s = io.open(pagina, encoding="utf-8", newline="").read()
    s += SONDA % {"param": json.dumps(par)}
    tmp = pagina + ".foto.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="foto")
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=%d,%d" % (par["largura"], par["altura"]),
                            "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                            "--hide-scrollbars", "--screenshot=" + png,
                            "--virtual-time-budget=20000",
                            "--enable-logging=stderr", "--log-level=0",
                            "file:///" + tmp.replace("\\", "/") + "?q=" + nivel],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        srv.shutdown()
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass
    saida = (r.stderr or "") + (r.stdout or "")
    if "--debug" in sys.argv:
        for ln in saida.splitlines():
            if "CONSOLE" in ln or "FOTO" in ln: print("    | " + ln[:220])
    info = None
    for ln in saida.splitlines():
        # A linha do Chrome e `..."FOTO {...}", source: file:///...` -- o JSON vem
        # entre aspas e com cauda. Recortar do primeiro { ao ultimo } da linha.
        if "FOTO " not in ln or "{" not in ln: continue
        try: info = json.loads(ln[ln.index("{"):ln.rindex("}") + 1])
        except ValueError: pass
    if not quieto:
        print("  %s" % (json.dumps(info, ensure_ascii=False) if info else "(a sonda nao respondeu)"))
    return info


def main():
    a = sys.argv
    pega = lambda k, d: (type(d)(a[a.index(k) + 1]) if k in a else d)
    cidade = pega("--cidade", "sao-carlos")
    pagina = os.path.abspath(pega("--pagina", os.path.join(RAIZ, VERSAO,
                                  "%s-%s-aberto.html" % (cidade, VERSAO))))
    png = os.path.abspath(pega("--saida", os.path.join(tempfile.gettempdir(), "foto.png")))
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    if not os.path.exists(pagina):
        print("pagina nao encontrada: %s" % pagina); return 2

    x, z = pega("--x", 0.0), pega("--z", 0.0)
    if "--lat" in a and "--lon" in a:
        cid = json.load(io.open(os.path.join(RAIZ, "padrao", "cidades", cidade + ".json"),
                                encoding="utf-8"))
        import math
        c = cid["centro"]
        mlon = 111319.49 * math.cos(c["lat"] * math.pi / 180)
        x = (pega("--lon", 0.0) - c["lon"]) * mlon
        z = -(pega("--lat", 0.0) - c["lat"]) * 111132.92

    par = {"x": x, "z": z,
           "raio": pega("--raio", 420.0), "phi": pega("--phi", 1.18), "theta": pega("--theta", 0.55),
           "espera": pega("--espera", 9000), "relevo": 1 if "--relevo" in a else 0,
           "hud": 0 if "--sem-hud" in a else 1,
           "clicar": [c for c in pega("--clicar", "").split(",") if c],
           "largura": pega("--largura", 1280), "altura": pega("--altura", 800)}
    print("%s -> %s" % (os.path.relpath(pagina, RAIZ), os.path.relpath(png, RAIZ)
                        if png.startswith(RAIZ) else png))
    foto(pagina, png, par, nivel=pega("--q", "alto"))
    if not os.path.exists(png):
        print("o Chrome nao gerou print"); return 1
    print("  %.0f KB" % (os.path.getsize(png) / 1024.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
