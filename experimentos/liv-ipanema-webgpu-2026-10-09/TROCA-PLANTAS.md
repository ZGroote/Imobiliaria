# Paredes completas e troca de plantas

As plantas 3D Canto e Meio começam com paredes na altura normal. **Paredes baixas** continua disponível como opção, desligada na primeira abertura. Uma preferência explicitamente escolhida é preservada ao voltar à tipologia. O Tour continua exibindo paredes e forro completos.

## Causa e correção

Na v9, trocar tipologia encerrava o iframe, renderer, texturas e geometria anteriores. Mesmo com os bytes da fila já baixados, a nova abertura repetia descompressão, validação, decodificação, construção da cena, upload e compilação dos materiais para a GPU.

A revisão conserva no máximo as duas tipologias já abertas em toda a sessão da página, inclusive ao alternar para Maquete, Planta 2D e mapa. As inativas permanecem ocultas e inertes, com loop de renderização, entradas de caminhada, rota e observador de tamanho suspensos. A volta reutiliza o mesmo contexto, materiais e recursos da GPU. A escolha de paredes, câmera manual e móveis permanece individual por tipologia.

Uma cena preparada não espera o comando da fila de downloads para reaparecer. A fila continua funcionando para a primeira abertura. Cenas incompletas, com erro ou dispositivo perdido são descartadas. Perda de um dispositivo suspenso não interrompe o interior visível. Encerrar o visualizador libera ambos os interiores pelo procedimento existente, incluindo o limite de encerramento para um driver sem resposta.

## Retenção entre modos — revisão de 12/10

O mapa abre em um diálogo sobre a página atual, sem navegação que destrua seus contextos. **Voltar à visualização**, Escape e **Abrir maquete** no mapa fecham o diálogo e recuperam o modo anterior. O diálogo e sua cena são removidos ao fechar; visitas repetidas não acumulam mapas. Links com Ctrl/Meta/Shift e acesso direto ao HTML do mapa conservam navegação independente. A comunicação de retorno exige a mesma origem e o iframe conhecido.

Trocar para Maquete/2D suspende os apartamentos, sem novas requisições, descompressão, upload ou compilação ao retornar. `dispose`, saída/recarga real da página e perda/erro do dispositivo liberam os recursos correspondentes. São no máximo dois interiores retidos, além da vista atual externa/mapa; apenas a vista atual renderiza. Manter os recursos usa mais memória que descartá-los. O navegador ainda pode perder um dispositivo sob pressão; nesse caso a cena afetada precisa ser preparada novamente.

## Medição local

`qa_troca_plantas.py` espera todos os arquivos do grupo Tour no cache antes de abrir os interiores. Abre ambas as tipologias e mede seis alternâncias na mesma sessão. A comparação usa a v9 imutável e o runtime novo, em Chrome desktop, sem qualificação física de celular.

| Backend | Mediana anterior ao retornar a uma planta | Mediana com reuso |
|---|---:|---:|
| WebGPU | 4.541 ms | 6,2 ms |
| WebGL2 | 2.600 ms | 6,0 ms |
| Automático com toque emulado | Não medido antes | 6,4 ms |

Esses tempos medem a conclusão da troca do visualizador; não são uma medição do tempo de apresentação física do monitor. A primeira abertura de Meio ainda levou 3.551 ms em WebGPU e 1.641 ms em WebGL2, porque o download prévio não prepara os gráficos. Não há promessa de abertura instantânea de uma tipologia nunca aberta ou depois de os recursos serem liberados.

Relatórios: `evidencias/troca-plantas-antes/runtime.json` e `evidencias/troca-plantas-conferida/runtime.json`. O ensaio atual confirma reuso das mesmas instâncias, zero novas requisições de interior nas trocas aquecidas, contagens de recursos próprios estáveis, uma única cena visível, nenhuma renderização/caminhada na suspensa, paredes completas por padrão, câmera/móveis/preferência preservados, escolha mais recente após trocas rápidas, isolamento de perda do dispositivo suspenso e descarte integral ao encerrar explicitamente o visualizador. Manter duas cenas usa mais memória que manter somente uma; a retenção é limitada a Canto e Meio durante a sessão.
