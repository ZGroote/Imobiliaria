#!/usr/bin/env python3
"""Server-only standalone fallback using existing SparkControls and full SOGs."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
import unicodedata
import re
from urllib.parse import unquote, urlsplit


KEYS = ("sala", "quarto", "suite", "banho-social", "banho-suite", "varanda")
ORDER = ("banho-social", "banho-suite", "varanda", "sala", "quarto", "suite")
CRITICAL = {"banho-social", "banho-suite", "varanda"}
ALIASES = {
    "sala": "sala", "sala integrada": "sala", "sala cozinha": "sala",
    "quarto": "quarto", "dormitorio": "quarto", "dormitorio 01": "quarto", "dormitorio 1": "quarto",
    "suite": "suite", "banho": "banho-social", "banheiro": "banho-social",
    "banho social": "banho-social", "banheiro social": "banho-social",
    "banho suite": "banho-suite", "banheiro suite": "banho-suite",
    "varanda": "varanda", "varanda servico": "varanda",
}
LABELS = {"sala": "Sala", "quarto": "Quarto", "suite": "Suíte", "banho-social": "Banheiro", "banho-suite": "Banheiro da suíte", "varanda": "Varanda"}


def key_for(name):
    plain = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode()
    return ALIASES.get(" ".join(re.sub(r"[^a-z0-9]+", " ", plain.lower()).split()))


def finite_matrix(matrix):
    return (isinstance(matrix, list) and len(matrix) == 4 and
            all(isinstance(row, list) and len(row) == 4 and
                all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in row) for row in matrix))


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(2 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_write(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as stream:
        tmp = Path(stream.name)
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


HTML = r'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>LIV · Visita do apartamento</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111;touch-action:none;color:#fff;font:14px system-ui,sans-serif}
canvas{display:block;width:100%;height:100%}nav{position:fixed;top:12px;left:12px;right:12px;display:flex;gap:6px;flex-wrap:wrap;z-index:2;pointer-events:none}
nav>*{pointer-events:auto}button{font:inherit;padding:10px 13px;min-height:44px;border:1px solid #666;border-radius:7px;background:#171717e8;color:#fff;cursor:pointer}
button[aria-pressed=true]{background:#e8dccb;color:#222}button:focus-visible{outline:3px solid #f6d37e}button:disabled{opacity:.45;cursor:wait}
#views{position:fixed;bottom:62px;left:12px;display:flex;gap:6px;z-index:2}#info{position:fixed;bottom:12px;left:12px;right:12px;background:#111c;padding:8px 10px;border-radius:6px;pointer-events:none}
#fps{position:fixed;right:12px;bottom:68px;background:#111b;padding:5px 7px;border-radius:5px;pointer-events:none}
@media(max-width:650px){nav{top:8px;left:8px;right:8px;gap:4px}button{font-size:12px;padding:8px 10px}}
</style>
<script type="importmap">{"imports":{"three":"./splat/lib/three/build/three.module.js","three/addons/":"./splat/lib/three/examples/jsm/","@sparkjsdev/spark":"./splat/lib/spark.module.min.js"}}</script>
</head>
<body>
<nav id="rooms" aria-label="Ir ao ambiente"></nav>
<div id="views" role="group" aria-label="Direção do olhar"><button data-pitch="-60">Chão</button><button data-pitch="0">À frente</button><button data-pitch="60">Teto</button><button id="fullscreen">Tela cheia</button></div>
<div id="info" role="status">Carregando o apartamento…</div><div id="fps"></div>
<script type="module">
import * as THREE from "three";
import {SparkRenderer,SplatMesh,SparkControls} from "@sparkjsdev/spark";
const CFG = __CONFIG__;
const query = new URLSearchParams(location.search);
const info = document.getElementById("info"), fpsEl = document.getElementById("fps");
const dpr = Math.min(devicePixelRatio || 1, Math.max(.5,Math.min(2,Number(query.get("dpr")) || 1.5)));
const renderer = new THREE.WebGLRenderer({antialias:false});
renderer.setPixelRatio(dpr); renderer.setSize(innerWidth,innerHeight); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111111);
const camera = new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.03,50);
const options = {renderer};
if (query.has("std") && Number(query.get("std")) > 0) options.maxStdDev = Number(query.get("std"));
scene.add(new SparkRenderer(options));
const controls = new SparkControls({canvas:renderer.domElement});
controls.fpsMovement.moveSpeed = 1.2; controls.pointerControls.pressMoveSpeed = 1.0;
const blenderToThree = new THREE.Matrix4().makeRotationX(-Math.PI/2);
let selected = null, requested = null, currentRoom = "sala", loadError = null, frames = 0, selectionFrames = 0;
const models = new Map();
function inside(poly,x,y) {
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[j],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    const dot=(x-a[0])*dx+(y-a[1])*dy;
    if(length>0&&Math.abs(dx*(y-a[1])-dy*(x-a[0]))<=1e-8*length&&dot>=-1e-8&&dot<=length*length+1e-8)return true;
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function roomAt(x,y) {return CFG.order.find(key=>inside(CFG.polygons[key],x,y)) || "sala";}
function status() {
  const pending=[...models.values()].filter(item=>!item.loaded&&!item.error).length;
  info.textContent = loadError ? `Falha ao carregar: ${loadError}` :
    `${CFG.labels[currentRoom]}${pending?" · carregando…":""} · arraste para olhar · WASD para andar · toque e segure para avançar`;
  for(const button of document.querySelectorAll("#rooms button")) button.setAttribute("aria-pressed",String(button.dataset.room===currentRoom));
}
function updateSelection() {
  currentRoom=roomAt(camera.position.x,-camera.position.z);
  requested=CFG.critical.includes(currentRoom)?"new":"old";
  const ready=models.get(requested)?.loaded?requested:models.get("old")?.loaded?"old":null;
  if(ready!==selected) {
    for(const [key,item] of models)item.mesh.visible=key===ready;
    selected=ready; selectionFrames=0; status();
  }
}
function goToRoom(key) {
  const view=CFG.views[key]; if(!view)throw new Error(`Ambiente desconhecido: ${key}`);
  const transform=new THREE.Matrix4().set(...view.transform.flat());
  transform.premultiply(blenderToThree).decompose(camera.position,camera.quaternion,new THREE.Vector3());
  controls.lastTime=performance.now(); currentRoom=key; updateSelection(); status();
}
function setPitch(degrees) {
  const forward=camera.getWorldDirection(new THREE.Vector3()); forward.y=0;
  if(forward.lengthSq()<1e-8)forward.set(0,0,-1); forward.normalize();
  const angle=degrees*Math.PI/180;
  forward.multiplyScalar(Math.cos(angle));forward.y=Math.sin(angle);
  camera.up.set(0,1,0);camera.lookAt(camera.position.clone().add(forward));
  controls.lastTime=performance.now();
}
for(const key of CFG.keys) {
  const button=document.createElement("button");button.type="button";button.dataset.room=key;
  button.textContent=CFG.labels[key];button.setAttribute("aria-pressed","false");
  button.addEventListener("click",()=>goToRoom(key));document.getElementById("rooms").appendChild(button);
}
for(const button of document.querySelectorAll("[data-pitch]"))button.addEventListener("click",()=>setPitch(Number(button.dataset.pitch)));
document.getElementById("fullscreen").addEventListener("click",async()=>{
  try{await document.documentElement.requestFullscreen?.({navigationUI:"hide"});await screen.orientation?.lock?.("landscape");}catch{}
});
for(const key of ["old","new"]) {
  const mesh=new SplatMesh({url:CFG.models[key]});mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);
  const item={mesh,loaded:false,error:null};models.set(key,item);
  Promise.resolve(mesh.initialized).then(()=>{item.loaded=true;updateSelection();status();},error=>{
    item.error=String(error);loadError=item.error;status();
  });
}
goToRoom(query.get("room") || "sala");
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener("webglcontextlost",event=>{event.preventDefault();loadError="Contexto gráfico perdido";status();});
let count=0,stamp=performance.now(),lastRoom=currentRoom;
renderer.setAnimationLoop(()=>{
  controls.update(camera);updateSelection();renderer.render(scene,camera);frames++;selectionFrames++;
  if(currentRoom!==lastRoom){lastRoom=currentRoom;status();}
  count++;const now=performance.now();if(now-stamp>1000){fpsEl.textContent=`${Math.round(count*1000/(now-stamp))} fps`;stamp=now;count=0;}
});
const api=window.__splat={camera,renderer,models,goToRoom,setPitch,
  getState:()=>({ready:!!selected&&!loadError,selected,requested,room:currentRoom,frames,selectionFrames,error:loadError,
    camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),models:[...models].map(([key,item])=>({key,loaded:item.loaded,error:item.error,visible:item.mesh.visible,gaussians:item.mesh.numSplats}))}),
  capture:()=>{if(!selected||loadError)throw new Error("Modelo ainda indisponível");renderer.render(scene,camera);return renderer.domElement.toDataURL("image/png");}};
addEventListener("pagehide",()=>{renderer.setAnimationLoop(null);for(const item of models.values())Promise.resolve(item.mesh.initialized).then(()=>item.mesh.dispose(),()=>item.mesh.dispose());renderer.dispose();},{once:true});
</script>
</body></html>
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/root/liv-corrigido-20261016")
    parser.add_argument("--old-model", default="old60k.sog", help="URL relative to tour-regional/splat/")
    parser.add_argument("--new-model", default="denso-corrigido.sog", help="URL relative to tour-regional/splat/")
    args = parser.parse_args()
    if os.name != "posix":
        raise SystemExit("Server-only helper; never execute on the PC")
    root = Path(args.root).resolve(strict=True)
    tour = (root / "tour-regional").resolve(strict=True)
    if tour.parent != root or tour.name != "tour-regional":
        raise ValueError("Refusing to write outside the isolated tour-regional copy")
    polygon_path = root / "poligonos-comodos.json"
    raw = json.loads(polygon_path.read_text(encoding="utf-8-sig"))
    polygons = {}
    for name, poly in raw.items():
        key = key_for(name)
        if key is None or key in polygons or not isinstance(poly, list) or len(poly) < 3:
            raise ValueError(f"Invalid or duplicated room polygon: {name!r}")
        if any(not isinstance(p, list) or len(p) != 2 or any(not isinstance(v, (int,float)) or isinstance(v,bool) or not math.isfinite(v) for v in p) for p in poly):
            raise ValueError(f"Invalid XY coordinate in {name!r}")
        polygons[key] = poly
    if set(polygons) != set(KEYS):
        raise ValueError("The six real room polygons are required")
    metadata_path = root / "dataset-denso" / "transforms.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
    views = {}
    for key in KEYS:
        poly = polygons[key]
        center = [sum(p[i] for p in poly) / len(poly) for i in (0,1)]
        candidates = [frame for frame in metadata["frames"] if key_for(frame.get("comodo")) == key and finite_matrix(frame.get("transform_matrix"))]
        if not candidates:
            raise ValueError(f"No validated capture camera for {key}")
        def score(frame):
            matrix = frame["transform_matrix"]
            return (abs(float(frame.get("pitch", 0))), (matrix[0][3]-center[0])**2+(matrix[1][3]-center[1])**2, str(frame.get("file_path", "")))
        frame = min(candidates, key=score)
        views[key] = {"transform": frame["transform_matrix"], "source_image": frame.get("file_path"), "pitch": frame.get("pitch")}
    files = {}
    model_urls = {}
    for label, url in (("old", args.old_model), ("new", args.new_model)):
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or parts.query or parts.fragment or parts.path.startswith("/"):
            raise ValueError("Models must use relative local file URLs")
        path = (tour / "splat" / unquote(parts.path)).resolve(strict=True)
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"Model outside work root: {url}")
        files[label] = path
        model_urls[label] = "./splat/" + url
    dependencies = ["splat/lib/spark.module.min.js", "splat/lib/three/build/three.module.js", "splat/lib/three/build/three.core.js", "splat/lib/three/examples/jsm/postprocessing/Pass.js"]
    missing = [name for name in dependencies if not (tour/name).is_file()]
    if missing:
        raise ValueError(f"Missing viewer bundles: {missing}")
    config = {"keys": KEYS, "order": ORDER, "critical": sorted(CRITICAL), "labels": LABELS,
              "polygons": polygons, "views": views, "models": model_urls}
    encoded = json.dumps(config, ensure_ascii=False, separators=(",", ":"), allow_nan=False).replace("</", "<\\/")
    rendered = HTML.replace("__CONFIG__", encoded)
    output = tour / "visita-compacta.html"
    if output.exists() and not output.with_suffix(".html.antes-compacta").exists():
        output.with_suffix(".html.antes-compacta").write_bytes(output.read_bytes())
    atomic_write(output, rendered.encode("utf-8"))
    report = {"schema": "liv-standalone-full-models-v1", "entry": output.name,
              "navigation": "Existing SparkControls free navigation; no collision geometry or original Tour controls",
              "selection": "Complete new SOG in critical polygons, complete old SOG everywhere else; no crop or crossfade",
              "camera_source": str(metadata_path), "camera_source_sha256": sha256(metadata_path),
              "polygon_source_sha256": sha256(polygon_path), "views": views,
              "models": {key: {"path":str(path), "bytes":path.stat().st_size, "sha256":sha256(path)} for key,path in files.items()},
              "dependencies": dependencies, "html_sha256": sha256(output), "browser_validation": "pending"}
    atomic_write(tour/"visita-compacta.json", (json.dumps(report, ensure_ascii=False, indent=2)+"\n").encode("utf-8"))
    print(json.dumps({"ok":True,"entry":str(output),"browser_validation":"pending"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
