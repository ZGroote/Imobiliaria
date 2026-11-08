# Pesquisa direcionada de empresa

Abra **Empresas**, escolha uma empresa cadastrada após revisão e entre em **Pesquisar esta empresa**. Selecione um estado dos EUA que já conste da atuação conferida e escolha Codex ou Claude. Preparar cria uma tarefa e abre sua prévia em **Tarefas assistidas**. A tarefa se refere a uma única organização e não executa nada ao ser criada.

Confira o prompt antes de confirmar a execução isolada do Codex ou baixar o pacote para o fluxo manual do Claude. A fila existente continua pausada por padrão, com agenda, progresso e cancelamento. O pacote inclui somente o nome, domínio, origem HTTPS pública e estado escolhidos, além do identificador necessário para o vínculo local. Caminhos, parâmetros e fragmentos da URL original ficam de fora, assim como contatos do cadastro, notas, conversas, credenciais e e-mails.

O resultado pode vir vazio. Um candidato precisa usar o domínio exato da organização escolhida, normalizando www. A pesquisa não troca o alvo por homônimos, concorrentes ou subsidiárias com outros domínios. O contrato de fontes e datas é o mesmo da pesquisa geral. A presença da empresa no cadastro não confirma fatos novos, estágio atual ou autorização de contato.

O resultado fica pendente até você conferir as fontes e confirmar o vínculo à mesma organização. A aprovação acrescenta uma pesquisa ao histórico da empresa existente. Ela não substitui contatos, empreendimentos ou notas; você pode conferir e cadastrar itens na ficha. A revisão pode exigir nova qualificação quando muda a base de fontes. Não há criação de rascunho, permissão de destinatário ou envio automático.

Se nome, domínio, origem HTTPS ou estado de atuação deixarem de corresponder ao alvo, o CRM preserva a tarefa e impede nova exportação, execução, primeira importação ou aprovação. Uma tarefa já agendada revalida o alvo antes do agente e antes de importar. Cancele uma execução pendente e prepare outra tarefa quando os dados mudarem. O histórico e a rejeição de um candidato permanecem disponíveis.

## Implementação e verificação

A migração 0019 adiciona dois campos opcionais de alvo às tarefas, com referência à empresa, sem recriar a tabela. Tarefas gerais e seus hashes anteriores permanecem válidos. O endpoint `POST /api/companies/{id}/research-jobs` valida estado, identidade, agente, confirmação e chave idempotente. Usa as rotas, contrato de resultado e trabalhador já existentes. O pacote exportado inclui o alvo público para conferência. Referência técnica: [SQLite ADD COLUMN](https://www.sqlite.org/lang_altertable.html#alter_table_add_column).

Validação: 508 testes passaram após corrigir um teste que presumira a ordem entre tarefas com o mesmo horário fixo. No navegador, empresa e agente fictícios: estado explícito, proteção de edição, abertura automática da tarefa, cancelamento durante preparação, Claude manual, fila pausada, confirmação, execução simulada e resultado pendente. O JSON baixado não continha os marcadores privados de URL. Uma mudança fictícia de identidade bloqueou exportação e aprovação; o resultado permaneceu preservado após reabrir. Em 320/768/1024/1440 px, formulário e detalhe sem overflow; console sem erros/avisos. Não houve pesquisa web ou e-mail real nesta etapa.

A pesquisa é voltada aos estados americanos já cadastrados. Cobertura de outros mercados, monitoramento automático de fontes e recomendações de pacotes recorrentes continuam fora deste incremento.
