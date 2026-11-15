# Tarefa 26 do Motor: o relevo dá para usar? (investigação, sem código)

**Quem:** Motor.
**Galho:** `viabilidade/pos-124`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** nada de código. O Terreno está mexendo em `viabilidade/terreno/` (T21); só leia. Scripts na sua pasta temporária. Só o relatório entra no repositório.
**Não fazer:** não commitar.

## Por quê

Hoje o motor assenta tudo em z=0 e avisa que o relevo foi ignorado. Há dois pontos em que isso pesa:
- o art. 80 fala em "9 m acima do nível da via" (T24);
- em terreno inclinado, o térreo, o subsolo e o h/8 mudam.

O projeto já tem relevo: `terreno/preparar_relevo.py` lê o Copernicus GLO-30, e cada piloto traz `cota_min_m`, `cota_max_m` e `declividade_pct` (`dados/relevo-pilotos.json`). Mas o GLO-30 é DSM: mede o topo de prédio e árvore, não o chão, e o pixel tem 30 m. Antes de usar, precisamos saber se ele serve.

## Perguntas

1. **O dado serve no lote?** Nos 171 aceitos da amostra da T20 (o script está no `terreno/RELATORIO-20.md`, `S=`), quanto dá a declividade e o desnível? Separe lote vazio de lote construído, olhando a foto aérea ou a contagem de prédios do cadastro. Em lote construído, quanto do "desnível" é prédio, e não chão?
2. **Comparação com uma fonte melhor, só se for aberta:** existe curva de nível ou MDT público de São Carlos (prefeitura, IBGE, IGC-SP, ANA)? Se houver, compare em 10 lotes. Só fonte aberta: nada de forçar URL nem contornar login.
3. **Nível da via:** dá para tirar a cota da rua em frente ao lote (pixel do asfalto, que não tem prédio em cima) com erro aceitável? Compare a cota da rua com a do lote nos 3 da subárea do art. 80 (77015, 77022, 77375).
4. **O que mudaria no estudo:** com o dado que existe, o que dá para fazer com honestidade? Por exemplo, só um alerta "lote com X% de declive: térreo e subsolo podem mudar", ou mexer na conta. Proponha 1 ou 2 caminhos, com o risco de cada um. **Não aplique.**

## Relatório

`viabilidade/motor/RELATORIO-26.md`, até 12 linhas, todo número com o comando que o gerou. Depois: `maestri ask "Claude Code" "Motor tarefa 26 pronta"`.
