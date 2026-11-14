"""Converte o GLB publico do Warehouse em componentes para a API do SketchUp."""
import json
from pathlib import Path
import sys

import bpy

root = Path(__file__).resolve().parent
asset = sys.argv[sys.argv.index("--") + 1]
source = root / "dados" / "warehouse" / (asset + ".glb")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
textures = root / "dados" / "texturas"
textures.mkdir(exist_ok=True)
result = {"geometries": {}, "materials": {}, "objects": []}


def rgb(value):
    return round(255 * (12.92 * value if value <= .0031308 else 1.055 * value ** (1 / 2.4) - .055))


for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH" or obj.hide_render:
        continue
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active.data if mesh.uv_layers.active else None
    by_material = {}
    for tri in mesh.loop_triangles:
        record = by_material.setdefault(tri.material_index, {"position": [], "uv": [], "index": None})
        for loop_index in tri.loops:
            co = obj.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
            record["position"].extend([co.x, co.z, -co.y])
            record["uv"].extend(list(uv[loop_index].uv) if uv else [0, 0])
    for material_index, geometry in by_material.items():
        mat = mesh.materials[material_index] if mesh.materials else None
        name = mat.name if mat else "Sem material"
        key = "m" + str(list(bpy.data.materials).index(mat)) if mat else "default"
        if key not in result["materials"]:
            bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if mat and mat.use_nodes else None
            color = list(bsdf.inputs["Base Color"].default_value) if bsdf else [.7, .7, .7, 1]
            spec = {"name": asset + " | " + name, "color": [rgb(c) for c in color[:3]],
                    "opacity": color[3], "roughness": bsdf.inputs["Roughness"].default_value if bsdf else .7,
                    "metalness": bsdf.inputs["Metallic"].default_value if bsdf else 0, "vertexColors": False}
            if bsdf and bsdf.inputs["Base Color"].is_linked:
                node = bsdf.inputs["Base Color"].links[0].from_node
                if node.type == "TEX_IMAGE" and node.image:
                    path = textures / (asset + "-" + key + ".png")
                    if node.image.packed_file:
                        path.write_bytes(node.image.packed_file.data)
                    else:
                        node.image.save_render(str(path))
                    spec["texture"] = {"path": path.as_posix(), "repeat": [1, 1], "offset": [0, 0], "flipY": True}
            result["materials"][key] = spec
        geo_key = "g" + str(len(result["geometries"]))
        result["geometries"][geo_key] = geometry
        result["objects"].append({"name": asset + " | " + obj.name, "geometry": geo_key, "material": key,
                                  "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]})
assert result["objects"], "O asset nao tem malhas"
path = root / "dados" / ("warehouse-" + asset + ".json")
path.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print("WAREHOUSE_CONVERTIDO", asset, len(result["objects"]), "partes", path)
