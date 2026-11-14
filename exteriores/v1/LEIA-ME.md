# Biblioteca de muros e quintais — 65 modelos

## Ampliação de detalhes e celular

Piso e representação aérea dos objetos acompanham `STREAM_R + STREAM_HYST`
das casas: 2.120 m na configuração atual, com margem de um tile nas bordas.
`atlas_distante.py` renderiza os 160 componentes no Blender para um atlas
transparente de 1.024 × 640. Cada objeto distante custa dois triângulos e todos
compartilham uma chamada de desenho. O sprite é ocultado quando seu lote recebe
os modelos completos. Modelos completos: 240 m no celular e 360 m no desktop,
até 840/1.680 painéis e 120/240 quintais. Muros distantes usam a cor do mesmo
modelo da biblioteca sobre sua geometria simplificada existente.
Os dados decodificados e as alturas de cada lote são guardados em WeakMap e
liberados junto com o tile. Buffers de piso são reutilizados; chegadas de tiles
atualizam os modelos próximos a cada 450 ms. Os dados são agregados em regiões
de 640 m; o piso e o atlas completos são remontados ao esvaziar a fila de downloads,
ou quando relevo/região mudam, sem reconstrução por resposta. A escrita é direta
nos buffers Float32 reutilizados, sem arrays JS gigantes intermediários. O cache acompanha a área
ativa das casas e descarta regiões externas; downloads limitados a 4 no celular
e 6 no desktop, priorizando o centro. Permanecem instanciamento e retry de rede.
Os testes verificam cobertura aérea, limites, recarga, relevo e recuperação 503.

## Correção: quintal é a área livre do lote

A integração atual não usa mais as 40 placas retangulares da primeira biblioteca.
`terrenos.py` calcula cada polígono cadastral menos as casas substitutas,
construções originais sem substituição, vias e empreendimentos protegidos. O piso cobre essa área
inteira, inclusive corredores laterais e recortes irregulares. A triangulação
é conferida contra a área livre, com tolerância de quantização de 1 mm.

`componentes.py` separa no Blender os objetos das composições, sem os pisos nem
as bordas das placas. `componentes_quintais.blend` contém os 160 componentes
editáveis dos 40 estilos. Os objetos são distribuídos na área livre com 0,5 m
de afastamento e 0,65 m entre envelopes; os móveis mantêm escala real. Piscinas
retangulares em áreas maiores admitem 3,2 × 5,5 m de envelope.

`terrenos.json` e `validacao-terrenos.json` registram as áreas e os encaixes
atuais. `compactar_terrenos.py` guarda coordenadas em buffers binários sem perder
os milímetros. `dividir_terrenos.py` divide os dados em regiões de 160 m,
publicadas como arquivos gzip imutáveis. O navegador baixa apenas as regiões
próximas, mantendo no máximo 64 em cache. O piso de todos os lotes ativos é
desenhado em uma única malha; os dados municipais completos não entram no HTML.

Muros detalhados não têm mais o corte pela distância da câmera de 650 m.
A seleção espacial usa 100 m no celular e 150 m no desktop, mantendo os limites
de 210/420 painéis e 40/80 quintais com objetos. O piso se estende mais 100 m
para manter a continuidade dos quintais. Entrar no interior restaura as faixas
simples dos muros; apenas afastar a câmera preserva os detalhes.

Para reproduzir a correção, executar `componentes.py` no Blender, depois
`terrenos.py`, `compactar_terrenos.py`, `dividir_terrenos.py`, montar o mapa, executar `preparar.py`,
`testar.cjs` e `catalogo_terrenos.py`. O teste agora verifica a persistência dos
muros a 1.000 m, os pisos completos e a distribuição dos objetos.

As seções abaixo documentam a biblioteca e o encaixe inicial. Os arquivos
`encaixes.json`, `validacao-espacial-final.json` e as miniaturas antigas são
históricos; os retângulos desses encaixes não são mais renderizados.

Criada no Blender 5.2.1 para o entorno ilustrativo do mapa de São Carlos.
25 construções de muro e 40 composições de quintal, com geometrias distintas.
Não representam amenidades verificadas dos anúncios.

## Arquivos

- `biblioteca_65.blend`: biblioteca editável, coleções Muros e Quintais,
  65 assets identificados e com miniaturas no Asset Browser.
- `glb/`: 65 modelos individuais, materiais e cores por vértice incluídos.
- `catalogo.html`: catálogo visual com links para GLB e Blender.
- `previas/` e folhas JPG: imagens renderizadas de todos os modelos.
- `catalogo.json`: nomes, dimensões, contagem de triângulos e hashes geométricos.
- `mapa-exteriores.json`: malhas compactadas para uso direto no renderizador.
- `encaixes.json`: 11.657 quintais posicionados em escala real na cidade.
- `build.json`: nome e hash exatos do HTML preparado para Hosting.
- `publicacao.json`: verificação do arquivo servido após deploy, quando concluído.

## Escala e integração

Metros, Blender Z para cima; GLB e mapa Y para cima. Quintais com origem no centro
horizontal do envelope completo, incluindo vegetação, e chão na altura zero.
Muros são painéis nominais de 3,2 m, com capas e perfis incluídos nas dimensões.
Repetição ao longo da divisa; somente o último ajuste de comprimento é distribuído
entre os módulos. O relevo usa as cotas das extremidades.

Os quintais conservam escala 1:1. O encaixe considera limites do lote, construções
originais, modelos de casas substitutos, vias, divisas e outros quintais.
Uma zona conservadora protege os quatro empreendimentos cadastrados manualmente.
Todos os 40 tipos estão distribuídos nos encaixes aceitos.

`renderizador-v16-moveis/exterior-details.js` faz instanciamento por modelo.
Detalhes aparecem com câmera a menos de 650 m do alvo; no celular, raio de seleção
140 m, até 210 painéis e 40 quintais. Desktop: 210 m, 420 painéis e 80 quintais.
As faixas simples dos muros só são escondidas quando o trecho detalhado está pronto.
Elas voltam ao afastar a câmera ou entrar em uma visita. `?exteriores=0` permite
comparar com o mapa sem a nova biblioteca. O registro geométrico base não é alterado.

## Validação

- 65 GLBs reabertos, com eixos, escala, cores, normais e triângulos conferidos.
- 65 hashes geométricos únicos; zero triângulos degenerados ou coordenadas inválidas.
- 72.678 triângulos na biblioteca inteira; maior modelo: 2.772 triângulos.
- `validacao-espacial-final.json`: todos os 11.657 envelopes conferidos em uma
  passagem independente; zero colisões com casas, muros, ruas e outros quintais;
  todos dentro de um lote.
- `teste-browser.json`: Chrome isolado, desktop e celular; conteúdo visível,
  limites de instâncias, troca de LOD, restauração dos muros, relevo finito,
  descarregamento e recarregamento estável; zero erros de página/console.
- Fluxos de busca, ficha, arredores, visita e móveis: teste em
  `relatorios/mobile/captura.cjs`, com seis larguras e fluxo completo a 390 × 844.
- Capturas `mapa-desktop.png` e `mapa-mobile.png` mostram os modelos integrados.

Não é benchmark de hardware físico nem teste Safari. O mapa completo continua
dependendo da GPU; o limite de detalhes impede crescimento ilimitado das instâncias.

## Reproduzir

1. Blender em background: `--factory-startup --python exteriores/v1/gerar.py`.
2. `python exteriores/v1/encaixar.py`.
3. `python exteriores/v1/proteger_cadastros.py`.
4. `python exteriores/v1/validar_encaixes.py` e `node exteriores/v1/validar_glb.mjs`.
5. `$env:MAPA_V='v16-moveis'; python pipeline/montar.py`.
6. `python exteriores/v1/preparar.py`.
7. Servir a raiz em `127.0.0.1:8765`; executar `node exteriores/v1/testar.cjs`
   e `node relatorios/mobile/captura.cjs`.
8. Após autorização: Firebase CLI `deploy --only hosting --project imobilaria-deccb`.
9. `node exteriores/v1/verificar_publicacao.cjs`; testar também com `MAPA_LIVE=1`.

## Retorno à versão anterior

`index-producao-anterior.html` preserva o índice que estava no ar. Desde
2026-09-11 os HTMLs e os conjuntos de tiles antigos saíram da pasta de
publicação para `_arquivo/publicado-antigos-2026-09-11/` (286 MB -> 30 MB no
deploy). Para rollback, devolver o HTML desejado a `v16-moveis/publicado/mapa/`,
copiar o índice antigo para `v16-moveis/publicado/index.html` e executar novo
deploy somente de Hosting. Os `redirects` do `firebase.json` já mandam os nomes
antigos para o atual, então links velhos continuam abrindo o mapa.
Não há migração nem alteração em Firestore, Storage ou dados de clientes.
