"""Derivado comparável de alta amostragem, sem sobrescrever a sonda ativa.

Reutiliza a política de raios e a geometria do exportador da sonda v2.
As substituições verificadas afetam só saída/resolução/amostragem/denoise.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parent
preferences = bpy.context.preferences.addons['cycles'].preferences
gpu_type = None
for backend in ('OPTIX', 'CUDA'):
    try:
        preferences.compute_device_type = backend
        preferences.get_devices()
        devices = [device for device in preferences.devices if device.type == backend]
        if devices:
            for device in preferences.devices:
                device.use = device.type == backend
            gpu_type = backend
            break
    except Exception:
        continue
device = 'GPU' if gpu_type else 'CPU'
samples = 128 if gpu_type else 64
print('CLEAN_PROBE_DEVICE', device, gpu_type, samples, flush=True)

code = (ROOT / 'exportar-ambiente-interior-web.py').read_text(encoding='utf-8')
replacements = {
    "scene.cycles.device = 'CPU'": "scene.cycles.device = '" + device + "'",
    'scene.cycles.samples = 16': 'scene.cycles.samples = ' + str(samples),
    'scene.cycles.use_denoising = False': "scene.cycles.use_denoising = True\nscene.cycles.denoiser = 'OPENIMAGEDENOISE'",
    'scene.render.resolution_x, scene.render.resolution_y = 512, 256': 'scene.render.resolution_x, scene.render.resolution_y = 1024, 512',
    "path = DEST / 'ambiente-interior.hdr'": "path = DEST / 'ambiente-interior-limpo.hdr'",
    "'samples': 16, 'device': 'CPU'": "'samples': " + str(samples) + ", 'device': '" + device + "'",
    'tuple(image.size) == (512, 256)': 'tuple(image.size) == (1024, 512)',
    "'device': 'CPU'": "'device': '" + device + "'",
    "'denoising': False": "'denoising': True,\n    'denoiser': 'OPENIMAGEDENOISE',\n    'purpose': 'Diagnostic derivative only; not activated in catalog',\n    'comparisonSource': 'ambiente-interior.hdr',\n    'computeBackend': '" + str(gpu_type or 'CPU') + "'",
    "(DEST / 'ambiente-interior.json').write_text": "(DEST / 'ambiente-interior-limpo.json').write_text",
}
for before, after in replacements.items():
    assert before in code, ('Exporter contract changed', before)
    code = code.replace(before, after)
exec(compile(code, str(ROOT / 'exportar-ambiente-interior-web.py'), 'exec'), globals())
