# Desempenho — medição e tentativas

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
