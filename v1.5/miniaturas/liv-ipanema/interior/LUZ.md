# Luz interna própria do LIV

Entrada de autoridade: `previa/unidade.json` produzida pelo construtor existente. O visualizador monta `FloorPlan`, `HouseMesh` e `FurnitureCatalog`; `exporter-interior.js` exporta essas mesmas malhas, sem reconstrução arquitetônica no Blender. Inclui o forro oculto na vista de planta. Não usa fontes, UVs ou atlas do Cedros.

`guardarAlbedoInteriorLiv(grupo)` precisa rodar imediatamente após `HM.geoDaCasa()` e antes da fila de AO JS. A cópia `userData.livAlbedo` usa os mesmos vértices e preserva a cor do acabamento sem multiplicar duas oclusões. Móveis/texturas devem estar aprovados antes da exportação final.

## Exportação

No navegador, chamar `await exportarCenaInteriorLiv({THREE,root:planta3d,unitId,unitHash,unitPath,height,rooms,lighting})`. `unitHash` é SHA-256 dos bytes do JSON do construtor. `rooms` traz centros no mesmo referencial mundial de `matrixWorld`, por exemplo `cx-ob.cx`, `cz-ob.cz` na página. `lighting` pode definir `world`, `sun` e `ceiling`; sem configuração explícita, o importador registra o estilo de luz do pipeline canônico, com fontes colocadas nos cômodos LIV.

Gravar o resultado como `luz/source.json`. Cada `InstancedMesh` vira um registro por instância. `slot` conta todas as malhas da travessia, inclusive detalhes excluídos do atlas. `matrix` é column-major mundial. Os atributos exportados são números float32 normalizados. A identidade geométrica é SHA-256 de cinco comprimentos uint32LE, seguidos de position/normal/uv/color float32LE e index uint32LE. Texturas guardam PNG, transformação UV e hash dos bytes PNG.

## Preparação e aprovação

Da raiz do repositório:

```powershell
& C:/Python314/python.exe v1.5/miniaturas/liv-ipanema/interior/preparar_luz.py --size 2048
```

Gera `export.json`, `unwrap.json`, `geometry-compact.json`, gzip e snapshot `source-scene.json`. UV1 é independente por malha/instância, sem sobreposição entre instâncias. Compact guarda índices uint32LE e UV uint16LE, em base64, preservando grupos de material e a ordem dos cantos. Padding padrão é oito pixels no espaço xatlas; o relatório calcula o padding efetivo após normalizar o atlas para 2048².

`auditar_cena.py` verifica a malha de paredes/rodapés do HouseMesh e sobreposições horizontais no tapete. A preparação recusa a fonte real quando essa auditoria falha. A distinção de origem é essencial: `ShellGeometry.prismaQuad` emite winding exterior com normal lateral interior no código compartilhado original; a correção LIV nega somente essas normais antes de AO/export. `Openings.pecaOr` já fornece normal exterior com winding interior e DoubleSide; nesse caso a normal permanece e o importador reorienta os índices. Negar todas as normais com dot negativo quebraria as esquadrias.

O tapete antigo da biblioteca tinha relevos de 3 mm arredondados em centímetros durante exportação, causando faces de campo/listras coplanares. O LIV usa uma malha única fina chanfrada, tecido e cor cadastral, mantendo a mesma entidade e footprint. A auditoria detectou 18 pares sobrepostos na fonte antiga e zero na corrigida. Não altera o atlas para esconder o problema.

Antes de recalcular uma fonte corrigida, preparar/importar em uma pasta QA separada com `--import-only --no-glb`. `render_diagnostico.py` cria sala e topo com 24 amostras, exposure zero e materiais/luzes originais. O topo esconde o forro somente dos raios de câmera e mantém sombra/indireto. Gravar aprovação somente após verificar essas imagens e a cena navegável corrigida.

Após aprovação visual da geometria/layout, o coordenador grava `luz/approval.json` com `approved:true`, `sourceSHA256` e `unitSHA256` exatamente iguais ao `export.json`. O bake recusa uma aprovação ausente ou obsoleta.

## Cálculo

```powershell
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background --python v1.5/miniaturas/liv-ipanema/interior/bake_luz.py -- --samples 512
& C:/Python314/python.exe v1.5/miniaturas/liv-ipanema/interior/denoise_luz.py --guard 2
& C:/Python314/python.exe v1.5/miniaturas/liv-ipanema/interior/auditar_saida.py
```

Cycles usa DIRECT+INDIRECT, cinco bounces difusos e nenhum COLOR pass. O albedo original participa do ricochete, mas o browser aplica a cor da superfície apenas uma vez. Normais split fornecidas pelo Three são preservadas. Materiais e mapas UV0 são importados; vidro/metal/plafon não recebem atlas, mas integram a cena de oclusão. Plafon não projeta sombra sobre sua própria fonte.

Autoria: `interior-source.blend`, `interior-source.glb` e `interior-baked.blend`. GLB contém as mesmas malhas, normais, materiais PBR e canais UV; o transporte RGBM pertence à integração própria do viewer. Funções de shader que não têm equivalente glTF continuam tendo o browser como referência visual.

O denoise OIDN 2.3.3 usa somente irradiância, filtro RTLightmap CPU, sem imagem auxiliar de albedo ou normal. Mantém `irradiance.f32` intacto, verifica seu SHA do bake, guarda `irradiance-denoised.f32` e aplica proteção de bordas por texel ocupado mais próximo. Guard não pode ultrapassar metade do padding efetivo. Codifica RGBM16 em bytes RGBA8 gzip, sem header, sem premultiplicação de alpha, sem mipmaps. A decodificação é `rgb/255 * alpha/255 * 16`, com origem bottom-left.

`manifest.json` só ganha `ready:true` após denoise/encode; inclui SHA de unidade, cena, compact, aprovação e textura decodificada. `bake.json`, `denoise.json` e `audit-transport.json` registram tempos, contagens, cobertura, erros e custos reais. Nenhum relatório de fixture em `qa/fixture` prova o cálculo da cena final.

`auditar_saida.py` verifica os bytes da cena/snapshot, unidade, UV/gzip, aprovação, irradiância bruta e RGBM decodificado. Também valida a autoria GLB: contagem de objetos/triângulos, normais, UV1 nos alvos e extras da unidade. Gera relatórios reproduzíveis `audit-authoring.json` e `audit-runtime-payload.json`; ambos ainda exigem o gate visual do browser.

O runtime deve usar namespace interno próprio, validar os hashes e restaurar albedo original. Mudança de posição/rotação/escala, identidade dos móveis ou interruptores invalida o atlas e ativa iluminação dinâmica. Planta 3D e visita usam a mesma geometria/UV/atlas; o teto muda apenas de visibilidade.

## Primeira execução medida em 08/10/2026 — gate visual retido

- Unidade do construtor: `27faa1c03c4868e86103b5afd82ebcbf4507767ddf31f30b9dae907c7b1a410c`.
- Cena da primeira execução: `bc4ef76bf059ade5764eebebc979a2254f3af64fda852822e24624fd1899ebb0`.
- Compact da primeira execução: `f6687c74bb9f98828aeeb33442b2bf7cb0a2f19433b66eb89a25edf38f4faa2a`.
- Atlas decodificado: `6f9e7f0e4ee99c676519c88adeb6aad7ee96492761bb1873292ad15aa78a95af`.
- 92 objetos, 71.099 triângulos na cena de autoria; 84 alvos e 69.023 triângulos assados. 30 rodatetos, nenhuma sobreposição colinear após união no gerador.
- UV final: 2,80 s, xatlas 3041×3040 normalizado para 2048²; padding efetivo 5,388 px, margin 2 e guard 2 explícito. BoxGeometry com material único usa material zero, como no Three; os grupos padrão 0..5 são ignorados.
- Cycles OPTIX GTX 1650: 485,00 s com 512 amostras. Denoise/encode: 7,69 s. RGBM sem clipping, irradiância máxima filtrada 8,24 dentro de range16.
- Runtime: atlas gzip 3.929.745 bytes, upload GPU 16.777.216 bytes; compact JSON 2.233.764 bytes ou gzip 859.569 bytes. Inputs source de 33,4 MB cada não devem ser embutidos no HTML.
- Autoria: source `.blend` 3.064.617 bytes, source `.glb` 10.385.288 bytes e baked `.blend` 18.555.624 bytes. `audit-authoring.json` conferiu 92 malhas, 71.099 triângulos, normais nas 92 e UV1 nos 84 alvos; `audit-runtime-payload.json` conferiu gzip, hashes, tamanho e valores finitos.

Esses resultados provam a execução e o transporte, mas a aprovação visual foi retida por normais interiores das paredes e coplanares no tapete. `qa/audit-scene-rejected.json` registra 22.612 faces verticais com normal oposta e 18 pares sobrepostos no tapete.

O candidato corrigido `270d61e914f9f3dfdb7a79327b694409b32ccb475c3187c92cf42490e8ae3fb6` passou no preflight: zero normais HM opostas, zero pares coplanares do tapete e zero molduras sobrepostas. Só a normal da malha de paredes/rodapés e a representação do tapete mudaram; o cadastro, as demais posições, os centros dos cômodos e a luz permaneceram iguais. Dois PNGs de ruído do piso frio foram regenerados ao abrir a página e serão congelados no runtime pela nova fonte exata. Renders diagnóstico em `qa/preflight-corrected` levaram 26,82 s (sala) e 11,18 s (topo), OPTIX com 24 amostras. Esses renders não substituem a aprovação do atlas final no viewer.

## Execução corrigida medida em 08/10/2026

- Unidade do construtor: `27faa1c03c4868e86103b5afd82ebcbf4507767ddf31f30b9dae907c7b1a410c`.
- Cena de produção: `270d61e914f9f3dfdb7a79327b694409b32ccb475c3187c92cf42490e8ae3fb6`.
- Compact: `a203719adc18db7c6ff1714907368566ce2d398590b08693716a5a5e41d4a56f`.
- Atlas decodificado: `1f32fd51333c05cc2ca1405ce45ba529ca0e760e007f7a4fd6464c3c3539cbde`.
- Irradiância bruta: `821181c038d1f5b47a9b3cb1011cfb760504a66fcaf0b24073c5b62ca6ee2e33`.
- Aprovação da cena: `1968064c7a427e75837eeab8efd96bb5261bc5d72cda04f9f270adb27c9f7478`.
- 92 objetos, 71.783 triângulos de autoria; 84 alvos e 69.707 triângulos assados. Normais verticais HM opostas: zero; coplanares horizontais sobrepostos do tapete: zero; pares colineares de rodateto: zero.
- UV 2048: 3,43 s, xatlas 3033×3032 normalizado, padding efetivo 5,402 px, margin 2 e guard 2. Compact JSON 2.255.654 bytes/gzip 857.241.
- Cycles 512 OPTIX GTX 1650: 495,64 s (8 min 15,64 s). OIDN/guard/encode: 9,06 s. Sem COLOR e sem albedo auxiliar no OIDN.
- Irradiância filtrada máxima 8,1895, sem clipping em RGBM16. Erro de codificação médio 0,000239987 e máximo 0,0154171. 2.001.410 texels cobertos e 555.125 texels de proteção externa.
- Atlas gzip 4.646.752 bytes; upload GPU 16.777.216 bytes. Uma leitura durante cálculo registrou 2427 MiB/4096 usados na GPU e 98% utilização; inclui os outros programas, não é medição exclusiva de pico.
- Autoria: source `.blend` 3.077.228 bytes, `.glb` 10.400.312 bytes, baked `.blend` 20.526.347 bytes. GLB SHA `7868299d0d41ca5b1f159ab336710169de306ca9ba594722d85bc6f9c33603a8`; auditoria confirmou 92 malhas/normais e 84 UV1.

As provas rejeitadas foram preservadas em `qa/atlas-rejeitado`. `audit-authoring.json` e `audit-runtime-payload.json` da produção corrigida passaram; a aprovação visual do novo atlas depende das capturas finais do browser.
