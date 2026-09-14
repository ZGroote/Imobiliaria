# -*- coding: utf-8 -*-
"""QA visual do mapa 3D: copia o HTML injetando uma camera fixa e tira screenshot
com Chrome headless (WebGL por software). Ver [[mapa-3d-duplo-clique]]."""
import io, os, sys, subprocess, tempfile, shutil

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
HERE = os.path.dirname(os.path.abspath(__file__))

def shot(src, out, tx, tz, rad=900, phi=1.02, theta=0.55, wait=9000, w=1600, h=1000):
    s = io.open(src, encoding="utf-8").read()
    cam = """
<style>body > div { display: none !important; }</style>
<script>
// QA: camera fixa. `target`/`sph` sao bindings lexicais de topo do script
// classico anterior, entao este <script> enxerga os dois. Reaplica em laco
// porque frame0() do loadCity reseta os dois DEPOIS do boot.
setInterval(function(){
  var q = window.__qa; if (!q) return;
  q.target.set(%f, 0, %f); q.sph.set(%f, %f, %f);
}, 250);
</script>
""" % (tx, tz, rad, phi, theta)
    # `target`/`sph` nao estao no escopo lexical global (o script principal e
    # embrulhado), entao a copia de QA exporta os dois em window.__qa.
    for anc, nome in (("const target = new THREE.Vector3();", "target"),
                      ("const sph = new THREE.Spherical(900, 0.98, 0.55);", "sph")):
        assert s.count(anc) == 1, "ancora nao unica: " + nome
        s = s.replace(anc, anc + "(window.__qa=window.__qa||{}).%s=%s;" % (nome, nome))
    s = (s.replace("</body>", cam + "</body>", 1) if "</body>" in s else s + cam)
    tmp = os.path.join(HERE, "_qa_" + os.path.basename(out).replace(".png", ".html"))
    io.open(tmp, "w", encoding="utf-8").write(s)
    ud = tempfile.mkdtemp(prefix="qachrome")
    # o screenshot precisa ser do arquivo COM camera
    subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                    "--window-size=%d,%d" % (w, h), "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader", "--hide-scrollbars",
                    "--virtual-time-budget=%d" % (wait + 22000),
                    "--screenshot=" + out, "file:///" + tmp.replace("\\", "/")],
                   check=False)
    shutil.rmtree(ud, ignore_errors=True)
    print(out, os.path.getsize(out) if os.path.exists(out) else "FALHOU")

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    tx, tz = float(sys.argv[3]), float(sys.argv[4])
    rad = float(sys.argv[5]) if len(sys.argv) > 5 else 900
    wt  = int(sys.argv[6]) if len(sys.argv) > 6 else 9000
    shot(src, out, tx, tz, rad, wait=wt)
