# Tarefa 6 do Visual — PRD V1 §4.2 e V1-004/006/007 (maquete volumétrica e relatório)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/` e `viabilidade/relatorio/`. Não commite.
O motor está sendo mexido em paralelo (`viabilidade/motor/`): não toque.

Leia `viabilidade/PRD-V1-COMERCIAL.md` §4.2 e a tabela §6 (V1-004, V1-005, V1-006, V1-007).

## 1. Revisão do estudo (V1-004 / V1-007: "mesma revisão, sem divergência")

- Identificador da revisão = os 12 primeiros caracteres do **sha256 dos bytes do JSON do estudo** como foi carregado + `versao_motor`. Ex.: `rev 3fa2b1c09d4e · motor 0.8.0`.
- Mostrar na tela (rodapé do resumo) e no relatório (cabeçalho e rodapé de cada página impressa).
- O relatório gera a partir do mesmo arquivo: o identificador tem que **bater** com o da tela para o mesmo JSON. Teste em `test_relatorio.py` (calcula o sha do arquivo e confere no HTML) e em `testar.cjs` (lê o identificador na tela e compara com o sha calculado no Node).
- O link "Relatório para imprimir" deve levar ao relatório da mesma revisão: se o `saida/<id>.html` foi gerado de outro JSON (sha diferente), a tela avisa "relatório desatualizado para esta revisão" em vez de abrir calada. O relatório grava o sha num `<meta name="estudo-sha256" content="...">` para a tela conferir (fetch do HTML, mesma origem).

## 2. Volume hipotético (§4.2, condição de aceite)

- Aviso **sempre visível** junto da maquete (não só no rodapé): "Volumes hipotéticos de potencial construtivo. Não são o projeto nem a fachada do edifício e não indicam aprovação." Mesmo texto no relatório, perto das figuras.
- Teste: o aviso está visível na primeira tela, em desktop e celular, sem rolar.

## 3. Alertas no fluxo (V1-005)

- Confirme que alertas de incerteza, área especial, opções ausentes e relevo aparecem **no mesmo fluxo** da maquete no celular (sem hover). Se algum só aparece no desktop, corrija.

## Testes

`python -I -X utf8 viabilidade/relatorio/test_relatorio.py` e `node --check viabilidade/visual/testar.cjs`. O Chrome a central roda.
Regenere `relatorio/saida/*.html` **só no fim**, depois que o motor terminar. Não regenere agora: os JSONs do motor ainda vão mudar. A central regenera.

## Relatório

`viabilidade/visual/RELATORIO-6.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 6 pronta"`.
