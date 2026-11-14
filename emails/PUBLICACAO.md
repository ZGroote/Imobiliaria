# Ativação do Resend — 23/10/2026

O usuário autorizou salvar os cinco registros DNS, criar a chave `painel-convites`
somente de envio e restrita a `conectaimoveis3d.com.br`, e armazená-la no
Secret Manager do Firebase. Não pedir essa autorização novamente para as mesmas ações.

## Concluído

- Domínio adicionado ao Resend em São Paulo: `a339a1b0-9cd4-44ab-8623-d7955c1e6084`.
- Cinco registros de `dns.json` salvos no Registro.br às 18h31; conferidos no DNS
  público. Registros de Hosting, HTTPS e SPF da raiz preservados.
- Domínio verificado pelo Resend para envio e recebimento às 18h43 de São Paulo.
- Três Inboxes criadas: `avisos@`, `contato@` e `diretoria@`, sem agentes automáticos.
- Chave `painel-convites` criada com **Sending access**, restrita ao domínio.
  O valor não foi gravado no código, no git ou na conversa.
- Teste real às 18h54: `avisos@` enviou para `contato@` e `diretoria@`; a chegada
  foi conferida nas duas caixas. Às 18h57, `contato@` respondeu e a resposta
  chegou em `avisos@`. Assunto: `Teste interno de e-mail — Conecta 3D — 23/10/2026`.
  Conversa no Resend: `bfd84ba6-f746-4a20-b0db-dbc583d84d45`.
- Conta `conecta-emails@imobilaria-deccb.iam.gserviceaccount.com` criada com
  `roles/datastore.user` e `roles/eventarc.eventReceiver` no projeto.
  `roles/run.invoker` concedido somente no serviço `enviarconvitepainel`.
  Invocação pública desabilitada. Acesso somente ao segredo `RESEND_API_KEY`
  configurado nesse recurso, sem permissão de leitura dos outros segredos.
- Segredo `RESEND_API_KEY`, versão `1`, habilitado no projeto `163406298617`.
  A transferência usou o arquivo temporário autorizado explicitamente pelo
  usuário; o arquivo foi apagado no bloco de limpeza e sua ausência conferida.
- Regras publicadas: `projects/imobilaria-deccb/rulesets/5a663b7b-e06b-4626-9af3-815f21b0b916`.
  SHA-256 normalizado: `a184d2c855d20acedd99d5a02e3e07fafb5cf6f0dd8568a6fbac102f1f289846`.
  Relidas e iguais ao arquivo local testado.
- Painel publicado: `sites/imobilaria-deccb-painel/versions/08d921d67e55980a`,
  em 23/10 às 18h35 de São Paulo. `/team` conferido no ar com `emailDelivery`
  e a orientação para acompanhar o envio.
- Função `enviarConvitePainel` publicada e conferida como `ACTIVE`, Node.js 22,
  região `southamerica-east1`, codebase `emails`.
  Revisão atual: `enviarconvitepainel-00005-hef`. Usa a versão `1` do segredo.
  Gatilho: `enviarconvitepainel-202649`, em `invites/{email}`.
- Convite real de teste para `contato@` aceito às 21h48 de 23/10 (São Paulo):
  mensagem `01a16b61-06de-797c-8adb-a586218b4394`.
  Recebimento e link do painel conferidos na própria Inbox, conversa
  `b7b6a05f-7cf0-4d77-a716-7aec28a3b08e`. O convite foi cancelado às 21h49
  após a validação, com condição de geração/versão para preservar alterações
  concorrentes. Nenhum usuário foi criado ou alterado.
- 61 testes passaram (4 unitários + 57 no emulador). TypeScript passou. Build
  de 26 páginas aprovado com `--webpack`; Turbopack falhou no subprocesso CSS.
  Auditoria das dependências de produção da função: zero vulnerabilidades conhecidas.

## Convites pela Diretoria — 23/10, 21h55 (São Paulo)

Remetente, assinatura e endereço de resposta alterados para a Diretoria:
`Diretoria Conecta Imóveis 3D <diretoria@conectaimoveis3d.com.br>`.
Publicação conferida como `ACTIVE`, com todo o tráfego na revisão atual.
Os quatro testes de composição e transporte passaram com o novo contrato.

Teste real aceito às 21h55m49s, mensagem
`01a16b68-2183-7442-8d0b-f1fa86aa8ed2`. A chegada em `contato@`, o nome/endereço
do remetente e o destino `diretoria@` ao clicar em responder foram conferidos
na conversa `99084f6a-2e9e-4635-b791-0fd17b5accc0` do Resend. O convite de teste
foi cancelado às 21h56 com condição de geração/versão. Nenhum usuário foi criado.

O passo a passo para o administrador, gerente e convidado está em **Como usar**
no README desta pasta.

## Texto e link público — 23/10, 22h09 (São Paulo)

O convite passou a usar `https://conectaimoveis3d.com.br/painel`, o mesmo atalho
da fachada. Conferido: HTTP 302 para o login do Firebase, seguido de HTTP 200.
O site do painel ainda não tem domínio personalizado próprio no Firebase Hosting.

A mensagem começa diretamente com "Você recebeu um convite para acessar o
painel administrativo da Conecta Imóveis 3D.", sem saudação anterior nem cargo.
O papel continua validado no servidor e usado para conceder o acesso no painel.
Os quatro testes passaram; a composição é a mesma para os quatro papéis.

Revisão conferida como `ACTIVE`, com todo o tráfego na versão atual.
Teste real aceito às 22h09m46s, mensagem
`01a16b74-e7d1-742d-8485-556e2b21f225`. A abertura, a ausência do cargo e o link
foram conferidos na Inbox, conversa `b706cfaf-25ba-44c1-94ce-51d2168a80b0`.
O convite de teste foi cancelado às 22h10 com condição de geração/versão.
A correção vale para novos envios; nenhuma mensagem já entregue foi reenviada.

## Migração para o domínio próprio — 23/10, 22h53 (São Paulo)

Painel publicado em `https://painel.conectaimoveis3d.com.br/login`, HTTPS válido.
Convites usam esse endereço diretamente. Os atalhos `/painel` e `/login` na
fachada encaminham ao mesmo host. Versão Hosting: `79a4e0352c5f4554`.

Confirmação enviada por `avisos@` via callable autenticada
`enviarVerificacaoPainel`, revisão `enviarverificacaopainel-00001-gek`.
O Firebase gera/valida o código e o Resend envia o link no domínio próprio.
O modelo padrão do Firebase recusou alteração da URL; o painel usa o fluxo
próprio. Teste real verificou o e-mail e voltou ao login novo. Conta técnica
e cota individual removidas. 40 testes de migração e e-mail passaram.

Convite real recebido em `contato@`: `01a16b9d-3476-795d-ab92-d6c0cd4bf89b`.
Novo link, abertura sem cargo e remetente Diretoria conferidos; convite removido.
Histórico, recuperação e versões em `conecta/DOMINIO-PAINEL.md`.

## Operação

Novos convites e convites recriados acionam o envio automático; convites antigos
não foram disparados em massa. O CLI exige `--force` em publicação não interativa
para habilitar as retentativas já cobertas pelos testes de idempotência.

A primeira implantação exigiu a propagação do agente Eventarc e as permissões
de recebimento/invocação da conta própria. O primeiro evento repetiu até essas
permissões propagarem e então enviou uma única mensagem, com estado `accepted`.

A confirmação de cadastro agora é enviada pelo Resend e validada pelo Firebase
Auth. A conta técnica usada na migração foi removida após a confirmação real.
Os testes locais cobrem o fluxo de convite e as regras de acesso.

O limite diário e a retenção das caixas estão documentados no README.

As referências anteriores às publicações e as regras para recuperação estão em
`releases/emails-20261023/`, ignorado pelo git. Nenhum commit feito nesta conversa.
