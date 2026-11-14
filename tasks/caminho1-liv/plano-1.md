# Caminho 1 — qualidade de render na visita interativa (base: Liv real) — revisão 1

Estado: **plano**, sem código. Data: 14/10/2026.

Revisa `plano.md` (original preservado no branch `ccr-2eee02b3-juf0te`, commit `c3a7150`). O original
foi escrito na nuvem **sem acesso ao Liv**: partia do Cedros (Three.js r168, WebGL) e de um preview
publicado. Esta revisão parte do código do Liv que existe na máquina local, em
`experimentos/liv-ipanema-webgpu-2026-10-09/` (branch `codex/liv-ipanema-webgpu`).

Objetivo (inalterado): levar a Planta 3D, o Tour e a maquete ao nível visual de um render de
arquitetura (referência: reel de @montani3d, 14/10), **mantendo a navegação livre no navegador**.

## O que mudou em relação ao `plano.md`

| Ponto | `plano.md` | Liv real | Consequência |
|---|---|---|---|
| Motor | Three.js r168, WebGL; WebGPU "fora" | Three.js **0.186.1**, `WebGPURenderer` com fallback WebGL2, materiais em TSL | O Caminho 1 é feito **em cima do WebGPU**. Voltar ao r168 seria regressão |
| Pós-processamento | `postprocessing` (pmndrs) e N8AO | Essas bibliotecas são só WebGL e não rodam no `WebGPURenderer` | Trocar pelos nós TSL do próprio r186: `BloomNode`, `GTAONode`, `SSRNode`, `SMAANode`, `TRAANode`, `Lut3DNode`. AgX vem do renderer. Nenhuma dependência nova |
| Reflexo planar | `Reflector` | Idem: classe WebGL | `reflector()` do TSL |
| Localização | "Ipanema" (praia, Rio) | O Liv Ipanema fica em **São Carlos** (terreno da Miguel Petroni / João de Guzzi) | Sol pela latitude/longitude de São Carlos. A vista da janela sai do **mapa regional de 5 km que já existe**, não de uma praia |
| Fase 0 | "O Liv não está em nenhuma branch" | O código, a reprodução T01 (`site-baseline/`, 125 arquivos byte a byte) e os QAs existem localmente | A Fase 0 encolhe: falta versionar, fixar câmeras e medir o teto |
| Luz assada | Generalizar o pipeline do Cedros | Canto e Meio **já têm bake próprio** no Cycles (Meio: 2048², 512 amostras, DIRECT+INDIRECT, 35 objetos) | Não é generalizar o Cedros. É **reassar o Liv com material e sol físico** |
| Reflexo do ambiente | Fase 3 inteira | O PMREM pré-calculado já existe (`ambiente.js`, 38 KB gzip) | A Fase 3 troca o gradiente pelo HDRI e acrescenta sonda por cômodo |
| Entardecer | — | `ambiencia.js` tem um entardecer **ilustrativo**: reaproveita o bake diurno, sem sol físico | O sol de 16h30 da Fase 2 substitui esse estudo nos interiores. O exterior continua com o seletor dia/entardecer |
| Aparelho físico | Android intermediário + iPhone + desktop | Alvo registrado: **Poco X6 5G** (qualificação física ainda pendente) e GTX 1650 no desktop | O Poco X6 é o aparelho do gate do celular |

## Decisões tomadas

| Decisão | Valor |
|---|---|
| Hora do sol | **16h30** |
| GPU de nuvem para o bake | **Permitida**, se a GTX 1650 ficar lenta |

## Separação

| Regra | Como |
|---|---|
| Código | `experimentos/caminho1-liv/`. Importa os módulos do Liv por caminho relativo e **não edita** os arquivos do Liv. Se faltar um ponto de extensão no Liv (por exemplo, um gancho para trocar o material de um papel), ele entra num commit separado e pequeno, com prova de imagem idêntica antes/depois |
| Documentos | `tasks/caminho1-liv/` |
| Saídas | `experimentos/caminho1-liv/geracoes/<vN>/`, ignorado pelo Git. Nunca sobrescreve uma geração anterior |
| Publicação | Canal de preview próprio `caminho1-liv-*` no site `imobilaria-deccb-miniaturas`, com expiração. Nunca `live` |
| Branch | `caminho1-liv`, criado a partir de `codex/liv-ipanema-webgpu` **depois** que as alterações em aberto do Liv forem commitadas |
| Versionamento | `plano.md` → `plano-1.md` → `plano-2.md`. Gerações `v0`, `v1`, `v2`… |

## Unidade piloto: Meio primeiro, depois Canto

O reel é de interior, então o piloto é interior. Começa pelo **Meio** porque ele já tem uma cena
**reconstruível**: `construir-meio.ts` → `exportar-meio.py` → `exportar_bake_meio.py --validar`
reproduz a cena e a luz byte a byte, e os 29 móveis têm identidade explícita. O Canto usa um
transporte RGBM legado, e trocar o bake dele exige primeiro reconstruir a fonte. Ele entra depois,
reaproveitando o que o Meio provar.

## Meta mensurável

1. **Câmeras fixas** (`cameras.json`): no Meio, sala, cozinha, suíte, banho e varanda. No exterior,
   a fachada de acesso (o enquadramento **Acesso de perto** que já existe). Cada câmera registra
   posição, alvo, FOV, modo (Planta 3D ou Tour) e backend.
2. **Teto**: render Cycles path-traced da mesma cena e câmera, com os mesmos materiais. A cena do
   Meio já é exportada para o Blender pelo pipeline do bake.
3. **Piso (v0)**: captura do Liv atual na mesma câmera, em WebGPU e WebGL2.
4. **Métrica**: NVIDIA FLIP entre interativo e teto. Cada fase precisa **reduzir** o FLIP médio sem
   estourar o orçamento.
5. **Aceite humano**: página lado a lado (v0 | interativo | teto | quadro do reel).

### Orçamento de desempenho

O `plano.md` propôs ≤ 6 MB até a primeira imagem. O Liv hoje abre com cerca de **20 MB** de conteúdo
inicial no exterior (medido em `AMBIENTE.md`). Por isso, a tabela abaixo vale para o **interior** e
será recalibrada com os números do v0 na Fase 0. Nenhuma fase pode piorar o v0 além dela.

| Medida | Celular (Poco X6 5G, nível Médio) | Desktop (GTX 1650, nível Alto) |
|---|---|---|
| Quadro p95 no Tour | ≤ 33 ms | ≤ 16,7 ms |
| Draw calls no interior | ≤ 120 | ≤ 250 |
| Memória de textura na GPU | ≤ 128 MB | ≤ 384 MB |
| Download adicional do interior | ≤ 25 MB, progressivo | ≤ 40 MB, progressivo |

---

## Fases

Cada fase é um PR pequeno, com gate próprio, uma geração nova e evidências nas mesmas câmeras. Os QAs
seguem o padrão do Liv: Playwright + Chrome, três perfis (WebGPU desktop, WebGL2 desktop, toque
emulado 390 px) e `runtime.json` em `evidencias/`.

### Fase 0 — Versionar e congelar o ponto de partida

1. Commitar as alterações em aberto do Liv em `codex/liv-ipanema-webgpu` e enviar ao GitHub (com
   autorização). Criar o branch `caminho1-liv` a partir dele.
2. **v0** = aquele commit. Registrar o hash em `tasks/caminho1-liv/v0.md`.
3. Escrever `cameras.json` e um capturador que reaproveita os helpers dos QAs do Liv.
4. Gerar as capturas v0 e os renders de teto no Cycles.
5. Instalar o NVIDIA FLIP e gravar o FLIP do v0 por câmera.
6. Medir o v0 (quadro, draw calls, memória, bytes) no desktop e no Poco X6.

Gate: `cameras.json` versionado, quadro de referência completo, FLIP e orçamento do v0 registrados.

### Fase 1 — Papéis e catálogo de acabamentos

1. **Papel por malha** (`userData.papel`): parede, piso seco, piso molhado, forro, rodapé, esquadria,
   bancada, revestimento, guarda-corpo. Gravado pelo construtor do Meio, que já conhece cada
   superfície (são as 34 superfícies alvo do bake).
2. **Slots nos móveis**: corpo, estofado, tampo, ferragem e pé, expostos pelo `FurnitureCatalog`.
3. **`acabamentos.json`**: perfis papel → material (mapas, escala física em metros, rugosidade,
   `normalScale`). Primeiro perfil: "Liv — memorial descritivo" ou "decorado livre", conforme a
   decisão pendente 1.
4. Texturas CC0 do Poly Haven / ambientCG, com manifesto de hashes e licença (formato do
   `assets-materiais/manifest.json`).
5. **KTX2** (UASTC para normal, ETC1S para cor e rugosidade) via KTX-Software, carregadas pelo
   `KTX2Loader` com `detectSupport(renderer)`, que funciona no `WebGPURenderer`. Fallback WebP.
6. Os materiais continuam `MeshStandardMaterial`/`MeshPhysicalMaterial`. A `StandardNodeLibrary`
   do r186 já os converte para nós, então nenhum shader é escrito por acabamento.

Gate: com o perfil "Base", imagem idêntica ao v0, provando que o contrato não mexeu em nada. Com o
perfil do Liv, FLIP menor que o v0. Testes Node de papéis e slots, como os `test_*.mjs` do Liv.

### Fase 2 — Reassar com material e sol físico

1. Exportar a cena do Meio com papéis, slots e materiais da Fase 1 para o Blender, pelo
   `exportar-meio.py` existente.
2. **Sol físico**: latitude e longitude de São Carlos, **16h30** e a data da decisão pendente 2. O
   pré-requisito é o **norte da implantação validado** (pendência T16 em `AMBIENCIA.md`). Sem norte
   conferido, a sombra cai na parede errada.
3. Cycles DIRECT + INDIRECT **com o albedo real nos rebatimentos**. O atlas continua sendo só
   irradiância (`colorPass: false` em `light.json`) e a cor é aplicada uma vez no navegador. A
   diferença é que o rebatimento passa a carregar a cor do material.
4. Luminárias com emissão física (spots, pendentes, fita de LED), no lugar dos plafons ilustrativos.
5. Mesmo formato de saída de hoje (RGBM u8, faixa 16, gzip), para o renderer não mudar.
6. Medir o tempo de bake na GTX 1650. Acima de cerca de 2 h por unidade, usar GPU de nuvem só nesta
   etapa.
7. QA de artefatos: vazamento em quinas (a união dos topos de parede já resolveu parte), emendas de
   atlas e texel mínimo por papel.

Gate: FLIP menor que o da Fase 1, zero vazamento, `exportar_bake_meio.py --validar` aprovando a nova
geração e tempo de bake registrado.

### Fase 3 — Céu, reflexos e vista

1. **HDRI CC0** casado com o sol da Fase 2. Entra no lugar do gradiente, pelo mesmo caminho
   pré-calculado de `ambiente.js` (PMREM preparado offline, validado por hash).
2. **Sonda de reflexo por cômodo** com projeção em caixa, assada uma vez. O
   projeto já mostrou ("a sonda é de um cômodo só") que uma sonda global acende parede pelo rumo da
   janela de outro cômodo.
3. `reflector()` do TSL só no espelho do banho.
4. Vidro físico (`MeshPhysicalMaterial` com transmissão) em esquadrias e box.
5. **Vista da janela**: backplate esférico gerado a partir do **mapa regional de 5 km** do Liv, na
   altura do pavimento escolhido. É o entorno real de São Carlos.

Gate: FLIP e orçamento mantidos no Poco X6.

### Fase 4 — Pós-processamento e níveis

1. Cadeia em `PostProcessing` do TSL: `GTAONode` (oclusão), `BloomNode` só em emissivos,
   `Lut3DNode` por perfil, AgX no renderer.
2. Suavização: `SMAANode` no celular, `TRAANode` no desktop.
3. `SSRNode` só no nível Alto.
4. **Níveis Baixo / Médio / Alto** pelo `frame-scheduler.js` e pelo diagnóstico que o Liv já tem
   (`diagnostico.html`). O nível Baixo é o v0 com os materiais novos.
5. No fallback WebGL2, a mesma cadeia TSL roda pelo backend WebGL, mas o custo é medido separado.

Gate: orçamento de cada nível no Poco X6 e na GTX 1650, nos dois backends.

### Fase 5 — Conteúdo: móveis, decoração e vegetação

1. Móveis GLB de qualidade, só CC0 ou com licença conferida e registrada, em LOD0/LOD1, meshopt e
   KTX2. A receita de estofado e o bake por peça do projeto entram aqui.
2. Decoração por regra do cômodo (sofá → almofadas, bancada → utensílios), instanciada.
3. Plantas de interior e jardineira da varanda.
4. Cortinas, que entram no bake da Fase 2.

Gate: FLIP, orçamento e aceite visual na página lado a lado.

### Fase 6 — Canto, aceite e promoção

1. Repetir as Fases 1 a 5 no Canto, com reconstrução da fonte dele.
2. Página comparativa no canal `caminho1-liv-*`.
3. Relatório de aceite (commit, geração, hashes, aparelhos, medições, pendências, data).
4. Decisão: promover como PREMIUM na fábrica ou iterar.

---

## Ferramentas

| Ferramenta | Situação |
|---|---|
| Three.js 0.186.1, `WebGPURenderer`, nós TSL de pós-processamento | Já instalado (`node_modules` do Liv) |
| Blender, Cycles, OIDN, Playwright, Chrome | Já em uso no Liv |
| Poly Haven / ambientCG (texturas, HDRI, modelos CC0) | Já em uso no piloto de 04/10 |
| KTX-Software (`toktx`) | Novo, CLI livre (Apache-2.0) |
| NVIDIA FLIP | Novo, métrica (BSD-3) |

Saem do `plano.md`: `postprocessing` (pmndrs), N8AO e `Reflector`, que não funcionam no
`WebGPURenderer`. `detect-gpu` fica dispensável enquanto o governador de quadro do Liv der conta.

## Riscos

| Risco | Mitigação |
|---|---|
| 301 alterações do Liv sem commit | Fase 0, passo 1, antes de qualquer código |
| Norte da implantação não validado | Bloqueia o sol físico da Fase 2. Validar antes de assar |
| Custo do pós-processamento TSL no Poco X6 | Níveis da Fase 4 e medição no aparelho |
| Fallback WebGL2 mais lento com a cadeia TSL | Medido separado. No pior caso, o nível Baixo desliga o pós |
| Memória de GPU no celular | KTX2 na Fase 1 |
| Mover móvel invalida a luz assada | Regra atual do Liv mantida: luz dinâmica até restaurar o layout |
| Licença de modelos 3D | Só CC0 ou licença conferida e registrada com hash |
| Melhorar uma câmera e piorar outra | FLIP em todas as câmeras, a cada fase |

## Decisões pendentes do responsável

1. **Perfil de acabamentos**: memorial descritivo do Liv ou decorado livre, como no reel.
2. **Data do sol** para as 16h30 (sugestão: um dia de inverno, com sol mais baixo e luz mais longa
   dentro do apartamento, ou o equinócio, que é neutro).
3. **Autorização para a Fase 0, passo 1**: commitar e enviar `codex/liv-ipanema-webgpu` ao GitHub.
