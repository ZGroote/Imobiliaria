"""ROIs de superfícies equivalentes; câmeras distintas impedem RMSE global."""
import colorsys
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
REGIONS = {
    'web-usuario.png': {
        'parede': [(279, 24), (314, 24), (314, 91), (279, 91)],
        'tampo': [(122, 231), (272, 211), (322, 235), (184, 267)],
    },
    'blender-referencia.png': {
        'parede': [(842, 58), (1050, 58), (1050, 163), (842, 163)],
        'tampo': [(327, 586), (525, 562), (620, 587), (417, 629)],
    },
}
for stage in ('agx-probe-antigo.png', 'agx-probe-limpo-sala.png', 'agx-reflexo-jantar.png', 'look-blender-final.png'):
    if (ROOT / stage).exists():
        REGIONS[stage] = {'tampo': [(82, 450), (186, 408), (260, 430), (148, 486)]}

report = {'schema': 'liv-surface-look-v1', 'comparison': 'Equivalent material regions in different cameras; diagnostic, not pixel alignment.', 'images': {}}
for name, regions in REGIONS.items():
    image = Image.open(ROOT / name).convert('RGB')
    rgb = np.asarray(image).astype(float) / 255
    entries = {}
    for label, polygon in regions.items():
        mask = Image.new('1', image.size)
        ImageDraw.Draw(mask).polygon(polygon, fill=1)
        pixels = rgb[np.asarray(mask, dtype=bool)]
        hsv = np.array([colorsys.rgb_to_hsv(*pixel) for pixel in pixels])
        luminance = pixels @ np.array([.2126, .7152, .0722])
        entries[label] = {'polygon': polygon, 'pixels': len(pixels), 'meanRGB': pixels.mean(0).tolist(),
                          'meanSaturation': float(hsv[:, 1].mean()), 'luminanceMean': float(luminance.mean()),
                          'luminanceStd': float(luminance.std()), 'luminanceP95': float(np.percentile(luminance, 95)),
                          'nearWhiteFraction': float((pixels.min(1) > .95).mean())}
    report['images'][name] = {'size': image.size, 'regions': entries}
(ROOT / (sys.argv[1] if len(sys.argv)>1 else 'look-fit-surfaces.json')).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
