# -*- coding: utf-8 -*-
"""A vitrine para na FICHA, e o pino so acende no "O que tem por perto?".

Ate o v12, clicar num item de "Imoveis para inspecao 3D" voava ate o predio e, 980 ms
depois, ENTRAVA nele: quem so queria saber o que era aquele anuncio se via em primeira
pessoa dentro de uma sala, sem ter lido metragem nem comodo. E os 1.197 pinos de
estabelecimento nasciam acesos, tapando a cidade que a pessoa veio ver.

Nada disso aparece numa foto, e todo modo de falhar e silencioso: a ficha abre vazia, o
botao "por perto" abre a coluna mas nao acende pino nenhum, apagar uma categoria nao
apaga nada, fechar o modo deixa os pinos acesos pra sempre. Por isso os portoes:

  BOOT      nenhum marcador de estabelecimento visivel, `__int.pins()` falso, e nem a
            ficha nem a coluna na tela. E o portao mais importante: e o unico que
            reprova se alguem devolver o padrao antigo sem querer.
  FICHA     clicar no primeiro item da vitrine abre a ficha (ou a ficha simples do
            anuncio sem planta) e NAO entra no interior. Com planta, a ficha tem que
            trazer comodo com area -- lista vazia e ficha que so parece ficha.
  PERTO     "O que tem por perto?" abre a coluna, acende os pinos, poe marcador na
            tela e conta categoria com o imovel no centro.
  TIRA      a ficha do imovel nao fecha ao entrar no modo: ENCOLHE pra uma tira no
            rodape (e ela que responde "perto de QUE?"). Clicar na tira devolve a ficha
            inteira sem sair do modo, e a seta encolhe de volta.
  FILTRO    a coluna abre com TUDO apagado: clicar acende a categoria e poe marcador na
            tela, clicar de novo limpa. Todos/Nenhum fazem o mesmo em bloco.
  FECHA     sair do modo apaga os pinos DE NOVO (zero marcador visivel).
  BUSCA     procurar um estabelecimento pelo nome acende o pino dele (senao a ficha
            abriria sobre um marcador invisivel), e fechar essa ficha apaga de novo --
            sem isso a busca acenderia o mapa pra sempre, porque nao ha botao Pins.
  ENTRA     o botao da ficha e que leva pra dentro da casa, e leva.
  PLANTA    dentro da casa o minimapa nao se esconde: desenha a planta do imovel, com o
            comodo em que se esta aceso. Canvas falha ficando EM BRANCO, entao a sonda
            conta tinta -- parede (claro) e "voce esta aqui" (verde).

    python pipeline/testa_ficha_e_perto.py                  # todas as cidades
    python pipeline/testa_ficha_e_perto.py ribeirao-preto
"""
import io, json, os, shutil, subprocess, sys, tempfile

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
  function fim(e) { if (e) R.erro = e; console.log("FICHA " + JSON.stringify(R)); }
  function pois() { return document.querySelectorAll(".poi"); }
  function poisVis() {
    var n = 0, e = pois();
    for (var i = 0; i < e.length; i++) if (e[i].style.display !== "none") n++;
    return n;
  }
  function on(id) { return document.getElementById(id).classList.contains("on"); }
  function min(id) { return document.getElementById(id).classList.contains("min"); }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var I = window.__int, P = window.__perf;
    // A fila do streaming seca antes de qualquer medida: quarteirao entrando muda o
    // que esta na tela, e a sonda estaria medindo o streaming, nao a interface.
    for (var k = 0; k < 60 && P.bombeia(4000); k++) P.passo();
    P.passo(); P.passo();

    // ---- BOOT --------------------------------------------------------------
    R.boot_pois_vis = poisVis();
    R.boot_pins = I.pins();
    R.boot_ficha = on("usheet") || on("hsheet");
    R.boot_coluna = on("nearby");
    R.ncat = document.querySelectorAll("#nList .ncat").length;

    // ---- FICHA -------------------------------------------------------------
    var itens = document.querySelectorAll("#houses .hitem");
    R.vitrine = itens.length;
    if (!itens.length) return fim();          // cidade sem vitrine para aqui
    var it = itens[0];
    R.com_planta = !!it.dataset.unidade;
    it.click();
    P.passo(); P.passo();
    R.ficha_usheet = on("usheet");
    R.ficha_hsheet = on("hsheet");
    R.entrou_sozinho = I.INT.on;              // TEM que ser falso: o v12 entrava
    R.ficha_nome = (document.getElementById(R.com_planta ? "uName" : "hName") || {}).textContent;
    R.ficha_stats = document.querySelectorAll("#usheet .stats div").length;
    R.ficha_comodos = document.querySelectorAll("#uCom .ci").length;
    R.ficha_ncom = (document.getElementById("uNCom") || {}).textContent;

    // ---- PERTO -------------------------------------------------------------
    document.getElementById(R.com_planta ? "uPerto" : "hPerto").click();
    for (var j = 0; j < 60 && P.bombeia(4000); j++) P.passo();
    P.passo(); P.passo();
    R.perto_coluna = on("nearby");
    R.perto_pins = I.pins();
    // A ficha NAO fecha ao entrar no modo: encolhe pra tira e continua no rodape.
    var ficha = R.com_planta ? "usheet" : "hsheet";
    R.perto_ficha_viva = on(ficha);
    R.perto_ficha_min = min(ficha);
    R.perto_pois_vis = poisVis();             // TEM que ser 0: a coluna abre apagada
    R.perto_sub = document.getElementById("nSub").textContent;
    // A soma dos numeros da coluna e a contagem POR RAIO, nao a cidade inteira.
    var chips = [].slice.call(document.querySelectorAll("#nList .ncat")), soma = 0, cheio = null;
    R.perto_cat_ligadas = 0;
    for (var c = 0; c < chips.length; c++) {
      var v = parseInt(chips[c].querySelector("b").textContent, 10) || 0;
      soma += v;
      if (chips[c].getAttribute("aria-pressed") === "true") R.perto_cat_ligadas++;
      if (!cheio && v > 0) cheio = chips[c];   // a lista ja vem ordenada por mais perto
    }
    R.perto_soma = soma;
    R.perto_total_cidade = pois().length;

    // ---- TIRA --------------------------------------------------------------
    // Clicar na tira devolve a ficha inteira SEM sair do modo, e a seta encolhe de
    // novo. Sem a volta, quem abrisse a ficha ficaria preso com ela cobrindo o mapa.
    document.getElementById(ficha).click();
    P.passo();
    R.tira_abriu = on(ficha) && !min(ficha);
    R.tira_coluna_ficou = on("nearby");
    document.getElementById(R.com_planta ? "uDobra" : "hDobra").click();
    P.passo();
    R.tira_encolheu = min(ficha);

    // ---- FILTRO ------------------------------------------------------------
    // Agora o sentido e o inverso do v13.0: a coluna abre APAGADA, entao o clique
    // ACENDE. O portao continua sendo o mesmo par de perguntas -- ligar poe marcador
    // na tela, desligar tira --, so que na ordem em que o usuario faz.
    if (cheio) {
      cheio.click(); P.passo(); P.passo();
      R.filtro_ligado = cheio.getAttribute("aria-pressed") === "true";
      R.filtro_pois_vis = poisVis();
      cheio.click(); P.passo(); P.passo();
      R.filtro_volta = poisVis();
      document.getElementById("nAll").click(); P.passo(); P.passo();
      R.todos_pois_vis = poisVis();
      document.getElementById("nNone").click(); P.passo(); P.passo();
      R.nenhum_pois_vis = poisVis();
    }

    // ---- FECHA -------------------------------------------------------------
    document.getElementById("nx").click();
    P.passo(); P.passo();
    R.fecha_coluna = on("nearby");
    R.fecha_pins = I.pins();
    R.fecha_pois_vis = poisVis();
    R.fecha_ficha = on(ficha);        // o x da coluna fecha a ficha junto
    R.fecha_min = min(ficha);         // ...e nao deixa a tira pra tras

    // ---- BUSCA -------------------------------------------------------------
    // A busca acende o pino sozinha: abrir a ficha de um lugar procurado sobre um
    // marcador invisivel nao mostraria nada. E como nao ha mais botao Pins na tela,
    // fechar essa ficha TEM que apagar de novo -- senao a busca acende o mapa pra
    // sempre.
    var alvo = (I.BUSCA || []).filter(function (x) { return x.k === "poi"; })[0];
    if (alvo) {
      var q = document.getElementById("bq");
      q.value = alvo.n; q.dispatchEvent(new Event("input"));
      var lin = document.querySelectorAll("#bres .bi");
      R.busca_achou = lin.length;
      // A sonda emite a SEQUENCIA que o navegador emite num clique, em vez de adivinhar
      // qual dos eventos o codigo escuta. O comentario que estava aqui dizia que o
      // resultado responde a mousedown e que `el.click()` nao dispara nada -- era verdade
      // no v15 (`bres.addEventListener("mousedown")`), e deixou de ser quando o galho v16
      // trocou para "click", ANTES da modularizacao. Desde entao este portao reprovava um
      // recurso que funciona: medido nesta pagina, so-mousedown nao acende o pino, e tanto
      // `el.click()` quanto a sequencia completa acendem. Emitindo a sequencia, a sonda
      // para de depender de qual evento esta ligado hoje.
      if (lin.length) {
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (t) {
          var Ev = (t.indexOf("pointer") === 0 && window.PointerEvent) ? PointerEvent : MouseEvent;
          lin[0].dispatchEvent(new Ev(t, { bubbles: true, cancelable: true }));
        });
        P.passo();
      }
      R.busca_acendeu = I.pins();
      document.getElementById("px").click(); P.passo();
      R.busca_apagou = I.pins() === false;
      q.value = ""; q.dispatchEvent(new Event("input"));
    }

    // ---- ENTRA -------------------------------------------------------------
    if (R.com_planta) {
      it.click(); P.passo();
      document.getElementById("uEnter").click();
      P.passo(); P.passo();
      R.entrou_no_botao = I.INT.on;
      R.entrou_comodos = I.INT.pl ? I.INT.pl.comodos.length : 0;

      // ---- PLANTA ----------------------------------------------------------
      // Dentro da casa o minimapa nao se esconde: desenha a planta. Como qualquer
      // canvas, o modo de falhar e ficar EM BRANCO -- entao a sonda conta tinta.
      // `claro` sao as paredes (linha fina: pouca area); `verde` e o comodo em que se
      // esta mais o cone de visao, que e o "voce esta aqui".
      R.planta_mm_visivel = !document.getElementById("minimapa").hidden;
      var cv = document.getElementById("mmc");
      var d2 = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      var claro = 0, verde = 0, tot = cv.width * cv.height;
      for (var p2 = 0; p2 < d2.length; p2 += 4) {
        if (d2[p2] + d2[p2+1] + d2[p2+2] > 300) claro++;
        if (d2[p2+1] > d2[p2] + 20 && d2[p2+1] > d2[p2+2] + 20) verde++;
      }
      R.planta_claro = +(100 * claro / tot).toFixed(1);
      R.planta_verde = +(100 * verde / tot).toFixed(1);
      R.planta_comodo = I.INT.pl ? I.INT.pl.comodos.length : 0;
    }
    fim();
  })(160);
})();
</script>
"""


def roda(html):
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".ficha.html"
    png = html + ".ficha.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="fp")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1200,760", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             # sem --screenshot a aba nao compoe frame nenhum e o programa nem sobe.
             "--screenshot=" + png, "--virtual-time-budget=90000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "FICHA " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("FICHA ") + 6:])[0]
            except Exception:
                pass
    return None


def criterios(d):
    """(nome, passou). Cidade sem vitrine so responde pelos portoes do boot."""
    c = [
        ("pino apagado no boot",        d.get("boot_pois_vis", -1) == 0),
        ("botao Pins em falso no boot", d.get("boot_pins") is False),
        ("nenhuma ficha aberta no boot", d.get("boot_ficha") is False),
        ("coluna fechada no boot",      d.get("boot_coluna") is False),
        ("coluna tem categoria",        d.get("ncat", 0) > 0),
    ]
    if not d.get("vitrine"):
        return c
    com = d.get("com_planta")
    c += [
        ("clique na vitrine abre a ficha",
         bool(d.get("ficha_usheet") if com else d.get("ficha_hsheet"))),
        ("clique na vitrine NAO entra na casa", d.get("entrou_sozinho") is False),
        ("a ficha tem nome",            bool((d.get("ficha_nome") or "").strip()) and
                                        d.get("ficha_nome") != "\u2014"),
    ]
    if com:
        c += [("a ficha lista comodo com area", d.get("ficha_comodos", 0) > 0),
              ("a ficha tem numero (area, preco, quartos)", d.get("ficha_stats", 0) >= 3)]
    c += [
        ("'por perto' abre a coluna",   bool(d.get("perto_coluna"))),
        ("'por perto' acende os pinos", d.get("perto_pins") is True),
        ("'por perto' encolhe a ficha em vez de fechar",
         bool(d.get("perto_ficha_viva")) and bool(d.get("perto_ficha_min"))),
        ("clicar na tira devolve a ficha inteira",
         bool(d.get("tira_abriu")) and bool(d.get("tira_coluna_ficou"))),
        ("a seta encolhe de volta",     bool(d.get("tira_encolheu"))),
        ("'por perto' abre com TODAS as categorias apagadas",
         d.get("perto_pois_vis", -1) == 0 and d.get("perto_cat_ligadas", -1) == 0),
        ("a contagem e por raio, nao a cidade inteira",
         0 < d.get("perto_soma", 0) < d.get("perto_total_cidade", 0)),
        ("ligar a categoria mais cheia poe marcador na tela",
         bool(d.get("filtro_ligado")) and d.get("filtro_pois_vis", 0) > 0),
        ("desligar de volta limpa o mapa", d.get("filtro_volta", -1) == 0),
        ("Todos acende, Nenhum apaga",
         d.get("todos_pois_vis", 0) >= d.get("filtro_pois_vis", 0) > 0
         and d.get("nenhum_pois_vis", -1) == 0),
        ("fechar recolhe a coluna",     d.get("fecha_coluna") is False),
        ("fechar apaga os pinos DE NOVO", d.get("fecha_pins") is False and
                                          d.get("fecha_pois_vis", -1) == 0),
        ("fechar leva a ficha junto, sem deixar tira",
         d.get("fecha_ficha") is False and d.get("fecha_min") is False),
        ("a busca acende o pino do lugar achado", d.get("busca_acendeu") is True),
        ("fechar a ficha do lugar apaga de novo", d.get("busca_apagou") is True),
    ]
    if com:
        c += [("o botao da ficha entra na casa", bool(d.get("entrou_no_botao"))),
              ("entrou na planta certa", d.get("entrou_comodos", 0) > 0),
              ("o minimapa fica na tela dentro da casa", bool(d.get("planta_mm_visivel"))),
              # Linha de parede ocupa pouca area; muito acima disso seria mancha, e 0
              # seria canvas em branco -- que e como um canvas falha.
              ("a planta tem parede desenhada", 0.4 < d.get("planta_claro", 0) < 25),
              ("a planta diz onde a pessoa esta", d.get("planta_verde", 0) > 0.4)]
    return c


def main():
    if not os.path.exists(CHROME):
        # 2 = "nao deu pra medir", diferente de 1 = "medi e reprovou". O portao de
        # comportamento le esse codigo: sem a distincao, maquina sem Chrome reprovaria
        # o build inteiro em vez de dizer que nao mediu.
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")] or lista()
    ruim = 0
    for slug in slugs:
        html = os.path.join(PASTA, "%s-%s-aberto.html" % (slug, VERSAO))
        if not os.path.exists(html):
            print("  --      %-24s sem pagina montada" % slug); ruim += 1; continue
        d = roda(html)
        if not d or d.get("erro"):
            print("  XX      %-24s %s" % (slug, (d or {}).get("erro", "sem resposta")))
            ruim += 1; continue
        if "--debug" in sys.argv: print("   ", json.dumps(d, ensure_ascii=False))
        falhas = [n for n, ok in criterios(d) if not ok]
        # "na tela" e depois de ACENDER a categoria mais cheia: com a coluna abrindo
        # apagada, o numero no instante em que ela abre e sempre zero e nao diz nada.
        print("  %s      %-24s vitrine=%d%s  %d cat, %d POI perto de %d, %d na tela  %s"
              % ("XX" if falhas else "ok", slug, d.get("vitrine", 0),
                 " (com planta)" if d.get("com_planta") else "",
                 d.get("ncat", 0), d.get("perto_soma", 0), d.get("perto_total_cidade", 0),
                 d.get("filtro_pois_vis", 0), "; ".join(falhas)))
        if falhas: ruim += 1
    print("")
    print("%d verificacao(oes) reprovada(s)." % ruim if ruim else "Tudo passou.")
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
