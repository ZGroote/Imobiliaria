# Relevo de São Carlos: fontes e limites

Consulta às fontes: **2026-11-14**. Pesquisa em páginas dos produtores e distribuidores oficiais. A análise dos arquivos locais e a comprovação do recorte efetivamente baixado devem ser lidas junto deste inventário.

## Resultado local entregue

O download público e a aplicação nos **sete lotes-piloto foram concluídos em 2026-11-14**. Foram lidas janelas de quatro COGs AWS (`S23/W049`, `S23/W048`, `S22/W049`, `S22/W048`), sem login. Só o recorte da área urbana de trabalho foi gravado; ele não representa o limite municipal inteiro. A tarefa 2 reutilizou esse recorte local para os dois novos remembramentos, sem novo download e sem alterar os valores dos cinco originais.

- Raster: `dados/copernicus-glo30-sao-carlos.tif`, **1.155 colunas × 682 linhas**, 1.904.215 bytes; 787.710 células válidas, sem NoData ou valores não finitos.
- Referência: horizontal EPSG:4326, vertical EGM2008, metros. Grade original de **1 segundo de arco** nos dois eixos, nominalmente 30 m; a distância em metros varia com a latitude. Espelho AWS da versão 2021, conforme o [registro do distribuidor](https://registry.opendata.aws/copernicus-dem/).
- Caixa solicitada `[oeste, sul, leste, norte]`: `[-48.1211, -22.1044, -47.8006, -21.9154]`. Caixa gravada, expandida até as bordas da grade original: `[-48.12125, -22.104583333333334, -47.80041666666667, -21.91513888888889]`.
- Intervalo do recorte: **504,05–947,69 m**. SHA-256: `1d4e386afa3ef3770b6e637a83d6132e5ef9856b68ab366076a5db6c9dc00173`.
- Proveniência em `dados/copernicus-glo30-sao-carlos.json`: URLs, ETags, datas de modificação remotas, dimensões, transformações afins, resolução, nodata, versão, licença e atribuição. As datas remotas de maio de 2022 são datas dos objetos, não datas do levantamento.

**Método:** cada vértice e o centroide do lote em EPSG:31983 são convertidos para EPSG:4326 e recebem interpolação bilinear dos centros dos pixels. `cota_min_m` e `cota_max_m` são extremos dessas amostras, não extremos comprovados do terreno inteiro. A declividade é `100 × sqrt(dx² + dy²)`, com diferenças centrais entre amostras a ±30 m em cada eixo UTM do centroide (base de 60 m). Assim, ela descreve o MDS no entorno e pode diferir da razão entre o desnível do lote e sua largura. Valores arredondados a 0,1 não significam precisão de 0,1 m.

| Lote | Cota mínima amostrada (m) | Cota máxima amostrada (m) | Declividade do MDS (%) | Células distintas usadas |
|---|---:|---:|---:|---:|
| SC-completo-30516 | 827,5 | 833,5 | 9,5 | 13 |
| SC-completo-37607 | 820,4 | 823,9 | 14,2 | 19 |
| SC-completo-22426 | 793,9 | 797,6 | 7,0 | 12 |
| SC-completo-22421 | 793,0 | 796,9 | 9,3 | 12 |
| SC-completo-25297 | 842,6 | 844,8 | 6,5 | 13 |
| SC-completo-q1382-11984-11988 | 855,4 | 857,3 | 2,5 | 13 |
| SC-completo-remembramento-75352-75354 | 865,2 | 867,7 | 6,2 | 15 |

A contagem inclui as células do entorno usadas na declividade; não representa medições estatisticamente independentes nem pixels integralmente contidos no lote. Os resultados e a contagem estão em `dados/relevo-pilotos.json`. O objeto `relevo` segue o contrato; as ressalvas foram acrescentadas em `observacoes`. A comparação antes/depois confirmou que nenhum outro campo dos lotes foi alterado pela aplicação.

**Correção verificada:** o primeiro mosaico, alinhado a múltiplos inteiros da resolução, apresentou NoData e foi rejeitado. Os COGs têm suas bordas deslocadas em meio pixel em relação aos graus inteiros; o script agora alinha o recorte à transformação da fonte. O [readme AWS](https://copernicus-dem-30m.s3.amazonaws.com/readme.html) explica o registro por pontos e a remoção da última linha/coluna das fontes. O recorte corrigido preservou a grade e passou integralmente na validação, sem inventar valores para lacunas.

Reprodução, usando dependências GIS já instaladas:

```text
python -I viabilidade/terreno/preparar_relevo.py --testar
python -I viabilidade/terreno/preparar_relevo.py --baixar
python -I viabilidade/terreno/preparar_relevo.py
```

`--testar` verifica alinhamento, interpolação, rejeição de bordas/NoData e plano sintético com declividade conhecida de 5%. `--baixar` valida e grava o recorte, depois aplica aos lotes; a execução sem opção reaplica localmente e confere o SHA-256 antes de usar o raster. Os três modos foram executados com sucesso. O acesso inicial no ambiente restrito falhou; o download foi concluído com a execução de rede autorizada.

## Auditoria de `sao-carlos/relevo_wide.json`

O arquivo contém **6.400 alturas relativas**, grade **80 × 80** em uma extensão de **19.000 × 19.000 m**, com passo de **240,5063 m**. O centro configurado é longitude -47,8908 e latitude -22,01725. O código `pipeline/fontes/relevo.py` documenta coleta Open-Elevation, mediana 3 × 3, ordem por linhas de norte para sul e subtração da amostra de índices `i=39,j=39` (índice linear 3159, valor zero confirmado). Como a grade tem tamanho par, essa amostra fica próxima do centro, não exatamente nele.

O intervalo observado no arquivo atual é **-181 a +125 m** em relação à amostra zerada. Não é altitude absoluta. O arquivo não preserva a altitude da referência, a data de aquisição, a resolução nativa da fonte consultada nem seu datum vertical; esses campos permanecem não conferidos. O passo de 240,5 m é o da amostragem do projeto, não a precisão do dado original. A suavização também elimina detalhe. Auditoria reproduzível em `dados/relevo-local-auditoria.json`, com hash e contagens; o arquivo original foi apenas lido.

## Escolha para o protótipo

O **Copernicus GLO-30** é a primeira opção para substituir a amostragem grosseira de `sao-carlos/relevo_wide.json`: disponibiliza valores altimétricos em grade de aproximadamente 30 m, documentação de precisão e acesso público sem conta pelo espelho AWS. A melhoria é de detalhe espacial e rastreabilidade; a precisão de cada lote continua **não conferida em campo**. [Produto Copernicus](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [acesso AWS](https://registry.opendata.aws/copernicus-dem/).

MDS/DSM representa a superfície, incluindo árvores e construções. MDT/DTM procura representar o chão. Copernicus e AW3D30 são MDS; FABDEM estima a remoção de árvores e prédios. Um pixel de cerca de 30 × 30 m tem aproximadamente 900 m²: muitos lotes terão poucos valores independentes. Interpolar mais pontos não acrescenta medição. Assim, cotas e declividades calculadas servem à triagem do entorno; não comprovam desnível entre divisas, altura de arrimo, volume de corte/aterro ou cota de acesso. [Definição Copernicus](https://documentation.dataspace.copernicus.eu/Data/Others/CCM.html), [descrição FABDEM](https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/readme.txt).

## Comparação das fontes

| Fonte | Tipo e resolução/escala | Precisão vertical documentada | Cobertura de São Carlos | Acesso e licença |
|---|---|---|---|---|
| Copernicus GLO-30 | MDS; 1 segundo de arco, nominal 30 m | Especificação absoluta < 4 m, erro linear a 90%. Não é RMSE nem validação do lote | Recorte urbano baixado e validado, incluindo os sete lotes | AWS sem conta; portal CDSE requer cadastro/CCM. Licença gratuita específica, com atribuição |
| ALOS AW3D30/JAXA | MDS óptico; 1 segundo de arco, nominal 30 m | **Meta** de 5 m RMS; não garantia pontual | Global declarada; tiles de São Carlos não baixados nesta pesquisa | Portal de download pede cadastro. Gratuito; crédito JAXA; condições atuais pedem notificação prévia para uso comercial |
| FABDEM V1-2 | Terreno estimado por remoção de vieses de árvores/prédios do Copernicus; 1 segundo de arco | Artigo original relata erro absoluto médio de 1,12 m em áreas construídas e 2,88 m em florestas, na amostra do estudo; não são RMSE local nem garantia da V1-2 | Pacote de 10° que contém São Carlos consta no índice; pixels locais não inspecionados | HTTPS sem login; **CC BY-NC-SA 4.0**, não adotar para produto comercial sem licença separada |
| IBGE, produto MDE | A definição do IBGE inclui vegetação/edificações; coleções em escalas 1:25.000 e 1:50.000 | Não conferida para São Carlos | Existe coleção `spmggo50`, mas o nome não comprova cobertura do município; índice ainda precisa de interseção com os lotes | Diretório público, TIF/ASCII. Licença específica de redistribuição não conferida |
| SMA/CPLA/FUNCATE, MDE estadual 2013 | Grade 30 m derivada de curvas de cartas 1:50.000; substituições locais por TOPODATA | A ficha consultada não declara RMSE/LE90; **não conferida** | Ficha declara todo o Estado; raster de São Carlos não inspecionado | Link público de TIF compactado; licença aberta específica não encontrada; ficha fornece créditos |
| IGC, cartografia topográfica | Cartas 1:10.000 e outras escalas. Catálogo menciona coleção “São Carlos / Ribeirão Preto”, 1:5.000, 1992 | Não conferida para as folhas de interesse | Menção no catálogo é pista; disponibilidade e abrangência de cada folha precisam ser confirmadas | Consulta ao índice/IGC; catálogo indica arquivo por e-mail e tabela de preços. Não classificar como download gratuito confirmado |
| Prefeitura/SigaSC, curvas | Manual documenta tema Topografia; resolução e equidistância não conferidas | Não conferida | Sistema municipal documentado; arquivo vetorial aberto de curvas não localizado | Manual público; download dos dados, necessidade de login e licença não confirmados |
| LiDAR municipal | Contrato localizado para Sítio do Mello e Capão das Antas; densidade e MDT/MDS finais não conferidos | Não conferida | Dois locais nomeados; não comprova cobertura da cidade, dos lotes-piloto nem entrega dos produtos | Não localizado arquivo público nem licença; requer localizar os produtos ou solicitar à prefeitura |

As fontes e as condições de cada linha estão detalhadas abaixo. Não comparar diretamente LE90, RMS/RMSE e erro absoluto médio: são estatísticas diferentes e dependem da amostra usada.

## Copernicus GLO-30: procedimento de acesso

A [página do produto](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) informa a precisão absoluta acima e precisão relativa de < 2 m em inclinações até 20%, ou < 4 m acima disso, a 90%, dentro de uma célula de 1°. Esses valores do produto não substituem avaliação local. A [documentação de acesso](https://documentation.dataspace.copernicus.eu/Data/Others/CCM.html) distingue o cadastro CDSE/CCM do acesso anônimo no espelho.

O [registro AWS](https://registry.opendata.aws/copernicus-dem/) documenta o bucket `copernicus-dem-30m` em `eu-central-1` e acesso `--no-sign-request`. Para a região urbana próxima de longitude -47,9° e latitude -22°, os nomes de células são `S23_00_W048_00` ao sul de -22° e `S22_00_W048_00` ao norte. URLs candidatas para confirmar por cabeçalho e leitura parcial:

- [COG S23/W048](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S23_00_W048_00_DEM/Copernicus_DSM_COG_10_S23_00_W048_00_DEM.tif).
- [COG S22/W048](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S22_00_W048_00_DEM/Copernicus_DSM_COG_10_S22_00_W048_00_DEM.tif).

O procedimento executado abriu os COGs por HTTP Range (`/vsicurl/` no GDAL) e gravou só a janela da caixa urbana configurada em `viabilidade/terreno/dados/`. Como essa caixa cruza -22° e -48°, foram necessárias quatro células, incluindo também W049. A prova de acesso e os metadados efetivos estão na seção de resultado local e no JSON de proveniência; tiles completos não foram gravados.

A licença e os avisos de atribuição para dados originais e modificados estão na seção “Licensing and citation guidelines” da página do produto. Preservar o aviso apropriado no arquivo de proveniência e nas distribuições. Não usar a licença de produtos restritos `GLO-30-R` como se fosse a do produto público.

## ALOS AW3D30

A [JAXA](https://www.eorc.jaxa.jp/ALOS/en/dataset/aw3d30/aw3d30_e.htm) entrega células de 1° com DSM, máscara, contagem de cenas e metadados; o download convencional exige conta e ativação por e-mail. A [FAQ técnica](https://www.eorc.jaxa.jp/ALOS/en/inquiry/faq_e.htm) informa a meta vertical de 5 m RMS e altitudes convertidas usando EGM96. A aquisição ALOS utilizada é de 2006–2011, com combinações de cenas e preenchimentos; conferir a versão e arquivos de qualidade baixados.

Os [termos do AW3D30](https://www.eorc.jaxa.jp/ALOS/en/dataset/aw3d30/terms.htm) remetem aos [termos de dados de pesquisa JAXA](https://earth.jaxa.jp/policy/): uso gratuito com crédito; o texto consultado exige aviso prévio para uso comercial. AW3D30 é alternativa de comparação, não uma melhora demonstrada sobre o Copernicus em São Carlos. Não confundir AW3D30 com arquivos auxiliares de produtos PALSAR rotulados com pixels de 12,5 m.

## FABDEM

O [readme V1-2](https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/readme.txt) confirma grade de 1 segundo de arco, GeoTIFFs por 1°, pacotes ZIP de 10°, horizontal WGS84 e vertical EGM2008. É uma estimativa corrigida por modelo, não LiDAR medido no lote. As estatísticas da tabela vêm do [artigo dos autores](https://research-information.bris.ac.uk/en/publications/a-30m-global-map-of-elevation-with-forests-and-buildings-removed/), publicado em 2022; não devem ser atribuídas como exatidão comprovada de São Carlos.

O [índice de arquivos](https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/) lista `S30W050-S20W040_FABDEM_V1-2.zip`, com 1.097.127.704 bytes, cujo retângulo contém São Carlos. Não foi baixado. A [licença dentro do próprio conjunto](https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/license.txt) confirma CC BY-NC-SA 4.0; por isso não é a escolha gratuita para este produto imobiliário comercial. O readme indica o contato do produtor para licenciamento comercial.

## IBGE

A [página MDE do IBGE](https://www.ibge.gov.br/geociencias/todos-os-produtos-geociencias/10856-mde-modelo-digital-de-elevacao.html) oferece TIF e ASCII nas escalas citadas; escala cartográfica não é tamanho de pixel. A definição inclui os elementos sobre a superfície, portanto não presumir MDT limpo.

O [diretório público `spmggo50`](https://geoftp.ibge.gov.br/modelos_digitais_de_superficie/modelo_digital_de_elevacao_mde/spmggo50/) contém rasters e [informações técnicas](https://geoftp.ibge.gov.br/modelos_digitais_de_superficie/modelo_digital_de_elevacao_mde/spmggo50/informacoes_tecnicas/), incluindo `indice_mdes_spmggo50.shp.zip` e documento de metadados. Caminho para avaliação: abrir o índice vetorial, intersectar com São Carlos, conferir metadados das folhas resultantes e então baixar somente os arquivos correspondentes. Cobertura, pixel, precisão, época, datum vertical e licença aplicável permanecem **não conferidos** nesta pesquisa; não adotar apenas porque a pasta contém “SP”.

## Estado de São Paulo: CPLA/DataGEO e IGC

O [MDE estadual na página SEMIL](https://semil.sp.gov.br/sma/cessao-de-dados/) tem link público para [arquivo compactado](https://s.ambiente.sp.gov.br/cpla/MDE_ESP_v2.rar), anunciado com 1,28 GB. A [ficha técnica original](https://smastr16.blob.core.windows.net/cpla/2013/10/Ficha_Tecnica_MDE.pdf) confirma grade de 30 m, origem nas curvas GISAT 1:50.000, cobertura estadual, uso de TOPODATA em correções e versões em SIRGAS2000 geográfico e UTM. A origem cartográfica aproxima um modelo de terreno, mas as substituições impedem presumir chão limpo em toda parte. A ficha não fornece precisão vertical numérica nem licença padronizada. Não baixar o Estado inteiro apenas para cinco lotes sem antes procurar recorte ou serviço de cobertura.

O [FAQ DataGEO](https://datageo.ambiente.sp.gov.br/pt/faq) orienta obter o download na seção Distribuição dos metadados e esclarece que nem todas as camadas liberam arquivos. WMS para visualização não equivale a um raster de altitudes. A licença de uma camada não se deduz da possibilidade de vê-la no portal.

O [catálogo IGC](https://www.igc.sp.gov.br/habit_igc/Produtos) é uma pista para cartografia mais detalhada. A coleção chamada “São Carlos / Ribeirão Preto”, 1:5.000 de 1992, aparece com lista de municípios que não esclarece as folhas de São Carlos: confirmar no índice/atendimento antes de afirmar cobertura. A equidistância de curvas de produtos da RMSP não pode ser transferida para São Carlos. O [FAQ IGC](https://www.igc.sp.gov.br/habit_igc/faq) informa que o mapeamento não cobre todo o Estado e remete dúvidas específicas ao instituto. Imagem aérea de 50 cm também não prova existência de MDT de 50 cm.

## Prefeitura, curvas locais e LiDAR

O [manual municipal do SigaSC](https://geo.saocarlos.sp.gov.br/data/manual_siga.pdf) documenta um tema Topografia, mas não foi encontrado nesta pesquisa um pacote de curvas com equidistância, precisão, época e licença verificáveis. O servidor retornou erro ao abrir o PDF integral; a descrição indexada comprova o tema, não o download atual.

Como pista acadêmica local, o [Observa Sanca/UFSCar](https://www.observasanca.ufscar.br/curvas-de-nivel-de-sao-carlos-sp-2/) descreve mapa derivado da digitalização de cartas IBGE de 1971. Isso demonstra uma fonte histórica, sem estabelecer um levantamento municipal atual nem a licença de um vetor reutilizável. Precisão e equidistância aplicáveis aos lotes não conferidas.

Há evidência primária de contratação de **LiDAR e fotogrametria por drone**: [Diário Oficial municipal nº 2812, de 25/07/2025, p. 46](https://saocarlos.sp.gov.br/files/DO%2002812_2025_certificado.pdf), contrato 63/25, processo 15.924/25, para **Sítio do Mello e Capão das Antas**. Contrato não comprova entrega, qualidade ou disponibilização. Não foi localizado catálogo público de LAS/LAZ, MDT ou curvas desse levantamento, nem cobertura dos lotes centrais. Para aproveitá-lo, solicitar área efetiva, relatório de controle, pontos classificados de chão, datum horizontal/vertical, data, licença e produtos finais. O LiDAR da cidade de São Paulo/GeoSampa não cobre São Carlos.

## Cuidados ao preencher os lotes

- Identificar `fonte`, resolução nominal e condição de **estimativa de MDS**; manter precisão local e validação topográfica como não conferidas.
- Usar referência horizontal conhecida antes de amostrar. EPSG:31983 resolve coordenadas planas, não transforma sozinho alturas EGM96/EGM2008 para uma referência altimétrica local.
- Guardar cota absoluta e eventual origem relativa da maquete separadamente. Não denominar um valor relativo “altitude”.
- Calcular distâncias de declividade em metros e declarar o método de amostragem; registrar quantos pixels independentes participam. Min/max interpolados de um MDS não são automaticamente extremos do chão.
- Para avançar à implantação real, validar com levantamento planialtimétrico atual e referência altimétrica definida. Nenhuma das fontes globais consultadas demonstrou resolver a topografia detalhada de um lote.

Foi baixado o recorte Copernicus descrito acima. Não houve download integral dos tiles, validação em campo ou contato com órgãos; as outras fontes continuam como pesquisa e alternativas não aplicadas. Não foram baixadas máscaras auxiliares de erro/edição. O MDS pode incluir telhados e árvores e não autoriza terraplenagem, dimensionamento de arrimos ou aplicação de limite legal de declividade. Arquivos preparados sem commit para integração pela central.
