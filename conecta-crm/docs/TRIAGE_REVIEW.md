# Revisão humana da triagem

Na Caixa de entrada, abra a conversa e escolha **Revisar uma mensagem recebida**. Selecione a mensagem específica, leia seu texto e confirme ou corrija a categoria. Registre separadamente a natureza da resposta: **Humana confirmada**, **Automática confirmada** ou **Incerta**. Essa escolha começa vazia; a sugestão da regra não comprova resposta humana.

Uma categoria Mensagem automática exige natureza Automática confirmada. As outras categorias aceitam Humana confirmada ou Incerta. É possível acrescentar uma nota local de até 2.000 caracteres. Marque **Li a mensagem selecionada e confirmo a categoria e a natureza da resposta** e use **Salvar revisão desta mensagem**. Alterar um campo desmarca a confirmação.

## O que muda na conversa

A categoria revisada passa a controlar o badge e os filtros. O badge mostra **Revisada** e a sugestão original das regras continua consultável no formulário. Uma nova execução das regras atualiza apenas a sugestão e preserva a revisão. Nenhuma regra é treinada ou modificada a partir das notas.

A revisão vale para uma mensagem, não para todas as respostas futuras. A classificação resumida da conversa mantém a precedência existente: descadastro primeiro, depois a resposta substantiva mais recente, com automáticas em último lugar. Assim, uma resposta humana mais nova ainda sem revisão pode controlar a categoria da conversa. Agrupar conversas preserva as revisões pelos identificadores das mensagens.

Somente mensagens recebidas de remetentes externos podem ser revisadas. Mensagens enviadas e endereços da própria Conecta são recusados. A solicitação confere conta, conversa, identificador, hash do conteúdo lido e versão da revisão. Ler/marcar como lida ou agrupar a conversa não muda esse hash. O cache não oferece edição de conteúdo recebido; uma mudança de conteúdo entre leitura e salvamento exige reabrir a mensagem.

## Bloqueios e seguimentos

Salvar Recusa/Sem interesse ou Descadastro aplica o bloqueio global do remetente e as proteções existentes da fila. Corrigir posteriormente a categoria não remove o bloqueio. Também não retoma seguimentos pausados/cancelados nem restaura aprovações antigas.

Confirmar uma resposta como humana aplica a pausa de seguimentos mais antigos daquela conversa. O contexto dos rascunhos de seguimento considera a categoria efetiva, incluindo correções de Mensagem automática. Mudanças de contexto exigem conferir e salvar o rascunho novamente. A fila continua em simulação, e a revisão de triagem não constitui autorização de envio, contato comercial, assinatura ou aceite de cliente.

## Histórico e edições pendentes

Cada mudança cria uma versão e uma entrada de histórico com categoria, natureza, nota e data. A interface mostra as 20 versões mais recentes; as anteriores permanecem no banco. Salvar os mesmos dados novamente não cria duplicata. Uma edição concorrente com conteúdo diferente é recusada.

Enquanto houver edição pendente, classificação por regras, marcação de leitura e preparo de resposta ficam desabilitados para preservar o formulário. A troca de mensagem no formulário exige salvar ou descartar. Navegar para outra conversa, conta, pasta, categoria ou página passa pela proteção existente de alterações não salvas. **Reabrir dados e descartar edição da revisão** permite recuperar a versão atual após conflito.

## Indicadores de respostas

**Indicadores → Respostas revisadas pelo operador** mostra mensagens recebidas com triagem local nas contas `contact` e `team`, divididas em humanas confirmadas, automáticas confirmadas, incertas após revisão e aguardando revisão humana. A conta de demonstração fica fora dos indicadores reais. Uma nova revisão substitui a contagem anterior daquela mensagem, sem contar cada versão como outra resposta.

São contagens de registros de mensagens. Não representam pessoas únicas, contatos autorizados, taxa de resposta de campanha, satisfação ou receita. Uma mensagem importada nas duas contas pode representar dois registros. Mensagens ainda sem triagem local não entram nesse conjunto; execute as regras para classificá-las. Nenhuma leitura ou inferência de IA confirma automaticamente uma resposta humana.

## Dados, API e verificação

As decisões e notas ficam no cache local e entram nos backups DPAPI existentes. A migração 0010 adiciona as tabelas de revisão/histórico e a visão de categorias efetivas; não cria revisões de mensagens antigas nem muda dados do provedor.

- `GET /api/classifications/{thread_id}/messages/{message_id}/review`: mensagem, sugestão, revisão atual e histórico.
- `POST /api/classifications/{thread_id}/messages/{message_id}/review`: confirmação, conta, hash, versão, categoria, natureza e nota.
- `GET /api/insights`: acrescenta `response_reviews` e `response_review_total`.

Rotas usam sessão e origem locais, entradas estritas, consultas parametrizadas e texto seguro no React. Não há solicitação a IA, exportação de mensagens ou acesso a credenciais neste fluxo.

Verificação: 255 testes passaram, incluindo 21 novos casos de revisão. Cobrem hash/versão/conta inválidos, mensagens enviadas/próprias, agrupamento, resposta nova, preservação de bloqueios, pausa de seguimentos, contexto corrigido e indicadores sem demonstração. Build TypeScript/esbuild passou; auditoria npm sem vulnerabilidades. Em banco separado, foram conferidos formulário, confirmação obrigatória, revisão humana/automática/incerta, correção com histórico, filtro, bloqueio preservado e indicadores. Em 320, 768, 1024 e 1440 px, sem overflow horizontal e sem erros de console.
