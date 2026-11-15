# Tarefa 6 do Revisor: testar o estudo de lote livre com lotes ao acaso

**Quem:** Revisor.
**Galho:** `feat/viabilidade-lote`.
**Onde escrever:** só `viabilidade/revisao/REVISAO-6.md` (e uma pasta temporária fora do repositório para as saídas).
**Não fazer:**
- não commitar;
- não alterar código.

## Contexto

Agora um estudo sai com um comando só:

```
python -I -X utf8 viabilidade/motor/estudar.py --base completo --ponto "lat, lon" --zona auto --pasta <tmp>
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices N --zona SC-Z1 --pasta <tmp>
```

Veja `motor/RELATORIO-13.md` e `RELATORIO-15.md` e `terreno/RELATORIO-4.md` a `RELATORIO-7.md`.

## O que fazer

1. **Sorteio.** Sorteie 20 índices da base `completo`, com semente fixa e anotada, e rode `--indices N --zona auto` em cada um.
   - Para cada lote, registre: resultado (estudo ou recusa), motivo, zona sugerida, opções, ausentes, áreas especiais e tempo.
2. **Procurar defeito.** Procure:
   - quebra (traceback);
   - recusa sem motivo claro;
   - estudo com número absurdo (área construída maior que CA × área do lote, TO acima do limite, unidades com área privativa zero, vagas negativas);
   - zona sugerida em lote que claramente fica numa divisa;
   - estudo sem nenhum alerta de área especial e sem "não verificada";
   - `resumo.txt` que contradiz o `estudo.json`.
3. **Dez coordenadas.** Escolha 10 pontos no Google Maps (5 em lotes, 5 em ruas ou praças) e rode com `--ponto`.

**Regra de evidência:** todo achado traz o comando exato e o trecho da saída copiado. Nada de achado sem comando reproduzível. Se não achar defeito, diga isso e o que foi testado.

## Relatório

`viabilidade/revisao/REVISAO-6.md`:
- veredito no topo;
- tabela dos 20 + 10;
- achados com o comando para reproduzir cada um.

Depois: `maestri ask "Claude Code" "Revisor tarefa 6 pronta"`.
