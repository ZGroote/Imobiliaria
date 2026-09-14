# -*- coding: utf-8 -*-
"""Exporta a cena do interior (geometria + materiais + luzes + camera) pra JSON.

Existe pra comparar renderizador com renderizador: a mesma cena, o mesmo enquadramento,
uma vez pelo Three (foto_interior.py) e uma vez pelo Cycles. Reaproveita o gancho
`--patch` do foto_interior, e a pagina devolve o dump por POST num servidor local --
porque `console.log` de 2 MB nao passa pelo log do Chrome.

    python tools/exporta_interior.py sao-carlos --unidade sanca-135-29 --de Sala --para Cozinha
"""
import http.server, json, os, subprocess, sys, threading

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.environ.get("SAIDA_INT", os.path.join(RAIZ, "_interior_dump.json"))
PORTA = 8765
recebido = threading.Event()


class Coletor(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        with open(SAIDA, "wb") as f:
            f.write(self.rfile.read(n))
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        recebido.set()

    def log_message(self, *a):
        pass


PATCH = """
setTimeout(function(){
  var meshes = [], texturado = 0, texs = {}, tid = 0;
  // Cada textura vira PNG por canvas.toDataURL. Serve pra imagem carregada e pra
  // CanvasTexture; DataTexture nao tem `width` no elemento, entao vai por putImageData.
  function reg(t) {
    if (!t) return null;
    if (t.__eid === undefined) {
      t.__eid = "t" + (tid++);
      var im = t.image, inf = { id: t.__eid, classe: t.constructor.name,
        rep: [t.repeat.x, t.repeat.y], off: [t.offset.x, t.offset.y],
        wrap: [t.wrapS, t.wrapT], cs: t.colorSpace || "", flipY: t.flipY,
        w: 0, h: 0, png: null };
      try {
        var W = im && (im.width || 0), H = im && (im.height || 0);
        if (W && H) {
          var c = document.createElement("canvas");
          c.width = W; c.height = H;
          var g = c.getContext("2d");
          if (im.data) {
            var idt = g.createImageData(W, H), n = im.data.length / (W * H);
            for (var i = 0; i < W * H; i++) {
              idt.data[i*4]   = im.data[i*n];
              idt.data[i*4+1] = n > 1 ? im.data[i*n+1] : im.data[i*n];
              idt.data[i*4+2] = n > 2 ? im.data[i*n+2] : im.data[i*n];
              idt.data[i*4+3] = n > 3 ? im.data[i*n+3] : 255;
            }
            g.putImageData(idt, 0, 0);
          } else {
            g.drawImage(im, 0, 0);
          }
          inf.w = W; inf.h = H;
          inf.png = c.toDataURL("image/png");
        }
      } catch (e) { inf.erro = String(e); }
      texs[t.__eid] = inf;
    }
    return t.__eid;
  }
  I.INT.raiz.updateMatrixWorld(true);
  I.INT.raiz.traverse(function (o) {
    if (!o.isMesh || !o.geometry || !o.visible) return;
    var g = o.geometry, a = g.attributes;
    if (!a.position) return;
    var m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && (m.map || m.lightMap)) texturado++;
    var r = function (arr, k) {
      var out = new Array(arr.length);
      for (var i = 0; i < arr.length; i++) out[i] = Math.round(arr[i] * k) / k;
      return out;
    };
    // BufferAttribute normalizado guarda 0..255 no array cru e so normaliza na GPU.
    // getX/getY/getZ desnormalizam; ler `.array` direto traz cor 255x maior.
    var lerAttr = function (at, k) {
      var n = at.itemSize, out = new Array(at.count * n), fn = ["getX","getY","getZ","getW"];
      for (var i = 0; i < at.count; i++)
        for (var j = 0; j < n; j++)
          out[i*n+j] = Math.round(at[fn[j]](i) * k) / k;
      return out;
    };
    meshes.push({
      nome: o.name || "",
      pos: r(Array.prototype.slice.call(a.position.array), 1e4),
      nor: a.normal ? lerAttr(a.normal, 1e3) : null,
      uv: a.uv ? lerAttr(a.uv, 1e4) : null,
      uv1: a.uv1 ? r(Array.prototype.slice.call(a.uv1.array), 1e4) : null,
      cor: a.color ? lerAttr(a.color, 1e4) : null,
      corN: a.color ? !!a.color.normalized : false,
      idx: g.index ? Array.prototype.slice.call(g.index.array) : null,
      mw: r(o.matrixWorld.elements.slice(), 1e5),
      mat: m ? {
        cor: m.color ? [m.color.r, m.color.g, m.color.b] : [1,1,1],
        rug: m.roughness === undefined ? 0.8 : m.roughness,
        met: m.metalness === undefined ? 0 : m.metalness,
        op: m.opacity === undefined ? 1 : m.opacity,
        transp: !!m.transparent,
        emis: m.emissive ? [m.emissive.r, m.emissive.g, m.emissive.b] : [0,0,0],
        vcor: !!m.vertexColors,
        temMap: !!m.map, temLM: !!m.lightMap,
        map: reg(m.map), lightMap: reg(m.lightMap), lmInt: m.lightMapIntensity,
        lado: m.side === undefined ? 0 : m.side
      } : null
    });
  });
  var luzes = [];
  I.scene.traverse(function (o) {
    if (!o.isLight) return;
    o.updateMatrixWorld(true);
    var e = o.matrixWorld.elements, p = { x: e[12], y: e[13], z: e[14] };
    var t = null;
    if (o.target) { o.target.updateMatrixWorld(true);
                    var q = o.target.matrixWorld.elements; t = { x: q[12], y: q[13], z: q[14] }; }
    luzes.push({ tipo: o.type, cor: [o.color.r, o.color.g, o.color.b],
                 int: o.intensity, pos: [p.x, p.y, p.z],
                 alvo: t ? [t.x, t.y, t.z] : null,
                 dist: o.distance || 0, sombra: !!o.castShadow });
  });
  var c = I.camera;
  c.updateMatrixWorld(true);
  var pack = {
    unidade: I.INT.pl.id,
    cam: { pos: c.position.toArray(), quat: c.quaternion.toArray(),
           fov: c.fov, near: c.near, far: c.far, aspect: c.aspect },
    luzes: luzes,
    ambiente: { fog: I.scene.fog ? [I.scene.fog.color.r, I.scene.fog.color.g,
                                    I.scene.fog.color.b] : null,
                fundo: (I.scene.background && I.scene.background.isColor)
                       ? [I.scene.background.r, I.scene.background.g, I.scene.background.b] : null,
                expo: (I.renderer && I.renderer.toneMappingExposure) || null,
                tone: (I.renderer && I.renderer.toneMapping) || null },
    texturados: texturado,
    texturas: texs,
    meshes: meshes
  };
  fetch("http://127.0.0.1:8765/dump", { method: "POST", body: JSON.stringify(pack) });
}, 800);
"""


def main():
    srv = http.server.HTTPServer(("127.0.0.1", PORTA), Coletor)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    cmd = [sys.executable, os.path.join(RAIZ, "pipeline", "foto_interior.py")] + sys.argv[1:]
    cmd += ["--patch", PATCH]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=500)
    print((r.stdout or "").strip()[-600:])
    srv.shutdown()
    if not recebido.is_set():
        print("NAO recebeu o dump"); return 1
    d = json.load(open(SAIDA, encoding="utf-8"))
    tri = sum((len(m["idx"]) if m["idx"] else len(m["pos"]) // 3) // 3 for m in d["meshes"])
    tx = d.get("texturas", {})
    print("dump: %.1f MB | %d meshes | %d tris | %d luzes | %d texturados"
          % (os.path.getsize(SAIDA) / 1e6, len(d["meshes"]), tri,
             len(d["luzes"]), d["texturados"]))
    for t in tx.values():
        print("  tex %s %s %dx%d rep=%s cs=%s flipY=%s %s"
              % (t["id"], t["classe"], t["w"], t["h"], t["rep"], t["cs"],
                 t["flipY"], t.get("erro", "ok" if t["png"] else "SEM PNG")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
