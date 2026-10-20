# Materiais da solicitação (especificação)

Proposta de 20/10/2026, revisada no mesmo dia com as respostas do usuário (§11). **Só
documento: nada implementado, nada no ar.** Escrita sobre a pilha #86→#91
(`feat/cloud-run-preparo`, `dc3e121`), junto com a do [robô do M2](m2-worker.md).

O que o usuário pediu em 20/10:

- "a ideia é que nós recebamos esses dados junto com a solicitação. Então planeje um espaço que
  permita todo tipo de entrada de dados como zip, xml, cad, png e tudo que envolva construção";
- o arquivo vai para os EUA, e "o sistema baixa 1 arquivo por vez e vai extraindo as
  informações necessárias. Depois que terminar exclui o arquivo original e parte para o
  próximo";
- tempo de guarda: "nenhum tempo, a partir do momento que colocar os arquivos no sistema, ele
  extrai e depois já exclui, mas as maquetes ficam por tempo a ser confirmado";
- endereço no mapa: "teria que ser automatizado, já que quando recebemos os dados, recebemos o
  endereço";
- o gerente pede revisão "com um campo explicativo com envio de fotos, texto e áudio"
  ([m2-worker.md](m2-worker.md) §1.1).

---

## 0. Resumo

1. **Um espaço de materiais em cada solicitação.** A imobiliária, a construtora e a equipe sobem
   qualquer arquivo de obra: CAD, BIM, PDF, XML, fotos, vídeo, áudio, nuvem de pontos, zip.
   - Até 2 GB por arquivo.
   - Se a conexão cair, o envio continua de onde parou.
2. **Recusado de propósito:** só o que executa ou roda no navegador (`.exe`, `.bat`, `.js`,
   `.html`, `.svg` e parecidos).
3. **Um arquivo por vez, e o original sai** (decidido). O robô:
   1. pega o arquivo mais antigo da fila;
   2. baixa;
   3. extrai o que interessa;
   4. guarda o que extraiu;
   5. **apaga o original**;
   6. passa para o próximo.

   A imobiliária recebe um recibo: "arquivo X recebido às 10h, processado e apagado às 10h12".
4. **O que fica é só o extraído:**
   - dados (texto e números);
   - imagens leves que a equipe precisa ver (a página da planta, fotos reduzidas);
   - o áudio virado texto.

   Isso também sai quando o pedido termina (publicado ou cancelado). **As maquetes ficam**, por
   um tempo a confirmar.
5. **Os dados do imóvel** vêm do formulário da solicitação e do que o robô extraiu. Quando os
   dois batem e nada falta, o robô fixa sozinho os dados que o 3D usa. Se brigam ou falta algo,
   a equipe resolve (§5).
6. **Endereço → lote → mapa, automático** (§6). Usa o cadastro de endereços do IBGE (CNEFE) e a
   grade de lotes de São Carlos que já temos. Lançamento novo, que o IBGE ainda não tem, cai
   numa estimativa ou na equipe, com um alfinete no mapa.
7. **Depende do plano Blaze**, porque o arquivo passa pelo Storage. O bucket fica nos EUA
   (`us-east1`), com 5 GB grátis. Como o original sai logo, o armazenamento quase não é usado
   (§9).

---

## 1. O que já existe

- **Regras do Storage** ([`firebase/storage.rules`](../../firebase/storage.rules)), escritas na
  T03 e testadas só no emulador:
  - caminho `request-assets/{agencyId}/{requestId}/{arquivo}`;
  - lê a equipe e a própria agência;
  - cria quem é da equipe ou da agência do pedido;
  - nunca sobrescreve;
  - **até 200 MB** por arquivo;
  - HTML, SVG e XHTML negados;
  - só a equipe apaga;
  - nenhum outro caminho existe.
- **Coleção `requestAssets`** nas regras do Firestore. O documento aponta o arquivo
  (`storagePath`) e é do mesmo pedido e da mesma agência.
- **`requests/{id}/internal/{doc}`**: só a equipe lê e escreve. É onde o extraído vai morar, sem
  regra nova.
- **No mapa:**
  - o CNEFE de São Carlos: 143.200 endereços com coordenada (`pipeline/fontes/cnefe.py`);
  - a grade de 113.501 lotes reconstruída das quadras (`lotes_saocarlos.geojson`);
  - a tolerância de 8 m entre o endereço e o lote (`pipeline/ocupacao.py`, `TOL`).
- **O que não existe:**
  - o bucket;
  - a tela de upload;
  - o tipo `RequestAsset` em `types.ts`;
  - qualquer extrator de arquivo enviado. O `pipeline/extrair_planta.py` lê uma imagem de planta
    já conhecida, e não um arquivo novo;
  - um índice de endereço por rua e número: o `cnefe.py` de hoje guarda só o ponto, sem a rua
    e o número.

---

## 2. O que entra

| Grupo | Exemplos de extensão |
|---|---|
| Planta e projeto (CAD/BIM) | `.dwg` `.dxf` `.dwf` `.dgn` `.ifc` `.rvt` `.rfa` `.skp` `.pln` `.3dm` |
| Modelo 3D | `.obj` `.fbx` `.glb` `.gltf` `.stl` `.dae` `.3ds` `.blend` `.usdz` |
| Nuvem de pontos e escaneamento | `.e57` `.las` `.laz` `.ply` `.pts` `.xyz` `.rcp` |
| Imagem | `.png` `.jpg` `.jpeg` `.heic` `.webp` `.tif` `.tiff` `.bmp` |
| Documento e dados | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.odt` `.ods` `.csv` `.txt` `.xml` `.json` |
| Mapa e terreno | `.kml` `.kmz` `.geojson` `.shp` (dentro de zip) |
| Vídeo | `.mp4` `.mov` `.webm` |
| Áudio | `.m4a` `.mp3` `.ogg` `.wav` `.webm` |
| Compactado | `.zip` `.rar` `.7z` |

- **A lista não é fechada:** um formato de obra que não está aqui entra como "outro".
- **A regra recusa só o que é perigoso de abrir:**
  - o que executa: `.exe` `.msi` `.bat` `.cmd` `.com` `.scr` `.ps1` `.vbs` `.js` `.jar` `.sh`
    `.app` `.dmg` `.apk` `.lnk` `.reg` `.hta`;
  - o que roda no navegador, como hoje: HTML, SVG e XHTML.
- **A regra confere o final do nome e o tipo declarado**, porque o navegador pode mentir o tipo.
- **Tamanho:** até 2 GB por arquivo (hoje são 200 MB), com upload retomável
  (`uploadBytesResumable`) e barra de progresso.

---

## 3. Como o arquivo entra

1. Na solicitação (nova ou já aberta), a área **"Materiais"** aceita arrastar arquivos ou
   escolher do computador. No celular, também tirar foto na hora.
2. Cada arquivo sobe para `request-assets/{agencyId}/{requestId}/{id}-{nome}`. O `{id}` é
   aleatório, para dois arquivos com o mesmo nome não se chocarem.
3. Ao terminar, o painel grava o `requestAssets/{id}` com nome, grupo (pela extensão), tamanho,
   quem subiu e quando, e o estado **"na fila"**.
4. **Quem sobe:**
   - a agência, enquanto o pedido está em "Recebida" ou "Aguardando materiais";
   - a equipe, em qualquer etapa;
   - o gerente, no pedido de revisão (§7).
5. A lista mostra cada arquivo com o estado: **na fila → processando → processado e apagado**,
   ou **não processado, a equipe vai olhar**.

---

## 4. A extração: um arquivo por vez

**Quem faz:** o mesmo robô do M2 ([m2-worker.md](m2-worker.md)), numa etapa nova, `extract`. Ele
já trabalha com uma trava global, então um arquivo por vez é literal: o próximo só começa
quando o anterior terminou.

**O caminho de cada arquivo:**

1. Pega o arquivo mais antigo "na fila" e marca "processando".
2. Baixa para a máquina descartável do robô, que some no fim da execução.
3. Confere tamanho e tipo de novo; não confia no que a tela disse.
4. Roda o extrator do formato (tabela abaixo), com limite de tempo e de memória.
5. Guarda o extraído em `requests/{id}/internal/extracao-<arquivo>`, só para a equipe. As imagens
   leves vão para o Storage, ao lado, como `derivado-<arquivo>-<n>.webp`.
6. **Apaga o original** do Storage e o `requestAssets` dele.
7. Grava o **recibo**, um AuditLog visível à agência: nome, tamanho, `md5` do Storage, quando
   chegou, quando foi processado e apagado, e o que foi achado (por exemplo "3 quartos, 1
   endereço, 4 páginas de planta").
8. Passa para o próximo.

**Formato do extraído:** uma lista de achados, cada um com a origem.

```ts
{ campo: 'quartos', valor: 3,
  fonte: { arquivo: 'memorial.pdf', pagina: 2 },
  como: 'xml' | 'ifc' | 'dxf' | 'texto' | 'exif' | 'cores' | 'ia',
  confianca: 'alta' | 'media' | 'baixa' }
```

**O que se extrai de cada formato:**

| Formato | O que sai | Como | Custo |
|---|---|---|---|
| XML de anúncio | endereço, CEP, quartos, suítes, banheiros, vagas, área, preço, descrição | leitor de XML. A imobiliária costuma exportar o XML dos portais num padrão conhecido; confirmar com um arquivo real | zero |
| IFC (BIM) | pavimentos, andar da unidade, cômodos com área, tamanho do prédio | `ifcopenshell` (dependência nova) | zero |
| DXF | rótulos e áreas dos cômodos, contorno; a planta vira imagem leve | `ezdxf` (dependência nova) | zero |
| DWG | o mesmo do DXF, depois de converter | o DWG é fechado; a conversão é o passo difícil. **No começo, DWG fica "não processado"** e a equipe olha | — |
| PDF | o texto (memorial, tabela de áreas); cada página de planta vira imagem leve | `pypdfium2` (licença livre para uso comercial) | zero |
| Imagem | data e GPS da foto (EXIF), as cores dominantes (paredes, piso), cópia reduzida (~1600 px) | `Pillow` | zero |
| Áudio | o texto falado | transcrição na própria máquina do robô (`faster-whisper`, licença MIT) | zero, ~1–3 min por 5 min de áudio |
| Vídeo | alguns quadros, como fotos reduzidas | `ffmpeg` | zero |
| ZIP, RAR, 7z | **cada arquivo de dentro entra na fila** como se tivesse sido enviado; o compactado sai | com os limites da §8 | zero |
| Nuvem de pontos, modelo 3D, Revit, SketchUp, desconhecido | nada, no começo | — | fica "não processado" |

- **Ler com IA** (memorial em texto livre, foto da planta, qual cômodo é qual) fica **desligado
  até você decidir** (§11). O custo é por arquivo, a medir, e o conteúdo sai para o fornecedor
  da IA.
- O `pipeline/extrair_planta.py` (a máquina acha as paredes na imagem) pode virar um extrator de
  planta depois. A planta continua sendo desenhada e fixada pela equipe no capturador.

**Quando o robô não consegue ler** (formato sem extrator, arquivo corrompido, estourou o tempo):

- o original **fica**, marcado "não processado";
- a equipe é avisada no painel;
- ela abre e decide: apagar, pedir de novo ou extrair à mão.

Assim nada some sem ninguém ter visto. É uma recomendação (§11, pergunta 1).

---

## 5. Os dados do imóvel (para o 3D sair sozinho)

O caminho automático pela planta ([m2-worker.md](m2-worker.md), M2-R) chama o `e2e_leitura`, que
recusa gerar sem estes dados. São os campos que ele já confere hoje (`pipeline/e2e_leitura.py`,
`unidade()`; exemplo em `tests/fixtures/m1f/contexto-sintetico.json`):

| Campo | O que é | De onde costuma vir |
|---|---|---|
| `ficha` | título, empreendimento, bairro, município, venda/aluguel, quartos, suítes, banheiros, vagas | formulário, XML do anúncio, memorial |
| `andar` | o andar da unidade (0 = térreo) | formulário, IFC |
| `lote` | onde fica no mapa: ponto, rumo da frente e, no apartamento, o prédio (largura, profundidade, pavimentos) | endereço (§6), IFC, CAD, o prédio no próprio mapa |
| `cores` | parede, piso frio, piso de madeira, teto (opcional) | cores dominantes das fotos |
| `moveis` | móveis já posicionados (opcional) | a equipe |

**Três camadas:**

1. **Informado:** o formulário da solicitação, com o que a agência sabe (ficha, andar, endereço).
2. **Extraído:** os achados do robô (§4).
3. **Fixado** (`productionContext` = `{ dados, sha256, fixedBy, fixedAt }`, com AuditLog interno
   no mesmo batch, igual ao `productionInput` da planta). É o único que o robô usa para gerar.

**Quem fixa:**

- **o robô, sozinho**, quando:
  - os campos obrigatórios estão todos lá;
  - o informado e o extraído **não brigam**;
  - o endereço virou lote com confiança alta (§6);
  - o conjunto passa na validação do `e2e_leitura`;
- **a equipe**, em qualquer outro caso. O pedido vai para "Revisão interna" com a lista do que
  brigou ou faltou, por exemplo "o XML diz 3 quartos, o formulário diz 2" ou "faltam os
  pavimentos do prédio". A equipe escolhe, completa e fixa.

Fixar de novo (com dado novo) dispara uma prévia nova, como uma planta nova.

---

## 6. Endereço → lote → mapa, automático

Decisão do usuário (20/10): "teria que ser automatizado, já que quando recebemos os dados,
recebemos o endereço."

**Só São Carlos.** É a única cidade do mapa na versão atual. Endereço de outra cidade dá
`CIDADE_FORA_DO_MAPA`, e o pedido vai para a equipe.

**Do endereço ao ponto**, nesta ordem, parando na primeira que der certo:

| # | Fonte | Confiança | Observação |
|---|---|---|---|
| 1 | **CNEFE**, rua + número, com o CEP conferindo | alta | 143.200 endereços de São Carlos. Usa só os níveis de coordenada 1 a 3 (os de endereço; 4 e 5 são quadra e bairro) |
| 2 | **Estimativa na mesma rua:** entre os dois números vizinhos do mesmo lado (par/ímpar) que o CNEFE tem | média | só **entre** dois números conhecidos; número além do último conhecido não se estima |
| 3 | **GPS das fotos** (EXIF), como segunda opinião | média | só confirma ou desconfia de 1 e 2; sozinho não decide |
| 4 | **A equipe marca no mapa** (um alfinete na tela do pedido) | — | quando nada acima deu certo, ou as fontes discordam por mais de ~60 m (`ENDERECO_NAO_ENCONTRADO`) |

**Do ponto ao lote:**

- o lote é o da grade de São Carlos que contém o ponto, com a tolerância de 8 m: o ponto do CNEFE
  é coletado na calçada, a ~3 m do lote;
- o **rumo da frente** sai da frente do lote (a grade já guarda a normal);
- num apartamento, o **prédio** vem do IFC/CAD, se houver, ou da edificação do mapa que está
  naquele ponto, com confiança média.

O resultado vai para o `lote` dos dados do imóvel: `{ lat, lon, rumo_graus, loteId, fonte,
confianca, confirmado }`. É o mesmo formato que o Cedros já tem no `unidade.json`.

**Caso real que mostra por que o alfinete existe** (`plantas_fornecidas/monte-dos-cedros-37`):

- o Cedros é lançamento da MRV;
- no CNEFE de 2022, a avenida só tinha os números 461 e 691. O 1099 fica **depois** do último
  número conhecido, e aí nem a estimativa entre vizinhos serve (seria chute para fora da
  régua);
- o ponto foi achado à mão: o marcador do site da MRV e o de um agregador concordaram a 35 m um
  do outro, e o lado da avenida saiu da imagem de satélite.

O caminho automático daria o passo 4: a equipe põe o alfinete, uma vez, e o resto segue sozinho.
Também por isso o rumo tem uma segunda fonte. Sem lote na grade (terreno vazio, lançamento), ele
sai do **eixo da rua** no grafo do próprio mapa, como foi feito no Cedros (173,9°).

**"Implementar no mapa":** o build do imóvel (M2-R) recorta o mapa da cidade em volta desse
ponto e põe a casa no lote. O dado da cidade no git não muda. Mostrar o imóvel também como um
ponto no mapa geral da cidade é outro passo (§11, pergunta 4).

**Peça nova:** um índice de endereços de São Carlos tirado do CNEFE com rua, número, CEP e
coordenada, gerado uma vez e versionado. O tamanho tem de caber na trava do git
(`test_tamanho_versionado`).

---

## 7. A revisão do gerente: texto, fotos e áudio

Decisão do usuário (20/10): na imobiliária, o fluxo é direto até o gerente. Se ele pedir
revisão, o pedido volta para a equipe revisar à mão ([m2-worker.md](m2-worker.md) §1.1).

- **A tela:** o "Pedir ajuste" de hoje vira **"Pedir revisão"**, com:
  - **texto**, obrigatório;
  - **fotos**, opcionais; no celular, podem ser tiradas na hora;
  - **um áudio**, opcional, gravado no navegador (`MediaRecorder`), até 5 min.
- **Para onde vai:** `agency_review → internal_review` (hoje vai para `production`). A equipe é
  avisada no painel.
- **O que fica**, pela regra do "extrai e apaga":
  - o texto, no AuditLog da mudança de status;
  - o áudio, **virado texto**;
  - as fotos, **em cópia reduzida**.

  Os originais saem como os outros materiais. A equipe lê o texto, lê o áudio transcrito e vê
  as fotos.
- **Regras:**
  - `managerDecision` aceita o novo destino;
  - o gerente só sobe material marcado `revisao` com o pedido em `agency_review`.
- **Sem o Blaze:** a revisão funciona só com texto.

---

## 8. Segurança e privacidade

Agora o robô **abre** arquivos sozinho, então os limites deixam de ser "para depois":

- **todo arquivo é não confiável:** nada é executado, macro nenhuma roda, e os extratores só
  leem dados;
- **compactado:**
  - teto do total descompactado (por exemplo 4 GB) e do número de arquivos (por exemplo 2.000);
  - nenhum caminho que saia da pasta (`../`, caminho absoluto);
  - zip dentro de zip só até 2 níveis;
- **imagem:** o `Pillow` recusa a "bomba de pixels" (imagem pequena em disco que vira gigante na
  memória);
- **tempo:** cada extrator tem prazo. Estourou: "não processado";
- **máquina descartável:** o robô roda numa máquina do GitHub que é apagada no fim. Nada fica lá;
- **registro público:** a lista das execuções do Actions é pública. O robô não imprime nome de
  arquivo, endereço nem nada extraído, só ids e códigos ([m2-worker.md](m2-worker.md) §11);
- **isolamento:** uma agência nunca vê material de outra (regra de hoje, teste 17);
- **dado pessoal:**
  - apagar o original logo é o melhor para a lei de dados (guardar o mínimo pelo menor tempo);
  - o recibo prova o que chegou e quando saiu;
  - o processamento acontece nos EUA (bucket do Google e máquina do GitHub). Isso deve constar
    no termo de uso com as imobiliárias.

---

## 9. Custo

Pela página de preços do Firebase, conferida em 20/10:

- Storage exige o Blaze;
- a cota grátis vale em `us-east1`: 5 GB guardados, 100 GB baixados, 5 mil uploads e 50 mil
  downloads por mês;
- acima disso, ~US$ 0,02 por GB por mês.

| Item | Uso | Custo |
|---|---|---|
| Guardar | o original fica minutos (até a vez dele na fila); o extraído e as imagens leves ficam até o pedido terminar | **zero** na prática |
| Baixar | o robô baixa cada original uma vez; 100 pedidos com ~300 MB = ~30 GB por mês | **zero** (cota de 100 GB) |
| Extrair | máquina do GitHub, de graça no repositório público | **zero** |
| IA (se ligar) | por arquivo, a medir | a decidir |

Proteção: o alerta de orçamento do Blaze (o mesmo do [`deploy/README.md`](../../deploy/README.md)).

---

## 10. Incrementos

Cada um é um PR pequeno, com teste no emulador (`firebase emulators:exec --only
auth,firestore,storage`, o mesmo padrão de `npm run test:regras`).

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **MAT-1** | **Regras.**<br>• Storage: 2 GB; recusa de executáveis pelo nome e pelo tipo; nome com id aleatório; a agência sobe só em "Recebida"/"Aguardando materiais"; `revisao` só pelo gerente em `agency_review`; `derivado-*` só pelo robô.<br>• Firestore: grupos e estados em `requestAssets` | `regras.test.mjs`:<br>• `.dwg` de 1,9 GB entra;<br>• `.exe`, `.js`, `.svg` e `.html` são recusados, inclusive com o tipo mentido;<br>• acima de 2 GB é recusado;<br>• outra agência não lê nem sobe;<br>• sobrescrever é recusado;<br>• a agência não sobe depois de "Aceita" | testes verdes, cada regra quebrada de propósito pega |
| **MAT-2** | **Área "Materiais" no pedido.** Arrastar e soltar, upload retomável com progresso, lista com o estado de cada arquivo e o recibo | testes do painel: a agência sobe nas etapas dela; o upload interrompido continua; o estado acompanha o arquivo | testes verdes; conferido no `painel:dev` |
| **MAT-3** | **Dados informados** no formulário da solicitação, e o `requesterEdit` aceitando o campo | regras e painel: a agência edita só nas etapas dela; só os campos da §5 | testes verdes |
| **MAT-4** | **A fila de extração**, com os extratores simples: compactado, imagem, PDF, XML, áudio | no emulador:<br>• o arquivo processado some do Storage e deixa o extraído e o recibo;<br>• dois arquivos nunca são processados ao mesmo tempo;<br>• arquivo corrompido fica e vai para a equipe;<br>• zip-bomba e `../` são recusados;<br>• nada extraído aparece na saída do robô | testes verdes |
| **MAT-5** | **Endereço → lote**: o índice do CNEFE, a estimativa na rua, o lote, o rumo e o alfinete da equipe | endereços reais de São Carlos com ponto conhecido; um número entre dois conhecidos cai na estimativa; o 1099 do Cedros (além do último conhecido) vai para o alfinete; fontes que discordam vão para a equipe; outra cidade dá `CIDADE_FORA_DO_MAPA` | testes verdes, com a distância medida contra os pontos conhecidos |
| **MAT-6** | **Dados fixados** (`productionContext`), pelo robô quando tudo bate e pela equipe no resto, validados pelas regras do `e2e_leitura` | regras no padrão do `productionInputSet`; robô não fixa com briga ou falta; o pedido vai para a revisão interna com a lista | testes verdes; é o que o M2-R consome |
| **MAT-7** | **"Pedir revisão" com fotos e áudio**, com a transcrição | painel: grava o áudio, sobe as fotos, leva a `internal_review`; a equipe lê a transcrição e vê as fotos reduzidas | testes verdes |
| **MAT-8** | **Extratores de projeto:** IFC e DXF; depois DWG, vídeo e, se decidido, IA | um arquivo real de cada formato, com o que deveria sair anotado à mão | cada extrator acerta o arquivo de referência |
| **MAT-9** | **Ligar de verdade:** Blaze, bucket em `us-east1`, deploy das regras do Storage. Cada passo em produção, com autorização | subir um arquivo de teste pela tela e ver o recibo de "processado e apagado" | um pedido real com materiais |

MAT-1 a MAT-8 rodam inteiros no emulador, sem o Blaze. Só o MAT-9 precisa dele.

---

## 11. Decisões e perguntas

**Decididas em 20/10:**

1. **Bucket nos EUA** (`us-east1`).
2. **Um arquivo por vez; o original sai logo depois da extração.** Fica só o extraído.
3. **As maquetes ficam**, por um tempo a confirmar.
4. **Endereço → lote → mapa, automático** (§6).

**Ainda em aberto:**

1. **Arquivo que o robô não consegue ler** (DWG no começo, nuvem de pontos, formato
   desconhecido, arquivo corrompido). A recomendação é **guardar até a equipe olhar**. Apagar
   na hora faria o arquivo sumir sem ninguém ter visto. Pode ser assim?
2. **As imagens leves contam como "informação extraída"?** São a página da planta, as fotos
   reduzidas e os quadros do vídeo. A proposta é que fiquem até o pedido terminar. Sem elas, a
   equipe não tem o que olhar para desenhar a planta, e as fotos da revisão do gerente
   sumiriam.
3. **Por quanto tempo as maquetes ficam?** No ar, ficam enquanto o imóvel está publicado. As
   prévias somem sozinhas em 30 dias.
4. **O imóvel aparece também como ponto no mapa geral da cidade**, além do tour dele?
5. **Ligar a IA para ler memorial e fotos?** Ela acha mais coisa que os leitores comuns, custa
   por arquivo e manda o conteúdo para o fornecedor da IA.
