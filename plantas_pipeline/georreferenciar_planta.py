# -*- coding: utf-8 -*-
"""Invocador do caminho antigo: a ferramenta mora em `pipeline/plantas/georreferenciar_planta.py`."""
import os
import runpy
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
runpy.run_path(os.path.join(RAIZ, "pipeline", "plantas", "georreferenciar_planta.py"), run_name="__main__")
