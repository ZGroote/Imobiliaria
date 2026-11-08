# Anexos recebidos sob demanda

Na mensagem recebida, use **Consultar anexos para download**. A consulta confere os metadados atuais no Resend e apresenta um botão **Baixar** para cada arquivo de até 20 MB. A consulta não baixa arquivos. O download só acontece ao clicar no botão do arquivo; o CRM não o abre nem o executa.

O navegador controla a pasta de destino e pode pedir onde salvar. A mensagem **Arquivo preparado para baixar no navegador** informa que o CRM entregou os bytes ao navegador; não comprova que o usuário concluiu o salvamento. O servidor não mantém uma cópia do arquivo em disco. Downloads de mensagens enviadas e metadados fictícios da conta demo ainda não estão disponíveis.

## Identidade e acesso

Em 08/11/2026, uma consulta somente leitura a uma mensagem já no cache confirmou o mesmo UUID e Message-ID na Inbox e no recurso Receiving. A mensagem não tinha anexos. Esse resultado valida a correspondência dessa mensagem; não é presumido para outras mensagens.

Cada consulta e cada download revalidam a caixa pelo endereço exato e a chave guardada no Windows. O ID remoto da conversa é obtido do histórico de sincronização da mesma conta. A mensagem deve estar no cache como recebida pelo Resend e ser recuperável na Inbox correspondente. UUID, Message-ID não vazio e endereço do remetente devem coincidir entre cache, Inbox e Receiving. IDs únicos e conjunto de anexos também devem coincidir; nomes/tamanhos conhecidos não podem divergir. Uma chave válida para outra caixa, item de outra mensagem ou ausência de vínculo verificável interrompe a operação.

Os IDs antigos dos anexos não precisam estar no cache: a consulta recupera os metadados atuais sem reescrever o corpo, leitura local ou revisão humana. A mensagem não é marcada como lida no Resend ou localmente por causa do download. Consultas/downloads compartilham o lock da caixa com sincronização e conexão; em caso de conflito, aguarde e tente novamente.

## Arquivo e limites

Antes de cada download, o CRM consulta metadados novos do anexo e verifica identidade, nome, tamanho e expiração do link. O endereço deve usar HTTPS no host exato `inbound-cdn.resend.com`, com caminho que contenha o UUID da mensagem e do anexo. Não aceita outro host, porta, usuário/senha, fragmento, caminho alternativo ou redirecionamento. Uma futura mudança de host/caminho no provedor exigirá atualização explícita do adaptador.

A transferência usa outro cliente, sem chave de API, token local, cookies, proxy do ambiente ou Referer. O link assinado não vai ao navegador, banco ou logs do aplicativo. O leitor de arquivos usa urllib, que não registra URLs de requisição no logger INFO do httpx. Erros retornam textos fixos, sem conteúdo de respostas externas.

Limite de 20 × 1024 × 1024 bytes, conferido nos metadados e durante a leitura. Tamanho anunciado e bytes recebidos devem coincidir; arquivos incompletos, conteúdo codificado inesperado ou excesso são recusados. Há timeout de 15 segundos nas operações de rede e orçamento de 60 segundos verificado entre as leituras. Não há repetição automática do download: uma nova tentativa solicita um link novo.

Nomes são normalizados para Unicode NFC, reduzidos ao nome do arquivo, sem diretórios, controles, caracteres inválidos do Windows ou nomes reservados. O conteúdo é devolvido como `application/octet-stream`, com `Content-Disposition: attachment`, `nosniff` e política restritiva de conteúdo. Não há prévia de HTML/PDF, extração de arquivos, execução ou análise por agentes.

## Auditoria e verificação

Somente após uma leitura completa, `attachment_transfers` registra mensagem/anexo, nome sanitizado, quantidade de bytes, SHA-256 e horário de preparação. Não armazena bytes, URL ou credenciais. O registro não é um certificado de segurança do arquivo nem comprova salvamento no computador. Esses metadados entram nos backups normais do SQLite; não há cópia criptografada dos próprios arquivos no servidor.

Testes automatizados usam API e arquivos simulados. A conferência no navegador usa banco separado e arquivo de texto fictício, incluindo nome Unicode, cache antigo sem IDs, limite de tamanho, expiração e preservação de edição. Na conta principal, as mensagens disponíveis nesta etapa não têm anexos; a transferência de um arquivo real do CDN ainda não foi verificada.

Fontes oficiais consultadas em 08/11/2026: [mensagem da Inbox](https://resend.com/docs/api-reference/inboxes/get-thread-email), [mensagem recebida](https://resend.com/docs/api-reference/emails/retrieve-received-email) e [metadados/link do anexo recebido](https://resend.com/docs/api-reference/emails/retrieve-received-email-attachment).
