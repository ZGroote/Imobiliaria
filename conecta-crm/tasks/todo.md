# Tarefas desta etapa

- [x] Tarefa 1: criar tarefa de pesquisa US por estado, exportar prompt/schema e importar JSON estrito sem efeitos externos. Aceite: idempotência, rejeição de dados incompatíveis e ausência de acesso ao e-mail. Verificação: testes de API.
- [x] Tarefa 2: aprovar/rejeitar candidatos individualmente, cadastrar empresas e deduplicar entre estados com confirmação de identidade. Aceite: candidato incompleto não aprovado, decisões auditáveis, fontes preservadas. Verificação: testes transacionais.
- [x] Tarefa 3: telas Tarefas assistidas e Empresas, documentação e entrega local. Aceite: criar/exportar/importar/revisar no painel, estados vazios, uso em celular. Verificação: suíte completa, build TypeScript e navegador.

Verificação: 160 testes passaram; build TypeScript/esbuild passou; npm audit sem vulnerabilidades. No navegador: criação da tarefa piloto FL/3/todos os portes, download do pacote, rejeição de JSON incompleto e importação de três candidatos reais. Cadastro/rejeição e vínculo multiestadual cobertos nos testes com banco temporário; candidatos reais permanecem sem aprovação. Em 320 px, conteúdo sem overflow horizontal e aprovações desmarcadas. Backup anterior à migração 0006 e posterior à importação.

## Conversas e oportunidades

- [x] 4. Oportunidades locais com empresa revisada, etapa, próxima ação, valor estimado e histórico. Verificar validação, concorrência, idempotência e filtros por testes de API.
- [x] 5. Vínculos de conversas a empresas/oportunidades, preservados no agrupamento. Verificar isolamento de empresa, rejeição de demo, remoção explícita e consolidação sem perda de contexto.
- [x] 6. Funil, ficha comercial da empresa e associação na conversa. Verificar navegação e formulários com banco de testes, sem cadastrar dados fictícios no cache real.
- [x] 7. Suíte completa, build, verificação desktop/celular, documentação e backup antes/depois da migração.

Verificação comercial: 185 testes passaram, build TypeScript/esbuild passou e npm audit sem vulnerabilidades. No navegador, instância temporária separada em 8766: criação de oportunidade fictícia, USD 1.500,50, mudança Qualificação → Proposta, data da próxima ação, histórico, associação à conversa, ficha da empresa, navegação e remoção explícita. Em 320 px, conteúdo sem overflow horizontal. Instância temporária encerrada. Migração 0007 aplicada ao cache principal com backup antes/depois; a tela Oportunidades foi conferida em 8765. Cache real continua com três candidatos pendentes, zero empresas aprovadas e zero oportunidades, sem importação dos dados fictícios. Campanhas continuam em simulação.

## Propostas e indicadores

- [x] 8. Proposta versionada com dados comerciais explícitos e aprovação vinculada a hash/versão da oportunidade; testes de preenchimento, concorrência e invalidação.
- [x] 9. Exportação Word derivada do papel timbrado, com estado de revisão inequívoco, hash do original preservado e inspeção visual em Word/PDF.
- [x] 10. Editor no contexto da oportunidade e indicadores locais com estimativas por moeda; testes de agregação e fluxo completo em banco temporário.
- [x] 11. Build, suíte, documentação e atualização local com backups e preservação dos candidatos reais pendentes.

Verificação de propostas: 207 testes passaram; build TypeScript/esbuild passou; npm audit completo sem vulnerabilidades. Dois documentos fictícios BR/US foram abertos no Word e conferidos visualmente em quatro páginas renderizadas. No navegador de testes: nova versão, revisão da prévia, aprovação interna, exportação Word, histórico somente leitura e indicadores. Edição pendente desabilita download; versão histórica desabilita Word revisado. Em 320 px, sem overflow horizontal; console sem erros. Instância temporária encerrada. Migração 0008 aplicada em 8765 com backups DPAPI antes/depois. Indicadores principais confirmam três candidatos pendentes e zero empresas, oportunidades e propostas; nenhuma mensagem enviada nesta etapa. Código de `conecta-crm/` continua sem commit, sem autorização para commit.

## Produção e entrega

- [x] 12. Acompanhamento por oportunidade com briefing, origem comercial opcional preservada, etapas manuais, entrega e feedback; validar idempotência, concorrência, datas e links com testes.
- [x] 13. Tela Projetos e ficha na oportunidade, filtros, histórico e proteção de alterações pendentes; conferir desktop e celular em banco separado.
- [x] 14. Suíte, build, documentação, backups e migração principal sem dados fictícios ou alterações em candidatos/e-mail.

Verificação de produção/entrega: 234 testes passaram (27 novos casos), build TypeScript/esbuild passou e npm audit sem vulnerabilidades. Banco temporário separado: criação com origem comercial revisada, bloqueio de proposta em rascunho, briefing, produção, entrega declarada, pós-venda, feedback, histórico e filtros; dados persistiram após reinício. Em 320, 768, 1024 e 1440 px, sem overflow horizontal; console sem erros. Instância de teste encerrada. Migração 0009 aplicada em 8765 com backups DPAPI anterior/posterior e tela principal conferida. Cache principal continua com três candidatos pendentes e zero empresas/oportunidades/propostas/projetos. Nenhum envio nesta etapa. Arquivos de `conecta-crm/` continuam sem commit.

## Revisão humana da triagem

- [x] 15. Revisões por mensagem, histórico e proteção contra conteúdo/versão desatualizados; integrar categoria efetiva aos filtros sem remover bloqueios.
- [x] 16. Editor de revisão na conversa e contagens de respostas confirmadas nas contas reais; conferir fluxos e responsividade em banco separado.
- [x] 17. Suíte, build, documentação, backups e migração principal; manter mensagens reais sem revisão automática e candidatos pendentes.

Verificação de revisão da triagem: 255 testes passaram (21 novos casos), build TypeScript/esbuild passou e auditoria npm sem vulnerabilidades. Na interface em banco separado: confirmação obrigatória, categorias e naturezas humana/automática/incerta, nova execução de regras sem perder a revisão, histórico de correção, bloqueio preservado e filtro da categoria revisada. Indicadores excluem demonstração e contam mensagens, sem inferir taxa de resposta. Em 320/768/1024/1440 px, sem overflow horizontal; console sem erros. Instância temporária encerrada. Migração 0010 aplicada em 8765 com backups DPAPI anterior/posterior. Indicadores principais conferidos: três mensagens recebidas com triagem ainda sem revisão humana, três candidatos pendentes e zero empresas/oportunidades/propostas/projetos. Nenhuma revisão real ou envio nesta etapa. Arquivos de `conecta-crm/` continuam sem commit.

## Contatos e empreendimentos

- [x] 18. Relatório de conferência dos candidatos FL, migração e API com fontes, versões, deduplicação e histórico, sem aprovar candidatos reais.
- [x] 19. Cadastro e edição na ficha da empresa, preenchimento explícito a partir de pesquisa aprovada, proteção de edições e verificação responsiva.
- [x] 20. Suíte, build, documentação, backups e migração principal preservando candidatos, mensagens e filas reais.

Verificação de contatos/empreendimentos: 280 testes passaram (25 novos casos), build TypeScript/esbuild aprovado e auditoria npm sem vulnerabilidades. Conferência pública dos três candidatos FL registrada em `docs/FL_PILOT_SOURCE_REVIEW_2026-11-08.md`, com estágio histórico, canais oficiais e acesso parcial da ficha ZOM explicitados; nenhum candidato real foi aprovado ou alterado. Em banco temporário: empresa fictícia aprovada, preenchimento de fonte, confirmação obrigatória, contato com e-mail, canal sem e-mail, edição/histórico, duplicata, descarte, isolamento entre empresas, empreendimento e data de estágio; busca conferida. Em 320/768/1024/1440 px, sem overflow horizontal e sem erros de console. Instância temporária encerrada. Migração 0011 aplicada em 8765, backups DPAPI anterior/posterior e tela Empresas conferida. Cache principal com três candidatos e três mensagens aguardando revisão, zero empresas/contatos/empreendimentos/oportunidades/propostas/projetos. Sem envios nesta etapa. Arquivos de `conecta-crm/` permanecem sem commit.


## Sincronização automática

- [x] 21. Migração aditiva, operação de leitura compartilhada, trabalhador local e testes de intervalo, lock, tentativas, backup, pausa concorrente e reinício.
- [x] 22. Controles por caixa, próxima consulta, falhas e aviso de novidades, preservando leitura aberta e edição não salva.
- [x] 23. Suíte completa, build, conferência com Resend simulado, documentação, backups e atualização principal sem envios/revisões/aprovações.

Verificação: 302 testes passaram (22 novos casos), build TypeScript/esbuild aprovado. Em banco separado com Resend simulado: ativação em 5 minutos, primeira importação automática, nova mensagem durante edição de revisão sem perder a nota, atualização impedida enquanto havia edição, descarte e leitura do histórico atualizado, metadado de anexo com tamanho desconhecido, limite HTTP 429 visível com próxima tentativa e pausa. Caixa e configurações sem overflow horizontal em 320/768/1024/1440 px; console sem erros/avisos. Instância QA encerrada. Migração 0012 aplicada ao cache principal com backup DPAPI anterior/posterior. As duas caixas já estavam conectadas: contact e team ativadas em 30 minutos, primeiras consultas concluídas sem erro, nenhuma mensagem nova nessas consultas. noreply fora da rotina. Três mensagens reais seguem sem revisão; três candidatos pendentes e zero empresas/contatos/empreendimentos/oportunidades/propostas/projetos. Campanhas permanecem simuladas; nenhum envio nesta etapa. Originais preservados. Download de anexos de Inboxes segue pendente de contrato de acesso confirmado no provedor, detalhado em docs/AUTO_SYNC.md. Arquivos de conecta-crm/ continuam sem commit.


## Anexos recebidos sob demanda

- [x] 24. Leitor restrito de arquivos, migração de auditoria e API com validação de caixa/mensagem/anexo, tamanho, expiração, URLs e segredos.
- [x] 25. Consulta e download por arquivo na mensagem, suporte a cache antigo sem IDs, limites e erros claros, sem interromper revisão em edição.
- [x] 26. Suíte completa, build/auditoria, QA com arquivos fictícios, documentação e atualização principal com backups.

Verificação: 373 testes passaram (71 casos novos), build TypeScript/esbuild aprovado e npm audit sem vulnerabilidades. Consulta somente leitura no Resend confirmou correspondência de UUID/Message-ID entre Inbox e Receiving para uma mensagem real do cache, sem anexo. Implementação revalida a identidade em cada operação; não presume que todos os IDs sejam equivalentes. Em banco separado com API/arquivos simulados: consulta sem transferência, cache antigo sem IDs, arquivo acima de 20 MB bloqueado, link vencido sem transferência e tentativa nova bem-sucedida, arquivo Unicode com diretório removido do nome, revisão não salva preservada. Dois downloads reais no navegador de arquivos fictícios de 62 bytes; bytes e SHA-256 conferidos, dois registros de preparação e nenhuma revisão. Em 320/768/1024/1440 px, sem overflow horizontal; console sem erros/avisos. QA encerrada. Migração 0013 e backups DPAPI anterior/posterior na instalação principal. Endpoint novo validado com mensagem real: lista vazia, pois as mensagens atuais não têm anexos; não houve download de arquivo real do CDN. contact/team continuam ativas em 30 minutos; três mensagens e três candidatos seguem sem revisão, zero empresas/contatos/empreendimentos/oportunidades/propostas/projetos. Nenhum envio nesta etapa. Limites: somente arquivos recebidos nesta etapa; CDN real ainda sem arquivo disponível para conferir. Arquivos de conecta-crm/ continuam sem commit.


## Análise assistida de trechos

- [x] 27. Migração/contrato/API de pacotes revisados, exportação mínima, importação estrita, citações, snapshots, idempotência e testes de isolamento/efeitos proibidos.
- [x] 28. Seleção e edição dos trechos, modos de análise/revisão, exportação, importação e evidências vinculadas à origem, com proteção de edição.
- [x] 29. Suíte, build/auditoria, QA fictício, documentação e atualização principal com backups.

Verificação: 400 testes passaram (27 casos novos), build TypeScript/esbuild aprovado e npm audit sem vulnerabilidades. Em banco separado: seleção inicialmente vazia, recorte de um trecho e ocultação de marcador privado; confirmação obrigatória; troca para revisão humana bloqueada durante edição; pacote Claude baixado no navegador e conferido sem marcador ocultado, mensagem não selecionada ou remetente. Nenhum agente foi executado. Importação de citação ausente recusada; resultado fictício válido exibido como sugestão com confiança declarada e links de origem, sem atualizar classificação ou revisão. Resultado continuou disponível após reabrir a página. Mensagem nova fictícia marcou o pacote como antigo e bloqueou exportação, preservando a sugestão. Em 320/768/1024/1440 px, sem overflow horizontal; console sem erros/avisos na sessão concluída. A automação não conseguiu inspecionar a confirmação nativa de troca de conversa na primeira sessão QA; a aba foi encerrada e a verificação retomada, sem alteração de dados reais. QA encerrada. Migração 0014 aplicada em 8765 com backups DPAPI anterior/posterior. Novo endpoint local conferido sem preparar/exportar conteúdo real: zero pacotes/vínculos/eventos de análise e zero revisões; três candidatos e três mensagens reais seguem pendentes, zero empresas/contatos/empreendimentos/oportunidades/propostas/projetos. contact/team seguem em 30 minutos. Nenhum envio nesta etapa. Modelo externo e qualidade de resumo real não foram testados. Arquivos de conecta-crm/ continuam sem commit.


## Qualificação comercial

- [x] 30. Migração, pesos versionados, catálogo de fontes da empresa, avaliação manual e ordenação com testes de vínculo, concorrência, histórico e efeitos proibidos.
- [x] 31. Tela de avaliação, acesso pela ficha da empresa, edição protegida, critérios desconhecidos, fontes e histórico.
- [x] 32. Documentação, atualização principal com backups e publicação autorizada na branch codex/crm-qualificacao, em PR separado do checkpoint #110.

Validação da implementação: 423 testes passaram (23 novos), build TypeScript/esbuild aprovado. Em banco fictício separado, conferidos pontuação completa, parcial com zero, fontes, pesos, histórico, nova conferência após mudança de modelo/fonte e conflito preservando os campos editados. Telas de avaliação e modelo sem overflow horizontal em 320/768/1024/1440 px; console sem erros/avisos. Nenhuma empresa real foi avaliada.

Atualização local conferida: migração 0015 aplicada com backups DPAPI anterior/posterior; nove originais da marca preservados. Instância QA encerrada. No CRM principal: zero empresas, avaliações e histórico de qualificação, modelo inicial v1, três candidatos e três mensagens sem revisão; zero oportunidades/propostas/projetos e zero pacotes/revisões de análise. contact/team mantidas em 30 minutos. Nenhum envio nesta etapa. Código salvo em codex/crm-qualificacao, separado do snapshot do PR #110; este permanece inalterado. Auditoria npm completa sem vulnerabilidades. Limite: notas manuais e vigência na base local, sem monitoramento ou validação factual automática das fontes.

Publicação pública explicitamente autorizada pelo usuário e concluída no [PR #111](https://github.com/ZGroote/Imobiliaria/pull/111), em rascunho. Base codex/crm-prospeccao, head codex/crm-qualificacao; o checkpoint do PR #110 permanece inalterado. Nenhum PR foi incorporado à main.


## Automação de agentes, pesquisa e envio autorizado

- [x] 33. Isolamento MXC comprovado, adaptador Codex limitado e testes.
- [x] 34. Execuções/agenda de pesquisa persistentes, fila, cancelamento e importação para revisão.
- [x] 35. Interface e QA da pesquisa automática, preservando decisão humana.
- [ ] 36. Envio autorizado com tentativas/idempotência/consulta remota e testes.
- [ ] 37. Interface de aprovação real e acompanhamento, QA fictício sem enviar e-mails reais.
- [ ] 38. Validação integrada, documentação, atualização local com backups e publicação separada.

Sonda real do MXC: pasta da tarefa legível, arquivo externo/credencial fictícia/rede local inacessíveis. Credencial de sonda removida após cada teste. Codex CLI 0.167.0-alpha.3.2 executou uma resposta estruturada mínima, sem ferramentas ou conteúdo privado. Dez testes do adaptador passaram; o agente recebe configuração fixa sem shell, conectores, plugins ou hooks do usuário.

Fila/API: 71 testes do adaptador, pesquisa e análise passaram, incluindo oito novos fluxos de execução. Verificados pausa inicial, agenda, isolamento de contas, confirmação de compartilhamento, importação somente em revisão, cancelamento vencendo saída tardia, exclusão de processos simultâneos por lease e interrupção preservada no reinício. Pacotes de análise usam apenas aliases/trechos revisados, sem pesquisa web.

Interface de agentes: build aprovado. No banco fictício, conferidos diagnóstico/ativação, fila pausada, confirmação obrigatória, pesquisa para candidatos sem aprovação, cancelamento e análise de trecho editado com confirmação de compartilhamento. Modo de revisão bloqueado durante edição; resultado continua sugestão com citação. Telas sem overflow horizontal em 320/768/1024/1440 px e console sem erros/avisos. O campo nativo de data não foi concluído pela automação de UI; agenda futura conferida nos testes de API. QA encerrada. Pesquisa pública real em banco separado: quatro consultas web e uma candidata com fontes, sem cadastro ou envio; estágio histórico não confirmado permaneceu unknown. A primeira tentativa retornou research_unavailable ao detectar host da busca desativado; configuração corrigida mantendo shell, conectores e acesso local bloqueados.
