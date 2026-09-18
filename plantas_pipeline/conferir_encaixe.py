# -*- coding: utf-8 -*-
"""Invocador do caminho antigo: a ferramenta mora em `pipeline/plantas/conferir_encaixe.py`."""
import os
import runpy
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
runpy.run_path(os.path.join(RAIZ, "pipeline", "plantas", "conferir_encaixe.py"), run_name="__main__")
