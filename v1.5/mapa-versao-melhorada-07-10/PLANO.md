# Mapa 3D — plano de implementação da versão melhorada (07/10/2026)

O objetivo é otimizar o mapa de São Carlos como as miniaturas foram otimizadas (`v1.5/miniaturas/versao-melhorada-07-10/`) e trocar todas as casas genéricas por casas **procedurais com regras de arquitetura e engenharia**. A versão nova precisa abrir no navegador do celular.

Decisões do usuário (07/10):
- Sem duplo clique (`file://`): só via servidor.
- As 74 casas Blender saem todas. A biblioteca fica só para comparar, por parâmetro de URL.
- Regras com valores típicos agora. Ficam num arquivo de parâmetros, marcados "a conferir com a lei de São Carlos".
- Entrega única: otimização, dados em blocos e casas procedurais juntos.

Tudo fica nesta pasta (`v1.5/mapa-versao-melhorada-07-10/`). O `v1.5/renderizador-v16-moveis/` **não é editado**, porque 49 testes de equivalência dependem dele. Os detalhes do levantamento, com arquivo:linha, estão no fim.

## 1. Situação de hoje (medida em 07/10, Chromium sem GPU)

| Métrica | Tour, computador | Tour, celular fraco |
|---|---:|---:|
| Bytes para abrir | 9,64 MB (cidade: 15,19 MB) | igual |
| Primeira pintura | 1,2 s | **18 s** (tela branca: o canvas só chega com 95% do HTML) |
| Cidade utilizável | ~7,5 s | ~33 a 80 s |
| Triângulos por quadro | 8,5 M | 8,3 M |
| Chamadas de desenho | 321 a 458 | 255 a 347 |
| CPU com a câmera parada | 4 ms por quadro | **39 ms por quadro** (desenha sem parar) |
| GPU / heap JS | 136 a 222 MiB / 76 a 260 MiB | 118 a 145 MiB |
| Andar 600 m | 348 MB enviados à GPU, p90 de 100 a 140 ms | — |

Gargalos, em ordem de impacto:
1. **Casas Blender sem nível de detalhe nem recorte.** São 62% dos triângulos, e as 7.585 cópias da casa-02 saem todas iguais.
2. **HTML único de 14 MB em base64.** Base64 não recomprime, o canvas chega por último e o navegador desempacota e faz `JSON.parse` de 32 MB.
3. **Montagem no navegador.** O recorte de muros contra ruas e o encaixe no relevo rodam na cidade inteira. Cada quarteirão custa cerca de 22 ms, e os rótulos são refeitos a cada lote.
4. **Quintais refeitos a cada 80 m**, com reenvio completo dos buffers.
5. **Desenho contínuo**, mesmo parado.
6. **Celular mal calibrado.** DPR 1 em tela de DPR 3, raio igual ao do computador e governador parado durante o streaming.
7. **Sombra refeita a cada metro**, mais de 22 programas de shader, tudo em `DoubleSide` e um material por quadra.

## 2. Estrutura da pasta

```
v1.5/mapa-versao-melhorada-07-10/
  fonte/        cópia de renderizador-v16-moveis + módulos novos (casas/, entrega/)
  gerador/      Node: lê city.json, lotes, ruas, muros, relevo → blocos binários + manifesto
  regras/       sao-carlos.json: recuos, ocupação, alturas, telhado, aberturas (marcados "a conferir")
  medicoes/     medir_mapa.mjs (scripts do levantamento), comparação visual, custos
  testes/       npm test próprio (determinismo, regras, formato binário)
  publicado/    saída (fora do git)
  firebase.json próprio (canal de pré-visualização), package.json, .gitignore, LEIA-ME.md
```

Restrições do repositório:
- Não mexer em `VARIANTES`/`V_PADRAO`. Não usar nomes de pasta proibidos (`test_pipeline_paths.py`).
- Não regravar `encaixes-sao-carlos.json`.
- Nenhum arquivo versionado acima de 1 MiB e nenhuma imagem fora das pastas classificadas: saídas grandes vão para o `.gitignore`, com SHA-256 de conferência.
- `imoveis.json` continua fictício.
- Publicar só com autorização, em canal de pré-visualização, com o `firebase.json` da pasta. **Nunca** o da raiz.

## 3. Etapas

### Etapa 1: entrega e boot

**Meta: tela em menos de 2 s no celular fraco.**
- O HTML vira uma casca de cerca de 30 KB: cabeça, CSS, `corpo.html` com o canvas, uma capa e a barra de progresso. Ele carrega primeiro.
- **Código:** esbuild concatena os 72 scripts na ordem de `modules.json` (sem refatorar para ESM), minifica e grava `app/mapa-<hash>.js`. O three r168 vai em `lib/three-r168/` com hash, e o código do interior em pedaço próprio.
- **Dados:** saem da página para `dados/<nome>-<hash>.{json,bin}`. São servidos com Brotli pelo Hosting, com `immutable`, e o HTML com `max-age=0, must-revalidate`. Para não reescrever os módulos, o carregador baixa em paralelo e injeta cada bloco no `<script type="application/json" id="__x">` que o código já lê.
- **Sob demanda:** `__moveis`, `__luzue` e o interior só descem quando o usuário entra no apartamento.
- **Capa:** a cidade renderizada offline na pose inicial (WebP pequeno), mostrada até o primeiro quadro.

### Etapa 2: gerador offline (Node, `gerador/`)

**Tiles:** uma grade de cerca de 400 m, com manifesto `{tile, bytes, caixa, hash}`. Cada tile leva, já pronto:
- ruas, calçadas, chão e vão de rua indexados, com Int16 relativo à origem do tile (precisão de cerca de 6 mm);
- muros **já recortados contra a rua** e o relevo **já aplicado**. O exagero vertical continua como uniforme no shader;
- prédios não residenciais no formato atual, em binário;
- o **plano de cada casa** (etapa 3), de 24 a 32 bytes por casa;
- portões, quintais e árvores plantadas.

**Índice leve da cidade** (algumas centenas de KB), para busca, ficha, clique e minimapa: ids estáveis, caixas e cadastro.

**Precisão:** matemática inteira ou de ponto fixo. Um teste compara o hash da saída entre o Node e o navegador.

### Etapa 3: casas procedurais com regras

**Entrada:** lote (`lotes_saocarlos_completo.geojson`), volumes residenciais do `city.json`, testada (a borda voltada para a rua, de `fa` e da proximidade da fita de rua) e relevo.

**Variação:**
- Semente `hash(cidade, id do lote, versão da regra)`, com splitmix32 e um fluxo por etapa: mudar o telhado não reembaralha recuos e cores.
- Casa, garagem e edícula do mesmo lote compartilham semente, paleta e telha.
- Partidos por bairro: conjunto habitacional repetitivo de 2 águas, sobrados na classe média, geminadas no alinhamento no centro.

**Regras, aplicadas em ordem.** Os números ficam em `regras/sao-carlos.json`, marcados "a conferir".
1. **Lote.**
   - Classe por testada: estreito < 7,5 m, padrão < 11,5 m, largo < 16 m, grande acima disso.
   - Recusa testada < 3,6 m ou fundo < 8 m.
2. **Recuos.**
   - Frontal de 4 m. A garagem coberta leve pode avançar até o alinhamento.
   - Lateral de 1,5 m em face com janela, e 0 em face cega (geminada).
   - Fundo de pelo menos 2 m.
   - Taxa de ocupação de 40 a 60%, com teto, e permeabilidade mínima.
   - Teste contra a rua já no gerador: casa sobre a rua ≤ 0,56%, sem regredir.
3. **Volumetria em malha estrutural.**
   - Vãos de 3 a 4,5 m e corpo de 6 a 9 m.
   - Plantas retangular, em L, em T, com garagem lateral e com edícula (esta só com fundo ≥ 22 m).
   - Piso 0,15 a 0,30 m acima do terreno, pé-direito de 2,6 a 2,8 m e laje de 0,12 m.
   - Respaldo da térrea em 2,9 a 3,2 m e do sobrado em 5,8 a 6,2 m.
   - O pavimento de cima se apoia na malha de baixo, com balanço de no máximo 1,2 m.
   - Em terreno inclinado: embasamento ou arrimo, com o piso na cota da frente.
4. **Telhado: um só por casa.**
   - Altura = inclinação × distância à borda do beiral, o que dá espigão e rincão corretos em L e T.
   - Telha cerâmica com 30 a 35% de inclinação (hoje são 72 a 98%). Beiral de 0,5 a 0,8 m, abaixo do respaldo, com testeira, cumeeira e rufo.
   - Variantes: empena em alvenaria; platibanda com fibrocimento de até 10% escondido e pelo menos 0,2 m acima dele; laje com caimento de 1 a 2%.
   - Caixa d'água de 500 a 1.000 L sob o telhado. Só aparece em casa de laje ou como torre.
5. **Aberturas por face e função.**
   - Frente: porta social alinhada ao portão e janela de sala de 1,5 a 2,0 m.
   - Laterais: só com recuo ≥ 1,5 m (Código Civil, art. 1.301).
   - Fundo: basculantes com peitoril de cerca de 1,5 m.
   - Janela a pelo menos 0,6 m do canto e dentro do vão estrutural, com verga e contraverga. No sobrado, alinhadas na vertical.
6. **Muros e portões.**
   - Frente: mureta com gradil, ou muro com portão de garagem **alinhado à garagem**. Isso substitui o lado sorteado por `crc32`.
   - Laterais e fundo: 2,0 a 2,5 m de altura, cerca de 15 cm de espessura, pilarete a cada 3 m, capa no topo e degraus no declive.
   - Piso de entrada do portão até a porta.
7. **Quintal procedural**, no lugar dos 239 tiles e dos exteriores Blender:
   - grama e piso pela área do lote fora da casa;
   - entrada de carro;
   - piscina por regra (lote grande e fundo livre).

**Níveis de detalhe da casa:**

| Nível | Distância (alto / baixo) | Conteúdo | Triângulos |
|---|---|---|---:|
| LOD0 | < 200 / < 120 m | vãos com profundidade real, beiral com testeira, cumeeira, muro com capa e pilaretes, portões; peças repetidas instanciadas com cor por instância | 600 a 1.500 |
| LOD1 | até 700 / 450 m | volume + telhado correto + beiral; janela no shader, só onde a regra deixa | 40 a 80 |
| LOD2 | além disso | caixa + telhado em cor média, mesclado por tile, feito no gerador | 12 a 24 |

Regras de troca e sombra:
- A troca de nível tem histerese e névoa.
- Só o LOD0 e o LOD1 próximos projetam sombra.
- O LOD0 e o LOD1 são expandidos num **Worker** a partir do plano.

### Etapa 4: renderização no navegador

- **Desenho sob demanda.** Uma marca `precisaDesenhar` liga em câmera, voo, streaming, envio de geometria, animação e interface. **Parado, zero quadros.**
- **Streaming por tile**, com prioridade por distância e frustum, histerese, LRU e teto de memória por perfil. O Worker baixa e abre o tile. O fio principal só cria a `BufferGeometry`, com orçamento de milissegundos e de bytes enviados à GPU por quadro.
- **Recorte por câmera:** esfera por tile, sem a esfera global dos `InstancedMesh`.
- **Rótulos** refeitos só quando chega tile novo.
- **Materiais:** um por camada, compartilhado, com variação por atributo. `DoubleSide` só onde precisa.
- **Perfis alto, médio e baixo.** Cada um define raio, distâncias de LOD, teto de triângulos (celular de 1,0 a 1,5 M, alto de 3 M) e de chamadas (150 / 300), DPR e sombra.
  - DPR do celular entre 1,5 e 2.
  - O governador de resolução (0,6 a 1,0) continua ativo durante o streaming.
  - Perfil gravado para a próxima abertura.
  - Parâmetros `?q=` e `?perf=1`, como nas miniaturas.
- **Sombra em cache.** Só é refeita quando o sol muda, o alvo anda 25 a 50 m ou chega tile novo. A câmera de sombra fica presa à grade de texels.
- **Texturas** em KTX2/Basis (fachada, telha, chão), com o transcodificador local, só onde a memória de GPU compensar.
- **O que precisa continuar funcionando:**
  - os parâmetros `?imovel=&etapa=`;
  - clique → ficha, pela cadeia lote → prédio fixado → `predio_id` → âncora de 120 m;
  - os 5 empreendimentos e a área protegida em volta deles;
  - o carimbo no HUD;
  - `?casas=biblioteca`, para a comparação A/B.

### Etapa 5: medição, QA e publicação

- **Mesmos scripts do levantamento** (`medir_mapa.mjs`, `mede.mjs`, `cpu_quadro.mjs`, `upload.mjs`), nos mesmos perfis e percursos: tour Cedros, centro, girar, e andar 600 m em 40 passos.
- **Metas no celular fraco:**

  | Item | Hoje | Meta |
  |---|---:|---:|
  | Primeira pintura | 18 s | < 2 s |
  | Cidade utilizável | 33 s | < 8 s |
  | Triângulos | 8,3 M | ≤ 1,5 M |
  | CPU parado | 39 ms | 0 |
  | GPU ao andar 600 m | 348 MB | < 30 MB |

- **QA do gerador:**
  - histogramas de inclinação, cumeeira, taxa de ocupação e recuos;
  - **0 janelas a menos de 1,5 m da divisa**;
  - casa sobre a rua ≤ 0,56%;
  - os portões do `PADRAO.md` (muro, lote e árvore sobre a rua).
- **Comparação visual** nas mesmas câmeras, lado a lado.
- **Custos:**
  - servidor para 1.000 acessos por dia, com revisita e "outra página", como no estudo das miniaturas;
  - tempo de geração da cidade.
- **Publicação:** canal de pré-visualização `mapa-v2`, com autorização. Para promover depois, nome `mapa/sao-carlos-exteriores-<sha12>.html` (herda `immutable` sem mexer em `test_hosting_cache.mjs`), ponteiro `index.html` e 302 do `f16b0250b705`.

## 4. Ordem de trabalho sugerida (cada passo medido antes de seguir)

1. Copiar a fonte e montar com o montador novo (Etapa 1). Conferir que a página sai **igual** à atual, com captura lado a lado, e medir.
2. Desenho sob demanda, perfis, sombra em cache e interior sob demanda. Medir.
3. Gerador: regras + planos das casas + QA estatístico, sem navegador ainda. Revisar histogramas e capturas de casas isoladas.
4. Expansão LOD0/1/2 no Worker; trocar biblioteca, quintais e exteriores pelos procedurais. Medir.
5. Tiles binários de rua, chão e muros recortados; streaming por tile; índice leve. Medir.
6. Texturas KTX2 e capa. Relatório (antes/depois, custos) e pré-visualização.

**Estimativa:** é trabalho de vários dias de agente. As etapas 3 e 4 são as maiores, e cada uma deve fechar com medição e captura antes da próxima.

## 5. Riscos

- **Leis urbanísticas.** Plano Diretor (talvez a Lei 18.053/2016) e Código de Obras não foram conferidos. Os parâmetros ficam marcados como composição.
- **Ids estáveis.** Clique, ficha e colisão dependem de ids estáveis entre versões. É preciso um teste de que cada `predio_id` cadastrado continua achando o prédio.
- **Celulares.** iOS: teto de memória por aba. Safari anterior à 16.4: `DecompressionStream` dentro do Worker, com caminho alternativo. O FPS real precisa de aparelho, porque o ambiente de medição não tem GPU.
- **Intermediários fora do git.** O gerador parte só de `v7.city.json`, dos lotes, de muros/portões e do relevo.
- **Testes da raiz.** O clone raso derruba 50 testes `.mjs` antes de qualquer mudança. A referência é o CI, com histórico completo.

## 6. Referências do levantamento

Relatórios completos, com arquivo:linha, gerados em 07/10:
- Renderizador: `R/app.js` (boot e `loadCity` em 1739-1804); `R/urban-models.js:90,146-174` (pools sem LOD e recorte); `R/exterior-details.js:152-229` (quintais refeitos); `R/scene/frame.js:93,109,116` (laço contínuo e sombra); `R/scene/quality.js:22,37` (celular); `R/world/streaming.js:7-40`.
- Entrega: `pipeline/montar.py:79-127`, `pipeline/build/html.py:23-96` (base64), `pipeline/build/blocos.py`.
- Casas hoje: `pipeline/city_final.py:274-516` (partidos, recuos, edícula); `R/world/buildings.js:101-571` (coberturas, inclinação, caixa d'água); `R/materials/facades.js:33-34` (janelas); `pipeline/portoes.py:128-139` (portão por `crc32`).
- Portões de aceite: `PADRAO.md:99-151`; limiares em `padrao/cidades/sao-carlos.json:107-116`; `tests/test_tamanho_versionado.py`, `test_dados_privados.py`, `test_hosting_cache.mjs`, `test_pipeline_paths.py`.

(`R/` = `v1.5/renderizador-v16-moveis/`)
