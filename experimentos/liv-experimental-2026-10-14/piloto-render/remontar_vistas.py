"""As fotos de treino contêm o que o visitante vê? Remonta vistas do Tour só com as fotos (roda no Blender, -b).

Para cada pixel da vista do Tour: o ponto da cena que ele mostra (raio contra a geometria exata), e a foto de
TREINO que viu esse ponto, sem obstrução, do rumo mais parecido com o do visitante. Grava a escolha; o
remontar_compor.py pinta o pixel com a cor dessa foto. Se a remontagem sai igual ao render de verdade, a
informação estava nas fotos e o borrão é do splat; se sai com buraco ou errada, faltava foto.

blender -b correcao-20261016/apartamento.blend --python nuvem/gpu.py --python remontar_vistas.py -- \
    --plano correcao-20261016/dataset/plano-captura.json --saida pasta [--fotos-de pasta-com-pngs ...] \
    [--res 640x360] [--amostras 64] [--escala-fotos 0.5] [--candidatas 8] [--so vista,...] [--sem-render]
Vistas fixas abaixo (XY do Blender, rumo em graus, olho 1,62 m, vertical 48° como o Tour).
"""
import bpy, json, math, os, sys, time
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
def arg(n, p=None): return argv[argv.index(n) + 1] if n in argv else p
SAIDA = arg("--saida"); os.makedirs(os.path.join(SAIDA, "fotos"), exist_ok=True)
W, H = map(int, arg("--res", "640x360").split("x"))
VISTAS = [("sala", -1.475, -0.75, 0), ("suite", 2.425, -0.6, 180), ("corr-0.425", 0.425, -0.9, 270),
          ("corr-1.375", 1.375, -0.6, 90), ("banho-social", 1.075, -1.85, 270), ("varanda", -2.275, 1.95, 270)]
if arg("--so"): VISTAS = [v for v in VISTAS if v[0] in arg("--so").split(",")]
VF = math.radians(48); FY = (H / 2) / math.tan(VF / 2)
K = int(arg("--candidatas", "8"))   # fotos testadas por pixel, em ordem de rumo

plano = json.load(open(arg("--plano"), encoding="utf-8"))["dataset"]
treino = [(i, f) for i, f in enumerate(plano["frames"]) if f["split"] == "train"]
M = np.array([f["transform_matrix"] for _, f in treino]); fx, fw, fh = plano["fl_x"], plano["w"], plano["h"]
print("FOTOS DE TREINO", len(treino), flush=True)

cena = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get()
verts, tris = [], []
for ob in cena.objects:
    if ob.type != "MESH" or ob.hide_render: continue
    ev = ob.evaluated_get(dg); me = ev.to_mesh(); me.calc_loop_triangles(); b = len(verts)
    verts += [tuple(ob.matrix_world @ v.co) for v in me.vertices]; tris += [tuple(b + k for k in t.vertices) for t in me.loop_triangles]
    ev.to_mesh_clear()
bvh = BVHTree.FromPolygons(verts, tris)

def camera_tour(x, y, graus):
    t = math.radians(graus)
    f = Vector((math.cos(t), math.sin(t), 0)); r = Vector((math.sin(t), -math.cos(t), 0)); u = Vector((0, 0, 1))
    return Vector((x, y, 1.62)), f, r, u

necessarias = set(); t0 = time.time()
for nome, x, y, g in VISTAS:
    o, f, r, u = camera_tour(x, y, g)
    P = np.full((H, W, 3), np.nan)
    for j in range(H):
        for i in range(W):
            d = (f + r * ((i + .5 - W / 2) / FY) + u * ((H / 2 - j - .5) / FY)).normalized()
            hit = bvh.ray_cast(o, d, 40)
            if hit[0] is not None: P[j, i] = hit[0]
    P = P.reshape(-1, 3); ok = ~np.isnan(P[:, 0])
    vis = P - np.array(o); vis /= np.linalg.norm(vis, axis=1, keepdims=True)   # rumo do visitante até o ponto
    melhor_ang = np.full((len(P), K), np.inf); melhor_cam = np.full((len(P), K), -1)
    for c, m in enumerate(M):
        R, oc = m[:3, :3], m[:3, 3]; q = (P - oc) @ R; z = -q[:, 2]
        with np.errstate(invalid="ignore", divide="ignore"):
            uu = fx * q[:, 0] / z + fw / 2; vv = fx * q[:, 1] / z + fh / 2
            dc = P - oc; dc /= np.linalg.norm(dc, axis=1, keepdims=True)
            ang = np.degrees(np.arccos(np.clip((dc * vis).sum(1), -1, 1)))
        dentro = ok & (z > 0.05) & (uu >= 0) & (uu < fw) & (vv >= 0) & (vv < fh)
        ang = np.where(dentro, ang, np.inf)
        pior = melhor_ang.argmax(1); troca = ang < melhor_ang[np.arange(len(P)), pior]
        melhor_ang[troca, pior[troca]] = ang[troca]; melhor_cam[troca, pior[troca]] = c
    ordem = np.argsort(melhor_ang, 1)
    melhor_ang = np.take_along_axis(melhor_ang, ordem, 1); melhor_cam = np.take_along_axis(melhor_cam, ordem, 1)
    escolha = np.full(len(P), -1); angulo = np.full(len(P), np.nan); uv = np.full((len(P), 2), np.nan)
    for p in np.nonzero(ok)[0]:
        for k in range(K):
            c = melhor_cam[p, k]
            if c < 0: break
            oc = Vector(M[c][:3, 3]); alvo = Vector(P[p]); d = alvo - oc; L = d.length
            hit = bvh.ray_cast(oc, d / L, L + 0.01)
            if hit[0] is None or hit[3] >= L - 0.015:   # nada na frente: esta foto viu o ponto
                q = (P[p] - M[c][:3, 3]) @ M[c][:3, :3]; z = -q[2]
                escolha[p] = c; angulo[p] = melhor_ang[p, k]; uv[p] = (fx * q[0] / z + fw / 2, fh / 2 - fx * q[1] / z)
                break
    usadas = sorted(set(escolha[escolha >= 0].tolist()))
    necessarias.update(treino[c][0] for c in usadas)
    np.savez_compressed(os.path.join(SAIDA, f"{nome}.npz"), escolha=np.array([treino[c][0] if c >= 0 else -1 for c in escolha]),
                        angulo=angulo, uv=uv, ok=ok, W=W, H=H)
    print("VISTA", nome, "fotos usadas", len(usadas), "sem foto %.1f%%" % (100 * ((escolha < 0) & ok).sum() / ok.sum()),
          "rumo mediano %.1f°" % np.nanmedian(angulo), round(time.time() - t0), "s", flush=True)
json.dump(sorted(necessarias), open(os.path.join(SAIDA, "fotos-necessarias.json"), "w"))
print("FOTOS NECESSARIAS", len(necessarias), flush=True)
if "--sem-render" in argv: sys.exit(0)

# Renders: a verdade nas poses do Tour e as fotos de treino que faltam (mesma câmera do plano).
cena.cycles.samples = int(arg("--amostras", "64")); cena.cycles.use_denoising = True
cena.render.image_settings.file_format = "PNG"; cena.render.image_settings.color_mode = "RGB"
cd = bpy.data.cameras.new("remontar"); cd.sensor_fit = "HORIZONTAL"; cd.sensor_width = 36; cd.clip_start = 0.05
cam = bpy.data.objects.new("remontar", cd); cena.collection.objects.link(cam); cena.camera = cam
cena.render.resolution_percentage = 100
cena.render.resolution_x, cena.render.resolution_y = W, H
cd.lens = 36 / (2 * math.tan(VF / 2) * W / H)
for nome, x, y, g in VISTAS:
    o, f, r, u = camera_tour(x, y, g)
    cam.matrix_world = Matrix.Translation(o) @ (-f).to_track_quat("Z", "Y").to_matrix().to_4x4()
    alvo = os.path.join(SAIDA, f"verdade-{nome}.png")
    if not os.path.exists(alvo): cena.render.filepath = alvo; bpy.ops.render.render(write_still=True)
    print("VERDADE", nome, flush=True)
ESCALA = float(arg("--escala-fotos", "0.5"))   # foto refeita em meia resolução: sobra para uma vista de 480 px
cena.render.resolution_x, cena.render.resolution_y = round(fw * ESCALA), round(fh * ESCALA)
cd.lens = 36 * fx / fw
fontes = [a for a in argv[argv.index("--fotos-de") + 1:] if not a.startswith("--")] if "--fotos-de" in argv else []
for n, i in enumerate(sorted(necessarias)):
    nome = os.path.basename(plano["frames"][i]["file_path"])
    if os.path.exists(os.path.join(SAIDA, "fotos", nome)) or any(os.path.exists(os.path.join(d, nome)) for d in fontes): continue
    cam.matrix_world = Matrix(plano["frames"][i]["transform_matrix"])
    cena.render.filepath = os.path.join(SAIDA, "fotos", nome); bpy.ops.render.render(write_still=True)
    print(f"FOTO {n + 1}/{len(necessarias)} {nome}", round(time.time() - t0), "s", flush=True)
print("FIM", flush=True)
