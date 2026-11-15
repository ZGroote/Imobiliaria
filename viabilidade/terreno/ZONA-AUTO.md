# Sugestão pelo Anexo 02

`python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 19 --zona auto --saida lote.json`

`--zona SC-XX` mantém o comportamento anterior. `auto` também funciona em `Cadastro.gerar()`, inclusive com união de parcelas. A CLI do Motor é outro fluxo, ainda exige zona explícita: o validador compartilhado só aceita `auto` quando o chamador habilita `permitir_auto=True`. Nenhum arquivo de motor/visual/relatório foi alterado.

O JPEG integral é conferido pelo SHA256 de `dados/mapas-externos.json`. Quando ausente, baixa somente `anexo02.jpg` da mesma release usada por `viabilidade/baixar_mapas.py`, com `gh` autenticado, verificando o hash antes de salvar. Um arquivo existente divergente é recusado. Não há consulta online quando o mapa está disponível e íntegro.

Reutiliza `zonas-posicionamento.json` e confere a matriz com os cinco pontos de `zonas-controles.json`. Converte EPSG:31983 para EPSG:29183 antes da transformação afim. O RMSE 3,53 m é ajuste aos controles, **não acurácia cadastral**. Nenhuma coordenada fx/fy é usada.

A paleta vem dos miolos dos oito retângulos da legenda: x=4280–4330, y=10855/10934/11013/11092/11171/11250/11329/11408 ±10 pixels. Z1–Z5B são as seis primeiras cores; campus e parque são reconhecidos, mas recusados como zona operacional. Branco também não é zona. Correspondência por distância euclidiana RGB ≤18. O traço Eixo vem de x=3265–3345, y=11165–11170, tolerância RGB 35; nunca determina `zona_id`.

Lê os centros de **todos** os pixels no interior do polígono (~1,4 m entre amostras). Até três pixels de texto/traço sem classificação podem herdar a cor reconhecida mais próxima, incluindo branco/campus (que continuam recusados). A saída registra ponto UTM, zona lida e se houve recuperação; proporções incluem `nao_classificada`. Menos de três amostras, qualquer amostra não zonal e mistura de zonas recusam. Traços grossos, nomes e antialiasing podem gerar recusas conservadoras ou cores aparentes de outras zonas: isso não prova incidência legal.

Busca outras cores reconhecidas num entorno de 250 m. `distancia_divisa_m` é o mínimo ao polígono, descontados quatro pixels na menor escala da afim (~5,65 m, cobrindo recuperação + meia diagonal); trata também branco/campus/parque como limite incerto. Recusa quando esse limite inferior é **menor que 10 m**. `null` significa nenhum limite reconhecido em até 250 m, nunca distância infinita ou ausência legal de divisa. Não se subtrai o RMSE como se fosse um erro máximo garantido.

Traço de Eixo a **até 60 m** do polígono (com margem de um pixel) inclui `SC-EIXO` em `alternativas` e explica que via, trecho e testada do art. 11 exigem confirmação. Ausência dessa alternativa não certifica ausência de eixo. O método lê somente o quadro principal do Anexo 02; não aceita legendas, quadros dos distritos, polígonos com buracos, área >1 km² ou recorte >2 milhões de pixels. Detalhes menores que um pixel e limites encobertos no raster não são resolvidos.

`ZonaIncerta` contém o diagnóstico em `.sugestao`; a CLI termina com código 2, explica o motivo e pede `--zona SC-XX`, sem tocar no destino. Uma sugestão aceita continua `zona_conferida: false`, `conferido: false`, `zona_origem: sugerida_pelo_mapa`. Áreas especiais, cadastro oficial e mudanças legais posteriores não são verificados.

`novo_lote.py --testar` preserva as regressões de zona explícita, executa cenários sintéticos de cor/divisa/eixo, os sete pilotos e três extras da base completa. Os recortes abaixo foram inspecionados visualmente em 15/11/2026, usando o JPEG original, polígono magenta de 2 pixels, recorte de 600×500 centrado na média dos vértices e ampliação 2×:

No piloto remembrado 75352–75354, a leitura automática do polígono salvo concorda com Z2, mas a montagem por `Cadastro.gerar()` recusa o vizinho 75351 inválido, antes de classificar a zona. O teste verifica ambos; a validação geométrica preexistente não foi relaxada. Nos demais seis pilotos, verifica também aceitação/recusa pelo caminho `gerar(..., "auto")`.

| Índice completo | Leitura visual independente do resultado automático | Evidência |
|---|---|---|
| 19 | Polígono inteiro no azul Z3, entre as ruas Joaquim de Meira Botelho e Valério Ribeiro; abaixo do perímetro vermelho da Rua Ernesto Bentin. | [Recorte](dados/zona-auto/completo-19.png) |
| 25298 | Polígono no ocre Z1, na Vila Monteiro Gleba I; azul Z3 ao sul e amarelo Z2 a leste, sem cruzar o lote. | [Recorte](dados/zona-auto/completo-25298.png) |
| 75355 | Polígono no amarelo Z2, entre Major Manoel Antonio de Mattos e Izabel de Oliveira Botelho; Z1 ocre distante a oeste. | [Recorte](dados/zona-auto/completo-75355.png) |
