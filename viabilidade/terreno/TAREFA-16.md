# Tarefa 16 do Terreno: o mapa do Centro está ~50 m fora do lugar?

**Quem:** Claude Code (Visual), emprestado ao terreno.
**Galho:** `viabilidade/lote-livre`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** nada de código. Só investigar e escrever `viabilidade/terreno/RELATORIO-16.md`. Scripts de medida ficam na sua pasta temporária, fora do repositório.
**Não fazer:** não commitar; não alterar código nem `dados/`.

## Por quê

No `RELATORIO-15.md`, você viu que, perto do 75931, os cruzamentos da malha de asfalto e os lotes ficam ~50 m (meia quadra) a oeste das ruas do Anexo 02. O erro de georreferenciamento medido antes era 3,53 m (`terreno/ZONA-AUTO.md` e `RELATORIO-5.md`). Se o recorte de algum anexo estiver 50 m fora em parte da cidade:
- a zona lida por cor (`sugerir_zona.py`) pode sair errada perto de divisa;
- as áreas especiais (Anexos 05, 06 e 07), inclusive a subárea de 9 m do art. 80 no Centro, podem cair no lote errado.

## Perguntas

1. **Qual está fora:** o anexo (recorte + ajuste), a malha de asfalto ou o cadastro de lotes? Use pontos de controle que dá para reconhecer nos três, como cruzamentos de ruas com nome, e uma fonte pública independente: OSM, já usado no projeto, ou a foto aérea que o projeto já usa. Mostre o deslocamento em metros e a direção em cada ponto.
2. **Onde:** meça em pelo menos 8 pontos espalhados (Centro, os 4 cantos da cidade e perto do aeroporto) e nos 4 anexos (02, 05, 06 e 07), já que cada um tem o seu ajuste. O deslocamento é constante, cresce para um lado ou só aparece no Centro?
3. **O que isso afeta:**
   - os lotes 74451, 77015, 77022, 77375 (dentro da subárea de 9 m) e 80172 (fora) continuariam do mesmo lado com o deslocamento medido?
   - e os pilotos, quanto à zona?
4. **Se houver erro:** proponha o conserto (refazer pontos de ajuste ou trocar de transformação) e o teste que pegaria o erro, mas **não aplique**.

## Regras

- Todo número vem com o comando rodado e a saída.
- Só dado público aberto. Nada de forçar parâmetro de URL ou contornar bloqueio.
- Se der 3 a 5 m, como o medido antes, diga isso e explique de onde veio a impressão dos 50 m.

## Relatório

`viabilidade/terreno/RELATORIO-16.md`, até 15 linhas, com a tabela dos pontos. Depois: `maestri ask "Claude Code" "Terreno tarefa 16 pronta"`.
