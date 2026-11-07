# Vistas da Quinze (Grupo Plano, São Carlos): quarto empreendimento no molde do Laranjeiras

Branch `feat/vistas-da-quinze`, saída de `feat/containers-mooca` (que já tem o Laranjeiras inteiro e o
desempenho do Codex). Meta do usuário (07/11): "o santo graal da qualidade e otimização", ou seja, juntar
tudo o que cada empreendimento anterior aprendeu e não deixar nenhum desses ganhos de fora.

## Fontes

- `plantas_fornecidas/vistas-da-quinze/anexos/`: as 10 imagens coladas na conversa do Codex de 06/11
  (6 plantas T01..T06 e 4 da implantação). Saem do Temp e ficam aqui.
- `plantas_fornecidas/vistas-da-quinze/site/`: o que está público em grupoplano.eng.br (6 plantas, 2
  implantações e 16 renders, até 4000 × 5000 px). Os renders são a referência de aparência.
- `experimentos/vistas-da-quinze/` (Codex, sem commit): `plantas.json` (paredes, vãos e zonas das 6
  plantas, em px) e `gerar.py` (IFC). O traçado de lá é o ponto de partida, não a verdade.

Dados que temos:
- Endereço: R. Major Manoel Antônio de Mattos, 1850, alto da Vila Nery, junto da XV de Novembro.
  O pino do Google no site oficial fica em −22,01235, −47,88188. **É São Carlos**, a cidade do mapa 3D.
- Áreas: 44,79 m² no 2 dormitórios com suíte sem terraço (anúncio); 61,59 a 76,16 m² nos com terraço
  (Contato Imóveis). O resto vem das imagens.
- **É uma torre em L de 20 andares**, não um prédio baixo (o `Implantacao.ifc` do Codex está errado nisso).
  A perspectiva colorida dos anexos (`anexos/c5be99a0…png`) numera as unidades: os finais vão de 01 a 18
  (3º andar: 301..318, 20º: 2001..2014), e as duas alas sobem em degraus a partir do 9º (lado sul) e do 15º
  (lado leste). As cores marcam a tipologia de cada unidade: vermelho é o tipo sem terraço, e verde, roxo,
  laranja e amarelo são as com terraço nos degraus. Esse desenho é o cadastro unidade → tipologia.
- Ruas: XV de Novembro ao norte e Major Manoel Antônio de Mattos a oeste (esquina no canto NO). As fotos do
  drone (`anexos/5e43…`, `anexos/7d1a…`) mostram a obra com a estrutura pronta e a vizinhança.
- Embasamento com lazer (piscina, spa, kids, gourmet, academia) na laje sobre a garagem. Fachada branca, guarda-corpo de réguas horizontais brancas, madeira no rodapé dos
  terraços. Obra em 81,5% (maio/2026).

## Ordem (a mesma do Laranjeiras e do Mooca)

| # | Etapa | O que sai | Ganhos que entram aqui |
|---|---|---|---|
| 1 | Plantas | `interiores/T0N/planta.json` → construtor do painel, conferência PASS | escala pela área anunciada; móveis do catálogo; `h` dos móveis; piso pelo campo `piso` |
| 2 | Implantação | `implantacao/` em metros + lat/lon, conferência sobre a imagem | rumo pela rua no OSM; tipologia por posição no L |
| 3 | Modelo externo | `modelo/modelar_*.py` (Blender) → `modelo.json` | fachada pelas plantas; guarda-corpo de réguas; degraus; lazer; árvores de folha; texturas CC0 |
| 4 | Luz do exterior + cena | atlas RGBM + `scene.json.gz` | scripts do LIV com `--model/--out`, OptiX |
| 5 | Cadastro + página | `assets/unidades.json`, `site/maquete-*.html` | seletor por torre, finais, horário solar com a lat/lon real |
| 6 | Interiores | pacote `native-factories` | OLHAR/REBOCO, `finishIds`, corredor atrás da porta, plantas espelhadas |
| 7 | Luz gravada por hora | 29 chaves por tipologia (~30 min cada) | sondas abaixo do forro, corte do RGBM, folha da porta pela dobradiça, navegador fechado |
| 8 | Mapa | mapa 2D do LIV com o prédio em 3D | POIs do OSM/Overture |
| 9 | Peso e celular | pacote minificado, medido com brotli | PageSpeed, prévia leve, textura adiada |
| 10 | Archicad | o mesmo `planta.json` vira IFC e entra no Archicad pela conexão (Tapir), sem o seletor de arquivo | ver a conversa do Codex de 06/11 |

## 1. Plantas (feito)

```
node experimentos/vistas-da-quinze-2026-11-07/interiores/construir.ts T01   # ... T06
```

`construir.ts` e `exportar.py` são os do Mooca, que suportam `h` nos móveis e polígono. As 6 saem `PASS`
(`T0N/conferencia.jpg`). As imagens são pequenas (~45 px/m), então os eixos ficam a ±5 cm.

| Tipo | O que é | Área (m²) | Cômodos / portas / janelas / móveis |
|---|---|---|---|
| T01 | 2 dorm. (suíte), sem terraço | 44,79 (anúncio, calibra a escala) | 5 / 5 / 3 / 24 |
| T02 | 1 dorm., sem terraço | 31,5 | 3 / 3 / 2 / 19 |
| T03 | 2 dorm. (suíte com closet), terraço lateral | 62,3 (anúncio: 61,59) | 6 / 6 / 5 / 27 |
| T04 | 2 dorm. + escritório, terraço lateral | 77,6 (maior anunciada: 76,16) | 7 / 7 / 6 / 35 |
| T05 | 2 dorm. (suíte com closet), terraço lateral | 62,4 | 6 / 6 / 5 / 28 |
| T06 | o T01 com terraço na frente | 44,79 + terraço | 6 / 6 / 4 / 28 |

- **Escala:** os 44,79 m² do anúncio são o T01 sem terraço. A mesma escala (21,95 mm/px) dá 62,3 m² no
  T03 com terraço e 77,6 m² no T04, o que confere com a faixa de 61,59 a 76,16 m² anunciada. Então os
  anúncios contam o terraço junto.
- **T06** vem em outra escala (o mesmo corpo é 9-10% maior na imagem) e é calibrado como T01 + terraço.
- O id do construtor tem que ser minúsculo (`vistas-da-quinze-t01`): com `T` maiúsculo o validador M1-0
  recusa com `INVALID_STRUCTURE /id`.
- **Rotação dos móveis no construtor:** 0 = fundo para cima na imagem, 90 = fundo à esquerda, 180 = embaixo,
  270 = à direita (a cabeceira da cama é o "fundo").
- **Faltam no catálogo:** banheira de hidromassagem, churrasqueira, vasos de planta e pufe (virou poltrona).
  Entram na etapa dos interiores.

Commit ao fim de cada etapa. Nada publicado sem o OK do usuário (e, sendo um lançamento real de outra
incorporadora, sem o OK do cliente).
