# Tarefa 8 do Revisor: revisão do código mudado desde a REVISAO-7 (antes do merge do #124)

**Quem:** Revisor.
**Galho:** `viabilidade/lote-livre` (não troque de galho). Revise o commit `3287e6d7`: `git diff e7a79f13..3287e6d7 -- '*.py'`.
**Onde escrever:** só `viabilidade/revisao/REVISAO-8.md`.
**Não fazer:**
- não commitar;
- não alterar código nem dados;
- não mexer em `terreno/lotes-piloto.json`, `conferencia/` nem `motor/exemplos/`: o Terreno está trabalhando neles (tarefa 18).

## Contexto

É a revisão independente que o usuário pediu antes de juntar o PR #124 na main. Mudou, desde a REVISAO-7 (13 arquivos .py, ~435 linhas):
- `gerar_lotes.py`: frente pela borda da quadra (T12) e a escolha da frente mais perto do asfalto e `make_valid` nos vizinhos (T15);
- `areas_especiais.py` e `cache.py`: subárea de 9 m do art. 80 e o cache em memória quando o disco falha (T13, T14);
- `sugerir_zona.py`: afim direta 31983→pixel por 21 cruzamentos, no lugar dos 5 vértices via SAD69 (T17, que fechou a ALTA do `terreno/RELATORIO-16.md`);
- `motor.py`: alerta agrupado de área não verificada e o ramo da frente pela borda (T21);
- `conferir.py`: stderr do servidor (T22).

Relatórios: `terreno/RELATORIO-12` a `17`, `motor/RELATORIO-21` a `23`. **Não confie neles:** confira no código e rodando.

## O que fazer

1. **Leitura do diff.** Erro de lógica, caso de borda sem tratamento, exceção engolida, teste que passa sem testar o que diz. Diga arquivo e linha.
2. **Posicionamento (T17).** Escolha 3 cruzamentos de rua com nome que **não** estão em `terreno/dados/zonas-controles.json` (nem nos 21 do ajuste nem nos 8 de verificação). Ache a coordenada no cadastro/malha do projeto, leve ao pixel com `MapaGeorreferenciado` em cada anexo (02, 05, 06, 07) e diga, olhando o recorte, a distância ao centro do cruzamento no mapa. Mais de 10 m é achado.
3. **Cache (T14/T17).** Se `zonas-posicionamento.json` mudar, o `subarea-06` e o `cones-07` são refeitos? Mostre com um teste numa cópia em pasta temporária, sem alterar o repositório.
4. **Frente (T15).** 3 lotes `borda_de_quadra` seus (não os da AUDITORIA-7): a frente principal dá para rua no Anexo 02?

## Regras de evidência

- Todo achado vem com o comando exato e a saída copiada.
- Rode tudo numa pasta temporária fora do repositório.
- Só dado público aberto; nada de forçar parâmetro de URL nem contornar bloqueio.

## Entrega

`REVISAO-8.md`: veredito no topo (pode juntar na main ou não, pelo código), uma seção por item e achados com gravidade (ALTA, MÉDIA, BAIXA).

Depois: `maestri ask "Claude Code" "Revisor tarefa 8 pronta"`.
