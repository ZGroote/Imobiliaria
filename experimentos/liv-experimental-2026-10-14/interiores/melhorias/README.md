# Interior aprovado do Blender no Tour

Os GLBs desta pasta vêm de cópias da cena `03 | Sala e jantar` de
`experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend`.
SHA256 da fonte preservada:
`517be435ec7072839a9088f2675c264e7fd297ff7c0f98c2bb2534035017db88`.

`catalogo.json` é o contrato de importação. Cada asset registra o SHA256,
tamanho, triângulos, objetos fonte, dimensões canônicas e pose do Canto.
O pivô é o centro do chão, Y aponta para cima e a frente canônica é +Z.
A transformação da fonte é `Three=(Blender.x, Blender.z, -Blender.y)`.

Canto usa escala autoral 1, posição e giro da fonte. Meio adapta a razão
entre seus footprints antigos e `referenceFootprintCanto`, preservando a
forma do modelo aprovado. Dimensões canônicas e bounds mundiais estão
separados. As cinco cadeiras de jantar/varanda e a cadeira lateral têm
poses individuais; a lateral possui GLB próprio porque sua geometria
aprovada é diferente, sem deformar um template para simular equivalência.

Foram exportados sofá, mesas de jantar/varanda/apoio, cadeiras, geladeira,
fogão, cozinha completa com cuba aberta, planta, quadro, livros e materiais
de parede/pisos. Os canais procedurais de material foram convertidos para
texturas de até 1024 px; imagens e normais UV já compatíveis foram mantidas.
Não há bake de iluminação, AO ou sol no albedo, nem luzes/câmeras nos GLBs.
O ambiente de iluminação é `ambiente-interior.hdr`: uma sonda local na posição
da câmera aprovada, com paredes, piso, teto, móveis e World originais.
`ceu.hdr` fica separado como background. O World global, sozinho no IBL do
Three, não recebe a oclusão das paredes; a sonda transfere a radiância que
realmente chega ao ponto de captura dentro da sala.

A sonda usa 512 × 256, 16 amostras CPU, dados lineares em EV 0 e nenhum ganho
adicional. A câmera fonte usa EV 3, registrado como `sourceExposureEV` para
uma transferência explícita entre os renderizadores. `Is Camera Ray` vê uma
cópia do céu sem disco solar; os raios indiretos e a amostragem de luz mantêm
o World original com sol, preservando seu rebatimento. Assim o disco direto
não é somado ao sol móvel do site. O catálogo/background são coordenados pelo
principal; o exportador da sonda não os escreve.

`ambiente-interior.json` registra a proveniência e a medição. Média RGB linear:
`[0.287926972, 0.196276009, 0.108162478]`; média por ângulo sólido:
`[0.263273122, 0.187242927, 0.112516537]`. A razão por canal em relação à média
de `ceu.hdr` é `[0.186384449, 0.080467609, 0.027656870]`.
SHA256 da sonda: `fc9765749487f57599977bc834813b326e1eff1731ff8f548badba34a11f9f77`.

A conversão corrigiu o Sheen: o exporter Blender 5.2 não multiplicava
Tint pelo Weight 0,4 nos tecidos. Os GLBs usam os valores reais da fonte,
preservando a rugosidade 0,5. Os PNGs de 16 bits da planta foram convertidos
para 8 bits, sem redução espacial, preservando a máscara alpha. O lobo
Translucent separado das folhas tem a limitação de portabilidade registrada
no catálogo; cor, alpha e normal foram preservados no PBR exportado.

O roundtrip independente comparou 16 bboxes com a cena original em densidade
de render: maior diferença de 0,016 mm no sofá; cadeiras abaixo de 0,00009 mm.
O parsing real de GLTFLoader verificou os arquivos e a integração em Canto
e Meio. A validação visual do Tour fica com o principal desta tarefa.

O export da sonda confirmou os mesmos bytes da fonte e dos 13 GLBs antes e
depois da captura. A versão inicial, que desligava o sol também nos indiretos,
foi preservada em `fontes/ambiente-interior-v1/` e substituída pela versão
com rebatimento solar. Nenhuma geometria, pose ou material foi redesenhado.

Para reproduzir, executar `exportar-web.py --mode export --asset all` no
Blender headless CPU e, depois, `fechar-export-web.py` no Python com Pillow.
O primeiro script mantém o catálogo incompleto durante os exports; o segundo
compacta as cópias, corrige Sheen de forma idempotente e fecha os hashes.
O módulo `materiais-web.py` cuida dos canais de material e mantém a fonte intacta.

## Correção da aparência na web

A primeira sonda local, com 16 amostras sem denoise, foi rejeitada: seu ruído
aparecia no reflexo da laca e do inox. O albedo do tampo foi isolado e comparado
entre fonte e GLB, com diferença zero. As sondas atuais usam 1024 × 512,
128 amostras e OIDN: sala global e jantar local para mesa, fogão e cozinha.
Ambas mantêm EV 0 e a fonte permanece intacta. Ganho de IBL é uma aproximação
do Tour e não equivale à exposição global do Cycles.

Os quatro GLBs complementares incluem cortinas, pendente com cabo, fruteira e
ripas existentes na fonte, totalizando 17 assets. Não importam novas luzes.
`complementos.json` registra as poses, mapas e verificações independentes.

O Look AgX / Medium Low Contrast foi extraído do OCIO da fonte para uma LUT
64³, em domínio log2 [-16,8], exposição externa. Seu RGB de saída é linear,
para uma única conversão final a sRGB. A LUT não recebe AgX novamente.
Erro médio de display fora da grade: 0,040%; máximo: 0,617%.

Após regenerar os arquivos de base/complementos/sondas/Look, executar
`node experimentos/liv-experimental-2026-10-14/atualizar-catalogo-melhorias.mjs`.
Esse passo confere fonte, tamanho e SHA antes de mesclar as transferências.
Em seguida executar `preparar-horario.mjs`. O catálogo final e o staging
não dependem mais de mesclagens manuais. Diagnóstico visual e versão rejeitada
estão em `evidencias-horario/cor-20261026/`.

Planta: [Potted Plant 01, de Rico Cilliers](https://polyhaven.com/a/potted_plant_01),
CC0 — Powered by Poly Haven. Os demais móveis vêm da biblioteca local
`experimentos/moveis-referencia`, sem suas luzes de estúdio.
