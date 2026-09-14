# -*- coding: utf-8 -*-
"""Monta UM arquivo .html com o apartamento assado no Cycles e a caminhada por dentro.

    python tools/monta_visualizador.py <pacote.json> [saida.html]

Tudo entra embutido -- three.js, malha e atlas -- entao o arquivo abre com duplo clique,
sem servidor e sem rede. O material e `MeshBasicMaterial`: a luz ja esta assada na
textura, entao nao ha luz, sombra nem PBR em tempo real. Um draw call.
"""
import base64, io, json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "_apto_pacote.json")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(PAC)[0] + ".html"

GANHO = float(os.environ.get("GANHO", "7.0"))   # exposicao; ver a nota no HTML

d = json.load(open(PAC, encoding="utf-8"))
three = io.open(os.path.join(RAIZ, "renderizador", "lib", "three.min.js"),
                encoding="utf-8").read()
MALHA = json.dumps({"malhas": d["malhas"], "texturas": d["texturas"],
                    "cam": d["cam"], "ganho": GANHO}, separators=(",", ":"))

HTML = """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%(TIT)s</title><style>
html,body{margin:0;height:100%%;background:#0b0c0e;overflow:hidden;
  font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8e8ea}
canvas{display:block}
#hud{position:fixed;left:14px;bottom:14px;background:rgba(12,13,15,.82);
  border:1px solid #26282d;border-radius:10px;padding:10px 13px;pointer-events:none}
#hud b{color:#fff;font-weight:600}
#hud kbd{background:#22242a;border:1px solid #33363d;border-bottom-width:2px;
  border-radius:4px;padding:1px 5px;font:12px ui-monospace,monospace}
#capa{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(8,9,11,.72);cursor:pointer;text-align:center}
#capa div{max-width:340px}
#capa h1{font-size:19px;margin:0 0 8px}
#capa p{margin:0;color:#a6a8ad;font-size:13px}
</style></head><body>
<div id="hud"><b>%(TIT)s</b><br>
<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar &nbsp;·&nbsp; mouse olhar
&nbsp;·&nbsp; <kbd>Shift</kbd> correr &nbsp;·&nbsp; <kbd>Esc</kbd> soltar</div>
<div id="capa"><div><h1>%(TIT)s</h1><p>Clique para entrar. A luz esta assada no
Cycles &mdash; o que voce anda dentro e o render, nao uma aproximacao.</p></div></div>
<script>%(THREE)s</script>
<script>
const D = %(MALHA)s;
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x0b0c0e);

// As texturas de cor (reboco, tabua) vem inteiras do Three original, com a UV
// original. A LUZ e outra coisa: veio assada no Cycles e viaja na cor por vertice,
// ja multiplicada pelo albedo. O material so precisa multiplicar as duas.
const texs = {};
for (const id in D.texturas) {
  const im = new Image(), t = new THREE.Texture(im);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  im.onload = () => { t.needsUpdate = true; };
  im.src = D.texturas[id];
  texs[id] = t;
}

const pecas = [];
for (const m of D.malhas) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m.pos), 3));
  g.setAttribute("color",    new THREE.BufferAttribute(new Float32Array(m.cor), 3));
  if (m.uv && m.uv.length === (m.pos.length / 3) * 2)
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(m.uv), 2));
  g.setIndex(m.idx);
  g.computeBoundingSphere();
  // `?soluz=0` apaga a cor por vertice e deixa a textura crua -- o outro lado do A/B.
  const par = { vertexColors: new URLSearchParams(location.search).get("soluz") !== "0",
                side: THREE.DoubleSide };
  // `?semtex=1` tira as texturas de cor e deixa so a LUZ assada. E o A/B que diz se
  // um defeito esta no bake ou na textura -- sem ele os dois se parecem.
  if (m.map && texs[m.map] && !new URLSearchParams(location.search).get("semtex"))
    par.map = texs[m.map];
  if (m.op < 1) { par.transparent = true; par.opacity = m.op; }
  const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial(par));
  cena.add(o);
  pecas.push(o);
}

const cam = new THREE.PerspectiveCamera(D.cam.fov, innerWidth / innerHeight, 0.05, 200);
const R = new THREE.WebGLRenderer({ antialias: true });
// Sem esta linha o build entrega LINEAR e a casa inteira sai escura -- o mesmo
// tropeco do mapa. O atlas ja e a imagem final, entao NAO ha tonemap aqui.
if ("outputColorSpace" in R) R.outputColorSpace = THREE.SRGBColorSpace;
else R.outputEncoding = THREE.sRGBEncoding;
// A cor por vertice e IRRADIANCIA em unidade fisica, nao cor de tela: sem ganho e
// curva a casa sai quase preta. O ganho reproduz a exposicao do render do Cycles.
R.toneMapping = THREE.ACESFilmicToneMapping;
R.toneMappingExposure = +(new URLSearchParams(location.search).get("ganho")) || D.ganho;
R.setPixelRatio(Math.min(devicePixelRatio, 2));
R.setSize(innerWidth, innerHeight);
document.body.appendChild(R.domElement);
addEventListener("resize", () => {
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  R.setSize(innerWidth, innerHeight);
});

// ---- caminhada ----------------------------------------------------------------
// A altura dos olhos e travada na que a cena foi exportada: nao ha gravidade nem
// piso pra testar, e o apartamento e de um pavimento so.
const OLHO = D.cam.pos[1];
const P = new THREE.Vector3(D.cam.pos[0], OLHO, D.cam.pos[2]);
let yaw = 0, pitch = 0;
{ const q = new THREE.Quaternion(D.cam.quat[0], D.cam.quat[1], D.cam.quat[2], D.cam.quat[3]);
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ"); yaw = e.y; pitch = e.x; }

const tecla = {};
addEventListener("keydown", e => { tecla[e.code] = true; });
addEventListener("keyup",   e => { tecla[e.code] = false; });

const capa = document.getElementById("capa");
// `?qa=1` tira a capa: ela e um veu de 72%% de preto por cima da cena, entao
// qualquer print sem isso mede o veu, nao o apartamento.
if (new URLSearchParams(location.search).get("qa")) capa.style.display = "none";
capa.addEventListener("click", () => R.domElement.requestPointerLock());
document.addEventListener("pointerlockchange", () => {
  capa.style.display = document.pointerLockElement ? "none" : "flex";
});
addEventListener("mousemove", e => {
  if (!document.pointerLockElement) return;
  yaw   -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

// Colisao: um raio na direcao do passo. Sem isso a caminhada atravessa parede, e
// atravessar parede num apartamento de 29 m2 destroi a nocao de tamanho, que e
// justamente o que o comprador foi ver.
const raio = new THREE.Raycaster();
raio.far = 0.45;
const PARA = 0.35;
function livre(dir) {
  raio.set(P, dir);
  const h = raio.intersectObjects(pecas, false);
  return !h.length || h[0].distance > PARA;
}

const passo = new THREE.Vector3(), frente = new THREE.Vector3(), lado = new THREE.Vector3();
let t0 = performance.now();
(function laco(t) {
  requestAnimationFrame(laco);
  const dt = Math.min((t - t0) / 1000, 0.05); t0 = t;
  frente.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  lado.set(Math.cos(yaw), 0, -Math.sin(yaw));
  passo.set(0, 0, 0);
  if (tecla.KeyW || tecla.ArrowUp)    passo.add(frente);
  if (tecla.KeyS || tecla.ArrowDown)  passo.sub(frente);
  if (tecla.KeyD || tecla.ArrowRight) passo.add(lado);
  if (tecla.KeyA || tecla.ArrowLeft)  passo.sub(lado);
  if (passo.lengthSq() > 0) {
    passo.normalize();
    const v = (tecla.ShiftLeft || tecla.ShiftRight ? 2.6 : 1.3) * dt;
    // Testa os eixos separados pra poder DESLIZAR na parede em vez de grudar nela.
    const ex = new THREE.Vector3(passo.x, 0, 0).normalize();
    const ez = new THREE.Vector3(0, 0, passo.z).normalize();
    if (passo.x && livre(ex)) P.x += passo.x * v;
    if (passo.z && livre(ez)) P.z += passo.z * v;
  }
  cam.position.copy(P);
  cam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  R.render(cena, cam);
})(t0);
window.__apto = { cam, cena, P, R, pecas };
</script></body></html>
"""

io.open(OUT, "w", encoding="utf-8", newline="").write(HTML % {
    "TIT": d["unidade"], "THREE": three, "MALHA": MALHA})
print("OK %s  %.1f MB" % (OUT, os.path.getsize(OUT) / 1e6))
