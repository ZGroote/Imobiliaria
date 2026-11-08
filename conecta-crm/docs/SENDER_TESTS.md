# Diagnóstico e teste individual de conexão

Em **Contas e identidades**, selecione `contact` ou `team` e use **Verificar domínio do remetente**. A conexão de leitura deve estar validada. O diagnóstico confere o ID exato da caixa, o domínio correspondente na conta Resend, sua capacidade de envio e todos os registros SPF/DKIM retornados pelo provedor. Registros verificados podem usar tipos DNS diferentes; a verificação considera o estado informado pelo Resend.

O CRM consulta DMARC por HTTPS no DNS público do Google, exclusivamente para os dois domínios da marca. Essa consulta recebe apenas o domínio público; não recebe chave, endereço do destinatário ou conteúdo de mensagem. O diagnóstico exige um único registro DMARC com política `none`, `quarantine` ou `reject`. `p=none` é monitoramento e aparece como aviso. A consulta não altera DNS nem configurações do Resend.

## Aprovação no painel

1. Informe um endereço seu e confirme que consegue conferir essa caixa.
2. Use **Preparar prévia · não envia**. O CRM grava uma mensagem de teste fixa, com referência única. O perfil BR usa português e o site `.com.br`; US usa inglês e o site `.com`.
3. Confira De, Responder para, Para, assunto e texto. De e Responder para são a caixa selecionada, sem troca livre de identidade. Não há anexos, HTML, listas de destinatários ou conteúdo de campanhas.
4. Para autorizar, marque a declaração abaixo da prévia e clique em **Enviar este teste real**. O backend exige a confirmação e o hash do conteúdo exato, refaz o diagnóstico e consulta a lista de bloqueio imediatamente antes da tentativa.
5. Use **Atualizar resultado no Resend** para consultar o estado remoto. Se você conferiu a mensagem na sua caixa, marque a declaração de recebimento e confirme. Entrega informada pelo provedor e recebimento declarado pelo operador são estados diferentes.

Nenhum teste é enviado automaticamente ao preparar a prévia, carregar a página, sincronizar a caixa, agendar ou rodar a simulação. A aprovação do teste não habilita a fila de campanhas. O teste é uma mensagem real; não é o destinatário de uma futura campanha.

## Tentativas e falhas

O registro `sending` e a auditoria de aprovação são confirmados no SQLite antes da chamada `POST /emails`. O transporte usa `Idempotency-Key` estável por teste, timeout de 15 segundos, resposta limitada e não segue redirects. Não há retentativa automática nem manual do mesmo registro após uma tentativa, mesmo que a interface repita a chamada.

Uma resposta HTTP explicitamente recusada é registrada como falha. Timeout, HTTP 408/409/5xx, redirect, resposta inválida ou queda do processo após começar a tentativa deixam resultado incerto. O CRM não presume que nada foi enviado e bloqueia outra prévia para o mesmo destinatário/caixa enquanto a tentativa estiver incerta. Confira a caixa de entrada, spam e o painel do provedor. Uma confirmação de recebimento pode resolver essa incerteza sem novo envio.

Há até três tentativas de teste por dia UTC, compartilhadas entre caixas, contando falhas e resultados incertos. Essa é uma proteção local; não é a cota contratada do Resend. A aplicação ainda não consulta consumo/cota da conta, nem coordena chamadas de outros sites que usam o provedor. Recusas do provedor permanecem registradas.

O teste usa a API de envio de e-mail do Resend, separada da API Inboxes. Não se presume que ele apareça automaticamente nas conversas importadas. O diagnóstico também não garante chegada à caixa principal, reputação do domínio ou permissão para prospectar.

Credenciais continuam no Gerenciador do Windows e só chegam ao Resend. O texto, destinatário e estados do teste ficam no cache local, incluídos nos backups. Processos do mesmo usuário Windows não são isolados entre si; este fluxo não cria uma barreira contra esses processos.

## Fontes oficiais

- [Listar domínios](https://resend.com/docs/api-reference/domains/list-domains) e [consultar domínio](https://resend.com/docs/api-reference/domains/get-domain).
- [Enviar e-mail](https://resend.com/docs/api-reference/emails/send-email) e [consultar e-mail enviado](https://resend.com/docs/api-reference/emails/retrieve-email).
- [Idempotência e prazo das chaves](https://resend.com/docs/dashboard/emails/idempotency-keys).
- [Formato JSON de DNS sobre HTTPS do Google](https://developers.google.com/speed/public-dns/docs/doh/json).
