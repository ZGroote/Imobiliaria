# Etapa 2 — acessos corrigidos (10/09/2026)

O gerador deixou de criar fileiras internas usando uma divisa de lote como se fosse
rua. Quadras comuns continuam parceladas até o meio; glebas largas conservam espaço
interno quando não existe rua ou viela confirmada. Sobras estreitas ainda são
absorvidas pelo lote vizinho.

A reconciliação também verifica cada lote gerado contra a mesma fita de vias
dirigíveis usada pelo QA. O filtro vale para `sintetico`, `planta_refeita` e
`planta_complemento`; lotes de planta confirmada ficam preservados porque condomínios
podem ter circulação interna ausente da malha viária.

## Resultado regenerado

- 110.089 lotes: 18.265 de planta, 9.698 complementos, 9.789 de quadras refeitas e
  72.337 sintéticos.
- 74.187 lotes com prova de ocupação, 4.831 km de muros e 74.140 portões.
- 89.895 volumes no `city.json` e 50.277 encaixes detalhados em escala 1:1.
- HTML comprimido: 11,37 MB; crescimento aproximado de 1,5% sobre a base de
  11.198.085 bytes, dentro do orçamento proposto de 5%.

## Provas

`lotes_sinteticos.py --demo` cobre quadra comum, gleba larga e esquina irregular:
zero lote sem testada, zero sobreposição e núcleo preservado na gleba.

`padrao/rodar_qa.py sao-carlos --rapido` passou com zero reprovações, inclusive:

- lote sintético sem acesso à rua: 0;
- lote sobre a rua: 0,00%;
- quadra de planta fora do eixo: 0;
- muro sobre a rua: 0,14%;
- casa sobre a rua: 0,56% (limite existente: 1%).

Os testes `testar.mjs`, `testar_ruas.mjs` e `testar_colisao_ruas.mjs` passaram. A
auditoria dos 50.277 encaixes encontrou zero invasão de lote, muro, prédio existente
ou outro modelo.

A medição visual e o p95 de quadro dos três trechos ainda precisam ser repetidos com
as câmeras fixas. Nada foi publicado.

## Câmeras fixas após a correção

As três capturas foram repetidas com a marca `acessos`. A / B / C carregaram,
respectivamente, 9.371 / 9.513 / 9.982 modelos detalhados. O custo mínimo medido pelo
rasterizador headless foi 3,43 / 3,77 / 2,29 ms por quadro. Essas medidas substituem
o registro anterior da etapa 2, mas ainda não equivalem ao p95 em GPU real.

No trecho A, a gleba sem via interna agora mostra um espaço central contínuo, sem
segunda fileira de lotes cegos. Nos trechos B e C, todas as parcelas geradas mantêm
contato com a fita viária; a esquina irregular também permanece sem sobreposição.
