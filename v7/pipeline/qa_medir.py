# -*- coding: utf-8 -*-
"""Mede custo de render do mapa 3D num ponto de vista fixo: draw calls,
triangulos e bytes de atributo das malhas vivas."""
import io, sys, subprocess, tempfile, shutil, os
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
s = io.open(src, encoding="utf-8").read()
for anc, nome in (("const target = new THREE.Vector3();", "target"),
                  ("const sph = new THREE.Spherical(900, 0.98, 0.55);", "sph"),
                  ('const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:"high-performance", logarithmicDepthBuffer:true });', "renderer"),
                  ("const scene = new THREE.Scene();", "scene")):
    assert s.count(anc) == 1, nome
    s = s.replace(anc, anc + "(window.__qa=window.__qa||{})." + nome + "=" + nome + ";")
s += """
<style>body > div { display:none !important; }</style>
<script>
setInterval(function(){var q=window.__qa; if(q){q.target.set(-950,0,150); q.sph.set(260,1.02,0.55);}},250);
setTimeout(function(){
  var q=window.__qa, bytes=0, verts=0, seen=new Set();
  q.scene.traverse(function(o){
    var g=o.geometry; if(!g||seen.has(g.uuid))return; seen.add(g.uuid);
    for(var k in g.attributes){var a=g.attributes[k];
      bytes+=a.array.byteLength; if(k==="position")verts+=a.count;}
  });
  var i=q.renderer.info.render;
  document.title="calls="+i.calls+" tris="+i.triangles+" verts="+verts+" attrMB="+(bytes/1048576).toFixed(1);
}, 55000);
</script>"""
tmp = os.path.join(HERE, "_medir.html")
io.open(tmp, "w", encoding="utf-8").write(s)
ud = tempfile.mkdtemp()
out = subprocess.run([CHROME, "--headless=new", "--user-data-dir="+ud, "--window-size=1600,1000",
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--virtual-time-budget=80000",
  "--dump-dom", "file:///" + tmp.replace("\\","/")], capture_output=True, text=True, encoding="utf-8", errors="replace")
shutil.rmtree(ud, ignore_errors=True)
for ln in (out.stdout or "").splitlines():
    if "<title>" in ln: print(ln.strip()[:200])
