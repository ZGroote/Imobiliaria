# Relatório do Motor, tarefa 6 (14/11): fechar as pendências

Motor **v0.7.1**. `python -I viabilidade/motor/test_motor.py` passa ("ok"); os 3 consertos têm teste em `tarefa6()`. `relatorio/test_relatorio.py` passa. Exemplo e os 7 pilotos regenerados (`preparar_exemplo.py`, `gerar_pilotos.py`).

## 1. O que foi feito

| # | Item | Causa e conserto | Teste |
|---|---|---|---|
| 1 | Auditoria 3, item 3.1: afrouxar o recuo tirava a opção B (`lote-20x35-perm-b`) | **Reproduzi**: B existia com recuo 3,0 m (30 unidades) e sumia com 1,5 m. A causa não era a caixa legal (que só cresce): era o limite de permeabilidade. `_encolhe(térreo, area_max)` recua igual em todo lado até sobrar `area_max`; com a caixa maior o recuo extra come mais da profundidade (26,98 → 25,96 m), as duas torres ficam com 99,7 m² e 99,7 − 40 de área comum < 60 m²: zero apartamento. Dois limites de mesma área não podem um conter o outro, então "limite maior" não existe; o que dá pra garantir é o limite **não depender do recuo da lei**. Agora `_Caixas.fixa_limite` usa a caixa com recuo `e` igual nos dois lados (frente fica a da lei), com `e` achado por bisseção pra dar `area_max`. Com recuo igual dos dois lados, `e` não depende do recuo da lei: afrouxar só faz `legal ∩ limite` crescer. Recuo da lei maior que `e` num lado continua valendo naquele lado. O cache de `legal()` arredonda o recuo a 1 cm e deixaria a área passar de `area_max`, então a bisseção chama `caixa_recuada` direto. | lote 20×35, permeabilidade 50%, recuos 3,0 / 2,0 / 1,5 m: as 4 opções existem nos três, unidades nunca caem, `confere` passa |
| 2 | MÉDIA 13: `laje_max` × núcleo | `laje_max` travava a laje **bruta** em `TO × A`, mas `_avaliar` mede a TO descontando o núcleo (20 m²) de cada volume no chão. A TO sobrava 20 m² sem uso. Agora a projeção bruta máxima é `min(TO × A + k × núcleo, (1 − perm) × A)`, com k = volumes no chão (1; duas torres: 2). A permeabilidade continua contando a área bruta. A TO medida nunca passa da lei (`_cabe` confere). | lote 25×40, TO 20%: a lâmina passa de 200 m² e `to_usada` ≤ 0,20 |
| 3 | BAIXA 16: `utm.para_utm23s` | Recusa ponto fora do fuso 23 (lon −48 a −42) ou fora do hemisfério sul (lat −80 a 0) com `ValueError` claro. Se (lat, lon) parece trocado, diz isso ("a ordem é (lon, lat)"). Ponto de São Carlos converte igual. | (lat, lon) invertido, lon −60, lat +10, e São Carlos |
| 4 | Cache | `lru_cache(maxsize=4096)` → `512` nas 3 funções (1 linha cada). | — |

## 2. O que mudou nos números

- **Unidades e pavimentos por opção: iguais** no exemplo e nos 7 pilotos (conferi contra o `HEAD`).
- Mudou só a área privativa e a geometria: exemplo, opção C, 3.402,56 → 3.436,06 m² (TO 0,687 → 0,694, o item 2). Os JSON dos pilotos também mudam na versão (`0.7.1`).
- No caso 20×35 com permeabilidade 50% a privativa de A e C caiu ~1–3% com recuo 3,0 m (A 2.109,88 → 2.095,68; C 1.077,31 → 1.044,96) com as mesmas unidades: é o preço do limite novo, que tem outra proporção que o encolhimento uniforme antigo. Em troca, os resultados com recuo 3,0 e 1,5 m ficaram iguais.
- `relatorio/saida/*.html` citam `0.6.0`: não regerei, é da frente Relatório (o teste dela regrava 3 deles; desfiz).

## 3. Pendentes

- Recuo assimétrico (por exemplo lateral 1,5 m e fundos 10 m) com permeabilidade apertada: o limite novo não é provado monotônico; o caso simétrico, que é o da auditoria, é.
- `garagem_computavel=True` continua limitação conhecida (tarefa 5).

## 4. Sem commit

`motor.py`, `test_motor.py`, `utm.py`, `RELATORIO.md`, `exemplos/estudo-exemplo.json`, `exemplos/pilotos/` (7 arquivos). Nada commitado (sem autorização). Na árvore há 4 arquivos da frente Visual (Codex), que não toquei.
