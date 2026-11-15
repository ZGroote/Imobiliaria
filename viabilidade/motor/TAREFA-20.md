# Tarefa 20 do Motor: varredura de lotes de uma região

**Quem:** Motor.
**Galho:** `viabilidade/lote-livre` (não troque de galho).
**Onde mexer:** só em `viabilidade/motor/`.
**Não fazer:**
- não commitar;
- não mexer em `terreno/` (o Terreno está corrigindo a zona automática na tarefa 11).

## Por quê

A incorporadora quer achar os lotes bons de uma região, não estudar um por um.

## O que fazer

`viabilidade/motor/varrer.py`

```
python -I -X utf8 viabilidade/motor/varrer.py --base completo --ponto "lat, lon" --raio 300 --saida <pasta> [--min-m2 400] [--apto-m2 ..]
```

1. **Lotes do raio.** Pegue os lotes cujo centroide fica dentro do raio, em metros e em UTM, usando o cadastro do terreno sem copiar lógica. Use `--min-m2` para filtrar a área. Limite de 500 lotes por varredura, com erro claro acima disso.
2. **Estudo de cada um.** Rode `estudar()` com `--zona auto`, no mesmo processo, aproveitando o cache.
   - Lote recusado (sem frente, zona duvidosa etc.) entra na tabela com o motivo, nunca some.
   - Um erro inesperado num lote não derruba a varredura: registre e siga.
3. **`<pasta>/varredura.csv`**, uma linha por lote, com as colunas:
   - índice, área, zona (com a origem), status (estudo ou recusa) e motivo;
   - número de opções, maior área computável, maior número de unidades;
   - áreas especiais (encontradas / não verificadas);
   - se a frente é presumida;
   - revisão do estudo.

   Ordene pela maior área computável, com as recusas no fim.
4. **`<pasta>/RESUMO.md`.**
   - Os 10 melhores lotes, com o caminho do `estudo.json` de cada um.
   - Quantos lotes foram recusados e por quê.
   - O aviso fixo: "Varredura automática: zona e áreas especiais sugeridas pela leitura do mapa, não conferidas. Não é lista de lotes à venda nem garantia de aprovação."
5. **Teste (`test_varrer.py`).**
   - Raio pequeno em torno de um piloto: o piloto aparece, com o mesmo resultado do `estudar.py`.
   - Raio que pega mais de 500 lotes: erro.
   - Um lote que lança exceção simulada: a varredura termina e registra o erro.
6. **Tempo.** Meça uma varredura de 300 m no centro e anote no relatório.

## Relatório

`viabilidade/motor/RELATORIO-20.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 20 pronta"`.
