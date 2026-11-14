"""GLB do prédio para o mapa 2D: a torre, o embasamento e o lazer, sem o chão, as ruas e as palmeiras da maquete.

No mapa o entorno é o satélite; o gramado de 150 m e as ruas do modelo tapavam o bairro. Lê modelo/vistas.blend
(gravado por modelar_vistas.py) e não mexe no modelo.json da luz gravada.
& 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe' -b experimentos/vistas-da-quinze-2026-11-07/modelo/vistas.blend --python-exit-code 1 --python experimentos/vistas-da-quinze-2026-11-07/mapa/exportar_glb_mapa.py
"""
from pathlib import Path

import bpy
from mathutils import Vector

SAIDA = Path(__file__).resolve().parents[1]/'modelo'/'vistas-mapa.glb'
ACIMA_M = 5.0   # árvore da praça e vaso de terraço ficam acima do chão; palmeira da rua e gramado, não

bpy.ops.object.select_all(action='DESELECT')
fica = 0
for ob in bpy.data.objects:
    if ob.type != 'MESH' or ob.name.startswith('GEO-implantacao'):
        continue
    if ob.name.startswith('GEO-SITE'):
        base = min((ob.matrix_world @ Vector(c)).z for c in ob.bound_box)
        if base < ACIMA_M:
            continue
    ob.select_set(True)
    fica += 1
# Peso (etapa 9): no mapa o prédio é uma peça só. Juntar as 417 malhas numa (uma primitiva por material) troca
# 417 desenhos por 28, e sem textura no GLB o UV é peso morto. O .blend não é salvo.
bpy.ops.object.duplicate()
bpy.ops.object.convert(target='MESH')  # aplica modificadores e solta instâncias de malha compartilhada
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=str(SAIDA), export_format='GLB', use_selection=True, export_apply=True,
                          export_cameras=False, export_lights=False, export_texcoords=False)
print('VISTAS_MAPA_GLB', fica, SAIDA.stat().st_size, flush=True)
