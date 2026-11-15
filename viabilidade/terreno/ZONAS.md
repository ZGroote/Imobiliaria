# Leitura manual das zonas dos sete lotes

14/11/2026. Entrega de pesquisa para ensaio, sem certidão cadastral ou aprovação municipal. Preserva os cinco lotes iniciais e acrescenta os dois casos da tarefa 2. Dados para integração em `dados/anotacoes-zonas.json`. Todos usam `zona_origem: "anotada_a_mao"` e `zona_conferida: false` (contrato v4).

| Lote | Zona operacional | Incidências e dúvidas |
|---|---|---|
| SC-completo-30516 | SC-Z4 | Sobreposição visual com AIA no Anexo 05; próximo da AEIS 21 no Anexo 06, cuja incidência não ficou clara. |
| SC-completo-37607 | SC-Z4 | Dentro da área industrial e de serviços 42 do CEAT / Parque Novo Mundo. Aptidão residencial não comprovada. |
| SC-completo-22426 | SC-Z1 | Dentro da superfície de aproximação/decolagem do aeroporto. Pode ser SC-EIXO se a frente candidata norte realmente der para a Av. Comendador Alfredo Maffei. |
| SC-completo-22421 | SC-Z1, ambígua | Colado à divisa Z2; confirmar ambas as hipóteses. Também dentro da superfície de aproximação/decolagem do aeroporto. |
| SC-completo-25297 | SC-Z1 | Nenhuma sobreposição identificada nos Anexos 05/06/07, o que não certifica ausência de restrições. |
| SC-completo-q1382-11984-11988 | SC-EIXO | Testada indicada para Miguel Petroni/Miguel João no trecho do art. 11-I; fora das manchas ambientais/industriais. Dentro da restrição aeronáutica do Anexo 07, sem altura local numérica. |
| SC-completo-remembramento-75352-75354 | SC-Z2 | Polígono completo na Z2, cerca de 213 m da divisa local com Z1. Nenhuma incidência especial visual identificada nos Anexos 05/06/07. |

Nenhum dos cinco polígonos originais aparece dentro da subárea histórica de 9 m, da poligonal histórica ou da área do Observatório da USP no Anexo 06. Não foi atribuído gabarito numérico aos lotes: o Anexo 07 indica incidência aeronáutica nos dois médios, mas não fornece a altura local. A consulta ao DECEA permanece pendente.

Os dois novos também ficam fora das manchas históricas e do Observatório. O caso do Eixo é união de cinco parcelas `planta_refeita`; o da Z2, de três parcelas `sintetico`. São ensaios da maquete, sem comprovação cadastral de remembramento. As fontes e limitações constam em `dados/anotacao-eixo.json` e `dados/anotacao-z2.json`; geometrias e testadas em `LOTES.md`.

Para o Eixo, o [art. 11-I oficial](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) inclui os lotes com testada para Miguel Petroni/Miguel João entre a Av. Francisco Pereira Lopes e a rotatória da Av. Bruno Ruggieiro Filho. O recorte `dados/eixo-trecho-art11.jpg` mostra o trecho e seus limites; o lote está a leste da rotatória. Não se classificou somente pela cor de fundo Z2 ou pela proximidade da via. A frente na malha continua sem conferência de endereço/alinhamento cadastral.

A Z2 foi escolhida mais afastada da divisa: `dados/anotacao-z2.json` registra o traço local usado para medir aproximadamente 213 m. Essa distância é leitura do raster, não levantamento do limite legal. A via inferida para a frente não está na lista do art. 11; os anexos não desenham Eixo sobre o polígono.

## Método e controles

Extraí o JPEG de 8858 × 12746 pixels de cada PDF oficial. Localizei manualmente cinco quinas/interseções do perímetro urbano e usei as coordenadas SAD69 do Anexo 02.A: vértices 17, 18 e 19 no sul (CEAT); 31 a oeste (Córrego Água Fria e estrada Cônego Washington José Pera); 54 a noroeste (limite da USP 2 e ferrovia). As coordenadas e pixels estão em `dados/zonas-controles.json`. Não há grade numerada aproveitável no raster; foram usados esses vértices do memorial, e não os campos fx/fy.

O ajuste é afim por mínimos quadrados, independente para cada anexo. Transformei todos os vértices dos lotes de EPSG:31983 para EPSG:29183 com pyproj. Inspecionei o polígono completo, a legenda e as vias nomeadas ao redor. Os nomes de bairros apenas ajudam a descrever o recorte; não determinaram a zona. Os KMLs de proposta e o mapa antigo do SigaSC não foram usados.

| Anexo | Escala impressa | RMSE dos controles | Maior resíduo |
|---|---|---:|---:|
| 02 | 1:15.000 | 3,53 m | 5,69 m |
| 05 | 1:33.000 | 4,09 m | 6,77 m |
| 06 | 1:15.000 | 7,88 m | 10,46 m |
| 07, quadro principal | 1:60.000 | 7,31 m | 11,37 m |

Esses resíduos são ajuste aos próprios controles, não validação independente nem acurácia cadastral. Não foi medido o erro total do raster, da transformação de datum ou da geometria de maquete. `incerteza_posicional_total_m` fica null. A espessura dos traços, a generalização e a ausência de lotes oficiais impedem precisão de divisa.

O lote 22421 evidencia esse limite: com três controles concentrados ao sul aparecia do lado Z2; com cinco controles distribuídos aparece do lado Z1, a poucos metros da linha. O recorte ampliado `dados/zonas-mapas/22421-divisa.jpg` mostra que a borda oeste do polígono está na mesma ordem de grandeza dos resíduos e da espessura do traço. SC-Z1 é somente a hipótese operacional do ajuste final; SC-Z2 permanece alternativa explícita. Nenhuma média de parâmetros entre zonas foi aplicada.

## Evidências e reprodução

`dados/zonas-mapas/SC-completo-<id>-anexo<02|05|06|07>.jpg` contém os 20 recortes inspecionados. O polígono magenta é o lote; o círculo magenta apenas destaca sua posição e não representa área ou margem de erro. As vistas `anexoNN-localizados.jpg` mostram o contexto geral. Em `dados/zonas-posicionamento.json` estão as matrizes, resíduos e coordenadas em pixels de todos os vértices.

Reproduzir recortes: `python -I viabilidade/terreno/dados/zonas-renderizar.py`. O script usa PyMuPDF, Pillow, numpy e pyproj já instalados; o pequeno self-check verifica dimensões, posto da transformação e resíduos máximos. Ele não decide zoneamento por cor. `zonas-anotar.py` registra a leitura manual aqui descrita; não deve ser reaplicado cegamente a geometrias diferentes. Cada anotação leva `poligono_sha256`, calculado sobre o JSON compacto das coordenadas, para a integração rejeitar lote alterado.

Os JPEGs integrais extraídos duplicam os PDFs e podem ficar fora do git. Os recortes, controles e anotações são a evidência útil. Os PDFs de origem permanecem em `viabilidade/lei/mapa/lei18053_anexos_2017_pdf`, sem alteração.

Tarefa 2: `dados/eixo-anexoNN.jpg` e `dados/z2-anexoNN.jpg` acrescentam oito recortes dos mesmos quatro mapas, usando os controles e matrizes existentes. `eixo-contiguidade.json`, `eixo-testada.jpg` e `z2-componentes.png` mostram componentes/testada. Os scripts `eixo-reproduzir.py` e `z2-reproduzir.py` verificam união exata, área, mesma quadra e sobreposição antes de reproduzir os artefatos; a ordem de integração está em `LOTES.md`.

## Fontes e limites jurídicos

Mapas oficiais: [Anexo 02](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf), [memorial 02ABC](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002ABC%20-%20Descri%C3%A7%C3%B5es%20Per%C3%ADmetros.pdf), [Anexo 05](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2005%20-%20AEIs%20Ambientais.pdf), [Anexo 06](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2006%20-%20AEIs%20Urbanas.pdf) e [Anexo 07](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2007%20-%20AEIs%20Rurais.pdf). Os hashes SHA256 integrais dos quatro mapas estão na anotação.

O [texto oficial da Lei 18.053/2016](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) foi consultado para relacionar mapas e artigos: art. 11 para testadas do Eixo; arts. 73-74 para AIA; arts. 79-82 para patrimônio e Observatório; arts. 84-86 para indústria/serviços; arts. 105-107 para transporte aéreo. Não se inferiu proibição absoluta de residência no CEAT, área edificável dentro da AIA ou altura aeronáutica numérica.

A leitura da frente Lei em `lei/zona-dos-pilotos.json` coincide com as cinco zonas operacionais e com a AEI 42. Esta entrega acrescenta a inspeção ambiental e aeronáutica, e incorpora a dúvida sobre testada norte do lote 22426. A classificação por testada depende de cadastro; o mapa de ruas esquemático não resolve o endereço de cada aresta.

Não foram conferidos cadastro oficial, matrícula, restrições registradas dos loteamentos, atualização das superfícies do DECEA, APP em levantamento topográfico, inundação, contaminação ou tombamento individual. A lista `areas_especiais` vazia significa ausência de incidência visual nos anexos consultados, nunca liberação irrestrita. Todos os registros permanecem `conferido: false`.

As limitações de fontes somente em imagem e o erro de acesso ao manual SigaSC identificado na entrega 1 foram acrescentados a `viabilidade/BLOQUEIOS.md`, com encaminhamento humano. Nesta etapa não houve nova tentativa de consulta bloqueada; os textos oficiais do art. 11 e os arquivos locais existentes foram suficientes para a anotação de ensaio.
