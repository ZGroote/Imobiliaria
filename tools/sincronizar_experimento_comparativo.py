"""Compatibilidade: a comparação agora é gerada diretamente na pasta canônica.

Não lê nem modifica o lote histórico em publicacao/.
"""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().parents[1] / 'experimentos' / 'comparativo-planos-3d' / 'gerar_planos_comparativo.py'), run_name='__main__')
