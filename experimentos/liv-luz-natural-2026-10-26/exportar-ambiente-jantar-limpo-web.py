"""Sonda especular local do jantar, sem a mesa apenas na cópia de captura."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
code = (ROOT / 'exportar-ambiente-interior-limpo-web.py').read_text(encoding='utf-8')
# Adapt the common v2 source in memory before the quality wrapper executes it.
hook = "code = (ROOT / 'exportar-ambiente-interior-web.py').read_text(encoding='utf-8')"
assert hook in code
code = code.replace(hook, hook + '''
code = code.replace("source_position = source_camera.matrix_world.translation.copy()", "from mathutils import Vector\\nsource_position = Vector((2.05, .325, .89))")
code = code.replace("scene = approved.copy()", """scene = approved.copy()
# The scene master collection is unique; referenced child collections are not.
# Flatten links only in this new master and exclude the table from those links.
original_objects = list(approved.objects)
for child in list(scene.collection.children):
    scene.collection.children.unlink(child)
for obj in list(scene.collection.objects):
    scene.collection.objects.unlink(obj)
for obj in original_objects:
    if not obj.name.startswith('R3 | Mesa jantar |'):
        scene.collection.objects.link(obj)
assert not any(obj.name.startswith('R3 | Mesa jantar |') for obj in scene.objects)
assert any(obj.name.startswith('R3 | Mesa jantar |') for obj in approved.objects)
""")
code = code.replace("'sourceCamera': source_camera.name,", "'sourceCamera': source_camera.name,\\n    'capturePositionPolicy': 'Dining table top center + 0.10 m; table excluded from capture copy only',\\n    'excludedCaptureObjects': [obj.name for obj in approved.objects if obj.name.startswith('R3 | Mesa jantar |')],")
''')
code = code.replace('ambiente-interior-limpo.hdr', 'ambiente-jantar-limpo.hdr')
code = code.replace('ambiente-interior-limpo.json', 'ambiente-jantar-limpo.json')
exec(compile(code, str(ROOT / 'exportar-ambiente-interior-limpo-web.py'), 'exec'), globals())
