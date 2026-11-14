# Diferença entre o Tour importado e o render aprovado

Feedback: a versão web da cozinha ficou saturada e com manchas, diferente do
render aprovado. A conferência anterior verificou carga e geometria, mas
encerrou cedo sem uma comparação visual suficiente da iluminação/reflexão.

## Evidência preservada

- `web-usuario.png` e `blender-referencia.png`: comparação fornecida pelo usuário.
- `rejeitado/`: screenshot, scripts, catálogo e HDR ativos antes da correção.
- `look-fit-before.json`: regiões de superfícies equivalentes, com câmeras
  diferentes; não é RMSE pixel a pixel nem prova de iluminação idêntica.
- `agx-probe-antigo.png`: teste isolado da transformação de cor, mantendo HDR.

## Causas comprovadas

1. O tampo é uniforme na fonte e no GLB. A/B de albedo sem luz deu diferença
   zero em 4.807 pixels do tampo. Cor, roughness e clearcoat foram preservados.
2. O probe de 16 amostras sem denoise tem 51% dos pixels com luminância zero;
   picos locais representam 26,6% da energia. Esse HDR foi usado para reflexos
   lisos e clearcoat, espalhando a granulação sobre mesa e forno.
3. O probe único foi capturado junto à sala de estar. Reutilizá-lo como reflexo
   em toda a cozinha ignora a posição do objeto em relação às janelas e paredes.
4. O display da web usava ACES, enquanto o render usa AgX / Medium Low Contrast.
   Copiar materiais não transporta a transformação de cor entre renderizadores.
5. O ganho 8 aplicado ao IBL, derivado de +3 EV, é uma aproximação de exposição
   desse termo. Não equivale a aplicar +3 EV globalmente a todo o render.
6. Cortinas, pendente, fruteira e ripas do painel já existiam na fonte aprovada,
   mas não estavam incluídos nos primeiros 13 GLBs.

Na ROI do tampo, saturação média web = 0,1793 e referência = 0,02157.
Na parede, web = 0,1279 e referência = 0,1269. Dessaturação global não corrige
essa distribuição; é preciso corrigir a origem dos reflexos.

## Critérios da correção

- Fonte `.blend` e materiais aprovados preservados, sem retocar albedos.
- Probe com mais amostras e OIDN; reflexo local próximo ao tampo na cozinha.
- Família de transformação AgX na web; nenhum filtro global de saturação.
- Complementos exportados da fonte, sem remodelar ou adicionar lâmpadas diurnas.
- Conferência de mesa, forno, madeira e parede, além da ausência de erros.
- Horário reversível e luzes noturnas continuam funcionando.
- A imagem do Blender continua sendo referência visual; o Tour em tempo real
  não faz o transporte de luz completo do Cycles nem recalcula GI por hora.

Diagnósticos detalhados e A/B em
`experimentos/liv-luz-natural-2026-10-26/fontes/materiais-web/` e
`experimentos/liv-luz-natural-2026-10-26/fontes/diagnostico-transporte-web/`.

## Correção integrada

- Sala e jantar: probes 1024 × 512, 128 amostras + OIDN, com fonte e exposição
  linear preservadas. Picos locais de ruído da sala: 24.020 → 5; luminância
  média variou somente -0,073%. A cozinha usa o probe capturado junto ao tampo.
- Mantidos cor, rugosidade, normais e clearcoat aprovados, sem dessaturação global.
- Exportadas as cortinas, pendente/cabo, fruteira e 28 ripas da fonte: quatro
  GLBs complementares, com erro de pose abaixo de 0,00018 mm.
- Look AgX / Medium Low Contrast transferido do OCIO para LUT logRGB 64³.
  O teste contra o Blender, fora da grade, mediu erro médio de display de
  0,040% e máximo de 0,617%. A web faz uma única conversão final para sRGB.
- `atualizar-catalogo-melhorias.mjs` refaz o catálogo de forma idempotente,
  conferindo hashes, para preservar complementos/probes/Look em novos exports.

O Look transfere a transformação de cor, não o transporte completo de luz.
O ganho de IBL e os probes estáticos continuam aproximações. A fonte do Blender
permanece intacta, e não foi feita publicação ou alteração de estado comercial.
