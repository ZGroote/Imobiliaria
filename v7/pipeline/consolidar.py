# -*- coding: utf-8 -*-
"""Invocador do caminho antigo: a etapa mora em `pipeline/consolidar.py`."""
import os
import runpy
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)
runpy.run_path(os.path.join(RAIZ, "pipeline", "consolidar.py"), run_name="__main__")
