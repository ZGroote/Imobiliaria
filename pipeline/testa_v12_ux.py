# -*- coding: utf-8 -*-
"""Os quatro recursos do v12 respondem, ou so PARECEM estar la?

Busca, link de posicao, minimapa e modo noite sao os primeiros recursos do mapa que nao
aparecem numa foto: um print nao distingue "o botao Noite funciona" de "o botao Noite
existe". E o modo dos quatro falharem e silencioso -- indice vazio, `replaceState`
recusado pela origem opaca do `file://`, canvas do minimapa em branco, transicao de
noite presa em t=0. Nenhum deles quebra a pagina; todos deixam o recurso morto.

O que cada portao mede:

  BUSCA     o indice tem via, lugar e edificacao, e uma consulta tirada do PROPRIO
            indice volta com o item certo em primeiro lugar. Consultar por uma palavra
            fixa ("centro") reprovaria em cidade que nao tem rua com esse nome; a
            consulta sai do dado da cidade que esta sendo testada.
  LINK      abrir com `?em=lat,lon&r&p&t` poe o alvo no lugar pedido (tolerancia de
            5 m, que e o arredondamento das 5 casas decimais) e a URL volta a ser
            escrita sozinha depois de um segundo.
  NOITE     um clique leva a exposicao de 1,18 pra <= 0,45 e o outro devolve os 1,18.
            A sonda espera ATE ASSENTAR (teto de 10 s), e nao um tempo fixo: a transicao
            anda pelo relogio mas so avanca quando ha quadro, e no rasterizador de
            software Ribeirao desenha ~1 quadro por segundo.
  MINIMAPA  o canvas tem entre 2% e 45% de pixel claro. Zero por cento e canvas em
            branco; acima disso e a mancha cinza que a versao por bitmap produzia.

    python pipeline/testa_v12_ux.py                  # todas as cidades
    python pipeline/testa_v12_ux.py sao-carlos
"""
import io, json, os, shutil, subprocess, sys, tempfile

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.build.config import resolve
VERSAO = resolve().versao   # sem flag propria: MAPA_V ou o padrao; o v15 reprova aqui
from pipeline.foto import servidor_de_espera

from padrao.cidade import lista
# A lista de cidades tem um dono: padrao/cidades/. Escrita a mao aqui, a
# SEXTA cidade nascia invisivel pra esta sonda -- passava por nao ter sido
# olhada, que e o modo de falhar mais caro que existe num portao.
CIDADES = lista()

SONDA = """
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length || !window.__int.BUSCA) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('UX {"erro":"a cidade nao subiu"}'); return;
  }
  var I = window.__int, P = window.__perf, out = {};
  // O contador NAO e enfeite: sem ele a segunda espera com o mesmo tempo vem do
  // cache do navegador e volta na hora -- foi assim que o portao "noite: volta"
  // reprovou medindo a exposicao antes de a transicao andar.
  var _esp = 0;
  function espera(ms) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = im.onerror = ok;
      im.src = "http://127.0.0.1:%(porta)d/espera?ms=" + ms + "&n=" + (++_esp);
    });
  }
  (async function () {
    // ---- busca -------------------------------------------------------------
    var tipos = {};
    for (var i = 0; i < I.BUSCA.length; i++) tipos[I.BUSCA[i].k] = (tipos[I.BUSCA[i].k] || 0) + 1;
    out.itens = I.BUSCA.length; out.tipos = tipos;
    // A consulta sai do proprio indice: nome de rua nao se repete entre cidades.
    var alvo = I.BUSCA.filter(function (x) { return x.k === "rua" && x.n.length > 9; })[0];
    out.consulta = alvo ? alvo.n : null;
    if (alvo) {
      var q = document.getElementById("bq");
      q.value = alvo.n; q.dispatchEvent(new Event("input"));
      var lin = [].slice.call(document.querySelectorAll("#bres .bi"));
      out.achou = lin.length;
      out.primeiro = lin.length ? lin[0].querySelector(".t").textContent : null;
      out.certo = out.primeiro === alvo.n;
      q.value = ""; q.dispatchEvent(new Event("input"));
    }

    // ---- link --------------------------------------------------------------
    // O alvo pedido pela URL foi aplicado no loadCity (ver lerLink).
    out.alvo = [Math.round(I.target.x * 10) / 10, Math.round(I.target.z * 10) / 10];
    out.raio = Math.round(I.sph.radius);
    await espera(1600);
    out.url = location.search.indexOf("em=") >= 0;

    // ---- noite -------------------------------------------------------------
    // A transicao anda pelo relogio, mas so avanca QUANDO HA QUADRO -- e no
    // rasterizador de software Ribeirao desenha ~1 quadro por segundo. Esperar um
    // tempo fixo transformaria a velocidade da maquina em portao (foi o que aconteceu:
    // 3 s bastavam em Sao Carlos e paravam em 0,85 de volta em Ribeirao). Entao a
    // sonda espera ATE ASSENTAR, com teto: o que se afere e "chega ao fim", nao "chega
    // em N segundos".
    // A transicao anda por RELOGIO (`performance.now()`), e em Chrome headless o rAF
    // para depois dos primeiros quadros (ver a nota do `__perf.passo`) -- entao esperar
    // tempo de parede nao faz a noite andar: ela ficava em t=0,38 e a exposicao em
    // 0,818, e este portao reprovava havia meses uma noite que funciona. Com o relogio
    // real e rAF vivo, medido nesta pagina: t=1 e exposicao 0,40, em 3 quadros.
    // `__perf.passo(t)` roda um quadro COMPLETO fora do rAF com o carimbo que a gente
    // escolhe. Passando 400 ms (o teto do dt da transicao) por chamada, a transicao de
    // 700 ms fecha em 2 quadros -- sem depender da velocidade da maquina, que e
    // exatamente o que o comentario original dizia querer evitar.
    var _t = performance.now();
    function ateAssentar(alvo) {
      for (var k = 0; k < 12 && Math.abs(I.NOITE.t - alvo) > 0.001; k++) { _t += 400; P.passo(_t); }
      return +I.NOITE.t.toFixed(2);
    }
    // v12: o botao Noite saiu do painel a pedido; o modo continua, por `?noite=1` e
    // pela porta do QA. Chamar `setNoite` e o mesmo caminho que o botao chamava.
    var dia = I.renderer.toneMappingExposure;
    I.setNoite(true);
    out.t = ateAssentar(1);
    out.expDia = +dia.toFixed(3);
    out.expNoite = +I.renderer.toneMappingExposure.toFixed(3);
    I.setNoite(false);
    out.tVolta = ateAssentar(0);
    out.expVolta = +I.renderer.toneMappingExposure.toFixed(3);

    // ---- minimapa ----------------------------------------------------------
    var cv = document.getElementById("mmc");
    var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    var claro = 0, total = cv.width * cv.height;
    for (var p = 0; p < d.length; p += 4)
      if (d[p] + d[p+1] + d[p+2] > 300) claro++;
    out.mmClaro = +(100 * claro / total).toFixed(1);
    console.log("UX " + JSON.stringify(out));
  })();
})(160);
</script>
"""

# O ponto pedido pela URL, em metros do centro de cada cidade, e o que o portao do link
# confere. Fica a 900 m do centro: perto o bastante pra ter quarteirao montado.
DESLOC = 900.0


def roda(cidade):
    pag = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (cidade, VERSAO))
    if not os.path.exists(pag):
        print("  %-22s pagina nao montada (%s)" % (cidade, os.path.relpath(pag, RAIZ)))
        return None
    cid = json.load(io.open(os.path.join(RAIZ, "padrao", "cidades", cidade + ".json"),
                            encoding="utf-8"))
    import math
    c = cid["centro"]
    mlon = 111319.49 * math.cos(c["lat"] * math.pi / 180)
    lat = c["lat"] - DESLOC / 111132.92          # z = +DESLOC
    lon = c["lon"] + DESLOC / mlon               # x = +DESLOC

    srv, porta = servidor_de_espera()
    s = io.open(pag, encoding="utf-8", newline="").read() + (SONDA % {"porta": porta})
    tmp = pag + ".ux.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="ux")
    url = ("file:///" + tmp.replace("\\", "/") +
           "?q=alto&em=%.5f,%.5f&r=240&p=1.20&t=0.80" % (lat, lon))
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=1000,640", "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader", "--hide-scrollbars",
                            "--virtual-time-budget=25000",
                            "--enable-logging=stderr", "--log-level=0", url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        srv.shutdown()
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass

    saida = (r.stderr or "") + (r.stdout or "")
    d = None
    for ln in saida.splitlines():
        if "UX " in ln and "{" in ln:
            try: d = json.loads(ln[ln.index("{"):ln.rindex("}") + 1])
            except ValueError: pass
    if not d or "erro" in d:
        print("  %-22s SONDA MUDA %s" % (cidade, (d or {}).get("erro", "")))
        return False
    return confere(cidade, d)


def confere(cidade, d):
    t = d.get("tipos", {})
    p = []
    p.append(("busca: itens", d.get("itens", 0) >= 200, d.get("itens", 0)))
    p.append(("busca: vias", t.get("rua", 0) >= 100, t.get("rua", 0)))
    p.append(("busca: lugares", t.get("poi", 0) >= 20, t.get("poi", 0)))
    p.append(("busca: acerta", bool(d.get("certo")), d.get("primeiro")))
    p.append(("link: alvo x", abs(d.get("alvo", [0, 0])[0] - DESLOC) <= 5, d.get("alvo", [None])[0]))
    p.append(("link: alvo z", abs(d.get("alvo", [0, 0])[1] - DESLOC) <= 5, d.get("alvo", [None, None])[1]))
    p.append(("link: raio", d.get("raio") == 240, d.get("raio")))
    p.append(("link: reescreve", bool(d.get("url")), d.get("url")))
    p.append(("noite: escurece", d.get("expNoite", 9) <= 0.45, d.get("expNoite")))
    p.append(("noite: completa", d.get("t", 0) >= 0.99, d.get("t")))
    p.append(("noite: volta", abs(d.get("expVolta", 0) - d.get("expDia", 1)) < 0.02, d.get("expVolta")))
    p.append(("minimapa: tinta", 2.0 <= d.get("mmClaro", 0) <= 45.0, d.get("mmClaro")))
    ruins = [n for n, ok, _ in p if not ok]
    print("  %s" % cidade)
    for n, ok, v in p:
        print("      %-20s %-28s %s" % (n, v, "ok" if ok else "REPROVA"))
    return not ruins


def main():
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    alvos = [a for a in sys.argv[1:] if not a.startswith("-")] or CIDADES
    print("UX do %s: busca, link, noite e minimapa" % VERSAO)
    ruins = []
    for c in alvos:
        if roda(c) is False: ruins.append(c)
    print("")
    if ruins:
        print("REPROVOU em: %s" % ", ".join(ruins)); return 1
    print("Todas as cidades passaram."); return 0


if __name__ == "__main__":
    sys.exit(main())
