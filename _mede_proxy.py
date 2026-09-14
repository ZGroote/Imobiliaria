# -*- coding: utf-8 -*-
"""Mede se o FOOTPRINT presta como malha de individualizacao.

A pergunta e uma so: mirando um predio, o raycast devolve AQUELE predio?

E o mesmo caminho que o `cliqueNaCidade` usa -- a malha do quarteirao e
mesclada, entao nao ha um objeto por predio; quem devolve a identidade e o
`presetCenter` (o centroide gravado por vertice) casado com a lista `recs`.
A sonda refaz esse caminho e confere contra o alvo pretendido.

  python _mede_proxy.py ribeirao-preto          # a casa gerada (146 mil)
  python _mede_proxy.py ribeirao-preto-proxy    # o footprint real (285 mil)
"""
import io, json, os, shutil, subprocess, sys, tempfile

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO

SONDA = """
<script>
(function () {
  var R = {};
  function fim(e) { if (e) R.erro = e; console.log("PROXY " + JSON.stringify(R)); }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var I = window.__int, P = window.__perf, TH = window.THREE;
    // seca a fila: o que nao montou nao tem malha pra acertar
    for (var k = 0; k < 80 && P.bombeia(4000); k++) P.passo();
    P.passo(); P.passo();

    R.grupos = I.grupos().length;
    R.vivos  = I.vivos().size;

    // as malhas de predio sao as que carregam `recs` (ver assembleInto)
    var malhas = [];
    I.scene.traverse(function (o) {
      if (o.isMesh && o.userData && o.userData.recs) malhas.push(o);
    });
    R.malhas = malhas.length;
    if (!malhas.length) return fim("nenhuma malha de predio na cena");

    var tris = 0, verts = 0;
    for (var i = 0; i < malhas.length; i++) {
      var g = malhas[i].geometry, p = g.attributes.position;
      verts += p.count; tris += p.count / 3;
    }
    R.tris_predio = Math.round(tris);
    R.verts_predio = verts;

    // ---- o teste: mirar um predio e ver se o raycast devolve ELE ------------
    // Reproduz o registroDoHit: face -> presetCenter do vertice a -> registro.
    // Compara por DISTANCIA, nao por id arredondado: `presetCenter` e Float32Array
    // e o centroide daqui e float64 -- arredondar a decimetro faz o mesmo predio
    // cair em dois ids na fronteira do arredondamento. 0,5 m = mesmo predio.
    var TOL = 0.5;
    var rc = new TH.Raycaster(); rc.far = 1e5;
    var baixo = new TH.Vector3(0, -1, 0), org = new TH.Vector3();
    var alvos = [], acertos = 0, erros = 0, vazios = 0, dists = [];

    // amostra predios dos quarteiroes vivos, espalhados
    var recs = [];
    for (var m = 0; m < malhas.length; m++) {
      var lista = malhas[m].userData.recs;
      for (var r = 0; r < lista.length; r += 7) recs.push(lista[r]);
      if (recs.length > 4000) break;
    }
    R.amostra_possivel = recs.length;
    var passo = Math.max(1, Math.floor(recs.length / 400));
    for (var s = 0; s < recs.length; s += passo) {
      var b = recs[s];
      var cx = 0, cz = 0;
      for (var q = 0; q < b.r.length; q++) { cx += b.r[q][0]; cz += b.r[q][1]; }
      cx /= b.r.length; cz /= b.r.length;
      alvos.push([cx, cz]);
      org.set(cx, 3000, cz);
      rc.set(org, baixo);
      var hits = rc.intersectObjects(malhas, false);
      var achou = null;
      for (var h = 0; h < hits.length; h++) {
        var o = hits[h].object, pc = o.geometry.userData.presetCenter, f = hits[h].face;
        if (!pc || !f) continue;
        achou = [pc[f.a * 2], pc[f.a * 2 + 1]];
        break;
      }
      if (!achou) { vazios++; continue; }
      var d = Math.hypot(achou[0] - cx, achou[1] - cz);
      if (d <= TOL) acertos++;
      else { erros++; dists.push(Math.round(d * 10) / 10); }
    }
    R.testados = acertos + erros + vazios;
    R.acertos = acertos; R.erros = erros; R.vazios = vazios;
    dists.sort(function (a, b) { return a - b; });
    R.erro_p50_m = dists.length ? dists[dists.length >> 1] : 0;
    R.erro_p90_m = dists.length ? dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.9))] : 0;
    R.erro_max_m = dists.length ? dists[dists.length - 1] : 0;
    // a que distancia estao os vizinhos errados: <5 m e predio colado (garagem,
    // edicula); >20 m e predio de outro lote, que seria erro grave.
    R.erro_ate_5m = dists.filter(function (v) { return v <= 5; }).length;
    R.erro_5_20m = dists.filter(function (v) { return v > 5 && v <= 20; }).length;
    R.erro_acima_20m = dists.filter(function (v) { return v > 20; }).length;

    // ---- custo de desenho ---------------------------------------------------
    // So os CONTADORES. O tempo nao vale nada aqui: com --virtual-time-budget o
    // Chrome virtualiza performance.now() (ver a nota do mede_minimapa.py).
    var med = P.mede(9, false);
    R.draw_calls = med.calls; R.tris_cena = med.tris;
    fim();
  })(200);
})();
</script>
"""


def roda(html):
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".proxy.html"
    png = html + ".proxy.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="px")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1200,760", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             "--screenshot=" + png, "--virtual-time-budget=180000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "PROXY " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("PROXY ") + 6:])[0]
            except Exception:
                pass
    return None


def main():
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado"); return 2
    slugs = sys.argv[1:] or ["ribeirao-preto", "ribeirao-preto-proxy"]
    saida = {}
    for slug in slugs:
        p = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (slug, VERSAO))
        if not os.path.exists(p):
            print("  %-26s sem pagina montada" % slug); continue
        print("  medindo %s ..." % slug, flush=True)
        d = roda(p)
        if not d or d.get("erro"):
            print("  %-26s %s" % (slug, (d or {}).get("erro", "sem resposta"))); continue
        d["mb_aberto"] = round(os.path.getsize(p) / 1e6, 2)
        z = p.replace("-aberto", "")
        d["mb_zip"] = round(os.path.getsize(z) / 1e6, 2) if os.path.exists(z) else None
        saida[slug] = d
    print()
    linhas = [("pagina comprimida", "mb_zip", "%s MB"), ("pagina aberta", "mb_aberto", "%s MB"),
              ("quarteiroes no total", "grupos", "%s"), ("quarteiroes vivos", "vivos", "%s"),
              ("malhas de predio", "malhas", "%s"),
              ("triangulos de predio", "tris_predio", "%s"),
              ("chamadas de desenho", "draw_calls", "%s"),
              ("triangulos na cena", "tris_cena", "%s"),
              ("--- individualizacao ---", None, None),
              ("predios testados", "testados", "%s"),
              ("acertos (o predio certo, ate 0,5 m)", "acertos", "%s"),
              ("devolveu OUTRO predio", "erros", "%s"),
              ("raio nao bateu em nada", "vazios", "%s"),
              ("  erro ate 5 m (predio colado)", "erro_ate_5m", "%s"),
              ("  erro 5 a 20 m", "erro_5_20m", "%s"),
              ("  erro acima de 20 m (outro lote)", "erro_acima_20m", "%s"),
              ("erro p50 / p90 / max", "erro_p50_m", "%s m"),
              ("  p90", "erro_p90_m", "%s m"),
              ("  max", "erro_max_m", "%s m")]
    cols = list(saida)
    print("  %-36s %s" % ("", "  ".join("%22s" % c for c in cols)))
    for rot, k, fmt in linhas:
        if k is None:
            print("  %-36s" % rot); continue
        vals = []
        for c in cols:
            v = saida[c].get(k)
            vals.append("%22s" % (fmt % (f"{v:,}".replace(",", ".") if isinstance(v, int) else v)
                                  if v is not None else "-"))
        print("  %-36s %s" % (rot, "  ".join(vals)))
    for c in cols:
        d = saida[c]
        if d.get("testados"):
            print("\n  %s: %.1f%% de acerto" % (c, 100.0 * d["acertos"] / d["testados"]))
    io.open("_proxy.json", "w", encoding="utf-8").write(json.dumps(saida, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
