# -*- coding: utf-8 -*-
"""Invocador do caminho antigo: a ferramenta mora em `pipeline/plantas/baixar_openplots.py`."""
import os
import runpy
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RAIZ)
runpy.run_path(os.path.join(RAIZ, "pipeline", "plantas", "baixar_openplots.py"), run_name="__main__")
