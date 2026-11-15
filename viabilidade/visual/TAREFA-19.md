# Tarefa 19 do Visual: deixar claro o que o VGV é e o que não é

**Quem:** Visual.
**Galho:** `viabilidade/lote-livre` (não troque de galho).
**Onde mexer:** só em `viabilidade/visual/` e `viabilidade/relatorio/`.
**Não fazer:** não commitar.

## Pedido da revisão

O VGV estimado não é lucro, nem receita garantida, nem valor de mercado validado. O rótulo tem que continuar dizendo que o preço foi informado pelo usuário.

## O que fazer

1. **Na tela,** junto da simulação (tarefa 18) e da linha "VGV estimado (preço do estudo)", mostrar uma frase curta e fixa:

   "VGV = área privativa × preço por m² informado pelo usuário. Não é lucro, receita garantida nem valor de mercado validado."

   - Visível sem hover, inclusive no celular, perto do número.
   - Os rótulos ficam assim:
     - "VGV estimado (preço informado pelo usuário na tela)";
     - "VGV estimado (preço informado no estudo)".
2. **No relatório,** onde houver VGV, a mesma frase, perto do número.
3. **Testes.**
   - `testar.cjs`: a frase está visível quando há VGV.
   - `test_relatorio.py`: a frase está no HTML quando há preço.
   - O teste das 6.519 folhas continua passando.

Rode `python -I -X utf8 viabilidade/relatorio/test_relatorio.py`. Se conseguir, rode também o Chrome (`VISUAL_URL=http://127.0.0.1:8787/viabilidade/visual/`).

## Relatório

`viabilidade/visual/RELATORIO-19.md`, até 6 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 19 pronta"`.
