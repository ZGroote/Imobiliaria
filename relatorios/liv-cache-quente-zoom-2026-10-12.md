# LIV: cache quente e zoom da planta 2D

As visualizações são preparadas após a primeira maquete utilizável e permanecem em memória durante a navegação. O cache contém uma cena exterior, os interiores Canto e Meio, o mapa e duas plantas 2D decodificadas. Planta 3D e Tour compartilham o interior da tipologia selecionada, com as duas apresentações renderizadas durante a preparação.

Ao trocar de tela, a cena anterior pausa sua renderização e conserva câmera, móveis e controles. O mapa conserva também a busca e os filtros. As imagens mantêm zoom e deslocamento separados por tipologia. Os contextos permanecem no mesmo lugar do DOM para evitar recarregar os iframes. O limite é de quatro iframes e duas imagens; sair da página libera os recursos. Recarregar a página prepara novamente os contextos gráficos.

Cadastros validados são reutilizados, consultas opcionais pendentes são compartilhadas e falhas podem ser tentadas novamente. A assinatura de estoque continua recebendo atualizações. Uma cena com erro é retirada individualmente do cache. Uma falha ao retomar nunca marca uma tela vazia como pronta.

A planta 2D tem botões de ampliar/diminuir, roda do mouse, pinça, arraste e duplo clique. O teclado aceita `+`, `−`, setas e `0`/`Home`. **Centralizar** restaura o enquadramento em 100%; a ampliação chega a 600%. Os controles continuam disponíveis com as informações minimizadas e o enquadramento acompanha o espaço recuperado.

Os scripts de entrada e o CSS têm revisão explícita para evitar que o navegador reutilize código anterior ao novo ciclo de vida. A montagem de entrega reconhece referências com parâmetros de revisão e inclui os novos módulos `planta2d.js` e `frame-scheduler.js`.

## Validação

- Suíte Node completa: 99 testes passaram. Após o reforço do tratamento de falha na retomada, os 34 testes de fluxo/cache/zoom passaram, incluindo um caso novo: 100 testes distintos verificados nesta etapa.
- Empacotamento Python: 5 testes passaram; inventário real de 240 recursos inclui o controlador 2D e o adaptador/suspensão do mapa.
- Navegador real: apartamentos 1110 (Canto) e 1108 (Meio), Planta 2D, Planta 3D, Tour e retorno à maquete. As quatro instâncias permaneceram com identificadores `1`, `2`, `3`, `4` em todas as trocas.
- O mapa manteve a consulta `farmácia` após fechar/reabrir; a consulta de teste foi limpa.
- Botões, roda, teclado e arraste 2D conferidos no navegador. Arraste a 244% produziu deslocamento de 120 × 60 px. Pinça e limites de deslocamento foram verificados com eventos de ponteiro nos testes.
- Larguras de 320, 768 e 1024 px sem rolagem horizontal; controles com altura de 44 px. O tamanho de teste foi restaurado.

Reabertura da maquete a partir da planta 2D, três repetições na mesma prévia local:

| Medição | Antes | Depois |
|---|---|---|
| Tempos | 3117, 3120, 3124 ms | 990, 935, 1005 ms |
| Mediana | 3120 ms | 990 ms |
| Ciclo de vida | Exterior recriado após sair | Mesma instância reutilizada |

Os tempos incluem clique e observação pela automação; não representam uma medição isolada do desenho pela GPU. A manutenção das mesmas instâncias confirma diretamente a eliminação da reconstrução das telas.

Prévia: `http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html`.

Captura final: `C:/Users/respawn/.codex/visualizations/2026/10/12/01a1311e-28a6-7871-82c2-c70259fc03b9/liv-cache-quente-planta2d-zoom.jpg`.
