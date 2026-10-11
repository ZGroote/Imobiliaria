# Desempenho — medição e tentativas

Continuação do decoder em 11/10: [BUFFERS.md](BUFFERS.md) registra montagem real da geometria com 72–73% menos tempo de CPU no desktop, usando a API nativa com fallback, e 65–77% menos sob CPU desacelerada 4×. O controle de abertura teve variação por par; o ganho uniforme é dessa etapa, sem promessa de FPS ou resultado físico. No novo lote sem intervenção, entrada abre em 3.266/2.717 ms frio/reload WebGPU e 3.513/2.400 ms WebGL2; base comparável 4.291/2.826 ms. O teto frio provisório passa e o reload mediano fica abaixo da base neste lote. Não comparar os tempos absolutos com o lote anterior; T05 continua parcial por rede/memória/aparelhos.

Revisão anterior das instâncias em 11/10: [INSTANCIAS.md](INSTANCIAS.md) registra o uso dos atributos intercalados do próprio Three.js nas instâncias. No controle alternado de três rodadas, abertura fria mediana melhora 51,5% em WebGL2 e 24,8% em WebGPU, com 43 → 14–16 programas; um par WebGPU piorou, com limites e variação explicitados. Na página completa, sem intervenção, entrada abre em 2.489/2.427 ms frio/reload em WebGPU e 2.643/1.951 ms em WebGL2; base 2.915/1.950 ms. Os dois backends passam no limite provisório de abertura fria do desktop, com 47,7% menos conteúdo inicial. Reload WebGPU ainda mais lento e ensaios físicos/rede/memória pendentes: T05 continua parcial. Noventa e nove comparações RGBA são idênticas; matrizes, contagens, materiais e atlas preservados.

Revisão integrada anterior, antes da política de instâncias: [medicao-entrada-integrada](evidencias/medicao-entrada-integrada/medicao.json) tem três rodadas por tratamento com a interface completa/canvas igual. A entrada abriu em 3.030 ms frio / 2.658 ms reload em WebGPU, 5.123/1.596 ms em WebGL2; base comparável 2.659/1.598 ms. Conteúdo inicial único 20.060.395 bytes, −47,7% vs. base / +0,24% vs. contorno. Naquele lote, o critério de abertura foi reprovado (+13,9% WebGPU / +92,6% WebGL2). A maior fase instrumentada era `sceneBuilt → compiled`: 1.645/3.752 ms frio, sem comprovar tempo GPU ou causa no driver. Conservar esses dados históricos; não misturar seus tempos com o lote atual.

O [estudo isolado anterior da entrada](modelo/entrada/README.md) tem medição própria de três rodadas por edição/backend, mesma página/câmera/canvas. Em WebGPU variou +1,2% frio/+3,5% reload contra o contorno, com +0,24% de conteúdo inicial e +0,41% nos bytes contabilizados pelo renderer. Não inclui interface, cadastro ou fila; seus tempos não se misturam com o ensaio integrado e não aprovam T05/aparelhos físicos.

Revisão anterior de 11/10: [AMBIENTE.md](AMBIENTE.md) qualifica os reflexos preparados antes da abertura, com recuperação e imagem equivalente. No mesmo ensaio, contorno WebGL2 passa de 4.975 para 4.042 ms frio e 3.680 para 1.324 ms no reload; WebGPU varia de 2.460 para 2.393 ms e 2.175 para 2.186 ms. Conteúdo inicial 20.011.590 bytes. A base comparável abre em 2.152 ms; o critério +10% continua pendente. [SOMBRAS-EXTERIOR.md](SOMBRAS-EXTERIOR.md) registra a remoção de 24 passes redundantes em 24 quadros de órbita na revisão anterior. As medições abaixo são históricas, com condições distintas de processo/cache/canvas.

09/10/2026. Ambiente local declarado no relatório JSON: Chrome 154, Windows 11, GTX 1650, headless, viewport 1440×900, DPR 1. Três rodadas por variante, cache HTTP frio em contexto novo e reload na mesma aba. Execução sequencial, sem outros QAs. Caches do driver não foram controlados; a primeira rodada pode pagar compilação adicional.

## Medição final

| Variante | Conteúdo inicial | Mediana de abertura fria | Mediana no reload | Intervalo p95 de submissão |
|---|---:|---:|---:|---:|
| Base r168 | 38.378.801 bytes | 1.508 ms | 1.345 ms | ~17,0 ms |
| Evolução WebGL2 | 23.993.373 bytes | 1.882 ms | 1.675 ms | ~16,7 ms |
| Evolução WebGPU | 23.993.373 bytes | 2.797 ms | 2.654 ms | ~16,7 ms |

[Dados completos](evidencias/medicao-final/medicao.json), com hashes de fonte, tempos de cada rodada, recursos/cache, backend e canvas. As rodadas frias WebGL2 foram **5.310 / 1.845 / 1.882 ms**; a mediana não elimina o custo observado na primeira abertura. A base teve 2.541 / 1.508 / 1.473 ms. WebGPU teve 2.797 / 2.789 / 2.797 ms.

O conteúdo inicial caiu **37,5%** na versão medida antes da fila automática. Mapa, interiores e planta não foram antecipados nesse ensaio. No reload, a transferência registrada foi cerca de 20,1 MB para a evolução e 38,4 MB para a base. O servidor local não comprime HTTP; arquivos `.gz` já vêm comprimidos. A publicação pode usar outra compressão/cache: esses números não comprovam a transferência na hospedagem ou em 4G. A política atual prepara conteúdo secundário depois da primeira cena utilizável; seu tráfego deve ser medido separadamente, conforme [FILA.md](FILA.md).

**O critério provisório de abertura de T05 ainda não passou:** a mediana deve ficar até 10% acima da base comparável. As variantes novas continuam mais lentas. O ganho de bytes e a cadência registrada não equivalem a ganho de FPS ou aprovação de desempenho. Os canvases também diferem: base 720×390, evolução 920×556. Intervalo entre submissões mede cadência, não execução GPU.

## Tentativas registradas

O custo foi dividido em entrada do módulo, backend, cena, atlas, construção e compilação. Evidências intermediárias em `evidencias/medicao-comparavel/fases-*.json`; tempos desse diagnóstico são relativos ao documento do iframe e não devem ser misturados com o relógio da página principal.

| Tentativa | Observação | Decisão |
|---|---|---|
| Nós RGBM compartilhados por atlas/faixa/intensidade | No diagnóstico WebGL2, a compilação das rodadas 2/3 caiu de ~1.178/1.229 ms para ~622/613 ms. O cache de programa inclui a identidade dos nós filhos; expressões equivalentes criadas por material geravam variantes repetidas. | Mantida. Atlas e parâmetros distintos têm entradas próprias. Capturas e QA dos dois backends continuaram iguais dentro das diferenças já documentadas da base. |
| Cena/atlas carregados em paralelo | Abertura no diagnóstico não melhorou de forma consistente; WebGPU passou de ~2,58 s para ~2,76 s na mediana. | Revertida. Não assumir que paralelismo melhora este pipeline local. |
| Iniciar animação apenas depois de `compileAsync` | Mediana do diagnóstico WebGPU passou de ~2,58 s para ~2,83 s; WebGL2 também não melhorou. | Revertida. Manter a estratégia validada e continuar investigando a primeira renderização. |
| Recursos identificados por hash na URL e manifesto revalidado | Chaves de cache acompanham o conteúdo, bytes/identidade são conferidos antes de usar o recurso e downloads pendentes são cancelados ao encerrar a cena. | Mantida por coerência/recuperação; não atribuída a um ganho de FPS. |
| Atributos intercalados para instâncias na revisão 186 | Controle alternado: entrada WebGL2 5.566→2.698 ms frio, WebGPU 3.075→2.314 ms; programas 43→14–16. Página completa passa no teto frio do desktop; 99 comparações RGBA idênticas, seleção/movimento/descarte preservados. Incremento de aproximadamente 0,2% nos bytes contabilizados pelo renderer. | Mantida, com política limitada às instâncias da cena e dependência fixada. Variação por rodada/reload WebGPU e ensaio físico continuam abertos. Ver [INSTANCIAS.md](INSTANCIAS.md). |
| Quadro explícito antes de `compileAsync`, com política de instâncias já aplicada | Controle alternado: WebGPU 2.718→2.870 ms frio / 2.480→2.641 ms reload; WebGL2 2.959→3.105 / 2.003→2.073 ms. A fase compilada encurtou, mas a abertura total piorou. | Descartada, sem alterar a sequência de produção. Perfil e dados em [BUFFERS.md](BUFFERS.md). |
| Decoder nativo de base64 com fallback | Montagem real WebGPU 159,2→43,0 ms frio / 162,1→43,4 ms reload; WebGL2 176,6→47,5 / 146,3→41,6 ms. Ganho em todos os 12 pares. Sob CPU 4×, ganho em todos os oito pares, de 65–77%. Abertura completa tem pares piores e não isola esse efeito. | Mantida pela redução consistente de CPU na geometria, com dados/capturas e compatibilidade qualificados em [BUFFERS.md](BUFFERS.md). Orçamento físico continua pendente. |

A comparação completa anterior, antes de compartilhar nós, está em [medicao-comparavel/medicao.json](evidencias/medicao-comparavel/medicao.json). As medianas frias eram 2.426 ms em WebGL2 e 3.006 ms em WebGPU; a base daquele ensaio era 1.451 ms. A medição final repetiu o protocolo e inclui a própria base, preservando a comparação entre rodadas.

## Continuação: PBR padrão e primeiro quadro

O exterior passou a manter os materiais não baked como `MeshStandardMaterial` padrão, convertidos pelo próprio renderer. A [nova medição sem antecipar upload](evidencias/medicao-pbr-antes-upload/medicao.json) repetiu três rodadas por variante/cache, sem outros QAs:

| Variante | Abertura fria: rodadas | Mediana fria | Mediana reload |
|---|---|---:|---:|
| Base | 2.853 / 1.535 / 1.633 ms | 1.633 ms | 1.529 ms |
| PBR padrão WebGL2 | 5.330 / 1.781 / 2.190 ms | 2.190 ms | 1.920 ms |
| PBR padrão WebGPU | 3.212 / 2.975 / 2.971 ms | 2.975 ms | 3.225 ms |

Os resultados continuam acima do critério de abertura. A variação também apareceu na base; esse ensaio não isola um custo causado pela conversão de materiais e não comprova um ganho de desempenho.

`perf_abertura.py` registra chamadas de render, pipelines, upload, long tasks e RAFs. No [perfil instrumentado](evidencias/perfil-abertura/perfil.json), o render explícito posterior a `compiled` custou 2,6–4,3 ms; a espera pelo primeiro RAF foi de cerca de 1,16–1,25 s nas rodadas frias WebGPU. Não houve pipeline novo ou long task após `compiled`. Isso indica espera de apresentação/agendamento nesse intervalo, sem identificar com certeza seu componente GPU/compositor. O observer interfere nos tempos e não substitui o benchmark sem instrumentação. A dupla RAF foi conservada.

Foi testado `renderer.initTexture(atlas)` logo após criar o atlas, antecipando o envio dos mesmos 64 MiB antes de construir o restante da cena. Na [tentativa](evidencias/medicao-pbr-upload-antecipado/medicao.json), a mediana WebGPU fria foi 3.147 ms e o reload 3.077 ms; WebGL2 ficou em 2.132/2.048 ms. O resultado não foi consistente: piorou a abertura fria WebGPU e variou nas outras condições. **Tentativa revertida**, conservando dados e hashes da versão ensaiada.

O laboratório de materiais é carregado em outra página sob demanda; seus GLB, loaders e decodificadores não foram adicionados à abertura da maquete. Adoção de novos acabamentos na cena continua dependente do orçamento e da comparação visual de T06/T07.

## Trabalho restante após esta continuação

Investigar o custo da primeira renderização/sombras/ambiente e a compilação em cada backend. Medir rede móvel e aparelhos físicos, inclusive memória GPU/atlas 4096, antes de fechar o orçamento. Avaliar bundle/representação binária somente com perfil que demonstre benefício. Não usar efeitos ou novos materiais mais caros para encobrir esta regressão; sua adoção precisa respeitar a qualificação de T05/T12.

Referências de implementação: `NodeMaterial._getNodeChildren/customProgramCacheKey` do Three.js 0.186.1 instalado; [NodeMaterial](https://threejs.org/docs/pages/NodeMaterial.html) e [WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer.html). O renderer acrescenta capacidades PBR/TSL e WebGPU; desempenho depende da cena e da implementação.

## Relato de caminhada e mudança de claridade, 10/10

O usuário localizou os travamentos durante a caminhada no link público e forneceu capturas da parede acima da porta mudando de claridade com a câmera. O aparelho informado é Poco X6 5G, Android 13, Chrome 154.0.8037.127. A publicação foi conferida por SHA-256 contra a base preservada; não confundir esse runtime r168 com os interiores nativos da prévia.

`perf_visita.py` compara a caminhada do HTML público preservado com DPR original 1,75 e DPR 1, sombras desligadas e conferência de bake dispensada, somente nos contextos locais do diagnóstico. Duas rodadas por variante, com CPU normal e 4×, estão em [perfil-visita-publica/runtime.json](evidencias/perfil-visita-publica/runtime.json). O bake e a sombra congelada estavam ativos no ambiente ensaiado. A cadência desktop não reproduziu o travamento; a GPU de celular não foi emulada. Não há ganho físico de FPS demonstrado.

O cálculo síncrono de rotas foi o custo de CPU mais evidente: aproximadamente 93–303 ms por chamada sob throttling 4×, incluindo buscas sem caminho. A conferência do bake teve p95 de cerca de 1 ms e o passo de caminhada, 0,2 ms. Esses resultados apontam uma possibilidade de pausa ao pedir um destino, sem estabelecer a causa da caminhada contínua no Poco.

A variação visual foi reproduzida com câmera em posição fixa e bake ativo. Atlas/albedo isolados ficaram estáveis; a composição difusa/ambiente antiga variou mesmo sem especular. O interior nativo passou no mesmo ponto em WebGPU e WebGL2. Método, inferência e prova em [LUZ-CAMERA.md](LUZ-CAMERA.md). Este caso não comprova que a falha visual cause o travamento de desempenho.

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/perf_visita.py --verificar-publico
```

## Iluminação dos dois interiores — continuação em 10/10

Meio recebeu seu próprio mapa de irradiância de 2048×2048/512 amostras, com materiais PBR preservados. A sombra solar agora usa `LightShadow.autoUpdate=false` e é invalidada nas mudanças de móveis, geometria baked e visibilidade do forro. Caminhada e giro não mudam esses elementos. A restauração do conjunto de móveis também recalcula colisões/rotas uma vez, em vez de repetir o trabalho a cada item.

[luz-estatica/runtime.json](evidencias/luz-estatica/runtime.json) registra seis casos no Chrome desktop: WebGPU, WebGL2 e toque emulado, com Canto e Meio. No controle sequencial de 24 quadros por variante, a atualização automática gerou 24 passes de sombra; o cache gerou zero. O renderer submeteu 72 contra 48 passes totais, incluindo seu passe de saída. Ao mover/restaurar, a sombra atualizou e a imagem foi idêntica ao recálculo de referência. O ponto/UV1 da parede permaneceu o mesmo e a variação RGB média máxima foi 0,16/255.

A emulação de toque usou CSS 390×844/DPR 3, com canvas limitado pelo runtime a 780×1688. A restauração síncrona dos snapshots consumiu aproximadamente 450–685 ms nos seis casos; ainda há custo de CPU ao editar/restaurar o layout. Nenhum desses resultados mede execução GPU, consumo de bateria ou FPS no Poco X6 5G. O ganho demonstrado é a remoção dos passes redundantes de sombra. O próprio bake adiciona cerca de 6 MB ao pacote secundário da fila; a abertura do exterior não recebeu esses recursos.
