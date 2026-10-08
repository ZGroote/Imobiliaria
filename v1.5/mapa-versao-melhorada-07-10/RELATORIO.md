# Mapa 3D de São Carlos: relatório da v2 (08/10/2026)

A v2 do mapa troca as 74 casas modeladas no Blender por **64.977 casas procedurais**, uma por lote, decididas por regras de arquitetura e engenharia. Ela também refaz a entrega da página e o desenho. O ponto de partida é a página de hoje (o piloto montado pelo pipeline). As duas foram medidas com o mesmo medidor, na mesma máquina.

## Resumo

Página da cidade inteira ("Ver mapa"), Chromium sem GPU (SwiftShader), 1 rodada por perfil.

| | Computador: hoje | Computador: v2 | Celular fraco: hoje | Celular fraco: v2 |
|---|---:|---:|---:|---:|
| Bytes para abrir | 15,19 MB | **5,80 MB (−62%)** | 15,19 MB | **5,67 MB (−63%)** |
| Requisições | 57 | 24 | 57 | 24 |
| Primeira pintura (FCP) | 2,6 s | **0,8 s** | **47,3 s** (tela branca) | **0,6 s** (capa com a cidade) |
| Primeiro desenho 3D | 6,0 s | 2,7 s | 71,8 s | 37,8 s |
| Cidade carregada | 7,9 s | **3,2 s (−60%)** | 80,6 s | **41,4 s (−49%)** |
| Maior travada (long task) | 2,2 s | 1,4 s | 17,8 s | 8,7 s |
| Soma das travadas | 5,0 s | 3,4 s | 46,2 s | 15,6 s |
| Montagem dos quarteirões: CPU / quadros | 6,6 s / 169 | 5,3 s / 113 | 51,7 s / 608 | 35,4 s / 413 |
| Fatias de montagem acima de 50 ms | 46 | 44 | 135 | 54 |
| Triângulos por quadro | 8,16 M | **1,52 M (−81%)** | 7,75 M | **1,38 M (−82%)** |
| Chamadas de desenho por quadro | 458 | 405 | 347 | **180 (−48%)** |
| Câmera parada | redesenha sem parar (71% de CPU) | **0 quadros** (0,5%) | redesenha sem parar | **0 quadros** |
| Memória de GPU depois de girar | 170 MiB | **91 MiB (−46%)** | 145 MiB | **72 MiB (−51%)** |
| Heap JS | 179 MiB | 130 MiB | 185 MiB | 119 MiB |
| CPU da thread principal até a cidade completa | 14,9 s | 9,2 s | 131 s | 61 s |
| Erros no console | 0 | 0 | 0 | 0 |

No celular, a v2 desenha com **2,25 vezes mais pixels** (DPR 1,5 em vez de 1, porque a imagem de hoje fica borrada) e ainda assim usa metade da memória de GPU.

### Metas do plano no celular fraco

| Item | Hoje | Meta | v2 | |
|---|---:|---:|---:|---|
| Primeira pintura | 47 s (cidade) / 18 s (tour) | < 2 s | 0,6 s | ✅ |
| Triângulos | 7,8 M | ≤ 1,5 M | 1,38 M | ✅ |
| Quadros com a câmera parada | todos | 0 | 0 | ✅ |
| Cidade utilizável | 33 a 80 s | < 8 s | 41 s | ❌ Só a descida de 5,7 MB a 1,6 Mbit/s já leva cerca de 29 s. Para cumprir a meta é preciso carregar por região (ver "O que falta"). |
| GPU ao andar 600 m | 348 MB enviados | < 30 MB | não medido | — |

## Como foi medido

- **Medidor:** `medicoes/medir_mapa.mjs`, o mesmo do levantamento de 07/10, com o mesmo método. A única adição é a conta da fila de nível de detalhe das casas. Resultados em `medicoes/resultados/base-cidade.json` (hoje) e `v2-cidade.json`.
- **Perfis:**
  - computador: 1366×768, rede de 50 Mbit/s;
  - celular fraco: 360×780, DPR 2, CPU 6 vezes mais lenta, 1,6 Mbit/s e 150 ms de latência.
- **Servidor:** comprime como o Hosting (Brotli só para tipos de texto).
- **Sem GPU, o SwiftShader distorce o FPS absoluto.** Por isso a montagem é medida como no levantamento: cada `streamPump()` é a fatia de um quadro, e conta-se quantas fatias são precisas até a fila zerar.
- **Câmera parada:** a v2 foi conferida à parte com `__perf.porque()`. Foram 0 quadros em 40 s depois de a cidade subir. O único quadro que aparece na janela de 5 s do medidor é provocado pelo próprio medidor (`__perf.mede`).

## O que mudou

### Entrega

- **HTML de 46 KB.** Hoje a página é um HTML só, com 14 MB de base64. O HTML da v2 mostra a tela de carga e a **capa** (a cidade na pose de abertura, em WebP de 189 KB no computador e 64 KB no celular em pé) antes de qualquer dado chegar.
- **Dados em arquivos com hash.** Cada bloco de dado vai num arquivo com o hash no nome, guardado pelo navegador por 1 ano. Os blocos descem em paralelo, com progresso real.
- **Interior só para quem entra.** Móveis e luz do apartamento descem só para quem entra no imóvel.
- **Binários comprimidos no gerador.** O Hosting só comprime texto, então as casas desceriam cruas. O `montar.mjs` grava um transporte que o próprio navegador desfaz:
  1. planos de byte dos registros de 40 B (o filtro *shuffle* do Blosc/HDF5);
  2. diferença entre índices vizinhos;
  3. gzip 9, aberto pelo `DecompressionStream` nativo.

  Resultado: `casas.bin` de 2,69 MB para **1,49 MB** e `substituidos.bin` de 342 KB para **4 KB**. O montar confere a ida e a volta byte a byte. Navegador sem `DecompressionStream` (Safari anterior à 16.4) baixa o arquivo cru, que continua publicado.

### Desenho

- **Sob demanda.**
  - Um quadro só é desenhado quando algo visível mudou: a câmera, a luz, uma geometria nova, um objeto que entra, sai ou muda de visibilidade, ou alguma coisa animando.
  - Correção de 08/10: o contador de mudanças era lido antes do render, e o próprio three marca `needsUpdate` no meio dele quando desenha material transparente de dupla face. Cada quadro acabava pedindo o seguinte. Agora ele é lido depois do render.
- **Montagem por orçamento de tempo:**
  - mais folga quando ninguém mexe no mapa;
  - rótulos de rua por quarteirão;
  - sombra refeita a cada 5% da área do mapa de sombra, e não a cada metro.
- **Celular:** DPR até 1,5, com o governador descendo até 0,75 se o quadro pesar.

### Casas por regra (`casas/`, `regras/sao-carlos.json`, `gerador/casas.mjs`)

- **64.977 casas** substituem **85.460 volumes antigos**. Ficam 4.435 volumes não residenciais ou mistos, e os 5 empreendimentos ficam protegidos por um raio de 27 a 69 m.
- **Partidos:** retangular 19.772, sobrado 16.038, caixa de laje na frente 11.525, em L 8.742, garagem lateral 5.977, em T 2.432, geminada no alinhamento 149. São 1.337 edículas e 914 piscinas.
- **Telhados:**
  - 4 águas: 28.293;
  - 2 águas paralelas à rua: 16.451;
  - 2 águas perpendiculares: 5.720;
  - platibanda: 9.401;
  - laje: 5.112.

  A cerâmica fica sempre entre 30% e 35% de inclinação.
- **Frente do lote:**
  - muro alto: 33.252;
  - gradil: 20.173;
  - muro baixo: 11.403;
  - garagem: vaga 36.700, laje 9.385, cobertura leve 9.115.
- **Cores:** paredes, telhas e muros variam por bairro e por casa, seguindo a referência que você mandou (térreas brancas e claras, telha cerâmica, caixa de laje branca na frente, muro branco ou da cor da casa).
- **Três níveis de detalhe, montados no navegador a partir de 40 B por casa:**
  - LOD0, perto: janela com recuo de verdade, beiral com testeira, muro com capa, portões e quintal. São cerca de 1.600 triângulos e 0,9 ms por casa.
  - LOD1, meia distância: volume, telhado correto e beiral, com a janela pintada no shader só onde a regra deixa. Cerca de 150 triângulos.
  - LOD2, longe: caixa e telhado, cerca de 20 triângulos.

  O quarteirão que entra nasce em LOD2 e sobe de nível casa a casa, dentro de 3 a 4 ms por quadro, com histerese na troca.
- **Portões de QA:** todos passam (`derivados/casas/qa.json`).
  - 0 janelas a menos de 1,5 m da divisa;
  - casa sobre a rua em 0,38% da área (o limite é 0,56%);
  - 0 casas fora do próprio lote;
  - 0 sobreposições entre casas, ou entre casa e volume mantido;
  - 0 garagens sem portão;
  - 0 telhados cerâmicos fora de 30% a 35%;
  - determinismo: duas execuções dão o mesmo SHA-256.
- **Geração da cidade inteira:** 22 s, ou 34 s com a conferência de determinismo.
- **Valores das regras:** os que vêm de prática estão marcados `a_conferir` em `regras/sao-carlos.json`, para conferir com o Plano Diretor e o Código de Obras de São Carlos.
- **Testes:** `npm test` passa os 26 testes. Eles cobrem regras, formato, determinismo e geometria (sem NaN, índices válidos, faixa de triângulos por nível, normal coerente com a ordem dos vértices e tempo).
- **Comparação antiga:** `?casas=antigas` volta aos volumes de antes. `node gerador/montar.mjs --sem-casas` monta a v2 com as casas de hoje, e nesse caso a imagem sai **igual pixel a pixel** à página atual (PSNR máximo nas vistas de centro, bairro e rua).

## Custo de servidor (Firebase Hosting)

Premissas iguais às do relatório das miniaturas: 360 MB por dia sem custo e US$ 0,15/GB depois. Cenário: 1.000 primeiros acessos por dia à cidade.

| | MB por acesso | GB/mês | Custo/mês |
|---|---:|---:|---:|
| Hoje | 15,19 | 456 | **US$ 66,70** |
| v2 | 5,80 | 174 | **US$ 24,47** |

Revisita sem publicação nova custa quase nada nas duas. Na v2, porém:
- uma publicação nova só troca os blocos que mudaram (o hash muda por bloco). Hoje, qualquer mudança troca o HTML inteiro de 9,6 MB;
- abrir outro imóvel reaproveita os mesmos arquivos da cidade (`?imovel=`). Hoje cada tour é um HTML próprio de 3,8 MB, mais os quintais.

## O que falta

1. **Carregar por região.** É o que falta para a meta de "cidade utilizável < 8 s" no celular fraco.
   - Hoje a v2 baixa a cidade inteira antes do primeiro desenho 3D (os maiores blocos são `citydata` com 1,8 MB, as casas com 1,5 MB e `streetdata` com 0,9 MB).
   - Por região, o bairro em volta da câmera desce primeiro e o resto vem depois. É a Etapa 2 do PLANO.md. A capa já cobre a espera visualmente.
2. **Fatias de montagem longas no celular.** Ainda há 54 fatias acima de 50 ms (p95 de 0,6 s com CPU 6 vezes mais lenta). Elas vêm principalmente da montagem dos quarteirões herdada do renderizador de hoje (muros, chão e relevo): hoje já eram 135 fatias assim, e o LOD2 das casas novas custa cerca de 1 ms por quarteirão. Os candidatos são dividir o quarteirão em partes e levar a montagem para um Worker.
3. **Aparelho real.** O ambiente de medição não tem GPU: o FPS e o tempo de quadro precisam ser conferidos num celular e num computador de verdade. O link de pré-visualização serve para isso, mas só publico com a sua autorização (veja LEIA-ME.md).
4. **Regras `a_conferir`.** Falta conferir recuos, taxa de ocupação e alturas com a legislação de São Carlos.
5. **Andar 600 m** (memória enviada à GPU durante o passeio): falta medir com `upload.mjs`, como no levantamento.

## Arquivos

| | |
|---|---|
| `medicoes/resultados/` | JSON das medições de hoje e da v2 |
| `derivados/casas/qa.json` | QA das casas: contagens, histogramas e portões |
| `PLANO.md`, `casas/ESPEC.md` | Plano e especificação |
| `LEIA-ME.md` | Comandos, estrutura e como publicar |
