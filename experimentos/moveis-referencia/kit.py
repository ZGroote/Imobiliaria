# -*- coding: utf-8 -*-
"""Kit comum das pecas (Blender headless, sem mode_set -- ele trava em -b).
Cada peca: `peca/cena.py` faz `import kit`, monta com caixa()/material() e chama render().
Tudo que vai pro navegador sai daqui com o MESMO dado (UV em metro, textura de materiais/)."""
import bpy, bmesh, json, math, os, sys, time, zlib
import numpy as np
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
T0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene


def lin(c):
    """sRGB 0-255 -> linear 0-1 (o Principled recebe linear)."""
    return tuple(((v / 255 + 0.055) / 1.055) ** 2.4 if v / 255 > 0.04045 else v / 255 / 12.92 for v in c) + (1.0,)


AMB = set()        # nomes do que e cenario (parede, piso...): o export deixa de fora


def amb(*objs):
    for o in objs:
        AMB.add(o.name)
    return objs[0] if len(objs) == 1 else objs


def obj(nome, me, mats=()):
    o = bpy.data.objects.new(nome, me)
    S.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    return o


def mesh_bm(nome, bm):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    return me


def semente(nome):
    return zlib.crc32(nome.encode()) & 0xffffffff


def uv_metro(bm, veio=None, nome=""):
    """UV em METRO (1 UV = 1 m = 1 repeticao da textura) por projecao de caixa. O veio da madeira
    corre no eixo mais LONGO da peca (porta: vertical; tampo: horizontal), ou no `veio` pedido.
    Cada peca ganha um deslocamento proprio: duas portas lado a lado nao mostram o mesmo desenho."""
    uv = bm.loops.layers.uv.verify()
    co = np.array([v.co[:] for v in bm.verts])
    ext = co.max(0) - co.min(0) if len(co) else np.ones(3)
    g = "xyz".index(veio) if veio else int(np.argmax(ext))
    rng = np.random.default_rng(semente(nome))
    du, dv = rng.random(2)
    for f in bm.faces:
        a = int(np.argmax(np.abs(f.normal)))
        plano = [k for k in range(3) if k != a]
        if g in plano:
            u_ax, v_ax = g, plano[0] if plano[1] == g else plano[1]
        else:                                   # face de topo do veio: tanto faz
            u_ax, v_ax = plano
        for l in f.loops:
            l[uv].uv = (l.vert.co[u_ax] + du, l.vert.co[v_ax] + dv)


def caixa(nome, x0, x1, y0, y1, z0, z1, mat, bevel=0.0015, seg=2, veio=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0),
                       (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bm.normal_update()
    uv_metro(bm, veio, nome)
    o = obj(nome, mesh_bm(nome, bm), [mat])
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width, m.segments, m.limit_method = bevel, seg, "ANGLE"
        m.harden_normals = True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def sock(col, nome):
    return next(x for x in col if x.name == nome and x.enabled)


IMGS = {}


def textura(nome, cor=True):
    p = os.path.join(AQUI, "materiais", nome + ".png")
    if p not in IMGS:
        im = bpy.data.images.load(p)
        im.colorspace_settings.name = "sRGB" if cor else "Non-Color"   # arquivo: recarrega do disco, sem perigo
        IMGS[p] = im
    return IMGS[p]


MATS = {}       # nome -> parametros (o export pro navegador le daqui)


def material(nome, cor=(200, 200, 200), rough=0.6, metal=0.0, tex=None, tinta=(1, 1, 1), relevo=0.5,
             sheen=0.0, coat=0.0, emissao=0.0, spec=0.5, alpha=1.0, duplo=False, escala=1.0):
    """`tex` = prefixo em materiais/ (<tex>_cor.png e <tex>_nor.png). `tinta` multiplica a textura
    (calibrar cor sem refazer a imagem). Sem tex: cor lisa."""
    m = bpy.data.materials.new(nome)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    bs.inputs["Specular IOR Level"].default_value = spec
    if alpha < 1:                             # vidro fume: o mesmo alfa vai pro navegador (opacity)
        bs.inputs["Alpha"].default_value = alpha
    if sheen:
        bs.inputs["Sheen Weight"].default_value = sheen
        bs.inputs["Sheen Roughness"].default_value = 0.5
    if coat:
        bs.inputs["Coat Weight"].default_value = coat
        bs.inputs["Coat Roughness"].default_value = 0.05
    if emissao:
        bs.inputs["Emission Color"].default_value = lin(cor)
        bs.inputs["Emission Strength"].default_value = emissao
    if tex:
        uvn = nt.nodes.new("ShaderNodeUVMap")
        coord = uvn.outputs["UV"]
        if escala != 1.0:                     # 1 repeticao a cada `escala` metros (la grossa: 2 m)
            mpn = nt.nodes.new("ShaderNodeMapping")
            mpn.inputs["Scale"].default_value = (1 / escala, 1 / escala, 1)
            nt.links.new(coord, mpn.inputs["Vector"])
            coord = mpn.outputs["Vector"]
        tc = nt.nodes.new("ShaderNodeTexImage")
        tc.image = textura(tex + "_cor")
        nt.links.new(coord, tc.inputs["Vector"])
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type, mx.blend_type = "RGBA", "MULTIPLY"
        sock(mx.inputs, "Factor").default_value = 1.0
        nt.links.new(tc.outputs["Color"], sock(mx.inputs, "A"))
        sock(mx.inputs, "B").default_value = tuple(tinta) + (1,)
        nt.links.new(sock(mx.outputs, "Result"), bs.inputs["Base Color"])
        if relevo:
            tn = nt.nodes.new("ShaderNodeTexImage")
            tn.image = textura(tex + "_nor", cor=False)
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = relevo
            nt.links.new(coord, tn.inputs["Vector"])
            nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
    else:
        bs.inputs["Base Color"].default_value = lin(cor)
    MATS[nome] = dict(cor=list(cor), rough=rough, metal=metal, tex=tex, tinta=list(tinta), relevo=relevo,
                      sheen=sheen, coat=coat, emissao=emissao, spec=spec, alpha=alpha, duplo=duplo, escala=escala)
    return m


def luz(nome, tipo, loc, energia, cor=(1, 1, 1), tam=1.0, mira=None, tam_y=None):
    ld = bpy.data.lights.new(nome, tipo)
    ld.energy, ld.color = energia, cor
    if tipo == "AREA":
        ld.size = tam
        if tam_y:
            ld.shape, ld.size_y = "RECTANGLE", tam_y
    else:
        ld.shadow_soft_size = tam
    o = bpy.data.objects.new(nome, ld)
    S.collection.objects.link(o)
    o.location = loc
    if mira:
        d = Vector(mira) - Vector(loc)
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o


def mundo(cor=(200, 200, 200), forca=0.5):
    S.world = bpy.data.worlds.new("mundo")
    try:
        S.world.use_nodes = True
    except Exception:
        pass
    bg = next(n for n in S.world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = lin(cor)
    bg.inputs[1].default_value = forca


def camera(peca):
    """camera.json (camera_<peca>.py): nivelada + shift. O shift do Blender e fracao da LARGURA
    quando o sensor e horizontal (viewfac = winx) -- nao do maior lado."""
    C = json.load(open(os.path.join(AQUI, peca, "camera.json")))
    IW, IH = C["res"]
    cd = bpy.data.cameras.new("cam")
    cd.sensor_fit, cd.sensor_width = "HORIZONTAL", 36.0
    if C.get("ortho"):                         # foto de lente longa (fogao): ortografica, quadro centrado
        cd.type, cd.ortho_scale = "ORTHO", C["ortho"]
    else:
        cd.lens = C["f"] / IW * 36.0
        cd.shift_x, cd.shift_y = (IW / 2 - C["cx"]) / IW, (C["cy"] - IH / 2) / IW
    cd.clip_start = 0.05
    o = bpy.data.objects.new("cam", cd)
    S.collection.objects.link(o)
    o.location = C["location"]
    o.rotation_euler = C["rotation_euler"]
    S.camera = o
    return C


def render(saida, res, amostras=128, look=None, vista="AgX"):
    S.render.engine = "CYCLES"
    try:
        cp = bpy.context.preferences.addons["cycles"].preferences
        for tipo in ("OPTIX", "CUDA"):
            try:
                cp.compute_device_type = tipo
                cp.get_devices()
                if any(d.type == tipo for d in cp.devices):
                    for d in cp.devices:
                        d.use = d.type == tipo
                    S.cycles.device = "GPU"
                    print("device", tipo, flush=True)
                    break
            except TypeError:
                continue
    except Exception as e:
        print("sem GPU:", e, flush=True)
    S.cycles.samples = int(os.environ.get("AMOSTRAS", amostras))
    S.cycles.use_denoising = True
    S.render.resolution_x, S.render.resolution_y = res
    S.render.resolution_percentage = 100
    S.view_settings.view_transform = os.environ.get("VISTA", vista)
    # foto de catalogo tem mais contraste que o AgX puro (o escuro sobe): "AgX - High Contrast" etc.
    look = os.environ.get("LOOK", look)
    if look and S.view_settings.view_transform == "AgX":
        S.view_settings.look = look
    S.render.filepath = saida
    if os.environ.get("SO_CENA") == "1":        # export/bake so querem a cena montada
        return
    bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(saida)[0] + ".blend")
    bpy.ops.render.render(write_still=True)
    print("ok %s em %.0f s" % (saida, time.time() - T0), flush=True)


def saida_padrao(peca):
    return sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(AQUI, peca, "render.png")


def estofado(nome, sx, sy, sz, mat, pressao=1.0, passo=0.025, quadros=30, rigidez=40.0, dobra=0.5,
             sub=1):
    """Estofado por SIMULACAO DE PANO: caixa de malha fina inflada por pressao (o que fez o
    travesseiro da cama). O pano nao estica: a face estufa, a aresta puxa pra dentro, o canto vira
    ponta e a ruga nasce na costura -- o "fofo" que bevel+subsurf nao da. UV em metro por face
    (o linho compartilhado segue o pano). Centro na origem; posicione depois."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    for eixo, tam in ((0, sx), (1, sy), (2, sz)):
        n = max(1, round(tam / passo))
        ed = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co)[eixo]) > 1e-6]
        if n > 1:
            bmesh.ops.subdivide_edges(bm, edges=ed, cuts=n - 1, use_grid_fill=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.verify()
    rng = np.random.default_rng(semente(nome))
    du, dv = rng.random(2)
    for f in bm.faces:
        a = int(np.argmax(np.abs(f.normal)))
        pl = [k for k in range(3) if k != a]
        for l in f.loops:
            l[uv].uv = (l.vert.co[pl[0]] + du, l.vert.co[pl[1]] + dv)
    o = obj(nome, mesh_bm(nome, bm), [mat])
    S.frame_start, S.frame_end = 1, quadros
    m = o.modifiers.new("pano", "CLOTH")
    cs = m.settings
    cs.quality, cs.mass = 8, 0.3
    cs.tension_stiffness = cs.compression_stiffness = rigidez
    cs.shear_stiffness, cs.bending_stiffness = 15.0, dobra
    cs.use_pressure, cs.uniform_pressure_force = True, pressao
    cs.effector_weights.gravity = 0.0
    m.point_cache.frame_start, m.point_cache.frame_end = 1, quadros
    for f in range(1, quadros + 1):
        S.frame_set(f)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    o.modifiers.remove(m)
    velho, o.data = o.data, me
    bpy.data.meshes.remove(velho)
    S.frame_set(1)
    for p in me.polygons:
        p.use_smooth = True
    if sub:
        ss = o.modifiers.new("sub", "SUBSURF")
        ss.levels = ss.render_levels = sub
    co = np.array([v.co[:] for v in me.vertices])
    print("estofado %s: %s -> %s (%d faces, %.0f s)" % (nome, (sx, sy, sz), (co.max(0) - co.min(0)).round(3).tolist(),
                                                         len(me.polygons), time.time() - T0), flush=True)
    return o


def poe(o, loc, rot=(0, 0, 0), modo="XYZ"):
    """posiciona; rot em graus. modo "YXZ" = gira no plano (Y) ANTES de deitar (X)."""
    o.rotation_mode = modo
    o.location = loc
    o.rotation_euler = tuple(math.radians(r) for r in rot)
    return o


def rolo(nome, r, comp, mat, achata=1.0, seg=40, aneis=40, ponta=0.05):
    """Rolo de estofado (braco de sofa): tubo ao longo de Y com as pontas arredondadas e secao
    redonda (caixa inflada nunca vira cilindro: fica retangulo de canto mole). UV em metro:
    u = arco (r * angulo), v = comprimento. `achata` < 1 achata a secao em Z."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    perfil = []                                  # (y, raio) com ponta em quarto de circulo
    for k in range(aneis + 1):
        t = k / aneis
        y = -comp / 2 + t * comp
        dist = min(y + comp / 2, comp / 2 - y)
        rr = r * math.sqrt(max(0.0, 1 - max(0.0, 1 - dist / ponta) ** 2)) if dist < ponta else r
        perfil.append((y, max(rr, 0.004)))
    anel = []
    for y, rr in perfil:
        anel.append([bm.verts.new((rr * math.cos(2 * math.pi * j / seg), y, rr * achata * math.sin(2 * math.pi * j / seg)))
                     for j in range(seg)])
    # UV em arco DE VERDADE: u = raio do anel x angulo, v = comprimento do meridiano. Com o raio
    # cheio ate a ponta a trama do linho espremia em raios na tampa (a "estrela" do navegador).
    arco = [0.0]
    for (ya, ra), (yb, rb) in zip(perfil, perfil[1:]):
        arco.append(arco[-1] + math.hypot(yb - ya, rb - ra))
    for i, (a, b) in enumerate(zip(anel, anel[1:])):
        for j in range(seg):
            f = bm.faces.new((a[j], b[j], b[(j + 1) % seg], a[(j + 1) % seg]))
            for l, (jj, ii) in zip(f.loops, ((j, i), (j, i + 1), (j + 1, i + 1), (j + 1, i))):
                l[uvl].uv = (perfil[ii][1] * 2 * math.pi * jj / seg, arco[ii])
    for ring, sgn in ((anel[0], -1), (anel[-1], 1)):
        c = bm.verts.new((0, ring[0].co.y + sgn * 0.002, 0))
        for j in range(seg):
            q = (ring[j], ring[(j + 1) % seg], c) if sgn < 0 else (ring[(j + 1) % seg], ring[j], c)
            f = bm.faces.new(q)
            for l in f.loops:
                l[uvl].uv = (l.vert.co.x, l.vert.co.z)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj(nome, mesh_bm(nome, bm), [mat])
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def travesseiro(nome, w, h, mat, pressao=1.4, nu=40, nv=28, quadros=36):
    """Travesseiro como ENVELOPE costurado na borda (frente e verso) inflado por pressao -- o da cama box.
    A costura nao estica: o canto vira ponta e a borda puxa pra dentro; caixa inflada (estofado) com pouca
    pressao fica placa de canto vivo. Deitado no plano XY, espessura em Z; posicione com poe()."""
    bm = bmesh.new()
    vs = {}

    def vert(i, j, lado):
        borda = i in (0, nu) or j in (0, nv)
        k = ("b", i, j) if borda else (lado, i, j)
        if k not in vs:
            u, v = -1 + 2 * i / nu, -1 + 2 * j / nv
            vs[k] = bm.verts.new((u * w / 2, v * h / 2, 0.0 if borda else lado * 0.015))
        return vs[k]

    for lado in (1, -1):
        for i in range(nu):
            for j in range(nv):
                q = [vert(i, j, lado), vert(i + 1, j, lado), vert(i + 1, j + 1, lado), vert(i, j + 1, lado)]
                bm.faces.new(q if lado == 1 else q[::-1])
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x, l.vert.co.y)
    o = obj(nome, mesh_bm(nome, bm), [mat])
    S.frame_start, S.frame_end = 1, quadros
    m = o.modifiers.new("pano", "CLOTH")
    cs = m.settings
    cs.quality, cs.mass = 8, 0.25
    cs.tension_stiffness = cs.compression_stiffness = 40.0
    cs.shear_stiffness, cs.bending_stiffness = 15.0, 0.05
    cs.use_pressure, cs.uniform_pressure_force = True, pressao
    cs.effector_weights.gravity = 0.0
    m.point_cache.frame_start, m.point_cache.frame_end = 1, quadros
    for f in range(1, quadros + 1):
        S.frame_set(f)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    o.modifiers.remove(m)
    velho, o.data = o.data, me
    bpy.data.meshes.remove(velho)
    S.frame_set(1)
    for p in me.polygons:
        p.use_smooth = True
    ss = o.modifiers.new("sub", "SUBSURF")
    ss.levels = ss.render_levels = 1
    co = np.array([v.co[:] for v in me.vertices])
    print("travesseiro %s: %s (%.0f s)" % (nome, (co.max(0) - co.min(0)).round(3).tolist(), time.time() - T0), flush=True)
    return o
