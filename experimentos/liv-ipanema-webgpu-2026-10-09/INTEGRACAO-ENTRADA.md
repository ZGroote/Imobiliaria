# Entrada na maquete completa — 11/10/2026

[Abrir a prévia local](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada). A edição reúne entrada reconstruída, contorno/cobertura corrigidos, seleção ilustrativa dos dez finais, Planta 2D/3D, Tour de Canto/Meio e mapa de 5 km. O endereço sem parâmetro conserva a base. Esta edição continua opcional enquanto rede, memória e ensaios físicos estão pendentes; não houve publicação.

Continuação do decoder: [BUFFERS.md](BUFFERS.md) registra 72–73% menos tempo de CPU na montagem da geometria e abertura integrada 3.266/2.717 ms frio/reload WebGPU, 3.513/2.400 ms WebGL2, contra base de 4.291/2.826 ms no mesmo lote. A fonte da entrada, os materiais e a fila permanecem os mesmos. T05 continua parcial; ensaios físicos, rede e memória pendentes.

Qualificação anterior das instâncias: [INSTANCIAS.md](INSTANCIAS.md) qualifica a política de atributos do próprio Three.js, preservando os materiais. Na página completa, entrada abre em 2.489 ms com WebGPU / 2.643 ms com WebGL2, contra 2.915 ms da base: os dois backends passam no teto provisório de abertura fria **do desktop**. Noventa e nove comparações RGBA são idênticas. T05 continua parcial, inclusive por reload WebGPU e qualificação física; as medições e QAs da integração original abaixo permanecem históricos.

## Identidade e navegação

| Recurso | Identidade |
|---|---|
| Autoria da entrada | `09407385ae2776910decbf433a365f000f61512e2c35c8fd7e3f3248086b172a` |
| GLB regional | `4947fee3d6eba10af3619493663a04a3fb478086a0953ae646f685b09e84ba01`, 2.535.936 bytes |
| GLB contra autoria | 97 geometrias, 1.815 instâncias, 54 materiais, 278.199 triângulos; superfícies e transformações correspondentes |
| Pacote RGBM próprio | 57 malhas / 42 baked, 16.091.722 bytes; UV/atlas da mesma autoria |
| Catálogo aproximado | [unidades-entrada.json](modelo/entrada/unidades-entrada.json), mesmos dez IDs/polígonos do contorno, nova fonte verificada |
| HTML regional compartilhado | `41f411c3d942facf58dcf0a6118803a815b3be4a21b9bdb13f16b407daf1458d`, 8.048.147 bytes |
| Fila secundária | 141 arquivos / 37.830.820 bytes, versão `03204482b5e3d8c2c0f74a7951118e290b6e0aaaf3810fc2b98fb00623c87ba5` |

[edicoes.js](edicoes.js) fornece os caminhos conhecidos de base/contorno/entrada para o viewer, renderer, cadastro e navegação. Cada cadastro precisa corresponder à fonte da cena antes de habilitar a seleção. O mapa verifica bytes/SHA do GLB antes de importá-lo. A sessão da entrada tem chave própria; o retorno conserva edição e final selecionado.

O clique em Mapa agora indica o GLB da edição antes de deixar a maquete. Antes, a primeira ordem priorizava o grupo inteiro: o worker podia começar o GLB original enquanto a página seguinte carregava. [A falha foi reproduzida](evidencias/fila-entrada-integrada/runtime.json) com download retido. [O ensaio corrigido](evidencias/fila-entrada-corrigida/runtime.json) exige que nem outras edições nem os 120 tiles comecem antes do modelo escolhido, para contorno e entrada.

A fila conserva Tour → mapa → Planta 2D, preempção pelo cliente, integridade e uma única cena ativa. A preparação completa inclui os três GLBs; o incremento secundário é 2.536.156 bytes. Nenhum atlas de exterior foi acrescentado à fila. Canto e Meio mantêm seus próprios modelos/bakes e continuam plantas gerais. Tipologia/espelhamento por final, área comercial, disponibilidade, preço e vaga não foram inferidos.

## Qualificação local

Chrome 154.0.8037.98, Windows 11, GTX 1650; backends efetivos WebGPU e WebGL2 registrados. Toque emulado em desktop, sem resultado de Poco X6/iPhone físicos. Cada relatório identifica os arquivos ensaiados por SHA-256; capturas e recursos grandes ficam neste computador.

| Ensaio | Resultado |
|---|---|
| CPU: edições, cadastro e picking | 13 testes Node; identidade das três fontes, zonas de recuo e ausência de vínculos comerciais inventados |
| CPU: GLB/autoria | 8 testes Python; entrada/contorno reais, rejeição de geometria/material/transformação incompatíveis e preservação do mapa regional |
| [Maquete completa](evidencias/unidades-entrada-final/runtime.json) | 3 perfis: dez escolhas por lista/fachada, teclado/gestos, realce sem preencher recuos, geometria/UV/atlas/PBR preservados, Canto/Meio em 2D/3D/Tour, sessão/câmera e descarte único; 3 falhas recuperadas e retorno normal/com falha do mapa |
| [Iluminação da entrada](evidencias/entrada-luz-integrada/runtime.json) | 3 perfis, enquadramento em cinco tamanhos, materiais padrão, luz estática/dinâmica comparáveis, zero atualizações de sombra em 24 quadros de giro, captura/gestos/descarte; fonte de atlas e cadastro incompatíveis rejeitados |
| [Mapa regional](evidencias/mapa-entrada-final/runtime.json) | 7 casos: base desktop e contorno/entrada no desktop, toque emulado e sem cache; GLB correto, escala/giro/terreno, recorte de 5 km, 614 POIs, busca/Centralizar, recarga e retorno ao final selecionado; 2 GLBs corrompidos rejeitados antes da construção |
| [Fila controlada](evidencias/fila-entrada-fixtures/runtime.json) | 13 cenários: prioridade, integridade, compartilhamento, tipologias/abas, pré-requisitos, versões, atualização e reinício do worker |
| [Fila com arquivos reais](evidencias/fila-entrada-corrigida/runtime.json) | 5 cenários: primeira cena antes do fundo, 141 arquivos em cache, preempção, mapas frios de contorno/entrada com modelo escolhido primeiro, cache sem duplicar downloads, quota cheia e ausência de Service Worker |

## Medição anterior da interface completa, antes da política de instâncias

[medicao-entrada-integrada/medicao.json](evidencias/medicao-entrada-integrada/medicao.json): 15 pares / 30 amostras, três rodadas por tratamento, Chrome novo por rodada, contexto HTTP frio e reload no mesmo contexto. Execução sequencial em ordem fixa base → contorno WebGL2/WebGPU → entrada WebGL2/WebGPU. Mesma interface completa, viewport 1440×900, canvas 720×390, DPR 1, ambiente pré-calculado sem fallback e fonte/backend efetivos conferidos. A fila é pausada depois da primeira cena utilizável, antes da amostra de órbita de quatro segundos.

| Versão | Mediana fria | Mediana reload | Conteúdo inicial único |
|---|---:|---:|---:|
| Base pública preservada | 2.659 ms | 1.598 ms | 38.378.801 bytes |
| Contorno / WebGL2 | 4.945 ms | 1.575 ms | 20.013.210 bytes |
| Contorno / WebGPU | 2.993 ms | 2.676 ms | 20.013.210 bytes |
| Entrada / WebGL2 | 5.123 ms | 1.596 ms | 20.060.395 bytes |
| Entrada / WebGPU | 3.030 ms | 2.658 ms | 20.060.395 bytes |

A entrada acrescentava 47.185 bytes (+0,24%) ao contorno; sua abertura variou +1,2% frio/−0,7% reload em WebGPU e +3,6%/+1,3% em WebGL2 nesta rodada anterior. O conteúdo inicial era 47,7% menor que o da base. Naquele lote, abertura fria +13,9% em WebGPU / +92,6% em WebGL2 superava o limite provisório de +10%. O protocolo passou, mas o orçamento frio não passou. O novo lote em [INSTANCIAS.md](INSTANCIAS.md) passa nesse critério desktop; T05 e a qualificação física continuam parciais.

O maior intervalo instrumentado daquela revisão era `sceneBuilt → compiled`: medianas frias 1.645 ms em WebGPU e 3.752 ms em WebGL2. No reload, 1.600/645 ms. Esse intervalo inclui trabalho interno/esperas de `compileAsync`, sem isolar execução GPU ou estabelecer a causa no driver. A repetição de programas foi tratada na continuação de instâncias; preparar o atlas consumia cerca de 365–382 ms, e importar o ambiente preparado, 14–31 ms.

Conteúdo é a soma de `encodedBodySize` por URL distinta dos documentos até a cena utilizável, em loopback sem compressão HTTP; `.gz` já comprimidos. Não contabiliza tráfego secundário do worker nem mede a hospedagem/rede móvel. Caches do driver e outras aplicações não são controlados; ordem fixa limita a atribuição causal. O p95 da cadência de submissão fica em aproximadamente 16,9 ms, sem medir tempo GPU/FPS. O ensaio é de órbita exterior; não mede caminhada no Poco. Não misturar seus tempos com os ensaios isolados ou históricos de outras condições.

## Reproduzir

Pré-requisitos: [receita de geometria/UV/bake/pacote](modelo/entrada/README.md), fontes e artefatos locais identificados, dependências Python/Chrome e servidor da raiz em `127.0.0.1:8790`. Executar a partir deste diretório, QAs gráficos em sequência, usando novos destinos para conservar os relatórios históricos:

```powershell
python modelo/registrar_unidades.py --edicao entrada
python modelo/registrar_mapa.py --edicao entrada
python preparar_mapa.py
python gerar_manifesto_transferencias.py
node --test test_edicoes.mjs test_unidades.mjs test_contorno_unidades.mjs
python -m unittest test_mapa_modelo.py
python qa_unidades.py --geometria entrada --saida evidencias/unidades-entrada-outra-revisao
python qa_mapa_modelo.py --saida evidencias/mapa-entrada-outra-revisao
python qa_fila_integrada.py --saida evidencias/fila-entrada-outra-revisao
python qa_transferencias.py --saida evidencias/fila-entrada-fixtures-outra-revisao
python modelo/entrada/qa_luz_entrada.py --saida evidencias/entrada-luz-outra-revisao
python medir_runtime.py --geometria revisadas --ambiente precalculado --igualar-canvas --rodadas 3 --saida evidencias/medicao-entrada-integrada-outra-revisao
```

A geometria permanece uma reconstrução proporcional pelas imagens disponíveis. Esta integração não confirma cotas, espelhamentos ou especificações executivas. T05–T12 conservam os critérios de desempenho, aparência final, cadastro comercial e dispositivos físicos do [plano](../../tasks/liv-ipanema-webgpu/plan.md).
