"""Monta o RELATORIO.md: texto (relatorio-modelo.md + tecnicas.md) com as tabelas geradas
dos resultados medidos (tabelas.py). Rodar depois de medir.mjs, comparar.mjs e custos.mjs:

    python medicoes/relatorio.py
"""
from pathlib import Path
import subprocess, sys

AQUI = Path(__file__).resolve().parent
tabelas = subprocess.run([sys.executable, str(AQUI / 'tabelas.py')], capture_output=True, text=True, check=True).stdout
i = tabelas.index('### Firebase Hosting')
resultados, custos = tabelas[:i].rstrip(), tabelas[i:].rstrip()
modelo = (AQUI / 'relatorio-modelo.md').read_text(encoding='utf8')
resumo = (AQUI / 'resumo.md').read_text(encoding='utf8').rstrip()
texto = (modelo.replace('@@RESUMO@@', resumo).replace('@@TABELAS@@', resultados + '\n\nA imagem lado a lado (versão atual, v4 e a diferença ampliada 6 vezes, nas poses acima) sai de '
         '`node medicoes/comparar.mjs --q alto` seguido de `python medicoes/montagem.py`, em '
         '`medicoes/resultados/comparacao-alto.webp`. Imagens não são versionadas fora das pastas '
         'classificadas em `tests/test_dados_privados.py`.')
         .replace('@@CUSTOS@@', custos.replace('### Firebase Hosting: ', '### ').strip())
         .replace('@@TECNICAS@@', (AQUI / 'tecnicas.md').read_text(encoding='utf8').replace('## As técnicas da lista, uma a uma\n\n', '').rstrip()))
assert '@@' not in texto
(AQUI.parent / 'RELATORIO.md').write_text(texto, encoding='utf8')
print('RELATORIO.md:', len(texto), 'caracteres')
