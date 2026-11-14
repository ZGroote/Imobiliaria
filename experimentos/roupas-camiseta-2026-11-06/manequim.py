"""Manequim em pose T, feito com Skin + Subsurf, e as medidas dele (skill roupas, item 3.1).
Uso: blender -b --python manequim.py -- <pasta_saida>
Grava manequim.blend e medidas.json na pasta de saida.
"""
import bpy, bmesh, json, math, sys
from mathutils import Vector

saida = sys.argv[sys.argv.index("--") + 1]

bpy.ops.wm.read_factory_settings(use_empty=True)

# esqueleto: (nome, posicao, raio_x, raio_y)
V = [
    ("pelve", (0, 0, 0.95), 0.17, 0.14),
    ("cintura", (0, 0, 1.07), 0.13, 0.11),
    ("busto", (0, 0, 1.25), 0.17, 0.15),
    ("peito_alto", (0, 0, 1.36), 0.16, 0.13),
    ("pescoco", (0, 0, 1.47), 0.055, 0.055),
    ("cabeca", (0, 0, 1.64), 0.085, 0.10),
    ("ombro_d", (0.17, 0, 1.40), 0.06, 0.06),
    ("cotovelo_d", (0.45, 0, 1.40), 0.045, 0.045),
    ("pulso_d", (0.70, 0, 1.40), 0.035, 0.035),
    ("ombro_e", (-0.17, 0, 1.40), 0.06, 0.06),
    ("cotovelo_e", (-0.45, 0, 1.40), 0.045, 0.045),
    ("pulso_e", (-0.70, 0, 1.40), 0.035, 0.035),
    ("quadril_d", (0.09, 0, 0.88), 0.085, 0.085),
    ("joelho_d", (0.10, 0, 0.50), 0.055, 0.055),
    ("tornozelo_d", (0.10, 0, 0.08), 0.04, 0.04),
    ("quadril_e", (-0.09, 0, 0.88), 0.085, 0.085),
    ("joelho_e", (-0.10, 0, 0.50), 0.055, 0.055),
    ("tornozelo_e", (-0.10, 0, 0.08), 0.04, 0.04),
]
idx = {n: i for i, (n, *_r) in enumerate(V)}
E = [("pelve", "cintura"), ("cintura", "busto"), ("busto", "peito_alto"),
     ("peito_alto", "pescoco"), ("pescoco", "cabeca"),
     ("peito_alto", "ombro_d"), ("ombro_d", "cotovelo_d"), ("cotovelo_d", "pulso_d"),
     ("peito_alto", "ombro_e"), ("ombro_e", "cotovelo_e"), ("cotovelo_e", "pulso_e"),
     ("pelve", "quadril_d"), ("quadril_d", "joelho_d"), ("joelho_d", "tornozelo_d"),
     ("pelve", "quadril_e"), ("quadril_e", "joelho_e"), ("joelho_e", "tornozelo_e")]

me = bpy.data.meshes.new("esqueleto")
me.from_pydata([v[1] for v in V], [(idx[a], idx[b]) for a, b in E], [])
ob = bpy.data.objects.new("manequim", me)
bpy.context.scene.collection.objects.link(ob)
sk = ob.modifiers.new("skin", "SKIN")
sk.use_smooth_shade = True
for i, (_n, _p, rx, ry) in enumerate(V):
    d = me.skin_vertices[0].data[i]
    d.radius = (rx, ry)
    d.use_root = (i == 0)
sub = ob.modifiers.new("sub", "SUBSURF")
sub.levels = sub.render_levels = 2

# aplica pelo depsgraph (sem operador: em -b o caminho de operador e fechado)
dg = bpy.context.evaluated_depsgraph_get()
m2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
ob.modifiers.clear()
ob.data = m2
bpy.data.meshes.remove(me)


def contorno(z, xmax):
    """Perimetro do corte horizontal em z, so a parte com |x| < xmax (sem bracos)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=geo, plane_co=(0, 0, z), plane_no=(0, 0, 1))
    cut = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    tot = sum(e.calc_length() for e in cut
              if all(abs(v.co.x) < xmax and v.co.y > -1 for v in e.verts))
    bm.free()
    return tot


def contorno_braco(x):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=geo, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    cut = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    tot = sum(e.calc_length() for e in cut if all(v.co.z > 1.2 for v in e.verts))
    bm.free()
    return tot


# acha a altura de maior/menor contorno em faixas
zs = [0.80 + 0.01 * i for i in range(61)]
cs = {round(z, 2): contorno(z, 0.30) for z in zs}
busto_z = max((z for z in cs if 1.15 <= z <= 1.32), key=cs.get)
cintura_z = min((z for z in cs if 0.98 <= z <= 1.15), key=cs.get)
quadril_z = max((z for z in cs if 0.82 <= z <= 1.00), key=cs.get)
xs = [v.co.x for v in ob.data.vertices if v.co.z > 1.30 and abs(v.co.y) < 0.2]
topo_ombro = max(v.co.z for v in ob.data.vertices if 0.12 < v.co.x < 0.22)
med = {
    "busto_cm": round(cs[busto_z] * 100, 1), "busto_z": busto_z,
    "cintura_cm": round(cs[cintura_z] * 100, 1), "cintura_z": cintura_z,
    "quadril_cm": round(cs[quadril_z] * 100, 1), "quadril_z": quadril_z,
    "braco_cm": round(contorno_braco(0.30) * 100, 1),
    "pescoco_cm": round(contorno(1.47, 0.2) * 100, 1),
    "topo_ombro_z": round(topo_ombro, 3),
    "meia_largura_peito_m": round(max(abs(v.co.x) for v in ob.data.vertices
                                      if abs(v.co.z - busto_z) < 0.01 and abs(v.co.x) < 0.3), 3),
    "meia_prof_peito_m": round(max(abs(v.co.y) for v in ob.data.vertices
                                   if abs(v.co.z - busto_z) < 0.01 and abs(v.co.x) < 0.3), 3),
}
print("MEDIDAS", json.dumps(med), flush=True)
with open(f"{saida}/medidas.json", "w") as f:
    json.dump(med, f, indent=1)
# pose final (skill: simular na pose T e so depois descer os bracos)
ob.shape_key_add(name="pose_T")
kp = ob.shape_key_add(name="pose_A")
ANG = math.radians(40)
for i, v in enumerate(ob.data.vertices):
    x, y, z = v.co
    if z < 1.26:
        continue
    s = 1 if x > 0 else -1
    w = min(1.0, max(0.0, (abs(x) - 0.17) / 0.07))   # 0 no tronco, 1 no braco
    w = w * w * (3 - 2 * w)
    a = ANG * w
    dx, dz = x - s * 0.19, z - 1.40
    kp.data[i].co = (s * 0.19 + dx * math.cos(a) + s * dz * math.sin(a), y,
                     1.40 - s * dx * math.sin(a) + dz * math.cos(a))
bpy.ops.wm.save_as_mainfile(filepath=f"{saida}/manequim.blend")
