# LIV — rodada de luz natural

**Renderização concluída, conferida visualmente e validada tecnicamente.** Estar e jantar foram refeitos com as correções de Q17/Q19. O primeiro conjunto de renders e seu fechamento técnico foram preservados para comparação.

A base é [LIV_Revisado.blend](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-render-revisao-2026-10-26/entrega/LIV_Revisado.blend). O arquivo anterior e seus renders são preservados. O histórico dos problemas e das tentativas está no [DIARIO.md](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/DIARIO.md); a explicação e os limites da iluminação estão em [ORIGEM_DA_LUZ.md](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/ORIGEM_DA_LUZ.md).

## O que mudou

O estar e o jantar usam um World com **Sky Texture Multiple Scattering e o disco solar incluído uma única vez**. As luzes artificiais e a emissão de materiais foram desligadas nas cenas internas. A luz chega pelas aberturas e pela varanda; o teto deve ficar claro pelo rebatimento nas superfícies. A exposição da câmera pode variar entre interior e exterior sem acrescentar uma fonte de luz.

Um objeto AREA configurado como **portal de amostragem, com potência zero**, orienta os raios para a abertura existente. Ele entra no inventário como auxiliar de amostragem. A auditoria continua exigindo zero emissores internos e rejeita potência positiva ou duplicação do portal.

O vidro plano usa uma aproximação de vidro fino: raios de sombra atravessam com atenuação de 0,96 por face, enquanto os raios da câmera mantêm reflexão e refração. Isso reduz o ruído de cáusticas. Não equivale a uma simulação física perfeita de um conjunto de vidros real.

A **planta do apartamento em corte** conserva uma iluminação de apresentação separada. Ela serve para mostrar o espaço aberto pelo corte e não deve ser usada para julgar a origem da luz nas fotografias internas com teto.

Os móveis vêm da biblioteca local [moveis-referencia](C:/Users/respawn/Desktop/imobiliaria/experimentos/moveis-referencia). A importação seleciona geometria e materiais, sem trazer luzes de estúdio. A planta adquirida é [Potted Plant 01, de Rico Cilliers](https://polyhaven.com/a/potted_plant_01), licença CC0 — **Powered by Poly Haven**. Os arquivos baixados e seus hashes estão no [manifesto do ativo](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/polyhaven/manifest.json).

## Comparação e diagnósticos

| Imagem | Uso e estado |
|---|---|
| [Antes: sala da revisão anterior](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-render-revisao-2026-10-26/entrega/LIV_sala_revisado.png) | Referência do problema de teto e lateral parecerem fontes simultâneas. |
| [Prévia r04 do estar](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/r04/LIV_estar_dia.png) | Histórico da prévia pequena que orientou a rodada; os defeitos de Q17 só apareceram na primeira resolução final. |
| [Depois: estar final corrigido](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_estar_dia.png) | 2048 × 1536, conferido sem as manchas no sofá, tapete e tampo da mesa. |
| [Diagnóstico: céu sem disco solar](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/diagnostico/LIV_estar_ceu.png) | Conferência visual: a mesma cena continua iluminada, com aspecto mais frio e difuso. |
| [Diagnóstico: World apagado](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/diagnostico/LIV_estar_apagado.png) | Conferência visual preta. A medição do EXR linear confirmou máximo RGB = 0,0. |

O inventário atual registra zero luzes artificiais e zero materiais emissivos nas verificações da cena do estar. Isso é uma evidência técnica; a simples existência dos PNGs de diagnóstico não aprova os testes. Veja [origem_da_luz.json](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/origem_da_luz.json).

A revisão independente do estar e do jantar finais não encontrou regressão bloqueante. Permanecem limites de apresentação: geladeira e porta ainda aparecem no enquadramento, o móvel à direita fica cortado, o grain da mesa tem aspecto pontilhado e a varanda muito clara perde leitura.

**Problema encontrado na primeira resolução final:** o [estar anterior à correção, preservado](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/q17_original/LIV_estar_dia.png), revelou manchas escuras irregulares no sofá, na mesa de centro e no tapete, ausentes na r04 pequena. O novo estar foi conferido sem essas marcas. Os casos Q17/Q19 e seus tratamentos estão registrados no diário; a validação técnica e a conferência visual foram repetidas sobre o conjunto final.

O [fechamento final](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/validacao.json) confirmou **48 texturas empacotadas após salvar e reabrir**, **duas tampas planas persistidas**, o mesmo World nas duas fotos internas, erro solar de **0,149353°**, teto fechado nas três amostras e sofá/quadro dentro das margens de enquadramento. A medida de luz residual usa o [EXR linear do blackout](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/diagnostico/LIV_estar_apagado.exr), refeito após aplicar o portal e igual a **0,0**. O PNG8 anterior tinha máximo de 1/255 depois da transformação de visualização e quantização; ele foi preservado, e o limiar da validação não foi relaxado.

O [recorte com portal de amostragem](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/q17/estar_portal.png) limpou sofá e tapete mantendo as 256 amostras e a mesma fonte. O portal tem potência zero e orienta a amostragem do World pela abertura; fica separado dos emissores na auditoria. A fração de pixels RGB bruto igual a zero caiu de 20,83% para 0,906%. A marca restante da mesa não era a textura: as tampas planas estavam suavizadas com as laterais. O [teste de normais em CPU](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/previas/q17/mesa_tampas_planas_normal_cpu.png) confirmou o tampo plano após a correção local. Os dois tratamentos foram aplicados ao `.blend` e conferidos nas imagens finais, com a versão anterior preservada em `fontes/q17_original/`.

## Como reproduzir

Os comandos abaixo são para PowerShell e usam o executável local desta entrega. `build` recria o arquivo desta rodada a partir da base anterior; use uma nova pasta de prévia para manter o histórico das tentativas.

```powershell
$blender = 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe'
$rodada = 'C:\Users\respawn\Desktop\imobiliaria\experimentos\liv-luz-natural-2026-10-26'
```

1. `build` importa os ativos, aplica as correções, audita a cena, empacota as texturas e salva/reabre o `.blend`.

   ```powershell
   & $blender --background --factory-startup --python-exit-code 1 --python "$rodada\renderizar.py" -- --mode build
   ```

2. `draft` renderiza uma prévia em `previas/<round>`. `--shot` aceita `estar`, `jantar`, `exterior`, `apartamento` ou `all`; `--samples` e `--scale` controlam amostras e porcentagem da resolução.

   ```powershell
   & $blender --background --factory-startup --python-exit-code 1 --python "$rodada\renderizar.py" -- --mode draft --shot all --round r05 --samples 96 --scale 38
   ```

   Os diagnósticos do interior usam a mesma cena, alterando somente o World na memória. `ceu` remove o disco solar; `apagado` zera a intensidade do World.

   ```powershell
   & $blender --background --factory-startup --python-exit-code 1 --python "$rodada\renderizar.py" -- --mode draft --shot estar --round diagnostico --variant ceu --samples 96 --scale 38
   & $blender --background --factory-startup --python-exit-code 1 --python "$rodada\renderizar.py" -- --mode draft --shot estar --round diagnostico --variant apagado --samples 96 --scale 38
   ```

3. `final` renderiza a resolução e a qualidade configuradas no `.blend`, gravando em `entrega`. As opções de redução `--samples` e `--scale` só se aplicam a `draft`.

   ```powershell
   & $blender --background --factory-startup --python-exit-code 1 --python "$rodada\renderizar.py" -- --mode final --shot all
   ```

4. `finish` exige os quatro renders finais e o EXR do diagnóstico apagado, confere as dimensões, mede a luz residual em dados lineares, repete a auditoria de luz, salva/reabre o `.blend`, verifica as texturas empacotadas e grava `entrega/validacao.json`. O comando `draft --variant apagado` gera o PNG e o EXR na mesma execução. A validação técnica não substitui a avaliação visual registrada no diário.

   ```powershell
   & $blender --background --factory-startup --python-exit-code 1 --python "$rodada\renderizar.py" -- --mode finish
   ```

O [calibrar_ceu.py](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/calibrar_ceu.py) mede a direção solar no céu realmente renderizado. Ele gera cinco EXRs lineares sem a geometria do apartamento e grava o pico solar em [sol_medido.json](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/fontes/sol_medido.json). A medição usa CPU e serve para conferir a convenção de rotação da versão instalada do Blender.

```powershell
& $blender --background --factory-startup --python-exit-code 1 --python "$rodada\calibrar_ceu.py"
```

## Arquivos gerados

| Arquivo | Conteúdo |
|---|---|
| [LIV_estar_dia.png](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_estar_dia.png) | 2048 × 1536; estar corrigido, 256 amostras. |
| [LIV_jantar_dia.png](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_jantar_dia.png) | 2048 × 1280; jantar e cozinha diurnos. |
| [LIV_exterior_dia.png](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_exterior_dia.png) | 2560 × 1600; exterior do condomínio. |
| [LIV_apartamento_dia.png](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_apartamento_dia.png) | 2400 × 2000; planta em corte com iluminação de apresentação. |
| [LIV_Luz_Natural.blend](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend) | Cenas e texturas empacotadas. |

Os quatro PNGs foram abertos para conferência. Estar e jantar finais passaram também por revisão visual independente. Exterior e planta foram preservados desta rodada, com a iluminação de apresentação da planta separada das fotos internas.

Os **SHA256 completos dos quatro PNGs e do `.blend`** estão em [SHA256SUMS.txt](C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-luz-natural-2026-10-26/entrega/SHA256SUMS.txt) e no relatório de validação. SHA256 do modelo final: `517be435ec7072839a9088f2675c264e7fd297ff7c0f98c2bb2534035017db88`.
