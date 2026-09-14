"""Build an editable exterior study from a data-only recipe in Blender.

blender -b --factory-startup --python montar_blender.py -- \
    --receita receita.json --destino resultado [--render]

Recipe coordinates are metres, Y up, front +Z. No recipe text is executed.
"""

import argparse
import json
import math
from pathlib import Path
import re
import sys

import bpy
from mathutils import Vector


KINDS = {"caixa", "telhado_duas_aguas", "portao_vertical", "portao_horizontal", "janela", "porta", "cilindro", "escada", "malha"}
MAX_PARTS = 1000
MAX_VERTICES = 250_000
MAX_TRIANGLES = 500_000
MAX_RECIPE_BYTES = 24 * 1024 * 1024


def number(value, label, limit=10_000):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or abs(value) > limit:
        raise ValueError(f"{label}: numero finito entre {-limit} e {limit} obrigatorio")
    return float(value)


def triple(value, label, positive=False):
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError(f"{label}: vetor de tres numeros obrigatorio")
    out = [number(v, label) for v in value]
    if positive and min(out) < .001:
        raise ValueError(f"{label}: dimensoes devem ser pelo menos 0.001 metro")
    return out


def strings(value, label, maximum=100):
    if not isinstance(value, list) or len(value) > maximum or any(not isinstance(v, str) or len(v) > 4000 for v in value):
        raise ValueError(f"{label}: lista de textos invalida")
    return value


def validate(data):
    if not isinstance(data, dict) or type(data.get("versao")) is not int or data["versao"] != 1:
        raise ValueError("Receita deve usar versao 1")
    if not isinstance(data.get("titulo"), str) or not 1 <= len(data["titulo"]) <= 500:
        raise ValueError("Titulo ausente ou muito longo")
    strings(data.get("observacoes", []), "observacoes")
    parts = data.get("partes")
    if not isinstance(parts, list) or not 1 <= len(parts) <= MAX_PARTS:
        raise ValueError(f"Receita deve conter de 1 a {MAX_PARTS} partes")
    total_v = total_t = 0
    for index, part in enumerate(parts):
        label = f"partes[{index}]"
        if not isinstance(part, dict) or part.get("tipo") not in KINDS:
            raise ValueError(f"{label}: tipo desconhecido")
        if not isinstance(part.get("nome"), str) or not 1 <= len(part["nome"]) <= 200:
            raise ValueError(f"{label}: nome invalido")
        triple(part.get("centro"), label + ".centro")
        triple(part.get("tamanho"), label + ".tamanho", positive=True)
        number(part.get("rotacao_graus", 0), label + ".rotacao_graus", 3600)
        if not isinstance(part.get("cor"), str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", part["cor"]):
            raise ValueError(f"{label}: cor deve ser #rrggbb")
        strings(part.get("referencias", []), label + ".referencias")
        if type(part.get("estimado", True)) is not bool:
            raise ValueError(f"{label}: estimado deve ser booleano")
        if part["tipo"] == "malha":
            vertices, triangles = part.get("vertices"), part.get("triangulos")
            if not isinstance(vertices, list) or not 3 <= len(vertices) <= MAX_VERTICES:
                raise ValueError(f"{label}: vertices ausentes ou excessivos")
            if not isinstance(triangles, list) or not 1 <= len(triangles) <= MAX_TRIANGLES:
                raise ValueError(f"{label}: triangulos ausentes ou excessivos")
            total_v += len(vertices)
            total_t += len(triangles)
            for vertex in vertices:
                triple(vertex, label + ".vertices")
            for tri in triangles:
                if not isinstance(tri, list) or len(tri) != 3 or any(type(i) is not int or not 0 <= i < len(vertices) for i in tri):
                    raise ValueError(f"{label}: indice de triangulo invalido")
                if len(set(tri)) != 3:
                    raise ValueError(f"{label}: triangulo degenerado")
    if total_v > MAX_VERTICES or total_t > MAX_TRIANGLES:
        raise ValueError("Receita excede o limite total de geometria")
    return data


def to_blender(point):
    return (point[0], -point[2], point[1])


def safe_name(text):
    return re.sub(r"[^\w .-]+", "_", text, flags=re.UNICODE)[:100]


def srgb_to_linear(value):
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


class Builder:
    def __init__(self, scene):
        self.scene = scene
        self.collection = bpy.data.collections.new("MODELO-exterior")
        scene.collection.children.link(self.collection)
        self.materials = {}
        self.objects = []
        self.parent = None
        self.vertex_count = 0

    def material(self, color):
        if color not in self.materials:
            rgba = tuple(srgb_to_linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1,)
            mat = bpy.data.materials.new("MAT-" + color[1:])
            mat.diffuse_color = rgba
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            bsdf.inputs["Base Color"].default_value = rgba
            bsdf.inputs["Roughness"].default_value = .72
            self.materials[color] = mat
        return self.materials[color]

    def mesh(self, name, vertices, faces, color):
        self.vertex_count += len(vertices)
        if self.vertex_count > 500_000:
            raise ValueError("Modelo gerado excede 500 mil vertices; divida-o em etapas")
        mesh = bpy.data.meshes.new("MESH-" + safe_name(name))
        mesh.from_pydata([to_blender(v) for v in vertices], [], faces)
        mesh.validate(verbose=False)
        mesh.update()
        obj = bpy.data.objects.new("GEO-" + safe_name(name), mesh)
        self.collection.objects.link(obj)
        obj.parent = self.parent
        if self.parent:
            for key in ("tipo_receita", "referencias", "estimado", "status"):
                obj[key] = self.parent[key]
            obj["parte"] = self.parent.name
        mesh.materials.append(self.material(color))
        self.objects.append(obj)
        return obj

    def box(self, name, center, size, color):
        x, y, z = center
        w, h, d = (v / 2 for v in size)
        vertices = [(x - w, y - h, z - d), (x + w, y - h, z - d), (x + w, y + h, z - d), (x - w, y + h, z - d),
                    (x - w, y - h, z + d), (x + w, y - h, z + d), (x + w, y + h, z + d), (x - w, y + h, z + d)]
        faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (0, 4, 7, 3), (1, 2, 6, 5)]
        return self.mesh(name, vertices, faces, color)

    def frame(self, name, w, h, d, thickness, color):
        self.box(name + "-montante-esquerdo", (-w / 2 + thickness / 2, 0, 0), (thickness, h, d), color)
        self.box(name + "-montante-direito", (w / 2 - thickness / 2, 0, 0), (thickness, h, d), color)
        self.box(name + "-travessa-inferior", (0, -h / 2 + thickness / 2, 0), (w - thickness * 2, thickness, d), color)
        self.box(name + "-travessa-superior", (0, h / 2 - thickness / 2, 0), (w - thickness * 2, thickness, d), color)

    def cylinder(self, name, center, size, color):
        w, h, d = size
        x, y, z = center
        count = 48
        vertices = [(x + w / 2 * math.cos(i * math.tau / count), y + side * h / 2,
                     z + d / 2 * math.sin(i * math.tau / count)) for side in (-1, 1) for i in range(count)]
        faces = [tuple(range(count)), tuple(range(count * 2 - 1, count - 1, -1))]
        faces += [(i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count)]
        obj = self.mesh(name, vertices, faces, color)
        for polygon in list(obj.data.polygons)[2:]:
            polygon.use_smooth = True
        return obj

    def tiled_roof(self, name, w, h, d, color):
        # The ridge, curved tile channels and overlapping courses are real geometry.
        # Their density is bounded for large roofs; no external textures are used.
        relief = min(.024, h / 12)
        low, high = -h / 2, h / 2 - relief * 2
        vertices = [(-w / 2, low, d / 2), (w / 2, low, d / 2), (0, high, d / 2),
                    (-w / 2, low, -d / 2), (w / 2, low, -d / 2), (0, high, -d / 2)]
        self.mesh(name + "-base", vertices, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (0, 2, 5, 3), (2, 1, 4, 5)], color)
        vertices, faces = [], []
        columns = max(1, min(100, math.ceil(d / .26)))
        rows = max(1, min(50, math.ceil(math.hypot(w / 2, high - low) / .42)))
        segments = 4
        for side in (-1, 1):
            for row in range(rows):
                t0, t1 = row / rows, (row + 1) / rows
                for col in range(columns):
                    start = len(vertices)
                    for t, overlap in ((t0, relief * .65), (t1, 0)):
                        for k in range(segments + 1):
                            q = k / segments
                            x = side * w / 2 * t
                            y = high + (low - high) * t + relief * math.sin(q * math.pi) + overlap
                            z = -d / 2 + (col + q) * d / columns
                            vertices.append((x, y, z))
                    for k in range(segments):
                        face = (start + k, start + k + 1, start + segments + k + 2, start + segments + k + 1)
                        faces.append(face if side > 0 else tuple(reversed(face)))
                    # Close each course's exposed lip so the overlap remains visible.
                    for k in range(segments + 1):
                        top = vertices[start + k]
                        vertices.append((top[0], top[1] - relief * .65, top[2]))
                    lower = start + 2 * (segments + 1)
                    for k in range(segments):
                        face = (start + k, lower + k, lower + k + 1, start + k + 1)
                        faces.append(face if side < 0 else tuple(reversed(face)))
        self.mesh(name + "-telhas", vertices, faces, color)
        # A closed low ridge cap, kept inside the declared roof envelope.
        width = min(.20, w * .15)
        cap = [(-width / 2, high, d / 2), (width / 2, high, d / 2), (0, h / 2, d / 2),
               (-width / 2, high, -d / 2), (width / 2, high, -d / 2), (0, h / 2, -d / 2)]
        self.mesh(name + "-cumeeira", cap, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (0, 2, 5, 3), (2, 1, 4, 5)], color)

    def stairs(self, name, w, h, d, color):
        count = max(1, min(64, round(h / .18)))
        profile = [(-h / 2, d / 2)]
        for step in range(count):
            level = -h / 2 + h * (step + 1) / count
            profile += [(level, d / 2 - d * step / count), (level, d / 2 - d * (step + 1) / count)]
        profile.append((-h / 2, -d / 2))
        n = len(profile)
        vertices = [(side * w / 2, y, z) for side in (-1, 1) for y, z in profile]
        faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
        faces += [(i, i + n, (i + 1) % n + n, (i + 1) % n) for i in range(n)]
        self.mesh(name, vertices, faces, color)

    def part(self, part, index):
        name, kind, color = part["nome"], part["tipo"], part["cor"]
        w, h, d = part["tamanho"]
        parent = bpy.data.objects.new(f"PARTE-{index:04d}-" + safe_name(name), None)
        self.collection.objects.link(parent)
        parent.location = to_blender(part["centro"])
        parent.rotation_euler[2] = math.radians(part.get("rotacao_graus", 0))
        parent["tipo_receita"] = kind
        parent["referencias"] = json.dumps(part.get("referencias", []), ensure_ascii=False)
        parent["estimado"] = part.get("estimado", True)
        parent["status"] = "aguarda_revisao_visual"
        self.parent = parent
        if kind == "caixa":
            self.box(name, (0, 0, 0), (w, h, d), color)
        elif kind == "telhado_duas_aguas":
            self.tiled_roof(name, w, h, d, color)
        elif kind in {"portao_vertical", "portao_horizontal"}:
            thickness = min(.055, min(w, h) / 8)
            self.frame(name, w, h, d, thickness, color)
            vertical = kind == "portao_vertical"
            span = (w if vertical else h) - thickness * 2
            count = max(1, min(96, int(span / (.14 if vertical else .12))))
            step = span / count
            slat = min(step * .55, .045 if vertical else .07)
            for i in range(count):
                offset = -span / 2 + step * (i + .5)
                center = (offset, 0, 0) if vertical else (0, offset, 0)
                size = (slat, h - thickness * 2, d * .65) if vertical else (w - thickness * 2, slat, d * .65)
                self.box(f"{name}-lamina-{i:02d}", center, size, color)
        elif kind == "janela":
            thickness = min(.065, min(w, h) / 8)
            self.frame(name, w, h, d, thickness, color)
            self.box(name + "-vidro-recuado", (0, 0, -d * .28), (w - thickness * 2, h - thickness * 2, d * .12), "#32434b")
            self.box(name + "-montante-central", (0, 0, 0), (thickness * .65, h - thickness * 2, d), color)
        elif kind == "porta":
            thickness = min(.075, min(w, h) / 8)
            self.frame(name, w, h, d, thickness, color)
            self.box(name + "-folha", (0, 0, -d * .15), (w - thickness * 2, h - thickness * 2, d * .5), color)
            for side in (-1, 1):
                self.box(name + f"-friso-{side}", (side * w * .30, 0, d * .125), (min(.025, w * .035), h * .8, d * .055), color)
            self.box(name + "-espelho-fechadura", (w * .30, -h * .035, d * .18), (w * .08, h * .10, d * .10), "#807a6f")
            self.box(name + "-macaneta", (w * .24, -h * .01, d * .32), (w * .20, min(.025, h * .02), d * .14), "#b1aba1")
        elif kind == "cilindro":
            self.cylinder(name, (0, 0, 0), (w, h, d), color)
        elif kind == "escada":
            self.stairs(name, w, h, d, color)
        elif kind == "malha":
            self.mesh(name, part["vertices"], part["triangulos"], color)
        self.parent = None


def add_references(scene, destination):
    destination = destination.resolve()
    folder = destination / "fotos"
    manifest_path = destination / "anuncio.json"
    if manifest_path.is_file():
        if manifest_path.stat().st_size > 1024 * 1024:
            raise ValueError("Manifesto de referencias excede 1 MiB")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        if not isinstance(manifest, dict) or not isinstance(manifest.get("fotos"), list):
            raise ValueError("Manifesto deve conter a lista fotos")
        paths, seen = [], set()
        for record in manifest["fotos"]:
            if not isinstance(record, dict) or not isinstance(record.get("arquivo"), str):
                raise ValueError("Referencia no manifesto sem arquivo valido")
            path = (destination / record["arquivo"]).resolve()
            if not path.is_relative_to(destination):
                raise ValueError("Referencia no manifesto aponta para fora do destino")
            if path not in seen:
                paths.append(path)
                seen.add(path)
    else:
        if folder.exists() and not folder.resolve().is_relative_to(destination):
            raise ValueError("Pasta de referencias aponta para fora do destino")
        paths = sorted(folder.iterdir()) if folder.is_dir() else []
    if not paths:
        return 0
    collection = bpy.data.collections.new("REFERENCIAS-fotos")
    scene.collection.children.link(collection)
    collection.hide_render = True
    collection.hide_viewport = True
    count, total = 0, 0
    for path in paths:
        if not path.resolve().is_relative_to(destination):
            raise ValueError("Referencia aponta para fora do destino")
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"} or not path.is_file():
            continue
        size = path.stat().st_size
        if size > 25 * 1024 * 1024 or total + size > 100 * 1024 * 1024 or count >= 30:
            continue
        try:
            image = bpy.data.images.load(str(path.resolve()), check_existing=True)
            image.pack()
            obj = bpy.data.objects.new("REF-" + path.stem, None)
            obj.empty_display_type = "IMAGE"
            obj.data = image
            obj.empty_display_size = 4
            obj.location = (count * 5, 15, 3)
            obj.rotation_euler = (math.pi / 2, 0, 0)
            obj.hide_render = True
            collection.objects.link(obj)
            count += 1
            total += size
        except (RuntimeError, OSError) as exc:
            print(f"Referencia ignorada: {path.name}: {exc}")
    return count


def studio(scene, objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center, extent = (lo + hi) / 2, max(hi - lo)
    collection = bpy.data.collections.new("STUDIO-nao-exportar")
    scene.collection.children.link(collection)
    ground_mesh = bpy.data.meshes.new("Studio-solo")
    radius = max(extent * 10, 5)
    ground_mesh.from_pydata([(center.x - radius, center.y - radius, lo.z - .025), (center.x + radius, center.y - radius, lo.z - .025),
                           (center.x + radius, center.y + radius, lo.z - .025), (center.x - radius, center.y + radius, lo.z - .025)], [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new("STUDIO-solo", ground_mesh)
    collection.objects.link(ground)
    mat = bpy.data.materials.new("Studio-cinza-claro")
    mat.diffuse_color = (.48, .51, .54, 1)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = mat.diffuse_color
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .9
    ground_mesh.materials.append(mat)
    world = bpy.data.worlds.new("Studio-mundo")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (.66, .72, .8, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .65
    scene.world = world
    for name, offset, energy in [("principal", (1, -1.3, 1.8), 1600), ("preenchimento", (-1.2, -.5, .9), 750)]:
        light = bpy.data.lights.new("LGT-" + name, "AREA")
        light.energy = energy * max(1, extent / 10) ** 2
        light.shape = "DISK"
        light.size = max(extent, 3)
        obj = bpy.data.objects.new("LGT-" + name, light)
        collection.objects.link(obj)
        obj.location = center + Vector(offset) * extent
        obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    cam_data = bpy.data.cameras.new("CAM-estudo")
    camera = bpy.data.objects.new("CAM-estudo", cam_data)
    collection.objects.link(camera)
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    return camera, center, extent, points


def frame_camera(camera, center, extent, points, front=False):
    direction = Vector((0, -1, 0) if front else (1.15, -1.55, 1.0)).normalized()
    rotation = (-direction).to_track_quat("-Z", "Y")
    camera.rotation_euler = rotation.to_euler()
    local = [rotation.inverted() @ (p - center) for p in points]
    camera.data.clip_start = max(.001, extent / 10000)
    camera.data.clip_end = max(100, extent * 100)
    if front:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = max(max(abs(p.x), abs(p.y)) for p in local) * 2.3
        distance = extent * 3
    else:
        camera.data.type = "PERSP"
        camera.data.lens = 48
        camera.data.sensor_fit = "HORIZONTAL"
        tan_half = camera.data.sensor_width / (2 * camera.data.lens)
        distance = max(p.z + max(abs(p.x), abs(p.y)) / tan_half * 1.2 for p in local)
        distance = max(distance, extent)
    camera.location = center + direction * distance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receita", type=Path, required=True)
    parser.add_argument("--destino", type=Path, required=True)
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if args.receita.stat().st_size > MAX_RECIPE_BYTES:
        raise ValueError("Arquivo de receita excede 24 MiB")
    data = validate(json.loads(args.receita.read_text(encoding="utf-8-sig")))
    destination = args.destino.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    scene = bpy.data.scenes.new("Exterior-" + safe_name(data["titulo"]))
    bpy.context.window.scene = scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene["status"] = "estudo_gerado_aguarda_revisao"
    scene["observacoes"] = json.dumps(data.get("observacoes", []), ensure_ascii=False)
    builder = Builder(scene)
    for index, part in enumerate(data["partes"]):
        builder.part(part, index)
    bpy.context.view_layer.update()
    refs = add_references(scene, destination)
    camera, center, extent, points = studio(scene, builder.objects)
    frame_camera(camera, center, extent, points)
    for obj in scene.objects:
        obj.select_set(False)
    for obj in builder.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = builder.objects[0]
    bpy.ops.export_scene.gltf(filepath=str(destination / "exterior.glb"), export_format="GLB", use_selection=True, use_active_scene=True,
                              export_apply=True, export_yup=True, export_animations=False, export_skins=False,
                              export_morph=False, export_cameras=False, export_lights=False, export_extras=True,
                              export_draco_mesh_compression_enable=False)
    renders = []
    if args.render:
        for name, front in [("frente.png", True), ("perspectiva.png", False)]:
            frame_camera(camera, center, extent, points, front)
            scene.render.filepath = str(destination / name)
            bpy.ops.render.render(write_still=True)
            renders.append(name)
    recipe_text = bpy.data.texts.new("receita.json")
    recipe_text.write(json.dumps(data, ensure_ascii=False, indent=2))
    instructions = bpy.data.texts.new("LEIA-ME-modelo.txt")
    instructions.write("Estudo exterior gerado a partir de uma receita de dados. Exige revisao visual contra as fotos.\n"
                       "Unidades: metros. Blender Z para cima; glTF Y para cima, frente +Z.\n"
                       "Cada PARTE tem referencias e estimado como propriedades. As pecas GEO sao editaveis.\n"
                       "STUDIO e REFERENCIAS nao fazem parte do GLB. As fotos disponiveis estao empacotadas.\n")
    # Keep reruns from writing accumulating .blend1 backups in generated output.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination / "projeto.blend"))
    report = {"status": "estudo_gerado_aguarda_revisao", "titulo": data["titulo"], "partes": len(data["partes"]),
              "objetos_malha": len(builder.objects), "vertices": sum(len(o.data.vertices) for o in builder.objects),
              "triangulos": sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in builder.objects),
              "referencias_empacotadas": refs, "renderizados": renders, "observacoes": data.get("observacoes", []),
              "arquivos": ["projeto.blend", "exterior.glb"] + renders}
    (destination / "resultado-blender.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("RESULTADO_BLENDER=" + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ERRO_BLENDER=" + str(exc), file=sys.stderr)
        raise
