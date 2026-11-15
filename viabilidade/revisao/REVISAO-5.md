# Revisão 5 — inspeção independente das 89 imagens

**Veredito: não identifiquei vazamento direto de dados pessoais nas imagens ou nos metadados lidos. Há localização de lotes/feições, nomes geográficos de pessoas e empresas e material cartográfico de terceiros. A inspeção não comprova autorização para republicar todo esse material.**

Inspeção em 15/11/2026, worktree com HEAD `5911fc3a`. Inventário por `git ls-files` nas duas pastas: **89 imagens**, conforme esperado: **55 JPEG, 33 PNG e 1 GeoTIFF**. Todas foram abertas e observadas individualmente; todas tiveram `Pillow.Image.info` e `getexif()` lidos. Capturas de celular foram divididas em faixas em memória, cobrindo toda a altura; legendas pequenas foram ampliadas. O TIFF foi visualizado como relevo em tons de cinza, somente em memória. Nenhuma imagem foi alterada. Não li o relatório da central `INSPECAO-PRIVACIDADE-1E.md`.

Não encontrei nome de cliente/incorporadora vinculado ao estudo, e-mail, telefone, CPF/RG, endereço associado nominalmente a morador, caminho absoluto de máquina ou fotografia de pessoa. Os números de leis e IDs de lotes/feições não foram classificados como documentos pessoais. As capturas exibem caminhos relativos e nomes de JSON, além de URLs públicas municipais.

Ressalvas concretas:
- Os mapas localizados e diagramas permitem localizar terrenos; capturas expõem IDs, áreas e hipóteses de estudo. Não são material anônimo quanto ao imóvel. Não verifiquei vínculo desses terrenos com cliente ou negociação reservada.
- Há nomes como Mário Pereira Lopes e Luiz Augusto de Oliveira em aeroporto/rodovia, e referências empresariais/institucionais como TAM, Volkswagen do Brasil, Science Park, CEMOSAR e PROHAB. No contexto observado são rótulos geográficos ou fontes, sem identificação de cliente.
- Os mapas municipais e seus recortes são conteúdo de terceiros. Não encontrei autorização de republicação inscrita nos pixels/metadados; isso **não prova ausência de licença**. A central deve conferir a base de republicação antes de tratar o conjunto como liberado.
- O GeoTIFF traz atribuição a DLR, Airbus, União Europeia e ESA. O arquivo auxiliar `terreno/dados/copernicus-glo30-sao-carlos.json` registra fonte, atribuição e URL da licença COP-DEM; não validei os termos externos nem o cumprimento integral deles.

Metadados na tabela:
- **J**: somente JFIF 1.1 (`jfif=257`, unidade 0, densidade 1×1); EXIF vazio. Sem autor, câmera, data de captura ou GPS pessoal informado.
- **P**: `info={}` e EXIF vazio.
- **G**: TIFF float32, uma banda, 1155×682, compressão Deflate, tags estruturais/resolução e GeoTIFF; WGS84/EPSG:4326, EGM2008, pixel de 0,0002777777777777778 grau, origem longitude −48,12125/latitude −21,91513888888889, nodata −9999. GDALMetadata contém fonte, descrição do recorte urbano e atribuição de direitos. É georreferenciamento regional deliberado, sem marca/modelo de câmera ou GPS de fotografia encontrado.

Caminhos da tabela relativos a `viabilidade/`. “Sem titular/contato” descreve o que consegui observar; não certifica anonimização nem licença. A ressalva de republicação cartográfica aplica-se aos mapas e recortes, inclusive os sem nomes.

| Nº | Arquivo | Metadados | Conteúdo observado e possível exposição |
|---:|---|:---:|---|
| 1 | `terreno/dados/copernicus-glo30-sao-carlos.tif` | G | Modelo de elevação regional, sem pessoas/fotografia identificável; coordenadas e atribuição Copernicus nos metadados (G). |
| 2 | `terreno/dados/eixo-anexo02.jpg` | J | Mapa Anexo 02 com ruas, bairros e lote marcado; nomes são topônimos, sem titular identificado. |
| 3 | `terreno/dados/eixo-anexo05.jpg` | J | Mapa ambiental Anexo 05 com córregos e lote marcado; sem pessoa identificada. |
| 4 | `terreno/dados/eixo-anexo06.jpg` | J | Mapa Anexo 06 com ruas/bairros e lote marcado; sem titular identificado. |
| 5 | `terreno/dados/eixo-anexo07.jpg` | J | Mapa Anexo 07 com córregos e lote marcado; sem pessoa identificada. |
| 6 | `terreno/dados/eixo-testada.jpg` | J | Diagrama de parcelas/testada: IDs 11984–11988 e EPSG:31983; sem titulares (não comprova cadastro oficial). |
| 7 | `terreno/dados/eixo-trecho-art11.jpg` | J | Mapa do eixo Miguel Petroni/Miguel João; nomes de vias e lote marcado, sem titular. |
| 8 | `terreno/dados/z2-anexo02.jpg` | J | Recorte de mapa do entorno Z2, com ruas/córregos e lote marcado; sem titular identificado. |
| 9 | `terreno/dados/z2-anexo05.jpg` | J | Recorte de mapa do entorno Z2, com ruas/córregos e lote marcado; sem titular identificado. |
| 10 | `terreno/dados/z2-anexo06.jpg` | J | Recorte de mapa do entorno Z2, com ruas/córregos e lote marcado; sem titular identificado. |
| 11 | `terreno/dados/z2-anexo07.jpg` | J | Recorte de mapa do entorno Z2, com ruas/córregos e lote marcado; sem titular identificado. |
| 12 | `terreno/dados/z2-componentes.png` | P | Diagrama das parcelas 75352–75354 e frente; sem nomes de titulares. |
| 13 | `terreno/dados/zonas-mapas/22421-divisa-sem-marca.jpg` | J | Ampliação de divisa e nomes de vias, sem marca de lote; sem dado pessoal. |
| 14 | `terreno/dados/zonas-mapas/22421-divisa.jpg` | J | Mesma divisa com contorno do lote em magenta; sem titular. |
| 15 | `terreno/dados/zonas-mapas/SC-completo-22421-anexo02.jpg` | J | Recorte cartográfico com localização do lote 22421 e vias/córregos; sem titular ou contato. |
| 16 | `terreno/dados/zonas-mapas/SC-completo-22421-anexo05.jpg` | J | Recorte cartográfico com localização do lote 22421 e vias/córregos; sem titular ou contato. |
| 17 | `terreno/dados/zonas-mapas/SC-completo-22421-anexo06.jpg` | J | Recorte cartográfico com localização do lote 22421 e vias/córregos; sem titular ou contato. |
| 18 | `terreno/dados/zonas-mapas/SC-completo-22421-anexo07.jpg` | J | Recorte cartográfico com localização do lote 22421 e vias/córregos; sem titular ou contato. |
| 19 | `terreno/dados/zonas-mapas/SC-completo-22426-anexo02.jpg` | J | Recorte cartográfico com localização do lote 22426 e vias/córregos; sem titular ou contato. |
| 20 | `terreno/dados/zonas-mapas/SC-completo-22426-anexo05.jpg` | J | Recorte cartográfico com localização do lote 22426 e vias/córregos; sem titular ou contato. |
| 21 | `terreno/dados/zonas-mapas/SC-completo-22426-anexo06.jpg` | J | Recorte cartográfico com localização do lote 22426 e vias/córregos; sem titular ou contato. |
| 22 | `terreno/dados/zonas-mapas/SC-completo-22426-anexo07.jpg` | J | Recorte cartográfico com localização do lote 22426 e vias/córregos; sem titular ou contato. |
| 23 | `terreno/dados/zonas-mapas/SC-completo-25297-anexo02.jpg` | J | Recorte cartográfico com lote 25297 marcado, ruas e zonas; sem titular ou contato. |
| 24 | `terreno/dados/zonas-mapas/SC-completo-25297-anexo05.jpg` | J | Recorte cartográfico com lote 25297 marcado, ruas e zonas; sem titular ou contato. |
| 25 | `terreno/dados/zonas-mapas/SC-completo-25297-anexo06.jpg` | J | Recorte cartográfico com lote 25297 marcado, ruas e zonas; sem titular ou contato. |
| 26 | `terreno/dados/zonas-mapas/SC-completo-25297-anexo07.jpg` | J | Recorte cartográfico com lote 25297 marcado, ruas e zonas; sem titular ou contato. |
| 27 | `terreno/dados/zonas-mapas/SC-completo-30516-anexo02.jpg` | J | Recorte cartográfico com lote 30516 marcado, ruas e zonas; sem titular ou contato. |
| 28 | `terreno/dados/zonas-mapas/SC-completo-30516-anexo05.jpg` | J | Recorte cartográfico com lote 30516 marcado, ruas e zonas; sem titular ou contato. |
| 29 | `terreno/dados/zonas-mapas/SC-completo-30516-anexo06.jpg` | J | Recorte cartográfico com lote 30516 marcado, ruas e zonas; sem titular ou contato. |
| 30 | `terreno/dados/zonas-mapas/SC-completo-30516-anexo07.jpg` | J | Recorte cartográfico com lote 30516 marcado, ruas e zonas; sem titular ou contato. |
| 31 | `terreno/dados/zonas-mapas/SC-completo-37607-anexo02.jpg` | J | Recorte cartográfico do lote 37607, com ruas e zonas; sem titular ou contato. |
| 32 | `terreno/dados/zonas-mapas/SC-completo-37607-anexo05.jpg` | J | Recorte cartográfico do lote 37607, com ruas e zonas; sem titular ou contato. |
| 33 | `terreno/dados/zonas-mapas/SC-completo-37607-anexo06.jpg` | J | Recorte cartográfico do lote 37607, com ruas e zonas; sem titular ou contato. |
| 34 | `terreno/dados/zonas-mapas/SC-completo-37607-anexo07.jpg` | J | Recorte cartográfico do lote 37607, com ruas e zonas; sem titular ou contato. |
| 35 | `terreno/dados/zonas-mapas/anexo02-geral.jpg` | J | Mapa geral municipal Anexo 02, legenda e fontes institucionais; sem dados pessoais identificados. |
| 36 | `terreno/dados/zonas-mapas/anexo02-localizados.jpg` | J | Anexo 02 com marcações dos lotes, legenda e fontes institucionais; sem titulares. |
| 37 | `terreno/dados/zonas-mapas/anexo05-geral.jpg` | J | Anexo 05 ambiental geral; legenda cita rodovia Luiz Augusto de Oliveira, sítios e fazenda como lugares; fontes institucionais, sem proprietário nominal identificado. |
| 38 | `terreno/dados/zonas-mapas/anexo05-localizados.jpg` | J | Anexo 05 ambiental com lotes marcados; rodovia Luiz Augusto de Oliveira, sítios e fazenda são referências geográficas; lotes geolocalizáveis. |
| 39 | `terreno/dados/zonas-mapas/anexo06-geral.jpg` | J | Anexo 06 de áreas especiais; nomes de bairros e fontes institucionais, inclusive PROHAB; sem cliente/contato identificado. |
| 40 | `terreno/dados/zonas-mapas/anexo06-localizados.jpg` | J | Anexo 06 com lotes destacados; bairros, fontes institucionais/PROHAB e localização dos lotes; sem proprietário identificado. |
| 41 | `terreno/dados/zonas-mapas/anexo07-geral.jpg` | J | Anexo 07 municipal e aeroporto; TAM como referência geográfica e nomes de lugares; sem cliente/contato identificado. |
| 42 | `terreno/dados/zonas-mapas/anexo07-localizados.jpg` | J | Anexo 07 com lotes destacados; referência à TAM e localização dos lotes; sem cliente/contato identificado. |
| 43 | `terreno/dados/zonas-mapas/controle02.jpg` | J | Recorte de controle Anexo 02; vias e córrego, sem identificação de morador. |
| 44 | `terreno/dados/zonas-mapas/controle05-31.jpg` | J | Controle ambiental 31; córregos e limites, sem dado pessoal identificado. |
| 45 | `terreno/dados/zonas-mapas/controle05-54.jpg` | J | Controle ambiental 54; traçado viário e zonas, sem dado pessoal identificado. |
| 46 | `terreno/dados/zonas-mapas/controle05.jpg` | J | Controle ambiental; quadras e zonas, sem dado pessoal identificado. |
| 47 | `terreno/dados/zonas-mapas/controle06-31.jpg` | J | Controle Anexo 06/31; córrego e estrada, sem identificação de morador. |
| 48 | `terreno/dados/zonas-mapas/controle06-54.jpg` | J | Controle Anexo 06/54; vias e limites, sem dado pessoal identificado. |
| 49 | `terreno/dados/zonas-mapas/controle06.jpg` | J | Controle Anexo 06; ruas com nomes de pessoas e lugares Science Park/CEMOSAR; topônimos, sem cliente identificado. |
| 50 | `terreno/dados/zonas-mapas/controle07-31.jpg` | J | Controle Anexo 07/31; córrego e zonas, sem dado pessoal identificado. |
| 51 | `terreno/dados/zonas-mapas/controle07-54.jpg` | J | Controle Anexo 07/54; vias e zonas, sem dado pessoal identificado. |
| 52 | `terreno/dados/zonas-mapas/controle07.jpg` | J | Controle Anexo 07; zonas e córregos, sem dado pessoal identificado. |
| 53 | `terreno/dados/zonas-mapas/controle31.jpg` | J | Controle 31; córrego e estrada municipal, sem morador identificado. |
| 54 | `terreno/dados/zonas-mapas/left.jpg` | J | Faixa lateral do mapa, quase vazia e com marcas de corte; nenhum dado pessoal legível. |
| 55 | `terreno/dados/zonas-mapas/legend.jpg` | J | Legenda de zoneamento e parâmetros urbanísticos; sem dado pessoal identificado. |
| 56 | `terreno/dados/zonas-mapas/sul.jpg` | J | Mapa sul; Volkswagen do Brasil, Science Park e CEMOSAR, além de nomes de ruas; referências geográficas empresariais. |
| 57 | `terreno/dados/zonas-mapas/top.jpg` | J | Faixa superior do mapa, marcas de corte e rótulos parciais de lugares; sem cliente/contato legível. |
| 58 | `visual/evidencias/celular-A.png` | P | Captura celular opção A; IDs de lotes 35038–35042/quadra 1560 e caminho relativo de exemplo; sem cliente/contato/caminho da máquina. |
| 59 | `visual/evidencias/celular-B.png` | P | Captura celular opção B; IDs de lotes 35038–35042/quadra 1560 e caminho relativo de exemplo; sem cliente/contato/caminho da máquina. |
| 60 | `visual/evidencias/celular-C.png` | P | Captura celular opção C; IDs de lotes 35038–35042/quadra 1560 e caminho relativo de exemplo; sem cliente/contato/caminho da máquina. |
| 61 | `visual/evidencias/celular-D.png` | P | Captura celular opção D; IDs de lotes 35038–35042/quadra 1560 e caminho relativo de exemplo; sem cliente/contato/caminho da máquina. |
| 62 | `visual/evidencias/celular-comparacao.png` | P | Captura celular comparação A–D; IDs de lotes 35038–35042/quadra 1560 e caminho relativo de exemplo; sem cliente/contato/caminho da máquina. |
| 63 | `visual/evidencias/celular-erro.png` | P | Celular com erro de JSON; valores rotulados TESTE SINTÉTICO, IDs dos lotes no texto; sem stack trace ou caminho da máquina. |
| 64 | `visual/evidencias/celular-parede-cega.png` | P | Celular parede cega; teste sintético e nome parede-cega.json; IDs dos lotes, sem proprietário/contato. |
| 65 | `visual/evidencias/celular-piloto-SC-completo-22421.png` | P | Celular piloto 22421; aeroporto e córrego Gregório; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 66 | `visual/evidencias/celular-piloto-SC-completo-22426.png` | P | Celular piloto 22426; Av. Comendador Alfredo Maffei e córrego Gregório; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 67 | `visual/evidencias/celular-piloto-SC-completo-25297.png` | P | Celular piloto 25297; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 68 | `visual/evidencias/celular-piloto-SC-completo-30516.png` | P | Celular piloto 30516; Jardim Gonzaga/Monte Carlo e córrego Água Quente; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 69 | `visual/evidencias/celular-piloto-SC-completo-37607.png` | P | Celular piloto 37607; CEAT/Parque Novo Mundo; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 70 | `visual/evidencias/celular-piloto-SC-completo-q1382-11984-11988.png` | P | Celular piloto quadra 1382/lotes 11984–11988; aeroporto; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 71 | `visual/evidencias/celular-piloto-SC-completo-remembramento-75352-75354.png` | P | Celular remembramento 75352–75354; três feições descritas como sintéticas, geometria e caminho relativo; sem titular/contato. |
| 72 | `visual/evidencias/celular-v2.png` | P | Celular contrato-v2-com-preco.json; valores rotulados TESTE SINTÉTICO, VGV de teste e IDs no texto; sem cliente/contato. |
| 73 | `visual/evidencias/degraus-explicitos.png` | P | Maquete de volumes/degraus explícitos, apenas botões de vista; sem nome, endereço ou foto. |
| 74 | `visual/evidencias/degraus-inferidos.png` | P | Maquete de volumes/degraus inferidos, apenas botões de vista; sem nome, endereço ou foto. |
| 75 | `visual/evidencias/desktop-A.png` | P | Desktop opção A; exemplo-restaurado.json, quadra 1560/IDs 35038–35042, sem cliente/contato/caminho da máquina. |
| 76 | `visual/evidencias/desktop-B.png` | P | Desktop opção B; exemplo-restaurado.json, quadra 1560/IDs 35038–35042, sem cliente/contato/caminho da máquina. |
| 77 | `visual/evidencias/desktop-C.png` | P | Desktop opção C; exemplo-restaurado.json, quadra 1560/IDs 35038–35042, sem cliente/contato/caminho da máquina. |
| 78 | `visual/evidencias/desktop-D.png` | P | Desktop opção D; exemplo-restaurado.json, quadra 1560/IDs 35038–35042, sem cliente/contato/caminho da máquina. |
| 79 | `visual/evidencias/desktop-comparacao.png` | P | Desktop comparação A–D; exemplo-restaurado.json, quadra 1560/IDs 35038–35042, sem cliente/contato/caminho da máquina. |
| 80 | `visual/evidencias/desktop-erro.png` | P | Desktop com erro de parede_cega; TESTE SINTÉTICO e VGV de teste, IDs no texto; sem stack trace/caminho da máquina. |
| 81 | `visual/evidencias/desktop-parede-cega.png` | P | Desktop parede cega; teste sintético e parede-cega.json, IDs no texto; sem proprietário/contato. |
| 82 | `visual/evidencias/desktop-piloto-SC-completo-22421.png` | P | Desktop piloto 22421; aeroporto e córrego Gregório; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 83 | `visual/evidencias/desktop-piloto-SC-completo-22426.png` | P | Desktop piloto 22426; Av. Comendador Alfredo Maffei e córrego Gregório; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 84 | `visual/evidencias/desktop-piloto-SC-completo-25297.png` | P | Desktop piloto 25297; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 85 | `visual/evidencias/desktop-piloto-SC-completo-30516.png` | P | Desktop piloto 30516; Jardim Gonzaga/Monte Carlo e córrego Água Quente; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 86 | `visual/evidencias/desktop-piloto-SC-completo-37607.png` | P | Desktop piloto 37607; CEAT/Parque Novo Mundo; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 87 | `visual/evidencias/desktop-piloto-SC-completo-q1382-11984-11988.png` | P | Desktop piloto quadra 1382/lotes 11984–11988; aeroporto; IDs/geometria e caminhos relativos, sem proprietário/cliente identificado. |
| 88 | `visual/evidencias/desktop-piloto-SC-completo-remembramento-75352-75354.png` | P | Desktop remembramento 75352–75354; três feições descritas como sintéticas, geometria e caminho relativo; sem titular/contato. |
| 89 | `visual/evidencias/desktop-v2.png` | P | Desktop contrato-v2-com-preco.json; valores rotulados TESTE SINTÉTICO, VGV de teste e IDs no texto; sem cliente/contato. |

Limites: textos muito pequenos, cortados ou já corrompidos na rasterização de mapas não podem ser integralmente recuperados pela ampliação. A inspeção visual e o Pillow não são perícia de esteganografia, bytes anexados ou formatos de metadados que o leitor não exponha. Não consultei cadastro externo para identificar titulares; não autentiquei a origem ou a cadeia de direitos de cada mapa, diagrama e captura. Também não verifiquei arquivos fora do inventário, histórico Git, conteúdo oculto da interface ou se estes arquivos estão efetivamente publicados. Nenhum segredo direto foi identificado; localização dos imóveis e permissões de republicação permanecem as ressalvas.

