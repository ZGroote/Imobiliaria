# -*- coding: utf-8 -*-
"""Tira uma foto DE DENTRO, de um comodo escolhido olhando pra outro.

    python pipeline/foto_interior.py sao-carlos --unidade sanca-135-29 \
        --de Cozinha --para Sala --salvar foto.png

Existe porque `mede_interior.py` mede a exposicao de UMA entrada fixa -- e essa
entrada, nas plantas de Sao Carlos, cai na CIRCULACAO: um corredor branco com duas
portas. Da pra aprovar iluminacao ali; nao da pra calibrar cor e detalhe, porque nao
ha material nenhum no quadro alem de parede. Uma foto de arquitetura enquadra um
comodo ATRAVES de outro -- cozinha em primeiro plano, sala ao fundo, janela no fim --
e e nesse enquadramento que se ve se a madeira parece madeira e se a luz muda de
temperatura na profundidade.

A camera e posta no centroide do comodo `--de`, na altura dos olhos, apontada pro
centroide do `--para`. Os dois vem do proprio `INT.pl.comodos`, ja em coordenada de
mundo, entao nao ha conversao de referencial pra errar aqui.
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
DE = arg("--de", "Cozinha")
PARA = arg("--para", "Sala")
ALTURA = arg("--altura", "1.55")
RECUO = arg("--recuo", "0.9")     # quanto anda pra tras do centroide, na direcao oposta
SALVAR = arg("--salvar", os.path.join(RAIZ, "unreal", "_foto.png"))
NIVEL = arg("--nivel", "alto")
PAG = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (SLUG, VERSAO))

SONDA = """
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length ||
      !document.querySelector("#houses .hitem[data-unidade]")) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('FOTO {"erro":"nao subiu"}'); return;
  }
  var I = window.__int, alvo = "%(UNI)s";
  var itens = [].slice.call(document.querySelectorAll("#houses .hitem[data-unidade]"));
  var it = itens[0];
  if (alvo) for (var k = 0; k < itens.length; k++)
    if ((itens[k].dataset.unidade || "").indexOf(alvo) >= 0) { it = itens[k]; break; }
  it.click();
  var bt = document.getElementById("uEnter");
  if (!bt) { console.log('FOTO {"erro":"sem botao"}'); return; }
  bt.click();
  if (I.bakeAgora) I.bakeAgora();
  (function pronto(m) {
    if ((!I.INT.pl || !I.INT.casa) && m > 0) return setTimeout(function(){pronto(m-1);}, 200);
    var pl = I.INT.pl;
    if (!pl) { console.log('FOTO {"erro":"nao entrou"}'); return; }
    var cen = function (nome) {
      for (var i = 0; i < pl.comodos.length; i++) {
        var c = pl.comodos[i];
        if ((c.nome || "").toLowerCase().indexOf(nome.toLowerCase()) === 0)
          return [c.cx, c.cz, c.nome];
      }
      return null;
    };
    var a = cen("%(DE)s"), b = cen("%(PARA)s");
    if (!a || !b) {
      console.log("FOTO " + JSON.stringify({erro:"comodo nao achado",
        tem: pl.comodos.map(function(c){return c.nome;})})); return;
    }
    var dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    // O recuo pede pra andar PRA TRAS do centroide, pra caber o comodo inteiro no
    // quadro. Numa cozinha de 2,3 m isso atravessa a parede -- e a foto sai do lado
    // de fora, olhando o terreno. Entao o recuo e testado com `livre()` e encolhe
    // ate caber; se nem o centroide couber, fica no centroide mesmo.
    var R = %(REC)s;
    while (R > 0.05 && !I.livre(a[0] - dx*R, a[1] - dz*R)) R -= 0.15;
    if (R <= 0.05) R = 0;
    I.INT.voo = null; I.INT.fp = true; I.INT.orbita = false;
    I.FP.pos.set(a[0] - dx*R, I.INT.baseY, a[1] - dz*R);
    // a camera olha pro -Z local: yaw = atan2(-dx, -dz)
    I.FP.yaw = Math.atan2(-dx, -dz);
    I.FP.pitch = %(PIT)s;
    I.FP.yaw += %(GIR)s;
    // `--pintar`: cada MATERIAL do interior vira uma cor CHAPADA (emissiva, sem luz e
    // sem bake). E o unico jeito de responder "que superficie e essa listra?" sem
    // adivinhar: se a listra sai colorida, ela e outra peca; se some, era sombreamento.
    // `--sem-env`: zera a reflexao de ambiente das superficies da casa. E o A/B que
    // separa "isto e geometria" de "isto e especular rasante".
    if (%(SEMENV)s) {
      I.INT.raiz.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var m = o.material.clone();
        m.envMap = null; m.envMapIntensity = 0;
        o.material = m;
      });
    }
    // `--sem-lightmap`: tira SO o atlas de luz do Unreal, mantendo cor por vertice,
    // luz e ambiente. Terceiro A/B: separa "listra de sombreamento" de "listra de
    // COSTURA DE ATLAS", que e o classico do lightmap.
    if (%(SEMLM)s) {
      I.INT.raiz.traverse(function (o) {
        if (!o.isMesh || !o.material || !o.material.lightMap) return;
        var m = o.material.clone(); m.lightMap = null; o.material = m;
      });
    }
    // `--sem-map`: tira SO a textura de reboco, mantendo cor por vertice e luz.
    if (%(SEMMAP)s) {
      I.INT.raiz.traverse(function (o) {
        if (!o.isMesh || !o.material || !o.material.map) return;
        var m = o.material.clone(); m.map = null; o.material = m;
      });
    }
    // `--sem-sombra`: desliga o mapa de sombra. Vazamento de luz em canto e o
    // sintoma classico de bias/resolucao de shadow map.
    if (%(SEMSOM)s) {
      I.scene.traverse(function (o) { if (o.isLight) o.castShadow = false; });
      I.INT.raiz.traverse(function (o) { if (o.isMesh) o.receiveShadow = false; });
    }
    // `--so-vertice`: mantem cor por vertice e mata a luz (emissive = cor do vertice).
    if (%(SOVERT)s) {
      I.INT.raiz.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var m = o.material.clone();
        if (m.color) m.color.setHex(0x000000);
        if (m.emissive) { m.emissive.setHex(0xFFFFFF); m.emissiveIntensity = 1; }
        m.lightMap = null; m.map = null; m.envMap = null;
        o.material = m;   // vertexColors continua ligado: multiplica o emissive
      });
    }
    // `--patch <js>`: roda JS arbitrario com `I` (o modulo do interior) em maos, antes
    // do disparo. E o A/B de uso unico -- trocar uma rugosidade, matar uma componente --
    // sem precisar de uma flag nova pra cada hipotese.
    %(PATCH)s
    if (%(PINTAR)s) {
      var pal = [0xFF0000,0x00FF00,0x0000FF,0xFFFF00,0x00FFFF,0xFF00FF,0xFF8000,0x8060FF],
          mapa = new Map(), i2 = 0;
      I.INT.raiz.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        if (!mapa.has(o.material)) mapa.set(o.material, pal[(i2++) %% pal.length]);
        var cor = mapa.get(o.material), m = o.material.clone();
        m.vertexColors = false; m.map = null; m.lightMap = null;
        if (m.color) m.color.setHex(0x000000);
        if (m.emissive) { m.emissive.setHex(cor); m.emissiveIntensity = 1; m.emissiveMap = null; }
        m.transparent = false; m.opacity = 1;
        o.material = m;
      });
    }
    setTimeout(function () {
      console.log("FOTO " + JSON.stringify({unidade: pl.id, de: a[2], para: b[2],
        cam: [+I.camera.position.x.toFixed(2), +I.camera.position.y.toFixed(2),
              +I.camera.position.z.toFixed(2)],
        moveis: I.INT.moveis.length, tris: (function(){var t=0;
          I.INT.raiz.traverse(function(o){ if (o.geometry && o.geometry.attributes.position)
            t += o.geometry.attributes.position.count/3; }); return Math.round(t);})()}));
    }, 900);
  })(80);
})(400);
</script>
""" % {"UNI": UNIDADE, "DE": DE, "PARA": PARA, "REC": RECUO,
       "PINTAR": "1" if "--pintar" in sys.argv else "0",
       "PIT": arg("--pitch", "-0.03"), "GIR": arg("--giro", "0"),
       "SEMENV": "1" if "--sem-env" in sys.argv else "0",
       "SEMLM": "1" if "--sem-lightmap" in sys.argv else "0",
       "SEMMAP": "1" if "--sem-map" in sys.argv else "0",
       "SEMSOM": "1" if "--sem-sombra" in sys.argv else "0",
       "SOVERT": "1" if "--so-vertice" in sys.argv else "0",
       "PATCH": arg("--patch", "")}


def main():
    if not os.path.exists(PAG):
        print("falta %s" % PAG); return 1
    s = io.open(PAG, encoding="utf-8", newline="").read() + SONDA
    tmp = PAG + ".foto.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="foto")
    bruto = ""
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=1280,760", "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader", "--hide-scrollbars",
                            "--screenshot=" + SALVAR, "--virtual-time-budget=70000",
                            "--enable-logging=stderr", "--log-level=0",
                            "file:///" + tmp.replace("\\", "/") + "?q=" + NIVEL
                            + ("&bake=0" if "--sem-bake" in sys.argv else "")],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=400)
        bruto = (r.stderr or "") + (r.stdout or "")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass
    for ln in bruto.splitlines():
        if "FOTO " in ln:
            try:
                d = json.JSONDecoder().raw_decode(ln[ln.index("FOTO ")+5:].lstrip())[0]
            except ValueError:
                continue
            print("  " + json.dumps(d, ensure_ascii=False))
            return 0 if "erro" not in d else 1
    print("(sem FOTO)"); print(bruto[-900:]); return 1


if __name__ == "__main__":
    sys.exit(main())
