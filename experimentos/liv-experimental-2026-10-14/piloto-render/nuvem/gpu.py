import bpy
p = bpy.context.preferences.addons["cycles"].preferences
for t in ("CUDA", "OPTIX"):   # OptiX derruba o Blender 5.2 em Tesla V100 (sem RT core); CUDA primeiro
    try:
        p.compute_device_type = t; p.get_devices()
        if any(d.type == t for d in p.devices):
            for d in p.devices: d.use = d.type == t
            bpy.context.scene.cycles.device = "GPU"; print("GPU", t, [d.name for d in p.devices if d.use]); break
    except TypeError: pass
