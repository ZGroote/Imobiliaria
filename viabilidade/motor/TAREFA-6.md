# Tarefa 6 da frente Motor: fechar as pendências (curta)

As 3 pendências da seção 3 do seu `RELATORIO.md`:
1. Auditoria 3, item 3.1: a opção B de `auditoria/casos/lote-20x35-perm-b.json` some ao afrouxar o recuo (permeabilidade muda a proporção da caixa). Afrouxar não pode tirar opção.
2. MÉDIA 13: `laje_max` × núcleo não computável na TO.
3. BAIXA 16: `utm.para_utm23s` rejeitar (lat, lon) invertido e ponto fora do fuso 23S, com erro claro.
Limite o cache (`maxsize` menor) se for 1 linha.

Cada um com teste. Regenere exemplo e pilotos só se os números mudarem.
Relatório em `motor/RELATORIO.md`; uma linha pra central: `maestri ask "Claude Code" "Motor tarefa 6 concluída. Testes ok/falhou."`
