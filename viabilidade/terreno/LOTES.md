# Cinco lotes de ensaio

Continuação em 14/11/2026, preservando a seleção e as geometrias já entregues. Dados em `lotes-piloto.json`; auditoria reproduzível em `gerar_lotes.py` e resultado completo em `dados/qualidade-lotes.json`.

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

Todos têm origem `planta`, geometria válida sem buracos, ocupação de pelo menos 70% do retângulo mínimo e nenhuma sobreposição com vizinho válido acima de 0,1 m². As propriedades de origem ficam preservadas, inclusive texto com codificação defeituosa. Não há `lid` nesses registros: `lid: null` é intencional e o ID usa o índice da feição mais o hash da base na auditoria para rastreio.

O gerador priorizou origem `planta` e depois proximidade ao centro configurado. **A preferência por áreas centrais foi atendida apenas parcialmente:** os grandes são mais afastados. Não foi comprovada verticalização, uso permitido, disponibilidade, matrícula ou aptidão de incorporação; o CEAT exige atenção ao uso e às restrições próprias do loteamento. São geometrias para ensaiar o motor, não ofertas de terreno aprovadas.

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
```

O primeiro comando verifica IDs, categorias, validade, áreas, frente na borda, ida/volta da projeção, correspondência dos vértices com a feição original convertida para EPSG:31983, separação dos pilotos e campos de enriquecimento quando preenchidos. A auditoria completa das bases já está gravada: não é necessário refazer a seleção. O gerador se recusa a sobrescrever `lotes-piloto.json`, para preservar zona e relevo.

`preparar_zonas.py` sem `--testar` aplica `dados/anotacoes-zonas.json`, conferindo o hash de cada polígono antes de escrever. A opção `--testar` valida as anotações e a igualdade da reaplicação, sem gravar. `preparar_relevo.py` sem argumentos reaplica o recorte local; `--baixar` obtém o recorte público novamente. Os dois enriquecimentos preservam os demais campos do Lote.

Zoneamento e áreas especiais devem ser lidos com `ZONAS.md` e suas evidências. Relevo, download e limitações altimétricas estão em `RELEVO.md`. Nenhum desses dados substitui levantamento topográfico e consulta urbanística para o lote.

Validação final em 14/11/2026: os três comandos de teste passaram; os cinco Lotes enriquecidos também foram lidos por `gerar_estudo` do Motor, em memória, produzindo respectivamente 4, 3, 1, 4 e 1 opções. Isso comprova compatibilidade do formato, não aptidão legal: o Motor não aplica restrições sem altura numérica, usa uma testada e ainda assenta os volumes em terreno plano. As incidências ambiental, industrial e aeronáutica e as alternativas de zona continuam exigindo revisão.
