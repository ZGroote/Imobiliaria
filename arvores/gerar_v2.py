"""Headless rebuild; does not touch the user's open Blender scene."""
import bpy, sys, runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import arvores as A
A.montar()
runpy.run_path(str(ROOT/'export_arvores.py'),run_name='__main__')
for ob in bpy.data.objects:
    if ob.name.startswith('TR_'): ob.name='GEO-'+ob.name[3:]
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'arvores-v2.blend'))
