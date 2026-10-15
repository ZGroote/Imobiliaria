"""Piloto de qualidade: veste sala/cozinha do Meio no Blender e renderiza vistas fixas no Cycles.

Uso (na raiz do repositório):
  blender -b experimentos/liv-experimental-2026-10-14/interiores/meio/bake/interior-source.blend \
    --python experimentos/liv-experimental-2026-10-14/piloto-render/montar_sala.py -- \
    --saida experimentos/liv-experimental-2026-10-14/piloto-render/v1 [--amostras 256] [--vistas v1,v2,v3]

Decorado livre, sol de inverno (21/06) às 16h30 em São Carlos. O norte da implantação não foi
validado: o sol entra pela varanda por escolha artística (ver README.md desta pasta).
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
TEX = os.path.join(RAIZ, "publicacao", "piloto-qualidade-visual-2026-10-04", "materiais-v2", "originais")
SOFA_GEN = os.path.join(RAIZ, "blender", "sofa_generator.py")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(nome, padrao):
    return argv[argv.index(nome) + 1] if nome in argv else padrao
SAIDA = os.path.abspath(arg("--saida", os.path.join(AQUI, "v1")))
AMOSTRAS = int(arg("--amostras", "256"))
VISTAS = arg("--vistas", "v1,v2,v3").split(",")
RES = [int(v) for v in arg("--res", "1280x720").split("x")]
os.makedirs(SAIDA, exist_ok=True)
random.seed(7)
cena = bpy.context.scene
col = bpy.data.collections.new("Piloto"); cena.collection.children.link(col)

# ---------------------------------------------------------------- materiais
def principled(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")

def entrada(no, *nomes):
    for n in nomes:
        if n in no.inputs: return no.inputs[n]
    raise KeyError(nomes)

def novo_mat(nome):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    return m

def imagem(nt, arquivo, cor=True):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(os.path.join(TEX, arquivo), check_existing=True)
    t.image.colorspace_settings.name = "sRGB" if cor else "Non-Color"
    t.projection = "BOX"; t.projection_blend = 0.25
    return t

def mat_textura(m, base, escala, tinta=(1, 1, 1), rug=(0.0, 1.0), relevo=0.08):
    """Textura em escala física (metros por repetição) por projeção em caixa no espaço do mundo."""
    nt = m.node_tree; b = principled(m)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / escala,) * 3
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])
    c = imagem(nt, base + "-color.jpg"); r = imagem(nt, base + "-roughness.png", False)
    for t in (c, r): nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0; mix.inputs["B"].default_value = (*tinta, 1)
    nt.links.new(c.outputs["Color"], mix.inputs["A"]); nt.links.new(mix.outputs["Result"], entrada(b, "Base Color"))
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = rug
    nt.links.new(r.outputs["Color"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], entrada(b, "Roughness"))
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = relevo
    nt.links.new(c.outputs["Color"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], entrada(b, "Normal"))
    return m

def mat_liso(m, cor, rug=0.5, metal=0.0, coat=0.0):
    b = principled(m)
    entrada(b, "Base Color").default_value = (*cor, 1); entrada(b, "Roughness").default_value = rug
    entrada(b, "Metallic").default_value = metal; entrada(b, "Coat Weight").default_value = coat
    return m

def mat_marmore(nome):
    m = novo_mat(nome); nt = m.node_tree; b = principled(m)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 0.9
    wv.inputs["Distortion"].default_value = 14; wv.inputs["Detail"].default_value = 10
    wv.inputs["Detail Scale"].default_value = 1.6
    nt.links.new(geo.outputs["Position"], wv.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB"); e = cr.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.30, 0.29, 0.28, 1); e[1].position, e[1].color = 0.12, (0.93, 0.92, 0.90, 1)
    nt.links.new(wv.outputs["Fac"], cr.inputs["Fac"]); nt.links.new(cr.outputs["Color"], entrada(b, "Base Color"))
    entrada(b, "Roughness").default_value = 0.12; entrada(b, "Coat Weight").default_value = 0.4
    return m

def mat_vidro(nome):
    """Vidro que deixa o sol passar: raio de sombra vê transparência (sem cáustica)."""
    m = novo_mat(nome); nt = m.node_tree; out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    g = nt.nodes.new("ShaderNodeBsdfGlass"); g.inputs["Roughness"].default_value = 0.0; g.inputs["IOR"].default_value = 1.5
    t = nt.nodes.new("ShaderNodeBsdfTransparent"); lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs[0]); nt.links.new(g.outputs[0], mx.inputs[1])
    nt.links.new(t.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m

def mat_emissor(nome, cor, forca):
    m = novo_mat(nome); b = principled(m)
    entrada(b, "Base Color").default_value = (*cor, 1)
    entrada(b, "Emission Color").default_value = (*cor, 1); entrada(b, "Emission Strength").default_value = forca
    return m

def mat_por_altura(nome, baixo, alto, z):
    """Um objeto, dois acabamentos: acima de z (tampo) usa `alto`."""
    m = novo_mat(nome); nt = m.node_tree; out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    nt.nodes.remove(principled(m))
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = z
    nt.links.new(geo.outputs["Position"], sep.inputs[0]); nt.links.new(sep.outputs["Z"], gt.inputs[0])
    mx = nt.nodes.new("ShaderNodeMixShader"); nt.links.new(gt.outputs[0], mx.inputs[0])
    for i, src in ((1, baixo), (2, alto)):
        g = nt.nodes.new("ShaderNodeGroup"); grp = bpy.data.node_groups.new(src.name + "_grp", "ShaderNodeTree")
        # copia a árvore do material de origem para um grupo
        grp.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
        mapa = {}
        for n in src.node_tree.nodes:
            if n.type == "OUTPUT_MATERIAL": continue
            c = grp.nodes.new(n.bl_idname); mapa[n.name] = c
            for attr in ("operation", "data_type", "blend_type", "projection", "projection_blend", "image"):
                if hasattr(n, attr): setattr(c, attr, getattr(n, attr))
            if n.type == "VALTORGB":
                for k, el in enumerate(n.color_ramp.elements):
                    e2 = c.color_ramp.elements[k] if k < len(c.color_ramp.elements) else c.color_ramp.elements.new(el.position)
                    e2.position, e2.color = el.position, el.color
            for a, b2 in zip(n.inputs, c.inputs):
                if hasattr(a, "default_value") and not a.is_linked:
                    try: b2.default_value = a.default_value
                    except Exception: pass
        go = grp.nodes.new("NodeGroupOutput")
        for l in src.node_tree.links:
            if l.to_node.type == "OUTPUT_MATERIAL":
                grp.links.new(mapa[l.from_node.name].outputs[l.from_socket.identifier], go.inputs[0])
            else:
                fo = next(s for s in mapa[l.from_node.name].outputs if s.identifier == l.from_socket.identifier)
                ti = next(s for s in mapa[l.to_node.name].inputs if s.identifier == l.to_socket.identifier)
                grp.links.new(fo, ti)
        g.node_tree = grp; nt.links.new(g.outputs[0], mx.inputs[i])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m

M = bpy.data.materials
PAREDE = mat_liso(M["m0"], (0.86, 0.83, 0.78), rug=0.9)
PISO = mat_textura(M["m1"], "madeira", 1.8, tinta=(0.95, 0.85, 0.75), rug=(0.25, 0.55), relevo=0.05)
mat_textura(M["m2"], "frio", 0.9, tinta=(0.92, 0.9, 0.87), rug=(0.2, 0.4), relevo=0.02)
NOGUEIRA = mat_textura(novo_mat("Nogueira"), "madeira_movel", 1.2, tinta=(0.85, 0.7, 0.55), rug=(0.35, 0.6), relevo=0.04)
MARMORE = mat_marmore("Marmore")
LINHO = mat_liso(novo_mat("Linho cru"), (0.82, 0.76, 0.66), rug=0.95)   # a textura "tecido" é xadrez
BOUCLE = mat_liso(novo_mat("Boucle"), (0.86, 0.82, 0.75), rug=0.95)
TAPETE = mat_liso(novo_mat("Tapete la"), (0.74, 0.68, 0.6), rug=1.0)
PRETO = mat_liso(novo_mat("Metal preto"), (0.02, 0.02, 0.02), rug=0.35, metal=1.0)
INOX = mat_liso(novo_mat("Inox"), (0.75, 0.74, 0.72), rug=0.28, metal=1.0)
LATAO = mat_liso(novo_mat("Latao"), (0.85, 0.66, 0.38), rug=0.25, metal=1.0)
CERAMICA = mat_liso(novo_mat("Ceramica"), (0.86, 0.82, 0.76), rug=0.45, coat=0.3)
TERRACOTA = mat_liso(novo_mat("Terracota"), (0.55, 0.30, 0.20), rug=0.8)
LED = mat_emissor("LED 2700K", (1.0, 0.72, 0.42), 9.0)
TELA = mat_emissor("Tela TV", (0.05, 0.07, 0.1), 0.25)
VIDRO = mat_vidro("Vidro")
FOLHA = mat_liso(novo_mat("Folha"), (0.06, 0.16, 0.05), rug=0.45)
entrada(principled(FOLHA), "Subsurface Weight").default_value = 0.25

M["m3"].node_tree and mat_liso(M["m3"], (0.92, 0.9, 0.86), rug=0.4)        # portas e batentes
mat_liso(M["m4"], (0.12, 0.12, 0.12), rug=0.4, metal=0.6)                  # caixilhos
M["m5"].user_remap(VIDRO)                                                  # vidro opaco -> vidro real

def troca(nome_mat, novo):
    if nome_mat in M: M[nome_mat].user_remap(novo)

BANCADA = mat_por_altura("Bancada", NOGUEIRA, MARMORE, 0.86)
for n in ("Acabamento pia", "Acabamento pia.001", "Acabamento pia.002"):   # cozinha e os dois lavatórios
    troca(n, BANCADA)
troca("Acabamento mesa.001", mat_por_altura("Mesa jantar", PRETO, MARMORE, 0.74))
for n in ("Acabamento cadeira", "Acabamento cadeira.001", "Acabamento cadeira.002", "Acabamento cadeira.003"):
    troca(n, BOUCLE)
troca("Acabamento rack", NOGUEIRA); troca("Tapete LIV", TAPETE); troca("Acabamento geladeira", INOX)

# ---------------------------------------------------------------- geometria auxiliar
def caixa(nome, dim, centro, mat, bevel=0.004):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((*dim, 1.0)))
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob); ob.location = centro
    me.materials.append(mat)
    if bevel:
        bv = ob.modifiers.new("Bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    return ob

def esfera(nome, r, centro, mat, escala=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=r)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob); ob.location = centro; ob.scale = escala
    me.materials.append(mat); return ob

def cilindro(nome, r, h, base, mat, r_topo=None, seg=32):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r_topo if r_topo is not None else r, depth=h)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob)
    ob.location = (base[0], base[1], base[2] + h / 2); me.materials.append(mat); return ob

def luz(nome, tipo, centro, energia, cor=(1.0, 0.75, 0.5), **kw):
    d = bpy.data.lights.new(nome, tipo); d.energy = energia; d.color = cor
    for k, v in kw.items(): setattr(d, k, v)
    ob = bpy.data.objects.new(nome, d); col.objects.link(ob); ob.location = centro; return ob

def planta(nome, base, altura, folhas=22, larg=0.10, vaso=CERAMICA, r_vaso=0.16):
    cilindro(nome + " vaso", r_vaso, r_vaso * 2.0, base, vaso, r_topo=r_vaso * 1.15)
    topo = base[2] + r_vaso * 2.0
    for i in range(folhas):
        h = topo + altura * (0.25 + 0.75 * random.random())
        ang = random.uniform(0, 2 * math.pi); raio = random.uniform(0.05, 0.35) * altura / 1.2
        f = esfera(f"{nome} folha {i}", 1.0, (base[0] + math.cos(ang) * raio, base[1] + math.sin(ang) * raio, h),
                   FOLHA, escala=(larg, larg * 2.4, 0.006))
        f.rotation_euler = (random.uniform(0.6, 1.2), 0, ang - math.pi / 2)
        haste = cilindro(f"{nome} haste {i}", 0.006, h - topo, (base[0] + math.cos(ang) * raio * 0.5,
                         base[1] + math.sin(ang) * raio * 0.5, topo), FOLHA, seg=6)

def cortina(nome, x0, x1, y, mat, ondas=7, amp=0.05):
    w = x1 - x0; n = ondas * 8
    bm = bmesh.new(); vs = []
    for i in range(n + 1):
        x = x0 + w * i / n; dy = amp * math.sin(i / n * ondas * 2 * math.pi)
        vs.append((bm.verts.new((x, y + dy, 0.03)), bm.verts.new((x, y + dy, 2.66))))
    for i in range(n):
        bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob); me.materials.append(mat)
    ob.modifiers.new("Esp", "SOLIDIFY").thickness = 0.004
    return ob

# ---------------------------------------------------------------- sofá (gerador do repositório, arquétipo Cloud)
fonte = open(SOFA_GEN, encoding="utf-8").read()
fonte = fonte[:fonte.index("# 5. EXECUÇÃO")]
ns = {"__name__": "sofa_generator"}; exec(compile(fonte, SOFA_GEN, "exec"), ns)
bpy.data.objects.remove(bpy.data.objects["mesh-14"], do_unlink=True)   # sofá de blocos antigo
sc, ec = ns["reset_sofa_collection"](); ns["build_sofa_0_cloud"]()
raiz = bpy.data.objects.new("Sofa_Root", None); sc.objects.link(raiz)
for ob in list(sc.objects):
    if ob is not raiz and ob.parent is None: ob.parent = raiz
raiz.location = (-1.17, -2.18, 0.02); raiz.rotation_euler = (0, 0, math.pi); raiz.scale = (0.78, 0.82, 1.0)
bpy.data.collections.remove(ec)

# ---------------------------------------------------------------- parede da TV: ripado, TV, LED
for i in range(27):
    x = -1.88 + 0.03 + i * 0.06
    caixa(f"Ripa {i}", (0.035, 0.025, 2.66), (x, -0.315, 1.36), NOGUEIRA, bevel=0.003)
caixa("Fita LED ripado", (1.58, 0.01, 0.012), (-1.08, -0.335, 2.64), LED, bevel=0)
tv = caixa("TV", (1.25, 0.03, 0.72), (-1.08, -0.345, 1.28), PRETO, bevel=0.005)
caixa("TV tela", (1.21, 0.002, 0.68), (-1.08, -0.362, 1.28), TELA, bevel=0)
# objetos no rack (topo em z 0.73)
for i, (w, h) in enumerate(((0.035, 0.24), (0.03, 0.22), (0.04, 0.25), (0.03, 0.2))):
    caixa(f"Livro {i}", (w, 0.17, h), (-1.68 + i * 0.04, -0.46, 0.73 + h / 2),
          [LINHO, NOGUEIRA, CERAMICA, TERRACOTA][i], bevel=0.002)
cilindro("Vaso rack", 0.07, 0.26, (-0.55, -0.46, 0.73), CERAMICA, r_topo=0.04)
esfera("Objeto rack", 0.06, (-0.75, -0.46, 0.79), LATAO)

# ---------------------------------------------------------------- cozinha: armários altos com LED embaixo
caixa("Armario alto", (0.36, 1.74, 0.72), (-4.62, -0.6, 1.98), NOGUEIRA, bevel=0.004)
caixa("Fita LED armario", (0.02, 1.68, 0.008), (-4.5, -0.6, 1.614), LED, bevel=0)
cilindro("Torneira", 0.012, 0.32, (-4.62, -0.9, 0.93), PRETO)
for i, x in enumerate((-4.6, -4.5)):
    cilindro(f"Pote {i}", 0.05 + 0.01 * i, 0.12 + 0.06 * i, (x, 0.05, 0.93), CERAMICA)

# ---------------------------------------------------------------- jantar: pendentes e centro de mesa
for i, y in enumerate((-0.35, -0.05, 0.25)):
    cilindro(f"Cabo {i}", 0.003, 0.95, (-2.78, y, 1.75), PRETO, seg=6)
    esfera(f"Pendente {i}", 0.09, (-2.78, y, 1.72), mat_emissor(f"Globo {i}", (1.0, 0.78, 0.55), 2.5))
    luz(f"Luz pendente {i}", "POINT", (-2.78, y, 1.66), 12, shadow_soft_size=0.08)
cilindro("Vaso mesa", 0.08, 0.18, (-2.78, -0.05, 0.79), CERAMICA, r_topo=0.06)
planta("Ramo mesa", (-2.78, -0.05, 0.95), 0.35, folhas=10, larg=0.04, vaso=CERAMICA, r_vaso=0.0001)

# ---------------------------------------------------------------- plantas, cortinas, almofadas
planta("Planta sala", (-0.55, -2.4, 0.02), 1.35, folhas=26, larg=0.11, vaso=TERRACOTA)
planta("Planta varanda", (-4.45, 1.0, 0.02), 1.1, folhas=20, larg=0.09)
VOIL = novo_mat("Voil"); vb = principled(VOIL)
entrada(vb, "Base Color").default_value = (0.95, 0.92, 0.86, 1); entrada(vb, "Roughness").default_value = 0.9
entrada(vb, "Transmission Weight").default_value = 0.55
cortina("Cortina E", -4.78, -4.45, 1.12, VOIL, ondas=4); cortina("Cortina D", -2.15, -1.95, 1.12, VOIL, ondas=3)

# ---------------------------------------------------------------- quartos, banheiros e varanda
FREIJO = mat_textura(novo_mat("Freijo"), "madeira_movel", 1.2, tinta=(1.05, 0.92, 0.8), rug=(0.35, 0.6), relevo=0.04)
ROUPA = mat_liso(novo_mat("Roupa de cama"), (0.9, 0.89, 0.86), rug=0.95)
PAINEL = mat_liso(novo_mat("Painel estofado"), (0.72, 0.66, 0.58), rug=0.95)
LOUCA = mat_liso(novo_mat("Louca"), (0.93, 0.93, 0.92), rug=0.08, coat=0.5)
ESMALTE = mat_liso(novo_mat("Esmalte"), (0.9, 0.9, 0.89), rug=0.3)
ESPELHO = mat_liso(novo_mat("Espelho"), (0.92, 0.92, 0.92), rug=0.02, metal=1.0)
def manta(cor):
    return mat_liso(novo_mat("Manta"), cor, rug=1.0)

for n in ("Algodao cru", "Algodao cru.001"): troca(n, ROUPA)
for n in ("Acabamento criado", "Acabamento criado.001"): troca(n, NOGUEIRA)
for n in ("Acabamento guardaroupa", "Acabamento guardaroupa.001", "Acabamento mesa", "Acabamento mesa.002"):
    troca(n, FREIJO)
for n in ("Acabamento cadeira.004", "Acabamento cadeira.005"): troca(n, BOUCLE)
for n in ("Acabamento vaso", "Acabamento vaso.001", "Acabamento pia.003"): troca(n, LOUCA)
for n in ("Acabamento box", "Acabamento box.001"): troca(n, VIDRO)
troca("Acabamento maquina", ESMALTE)

def abajur(nome, base):
    x, y, z = base
    cilindro(nome + " base", 0.055, 0.24, (x, y, z), CERAMICA, r_topo=0.035)
    cilindro(nome + " cupula", 0.14, 0.2, (x, y, z + 0.24), mat_emissor(nome + " tecido", (1.0, 0.82, 0.62), 2.2), r_topo=0.1)
    luz(nome + " luz", "POINT", (x, y, z + 0.33), 10, shadow_soft_size=0.08)

def parede_atras(obj, z=1.4):
    """Parede mais próxima de um móvel encostado: devolve (ponto na parede, normal para dentro)."""
    dg = bpy.context.evaluated_depsgraph_get()
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    c = Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, z))
    melhor = None
    for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0))):
        ok, loc, n, *_ = cena.ray_cast(dg, c, d, distance=1.0)
        if ok and (melhor is None or (loc - c).length < (melhor[0] - c).length):
            melhor = (loc, -d)
    return melhor

def lavatorio(nome, obj):
    """Revestimento de porcelanato marmorizado, espelho com LED atrás e toalha sobre o lavatório."""
    loc, n = parede_atras(obj)
    lado = Vector((-n.y, n.x, 0))
    giro = math.atan2(n.y, n.x)
    def placa(nm, larg, alt, zc, desloc, mat, esp=0.01):
        ob = caixa(nm, (esp, larg, alt), loc + n * desloc + Vector((0, 0, zc - loc.z)), mat, bevel=0)
        ob.rotation_euler = (0, 0, giro); return ob
    placa(nome + " revestimento", 1.3, 2.62, 1.34, 0.006, MARMORE)
    placa(nome + " LED", 0.66, 0.86, 1.5, 0.014, mat_emissor(nome + " brilho", (1.0, 0.8, 0.6), 3.0), esp=0.004)
    placa(nome + " espelho", 0.6, 0.8, 1.5, 0.03, ESPELHO, esp=0.012)
    t = caixa(nome + " toalha", (0.04, 0.4, 0.6), loc + n * 0.04 + lado * 0.55 + Vector((0, 0, 1.0 - loc.z)), ROUPA, bevel=0.01)
    t.rotation_euler = (0, 0, giro)
    cilindro(nome + " torneira", 0.012, 0.22, tuple(loc + n * 0.08 + Vector((0, 0, 0.93 - loc.z))), PRETO)
    luz(nome + " spot", "SPOT", tuple(loc + n * 0.45 + Vector((0, 0, 2.66 - loc.z))), 25,
        spot_size=math.radians(80), spot_blend=0.6, shadow_soft_size=0.03)

O = bpy.data.objects
def topo(x, y):
    """Altura da primeira superfície abaixo de (x, y): o colchão, não o chute."""
    dg = bpy.context.evaluated_depsgraph_get()
    ok, loc, *_ = cena.ray_cast(dg, Vector((x, y, 2.5)), Vector((0, 0, -1)))
    return loc.z if ok else 0.0
ZS, ZQ = topo(3.3, -0.25), topo(-1.22, 1.0)   # colchão da suíte e do quarto 1
print("COLCHAO", round(ZS, 3), round(ZQ, 3))
# suíte: cabeceira em +x, criados dos dois lados
caixa("Painel cabeceira", (0.06, 2.7, 1.2), (4.79, -0.25, 1.05), PAINEL, bevel=0.01)
for i, y in enumerate((-0.55, 0.05)):
    ns["make_throw_pillow"](f"Travesseiro suite {i}", 0.55, 0.42, 0.16, (4.3, y, ZS + 0.13),
                            (0, math.radians(-14), math.radians(90)), ROUPA)
ns["make_throw_pillow"]("Almofada suite", 0.4, 0.4, 0.15, (4.12, -0.25, ZS + 0.17), (0, math.radians(-18), math.radians(90)),
                        manta((0.62, 0.42, 0.32)))
caixa("Manta suite", (0.55, 1.62, 0.035), (2.98, -0.25, ZS + 0.018), manta((0.62, 0.42, 0.32)), bevel=0.012)
caixa("Tapete suite", (2.3, 2.5, 0.012), (3.35, -0.25, 0.026), TAPETE, bevel=0.004)
abajur("Abajur suite A", (4.52, 0.75, 0.58)); abajur("Abajur suite B", (4.52, -1.2, 0.58))
planta("Planta suite", (2.55, 1.0, 0.02), 0.9, folhas=14, larg=0.08)
cortina("Cortina suite", 2.45, 2.85, 1.24, VOIL, ondas=3)

# quarto 1: cama de solteiro com cabeceira em +y, escrivaninha na parede da sala
caixa("Painel cabeceira q1", (1.15, 0.06, 1.0), (-1.22, 2.27, 0.95), PAINEL, bevel=0.01)
ns["make_throw_pillow"]("Travesseiro q1", 0.55, 0.4, 0.15, (-1.22, 1.98, ZQ + 0.13), (math.radians(14), 0, 0), ROUPA)
caixa("Manta q1", (0.97, 0.5, 0.035), (-1.22, 0.62, ZQ + 0.018), manta((0.55, 0.62, 0.52)), bevel=0.012)
caixa("Tapete q1", (1.0, 1.4, 0.012), (-0.25, 1.3, 0.026), TAPETE, bevel=0.004)
caixa("Prateleira q1", (1.0, 0.22, 0.03), (-0.8, -0.15, 1.55), FREIJO, bevel=0.003)
for i in range(6):
    h = 0.2 + 0.03 * (i % 3)
    caixa(f"Livro q1 {i}", (0.035, 0.16, h), (-1.2 + i * 0.045, -0.15, 1.565 + h / 2), [LINHO, NOGUEIRA, TERRACOTA][i % 3], bevel=0.002)
cilindro("Luminaria mesa base", 0.07, 0.02, (-0.3, 0.05, 0.77), PRETO)
cilindro("Luminaria mesa haste", 0.008, 0.42, (-0.3, 0.05, 0.79), PRETO, seg=8)
cilindro("Luminaria mesa cupula", 0.09, 0.12, (-0.3, 0.05, 1.18), mat_emissor("Cupula mesa", (1.0, 0.8, 0.6), 2.0), r_topo=0.05)
luz("Luminaria mesa luz", "POINT", (-0.3, 0.05, 1.16), 8, shadow_soft_size=0.05)
planta("Planta q1", (-1.35, 0.05, 0.77), 0.3, folhas=8, larg=0.04, r_vaso=0.06)
cortina("Cortina q1", -0.78, -0.5, 2.24, VOIL, ondas=3)

# banheiros
lavatorio("Banho suite", O["mesh-25"]); lavatorio("Banho social", O["mesh-28"])

# varanda / serviço
planta("Planta varanda 2", (-2.15, 2.35, 0.02), 0.8, folhas=12, larg=0.08, vaso=TERRACOTA)
cilindro("Vaso varanda mesa", 0.06, 0.16, (-3.03, 1.8, 0.79), CERAMICA, r_topo=0.045)

# ---------------------------------------------------------------- luz artificial quente
for ob in cena.objects:
    if ob.type == "LIGHT" and ob.name.startswith("LIV fixture"):
        ob.data.color = (1.0, 0.78, 0.55); ob.data.energy = 18
for i, (x, y) in enumerate(((-1.55, -1.2), (-0.6, -1.2), (-3.6, -1.6), (-3.6, -0.4))):
    luz(f"Spot {i}", "SPOT", (x, y, 2.66), 35, spot_size=math.radians(70), spot_blend=0.6, shadow_soft_size=0.03)
    cilindro(f"Spot aro {i}", 0.045, 0.01, (x, y, 2.685), mat_emissor(f"Spot emissor {i}", (1.0, 0.8, 0.6), 4.0))

# ---------------------------------------------------------------- sol de inverno, 16h30, São Carlos
# 21/06, lat -22.0, lon -47.9, UTC-3: altitude ~13 graus, azimute ~302 graus (noroeste).
# Sem norte validado, o sol vem perpendicular à fachada da varanda (+y): a varredura de azimutes
# (raios do piso até o sol) mostrou que é a direção que mais ilumina o piso da sala.
ALT, DIR = math.radians(13.0), Vector((0.0, 1.0, 0.0))
para_sol = (DIR * math.cos(ALT) + Vector((0, 0, math.sin(ALT)))).normalized()
sol = next(o for o in cena.objects if o.type == "LIGHT" and o.data.type == "SUN")
sol.rotation_euler = Vector((0, 0, 1)).rotation_difference(para_sol).to_euler()
sol.data.energy = 5.0; sol.data.color = (1.0, 0.70, 0.46); sol.data.angle = math.radians(0.6)

mundo = cena.world; mundo.use_nodes = True; wn = mundo.node_tree
for n in list(wn.nodes):
    if n.type != "OUTPUT_WORLD": wn.nodes.remove(n)
ceu = wn.nodes.new("ShaderNodeTexSky")
tipos = [i.identifier for i in ceu.bl_rna.properties["sky_type"].enum_items]
ceu.sky_type = next((t for t in tipos if "NISHITA" in t or "SINGLE" in t), tipos[0])
for k, v in (("sun_elevation", ALT), ("sun_rotation", math.atan2(DIR.x, DIR.y) % (2 * math.pi)), ("sun_disc", False)):
    if hasattr(ceu, k): setattr(ceu, k, v)
fundo = wn.nodes.new("ShaderNodeBackground"); fundo.inputs["Strength"].default_value = float(arg("--ceu", "0.12"))
wn.links.new(ceu.outputs[0], fundo.inputs[0])
wn.links.new(fundo.outputs[0], next(n for n in wn.nodes if n.type == "OUTPUT_WORLD").inputs["Surface"])

# ---------------------------------------------------------------- render
cena.render.engine = "CYCLES"
pref = bpy.context.preferences.addons["cycles"].preferences
for tipo in ("OPTIX", "CUDA"):
    try:
        pref.compute_device_type = tipo; pref.get_devices()
        if any(d.type == tipo for d in pref.devices):
            for d in pref.devices: d.use = d.type == tipo
            cena.cycles.device = "GPU"; print("DISPOSITIVO", tipo); break
    except TypeError:
        continue
cena.cycles.samples = AMOSTRAS; cena.cycles.use_denoising = True
cena.cycles.sample_clamp_indirect = 8.0; cena.cycles.max_bounces = 10
cena.render.resolution_x, cena.render.resolution_y = RES
cena.view_settings.view_transform = "AgX"   # a lista do enum é dinâmica; o erro, se houver, lista as válidas
try:
    cena.view_settings.look = arg("--look", "AgX - Medium High Contrast")
except TypeError as e:
    print("LOOK indisponível:", e)
cena.view_settings.exposure = float(arg("--exposicao", "0.5"))

CAMERAS = {  # posição do olho, alvo
    "v1": ((-0.9, -1.05, 1.55), (-4.3, 0.2, 1.0)),   # sala -> jantar, cozinha e varanda
    "v2": ((-4.25, -1.25, 1.45), (-0.5, -1.35, 0.95)), # cozinha -> sala, TV e sofá
    "suite": ((2.45, 0.95, 1.55), (4.6, -0.7, 0.75)),
    "quarto": ((0.15, 0.15, 1.55), (-1.4, 2.0, 0.7)),
    "banho_suite": ((2.0, 0.15, 1.6), (1.2, 1.3, 1.0)),
    "banho": ((1.75, -1.55, 1.6), (0.9, -2.45, 1.1)),
    "varanda": ((-2.1, 1.45, 1.55), (-4.4, 2.3, 0.8)),
    "v3": ((-2.0, 0.95, 1.5), (-3.6, -2.6, 0.85)),     # porta da varanda -> jantar e parede do fundo com sol
}
for nome in VISTAS:
    olho, alvo = CAMERAS[nome]
    cd = bpy.data.cameras.new(nome); cd.lens = 20; cd.clip_start = 0.05
    co = bpy.data.objects.new(nome, cd); col.objects.link(co); co.location = olho
    co.rotation_euler = (Vector(alvo) - Vector(olho)).to_track_quat("-Z", "Y").to_euler()
    cena.camera = co; cena.render.filepath = os.path.join(SAIDA, nome + ".png")
    bpy.ops.render.render(write_still=True); print("SALVO", cena.render.filepath)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SAIDA, "piloto.blend"), compress=True)
print("BLEND", os.path.join(SAIDA, "piloto.blend"))
