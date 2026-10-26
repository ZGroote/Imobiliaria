# LIV — origem da luz e direção visual

## Fonte preservada

Base: `../liv-render-revisao-2026-10-26/entrega/LIV_Revisado.blend`.
Não sobrescrever a base ou os renders já entregues. A versão do LIV continua
sendo a publicada em conectaimoveis3d.com.br, com a mesma arquitetura e implantação.

## Feedback e objetivo desta rodada

O usuário perguntou de onde vem a iluminação numa imagem diurna: o teto e a
lateral parecem fontes simultâneas. Autorizou seguir com esse ajuste e com os
demais pontos levantados: composição, móveis, cozinha, plantas e exterior.

## Falhas e prevenção

| ID | Falha / causa | Correção e critério |
|---|---|---|
| Q13 | Fontes sem motivação: área na janela, preenchimento interno, sol e pendente aceso ao mesmo tempo numa cena diurna. | Dia com céu e um único sol coerente. Sem emissores internos, sem luz atravessando teto. Conferir inventário, raios de visibilidade e ablação céu/sol. Teto claro deve resultar de rebatimento. |
| Q14 | Ativos rígidos usados sem consultar a biblioteca de móveis já existente no projeto. | Avaliar os ativos locais mais detalhados; importar somente geometria e materiais. Nunca importar as luzes de estúdio desses arquivos. |
| Q15 | Direção visual fragmentada: geladeira e porta aberta competem com o estar, quadro e acessórios parecem peças geométricas. | Escolher o assunto da câmera, resolver porta e móveis antes de variar luz. Conferir em prévia na proporção final. |
| Q16 | Cuba parecia um contorno sobre uma superfície fechada. A primitiva herdada tinha faces invertidas; depois de corrigida, o raio identificou que a carcaça era um bloco maciço cobrindo a cuba por baixo. | Corrigir orientação e construir carcaça oca. Raio no centro da cuba deve atingir o fundo abaixo de 0,80 m, não tampo ou corpo do gabinete. Não tentar corrigir geometria com iluminação. |
| Q17 | O estar final de 2048 × 1536 revelou manchas escuras irregulares no sofá e tapete, ausentes na prévia r04 pequena. A amostragem da luz indireta deixava muitos pixels sem contribuição, e o denoising convertia o ruído em manchas. | Portal de amostragem de potência zero na abertura, sem aumentar amostras nem acrescentar emissor. Conferir a resolução final. O novo estar ficou limpo e passou por revisão independente; não presumir que a prévia pequena aprova o final. |
| Q18 | A primeira validação do blackout leu máximo de 1/255 num PNG8 de visualização, confundindo dados após transformação de cor e quantização com radiância linear. | Medir o blackout em EXR linear de 32 bits, com dither desligado. O novo EXR confirmou máximo RGB = 0,0; o limite de 0,001 foi mantido e o PNG original foi preservado. |
| Q19 | O tampo plano da mesa de apoio herdava `use_smooth=True` inclusive nas tampas n-gon de uma malha torneada. O passe de normal mostrava setores com direções diferentes no tampo; a marca escura não aparecia no albedo e não era o grain da madeira. | Deixar as duas tampas planas em flat shading e preservar suavização das laterais. Correção somente nesta rodada, sem modificar o helper ou entregas anteriores. O teste CPU confirmou normal constante; o novo final confirmou o tampo uniforme e a persistência das duas tampas planas ao reabrir. |

## Fontes de método

Skills existentes: iluminação, câmeras, materiais e revisão por evidências.
O problema exige aplicar esses métodos e validar a origem da luz; não exige
publicar ou alterar skills globais. O histórico Q01–Q12 está no diário anterior.

Documentação primária: Blender Sky Texture e implementação oficial do shader.
Após a normalização pública do Cycles, o cálculo adotado é
`azimute = pi/2 - sun_rotation`; a correção e medição estão registradas abaixo.
Céu e sol devem compartilhar orientação.
Não confundir o estúdio usado numa foto de catálogo com a luz da sala montada.

## Rodadas

R00: inventário concluído. A perspectiva anterior tinha área de 480 W na janela,
área de 35 W no interior, sol de 1,3 e pendente de 38 W. Os móveis locais são
importados sem câmeras, mundos, paredes e luzes de estúdio.

R01: primeira prévia com zero emissores internos. O interior ficou escuro e o
exterior muito claro. Corrigir exposição de câmera, sem inserir preenchimento
invisível. A elevação de 20° produziu uma faixa dura de sol baixo; testar 35°
e respeitar a proteção solar da varanda. Sofá agora usa malha simulada de pano,
cadeiras estofadas, eletrodomésticos e cozinha com cuba aberta e ferragens.

Correção de método: o shader Cycles normaliza a rotação pública para
`2*pi-rotation` antes de acrescentar `pi/2`. A direção calculada deve usar
`azimute=pi/2-rotation`, não somar diretamente a propriedade da interface.
Código oficial consultado: https://raw.githubusercontent.com/blender/blender/main/intern/cycles/scene/shader_nodes.cpp

R02: exposição externa -2,6 EV e interna +3,5 EV, sol com elevação de 35°,
azimute de 80°. Mesmo céu nas duas tomadas internas. A diferença de exposição
é da câmera e não acrescenta luz ao ambiente. A arte passa a ser impressão plana
com composição definida; o ruído aleatório anterior parecia uma mancha.

R02: o sentido da luz ficou reconhecível e os móveis têm volumes mais suaves,
mas a prévia de 32 amostras mostra manchas de ruído na iluminação indireta.
Vidros planos finos passam a transmitir raios de sombra com atenuação de 0,96
por face, preservando reflexão/refração para a câmera. É uma aproximação de
janela fina para evitar ruído de cáusticas; não acrescenta emissores. Conferir
de novo a 96 amostras e separar do problema de origem da luz.

Exterior: variar malhas e rotação das copas sem mover seus centros; reduzir
reflexo excessivo da folhagem e suavizar arestas dos veículos da base.
R03: exposição interna +3 EV e paredes um pouco mais neutras; não tentar
clarear a sala adicionando luz no teto.

R03: prévias de 96 amostras reduziram as manchas. A cuba continuava fechada,
revelando Q16; a correção inclui orientação das novas caixas e auditoria de
sólidos decorativos herdados. A geometria de paredes e teto não é alterada.

Medição empírica do céu renderizado em cinco direções (EXR linear, sem cenário):
vetor solar medido (0,1416; 0,8053; 0,5757), coerente com o vetor calculado
(0,1422; 0,8067; 0,5736). Evidência em `fontes/sol_medido.json`.
Isso verifica a convenção de rotação no Blender instalado, além da documentação.

R04: prévias abertas e comparadas. A cuba é aberta, as manchas no estar foram
eliminadas, o pendente está desligado e a luz tem leitura consistente com a
abertura. O teste com apenas o céu é mais frio e difuso. O teste sem céu/sol
ficou visualmente preto; a medição de pixels será feita no fechamento.

Revisão independente das quatro prévias: nenhuma falha visual bloqueante para
a linguagem ilustrativa da base. Restam dois pontos menores: geladeira/porta
ainda fazem parte da composição do estar e a mobília da varanda tem menos
contraste contra o exterior claro. Esses limites não são ocultados pelo relatório.

## Primeiro conjunto de renders finais e descoberta de Q17

O log `logs/finais.log` confirmou quatro `RENDER_OK` e `Blender quit`, após
24 min 25 s: exterior (2560 × 1600), planta em corte (2400 × 2000), estar
(2048 × 1536) e jantar (2048 × 1280). Os quatro arquivos foram abertos com
`view_image`. Exterior e planta não mostraram falhas bloqueantes nessa
conferência. Jantar mantém a varanda muito clara. O estar revelou Q17,
comparado diretamente com a r04.

O primeiro `finish` falhou em Q18. Após medir o blackout em EXR linear, sem
relaxar o limite, o fechamento técnico passou: máximo RGB residual = 0,0;
erro solar = 0,149353°; 48 texturas empacotadas persistiram ao salvar e
reabrir; sofá e quadro estão dentro das margens de enquadramento. Evidência
em `entrega/validacao.json`. Isso não resolve nem aprova Q17.

## Investigação de Q17

A inspeção sem render não encontrou SSS ativo no interior nem volumes
fechados negativos nos objetos afetados. Não há displacement nos materiais
do sofá, mesa e tapete. Os passes de albedo e normal do recorte estão limpos;
o passe sem denoising tem ruído preto forte, que o OIDN converte em manchas.

Teste 1: recorte de 1024 × 768 na escala de pixels da imagem final, mantendo
256 amostras e alterando somente o vidro para transmitir também raios difusos.
As manchas persistiram. Essa hipótese não foi aplicada ao `.blend`.
Evidência em `previas/q17/estar_vidro_difuso.exr`, PNG correspondente e passes
`Noisy_Image.png`, `Denoising_Normal.png` e `Denoising_Albedo.png`.

Teste 2: mesmo recorte, fonte, vidro e amostras do original, alterando apenas
a amostragem do World de `AUTOMATIC` para `NONE`. O resultado ficou mais
escuro e muito mais manchado; a alteração foi rejeitada e não foi aplicada.
Evidência em `previas/q17/estar_mis_none.png` e EXR correspondente.

Reprocessar o EXR existente no OIDN em CPU, com passes de albedo e normal e
prefiltro Accurate, também manteve as manchas. O passe bruto do primeiro
recorte tem 20,83% de pixels com RGB exatamente zero, alfa sempre 1 e nenhum
valor RGB negativo (`fontes/q17_noisy_stats.json`). Isso favorece a hipótese
de baixa eficiência/subamostragem da iluminação indireta; a causa específica
ainda não está confirmada. Não houve aumento de amostras nem aplicação das
duas hipóteses ao arquivo de entrega.

Terceiro teste autorizado: portal de amostragem na abertura existente. A
[documentação oficial do Blender 5.2](https://docs.blender.org/manual/en/5.2/render/cycles/light_settings.html)
explica que portais orientam a amostragem da luz do ambiente para interiores.
O recorte usou a mesma fonte, vidro original e 256 amostras, com um portal de
potência zero, 0,73 × 2,02 m, dentro da abertura medida. O sofá e o tapete
ficaram limpos, e a fração de pixels RGB exatamente zero no passe bruto caiu
de 20,83% no primeiro recorte para 0,906% com portal, redução de cerca de
95,65%. Isso comprova ganho de amostragem sem acrescentar energia. A mesa
ainda tinha uma marca frontal direita, tratada separadamente em Q19.

Evidências: `previas/q17/estar_portal.png`, EXR correspondente,
`fontes/q17_portal_noisy_stats.json` e `fontes/q17_portal_inventario.json`.
O inventário diferencia o portal dos emissores. A auditoria local exige
potência zero no portal e continua rejeitando lâmpadas e materiais emissivos.

Q19 foi isolado por revisão do passe de albedo, do passe de normal e do
código de construção da mesa. Um teste de normal em CPU, uma amostra e
World apagado confirmou o tampo plano após corrigir somente suas tampas:
`previas/q17/mesa_tampas_planas_normal_cpu.png`. Não houve ajuste de textura
nem aumento de amostras para esconder a marca.

O patch de portal e tampas foi aplicado ao `.blend` e salvo/reaberto em CPU.
A versão anterior do arquivo, os PNGs internos e sua validação foram
preservados em `fontes/q17_original/`. A auditoria registra zero emissores e
um portal de potência zero; o blackout foi refeito com esse portal e confirmou
novamente máximo RGB linear = 0,0. Os novos renders internos aguardaram a
liberação da GPU antes de iniciar; o fechamento está registrado a seguir.

## Fechamento R05 — 26/10/2026

Novo estar final concluído em 11 min 45 s, 2048 × 1536, mantendo as 256
amostras e a mesma fonte. A imagem completa foi aberta com `view_image`:
sofá e tapete limpos, tampo da mesa uniforme, sem as marcas de Q17/Q19.
Revisão independente confirmou a correção e não encontrou regressão bloqueante.

Novo jantar final concluído em 10 min 16 s, 2048 × 1280, também com 256
amostras. A imagem completa foi aberta e revisada de forma independente:
cuba aberta, luz e objetos coerentes, sem regressão bloqueante. A varanda
segue muito clara, com perda de contraste de mesa e cadeiras externas.

Exterior (2560 × 1600) e planta em corte (2400 × 2000) foram preservados desta
rodada. A planta mantém a iluminação de apresentação separada das fotos.

`finish` final encerrou com código 0 e `TECHNICAL_OK`: 48 texturas empacotadas
persistiram após salvar/reabrir; as duas tampas planas persistiram; estar e
jantar compartilham o mesmo World; zero emissores internos e um portal de
0 W; blackout EXR máximo RGB = 0,0; erro solar = 0,149353°; sofá e quadro
respeitam as margens de enquadramento. Evidência em `entrega/validacao.json`.

Q17/Q19 encerrados nas imagens finais desta rodada. Permanecem limites
estéticos: geladeira/porta à esquerda, móvel da direita cortado, grain
pontilhado da madeira e varanda muito clara. O vidro fino segue como
aproximação de transmissão de raios de sombra, com atenuação de 0,96 por face.

Integridade registrada em `entrega/SHA256SUMS.txt`:

```text
2d3b2425a15043336078e92fc0664d1506a30c23f4f636149641d0db96f35749  LIV_exterior_dia.png
dad127e6e5220838aeec65393cf9ddbc14cb82b75a9326c45601a1f6d205bce5  LIV_apartamento_dia.png
e15eb2e8dafeeef349940e5cc7f5417980d7a440ea12f45ee124b3c0d8612da8  LIV_estar_dia.png
ab3414fed737fd6793bf53bc50bcd78d2d69951e7eb82143ec89d739b3ec55ec  LIV_jantar_dia.png
517be435ec7072839a9088f2675c264e7fd297ff7c0f98c2bb2534035017db88  LIV_Luz_Natural.blend
```

## Transferência do ambiente para o Tour — 26/10/2026

A cena aprovada não foi retunada. A importação do World exterior como IBL
global do Three deixou o interior branco/azulado porque esse IBL não recebe
a oclusão das paredes do ambiente. O tratamento é transferir uma sonda de
radiância local com a geometria aprovada, separando iluminação e background.

Uma primeira sonda de 512 × 256, 16 amostras CPU, na posição da câmera
`CAM | 03 | Sala e jantar`, foi capturada com o disco solar desligado em
todos os caminhos. Isso também retirava o rebatimento solar aprovado;
a versão foi preservada em `fontes/ambiente-interior-v1/`.

A versão final mantém o World original com sol para indiretos e amostragem
de luz. Somente `Is Camera Ray` recebe o céu sem disco. O background exterior
continua separado em `ceu.hdr`; o site representa o disco por seu sol móvel.
Posição da sonda em Three: `[-0.55, 1.43, 0.35]`. Saída linear EV 0;
`sourceExposureEV = 3.0` apenas nos metadados, sem multiplicação escondida.

Resultado em `interiores/melhorias/ambiente-interior.hdr/json`: 469.014 bytes,
512 × 256, 16 amostras CPU, sem denoising. Média RGB linear:
`[0.287926972, 0.196276009, 0.108162478]`; média por ângulo sólido:
`[0.263273122, 0.187242927, 0.112516537]`. Razão por canal com o céu exterior:
`[0.186384449, 0.080467609, 0.027656870]`; máximo RGB linear: 16,75.
SHA256: `fc9765749487f57599977bc834813b326e1eff1731ff8f548badba34a11f9f77`.

O export preservou byte a byte o `.blend` aprovado e os 13 GLBs, e não
escreveu o catálogo. A integração de `environment` local e `background`
exterior fica sob responsabilidade do principal. A correção é de transferência
entre renderizadores, sem redesenhar móveis, materiais ou iluminação da fonte.
