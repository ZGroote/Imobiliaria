# E-mails da Conecta

Provedor: Resend. Domínio de e-mail: `conectaimoveis3d.com` (desde 07/11/2026;
antes era `conectaimoveis3d.com.br`, que continua verificado no Resend mas sem
caixas). Registros em [dns-com.json](dns-com.json). Caixas:

- `noreply@conectaimoveis3d.com`: remetente da confirmação de cadastro e do formulário.
- `contact@conectaimoveis3d.com`: atendimento; recebe o formulário e as respostas à confirmação.
- `team@conectaimoveis3d.com`: remetente e respostas dos convites do painel.

O site e o painel continuam no `.com.br`; só o e-mail mudou. O formulário da
apresentação inglesa está em [CONTATO.md](CONTATO.md).

O código está em `config.mjs`, `resend.mjs` e `convites.mjs`. `index.mjs` liga o
processador à escrita de `invites/{email}` no Firestore. A criação/recriação do
convite agenda o envio; alterações no resultado do envio e exclusões são ignoradas.
A confirmação de cadastro é enviada pelo Resend. O Firebase Auth gera e valida
o código; o link usa o handler nativo em
`https://painel.conectaimoveis3d.com.br/__/auth/action`.

## Como usar

Para ler ou escrever e-mails, entrar na conta do [Resend](https://resend.com/inboxes),
abrir **Inboxes** e escolher a caixa. **Compose** cria uma mensagem nova;
**Reply** responde à mensagem aberta. As três caixas são acessadas pela conta
do Resend, sem senhas individuais configuradas para cada endereço.

Para convidar alguém como administrador, abrir o
[painel](https://painel.conectaimoveis3d.com.br/login), entrar em
**Usuários e convites**, informar e-mail, nome, papel e imobiliária quando
solicitada, e clicar em **Convidar**. O gerente usa **Equipe → Convidar corretor**.
O envio é automático, identificado como **Conecta Imóveis 3D**;
respostas ao convite chegam em `team@conectaimoveis3d.com`.
O texto do convite começa com "Você recebeu um convite para acessar o painel
administrativo da Conecta Imóveis 3D.", sem mencionar o papel do destinatário.
O link público é `https://painel.conectaimoveis3d.com.br/login`. Os atalhos
`https://conectaimoveis3d.com.br/painel` e `/login` encaminham para esse domínio.

A lista **Convites pendentes** mostra o estado do envio. O destinatário abre o
link recebido, escolhe **Primeiro acesso (recebi um convite)**, cria sua senha,
confirma o e-mail e clica em **Aceitar convite** no painel. Quem já tem conta
entra normalmente e aceita o convite. Cancelar impede o aceite, mas não recolhe
uma mensagem já enviada. Para reenviar, criar novamente o convite para o mesmo
e-mail; isso substitui o convite pendente e agenda outro envio.

## Segurança e resultado

O servidor confere se o autor continua ativo e autorizado a convidar para aquela
agência. Nomes e endereços são validados; o e-mail usa texto simples e link fixo.
As regras proíbem o cliente de escrever `emailDelivery` ou a cota de envio.
O painel acompanha `processing`, `accepted` ou `failed`; `accepted` significa
aceito pelo Resend, sem garantia de chegada à caixa de entrada. Sem resultado,
o painel informa que o envio ainda não foi confirmado.

Eventos repetidos usam a mesma chave de idempotência. O estado aceito fica no
convite até seu consumo/cancelamento. Erros temporários repetem por até 23 horas;
erros permanentes e convites antigos falham sem novos disparos. Há reserva de
no máximo 90 convites por dia UTC. As caixas também usam a cota do Resend; se
ela acabar antes, o provedor poderá recusar o envio. Recriar o convite gera uma
nova tentativa; convites cancelados ou substituídos antes do processamento são
ignorados. O envio externo não é uma transação com o banco: cancelar enquanto a
requisição já está em trânsito não recolhe o e-mail.

`emailQuota/{AAAA-MM-DD}` guarda somente contagem e data, sem destinatários.
Corpos, chaves e dados dos destinatários não são gravados nos logs pela função.

`enviarVerificacaoPainel` é uma callable que exige Firebase Auth e não recebe
destinatário no corpo. O servidor lê apenas o e-mail da própria conta solicitante.
Conta desativada ou já confirmada não recebe outro disparo. Há intervalo de um
minuto e até cinco tentativas por conta/dia UTC, além da cota global compartilhada
de 90 mensagens. `emailVerificationQuota/{uid}` contém somente dia, contagem e
data; o código de confirmação não é persistido no banco nem devolvido ao cliente.

A conta da função usa o papel personalizado `conectaEmailVerification`, contendo
apenas `firebaseauth.users.get` e `firebaseauth.users.sendEmail`. Não permite criar,
alterar ou excluir usuários. O domínio antigo dos modelos padrão permanece como
configuração legada: o Firebase recusou sua edição com
`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`. O painel em produção usa o envio próprio
pelo Resend; no emulador, usa o SDK diretamente sem enviar mensagens reais.

## Ativação

1. No Resend, verificar o domínio de `dns.json` (região São Paulo), com envio e
   recebimento habilitados. O arquivo contém só registros públicos. Preservar
   os registros A/TXT do Hosting e HTTPS ao acrescentar os de e-mail no Registro.br.
2. Criar as três Inboxes da lista acima, com agentes automáticos desativados.
   O Resend exige domínio verificado para criar as caixas.
3. Criar uma chave Resend **somente de envio**, restrita a este domínio. Armazenar
   como `RESEND_API_KEY` no Secret Manager do projeto `imobilaria-deccb`:

   ```powershell
   node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set RESEND_API_KEY --project imobilaria-deccb
   ```

   Nunca colocar a chave no painel, em `NEXT_PUBLIC_*`, no git ou na conversa.
4. A função usa `conecta-emails@imobilaria-deccb.iam.gserviceaccount.com` com
   `roles/datastore.user` e `roles/eventarc.eventReceiver` no projeto e acesso
   somente ao segredo `RESEND_API_KEY`. O gatilho usa essa mesma conta;
   conferir `roles/run.invoker` somente no serviço da função. O Firebase CLI
   precisa de permissão para publicar com essa conta e configurar o gatilho.
5. Publicar as regras e depois a função e o painel já testados:

   ```powershell
   node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules --project imobilaria-deccb
   node node_modules/firebase-tools/lib/bin/firebase.js deploy --only functions:emails --config firebase.emails.json --project imobilaria-deccb
   npm --prefix painel run build -- --webpack
   node node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting:painel --config firebase.painel.json --project imobilaria-deccb
   ```

   Conferir o diff das regras antes do deploy: há trabalho de outras conversas.
   Não executar `--only functions` contra configurações de outras codebases.
   Nesta sessão, o Turbopack falhou ao abrir seu subprocesso CSS; o build com
   Webpack concluiu as 26 páginas e a checagem de TypeScript.
6. Enviar um convite de teste para um endereço autorizado, verificar recebimento,
   resposta para `diretoria@` e o resultado exibido na lista. Não disparar os convites
   antigos em massa: somente novas escritas acionam o gatilho.

O plano gratuito consultado inclui 3 caixas e 3.000 mensagens/mês, até 100/dia.
A tabela informa retenção de dados de 30 dias; confirmar a retenção das conversas
das Inboxes antes de usá-las como arquivo permanente de atendimento.

## Verificação local

`node --test tests/test_emails.mjs` na raiz testa destinatários, composição, erros
e idempotência da chamada REST. `painel/tests/emails.test.mjs`, executado por
`npm run test:painel`, testa o processador contra Firestore no projeto
`demo-painel`, com Resend simulado. `npm run test:regras` inclui a proteção do
estado de envio. Esses testes nunca mandam mensagens reais.
`painel/tests/verificacao-servidor.test.mjs` cobre identidade do destinatário,
concorrência, cotas e validação do link. `verificacao-email.test.mjs` confirma o
retorno ao domínio próprio usando o SDK e o Auth emulado.

Referências: [Resend API](https://resend.com/docs/api-reference/emails/send-email),
[idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Inboxes](https://resend.com/docs/api-reference/inboxes/create-inbox),
[preços](https://resend.com/pricing),
[gatilhos Firestore](https://firebase.google.com/docs/functions/firestore-events),
[permissões do Eventarc](https://docs.cloud.google.com/eventarc/docs/roles-permissions).
