# Compilação das instâncias — 11/10/2026

O exterior agora usa o caminho de atributos intercalados do Three.js para suas instâncias. No ensaio completo, a entrada abre em **2.489 ms com WebGPU / 2.643 ms com WebGL2**, contra **2.915 ms da base preservada**. Os dois backends passam no limite provisório de abertura fria do desktop. T05 continua parcial: rede/hospedagem, memória e aparelhos físicos ainda precisam ser qualificados, e o reload WebGPU permanece mais lento que a base.

[Prévia completa da entrada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada). A publicação original não foi alterada. Base, contorno e entrada continuam com os mesmos modelos, atlas, materiais padrão, quantidades, matrizes e seleção; Canto e Meio conservam seus interiores independentes.

## Causa localizada e mudança

[perfil-compilacao-entrada/perfil.json](evidencias/perfil-compilacao-entrada/perfil.json) identifica 35 programas de vértice e oito de fragmento no diagnóstico da entrada anterior. Os shaders de várias esquadrias, vidros e árvores diferem pelos nomes `buffer<id>` e pelos tamanhos dos arrays de matrizes. `Instance.js` escolhe uniformes quando as matrizes cabem no limite do aparelho; esses nomes/tamanhos tornam seus programas distintos. O perfil adiciona custo e pode alterar o agendamento: não usar seus tempos como benchmark ou medida de execução GPU.

Em [renderer.js](renderer.js), o callback `debug.onNodeBuilderCreated` escolhe atributos para um `WeakSet` das instâncias da própria cena, somente na revisão 186. O limite consultado por esse builder é zero; os limites reais do dispositivo permanecem intactos. O próprio `Instance.js` gera os atributos e sincroniza atualizações de matrizes/cores. Não há edição do código da dependência, padding das matrizes, cópia de geometria ou shader escrito para cada acabamento. A conversão dos materiais PBR padrão continua na biblioteca do renderer; o transporte RGBM mantém sua implementação específica anterior.

Esta é uma adaptação ao **Three.js 0.186.1 fixado**. Requalificar o callback, `Instance.js`, o orçamento e as imagens ao atualizar a dependência. Fora da revisão 186, o renderer conserva a política padrão. Referências: fonte local de `Instance.js`, `NodeManager._createNodeBuilder` e `RenderObject.getMaterialCacheKey`; documentação oficial de [NodeBuilder](https://threejs.org/docs/pages/NodeBuilder.html) e [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

Identidades da dependência conferida:

| Arquivo | SHA-256 |
|---|---|
| `three/build/three.webgpu.js` | `15cfce5c653541704fd9a3463c39d3e8b854bb6265ccd854d7cfe74090625cc6` |
| `three/src/nodes/accessors/Instance.js` | `0358e1836d8fe2af1ff5779d52f993e2afca20f258f0b3da53bb95516c67fa2d` |
| `three/src/renderers/common/nodes/NodeManager.js` | `8ec9afe44c4b8a3e56a1122c0c1bd5d2a5de2ac887dc397a535127a7dbce8076` |

## Comparação controlada da política

[medicao-instancias-controle-final/medicao.json](evidencias/medicao-instancias-controle-final/medicao.json): três rodadas, 12 pares frio/reload / 24 amostras, backend e ordem dos tratamentos alternados. Mesmo runtime atual e mesma cena; o ensaio controla o callback nos dois tratamentos para comparar a decisão padrão da biblioteca com atributos. Não intercepta HTTP: Chrome novo por tratamento/rodada, contexto frio e reload na mesma aba. Viewport 1440×900, canvas 720×390, DPR 1, ambiente preparado, fila pausada após ready e amostra de órbita de quatro segundos. Anexação da intervenção anterior à construção e supressão da política de produção são verificadas.

| Backend / política | Mediana fria | Mediana reload | Fase de compilação fria | Programas após ready |
|---|---:|---:|---:|---:|
| WebGL2 / uniformes | 5.566 ms | 1.993 ms | 4.298 ms | 43 |
| WebGL2 / atributos | 2.698 ms | 1.944 ms | 1.537 ms | 14–16 |
| WebGPU / uniformes | 3.075 ms | 3.272 ms | 1.771 ms | 43 |
| WebGPU / atributos | 2.314 ms | 2.407 ms | 1.018 ms | 14–16 |

As medianas frias melhoram 51,5% em WebGL2 e 24,8% em WebGPU neste controle; a redução de programas e o ganho WebGL2 são consistentes. O ganho de tempo não aparece em todo par WebGPU: na terceira rodada, atributos abriu em 2.989 ms contra 2.782 ms com uniformes. Caches de driver e outras aplicações não são controlados. A primeira hipótese, antes de integrar a política, também passou em três rodadas: [medicao-instancias-entrada-ab](evidencias/medicao-instancias-entrada-ab/medicao.json), com fontes e script da revisão anterior; não misturar seus tempos com os do controle final.

Os contadores do renderer na entrada passam de 119.782.507 para 120.032.185 bytes em WebGL2 e de 119.809.089 para 120.039.358 em WebGPU: incremento de aproximadamente 0,2%, com nove texturas nas duas políticas. Isso é contabilização do renderer, sem comprovar pico de memória ou uso físico de VRAM. Matrizes/capacidades reais continuam iguais à fonte. Não houve aumento do atlas nem do catálogo secundário.

## Página completa, sem intervenção

[medicao-instancias-integrada/medicao.json](evidencias/medicao-instancias-integrada/medicao.json): 15 pares / 30 amostras, três rodadas por versão/backend, mesmos viewport/canvas/DPR. Usa a página completa e a política de produção, sem o observer ou a intervenção do controle. Ordem fixa: base → contorno WebGL2/WebGPU → entrada WebGL2/WebGPU. Chrome novo por rodada e fila pausada depois da primeira cena utilizável. Ambiente/backend efetivos e fonte da maquete são verificados.

| Versão | Mediana fria | Mediana reload | Conteúdo inicial único |
|---|---:|---:|---:|
| Base pública preservada | 2.915 ms | 1.950 ms | 38.378.801 bytes |
| Contorno / WebGL2 | 2.543 ms | 1.953 ms | 20.013.863 bytes |
| Contorno / WebGPU | 2.250 ms | 2.446 ms | 20.013.863 bytes |
| Entrada / WebGL2 | 2.643 ms | 1.951 ms | 20.061.048 bytes |
| Entrada / WebGPU | 2.489 ms | 2.427 ms | 20.061.048 bytes |

A entrada fica 9,3% abaixo da base em WebGL2 e 14,6% abaixo em WebGPU na abertura fria; ambas passam no teto provisório base +10% **neste desktop/ensaio**. O conteúdo inicial é 47,7% menor. O reload WebGL2 acompanha a base; o WebGPU fica 24,5% acima. Na entrada, `sceneBuilt → compiled` ainda consome 1.376/1.055 ms frio e 802/1.147 ms reload em WebGL2/WebGPU. Esse intervalo inclui construção, uploads e esperas internas; não isola tempo GPU.

Conteúdo é `encodedBodySize` por URL distinta dos documentos, em loopback sem compressão HTTP; `.gz` já comprimidos. Não inclui tráfego do worker ou comprova rede 4G/hospedagem. A cadência p95 de submissão foi aproximadamente 7,2 ms neste lote, sem medida de FPS; não é comparável automaticamente aos 16,9 ms do lote anterior. A ordem fixa e caches/atividade externos limitam atribuição causal. Nenhum destes ensaios mede caminhada no Poco X6 físico.

## Paridade e regressão

[instancias-paridade/runtime.json](evidencias/instancias-paridade/runtime.json) compara o renderer do commit `b67984e` com o atual em nove casos: base/contorno/entrada × WebGPU/WebGL2/toque emulado. **99 comparações RGBA foram idênticas, com delta máximo zero.** Incluem sete enquadramentos, destaque do final 01 e movimento/restauração de uma instância. Matrizes e contagens são conferidas contra os bytes originais; materiais e atlas permanecem iguais. Cores do pavimento são verificadas por instância; movimentar a esquadria altera mais de 7.500 pixels e restaurar recupera a imagem. Recursos são descartados uma vez. A interceptação HTTP é exclusiva deste QA visual; seus tempos não são benchmark.

Regressões da integração atual: [maquete, duas plantas e Tour](evidencias/unidades-instancias-final/runtime.json), [luz/gestos/descarte da entrada](evidencias/entrada-luz-instancias-final/runtime.json) e [fila com recursos reais](evidencias/fila-instancias-final/runtime.json). Os relatórios registram suas fontes por SHA-256. A qualificação física e a precisão arquitetônica/comercial conservam os limites de [INTEGRACAO-ENTRADA.md](INTEGRACAO-ENTRADA.md).

## Reproduzir

Servidor da raiz em `127.0.0.1:8790`, dependências fixadas e artefatos identificados disponíveis. A partir deste diretório, executar os QAs gráficos em sequência, usando novos destinos:

```powershell
python medir_instancias.py --rodadas 3 --saida evidencias/instancias-controle-outra-revisao
python medir_runtime.py --geometria revisadas --ambiente precalculado --igualar-canvas --rodadas 3 --saida evidencias/instancias-integrada-outra-revisao
python qa_instancias.py --referencia b67984e --saida evidencias/instancias-paridade-outra-revisao
python qa_unidades.py --geometria entrada --saida evidencias/unidades-instancias-outra-revisao
python modelo/entrada/qa_luz_entrada.py --saida evidencias/entrada-luz-instancias-outra-revisao
python qa_fila_integrada.py --saida evidencias/fila-instancias-outra-revisao
```

Conservar T05 parcial e as edições revisadas opcionais. Próximo: medir abertura, órbita/caminhada, alternância e memória no Poco informado e em iPhone, investigar o reload WebGPU e só ampliar efeitos dentro do orçamento qualificado.
