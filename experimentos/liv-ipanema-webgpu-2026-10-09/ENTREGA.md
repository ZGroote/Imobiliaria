# LIV Ipanema — etapa técnica local

09/10/2026. Branch `codex/liv-ipanema-webgpu`. Base: edição pública `strict-circle-v3` indicada pelo usuário, preservada e conferida por hash. Esta entrega corresponde à reprodução e integração do renderer, **antes do piloto de seleção de unidades**. Não há publicação nova.

## Abrir e avaliar

[Maquete integrada local](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html). O servidor usa somente `127.0.0.1`; o link funciona neste computador enquanto estiver em execução. Para reiniciá-lo, seguir [README.md](README.md).

- Exterior completo com WebGPU automático e alternativa WebGL2, mantendo torre, portaria, lazer e paisagismo da base.
- Cinco câmeras e navegação livre; destaque de térreo e 16 pavimentos tipo; PNG da vista.
- Planta 2D direta da imagem comercial; Planta 3D/Tour de canto sob demanda, com indicação de referência ilustrativa.
- Mapa preservado de 5 km, busca e retorno à maquete nova; câmera e pavimento recuperados ao voltar.

Para comparar backends, acrescentar `?backend=webgpu` ou `?backend=webgl`. A [prova técnica](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/prova-rgbm.html) exibe o backend efetivo. A alternativa sem 3D é a imagem da planta.

## Evidências

| Verificação | Resultado e limite |
|---|---|
| Reprodução | Dez testes, montagem e QAs de miniatura/mapa aprovados; 125 arquivos de conteúdo iguais à edição preservada. |
| RGBM/TSL | 56 malhas, 41 baked; geometria/UV/atlas associados à própria versão. WebGPU e WebGL2 aprovados em desktop e toque emulado. |
| Continuidade visual | Dez capturas RGBA em canvas idêntico; diferenças de PBR especular, sombras e AA documentadas. Não é equivalência de pixels ou refinamento artístico final. |
| Quatro modos | Vistas, destaque/reset, giro/mover, caminhada, PNG e retorno ao exterior aprovados. Downloads decodificados, com dimensões e conteúdo verificados. |
| Trocas repetidas | Vinte ciclos desktop e vinte com toque emulado; um iframe ativo e contagem estável de documentos/nós. Amostra de heap não mede toda a memória GPU. |
| Recuperação | Nove cenários aprovados: GPU ausente/inicialização, HTTP, corrupção, planta, navegação rápida e perda de contexto. Perda WebGL real; WebGPU pelo callback simulado. |
| Navegação/layout | Aprovados em 320/768/1440 px; ida/volta do mapa e recuperação de câmera/pavimento no histórico. |
| Carregamento | 37,5% menos conteúdo inicial no servidor local; abertura fria mediana: base 1,51 s, evolução WebGL2 1,88 s, WebGPU 2,80 s. Critério de tempo ainda pendente. Ver [PERF.md](PERF.md). |

Ambiente: Chrome 154.0.8037.98, Windows 11, GTX 1650; WebGPU NVIDIA/Turing e WebGL2 ANGLE/D3D11. Evidências JSON em `evidencias/`; capturas e assets binários grandes ficam locais, com hashes nos manifestos. A matriz de referência e reconciliação estão em [referencias.json](referencias.json) e [reconciliacao-unidades.md](reconciliacao-unidades.md).

## Continuidade do desenvolvimento

O estado detalhado está em [todo.md](../../tasks/liv-ipanema-webgpu/todo.md). T02 permanece parcial até qualificação física/comparação oficial; o [orçamento](orcamento.json) é provisório. T05 começou pela separação de recursos e abertura por modo. O refinamento de fachada/materiais, dia/entardecer, seleção de um pavimento, interiores de meio e catálogo reconciliado continuam pendentes.

A tipologia correta de cada final, seus limites cotados, gardens e numeração comercial não foram confirmados. Preço, disponibilidade e vagas atribuídas dependem de cadastro oficial. O interior de canto continua geral e ilustrativo. A troca de renderer preserva a reconstrução existente e não produz, por si só, uma aparência fotográfica.

Para recuperar a base, executar `preparar_pacote.py` e servir `site-baseline/`; o inventário e os arquivos originais preservados são pré-requisitos. O preview antigo expira em 16/10/2026 às 09:12:58 BRT. Os arquivos locais continuam disponíveis.
