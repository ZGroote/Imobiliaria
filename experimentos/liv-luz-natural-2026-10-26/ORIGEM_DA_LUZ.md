# De onde vem a luz no LIV

**Modelo e imagens internas corrigidos, com fechamento técnico e conferência visual concluídos.** O problema relatado foi uma sala diurna em que teto e lateral pareciam iluminar o ambiente ao mesmo tempo, sem uma origem clara para a luz.

## Fonte adotada

Nas cenas internas de estar e jantar, a fonte é o **World com Sky Texture Multiple Scattering**, com o disco solar incluído uma única vez. Não há uma segunda lâmpada do tipo Sun para reforçá-lo. O mesmo World atende às duas tomadas internas.

As luzes artificiais foram removidas das cenas internas e a emissão dos materiais foi zerada. A luz exterior deve entrar pelos vãos de janela e pela varanda, respeitando a cobertura existente. O teto recebe luz rebatida por piso, paredes e móveis. Ele não deve emitir luz nem receber luz atravessando uma cobertura aberta.

O modelo corrigido inclui **um objeto AREA usado como portal de amostragem**, `cycles.is_portal=True`, com potência **0 W**. Ele orienta a amostragem da luz do World na abertura e é registrado separadamente dos emissores. A auditoria exige potência zero e uma única instância nessa abertura.

A exposição interna atual é +3 EV; a externa é −2,6 EV. Essa diferença é um ajuste da câmera para cada tomada e não representa outra luminária dentro da sala.

## Evidências disponíveis

O [relatório de origem da luz](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/origem_da_luz.json), gerado por `build`, registra:

- Nenhum objeto de luz artificial ativo e nenhum material emissivo encontrado pela auditoria do estar.
- Sol com elevação de 35° e azimute de 80°.
- Raios verticais em três pontos do interior atingindo o forro original a 2,70 m.
- Sol direto bloqueado nos quatro pontos amostrados: mesa, piso do estar, parede da arte e teto. Na mesa, o raio atravessa os vidros e encontra a cobertura da varanda. Isso é compatível com um interior iluminado principalmente pelo céu e por rebatimentos; não exige uma faixa de sol direto em toda a sala.

Esses raios são amostras locais. Eles não comprovam cada ponto da geometria nem substituem os renders de diagnóstico.

A direção do sol também foi medida em EXRs lineares de um céu sem geometria pelo [calibrar_ceu.py](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/calibrar_ceu.py). O vetor medido `(0,1416; 0,8053; 0,5757)` está próximo do calculado `(0,1422; 0,8067; 0,5736)`. O registro está em [sol_medido.json](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/sol_medido.json).

Essa medição evita repetir uma falha de interpretação da rotação: no cálculo utilizado pelo Cycles, o azimute é `pi/2 - sun_rotation`. A convenção foi conferida na [implementação oficial do Blender](https://raw.githubusercontent.com/blender/blender/main/intern/cycles/scene/shader_nodes.cpp) e, depois, no céu renderizado da instalação local.

## Comparação e testes de diagnóstico

| Imagem | O que comparar | Estado |
|---|---|---|
| [Sala da revisão anterior](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-render-revisao-2026-10-26/entrega/LIV_sala_revisado.png) | Origem ambígua da luz no teto e na lateral. | Base anterior preservada. |
| [Estar diurno r04](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/r04/LIV_estar_dia.png) | Leitura da luz entrando pela varanda, teto por rebatimento e ruído residual. | Conferida visualmente: prévia limpa e cuba aberta. Ainda sem aprovação do usuário. |
| [Estar final corrigido](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_estar_dia.png) | Conferir Q17/Q19 na resolução completa. | 2048 × 1536; sem as manchas no sofá, tapete e tampo da mesa; revisão independente sem regressão bloqueante. |
| [Jantar final corrigido](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_jantar_dia.png) | Conferir cozinha, cuba e luz da abertura. | 2048 × 1280; cuba aberta, sem regressão bloqueante; varanda ainda muito clara. |
| [Somente céu, sem disco solar](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/diagnostico/LIV_estar_ceu.png) | Quanto da iluminação vem do céu quando o disco solar é desligado. | Conferida visualmente: cena iluminada de forma mais fria e difusa. |
| [World apagado](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/diagnostico/LIV_estar_apagado.png) | A imagem deve ficar preta quando a única fonte exterior é zerada. Claridade restante exige investigar outro emissor. | Conferência visual preta; o EXR linear mediu máximo RGB = 0,0. |

A conferência numérica do [diagnóstico EXR linear](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/diagnostico/LIV_estar_apagado.exr) confirmou máximo RGB de **0,0**, sem relaxar o limite de 0,001. O PNG8 de visualização anterior tinha máximo de 1/255; transformação de cor e quantização impedem usá-lo como medida direta de radiância. O novo blackout foi salvo em EXR de 32 bits e PNG de 16 bits sem dither; o original foi preservado. Os dados estão em [blackout_linear.json](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/blackout_linear.json).

O [fechamento final](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/validacao.json) confirmou erro solar de **0,149353°**, **48 texturas** persistidas após salvar e reabrir o `.blend`, **duas tampas planas persistidas** e o mesmo World nas duas fotos internas. A auditoria registra zero emissores internos e um portal de 0 W. Os SHA256 dos quatro PNGs e do modelo estão em [SHA256SUMS.txt](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/SHA256SUMS.txt).

A primeira conferência do [estar final anterior à correção, preservado](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/q17_original/LIV_estar_dia.png) encontrou manchas escuras irregulares no sofá, na mesa e no tapete que não apareciam na prévia pequena. A investigação isolou ineficiência de amostragem e uma falha nas normais da mesa, descritas abaixo. O novo estar de 2048 × 1536 foi conferido sem essas marcas. Estar e jantar finais passaram pela conferência visual e revisão independente; a aprovação técnica foi complementada por essa avaliação das imagens completas.

O [terceiro recorte diagnóstico](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/q17/estar_portal.png) confirmou ganho de amostragem com um portal de potência zero na abertura: o sofá e o tapete ficaram limpos, sem aumentar amostras ou mudar a fonte. A fração de pixels RGB bruto exatamente zero passou de 20,83% para 0,906%. O portal orienta a busca da luz existente e não é uma luminária. Seu [inventário](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/q17_portal_inventario.json) é separado do inventário de emissores; o patch da auditoria exige potência zero.

A marca restante da mesa estava ausente do albedo e coincidia com normais variáveis em um tampo plano. As tampas n-gon tinham suavização herdada das laterais. A correção local deixa as tampas planas e as laterais suaves; um [teste de normal em CPU](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/q17/mesa_tampas_planas_normal_cpu.png) confirmou normal constante no tampo. O patch foi aplicado ao `.blend`, sem alterar o helper original, e o blackout com o portal confirmou novamente máximo RGB linear = 0,0. As tomadas internas foram refeitas com 256 amostras e conferidas na resolução completa, encerrando Q17/Q19 nesta rodada.

Permanecem limites de apresentação: geladeira e porta à esquerda, móvel da direita cortado, grain pontilhado da mesa e perda de contraste dos móveis da varanda contra a abertura muito clara. A aproximação do vidro continua descrita abaixo.

## Aproximação adotada para o vidro

O material dos vidros planos mantém reflexão e refração para os raios vistos pela câmera. Para raios de sombra, usa transparência com atenuação de **0,96 por face**. É uma aproximação de vidro fino para reduzir o ruído de cáusticas e permitir a entrada de luz; não cria energia nem adiciona emissores.

Essa solução não promete reproduzir perfeitamente espessura, múltiplas lâminas, absorção e cáusticas de um vidro real. Quando um raio atravessa várias faces, a atenuação se acumula. Esse limite deve acompanhar a avaliação da imagem.

## Falhas a não repetir

| Falha observada | Regra para a próxima tentativa |
|---|---|
| Área de 480 W na janela, preenchimento de 35 W no interior, sol de 1,3 e pendente de 38 W juntos numa vista diurna. | Manter a origem exterior coerente e testar com o World apagado antes de acrescentar outra fonte. |
| Interior escuro tratado como falta de luminárias. | Conferir exposição, entrada de luz e ruído. Teto claro deve vir de rebatimento. |
| Sol baixo de 20° produzindo uma faixa dura pouco adequada à tomada. | Julgar direção e proteção solar da varanda na câmera final; a configuração atual usa 35°. |
| Rotação solar calculada com o sinal errado. | Conferir a convenção na implementação e medir o disco solar no EXR renderizado. |
| Manchas de iluminação indireta em 32 amostras. | Comparar com mais amostras e conferir o vidro antes de confundir ruído com uma nova fonte de luz. |
| Peças rígidas no lugar dos móveis da biblioteca e risco de importar um estúdio inteiro. | Usar os ativos locais com geometria e materiais selecionados, sem luzes, câmeras ou cenários de catálogo. |
| Cuba coberta por carcaça maciça e faces invertidas. | Corrigir geometria e verificar o fundo com raio. Luz não corrige uma cuba fechada. |

O histórico completo permanece no [DIARIO.md](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/DIARIO.md). A planta em corte usa luz de apresentação separada e não é uma evidência da iluminação das fotos internas.
