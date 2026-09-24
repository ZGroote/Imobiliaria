# Verificação do T02 — dados de anúncio seguros

## O que estava aberto

Três entradas do cadastro chegavam à página sem tratamento:

1. `listings/house-sheet.js` montava o item da vitrine pública por `innerHTML` com
   `${h.titulo}` e `${h.bairro}` crus. É o único ponto do anúncio público montado por
   marcação — o resto da ficha já usava `textContent`, e a ficha da unidade cadastrada
   (`listings/sheet.js`) já passava tudo por `esc`.
2. `preencheAnuncio` fazia `$("hLink").href = house.url` sem olhar o esquema, então
   `javascript:` ou `data:` no cadastro viraria um link que executa ao clique.
3. `pipeline/montar.py` escrevia cada bloco de dado direto dentro de
   `<script type="application/json">`. Um `</script>` em título ou URL fecharia a tag
   e jogaria o resto do JSON para dentro do documento; `html.comprime`, que separa os
   blocos procurando `</script>`, cortaria no mesmo lugar errado.

## O que mudou

- `bloco_json` em `pipeline/montar.py`: um lugar só monta bloco de dado, aplica o
  recorte e troca `</` por `<\/`. Em JSON válido `<` só existe dentro de string e
  `<\/` volta a `</` no `JSON.parse` — o dado que o renderizador lê não muda. Os sete
  pontos que montavam a tag à mão passaram a chamá-lo (o `rec()` do recorte saiu junto,
  virou o mesmo caminho).
- `house-sheet.js` recebe `esc` e escapa título e bairro.
- `esc` subiu em `app.js`, de junto do POI para antes da criação da vitrine: a vitrine
  se monta na criação do módulo, e um `const` declarado depois estaria na zona morta.
  Todos os outros usos de `esc` já ficavam abaixo desse ponto.
- `sheet.js`: só `http(s)` vira `href`; sem URL utilizável o link some em vez de virar
  um botão que não leva a lugar nenhum.

## Medido

- `npm test`: 113 testes, zero falhas (eram 111; entraram o da vitrine hostil e o do
  link). `python -m unittest discover -s tests`: 41, zero falhas (eram 36; entraram os
  5 de `tests/test_bloco_json.py`).
- Testes novos: `tests/test_house_sheet.mjs` monta a vitrine com
  `<img src=x onerror=...>` e `</div><script>...` no cadastro e exige texto escapado;
  `tests/test_listing_sheet.mjs` exige `href` só para `http(s)`;
  `tests/test_bloco_json.py` exige que nenhum `</` sobre no bloco, que o JSON volte
  igual, que o recorte rode antes do escape e que nenhum bloco seja montado à mão
  fora de `bloco_json`.
- Montagem isolada de São Carlos (`--destino` em pasta temporária, 1,2 s, cache de
  encaixe válido): os 18 blocos de dado saíram **idênticos** aos da página anterior, e
  zero `<\/` foi emitido. O escape está inerte no cadastro de hoje; ele só age quando
  a sequência aparecer. A página cresceu 678 bytes, que são os comentários novos.
- Página servida por HTTP e aberta em navegador: 12 itens na vitrine, ficha do primeiro
  anúncio abre com `href` do anúncio original, zero erro de console.

## Limites

Nenhum anúncio do cadastro atual tem `</script>`, `<` no título ou URL fora de
`http(s)` — os sete têm URL `https://`. Portanto isto é prevenção medida em fixture,
não correção de defeito observado em produção. Não foi verificado o restante da
superfície de entrada (POI, busca, nomes de rua), que já passava por `esc`. Não houve
deploy nem mudança em dado de produção.
