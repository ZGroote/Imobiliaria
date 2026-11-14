"""Tira da cena o que muda com o ângulo (reflexo), só na memória: rode antes do script que renderiza.

O splat guarda uma cor por ponto que varia pouco com o rumo; vidro, espelho e superfície polida mostram outra
coisa a cada ângulo e viram mancha/fantasma. Variantes (--sem-reflexo):
  estatico  vidro sem reflexo (só transparência), espelho como painel fosco, mármore/louça/metal sem polimento
  jateado   igual, e os boxes dos banheiros em vidro jateado (translúcido)

blender -b cena.blend --python sem_reflexo.py --python capturar_splat.py -- --sem-reflexo estatico ...
"""
import bpy, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
VARIANTE = argv[argv.index("--sem-reflexo") + 1] if "--sem-reflexo" in argv else "estatico"
BOXES = ("mesh-27", "mesh-30")   # banho suíte, banho social (Meio)

def principled(m):
    return next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)

def so_shader(m, tipo, **entradas):
    """Troca a saída do material por um shader só, sem reflexo."""
    nt = m.node_tree; saida = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    s = nt.nodes.new(tipo)
    for k, v in entradas.items(): s.inputs[k].default_value = v
    nt.links.new(s.outputs[0], saida.inputs["Surface"]); return s

def fosco(m, rugosidade):
    b = principled(m)
    if not b: return
    if not b.inputs["Roughness"].is_linked: b.inputs["Roughness"].default_value = max(b.inputs["Roughness"].default_value, rugosidade)
    b.inputs["Coat Weight"].default_value = 0

mats = bpy.data.materials
vidro = mats["Vidro"]
so_shader(vidro, "ShaderNodeBsdfTransparent")
if VARIANTE == "jateado":
    jateado = vidro.copy(); jateado.name = "Vidro jateado"
    nt = jateado.node_tree; saida = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    t = nt.nodes.new("ShaderNodeBsdfTransparent"); l = nt.nodes.new("ShaderNodeBsdfTranslucent"); mx = nt.nodes.new("ShaderNodeMixShader")
    l.inputs["Color"].default_value = (0.92, 0.92, 0.9, 1); mx.inputs["Fac"].default_value = 0.65
    nt.links.new(t.outputs[0], mx.inputs[1]); nt.links.new(l.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], saida.inputs["Surface"])
    for n in BOXES:
        for s in bpy.data.objects[n].material_slots:
            if s.material == vidro: s.material = jateado
b = principled(mats["Espelho"])
b.inputs["Metallic"].default_value = 0; b.inputs["Roughness"].default_value = 0.6; b.inputs["Base Color"].default_value = (0.55, 0.57, 0.58, 1)
for nome, rug in (("Marmore", 0.55), ("Louca", 0.45), ("Ceramica", 0.5), ("Esmalte", 0.5), ("Inox", 0.6), ("Metal preto", 0.6),
                  ("Latao", 0.6), ("Acabamento fogao", 0.6), ("m4", 0.6)):
    if nome in mats: fosco(mats[nome], rug)
print("SEM REFLEXO", VARIANTE, flush=True)
