# M1.1-A — baseline de usabilidade em aparelho físico

**Estado: protocolo e ferramentas prontos; sessões pendentes.** As sessões são feitas por
pessoas, com telefone físico. Nada aqui foi medido ainda, e nenhum resultado deve ser
preenchido sem sessão real.

Base: `06bbcd6` (merge #81). Não se altera código do capturador, contrato M1-0/M1-A, portões
do M1-F nem o painel. A dívida do cartão "Escolher versão" com imóvel transferido fica para o
M1.1-B. Sem deploy e sem Firestore: o objeto é a captura, não a persistência.

## Perguntas

1. Uma pessoa entende o modelo sem treinamento técnico?
2. Consegue montar uma planta no celular sem brigar com toque, encaixe e aberturas?
3. Os dados reais que ela informa continuam válidos no M1-0 e no M1-A?
4. Quantas plantas reais esbarram nas limitações atuais do consumidor 3D?

## Preparação (uma vez)

1. Build estático do painel, onde o capturador é a página `/capturador`, sem Firebase:
   `cd painel && npm run build` (gera `painel/out/`).
2. Servir na rede: `python tools/servir_lan.py painel/out`. Ele imprime o endereço
   `https://<ip-do-pc>:8813/`. O telefone abre `https://<ip-do-pc>:8813/capturador`.
   - **Por que HTTPS.** O capturador usa `crypto.randomUUID`, que só existe em contexto
     seguro. Por HTTP no IP da rede ele nem abre ("This page couldn't load"), como
     verificado na preparação. Em produção o Hosting já é HTTPS. O certificado é
     autoassinado para o IP do PC, vale 7 dias e some quando o servidor para.
   - **Firewall.** Nesta máquina a rede está como *Pública*, e o Windows costuma barrar
     conexões de entrada nesse perfil. Na primeira execução ele pode pedir permissão para o
     Python. Permitir, ou marcar a rede como privada, é decisão de quem opera o PC: nenhuma
     ferramenta do estudo mexe nisso.
   - O telefone e o PC ficam na mesma rede. Se o roteador isolar os aparelhos, conecte o PC
     ao roteador do telefone e rode o servidor de novo, porque o IP muda.
3. **Checklist no telefone, antes de a pessoa chegar:**
   - abrir o endereço e aceitar o aviso de certificado (Android/Chrome: *Avançado →
     Continuar*; iPhone/Safari: *Mostrar detalhes → visitar este site*);
   - conferir que aparece **"Desenhe sua planta"**. Se aparecer "This page couldn't load", o
     navegador não tratou a página como contexto seguro: pare aqui e registre;
   - anotar modelo, sistema, versão e navegador;
   - **recarregar a página:** o capturador não guarda nada, e recarregar é a tela vazia.
4. O log do servidor registra IP e User-Agent de cada acesso. Guarde o trecho da sessão como
   prova de qual aparelho abriu a página.

## Casos

- **Cinco plantas reais**, distintas, sem usar a fixture sintética do M1-F. IDs anônimos
  `C1`…`C5`, e a origem descrita de forma genérica: "anúncio público", "planta técnica cedida
  pelo proprietário", "levantamento com trena", etc.
- **Convenção de cada medida da fonte:** livre (parede a parede), eixo de parede, externa,
  cota de projeto, trena/laser, ou "não indicada". O capturador pede medida entre eixos;
  saber se as fontes reais conseguem dar isso é uma das respostas do estudo.
- **Não arredondar.** Se a planta diz 3,43 m, digita-se 3,43 m. Se a pessoa arredondar por
  conta própria, anote e não corrija.
- **Privacidade.** Não versionar planta de origem (imagem, PDF), endereço, nome de
  proprietário ou anúncio identificável. O export fica em `publicacao/m1-1a/<caso>/`, que o
  git ignora. O checkpoint leva só ID anônimo, origem genérica, hashes e resultados.
  Versionar um export exige autorização explícita de quem cedeu a planta.

## Pessoas

- Pelo menos **duas** pessoas operam o capturador, e pelo menos **uma** não teve contato com a
  implementação nem com o capturador antes.
- Quem facilita não opera. Com apenas um facilitador, ele observa e anota; não toca no
  telefone durante a sessão.

## Roteiro da sessão

1. Pedir consentimento verbal para observar e, se a pessoa aceitar, gravar a tela do
   telefone (gravação nativa do Android/iOS). Gravação ajuda muito a contar toques perdidos.
2. Entregar o telefone já na tela vazia e a planta de origem, em papel ou em outra tela.
   Dizer só o objetivo: **"Reproduza esta planta neste aplicativo e, quando terminar,
   baixe o arquivo."** Não explicar botões, gestos nem a convenção de medida.
3. **Cronômetro:** começa no primeiro toque e para quando o download de
   "Baixar leitura.json" termina.
4. **Não conduzir.** Se a pessoa perguntar, anote a pergunta **literal** e o minuto **antes**
   de responder, e responda o mínimo. Se ela ficar mais de 3 min sem progresso, pergunte
   "o que você está tentando fazer?". Cada fala do facilitador que ajude a avançar conta
   como **uma intervenção**.
5. **Parada:** se a pessoa desiste, passa de 40 min, ou fica bloqueada por um problema que a
   impede de terminar, a sessão é *não concluída*. Registre a evidência e **pare o estudo**:
   não faça as outras sessões antes de decidir a correção.
6. Depois do download, levar o arquivo ao PC **sem abrir nem editar** (USB, Drive, e-mail ou
   AirDrop) para `publicacao/m1-1a/<caso>/leitura.json`.
7. Rodar a cadeia:
   `python -m pipeline.avaliar_captura publicacao/m1-1a/C1/leitura.json --caso C1`
   - O stdout é o registro JSON; salve-o como `publicacao/m1-1a/C1/cadeia.json`.
   - O stderr traz o resumo (M1-0, M1-A, M1-F, e quanto cada medida fora da grade erra) e a
     tabela de cômodos e aberturas em mm.
   - O `arquivo.sha256` identifica o export analisado.
   - Se o M1-F recusar (`FORA_DA_GRADE`, `VAO_ESTREITO`, encaixe ou outro), **registre a
     recusa e não corrija a planta**.
   - Encaixe no prédio só com contexto real (`--contexto`, formato do M1-F, com
     `lote.predio` da fonte). Sem prédio conhecido, fica "não avaliado": o estudo não inventa
     prédio.
8. **Fidelidade:** comparar a tabela do stderr com a fonte, cômodo a cômodo e abertura a
   abertura, e anotar cada diferença e sua causa provável (digitação, encaixe que moveu,
   arredondamento da pessoa, convenção de medida).

## Ficha da sessão (uma por caso)

| Medida | Registrar |
|---|---|
| Caso | ID anônimo + origem genérica da planta + convenção das medidas da fonte |
| Aparelho | modelo, SO e versão, navegador e viewport aproximado; trecho do log do servidor |
| Operador | familiar ou não com a ferramenta; já viu o capturador? |
| Complexidade | nº de cômodos, portas e janelas (o `avaliar_captura` confirma pelo export) |
| Tempo total | tela vazia → JSON exportado (mm:ss) |
| Intervenções | quantas, e o que foi dito em cada uma |
| Toque | seleção perdida, arraste ruim, rolagem ou zoom acidental (contagem + momento) |
| Encaixe | encaixes errados, correções, dificuldade percebida |
| Aberturas | dificuldade para escolher parede, deslocamento e edição |
| Correção | uso de desfazer/refazer e erros recuperados |
| Validação | M1-0 e M1-A (resultado do `avaliar_captura`) |
| Consumidor | resultado do M1-F; código e caminho exatos de cada recusa |
| Fidelidade | diferenças entre a fonte e o JSON exportado, com causa |
| Observação | onde hesitou, perguntas literais com o minuto |

## Smoke físico do 3D (pelo menos um)

1. Escolher um caso aceito pelo M1-F e gerar a maquete com contexto declarado:
   `python -m pipeline.avaliar_captura publicacao/m1-1a/C1/leitura.json --caso C1
   --contexto <contexto.json> --destino publicacao/m1-1a/C1/maquete`.
   Sem prédio real conhecido, o contexto é "de estudo" e **registrado como tal**: serve só
   para abrir a maquete e não para avaliar encaixe.
2. `python tools/servir_lan.py publicacao/m1-1a/C1/maquete --porta 8814`, e abrir
   `https://<ip-do-pc>:8814/maquete` no **mesmo telefone**.
3. Passar por Prédio, Planta 2D, Planta 3D e Visita 3D, e **atravessar pelo menos uma porta**
   na visita. Tirar captura de tela de cada etapa.
4. Se nenhum caso passar pelo M1-F, isso já é resultado. O smoke então usa o artefato
   sintético do M1-F, e o checkpoint diz isso.

## Descobertas que interrompem o estudo

- **UX grave:** alguém não consegue concluir. Pare e traga a evidência.
- **Descoberta arquitetural:** por exemplo, ninguém consegue informar medida entre eixos, ou
  3 das 5 plantas caem em `FORA_DA_GRADE`. Isso volta para decisão de fronteira
  (contrato × consumidor); não se esconde na interface.

## Gate do M1.1-A

- cinco sessões documentadas na ficha acima;
- telefone físico comprovado (modelo, log do servidor, capturas);
- pelo menos um operador alheio à implementação;
- 5/5 exports passando no M1-0 e no M1-A sem edição de JSON;
- tempos e intervenções registrados;
- todos os resultados do M1-F categorizados, inclusive as recusas;
- smoke físico do 3D feito.

Não há meta de tempo: seria inventar KPI antes dos dados.

## Achados da preparação (não são sessões)

- **Contexto seguro obrigatório.** Servido por HTTP no IP da rede, o capturador não abre:
  `crypto.randomUUID` não existe fora de contexto seguro, e a página cai em "This page
  couldn't load". Em produção (HTTPS) não acontece; para o estudo, a solução é o servidor
  HTTPS.
- **Hidratação (React #418) ao abrir por `/capturador.html`.** Some com a URL limpa
  `/capturador`, que é o que o Hosting (`cleanUrls`) e o `servir_lan.py` servem.

## Ferramentas

- [`tools/servir_lan.py`](../../tools/servir_lan.py): HTTPS na LAN, URL limpa, só leitura,
  log com User-Agent.
- [`pipeline/avaliar_captura.py`](../../pipeline/avaliar_captura.py): export → M1-0 → M1-A →
  portões do M1-F (e encaixe/maquete com contexto). É harness do estudo, **não** caminho de
  entrada: o caminho confiável continua sendo o par fixado em `pipeline.e2e_leitura`.
