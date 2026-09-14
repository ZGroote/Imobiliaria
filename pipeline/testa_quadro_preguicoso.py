# -*- coding: utf-8 -*-
"""Prova do que o frame() passou a NAO fazer: rotulo parado e sombra sem quem projete.

Duas economias da Fase 1 sao a mesma aposta -- deixar de refazer trabalho quando nada
mudou -- e as duas quebram do mesmo jeito: nao "some", e "NAO VOLTA".

  * O laco de rotulo de rua so roda quando camera, janela ou relevo mudam. A armadilha
    e o botao Rua, que se liga e desliga com a camera PARADA; e a outra e o
    rebuildOverlay(), que refaz a lista inteira com elementos novos (display:none) e
    as vezes no MESMO tamanho -- por isso contar rotulo nao serve de chave.
  * O marcador de estabelecimento (POI) tem a mesma guarda e a mesma armadilha, no
    botao Pins e nos filtros de categoria (v13: e o pino nasce APAGADO -- a sonda
    confere isso e acende antes de medir). Sao 1.197 POIs pra ~100 visiveis, entao e
    onde a guarda rende mais -- e onde ela quebraria mais feio.
  * A passada do mapa de sombra so acontece se alguem projeta. Em "baixo"/"medio"
    SOMBRA_CIDADE e false e nada na cidade projeta: o three nem chega a alocar o mapa.
    Em "alto" ele tem que alocar -- e esse o controle que prova que a medida vale.

Os quadros sao dados na mao (`__perf.passo`): em Chrome headless o rAF morre depois
dos primeiros quadros, e medir pelo laco normal aprova qualquer coisa
(ver [[mapa-3d-raf-aba-oculta]]).

    python pipeline/testa_quadro_preguicoso.py                  # todas as cidades
    python pipeline/testa_quadro_preguicoso.py ribeirao-preto   # so uma

Sai 1 se algum criterio reprovar.
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO
from padrao.cidade import lista

PASTA = os.path.join(RAIZ, VERSAO)

SONDA = """
<script>
(function () {
  var R = {};
  function els() { return document.querySelectorAll("#overlay .street"); }
  function visiveis() {
    var n = 0, e = els();
    for (var i = 0; i < e.length; i++) if (e[i].style.display === "block") n++;
    return n;
  }
  function pois() { return document.querySelectorAll(".poi"); }
  function poisVis() {
    var n = 0, e = pois();
    for (var i = 0; i < e.length; i++) if (e[i].style.display !== "none") n++;
    return n;
  }
  function algum() {
    var e = els();
    for (var i = 0; i < e.length; i++) if (e[i].style.display === "block") return e[i];
    return null;
  }
  function fim(e) { if (e) R.erro = e; console.log("PREGUICA " + JSON.stringify(R)); }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var I = window.__int, P = window.__perf;
    R.nivel = P.nivel;
    // A fila do streaming TEM que secar antes: quarteirao entrando refaz a lista de
    // rotulos, e isso invalida a guarda de proposito. Sem drenar, o teste de "camera
    // parada" estaria medindo streaming.
    for (var k = 0; k < 60 && P.bombeia(4000); k++) P.passo();
    P.passo(); P.passo();
    R.total = els().length; R.fila = P.fila();
    R.a_visiveis = visiveis();
    if (!R.a_visiveis) return fim("nenhum rotulo de rua visivel no enquadramento inicial");

    // 1) Camera PARADA: o laco nao pode rodar. Prova direta -- sujo o transform de TODO
    //    rotulo visivel e dou dois quadros; se algum voltar, a guarda nao segurou.
    //    Sujar todos, e nao um so, porque andar refaz a lista (rebuildOverlay) e um
    //    elemento escolhido a dedo pode simplesmente sair do DOM -- ai o teste mediria
    //    orfao, e foi assim que ele deu falso negativo em 3 das 5 cidades.
    //    O navegador RESSERIALIZA o valor ("-999px, -999px", com espaco): o que vale na
    //    comparacao e o que ele devolveu, nao a string que eu escrevi.
    var e = els(), sujo = "";
    for (var i = 0; i < e.length; i++)
      if (e[i].style.display === "block") { e[i].style.transform = "translate(-999px,-999px)";
                                            sujo = e[i].style.transform; }
    function sujos() {
      var n = 0, q = els();
      for (var i = 0; i < q.length; i++)
        if (q[i].style.display === "block" && q[i].style.transform === sujo) n++;
      return n;
    }
    P.passo(); P.passo();
    R.b_sujos = sujos();
    R.b_pulou_parado = (R.b_sujos === R.a_visiveis);

    // 2) Camera ANDOU: o laco roda de novo e nao sobra nenhum rotulo com a marca.
    I.target.x += 260; I.target.z += 180;
    P.passo(); P.passo();
    for (var j = 0; j < 60 && P.bombeia(4000); j++) P.passo();
    P.passo(); P.passo();
    R.c_visiveis = visiveis();
    R.c_sujos = sujos();
    R.c_refez_ao_andar = (R.c_sujos === 0);

    // 3) Botao Rua desliga e liga COM A CAMERA PARADA -- a armadilha da guarda.
    var b = document.getElementById("tLab");
    b.click(); P.passo();
    R.d_desligado = visiveis();
    b.click(); P.passo();
    R.e_religado = visiveis();

    // 4) O mesmo par de perguntas pros marcadores de estabelecimento.
    // v13: o pino NASCE APAGADO -- quem acende e o "O que tem por perto?", a busca por
    // um lugar, ou o proprio botao Pins. Entao a sonda primeiro CONFERE que esta
    // apagado e so depois acende, pela mesma porta que o botao usa.
    var bp = window.__int.el("tPins");
    R.pois_apagados_no_boot = poisVis();
    bp.click(); P.passo(); P.passo();
    R.pois_total = pois().length;
    R.f_pois = poisVis();
    var pv = pois(), sujoP = "";
    for (var q = 0; q < pv.length; q++)
      if (pv[q].style.display !== "none") { pv[q].style.transform = "translate(-999px,-999px)";
                                            sujoP = pv[q].style.transform; }
    function poisSujos() {
      var n = 0, e = pois();
      for (var i = 0; i < e.length; i++)
        if (e[i].style.display !== "none" && e[i].style.transform === sujoP) n++;
      return n;
    }
    P.passo(); P.passo();
    R.g_poi_pulou_parado = (poisSujos() === R.f_pois);
    // v12: o botao Pins saiu do painel e virou elemento orfao; o comportamento
    // (desligar esconde marcador) continua. `__int.el` e o $ do app -- e desde o
    // v13 a sonda ja acendeu o pino la em cima, entao aqui `bp` so alterna.
    bp.click(); P.passo();
    R.h_pins_desligado = poisVis();
    bp.click(); P.passo();
    R.i_pins_religado = poisVis();

    // 5) Passada de sombra: sem quem projete, o three nunca aloca o mapa.
    R.sombra_alocada = !!(I.sun.shadow && I.sun.shadow.map);
    fim();
  })(120);
})();
</script>
"""


def roda(html, q):
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".preguica.html"
    png = html + ".preguica.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="pg")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1100,700", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             # sem --screenshot a aba nao compoe frame nenhum e o programa nem sobe.
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
        if "PREGUICA " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("PREGUICA ") + 9:])[0]
            except Exception:
                pass
    return None


def criterios(d, q):
    """(nome, passou) — o controle de "alto" e o unico que muda entre os dois niveis."""
    return [
        ("guarda segura com a camera parada", bool(d.get("b_pulou_parado"))),
        ("laco volta a rodar ao andar",       bool(d.get("c_refez_ao_andar"))),
        ("rotulo sobrevive ao andar",         d.get("c_visiveis", 0) > 0),
        ("botao Rua desliga",                 d.get("d_desligado", -1) == 0),
        ("botao Rua religa com camera parada", d.get("e_religado", 0) > 0),
        ("pino apagado no boot",                d.get("pois_apagados_no_boot", -1) == 0),
        ("POI visivel no enquadramento",        d.get("f_pois", 0) > 0),
        ("guarda de POI segura parada",         bool(d.get("g_poi_pulou_parado"))),
        ("botao Pins desliga",                  d.get("h_pins_desligado", -1) == 0),
        ("botao Pins religa com camera parada", d.get("i_pins_religado", 0) > 0),
        ("mapa de sombra %s" % ("alocado" if q == "alto" else "nao alocado"),
         bool(d.get("sombra_alocada")) == (q == "alto")),
    ]


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
            print("  --      %-28s sem pagina montada" % slug); ruim += 1; continue
        for q in ("baixo", "alto"):
            d = roda(html, q)
            if not d or d.get("erro"):
                print("  XX      %-22s q=%-6s %s"
                      % (slug, q, (d or {}).get("erro", "sem resposta")))
                ruim += 1; continue
            falhas = [n for n, ok in criterios(d, q) if not ok]
            print("  %s      %-22s q=%-6s %d rotulos (%d vis), %d POIs (%d vis), "
                  "sombra=%s  %s"
                  % ("XX" if falhas else "ok", slug, q, d.get("total", 0),
                     d.get("e_religado", 0), d.get("pois_total", 0),
                     d.get("i_pins_religado", 0), d.get("sombra_alocada"),
                     "; ".join(falhas)))
            if falhas: ruim += 1
    print("")
    print("%d verificacao(oes) reprovada(s)." % ruim if ruim else "Tudo passou.")
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
