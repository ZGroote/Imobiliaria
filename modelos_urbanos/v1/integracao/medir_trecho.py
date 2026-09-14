# -*- coding: utf-8 -*-
"""Linha de base dos tres trechos de teste, com camera FIXA.

    python modelos_urbanos/v1/integracao/medir_trecho.py            # A, B e C
    python modelos_urbanos/v1/integracao/medir_trecho.py B
    python modelos_urbanos/v1/integracao/medir_trecho.py A --marca depois

A camera de cada trecho sai de `trechos-<cidade>.json` e nao pode mudar entre uma
medida e a proxima: o plano compara antes/depois no MESMO enquadramento.

O relogio nao pode ser o da pagina. Com `--virtual-time-budget` o Chrome virtualiza
`performance.now()` e ele fica parado enquanto o JS roda -- mesma armadilha ja medida
em `pipeline/mede_minimapa.py`, de onde vem o servidor de marcas. Quem cronometra e o
relogio de parede de um HTTP local; a ida e volta em 127.0.0.1 e descontada.

O numero de quadro sai do rasterizador de software do headless: vale como comparacao
antes/depois na mesma maquina, nao como promessa de ms em maquina de usuario.
"""
import io, json, os, shutil, subprocess, sys, tempfile

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, RAIZ)
from pipeline.mede_minimapa import CHROME, servidor_de_marcas
from pipeline.montar import saida as pagina_de
from padrao.cidade import carrega

AQUI = os.path.dirname(os.path.abspath(__file__))
CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
a = sys.argv[1:]
MARCA = a[a.index("--marca") + 1] if "--marca" in a else "antes"
N = int(a[a.index("--n") + 1]) if "--n" in a else 30
IDS = [x.upper() for x in a if not x.startswith("--") and len(x) == 1]

SONDA = """
<script>
(function () {
  var R = {trecho:"%(id)s"}, N = %(n)d, PORTA = %(porta)d, seq = 0;
  function fim(e) { if (e) R.erro = String(e); console.log("TRECHO " + JSON.stringify(R)); }
  function marca(tag) {
    return new Promise(function (ok) {
      var im = new Image(); im.onload = im.onerror = ok;
      im.src = "http://127.0.0.1:" + PORTA + "/marca?t=" + tag + "&n=" + (++seq);
    });
  }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var I = window.__int, P = window.__perf;
    try {
      I.target.set(%(x)f, 0, %(z)f);
      I.sph.set(%(dist)f, %(phi)f, %(theta)f);
      for (var k = 0; k < 200 && P.bombeia(4000); k++) P.passo();
      P.passo(); P.passo();
      (async function () {
        // Custo da propria medicao: duas marcas sem nada no meio.
        for (var r = 0; r < 3; r++) {
          await marca("base_" + r + "_ini"); await marca("base_" + r + "_fim");
        }
        // MENOR de tres rodadas: a primeira paga o JIT e qualquer uma pode pegar GC.
        for (var r2 = 0; r2 < 3; r2++) {
          await marca("quadro_" + r2 + "_ini");
          for (var i = 0; i < N; i++) P.renderer.render(P.scene, P.camera);
          await marca("quadro_" + r2 + "_fim");
        }
        var inf = P.renderer.info;
        R.chamadas = inf.render.calls;
        R.triangulos = inf.render.triangles;
        R.geometrias = inf.memory.geometries;
        R.texturas = inf.memory.textures;
        R.programas = inf.programs ? inf.programs.length : null;
        R.quarteiroes_vivos = I.vivos().size;
        R.biblioteca = I.urban ? I.urban.stats() : null;
        // Quantos volumes deste enquadramento sao modelo da biblioteca e quantos
        // continuam sendo o desenho anterior: e o numero que a etapa 3 tem que subir.
        var lib = 0, velhos = 0, escalas = [];
        for (const rec of I.vivos().values()) {
          for (const s of rec.urban || []) { lib++; escalas.push(s.scale); }
          for (const o of rec.objs || []) velhos += (o.userData.recs || []).length;
        }
        R.modelos_biblioteca = lib;
        R.volumes_antigos = velhos;
        R.escala_min = escalas.length ? Math.min.apply(null, escalas) : null;
        R.escala_media = escalas.length ? escalas.reduce(function(x,y){return x+y;},0)/escalas.length : null;
        if (performance.memory) {
          R.heap_mb = +(performance.memory.usedJSHeapSize / 1048576).toFixed(1);
        }
        fim();
      })();
    } catch (e) { fim(e && e.stack || e); }
  })(200);
})();
</script>
"""


def roda(t, pagina):
    srv, porta, marcas = servidor_de_marcas()
    html = os.path.abspath(pagina)
    png = os.path.join(AQUI, "trecho-%s-%s.png" % (t["id"], MARCA))
    tmp = os.path.join(AQUI, "trecho-%s.tmp.html" % t["id"])
    io.open(tmp, "w", encoding="utf-8", newline="").write(
        io.open(html, encoding="utf-8", newline="").read()
        + SONDA % dict(id=t["id"], n=N, porta=porta, x=t["x"], z=t["z"],
                       dist=t["dist"], phi=t["phi"], theta=t["theta"]))
    ud = tempfile.mkdtemp(prefix="trecho")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1440,1000", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             "--screenshot=" + png, "--virtual-time-budget=120000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=420)
    finally:
        srv.shutdown()
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass
    log = r.stdout + r.stderr
    io.open(os.path.join(AQUI, "trecho-%s-%s.log" % (t["id"], MARCA)), "w",
            encoding="utf-8").write(log)
    linha = [l for l in log.splitlines() if "TRECHO {" in l]
    if not linha:
        raise SystemExit("trecho %s: a sonda nao respondeu (ver o .log)" % t["id"])
    # o Chrome cola `", source: file:///..."` no fim da linha de console
    d, _ = json.JSONDecoder().raw_decode(linha[-1].split("TRECHO ", 1)[1])
    if d.get("erro"):
        raise SystemExit("trecho %s: %s" % (t["id"], d["erro"]))
    # menor das tres rodadas, ja sem o custo da propria marca
    def menor(tag):
        m = dict(marcas)
        v = []
        for r2 in range(3):
            ini = [t2 for k, t2 in marcas if k.startswith("%s_%d_ini" % (tag, r2))]
            fim = [t2 for k, t2 in marcas if k.startswith("%s_%d_fim" % (tag, r2))]
            if ini and fim:
                v.append(fim[0] - ini[0])
        return min(v) if v else None
    base, quadro = menor("base"), menor("quadro")
    d["ms_quadro"] = round(1000 * max(0.0, quadro - base) / N, 2) if quadro and base is not None else None
    d["png"] = os.path.basename(png)
    return d


def main():
    reg = json.load(open(os.path.join(AQUI, "trechos-%s.json" % CID.slug), encoding="utf-8"))
    pagina = pagina_de("html_comprimido")
    if not os.path.exists(pagina):
        raise SystemExit("pagina nao montada: %s" % pagina)
    alvo = [t for t in reg["trechos"] if not IDS or t["id"] in IDS]
    out = dict(cidade=CID.slug, marca=MARCA, pagina=os.path.relpath(pagina, RAIZ),
               pagina_bytes=os.path.getsize(pagina), n_render=N, trechos=[])
    for t in alvo:
        d = roda(t, pagina)
        d.update(titulo=t["titulo"], x=t["x"], z=t["z"],
                 camera=[t["dist"], t["phi"], t["theta"]])
        out["trechos"].append(d)
        print("%s %-32s %4d chamadas | %8d tri | %3d modelos | %4d volumes antigos | "
              "%5.2f ms/quadro | %6.1f MB heap"
              % (d["trecho"], t["titulo"], d["chamadas"], d["triangulos"],
                 d["modelos_biblioteca"], d["volumes_antigos"],
                 d["ms_quadro"] or 0, d.get("heap_mb") or 0))
    p = os.path.join(AQUI, "medicao-trechos-%s-%s.json" % (CID.slug, MARCA))
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("pagina %s: %.2f MB" % (out["pagina"], out["pagina_bytes"] / 1e6))
    print("-> %s" % p)


if __name__ == "__main__":
    main()
