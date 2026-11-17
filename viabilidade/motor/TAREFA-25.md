# Tarefa 25 (Motor, emprestado ao terreno): por que 29 lotes caem em "cor sem zona segura"

**Quem:** Motor.
**Galho:** `viabilidade/pos-124`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** nada de código. O Terreno está mexendo em `viabilidade/terreno/` (T21); só leia. Scripts de medida ficam na sua pasta temporária. Entra no repositório só o relatório.
**Não fazer:** não commitar.

## Por quê

No `terreno/RELATORIO-20.md`, 22% dos 500 lotes sorteados (semente 20261120) caem em "zona incerta":
- 62 por divisa a menos de 10 m;
- 29 por "cor sem zona segura";
- 12 por estarem fora do Anexo 02;
- 6 por eixo.

A margem de 10 m fica, porque o erro do mapa chega a ~6 m. Mas os 29 de cor podem ser defeito de leitura, e não dúvida de verdade.

## Perguntas

1. Para os 29 de cor (refaça a lista com o script da T20: está no relatório, com o caminho `S=`): que cor o `sugerir_zona.py` leu em cada um, e por que não casou com a paleta? Exemplos de causa: ruído do JPEG, texto ou rótulo por cima, hachura, cor de área especial misturada, borda.
2. Abra pelo menos 10 no recorte do Anexo 02 e diga qual zona um humano leria. Se nem um humano consegue dizer, a recusa está certa.
3. Para os 12 fora do Anexo 02: estão mesmo fora do perímetro do mapa (zona rural) ou fora por erro de recorte?
4. Proponha 1 ou 2 consertos com quantos lotes cada um recupera, e o risco de dar a zona errada. **Não aplique.** Ler a zona errada é pior que recusar.

## Relatório

`viabilidade/motor/RELATORIO-25.md`, até 12 linhas, todo número com o comando que o gerou. Depois: `maestri ask "Claude Code" "Motor tarefa 25 pronta"`.
