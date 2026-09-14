# -*- coding: utf-8 -*-
"""
Gera v6/sao-carlos-v6.html: a versao de DUPLO CLIQUE, com a base de LOTES.

O v5 tirou a base da pagina e passou a le-la por fetch -- e em file:// (duplo
clique) o fetch morre por origem opaca. O v6 desfaz isso: embute tudo dentro da
pagina (three.js, earcut, a base da cidade e a grade de relevo) e faz o boot()
ler o embutido antes de tentar a rede. Resultado: um arquivo unico que abre no
navegador com duplo clique, sem servidor e sem internet.

A base embutida e a de LOTES (v5/sao-carlos-v5-lotes.city.json): as casas
soltas do Overture trocadas por casas alinhadas ao lote. Ver
[[mapa-3d-lotes-alinhados]] e [[mapa-3d-duplo-clique]].

  python v6/make_v6.py

Mesma disciplina dos make_v4/v5: replace ancorado em texto exato do v5, que
falha alto se o v5 mudar de forma.
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

import io, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SRC  = os.path.join(ROOT, "v5", "sao-carlos-v5.html")
CITY = os.path.join(ROOT, "v5", "sao-carlos-v5-lotes.city.json")   # base de LOTES
GFX  = os.path.join(ROOT, "teste melhoria grafica")               # libs + relevo ja prontos
OUT  = os.path.join(BASE, "sao-carlos-v6.html")

patches = 0
def sub(s, old, new, what):
    global patches
    if s.count(old) != 1:
        raise SystemExit("ancora nao unica (%dx): %s" % (s.count(old), what))
    patches += 1
    print("  [%d] %s" % (patches, what))
    return s.replace(old, new)


def main():
    global patches
    if not os.path.exists(SRC):
        raise SystemExit("v5 nao encontrado: %s" % SRC)
    if not os.path.exists(CITY):
        raise SystemExit("base de lotes nao encontrada: %s" % CITY)
    s = io.open(SRC, encoding="utf-8").read()
    print("v5: %.0f KB" % (len(s)/1024))
    print("aplicando patches:")

    def rd_gfx(name):
        return io.open(os.path.join(GFX, name), encoding="utf-8").read()

    # 1. marcador de versao
    s = sub(s, "<title>São Carlos — mapa 3D (v5)</title>",
               "<title>São Carlos — mapa 3D (v6 · duplo clique · lotes + tipologia)</title>",
               "titulo v6")

    # ---- patches graficos (branch "teste melhoria grafica") ----------------
    # G1. secao 5 inteira: tipologia + novo buildBuildings (modelos/telhados)
    a = s.index("/* ============================================================\n"
                "   5. Geometria a partir dos registros")
    b = s.index("function buildRibbons(recs, y, mul) {")
    s = s[:a] + rd_gfx("tipologia.js") + "\n" + rd_gfx("predios.js") + "\n" + s[b:]
    patches += 1
    print("  [%d] secao 5 (tipologia + predios) aplicada" % patches)

    # G2. shader de fachada por tipologia
    a = s.index("function facadeMaterial(u) {")
    b = s.index("function riseLine(u) {")
    s = s[:a] + rd_gfx("fachada.js") + "\n" + s[b:]
    patches += 1
    print("  [%d] facadeMaterial() com aStyle" % patches)

    # G3. espaco de cor sRGB (o que mais muda a imagem) + fundo reajustado
    s = sub(s, "scene.fog = new THREE.Fog(K.void, 1400, 5500);",
"""scene.fog = new THREE.Fog(K.void, 1400, 5500);
if (new URLSearchParams(location.search).get("srgb") !== "0") {
  renderer.outputEncoding = THREE.sRGBEncoding;
  const VOID2 = 0x59636F;
  renderer.setClearColor(VOID2);
  scene.fog.color.setHex(VOID2);
}""",
        "saida sRGB + fundo (?srgb=0 volta ao v5)")

    # G4. a ficha do imovel mostra a tipologia derivada
    s = sub(s, '  $("shTag").textContent = LABEL[p.cls];',
               '  $("shTag").textContent = p.tipo ? p.tipo + " · " + LABEL[p.cls] : LABEL[p.cls];',
               "ficha mostra a tipologia")

    # G_CHAO. Superficie de chao presa ao relevo (quadras trianguladas). Sem ela,
    # os predios em miolo de quarteirao (sem rua/verde embaixo) flutuavam quando o
    # relevo subia, porque o fundo plano nao acompanha. O chao entra no
    # terrainRegistry (segue o terreno por vertice) e vai direto na `scene` (nao no
    # gRest) pra sobreviver ao resetScene.
    ground_js = """
// v6: chao que acompanha o relevo (quadras). Ver make_v6.py.
(function buildGround(){
  const el = document.getElementById("__grounddata");
  if (!el) return;
  let a; try { a = JSON.parse(el.textContent); } catch(e){ return; }
  const n = a.length/2, pos = new Float32Array(n*3);
  for (let i=0;i<n;i++){ pos[i*3]=a[i*2]; pos[i*3+1]=0; pos[i*3+2]=a[i*2+1]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  g.computeVertexNormals();
  g.userData.ground = true;
  registerTerrain(g);
  // DoubleSide: a triangulacao das quadras tem winding arbitrario; sem isso metade
  // dos triangulos fica de costas e o chao some visto de cima.
  // MeshBasic (nao-iluminado) na cor do vazio: 0x192029 e o linear que, apos o
  // outputEncoding sRGB, vira o clearColor 0x59636F -- chao fica do mesmo tom do fundo.
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0x192029, side:THREE.DoubleSide, fog:true }));
  m.userData.ground = true; m.position.y = -0.06; m.receiveShadow = true; m.renderOrder = -2;
  scene.add(m);
})();
// v6: a RUA como uma unica entidade -- malha continua preenchendo os corredores
// entre as quadras (nao as tirinhas de centro). As casas encostam a face dianteira
// nela. Presa ao relevo, cor asfalto (linear 0x28303B -> ~0x6E7884 apos sRGB, um tom
// acima do vazio). renderOrder -1: acima do chao (-2), abaixo dos predios/ribbons.
(function buildStreets(){
  const el = document.getElementById("__streetdata");
  if (!el) return;
  let a; try { a = JSON.parse(el.textContent); } catch(e){ return; }
  const n = a.length/2, pos = new Float32Array(n*3);
  for (let i=0;i<n;i++){ pos[i*3]=a[i*2]; pos[i*3+1]=0; pos[i*3+2]=a[i*2+1]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  g.computeVertexNormals();
  g.userData.ground = true;
  registerTerrain(g);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0x28303B, side:THREE.DoubleSide, fog:true }));
  m.userData.ground = true; m.position.y = -0.05; m.receiveShadow = true; m.renderOrder = -1;
  scene.add(m);
})();
"""
    flat_anchor = ('const flat = c => new THREE.MeshPhongMaterial({ color:c, shininess:0, '
                   'specular:0x000000, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });')
    s = sub(s, flat_anchor, flat_anchor + "\n" + ground_js.strip(), "chao preso ao relevo (buildGround)")
    # resetScene mantem o chao no terrainRegistry (como ja faz com POIs)
    s = sub(s, "const keepPoi = terrainRegistry.filter(g => g.userData.poi);",
               "const keepPoi = terrainRegistry.filter(g => g.userData.poi || g.userData.ground);",
               "resetScene mantem o chao no terrainRegistry")

    # G_PINS. botao pra desligar TODOS os pins de POI (estabelecimentos/lojas/etc).
    s = sub(s,
"""  <div class="row">
    <button id="tRelief" aria-pressed="false">Relevo</button>
  </div>""",
"""  <div class="row">
    <button id="tRelief" aria-pressed="false">Relevo</button>
  </div>
  <div class="row">
    <button id="tPins" aria-pressed="true">Pins</button>
  </div>""",
        "botao Pins no painel")
    s = sub(s,
"""function updatePois() {
  const W = innerWidth, H = innerHeight, cam = camera.position, vis = [];""",
"""let poiHidden = false;
$("tPins").addEventListener("click", () => {
  const on = $("tPins").getAttribute("aria-pressed") !== "true";
  $("tPins").setAttribute("aria-pressed", String(on));
  poiHidden = !on; gPoi.visible = on;
  if (poiHidden && typeof poiSel !== "undefined" && poiSel) closePoiSheet();
});
function updatePois() {
  if (poiHidden) { for (const p of POIS) if (p.el.style.display !== "none") p.el.style.display = "none"; return; }
  const W = innerWidth, H = innerHeight, cam = camera.position, vis = [];""",
        "logica do botao Pins (esconde DOM + gPoi)")

    # G_SETAS. seta em cada casa mostrando pra onde a frente "olha" (virada pra rua).
    # O angulo de frente foi gravado na geracao em data.fa (graus, no frame do mapa;
    # 400 = predio sem seta). Uma unica InstancedMesh (1 draw call) aguenta as ~98k.
    s = sub(s, "    B.push({ r, h, c, area:a, name:m.name || null, addr:m.addr || null });",
               "    B.push({ r, h, c, area:a, name:m.name || null, addr:m.addr || null, "
               "fa:(data.fa && data.fa[n]!==undefined ? data.fa[n] : 400) });",
               "decode carrega angulo de frente (fa) por predio")
    s = sub(s,
"""  <div class="row">
    <button id="tPins" aria-pressed="true">Pins</button>
  </div>""",
"""  <div class="row">
    <button id="tPins" aria-pressed="true">Pins</button>
    <button id="tArrows" aria-pressed="false">Setas</button>
  </div>""",
        "botao Setas no painel")
    arrows_js = """
// v6: setas de orientacao -- uma seta chata no teto de cada casa apontando pra
// frente (a rua). data.fa (graus) por predio; rotation.y = -fa (o +X do mapa vira
// (cos,-sin) no mundo). Uma InstancedMesh so, invisivel ate ligar no botao Setas.
let gArrows = null;
function buildFacingArrows(B) {
  if (gArrows) { scene.remove(gArrows); if (gArrows.geometry) gArrows.geometry.dispose(); gArrows = null; }
  let cnt = 0;
  for (const b of B) if (b.c === 1 && b.fa != null && b.fa < 361) cnt++;
  if (!cnt) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
     3.0,0,0,  -1.4,0,1.5,  -0.3,0,0.55,
     3.0,0,0,  -0.3,0,-0.55, -1.4,0,-1.5,
     3.0,0,0,  -0.3,0,0.55,  -0.3,0,-0.55 ]), 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color:0xff3b30, side:THREE.DoubleSide });
  const im = new THREE.InstancedMesh(g, mat, cnt);
  const o = new THREE.Object3D(); let k = 0;
  const ty = (typeof terrainY === "function") ? terrainY : () => 0;
  for (const b of B) {
    if (!(b.c === 1 && b.fa != null && b.fa < 361)) continue;
    let cx = 0, cz = 0; for (const p of b.r) { cx += p[0]; cz += p[1]; }
    cx /= b.r.length; cz /= b.r.length;
    o.position.set(cx, b.h + 0.5 + ty(cx, cz), cz);
    o.rotation.set(0, -b.fa * Math.PI / 180, 0);
    o.scale.setScalar(1);
    o.updateMatrix(); im.setMatrixAt(k++, o.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false; im.renderOrder = 4; im.visible = false; im.userData.arrows = true;
  gArrows = im; scene.add(im);
}
if ($("tArrows")) $("tArrows").addEventListener("click", () => {
  const on = $("tArrows").getAttribute("aria-pressed") !== "true";
  $("tArrows").setAttribute("aria-pressed", String(on));
  if (gArrows) gArrows.visible = on;
});
"""
    s = sub(s, "function loadCity(data, label) {",
               arrows_js.strip() + "\nfunction loadCity(data, label) {",
               "buildFacingArrows + toggle do botao Setas")
    s = sub(s, "  gGroups = groupsFrom(B, R, G, grp);",
               "  gGroups = groupsFrom(B, R, G, grp);\n  buildFacingArrows(B);",
               "monta as setas apos o decode")

    # G_SOMBRA. tira as sombras projetadas pelos PREDIOS (pedido do usuario).
    # Predios continuam recebendo sombra (de arvores); so nao projetam mais.
    s = sub(s, "    bm.castShadow = true; bm.receiveShadow = true; add(bm, gBuild);",
               "    bm.castShadow = false; bm.receiveShadow = true; add(bm, gBuild);",
               "predios nao projetam sombra")

    # G_SOMBRA2. arvores tambem nao projetam sombra (mesmo tratamento dos predios).
    s = sub(s, "  im.castShadow = true; im.receiveShadow = true;",
               "  im.castShadow = false; im.receiveShadow = true;",
               "arvores nao projetam sombra")

    # G5. arvores sempre ativas. No v5 elas so aparecem se !LIGHT(), e LIGHT()=
    # GRID>=10; como São Carlos tem b[] grande, o mapa inicia em GRID=12 (light)
    # e as arvores nunca aparecem. Aqui elas saem do gate (as faixas de rua/dashes
    # continuam gated por performance). buildTrees ja registra em treeRegistry.
    s = sub(s,
"""  if (!LIGHT()) {
    const ds = buildDashes(R);
    if (ds) add(new THREE.Mesh(ds, new THREE.MeshBasicMaterial({ color:K.mark })), gRoad);
    const tm = buildTrees(gp.polys, R);
    if (tm) { add(tm, gRest); treeRegistry.push(tm); }
  }""",
"""  if (!LIGHT()) {
    const ds = buildDashes(R);
    if (ds) add(new THREE.Mesh(ds, new THREE.MeshBasicMaterial({ color:K.mark })), gRoad);
  }
  { // v6: arvores sempre ativas, MAS so nas areas verdes/pracas (roads=[]): as
    // arvores de beira de rua caiam em cima das casas (que agora encostam na rua)
    // e do asfalto. buildTrees ja empurra em treeRegistry.
    const tm = buildTrees(gp.polys, []);
    if (tm) { tm.userData.cx = cx; tm.userData.cz = cz; add(tm, gRest); }
  }""",
        "arvores sempre ativas (fora do gate LIGHT) + centro do bloco")

    # G5b. culling das arvores por regiao: so renderiza as arvores dos blocos
    # perto do alvo da camera (senao, no modo afastado, TODAS renderizam de uma vez).
    s = sub(s, "  updatePois();\n  streamUpdate(false);   // alvo mudou? recalcula o conjunto vivo",
"""  // v6: arvores por regiao -- so as perto do que se olha ficam renderizadas.
  { const TR2 = 1800*1800;
    for (const tm of treeRegistry) {
      if (tm.userData.cx === undefined) continue;
      const dx = tm.userData.cx - target.x, dz = tm.userData.cz - target.z;
      tm.visible = (dx*dx + dz*dz) < TR2;
    } }
  updatePois();
  streamUpdate(false);   // alvo mudou? recalcula o conjunto vivo""",
        "culling das arvores por regiao (loop de render)")

    # G5c. arvores so em verde de verdade (praca/parque): pula poligono verde
    # FINO ou PEQUENO (canteiro central/faixa de avenida) -- era de la que vinha a
    # fileira de arvores no meio da avenida, em cima do asfalto.
    s = sub(s, "    if (x1-x0 > 900 || z1-z0 > 900) continue;",
               "    if (x1-x0 > 900 || z1-z0 > 900) continue;\n"
               "    if (Math.min(x1-x0, z1-z0) < 22 || (x1-x0)*(z1-z0) < 1200) continue; // v6: sem canteiro/faixa fina",
               "arvores so em verde grande (sem canteiro central de avenida)")

    # ---- POIs: categorias novas (comercio/servicos) do OSM da cidade toda ----
    ICO_NEW = {
     'utensils':'<path d="M3 2v7c0 1.1.9 2 2 2h.5a.5.5 0 0 1 .5.5V22"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z"/><path d="M21 15v7"/>',
     'coffee':'<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
     'bread':'<path d="M4 11h16a1 1 0 0 1 1 1 5 5 0 0 1-5 5H8a5 5 0 0 1-5-5 1 1 0 0 1 1-1z"/><path d="M8 11a4 4 0 0 1 8 0"/>',
     'bank':'<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
     'grad':'<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
     'fuel':'<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5"/>',
     'bed':'<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
     'church':'<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="m18 22 .01-8.5a2 2 0 0 0-.9-1.7L12 8 6.9 11.8a2 2 0 0 0-.9 1.7L6 22"/>',
     'dumbbell':'<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
     'store':'<path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.3a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/>',
     'building':'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M8 10h.01M8 14h.01M16 14h.01"/>',
     'camera':'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
     'wrench':'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    }
    CAT_NEW = [
     ('comida',  'Restaurantes',     'Restaurante',          '#FF7A45', 'utensils'),
     ('cafebar', 'Cafés & Bares',    'Café / Bar',           '#D98E4A', 'coffee'),
     ('padaria', 'Padarias',         'Padaria',              '#E7C24A', 'bread'),
     ('banco',   'Bancos',           'Banco',                '#4DA3FF', 'bank'),
     ('escola',  'Escolas',          'Escola / Educação',    '#63D2A0', 'grad'),
     ('posto',   'Postos',           'Posto de combustível', '#FF5A5A', 'fuel'),
     ('hotel',   'Hotéis',           'Hotel / Pousada',      '#9B8CFF', 'bed'),
     ('igreja',  'Igrejas',          'Igreja / Templo',      '#B7A588', 'church'),
     ('academia','Academias',        'Academia / Esporte',   '#59D0E0', 'dumbbell'),
     ('loja',    'Lojas',            'Loja / Comércio',      '#C6D24A', 'store'),
     ('turismo', 'Turismo & Cultura','Turismo / Cultura',    '#E85D9C', 'camera'),
     ('publico', 'Serviços públicos','Serviço público',      '#8FA6BC', 'building'),
     ('servico', 'Serviços',         'Serviço',              '#9AA0A6', 'wrench'),
    ]
    ico_add = ''.join("  %s:'%s',\n" % (k, v) for k, v in ICO_NEW.items())
    cat_add = ''.join("  %-10s { lbl:%r, curto:%r, col:%r, ic:ICO.%s },\n" % (k+':', lbl, cu, co, ic)
                      for k, lbl, cu, co, ic in CAT_NEW)
    # P1. icones novos no ICO (antes do fecho, apos clinic)
    clinic = '  clinic:\'<path d="M12 10v6"/><path d="M9 13h6"/><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>\''
    s = sub(s, clinic, clinic + ",\n" + ico_add.rstrip("\n"), "icones POI novos no ICO")
    # P2. categorias novas no CAT (mercado ganha virgula, entram as novas)
    merc = '  mercado:      { lbl:"Mercados",         curto:"Mercado / feira",      col:"#B98CFF", ic:ICO.basket }'
    s = sub(s, merc, merc + ",\n" + cat_add.rstrip("\n"), "categorias POI novas no CAT")
    # P3. dados: 82 -> 931 POIs (merge existente + novos do OSM)
    pd = io.open(os.path.join(BASE, "poidata_merged.json"), encoding="utf-8").read()
    a = s.index('id="__poidata">') + len('id="__poidata">')
    b = s.index('</script>', a)
    s = s[:a] + pd + s[b:]
    patches += 1
    print("  [%d] POIs expandidos: 82 -> %d" % (patches, pd.count('"lat"')))

    # 2. bibliotecas por dentro, no lugar dos <script src> de CDN
    a = s.index('<script src="https://cdnjs')
    b = s.index("<style>")
    three = io.open(os.path.join(GFX, "lib", "three.min.js"), encoding="utf-8").read()
    earcut = io.open(os.path.join(GFX, "lib", "earcut.min.js"), encoding="utf-8").read()
    libs = ("<!-- three.js r128 (MIT) e earcut 2.2.4 (ISC) embutidos: duplo clique\n"
            "     nao pode depender de CDN nem de conexao. -->\n"
            "<script>" + three + "</script>\n"
            "<script>" + earcut + "</script>\n\n")
    s = s[:a] + libs + s[b:]
    patches += 1
    print("  [%d] three.js + earcut embutidos (%.0f KB)" % (patches, len(libs)/1024))

    # 3. base da cidade (LOTES) volta pra dentro, no marcador que o v5 deixou
    city = io.open(CITY, encoding="utf-8").read()
    s = sub(s, "<!-- v5: a base da cidade agora e um arquivo separado, "
               "baixado em runtime (ver CITY_FILE) -->",
            '<script type="application/json" id="__citydata">' + city + "</script>",
            "base de LOTES embutida (%.1f MB)" % (len(city)/1048576))

    # 3b. grade de relevo MAIOR (cobre a cidade toda, evita predios flutuando na
    #     periferia onde a grade ±5,5km original achatava). Se existir relevo_wide.json
    #     (80x80, ±9,5km) no v6/, usa ela e ajusta ELEV_N/ELEV_HALF.
    wide = os.path.join(BASE, "relevo_wide.json")
    if os.path.exists(wide):
        s = sub(s, "const ELEV_HALF = 5500, ELEV_N = 44;",
                   "const ELEV_HALF = 9500, ELEV_N = 80;",
                   "grade de relevo ampliada: ±9,5km, 80x80")

    # 3c. dados do chao (quadras trianguladas) embutidos, antes do __citydata
    gnd = os.path.join(BASE, "ground_tris.json")
    if os.path.exists(gnd):
        s = sub(s, '<script type="application/json" id="__citydata">',
                '<script type="application/json" id="__grounddata">'
                + io.open(gnd, encoding="utf-8").read() + "</script>\n"
                + '<script type="application/json" id="__citydata">',
                "chao (quadras) embutido (%.0f KB)" % (os.path.getsize(gnd)/1024))
    # 3c-bis. a rua como entidade unica (corredores entre quadras) embutida
    stt = os.path.join(BASE, "street_tris.json")
    if os.path.exists(stt):
        s = sub(s, '<script type="application/json" id="__citydata">',
                '<script type="application/json" id="__streetdata">'
                + io.open(stt, encoding="utf-8").read() + "</script>\n"
                + '<script type="application/json" id="__citydata">',
                "rua unica (corredores) embutida (%.0f KB)" % (os.path.getsize(stt)/1024))
    # (muros removidos a pedido do usuario -- nao ajudaram na visualizacao)

    # 4. grade de relevo embutida (senao o botao Relevo morre offline)
    rel = wide if os.path.exists(wide) else os.path.join(GFX, "relevo.json")
    if os.path.exists(rel):
        s = sub(s, '<script type="application/json" id="__citydata">',
                '<script type="application/json" id="__elevdata">'
                + io.open(rel, encoding="utf-8").read() + "</script>\n"
                + '<script type="application/json" id="__citydata">',
                "grade de relevo embutida (%.0f KB)" % (os.path.getsize(rel)/1024))
        s = sub(s, """function loadElevCache() {
  try {
    const raw = localStorage.getItem(ELEV_CACHE_KEY);""",
"""function loadElevCache() {
  const t = document.getElementById("__elevdata");
  if (t) {
    try {
      const a = JSON.parse(t.textContent);
      if (Array.isArray(a) && a.length === ELEV_N*ELEV_N) return Float32Array.from(a);
    } catch (e) { console.error("Grade de relevo embutida invalida:", e); }
  }
  try {
    const raw = localStorage.getItem(ELEV_CACHE_KEY);""",
                "Relevo le a grade embutida antes da API")
    else:
        print("      (sem relevo.json -- botao Relevo dependeria da rede)")

    # 5. boot() le a base embutida antes da rede (fetch fica so pro ?city=)
    s = sub(s, """async function boot() {
  frame0(4);
  stK.textContent = "Baixando a base da cidade";""",
"""async function boot() {
  frame0(4);
  // Duplo clique abre em file://, e ali fetch e bloqueado pela origem opaca.
  // A base vai embutida; a rede so entra se alguem pedir outra cidade por ?city=.
  const embutida = document.getElementById("__citydata");
  if (embutida && !new URLSearchParams(location.search).get("city")) {
    stK.textContent = "Reconstruindo a cidade";
    stM.textContent = "base embutida na pagina (v6)";
    stI.style.width = "45%";
    await new Promise(r => setTimeout(r, 50));
    try {
      loadCity(JSON.parse(embutida.textContent), "base embutida (v6 lotes)");
      return;
    } catch (e) {
      console.error("Base embutida invalida, tentando pela rede:", e);
    }
  }
  stK.textContent = "Baixando a base da cidade";""",
            "boot() le a base embutida antes da rede")

    io.open(OUT, "w", encoding="utf-8").write(s)
    print("\nv6 (duplo clique): %.1f MB -> %s" % (len(s)/1048576, OUT))
    print("  abre direto no navegador, sem servidor e sem internet")


if __name__ == "__main__":
    main()
