# -*- coding: utf-8 -*-
"""Exporta a cena de BELEZA pro Unreal: mesma geometria que o navegador desenha.

    python pipeline/unreal_cena.py sanca-135-29

Sai em `unreal/malhas/<id>.cena.obj` + `.mtl` + `.cena.json`.

NAO E o `unreal_exporta.py`. Aquele exporta a casa com albedo BRANCO e um atlas de
uma peca por face, porque o que ele quer de volta e IRRADIANCIA. Este exporta a casa
com a COR DO CADASTRO e agrupada por material, porque o que ele quer de volta e uma
IMAGEM. A ordem das faces aqui nao importa e nao deve ser comparada com a de la.

**Por que existe.** A duvida em aberto e "quanto da diferenca de qualidade e o
renderizador e quanto e o conteudo". A unica forma de responder e um experimento
controlado: MESMA geometria, MESMA mobilia, MESMAS cores, so trocando quem renderiza.
Se a imagem do UE for muito melhor com tudo isso igual, a diferenca e o renderizador;
se for parecida, a diferenca esta no conteudo (moveis, textura, direcao de arte) e
trocar de motor nao resolve nada.

**O que a sonda traz e o .json nao tem.** O referencial (ux,uz) em que a planta
assenta nao esta no `unreal/plantas/<id>.json` -- `rumo` de la e o rumo do LOTE, que
nao e o mesmo eixo. Sem ele nao da pra girar a direcao do sol pro referencial da
planta. Mobilia tambem vem da sonda ja resolvida em (u,v), o que evita recalcular o
centro `mc` da planta aqui e errar por 1 cm.

Unidades: OBJ em CENTIMETROS e Z pra cima, que e o que a UE espera. A planta e
metros com Y pra cima, entao (x, y, z) da planta vira (x, z, y) em cm.
"""
import io, json, math, os, shutil, subprocess, sys, tempfile

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
# `montar` resolve a CIDADE no topo do modulo, lendo sys.argv. Aqui o primeiro
# posicional e o id da UNIDADE, e importar direto morre com "cidade desconhecida".
_argv = sys.argv
sys.argv = [_argv[0]]
from pipeline.build.config import resolve
VERSAO = resolve().versao   # sem flag propria: MAPA_V ou o padrao; o v15 reprova aqui
sys.argv = _argv

ESP = 0.13
ROD_ESP = ESP + 0.024
SOBE_FORRO = 0.06     # igual ao geoDaCasa: a parede passa do forro, senao z-fighting

ID = ([a for a in sys.argv[1:] if not a.startswith("-")] or ["sanca-135-29"])[0]
DE = "Cozinha"
PARA = "Sala"

SONDA = r"""
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length ||
      !document.querySelector("#houses .hitem[data-unidade]")) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('CENA {"erro":"nao subiu"}'); return;
  }
  var I = window.__int, alvo = "%(ID)s";
  var itens = [].slice.call(document.querySelectorAll("#houses .hitem[data-unidade]"));
  var it = null;
  for (var k = 0; k < itens.length; k++)
    if ((itens[k].dataset.unidade || "").indexOf(alvo) >= 0) { it = itens[k]; break; }
  if (!it) { console.log('CENA {"erro":"unidade nao listada"}'); return; }
  it.click();
  var bt = document.getElementById("uEnter");
  if (!bt) { console.log('CENA {"erro":"sem botao"}'); return; }
  bt.click();
  (function pronto(m) {
    if ((!I.INT.pl || !I.INT.casa) && m > 0) return setTimeout(function(){pronto(m-1);}, 200);
    var pl = I.INT.pl;
    if (!pl) { console.log('CENA {"erro":"nao entrou"}'); return; }
    var ob = pl.ob;
    // mundo -> planta: o mesmo inverso de W() que o dump_planta usa
    var loc = function (p) { var x=p[0]-ob.cx, z=p[1]-ob.cz;
      return [ x*ob.ux + z*ob.uz, -x*ob.uz + z*ob.ux ]; };
    var locDir = function (dx, dz) { return [ dx*ob.ux + dz*ob.uz, -dx*ob.uz + dz*ob.ux ]; };

    var cen = function (nome) {
      for (var i = 0; i < pl.comodos.length; i++) {
        var c = pl.comodos[i];
        if ((c.nome||"").toLowerCase().indexOf(nome.toLowerCase()) === 0) return [c.cx, c.cz];
      }
      return null;
    };
    var a = cen("%(DE)s"), b = cen("%(PARA)s");
    if (!a || !b) { console.log('CENA {"erro":"comodo nao achado"}'); return; }
    var dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
    var R = 0.9;
    while (R > 0.05 && !I.livre(a[0]-dx*R, a[1]-dz*R)) R -= 0.15;
    if (R <= 0.05) R = 0;
    I.INT.voo = null; I.INT.fp = true; I.INT.orbita = false;
    I.FP.pos.set(a[0]-dx*R, I.INT.baseY, a[1]-dz*R);
    I.FP.yaw = Math.atan2(-dx, -dz); I.FP.pitch = -0.03;

    setTimeout(function () {
      var c = I.camera, d = new THREE.Vector3(); c.getWorldDirection(d);
      var cp = loc([c.position.x, c.position.z]), cd = locDir(d.x, d.z);
      console.log("CENA " + JSON.stringify({
        id: pl.id, pd: pl.pd, baseY: I.INT.baseY,
        ob: { ux: ob.ux, uz: ob.uz },
        cam: { p: [cp[0], c.position.y - I.INT.baseY, cp[1]], dir: [cd[0], d.y, cd[1]],
               fov: c.fov, aspecto: c.aspect },
        moveis: pl.moveis.map(function(m){ return { tipo:m.tipo, u:m.u, v:m.v, rot:m.rot,
                 w:m.w, h:m.h, d:m.d, cor:m.cor }; })
      }));
    }, 900);
  })(80);
})(400);
</script>
"""


def sonda(slug):
    pag = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (slug, VERSAO))
    if not os.path.exists(pag):
        print("falta %s" % pag); return None
    s = io.open(pag, encoding="utf-8", newline="").read() + (SONDA % {"ID": ID, "DE": DE, "PARA": PARA})
    tmp = pag + ".cena.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="cena")
    bruto = ""
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=1280,760", "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader", "--hide-scrollbars",
                            "--virtual-time-budget=70000", "--enable-logging=stderr",
                            "--log-level=0",
                            "file:///" + tmp.replace("\\", "/") + "?q=alto"],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=int(os.environ.get("QA_TIMEOUT", 1500)))
        bruto = (r.stderr or "") + (r.stdout or "")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass
    for ln in bruto.splitlines():
        if "CENA " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("CENA ")+5:].lstrip())[0]
            except ValueError:
                continue
    print(bruto[-900:])
    return None


# ---- geometria ---------------------------------------------------------------
class Obj(object):
    """Acumula triangulos por MATERIAL. Ponto em metros no referencial da planta
    (x, y=altura, z); a escrita converte pra centimetro e Z pra cima."""

    def __init__(self):
        self.v = []
        self.grupos = {}
        self.cores = {}

    def cor(self, nome, hexa):
        self.cores[nome] = hexa

    def tri(self, mat, p0, p1, p2):
        i = len(self.v)
        self.v += [p0, p1, p2]
        self.grupos.setdefault(mat, []).append((i + 1, i + 2, i + 3))

    def quad(self, mat, p0, p1, p2, p3):
        self.tri(mat, p0, p1, p2)
        self.tri(mat, p0, p2, p3)

    def poligono(self, mat, poly, y, cima):
        # leque a partir do vertice 0. Comodo aqui e retangulo; poligono concavo sairia
        # com face a mais -- se aparecer geometria estranha no chao, e aqui que se olha.
        for k in range(1, len(poly) - 1):
            a = (poly[0][0], y, poly[0][1])
            b = (poly[k][0], y, poly[k][1])
            c = (poly[k + 1][0], y, poly[k + 1][1])
            if cima:
                self.tri(mat, a, b, c)
            else:
                self.tri(mat, a, c, b)

    def prisma(self, mat, q, y0, y1):
        for i in range(4):
            a, b = q[i], q[(i + 1) % 4]
            self.quad(mat, (a[0], y0, a[1]), (b[0], y0, b[1]),
                           (b[0], y1, b[1]), (a[0], y1, a[1]))
        self.quad(mat, (q[0][0], y1, q[0][1]), (q[1][0], y1, q[1][1]),
                       (q[2][0], y1, q[2][1]), (q[3][0], y1, q[3][1]))
        self.quad(mat, (q[3][0], y0, q[3][1]), (q[2][0], y0, q[2][1]),
                       (q[1][0], y0, q[1][1]), (q[0][0], y0, q[0][1]))

    def escreve(self, base):
        with io.open(base + ".mtl", "w", encoding="ascii") as f:
            for nome, hx in sorted(self.cores.items()):
                r = ((hx >> 16) & 255) / 255.0
                g = ((hx >> 8) & 255) / 255.0
                b = (hx & 255) / 255.0
                f.write("newmtl %s\nKd %.4f %.4f %.4f\nKs 0 0 0\nd 1\nillum 1\n\n"
                        % (nome, r, g, b))
        with io.open(base + ".obj", "w", encoding="ascii") as f:
            f.write("mtllib %s\n" % os.path.basename(base + ".mtl"))
            # metro Y-cima -> centimetro Z-cima, com o Y NEGADO.
            #
            # O `-` nao e gosto: o importador do Interchange trata o OBJ como destro
            # (que e a convencao do formato) e NEGA o Y ao trazer pro sistema canhoto
            # da UE. Medido: o grupo `parede` sai daqui com Y de -298 a +300 e a engine
            # reporta -300 a +298. Sem o `-`, a casa chega espelhada -- e como a caixa
            # envolvente e quase simetrica, o espelho NAO aparece na caixa; aparece so
            # como "a foto enquadrou outro comodo", que e o sintoma mais caro de ler.
            # A camera, o sol e as luminarias sao postos direto na engine e nao passam
            # pelo importador, entao so a geometria precisa do sinal.
            for p in self.v:
                f.write("v %.3f %.3f %.3f\n" % (p[0] * 100.0, -p[2] * 100.0, p[1] * 100.0))
            for nome in sorted(self.grupos):
                f.write("g %s\nusemtl %s\n" % (nome, nome))
                for t in self.grupos[nome]:
                    f.write("f %d %d %d\n" % t)
        return len(self.v) // 3


def quad_do_seg(a, b, esp):
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz) or 1.0
    dx /= L
    dz /= L
    nx, nz = -dz * esp / 2, dx * esp / 2
    return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz],
            [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]


def hexa(cores, chave, padrao):
    c = cores.get(chave)
    if not c:
        return padrao
    return int(str(c).replace("#", ""), 16)


def main():
    pj = os.path.join(RAIZ, "unreal", "plantas", ID + ".json")
    if not os.path.exists(pj):
        print("falta %s (rode pipeline/dump_planta.py)" % pj)
        return 1
    pl = json.load(io.open(pj, encoding="utf-8"))

    base = os.path.join(RAIZ, "unreal", "malhas", ID + ".cena")
    # `--rapido` reaproveita a sonda anterior. A sonda custa uma rodada de Chrome de
    # ~60 s e so muda quando a PAGINA muda; regerar o OBJ e instantaneo.
    if "--rapido" in sys.argv and os.path.exists(base + ".json"):
        d = json.load(io.open(base + ".json", encoding="utf-8"))
        print("(--rapido: reusando %s.json)" % base)
    else:
        d = sonda(pl["cidade"])
    if not d or "erro" in d:
        print("sonda falhou: %s" % (d or "sem saida"))
        return 1

    cores = pl["cores"]
    o = Obj()
    o.cor("parede", hexa(cores, "parede", 0xD9D4CB))
    o.cor("teto", hexa(cores, "teto", 0xE6E3DD))
    o.cor("rodape", hexa(cores, "rodape", 0xF4F2EE))
    o.cor("piso_frio", hexa(cores, "piso_frio", 0xBCB4A8))
    o.cor("piso_madeira", hexa(cores, "piso_madeira", 0xA07D52))
    o.cor("vidro", 0xC4D8E6)

    pd = pl["pd"]
    for c in pl["comodos"]:
        o.poligono("piso_madeira" if c["piso"] == "madeira" else "piso_frio",
                   c["poly"], 0.02, True)
    for ct in pl["contorno"]:
        o.poligono("teto", ct, pd, False)
    for w in pl["paredes"]:
        yt = pd + SOBE_FORRO if w["y1"] >= pd - 0.01 else w["y1"]
        o.prisma("parede", quad_do_seg(w["a"], w["b"], ESP), w["y0"], yt)
        if w["y0"] < 0.05:
            o.prisma("rodape", quad_do_seg(w["a"], w["b"], ROD_ESP), 0.02, 0.10)
    # Vidro: uma folha de 2 cm no vao de cada JANELA. Sem ele o comodo recebe luz de
    # ceu aberto e a comparacao vira "com e sem janela", nao "com e sem path tracer".
    for e in pl["esquadrias"]:
        if e.get("porta"):
            continue
        o.prisma("vidro", quad_do_seg(e["a"], e["b"], 0.02), e["y0"], e["y1"])

    # Movel: caixa no lugar da malha chanfrada do catalogo. `atualizaMovel` poe a peca
    # em (u,v) com a base em 0,03, escala por (w,h,d) e gira rot*90 no eixo Y -- a
    # origem do catalogo e o CENTRO DO CHAO da peca, entao a caixa vai de 0 a h.
    for m in d.get("moveis", []):
        nome = "movel_%06X" % m["cor"]
        o.cor(nome, m["cor"])
        th = m["rot"] * math.pi / 2.0
        cs, sn = math.cos(th), math.sin(th)
        hw, hd = m["w"] / 2.0, m["d"] / 2.0
        q = []
        for ex, ez in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)):
            q.append([m["u"] + ex * cs + ez * sn, m["v"] - ex * sn + ez * cs])
        o.prisma(nome, q, 0.03, 0.03 + m["h"])

    # O sol NAO vem da sonda: percorrer a cena atras da DirectionalLight devolveu
    # nulo (a luz nao esta abaixo de `INT.raiz.parent`), e nulo aqui vira sol a pino
    # sem erro nenhum. `SOL_OFF` do app.js e constante e da a mesma resposta: a luz
    # viaja de +SOL_OFF pro alvo, entao a direcao e -SOL_OFF normalizado, girada pro
    # referencial da planta pela mesma matriz que `locDir` usa la.
    sx, sy, sz = 520.0, -940.0, -640.0          # = -SOL_OFF
    n = math.sqrt(sx*sx + sy*sy + sz*sz)
    sx, sy, sz = sx/n, sy/n, sz/n
    ux, uz = d["ob"]["ux"], d["ob"]["uz"]
    d["sol"] = {"dir": [sx*ux + sz*uz, sy, -sx*uz + sz*ux], "origem": "SOL_OFF do app.js"}

    tris = o.escreve(base)
    d["obj"] = os.path.basename(base + ".obj")
    d["cores"] = cores
    json.dump(d, io.open(base + ".json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("%s.obj: %d tris, %d materiais, %d moveis"
          % (base, tris, len(o.cores), len(d.get("moveis", []))))
    print("  camera local %s  olhando %s  fov %.1f"
          % ([round(x, 2) for x in d["cam"]["p"]],
             [round(x, 2) for x in d["cam"]["dir"]], d["cam"]["fov"]))
    print("  sol local %s" % [round(x, 3) for x in d["sol"]["dir"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
