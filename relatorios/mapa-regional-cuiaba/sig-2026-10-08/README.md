# Extração amostral do SIG Cuiabá — 08/10/2026

O usuário pediu para verificar o que pode ser extraído do site, com o [lote 1603515](https://app.smartgis.net.br/cuiaba/publico/navegador-geofinanceiro/lote/1603515) aberto. Foram inspecionadas as interfaces públicas e feitas consultas pequenas, anônimas, aos serviços observados na própria página. Esta amostra não é importação da cidade, prova de cobertura completa ou liberação de redistribuição do acervo.

## Resultado confirmado

1. A [API pública do lote](https://api.smartgis.net.br/cuiaba/prefeitura/api/PublicLote/Get/1603515) respondeu HTTP 200 com JSON, inscrição, geometria GeoJSON, quantidade de unidades e atributos cadastrais.
2. O serviço WMS usado pela página anuncia saída GeoJSON e efetivamente devolveu `FeatureCollection` em consultas de uma bbox pequena. Isso permite obter vetores por área, embora a exportação de mapa apresente cortes na borda.
3. O catálogo público contém nomes de camadas de lotes, edificações, quadras, bairros, loteamentos, hidrografia, áreas verdes, APP, zoneamento e outras versões. Os nomes no catálogo não provam qualidade, atualidade, acesso ou equivalência entre essas camadas.
4. A interface oferece busca de logradouros, documentos públicos e diversas imagens aéreas. A existência de opções de imagem não prova cobertura nem autorização de uso fora do portal.

## Arquivos extraídos

| Arquivo | Feições | Conteúdo |
|---|---:|---|
| [lote-1603515.geojson](lote-1603515.geojson) | 1 | Polígono retornado pela API individual e campos cadastrais públicos conhecidos. |
| [lotes-amostra.geojson](lotes-amostra.geojson) | 36 | Polígonos da camada `pmcba2020:476_2026_lotes`, exportados por WMS. |
| [edificacoes-amostra.geojson](edificacoes-amostra.geojson) | 9 | Contornos da camada `pmcba2020:476_2026_edificacoes`. Não fornecem, por si só, volume ou altura. |
| [quadras-amostra.geojson](quadras-amostra.geojson) | 8 | Polígonos da camada `pmcba2020:476_2025_quadras_prediais`. |
| [bairros-amostra.geojson](bairros-amostra.geojson) | 1 | Polígono da camada `pmcba2020:476_2026_bairros`. |
| [vias-amostra.geojson](vias-amostra.geojson) | 0 | A camada `pmcba2020:eixos_logradouros` respondeu GeoJSON vazio nesta bbox; isso não prova ausência de vias no entorno ou em outras camadas. |
| [camadas-wms.json](camadas-wms.json) | 108 entradas | Inventário de nomes/metadados relevantes de Cuiabá anunciados no catálogo WMS; há versões e temas diferentes, não 108 conjuntos validados para importação. |

As consultas WMS usaram bbox `[oeste, sul, leste, norte] = [-56.12465, -15.55615, -56.12355, -15.5553]`, `CRS:84`, largura/altura de 512 pixels e `FORMAT=application/json;type=geojson`. URLs de origem, nomes de camada e data de consulta estão nos arquivos. Os atributos genéricos não interpretados da resposta foram descartados; foram retidos geometria e identificadores. Não foram importados dados pessoais de proprietários ou informações tributárias.

A [prévia dos dados extraídos](previa-amostra.png) mostra lotes em cinza, edificações em azul e o lote individual da API em vermelho. O traço interrompido indica a bbox consultada; a imagem foi produzida com os vetores locais, sem fotografia aérea.

## Ficha cadastral do lote aberto

| Campo | Valor publicado |
|---|---|
| ID público | 1603515 |
| Inscrição do lote | 021140030160# |
| Área do terreno | 920,31 |
| Testada real | 16,40 |
| Área construída | 395,07 |
| Endereço | CAMOMILA (COND VILLA JARDIM) |
| Quadra / lote | 05 / 17 |
| Bairro | AREA DE EXP URB OESTE |
| CEP | 78042860 |
| Calçada / muro | C/CALCADA / C/MURO |
| Unidades | 1 |

A unidade visível na interface tem inscrição `02.1.14.003.0160.001`, código `567637`, tipo `PREDIAL`, terreno `CONSTRUIDO` e construção `RESIDENCIA`. O campo de data da construção está vazio. Os campos numéricos da API não explicitam unidade; os valores foram preservados como publicados. A interface informa última consolidação em `21/07/2026 20:25`; isso não identifica a data de cada geometria individual.

## Validação geométrica e limitações

- O polígono individual da API e os 36 lotes/9 edificações WMS são polígonos válidos na validação local.
- Quadras e bairro da amostra também têm polígonos válidos. Uma aresta do lote individual mede aproximadamente 16,403 m, compatível com a testada publicada de 16,40; a divergência de área permanece.
- A área geodésica do polígono individual é aproximadamente **501,71 m²**, enquanto a ficha informa **920,31** para a área do terreno. Se o campo cadastral estiver em m², a diferença é aproximadamente **45,48%**. Não alterar o cadastro para fazê-lo coincidir com o desenho; a causa ainda precisa ser investigada.
- Um polígono da amostra WMS coincide quase totalmente com o lote individual: aproximadamente 99,30% de interseção sobre união e área geodésica de 505,10 m². IDs da API cadastral e da camada WMS pertencem a espaços distintos; o vínculo não deve ser presumido apenas por igualdade numérica.
- Há segmentos de **23 dos 36 lotes** e de **4 das 9 edificações** exatamente no limite expandido do recorte. Isso é evidência de clipping na exportação WMS. O buffer do mapa não garante que uma entidade inteira seja devolvida.
- Não considerar a saída `GetMap` equivalente ao cadastro vetorial completo. A resolução/renderização também deve ser avaliada antes de usar as geometrias em medições ou geração de divisas.
- As camadas anunciam CRS diferentes. CRS:84 e EPSG:4326 exigem atenção à ordem dos eixos em WMS 1.3; EPSG:31981 aparece em imagens e outros temas. Cada importação deve validar coordenadas e metadados.
- O XML de `GetCapabilities` recebido não pôde ser interpretado diretamente como documento XML bem formado; o inventário foi obtido de fragmentos de camada. Os nomes de camadas usados no teste foram confirmados pelas respostas GeoJSON reais.

## Interface e documentos

Em `Tema de Referência`, a página ofereceu APP, áreas verdes, bairros, hierarquia viária, temático/lotes, zoneamento e zona de coleta de lixo. Em `Bairros e Loteamentos`, a seleção de temas também ofereceu loteamentos; a lista de arquivos estava vazia no estado inspecionado.

A aba [Arquivos](https://app.smartgis.net.br/cuiaba/publico/arquivos-gerais-financas) listou 17 documentos PDF, incluindo georreferenciamento cadastral, planta de valores, abairramento, logradouros, perímetro/massa urbana, hierarquia viária e regiões administrativas. Esta inspeção confirmou a lista e os botões de download; não baixou nem validou o conteúdo desses PDFs.

A lista de fundos incluiu fotos aéreas de 2026, 2024, 2023, 2021, 2012 e 2005; Pleiades de 2020/2014; WorldView de 2018/2015/2010; Google e OpenStreetMap. O nome/ano anunciado não comprova precisão, abrangência ou direitos de redistribuição.

## Consequência para o plano de Cuiabá

A disponibilidade técnica deixou de ser apenas uma hipótese: já há polígono cadastral individual e vetores de lotes, edificações, quadras e bairro por área. O próximo teste deve:

1. Encontrar/confirmar uma forma de obter **entidades completas**, com documentação e condições de reutilização da Prefeitura/Tecnomapas. WFS ou exportação direta ainda não foram confirmados nesta inspeção.
2. Conciliar geometrias, atributos e IDs, começando pela divergência de área do lote amostrado; fixar versões e distinguir cadastro de representação.
3. Validar cobertura e atualizar o catálogo de fontes antes de importar uma área maior.
4. Só depois comparar o gerador regional nos raios de 2,5 e 5 km.

Os [termos públicos do SmartGIS](https://app.smartgis.net.br/termos-de-uso/) não estabelecem uma licença aberta específica do acervo municipal e tratam de uso comercial do produto. A aplicabilidade ao portal público e a autorização de reutilização dos dados precisam ser confirmadas; o acesso técnico não resolve esse ponto. Esta inspeção não fez espelhamento em lote nem publicou os dados extraídos.
