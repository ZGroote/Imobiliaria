# A IA que gerencia a criação (especificação)

Proposta de 20/10/2026. **Só documento: nada implementado, nada no ar.** Escrita sobre a pilha
#86→#91 (`feat/cloud-run-preparo`, `dc3e121`), junto com a do [robô do M2](m2-worker.md), a dos
[materiais da solicitação](materiais-da-solicitacao.md) e a do [plano e vagas no ar](plano-no-ar.md).

Pedido do usuário (20/10): "eu preciso que a IA gerencie a criação completa, porque se o fluxo
quebrar ela precisa estar pronta para interferir e avaliar a qualidade também. Veja quanto sai a
API e se seria melhor já fazer com o repositório fechado."

---

## 0. Resumo

1. **A IA vira a gerente da criação, dentro do robô.** Ela:
   - lê os materiais e junta os dados;
   - faz o rascunho da planta;
   - manda gerar;
   - olha o resultado e diz se presta;
   - quando algo quebra, diagnostica e tenta consertar dentro de limites;
   - se não conseguir, chama a equipe com o diagnóstico em português.
2. **Ela não tem mais poder que o robô.** Age só por uma lista fechada de ferramentas (§3), e as
   regras do banco valem para ela.
   - **Não aprova, não publica sem o gerente e não mexe em portão.**
3. **Modelo: Claude Opus 5.5, pela API.**
   - **~US$ 0,60 por pedido** quando dá certo de primeira, e ~US$ 1,20 com uma rodada de
     conserto;
   - 100 pedidos por mês: **~US$ 60 a 120** (§5).
4. **A IA própria (local) não serve para esse papel.** Ler planta e julgar a qualidade de uma
   imagem pede um modelo grande. A local fica, no máximo, para texto simples.
5. **Antes de decidir sozinha, ela trabalha "à sombra".** Nos primeiros pedidos, ela dá a nota e
   a equipe revisa do mesmo jeito. Só quando o acerto dela for medido e bom, ela passa a decidir
   (§4).
6. **O repositório foi fechado em 20/10**, com o ok do usuário (§6).
   - Custo medido: zero a ~US$ 7 por mês até ~30 pedidos, e ~US$ 16 a 28 com 100;
   - o robô passa a ser acordado por evento, e não a cada 10 minutos.

---

## 1. O que a IA faz em cada etapa

O robô continua dono da ordem dos passos (§3). A IA decide **dentro** de cada passo. Assim o
custo e o comportamento ficam previsíveis.

| Etapa | O que a IA faz | Quando chama a equipe |
|---|---|---|
| **Materiais** ([materiais](materiais-da-solicitacao.md) §4) | os leitores comuns rodam primeiro (XML, IFC, DXF, texto do PDF, fotos). A IA lê o que eles não leem (memorial em texto livre, planta em imagem), junta os achados e aponta o que briga | arquivo que ninguém consegue ler; briga que ela não resolve com segurança |
| **Dados do imóvel** (materiais §5) | propõe os dados e fixa quando tudo bate, pela mesma regra de hoje | campo obrigatório faltando; briga entre formulário e arquivo |
| **Posição** (materiais §6) | confere o pino contra o endereço e as fotos | pino longe do endereço sem explicação |
| **Planta** | **rascunho da planta**: o `pipeline/extrair_planta.py` acha as paredes; a IA diz qual cômodo é qual e confere as áreas com os rótulos e a ficha. Salva como versão de leitura, pelo mesmo caminho e o mesmo portão M1-0 da tela, e **fixa** se a conferência fechar | área fora de ~5%, cômodo que não bate com a ficha, desenho ambíguo |
| **Prévia** | o robô gera e tira **fotos fixas** do tour e da maquete. A IA compara com a planta original e com as fotos do imóvel, pela lista de conferência (§4) | nota abaixo do mínimo depois de até 2 rodadas de conserto |
| **Falha em qualquer passo** | lê o código de erro e o registro do job e decide: tentar de novo, corrigir a entrada (por exemplo um campo dos dados) ou chamar a equipe | o que não for falha de entrada; 3 tentativas sem sucesso |
| **Revisão do gerente** | lê o texto, o áudio transcrito e as fotos, e escreve **uma proposta de correção** | sempre: a revisão do gerente vai para a equipe, como decidido. A equipe aceita a proposta com um clique, ou corrige à mão |

**O que muda na decisão anterior sobre a planta:** antes, a planta era sempre desenhada pela
equipe. Agora, **a IA faz o rascunho e fixa quando a conferência fecha**, e a equipe entra quando
ela tem dúvida. O capturador continua sendo a tela para corrigir.

---

## 2. O que a IA não faz

- **Não aprova** (só o gerente, pela regra `managerDecision`).
- **Não publica sem aprovação** e não reverte. Publicar depois da aprovação é do robô, pelos
  portões de sempre ([m2-worker.md](m2-worker.md) §13).
- **Não mexe em portão nem em regra.** Hash do manifest, `estado.json` relido, escopo do imóvel:
  tudo continua igual, e a IA não tem ferramenta para pular nenhum.
- **Não roda comando livre.** Ela não tem terminal, não escreve código e não grava no banco fora
  das ferramentas da §3.
- **Não fala com a imobiliária.** O que a imobiliária vê são os status e avisos do painel.
- **Não apaga material que não foi processado**, como já decidido.
- **Tem teto por pedido:** no máximo ~US$ 3 e 2 rodadas de conserto. Passou, a equipe assume.
- **Tudo o que ela decide vira registro interno** (AuditLog `ia:*`), com o porquê, para a equipe
  auditar.

---

## 3. Como funciona por dentro

- **Um roteiro com pontos de decisão, não um agente solto.** O robô segue os passos em ordem e,
  em cada um, chama a IA com uma pergunta fechada ("quais são os cômodos desta planta?", "esta
  prévia passa nesta lista?"). A resposta vem em formato fixo.
- **O único trecho em que ela age em ciclo é o diagnóstico de falha:** ela pode olhar o registro,
  pedir mais detalhe e então escolher uma das saídas. São no máximo ~10 voltas.
- **As ferramentas, lista fechada.** Cada uma é código do robô, que aplica as conferências e grava
  pelas regras como `users/worker`:

| Ferramenta | Faz |
|---|---|
| `ler_material(arquivo)` | devolve o texto/imagem leve de um material já processado |
| `achados_do_pedido()` | os achados de todos os materiais, com a origem |
| `propor_dados(dados)` / `fixar_dados()` | os dados do imóvel (fixa só se a regra deixar) |
| `paredes_da_planta(pagina)` | roda o `extrair_planta.py` |
| `salvar_planta(leitura)` / `fixar_planta(versao)` | nova versão de leitura, pelo portão M1-0; fixar segue a regra do `productionInput` |
| `gerar_previa()` | pede a prévia ao robô (o build e os portões são os de sempre) |
| `fotos_da_previa()` | as fotos fixas do tour e da maquete |
| `registrar_avaliacao(nota, itens)` | grava a nota e cada item da lista |
| `seguir()` | leva o pedido para o próximo status da política ([m2-worker.md](m2-worker.md) §1.2) |
| `chamar_equipe(motivo, diagnostico)` | revisão interna, com o texto da IA para a equipe |
| `tentar_de_novo(passo)` | dentro do teto |

- **A chave da Anthropic:** guardada como segredo do GitHub, ou nem existir, se a identidade
  federada da Anthropic aceitar o token do próprio GitHub (o mesmo esquema que o robô já usa com
  o Google). Conferir na configuração da conta.
- **Privacidade:** pela API, o conteúdo dos materiais vai para a Anthropic. Isso entra no termo
  de uso com as imobiliárias, junto com o Google e o GitHub
  ([materiais](materiais-da-solicitacao.md) §8).

---

## 4. Como a qualidade é medida

**A lista de conferência da prévia.** Parte é medida por programa e parte pela IA:

| Item | Quem mede |
|---|---|
| o build passou em todos os portões | programa |
| a maquete tem os cômodos e as aberturas da planta (a sonda do M1-F) | programa |
| a soma das áreas bate com a ficha (±5%) | programa |
| a casa está dentro do lote, virada para a rua | programa |
| nenhuma foto da prévia saiu preta, branca ou vazia | programa |
| a planta gerada parece a planta original (formato, posição dos cômodos, portas) | IA |
| a fachada e as cores lembram as fotos do imóvel | IA |
| nada estranho à vista: objeto flutuando, parede faltando, móvel atravessando parede | IA |
| "um comprador entenderia este imóvel olhando isto?" | IA |

**Calibrar antes de confiar.** Medida automática de imagem já errou neste projeto: houve portão
que fabricava o defeito que dizia achar. Por isso:

1. **Conjunto de referência:** prévias boas e ruins já conhecidas, cada uma com a nota que a
   equipe deu.
2. **Modo sombra:** nos primeiros pedidos reais (por exemplo 20), a IA dá a nota, mas a equipe
   revisa tudo do mesmo jeito. Anota-se onde ela acertou e onde errou.
3. **Ligar a decisão** só quando o acerto estiver medido e bom. O que conta mais é **nunca deixar
   passar uma prévia ruim**; mandar uma boa para a equipe à toa custa só tempo.

---

## 5. Quanto custa pela API

Preços da Anthropic por milhão de "tokens" (os pedacinhos de texto que a IA lê e escreve), da
tabela de 06/10/2026:

| Modelo | Lê | Escreve |
|---|---|---|
| Claude Opus 5.5 (o padrão) | US$ 4,00 | US$ 20,00 |
| Claude Sonnet 5.5 | US$ 2,00 | US$ 10,00 |
| Claude Haiku 5.5 | US$ 0,10 | US$ 0,50 |

**Premissas:**

- uma página de PDF conta ~1.500 a 3.000 tokens;
- uma imagem conta ~1.600 tokens;
- o que a IA pensa antes de responder conta como "escreve".

| Passo, por pedido | Lê | Escreve | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|---|---|
| Ler o memorial (10 páginas) | ~25 mil | ~4 mil | US$ 0,18 | US$ 0,09 | US$ 0,005 |
| Rascunho da planta (2 páginas + paredes + ficha) | ~14 mil | ~8 mil | US$ 0,22 | US$ 0,11 | US$ 0,005 |
| Avaliar a prévia (8 fotos + planta + 3 fotos do imóvel) | ~24 mil | ~6 mil | US$ 0,22 | US$ 0,11 | US$ 0,005 |
| **Pedido que dá certo de primeira** | ~63 mil | ~18 mil | **~US$ 0,60** | **~US$ 0,30** | ~US$ 0,015 |
| + uma rodada de conserto (planta + avaliação de novo) | ~38 mil | ~14 mil | +US$ 0,43 | +US$ 0,22 | +US$ 0,01 |
| + um diagnóstico de falha | ~15 mil | ~4 mil | +US$ 0,14 | +US$ 0,07 | +US$ 0,004 |

| Volume | Opus 5.5 em tudo | Haiku no memorial, Opus no resto |
|---|---|---|
| 10 pedidos por mês | ~US$ 6 a 12 | ~US$ 4 a 10 |
| 30 pedidos por mês | ~US$ 18 a 36 | ~US$ 13 a 31 |
| 100 pedidos por mês | ~US$ 60 a 120 | ~US$ 43 a 103 |

- **Por que o Opus é o padrão:** a planta e a avaliação da prévia são julgamentos difíceis, e
  errar ali custa mais que a diferença de preço. O Haiku só faz sentido para ler texto simples
  (o memorial), se você quiser economizar ali.
- **Sonnet, metade do preço:** dá para testar contra o Opus no modo sombra (§4) e decidir com
  os números.
- **As instruções fixas** (a lista de conferência e as ferramentas) ficam em cache e custam
  ~10% nas leituras seguintes. A economia é pequena e não entra nas contas acima.
- **Os números são estimativas.** O certo sai do modo sombra, com a conta real de 20 pedidos.

---

## 6. Repositório fechado (feito em 20/10)

**Fechado em 20/10/2026, com o ok do usuário.** Antes, foi conferido que:

- o repositório é da conta pessoal `ZGroote`;
- não havia proteção de branch nem regras do GitHub, que no plano gratuito deixariam de valer
  num repositório privado;
- não havia segredos;
- nada no código aponta para o endereço público.

Depois, o `git` e o Actions continuaram funcionando. O porquê e a conta ficam abaixo, como
registro.

**Por quê:**

- a IA vai ler os arquivos dos clientes e escrever diagnósticos. Num repositório público, o
  registro de cada execução do robô é público. Com uma IA escrevendo texto, garantir que nada do
  cliente apareça ali fica difícil;
- as instruções da IA, a lista de conferência e o pipeline são conhecimento do negócio;
- o que já foi público continua público para quem copiou. Fechar antes é melhor do que fechar
  depois;
- **nada quebra:**
  - nenhum código do projeto aponta para o repositório público;
  - não há GitHub Pages;
  - não há cópias (forks).

**Quanto custa** (o plano gratuito do GitHub dá 2.000 minutos por mês para repositório privado;
depois, US$ 0,006 por minuto):

| | Minutos por mês |
|---|---|
| CI de hoje (**medido**: 959 minutos cobráveis de 28/09 a 20/10, em 22 dias) | ~1.300 |
| Robô, por pedido (extração, duas montagens, prévia, fotos, publicação; **a medir**) | ~30 a 50 |
| Varredura de segurança a cada 2 h | ~360 |

| Pedidos por mês | Minutos no total | Passa da cota em | Custo por mês |
|---|---|---|---|
| 10 | ~2.000 a 2.200 | 0 a ~200 | ~US$ 0 a 1 |
| 30 | ~2.600 a 3.200 | ~600 a 1.200 | ~US$ 3 a 7 |
| 100 | ~4.700 a 6.700 | ~2.700 a 4.700 | ~US$ 16 a 28 |

- O plano Pro ou Team do GitHub dá 3.000 minutos em vez de 2.000 (preço por usuário, a
  conferir). Isso tira ~US$ 6 da conta.
- **Sem cartão no GitHub, ele trava** em vez de cobrar. Com cartão, dá para pôr um teto de gasto.

**O que muda junto:**

- **O gatilho vira evento.** Olhar a fila a cada 10 minutos gastaria ~4.300 minutos por mês
  sozinho. No lugar:
  - uma **função pequena no Firebase** acorda o robô no GitHub quando algo acontece: arquivo
    novo, pedido de trabalho, planta fixada, aprovação do gerente;
  - ela precisa do Blaze, que já é necessário para os arquivos;
  - ela usa um token do GitHub que **só sabe acordar este robô**, guardado no cofre de segredos
    do Google;
  - de bônus, acaba a espera de até 10 minutos.
- **A varredura de segurança fica a cada 2 h**, para pegar o que o evento perder.
- A regra "agendamento desligado depois de 60 dias sem atividade" deixa de valer: ela só vale
  para repositório público.

**Alternativa:** manter público e rodar só a IA fora do GitHub. Complica sem ganho; a diferença
de custo é de poucos dólares.

---

## 7. Incrementos

Cada um é um PR pequeno, com teste que não gasta dinheiro de IA por padrão: a IA é trocada por
uma resposta gravada. Os testes com a IA de verdade rodam à parte, com orçamento autorizado.

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **IA-1** | **Gatilho por evento** (o repositório já foi fechado em 20/10). Função que acorda o robô e varredura a cada 2 h. Ação em produção, com autorização | um pedido de trabalho no emulador acorda o robô; sem evento, só a varredura roda | o robô roda por evento; minutos do mês anotados |
| **IA-2** | **As ferramentas da §3**, sem IA: cada uma chamável por teste | no emulador: cada ferramenta respeita as regras como `users/worker`; nenhuma pula portão; o teto por pedido corta | testes verdes |
| **IA-3** | **Leitura de materiais e dados** com a IA | respostas gravadas; com IA de verdade, 20 pedidos de referência com o certo anotado à mão | acerto anotado aqui |
| **IA-4** | **Rascunho da planta** (paredes pelo `extrair_planta.py`, cômodos pela IA, portão M1-0) | plantas de referência com a leitura certa; erro de área e de cômodo medido | acerto anotado aqui |
| **IA-5** | **Avaliação da prévia**: fotos fixas, lista de conferência, **modo sombra** | o conjunto de prévias boas e ruins; nenhuma ruim pode passar | taxa de acerto e de "ruim que passou" anotadas |
| **IA-6** | **Diagnóstico de falha** e proposta para a revisão do gerente | falhas provocadas de propósito (cada código de erro da [m2-worker.md](m2-worker.md) §4) | cada falha termina em conserto certo ou equipe chamada com diagnóstico útil |
| **IA-7** | **Ligar a decisão** (sair do modo sombra), por etapa | os números do IA-5 | autorização sua, com os números na mão |

---

## 8. Perguntas para você decidir

1. ~~Fechar o repositório?~~ Fechado em 20/10 (§6).
2. **Modelo:** Opus 5.5 em tudo (recomendado), ou Haiku só no memorial?
3. **O teto por pedido** de ~US$ 3 e 2 rodadas de conserto está bom?
4. **Modo sombra:** 20 pedidos com a equipe revisando tudo antes de a IA decidir sozinha está
   bom?
