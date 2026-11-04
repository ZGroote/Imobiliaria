"""Renderiza uma 'foto' frontal de um manequim com medidas conhecidas.

Serve para testar a estimativa de medidas do site sem usar foto de pessoa.
uso: python3 foto_sintetica.py <saida.jpg> <tamanho>
"""
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import cena  # noqa: E402
import modelo  # noqa: E402

saida, nome = Path(sys.argv[1]).resolve(), sys.argv[2]
p = modelo.TAMANHOS[nome]
modelo.ANG_BRACO = math.radians(35)  # pose pedida pelo site: braços afastados
cena.limpar()
# pele e roupa justa em tons diferentes ajudam a segmentação
cena.objeto("Corpo", modelo.corpo(p), [cena.material_liso("Pele", (0.62, 0.45, 0.36), 0.5)])
cam = cena.estudio(alvo_z=p["altura"] / 2, dist=3.9, lente=45, res=(800, 1200), amostras=24, azimute=0)
bpy.context.scene.render.image_settings.file_format = "JPEG"
cena.render(saida)
