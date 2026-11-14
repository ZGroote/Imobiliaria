# LIV — renderização Blender, 26/10/2026

**Status visual: esta versão foi rejeitada pelo usuário.** O relatório `aprovado`
registrava apenas verificações técnicas, insuficientes para aprovar a apresentação.
Veja as correções e regras de prevenção em
`../liv-render-revisao-2026-10-26/DIARIO_DE_QUALIDADE.md`.

## Fonte e entrega

Fonte efetivamente exportada: `../liv-sketchup-2026-10-26/entrega/LIV_Ipanema_Conecta.skp`.
O modelo corresponde à versão publicada em <https://conectaimoveis3d.com.br/maquetes/liv/>,
com os móveis da SketchUp Content Library e os materiais nativos aplicados na etapa anterior.
O manifesto em `fontes/reference_manifest.json` registra os SHA-256 da origem e do snapshot.

`entrega/LIV_Ipanema_Render.blend` contém as três cenas, câmeras e texturas incorporadas.
As imagens são `LIV_exterior.png`, `LIV_apartamento.png` e `LIV_sala.png`.

## Processo

1. Exportação direta pela API do SketchUp: 120 definições de malha, 944 objetos
   instanciados, 119 materiais e 29 imagens de cor. UVs, normais, matrizes e unidades
   foram transferidos; as posições são dadas em metros, com Z para cima.
2. Importação no Blender 5.2.3 LTS, mantendo as instâncias. O modelo aberto do usuário
   no SketchUp não foi alterado pela exportação.
3. Materiais de vidro, água, tecidos, madeira, metal e reboco receberam parâmetros
   adequados ao Cycles. As imagens de cor exportadas preservam as tonalidades aplicadas
   no SketchUp; mapas numéricos usam Non-Color.
4. Câmeras de apresentação para condomínio e planta decorada, além da perspectiva da
   sala/jantar. Céu físico e sol suave no exterior; luzes de janela e plafons no interior.
5. Prévias em Cycles e revisão visual antes das imagens finais.

## Recorte da planta

A prévia inicial revelou topo irregular nas paredes cortadas da malha transferida.
As evidências iniciais e o `.blend` correspondente foram preservados em `previas/v01/`.
Apenas as paredes da cena de planta foram refeitas a partir dos mesmos polígonos de
cômodos e das mesmas portas/janelas de `unidade.json`: espessura de 16 cm e corte a
1,15 m. União 2D e triangulação restrita produzem tampas contínuas, sem preencher os
vazios dos cômodos. A cena completa de interior continua usando a geometria exportada.
O reparo empregou métodos geométricos existentes; não foi necessário alterar skills.

A primeira passagem revelou também reflexos de metal em materiais comuns. A origem
foi interpretar fatores padrão de mapas do SketchUp como proporção metálica. A conversão
agora atribui comportamento metálico somente a metais identificados; madeira, tecidos,
pedra, água e reboco permanecem dielétricos. A validação do `.blend` confere esse ponto.

## Renderização

- Cycles na NVIDIA GeForce GTX 1650, com CUDA.
- Exterior: 2560 × 1600, até 192 amostras.
- Planta decorada: 2400 × 2000, até 192 amostras.
- Sala/jantar: 2048 × 1280, até 256 amostras.
- Amostragem adaptativa, OpenImageDenoise, gerenciamento de cor AgX e PNG RGB de 16 bits.
- As configurações de GPU foram aplicadas somente aos processos de renderização;
  não foi gravada uma preferência global do Blender.
- O `.blend` entregue abre pela câmera, com renderização por CPU como padrão
  portátil. O script ativa CUDA ao gerar imagens; o guia explica como usar a GPU
  pela interface, sem depender de preferências globais gravadas nesta sessão.

As dimensões permanecem as da maquete ilustrativa original. Esta entrega é um conjunto
de renders e um projeto Blender editável, não um projeto executivo.

## Reproduzir

`exportar_sketchup.rb` é executado pela ponte MCP local já instalada, usando o helper
`../liv-sketchup-2026-10-26/sketchup_mcp.py`.

`preparar_corte.py` usa Shapely 2.1.2 já instalado para a geometria da apresentação.
`renderizar_liv.py` é executado pelo Blender em segundo plano:

```text
blender --background --factory-startup --python-exit-code 1 --python renderizar_liv.py -- --mode build
blender --background --factory-startup --python-exit-code 1 --python renderizar_liv.py -- --mode draft --shot all
blender --background --factory-startup --python-exit-code 1 --python renderizar_liv.py -- --mode final --shot all
blender --background --factory-startup --python-exit-code 1 --python renderizar_liv.py -- --mode finish
```

Os diretórios de saída e de trabalho são ignorados pelo Git. Os scripts e estas notas
permanecem sem commit.
