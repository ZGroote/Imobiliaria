# Caminho 1 — qualidade de render na visita interativa (base: Liv Ipanema)

Estado: **plano**, sem código. Data: 14/10/2026.

Objetivo: levar a maquete, a planta 3D e a visita em primeira pessoa ao nível visual de um render de
arquitetura (referência: reel de @montani3d enviado em 14/10), **mantendo a navegação livre e
interativa no navegador**. Não é vídeo, nem imagem gerada por IA: é a mesma cena 3D, com material,
luz, reflexo, ambiente e conteúdo de melhor qualidade.

Base: **Liv Ipanema**, a partir do preview
`imobilaria-deccb-miniaturas--liv-acabamentos-20261013-4qt2093a.web.app/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio`.
O Monte dos Cedros continua sendo o padrão aprovado e **não é tocado** por esta frente.

## Separação

| Regra | Como |
|---|---|
| Código | Somente em `experimentos/caminho1-liv/`. O renderizador `v1.5/renderizador-v16-moveis` só recebe **extensão**, no mesmo molde do piloto de acabamentos de 04/10 (`window.PilotoVisual`), nunca edição do padrão |
| Documentos | Somente em `tasks/caminho1-liv/` |
| Saídas | `publicacao/caminho1-liv/<geração>/`, ignorado pelo Git, como o piloto de 04/10 |
| Publicação | Canal de preview próprio `caminho1-liv-*` no site `imobilaria-deccb-miniaturas`, com expiração. Nunca `live` |
| Versionamento | O arquivo original fica preservado; cada revisão vira um arquivo novo com número seguinte (`plano.md` → `plano-1.md` → `plano-2.md`). Gerações de saída seguem `v0`, `v1`, `v2`… e nunca sobrescrevem a anterior |

## O que já existe e será reaproveitado

| Peça | Onde | Uso no Caminho 1 |
|---|---|---|
| Luz assada de qualidade (xatlas → Cycles DIRECT+INDIRECT → OIDN RTLightmap → RGBM gzip) | `v1.5/miniaturas/padrao-atual/` (`unwrap-v3.py`, `bake-v3.py`, `denoise-v3.py`, `encode_lightmaps.py`, `lightmap-v3.js`) | Generalizar do Cedros para o Liv. É a parte mais cara, e já está provada |
| Acabamentos PBR (Poly Haven CC0, cor/normal/rugosidade, UV em escala física, manifesto com hashes) | branch `experimento/moveis-melhorados`, `experimentos/piloto-qualidade-visual-2026-10-04/` e `relatorios/guia-acabamentos-pbr-2026-10-04.md` | Base da Fase 1. O §10 do guia lista exatamente o que falta para virar padrão |
| Leitura de entrada → maquete LEVE | M1-0 a M1-F, M1.1 (capturador, normalizador, `e2e_leitura.py`) | Fonte da geometria do Liv (`geometria=entrada`) |
| Compressão glTF | `@gltf-transform/core` e `extensions`, `draco3dgltf` (já no `package.json`) | Malhas de móveis e decoração |
| QA em navegador real | Playwright (`qa_*.py`) | Capturas por câmera fixa e medição de quadros |
| Governador de qualidade | `pipeline/testa_governador.py` e renderizador | Base dos níveis por aparelho (Fase 4) |

## Por que hoje parece inferior

Comparando o reel com as capturas de QA do Cedros (`v1.5/miniaturas/padrao-atual/qa/`): a **luz já é
boa**, com sombra suave e rebatimento. O que falta é conteúdo:

| No vídeo | Hoje | Camada que resolve |
|---|---|---|
| Mármore, madeira ripada, pedra, tecido | Cor lisa por superfície | 1. Materiais |
| A luz "pega" a cor do material (madeira aquece o canto) | Bake calculado com albedo neutro | 2. Luz assada com material |
| Reflexo em piso, vidro, água, espelho | Pouco ou nenhum | 3. Reflexos |
| Céu de fim de tarde, vegetação, vista | Fundo escuro | 4. Ambiente |
| Tratamento de cor, contraste, brilho de luminárias | Saída crua | 5. Pós-processamento |
| Móveis detalhados, decoração, plantas, cortinas | Móveis paramétricos simples | 6. Conteúdo |

## Meta mensurável

"Nível do vídeo" precisa virar número, senão o aceite vira opinião.

1. **Quadro de referência**: 6 câmeras fixas do Liv (sala, cozinha, suíte, banho, varanda e fachada
   ou áreas comuns), definidas na Fase 0 e usadas em todas as fases.
2. **Teto**: para cada câmera, um render **Cycles path-traced** da mesma cena, com os mesmos
   materiais. É o melhor resultado possível daquela geometria.
3. **Piso**: a captura do preview `liv-acabamentos-20261013` na mesma câmera.
4. **Métrica**: NVIDIA FLIP (diferença perceptual, licença BSD-3) entre a visita interativa e o teto.
   Cada fase precisa **reduzir** o FLIP médio sem piorar o desempenho além do orçamento.
5. **Aceite humano**: página lado a lado (piso | interativo | teto | quadro do reel) para a
   aprovação visual.

### Orçamento de desempenho

| Medida | Celular (nível Médio) | Desktop (nível Alto) |
|---|---|---|
| Quadro p95 | ≤ 33 ms (30 fps) | ≤ 16,7 ms (60 fps) |
| Draw calls na visita | ≤ 120 | ≤ 250 |
| Triângulos visíveis | ≤ 300 mil | ≤ 1,5 milhão |
| Memória de textura na GPU | ≤ 128 MB | ≤ 384 MB |
| Download até a primeira imagem | ≤ 6 MB | ≤ 6 MB |
| Download total da unidade | ≤ 25 MB, progressivo | ≤ 40 MB, progressivo |

Os valores são o ponto de partida. A Fase 0 mede o Liv atual e ajusta a tabela com dados reais.

---

## Fases

Cada fase é um PR pequeno, com gate próprio, nova geração versionada e evidências na mesma câmera.

### Fase 0 — Trazer o Liv e congelar o ponto de partida

**Bloqueio atual:** o código e a fonte do Liv **não estão em nenhuma branch** do repositório, e o
preview não é acessível do ambiente de nuvem. Antes de qualquer outra fase, é preciso:

1. Versionar no repositório (ou no manifesto de artefatos privados, `tools/artefatos-privados.json`)
   a leitura do Liv, o gerador e a extensão de acabamentos usados no preview de 13/10.
2. Reproduzir localmente o preview `liv-acabamentos-20261013` byte a byte. Esta é a **geração v0**,
   o original preservado.
3. Definir as 6 câmeras de referência (`cameras.json`: posição, alvo, FOV e modo).
4. Gerar as capturas do piso (v0) e os renders do teto (Cycles).
5. Medir o orçamento real do v0 (quadros, draw calls, memória e bytes), em desktop e em celular físico.

Gate: reprodução idêntica do v0, `cameras.json` versionado, quadro de referência completo.

### Fase 1 — Contrato de papéis e catálogo de acabamentos

Resolve a tabela do §10 do guia de 04/10, que é o que impede o piloto de virar padrão:

1. **Papéis explícitos nas malhas**: parede, piso por ambiente (seco/molhado), forro, rodapé,
   esquadria, bancada, revestimento de área molhada, fachada e guarda-corpo. Hoje o piloto acha a
   parede por `house.children[0]`. Passa a ser `userData.papel`, gravado pelo gerador.
2. **Slots de material nas peças de móveis**: corpo, estofado, tampo, ferragem e pé, expostos pela
   fábrica (`MOVEIS[type].param`), em vez da máscara reconstruída por ordem de vértices.
3. **Catálogo `acabamentos.json`** com perfis (por exemplo, "Liv — memorial descritivo"): papel →
   material, escala física, rugosidade e normalScale. A calibração sai do código.
4. **Mapas em KTX2** (Basis: UASTC para normal, ETC1S para cor e rugosidade) via `gltf-transform` +
   KTX-Software, com fallback WebP. Reduz a memória de GPU de 4 a 8 vezes, o que é decisivo no celular.
5. Adicionar mapa de AO de material onde o asset tiver.

Gate: com o perfil "Base", a imagem é idêntica ao v0 (prova de que o contrato não mudou nada). Com
o perfil do Liv, FLIP menor que o v0. Testes de contrato para papéis e slots.

### Fase 2 — Luz assada com material, no Blender

Generaliza o pipeline PREMIUM do Cedros para a geometria do Liv:

1. Exportar a cena montada (geometria + papéis + slots + materiais da Fase 1) para Blender 5.2.2.
2. Gerar UV de luz com xatlas (`uv1`, sem sobreposição), como em `unwrap-v3.py`.
3. Assar no Cycles DIRECT + INDIRECT **com o albedo real dos materiais nos rebatimentos**. A cor
   continua aplicada no navegador uma só vez (regra 6 do `PADRAO-ATUAL.md`), mas a luz indireta passa
   a carregar a cor do mármore e da madeira.
4. **Sol físico do Liv**: latitude e longitude de Ipanema, orientação real da torre e hora escolhida
   (por exemplo, 16h30 para luz de fim de tarde). O mesmo sol vai para o HDRI da Fase 3, para que céu
   e sombra concordem.
5. Luminárias com emissão física (spots de forro, pendentes, fitas de LED), assadas.
6. OIDN `RTLightmap` → RGBM gzip, mesmo formato e loader do Cedros.
7. QA automático de artefatos: vazamento de luz em quinas, emendas de atlas e texel insuficiente
   (densidade mínima por papel).

Gate: FLIP contra o teto melhor que o da Fase 1. Zero vazamento detectado. Tempo de bake registrado.
A GTX 1650 roda Cycles com CUDA. Se o tempo passar de cerca de 2 h por unidade, avaliar uma GPU de
nuvem só para o bake.

### Fase 3 — Reflexos e ambiente

1. **HDRI** de céu (Poly Haven, CC0) casado com o sol da Fase 2, como fundo e como luz especular.
2. **Cubemaps assados por cômodo com projeção em caixa** (box-projected), gerados no Blender ou uma
   vez no navegador com `CubeCamera`. Dão reflexo correto em piso polido, porcelanato e metais, sem
   custo por quadro.
3. **Reflexo planar** só onde importa (espelho de banho, piscina ou água), com o `Reflector` do Three.js.
4. **Vidro** com transmissão física (`MeshPhysicalMaterial`) nas esquadrias e nos boxes.
5. **Vista da janela**: no Liv (Ipanema), a vista vende. Usar um backplate esférico de baixa
   resolução com o entorno e a praia, sem simular a cidade inteira.

Gate: FLIP; orçamento de quadro mantido no celular.

### Fase 4 — Pós-processamento e níveis por aparelho

1. Pipeline de pós-processamento com a biblioteca `postprocessing` (pmndrs), que funde os efeitos em
   menos passes que o `EffectComposer` padrão.
2. Tone mapping **AgX** (já disponível no Three.js r168) e LUT de correção de cor por perfil.
3. **Bloom** suave só em emissivos (luminárias e reflexo do sol).
4. **SMAA** no celular, MSAA ou TAA no desktop.
5. **Níveis Baixo / Médio / Alto** definidos pela GPU (biblioteca `detect-gpu`) e corrigidos em tempo
   real pelo governador de quadro existente. O nível Baixo é o v0 com materiais; o nível Alto liga
   SSR e oclusão de contato (N8AO).

Gate: o orçamento de cada nível é cumprido em aparelhos físicos (no mínimo 1 Android intermediário,
1 iPhone e 1 desktop).

### Fase 5 — Conteúdo: móveis, decoração e vegetação

É a camada que mais aproxima do reel e a mais trabalhosa:

1. **Biblioteca de móveis GLB** de qualidade, com licença verificada (Poly Haven Models CC0 primeiro;
   outras fontes só com a licença conferida, como no §2 do guia de 04/10), em LOD0/LOD1, com
   Draco/meshopt e KTX2.
2. **Decoração por ambiente**: almofadas, livros, vasos, quadros, utensílios e toalhas, posicionados
   por regras do cômodo (sofá → almofadas; bancada → utensílios). Instanciados.
3. **Vegetação**: plantas de interior, jardineiras e paisagismo de áreas comuns, em cards de alta
   qualidade ou malha leve.
4. **Cortinas e persianas** que suavizam a luz da janela (entram no bake da Fase 2).
5. Sofá e cama com volumes arredondados, generalizando o que o piloto fez só no primeiro sofá.

Gate: FLIP; orçamento; aceite visual na página lado a lado.

### Fase 6 — Aceite e decisão de promoção

1. Página comparativa publicada no canal `caminho1-liv-*`: v0 | final | teto | quadro do reel.
2. Relatório de aceite no formato do §11 do guia de 04/10 (commit, geração, hashes, aparelhos,
   medições, pendências, responsável e data).
3. Decisão: promover para a fábrica como PREMIUM genérico (sequência M3 em
   `tasks/miniaturas/fabrica.md`) ou iterar.

---

## Ferramentas

Não é preciso SketchUp, Enscape, D5 nem Twinmotion. Tudo é automatizável pelo pipeline atual:

| Ferramenta | Situação |
|---|---|
| Blender 5.2.2, Cycles, xatlas, OIDN | Já em uso |
| Three.js r168, Playwright, `gltf-transform`, Draco | Já em uso |
| Poly Haven (texturas, HDRI e modelos CC0) | Já em uso no piloto |
| KTX-Software (`toktx`) / Basis Universal | Novo; CLI livre (Apache-2.0) |
| `postprocessing` (pmndrs), N8AO, `detect-gpu` | Novos; bibliotecas JS (MIT) |
| NVIDIA FLIP | Novo; métrica de imagem (BSD-3) |

A atualização do Three.js além do r168 e a troca para WebGPU **ficam fora**: não são necessárias
para nenhuma fase e trariam risco de regressão no padrão aprovado.

## Riscos

| Risco | Mitigação |
|---|---|
| Fonte do Liv fora do repositório | Fase 0 bloqueia tudo até a reprodução do v0 |
| Memória de GPU no celular | KTX2 (Fase 1), níveis (Fase 4), orçamento medido em aparelho físico |
| Bake lento na GTX 1650 | Medir na Fase 2; GPU de nuvem só para o bake, se necessário |
| Mover móvel invalida a luz assada | Regra atual mantida: aviso e queda para luz dinâmica (`PADRAO-ATUAL.md`, item 7) |
| Licença de modelos 3D | Somente CC0, ou licença conferida e registrada no inventário com hashes |
| Melhorar uma câmera e piorar outra | As 6 câmeras fixas e o FLIP em todas, a cada fase |

## Decisões pendentes do responsável

1. **Como trazer o Liv para o repositório** (Fase 0): branch, artefato privado ou acesso ao preview.
2. **Perfil de acabamentos do Liv**: seguir o memorial descritivo do empreendimento ou um estilo
   decorado livre (como no reel).
3. **Hora do sol** para a luz assada (sugestão: 16h30).
4. Se **GPU de nuvem** é aceitável para o bake, caso a local fique lenta.
