"""Captura para Gaussian Splatting: renderiza o apartamento vestido de vários pontos e grava
`transforms.json` (formato nerfstudio/gsplat) + `pontos.ply` para iniciar o treino.

Uso:
  blender -b <saida do montar_apartamento>/apartamento.blend --python piloto-render/capturar_splat.py -- \
    --saida captura [--zona apto|"Suíte,Banho"] [--passo 0.35] [--prefixo f] [--amostras 128]
    [--res 1280x720] [--limite 0] [--sem-render] [--folga 0.28] [--colado 0.6] [--rumos 4]
    [--unidade interiores/meio/unidade.json]   (.blend sem liv_comodos, como o do piloto)
    [--perfil cobertura] [--planejar]   (plano sem imagens; não gera transforms.json de treino)

As zonas vêm dos cômodos do cadastro (gravados na cena pelo montar_apartamento.py); cada quadro leva o
cômodo da câmera em "comodo", que o inspetor usa para agregar a nota por cômodo. --prefixo dá nome novo
às imagens de uma recaptura de zona, para juntar à captura anterior sem sobrescrever.

--empacotar só embute as texturas no .blend (para mandar à nuvem) e sai.
"""
import bpy, hashlib, json, math, os, random, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(nome, padrao=None):
    return argv[argv.index(nome) + 1] if nome in argv else padrao
cena = bpy.context.scene

if "--empacotar" in argv:
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=arg("--empacotar"), compress=True)
    print("EMPACOTADO", arg("--empacotar")); sys.exit(0)

SAIDA = os.path.abspath(arg("--saida", "captura"))
AMOSTRAS = int(arg("--amostras", "128"))
W, H = (int(v) for v in arg("--res", "1280x720").split("x"))
LIMITE = int(arg("--limite", "0"))
PERFIL = arg("--perfil", "original")
if PERFIL not in ("original", "cobertura"): sys.exit("Perfil inválido: original ou cobertura")
COBERTURA = PERFIL == "cobertura"
if W <= 0 or H <= 0 or AMOSTRAS <= 0 or LIMITE < 0: sys.exit("Resolução, amostras ou limite inválidos")
os.makedirs(os.path.join(SAIDA, "images"), exist_ok=True)
random.seed(11)

# câmeras do próprio piloto não entram
for ob in [o for o in cena.objects if o.type == "CAMERA"]:
    bpy.data.objects.remove(ob, do_unlink=True)
dg = bpy.context.evaluated_depsgraph_get()

def raio(p, d, longe=50.0):
    ok, loc, n, i, ob, m = cena.ray_cast(dg, p, d, distance=longe)
    return (loc - p).length if ok else longe

FOLGA = float(arg("--folga", "0.18" if COBERTURA else "0.28"))
COLADO = float(arg("--colado", "0.25" if COBERTURA else "0.6"))
RUMOS = int(arg("--rumos", "8" if COBERTURA else "4"))
if FOLGA <= 0 or COLADO <= 0 or RUMOS <= 0: sys.exit("Folga, distância ou rumos inválidos")
def livre(p, folga=FOLGA):
    """Ponto dentro do apartamento (piso abaixo, forro acima) e longe de parede e móvel."""
    if raio(p, Vector((0, 0, -1))) > p.z + 0.1 or raio(p, Vector((0, 0, 1))) > 3.0:
        return False
    if raio(p, Vector((0, 0, 1))) < 2.6 - p.z:     # embaixo de móvel alto ou dentro de armário
        return False
    for a in range(0, 360, 30):
        d = Vector((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        if raio(p, d) < folga: return False
    return raio(p, Vector((0, 0, -1))) > 0.25 or p.z < 0.3

# zona: cômodos gravados pelo montar_apartamento.py (`liv_comodos`, mundo). --zona apto (padrão) pega
# todos; --zona "Suíte,Banho" pega os cômodos cujo nome contém algum dos termos. --passo adensa a grade
# (o inspetor sugere passo menor onde o splat ficou abaixo da meta).
import sys as _s; _s.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from planta import dentro, carregar
# O .blend do piloto (montar_sala.py, de onde saíram os splats publicados) não grava liv_comodos:
# --unidade lê os cômodos direto do cadastro, no mesmo referencial.
if "liv_comodos" in cena: COMODOS = json.loads(cena["liv_comodos"])
elif arg("--unidade"): COMODOS = carregar(arg("--unidade")).comodos
else: sys.exit("cena sem liv_comodos: gere o .blend com montar_apartamento.py ou passe --unidade")
termos = [t.strip().lower() for t in arg("--zona", "apto").split(",")]
def casa(t):   # nome exato primeiro ("Suíte" não puxa o "Banho suíte"); senão, pedaço do nome
    return [c for c in COMODOS if c["nome"].lower() == t] or [c for c in COMODOS if t in c["nome"].lower()]
ZONA = COMODOS if termos == ["apto"] else [c for t in termos for c in casa(t)]
if not ZONA: sys.exit(f"nenhum cômodo casa com --zona {termos}; há {[c['nome'] for c in COMODOS]}")
X0 = min(v[0] for c in ZONA for v in c["poly"]); X1 = max(v[0] for c in ZONA for v in c["poly"])
Y0 = min(v[1] for c in ZONA for v in c["poly"]); Y1 = max(v[1] for c in ZONA for v in c["poly"])
def comodo_de(x, y):
    return next((c["nome"] for c in COMODOS if dentro((x, y), c["poly"])), None)
def dentro_zona(x, y):
    return any(dentro((x, y), c["poly"]) for c in ZONA)
PASSO = float(arg("--passo", "0.55" if COBERTURA else "0.35"))
if PASSO <= 0: sys.exit("Passo deve ser positivo")

pontos = []
for x in [X0 + i * PASSO for i in range(int((X1 - X0) / PASSO) + 1)]:
    for y in [Y0 + j * PASSO for j in range(int((Y1 - Y0) / PASSO) + 1)]:
        if not dentro_zona(x, y): continue
        for z in ((1.62,) if COBERTURA else (1.15, 1.6)):
            p = Vector((x + random.uniform(-0.06, 0.06), y + random.uniform(-0.06, 0.06), z))
            if dentro_zona(p.x, p.y) and livre(p): pontos.append(p)

if COBERTURA and arg("--unidade"):
    # Posições de ambos os lados das portas: a grade sozinha pode pular uma passagem estreita.
    for abertura in carregar(arg("--unidade")).aberturas():
        if abertura["tipo"] != "porta": continue
        for comodo, normal in abertura["lados"]:
            for distancia in (.3, .6):
                p = Vector((abertura["centro"][0] + normal[0] * distancia,
                            abertura["centro"][1] + normal[1] * distancia, 1.62))
                if dentro_zona(p.x, p.y) and livre(p) and all((p-q).length > .1 for q in pontos):
                    pontos.append(p)

centro = Vector(((X0 + X1) / 2, (Y0 + Y1) / 2, 1.0))
cams = []
for ponto_id, p in enumerate(pontos):
    base = math.degrees(math.atan2(centro.y - p.y, centro.x - p.x))
    for k in range(RUMOS):                  # rumos por ponto, um deles para o centro
        yaw = math.radians(base + k * 360 / RUMOS + (0 if "--sem-jitter" in argv else random.uniform(-12, 12)))
        inclinacoes = (-60, 0, 60) if COBERTURA else (random.uniform(-18, 4) if p.z > 1.4 else random.uniform(-8, 10),)
        for inclinacao in inclinacoes:
            pitch = math.radians(inclinacao)
            d = Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))
            if raio(p, d) < COLADO: continue
            cams.append((p.copy(), d, ponto_id, inclinacao))
random.shuffle(cams)
if LIMITE: cams = cams[:LIMITE]
print("PONTOS", len(pontos), "CAMERAS", len(cams))
if not cams: sys.exit("Nenhuma câmera livre na zona selecionada")

cd = bpy.data.cameras.new("cap"); cd.lens = 16 if COBERTURA else 18; cd.sensor_width = 36; cd.sensor_fit = "HORIZONTAL"; cd.clip_start = 0.05
cd.dof.use_dof = False
cam = bpy.data.objects.new("cap", cd); cena.collection.objects.link(cam); cena.camera = cam
cena.render.resolution_x, cena.render.resolution_y, cena.render.resolution_percentage = W, H, 100
cena.cycles.samples = AMOSTRAS; cena.cycles.use_denoising = True
cena.render.image_settings.file_format = "PNG"
cena.render.image_settings.color_mode = "RGB"
cena.render.resolution_percentage = 100
cena.render.pixel_aspect_x = cena.render.pixel_aspect_y = 1

fl = W * cd.lens / cd.sensor_width          # sensor ajustado à largura
grupos = {}
for p, d, ponto_id, inclinacao in cams:
    grupos.setdefault(comodo_de(p.x, p.y), set()).add(ponto_id)
# A reserva é por cômodo e posição, para não deixar um banheiro ou a varanda sem avaliação.
ids_aval = {i for ids in grupos.values() if len(ids) > 1 for i in sorted(ids)[::8]}
frames = []
for i, (p, d, ponto_id, inclinacao) in enumerate(cams):
    cam.location = p
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    split = "eval" if ponto_id in ids_aval else "train"
    nome = f"images/{arg('--prefixo', 'f')}{i:04d}.png"
    frames.append({"file_path": nome, "transform_matrix": [list(r) for r in cam.matrix_world],
                   "comodo": comodo_de(p.x, p.y), "position_id": ponto_id, "pitch": inclinacao, "split": split})

meta = {"camera_model": "OPENCV", "w": W, "h": H, "fl_x": fl, "fl_y": fl, "cx": W / 2, "cy": H / 2,
        "k1": 0, "k2": 0, "p1": 0, "p2": 0, "ply_file_path": "pontos.ply", "frames": frames}
if COBERTURA:
    meta.update(train_filenames=[f["file_path"] for f in frames if f["split"] == "train"],
                val_filenames=[f["file_path"] for f in frames if f["split"] == "eval"],
                test_filenames=[f["file_path"] for f in frames if f["split"] == "eval"])
with open(bpy.data.filepath, "rb") as f: fonte_sha = hashlib.file_digest(f, "sha256").hexdigest()
config = {"source_sha256": fonte_sha, "perfil": PERFIL, "zona": termos, "diagnostico": COBERTURA and LIMITE > 0, "passo": PASSO,
          "folga": FOLGA, "colado": COLADO, "rumos": RUMOS, "amostras": AMOSTRAS, "dataset": meta}
if "--sem-jitter" in argv: config["sem_jitter"] = True
plano_path = os.path.join(SAIDA, "plano-captura.json")
if os.path.exists(plano_path):
    with open(plano_path, encoding="utf-8") as f: anterior = json.load(f)
    if anterior != config: sys.exit("Configuração ou cena mudou: use outra pasta de saída para não reutilizar imagens erradas")
with open(plano_path, "w", encoding="utf-8") as f: json.dump(config, f, ensure_ascii=False, indent=2)
if "--planejar" in argv:
    print("PLANO", plano_path, "SEM IMAGENS; render pendente"); sys.exit(0)

for i, frame in enumerate(frames):
    cam.matrix_world = Matrix(frame["transform_matrix"])
    bpy.context.view_layer.update()
    nome = frame["file_path"]
    if "--sem-render" not in argv and not os.path.exists(os.path.join(SAIDA, nome)):   # retoma (ordem fixa pela semente)
        cena.render.filepath = os.path.join(SAIDA, nome)
        bpy.ops.render.render(write_still=True)
    print(f"VISTA {i + 1}/{len(cams)}", flush=True)
    # transforms só é publicado com o conjunto completo; o plano permite retomar um render interrompido.

# nuvem de pontos inicial: amostras nas superfícies visíveis da zona
amostras = []
for ob in cena.objects:
    if ob.type != "MESH" or ob.hide_render: continue
    me = ob.evaluated_get(dg).to_mesh(); mw = ob.matrix_world
    me.calc_loop_triangles()
    for t in me.loop_triangles:
        c = mw @ t.center
        if not (X0 - 0.5 <= c.x <= X1 + 0.5 and Y0 - 0.5 <= c.y <= Y1 + 0.5): continue
        area = t.area * mw.to_scale().x * mw.to_scale().y
        for _ in range(max(1, int(area * 400))):
            a, b = random.random(), random.random()
            if a + b > 1: a, b = 1 - a, 1 - b
            v = [mw @ me.vertices[k].co for k in t.vertices]
            amostras.append(v[0] + (v[1] - v[0]) * a + (v[2] - v[0]) * b)
    ob.evaluated_get(dg).to_mesh_clear()
random.shuffle(amostras); amostras = amostras[:200000]
with open(os.path.join(SAIDA, "pontos.ply"), "w") as f:
    f.write(f"ply\nformat ascii 1.0\nelement vertex {len(amostras)}\nproperty float x\nproperty float y\n"
            "property float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n")
    for v in amostras: f.write(f"{v.x:.4f} {v.y:.4f} {v.z:.4f} 200 190 175\n")
print("PLY", len(amostras), "FIM", SAIDA)
if "--sem-render" not in argv or not COBERTURA:
    with open(os.path.join(SAIDA, "transforms.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
