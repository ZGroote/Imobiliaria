# Tarefas assistidas de pesquisa

Continuação do plano v2 após o teste de e-mail confirmado em 08/11/2026. O Resend proíbe mensagens não solicitadas, inclusive cold outreach; a fila comercial permanece simulada. Fonte: https://resend.com/legal/acceptable-use (consulta em 08/11/2026).

Entregar um fluxo completo de pesquisa assistida: tarefa com parâmetros e prompt, exportação de contrato JSON, importação local de candidatos e aprovação individual para cadastro de empresas. Nenhum executor de CLI, leitura de credenciais, acesso a mensagens ou busca automática nesta etapa. O operador escolhe o material que envia à sua sessão do agente.

## Decisões

- Persistir tarefas, candidatos e empresas no cache SQLite existente, com migração e backup.
- JSON estrito, até 50 candidatos por tarefa e 256 KiB por importação; URLs públicas HTTPS, fontes e datas obrigatórias. Validação de formato não comprova a fonte; revisão humana explícita antes de cadastrar.
- Resultado imutável por tarefa; reimportação idêntica é idempotente. Conteúdo diferente exige outra tarefa, preservando decisões existentes.
- Empresa única por domínio normalizado; aprovação em outra tarefa exige confirmação explícita de que é a mesma organização. Preservar todas as fontes e presenças estaduais.
- Prompt e schema contêm só parâmetros de pesquisa e o identificador da tarefa. Dados importados não viram comandos, HTML ou envios.

## Implementação

1. Contrato, migração e API de tarefas/exportação/importação; testar limites, isolamento e idempotência.
2. Revisão individual e cadastro deduplicado; testar aprovação parcial e fontes insuficientes.
3. Interface de tarefas e empresas, documentação, build e conferência no navegador.

## Limites

Não é possível provar automaticamente que páginas ou afirmações são verdadeiras sem consultá-las. O operador precisa abrir e verificar fontes antes da aprovação. Domínios compartilhados entre entidades diferentes exigem revisão; não fundir automaticamente. Execução local de agentes continua pendente de isolamento efetivo do usuário Windows e das credenciais.

## Próxima etapa: conversas e oportunidades

Entregar vínculos manuais de conversas a empresas já revisadas, com oportunidade opcional da mesma empresa. Criar um funil de oportunidades com etapa, valor estimado opcional em BRL/USD, próxima ação e data, notas e histórico. Nenhum envio ou movimentação remota de e-mail; nenhum candidato é aprovado por essa implementação.

As associações aceitam mais de um contexto comercial na mesma conversa e são preservadas quando a sincronização agrupa threads. Duplicatas da mesma associação são consolidadas com auditoria. Vínculos não são inferidos por domínio. Conversas fictícias da conta demo não podem ser vinculadas a empresas reais.

Oportunidades têm empresa imutável, versão para impedir sobrescrita concorrente e chave de criação idempotente. Valores usam centavos inteiros, sem somar moedas diferentes nem tratar estimativa como receita. Datas de próxima ação são dias do calendário pessoal; o aviso de atraso usa America/Sao_Paulo. Nenhuma execução automática decorre da data.

Implementação: (4) migração e API de oportunidade com testes; (5) vínculos, histórico e preservação no agrupamento de threads; (6) interfaces na caixa, ficha da empresa e funil; (7) verificação integrada, backup e atualização local. Fluxos com empresas e oportunidades fictícias serão verificados apenas em banco de testes separado.

## Propostas comerciais e indicadores

Preparar propostas versionadas vinculadas à oportunidade e a uma cópia explícita dos seus dados. Escopo, entregas, materiais, prazo, revisões, suporte, preço, pagamento e validade dependem de preenchimento/revisão do operador. Sem cláusulas jurídicas geradas automaticamente, assinatura ou aceite de cliente inferido.

Cada aprovação vale para versão/hash e versão da oportunidade. Editar a proposta ou mudar a oportunidade exige nova revisão. Exportação de rascunho Word tem identificação inequívoca de rascunho; exportação revisada exige aprovação vigente. BR e US são escolhas explícitas: textos do operador não são traduzidos; rótulos/rodapé usam o mercado escolhido. Derivar do papel timbrado preservando o original e a marca, com verificação dos componentes do pacote e inspeção visual.

Indicadores locais: empresas cadastradas, candidatos em revisão, oportunidades por etapa, valores estimados separados por moeda, próximas ações e propostas aprovadas vigentes. Não chamar estimativa de receita nem inferir taxa de resposta humana a partir das regras locais. Fluxos completos e arquivos de exemplo usarão somente banco temporário.

## Produção, entrega e pós-venda

Um acompanhamento de produção por oportunidade, criado expressamente pelo operador. Briefing resumido baseado no documento técnico: responsáveis, localização, características do imóvel, escopo/recursos, materiais, referências e cronograma. Etapas manuais: Briefing, Produção, Revisão, Pronta para entrega, Entregue, Pós-venda, Concluído e Cancelado. Não inferir contratação ou pagamento a partir de oportunidade ganha ou proposta revisada.

Proposta de origem opcional, com versão/hash e conteúdo copiados somente se a revisão interna estiver vigente no momento da criação. O acompanhamento preserva essa origem e não acompanha mudanças comerciais automaticamente. Nenhum campo é preenchido com serviços, preços ou promessas inventados. Uma mudança posterior na proposta não reescreve o projeto.

Registrar link HTTPS de entrega, orientações, data declarada de entrega, próxima ação, data de acompanhamento e feedback informado pelo operador. Etapas de entrega/pós-venda/conclusão exigem link e data de entrega não futura. Registrar entrega não envia mensagem nem registra confirmação do cliente. Sem upload de arquivos, publicação, execução de links, automações, assinatura ou inferência de satisfação. Os três documentos originais continuam na biblioteca.

Entrega em três incrementos: (12) migração/API, validação e testes; (13) telas na oportunidade e visão de projetos, com proteção a edições não salvas; (14) verificação completa em banco temporário, documentação e atualização local com backups. Nenhum candidato real será aprovado nesta etapa.

## Revisão humana da triagem

Confirmar/corrigir a categoria de uma mensagem recebida específica, registrando separadamente se a resposta é humana, automática ou incerta. Revisão explícita, versão e identificação do conteúdo lido; histórico imutável das decisões. A sugestão por regra permanece consultável e uma nova execução das regras não apaga a revisão. Uma nova mensagem exige sua própria revisão; o agrupamento de conversas preserva a decisão pelo identificador da mensagem.

Categoria revista controla o badge/filtro da conversa com a mesma precedência atual (descadastro primeiro; resposta substantiva antes de automática). Correção não remove bloqueios existentes nem retoma seguimentos. Revisar como recusa/descadastro aplica bloqueio global; confirmação como resposta humana pausa seguimentos conforme as proteções já existentes. Nenhuma revisão habilita envio.

Indicadores mostram contagens de mensagens recebidas com triagem nas contas contact/team: revisadas humanas, automáticas, incertas e ainda sem revisão. Demonstração fica fora das contagens reais. Não inferir pessoas únicas, taxa de resposta, consentimento, receita ou aceite. Mensagens e notas permanecem locais. Implementar/testar primeiro a API (15), depois revisão na conversa e indicadores (16), e concluir documentação/verificação/atualização com backups (17). As revisões de teste serão exclusivamente em banco separado.

## Contatos profissionais e empreendimentos pesquisados

Conferir novamente as fontes públicas dos três candidatos da Flórida e preservar um relatório datado, sem aprovar candidatos nem reescrever o resultado importado. Distinguir fonte aberta de resultado indexado, data histórica de estágio atual e contato departamental de pessoa. Não adivinhar endereços nem enviar formulários.

Criar contatos e empreendimentos ligados somente a empresas cadastradas após revisão. Contatos aceitam e-mail publicado e/ou canal HTTPS público, com nome da pessoa/equipe, função, fonte, data observada e confiança declarada. Empreendimentos mantêm nome, cidade/UF, endereço conhecido, tipologia, estágio e data de referência. Estado deve constar na atuação já revisada da empresa. Estágio conhecido exige data de referência; unknown não afirma situação atual. Os projetos de produção da Conecta permanecem como acompanhamento comercial separado.

Cadastro e atualização explícitos com confirmação das fontes, versões concorrentes, deduplicação por empresa e histórico imutável de revisões. Origem opcional em candidato aprovado da mesma empresa, preservada; preencher a partir de um item importado exige revisão antes de salvar. Sem importação automática ou autorização de contato/envio. Dados entram nos backups locais existentes. Interfaces dentro da ficha da empresa, com busca e estados vazios; proteger alterações pendentes. Incrementos: (18) fontes/contrato/API/testes, (19) interface e integração, (20) verificação, documentação, backups e atualização local. Testes completos usarão somente banco temporário.

## Sincronização incremental automática

Rotina de leitura por contact/team, com intervalo de 5/10/30/60 minutos, ativação e pausa explícitas, estado persistido e versões de configuração. A migração começa pausada. Funciona somente enquanto o servidor local está aberto; reiniciar executa no máximo um lote vencido por caixa, sem recuperar cada intervalo perdido. Mantém a consulta manual e compartilha os mesmos locks, validação de caixa e credenciais Windows. Nunca consulta noreply ou executa envio, aprovação ou revisão humana.

Um trabalhador serial consulta as caixas vencidas a cada cinco segundos. Cada execução lê até dez conversas; se houver mais histórico, continua após um minuto. Falhas usam tentativas espaçadas, dobrando o intervalo até uma hora. Exceções externas não são persistidas nem logadas; o painel mostra mensagens genéricas e horário da próxima tentativa. Pausar impede futuras execuções; uma consulta iniciada pode terminar. Alterar configuração durante uma consulta não é sobrescrito pela conclusão anterior. Encerramento cancela novas chamadas e aguarda o trabalho em curso antes de fechar o banco.

Lotes automáticos criam backup antes da primeira conversa alterada e depois do lote, inclusive em falha parcial. Consultas sem mudança de conversa atualizam cursor/estado/auditoria, sem criar cópias redundantes. Lotes manuais preservam backups anterior/posterior. Nada é excluído automaticamente. O cache conserva leitura local, revisões e histórico. Atualização de lista em segundo plano somente sem conversa aberta; com conversa selecionada, exibe aviso e botão. Edições pendentes impedem atualizar a visualização.

Incrementos: (21) migração, operação compartilhada, trabalhador, testes de concorrência/falhas/persistência; (22) controles de rotina e aviso de novidades com proteção de edições; (23) verificação no navegador com Resend simulado, suíte completa, documentação e atualização principal com backups. Ativar contact em 30 minutos na instalação local após validar. A conferência principal confirmou team também conectada; ativar sua rotina no mesmo intervalo para acompanhar respostas aos convites.

Anexos: a OpenAPI oficial consultada em 08/11/2026 lista somente id/nome/tamanho em Inboxes, sem URL ou endpoint de download próprio. Existem rotas de anexos para e-mails transacionais e Receiving; não há contrato confirmado de equivalência de IDs com Inboxes. Não oferecer botão com rota presumida. Preservar os IDs novos e aceitar tamanho desconhecido; download continua pendente de acesso documentado/validado aos arquivos da Inbox. Fontes: https://github.com/resend/resend-openapi/blob/main/resend.yaml e https://resend.com/docs/api-reference/inboxes/get-thread-email.

## Download de anexos recebidos

Continuação da validação em 08/11/2026: consulta somente leitura a uma mensagem real do cache confirmou o mesmo UUID/Message-ID na Inbox e no recurso Receiving. Não havia anexos nas mensagens reais. Substituir a pendência acima por um adaptador com verificação por operação, sem presumir equivalência global. Somente mensagens recebidas nesta etapa; não integrar envios ou análise de arquivos.

Consultar metadados sob demanda pela mensagem/conta local; obter conversa pelo identificador já sincronizado. Revalidar endereço da caixa, mensagem recebida, UUID, Message-ID, remetente e anexos em Inbox/Receiving. O conjunto de IDs precisa coincidir; nomes e tamanhos conhecidos devem ser compatíveis. Cache antigo sem IDs continua utilizável. Cada download repete a validação e obtém link novo do anexo específico.

Transferir somente por HTTPS no CDN oficial com caminho vinculado aos IDs. Cliente sem credenciais, proxies, logs de URL ou redirects; limite de 20 MiB, tamanho efetivo/esperado, expiração e tempo de leitura. Não guardar bytes no servidor nem abrir/executar arquivos. Entregar como download binário com nome sanitizado; browser controla salvamento. Auditoria registra preparação completa, hash e tamanho, sem afirmar que o usuário salvou.

Incrementos: (24) leitor restrito, migração/API, testes de vínculo/isolamento/tamanho/expiração/segredos; (25) consulta e botão por arquivo na mensagem, erros e edição preservada; (26) suíte completa, build/auditoria, QA no navegador com arquivo fictício, documentação e atualização principal com backups. Não enviar mensagens para fabricar um anexo real de teste. Registrar o limite de validação: compatibilidade de uma mensagem real sem anexos e transferência fictícia conferida; CDN real ainda sem arquivo disponível.

## Análise assistida de trechos

Entregar a preparação/exportação manual e importação de análise da seção 6.2, sem executar CLI no usuário Windows do CRM ou transmitir mensagens automaticamente. Seleção inicialmente vazia, até cinco trechos editáveis de 4.000 caracteres, revisão explícita antes de persistir o pacote. Exportar somente aliases, direção e textos revisados, prompt/versão, ID da análise e hash; não exportar metadados privados originais ou mensagens não selecionadas. O operador escolhe o que leva à sessão externa.

Resultado estrito, vinculado ao pacote, com modelo declarado, até seis afirmações, categoria/confiança e citações literais dos trechos selecionados. Validar limite, referências, Unicode e imutabilidade; nunca aceitar auto_send_allowed=true. Resultado permanece sugestão não verificada, sem atualizar classificação humana, natureza da resposta, bloqueios, leitura ou ações comerciais. Presença de citação não comprova uma interpretação; exibir origem e limitação.

Snapshot por conteúdo da conversa inteira: resposta nova ou mudança de texto invalida exportação/primeira importação e identifica sugestões antigas, preservando histórico. Leitura local/regras não invalidam. Vínculos por mensagem preservam pacotes no agrupamento de threads. Preparação e importação idempotentes; não sobrescrever resultados. Proteção de edições e modos de análise/revisão mutuamente exclusivos na conversa.

Incrementos: (27) migração/contrato/API/testes; (28) preparação, exportação, importação e evidências na interface; (29) suíte, build/auditoria, QA com conteúdo fictício, documentação e atualização principal com backups. Não preparar, exportar ou importar análise em mensagens reais nesta etapa. Execução real do modelo/qualidade de resumo fora da verificação deste incremento.
