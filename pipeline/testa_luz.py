# -*- coding: utf-8 -*-
"""Prova da instalacao eletrica do interior: interruptor, lampada e parede que veda.

A luz de teto deixou de acender sozinha (v16). O que precisa continuar valendo, e que
nenhum portao anterior olha:

  * A casa abre APAGADA. Quem entra ve o que entra pela janela, nao um apartamento
    aceso sem ninguem ter acendido.
  * Todo comodo tem um plafom, e o comodo com porta tem uma placa de interruptor.
  * Acionar acende de verdade -- luz com intensidade, nao so o plafom mudando de cor.
  * O POOL NAO CRESCE. Sao quatro luzes pontuais na cena, aceso o apartamento
    inteiro ou nao: cada luz a mais entra no shader de todo material da cidade, e uma
    planta destas tem ate 11 comodos.
  * A LUZ PARA NA PAREDE. E o unico criterio que nao da pra ler do estado do objeto:
    aqui ele e medido no pixel. Com a camera dentro do comodo B, acender a lampada
    DELE tem que clarear a cena varias vezes mais do que acender a do vizinho A --
    numa cena sem sombra de lampada os dois clareiam quase igual, porque a luz
    atravessa a divisoria e so a distancia separa os dois casos.

    A razao exigida e 3x, e nao "o vizinho nao muda nada": porta aberta e vao sao
    caminho legitimo de luz, e o interior nasce com as folhas abertas de proposito
    (ver `geoDasEsquadrias`). O que se prova aqui e que a divisoria opaca vale mais
    que a distancia, nao que o apartamento e estanque.

    python pipeline/testa_luz.py                  # todas as cidades com planta
    python pipeline/testa_luz.py sao-carlos       # so uma

Sai 1 se algum criterio reprovar, 2 se nao deu pra medir.
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO
from padrao.cidade import lista

PASTA = os.path.join(RAIZ, VERSAO)

SONDA = r"""
<script>
(function () {
  var R = {};
  function fim(e) { if (e) R.erro = e; console.log("LUZ " + JSON.stringify(R)); }

  // Brilho medio do quadro, lido do proprio canvas. `drawImage` no mesmo tick do
  // render e o que salva: sem `preserveDrawingBuffer` o buffer morre na composicao.
  var cv = document.createElement("canvas"); cv.width = cv.height = 48;
  var g2 = cv.getContext("2d", { willReadFrequently: true });
  function brilho(I) {
    I.renderer.shadowMap.needsUpdate = true;
    I.renderer.render(I.scene, I.camera);
    g2.drawImage(I.renderer.domElement, 0, 0, 48, 48);
    var d = g2.getImageData(0, 0, 48, 48).data, s = 0;
    for (var i = 0; i < d.length; i += 4) s += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    return s / (d.length/4);
  }
  function acesas(I) {
    var n = 0;
    for (var i = 0; i < I.INT.lamps.length; i++) if (I.INT.lamps[i].on) n++;
    return n;
  }
  function pontuais(I) {
    return I.scene.children.filter(function (o) { return o.type === "PointLight"; }).length;
  }
  function comIntensidade(I) {
    return I.scene.children.filter(function (o) {
      return o.type === "PointLight" && o.intensity > 0; }).length;
  }

  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length ||
        !document.querySelector("#houses .hitem[data-unidade]")) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    document.querySelector("#houses .hitem[data-unidade]").click();
    document.getElementById("uEnter").click();
    var I = window.__int;
    function medir() {
      if (I.INT.voo && medir.n++ < 40) {          // mesma rebobinada do mede_interior
        I.INT.voo.t0 -= I.INT.voo.dur + 1000;
        return setTimeout(medir, 250);
      }
      if (!I.INT.on || !I.INT.pl) return fim("nao entrou no interior");
      var pl = I.INT.pl;
      R.comodos = pl.comodos.length;
      R.lamps   = I.INT.lamps.length;
      R.chaves  = I.INT.chaves ? I.INT.chaves.count : 0;
      R.pool    = I.INT.pool.length;
      R.acesas_no_boot = acesas(I);
      R.luz_no_boot    = comIntensidade(I);
      R.pontuais       = pontuais(I);
      R.castShadow = I.INT.pool.every(function (l) { return l.castShadow; });

      // acender TODAS nao pode criar luz nova na cena
      for (var i = 0; i < I.INT.lamps.length; i++) I.alternaLuz(i);
      R.acesas_tudo   = acesas(I);
      R.pontuais_tudo = pontuais(I);
      R.luz_tudo      = comIntensidade(I);
      // O cubemap so existe DEPOIS que a passada de sombra roda: perguntar antes do
      // render devolve `null` e reprovaria uma luz que projeta.
      I.renderer.shadowMap.needsUpdate = true;
      I.renderer.render(I.scene, I.camera);
      R.mapa = !!(I.INT.pool[0] && I.INT.pool[0].shadow.map);
      for (var j = 0; j < I.INT.lamps.length; j++) I.alternaLuz(j);
      R.acesas_fim = acesas(I);
      R.luz_fim    = comIntensidade(I);

      // ---- a parede veda? -------------------------------------------------
      // B = maior comodo (o primeiro: `plantaDaUnidade` ordena por area).
      // A = o comodo cujo centro esta mais perto do centro de B, que e o vizinho
      //     mais provavel -- e o pior caso pra este teste, porque e o mais perto.
      var B = 0, A = -1, dm = 1e9;
      for (var k = 1; k < pl.comodos.length; k++) {
        var d = Math.hypot(pl.comodos[k].cx - pl.comodos[B].cx,
                           pl.comodos[k].cz - pl.comodos[B].cz);
        if (d < dm) { dm = d; A = k; }
      }
      if (A < 0) return fim("planta com um comodo so");
      R.viz = dm;
      // A camera olha pro lado OPOSTO ao vizinho: o que tem que aparecer no quadro e
      // a parede de B, nao o vao que da pra A. Olhando PRA A o teste media a luz que
      // passa pela porta aberta -- que e caminho legitimo -- e dava 1,17x.
      var c = pl.comodos[B];
      I.camera.position.set(c.cx, I.INT.baseY + 1.60, c.cz);
      I.camera.lookAt(c.cx - (pl.comodos[A].cx - c.cx),
                      I.INT.baseY + 0.05,
                      c.cz - (pl.comodos[A].cz - c.cz));
      I.camera.updateMatrixWorld();
      var base = brilho(I);
      I.alternaLuz(A); var comA = brilho(I); I.alternaLuz(A);
      I.alternaLuz(B); var comB = brilho(I); I.alternaLuz(B);
      R.base = +base.toFixed(1); R.comA = +comA.toFixed(1); R.comB = +comB.toFixed(1);
      var gA = Math.max(0.01, comA - base), gB = Math.max(0.01, comB - base);
      R.razao = +(gB / gA).toFixed(2);
      fim();
    }
    medir.n = 0;
    setTimeout(medir, 2600);
  })(120);
})();
</script>
"""


def roda(html):
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".luz.html"
    png = html + ".luz.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="luz")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=900,600", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             # sem --screenshot a aba nao compoe quadro nenhum e o programa nem sobe.
             "--screenshot=" + png, "--virtual-time-budget=90000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/") + "?q=alto"],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "LUZ " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("LUZ ") + 4:])[0]
            except Exception:
                pass
    return None


def criterios(d):
    return [
        ("um plafom por comodo",        d.get("lamps") == d.get("comodos")),
        ("tem interruptor na parede",   d.get("chaves", 0) >= 1),
        ("a casa abre apagada",         d.get("acesas_no_boot", -1) == 0
                                        and d.get("luz_no_boot", -1) == 0),
        ("acender acende de verdade",   d.get("luz_tudo", 0) >= 1),
        ("o pool nao cresce",           d.get("pontuais_tudo", 99) == d.get("pontuais", 0)
                                        and d.get("luz_tudo", 99) <= d.get("pool", 0)),
        ("lampada projeta sombra",      bool(d.get("castShadow")) and bool(d.get("mapa"))),
        ("apagar apaga",                d.get("acesas_fim", -1) == 0
                                        and d.get("luz_fim", -1) == 0),
        ("a luz para na parede (3x)",   d.get("razao", 0) >= 3.0),
    ]


def main():
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    slugs = sys.argv[1:] or lista()
    ruim = 0
    vistos = 0
    for slug in slugs:
        html = os.path.join(PASTA, "%s-%s-aberto.html" % (slug, VERSAO))
        if not os.path.exists(html):
            print("  --      %-24s sem pagina montada" % slug); continue
        d = roda(html)
        if not d or d.get("erro"):
            msg = (d or {}).get("erro", "sem resposta")
            # Cidade sem planta pendurada em predio nao tem interior pra medir: nao e
            # reprovacao, e ausencia de assunto -- mesmo criterio do mede_interior.
            if "nao entrou" in msg or "nunca subiu" in msg:
                print("  --      %-24s sem interior (%s)" % (slug, msg)); continue
            print("  XX      %-24s %s" % (slug, msg)); ruim += 1; continue
        vistos += 1
        falhas = [n for n, ok in criterios(d) if not ok]
        print("  %s      %-24s %d comodos, %d chaves, pool %d, razao %.2fx  %s"
              % ("XX" if falhas else "ok", slug, d.get("comodos", 0), d.get("chaves", 0),
                 d.get("pool", 0), d.get("razao", 0),
                 ("FALHOU: " + ", ".join(falhas)) if falhas else ""))
        if falhas: ruim += 1
    if not vistos and not ruim:
        print("  nenhuma cidade com interior medido"); return 2
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
