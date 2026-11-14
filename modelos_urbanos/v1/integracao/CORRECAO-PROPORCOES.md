# Casas e terrenos — 09/09/2026

O encaixe anterior reduzia uniformemente os modelos ate 65% e usava apenas o
contorno da construcao antiga. Isso diminuia portas, janelas e pe-direito junto
com a casa. Uma casa de 62 m² de envelope podia cair para cerca de 26 m².

## Comportamento atual

- O build associa volumes residenciais sinteticos principais aos lotes disponiveis
  e testa os modelos da biblioteca em escala **1:1**. Escolhe entre os maiores
  compativeis e preserva a orientacao da frente. A altura nao e esticada.
- A geometria externa inteira, incluindo beirais e varandas, precisa caber no lote,
  com afastamento dos muros desenhados, vias, volumes existentes e novos encaixes.
- O resultado e embutido em `city.urbanLots`; a base original nao e modificada.
  O browser reutiliza as mesmas 60 geometrias e as mesmas instancias por modelo.
- Sem encaixe de lote verificado, casas/sobrados aceitam somente escala entre
  0,95 e 1,05 dentro do contorno existente. Onde nenhum modelo cabe, o volume
  anterior continua sendo desenhado. Predios mantem sua regra anterior.
- Lancamentos e modelos de unidades cadastradas ficam protegidos.

## Fontes e limites

O arquivo configurado `v7/dados/lotes_saocarlos_completo.geojson` nao esta presente.
A configuracao declara explicitamente `lotes_saocarlos.geojson` como fonte
alternativa para visualizacao. O encaixe exige correspondencia unica e verifica
os muros reais de `v7/dados/muros_segs.json`, evitando atravessar divisas quando
as fontes divergem. Isso nao confirma que todos esses lotes sao cadastrais reais.

Lotes profundos nao foram divididos em terrenos inventados de 10 x 25 m. A
correcao elimina miniaturizacao dos modelos; corrigir o parcelamento que produz
quintais desproporcionais exige revisar a fonte dos lotes e regenerar seus muros.
O cache contem 6.771 encaixes possiveis; o total efetivamente instanciado depende
dos quarteiroes carregados e das protecoes do renderizador.

## Validacao

- `testar.mjs`: escala, encaixe em terreno 10 x 25, rejeicao de miniaturizacao,
  diversidade, picking, streaming, transformacoes e unidades protegidas.
- `auditar_encaixes.py`: todos os 6.771 envelopes; zero invasoes de lotes, muros,
  volumes existentes ou outros novos encaixes. Envelope medio 84,86 m², que nao
  equivale a area util ou area construida cadastrada.
- `testar_ruas.mjs` e `testar_colisao_ruas.mjs`: preservam calcadas e protecao viaria.
- `testar_browser.py proporcoes` e `proporcoes-antes`: imagens do mesmo local;
  streaming, descarregamento, recarregamento deterministico e selecao passam.
- `testar_browser.py colisao`: zero casas, telhados ou muros sobre o asfalto no
  trecho verificado (398 instancias, 2.167 volumes antigos e 107 volumes rejeitados).
- O HTML comprimido ficou com aproximadamente 11,20 MB, antes 11,06 MB.

## Reproduzir

```powershell
$env:MAPA_V='v16-moveis'
python pipeline/montar.py sao-carlos
node modelos_urbanos/v1/integracao/testar.mjs
python modelos_urbanos/v1/integracao/auditar_encaixes.py
python modelos_urbanos/v1/integracao/testar_browser.py colisao
```

O primeiro build calcula os encaixes offline. Os seguintes validam um hash do
codigo, configuracao, cidade, biblioteca, lotes e muros e reutilizam o cache.
Nao houve publicacao nem alteracao na pasta `publicado`.
