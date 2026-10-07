"""Monta a versão APROVADA atual (padrão de 23/09) numa pasta temporária, para medir.

Não grava nada em `padrao-atual/` (o `publish()` original reescreve `release.json`):
aqui só se usa `render(offline=False)` e a lista de recursos, igual à publicação.

    python montar_base.py <destino>
"""
from pathlib import Path
import shutil, sys

AQUI = Path(__file__).resolve().parent
MINIATURAS = AQUI.parents[1]
sys.path.insert(0, str(MINIATURAS))
import padrao_atual  # noqa: E402


def montar(destino):
    destino = Path(destino)
    if destino.exists():
        shutil.rmtree(destino)
    manifesto = padrao_atual.source_manifest()
    prefixo = Path('assets/cedros') / manifesto['release']
    for nome, fonte in padrao_atual.ASSETS.items():
        alvo = destino / prefixo / nome
        alvo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(padrao_atual.SOURCE / fonte, alvo)
    pagina = destino / f'maquete-{padrao_atual.UID}.html'
    pagina.write_text(padrao_atual.render(offline=False), encoding='utf8')
    return pagina


if __name__ == '__main__':
    print(montar(sys.argv[1] if len(sys.argv) > 1 else AQUI / 'base-montada'))
