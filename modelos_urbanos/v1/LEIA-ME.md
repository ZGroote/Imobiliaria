# Biblioteca urbana: 60 modelos externos

20 casas térreas, 20 sobrados e 20 prédios residenciais, fictícios e com arquitetura variada. Para ambientação ilustrativa do mapa, não para representar a fachada real de um endereço ou avaliar sua vista/insolação.

## Arquivos

- `biblioteca_60.blend`: biblioteca editável, organizada em coleções. Os modelos LOD0 estão marcados como assets do Blender. LOD1 fica em coleções ocultas.
- `glb/`: 60 modelos com mais detalhe.
- `glb_lod1/`: 60 versões simplificadas das mesmas construções.
- `fbx/`: 60 modelos LOD0 para intercâmbio com ferramentas como Unreal.
- `catalogo.json`: categoria, nome, pavimentos, dimensões externas, triângulos e caminho dos modelos.
- `casas-catalogo.jpg`, `sobrados-catalogo.jpg`, `predios-catalogo.jpg`: prévias de todos os modelos.
- `previas/`: renders individuais e vistas traseiras de 15 modelos da amostra.
- `validation/glb_report.json`: validação dos arquivos GLB reabertos com glTF-Transform.

## Uso no mapa

Cada GLB possui uma malha, com até dois grupos de material: envelope fosco e vidros opacos mais polidos. As cores estão no atributo `COLOR_0`, sem texturas externas. É necessário preservar as cores dos vértices ao substituir materiais.

Compartilhe a geometria e os materiais entre instâncias. Agrupe as instâncias por variante, material, nível de detalhe e região. Carregue somente regiões necessárias; os 60 arquivos não precisam ser baixados ao abrir um anúncio. Uma malha com dois materiais não equivale a uma única chamada de desenho; separar suas primitivas para instanciamento pode ser necessário no Three.js.

Escolha o modelo por categoria, altura, largura e profundidade compatíveis com o lote, e mantenha a escolha estável por endereço. Ajuste principalmente a rotação. Escalas exageradas deformam portas/janelas. As dimensões do catálogo incluem sacadas, beirais e marquises, não representam área útil nem tamanho de terreno.

Blender: metros, Z para cima, fachada principal para -Y. GLB: metros, Y para cima, fachada para +Z. Origem no chão; centro horizontal da versão LOD0. LOD1 usa a mesma origem. Os deslocamentos de exposição da biblioteca `.blend` não aparecem nos GLBs e FBXs individuais.

O modelo simplificado é arquivo separado. Carregar ambos simultaneamente causa sobreposição: a aplicação deve escolher um por distância/tamanho em tela. Distâncias de troca e capacidade de instanciamento ainda precisam ser medidas no portal e nos aparelhos-alvo.

## Blender e Unreal

Abra `biblioteca_60.blend` e selecione a coleção de interesse. Os objetos LOD0 também podem ser acessados pelo Asset Browser ao adicionar esta pasta como biblioteca.

No Unreal, importe os FBXs e preserve as cores de vértices. Para reproduzir a paleta, use `Vertex Color` ligado a `Base Color`; roughness de referência: envelope 0,77 e vidro ilustrativo 0,24. Vidros são opacos de propósito; não há interior atrás deles. A importação no Unreal não foi validada nesta entrega. GLB também pode ser usado conforme o importador instalado.

## Reconstrução

`gerar.py` é executado pelo Python do Blender, em uma sessão separada. Sem argumentos gera as prévias. `--preview` limita aos 15 modelos de amostragem; `--export` gera GLBs, FBXs, catálogo e `.blend`. A geometria é calculada antes da publicação: o portal consome os modelos prontos.

`montar_catalogo.py` usa Pillow para montar os catálogos a partir dos renders reais. `validar_glb.mjs` usa o glTF-Transform já instalado no projeto para conferir os GLBs exportados.

Esta edição é uma biblioteca inicial de exteriores simplificados, sem UVs artísticas ou texturas fotográficas, colisões dedicadas ou interiores. O material é editável e as UVs planas por face estão disponíveis para evoluções futuras. Nenhuma integração ou publicação do portal foi feita.
