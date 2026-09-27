# -*- coding: utf-8 -*-
"""O governador de resolucao ainda chega na tela?

A alavanca mais forte que existe pra maquina fraca e quantos pixels desenhar: o
governador mede a mediana do quadro e mexe no `devicePixelRatio` do renderer. Mas
`setPixelRatio()` sozinho nao redimensiona nada -- quem aplica e o `resize()` chamado
logo depois. Se o `resize()` sair cedo, o governador vira enfeite EM SILENCIO: a
mediana continua sendo medida, o numero gravado continua mudando, e a resolucao nao.

A sonda faz o que o governador faz e pergunta ao canvas se mudou:

    setPixelRatio(alvo) -> um quadro -> canvas.width bate com innerWidth * alvo?

    python pipeline/testa_governador.py                  # todas as cidades
    python pipeline/testa_governador.py ribeirao-preto

Sai 1 se a resolucao nao acompanhar.
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.build.config import resolve
VERSAO = resolve().versao   # sem flag propria: MAPA_V ou o padrao; o v15 reprova aqui
from padrao.cidade import lista

PASTA = os.path.join(RAIZ, VERSAO)

SONDA = """
<script>
(function () {
  var R = {};
  function fim(e) { if (e) R.erro = e; console.log("GOV " + JSON.stringify(R)); }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var P = window.__perf, cv = P.renderer.domElement;
    for (var k = 0; k < 40 && P.bombeia(4000); k++) P.passo();
    P.passo(); P.passo();
    R.janela = [innerWidth, innerHeight];
    R.dpr_inicial = P.renderer.getPixelRatio();
    R.canvas_inicial = [cv.width, cv.height];
    // Exatamente o que `governa()` faz quando decide baixar a resolucao.
    var alvo = 0.5;
    P.renderer.setPixelRatio(alvo);
    P.passo();
    R.dpr_pedido = alvo;
    R.canvas_depois = [cv.width, cv.height];
    R.esperado = [Math.floor(innerWidth * alvo), Math.floor(innerHeight * alvo)];
    R.aplicou = (cv.width === R.esperado[0] && cv.height === R.esperado[1]);
    // E a volta pra cima, que e o outro lado do governador.
    P.renderer.setPixelRatio(R.dpr_inicial);
    P.passo();
    R.canvas_voltou = [cv.width, cv.height];
    R.voltou = (cv.width === R.canvas_inicial[0] && cv.height === R.canvas_inicial[1]);
    fim();
  })(120);
})();
</script>
"""


def roda(html, q):
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".gov.html"
    png = html + ".gov.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="gv")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1100,700", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             "--screenshot=" + png, "--virtual-time-budget=90000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/") + "?q=" + q],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "GOV " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("GOV ") + 4:])[0]
            except Exception:
                pass
    return None


def main():
    if not os.path.exists(CHROME):
        # 2 = "nao deu pra medir", diferente de 1 = "medi e reprovou". O portao de
        # comportamento le esse codigo: sem a distincao, maquina sem Chrome reprovaria
        # o build inteiro em vez de dizer que nao mediu.
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    slugs = sys.argv[1:] or lista()
    ruim = 0
    for slug in slugs:
        html = os.path.join(PASTA, "%s-%s-aberto.html" % (slug, VERSAO))
        if not os.path.exists(html):
            print("  --      %-24s sem pagina montada" % slug); ruim += 1; continue
        d = roda(html, "alto")
        if not d or d.get("erro"):
            print("  XX      %-24s %s" % (slug, (d or {}).get("erro", "sem resposta")))
            ruim += 1; continue
        falhas = []
        if not d.get("aplicou"): falhas.append("baixar a resolucao nao chegou no canvas")
        if not d.get("voltou"):  falhas.append("subir de volta nao chegou no canvas")
        print("  %s      %-24s canvas %sx%s -> %sx%s (esperado %sx%s)  %s"
              % ("XX" if falhas else "ok", slug,
                 d["canvas_inicial"][0], d["canvas_inicial"][1],
                 d["canvas_depois"][0], d["canvas_depois"][1],
                 d["esperado"][0], d["esperado"][1], "; ".join(falhas)))
        if falhas: ruim += 1
    print("")
    print("%d cidade(s) com o governador sem efeito." % ruim if ruim
          else "O governador chega na tela em todas.")
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
