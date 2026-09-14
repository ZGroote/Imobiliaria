# Gerador parametrico de arvores urbanas brasileiras (low-poly, cor por vertice).
import bpy, bmesh, math, random, zlib
from mathutils import Vector, Matrix

OUT = "C:/Users/respawn/Desktop/imobiliaria/arvores"

# LOD: 1 = copa arredondada (80 tris por blob principal), 0 = icosaedro cru (20 tris).
# O mapa usa 0 pra arvore distante e 1 pra arvore perto/heroi.
LOD = 1


def sd(major):
    """subdivisoes do icosphere conforme o LOD."""
    if major:
        return 2 if LOD else 1
    return 1 if LOD else 1

# ---------------------------------------------------------------- utilidades
def lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i+2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _new(bm, fn):
    before = set(bm.faces)
    fn()
    return [f for f in bm.faces if f not in before]


def paint(faces, lay, color, jitter=0.0, grad=None):
    r, g, b = color
    for f in faces:
        j = 1.0 + random.uniform(-jitter, jitter)
        for l in f.loops:
            k = j
            if grad:
                z0, z1, lo, hi = grad
                t = min(1.0, max(0.0, (l.vert.co.z - z0) / max(1e-6, z1 - z0)))
                k = j * (lo + (hi - lo) * t)
            l[lay] = (min(1.0, r * k), min(1.0, g * k), min(1.0, b * k), 1.0)


def tube(bm, p0, p1, r0, r1, segs=6, caps=False):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    if L < 1e-5:
        return []
    mat = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()

    def f():
        try:
            bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs,
                                  radius1=r0, radius2=r1, depth=L, matrix=mat)
        except TypeError:
            bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs,
                                  diameter1=r0 * 2, diameter2=r1 * 2, depth=L, matrix=mat)
    return _new(bm, f)


def blob(bm, c, r, scale=(1, 1, 1), subd=1, rot=0.0):
    mat = (Matrix.Translation(Vector(c)) @ Matrix.Rotation(rot, 4, 'Z')
           @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0)))

    def f():
        try:
            bmesh.ops.create_icosphere(bm, subdivisions=subd, radius=r, matrix=mat)
        except TypeError:
            bmesh.ops.create_icosphere(bm, subdivisions=subd, diameter=r * 2, matrix=mat)
    faces = _new(bm, f)
    # Irregular canopy outline without increasing the distant triangle budget.
    center=Vector(c)
    for v in {v for face in faces for v in face.verts}:
        d=v.co-center
        amount=1+.065*math.sin(d.x*1.9+rot)*math.cos(d.y*1.7+d.z*.8)
        v.co=center+d*amount
    for face in faces: face.smooth=True
    return faces


def frond(bm, base, yaw, pitch, length, width, droop, segs=5, fold=0.20):
    """Folha de palmeira: fita arqueada com vinco central, 2 quads por segmento."""
    cy, sy = math.cos(yaw), math.sin(yaw)
    rails = [[], [], []]
    for i in range(segs + 1):
        t = i / segs
        x = length * t * math.cos(pitch)
        z = length * t * math.sin(pitch) - droop * length * t * t
        w = width * (math.sin(math.pi * t) ** 0.55)
        if i == 0:
            w = width * 0.15
        for k, off in enumerate((-w, 0.0, w)):
            v = bm.verts.new((base[0] + cy * x - sy * off,
                              base[1] + sy * x + cy * off,
                              base[2] + z + (fold * w if k == 1 else 0.0)))
            rails[k].append(v)
    faces = []
    for i in range(segs):
        for k in (0, 1):
            try:
                faces.append(bm.faces.new((rails[k][i], rails[k][i + 1],
                                           rails[k + 1][i + 1], rails[k + 1][i])))
            except ValueError:
                pass
    return faces


# ---------------------------------------------------------------- estilos
def _trunk_and_anchors(bm, lay, s, bark):
    h, cr = s["h"], s["cr"]
    tr = s.get("tr", h * 0.035)
    fork = s.get("fork", 0.42) * h
    paint(tube(bm, (0, 0, 0), (0, 0, fork), tr * 1.45, tr * 0.8, 7), lay, bark, 0.07)
    n = s.get("branches", 4)
    cz = s.get("cz", 0.72) * h
    anchors = []
    for i in range(n):
        a = 2 * math.pi * i / n + random.uniform(-0.35, 0.35)
        rad = cr * s.get("anchor", 0.45) * random.uniform(0.7, 1.15)
        p = (math.cos(a) * rad, math.sin(a) * rad, cz * random.uniform(0.92, 1.06))
        paint(tube(bm, (0, 0, fork * 0.92), p, tr * 0.72, tr * 0.28, 5), lay, bark, 0.09)
        anchors.append(p)
    return anchors, fork, tr


def build(bm, lay, s):
    st = s["style"]
    leaf = lin(s["leaf"])
    # A cor da "flor" pode ser verde: com FLORACAO=0 a copa de duas cores continua,
    # so que em dois tons de verde. E o que da volume a copa vista de cima.
    _cf = cor_da_flor(s)
    flower = lin(_cf) if _cf else None
    fr = s.get("flower_ratio", 0.0) * (1.0 if _cf else 0.0)
    bark = lin(s.get("bark", "#4A3A2C"))
    h, cr = s["h"], s.get("cr", 3.0)
    leafF, flowF = [], []

    if st in ("dome", "umbrella", "layered", "irregular", "weeping", "tiered", "columnar"):
        anchors, fork, tr = _trunk_and_anchors(bm, lay, s, bark)
        flat = s.get("flat", 0.85)
        br = s.get("br", 0.55) * cr
        plan = []
        if st == "tiered":
            n = s.get("tiers", 4)
            for i in range(n):
                t = i / max(1, n - 1)
                z = h * 0.42 + (h * 0.55) * t
                rr = cr * (1.0 - 0.42 * t)
                plan.append(((0, 0, z), rr, (1, 1, 0.20), sd(1)))
                for k in range(3):
                    a = 2 * math.pi * k / 3 + i * 0.7
                    plan.append(((math.cos(a) * rr * 0.55, math.sin(a) * rr * 0.55, z),
                                 rr * 0.52, (1, 1, 0.24), sd(0)))
        elif st == "columnar":
            # copa so no topo: eucalipto e tronco limpo com penacho alto
            n = s.get("blobs", 7)
            for i in range(n):
                t = i / max(1, n - 1)
                z = h * (0.66 + 0.32 * t)
                a = 2.399 * i + random.uniform(-0.3, 0.3)  # espiral -> copa arejada
                rad = cr * (0.95 - 0.70 * t) * random.uniform(0.45, 1.0)
                plan.append(((math.cos(a) * rad, math.sin(a) * rad, z),
                             cr * random.uniform(0.26, 0.40), (1, 1, 0.85), sd(0)))
        else:
            plan.append(((0, 0, h * s.get("cz", 0.72)), br * s.get("core", 1.05),
                         (1, 1, flat), sd(1)))
            for p in anchors:
                sp = s.get("spread", 1.0)
                plan.append(((p[0] * sp * 1.15, p[1] * sp * 1.15, p[2] + h * s.get("rise", 0.06)),
                             br * random.uniform(0.85, 1.10), (1, 1, flat), sd(1)))
            for i in range(s.get("fill", 4)):
                a = random.uniform(0, 6.283)
                rad = cr * random.uniform(0.45, 0.95)
                zz = h * s.get("cz", 0.72) + random.uniform(-0.10, 0.14) * h * (1.5 if st == "irregular" else 1.0)
                plan.append(((math.cos(a) * rad, math.sin(a) * rad, zz),
                             br * random.uniform(0.60, 0.90), (1, 1, flat), sd(0)))
            if st == "weeping":
                for i in range(6):
                    a = 2 * math.pi * i / 6 + 0.4
                    rad = cr * random.uniform(0.60, 0.90)
                    plan.append(((math.cos(a) * rad, math.sin(a) * rad, h * 0.60),
                                 br * 0.62, (0.85, 0.85, 1.35), sd(0)))
        for (c, r, sc, nsub) in plan:
            fs = blob(bm, c, r, sc, nsub, random.uniform(0, 3.14))
            (flowF if (flower and random.random() < fr) else leafF).extend(fs)

    elif st == "topiary":
        paint(tube(bm, (0, 0, 0), (0, 0, h * 0.42), h * 0.045, h * 0.035, 6), lay, bark, 0.05)
        leafF += blob(bm, (0, 0, h * 0.66), cr, (1, 1, 0.92), sd(1))

    elif st == "shrub":
        for i in range(5):
            a = 2 * math.pi * i / 5
            leafF += blob(bm, (math.cos(a) * cr * 0.42, math.sin(a) * cr * 0.42,
                               h * random.uniform(0.45, 0.7)),
                          cr * random.uniform(0.62, 0.85), (1, 1, 0.85), sd(0))

    elif st == "cone":
        paint(tube(bm, (0, 0, 0), (0, 0, h * 0.28), h * 0.035, h * 0.022, 6), lay, bark, 0.05)
        n = s.get("tiers", 3)
        for i in range(n):
            t = i / n
            z0 = h * (0.20 + 0.62 * t)
            leafF += tube(bm, (0, 0, z0), (0, 0, z0 + h * 0.42 * (1 - 0.18 * t)),
                          cr * (1.0 - 0.30 * t), 0.0, 8)

    elif st == "candelabra":
        paint(tube(bm, (0, 0, 0), (0, 0, h * 0.74), h * 0.030, h * 0.020, 7), lay, bark, 0.06)
        n = s.get("arms", 7)
        for i in range(n):
            a = 2 * math.pi * i / n + random.uniform(-0.15, 0.15)
            t = random.uniform(0.80, 1.0)
            tip = (math.cos(a) * cr * t, math.sin(a) * cr * t, h * random.uniform(0.80, 0.94))
            paint(tube(bm, (0, 0, h * 0.72), tip, h * 0.012, h * 0.006, 4), lay, bark, 0.08)
            leafF += blob(bm, tip, cr * 0.36, (1, 1, 0.30), sd(0), random.uniform(0, 3.1))
        leafF += blob(bm, (0, 0, h * 0.99), cr * 0.32, (1, 1, 0.45), sd(0))

    elif st in ("palm", "clump_palm"):
        stems = s.get("stems", 1)
        for st_i in range(stems):
            ox = random.uniform(-0.35, 0.35) if stems > 1 else 0.0
            oy = random.uniform(-0.35, 0.35) if stems > 1 else 0.0
            hh = h * (random.uniform(0.72, 1.0) if stems > 1 else 1.0)
            lean = s.get("lean", 0.0) * (random.choice([1, -1]) if stems > 1 else 1)
            segs = 6
            pts = [(ox + lean * hh * (i / segs) ** 1.7, oy, hh * i / segs) for i in range(segs + 1)]
            tr = s.get("tr", hh * 0.030)
            for i in range(segs):
                bulge = 1.25 if (s.get("belly") and i == 1) else 1.0
                paint(tube(bm, pts[i], pts[i + 1], tr * (1.18 - 0.30 * i / segs) * bulge,
                           tr * (1.18 - 0.30 * (i + 1) / segs), 7), lay, bark, 0.05)
            top = pts[-1]
            if s.get("shaft"):  # capitel verde da imperial, logo abaixo das folhas
                base_shaft = (pts[-2][0] * 0.4 + top[0] * 0.6, top[1], hh * 0.86)
                paint(tube(bm, base_shaft, top, tr * 0.95, tr * 0.70, 7),
                      lay, lin(s["shaft"]), 0.04)
            nf = s.get("fronds", 11)
            for i in range(nf):
                yaw = 2 * math.pi * i / nf + random.uniform(-0.12, 0.12)
                p0, p1 = s.get("pitch", (0.10, 0.80))
                # alterna pra que folha nova fique alta e folha velha caia
                pit = p0 + (p1 - p0) * ((i % 3) / 2.0 + random.uniform(-0.15, 0.15))
                pit = max(-0.35, min(1.1, pit))
                leafF += frond(bm, top, yaw, pit,
                               s["flen"] * random.uniform(0.85, 1.12),
                               s["fw"], s.get("droop", 0.55), s.get("fsegs", 5))

    # pintura com gradiente vertical (topo mais claro) -> profundidade sem textura
    for group, colr in ((leafF, leaf), (flowF, flower or leaf)):
        if not group:
            continue
        zs = [v.co.z for f in group for v in f.verts]
        paint(group, lay, tuple(c*.88 for c in colr), 0.008, (min(zs), max(zs), 0.72, 1.08))


# ---------------------------------------------------------------- catalogo
# A tabela saiu daqui pra `especies.py`: ela e dado puro e nao pode depender de
# ter o Blender aberto pra ser lida (ver o cabecalho de la).
from especies import SPECIES, FLORACAO, cor_da_flor


# ---------------------------------------------------------------- montagem
def limpar():
    for ob in list(bpy.data.objects):
        if ob.name.startswith(("TR_", "LB_")) or ob.name == "Cube":
            bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)


def montar():
    limpar()
    col = bpy.data.collections.get("Arvores")
    if col is None:
        col = bpy.data.collections.new("Arvores")
        bpy.context.scene.collection.children.link(col)
    stats = []
    COLS, DX, DY = 5, 18.0, 26.0
    for i, s in enumerate(SPECIES):
        random.seed(zlib.crc32(s["nome"].encode()))
        bm = bmesh.new()
        lay = bm.loops.layers.float_color.new("Col")
        build(bm, lay, s)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new("TR_" + s["nome"])
        bm.to_mesh(me)
        bm.free()
        if me.color_attributes:
            me.color_attributes.active_color_index = 0
            me.color_attributes.render_color_index = 0
        ob = bpy.data.objects.new("TR_" + s["nome"], me)
        ob.location = ((i % COLS) * DX, (i // COLS) * DY, 0.0)
        col.objects.link(ob)
        co = [v.co for v in me.vertices]
        alt = max(v.z for v in co)
        larg = 2 * max(max(abs(v.x), abs(v.y)) for v in co)

        # mesma arvore no LOD baixo, so pra medir o custo distante
        global LOD
        LOD = 0
        random.seed(zlib.crc32(s["nome"].encode()))
        bm2 = bmesh.new()
        build(bm2, bm2.loops.layers.float_color.new("Col"), s)
        bmesh.ops.triangulate(bm2, faces=bm2.faces[:])
        lo = len(bm2.faces)
        bm2.free()
        LOD = 1

        stats.append((s["nome"], len(me.polygons), lo, len(me.vertices), alt, larg))
    return stats


if __name__ != "arvores":  # rodando direto pela ponte; como import so define
    stats = montar()
    tot = sum(t[1] for t in stats)
    tlo = sum(t[2] for t in stats)
    print("%-20s %6s %6s %6s %7s %7s" % ("especie", "tris", "lod0", "verts", "alt_m", "larg_m"))
    for n, t, lo, v, a, w in stats:
        print("%-20s %6d %6d %6d %7.1f %7.1f" % (n, t, lo, v, a, w))
    print("-" * 60)
    print("total %d tris (lod0 %d) em %d especies -- media %.0f / %.0f"
          % (tot, tlo, len(stats), tot / len(stats), tlo / len(stats)))
    bpy.ops.wm.save_as_mainfile(filepath=OUT + "/arvores.blend")
    print("salvo em arvores.blend")
    result = tot
