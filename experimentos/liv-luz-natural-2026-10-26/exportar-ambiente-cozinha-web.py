"""Sonda especular local da cozinha (26/10): o inox refletia a sonda da sala, alaranjada pelo piso de
madeira e pelas manchas de sol, e ficava bronzeado. Capturada na frente da bancada, entre geladeira,
cuba e fogão, com a cena aprovada inteira; só a posição muda em relação à sonda limpa da sala."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
code = (ROOT / 'exportar-ambiente-interior-limpo-web.py').read_text(encoding='utf-8')
hook = "code = (ROOT / 'exportar-ambiente-interior-web.py').read_text(encoding='utf-8')"
assert hook in code
code = code.replace(hook, hook + '''
code = code.replace("source_position = source_camera.matrix_world.translation.copy()", "from mathutils import Vector\\nsource_position = Vector((2.95, -.25, 1.05))")
code = code.replace("'sourceCamera': source_camera.name,", "'sourceCamera': source_camera.name,\\n    'capturePositionPolicy': 'Kitchen counter front, between fridge, sink and stove (Blender 2.95, -0.25, 1.05)',")
''')
code = code.replace('ambiente-interior-limpo.hdr', 'ambiente-cozinha.hdr')
code = code.replace('ambiente-interior-limpo.json', 'ambiente-cozinha.json')
exec(compile(code, str(ROOT / 'exportar-ambiente-interior-limpo-web.py'), 'exec'), globals())
