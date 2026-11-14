# Miniatura LIV Ipanema

Abra `maquete-liv-ipanema.html` no navegador para explorar a miniatura. O arquivo
inclui o modelo, a iluminação e as referências; não precisa de um servidor.

Arraste para girar, use a roda do mouse ou dois dedos para aproximar e escolha
`Ver conjunto` para mostrar a implantação. Os botões de vista alinham fachada,
vista aérea, portaria e implantação. `Fotografar PNG` salva a vista atual.

Em `Fotos comparativas e referências`, cada referência oficial aparece ao lado
da captura da miniatura. A pasta `comparacoes` contém as pranchas do exterior
e as conferências do interior. `liv-ipanema.blend` permite editar a autoria no Blender;
`liv-ipanema.glb` contém a geometria e os materiais para outros visualizadores.
A iluminação calculada está incorporada à página HTML.

Reconstrução baseada nas imagens da
[Livon Incorporadora](https://www.livonincorporadora.com.br/produtos/liv-ipanema/).
Uma torre, 17 pavimentos, cinco colunas de varandas e a organização do terreno
foram conferidos com as referências. Medidas lineares, detalhes ocultos e
interiores são aproximados. A planta oficial de 47,59 m² aparece no modo 2D.
O interior 3D é gerado pelo construtor de plantas existente, a partir dos
contornos, portas, janelas e posições de móveis observados nessa planta.

Para editar o apartamento, abra `interior/projeto-planta.json` em **Abrir projeto**
no construtor. A leitura, os móveis, o contexto e o relatório do pipeline estão
na mesma pasta. Os seis ambientes incluem a sala, jantar, circulação e cozinha
em um contorno integrado, sem divisórias entre esses usos. A escala foi aplicada
uniformemente; o pé-direito de 2,70 m é inferido. A área nominal de 47,235 m²,
medida entre eixos de paredes, tem uma base diferente da área publicada.

O acabamento usa as funções de móveis arredondados e materiais do padrão
aprovado do produto, com o cadastro e as dimensões do LIV. A geometria e a
iluminação do apartamento pertencem a esta maquete.

`interior/luz/interior-source.blend` e `interior/luz/interior-source.glb` contêm
as malhas reais do apartamento exportadas do visualizador, com materiais,
texturas e UVs próprios. A versão com a iluminação calculada fica em
`interior/luz/interior-baked.blend`; a página HTML incorpora o mesmo atlas.
Ao editar os móveis na página, a luz muda para o cálculo dinâmico até o layout
corresponder novamente ao que foi calculado.

Entrega local em 8 de outubro de 2026.
