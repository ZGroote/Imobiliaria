# Relatório da tarefa 4 do Projetista: gerador esquemático de pavimento

Data: 16/11. Nada foi commitado (ordem da tarefa). A fatia 1 (`esquema.py`, `adaptador.py`, `validador.py`) não foi alterada.

## O que foi feito

- `gerador.py`: `gerar_pavimento(site, regras, programa, limites, estudo_ref) -> resultado` e a linha de comando.
- `test_gerador.py`: 7 testes só com `assert`. Passam, e os 18 da fatia 1 continuam passando.

Como o gerador pensa (sem IA, sem `random`, sem relógio):

1. Acha a direção dominante do envelope (lado longo do retângulo mínimo que o cerca) e gira tudo para ficar alinhado.
2. Enumera combinações em ordem fixa: tipo de corredor (central, com unidades dos dois lados, ou lateral, com unidades de um lado), profundidade da unidade, largura da unidade e posição do núcleo (no meio ou na ponta).
3. Ordena pelo limite superior da área privativa total e poda quando o limite não bate mais a K-ésima melhor (ramificar e podar). Empate: menor resíduo, depois mais fachada mínima por unidade, depois a ordem de enumeração.
4. Para cada combinação acha a primeira posição em que a laje cabe no envelope, monta a revisão e **passa pelo `validador.validar`**.
5. Só sai como `gerado` a proposta sem `violacao` e sem `erro_tecnico`. Achado `nao_verificado` não bloqueia. Mas acesso, fachada e lado mínimo são conferidos também pelo gerador, porque o validador esconde essas contas atrás de `nao_verificado` quando a fonte não está verificada.
6. O limite da busca é contagem de nós (`max_nos`, padrão 100.000), nunca tempo.

Resultados (`outcome`):

- `gerado`: lista de até K revisões seladas (padrão 3), ordenadas pela área privativa total, cada uma com suas métricas em `metrics_summary`.
- `inviavel`: só com prova simples e escrita (área do envelope menor que N × área mínima + núcleo; ou largura mínima do envelope menor que lado mínimo + corredor).
- `nao_encontrado`: sem prova. Traz o número de nós, se a busca terminou ou foi cortada, e o motivo de recusa mais frequente (`recusas`).

## Números nos pilotos (6 unidades por pavimento, padrões)

| Piloto | Resultado | Unidades | Área privativa média | Resíduo da laje | Observação |
|---|---|---|---|---|---|
| q1382-11984-11988 | gerado | 6 | 73,75 m² (73,26 a 74,74) | 0,10 m² | 8 faixas do envelope refeitas; busca cortada pelo limite de nós |
| 22421 | gerado | 6 | 55,11 m² (54,77 a 55,78) | 0,09 m² | busca completa |
| 25297 | inviável | 0 | | | prova: envelope 146,6 m² < 6 × 45 + núcleo 22,2 = 292,2 m² |
| 30516 | nao_encontrado | | | | busca cortada pelo limite; recusa mais frequente: "núcleo não cabe na profundidade da unidade" |
| 22426 | nao_encontrado | | | | busca completa; recusa mais frequente: "laje não cabe no envelope" |

Retângulo sintético 30 × 20 m: 6 unidades, total 436,9 m², resíduo 0,09 m², fachada mínima 8,45 m. Girado 37°: o mesmo total (diferença menor que 0,5 m²).
Cada revisão gerada tem 28 achados `nao_verificado` (areas.computavel, areas.privativa, areas.util, dimensao, norma.envelope): são fontes que a fatia 1 marca como não conferidas, não problema da proposta.

### q1382: faixas do envelope refeitas

8 das 12 faixas (0, 2, 6, 7, 8, 9, 10, 11) têm autointerseção de largura zero (espigões). O validador da fatia 1 recusa a revisão inteira por uma faixa inválida (`erro_tecnico`), mesmo que o pavimento nem toque nela. Então o gerador refaz a faixa com `make_valid` e só aceita se a área não mudar além da tolerância. Variação medida nas 8: 0,0000 m² (a área em 4 casas é idêntica). As áreas antes e depois ficam gravadas em `metrics_summary.geracao.reparos_envelope` da revisão, e o `site` da revisão já leva as faixas refeitas. O estudo original não é tocado.

## Premissas (não são norma conferida)

Todos os padrões ficam em `PADROES` no `gerador.py` e podem ser trocados por parâmetro:

- 6 unidades por pavimento; área privativa por unidade de 45 a 75 m²;
- corredor de 1,50 m; núcleo de 2,50 m de largura com escada 5,0 m, elevador 2,4 m e shaft 1,5 m de profundidade;
- lado mínimo da unidade 3,0 m; fachada mínima 3,0 m e porta 0,8 m (as duas já eram premissas da fatia 1);
- espessuras: interna 0,15, externa 0,20, divisa 0,20 m; pé-direito 3,0 m; pavimento tipo em z = 0.

Nenhuma medida de norma foi verificada. O `programa` completo vai gravado em cada revisão.

## Limitações

- Só o modelo de faixas retangulares alinhadas ao eixo dominante. Envelope em L, com recorte forte, ou com miolo torto sai pior ou como `nao_encontrado`. Isso não é prova de inviabilidade.
- A laje inteira (unidades, corredor e núcleo) é um único retângulo. Não há dois corpos nem corredor em L.
- Núcleo em pilha: no corredor lateral precisa de escada + elevador + shaft ≤ profundidade da unidade; no central, escada ≤ profundidade e elevador + shaft ≤ profundidade.
- Um só pavimento tipo, na altura z = 0. Não avalia andares em que o envelope encolhe.
- Unidades retangulares sem varanda, sem divisórias internas, sem abertura de porta ou janela desenhada.
- Posição da laje em grade de 0,5 m (`passo_posicao_m`); larguras e profundidades em grade de 0,25 m (`passo_m`). Uma solução que só cabe fora da grade não é achada.
- Folga de 0,3 mm entre elementos (`FOLGA`) para o arredondamento em 4 casas não gerar sobreposição nem zerar o contato. Por isso as áreas não batem exatamente com a soma ideal. O resíduo declarado é o vazio real, medido depois do arredondamento.
- Em envelopes grandes e irregulares (q1382, 30516) o limite de 100.000 nós corta a busca. Dá para subir com `--max-nos`.

## Como rodar

```
python -I -X utf8 viabilidade/projetista/gerador.py <estudo.json> --unidades 6 --saida <pasta>
python -I -X utf8 viabilidade/projetista/test_gerador.py
python -I -X utf8 viabilidade/projetista/test_projetista.py
```

Opções: `--max-nos N`, `--revisoes K`. A linha de comando grava `revisao-01.json` etc. com `gravar` (atômico; recusa conteúdo diferente em arquivo já existente) e imprime resultado, unidades por pavimento, área privativa por unidade, resíduo e quantos achados `nao_verificado`. Saída 0 se gerou, 1 se inviável ou não encontrado.

## Sobra no git

`viabilidade/projetista/` aparece inteira como não rastreada neste galho (a fatia 1 também). Arquivos novos desta tarefa: `gerador.py`, `test_gerador.py`, `RELATORIO-4.md`. Nada commitado.
