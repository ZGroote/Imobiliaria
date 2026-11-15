# Tarefa 14 do Terreno: achados da REVISAO-7 (1 MÉDIA, 2 BAIXA)

**Quem:** Claude Code (Terreno). Começar só depois de entregar a tarefa 13.
**Galho:** `viabilidade/lote-livre`.
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:** não commitar; não tocar em motor, tela, relatório, `conferir.py` nem `dados/`.

Leia `viabilidade/revisao/REVISAO-7.md`, seção 4.

## 1. MÉDIA: os 9 m do art. 80 não entram no cálculo

Hoje `restricao_gabarito_historico` sai sem `altura_max_m`, e o motor gera prédio de 13,5 m em `74451`, `77015`, `77022` e `77375`, só com alerta.

- Quando o lote está **dentro** do tracejado magenta (não só perto), grave `altura_max_m: 9` com a fonte (Lei 18.053/2016, art. 80). O motor já aplica o menor `altura_max_m` das áreas especiais (`busca_fina.py`); confirme isso lendo o código e não altere o motor.
- Quando é só "perto" (margem de divisa), mantenha sem altura e com o alerta, como hoje.
- Antes, confira no texto do art. 80 (em `viabilidade/lei/`) se os 9 m são altura total e de onde se mede. Se o texto disser outra coisa, siga o texto e diga no relatório.

## 2. BAIXA: contorno grosseiro dá falso positivo

- `ler_subarea` usa o contorno convexo de um tracejado côncavo, e isso inclui quinas de fora. Isso passa a importar, porque o item 1 vai aplicar altura. Troque por um contorno que siga o tracejado (por exemplo, fechar o traço e preencher) **só se** os 4 lotes acima continuarem dentro e `80172` continuar fora. Se não der com segurança, deixe como está e diga por quê.
- `ler_cones` (fecho único dos dois cones) e o retângulo da AEI do Transporte Aéreo: aqui o falso positivo é conservador, só gera alerta. Só mexa se for simples; senão, registre como limite.

## 3. BAIXA: cache sem trava entre dois processos

`Permission denied` em `.cache/tmp*.tmp` quando dois `estudar.py` rodam juntos (Windows). Faça a gravação tolerar isso: nome temporário único e, se a troca falhar porque outro processo já gravou o mesmo arquivo, use o que está lá ou siga sem cache. Nunca falhe o estudo por causa do cache. Teste com dois processos em paralelo no mesmo lote frio.

## Testes

- `novo_lote.py --testar`, `motor/test_estudar.py`, `motor/test_varrer.py`.
- Um caso novo: lote dentro da subárea sai com opções de no máximo 9 m.

## Relatório

`viabilidade/terreno/RELATORIO-14.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 14 pronta"`.
