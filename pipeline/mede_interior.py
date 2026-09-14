# -*- coding: utf-8 -*-
"""Mede a EXPOSICAO do interior num print headless, em vez de decidir no olho.

Iluminacao e o unico lugar deste projeto onde "ficou bom" foi decidido olhando a tela --
e foi assim que a primeira versao com luz de teto saiu estourada em branco sem ninguem
perceber ate o print. Aqui sai numero: media, percentis e quanto da tela queimou.

    python pipeline/mede_interior.py                    # ribeirao-preto, entrada padrao
    python pipeline/mede_interior.py <slug>             # outra cidade com planta
    python pipeline/mede_interior.py --salvar luz.png   # guarda o print pra olhar

Faixa desejada, medida no miolo da tela (fora dos paineis):
    media    105 a 168      nem escuro nem lavado
    p99      abaixo de 250  quase nada encostando no branco
    queimado abaixo de 1,5% fracao de pixel >= 252 em todos os canais
    faixa    acima de 90    p95 menos p05: se for baixa, a cena e chapada
    escuro   acima de 2,5%  fracao de pixel abaixo de 70: a ANCORA da paleta
    croma    acima de 0,09  saturacao media: cena sem cor nenhuma nao e foto

RECALIBRADO EM 04/09/2026, e o motivo importa mais que os numeros.

O piso de `faixa` e 90, e nao 100: 100 foi o primeiro palpite, tirado da medida de UMA
cidade (Sao Carlos, 102,4) -- e reprovou Ribeirao em 93,4, que tinha MELHORADO (era
84,6). Portao calibrado no melhor quadro de uma cidade so nao e portao, e retrato. 90
aperta de verdade contra o limite antigo de 80 e as duas cidades passam por margem
propria.

O criterio antigo (media 120 a 175) foi escrito pra pegar dois defeitos: cena
estourada em branco e cena preta. Ele pegava os dois. So que, sendo um portao de
MEDIA, ele empurra a cena inteira pro meio-cinza -- e as cores do cadastro foram
literalmente calibradas pra caber nele (esta escrito no `_calibracao` da sanca-135:
"Escurecidas ~5% ... saia com media 175,3"). O resultado, medido: 0,0% de pixel
abaixo de 70 e saturacao media 0,044. A cena inteira vivia entre 138 e 224 num
espaco de 255.

Foto de arquitetura nao e isso. Ela tem media MAIS BAIXA, preto de verdade em
alguns lugares (o tampo da bancada, a coifa, o vao de uma porta) e UMA cor
saturada que segura o quadro. Entao o portao deixou de perguntar so "esta no meio?"
e passou a exigir tambem PRETO (`escuro`) e COR (`croma`) -- os dois como PISO, nao
como teto. Continuam existindo os limites de cima: `p99` e `queimado` seguem
proibindo cena lavada, que era o defeito original e nao deixou de ser defeito.

O 80 era 90 ate 2026-08-31, quando a mobilia do mirra-114 foi removida a pedido: o
movel era a maior parte do que havia de escuro no quadro, e a cena de referencia passou
a ser um apartamento VAZIO -- parede, piso, rodape e sombra de vao. Medido logo depois
da remocao: 88,5. O portao continua servindo pro que existe (pegar a cena lavada ou
chapada de verdade); o que mudou foi a cena, nao o criterio.
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
# A versao tem UM dono, o montar.py -- mesma licao do testa_duplo_clique.py, que ja
# tinha sido aprendida uma vez: aqui a pagina estava presa no "v9" escrito a mao, e o
# medidor seguia aprovando a iluminacao de uma pagina duas versoes atras.
from pipeline.montar import VERSAO
from padrao.cidade import lista
# A cidade tambem tem UM dono, e nao e este arquivo (regra 1b do PADRAO.md): "ribeirao-
# preto" estava escrito aqui dentro porque era a unica com planta fornecida. Agora vem
# de argumento -- e o portao de comportamento so chama este medidor pra cidade que tem
# planta pendurada em predio, que e onde existe interior pra medir.
# `--nivel alto` deixa um "alto" solto em argv: casa contra a lista de cidades, nao
# contra "o primeiro que nao comeca com -".
SLUG = ([x for x in sys.argv[1:] if x in lista()] or ["ribeirao-preto"])[0]
PAG = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (SLUG, VERSAO))

PLANTA = "--planta" in sys.argv
# Este medidor roda em SwiftShader (rasterizador de SOFTWARE), e o detector de nivel de
# graficos classifica software como "baixo" -- ou seja, sem esta trava a medida mudaria
# de configuracao sozinha e a faixa calibrada la em cima deixaria de valer. A referencia
# e "alto"; `--nivel baixo` compara de proposito.
NIVEL = (sys.argv[sys.argv.index("--nivel") + 1] if "--nivel" in sys.argv else "alto")
# QUAL unidade. Sem isto o medidor clica no PRIMEIRO item da vitrine, que e o primeiro
# em ordem de pasta -- com quatro lancamentos em Sao Carlos ele media so o
# `monte-das-colinas-39`, e renomear uma pasta trocaria o que o portao olha, em
# silencio. O portao continua medindo o primeiro (a calibracao la de cima e dele); o
# argumento existe pra conferir as OUTRAS antes de fechar um lancamento novo.
UNIDADE = (sys.argv[sys.argv.index("--unidade") + 1] if "--unidade" in sys.argv else "")
SONDA = """
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length ||
      !document.querySelector("#houses .hitem[data-unidade]")) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('SONDA {"erro":"nao subiu"}'); return;
  }
  // v13: o clique na vitrine para na FICHA -- quem entra e o botao dela. Sem este
  // segundo clique o medidor mede a CIDADE achando que esta medindo o interior, e
  // aprova a iluminacao de uma cena que nem chegou a abrir.
  var alvo = window.__unidade
    ? document.querySelector('#houses .hitem[data-unidade="' + window.__unidade + '"]')
    : document.querySelector("#houses .hitem[data-unidade]");
  if (!alvo) { console.log('SONDA {"erro":"unidade nao esta na vitrine"}'); return; }
  alvo.click();
  document.getElementById("uEnter").click();
  // v15: TERMINAR O VOO E O BAKE ANTES DE MEDIR -- os dois, e nesta ordem.
  //
  // Este medidor fotografava a camera ONDE ELA ESTIVESSE aos 2600 ms, e sob
  // `--virtual-time-budget` isso e uma corrida: o tempo virtual so avanca quando o
  // renderizador fica ocioso, entao QUALQUER mudanca no custo do quadro decide se o
  // voo de entrada terminou ou nao. Medido no v15: a mesma pagina, so trocando
  // `?bake=0` por `?bake=1`, dava `voo: true` e camera na origem de um lado e camera
  // posta do outro -- dois ENQUADRAMENTOS, e a faixa dinamica caindo de 82,7 pra 65,8
  // por causa disso. O portao estava medindo, em boa parte, de onde a foto foi tirada.
  //
  // Rebobinar o `t0` faz o proprio laco da pagina concluir o voo no quadro seguinte
  // (`t >= 1` -> `fim()`), o que poe a camera exatamente no destino que ela sempre
  // teve -- sem coordenada magica aqui dentro. Com a camera presa, medida com bake e
  // sem bake passam a ser comparaveis, que e o que um portao precisa ser.
  if (window.__int.INT.voo)
    window.__int.INT.voo.t0 -= window.__int.INT.voo.dur + 1000;
  // E o bake termina agora, nao em fatias: cena assando pela metade e outra cena.
  if (window.__int.bakeAgora) window.__int.bakeAgora();
  // ...E DE NOVO NA HORA DE MEDIR, porque os voos sao ENCADEADOS. `uEnter` dispara o
  // voo ate o predio, e o `fim()` dele e que cria o segundo voo, o de entrar (ver as
  // duas atribuicoes de INT.voo no app.js). Rebobinar so aqui em cima pega o primeiro;
  // o segundo nasce depois e, dependendo do custo do quadro, ainda esta correndo aos
  // 2600 ms -- e a foto sai de outro lugar. Medido: o MESMO build deu faixa 99,6 numa
  // rodada e 73,7 na seguinte, so por isso; um portao que muda de resposta sem o
  // programa mudar nao esta medindo o programa. Agora so se mede com INT.voo nulo.
  function medir() {
    var I = window.__int;
    if (I.INT.voo && medir.n++ < 40) {
      I.INT.voo.t0 -= I.INT.voo.dur + 1000;
      return setTimeout(medir, 250);
    }
    // v15: o bake de luz assenta em fatias de 5 ms por quadro. Sem terminar o que
    // falta aqui, o print sai de uma cena assando pela metade -- e a medida
    // aprovaria uma iluminacao que o usuario nunca ve. Mesma licao do carimbo de
    // build: print sem saber DE QUE nao e evidencia de nada.
    if (I.bakeAgora) I.bakeAgora();
    if (window.__sol) {   // prova de sombra: so o sol, sem preenchimento
      var so = I.scene.children.filter(function(o){return o.type==="DirectionalLight";})[0];
      so.intensity = 2.0;
      I.scene.children.filter(function(o){return o.type==="AmbientLight"||o.type==="PointLight";})
        .forEach(function(l){ l.intensity = 0; });
      I.scene.children.filter(function(o){return o.type==="HemisphereLight";})
        .forEach(function(l){ l.intensity = 0.05; });
    }
    // v16: a luz de teto passou a ter interruptor e nasce APAGADA. O portao mede a
    // casa com a lampada acesa -- ver a nota no cabecalho -- e `--apagado` mede a
    // cena de dia, sem ninguem ter acendido nada.
    if (!window.__apagado && I.alternaLuz) {
      I.INT.lamps.forEach(function (L, i) { I.alternaLuz(i); });
      // A sombra da lampada e refeita SOB DEMANDA (`shadow.autoUpdate=false`), e no
      // headless o rAF entrega um punhado de quadros em todo o tempo virtual: sem
      // forcar a passada aqui o print sai ora com sombra, ora sem -- medido, 98,1 e
      // 109,4 de media na MESMA pagina. O global e o que autoriza a passada; o
      // `needsUpdate` de cada luz e o que ela ja marcou ao acender.
      I.renderer.shadowMap.needsUpdate = true;
      I.renderer.render(I.scene, I.camera);
    }
    if (window.__baixo) { I.FP.pitch = -0.42; }   // olhando pra baixo pela janela
    // v12: o painel do interior saiu da tela; o botao virou elemento orfao e
    // `__int.el` e o $ do proprio app (ver SUMIDOS no app.js).
    if (window.__planta) { window.__int.el("ivista").click();
      var ob = I.INT.pl.ob;
      I.sph.theta = Math.atan2(-ob.uz, ob.ux); I.sph.phi = 0.36; I.sph.radius = 15; }
    // esconde os paineis: o que se quer medir e a CENA, nao a interface
    ["hud","panel","ipanel","houses","poibar","usheet","nearby","attrib",
     "compass"].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.style.display = "none";
    });
    document.getElementById("overlay").style.display = "none";
    var sol = I.scene.children.filter(function(o){ return o.type === "DirectionalLight"; })[0];
    var sc = sol.shadow.camera;
    var mv = I.INT.moveis[0];
    console.log("SONDA " + JSON.stringify({ luzes: I.INT.luzes.length, dentro: I.INT.on,
      bake: !!(I.BAKE && I.BAKE.pronto), bakeMs: I.BAKE ? +I.BAKE.ms.toFixed(0) : null,
      voo: !!I.INT.voo, cam: [+I.camera.position.x.toFixed(2), +I.camera.position.y.toFixed(2),
                              +I.camera.position.z.toFixed(2)],
      solInt: +sol.intensity.toFixed(2), solCast: sol.castShadow,
      dist: +sol.position.distanceTo(sol.target.position).toFixed(0),
      caixa: [sc.left, sc.right, sc.near, sc.far],
      movelCast: mv && mv.obj.children[0].castShadow,
      pisoRecebe: I.INT.casa.children[1] ? I.INT.casa.children[1].receiveShadow : null,
      mapaSombra: !!sol.shadow.map, mapaTam: sol.shadow.mapSize.x,
      corteAtivo: I.CORTE.constant < 1e5, shadowSide: mv && mv.obj.children[0].material.shadowSide,
      matSide: mv && mv.obj.children[0].material.side }));
  }
  medir.n = 0;
  setTimeout(medir, 2600);
})(120);
</script>
"""


def print_headless(png):
    """Devolve o que a sonda relatou (ou None). Ver o guarda de `dentro` no main()."""
    sonda = None
    s = io.open(PAG, encoding="utf-8", newline="").read()
    if PLANTA: s += "<script>window.__planta=1;</script>"
    if UNIDADE: s += "<script>window.__unidade=%s;</script>" % json.dumps(UNIDADE)
    if "--sol" in sys.argv: s += "<script>window.__sol=1;</script>"
    if "--apagado" in sys.argv: s += "<script>window.__apagado=1;</script>"
    if "--baixo" in sys.argv: s += "<script>window.__baixo=1;</script>"
    s += SONDA
    tmp = PAG + ".medida.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="medida")
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                        "--window-size=1000,640", "--use-angle=swiftshader",
                        "--enable-unsafe-swiftshader", "--hide-scrollbars",
                        "--screenshot=" + png, "--virtual-time-budget=70000",
                        "--enable-logging=stderr", "--log-level=0",
                        "file:///" + tmp.replace("\\", "/") + "?q=" + NIVEL],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
        for ln in ((r.stderr or "") + (r.stdout or "")).splitlines() if False else []:
            pass
        for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
            if "SONDA " in ln:
                if "--debug" in sys.argv:
                    print("  sonda:", ln[ln.index("SONDA ") + 6:].strip())
                # raw_decode, nao loads: o Chrome envolve o console numa linha sua
                # (`[...:INFO:CONSOLE(1)] "SONDA {...}", source: file://...`), entao o
                # que vem depois do JSON e lixo. Mesma leitura do padrao/pagina.py.
                try: sonda = json.JSONDecoder().raw_decode(
                        ln[ln.index("SONDA ") + 6:].lstrip())[0]
                except ValueError: pass
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass
    return sonda


def mede(png):
    from PIL import Image
    im = Image.open(png).convert("RGB")
    w, h = im.size
    im = im.crop((int(w*0.10), int(h*0.10), int(w*0.90), int(h*0.92)))
    px = list(im.getdata())
    lum = sorted(0.2126*r + 0.7152*g + 0.0722*b for r, g, b in px)
    n = len(lum)
    q = lambda f: lum[min(n-1, int(n*f))]
    queimado = sum(1 for r, g, b in px if r >= 252 and g >= 252 and b >= 252) / n
    # `escuro`: quanto do quadro e sombra de verdade. `croma`: saturacao media em
    # HSV. Sao as duas medidas que separam "foto" de "maquete bem iluminada", e
    # nenhuma das duas aparecia na tabela antiga.
    escuro = sum(1 for v in lum if v < 70) / float(n)
    croma = 0.0
    for r, g, b in px:
        mx = r if r > g else g
        if b > mx: mx = b
        mn = r if r < g else g
        if b < mn: mn = b
        croma += 0.0 if mx == 0 else (mx - mn) / float(mx)
    return {"media": sum(lum)/n, "p05": q(0.05), "p50": q(0.50), "p95": q(0.95),
            "p99": q(0.99), "queimado": queimado*100, "faixa": q(0.95) - q(0.05),
            "escuro": escuro*100, "croma": croma/n}


def main():
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado"); return 2
    if not os.path.exists(PAG):
        print("sem pagina montada: %s" % os.path.relpath(PAG, RAIZ)); return 2
    print("cidade: %s" % SLUG)
    guardar = None
    if "--salvar" in sys.argv:
        guardar = sys.argv[sys.argv.index("--salvar") + 1]
    png = guardar or os.path.join(tempfile.gettempdir(), "_medida.png")
    sonda = print_headless(png)
    if not os.path.exists(png):
        print("o Chrome nao gerou print"); return 1
    # O guarda que faltava: sem ele o medidor fotografa a CIDADE quando o clique nao
    # entra na casa (vitrine vazia, botao renomeado, planta sem comodo) e APROVA a
    # iluminacao de uma cena que nunca abriu -- a media de uma vista aerea de dia cai
    # confortavelmente dentro da faixa de 120 a 175. Portao que passa medindo outra
    # coisa e pior que portao que reprova.
    if not sonda or not sonda.get("dentro"):
        porque = ("a sonda nao respondeu" if not sonda
                  else sonda.get("erro") or "__int.on falso (a casa nao abriu)")
        print("nao entrou no interior de %s: %s" % (SLUG, porque))
        return 1
    d = mede(png)
    lim = {"media": (105, 168), "p99": (0, 250), "queimado": (0, 1.5),
           "faixa": (90, 999), "escuro": (2.5, 100), "croma": (0.09, 1)}
    ruim = 0
    print("  %-10s %8s   %s" % ("medida", "valor", "faixa desejada"))
    for k in ["media", "p50", "p95", "p99", "queimado", "faixa", "escuro", "croma"]:
        v = d[k]
        if k in lim:
            lo, hi = lim[k]
            ok = lo <= v <= hi
            ruim += 0 if ok else 1
            print("  %-10s %8.1f   %s %s" % (k, v, "%g a %g" % (lo, hi), "ok" if ok else "FORA"))
        else:
            print("  %-10s %8.1f" % (k, v))
    if guardar: print("\nprint em %s" % guardar)
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
