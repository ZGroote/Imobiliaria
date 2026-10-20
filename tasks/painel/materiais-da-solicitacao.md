# Materiais da solicitação (especificação)

Proposta de 20/10/2026. **Só documento: nada implementado, nada no ar.** Escrita sobre a pilha
#86→#91 (`feat/cloud-run-preparo`, `dc3e121`), junto com a do [worker do M2](m2-worker.md).

Pedido do usuário (20/10): "a ideia é que nós recebamos esses dados junto com a solicitação.
Então planeje um espaço que permita todo tipo de entrada de dados como zip, xml, cad, png e tudo
que envolva construção." Na mesma conversa, ele decidiu que o gerente pede revisão "com um campo
explicativo com envio de fotos, texto e áudio" ([m2-worker.md](m2-worker.md) §1.1).

---

## 0. Resumo

1. **Um espaço de materiais em cada solicitação**, onde a imobiliária, a construtora e a equipe
   sobem qualquer arquivo de obra: planta em CAD, BIM, PDF, fotos, vídeos, áudio, nuvem de
   pontos, zip. Arquivo de até 2 GB cada, com upload que continua de onde parou se a conexão
   cair.
2. **Recusado de propósito:** só o que executa ou roda no navegador (`.exe`, `.bat`, `.js`,
   `.html`, `.svg` e parecidos). Quem precisar mandar um desses manda dentro de um `.zip`.
3. **Ninguém abre nada sozinho.** O robô não lê os arquivos, e o zip não é descompactado
   automaticamente. A equipe olha os materiais e desenha a planta no capturador. Ler os arquivos
   automaticamente (ou por IA) fica para depois, com limites próprios (§6).
4. **Os dados do imóvel** que o 3D precisa (ficha, andar, prédio, cores) chegam num formulário da
   própria solicitação (§4). A equipe confere e **fixa** esses dados, como já fixa a planta. O
   robô usa só o que foi fixado.
5. **A revisão do gerente** usa o mesmo espaço: texto, fotos e um áudio gravado na hora, todos
   presos ao pedido (§5).
6. **Depende do plano Blaze.** Arquivo mora no Storage, e desde 30/10/2024 o Firebase só cria
   bucket novo no Blaze. Sem ele, só o texto funciona em produção. Tudo se testa no emulador
   antes.
7. **Custo:** 5 GB grátis num bucket em `us-east1`; acima disso, ~US$ 0,02 por GB por mês
   (§7).

---

## 1. O que já existe

- **Regras do Storage** ([`firebase/storage.rules`](../../firebase/storage.rules)), escritas na
  T03 e testadas só no emulador:
  - caminho `request-assets/{agencyId}/{requestId}/{arquivo}`;
  - lê a equipe e a própria agência;
  - cria quem é da equipe ou da agência do pedido;
  - nunca sobrescreve: reenviar é arquivo novo;
  - **até 200 MB** por arquivo;
  - HTML, SVG e XHTML negados;
  - só a equipe apaga;
  - nenhum outro caminho existe.
- **Coleção `requestAssets`** nas regras do Firestore. O documento aponta o arquivo
  (`storagePath`) e é do mesmo pedido e da mesma agência. Os tipos são `photo`, `video`,
  `floorplan`, `document`, `reference` e `other`.
- **O que não existe:**
  - o bucket: o projeto não tem um (proposta, D9);
  - a tela: o formulário "Nova solicitação" não tem upload;
  - o tipo `RequestAsset` em `painel/src/lib/types.ts`;
  - qualquer campo de dados do imóvel no pedido.

A base está certa: isolamento por agência, nada sobrescrito e nada que rode no navegador. O que
muda é o tamanho, a lista do que entra e a tela.

---

## 2. O que entra

| Grupo | Exemplos de extensão | Para quê |
|---|---|---|
| Planta e projeto (CAD/BIM) | `.dwg` `.dxf` `.dwf` `.dgn` `.ifc` `.rvt` `.rfa` `.skp` `.pln` `.3dm` | planta oficial, cortes, fachadas |
| Modelo 3D | `.obj` `.fbx` `.glb` `.gltf` `.stl` `.dae` `.3ds` `.blend` `.usdz` | modelo da construtora ou do arquiteto |
| Nuvem de pontos e escaneamento | `.e57` `.las` `.laz` `.ply` `.pts` `.xyz` `.rcp` | levantamento do imóvel |
| Imagem | `.png` `.jpg` `.jpeg` `.heic` `.webp` `.tif` `.tiff` `.bmp` | fotos, renders, planta escaneada |
| Documento e dados | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.odt` `.ods` `.csv` `.txt` `.xml` `.json` | memorial descritivo, tabela de áreas, tabela de vendas |
| Mapa e terreno | `.kml` `.kmz` `.geojson` `.shp` (dentro de zip) | localização, lote |
| Vídeo | `.mp4` `.mov` `.webm` | visita gravada |
| Áudio | `.m4a` `.mp3` `.ogg` `.wav` `.webm` | explicação falada, revisão do gerente |
| Compactado | `.zip` `.rar` `.7z` | pacotes do escritório de arquitetura |

**A lista não é fechada.** Um formato de obra que não está aqui entra como "outro". A regra
recusa **só** o que é perigoso de abrir:

- **o que executa:** `.exe` `.msi` `.bat` `.cmd` `.com` `.scr` `.ps1` `.vbs` `.js` `.jar` `.sh`
  `.app` `.dmg` `.apk` `.lnk` `.reg` `.hta`;
- **o que roda no navegador**, como hoje: HTML, SVG e XHTML. A planta em SVG vai dentro de um zip
  ou como PDF.

A regra confere duas coisas, porque o navegador pode mentir o tipo: o **final do nome** do
arquivo e o tipo declarado. A forma exata da expressão é conferida no emulador do Storage no
MAT-1.

**Tamanho:**
- **até 2 GB por arquivo** (hoje são 200 MB). Uma nuvem de pontos ou um vídeo passam de 200 MB
  fácil;
- o upload é **retomável** (`uploadBytesResumable`): se a conexão cair, continua de onde parou,
  e a tela mostra o progresso;
- não há limite por pedido nas regras, porque o Storage confere um arquivo de cada vez. A tela
  mostra o total do pedido, e o alerta de orçamento do Blaze avisa se o total disparar.

**Categoria:** sai da extensão, automaticamente, só para a tela agrupar e mostrar o ícone. A
pessoa não escolhe. Os tipos de `requestAssets` viram os grupos da tabela, mais `revisao` (§5)
e `outro`.

---

## 3. Como o arquivo entra

1. Na solicitação (nova ou já aberta), a área **"Materiais"** aceita arrastar arquivos ou
   escolher do computador. No celular, também tirar foto na hora.
2. Cada arquivo sobe para `request-assets/{agencyId}/{requestId}/{id}-{nome}`. O `{id}` é
   aleatório, para dois arquivos com o mesmo nome não se chocarem, já que sobrescrever é
   proibido.
3. Ao terminar, o painel grava o `requestAssets/{id}` com nome, grupo, tamanho, quem subiu e
   quando. O `md5` vem do próprio Storage, sem calcular nada no navegador.
4. **Quem sobe:**
   - a agência, enquanto o pedido está em "Recebida" ou "Aguardando materiais" (o mesmo período
     em que ela edita o pedido hoje);
   - a equipe, em qualquer etapa;
   - o gerente, também no pedido de revisão (§5).
5. **Quem vê e baixa:** a equipe e a própria agência, como hoje. O download sai sempre como
   anexo, do domínio do Google, nunca aberto dentro do painel.
6. **Quem apaga:** só a equipe, como hoje. Apagar tira o arquivo e o registro; o AuditLog
   guarda que existiu.

O aviso "Aguardando materiais" passa a ter para onde mandar a pessoa: a área de materiais do
próprio pedido.

---

## 4. Os dados do imóvel (para o 3D sair sozinho)

O caminho automático pela planta ([m2-worker.md](m2-worker.md), M2-R) chama o `e2e_leitura`. Ele
recusa gerar sem um **contexto** que não está na planta. Os campos são os que o próprio programa
confere hoje (`pipeline/e2e_leitura.py`, `unidade()`, e o exemplo em
`tests/fixtures/m1f/contexto-sintetico.json`):

| Campo | O que é | Quem costuma saber |
|---|---|---|
| `ficha` | título, empreendimento, bairro, município, venda/aluguel, quartos, suítes, banheiros, vagas | a imobiliária ou a construtora |
| `andar` | o andar da unidade (0 = térreo) | a imobiliária ou a construtora |
| `lote.predio` | largura e profundidade do prédio, em metros, e quantos pavimentos | a construtora, ou a equipe pelo CAD |
| `cores` | parede, piso frio, piso de madeira, teto (`#RRGGBB`) | a equipe, pelas fotos (opcional) |
| `moveis` | móveis já posicionados (opcional) | a equipe |

Além deles, o tour precisa saber **onde o imóvel fica no mapa**: endereço e, se possível, um
ponto marcado no mapa. Como esse endereço vira o lote no mapa é a pergunta aberta do M2-R.

**Em duas camadas, como a planta:**

1. **O que a imobiliária informa**: um formulário na solicitação, com os campos que ela sabe
   (ficha, andar, endereço, pavimentos). Fica no pedido como `informado` e é editável nas mesmas
   etapas em que ela edita o pedido hoje. As regras do `requesterEdit` passam a aceitar esse
   campo.
2. **O que a equipe fixa** para produzir: em "Em produção", a equipe confere o informado,
   completa o que falta (prédio, cores) olhando os materiais e **fixa** o contexto. Ele vira
   `productionContext` = `{ dados, sha256, fixedBy, fixedAt }`, com AuditLog interno no mesmo
   batch, igual ao `productionInput` da planta (M1-E). Fixou, não muda em silêncio: mudar é
   fixar de novo, e isso dispara uma prévia nova.

O robô usa **só** o `productionContext` fixado e confere o `sha256`. Contexto que não passa na
validação do `e2e_leitura` vira `CONTEXT_INVALID`, e o pedido vai para a revisão interna com o
motivo.

---

## 5. A revisão do gerente: texto, fotos e áudio

Decisão do usuário (20/10): na imobiliária, o fluxo é direto até o gerente. Se ele pedir
revisão, o pedido volta para a equipe revisar à mão ([m2-worker.md](m2-worker.md) §1.1).

- **A tela:** o "Pedir ajuste" de hoje vira **"Pedir revisão"**, com:
  - **texto**, obrigatório, como hoje: o que está errado;
  - **fotos**, opcionais. No celular, podem ser tiradas na hora, por exemplo do imóvel real;
  - **um áudio**, opcional, gravado no próprio navegador (`MediaRecorder`), até 5 min. O
    navegador grava em `webm` (Chrome) ou `mp4` (Safari), e os dois entram na lista.
- **Onde mora:**
  - fotos e áudio sobem como materiais do pedido, com o grupo `revisao` e o id da revisão;
  - o texto e a lista dos anexos vão no AuditLog da mudança de status, que já é visível à
    agência e à equipe.

  Não há coleção nova.
- **Para onde vai:** `agency_review → internal_review` (hoje vai para `production`). A equipe é
  avisada no painel, como no aviso de pedido novo.
- **Regras:**
  - `managerDecision` aceita o novo destino;
  - os anexos usam a regra de criação de materiais, que já deixa a agência subir para o próprio
    pedido;
  - a regra nova só deixa o gerente subir material com grupo `revisao` quando o pedido está em
    `agency_review`.
- **Sem o Blaze:** a revisão funciona só com texto. As fotos e o áudio ligam junto com o bucket.

---

## 6. Segurança e privacidade

- **Todo arquivo que chega é não confiável.** O robô não abre, e o servidor não descompacta.
- **Quem abre na equipe** abre com o programa certo e com macro desligada (Office, `.blend` com
  "Auto Run Python Scripts" desligado, que é o padrão do Blender).
- **Ler automaticamente fica para depois** (extrair zip, ler CAD, um agente de IA olhar
  materiais). Vai com limites:
  - tamanho total descompactado;
  - número de arquivos;
  - nenhum caminho que saia da pasta (`../`);
  - nada executado;
  - numa máquina descartável, como a do robô.

  Antivírus no upload também fica para depois (YAGNI); a recusa de executáveis já corta o
  caminho mais comum.
- **Isolamento:** uma agência nunca vê material de outra (regra de hoje, teste 17).
- **Dado pessoal:** materiais podem trazer nome de proprietário, documento ou foto de pessoas.
  - Só a equipe e a própria agência acessam.
  - O tempo de guarda é uma decisão (§9); até ela, nada se apaga sozinho.

---

## 7. Custo

Pela página de preços do Firebase, conferida em 20/10:

- Storage **exige o Blaze**;
- a cota grátis só vale em `us-central1`, `us-west1` e `us-east1`;
- ela é de **5 GB guardados, 100 GB baixados por mês, 5 mil uploads e 50 mil downloads por
  mês**;
- acima disso, o armazenamento padrão em `us-east1` custa ~**US$ 0,02 por GB por mês**.

| Exemplo | Total guardado | Custo por mês |
|---|---|---|
| 30 pedidos com ~150 MB (fotos + PDF + CAD) | ~4,5 GB | **zero** |
| 100 pedidos com ~200 MB | ~20 GB | ~US$ 0,30 |
| 100 pedidos, 10 deles com nuvem de pontos de 2 GB | ~38 GB | ~US$ 0,66 |

- **Local do bucket:** recomendo **`us-east1`**, pela cota grátis.
  - `southamerica-east1` fica mais perto de quem sobe, mas paga desde o primeiro GB.
  - O local **não muda depois**, então é decisão (§9).
  - O Firestore continua em São Paulo; os dois não precisam estar juntos.
- **Proteções:**
  - o alerta de orçamento do Blaze (o mesmo do [`deploy/README.md`](../../deploy/README.md));
  - o limite de 2 GB por arquivo.

---

## 8. Incrementos

Cada um é um PR pequeno, com teste no emulador (`firebase emulators:exec --only
auth,firestore,storage`, o mesmo padrão de `npm run test:regras`).

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **MAT-1** | **Regras.** Storage: 2 GB; recusa de executáveis pelo nome e pelo tipo; nome com id aleatório; a agência sobe só com o pedido em "Recebida" ou "Aguardando materiais" (hoje sobe em qualquer etapa); grupo `revisao` (no metadado do arquivo) só pelo gerente em `agency_review`. Firestore: grupos novos em `requestAssets` | `regras.test.mjs`:<br>• `.dwg` de 1,9 GB entra;<br>• `.exe`, `.js`, `.svg` e `.html` são recusados, inclusive com o tipo mentido;<br>• acima de 2 GB é recusado;<br>• outra agência não lê nem sobe;<br>• sobrescrever é recusado;<br>• gerente sobe `revisao` só em `agency_review` | testes verdes, cada regra quebrada de propósito pega |
| **MAT-2** | **Área "Materiais" no pedido.** Arrastar e soltar, upload retomável com progresso, lista agrupada, baixar, apagar (equipe) | testes do painel no emulador: a agência sobe em "Recebida" e não sobe depois de "Aceita"; a equipe sobe sempre; o upload interrompido continua | testes verdes; conferido no `painel:dev` |
| **MAT-3** | **Dados do imóvel informados** (`informado`) no formulário da solicitação, e o `requesterEdit` aceitando o campo | regras e painel: a agência edita só nas etapas dela; o campo só aceita os nomes da §4 | testes verdes |
| **MAT-4** | **"Pedir revisão" com fotos e áudio** (o texto já vem no M2-4) | painel: grava o áudio, sobe as fotos, leva a `internal_review` com o AuditLog listando os anexos; a equipe vê e ouve | testes verdes |
| **MAT-5** | **Contexto fixado** (`productionContext`) pela equipe, com o sha256 e o AuditLog, validado pelas mesmas regras do `e2e_leitura` | regras no padrão do `productionInputSet`; o robô recusa contexto com sha diferente | testes verdes; é o que o M2-R consome |
| **MAT-6** | **Ligar de verdade.** Blaze, bucket no local decidido, deploy das regras do Storage: cada passo em produção, com autorização | subir e baixar um arquivo de teste pela tela; conferir o isolamento com uma conta de outra agência | um pedido real com materiais |

MAT-1 a MAT-5 rodam inteiros no emulador, sem o Blaze. Só o MAT-6 precisa dele.

---

## 9. Perguntas para você decidir

1. **Local do bucket:** `us-east1`, com 5 GB grátis (recomendado), ou `southamerica-east1`,
   mais perto e pago desde o primeiro GB? Não muda depois.
2. **Tempo de guarda dos materiais:**
   - para sempre;
   - ou apagar (ou mover para armazenamento mais barato) um tempo depois de o imóvel ser
     publicado, por exemplo 12 meses?

   Isso pesa no custo e no dado pessoal guardado.
3. **2 GB por arquivo está bom?** Uma nuvem de pontos inteira pode passar disso; nesse caso, ela
   vai em partes ou por link externo.
