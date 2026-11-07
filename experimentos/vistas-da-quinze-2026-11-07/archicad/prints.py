"""Imagens de conferência do modelo do Archicad (janela 3D), pelas câmeras do site.

python -I experimentos/vistas-da-quinze-2026-11-07/archicad/prints.py
Grava archicad/conferencia/<vista>.jpg.
"""
import base64
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelar_archicad import tapir  # noqa: E402

SAIDA = Path(__file__).resolve().parent/'conferencia'
# Archicad: X leste, Y norte. A torre ocupa X 7..62, Y -47..-7; o pátio fica a noroeste do L.
VISTAS = {
    'noroeste': ((-75, 70, 90), (36, -27, 30), 55),
    'patio': ((8, 0, 45), (50, -34, 30), 80),
    'sudeste': ((150, -150, 70), (36, -28, 30), 50),
}


def main():
    SAIDA.mkdir(exist_ok=True)
    tapir('ChangeWindow', {'windowType': '3DModel'})
    for nome, (cam, alvo, cone) in VISTAS.items():
        dx, dy = cam[0]-alvo[0], cam[1]-alvo[1]
        tapir('Set3DProjectionSettings', {'perspective': {
            'cameraPosition': dict(zip('xyz', cam)), 'targetPosition': dict(zip('xyz', alvo)),
            'distance': math.dist(cam, alvo), 'azimuth': math.degrees(math.atan2(dy, dx)) % 360,
            'viewCone': cone, 'rollAngle': 0, 'isTwoPointPersp': True}})
        r = tapir('GetCurrentViewImage', {'format': 'jpg'})
        (SAIDA/f'{nome}.jpg').write_bytes(base64.b64decode(r['image']))
        print(nome, r['width'], r['height'])


if __name__ == '__main__':
    main()
