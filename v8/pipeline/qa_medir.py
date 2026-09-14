# -*- coding: utf-8 -*-
"""Mede o custo de render do mapa 3D num ponto de vista fixo.

Diferencas para o v7/pipeline/qa_medir.py:
  * FORCA um render (renderer.render(scene, camera)) e le o info logo depois,
    em vez de torcer para o rAF ter rodado no instante da leitura -- era isso
    que devolvia `calls=0` com a cena inteira montada;
  * NOMEIA os grupos (gBuild/gLines/gRoad/gRest/gPoi) na copia de QA, para
    quebrar o custo por camada: e a quebra que diz onde vale mexer;
  * imprime JSON, para comparar duas versoes sem olhar screenshot.

  python v8/pipeline/qa_medir.py <html> [tx] [tz] [raio]

Ver [[mapa-3d-qa-headless]]: a cena e em METROS, `target`/`sph` nao estao no
escopo global e `frame0()` reseta a camera DEPOIS do boot (dai o setInterval).
"""
import io, sys, os, json, subprocess, tempfile, shutil

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
HERE = os.path.dirname(os.path.abspath(__file__))

# (ancora, o que exportar). A copia de QA anexa `(window.__qa=...).X = X;`.
EXPORTA = [
    ("const target = new THREE.Vector3();", "target"),
    ("const sph = new THREE.Spherical(900, 0.98, 0.55);", "sph"),
    ('const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, '
     'powerPreference:"high-performance", logarithmicDepthBuffer:true });', "renderer"),
    ("const scene = new THREE.Scene();", "scene"),
    ("const camera = new THREE.PerspectiveCamera(40, 1, 2, 40000);", "camera"),
]
# nomear os grupos: sem isso todo predio cai num balaio "outros"
NOMES = ("scene.add(gBuild, gLines, gRoad, gRest);",
         "scene.add(gBuild, gLines, gRoad, gRest);"
         'gBuild.name="predios";gLines.name="linhas";gRoad.name="ruas";gRest.name="verde";')

SONDA = r"""
<style>body > div { display:none !important; }</style>
<script>
(function(){
  var q = window.__qa; if (!q) return;
  window.addEventListener("error", function(e){
    console.log("QAv ERRO " + (e.message||"") + " @" + (e.lineno||0)); });
  // frame0() reseta target/sph DEPOIS do boot; dai reaplicar em laco
  setInterval(function(){ q.target.set(TX,0,TZ); q.sph.set(RAD,1.02,0.55); }, 250);
  // espera a cidade PARAR de crescer (o streaming monta em fatias dentro do rAF)
  // em vez de um timeout fixo: com prazo curto a medida sai de uma carga parcial
  // e a comparacao entre duas versoes deixa de valer.
  var ant = -1, quieto = 0, t0 = Date.now();
  var vigia = setInterval(function(){
    var n = 0;
    q.scene.traverse(function(o){ if (o.geometry) n++; });
    // so comeca a contar sossego DEPOIS que o primeiro quarteirao entrou: entre o
    // fim dos POIs e o comeco do streaming a cena fica parada por dezenas de
    // segundos (decode da base), e medir ai da uma cidade vazia.
    var g = q.scene.getObjectByName("predios");
    var comecou = g && g.children.length > 0;
    console.log("QAv t=" + ((Date.now()-t0)/1000|0) + " malhas=" + n
      + " predios=" + (g ? g.children.length : -1)
      + " filhos=" + q.scene.children.map(function(c){
          return (c.name||c.type) + ":" + (c.children ? c.children.length : 0); }).join(","));
    quieto = (comecou && n === ant) ? quieto + 1 : 0;
    ant = n;
    if (quieto < 3 && Date.now() - t0 < ESPERA) return;
    clearInterval(vigia);
    medir();
  }, 2000);
  function medir(){
    var seen = new Set(), por = {}, bytes = 0, verts = 0;
    function rotulo(o){
      // o v5 marca `poi`/`ground` na GEOMETRIA em alguns pontos e no OBJETO em
      // outros; olhar so o objeto jogava os 46 pinos de POI no balaio "outros".
      var gu = (o.geometry && o.geometry.userData) || {};
      if (gu.poi) return "poi";
      for (var p = o; p; p = p.parent) {
        var u = p.userData || {};
        if (u.muros)  return "muros";
        if (u.arrows) return "setas";
        if (u.poi)    return "poi";
        if (u.ground) return p.renderOrder === -1 ? "rua" : "chao";
        if (p.name)   return p.name;
      }
      return o.isInstancedMesh ? "arvores" : "outros";
    }
    q.scene.traverse(function(o){
      var g = o.geometry; if (!g) return;
      var r = rotulo(o), e = por[r] || (por[r] = { malhas:0, visivel:0, verts:0, MB:0 });
      e.malhas++; if (o.visible) e.visivel++;
      if (seen.has(g.uuid)) return; seen.add(g.uuid);
      var b = 0;
      for (var k in g.attributes) {
        var a = g.attributes[k]; b += a.array.byteLength;
        if (k === "position") { e.verts += a.count; verts += a.count; }
      }
      if (g.index) b += g.index.array.byteLength;
      e.MB += b/1048576; bytes += b;
    });
    for (var k in por) por[k].MB = +por[k].MB.toFixed(2);
    // conta as chamadas de UM frame nosso: o info.render zera a cada render, e ler
    // "o que o rAF deixou" da 0 sempre que o laco nao rodou no ultimo tick.
    q.renderer.info.reset();
    q.renderer.render(q.scene, q.camera);
    var i = q.renderer.info.render;
    // canal de saida: console.log + --enable-logging=stderr. Nao da pra usar
    // --dump-dom: com ele a pagina nao compoe frames, o rAF fica estrangulado e
    // a cidade nunca chega a ser montada (a medida sai de uma cena vazia).
    console.log("QA" + JSON.stringify({ calls:i.calls, tris:i.triangles,
      verts:verts, attrMB:+(bytes/1048576).toFixed(1), grupos:por }));
  }

})();
</script>
"""


# 80 s bastava na pagina de 11 MB; na de 12,5 MB o decode estourava o prazo e a sonda
# devolvia uma cidade AINDA NAO montada (calls=46, zero predio) sem reclamar de nada.
def medir(src, tx=-950.0, tz=150.0, rad=260.0, espera=200000, w=1600, h=1000):
    s = io.open(src, encoding="utf-8").read()
    for anc, nome in EXPORTA:
        if s.count(anc) != 1:
            raise SystemExit("ancora nao unica (%dx): %s" % (s.count(anc), nome))
        s = s.replace(anc, anc + "(window.__qa=window.__qa||{})." + nome + "=" + nome + ";")
    if s.count(NOMES[0]) != 1:
        raise SystemExit("ancora dos grupos nao unica")
    s = s.replace(*NOMES)
    s += (SONDA.replace("TX", repr(tx)).replace("TZ", repr(tz))
               .replace("RAD", repr(rad)).replace("ESPERA", str(espera)))
    tmp = os.path.join(HERE, "_medir.html")
    png = os.path.join(HERE, "_medir.png")
    io.open(tmp, "w", encoding="utf-8").write(s)
    ud = tempfile.mkdtemp(prefix="qamedir")
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=%d,%d" % (w, h), "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader",
                            "--virtual-time-budget=%d" % (espera + 30000),
                            # --screenshot junto com --dump-dom: sem ele a pagina nao
                            # compoe frames e o rAF fica estrangulado (aba oculta).
                            # --screenshot: sem ele a pagina nao COMPOE frames, o
                            # requestAnimationFrame fica estrangulado e a cidade nunca
                            # e montada. Ver [[mapa-3d-raf-aba-oculta]].
                            "--screenshot=" + png,
                            "--enable-logging=stderr", "--log-level=0",
                            "file:///" + tmp.replace("\\", "/")],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "QAv " in ln and os.environ.get("QA_DEBUG"):
            print("   " + ln[ln.index("QAv "):][:160])
        i = ln.find("QA{")
        if i >= 0:
            # o log do Chrome ainda cola ", source: file://..." depois da mensagem
            return json.JSONDecoder().raw_decode(ln[i + 2:])[0]
    raise SystemExit("sonda nao respondeu (aumente a espera)")


def imprime(src, d):
    print("%-24s %.1f MB de pagina" % (os.path.basename(src), os.path.getsize(src) / 1048576))
    print("  calls=%d  tris=%d  verts=%d  attr=%.1f MB"
          % (d["calls"], d["tris"], d["verts"], d["attrMB"]))
    print("  %-10s %10s %10s %9s" % ("camada", "vis/malhas", "verts", "MB"))
    for k, v in sorted(d["grupos"].items(), key=lambda kv: -kv[1]["MB"]):
        print("  %-10s %5d/%-4d %10d %8.2f" % (k, v["visivel"], v["malhas"], v["verts"], v["MB"]))
    # medida sem predio nenhum e cidade que nao terminou de montar, nao cidade barata.
    # Comparar duas versoes com uma dessas no meio da conta e pior que nao medir.
    if not d["grupos"].get("predios", {}).get("malhas"):
        print("  !! NENHUM PREDIO na cena: a medida NAO vale. Aumente `espera`.")


if __name__ == "__main__":
    src = sys.argv[1]
    tx  = float(sys.argv[2]) if len(sys.argv) > 2 else -950.0
    tz  = float(sys.argv[3]) if len(sys.argv) > 3 else 150.0
    rad = float(sys.argv[4]) if len(sys.argv) > 4 else 260.0
    d = medir(src, tx, tz, rad)
    imprime(src, d)
    io.open(os.path.join(HERE, "_ultima_medida.json"), "w", encoding="utf-8").write(
        json.dumps({"arquivo": src, "MB": os.path.getsize(src)/1048576, **d}, ensure_ascii=False))
