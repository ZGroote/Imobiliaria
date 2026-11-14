# -*- coding: utf-8 -*-
"""Re-render so da LUZ a partir do .blend salvo (sem refazer os panos): mudar o sol com a camera
travada (archviz-realista). blender -b <cena.blend> --python reluz.py -- <saida.png>
Variaveis: CEU, SOL, KELVIN, EXPO, LOOK, AMOSTRAS, ESCALA (% da resolucao)."""
import bpy, os, sys

S = bpy.context.scene
saida = sys.argv[sys.argv.index("--") + 1]
e = os.environ.get
bg = next(n for n in S.world.node_tree.nodes if n.type == "BACKGROUND")
if e("CEU"):
    bg.inputs["Strength"].default_value = float(e("CEU"))
sol = bpy.data.lights["sol"]
if e("SOL"):
    sol.energy = float(e("SOL"))
if e("KELVIN"):
    sol.temperature = float(e("KELVIN"))
if e("EXPO"):
    S.view_settings.exposure = float(e("EXPO"))
if e("WB"):                                   # balanco de branco: a luz de ceu (~7500 K) vira neutra
    S.view_settings.use_white_balance = True
    S.view_settings.white_balance_temperature = float(e("WB"))
if e("LOOK"):
    S.view_settings.look = e("LOOK")
if e("CAM") == "detalhe":                    # mesmo detalhe do sofa.py: 85 mm, f/3.5, retrato 4:5
    import math
    from mathutils import Vector
    cam, cd = S.camera, S.camera.data
    cd.lens, cd.shift_x, cd.shift_y = 85, 0, 0
    cam.location = Vector((float(e("CX", "-0.28")), float(e("CY", "-1.55")), float(e("CZ", "0.64"))))
    alvo = Vector((float(e("AX", "-0.80")), float(e("AY", "-0.47")), float(e("AZ", "0.45"))))
    cam.rotation_euler = (alvo - cam.location).to_track_quat("-Z", "Y").to_euler()
    cd.dof.use_dof, cd.dof.aperture_fstop = True, 3.5
    cd.dof.focus_distance = (alvo - cam.location).length
    S.render.resolution_x, S.render.resolution_y = 1200, 1500
S.cycles.samples = int(e("AMOSTRAS", "64"))
S.render.resolution_percentage = int(e("ESCALA", "100"))
S.render.filepath = saida
bpy.ops.render.render(write_still=True)
print("ok", saida, flush=True)
