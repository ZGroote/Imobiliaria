# T29 — lote na divisa: um estudo por zona candidata (16/11)

Galho `viabilidade/duas-zonas`. Leia antes `terreno/RELATORIO-23.md`: o terreno agora diz, na `ZonaIncerta.sugestao`, `so_divisa: true` e `candidatas` (2 zonas; nunca 3 no sorteio) quando a única dúvida é a divisa a menos de 10 m. Com `--zona auto:SC-Zx` o `novo_lote` gera o lote com `zona_origem: "candidata_na_divisa"`, a `zona_sugestao` inteira e a observação "… confirmar a zona na Prefeitura".

## O que fazer

1. **`estudar.py --zona auto`:** quando a `ZonaIncerta` vier com `so_divisa: true`, em vez de recusar, gerar **um estudo por candidata** chamando o terreno com `auto:SC-Zx`, em subpastas `zona-SC-Zx/` dentro da `--pasta` (cada uma com os 4 arquivos de hoje), mais um `resumo.txt` na raiz que compara as candidatas lado a lado (zona, nº de opções, melhor CA/unidades/área vendável por zona, revisão de cada estudo) e diz em uma linha: "Lote na divisa entre zonas: confirmar a zona na Prefeitura antes de usar qualquer um dos estudos." Se uma candidata não gerar estudo, o resumo diz por quê e a outra segue. Falha no meio apaga o que criou (como hoje). Sem `so_divisa`, a recusa e a mensagem de hoje não mudam.
2. **`motor.py`:** `texto_origem` ganha `"candidata_na_divisa"` → algo como "uma das zonas candidatas na divisa (SC-Z4, SC-Z3), escolhida para este estudo; a outra tem estudo próprio". O lote continua `zona_conferida: false`, então a incerteza "NÃO conferido" segue. Acrescente **um alerta** por opção: "Lote na divisa entre zonas (SC-Z4 | SC-Z3, a ~X m): este estudo supõe SC-Zx; confirmar a zona na Prefeitura." (texto livre, mas curto e com as candidatas).
3. **`estudar._linha_zona`** e **`varrer.ORIGEM`**: tratar a origem nova (hoje o resumo diria "sugerida pelo mapa" e o `varrer` quebraria com KeyError). No `varrer`, um lote `so_divisa` pode virar uma linha por candidata ou uma linha "divisa: SC-Z4 | SC-Z3"; escolha o mais simples e diga no relatório.
4. **Nada muda nos outros lotes:** pilotos com o mesmo SHA de `motor/exemplos/linha-de-base-0.8.1.json` (`test_8b`), e lote aceito ou com zona informada sai igual byte a byte. Se precisar mexer no `test_estudar` (lista de alertas permitidos), mexa só para aceitar o alerta novo.

## Teste

- Use 90050 (Z4|Z3) do relatório do Terreno: `estudar.py --base completo --indices 90050 --zona auto --pasta <temp>` gera `zona-SC-Z4/`, `zona-SC-Z3/` e o `resumo.txt` comparativo; o alerta novo aparece nas opções dos dois.
- Um lote `so_divisa: false` (ex.: 75352–75354) continua recusado com a mensagem de hoje.
- `varrer` num raio que inclua 90050 não quebra.
- Rode `test_estudar.py`, `test_motor.py`, `test_varrer.py`, `test_8b` e `conferir.py` (8/8).

Não toque em `terreno/`, `relatorio/` nem tela. Não commite. Relato em `motor/RELATORIO-29.md` (curto, numerado, com os números e onde ficaram os exemplos). Ao terminar: `maestri ask "Claude Code" "Motor tarefa 29 pronta"`.
