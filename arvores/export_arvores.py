# Exporta a biblioteca de arvores num JSON pronto pra ser mesclado por quarteirao.
# Cada especie sai nos dois LODs, com posicao (cm), indices e cor por vertice (byte sRGB).
import bpy, bmesh, json, math, random, sys, zlib
from mathutils import Vector

sys.path.insert(0, "C:/Users/respawn/Desktop/imobiliaria/arvores")
import importlib
import arvores as A  # como import o modulo so define; o corpo so roda pela ponte
# O Python do Blender sobrevive entre execucoes: sem o reload, a segunda exportacao
# usa o modulo da PRIMEIRA -- e escreve o JSON no diretorio antigo, calado.
A = importlib.reload(A)

OUT = A.OUT


def srgb_byte(c):
    c = max(0.0, min(1.0, c))
    s = c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return int(round(s * 255))


def dump(spec, lod):
    A.LOD = lod
    random.seed(zlib.crc32(spec["nome"].encode()))
    bm = bmesh.new()
    lay = bm.loops.layers.float_color.new("Col")
    A.build(bm, lay, spec)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()

    # Include exported normals in the key: smooth canopies and hard trunks coexist.
    pos, col, nrm, idx = [], [], [], []
    cache = {}
    for f in bm.faces:
        # Leaf tips can collapse after centimeter quantization. Do not export
        # zero-area triangles or their undefined normals.
        q=[Vector(tuple(round(v*100) for v in vert.co)) for vert in f.verts]
        if (q[1]-q[0]).cross(q[2]-q[0]).length_squared==0 or f.normal.length_squared<1e-10:
            continue
        for l in f.loops:
            n = l.vert.normal if f.smooth else f.normal
            nk = (round(n.x, 2), round(n.y, 2), round(n.z, 2))
            co = l.vert.co
            c = l[lay]
            key = (round(co.x, 3), round(co.y, 3), round(co.z, 3),
                   round(c[0], 3), round(c[1], 3), round(c[2], 3)) + nk
            j = cache.get(key)
            if j is None:
                j = len(pos) // 3
                cache[key] = j
                pos.extend([round(co.x * 100), round(co.y * 100), round(co.z * 100)])
                col.extend([srgb_byte(c[0]), srgb_byte(c[1]), srgb_byte(c[2])])
                nrm.extend([round(n.x * 127), round(n.y * 127), round(n.z * 127)])
            idx.append(j)
    bm.free()
    return {"pos_cm": pos, "nrm_127": nrm, "col": col, "idx": idx,
            "tris": len(idx) // 3, "verts": len(pos) // 3}


lib = {"unidade": "cm", "cor": "sRGB byte, aplicar como vertexColors",
       "obs": "origem no pe do tronco, +Z pra cima; girar em Z e escalar 0.85-1.2 por instancia",
       "especies": {}}
for s in A.SPECIES:
    e = {"estilo": s["style"], "altura_m": s["h"], "lod": {}}
    for lod in (1, 0):
        e["lod"][str(lod)] = dump(s, lod)
    lib["especies"][s["nome"]] = e
A.LOD = 1

path = OUT + "/arvores_lib.json"
with open(path, "w", encoding="utf-8") as fp:
    json.dump(lib, fp, separators=(",", ":"))

import os
kb = os.path.getsize(path) / 1024
print("%-20s %7s %7s" % ("especie", "lod1", "lod0"))
for n, e in lib["especies"].items():
    print("%-20s %7d %7d" % (n, e["lod"]["1"]["tris"], e["lod"]["0"]["tris"]))
print("arquivo: arvores_lib.json  %.0f KB" % kb)
result = round(kb)
