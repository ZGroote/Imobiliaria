# Montagem da geometria — 11/10/2026

O exterior usa `Uint8Array.fromBase64` quando disponível e conserva o decoder anterior com `atob` nos demais navegadores. A montagem real da geometria da entrada passou de aproximadamente 150–200 ms para 40–60 ms no controle desktop. São os mesmos 327 buffers e 18.305.112 bytes descomprimidos; tipos, tamanho, materiais, UV, matrizes e conferências de integridade permanecem exigidos. Esta revisão atua na inicialização do exterior, incluindo seu retorno dos outros modos.

O ganho demonstrado é o tempo de CPU dessa etapa. A abertura completa varia com download, preparação dos gráficos, cache e aplicações concorrentes. Os ensaios usam Chrome 154.0.8037.98, Windows, GTX 1650 e loopback, sem controle do cache do driver. Não demonstram FPS, bateria, pico de VRAM ou o comportamento do Poco X6 físico.

## Controle de disponibilidade da API

[Medição A/B](evidencias/medicao-buffers-ab/medicao.json): três rodadas, ordem alternada, Chrome novo por braço/backend/rodada, frio e reload no mesmo contexto, canvas 720×390/DPR 1. O braço manual torna a API indisponível e executa o fallback real; o outro conserva a API e conta suas chamadas. Não há interceptação HTTP. A montagem é delimitada por `geometryStart` e `geometryReady`, incluindo bounds e criação das instâncias. A fila é pausada após a primeira cena utilizável.

| Backend / cache | Montagem manual | Montagem nativa | Redução de tempo |
|---|---:|---:|---:|
| WebGPU frio | 159,2 ms | 43,0 ms | 73,0% |
| WebGPU reload | 162,1 ms | 43,4 ms | 73,2% |
| WebGL2 frio | 176,6 ms | 47,5 ms | 73,1% |
| WebGL2 reload | 146,3 ms | 41,6 ms | 71,6% |

A etapa melhorou em todos os 12 pares de cache/backend/rodada, além da variação observada. A abertura completa desse controle teve medianas WebGPU de 3.040→3.082 ms frio / 2.850→2.642 ms reload, WebGL2 de 3.329→3.298 / 2.303→2.170 ms. Houve pares de abertura piores; não atribuir o tempo total a essa etapa nem anunciar um ganho uniforme de abertura.

[Controle com CPU desacelerada 4×](evidencias/medicao-buffers-cpu4/medicao.json): duas rodadas sob o mesmo método, oito pares de cache/backend/rodada. Montagem WebGPU 821,5→286,4 ms frio / 779,7→180,5 ms reload; WebGL2 779,3→256,9 / 707,3→207,1 ms. São reduções de 65–77%, com ganho em todos os oito pares. O throttling não emula uma GPU móvel nem qualifica um aparelho.

## Página completa sem intervenção

[Medição integrada](evidencias/medicao-buffers-integrada/medicao.json): 15 pares/30 amostras, três rodadas por variante, Chrome novo por rodada, frio/reload no mesmo contexto, reflexos preparados, canvas 720×390, amostra de órbita de 4 s. Nenhum contador/seleção de decoder é injetado. As identidades dos modelos, backend efetivo e ausência de fallback do ambiente são conferidas.

| Variante | Conteúdo inicial único | Mediana fria | Mediana reload |
|---|---:|---:|---:|
| Base pública preservada r168 | 38.378.801 bytes | 4.291 ms | 2.826 ms |
| Contorno WebGL2 | 20.014.028 bytes | 3.707 ms | 2.374 ms |
| Contorno WebGPU | 20.014.028 bytes | 2.954 ms | 2.807 ms |
| Entrada WebGL2 | 20.061.213 bytes | 3.513 ms | 2.400 ms |
| Entrada WebGPU | 20.061.213 bytes | 3.266 ms | 2.717 ms |

Neste lote, as duas edições/backend passam no teto provisório de abertura fria do desktop e têm reload mediano abaixo da base. Entrada: −18,1% frio/−15,1% reload em WebGL2, −23,9%/−3,9% em WebGPU. Conteúdo inicial −47,7% contra a base e +165 bytes contra a revisão das instâncias. Não comparar esses valores absolutos com lotes anteriores: a própria base também variou. Em [INSTANCIAS.md](INSTANCIAS.md), o reload WebGPU estava 24,5% acima da base; os novos dados não isolam toda essa diferença como efeito do decoder.

Após a amostra, entrada mantém 16 programas, nove texturas, 58 geometrias e os mesmos bytes contabilizados pelo renderer: 120.032.185 WebGL2 / 120.039.358 WebGPU. Esses contadores não são pico de VRAM. Intervalo p95 de submissão de aproximadamente 7–9 ms também não é tempo GPU/FPS.

T05 continua parcial: memória, rede/hospedagem e aparelhos físicos precisam ser qualificados. A entrada e o contorno continuam opcionais. A fila mantém 141 arquivos / 37.830.820 bytes, versão `03204482b5e3d8c2c0f74a7951118e290b6e0aaaf3810fc2b98fb00623c87ba5`, com Tour → mapa → Planta 2D depois da abertura e preempção por demanda. O renderer inicial não integra seu catálogo; este incremento não muda seus recursos.

## Verificação funcional e de imagem

[Decoder nativo](evidencias/buffers-paridade-nativa-qualificada/runtime.json) e [API ausente/fallback](evidencias/buffers-paridade-fallback-qualificada/runtime.json): nove casos em cada ensaio, original/contorno/entrada × WebGPU/WebGL2/toque emulado. Comparação contra o renderer Git `40317f5`, com mesma câmera, modelo, atlas e ambiente. As 99 capturas nativas são idênticas; as 99 do fallback têm diferença máxima de 1/255. A interceptação HTTP desse QA desativa cache, portanto seus tempos não são benchmark.

Os snapshots conferem 265 buffers estáticos por original/contorno e 270 por entrada (posição, normais, UV, índices e outros atributos), além das matrizes/contagens de todas as instâncias e materiais. A conversão de pequenos inteiros para 32 bits realizada por `WebGPUAttributeUtils` r186 é verificada por valores/hash na representação de destino, inclusive primitive restart; a fonte também tem hash próprio. Cores mutáveis do pavimento têm conferência específica, junto da seleção do final, vistas, movimento/restauração de uma esquadria e descarte único dos recursos. Nenhum shader de acabamento foi reescrito.

[Controle da referência contra ela mesma](evidencias/buffers-controle-referencia/runtime.json): três pares com o mesmo código Git `40317f5`, original/toque, 33 comparações RGBA idênticas. Depois das mesmas vistas/seleção/movimento, o inventário de programas variou 24/24, 24/24 e 24/22. A origem da variação não foi isolada. Igualdade ou ausência de aumento por execução era uma exigência imprópria no novo QA do decoder; suas primeiras execuções pararam nesse contador apesar de pixels/buffers iguais. O modo `registrar` mantém o inventário como diagnóstico. Os critérios obrigatórios desse QA são conteúdo, materiais, imagem, interação e descarte. O modo padrão `reducao` conserva a exigência anterior da otimização de instâncias. Não prometer igualdade temporal desse contador, ganho de compilação ou memória pico. O controle precede somente a adição dessa opção de CLI; o helper de captura/conferência é o mesmo.

[Fluxos integrados](evidencias/unidades-buffers-final/runtime.json): três perfis aprovados com os dez finais por lista/teclado/gestos, seleção/recorte, Canto e Meio independentes em Planta 2D/3D e Tour, sessão/câmera, retorno da maquete e liberação de recursos. Três falhas de cadastro recuperadas; retorno normal e links de falha do mapa preservam seleção/edição.

[Fila com os 141 recursos reais](evidencias/fila-buffers-final/runtime.json): cinco casos aprovados. A primeira cena precede as transferências de fundo, solicitação do usuário preempta/resume a fila, GLB da edição solicitada precede as outras edições/tiles, quota de cache indisponível e ausência de worker conservam a recuperação. A ordem e o catálogo permanecem preservados.

Checks de sintaxe JavaScript/Python, consistência dos hashes dos relatórios finais e `git diff --check` aprovados. Fotografias, geometria/bake, atlas de irradiância e GLBs existentes permanecem as fontes qualificadas anteriores; esta revisão não muda a aparência proposta nem confirma associação/espelhamento de tipologia por final. Não houve publicação.

## Recarga e hipótese descartada

O [perfil antes do decoder](evidencias/perfil-reload-instancias/perfil.json) registra um ciclo frio/reload dos dois backends, interface completa e renderer do Git `40317f5`. A fase compilada→ready levou 10 ms em WebGPU / 19–20 ms em WebGL2. No reload WebGPU, `sceneBuilt→compiled` durou 1.145 ms; o primeiro pipeline assíncrono da API completou em 612 ms, e a espera do backend por essa criação/validação durou 1.076 ms, incluindo renderização intercalada. Os shaders frios/reload têm os mesmos 16 hashes. O perfil não estabelece causalidade no driver, e a instrumentação interfere nos tempos.

Um quadro explícito antes de `compileAsync` conservou a compilação completa, loop e dupla RAF. No [controle alternado de três rodadas](evidencias/medicao-preparo-ab/medicao.json), abertura WebGPU passou de 2.718→2.870 ms frio / 2.480→2.641 ms reload; WebGL2 de 2.959→3.105 / 2.003→2.073 ms. Encurtar a fase marcada como compilação não melhorou o tempo total. **Hipótese descartada**, sem alteração dessa sequência na produção. Os dois relatórios desta seção identificam a fonte anterior ao decoder; não misturar seus tempos com os lotes novos.

## Reprodução e manutenção

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/medir_buffers.py --rodadas 3 --amostra-ms 2000 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/medicao-buffers-ab
python experimentos/liv-ipanema-webgpu-2026-10-09/medir_buffers.py --rodadas 2 --cpu-factor 4 --amostra-ms 1000 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/medicao-buffers-cpu4
python experimentos/liv-ipanema-webgpu-2026-10-09/medir_runtime.py --geometria revisadas --ambiente precalculado --igualar-canvas --rodadas 3 --amostra-ms 4000 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/medicao-buffers-integrada
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_instancias.py --referencia 40317f5 --programas registrar --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/buffers-paridade-nativa-qualificada
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_instancias.py --referencia 40317f5 --programas registrar --decoder-nativo ausente --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/buffers-paridade-fallback-qualificada
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_unidades.py --geometria entrada --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/unidades-buffers-final
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_fila_integrada.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/fila-buffers-final
```

Executar Chrome/QA/benchmarks sequencialmente. Os controles são selecionados somente pelos ensaios; o produto usa detecção de capacidade. [MDN: Uint8Array.fromBase64](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64) descreve a criação direta do array de bytes e a disponibilidade em versões recentes. O fallback continua necessário e exercitado. Preservar as verificações de hash/tamanho e o tipo/quantidade declarados antes de criar `BufferAttribute`.
