# M1.1-C1 — cômodo composto (contrato 1.1.0)

Pedido do usuário em 01/10/2026: poder mesclar cômodos encostados parede com parede, para
criar cômodos que não são retângulos (sala em L, por exemplo). Decidido como marco próprio,
antes das sessões do M1.1-A. **Parte 1 (este PR):** contrato, validador, normalizador e prova
no consumidor 3D. **Parte 2** (depois do #83): o botão Mesclar na tela.

Base: `06bbcd6` (merge #81). Não mexe no capturador, no painel nem na API.

## Leitura 1.1.0

Igual à 1.0.0 mais um tipo de relação: `relations[].kind: "merged"`. As duas paredes opostas
pertencem ao mesmo cômodo, e o trecho comum não tem parede. Cada retângulo (agora uma
**parte**) continua com medidas, posição e paredes próprias, que são o que a pessoa digita.

- A 1.0.0 continua válida e com o mesmo significado. O validador escolhe o schema pela
  versão declarada.
- Regras novas, que só existem na 1.1.0:
  - partes ligadas por `merged` formam um cômodo (grupo), e todas têm o mesmo nome
    (`MERGED_NAME_MISMATCH`);
  - entre partes do mesmo grupo não há parede: todo par de paredes adjacentes entre elas é
    `merged` (`MERGED_INTERNAL_WALL`);
  - o grupo forma um contorno único, sem vazio interno e sem encostar em si mesmo num ponto
    só (`MERGED_SHAPE`);
  - nenhuma abertura no trecho mesclado: abertura com par `merged` é `INVALID_OPENING`.
- Conexão, sobreposição e relações completas seguem como na 1.0.0 (`merged` também conecta).

## Planta derivada 1.1.0 (M1-A)

- Leitura 1.0.0 → derivada 1.0.0 **idêntica byte a byte**: os hashes de plantas já salvas não
  mudam.
- Leitura 1.1.0 → derivada 1.1.0, normalizador `nominal-floor-plan@1.1.0`, com a regra a
  mais `merge-parts-to-polygon@1`:
  - um cômodo por grupo; grupo de uma parte sai igual ao 1.0.0 (com `walls`);
  - grupo de duas ou mais partes: `id` da primeira parte na ordem da leitura, `nome` comum,
    `poly` com o contorno da união (anti-horário, começando no vértice de menor y e depois
    menor x, sem pontos colineares) e `parts: [{id, walls, provenance}]` no lugar de `walls` e
    `provenance` (a procedência fica em cada parte);
  - relações preservadas com o `kind`; aberturas calculadas como antes, na parede da parte.
- O contorno é calculado em mm inteiros, sem ponto flutuante, e só então convertido a metros.
  Validador e normalizador usam a mesma função.

## Consumidor (M1-F)

O `FloorPlan` aceita qualquer polígono por cômodo. Os portões do M1-F (grade de 5 cm, vão
mínimo, encaixe no prédio) valem para as partes e não mudam. A prova: uma leitura 1.1.0 com
sala em L passa pelo `e2e_leitura`, é conferida, e nenhuma parede do consumidor fica no trecho
mesclado.

## Fora deste PR

A tela (parte 2) e "separar" um cômodo mesclado. O editor do painel continua produzindo
1.0.0 e recusa carregar uma 1.1.0 (política de round-trip do M1-D, sem perder dado). A API do
M1-D passa a aceitar 1.1.0 porque usa o mesmo validador.
