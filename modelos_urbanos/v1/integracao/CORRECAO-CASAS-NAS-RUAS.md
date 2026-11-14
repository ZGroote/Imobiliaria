# Construções sobre ruas — 09/09/2026

Reproduzido por auditoria da base completa de São Carlos: 706 dos 96.168 polígonos
de construções cruzam a área desenhada das vias (9.292 registros de ruas). A medida
usa a largura de `ROAD_W` e inclui os remendos quadrados nos nós internos que
`buildRibbons` desenha. Exemplos ficam em `auditoria-sobreposicao.json`.

O encaixe da biblioteca verificava somente o polígono da construção. Se esse
polígono já cruzava uma rua, o modelo poderia caber nele e ainda invadir a pista.
No caminho procedural, beirais de até 1,05 m criavam uma segunda possibilidade
de avanço, mesmo quando as paredes não tocavam a rua.

## Correção

- Índice espacial global das vias renderizadas, independente das regiões visíveis
  e da arborização. Margem lateral de segurança de 15 cm.
- Antes de montar uma região, omitir volumes genéricos cujo polígono invade a via.
  O mesmo filtro vale para modelos da biblioteca e para o caminho procedural.
- Reduzir beiral conflitante a zero; se até o retângulo do telhado sem beiral invade
  a rua, usar cobertura plana sobre o anel original das paredes.
- Recortar muros genéricos nos intervalos que cruzam ruas, mantendo os trechos
  restantes e as cores originais. A criação dos muros passa a ocorrer após a
  montagem do índice viário; numa recarga, o recurso anterior é descartado.
- Preservar registros e coordenadas da base e os volumes explicitamente modelados
  (`lancamento`, `parede`, `sacadas`). Não mover casas para endereços inventados nem
  editar os cadastros para corrigir uma representação ilustrativa.

Isso corrige a representação local. Os polígonos de origem ainda precisam de uma
revisão do processo que os gerou; a auditoria registra o problema para essa etapa.
Não foi realizada publicação.

## Verificação

`testar_colisao_ruas.mjs`: contenção em ambas as direções, cruzamento apenas pelas
arestas, fronteiras do índice espacial, remendos de cruzamento, polígonos côncavos
e recorte de um muro preservando as duas pontas fora da rua.

`testar_browser.py colisao`: região da Avenida da Liberdade, com ida/volta do
streaming, relevo, seleção e comparação das escolhas de modelos. Confere os modelos
instanciados, registros procedurais, triângulos de cobertura e centros dos trechos
de muro. Resultados ficam em `colisao.log` e a imagem em `colisao.png`.

Comparação anterior: `colisao-antes.png`. Fontes e página anteriores à correção
foram copiados para `antes/`.
