# Relatório do Motor, tarefa 22: conferir.py travava o teste do visual no Windows
1. **Conserto (`conferir.py`, 1 linha):** o servidor `http.server` agora sobe com `stderr=subprocess.DEVNULL`. A linha da porta ("Serving HTTP on … port N") sai no **stdout** (conferido no Python instalado: o `readline()` achou a porta), então nada mais mudou.
2. **Prova:** `python -I -X utf8 viabilidade/conferir.py` rodado 2 vezes no Windows: as 8 frentes APROVADO nas duas (visual em 36 s e 40 s, sem estourar os 30 s do `page.goto`); `git status` de `viabilidade/visual/evidencias` limpo no fim.
3. Sem commit: `viabilidade/conferir.py` e este relatório. Não toquei no visual, no terreno nem no motor.
