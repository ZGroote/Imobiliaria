import bpy, math

OUT = "C:/Users/respawn/Desktop/imobiliaria/arvores"
COLS, DX, DY = 5, 18.0, 26.0

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.render.film_transparent = False
sc.display.render_aa = "16"
sh = sc.display.shading
sh.light = "STUDIO"
sh.color_type = "VERTEX"
sh.show_shadows = True
sh.shadow_intensity = 0.35
sh.show_cavity = True
sh.cavity_type = "WORLD"
sh.background_type = "VIEWPORT"
sh.background_color = (0.80, 0.83, 0.86)

cam = bpy.data.objects.get("CAM_ficha")
if cam is None:
    cam = bpy.data.objects.new("CAM_ficha", bpy.data.cameras.new("CAM_ficha"))
    sc.collection.objects.link(cam)
cam.data.type = "ORTHO"
sc.camera = cam

trees = [o for o in bpy.data.objects if o.name.startswith("TR_")]
trees.sort(key=lambda o: (round(o.location.y), round(o.location.x)))


def render(path, res):
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --- vista de cima: silhueta de copa (o que mais importa no mapa) ---
for o in trees:
    o.hide_render = False
cam.location = (2 * DX, 1.5 * DY, 200)
cam.rotation_euler = (0, 0, 0)
cam.data.ortho_scale = 108
render(OUT + "/fichas_topo.png", (1300, 1300))

# --- elevacao frontal, uma imagem por fileira ---
for r in range(4):
    for o in trees:
        o.hide_render = round(o.location.y / DY) != r
    cam.location = (2 * DX, r * DY - 160, 9.5)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    cam.data.ortho_scale = 100
    render(OUT + "/fichas_fila%d.png" % r, (1500, 500))

for o in trees:
    o.hide_render = False
print("renders ok")
for i, o in enumerate(trees):
    print(i // COLS, i % COLS, o.name)
result = "ok"
