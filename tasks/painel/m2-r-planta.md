# M2-R: o 3D a partir da planta fixada (especificação)

O passo que liga o ciclo automático da imobiliária: a equipe fixa a planta, os dados do imóvel são
fixados, e a prévia sai sozinha, já no formato da [maquete geral](maquete-geral.md). **Ainda não
muda código.**

Relaciona-se com:

- [m2-worker.md](m2-worker.md): a linha do M2-R na §15, o gatilho da §3, a decisão W9 e o portão 4
  da §13;
- [maquete-geral.md](maquete-geral.md): o motor, os dados do imóvel e o build de vários arquivos
  (MG-1 a MG-7);
- [materiais-da-solicitacao.md](materiais-da-solicitacao.md): os dados fixados (§5, MAT-6) e o
  endereço que vira ponto no mapa (§6, MAT-5).

---

## 0. Resumo

- **Hoje, a planta fixada não vira prévia sozinha.**
  - O `e2e_leitura` (M1-F) gera só a maquete LEVE local e a confere com a sonda.
  - Não gera o tour (o mapa da cidade), nem a pasta do build, nem o `manifest.json`.
  - O robô recusa o pedido que só tem planta (`PRODUCTION_INPUT_UNSUPPORTED`).
- **Com o M2-R, um script novo, `pipeline/build_planta.py`, faz o build inteiro** a partir de duas
  entradas fixadas no pedido:
  - a **planta** (`productionInput`, do M1-E);
  - os **dados do imóvel** (`productionContext`, do MAT-6), que passam a trazer o ponto no mapa e o
    rumo da frente.
- **A saída é a pasta da maquete geral:**
  - o motor e os dados do imóvel;
  - o tour com a cidade recortada em volta do ponto e a unidade do pedido dentro;
  - o `manifest.json` com todos os arquivos.
- **A sonda continua sendo o portão "a maquete é a planta".** Se o que foi montado não bate com a
  planta, o build para com `PROBE_MISMATCH`.
- **O robô ganha o gatilho da planta:** pedido em produção, com planta e dados fixados, e sem job
  para esse par, vira uma prévia. O resto do ciclo é o de hoje: a prévia vai ao gerente (na
  imobiliária) ou à revisão interna (na construtora), e a aprovação publica.
- **O dado da cidade no git não muda.** A unidade do pedido entra no tour só em memória.

---

## 1. Hoje

### 1.1 O `e2e_leitura` (M1-F)

`python -m pipeline.e2e_leitura ENTRADA.json CONTEXTO.json --destino PASTA`

| Fase | O que faz |
|---|---|
| F0 entrada | o ponteiro do pedido, o snapshot da leitura e o sha256 do conteúdo têm de ser o mesmo; a planta é normalizada e vinculada ao hash |
| F5 portões | o que o desenhista de planta (`floor-plan.js`) não representa fielmente recusa antes de gerar (fora da grade de 5 cm, vão menor que 20 cm) |
| F1 unidade | a planta derivada mais o contexto explícito. O contexto não traz geometria, e a planta não inventa contexto |
| F3 artefato | `pagina_maquete.py --cadastro`, numa pasta de trabalho |
| F2 conferência | a sonda roda o desenhista embutido na página (sem navegador) e confere cômodos, aberturas e pé-direito com a planta |
| F4 relatório | a leitura, a planta derivada, a geometria montada e o artefato, cada um com o seu hash |

**O que ele não faz e o M2-R precisa:**

- não gera o `tour.html`, nem a pasta `b/<id>/<build>/`, nem o `manifest.json`;
- o contexto (`schema: 1`) só aceita `lote` com o prédio (largura, profundidade, pavimentos), sem
  o ponto no mapa nem o rumo. O tour precisa dos dois;
- a página da maquete exige o prédio. Uma casa não tem "prédio" declarado.

### 1.2 O build de hoje

O `build_imovel.py` (o fluxo legado, do Cedros) lê o imóvel do cadastro do git
(`plantas_fornecidas/<id>/unidade.json`) e o tour mostra as unidades de lá. Pela decisão W9 e pela
fronteira do M1-F, **o caminho da planta não passa pelo `--cadastro` direto**: só pelo que o
`e2e_leitura` conferiu.

### 1.3 O robô de hoje

- A prévia só sai pelo clique "Gerar prévia".
- Imóvel sem `pipelineUnitId` dá `PRODUCTION_INPUT_UNSUPPORTED`.

---

## 2. As entradas

### 2.1 A planta: `productionInput` (M1-E, já existe)

O ponteiro fixado no pedido (`readingId`, versão, revisão, esquema, `contentSha256`) e o snapshot
de `propertyReadings/<readingId>`. É exatamente o que o `e2e_leitura` já lê.

### 2.2 Os dados do imóvel: `productionContext` (MAT-6)

`{ dados, sha256, fixedBy, fixedAt }`, com AuditLog interno no mesmo batch. O `dados` é o contexto
na **versão 2**, o contrato entre o MAT-6 e o M2-R:

| Campo | Obrigatório | O que é |
|---|---|---|
| `schema` | sim | `2` |
| `propertyId`, `agencyId` | sim | do pedido; outro imóvel dá `CONTEXTO_DE_OUTRO_IMOVEL`, como hoje |
| `tipo` | sim | `casa` ou `apartamento` |
| `andar` | sim | inteiro, 0 = térreo |
| `ficha` | sim | título, empreendimento, bairro, município, venda/aluguel, quartos, suítes, banheiros, vagas |
| `cores` | não | parede, piso frio, piso de madeira, teto (`#RRGGBB`) |
| `moveis` | não | móveis já posicionados, validados como hoje |
| `lote.lat`, `lote.lon` | sim | o ponto (materiais §6) |
| `lote.rumo_graus` | sim | o rumo da frente, de 0 a 360 |
| `lote.loteId`, `fonte`, `confianca`, `confirmado` | não | de onde veio o ponto. O build não decide por eles: quem decide fixar é o MAT-6 |
| `lote.predio` | só no apartamento | largura, profundidade e pavimentos, como hoje. Na casa, sai da planta (decisão D2) |

**Regras que valem igual à versão 1:**

- o contexto não traz geometria: cômodos, paredes e aberturas vêm só da planta;
- chave fora da lista recusa.

**Regras novas:**

- ponto fora de São Carlos dá `CIDADE_FORA_DO_MAPA`; é a única cidade do mapa hoje;
- no apartamento, a planta tem de caber no prédio declarado (`CONTEXTO_NAO_COMPORTA`, como hoje).

### 2.3 O endereço público do imóvel (decisão D1)

O site de imóveis precisa de um nome estável para cada imóvel: as pastas `b/<slug>/…`, os ponteiros
`/imovel/<slug>` e o `vitrine/<slug>`.

- No legado, esse nome é o `pipelineUnitId`.
- Imóvel novo não tem um. O id do Firestore não serve: tem letra maiúscula, e o site só aceita
  minúscula, número e hífen.
- **Proposta:** o imóvel ganha `publicSlug` quando é criado, com o título em minúsculas e sem acento
  mais 4 letras sorteadas (`casa-jardim-paraiso-k3f9`). As regras não deixam mudar depois:
  - mudar o título não muda o endereço;
  - o endereço publicado não quebra.

---

## 3. O que o build faz

`python pipeline/build_planta.py ENTRADA.json CONTEXTO.json --builds DIR`

O script novo usa as funções do `e2e_leitura` (que continua existindo como o teste do M1-F). A
última linha do stdout é o JSON do resultado, como no `build_imovel.py`; uma recusa sai com a
lista de erros e os códigos.

1. **Entrada (F0):** o ponteiro, o snapshot e o hash, como hoje.
2. **Portões (F5):** o que o desenhista de planta não representa fielmente, como hoje.
3. **Unidade (F1):** a planta mais o contexto versão 2. Na casa, o prédio sai da caixa da planta,
   com a margem da casca (0,25 m por lado) e 1 pavimento.
4. **Página de origem e sonda (F3, F2):**
   - o `pagina_maquete.py --cadastro` monta a página;
   - a sonda confere cômodos, aberturas e pé-direito contra a planta. Divergiu: `PROBE_MISMATCH`,
     e nada sai.
5. **Dados do imóvel** (no formato da [maquete geral](maquete-geral.md) §3):
   - `cena.json.gz`: a cena exportada **dessa mesma página**, a que passou na sonda, pelo
     exportador do MG-4. O pacote guarda o sha256 da página de onde a cena saiu;
   - `planta.json`: a planta derivada, que o motor desenha como Planta 2D (`floor-plan.js`) e usa
     para o interior (MG-7);
   - `maquete.json` com:
     - `tipo` e uma unidade;
     - `comercial: { fonte: "vitrine", slug }`;
     - `mapa: "tour.html"`;
     - **o vínculo da leitura** (`entrada`: id, versão e hash), para a página dizer de que planta
       nasceu, como já faz hoje.
6. **Tour:**
   - o montador do mapa (`imovel.gera`) recorta a cidade em volta do ponto do contexto;
   - a unidade do pedido entra **em memória**, como uma unidade a mais no bloco de unidades;
   - nada é gravado em `plantas_fornecidas/` nem no dado da cidade.
7. **A pasta do build**, como na maquete geral §5:
   - motor, dados, `tour.html`, `maquete.html`, vitrine ao vivo e `manifest.json` (`schema: 2`);
   - o manifest ganha `entradas: { leitura: { readingId, contentSha256 }, contexto: { sha256 } }`
     no lugar das `fontes` de arquivo do legado. As fontes de código (motor, montador, exportador)
     continuam listadas;
   - o build é o conteúdo, e a pasta nunca é sobrescrita.

**Tem de sair igual duas vezes**, porque o robô monta duas vezes e exige o mesmo build:

- o exportador, o gzip e o JSON com ordem fixa;
- o montador do mapa com o carimbo fixo, como hoje;
- nada de data, caminho ou sorteio dentro dos arquivos.

---

## 4. O robô

### 4.1 O gatilho e a identidade (m2-worker.md §3)

- **Fato:**
  - o pedido está em `production`;
  - tem `productionInput` e `productionContext`;
  - não há job com a identidade `previa-<requestId>-<readingId>-<12 primeiros hex do sha256 dos dados>`.
- **A mesma planta com os mesmos dados não gera build de novo.** Fixar uma planta nova ou dados
  novos gera.
- **"Gerar prévia" (clique) também serve ao caminho da planta**, para montar de novo sem mudar
  nada.
- **Na criação do job, ele exige:** os dois fixados, o imóvel da mesma agência, o `publicSlug` e o
  modo LEVE.
  - Faltou alguma coisa: o job nasce bloqueado.
  - Como o gatilho é automático, o pedido vai para a revisão interna com o motivo. É a regra do
    M2-5 para fato que ninguém clicou.

### 4.2 O executor

O mesmo da prévia (M2-3), com outro começo:

1. lê do banco o snapshot da leitura e o `productionContext` do pedido, e grava os dois numa pasta
   de trabalho;
2. roda o `build_planta.py` duas vezes e exige o mesmo build (`BUILD_NOT_REPRODUCIBLE`);
3. segue igual a partir daí:
   - `montar-preview` e canal;
   - a conferência de **todos** os arquivos servidos (MG-6);
   - o registro pela política da conta.

### 4.3 Os motivos

Os códigos do `build_planta.py` passam para o job assim:

| Do build | No job | O que a equipe lê no painel |
|---|---|---|
| `CONTEXTO_INVALIDO`, `CONTEXTO_DE_OUTRO_IMOVEL`, `CONTEXTO_NAO_COMPORTA` | `CONTEXT_INVALID` | Os dados do imóvel não fecham (o detalhe vai junto) |
| `CIDADE_FORA_DO_MAPA` | `CIDADE_FORA_DO_MAPA` | O ponto do imóvel está fora de São Carlos |
| `GEOMETRIA_DIVERGENTE` | `PROBE_MISMATCH` | A maquete montada não bate com a planta |
| `PONTEIRO_DIVERGENTE`, `CONTEUDO_ADULTERADO`, `VINCULO_DIVERGENTE`, `NORMALIZADOR_DESVINCULADO`, `ENTRADA_INVALIDA` | `INPUT_MISMATCH` | A planta fixada não é a que está salva |
| `FORA_DA_GRADE`, `VAO_ESTREITO` | `BUILD_REFUSED` | A planta tem algo que o 3D não desenha fiel (o detalhe vai junto) |
| sem planta e com dados, ou o contrário | `CONTEXT_MISSING` | Falta fixar a planta ou os dados do imóvel |

- Todos levam o pedido à revisão interna com o motivo, como os portões de hoje.
- `PRODUCTION_INPUT_UNSUPPORTED` deixa de existir.

### 4.4 Publicar e reverter

Não mudam além do MG-6: a aprovação publica o build aprovado, e o ponto no mapa geral (MAT-10)
usa o `lat` e o `lon` do contexto fixado.

---

## 5. O painel

- **Na equipe**, o cartão do robô (M2-4, M2-6) passa a dizer:
  - "A prévia sai sozinha quando a planta e os dados do imóvel estão fixados";
  - qual dos dois falta.
- **O aviso "a fila está parada"** (m2-worker.md §9) cobre também esse fato: os dois fixados há
  mais de 30 min sem job.
- **A tela de fixar os dados é do MAT-6**, não do M2-R.
- **Na imobiliária, nada muda:** o pedido vai de "Em produção" para "Revisão da imobiliária" quando
  a prévia fica pronta.

---

## 6. O que não muda

- **O fluxo legado** (`pipelineUnitId`, como o Cedros) continua pelo `build_imovel.py` e pelo
  clique.
- **O `e2e_leitura`** continua como o teste do M1-F.
- **O ciclo depois da prévia:** a aprovação do gerente, a revisão interna, a publicação e o
  reverter.
- **O dado da cidade e o `plantas_fornecidas/` no git.**

---

## 7. Riscos, ditos com clareza

- **A sonda confere a página, não a cena exportada.** A cena sai da mesma página que passou na
  sonda, e o pacote guarda o sha dela. Uma diferença entre as duas seria defeito do exportador, e
  quem pega é o teste do MG-4. Ele compara o número de cômodos e paredes da sonda com o da cena.
- **O exportador usa o Chrome sem janela** ([maquete-geral.md](maquete-geral.md) §8). Se ele se
  mostrar instável na máquina do GitHub, o plano B é gerar a cena em Python.
- **Cada planta ou dado fixado de novo gera uma prévia** (dois builds e um deploy de canal). A
  identidade evita repetir o mesmo par, mas uma equipe que fixa várias vezes seguidas gasta
  minutos do Actions. Vale olhar o número no M2-8.
- **O ponto errado leva o imóvel para o lugar errado do tour.** A confiança do ponto é decidida no
  MAT-5 e no MAT-6; o build só confere que está em São Carlos. O gerente vê o tour na prévia antes
  de aprovar.
- **A casa com o prédio tirado da planta** ainda não foi testada no `pagina_maquete.py`. Se a página
  pedir mais do que a caixa da planta, o R-1 descobre.

---

## 8. Decisões

| # | Decisão | Recomendação |
|---|---|---|
| D1 | O endereço público de imóvel novo | `publicSlug` na criação (título sem acento + 4 letras sorteadas), sem poder mudar depois; o legado continua com o `pipelineUnitId` |
| D2 | O prédio da casa | sai da caixa da planta, com a margem da casca e 1 pavimento; o contexto não declara |
| D3 | O contexto versão 2 (§2.2) | é o contrato com o MAT-6: o MAT-6 fixa nesse formato, e o M2-R recusa outro |
| D4 | Ordem | depois do MG-1 ao MG-6 (motor, exportador, build de vários arquivos e robô). Os testes do M2-R usam um contexto semeado, então não esperam o MAT-6; o uso real espera |
| D5 | O `e2e_leitura` | continua como está, como o teste do M1-F; o `build_planta.py` usa as funções dele |

---

## 9. Incrementos

Cada um é um PR pequeno, com teste, como no M2.

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **R-1** | **O contexto versão 2** e a unidade da casa: ponto, rumo, `tipo`, prédio tirado da planta na casa; `CIDADE_FORA_DO_MAPA` | `tests/test_e2e_leitura.py` estendido: contexto v2 válido para casa e apartamento; ponto fora de São Carlos; rumo fora de 0–360; chave fora da lista; a casa monta na página e passa na sonda | a casa e o apartamento sintéticos passam na sonda com o contexto v2 |
| **R-2** | **O tour com a unidade do pedido:** a cidade recortada em volta do ponto e a unidade em memória | a unidade aparece no tour (o link direto acha ela); o centro do recorte cai no ponto; `git status` limpo em `plantas_fornecidas/` e no dado da cidade depois do build | o tour de uma casa sintética abre com ela no lote |
| **R-3** | **O `build_planta.py`:** a pasta da maquete geral com os dados, o tour, o motor e o manifest `schema: 2` | duas montagens dão o mesmo build; o manifest lista todos os arquivos e as entradas; sonda divergente dá `PROBE_MISMATCH` sem pasta nenhuma; cada código da §4.3 aparece no erro certo | a casa sintética vira uma pasta que o `montar-preview` aceita |
| **R-4** | **O `publicSlug`** (D1): na criação do imóvel, e as regras que travam a mudança | regras: ninguém muda o `publicSlug` depois; o painel gera um válido para títulos com acento e símbolo | testes verdes |
| **R-5** | **O robô com o gatilho da planta:** coleta, identidade, executor e motivos; o cartão da equipe | no emulador, com os scripts de verdade: a matriz da prévia pelo gatilho da planta nas duas contas; a mesma planta com os mesmos dados não gera job de novo; dados novos geram; `CONTEXT_INVALID` e `PROBE_MISMATCH` levam à revisão interna com o motivo; a fila parada aparece depois de 30 min | **a imobiliária vai da planta fixada ao `published` com só a aprovação do gerente**, no teste com o "ar" falso |
