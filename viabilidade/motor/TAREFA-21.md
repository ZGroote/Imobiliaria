# Tarefa 21 do Motor: um alerta só para as áreas não verificadas

**Quem:** Claude Code (Motor).
**Galho:** `viabilidade/lote-livre`.
**Onde mexer:** `viabilidade/motor/` (e, se um teste do relatório ou da tela quebrar pelo texto novo, só o teste, dizendo qual).
**Não fazer:** não commitar; não tocar em `viabilidade/terreno/` (o Terreno está na tarefa 12).

## Por quê

Depois da tarefa 13 do terreno (que você fez), todo lote novo traz de 2 a 4 registros `tipo: nao_verificada` (um por anexo vazio + o das leis posteriores). Em `motor.py` (~linha 784), cada um vira um alerta "ÁREA ESPECIAL sem altura numérica, NÃO aplicada: nao_verificada" **em cada opção**. É barulho: o usuário lê o mesmo aviso 4 vezes por opção.

## O que fazer

1. Em cada opção, os registros com `tipo == "nao_verificada"` viram **um** alerta só, que diz quais anexos (campo `anexo`) e que o resultado pode passar do que o terreno permite. Áreas **encontradas** sem altura (por exemplo `restricao_gabarito_historico`, `gabarito_aeronautico`) continuam com o alerta próprio, uma por uma.
2. As `incertezas` do estudo continuam listando cada registro, porque ali é o lugar do detalhe. Se você achar que também deveria agrupar, diga, mas não agrupe.
3. Nenhum alerta pode sumir sem ser substituído: se havia pelo menos um `nao_verificada`, a opção tem o alerta agrupado.
4. Pilotos: se a saída de algum piloto em `exemplos/` mudar, diga qual e por quê. A versão do motor sobe só se o contrato mudar (o texto do alerta não é contrato; confira no `README.md`).

## Testes

`test_motor.py`, `test_estudar.py`, `test_varrer.py` e `relatorio/test_relatorio.py`. Um caso novo: lote com 3 `nao_verificada` + 1 área encontrada sem altura sai com exatamente 2 alertas de área especial por opção.

## Relatório

`viabilidade/motor/RELATORIO-21.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 21 pronta"`.

## Acréscimo (depois da tarefa 12 do terreno)

O terreno agora marca `qualidade.frentes[0].regra: "borda_de_quadra"` com `largura_vao_m` (veja `terreno/RELATORIO-12.md`). Em `motor.py` (~linha 768) isso cai no ramo da tolerância e sai "Frente presumida (asfalto a 29.141 m, acima dos 6 m da regra)", que é enganoso. Dê um ramo próprio: "Frente presumida pela borda da quadra (sem asfalto no mapa; vão de X m entre quadras): conferir no local". Teste com um lote real dessa regra (ex.: 92058).
