# Tarefa 14 do Motor: `test_motor.py` mais rápido, sem perder cobertura

**Quem:** Motor.
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/motor/test_motor.py` (e um auxiliar de teste novo, se precisar).
**Não fazer:**
- não commitar;
- não mudar o `motor.py` nem os resultados;
- Terreno e Visual estão trabalhando em `terreno/`, `visual/` e `relatorio/`: não toque.

## Por quê

O `conferir.py` leva cerca de 10 min, e o `test_motor.py` sozinho gasta 460 s. Isso trava cada entrega.

## O que fazer

1. **Medir.** Meça o tempo de cada teste (ou grupo) e liste os 10 mais lentos no relatório.
2. **Cortar o tempo sem tirar nenhuma conferência.** Exemplos do que vale:
   - calcular uma vez o estudo que vários testes refazem (cache dentro do processo);
   - rodar grupos independentes em paralelo com `concurrent.futures`, se for seguro.

   Exemplos do que **não** vale:
   - reduzir a varredura de monotonia (94 pares);
   - pular piloto;
   - afrouxar a comparação com a linha de base.
3. **Provar que nada sumiu.**
   - Antes e depois: mesma contagem de asserções ou de casos (conte e mostre).
   - Os mesmos 94 pares.
   - A mesma linha de base 0.8.1, conferida pelo sha.
   - Uma mutação proposital no `motor.py` (cópia temporária, por exemplo trocar um recuo) tem que falhar antes e depois.
4. **Meta:** abaixo de 120 s nesta máquina. Se não der, diga onde está o piso e por quê.

## Relatório

`viabilidade/motor/RELATORIO-14.md`, até 10 linhas:
- tempo antes e depois;
- os 10 mais lentos;
- o que mudou;
- a prova de cobertura.

Depois: `maestri ask "Claude Code" "Motor tarefa 14 pronta"`.
