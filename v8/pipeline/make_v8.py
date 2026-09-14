# -*- coding: utf-8 -*-
"""Gera v8/sao-carlos-v8.html: o v7 com as otimizacoes de peso e de render.

Mesma disciplina dos make_v4/v5/v6/v7: `sub()` ancorado em texto exato, que
FALHA ALTO se a versao anterior mudar de forma. A fonte e o HTML pronto do v7
-- o v7 continua reproduzivel do jeito que saiu.

O que o v8 muda, e por que:

  A. atributo morto na GPU (-22 MB de VRAM, zero mudanca visual)
     chao, rua e muro sao malhas gigantes que carregavam dois atributos que
     ninguem le: `normal` (chao e rua sao MeshBasic, que nao ilumina; o muro e
     quad plano, onde flatShading da exatamente a mesma normal de face) e `aDY`
     (so o shader de predio le aDY -- nessas tres o relevo e aplicado na CPU,
     mexendo a posicao). Sao 28 B por vertice em 1,45 M vertices.

  B. corte por frustum de volta (menos draw call)
     `bm.frustumCulled = false` esta la desde o v3: a esfera de corte e
     calculada na CPU e o shader desloca o vertice depois (relevo `aDY*uRelief`
     e exagero de altura `uHeight`), entao o three descartava quarteirao que
     estava na tela. A correcao nao e desistir do corte, e INFLAR a esfera pelo
     deslocamento maximo que o shader pode aplicar -- que e mensuravel: o maior
     |aDY| da propria malha e o topo da caixa. Com o Relevo desligado
     (uRelief=0, uHeight=1) a esfera exata ja vale.

  C. pagina comprimida (10,9 MB -> ~4,5 MB)
     tudo que esta embutido -- base da cidade, chao, rua, muros, relevo, POIs,
     three.js, earcut e o proprio programa -- e texto. Vai deflate + base64 e
     e descomprimido no boot com DecompressionStream, nativo do navegador.
     Como a descompressao e assincrona e o programa do v7 roda em <script>
     classico no meio da pagina, o v8 guarda o programa como texto e o injeta
     DEPOIS -- assim nenhuma linha do renderizador precisa saber que mudou.

  python v8/pipeline/make_v8.py            # tudo
  python v8/pipeline/make_v8.py --sem-zip  # so A e B (util pra medir separado)
"""
# ---------------------------------------------------------------------------
# APOSENTADO em 2026-08-29. Este script fazia parte da cadeia de patch ancorado
# (make_v4 -> make_v5 -> make_v7 -> make_v8, 59 ancoras de texto exato) que montava
# a pagina. O renderizador virou codigo de verdade em `renderizador/` e a pagina
# passou a ser montada por `pipeline/montar.py`. Rodar isto AGORA sobrescreve a saida
# do montador com uma versao gerada da base antiga -- as duas divergem em silencio.
# Fica aqui como historico. Pra rodar assim mesmo: --aposentado-eu-sei.
import sys as _s
if "--aposentado-eu-sei" not in _s.argv:
    raise SystemExit(__file__ + ": APOSENTADO. A pagina agora sai de "
                     "`python pipeline/montar.py` (ver PIPELINE.md). "
                     "Use --aposentado-eu-sei pra rodar mesmo assim.")
# ---------------------------------------------------------------------------

import io, os, sys, base64, zlib

AQUI = os.path.dirname(os.path.abspath(__file__))
V8 = os.path.dirname(AQUI)
RAIZ = os.path.dirname(V8)
SRC = os.path.join(RAIZ, "v7", "sao-carlos-v7.html")
OUT = os.path.join(V8, "sao-carlos-v8.html")
# variante sem compressao: e nela que as sondas de QA mexem (qa_medir/qa_shot
# ancoram em texto do renderizador, que na versao comprimida virou base64)
OUT_ABERTO = os.path.join(V8, "sao-carlos-v8-aberto.html")

patches = 0


def sub(s, old, new, oque):
    global patches
    n = s.count(old)
    if n != 1:
        raise SystemExit("ancora nao unica (%dx): %s" % (n, oque))
    patches += 1
    print("  [%d] %s" % (patches, oque))
    return s.replace(old, new)


# ---------------------------------------------------------------- A. VRAM
def sem_atributo_morto(s):
    # A1. aDY so em quem o shader le. registerTerrain poe aDY em TODA malha que
    # segue o relevo -- mas chao/rua/muro tem o relevo aplicado na CPU
    # (applyTerrainToGeo mexe position), entao la o atributo e 4 B/vertice de
    # peso morto na GPU. O valor continua em userData.terrain.dy.
    s = sub(s,
            '  geo.userData.terrain = { baseY, dy };\n'
            '  geo.setAttribute("aDY", new THREE.BufferAttribute(dy, 1));',
            '  geo.userData.terrain = { baseY, dy };\n'
            '  // v8: so o shader de predio (dynamicHeight) le aDY. Chao/rua/muro tem o\n'
            '  // relevo aplicado na CPU por applyTerrainToGeo -- ali o atributo e peso\n'
            '  // morto na GPU (4 B x 1,45 M vertices).\n'
            '  if (geo.userData.dynamicHeight)\n'
            '    geo.setAttribute("aDY", new THREE.BufferAttribute(dy, 1));',
            "aDY so onde o shader le")

    # A2. quem nao tem aDY nao pode ser marcado pra atualizar
    s = sub(s, "    geo.attributes.aDY.needsUpdate = true;",
               "    if (geo.attributes.aDY) geo.attributes.aDY.needsUpdate = true;",
               "recomputeAllDy tolera malha sem aDY")

    # A3. idem pra normal: sem o atributo, nao ha o que recomputar
    s = sub(s, "  if (settle) { geo.computeVertexNormals(); geo.computeBoundingSphere(); }",
               "  if (settle) {\n"
               "    if (geo.attributes.normal) geo.computeVertexNormals();\n"
               "    geo.computeBoundingSphere();\n"
               "  }",
               "applyTerrainToGeo tolera malha sem normal")

    # A4. chao: MeshBasicMaterial nao ilumina -- a normal nunca e lida
    s = sub(s,
            '  const n = a.length/2, pos = new Float32Array(n*3);\n'
            '  for (let i=0;i<n;i++){ pos[i*3]=a[i*2]; pos[i*3+1]=0; pos[i*3+2]=a[i*2+1]; }\n'
            '  const g = new THREE.BufferGeometry();\n'
            '  g.setAttribute("position", new THREE.BufferAttribute(pos,3));\n'
            '  g.computeVertexNormals();\n'
            '  g.userData.ground = true;\n'
            '  registerTerrain(g);\n'
            '  // DoubleSide: a triangulacao das quadras tem winding arbitrario;',
            '  const n = a.length/2, pos = new Float32Array(n*3);\n'
            '  for (let i=0;i<n;i++){ pos[i*3]=a[i*2]; pos[i*3+1]=0; pos[i*3+2]=a[i*2+1]; }\n'
            '  const g = new THREE.BufferGeometry();\n'
            '  g.setAttribute("position", new THREE.BufferAttribute(pos,3));\n'
            '  // v8: sem normal. O material e MeshBasic, que nao ilumina -- a normal\n'
            '  // nunca chegava a ser lida, e sao 12 B x 52 mil vertices.\n'
            '  g.userData.ground = true;\n'
            '  registerTerrain(g);\n'
            '  // DoubleSide: a triangulacao das quadras tem winding arbitrario;',
            "chao sem atributo normal (MeshBasic)")

    # A5. rua: mesmo caso, 350 mil vertices
    s = sub(s,
            '  const g = new THREE.BufferGeometry();\n'
            '  g.setAttribute("position", new THREE.BufferAttribute(pos,3));\n'
            '  g.computeVertexNormals();\n'
            '  g.userData.ground = true;\n'
            '  registerTerrain(g);\n'
            '  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0x28303B,',
            '  const g = new THREE.BufferGeometry();\n'
            '  g.setAttribute("position", new THREE.BufferAttribute(pos,3));\n'
            '  // v8: sem normal, mesmo motivo do chao (MeshBasic nao ilumina).\n'
            '  g.userData.ground = true;\n'
            '  registerTerrain(g);\n'
            '  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0x28303B,',
            "rua sem atributo normal (MeshBasic)")

    # A6. muro: 1,1 M vertices, o maior consumidor da cena. O muro e um quad
    # vertical plano; computeVertexNormals em malha NAO indexada devolve a normal
    # da face -- exatamente o que flatShading calcula no fragmento, de graca.
    s = sub(s,
            '  const g = new THREE.BufferGeometry();\n'
            '  g.setAttribute("position", new THREE.BufferAttribute(pos,3));\n'
            '  g.computeVertexNormals();\n'
            '  g.userData.ground = true;\n'
            '  g.userData.presetDY = dy;',
            '  const g = new THREE.BufferGeometry();\n'
            '  g.setAttribute("position", new THREE.BufferAttribute(pos,3));\n'
            '  // v8: sem normal. O muro e um quad vertical plano e a malha nao e\n'
            '  // indexada -- computeVertexNormals devolvia a normal da FACE, que e\n'
            '  // exatamente o que flatShading calcula no fragmento. Mesma imagem,\n'
            '  // menos 12 B x 1,1 M vertices e menos um passo no carregamento.\n'
            '  g.userData.ground = true;\n'
            '  g.userData.presetDY = dy;',
            "muro sem atributo normal (flatShading)")
    s = sub(s,
            '  const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({\n'
            '      color:0x6E6A62, side:THREE.DoubleSide, shininess:0, specular:0x000000 }));',
            '  const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({\n'
            '      color:0x6E6A62, side:THREE.DoubleSide, shininess:0, specular:0x000000,\n'
            '      flatShading:true }));',
            "muro com flatShading")
    return s


# ------------------------------------------------------- B. corte por frustum
ESFERAS_JS = """
// v8: esfera de corte que acompanha o que o SHADER faz com o vertice.
// O renderizador desloca cada vertice em `transformed.y*=riser*uHeight` e
// `transformed.y+=aDY*uRelief` -- nada disso existe na geometria da CPU, e por
// isso o v3 desligou o frustum culling: o three cortava quarteirao visivel.
// Aqui a esfera e a exata MAIS o deslocamento maximo que o shader pode aplicar,
// que da pra medir na propria malha (maior |aDY|, topo da caixa).
function medeFolga(geo) {
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  const dy = geo.userData.terrain && geo.userData.terrain.dy;
  let dm = 0;
  if (dy) for (let i = 0; i < dy.length; i++) { const v = Math.abs(dy[i]); if (v > dm) dm = v; }
  geo.userData.r0 = geo.boundingSphere.radius;
  geo.userData.dyMax = dm;
  geo.userData.hMax = Math.max(0, geo.boundingBox.max.y);
}
function inflaEsfera(geo) {
  if (geo.userData.r0 === undefined || !geo.boundingSphere) return;
  geo.boundingSphere.radius = geo.userData.r0
    + geo.userData.dyMax * Math.abs(uRelief.value)
    + geo.userData.hMax * Math.max(0, uHeight.value - 1);
}
let _relAnt = -1, _altAnt = -1;
function ajustaEsferas() {
  if (uRelief.value === _relAnt && uHeight.value === _altAnt) return;
  _relAnt = uRelief.value; _altAnt = uHeight.value;
  for (const o of gBuild.children) inflaEsfera(o.geometry);
  for (const o of gLines.children) inflaEsfera(o.geometry);
}
"""


def frustum_de_volta(s):
    s = sub(s, "const gBuild = new THREE.Group(), gLines = new THREE.Group(),",
               ESFERAS_JS.strip() + "\nconst gBuild = new THREE.Group(), gLines = new THREE.Group(),",
               "medeFolga/inflaEsfera/ajustaEsferas")
    s = sub(s,
            """    const bm = new THREE.Mesh(b.g, facadeMaterial(u));
    // Mesmo motivo do v3: a esfera de corte é calculada antes de o shader deslocar
    // pelo relevo, então o Three.js às vezes descartava o bloco inteiro. Aqui o
    // descarte por distância já é feito pelo streaming, que é mais agressivo que
    // o frustum — manter desligado não custa o que custava no v3.
    bm.frustumCulled = false;""",
            """    const bm = new THREE.Mesh(b.g, facadeMaterial(u));
    // v8: o corte por frustum volta. O v3 o desligou porque a esfera nao sabia do
    // deslocamento que o shader aplica (relevo/altura) e o three cortava quadra
    // visivel; agora a esfera e inflada pelo deslocamento maximo possivel dessa
    // malha (medeFolga/inflaEsfera). O streaming corta por distancia, mas quem
    // esta perto e ATRAS da camera continuava custando uma chamada de desenho.
    medeFolga(b.g); inflaEsfera(b.g);
    bm.frustumCulled = true;""",
            "predio volta a ser cortado pelo frustum")
    s = sub(s,
            """      const lgLines = new THREE.LineSegments(b.lg, riseLine(u));
      lgLines.frustumCulled = false;""",
            """      const lgLines = new THREE.LineSegments(b.lg, riseLine(u));
      medeFolga(b.lg); inflaEsfera(b.lg);
      lgLines.frustumCulled = true;""",
            "contorno volta a ser cortado pelo frustum")
    # reaplica quando o Relevo/exagero muda -- um lugar so pega todos os caminhos
    s = sub(s, "function frame(now) {",
               "function frame(now) {\n  ajustaEsferas();   // v8: relevo/altura mudaram? a esfera de corte muda junto",
               "frame() reajusta as esferas quando o relevo muda")
    return s


# ------------------------------------------------------------- C. compressao
CARREGADOR = """<script>
/* v8: a pagina inteira vai comprimida.
   Base da cidade, chao, rua, muros, relevo, POIs, three.js, earcut e o proprio
   programa somam ~10,7 MB de TEXTO. Aqui vao em deflate + base64 e sao
   descomprimidos no boot pelo DecompressionStream, que e nativo -- nada de
   biblioteca de inflate embutida.
   Por que o programa tambem vira dado: descompressao e assincrona, e o
   renderizador do v7 e um <script> classico que roda no meio da pagina e monta
   chao/rua/muro na hora. Em vez de reescrever aquilo em async (e ter que acertar
   a ordem de dezenas de IIFEs), o v8 guarda o programa como texto e o injeta
   como <script> DEPOIS que os dados chegaram: para o renderizador, nada mudou. */
(function () {
  function falha(m) {
    document.title = "erro";
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:99;display:grid;place-items:center;"
      + "font:14px/1.6 system-ui;color:#e8b4b4;background:#11161c;padding:24px;text-align:center";
    d.textContent = m;
    document.body.appendChild(d);
  }
  if (typeof DecompressionStream !== "function")
    return falha("Este navegador nao tem DecompressionStream. Use Chrome/Edge 103+, Firefox 113+ ou Safari 16.4+.");
  function bytes(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function texto(b64) {
    var s = new Blob([bytes(b64)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(s).text();
  }
  var pacotes = Array.prototype.slice.call(document.querySelectorAll("script[data-zip]"));
  Promise.all(pacotes.map(function (el) { return texto(el.textContent.trim()); }))
    .then(function (textos) {
      var programa = null;
      pacotes.forEach(function (el, i) {
        if (el.dataset.zip === "programa") { programa = textos[i]; el.remove(); return; }
        var t = document.createElement("script");
        t.type = el.dataset.zip === "js" ? "text/javascript" : "application/json";
        if (el.id) t.id = el.id.replace(/_zip$/, "");
        t.textContent = textos[i];
        el.replaceWith(t);
        // <script> criado por createElement so EXECUTA se entrar no documento com
        // o tipo certo -- o replaceWith acima ja faz isso para o three/earcut.
      });
      if (!programa) return falha("pacote do programa ausente");
      var m = document.createElement("script");
      m.textContent = programa;
      document.body.appendChild(m);
    })
    .catch(function (e) { falha("Falha ao descomprimir a pagina: " + e); });
})();
</script>
"""


def zipa(txt):
    """deflate cru (o que o DecompressionStream chama de deflate-raw), em base64."""
    c = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
    return base64.b64encode(c.compress(txt.encode("utf-8")) + c.flush()).decode("ascii")


def comprime_pagina(s):
    global patches
    antes = len(s.encode("utf-8"))
    pedacos = []          # (marcador_no_html, texto, tipo, id)

    # 1. os <script type="application/json" id="__x"> de dado
    for ident in ("__grounddata", "__murosdata", "__streetdata", "__elevdata",
                  "__citydata", "__poidata"):
        abre = '<script type="application/json" id="%s">' % ident
        i = s.index(abre)
        j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre):j], "json", ident))

    # 2. os <script> sem atributo nenhum: three.js, earcut e o RENDERIZADOR, nessa
    #    ordem. O ultimo e o programa -- e o que precisa esperar os dados.
    pos, blocos = 0, []
    while True:
        i = s.find("<script>", pos)
        if i < 0:
            break
        j = s.index("</script>", i)
        blocos.append((i, j))
        pos = j + 9
    if len(blocos) != 3:
        raise SystemExit("esperava three.js + earcut + programa, achei %d <script> simples"
                         % len(blocos))
    for k, (i, j) in enumerate(blocos):
        tipo = "programa" if k == len(blocos) - 1 else "js"
        pedacos.append((s[i:j + 9], s[i + 8:j], tipo, "__lib%d" % k))

    for marcador, corpo, tipo, ident in pedacos:
        b64 = zipa(corpo)
        novo = ('<script type="text/plain" data-zip="%s"%s>%s</script>'
                % (tipo, ('' if tipo == "programa" else ' id="%s_zip"' % ident), b64))
        s = s.replace(marcador, novo, 1)
        print("      %-14s %7.2f MB -> %6.2f MB" % (ident, len(corpo) / 1048576.0,
                                                    len(b64) / 1048576.0))

    # o carregador vai no FIM do arquivo: ele procura os `script[data-zip]` no
    # documento, entao precisa rodar depois de todos eles terem sido parseados.
    # (Esta pagina nao tem <body> nem </body> escritos -- o navegador cria os dois.)
    s = s.rstrip() + "\n" + CARREGADOR
    global patches
    patches += 1
    print("  [%d] carregador (DecompressionStream) no fim da pagina" % patches)
    depois = len(s.encode("utf-8"))
    patches += 1
    print("  [%d] pagina comprimida: %.1f MB -> %.1f MB (-%.0f%%)"
          % (patches, antes / 1048576.0, depois / 1048576.0, (antes - depois) * 100.0 / antes))
    return s


def main():
    if not os.path.exists(SRC):
        raise SystemExit("v7 nao encontrado: %s" % SRC)
    s = io.open(SRC, encoding="utf-8").read()
    print("v7: %.1f MB" % (len(s) / 1048576.0))
    print("aplicando patches:")
    s = sub(s, "<title>São Carlos — mapa 3D (v7 · duplo clique · lotes das plantas oficiais)</title>",
               "<title>São Carlos — mapa 3D (v8 · duplo clique · pagina comprimida)</title>",
               "titulo v8")
    s = sem_atributo_morto(s)
    s = frustum_de_volta(s)
    if "--sem-zip" in sys.argv:
        io.open(OUT_ABERTO, "w", encoding="utf-8").write(s)
        print("\nv8 aberto (pra QA): %.1f MB -> %s" % (len(s) / 1048576.0, OUT_ABERTO))
        return
    io.open(OUT_ABERTO, "w", encoding="utf-8").write(s)
    s = comprime_pagina(s)
    io.open(OUT, "w", encoding="utf-8").write(s)
    print("\nv8: %.1f MB -> %s" % (len(s) / 1048576.0, OUT))
    print("   (a copia sem compressao ficou em %s, e nela que o qa_medir mexe)"
          % os.path.basename(OUT_ABERTO))


if __name__ == "__main__":
    main()
