# -*- coding: utf-8 -*-
"""
Gera "teste melhoria grafica/sao-carlos-tipologia.html" por patch sobre o v5.

Mesma disciplina do make_v4.py / make_v5.py: replace ancorado em texto exato,
que falha alto se o v5 mudar de forma. O v5 continua sendo a fonte -- este
diretorio e um teste grafico, nao um fork.

Nada no city.json precisou mudar pra este teste, e esse e o ponto -- tipologia,
telhado e fachada saem todos de coisas que ja estavam no dado (contorno, altura,
classe de uso). E o mesmo truque do Global Rescue: o Overture entrega poligono e
altura, e o resto o gerador inventa com regra, nao com dado novo.

SAIDA PADRAO: um arquivo so, que abre com DUPLO CLIQUE.

  Em file:// o fetch e bloqueado pela origem opaca -- o navegador trata cada
  arquivo local como origem propria, entao a pagina nao consegue ler o
  city.json do lado. Script classico (<script src>) nao passa por essa regra,
  mas o city.json nao e script. Entao a versao de duplo clique leva TUDO
  dentro: a base da cidade, o three.js e o earcut. Sem servidor e sem internet.

  O preco e o que o v5 tinha acabado de ganhar: a pagina volta de 124 KB pra
  ~7,6 MB, e cada aba aberta carrega a sua propria copia em vez de compartilhar
  um download so. Por isso a versao servida continua sendo gerada com --servido.

  python "teste melhoria grafica/make_fachadas.py"
  python "teste melhoria grafica/make_fachadas.py" --servido  # + versao leve, exige servidor
  python "teste melhoria grafica/make_fachadas.py" --bench    # + copia instrumentada
"""
import io, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SRC  = os.path.join(ROOT, "v5", "sao-carlos-v5.html")
CITY = os.path.join(ROOT, "v5", "sao-carlos-v5.city.json")
OUT  = os.path.join(BASE, "sao-carlos-tipologia.html")
OUT_SRV = os.path.join(BASE, "sao-carlos-tipologia-servido.html")

patches = 0
def sub(s, old, new, what):
    global patches
    if s.count(old) != 1:
        raise SystemExit("ancora nao unica (%dx): %s" % (s.count(old), what))
    patches += 1
    print("  [%d] %s" % (patches, what))
    return s.replace(old, new)

def rd(name):
    return io.open(os.path.join(BASE, name), encoding="utf-8").read()


def offline(s):
    """Transforma a pagina servida na versao de duplo clique.

    Tres coisas saem da rede e entram no arquivo: as bibliotecas (CDN), a base
    da cidade (fetch) e o caminho de leitura no boot(). Em file:// nenhuma
    requisicao XHR/fetch passa -- cada arquivo local e uma origem opaca --, mas
    <script src> local passa, e conteudo ja embutido nem precisa passar.
    """
    global patches

    # a. bibliotecas por dentro, no lugar dos quatro <script src> de CDN (dois
    #    principais + dois fallback, que deixam de fazer sentido embutidos).
    a = s.index('<script src="https://cdnjs')
    b = s.index("<style>")
    libs = ("<!-- three.js r128 (MIT) e earcut 2.2.4 (ISC) embutidos: duplo clique\n"
            "     nao pode depender de CDN nem de conexao. -->\n"
            "<script>" + rd("lib/three.min.js") + "</script>\n"
            "<script>" + rd("lib/earcut.min.js") + "</script>\n\n")
    s = s[:a] + libs + s[b:]
    patches += 1
    print("  [%d] three.js + earcut embutidos (%.0f KB)" % (patches, len(libs)/1024))

    # b. a base da cidade volta pra dentro da pagina, no marcador que o v5
    #    deixou quando a tirou de la.
    city = io.open(CITY, encoding="utf-8").read()
    s = sub(s, "<!-- v5: a base da cidade agora e um arquivo separado, "
               "baixado em runtime (ver CITY_FILE) -->",
            '<script type="application/json" id="__citydata">' + city + "</script>",
            "base da cidade embutida (%.1f MB)" % (len(city)/1048576))

    # c. grade de relevo embutida (ver grade_relevo.py). Sem ela o botao
    #    "Relevo" dependeria da open-elevation, que em file:// parte de origem
    #    opaca e sem internet nao responde de jeito nenhum -- o botao ficaria
    #    morto justamente na versao de duplo clique. Sao 1.936 numeros.
    rel = os.path.join(BASE, "relevo.json")
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
  // A grade ja vem dentro da pagina (gerada por grade_relevo.py, com o mesmo
  // centro, a mesma extensao e a mesma mediana 3x3 que fetchElevation faria).
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
        print("      (sem relevo.json -- rode grade_relevo.py pra o botao Relevo"
              " funcionar offline)")

    # d. boot() le o que esta dentro da pagina antes de tentar a rede. O fetch
    #    continua vivo pro caso de alguem pedir outra cidade por ?city=.
    s = sub(s, """async function boot() {
  frame0(4);
  stK.textContent = "Baixando a base da cidade";""",
"""async function boot() {
  frame0(4);
  // Duplo clique abre em file://, e ali fetch e bloqueado pela origem opaca --
  // o navegador trata cada arquivo local como um site diferente. Por isso a
  // base vai embutida na pagina, e a rede so entra em cena se alguem pedir
  // outra cidade por ?city=.
  const embutida = document.getElementById("__citydata");
  if (embutida && !new URLSearchParams(location.search).get("city")) {
    stK.textContent = "Reconstruindo a cidade";
    stM.textContent = "base embutida na pagina";
    stI.style.width = "45%";
    await new Promise(r => setTimeout(r, 50));
    try {
      loadCity(JSON.parse(embutida.textContent), "base embutida");
      return;
    } catch (e) {
      console.error("Base embutida invalida, tentando pela rede:", e);
    }
  }
  stK.textContent = "Baixando a base da cidade";""",
            "boot() le a base embutida antes da rede")
    return s


def main():
    global patches
    if not os.path.exists(SRC):
        raise SystemExit("v5 nao encontrado: %s (rode v5/make_v5.py antes)" % SRC)
    s = io.open(SRC, encoding="utf-8").read()
    print("v5: %.0f KB" % (len(s)/1024))
    print("aplicando patches:")

    # 1. marcador de versao
    s = sub(s, "<title>São Carlos — mapa 3D (v5)</title>",
               "<title>São Carlos — mapa 3D (v5 + tipologia)</title>",
               "titulo")

    # 2. le a MESMA base do v5, sem copiar 6,5 MB pra ca
    s = sub(s, 'const CITY_FILE = "sao-carlos-v5.city.json";',
               'const CITY_FILE = "../v5/sao-carlos-v5.city.json";',
               "CITY_FILE aponta pra base do v5")

    # 3. secao 5 inteira: tipologia + novo buildBuildings
    a = s.index("/* ============================================================\n"
                "   5. Geometria a partir dos registros")
    b = s.index("function buildRibbons(recs, y, mul) {")
    old = (b - a)
    s = s[:a] + rd("tipologia.js") + "\n" + rd("predios.js") + "\n" + s[b:]
    patches += 1
    print("  [%d] secao 5 substituida: %d -> %d caracteres" % (patches, old, len(rd("tipologia.js")) + len(rd("predios.js"))))

    # 4. shader de fachada por tipologia
    a = s.index("function facadeMaterial(u) {")
    b = s.index("function riseLine(u) {")
    s = s[:a] + rd("fachada.js") + "\n" + s[b:]
    patches += 1
    print("  [%d] facadeMaterial() -> versao com aStyle" % patches)

    # 5. espaco de cor da saida
    # Achado no meio do caminho, e o que mais muda a imagem: o v5 renderiza com
    # outputEncoding = LinearEncoding (padrao do three.js r128). O valor linear
    # vai direto pro framebuffer e o monitor le como se fosse sRGB, o que esmaga
    # todo meio-tom. Parede quase branca sobrevive; telha, laje, vidro e metal
    # caem pra quase preto -- por isso o v5 parece uma cidade de caixas de
    # isopor com tampa preta. Nao adianta diferenciar material se o material nao
    # chega na tela. Uma linha devolve os meios-tons.
    #   ?srgb=0 na URL volta ao comportamento do v5, pra comparar lado a lado.
    s = sub(s, "scene.fog = new THREE.Fog(K.void, 1400, 5500);",
"""scene.fog = new THREE.Fog(K.void, 1400, 5500);
// Ver make_fachadas.py, patch 5: sem isto a paleta de telhado e fachada nao
// chega na tela. ?srgb=0 volta ao espaco de cor do v5.
if (new URLSearchParams(location.search).get("srgb") !== "0") {
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Cor de limpeza e cor de neblina NAO passam pela conversao de saida -- vao
  // cruas pro framebuffer. Se so o resto clareia, o fundo (que tambem e o que
  // aparece no miolo dos quarteiroes, onde nao ha malha de chao) vira um buraco
  // preto. Aqui o mesmo tom vai ja convertido, pra continuar combinando.
  const VOID2 = 0x59636F;
  renderer.setClearColor(VOID2);
  scene.fog.color.setHex(VOID2);
}""",
        "saida em sRGB + fundo reajustado (?srgb=0 volta ao v5)")

    # 6. a ficha do imovel passa a dizer a tipologia derivada
    s = sub(s, '  $("shTag").textContent = LABEL[p.cls];',
               '  $("shTag").textContent = p.tipo ? p.tipo + " · " + LABEL[p.cls] : LABEL[p.cls];',
               "ficha mostra a tipologia")

    # --servido: a versao leve do v5, que exige um servidor HTTP porque le o
    # city.json por fetch. Fica pra quando a pagina voltar a ser servida.
    if "--servido" in sys.argv:
        io.open(OUT_SRV, "w", encoding="utf-8").write(s)
        print("\nversao servida: %.0f KB -> %s" % (len(s)/1024, OUT_SRV))
        print("  python -m http.server 8777   (na raiz do projeto)")
        print("  http://localhost:8777/teste%20melhoria%20grafica/sao-carlos-tipologia-servido.html")

    # ---- versao de duplo clique -------------------------------------------
    s = offline(s)
    io.open(OUT, "w", encoding="utf-8").write(s)
    print("\nduplo clique: %.1f MB -> %s" % (len(s)/1048576, OUT))
    print("  abre direto no navegador, sem servidor e sem internet")

    # --bench: mesma copia instrumentada do v4. A pagina monta a cidade dentro de
    # requestAnimationFrame, que e estrangulado em aba oculta / painel nao
    # composto -- sem o shim a tela trava em "Reconstruindo a cidade" pra sempre
    # e parece bug, mas o v5 sem alteracao nenhuma trava igual.
    if "--bench" in sys.argv:
        shim = ('<script>window.requestAnimationFrame=function(cb){return setTimeout('
                'function(){cb(performance.now())},0)};'
                'window.cancelAnimationFrame=clearTimeout;</script>' + chr(10))
        b2 = s.replace("<title>", shim + "<title>", 1)
        expose = (chr(10) + "window.__M={renderer,scene,camera,THREE,"
                  "gr:()=>gGroups,gl:()=>gLive,sq:()=>streamQ,tgt:()=>target,sph:()=>sph,"
                  "terr:()=>terrainRegistry.length,ris:()=>risers.length,"
                  "parc:()=>parcels,ty:(x,z)=>terrainY(x,z),rel:()=>reliefAmount,"
                  "eg:()=>elevGrid,tog:()=>$('tRelief'),setR:m=>setStreamRadius(m),"
                  "gb:()=>gBuild.children.length,gro:()=>gRoad.children.length,"
                  "tipo:(c,h,a,r)=>tipoDe(c,h,a,r),obb:(r,a)=>obbOf(r,a),STN:ST_NOME};"
                  + chr(10) + "boot();")
        assert chr(10) + "boot();" in b2
        b2 = b2.replace(chr(10) + "boot();", expose, 1)
        bp = os.path.join(BASE, "__bench_tipologia.html")
        io.open(bp, "w", encoding="utf-8").write(b2)
        print("bench: " + bp + "  (apagar depois de medir)")


if __name__ == "__main__":
    main()
