# -*- coding: utf-8 -*-
"""Quanto CUSTA o minimapa, em milissegundos por desenho.

O minimapa e um canvas 2D de 170 px redesenhado dentro do laco de quadro. Isso pode ser
irrelevante ou pode ser o maior item de CPU do laco -- e a diferenca entre os dois nao
se ve olhando o codigo. Este medidor cronometra os dois desenhos (o de RUA, la fora, e
o da PLANTA, dentro da casa) chamando cada um N vezes fora do rAF, pela porta do QA.

O CRONOMETRO NAO PODE SER O DA PAGINA. Com `--virtual-time-budget` o Chrome virtualiza
`performance.now()`, e o relogio virtual fica PARADO enquanto o JS roda: a primeira
versao deste arquivo mediu 0,00 ms para tudo, inclusive para 120 desenhos de uma cidade
de 22 mil vias. Quem marca o tempo aqui e um servidor HTTP local: a sonda pede uma
imagem antes e outra depois do laco, e o relogio de parede do SERVIDOR e a medida.
A ida e volta em 127.0.0.1 entra na conta e e descontada (ver `base_ms`).

    python pipeline/mede_minimapa.py                  # todas as cidades
    python pipeline/mede_minimapa.py ribeirao-preto
    python pipeline/mede_minimapa.py --n 200          # mais repeticoes

O numero sai do rasterizador de software do headless, que e MAIS LENTO que a maquina de
quem usa a pagina: vale como ordem de grandeza e como comparacao antes/depois, nao como
promessa de milissegundo em maquina nenhuma.

Os TETOS abaixo nao sao meta de desempenho: sao alarme de cache desligado. Medido em
Ribeirao (22 mil vias, 1.197 POIs), antes e depois do Path2D em coordenada de mundo:

    rua        0,57 ms -> 0,02 ms     teto 0,30
    rua+POI    0,78 ms -> 0,16 ms     teto 0,45
    planta     0,02 ms -> 0,02 ms     teto 0,30   (nunca foi o problema)

Quem reprovar aqui provavelmente desfez o cache da via ou voltou a um `fill()` por
ponto de POI -- e nao "deixou a pagina 3% mais lenta".
"""
import base64, io, json, os, shutil, subprocess, sys, tempfile, threading, time

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.build.config import resolve
VERSAO = resolve().versao   # sem flag propria: MAPA_V ou o padrao; o v15 reprova aqui
from padrao.cidade import lista

PASTA = os.path.join(RAIZ, VERSAO)
PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def servidor_de_marcas():
    """HTTP local que carimba a hora de parede de cada `/marca?t=<tag>`."""
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    marcas = []

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            tag = ""
            if "?" in self.path:
                for par in self.path.split("?", 1)[1].split("&"):
                    if par.startswith("t="):
                        tag = par[2:]
            marcas.append((tag, time.perf_counter()))
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(PIXEL)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(PIXEL)

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1], marcas


SONDA = """
<script>
(function () {
  var R = {}, N = %(n)d, PORTA = %(porta)d, seq = 0;
  function fim(e) { if (e) R.erro = e; console.log("MM " + JSON.stringify(R)); }
  // O carimbo e do SERVIDOR: o relogio da pagina esta virtualizado e nao anda enquanto
  // o laco roda. Cada marca e uma imagem: `onload` garante que a resposta ja voltou.
  function marca(tag) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = im.onerror = ok;
      im.src = "http://127.0.0.1:" + PORTA + "/marca?t=" + tag + "&n=" + (++seq);
    });
  }
  // TRES rodadas por medida, e quem fica e a MENOR. A primeira rodada paga a
  // compilacao do JIT, e qualquer uma pode pegar uma coleta de lixo no meio: medindo
  // uma vez so, a mesma funcao deu 5 ms e 12 ms em execucoes seguidas. O minimo e o
  // estimador honesto de "quanto isto custa quando nada atrapalha", e e o que serve
  // pra comparar antes e depois.
  var RODADAS = 3;
  async function cron(tag, f) {
    for (var r = 0; r < RODADAS; r++) {
      await marca(tag + "_" + r + "_ini");
      for (var i = 0; i < N; i++) f(i);
      await marca(tag + "_" + r + "_fim");
    }
  }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length ||
        !window.__int.desenhaPlantaMini) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var I = window.__int, P = window.__perf;
    for (var k = 0; k < 60 && P.bombeia(4000); k++) P.passo();
    P.passo(); P.passo();
    (async function () {
      // Custo da propria medicao: duas marcas sem nada no meio.
      await cron("base", function () {});
      R.vias = I.MM.vias ? I.MM.vias.length : 0;

      // ---- o minimapa de RUA --------------------------------------------
      // A camera anda 1 m por chamada: e o caso do laco real (quem arrasta o mapa
      // invalida a guarda todo quadro) e derruba cache que dependa de camera parada.
      var tx = I.target.x, tz = I.target.z;
      await cron("rua", function (i) {
        I.target.x = tx + (i %% 2 ? 1 : -1); I.target.z = tz + i * 0.01;
        I.desenhaMinimapa();
      });
      I.target.x = tx; I.target.z = tz;

      // ---- o mesmo, com os estabelecimentos acesos ----------------------
      // O laco de POI so roda com o pino ligado, e no v13 o padrao e apagado: dizer
      // "o minimapa custa X" sem separar os dois esconderia qual dos dois custa.
      I.setPins(true);
      var cats = document.querySelectorAll("#nList .ncat");
      for (var q = 0; q < cats.length; q++)
        if (cats[q].getAttribute("aria-pressed") !== "true") cats[q].click();
      R.pois = document.querySelectorAll(".poi").length;
      await cron("ruapoi", function (i) {
        I.target.x = tx + (i %% 2 ? 1 : -1); I.target.z = tz + i * 0.01;
        I.desenhaMinimapa();
      });
      I.target.x = tx; I.target.z = tz;
      I.setPins(false);

      // ---- a PLANTA, dentro da casa -------------------------------------
      var it = document.querySelector("#houses .hitem[data-unidade]");
      if (!it) { R.nota = "cidade sem unidade cadastrada"; return fim(); }
      it.click();
      document.getElementById("uEnter").click();
      P.passo(); P.passo();
      if (!I.INT.on || !I.INT.pl) return fim("nao entrou no imovel");
      R.comodos = I.INT.pl.comodos.length;
      R.paredes = I.INT.pl.paredes.length;
      R.esquadrias = I.INT.pl.esquadrias.length;
      var px = I.FP.pos.x;
      await cron("planta", function (i) {
        // 1 cm por chamada: dentro da casa e o que o passo de quem caminha faz.
        I.FP.pos.x = px + i * 0.01; I.FP.yaw += 0.001;
        I.desenhaPlantaMini();
      });
      I.FP.pos.x = px;

      // ---- de onde vem o custo -------------------------------------------
      // Dois suspeitos GENERICOS, medidos a parte porque a resposta vale pra qualquer
      // desenho de canvas deste projeto: ler estilo computado (que obriga o navegador a
      // resolver estilo na hora) e limpar/pintar o fundo do quadrado.
      var g2 = document.getElementById("mmc").getContext("2d"), S2 = 170;
      await cron("estilo", function () {
        g2.font = "600 10px " + getComputedStyle(document.body).fontFamily;
      });
      await cron("limpa", function () {
        g2.setTransform(1,0,0,1,0,0);
        g2.clearRect(0,0,S2,S2); g2.fillStyle = "#0E141C"; g2.fillRect(0,0,S2,S2);
      });
      fim();
    })();
  })(160);
})();
</script>
"""


def roda(html, n):
    srv, porta, marcas = servidor_de_marcas()
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA % {"n": n, "porta": porta}
    tmp = html + ".mm.html"
    png = html + ".mm.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="mm")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1200,760", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             "--screenshot=" + png, "--virtual-time-budget=90000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        srv.shutdown()
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    d = None
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "MM " in ln and "{" in ln:
            try:
                d = json.loads(ln[ln.index("{"):ln.rindex("}") + 1])
            except ValueError:
                pass
    if d is None:
        return None
    t = dict(marcas)

    def menor(nome):
        """A menor das rodadas: ver RODADAS na sonda."""
        v = []
        for r in range(8):
            a, b = "%s_%d_ini" % (nome, r), "%s_%d_fim" % (nome, r)
            if a in t and b in t:
                v.append(t[b] - t[a])
        return min(v) if v else None

    base = menor("base") or 0.0          # ida e volta em 127.0.0.1, descontada
    for nome in ("rua", "ruapoi", "planta", "estilo", "limpa"):
        s = menor(nome)
        if s is not None:
            d[nome + "_ms"] = max(0.0, s - base) * 1000.0 / n
    d["base_ms"] = base * 1000.0
    return d


def main():
    if not os.path.exists(CHROME):
        # 2 = "nao deu pra medir", diferente de 1 = "medi e reprovou". O portao de
        # comportamento le esse codigo: sem a distincao, maquina sem Chrome reprovaria
        # o build inteiro em vez de dizer que nao mediu.
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    a = sys.argv[1:]
    n = int(a[a.index("--n") + 1]) if "--n" in a else 120
    slugs = [x for x in a if x in lista()] or lista()
    TETO = {"rua_ms": 0.30, "ruapoi_ms": 0.45, "planta_ms": 0.30}
    ruim = 0
    print("  %-22s %9s %9s %9s   %s" % ("cidade", "rua", "rua+POI", "planta", "pior / quadro 60fps"))
    for slug in slugs:
        html = os.path.join(PASTA, "%s-%s-aberto.html" % (slug, VERSAO))
        if not os.path.exists(html):
            print("  %-22s sem pagina montada" % slug); continue
        d = roda(html, n)
        if not d or d.get("erro"):
            print("  %-22s %s" % (slug, (d or {}).get("erro", "sem resposta"))); continue
        pior = max(d.get("rua_poi_ms", 0) or 0, d.get("ruapoi_ms", 0) or 0,
                   d.get("planta_ms", 0) or 0)
        print("  %-22s %7.2fms %7.2fms %9s   %5.1f%%"
              % (slug, d.get("rua_ms", 0), d.get("ruapoi_ms", 0),
                 ("%.2fms" % d["planta_ms"]) if "planta_ms" in d else "--",
                 100.0 * pior / 16.7))
        if "estilo_ms" in d:
            print("      de onde vem: estilo computado %.2fms, limpar o quadrado %.2fms"
                  % (d.get("estilo_ms", 0), d.get("limpa_ms", 0)))
        print("      %d vias no indice, %d POIs%s"
              % (d.get("vias", 0), d.get("pois", 0),
                 (", planta com %d comodos / %d paredes / %d esquadrias"
                  % (d.get("comodos", 0), d.get("paredes", 0), d.get("esquadrias", 0)))
                 if "planta_ms" in d else " (" + d.get("nota", "") + ")"))
        fora = ["%s %.2fms > %.2f" % (k[:-3], d[k], t)
                for k, t in sorted(TETO.items()) if k in d and d[k] > t]
        if fora:
            print("      FORA DO TETO: %s" % "; ".join(fora))
            ruim += 1
    print("")
    print("%d cidade(s) acima do teto." % ruim if ruim else "Tudo dentro do teto.")
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
