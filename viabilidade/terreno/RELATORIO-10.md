# Terreno, tarefa 10: REVISAO-6, Achado 1 e Observação 3

## (a) Leitura dos Anexos 05/06/07 sem nada achado

Quando os três mapas não acham nada, `AreasEspeciais.ler` agora devolve um registro, e não mais `[]`. O registro tem `tipo`/`incidencia` `nao_verificada`, `anexo` `05/06/07` e o nome "Leitura automática dos Anexos 05/06/07: nenhuma área especial encontrada — não conferida".

O motor **não precisou mudar**: os caminhos que já existiam passam a disparar sozinhos. No lote 25300, `--zona auto`, isso aparece em quatro lugares:
- no resumo: "Áreas especiais não verificadas: Anexo 05/06/07 (o resultado pode passar do que o terreno permite; conferir)";
- em cada opção, o alerta `ÁREA ESPECIAL sem altura numérica, NÃO aplicada`, com esse nome;
- na incerteza "Área especial nao_verificada sem número de altura";
- no relatório, que mostra o semáforo de altura amarelo e a caixa de áreas especiais.

No domínio do motor, `area_especial` passa a valer `True`, e esse valor já consta no conjunto testado. Os 7 pilotos ficaram byte a byte iguais. Mudaram só os extras 19 e 75355, que antes saíam `[]`.

## (b) Os 16 recusados "sem frente para rua" (amostra da semente 20261115)

A causa é **a base, não o lote**. A malha de asfalto (`sao-carlos/dados/street_tris.json`, gerada por `pipeline/ruas.py`) tem buracos grandes: em 24% dos lotes da base não há asfalto a 30 m. No desenho, os corredores entre as quadras aparecem vazios. Do outro lado deles há lote a 11,6 m, que é a largura típica da rua, e asfalto nenhum.

Como os 16 se dividem:

| Caso | Lotes |
|---|---|
| Lado picotado em arestas menores que 8 m, encostado no asfalto | 94130 |
| Lado livre a 9–12 m do asfalto, sem lote no meio | 21164, 23249, 59281, 82415 |
| Lado paralelo à rua, mas com o asfalto a 12,1 m (passa do limite) | 86650 |
| Asfalto a 5,8–11 m, porém em diagonal ou atrás de outro lote | 92058, 108586, 46087 |
| Nenhum asfalto a menos de 29 m (de 29 a 637 m) | 39431, 3321, 62350, 91412, 102159, 104833, 97132 |

### A regra nova

Fica em `gerar_lotes.avaliar(..., ampliar=True)` e só o `novo_lote` a liga. Ela só roda quando a regra de hoje não acha nenhuma aresta, por isso os pilotos ficam intocados.

1. **Juntar arestas contíguas** que não desviam mais de 10° da primeira. A corda resultante precisa ter pelo menos 8 m e ficar a até 6 m do asfalto.
2. **Aceitar asfalto a até 12 m**, que é a largura do corredor, desde que o caminho até o asfalto não corte o próprio lote nem outro lote. Isso exclui o miolo e o fundo de quadra. Nesse caso o lote sai com `"AVISO: frente presumida..."` nas observações, e a frente fica marcada com `regra` em `qualidade.frentes`.

A recusa agora diz a que distância está o asfalto mais próximo e avisa que a malha tem buracos.

### Resultado

- **Na amostra de 20:** passavam 4 e agora passam 9. São 94130 juntando arestas, 21164, 23249, 59281 e 82415 com o aviso, além dos 4 que já passavam.
- **Na varredura de 551 lotes (passo 200):** a regra de hoje aprova 48 lotes e recusa 479 por frente; outros 24 lotes caem por outro motivo e não contam aqui. A regra nova recupera 147 desses 479: 13 juntando arestas e 134 com o aviso. Sobram 332, e 237 deles não têm asfalto a menos de 12 m.
- **O motor roda com a frente-corda:** estudei 94130 e 59281 sem erro.

## O que fica para outras áreas (não mexi)

- **Corrigir a malha de ruas:** em vez do triângulo do asfalto, usar o vão entre quadras. Provavelmente o `triangulate` mais o filtro por centroide em `pipeline/ruas.py` descartam pedaços, mas eu não verifiquei. Isso fecharia os 237.
- **Motor:** se quiserem que o aviso de frente presumida vire incerteza no estudo, o motor precisaria ler `qualidade.frentes[0].regra`. Hoje ele só aparece em `lote.observacoes`.

## Testes

Todos passaram:
- `novo_lote.py --testar`, com o teste novo de cadeias de arestas e de 94130/23249;
- `gerar_lotes.py --testar`;
- `testar_pilotos.py`;
- a comparação antes/depois: os 7 pilotos e os extras byte a byte iguais.

Não houve commit.
