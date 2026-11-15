# Tarefa 15 do Terreno: frente pela borda da quadra aceita o miolo da quadra (AUDITORIA-7, parte 1)

**Quem:** Claude Code (Visual), emprestado ao terreno: o Terreno e o Motor estão no fim da cota.
**Galho:** `viabilidade/lote-livre` (PR #124), worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** só `viabilidade/terreno/gerar_lotes.py` e os testes do terreno (`test_novo_lote.py` ou o teste do `gerar_lotes.py --testar`).
**Não fazer:** não commitar; não tocar em motor, tela, relatório, `conferir.py` nem `dados/`.

## Contexto

Leia, nesta ordem:
- `terreno/RELATORIO-12.md`: a regra 3, `frentes_borda` em `gerar_lotes.py`. Um lote sem asfalto a até 6 m ganha frente presumida quando um lado dá para um vão livre entre quadras;
- `auditoria/AUDITORIA-7.md`, pergunta 4.

## 1. MÉDIA: o lote 75931 recebe como frente principal um lado que dá para o miolo da quadra

- `75931` (Centro, em L, entre a Rua Aquidaban e a Rua Nove de Julho) sai com duas frentes `borda_de_quadra`:
  - lados `[3, 4]`, 24,029 m, vão de 17,05 m. Dá para um vazio de lotes não cadastrados **dentro** da quadra;
  - lados `[9, 0]`, 12,014 m, vão de 14,725 m. Dá para a rua de verdade.
- Como `frentes_borda` ordena por comprimento (`gerar_lotes.py:~202`), a falsa vira `frentes[0]`.
- Comando do Auditor para reproduzir:
  ```
  python -I -X utf8 -c "import sys; sys.path.insert(0,'viabilidade/terreno'); import gerar_lotes as gl, novo_lote as nl; cad=nl.Cadastro('completo'); print(gl.avaliar(cad.geos[75931], 75931, cad.geos, cad.tree, cad.malha, cad.tree_ruas, ampliar=True)['frentes'])"
  ```

**O que fazer.** Ache um critério simples que separe um vão que é rua de um vazio no miolo da quadra, usando o que já existe (malha de ruas, asfalto, quadras, lotes). Por exemplo:
- o corredor do vão tem que se ligar à malha de ruas ou ao asfalto pelas duas pontas, não só por uma;
- ou, havendo mais de uma candidata, a frente principal é a que fica mais perto do asfalto, e não a mais comprida.

Escolha um e explique em uma linha por que esse critério.

**Aceite:**
- `75931`: a frente principal é a sul (`[9, 0]`), ou o lote é recusado. Nunca o lado do miolo.
- Continuam com a mesma frente principal: `92058`, `46087`, `62350`, `73863`, `77017` e `76476`, que o Auditor conferiu no mapa como plausíveis.
- Os pilotos não mudam.
- Conte os lotes `borda_de_quadra` num raio de 400 m do centro, antes e depois (o Auditor contou 440), e diga quantos mudaram de frente ou passaram a ser recusados. Abra 3 dos que mudaram e diga se a mudança faz sentido.

## 2. BAIXA: erro de geometria derruba a avaliação

- `sh.union_all([geos[j] ...])` em `gerar_lotes.py:~187` dá `TopologyException: side location conflict` quando um vizinho na faixa de 30 m tem geometria inválida. O Auditor achou 1 caso no raio de 400 m.
- Faça o vizinho inválido não derrubar a avaliação: corrija a geometria antes de unir (`make_valid` ou `buffer(0)`, o que o código já usar em outro ponto) ou, se não der, trate como "frente não presumida" (recusa com motivo), nunca como erro.
- Teste com um caso que reproduza o erro.

## Testes

- `python -I -X utf8 viabilidade/terreno/novo_lote.py --testar`
- `python -I -X utf8 viabilidade/terreno/gerar_lotes.py --testar`
- `python -I -X utf8 viabilidade/motor/test_estudar.py`
- `python -I -X utf8 viabilidade/motor/test_varrer.py`

Casos novos: `75931` (item 1) e o vizinho inválido (item 2).

## Relatório

`viabilidade/terreno/RELATORIO-15.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 15 pronta"`.
