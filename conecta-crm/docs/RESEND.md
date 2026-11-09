# Integração de leitura com Resend

Implementada em 08/11/2026 a partir da documentação oficial. Testes usam `httpx.MockTransport`; nenhuma mensagem real é necessária e nenhum teste executa envio. A verificação da conta real exige uma chave inserida pelo operador na página local de configurações.

## Dados e permissões

- O cliente de leitura só chama GET em `https://api.resend.com`, sem redirects e sem proxies vindos do ambiente. Não responde, cria rascunhos ou modifica mensagens. O [teste individual aprovado](SENDER_TESTS.md) usa outro módulo, com uma única chamada POST por teste; a [fila real autorizada](REAL_DELIVERY.md) usa um transporte separado e começa pausada.
- O [leitor de arquivos recebidos](ATTACHMENTS.md) usa um cliente separado para o CDN oficial, sem chave ou token, sem redirects/proxies e com limite de tamanho. URLs assinadas não são expostas.
- A chave pode ter permissões mais amplas na conta Resend; este código limita suas próprias operações, não reduz o escopo da chave no provedor.
- A chave é validada contra o endereço exato da caixa, salva como credencial genérica `ConectaCRM/Resend/contact` ou `ConectaCRM/Resend/team` no Windows e nunca devolvida pela API. `noreply` não pode ser conectada para leitura.
- O navegador limpa o campo da chave ao submeter e não a grava em localStorage. Ela transita no loopback local e por HTTPS até o Resend. A aplicação não a encaminha a agentes nem a outros serviços.

## Sincronização

Cada comando lê uma página de até 10 conversas das pastas disponíveis. O cursor é salvo somente quando essa página termina. Cada conversa é persistida atomicamente depois de ler todas as páginas de mensagens; se uma conversa falhar, as anteriores já completas permanecem no cache e o próximo comando retoma a página sem duplicá-las. Ao terminar a varredura, o próximo comando volta ao início para localizar respostas novas, inclusive em conversas antigas.

O cache compara quantidade, data de atividade e pasta antes de baixar novamente os corpos. Uma mudança nesses campos provoca releitura da conversa. Essa otimização pressupõe a imutabilidade do corpo após envio; não representa uma auditoria de alterações silenciosas no provedor.

As Inboxes já fornecem o agrupamento da conversa. O CRM usa o ID remoto sem inventar `References` ou `In-Reply-To` ausentes. Mensagens recebidas e enviadas da mesma conversa permanecem juntas. A API possui pastas no nível da conversa: `Enviados` contém conversas exclusivamente de saída, conforme o provedor, e não todos os e-mails enviados de todas as conversas.

O CRM mantém o histórico local mesmo que uma mensagem desapareça do provedor. Não há espelhamento destrutivo de exclusões. Leitura e filtros locais não mudam status remoto. A [rotina automática](AUTO_SYNC.md) usa a mesma operação de leitura, com intervalos e pausa por caixa enquanto o CRM estiver aberto.

As chamadas de leitura têm timeout de 15 segundos, limite de resposta de 4 MB e intervalo mínimo de 0,6 segundo por cliente. Um lote pode receber HTTP 429 se a conta compartilhar a cota com outros sistemas; a aplicação interrompe a operação e pede nova tentativa de leitura. O teste individual nunca repete uma tentativa de envio. Uma conversa está limitada a 50 páginas de mensagens por operação, com falha explícita em vez de truncamento silencioso.

## Cache e backups

SQLite fica em `%LOCALAPPDATA%/ConectaCRM`, fora do workspace. DPAPI protege os backups; o SQLite ativo não está criptografado. Processos do mesmo usuário Windows podem acessar dados e credenciais: guardar fora do repositório reduz exposição acidental, mas não cria uma sandbox para agentes. O [executor Codex](AGENT_EXECUTION.md) usa isolamento próprio; para analisar uma conversa, só recebe trechos revisados e confirmados. Nunca recebe o cache nem credenciais Resend.

Backups usam a API de backup do SQLite, incluindo dados do WAL. A restauração descriptografa, verifica integridade e grava uma nova cópia, sem substituir um banco aberto. Cada lote manual real gera backup anterior e posterior. Na rotina automática, as cópias são criadas somente quando uma conversa muda, inclusive em falha parcial; consultas sem mudança preservam cursor/horário/auditoria sem cópias redundantes. Retenção e limpeza de backups são manuais nesta etapa.

## Fontes

- [Listar Inboxes](https://resend.com/docs/api-reference/inboxes/list-inboxes)
- [Listar conversas e semântica de pastas](https://resend.com/docs/api-reference/inboxes/list-threads)
- [Listar mensagens e paginação](https://resend.com/docs/api-reference/inboxes/list-thread-emails)
- [Ler mensagem da conversa](https://resend.com/docs/api-reference/inboxes/get-thread-email)
