# Tarefa 18 do Motor: premissas de produto no comando único

**Quem:** Motor.
**Galho:** `viabilidade/lote-livre` (não troque de galho).
**Onde mexer:** só em `viabilidade/motor/`.
**Não fazer:** não commitar.

## Por quê

A tarefa 16 mostrou que lote estreito perde opção por **premissa de produto**, não por lei:
- 60 m² privativos por apartamento;
- 40 m² de área comum por pavimento;
- laje mínima de 80 m².

Num lote estreito, um produto de studios de 30 a 40 m² pode caber. Hoje só dá para mudar isso com um JSON (`--premissas`).

## O que fazer

1. **`estudar.py` ganha atalhos.** Cada um troca a premissa correspondente e entra na lista de premissas **informadas pelo usuário**, fora de `premissas.padrao`:
   - `--apto-m2 N` → `area_privativa_por_unidade_m2`;
   - `--comum-m2 N` → `area_comum_por_pavimento_m2`;
   - `--laje-min-m2 N` → laje mínima. Confira qual é o nome real no motor. Se a laje mínima não for premissa hoje, diga no relatório e **não** a transforme em premissa sem a prova do item 3.
2. **Validação.**
   - Faixas plausíveis, por exemplo apto de 20 a 400 m² e comum de 0 a 400 m².
   - Fora disso, erro claro.
   - Conflito com `--premissas`: erro.
3. **Prova.**
   - O lote 75902 (`--ponto "-22.0175, -47.8908" --zona auto`) com `--apto-m2 35` tem que abrir mais opções do que com o padrão. Mostre quais.
   - Nenhum número pode passar dos limites da lei (CA, TO, permeabilidade, recuos): confira com as funções de verificação do motor.
4. **`resumo.txt`** traz uma linha "Premissas do usuário: apto 35 m²; …" quando houver.
5. **Testes.**
   - `test_estudar.py` cobre o caso acima, as recusas e a linha do resumo.
   - `test_motor.py` continua passando, com os pilotos iguais.

## Relatório

`viabilidade/motor/RELATORIO-18.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 18 pronta"`.
