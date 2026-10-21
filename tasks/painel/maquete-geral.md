# A maquete geral: a estrutura do LIV para todo imóvel (especificação)

**Decisão do usuário, 21/10/2026:** "a estrutura do LIV vira a maquete geral da imobiliária."

Este documento diz como o build de um imóvel passa a usar essa estrutura. **Ainda não muda
código.** Relaciona-se com:

- [m2-worker.md](m2-worker.md): o robô, que monta e publica o que o build produz;
- [materiais-da-solicitacao.md](materiais-da-solicitacao.md): de onde vêm os dados do imóvel;
- [ia-da-criacao.md](ia-da-criacao.md): a IA que avalia a prévia.

O LIV está em `experimentos/liv-experimental-2026-10-14/`, no galho `liv-melhorado`, e o build
de hoje está em `pipeline/build_imovel.py`.

---

## 0. Resumo

- **Hoje são duas maquetes diferentes:**
  - a do **LIV**: um visualizador novo (WebGPU), com seleção de unidades, vitrine, planta, Tour
    e carregamento otimizado;
  - a da **imobiliária**: uma página só, mais antiga (`pagina_maquete.py`), que o robô monta e
    publica.
- **Com a decisão, o LIV vira o molde.** Ele é separado em duas partes:
  - **o motor**, o código que mostra qualquer imóvel;
  - **os dados de um imóvel**: a cena, a luz, as unidades, as plantas e os interiores.
- **O build da imobiliária passa a gerar só os dados** e junta o motor a eles.
- **O caminho mais curto já existe:**
  - a página da maquete de hoje e a do Cedros expõem a cena do mesmo jeito que a base do LIV
    expunha;
  - o LIV foi montado lendo a cena por esse caminho (`exportar_cena.py`);
  - a luz do Cedros já usa a mesma codificação da luz do LIV (RGBM, faixa 16).
- **Três mudanças grandes:**
  1. tirar do código do LIV os dados do prédio que estão escritos nele (~200 pontos);
  2. o motor aceitar imóvel **sem luz pré-calculada** (a casa LEVE não tem);
  3. o build passar de **2 arquivos** para **uma pasta com vários**. Isso mexe no site de imóveis,
     no painel e no robô do M2.
- **O que não muda:**
  - o mapa da cidade (`tour.html`);
  - os portões do build;
  - a aprovação do gerente;
  - a publicação à mão do LIV clássico e do novo.

---

## 1. Hoje: como o build monta a maquete da imobiliária

`pipeline/build_imovel.py <imóvel> --modo leve|premium` gera dois arquivos e o `manifest.json`:

| Arquivo | De onde vem | O que é |
|---|---|---|
| `tour.html` | `pipeline/imovel.py` (o montador do mapa v16) | o mapa da cidade, recortado em volta do lote, com o imóvel dentro |
| `maquete.html` | `v1.5/miniaturas/pagina_maquete.py` | **LEVE:** o prédio montado no navegador a partir do cadastro (laje, parede e esquadria por pavimento), sem luz pré-calculada. **PREMIUM** (só o Cedros): o padrão de `padrao_atual.py`, com a geometria e a luz calculada (`geometry-compact.json` + `lightmap.rgbm.gz`, que estão no git) |
| `manifest.json` | o próprio build | quais fontes entraram, o hash de cada arquivo, os tiles e o `build` |

Regras que valem hoje e continuam valendo:

- **O build é o conteúdo:** `build = sha256(tour.html + maquete.html)` (12 primeiros dígitos).
  A pasta nunca é sobrescrita.
- **Fonte estável:** se uma fonte muda durante a montagem, o build recusa.
- **Sem rebaixar** PREMIUM para LEVE em silêncio.
- **`mirra-114` não se publica.**
- **A vitrine ao vivo** (`vitrine_ao_vivo.js`: liga e desliga do ar, preço e situação) entra nas
  duas páginas.
- **O robô monta duas vezes** e exige o mesmo build (M2-3).

O caminho pela planta fixada (`pipeline/e2e_leitura.py`, do M1-F) também termina no
`pagina_maquete.py`, com a sonda que confere a maquete contra a planta.

---

## 2. O que é a "estrutura do LIV"

### 2.1 O que ela tem

- **Exterior:**
  - three.js 0.186.1, com WebGPU e reserva automática em WebGL2;
  - a cena (`scene.json.gz`) e a luz pré-calculada do prédio (`irradiance.rgbm.gz`, 4096², com
    uma prévia de 1024² que acende antes);
  - acabamentos PBR padrão, sombra do sol reaproveitada, dia e entardecer.
- **Unidades:**
  - clique direto no apartamento da fachada, com realce e ficha;
  - lista de disponíveis, cartão com preço e preço por m²;
  - estoque ao vivo (`salesInventory`, só para o prédio do LIV hoje).
- **Planta 2D, Planta 3D ("Paredes baixas") e Tour:**
  - interior por tipologia (Canto, Meio), com luz própria;
  - Tour em malha ou em splat.
- **Mapa:** "O que tem por perto?", com volta para a maquete, guardando a seleção e a câmera.
- **Carregamento otimizado** (PageSpeed, 21/10):
  - um ajudante em paralelo (`decodificar-worker.js`) baixa, confere e descomprime a cena e a
    luz;
  - o 3D só nasce depois da primeira pintura da página;
  - os shaders são montados um por vez;
  - um otimizador da cópia publicada (`otimizar_publicacao.mjs`) junta, minifica e corta o
    three.
  - Notas no ar, no liv-clássico: computador 100/100/100/100; celular 90–91/100/100/100.
- **Fila de preparação** (Tour, mapa, Planta 2D) num service worker restrito à própria pasta.
- **Conferência de identidade:** cada recurso tem tamanho e sha256 num manifesto. A cena e a luz
  têm de ser da mesma edição.

### 2.2 Motor e dados estão misturados

O código do LIV tem o prédio escrito dentro dele. Contei ~200 menções a LIV, Canto, Meio,
Ipanema, edifício, varanda e portaria. Os principais pontos:

| Onde | O que é do LIV | Para onde vai |
|---|---|---|
| `edicoes.js` | as três edições do exterior (base, contorno, entrada) e as pastas delas | os dados do imóvel |
| `tipologias.js` | as medidas de cada cômodo do Canto e do Meio | os dados de cada tipologia |
| `vinculos.js` | os hashes das plantas do Canto e do Meio | os dados de cada tipologia |
| `catalogo-unidades.js`, `unidades.json` | as 170 posições, por pavimento e final | os dados das unidades |
| `renderer.js` | as vistas próprias (Varandas, Acesso) e os acabamentos da torre | os dados (vistas) e os acabamentos |
| `viewer.js` | o link do mapa de 5 km, a configuração do estoque e os textos do prédio | os dados do imóvel |
| `interior-renderer.js`, `interiores/catalogo.json` | o Canto e o Meio congelados | os dados de cada tipologia |
| `estoque-config.json` | `salesInventory/liv-sales-v1` | os dados (fonte comercial) |

**A regra:** o motor não pode ter nome, medida, caminho nem número de nenhum imóvel. É a mesma
lição do mapa v16: as 59 âncoras e as constantes de São Carlos dentro do JS tiveram de sair.

### 2.3 O tamanho do LIV publicado, para referência

- **O pacote do liv-clássico:** 255 arquivos, 142 MB. Leva três edições do exterior e a base
  antiga inteira, para comparação.
- **O que a edição usada abre de fato:**
  - cena de 2,6 MB;
  - luz de 12,7 MB, mais 1,9 MB da prévia;
  - GLB do mapa de 2,4 MB;
  - ~4 MB de luz por interior;
  - o motor minificado, ~1 MB mais os pedaços do three.
- **Uma casa deve ficar bem menor:** a geometria é pequena, e o tamanho da luz é escolha nossa.
  O número certo sai do MG-4.

---

## 3. Os dados de um imóvel

Uma pasta `dados/` dentro do build, com um arquivo de entrada e os recursos. Esboço; o formato
exato fecha no MG-1:

```text
dados/
  maquete.json         o que o motor lê primeiro (abaixo)
  cena.json.gz         a cena do exterior, no formato que o LIV já lê (liv-exterior-proof-v1)
  luz.rgbm.gz          a luz pré-calculada; ausente no LEVE (§4)
  luz-previa.rgbm.gz   a prévia da luz, quando houver luz
  interiores/<tipologia>/   o interior de cada tipologia
  plantas/<tipologia>.webp  a Planta 2D, quando for imagem
```

```json
{
  "schema": "maquete-dados-v1",
  "imovel": "monte-dos-cedros-37",
  "tipo": "casa",
  "exterior": { "cena": "cena.json.gz", "luz": null, "vistas": { "frente": { "...": "..." } } },
  "unidades": [
    { "id": "monte-dos-cedros-37", "rotulo": "Casa", "tipologia": "casa", "contorno": [[0, 0], [12, 0], [12, 9], [0, 9]] }
  ],
  "tipologias": {
    "casa": { "rotulo": "Casa térrea", "area": 92.4, "planta2d": "desenho", "interior": "interiores/casa/" }
  },
  "mapa": "tour.html",
  "comercial": { "fonte": "vitrine", "slug": "monte-dos-cedros-37" }
}
```

- **`tipo`**:
  - `casa` ou `apartamento`: uma unidade, sem lista nem pavimentos;
  - `predio`: o modo do LIV, com várias unidades.
- **`comercial.fonte`**:
  - `vitrine`: um imóvel. O documento `vitrine/<slug>` que o painel já mantém, lido pelo
    `vitrine_ao_vivo.js`. Não carrega o pacote do Firestore (576 KB);
  - `estoque`: o prédio, por `salesInventory/<id>`, como o LIV hoje.
- **`planta2d: "desenho"`:** a Planta 2D é desenhada pelo `floor-plan.js` a partir da planta,
  sem imagem. O LIV usa imagem porque tem a planta comercial.
- **`mapa`:** o motor aponta "O que tem por perto?" para o `tour.html` do mesmo build, o mapa da
  cidade que já existe.

---

## 4. De onde vêm os dados, por produto

| Produto | Exterior | Luz | Interior e Planta 2D | Quem faz |
|---|---|---|---|---|
| **LEVE** (imobiliária; o robô faz sozinho) | a cena da página do `pagina_maquete.py`, lida pelo mesmo caminho do `exportar_cena.py` (o objeto `window.__maq` que a página já expõe) | **nenhuma**: luz do sol e sombra em tempo real, com os materiais PBR padrão | do cadastro hoje; da planta fixada depois do M2-R. Planta 2D pelo `floor-plan.js` | o build, no robô |
| **PREMIUM** (Cedros e quem tiver luz calculada) | a cena da página do padrão (`padrao_atual.py`, que também expõe `window.__maq`) | a luz calculada pela equipe (Blender/Cycles). O Cedros já tem a sua, na mesma codificação do LIV (RGBM, faixa 16); se ela entra no motor sem conversão, o MG-4 confirma | o interior do padrão, com a luz dele | a luz é feita pela equipe, fora do robô; o build só a usa |
| **Construtora** (o próprio LIV) | a cena da produção artesanal | a luz artesanal | Canto, Meio, Tour em splat | continua à mão, fora do robô ([m2-worker.md](m2-worker.md) §1). Vira o primeiro pacote de dados do motor (MG-1) |

**Por que o LEVE não tem luz calculada:**

- a luz do LIV é um cálculo de Cycles na placa de vídeo (OPTIX, 64 amostras);
- a máquina do GitHub, onde o robô roda, não tem placa de vídeo;
- na CPU, levaria muitos minutos por imóvel e não sai igual duas vezes (o portão do build exige
  sair igual);
- a luz calculada fica sendo do PREMIUM, feita pela equipe e guardada por hash, como já é no
  Cedros.

**O exportador da cena** (`pipeline/maquete_dados.py`, no MG-4):

- abre a página do `pagina_maquete.py`, ou a do padrão, num Chrome sem janela;
- lê a cena do `window.__maq`, como o `exportar_cena.py`;
- grava a `cena.json.gz` com as chaves em ordem e o gzip sem data;
- exportar duas vezes tem de dar os mesmos bytes, senão o portão do robô
  (`BUILD_NOT_REPRODUCIBLE`) derruba.
- Se o Chrome sem janela se mostrar instável na máquina do GitHub (o Chrome 151+ já quebrou os
  portões uma vez), o plano B é gerar a cena em Python, sem navegador. É mais trabalho, e a
  decisão fica para quando o MG-4 medir.

---

## 5. O novo build

A pasta do build continua sendo `b/<imóvel>/<build>/`, agora com vários arquivos:

```text
b/<imóvel>/<build>/
  tour.html        o mapa da cidade, como hoje
  maquete.html     a entrada do motor, com a vitrine ao vivo
  manifest.json
  motor/           o motor já otimizado (o otimizar_publicacao.mjs roda no build)
  dados/           os dados do imóvel (§3)
```

**O `manifest.json` passa ao `schema: 2`:**

- `arquivos` lista **todos** os arquivos da pasta (menos ele mesmo), cada um com bytes e sha256;
- `build` = sha256 da lista "caminho sha256", uma linha por arquivo, em ordem de caminho (12
  primeiros dígitos). Continua sendo o conteúdo: mudou um byte de qualquer arquivo, muda o
  build;
- `entradas: { "tour": "tour.html", "maquete": "maquete.html" }`: os nomes de entrada não
  mudam, e por isso os ponteiros `/imovel/<id>` e `/maquete/<id>` também não;
- `motor`: o hash do motor que entrou;
- `formato: "maquete-geral-v1"`;
- o resto (`fontes`, `tiles`, `publico`, `commit`, `gerado_em`) fica como hoje.

**Os portões de hoje valem para a pasta inteira:**

- **fonte estável:** as fontes passam a incluir o motor, o exportador e a página de onde a cena
  sai;
- **duas montagens com o mesmo build:** o motor otimizado também tem de sair igual (o esbuild com
  versão fixa no `package-lock.json` da raiz, onde ele precisa entrar);
- **sem rebaixar**, e `mirra-114` não se publica.

**Outras regras:**

- **A vitrine ao vivo** entra na `maquete.html` (a entrada do motor) e no `tour.html`, como hoje.
  "Tirar do ar" continua cobrindo as duas.
- **O service worker** fica restrito à pasta do build, como já é no LIV; nunca na raiz do site.
- **O motor vai dentro de cada build** (decisão D2, §9), e é a forma mais simples:
  - custa ~1–2 MB por build no Hosting: com 250 imóveis × 2 builds, ~0,5–1 GB dos 10 GB;
  - um motor compartilhado por hash (`/motor/<hash>/`, como os quintais) fica para quando o
    armazenamento ou o tráfego pedirem.

---

## 6. O que muda fora do build

| Onde | Hoje assume | Passa a |
|---|---|---|
| `pipeline/publicar_imovel.py` | `PUBLICADOS = tour.html, maquete.html, manifest.json`; o `confere_build` recalcula `sha256(tour + maquete)` | percorrer `manifest.arquivos` e recalcular o build pelo schema do manifest. **Aceitar os dois schemas:** o build anterior de um imóvel no ar pode ser do schema 1, e reverter para ele tem de continuar funcionando |
| painel, `validarManifesto` (`painel/src/lib/publicacao.ts`) | `schema === 1` | aceitar 1 e 2. A exigência de `tour.html` e `maquete.html` em `arquivos` continua |
| robô, prévia (`conferirCanal`, M2-3) | confere só `tour.html` e `maquete.html` contra o manifest | conferir **todos** os arquivos do manifest no canal |
| robô, publicar (`baixar`, M2-5) | baixa 3 arquivos de cada build | baixar todos os arquivos do manifest de cada build. O portão de escopo já cobre `b/X/…` e não muda |
| `firebase.imoveis.json` | cabeçalhos de `/b/**` imutáveis | igual. Conferir no MG-5 o tipo dos `.js` dos ajudantes e do service worker, e os `.gz` que o motor descomprime sozinho |
| tráfego do robô ([m2-worker.md](m2-worker.md) §14) | ~5 MB por build | refazer a conta com o tamanho medido no MG-4 (§2.3). Se crescer muito, a cópia no servidor (M2-9) vem antes |

---

## 7. O que não muda

- O mapa da cidade (`tour.html`) e o gerador dele.
- **O fluxo:** a aprovação do gerente, a revisão interna e o robô, cujas etapas, travas e
  conferências do M2 são as mesmas.
- O site de imóveis, os ponteiros, o `estado.json`, o promover e o reverter.
- **O LIV clássico e o novo:**
  - continuam publicados à mão no site de miniaturas;
  - mudança de tela continua indo só no clássico, sem mexer no novo (o Tour do servidor).
  - Só entram no robô quando a construtora entrar, com o pacote de dados no contrato do site de
    imóveis.

---

## 8. Riscos, ditos com clareza

- **O código do LIV não está no GitHub.**
  - O galho `liv-melhorado` tem **26 commits só neste computador**, entre eles o do PageSpeed
    (`4a891c6`).
  - Os recursos grandes do LIV (cena, luz) são ignorados pelo git e só existem nesta máquina.
  - O MG-1 começa ali, então o risco de perder o trabalho existe até ele subir (decisão D4).
- **O motor fica mais exigente que a página de hoje:**
  - WebGPU, com reserva em WebGL2;
  - aparelhos físicos (Poco X6, iPhone) ainda não foram qualificados nem no LIV.
  - A página antiga continua existindo e pode servir de reserva até o MG-8 medir.
- **Chrome sem janela no build:** a exportação da cena depende dele, e o GitHub precisa ter o
  Chrome e o Playwright. Isso põe minutos a mais em cada build do robô (a medir no MG-4).
- **O build fica maior e com mais arquivos:** o robô baixa mais por publicação. O teto de ~15
  imóveis no ar (§14 do M2) pode cair.
- **O LEVE sem luz calculada fica menos bonito que o LIV.** É a mesma maquete de hoje, num motor
  melhor. A diferença de aparência entre LEVE e PREMIUM continua sendo o produto.

---

## 9. Decisões

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Luz do LEVE: em tempo real (sem cálculo), ou calculada no robô | **em tempo real.** A máquina do robô não tem placa de vídeo, e a luz calculada não sai igual duas vezes |
| D2 | Motor dentro de cada build, ou compartilhado por hash | **dentro de cada build** no começo; compartilhado quando o armazenamento pedir (§5) |
| D3 | Onde mora a luz calculada do PREMIUM | **no git até ~10 MB por imóvel** (como o Cedros, 6–7 MB); acima disso, no repositório privado de artefatos, por hash |
| D4 | Subir a `liv-melhorado` para o GitHub antes do MG-1 | **sim**, ou pelo menos o código do motor, para não depender só deste computador. O tamanho do galho tem trava própria (300 MB); conferir antes |
| D5 | Ordem com o M2 | o **M2-6 e o M2-7 seguem em paralelo**, porque não dependem do formato. Os MG vêm **antes do M2-R**, que passa a gerar os dados do imóvel pela planta. O M2-8 pode ligar com o formato antigo: os dois schemas são aceitos |

---

## 10. Incrementos

Cada um é um PR pequeno, com teste, como no M2.

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **MG-1** | **Separar motor e dados, na `liv-melhorado`.** As constantes do LIV (§2.2) saem do código para um pacote de dados `maquete-dados-v1`. O LIV vira o primeiro pacote | os testes do LIV (`test_viewer_flow` e os demais). O liv-clássico montado com o motor novo, comparado pixel a pixel com o que está no ar | as imagens são idênticas, e nenhum nome, medida ou caminho do LIV fica no motor (um teste procura) |
| **MG-2** | **O motor na main**, em `maquete/motor/`, com um pacote de teste pequeno (um volume simples com luz de 64²) e os testes do motor. Sem o LIV | os testes do motor no CI | o pacote de teste abre em WebGPU e WebGL2, e a conferência de identidade recusa um recurso trocado |
| **MG-3** | **Imóvel de uma unidade e sem luz calculada.** Sem lista nem pavimentos; ficha da vitrine ao vivo; Planta 2D pelo `floor-plan.js`; sol e sombra em tempo real | o pacote de teste nas duas formas (com e sem luz); a ficha lendo `vitrine/<slug>` no emulador | a casa abre, mostra a ficha e a planta, e o "tirar do ar" cobre a tela |
| **MG-4** | **O exportador** (`pipeline/maquete_dados.py`): da página do `pagina_maquete.py` (LEVE) e da do padrão (PREMIUM) para o pacote de dados | exportar duas vezes dá os mesmos bytes; o Cedros PREMIUM com a luz dele; uma casa LEVE. Medir tamanho, tempo e memória | os dois produtos abrem no motor e parecem a maquete de hoje (print lado a lado) |
| **MG-5** | **O build novo** (§5) e o site: `build_imovel.py` monta a pasta; o manifest vai ao schema 2; `publicar_imovel.py` e o painel aceitam os dois schemas | os testes de Python da publicação com builds de vários arquivos; promover X mantém Y byte a byte; reverter para um build do schema 1 | um build novo vai do canal ao ar no teste local, e o anterior antigo volta |
| **MG-6** | **O robô com o build novo:** a prévia e a publicação conferem e baixam todos os arquivos | a matriz do M2-3 e do M2-5 de novo, com builds novos e antigos misturados no ar; as quebras de propósito | testes verdes; tráfego por publicação medido e anotado no §14 do m2-worker.md |
| **MG-7** | **Interior e Planta 2D pela planta fixada**, junto do M2-R: o interior do v16 gerado da leitura vira o interior da tipologia | o `test_e2e_leitura.py` estendido com a sonda contra a planta | o gerente aprova a prévia de uma casa da planta fixada até o ar, no teste |
| **MG-8** | **Carregamento e notas:** o otimizador no build e a medição do PageSpeed pelo método do LIV (Lighthouse local com brotli, 3 rodadas) | as notas de uma casa LEVE e do Cedros PREMIUM | computador 100 nas quatro; celular perto do LIV (90+). Só então a página antiga deixa de ser a reserva |
