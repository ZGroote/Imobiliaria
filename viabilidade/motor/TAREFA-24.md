# Tarefa 24 do Motor: a altura do art. 80 é medida do chão do motor, não da via (BAIXA da AUDITORIA-7, pós-merge do #124)

**Quem:** Motor.
**Galho:** `viabilidade/pos-124` (saiu da main depois do merge do PR #124), worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** `viabilidade/motor/` (código e testes). Pode ler `viabilidade/lei/` e `viabilidade/terreno/`, mas não mexer neles.
**Não fazer:** não commitar; não tocar em terreno, tela, relatório nem `conferir.py`.

## Por quê

Leia `auditoria/AUDITORIA-7.md`, pergunta 3, item 3. Resumo:

- art. 80 da Lei 18.053/2016: "limitação do gabarito a 9m (nove metros) acima do nível da via pública nas novas construções ou ampliações";
- `_cabe()` (`motor.py:~536`) compara `max(z0_m + altura_m)` com `altura_max`. A `altura_m` (`_altura`, `motor.py:~402`) soma só pé-direito por pavimento, sem platibanda, telhado, caixa d'água ou barrilete, e o chão é z=0 (relevo ignorado);
- hoje isso só aparece como texto (`terreno/areas_especiais.py:~55` e a incerteza "Relevo ignorado" em `motor.py:~827`).

Nos 3 lotes de dentro da subárea (77015, 77022, 77375), sai 2 pavimentos com 7,5 m. Sobram 1,5 m para o que fica acima da laje. Não sabemos se isso basta.

## O que fazer

1. **Ler antes de codar.** Procure na Lei 18.053/2016 (cópia e notas em `viabilidade/lei/`) e no Código de Obras (Lei 19.950/2020, citada em `lei/ALTERACOES-P12.md`) como "gabarito" é medido: de onde (via, meio-fio, nível médio do terreno) até onde (laje, platibanda, cumeeira, caixa d'água). Cite o artigo e o trecho. Se não achar, diga isso. Não invente a regra.
2. **Conserto mínimo, conforme o que achar:**
   - Se a lei disser o que entra, aplique isso na comparação com `altura_max` e só com ela. O h/8 e o resto não mudam.
   - Se não disser, crie uma premissa de quanto fica acima da última laje (por exemplo, `acrescimo_topo_m`), com padrão 0 e listada em "premissas no valor padrão". Some essa premissa na comparação com `altura_max`. Em toda opção limitada por `altura_max`, ponha um alerta com a folga: "sobram X m até os 9 m do art. 80 para platibanda/caixa d'água; medido do térreo, não da via; confirmar na Prefeitura".
3. **Nível da via:** o motor não tem a cota da rua. Não tente calcular. Basta o alerta dizer que a altura sai do térreo, não da via.
4. **Testes:**
   - 77015 com `acrescimo_topo_m` 0 e 2: com 2, a opção de 7,5 m (1,5 m de folga) tem que sair ou mudar;
   - lote fora da subárea: saída idêntica à de antes.

## Testes

- `python -I -X utf8 viabilidade/motor/test_motor.py`
- `python -I -X utf8 viabilidade/motor/test_estudar.py`
- `python -I -X utf8 viabilidade/motor/test_varrer.py`
- `python -I -X utf8 viabilidade/conferir.py`: 8/8 (se algum estudo comparado byte a byte mudar, diga qual e por quê)

## Relatório

`viabilidade/motor/RELATORIO-24.md`, até 10 linhas, com o artigo achado (ou "não achei"). Depois: `maestri ask "Claude Code" "Motor tarefa 24 pronta"`.
