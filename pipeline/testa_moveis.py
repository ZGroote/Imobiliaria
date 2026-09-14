# -*- coding: utf-8 -*-
"""Portao do MODO MOVEIS (v16-moveis): grade, gizmo de setas, fantasma.

    python pipeline/testa_moveis.py sao-carlos
    python pipeline/testa_moveis.py sao-carlos --unidade sanca-135-29 --foto m.png

Sete sondas. Todas medem coisa que **falha calada** -- nenhuma delas produz erro no
console quando quebra:

  1. fora do modo, clicar num movel nao seleciona (a visita e uma visita);
  2. ligar o modo poe a grade, e ela gira com a PLANTA, nao com o norte;
  3. escolher + Modificar mostra as 5 setas e os 3 campos de medida;
  4. puxar a seta "+" ancora a face oposta -- nas QUATRO rotacoes. Este e o item
     caro: o eixo local do movel nao se deduz do `rot` por tabela de sinais, e um
     sinal trocado faz o armario crescer pro lado contrario do gesto, em silencio;
  5. a seta "-" ancora a face "+", pelo mesmo motivo e com o sinal oposto;
  6. altura cresce pra cima com a base parada no chao;
  7. mover + Esc devolve o movel de onde ele saiu, e um destino fora da planta
     acende o contorno vermelho (MOB.cabe).
"""
import io, json, os, shutil, subprocess, sys, tempfile

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


SLUG = ([a for a in sys.argv[1:] if not a.startswith("-")] or ["sao-carlos"])[0]
UNIDADE = arg("--unidade", "")
FOTO = arg("--foto", "")
PAG = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (SLUG, VERSAO))

SONDA = r"""
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length ||
      !document.querySelector("#houses .hitem[data-unidade]")) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('MOB {"erro":"nao subiu"}'); return;
  }
  var I = window.__int, alvo = "%(UNI)s", R = {}, falhas = [];
  var itens = [].slice.call(document.querySelectorAll("#houses .hitem[data-unidade]"));
  var it = itens[0];
  if (alvo) for (var k = 0; k < itens.length; k++)
    if ((itens[k].dataset.unidade || "").indexOf(alvo) >= 0) { it = itens[k]; break; }
  it.click();
  var bt = document.getElementById("uEnter");
  if (!bt) { console.log('MOB {"erro":"sem botao Entrar"}'); return; }
  bt.click();
  (function pronto(m) {
    if ((!I.INT.pl || !I.INT.casa) && m > 0) return setTimeout(function(){pronto(m-1);}, 200);
    var pl = I.INT.pl;
    if (!pl) { console.log('MOB {"erro":"nao entrou"}'); return; }
    I.INT.voo = null;                       // o voo de entrada nao interessa aqui
    var reprova = function (nome, cond, det) { if (!cond) falhas.push(nome + (det ? " " + det : "")); };
    var r2 = function (v) { return Math.round(v * 1000) / 1000; };

    R.unidade = pl.id;
    R.moveis = I.INT.moveis.length;
    if (!R.moveis) { console.log('MOB {"erro":"unidade sem movel pra editar"}'); return; }

    /* Vista de planta antes de tudo: e dela que sai o clique sintetico das
       sondas 1 e 3, e sem um quadro completo a matriz da camera ainda e a do voo
       de entrada -- a projecao cairia em qualquer lugar da tela. */
    // Pelo BOTAO, e nao mexendo em `INT.orbita` na mao. A diferenca nao e estilo:
    // `vista(true)` e quem baixa o plano de corte pra altura do ombro. Sem ela o
    // forro continua inteiro, o raio do clique bate no TETO antes do movel, e a
    // sonda reprova um clique que na tela funciona -- foi o que aconteceu aqui.
    document.getElementById("ivista").click();
    for (var f = 0; f < 40; f++) window.__perf.passo(1000 + f * 120);

    // Onde, na TELA, esta o movel de indice i. E o que permite dizer "clicou nele"
    // em vez de "chamei a funcao de selecionar", que e o teste que passa sozinho.
    var naTela = function (i) {
      var mv = I.INT.moveis[i], p = I.INT.pl.W(mv.u, mv.v);
      var v = new THREE.Vector3(p[0], I.INT.baseY + Math.min(0.5, mv.h*0.4), p[1]);
      v.project(I.camera);
      return { clientX: (v.x*0.5+0.5)*innerWidth, clientY: (-v.y*0.5+0.5)*innerHeight,
               button: 0 };
    };

    /* 1. fora do modo, CLICAR num movel nao seleciona --------------------- */
    I.modoMoveis(false);
    I.seleciona(-1);
    I.cliqueInterior(naTela(0));
    R.selForaDoModo = I.INT.sel;
    reprova("clique fora do modo selecionou", I.INT.sel === -1, "sel " + I.INT.sel);
    R.painelForaDoModo = document.getElementById("ipanel").classList.contains("on");
    reprova("painel aberto fora do modo", !R.painelForaDoModo);
    reprova("grade existe fora do modo", !I.MOB.grade);

    /* 2. a grade gira com a planta --------------------------------------- */
    I.modoMoveis(true);
    R.temGrade = !!I.MOB.grade;
    reprova("modo ligado nao criou grade", R.temGrade);
    if (I.MOB.grade) {
      var esperado = Math.atan2(-pl.ob.uz, pl.ob.ux);
      R.grade = { rot: r2(I.MOB.grade.rotation.y), esperado: r2(esperado),
                  y: r2(I.MOB.grade.position.y) };
      reprova("grade desalinhada da planta",
              Math.abs(I.MOB.grade.rotation.y - esperado) < 1e-6, JSON.stringify(R.grade));
      // O piso da casa esta em y = 0,02 e o movel em 0,03. A grade tem que ficar
      // ENTRE os dois: fora dessa fresta ela some ou flutua, e nos dois casos sem
      // erro no console -- so uma foto denuncia.
      reprova("grade fora da fresta entre piso (0,02) e movel (0,03)",
              I.MOB.grade.position.y > 0.022 && I.MOB.grade.position.y < 0.03,
              "y " + I.MOB.grade.position.y);
    }
    // "A grade esta na cena" e "a grade foi DESENHADA" sao perguntas diferentes, e
    // a segunda e a que interessa: um material transparente sobre um plano de corte
    // some sem tirar o objeto da arvore. A contagem de chamadas responde.
    I.modoMoveis(false); window.__perf.passo(400);
    var dc0 = window.__perf.renderer.info.render.calls;
    I.modoMoveis(true); window.__perf.passo(520);
    R.draw = { semGrade: dc0, comGrade: window.__perf.renderer.info.render.calls };
    R.gradeLinhas = I.MOB.grade ? I.MOB.grade.geometry.attributes.position.count / 2 : 0;
    R.gradeLado = I.MOB.grade ? r2(I.MOB.grade.geometry.boundingSphere
                                   ? I.MOB.grade.geometry.boundingSphere.radius : -1) : 0;
    reprova("a grade nao foi desenhada",
            R.draw.comGrade === R.draw.semGrade + 1,
            JSON.stringify(R.draw));
    // Desenhada nao e o mesmo que visivel: com o ACES e a exposicao de 0,58 do
    // interior ela chegava no chao empatada com o piso. Ver a nota em `fazGrade`.
    R.gradeToneMapped = I.MOB.grade ? I.MOB.grade.material.toneMapped : null;
    reprova("grade voltou a passar pelo tone mapping (some no chao)",
            R.gradeToneMapped === false);
    R.painelNoModo = document.getElementById("ipanel").classList.contains("on");
    reprova("modo ligado nao abriu painel", R.painelNoModo);

    /* 3. dentro do modo o MESMO clique escolhe, e o gizmo aparece --------- */
    I.seleciona(-1);
    I.cliqueInterior(naTela(0));
    R.selNoModo = I.INT.sel;
    var alvo0 = naTela(0);
    R.clique = { x: Math.round(alvo0.clientX), y: Math.round(alvo0.clientY),
                 tela: [innerWidth, innerHeight],
                 cam: [+I.camera.position.x.toFixed(1), +I.camera.position.y.toFixed(1),
                       +I.camera.position.z.toFixed(1)],
                 orbita: I.INT.orbita, fp: I.INT.fp, voo: !!I.INT.voo,
                 corte: I.CORTE ? +I.CORTE.constant.toFixed(1) : null };
    reprova("clique no modo nao selecionou", I.INT.sel >= 0, "sel " + I.INT.sel);
    I.seleciona(0);
    I.modo("medir");
    R.setasVisiveis = I.mobSetas.visible;
    R.setas = I.mobSetas.children.length;
    reprova("gizmo nao apareceu", R.setasVisiveis && R.setas === 5);
    R.campos = document.querySelectorAll(".med").length;
    reprova("faltam campos de medida", R.campos === 3, "tem " + R.campos);

    /* 4-5. a seta cresce pro lado certo, nas quatro rotacoes -------------- */
    /* A face que NAO se puxa tem que ficar parada. Medida em (u,v) da planta: o
       centro do movel mais meia largura na direcao do eixo local. */
    var m = I.INT.moveis[0];
    var face = function (mv, s) {
      var d = I.dirUV(mv, s, 0);
      return [mv.u + d[0]*mv.w/2, mv.v + d[1]*mv.w/2];
    };
    R.ancora = [];
    for (var rot = 0; rot < 4; rot++) {
      // `dirUV` le a rotacao do OBJETO, nao o campo `rot`. Sem remontar aqui, a
      // medida de ANTES sai no referencial velho e a de DEPOIS no novo -- e a
      // sonda acusa um defeito que nao existe (foi o que ela fez na primeira volta).
      m.rot = rot; I.atualizaMovel(m); I.seleciona(0);
      for (var si = 0; si < 2; si++) {
        var sinal = si ? -1 : 1;
        var w0 = m.w, oposta0 = face(m, -sinal), puxada0 = face(m, sinal);
        I.redimensiona(m, "w", w0 + 0.40, sinal);
        var oposta1 = face(m, -sinal), puxada1 = face(m, sinal);
        var parada = Math.hypot(oposta1[0]-oposta0[0], oposta1[1]-oposta0[1]);
        var andou  = Math.hypot(puxada1[0]-puxada0[0], puxada1[1]-puxada0[1]);
        R.ancora.push({ rot: rot, s: sinal, opostaAndou: r2(parada), puxadaAndou: r2(andou) });
        reprova("face oposta andou (rot " + rot + ", s " + sinal + ")",
                parada < 0.005, "andou " + r2(parada) + " m");
        reprova("face puxada nao andou 0,40 (rot " + rot + ", s " + sinal + ")",
                Math.abs(andou - 0.40) < 0.005, "andou " + r2(andou) + " m");
        I.redimensiona(m, "w", w0, sinal);   // devolve pra proxima volta
      }
    }
    m.rot = 0; I.atualizaMovel(m); I.seleciona(0);

    /* 6. altura cresce pra cima ------------------------------------------- */
    var h0 = m.h, y0 = m.obj.position.y;
    I.redimensiona(m, "h", h0 + 0.30, 1);
    R.altura = { de: r2(h0), para: r2(m.h), baseAntes: r2(y0), baseDepois: r2(m.obj.position.y) };
    reprova("altura nao cresceu", Math.abs(m.h - (h0 + 0.30)) < 1e-6);
    reprova("a base do movel saiu do chao", Math.abs(m.obj.position.y - y0) < 1e-6);
    I.redimensiona(m, "h", h0, 1);

    /* 7. mover: fantasma, vermelho e o Esc que devolve --------------------- */
    var u0 = m.u, v0 = m.v;
    I.modo("mover");
    R.fantasma = !!I.MOB.fantasma;
    reprova("mover nao deixou fantasma", R.fantasma);
    R.cabeNoLugar = I.cabeAqui(m, u0, v0);
    reprova("o movel nao cabe onde ele JA esta", R.cabeNoLugar);
    R.cabeLaFora = I.cabeAqui(m, u0 + 400, v0);
    reprova("fora da planta deu como cabendo", !R.cabeLaFora);
    m.u = u0 + 0.6; m.v = v0 + 0.6;          // "arrasta" e desiste
    I.cancelaGesto();
    R.voltou = { du: r2(m.u - u0), dv: r2(m.v - v0) };
    reprova("Esc nao devolveu o movel",
            Math.abs(m.u-u0) < 1e-9 && Math.abs(m.v-v0) < 1e-9, JSON.stringify(R.voltou));
    reprova("fantasma ficou na cena", !I.MOB.fantasma);

    /* desligar limpa tudo -------------------------------------------------- */
    I.modoMoveis(false);
    reprova("grade sobrou depois de desligar", !I.MOB.grade);
    reprova("setas sobraram depois de desligar", !I.mobSetas.visible);

    /* Quadro final so pra foto: primeira pessoa, a 2,4 m do movel MAIOR, com o
       modo ligado e o gizmo aceso. Enquadrar de cima poe a laje entre a camera e
       a cena; enquadrar de longe mostra o quarteirao. */
    document.getElementById("ivista").click();     // volta pra primeira pessoa
    var maior = 0;
    for (var q = 1; q < I.INT.moveis.length; q++)
      if (I.INT.moveis[q].w * I.INT.moveis[q].h > I.INT.moveis[maior].w * I.INT.moveis[maior].h)
        maior = q;
    I.modoMoveis(true); I.seleciona(maior); I.modo("medir");
    var mm = I.INT.moveis[maior], pm = pl.W(mm.u, mm.v);
    // Recua na direcao da FRENTE do movel (+Z local) ate achar chao livre: dentro
    // de um quarto de 3 m, 2,4 m atras da cama e do lado de fora da parede.
    var fr = new THREE.Vector3(0, 0, 1).applyEuler(
               new THREE.Euler(0, mm.obj.rotation.y, 0));
    var Rq = 2.4;
    while (Rq > 0.5 && !I.livre(pm[0] + fr.x*Rq, pm[1] + fr.z*Rq)) Rq -= 0.2;
    I.INT.voo = null; I.INT.fp = true; I.INT.orbita = false;
    I.FP.pos.set(pm[0] + fr.x*Rq, I.INT.baseY, pm[1] + fr.z*Rq);
    I.FP.yaw = Math.atan2(fr.x, fr.z);   // olha de volta pro movel
    I.FP.pitch = -0.42;   // olhando pro chao: e onde a grade esta
    R.foto = { movel: mm.tipo, recuo: r2(Rq) };
    for (var f2 = 0; f2 < 12; f2++) window.__perf.passo(6000 + f2 * 120);

    setTimeout(function () {
      R.falhas = falhas;
      R.ok = falhas.length === 0;
      console.log("MOB " + JSON.stringify(R));
    }, 700);
  })(80);
})(400);
</script>
""" % {"UNI": UNIDADE}


def main():
    if not os.path.exists(PAG):
        print("falta %s" % PAG)
        return 1
    s = io.open(PAG, encoding="utf-8", newline="").read() + SONDA
    tmp = PAG + ".mob.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="mob")
    cmd = [CHROME, "--headless=new", "--user-data-dir=" + ud,
           "--window-size=1280,760", "--use-angle=swiftshader",
           "--enable-unsafe-swiftshader", "--hide-scrollbars",
           "--virtual-time-budget=70000", "--enable-logging=stderr", "--log-level=0"]
    if FOTO:
        cmd.append("--screenshot=" + os.path.abspath(FOTO))
    cmd.append("file:///" + tmp.replace("\\", "/") + "?q=alto")
    bruto = ""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=400)
        bruto = (r.stderr or "") + (r.stdout or "")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try:
            os.remove(tmp)
        except OSError:
            pass
    for ln in bruto.splitlines():
        if "MOB " in ln:
            try:
                d = json.JSONDecoder().raw_decode(ln[ln.index("MOB ") + 4:].lstrip())[0]
            except ValueError:
                continue
            print(json.dumps(d, ensure_ascii=False, indent=1))
            if d.get("ok"):
                print("PASSOU")
                return 0
            print("REPROVOU: %s" % (d.get("erro") or "; ".join(d.get("falhas", []))))
            return 1
    print("(sem MOB)")
    print(bruto[-1200:])
    return 1


if __name__ == "__main__":
    sys.exit(main())
