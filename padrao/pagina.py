# -*- coding: utf-8 -*-
"""Sonda dentro da PÁGINA: roda um JS no HTML pronto e devolve o que ele mediu.

Existe porque alguns defeitos só aparecem no artefato final. O muro seguir o relevo,
por exemplo, é decidido no `buildMuros` do renderizador — medir isso em Python seria
reimplementar a regra do renderizador em outro lugar, que é exatamente o vício que
este projeto está tentando matar. Aqui a medição é feita no navegador, lendo a
geometria que o usuário vê.

Chrome headless com WebGL por software. `CHROME` pode ser trocado pelo ambiente.
"""
import io, json, os, subprocess, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
AQUI = os.path.dirname(os.path.abspath(__file__))

# `terrainY`, `target` e afins são bindings de topo do script principal: outro <script>
# não os enxerga. A cópia de sonda exporta por texto o que for preciso.
EXPORTA = {
    "terrainY": ("function registerTerrain(geo) {",
                 "(window.__qa=window.__qa||{}).terrainY=terrainY;"),
    # `scene` e `const` de topo: outro <script> nao enxerga. Sem isto a sonda de
    # arvore morre com "scene is not defined" e devolve None -- que o portao leria
    # como "nao medido" em vez de erro.
    # `monta` existe porque `--virtual-time-budget` adianta os temporizadores sem
    # dar CPU: esperar por setTimeout enquanto o streaming monta um quarteirao a
    # cada quadro devolvia pagina em branco em uma tentativa de cada duas. A sonda
    # drena a fila ela mesma, de forma sincrona, e a medida vira deterministica.
    "cena": ("function buildTrees(polys, roads) {",
             "(window.__qa=window.__qa||{}).cena=function(){return{scene:scene,"
             "renderer:renderer,camera:camera,target:target,sph:sph,"
             "monta:function(n){streamUpdate(true);n=n||60;"
             "while(streamQ.length&&n-->0)buildGroup(streamQ.shift());},"
             "ARV:(typeof ARV!=='undefined'?ARV:null)};};"),
}


def disponivel():
    return os.path.exists(CHROME)


def roda(html, js, exporta=("terrainY",), espera_ms=60000, marca="SONDA"):
    """Injeta `js` no fim do HTML e devolve o objeto do primeiro `console.log("<marca> {...}")`.

    Devolve None se a sonda não responder (sem Chrome, erro de JS, prazo curto)."""
    if not disponivel(): return None
    s = io.open(html, encoding="utf-8", errors="replace").read()
    for nome in exporta:
        anc, ins = EXPORTA[nome]
        if s.count(anc) != 1: return None
        s = s.replace(anc, ins + chr(10) + anc)
    s += "\n<script>\n" + js + "\n</script>\n"
    tmp = os.path.join(AQUI, "_sonda.html"); png = os.path.join(AQUI, "_sonda.png")
    io.open(tmp, "w", encoding="utf-8").write(s)
    ud = tempfile.mkdtemp(prefix="padraosonda")
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=900,600", "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader", "--hide-scrollbars",
                            # --screenshot: sem ele a pagina nao compoe frames e o rAF
                            # fica estrangulado. Ver [[mapa-3d-raf-aba-oculta]].
                            "--screenshot=" + png,
                            "--virtual-time-budget=%d" % espera_ms,
                            "--enable-logging=stderr", "--log-level=0",
                            "file:///" + tmp.replace("\\", "/")],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if marca + " " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index(marca + " ") + len(marca) + 1:])[0]
            except Exception:
                pass
    return None


# ------------------------------------------------------------------ sondas
JS_MURO_NO_CHAO = """
(function(){
  // Para cada vertice do muro: o deslocamento de relevo gravado nele (dy) bate com o
  // relevo daquele ponto? A diferenca e o quanto aquele pedaco de muro fica fora do
  // chao com o Relevo ligado.
  function tenta(){
    var m = window.__gMuros, TY = window.__qa && window.__qa.terrainY;
    if (!TY) { console.log("SONDA {\\"erro\\":\\"terrainY nao exportado\\"}"); return; }
    if (!m || !m.geometry || !m.geometry.userData.terrain) return setTimeout(tenta, 500);
    var g = m.geometry, pos = g.attributes.position, dy = g.userData.terrain.dy, n = pos.count;
    var passo = Math.max(1, Math.floor(n/200000)), e = [], pior = 0, soma = 0, k = 0;
    for (var i = 0; i < n; i += passo){
      var d = Math.abs(dy[i] - TY(pos.getX(i), pos.getZ(i)));
      e.push(d); soma += d; if (d > pior) pior = d; k++;
    }
    e.sort(function(a,b){ return a-b; });
    function p(q){ return e[Math.min(e.length-1, Math.floor(e.length*q))]; }
    console.log("SONDA " + JSON.stringify({ vertices:n, amostrados:k, media:soma/k,
      p50:p(0.5), p90:p(0.9), p99:p(0.99), max:pior,
      fora_do_chao: e.filter(function(x){ return x > 1.1; }).length / k }));
  }
  tenta();
})();
"""


JS_ARVORES = """
(function(){
  // Devolve o PE de cada arvore de rua que a pagina plantou, mais o custo da cena.
  // Quem julga se o pe caiu na calcada e o Python, com a fita de `padrao/vias.py` --
  // a unica implementacao da largura da rua.
  function tenta(n){
    var Q = window.__qa && window.__qa.cena;
    if (!Q) { console.log("SONDA {\\"erro\\":\\"cena nao exportada\\"}"); return; }
    var C = Q();
    // o streaming so comeca depois que a base da cidade foi decodificada
    try { C.monta(80); } catch (e) { if (n < 80) return setTimeout(function(){ tenta(n+1); }, 250); }
    var g = C.scene.getObjectByName("arvores");
    var pes = (g && g.userData.pesRua) || [];
    if (!pes.length && n < 80) return setTimeout(function(){ tenta(n+1); }, 250);
    var esp = 0, arv = 0, tris = 0;
    if (g) g.traverse(function(o){
      if (!o.isInstancedMesh || !o.count) return;
      esp++; arv += o.count; tris += o.count * o.geometry.attributes.position.count/3;
    });
    console.log("SONDA " + JSON.stringify({ especies_vivas: esp, arvores: arv,
      tris_arvores: Math.round(tris), catalogo: C.ARV ? C.ARV.cat.length : 0,
      pes: pes.map(function(p){ return [Math.round(p[0]*100)/100, Math.round(p[1]*100)/100]; }) }));
  }
  tenta(0);
})();
"""
