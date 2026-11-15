# Sete lotes de ensaio

Continuação em 14/11/2026, preservando os cinco pilotos da entrega 1 e acrescentando dois da tarefa 2. Dados em `lotes-piloto.json`; auditoria inicial reproduzível em `gerar_lotes.py` e resultado em `dados/qualidade-lotes.json`.

Contrato v4: nos sete lotes, `zona_origem: "anotada_a_mao"` e `zona_conferida: false`. O campo anterior `zona_anotada_a_mao` foi removido. A conferência dos números da lei, em `Zona.conferido`, não certifica a localização do imóvel nessa zona.

## O que as bases contêm

| Base | Feições | Inválidas | Pares com sobreposição > 0,1 m² | Área máxima |
|---|---:|---:|---:|---:|
| `lotes_saocarlos.geojson` | 113.501 | 55 | 110.671 | 307,481 m² |
| `sao-carlos/dados/lotes_saocarlos_completo.geojson` | 110.089 | 3.893 | 943 | 2.862,434 m² |

As interseções foram medidas entre geometrias válidas; a soma das interseções por par não é uma área territorial única. A primeira base não tem lotes médios ou grandes nas faixas pedidas. `pipeline/consolidar.py` a identifica como fallback sintético, apesar de suas propriedades não trazerem esse rótulo.

A base completa mistura 18.265 feições `planta`, 9.698 `planta_complemento`, 9.789 `planta_refeita` e 72.337 `sintetico`. `pipeline/juntar_lotes.py` explica que as plantas são recortadas no miolo da quadra e plantas reprovadas são substituídas por grades. Portanto, mesmo `planta` não equivale a divisa cadastral conferida. Foram encontradas 1.352 geometrias com buracos e 818 geometrias válidas com ocupação inferior a 50% do retângulo mínimo. Não corrigimos as bases originais.

## Seleção preservada

| ID local | Categoria | Área m² | Loteamento na origem | Distância ao centro de referência |
|---|---|---:|---|---:|
| SC-completo-30516 | grande | 1.604,658 | Jardim Pacaembu | 2.719,4 m |
| SC-completo-37607 | grande | 2.684,942 | C.E.A.T. | 5.706,0 m |
| SC-completo-22426 | médio | 601,815 | Jardim São Carlos | 992,0 m |
| SC-completo-22421 | médio | 651,571 | Jardim São Carlos | 1.084,4 m |
| SC-completo-25297 | esquina | 326,676 | Vila Monteiro Gleba I | 1.080,6 m |

Os cinco originais têm origem `planta`, geometria válida sem buracos, ocupação de pelo menos 70% do retângulo mínimo e nenhuma sobreposição com vizinho válido acima de 0,1 m². As propriedades de origem ficam preservadas, inclusive texto com codificação defeituosa. Não há `lid` nesses registros: `lid: null` é intencional e o ID usa o índice da feição mais o hash da base na auditoria para rastreio.

O gerador priorizou origem `planta` e depois proximidade ao centro configurado. **A preferência por áreas centrais foi atendida apenas parcialmente:** os grandes são mais afastados. Não foi comprovada verticalização, uso permitido, disponibilidade, matrícula ou aptidão de incorporação; o CEAT exige atenção ao uso e às restrições próprias do loteamento. São geometrias para ensaiar o motor, não ofertas de terreno aprovadas.

## Acréscimos da tarefa 2

| ID | Zona manual | Área m² | Quadra / componentes da base completa | Distância ao centro |
|---|---|---:|---|---:|
| SC-completo-q1382-11984-11988 | SC-EIXO | 1.599,108 | 1382 / índices 11984 a 11988 | 3.142,8 m |
| SC-completo-remembramento-75352-75354 | SC-Z2 | 1.607,776 | 2725 / índices 75352 a 75354 | 1.202,6 m |

São **remembramentos geométricos de ensaio**: cinco parcelas `planta_refeita` no Eixo e três `sintetico` na Z2. A união é exata, sem buffer, simplificação ou preenchimento de lacunas; componentes da mesma quadra, sem sobreposição de área e com bordas compartilhadas. Não comprovam lotes cadastrais, disponibilidade, propriedade comum ou possibilidade legal de remembrar. Foram rejeitadas alternativas cujos componentes deixavam lacunas. A triagem não é um inventário exaustivo de imóveis.

O Eixo usa a testada norte indicada para Miguel Petroni/Miguel João entre Francisco Pereira Lopes e a rotatória Bruno Ruggieiro Filho (Lei 18.053/2016, art. 11-I). A Z2 está cerca de 213 m para dentro da divisa Z1/Z2 desenhada, com distância aproximada medida no raster. Ambos ficam fora das manchas ambientais/industriais inspecionadas; o Eixo tem incidência visual de gabarito aeronáutico sem altura local definida. Veja `ZONAS.md` e `dados/anotacao-eixo.json` / `anotacao-z2.json`.

As frentes registradas são segmentos retos de 16,773 m (Eixo) e 8,391 m (Z2), com distância máxima ao asfalto de 4,403 m e 1,874 m. **Não são a testada cadastral total:** a borda está fragmentada e a malha viária tem lacunas. A origem sintética/refeita limita o uso a simulação; ainda exige conferência de matrícula, alinhamento e testadas.

## Coordenadas e frente

Os vértices em longitude/latitude são transformados de EPSG:4326 para **SIRGAS 2000 / UTM 23S, EPSG:31983**, com `always_xy=True`. `fx/fy` não participa da transformação nem da escolha da frente.

`sao-carlos/dados/street_tris.json` contém 133.811 triângulos da malha viária, dos quais 127.332 são válidos e não degenerados. A origem local, orientação e escala vêm de `padrao/cidades/sao-carlos.json`: x cresce para leste e y para sul. A malha é convertida de volta para longitude/latitude e depois para EPSG:31983. Os valores locais têm arredondamento de 1 m.

Uma aresta é candidata a frente se mede pelo menos 8 m e os pontos de 15%, 50% e 85% do comprimento ficam a até 6 m da malha de asfalto. O lote é rejeitado se mais de 2% da área invade a malha. A frente escolhida é a candidata mais longa. Esquina exige duas candidatas com extremidades a menos de 2 m e ângulo entre 45° e 135°; isso é indicação geométrica, sem vistoria.

As demais candidatas estão em `qualidade.frentes`. **O Motor atual usa uma única `frente`**: o lote de esquina e outros com múltiplas testadas exigem revisão dos recuos antes de qualquer conclusão legal. A malha não confirma nome de rua, acesso de veículos ou alinhamento oficial.

## Verificação e reprodução

```powershell
python -I viabilidade/terreno/gerar_lotes.py --testar
python -I viabilidade/terreno/preparar_relevo.py --testar
python -I viabilidade/terreno/preparar_zonas.py --testar
python -I viabilidade/terreno/testar_pilotos.py
```

O primeiro comando verifica IDs, categorias, validade, áreas, frente na borda, ida/volta da projeção, correspondência dos vértices com a feição original convertida para EPSG:31983, separação dos pilotos e campos de enriquecimento quando preenchidos. A auditoria completa das bases já está gravada: não é necessário refazer a seleção. O gerador se recusa a sobrescrever `lotes-piloto.json`, para preservar zona e relevo.

`preparar_zonas.py` sem `--testar` aplica `dados/anotacoes-zonas.json`, conferindo o hash de cada polígono antes de escrever. A opção `--testar` valida as anotações e a igualdade da reaplicação, sem gravar. `preparar_relevo.py` sem argumentos reaplica o recorte local; `--baixar` obtém o recorte público novamente. Os dois enriquecimentos preservam os demais campos do Lote.

Se partir dos cinco pilotos da entrega 1 ainda no contrato v3, execute primeiro `python -I viabilidade/terreno/dados/zonas-anotar.py` e `python -I viabilidade/terreno/preparar_zonas.py`: isso faz a migração dos campos sem mudar os demais dados.

Para reproduzir a integração da tarefa 2, a partir dos cinco já migrados ao v4 ou dos sete pilotos:

```powershell
python -I viabilidade/terreno/dados/eixo-reproduzir.py
python -I viabilidade/terreno/dados/z2-reproduzir.py
python -I viabilidade/terreno/adicionar_pilotos.py
python -I viabilidade/terreno/dados/zonas-anotar.py
python -I viabilidade/terreno/preparar_zonas.py
python -I viabilidade/terreno/preparar_relevo.py
python -I viabilidade/terreno/testar_pilotos.py
```

Os reprodutores usam as imagens integrais já extraídas dos PDFs públicos e os controles salvos. Se as imagens locais não existirem, `dados/zonas-renderizar.py` as extrai dos PDFs indicados em `lei/FONTES.md`. Nenhuma leitura manual nova é feita automaticamente: os hashes das geometrias inspecionadas protegem as anotações. `adicionar_pilotos.py` acrescenta apenas os IDs ausentes e preserva enriquecimentos já existentes. `testar_pilotos.py` também compara os cinco objetos originais com os hashes do commit da entrega 1, descontando somente a migração v4.

`python -I viabilidade/terreno/testar_pilotos.py --reproduzir` executa essa sequência e compara SHA-256 antes/depois de dez JSONs, incluindo os lotes, anotações, geometrias e resumos de relevo. O teste passou com bytes idênticos na entrega v4.

Zoneamento e áreas especiais devem ser lidos com `ZONAS.md` e suas evidências. Relevo, download e limitações altimétricas estão em `RELEVO.md`. Nenhum desses dados substitui levantamento topográfico e consulta urbanística para o lote.

Validação final v4 em 14/11/2026: os comandos de teste passaram; os sete Lotes enriquecidos foram lidos por `gerar_estudo` do Motor, em memória, produzindo respectivamente 4, 3, 1, 4, 1, 4 e 4 opções. Isso comprova compatibilidade do formato, não aptidão legal: o Motor não aplica restrições sem altura numérica, usa uma testada e ainda assenta os volumes em terreno plano. As incidências ambiental, industrial e aeronáutica e as alternativas de zona continuam exigindo revisão.
