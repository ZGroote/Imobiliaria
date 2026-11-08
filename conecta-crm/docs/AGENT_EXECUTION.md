# Execução de agentes e pesquisa

O CRM pode executar o Codex local para pesquisar empresas e analisar pacotes de trechos já revisados. Claude permanece na exportação/importação manual. Pesquisa não cadastra empresas nem habilita contato; análise não altera a triagem humana.

## Ativar e executar

Em **Tarefas assistidas**, use **Conferir isolamento do Codex**. A sonda trabalha somente com arquivos e uma credencial fictícios, removendo a credencial ao terminar. Ela precisa comprovar que a tarefa é legível, mas arquivo externo, credencial do usuário e conexão de rede local são inacessíveis. Sem isso a fila não é habilitada. A instalação oficial do Codex para Windows e sua sessão autenticada precisam estar disponíveis.

Ative a fila para executar as tarefas já confirmadas. Ela começa pausada e funciona enquanto o CRM estiver aberto. Pausar impede próximas execuções; cancelar interrompe uma tarefa específica. Há uma execução por vez, com bloqueio entre processos, até 15 minutos de execução e no máximo 80 consultas web. Tarefas em andamento ao encerrar o CRM ficam interrompidas; não são repetidas automaticamente.

Prepare uma pesquisa, confira o prompt, escolha agora ou uma data nos próximos sete dias e confirme a execução. O horário informado é o do navegador e fica gravado em UTC. Se o CRM não estiver aberto, tarefas ainda na fila aguardam a próxima abertura. O resultado passa pelo contrato existente, inclusive vínculo à tarefa, limites, fontes e datas, antes de entrar como candidato. Ausência de pesquisa web gera `research_unavailable`, sem completar a meta artificialmente.

Para analisar uma conversa, selecione mensagens, edite os trechos e prepare o pacote. Confira novamente os trechos exatos e confirme separadamente seu compartilhamento com o Codex. Somente aliases, direção e texto revisado entram na execução, sem anexos, cabeçalhos ou mensagens não selecionadas. Pesquisa web fica desativada para esse tipo de tarefa. Mudança da conversa antes da execução ou da importação exige outro pacote. Confira as citações e a interpretação do resultado.

Não importe manualmente enquanto houver execução confirmada para o mesmo pacote; cancele primeiro. Cancelamento vence resultado tardio. Campos editados não são substituídos por atualização automática do resultado; limpe/conclua a edição e reabra ou atualize o pacote.

## Fronteiras técnicas

Argumentos fixos de `codex exec`, sem comando fornecido pela página. Configuração do usuário, regras, hooks, conectores, plugins, ferramentas de shell, imagens locais, navegador, computador e subagentes ficam desativados. Instruções/skills do host não são descobertas. O host de orquestração da busca web permanece ativo porque esta versão do CLI depende dele; ele não reabilita as ferramentas locais desativadas. O MXC restringe comandos e seus descendentes à pasta da tarefa e ao mínimo do sistema, com rede direta desabilitada. Não existe fallback para execução sem isolamento.

O CLI confiável utiliza a autenticação local do Codex, fora do contexto do modelo. Chaves Resend, proxies e variáveis arbitrárias não são herdados pelo processo. O modelo recebe só o pacote explicitamente escolhido. Saída limitada a 256 KiB de JSON final e 4 MiB de eventos transitórios; logs da aplicação guardam estados/contagens, sem saída bruta do CLI. Pacotes/resultados locais ficam junto do cache pessoal, fora do Git. A identificação de modelo declarada no JSON continua sem verificação independente.

Migração `0016`: controle inicialmente pausado, execuções e eventos. Endpoints `/api/agent-runs`, `/control`, `/check`, `/{id}/cancel`, `/api/jobs/{id}/run` e `/api/thread-analyses/{id}/run`. Sessão/origem local obrigatórias; a API não aceita executável, argumentos ou caminhos de resultado.

## Verificação em 08/11/2026

Sonda real MXC e resposta estruturada mínima executadas com Codex CLI 0.167.0-alpha.3.2. Dez testes do adaptador e oito fluxos adicionais da fila; 71 casos de adaptador/pesquisa/análise passaram em conjunto. QA fictício no navegador: confirmação, pausa, cancelamento e importação para revisão, análise editada com citação e sem decisão humana automática; quatro larguras sem overflow e console sem erros/avisos. Agendamento futuro validado pela API; a automação de UI não concluiu a edição do campo nativo de data. Nenhuma mensagem real foi analisada.

Pesquisa pública pequena em banco separado: quatro consultas web, uma candidata e fontes retornadas, sem cadastro. A saída preservou `unknown` para o estágio atual não comprovado de um empreendimento com conclusão histórica. Isso comprova execução e importação do contrato, não a veracidade de todas as afirmações. A primeira tentativa retornou `research_unavailable` por configuração do host da busca; o resultado vazio foi preservado e a tentativa seguinte concluiu após correção.

Referências: [permissões](https://learn.chatgpt.com/docs/permissions), [sandbox Windows](https://learn.chatgpt.com/docs/windows/windows-sandbox), [configuração oficial do Codex](https://learn.chatgpt.com/docs/config-file/config-reference). As flags foram conferidas também no `--help` e no catálogo de features da versão instalada.
