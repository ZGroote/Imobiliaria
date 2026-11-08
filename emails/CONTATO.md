# Formulário internacional — 03/11/2026

Publicado em `https://conectaimoveis3d.com/#contato`. O “Let’s talk” e os atalhos
de contato da apresentação inglesa levam ao formulário. A página brasileira
mantém seu atendimento por WhatsApp.

O formulário pede nome, e-mail, empresa opcional e mensagem. Faz POST JSON para
`/api/contact`, reescrito pelo Hosting para o serviço Cloud Run `recebercontato`
em `southamerica-east1`. A função exportada é `receberContato`, codebase `emails`.
O servidor usa `noreply@conectaimoveis3d.com` como remetente e envia somente a
`contact@conectaimoveis3d.com`, com o e-mail validado do interessado em Reply-To.
Não envia confirmação automática ao visitante.

O aviso específico do formulário está em
`https://conectaimoveis3d.com/assets/contact-privacy.html`. A política anterior
da fachada descrevia um formulário que apenas montava mensagens no WhatsApp;
ela não foi reutilizada como aviso deste fluxo novo.

## Acesso às caixas

Entrar em [Resend Inboxes](https://resend.com/inboxes), selecionar
`team@conectaimoveis3d.com` e clicar **Compose**. Informar destinatário,
assunto e mensagem e clicar **Send**. Para responder a uma conversa, usar
**Reply**. O acesso é pela conta Resend existente; não foi criada senha individual
para cada endereço. Para conferir os contatos enviados pelo formulário, abrir
a Inbox `contact@conectaimoveis3d.com`.

## Troca para o `.com` — 07/11/2026

As três caixas `.com.br` (`avisos`, `contato`, `diretoria`) foram trocadas por
`noreply`, `contact` e `team` no `.com`. O plano grátis do Resend permite só três
caixas; ter as seis custaria US$20/mês + US$1 por caixa, então as antigas foram
apagadas. Domínio `.com` cadastrado no Resend (São Paulo, envio e recebimento) e
registros DKIM/SPF/MX/DMARC postos na Spaceship sem tocar nos do site.
`RESEND_API_KEY` versão 2 é a chave de envio restrita ao `.com`; as três funções
da codebase `emails` foram republicadas com ela.

## Envio e proteção

- Destinatário/remetente fixos, allowlist de campos e texto simples; limites de
  12 KiB no corpo, 120 caracteres no nome, 254 no e-mail, 160 na empresa e
  10–5.000 na mensagem. O campo-armadilha deve estar vazio.
- Origens exatas são conferidas, mas Origin não é autenticação de clientes HTTP.
- Cotas transacionais: contato 20/dia UTC; endereço 3/dia, com intervalo de
  60 segundos; orçamento compartilhado `emailQuota` de 90/dia continua valendo.
  O endereço é identificado por HMAC diário. Nenhum IP é usado para identificar
  o visitante atrás do proxy do Hosting.
- UUID idempotente e lease de 90 segundos, até três tentativas em 23 horas.
  Erro de rede preserva o formulário e a mesma identidade para repetição.
- `CONTACT_HMAC_KEY` é uma chave estável separada de `RESEND_API_KEY`, vinculada
  somente à nova função. Trocar a credencial de envio não muda a identidade do
  pedido. Não rotacionar a chave HMAC junto com a chave do provedor.
- Firestore guarda apenas HMACs, cotas, datas, estado e ID de envio, sem nome,
  e-mail, empresa, mensagem, UUID bruto, IP ou credenciais. Não houve mudança nas
  regras do banco, Auth, painel ou nas funções anteriores.

HTTP 200 `{status:"accepted"}` significa aceitação pelo Resend, não comprovação
de chegada à Inbox. HTTP 202 informa processamento; erros não são apresentados
como envio concluído. O frontend não salva os dados em localStorage.

## Publicação e evidências

Somente a função nova foi publicada:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only functions:emails:receberContato --config firebase.emails.json --project imobilaria-deccb --non-interactive
```

Revisão ativa: `recebercontato-00001-nus`. A conta de serviço existente usa as
versões 1 de `RESEND_API_KEY` e `CONTACT_HMAC_KEY`. O script
`conecta/internacional/preparar-contato.mjs` consulta só metadados por padrão;
`--criar-segredo` cria a chave HMAC em memória, sem ler/imprimir seu valor e com
o logging do corpo da chamada desativado. Não cria nova versão se já existir uma.

Hosting global: `58c8baab8f4d5139`; brasileiro: `13b66e6ca730b152`.
O publicador preservou os inventários anteriores e incluiu o rewrite exato antes
dos padrões abrangentes. O journal está em
`publicacao/contato-internacional-20261103/`, com metadados antes/depois das funções,
metadados do segredo, pacote imutável, integridade e verificações HTTP.

As duas funções anteriores mantiveram suas revisões, datas e referências de
segredo. Integridade do Hosting: PASS. Passaram 34 testes Node pertinentes e
seis testes de tradução/SSR; um teste de symlink foi ignorado neste Windows.
As 18 verificações HTTP dos arquivos e da API pelo Hosting passaram.

O usuário autorizou uma mensagem real identificada como teste para a própria
caixa `contato@conectaimoveis3d.com.br`. Ela foi aceita às 21:19 UTC de 03/11,
HTTP 200 `{status:"accepted"}`. O identificador foi conservado no journal para
evitar outro envio em caso de repetição. Não houve mensagem para terceiros.
A confirmação visual na Inbox e a inspeção do formulário em navegador continuam
pendentes do controle do navegador.

## Auditoria de dependências

Os manifests permaneceram intactos. A auditoria encontrou seis alertas moderados
transitivos e zero altos/críticos. Não existe correção compatível nas faixas
fixadas; a tentativa sem `--force` não alterou o lockfile. O caminho é
Firestore → firestore-api → google-gax/gcp-metadata → gaxios/rimraf → glob/minimatch.
Não foi identificado caminho do formulário que passe padrões do visitante a
glob/minimatch; a presença das dependências foi confirmada, sem exploração
demonstrada neste fluxo. Não foi aplicado override incompatível.

Referências: [Inboxes](https://resend.com/docs/dashboard/inboxes/introduction),
[Compose e envio](https://resend.com/docs/dashboard/inboxes/drafts),
[preços](https://resend.com/pricing),
[domínio para recebimento](https://resend.com/docs/dashboard/receiving/custom-domains),
[glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

Nenhum commit nesta entrega.
