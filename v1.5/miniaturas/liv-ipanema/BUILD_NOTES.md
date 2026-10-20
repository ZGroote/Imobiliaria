# LIV Ipanema — miniatura do visualizador

Pedido: reconstruir o empreendimento o mais fiel possível às imagens oficiais,
usando o mesmo visualizador das miniaturas do Monte dos Cedros e fotos comparativas.

Fonte: https://www.livonincorporadora.com.br/produtos/liv-ipanema/

## Autoridade das referências

1. A implantação oficial controla o perímetro, relações entre volumes, lazer,
   estacionamento, entrada e bosque.
2. A fachada e a portaria oficiais controlam a silhueta, os cinco stacks de
   varandas no arranjo 2 + 1 + 2, os vãos, as cores e o núcleo bege descentrado.
3. A perspectiva aérea controla a lâmina, cobertura e vegetação.
4. As fotos específicas controlam a piscina, quiosques e equipamentos.

Dados oficiais: uma torre, 17 pavimentos, 170 apartamentos, 175 vagas,
terreno 6.921,79 m². A planta publicada de 47,59 m² é usada na planta 2D;
planta 3D e visita são ilustrações aproximadas daquela distribuição.

Dimensões da torre (47,7 × 12,7 m, repetição vertical 2,85 m) foram inferidas
por proporção da implantação e das perspectivas. Não são cotas oficiais.
Detalhes dos fundos e interiores não visíveis são inferidos. Sem unidade,
preço ou posição comercial inventados.

## Arquivos e reprodução

- `modelar_liv_ipanema.py`: torre, cinco stacks, esquadrias/guarda-corpos,
  cobertura e autoria com referências empacotadas.
- `modelar_implantacao.py`: geometria do conjunto a partir da implantação.
- `modelo.json`: geometria e instâncias avaliadas do Blender para o visualizador.
- `liv-ipanema.glb` e `liv-ipanema.blend`: modelos interoperável e de autoria.
- `gerar_pagina.py` e `liv-viewer.js`: extensões próprias em memória do template;
  preservam a fonte canônica do Cedros e a câmera livre.
- `referencias/`: cópias das imagens oficiais e manifesto de análise.
- `comparacoes/`: capturas reais do modelo e pranchas comparativas.
- `qa/`: evidências dos modos, pavimentos e telas.
- `empacotar.py`: pacote portátil com HTML, Blender/GLB, referências e fotos,
  com SHA-256 dos arquivos e verificação de integridade ZIP.

Blender 5.2.2 LTS em background, num processo isolado. A conexão MCP ao Blender
interativo não estava ativa. A autoria existente do usuário não é modificada.

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python v1.5/miniaturas/liv-ipanema/modelar_liv_ipanema.py -- --no-render
python v1.5/miniaturas/liv-ipanema/gerar_pagina.py
```

Para recalcular a luz da geometria atual, antes de montar a página:

```powershell
python v1.5/miniaturas/liv-ipanema/preparar_luz.py --size 4096
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --samples 64
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --output-guard 4
python v1.5/miniaturas/liv-ipanema/reparar_luz_exterior.py
python v1.5/miniaturas/liv-ipanema/gerar_pagina.py
```

Luz final calculada em Cycles/OptiX, GTX 1650, 4096², 64 amostras, 615,94 s.
O mapa calcula luz direta e indireta sem incorporar a cor dos materiais;
os materiais recebem a cor uma única vez no navegador. RGBM linear de alcance
16, bytes RGBA gzip, sem pré-multiplicar alpha. O carregador confere SHA-256
do modelo, dos UVs compactos e dos bytes descomprimidos do mapa. UVs de luz são
independentes para as 1.011 instâncias mapeadas. O RGBM transfere cerca de
13,02 MB gzip e aloca 64 MiB na GPU. A versão offline embute estes recursos.
Vidro, vegetação e metais recebem luz dinâmica; sombras ficam em cache até
mudanças de modo ou visibilidade. Não há simulação automática de luz para
alterações de geometria.

A limpeza usa OIDN RTLightmap 2.3.3 e uma margem de quatro pixels copiada do
vizinho ocupado mais próximo. Microfaces exteriores com área UV inferior a
dois pixels e amostras quase pretas recebem uma estimativa de um pano plano
compatível próximo. O reparo altera 18.304 texels (0,11% do atlas), preservando
UVs, geometria, interiores e faces grandes. A radiância original permanece
salva, e os critérios/contagens constam em `luz/guided-repair.json`.

Cada modelo tem sua própria geometria, UVs e iluminação. Nenhum mapa do Cedros
foi reutilizado. A página é uma entrega local; a publicação Firebase é uma etapa
separada que requer autorização do usuário, conforme AGENTS.md das miniaturas.

## Portões de validação

Contagem de torre/pavimentos/colunas de varandas e relações de implantação são
portões rígidos. O exportador confere valores finitos, normais, UVs, índices e GLB.
O visualizador deve abrir os quatro modos, retornar à torre, destacar pavimento
e mostrar conjunto/torre em desktop e largura móvel sem erro ou overflow.
Comparar imagens arquitetônicas alinhadas; uma SSIM de cenas com árvores,
fundos e luz distintos não representa fidelidade geométrica.

As quatro capturas finais são fotografias do canvas com DPR 2. A implantação
usa projeção ortográfica de topo para manter a escala da cobertura em relação
ao terreno. As demais vistas usam perspectiva e permitem órbita livre. O registro
`qa/capturas.json` identifica o atlas carregado e os hashes das fotos. As
pranchas usam recortes para igualar a escala; fotos originais são preservadas.
Após conferir visualmente as quatro vistas, executar `comparar.py`, regenerar
a página para embutir as capturas, e executar `empacotar.py`.

## Interior pelo construtor

`interior/construir-interior.ts` usa `modelo.ts` e `editorDocument.ts` do construtor,
com as operações de contorno, mesclagem, abertura e mobília. O projeto completo
é reaberto pelo carregador do editor para conferir o round-trip. A leitura e
os móveis percorrem `pipeline.gerar_maquete`; a página LIV conserva o `cadastro`
cru de `interior/previa/unidade.json`. Assim o consumidor é
`FloorPlan.plantaDaUnidade` / `HouseMesh` / `Openings` / `FurnitureCatalog`.
A planta manual anterior foi removida de `gerar_pagina.py`.

A captura possui seis ambientes, dez partes de contorno, seis portas,
quatro janelas e 29 entidades de mobiliário. Sala, jantar, cozinha e circulação
usam o contorno integrado do construtor. A navegação usa as mesmas paredes,
aberturas e footprints, com corpo virtual de 30 cm de raio. Uma conferência de
conectividade usa passo de 5 cm para não perder passagens estreitas pela amostragem.

`liv-interior.js` adapta as funções de acabamento V2: sofás e camas arredondados,
texturas de madeira, linho, pedra e reboco. Preserva as dimensões, cores e giros
do cadastro LIV. Não incorpora o layout, câmeras ou mapa de luz do Cedros.
A tela da TV é um subcomponente do rack registrado, sem nova entidade de leitura.
Os materiais guardam seu albedo anterior à oclusão dinâmica para exportação e
para impedir aplicação dupla da cor ou da sombra no mapa calculado.

A procedência e o registro da planta pública estão em `interior/referencia.json`.
`interior/comparativo-captura.png` é um desenho de conferência sobre a fonte;
as fotografias reais do canvas são identificadas separadamente na validação.
`empacotar.py` exige também `validacao-interior.json` aprovado, com hashes da
unidade, projeto, página final, iluminação e capturas. A aprovação do exterior
sozinha não libera a entrega.

O acabamento da faixa da cozinha divide somente a superfície do piso em
madeira e piso frio, com corte diagonal observado na foto. Os polígonos são
disjuntos e sua área soma a área original. Paredes, forro, seis centros de luz,
colisões e cadastro permanecem os mesmos. A adaptação usa o tipo semântico real
`pia` na fábrica de bancadas para gerar as cubas, a cor de pedra clara cadastrada
e a geometria circular da mesa de varanda, preservando a entidade e seu footprint.

As molduras do LIV são unidas por faixas colineares compatíveis antes do export:
30 faixas, zero pares sobrepostos no relatório da fonte final. Cantos
perpendiculares permanecem. Esse reparo usa posição e seção, sem índices de
geometria de outro imóvel.

## Luz própria do interior

`interior/exporter-interior.js` exporta exatamente as malhas montadas pelo
construtor/consumidores, inclusive forro escondido na vista de planta. O processo
Blender importa materiais, texturas e normais split; não reconstrói paredes.
`interior/preparar_luz.py` verifica atributos, fingerprints, índices/grupos e
abre UV1 por instância. Grupos padrão de BoxGeometry com material único são
normalizados para o material 0, conforme a semântica do Three.js. Triângulos
degenerados são descartados e o winding é alinhado às normais da fonte.

A fonte final possui 92 objetos, com 84 destinos de luz e 69.707 triângulos
mapeados. O xatlas produziu 3033×3032, normalizado para 2048²; o padding efetivo
é 5,402 pixels, com margem e proteção de dois pixels. Cycles calcula 512
amostras, cinco ricochetes difusos, DIRECT+INDIRECT sem COLOR. OIDN RTLightmap
limpa somente a irradiância, sem imagens auxiliares de albedo ou normal.
O transporte usa RGBM16 em bytes RGBA gzip, sem pré-multiplicar alpha ou gerar
mipmaps codificados. Os hashes de unidade, cena, UVs e textura são próprios.

A sequência reprodutível e os contratos estão em `interior/LUZ.md`. A aprovação
de geometria está em `interior/luz/approval.json`; o mapa só fica pronto após
o cálculo e a codificação. O runtime restaura o albedo anterior ao AO JS e
mantém a reflexão dinâmica. Alterações de mobília que invalidem o layout
calculado ativam o fallback dinâmico. A validação final confere isso e fotografa
o próprio canvas em topo, sala e suíte após o atlas carregado.

A revisão visual da primeira execução reteve o resultado por paredes escuras
e faixas no tapete. A causa das paredes era a normal lateral do prisma HM
voltada para dentro; a adaptação local corrige somente a malha de paredes e
rodapés, preservando as normais exteriores das esquadrias. O tapete tinha
relevos coplanares após arredondamento em centímetros; usa agora uma malha
única de tecido, com a mesma entidade, posição, cor e footprint cadastral.
`interior/auditar_cena.py` recusa essas duas condições antes de preparar os UVs.
Na fonte corrigida há zero faces verticais HM opostas e zero pares coplanares
do tapete. A planta do construtor e as outras posições permanecem iguais.

`interior/luz/bake.json`, `denoise.json`, `audit-runtime-payload.json` e
`audit-authoring.json` registram os custos e hashes da execução atual. O
transporte aloca 16 MiB na GPU. As quinze imagens de materiais aprovadas são
fixadas no runtime para que ruído procedural a cada carregamento não altere
o albedo que participou do ricochete da luz. Renders físicos de diagnóstico
confirmam a correção antes do cálculo definitivo; o gate final exige também
fotografias da planta, sala e suíte com o atlas ativo no navegador.

A execução corrigida levou 495,64 s em Cycles/OptiX, GTX 1650, e 9,06 s
para OIDN/proteção/codificação. O arquivo gzip tem 4.646.752 bytes. A radiância
máxima filtrada é 8,1895, sem clipping no alcance 16; o erro RGBM médio é
0,000240. A cena de autoria contém 71.783 triângulos em 92 malhas, todas com
normais; os 84 alvos têm UV1. `auditar_saida.py` confere hashes, gzip, valores
finitos e autoria GLB. O atlas decodificado tem SHA-256
`1f32fd51333c05cc2ca1405ce45ba529ca0e760e007f7a4fd6464c3c3539cbde`.
