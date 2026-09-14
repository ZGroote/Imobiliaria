# -*- coding: utf-8 -*-
"""
Gera v4/sao-carlos-v4.html aplicando patches sobre o v3.

Patch em vez de copia editada de proposito: o v3 continua sendo a fonte, da pra
ver exatamente o que mudou, e se algo quebrar basta rodar de novo. Todo replace
e ancorado em texto exato e falha alto se o v3 mudar de forma -- silencio aqui
significaria um v4 pela metade.
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
SRC  = os.path.join(ROOT, "v3", "sao-carlos-overture-v3.html")
CITY = os.path.join(BASE, "sao-carlos-v4.city.json")
OUT  = os.path.join(BASE, "sao-carlos-v4.html")

patches = 0
def sub(s, old, new, what):
    global patches
    if s.count(old) != 1:
        raise SystemExit(f"ancora nao unica ({s.count(old)}x): {what}")
    patches += 1
    print(f"  [{patches}] {what}")
    return s.replace(old, new)


def main():
    global patches
    s = io.open(SRC, encoding="utf-8").read()
    print(f"v3: {len(s)/1048576:.1f} MB")
    print("aplicando patches:")

    # 1. titulo / marcador de versao
    s = sub(s, "<title>São Carlos — mapa 3D</title>",
               "<title>São Carlos — mapa 3D (v4)</title>",
               "titulo v4")

    # 2. troca o payload embutido pelo city.json v4 (b[] reagrupado + bl[])
    tag = '<script type="application/json" id="__citydata">'
    i = s.index(tag) + len(tag)
    j = s.index("</script>", i)
    city = io.open(CITY, encoding="utf-8").read()
    old_mb, new_mb = (j-i)/1048576, len(city)/1048576
    s = s[:i] + city + s[j:]
    patches += 1
    print(f"  [{patches}] dados embutidos: {old_mb:.1f} MB -> {new_mb:.1f} MB (v4, com bl[])")

    # 3. decode() passa a devolver os grupos de quarteirao
    s = sub(s, "  return { B, R, G };\n}",
"""  // v4: bl[] = [cx, cz, raio, inicioB, qtdB] por quarteirao. Os indices batem
  // com a ordem de B porque o build_city_v4.py reordenou data.b agrupando por
  // quadra -- por isso aqui e uma fatia contigua, nao uma lista de indices.
  const grp = [], bl = data.bl || [];
  for (let k = 0; k < bl.length; k += 5)
    grp.push({ cx: bl[k]/Q*scale, cz: bl[k+1]/Q*scale, rad: bl[k+2]/Q*scale,
               s: bl[k+3], n: bl[k+4] });
  return { B, R, G, grp };
}""", "decode() devolve grp[]")

    # 4. assemble() -> assembleInto(), que registra o que criou
    a = s.index("function assemble(B, R, G, cx, cz) {")
    b = s.index("function addPins() {")
    s = s[:a] + io.open(os.path.join(BASE, "assemble_block.js"), encoding="utf-8").read() + "\n" + s[b:]
    patches += 1
    print(f"  [{patches}] assemble() -> assembleInto()")

    # 5. nucleo do streaming, antes do resetScene()
    s = sub(s, "function resetScene() {",
            io.open(os.path.join(BASE, "stream_block.js"), encoding="utf-8").read()
            + "\nfunction resetScene() {",
            "insere nucleo de streaming")

    # 6. resetScene tambem zera o estado do streaming
    s = sub(s, "  treeRegistry.length = 0;\n}",
"""  treeRegistry.length = 0;
  // v4: sem isso, um segundo loadCity() deixaria gLive apontando pra malhas ja
  // descartadas e o streaming nunca remontaria essas quadras.
  for (const k of [...gLive.keys()]) gLive.delete(k);
  streamQ = []; anchorX = anchorZ = 1e9; streamReady = false;
}""", "resetScene zera streaming")

    # 7. loadCity: em vez de montar tudo, prepara os grupos e liga o streaming
    a = s.index("function loadCity(data, label) {")
    b = s.index("function startDownload(n) {")
    s = s[:a] + '''function loadCity(data, label) {
  if (!data || !data.b) throw new Error("arquivo sem edificações");
  resetScene();
  GRID = data.b.length > 400000 ? 12 : 4;
  const { B, R, G, grp } = decode(data);
  if (!grp.length) throw new Error("city.json sem bl[] — rode build_city_v4.py");

  gGroups = groupsFrom(B, R, G, grp);

  // A extensao vem do dado inteiro, nao do que esta montado: senao o
  // enquadramento mudaria sozinho conforme o streaming entra e sai.
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for (const g of gGroups) {
    minX=Math.min(minX,g.cx-g.rad); maxX=Math.max(maxX,g.cx+g.rad);
    minZ=Math.min(minZ,g.cz-g.rad); maxZ=Math.max(maxZ,g.cz+g.rad);
  }
  frame0(Math.max(4, Math.round(Math.max(maxX-minX, maxZ-minZ)/TILE_M)));

  // A malha viaria inteira, fina, numa unica chamada de desenho: da contexto pro
  // que ainda nao montou e permite tracar rota atravessando a cidade sem exigir
  // que a cidade toda esteja construida.
  const ctx = buildStreetContext(R);
  if (ctx) { gRoad.add(ctx); }

  // Comeca olhando um bairro, nao a cidade: o enquadramento de cidade inteira do
  // v3 mostraria chao vazio. Valor absoluto, nao fracao de STREAM_R -- o raio de
  // montagem existe pra o usuario PODER afastar, nao pra ele comecar longe.
  sph.radius = Math.min(sph.radius, 480);
  streamReady = true;
  streamUpdate(true);

  phase.classList.remove("off");
  progTxt.textContent = `${gGroups.length} grupos · ${label}`;
  hideStatus();
}

''' + s[b:]
    patches += 1
    print(f"  [{patches}] loadCity() monta sob demanda")

    # 8. limite de zoom: nao adianta afastar alem do que o streaming monta
    s = s.replace("Math.min(HALF*4, sph.radius", "Math.min(zoomMax(), sph.radius")
    patches += 1
    print(f"  [{patches}] teto de zoom: HALF*4 -> zoomMax()")
    s = sub(s, "const STREAM_MS   = 6;",
"""const STREAM_MS   = 6;
// Afastar alem do que o streaming monta so mostraria chao vazio, entao o teto de
// zoom e amarrado ao raio -- e a decisao de produto ("mostrar so uma regiao")
// vira uma constante, nao uma regra espalhada pelo controle de camera.
function zoomMax() { return STREAM_R * 0.85; }

// Muda o alcance em tempo de execucao e refaz o conjunto vivo na hora: encolher
// descarta o excedente no mesmo instante, crescer enfileira o que falta.
function setStreamRadius(m) { STREAM_R = Math.max(150, m); streamUpdate(true); }""", "teto de zoom amarrado ao raio")

    # 9. a orbita da camera acompanha o relevo
    s = sub(s, "  camera.position.setFromSpherical(sph).add(target);",
"""  // v4: o alvo da orbita segue o relevo. O target nasce sempre com y=0
  // (target.set(p.x, 0, p.z)), mas o chao e deslocado pra cima por
  // terrainY()*reliefAmount -- e terrainY ja embute TERRAIN_EXAG=4.5. Num bairro
  // alto isso punha o terreno POR CIMA da camera: ela orbitava um ponto no nivel
  // do mar enquanto o chao subia centenas de metros, e a cena ficava tapada.
  // Afastar a camera nao resolveria, so afastaria um ponto que continua enterrado.
  target.y = terrainY(target.x, target.z) * reliefAmount;
  camera.position.setFromSpherical(sph).add(target);""",
        "orbita acompanha o relevo")

    # 10. laco de render chama o streaming
    s = sub(s, "  updatePois();\n  renderer.render(scene, camera);",
"""  updatePois();
  streamUpdate(false);   // alvo mudou? recalcula o conjunto vivo
  streamPump();          // gasta ate STREAM_MS montando o que falta
  renderer.render(scene, camera);""", "laco de render puxa o streaming")

    io.open(OUT, "w", encoding="utf-8").write(s)
    print(f"\nv4: {len(s)/1048576:.1f} MB -> {OUT}")


    # --bench: copia instrumentada pra medir. A pagina monta a cidade dentro de
    # requestAnimationFrame, e rAF e estrangulado em aba oculta / painel nao
    # composto -- sem o shim a tela trava em "Reconstruindo a cidade" pra sempre
    # e parece bug do codigo, mas o v3 sem alteracao nenhuma trava igual.
    # Sob o shim o WebGL desenha (da pra ler pixel com gl.readPixels), mas
    # screenshot falha e transicao CSS congela: getComputedStyle mente nesse modo.
    if "--bench" in sys.argv:
        shim = ('<script>window.requestAnimationFrame=function(cb){return setTimeout('
                'function(){cb(performance.now())},0)};'
                'window.cancelAnimationFrame=clearTimeout;</script>' + chr(10))
        b = s.replace("<title>", shim + "<title>", 1)
        expose = (chr(10) + "window.__M={renderer,scene,camera,THREE,"
                  "gr:()=>gGroups,gl:()=>gLive,sq:()=>streamQ,tgt:()=>target,sph:()=>sph,"
                  "terr:()=>terrainRegistry.length,ris:()=>risers.length,"
                  "parc:()=>parcels.length,ty:(x,z)=>terrainY(x,z),rel:()=>reliefAmount,"
                  "eg:()=>elevGrid,tog:()=>$('tRelief'),setR:m=>setStreamRadius(m),"
                  "gb:()=>gBuild.children.length,gro:()=>gRoad.children.length};"
                  + chr(10) + "boot();")
        assert chr(10) + "boot();" in b
        b = b.replace(chr(10) + "boot();", expose, 1)
        bp = os.path.join(BASE, "__bench4.html")
        io.open(bp, "w", encoding="utf-8").write(b)
        print("bench: " + bp + "  (apagar depois de medir)")


if __name__ == "__main__":
    main()
