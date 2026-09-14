# -*- coding: utf-8 -*-
"""O terreno de fundo tapa TODO buraco e nao espeta por cima do chao detalhado?

O chao do quarteirao e a malha de rua so existem onde ha quadra, e a quadra vem da face
do grafo de ruas. Varzea, chacara e area militar nao tem rua dentro: nao viram face, nao
ganham chao, e o que restava era buraco -- de um apartamento a 155 m de cota via-se o
ceu POR BAIXO do bairro, e a barriga do pedaco de cidade que o relevo levantou do outro
lado do vale. O v12 poe uma superficie continua embaixo de tudo, tirada da mesma grade
de elevacao que ja esta na pagina.

Isso tem duas maneiras silenciosas de dar errado, e nenhuma delas aparece num teste de
"abriu?":

  1. BURACO QUE SOBROU. Sem cobertura em algum ponto, o ceu volta a aparecer por baixo.
  2. FUNDO ESPETADO. O fundo e a grade de 240 m subdividida; dois triangulos por celula
     nao reproduzem a bilinear que o `terrainY` devolve, e o erro (o termo de torcao)
     vai de 1,5 m a 5,8 m dependendo da cidade. Se o rebaixo for menor que o erro, o
     fundo fura o chao detalhado NO MEIO de um quarteirao -- mancha verde em cima do
     asfalto. Um rebaixo fixo calibrado numa cidade so reprova nas outras, e por isso
     ele e medido da grade no boot.

A sonda amostra uma malha de pontos sobre a cidade e, em cada um, deixa cair um raio de
2 km de altura: uma vez contra o fundo, uma vez contra o chao/rua detalhados. Cobertura
tem que ser 100%, e onde os dois existem o fundo tem que estar ABAIXO.

    python pipeline/testa_terreno_base.py                  # todas as cidades
    python pipeline/testa_terreno_base.py ribeirao-preto
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO

from padrao.cidade import lista
# A lista de cidades tem um dono: padrao/cidades/. Escrita a mao aqui, a
# SEXTA cidade nascia invisivel pra esta sonda -- passava por nao ter sido
# olhada, que e o modo de falhar mais caro que existe num portao.
CIDADES = lista()
PASSO = 48          # 48x48 = 2304 pontos por cidade
ALCANCE = 7000.0    # metade do lado da malha amostrada, em metros

SONDA = """
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('TERRENO {"erro":"nao subiu"}'); return;
  }
  // o fundo so vale o que vale COM relevo: sem ele todo mundo e plano e o teste passa
  // de graca. O botao le a grade que ja esta embutida na pagina, sem rede.
  var br = document.getElementById("tRelief"); if (br) br.click();
  setTimeout(function () {
    var I = window.__int, TH = window.THREE, sc = I.scene;
    var fundo = window.__gTerreno;
    if (!fundo) { console.log('TERRENO {"erro":"sem __gTerreno"}'); return; }
    var detalhe = sc.children.filter(function (o) {
      return o.userData && o.userData.ground && o !== fundo && o.isMesh && !o.userData.muros;
    });
    var rc = new TH.Raycaster(); rc.far = 1e5;
    var baixo = new TH.Vector3(0, -1, 0), o = new TH.Vector3();
    var P = %(passo)d, A = %(alcance)s;
    var semNada = 0, espetou = 0, folgaMin = 1e9, total = 0, comDetalhe = 0;
    var pior = null, ruins = [];
    // 15 cm de tolerancia. Nao e complacencia: o fundo nasce com o Y calculado NO no da
    // grade e o raio cai num ponto qualquer, entao as duas superficies se cruzam por
    // fracao de centimetro em algumas amostras. Abaixo disso nao ha o que ver na tela;
    // o que este teste procura e mancha de metros.
    var TOL = -0.15;
    for (var i = 0; i < P; i++) for (var j = 0; j < P; j++) {
      var x = -A + 2*A*i/(P-1), z = -A + 2*A*j/(P-1);
      total++;
      o.set(x, 2000, z);
      rc.set(o, baixo);
      var hf = rc.intersectObject(fundo, false);
      var hd = rc.intersectObjects(detalhe, false);
      if (!hf.length && !hd.length) { semNada++; continue; }
      if (!hf.length || !hd.length) continue;
      comDetalhe++;
      // o detalhe mais BAIXO e o que o fundo tem que respeitar: se o fundo passar
      // dele, aparece por cima em algum lugar daquele ponto.
      var yd = hd[hd.length-1].point.y;
      var folga = yd - hf[0].point.y;
      if (folga < folgaMin) { folgaMin = folga; pior = [Math.round(x), Math.round(z)]; }
      if (folga < TOL) { espetou++; ruins.push([Math.round(x), Math.round(z), +folga.toFixed(1)]); }
    }
    console.log("TERRENO " + JSON.stringify({
      tris: fundo.geometry.index.count/3,
      folga: +fundo.userData.folga.toFixed(2),
      desceMax: +fundo.userData.desceMax.toFixed(2),
      pontos: total, comDetalhe: comDetalhe,
      semNada: semNada, espetou: espetou,
      folgaMin: +folgaMin.toFixed(2), pior: pior,
      ruins: ruins.sort(function(a,b){return a[2]-b[2];}).slice(0,12),
      chamadas: I.renderer.info.render.calls
    }));
  }, 3500);
})(140);
</script>
""" % {"passo": PASSO, "alcance": ALCANCE}


def roda(cidade):
    pag = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (cidade, VERSAO))
    if not os.path.exists(pag):
        return cidade, {"erro": "sem pagina"}
    s = io.open(pag, encoding="utf-8", newline="").read() + SONDA
    tmp = pag + ".terreno.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="terreno")
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=1000,640", "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader", "--hide-scrollbars",
                            "--virtual-time-budget=120000", "--enable-logging=stderr",
                            "--log-level=0", "--screenshot=" + os.path.join(ud, "x.png"),
                            "file:///" + tmp.replace("\\", "/") + "?q=alto"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        txt = (r.stderr or "") + (r.stdout or "")
        achado = None
        for ln in txt.splitlines():
            i = ln.find("TERRENO {")
            if i < 0:
                continue
            bruto = ln[i + 8:].strip()
            j = bruto.rfind("}")
            if j < 0:
                continue
            try:
                d = json.loads(bruto[:j + 1])
            except ValueError:
                continue
            if "tris" in d or achado is None:
                achado = d
        return cidade, achado or {"erro": "sem sonda"}
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass


def main():
    alvo = [a for a in sys.argv[1:] if not a.startswith("-")] or CIDADES
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado"); return 2
    ruim = 0
    print("  %-24s %7s %6s %8s %7s %7s %9s" % ("cidade", "tris", "folga", "mergulho", "buraco", "espeta", "folga min"))
    for c in alvo:
        _, d = roda(c)
        if "erro" in d:
            print("  %-24s %s" % (c, d["erro"])); ruim += 1; continue
        # mergulho e informativo, nao criterio: o fundo desce debaixo da quadra que
        # afundou, e uma quadra grande atravessando um morro afunda dezenas de metros de
        # verdade. So o absurdo reprova -- a cidade inteira tem ~1.100 m de desnivel
        # depois do exagero, entao mergulho de centenas de metros e conta errada, nao
        # quadra torta. Foi assim que a extrapolacao de plano (4.389 m) foi pega.
        ok = d["semNada"] == 0 and d["espetou"] == 0 and d["desceMax"] < 300
        ruim += 0 if ok else 1
        print("  %-24s %7d %6.2f %8.2f %7d %7d %9.2f  %s"
              % (c, d["tris"], d["folga"], d["desceMax"], d["semNada"], d["espetou"], d["folgaMin"],
                 "ok" if ok else "FORA"))
        if d.get("ruins"):
            print("        piores: " + ", ".join("(%d,%d) %.1f" % tuple(r) for r in d["ruins"]))
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
