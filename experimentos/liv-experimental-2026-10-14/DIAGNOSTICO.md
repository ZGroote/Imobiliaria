# Teste no aparelho

[Abrir o coletor local](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/diagnostico.html). A página acompanha o visualizador normal e não muda iluminação, resolução, colisões ou prioridade dos downloads. Nenhuma informação é enviada automaticamente; o operador baixa um JSON. Em celular, usar uma hospedagem HTTPS ou `adb reverse tcp:8790 tcp:8790` para acessar o servidor por `127.0.0.1`. HTTP pelo IP da rede não qualifica WebGPU/crypto/service worker.

O caso relatado é Poco X6 5G / Android 13 / Chrome 154.0.8037.127, com pausas durante caminhada na publicação antiga. A ausência de aparelho conectado continua pendente. Os testes deste diretório não comprovam correção no Poco.

## Procedimento

1. Preencher aparelho, ambiente físico/emulado/computador, rede e condição de cache. Cache é declarado pelo operador; a ferramenta não apaga o cache nem certifica uma abertura fria.
2. Abrir a entrada revisada em renderização automática. Anotar o backend efetivo no relatório; renderização forçada também pode falhar em um aparelho sem suporte.
3. Medir giro na maquete, caminhada de Canto e caminhada de Meio, pelo menos 15 segundos cada. Usar controles/rotas reais. Giro no lugar não prova caminhada; o relatório registra deslocamento entre início e fim, que também pode ser zero ao retornar ao ponto de partida.
4. Abrir ambas as plantas 2D/3D e alternar entre os quatro modos. Registrar pausas, falhas, posição e condição percebida. Para comparar com a publicação antiga, repetir a mesma rota nela separadamente; “Base da evolução” usa o renderer novo e não é a publicação antiga.
5. Repetir três rodadas comparáveis e uma rodada forçando WebGL2. No iPhone, registrar versão do Safari, aparelho e backend. Baixar cada relatório para avaliação com as evidências desktop.

## Interpretação

O relatório permanece `pendente-de-revisao`, inclusive quando todos os trechos terminam. `physicalDevice` é uma declaração do operador, nunca deduzida do tamanho da tela ou user agent. Mudança de modo/planta durante um trecho é marcada como interrupção. O arquivo registra falhas em vez de promover a coleta a homologação automática.

`submissionIntervalMs` é a cadência entre chamadas ao renderer; `cpuSubmitMs` mede a duração síncrona dessas chamadas. Não são execução GPU ou FPS garantido. Intervalos ocultos são excluídos da distribuição e somados separadamente. Há no máximo 12.000 amostras por trecho, com descartes registrados.

`memoryPeakSampled.rendererTrackedBytes` é a contabilidade do Three.js r186, amostrada a cada 250 ms. `jsHeapEstimateBytes` depende da API não padronizada do Chromium; ausência fica `null`. Não somar esses números como memória total: não medem toda a VRAM, memória do navegador nem pico exato. Tempos de recursos de documentos não cobrem integralmente os downloads do Service Worker; valores zerados não significam ausência de tráfego.

As referências de APIs foram conferidas em [Three.js Info](https://threejs.org/docs/pages/Info.html), [Performance.memory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory) e [ResourceTiming.transferSize](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/transferSize), além do código local fixado.

## Verificação do coletor

`node --test test_diagnostic_recorder.mjs` verifica percentis, amostra vazia, limites, exclusão de intervalos ocultos, restituição do método original e deslocamento. `python qa_diagnostico.py --saida evidencias/diagnostico-aparelho-final` abre o produto normal em WebGPU, WebGL2 e toque emulado, exercita cinco trechos e confere a exportação. Amostras curtas bastam para verificar a coleta; não qualificam cadência sustentada ou memória física. A primeira rodada de QA exigia 30 chamadas em uma amostra de 1,2 s também após troca de modo: a planta 3D teve seis chamadas reais. Esse dado não era uma falha do coletor. O requisito de movimento e 30 chamadas permanece nos tours; as distribuições da coleta preservam também amostras parciais.
