# Paredes completas e troca de plantas

As plantas 3D Canto e Meio começam com paredes na altura normal. **Paredes baixas** continua disponível como opção, desligada na primeira abertura. Uma preferência explicitamente escolhida é preservada ao voltar à tipologia. O Tour continua exibindo paredes e forro completos.

## Causa e correção

Na v9, trocar tipologia encerrava o iframe, renderer, texturas e geometria anteriores. Mesmo com os bytes da fila já baixados, a nova abertura repetia descompressão, validação, decodificação, construção da cena, upload e compilação dos materiais para a GPU.

A revisão conserva no máximo as duas tipologias já abertas durante o uso de Planta 3D/Tour. A inativa permanece oculta e inerte, com loop de renderização, entradas de caminhada, rota e observador de tamanho suspensos. A volta reutiliza o mesmo contexto, materiais e recursos da GPU. A escolha de paredes, câmera manual e móveis permanece individual por tipologia.

Uma cena preparada não espera o comando da fila de downloads para reaparecer. A fila continua funcionando para a primeira abertura. Cenas incompletas, com erro ou dispositivo perdido são descartadas. Perda de um dispositivo suspenso não interrompe o interior visível. Ao mudar para Maquete/Planta 2D, abrir o mapa ou encerrar o visualizador, ambos os interiores são liberados pelo procedimento existente, incluindo o limite de encerramento para um driver sem resposta.

## Medição local

`qa_troca_plantas.py` espera todos os arquivos do grupo Tour no cache antes de abrir os interiores. Abre ambas as tipologias e mede seis alternâncias na mesma sessão. A comparação usa a v9 imutável e o runtime novo, em Chrome desktop, sem qualificação física de celular.

| Backend | Mediana anterior ao retornar a uma planta | Mediana com reuso |
|---|---:|---:|
| WebGPU | 4.541 ms | 6,2 ms |
| WebGL2 | 2.600 ms | 6,0 ms |
| Automático com toque emulado | Não medido antes | 6,4 ms |

Esses tempos medem a conclusão da troca do visualizador; não são uma medição do tempo de apresentação física do monitor. A primeira abertura de Meio ainda levou 3.551 ms em WebGPU e 1.641 ms em WebGL2, porque o download prévio não prepara os gráficos. Não há promessa de abertura instantânea de uma tipologia nunca aberta ou depois de os recursos serem liberados.

Relatórios: `evidencias/troca-plantas-antes/runtime.json` e `evidencias/troca-plantas-conferida/runtime.json`. O ensaio atual confirma reuso das mesmas instâncias, zero novas requisições de interior nas trocas aquecidas, contagens de recursos próprios estáveis, uma única cena visível, nenhuma renderização/caminhada na suspensa, paredes completas por padrão, câmera/móveis/preferência preservados, escolha mais recente após trocas rápidas, isolamento de perda do dispositivo suspenso e descarte integral ao sair para 2D. Manter duas cenas usa mais memória que manter somente uma; a retenção é limitada e não continua ao voltar à maquete.
