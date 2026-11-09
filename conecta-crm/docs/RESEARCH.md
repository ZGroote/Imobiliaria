# Tarefas assistidas e empresas

## Atualização: agentes e comunicações autorizadas

Pesquisa pode executar Codex isolado e agendado, com cancelamento e importação automática para candidatos pendentes. Veja [execução de agentes](AGENT_EXECUTION.md). Claude permanece por importação manual; resultados não cadastram empresa nem autorizam contato.


O fluxo funciona sem executor de IA: preparar tarefa → exportar prompt e schema → pesquisar em sessão assistida escolhida pelo operador → importar JSON → revisar candidato → cadastrar empresa. Esta etapa não inicia Codex/Claude, não agenda pesquisa, não acessa mensagens/credenciais e não consulta as URLs importadas. O teste de e-mail bem-sucedido não altera essas permissões nem habilita a fila comercial.

## No painel

1. Abra **Tarefas assistidas**, escolha estado dos EUA, meta de 1 a 50, porte e sessão assistida. **Preparar tarefa** grava os parâmetros e o prompt, sem executar pesquisa.
2. Confira **Ver prompt da tarefa** e use **Baixar pacote com prompt e contrato JSON**. O pacote contém `job_id`, prompt, hash dos inputs e schema. Não contém e-mails, banco local ou credenciais.
3. Em uma sessão de pesquisa de sua escolha, forneça o prompt e o schema. O resultado deve ser somente o objeto JSON de pesquisa, não o pacote inteiro nem um bloco Markdown. A ferramenta precisa ter acesso real à pesquisa; se não tiver, o resultado correto é `companies: []` com `research_unavailable` nos avisos.
4. Importe o arquivo `.json` ou cole seu conteúdo. O painel limita a entrada a 250 KB; a API limita o corpo completo a 256 KiB. A importação é transacional, vinculada ao `job_id`, estado e meta. Um erro não importa parte dos candidatos.
5. Cada empresa aparece como candidata, com fontes, projetos, contatos publicados, datas e confiança declarada. Essas informações ainda não foram comprovadas pelo CRM.
6. Abra as fontes, confira a identidade, a atuação nos estados e o empreendimento de apartamentos. Confirme a declaração e use **Aprovar e cadastrar empresa**, ou rejeite individualmente. Nota da revisão é opcional. Aprovar não cria rascunhos nem autoriza contato.
7. Na tela **Empresas**, busque por nome/domínio ou filtre por estado. Cada cadastro preserva os resultados de origem, a tarefa, a data e a nota da revisão. Projetos e contatos ainda são consultados dentro desses resultados; não há funil de oportunidades nesta etapa.

Pode haver menos candidatos que a meta. Não completar a quantidade com empresas imaginárias. Construtoras sem atribuição de incorporação, corretoras e pesquisas sem empreendimento compatível podem ser importadas para revisão, mas a aprovação para o cadastro deste segmento é bloqueada. Empresa sem e-mail público pode ser aprovada; nenhum e-mail é adivinhado.

## Integridade e revisão

O contrato exige fontes HTTPS, títulos, datas observadas com fuso e confiança de 0 a 1. Rejeita URLs com credenciais, IPs, destinos locais e domínios reservados de exemplo. Não resolve DNS nem garante que uma URL exista ou que seja pública de fato: essa é uma conferência humana antes de abrir/cadastrar. Os links só geram navegação quando o operador os abre; não há busca automática, prévia externa ou acesso indireto ao servidor local.

JSON é validado com campos extras proibidos, tipos e limites. Não é permitido `status: verified`, instruções de envio ou aprovação automática. Texto de fontes é mostrado como texto escapado; não vira HTML, comando ou prompt executado. Datas futuras de geração, observação, documento ou estágio são recusadas.

Cada tarefa aceita um resultado imutável. Reimportar o mesmo resultado normalizado devolve os candidatos existentes, sem duplicar registros ou auditoria. Para corrigir/substituir um resultado, prepare nova tarefa. Decisões individuais são preservadas; repeti-las não duplica cadastro. Cancelar bloqueia novas importações/decisões e conserva empresas já aprovadas.

O domínio normalizado, sem `www.`, identifica um possível cadastro existente. Não se calcula domínio registrável nem se infere que subdomínios diferentes sejam a mesma empresa. Uma nova aprovação com domínio já cadastrado exige confirmação explícita da mesma organização; nomes e site do cadastro original não são sobrescritos. Estados e fontes são acrescentados sem duplicação. Organizações diferentes que compartilham um domínio devem ser rejeitadas nesta etapa e revisadas antes de ampliar o modelo de identidade.

## API e contrato

- `GET /api/jobs/options` e `/api/jobs/schema`.
- `POST /api/jobs`, `GET /api/jobs` e `/api/jobs/{id}`.
- `GET /api/jobs/{id}/export`, `POST /api/jobs/{id}/import` com `{ "result": ... }`.
- `POST /api/jobs/{id}/candidates/{candidate_id}/review`: confirmação específica, hash, decisão, declaração de fontes e confirmação de vínculo quando necessário.
- `POST /api/jobs/{id}/cancel`: confirmação específica.
- `GET /api/companies` com busca/estado/paginação e `/api/companies/{id}` com resultados de origem.

Todas as rotas usam a proteção local de sessão/origem existente. Dados ficam no cache e nos backups criptografados, fora do Git. O contrato de referência `contracts/research_result.schema.json` é gerado por `ResearchResult.model_json_schema()`; o endpoint entrega o mesmo schema. A validação adicional de URLs e do contexto da tarefa é feita no backend.

## Situação do envio

O operador confirmou sucesso do teste individual. SPF/DKIM foram confirmados pelo Resend e DMARC foi encontrado em monitoramento. A [política atual do Resend](https://resend.com/legal/acceptable-use), consultada em 08/11/2026, proíbe cold outreach, mensagens não solicitadas e listas compradas/coletadas. Empresas pesquisadas não são, por isso, destinatárias consentidas.

A fila permanece em simulação. Endereço postal, origem/consentimento dos contatos, identidade por mercado, política do transporte e limites da conta ainda precisam ser tratados antes de qualquer expansão de envio real. Não há troca automática de provedor ou tentativa de contornar essas condições.

## Próximos passos

Foi importada uma pesquisa piloto de três candidatos na Flórida, com fontes oficiais e avisos de incerteza, todos aguardando revisão. Nenhum contato foi adivinhado nem cadastro aprovado automaticamente. O próximo passo é revisar esses resultados; os [vínculos com conversas e o funil de oportunidades](COMMERCIAL.md) já estão disponíveis para empresas cadastradas. Executor automático permanece pendente de isolamento efetivo do processo, sem acesso ao usuário Windows que guarda as credenciais.

Referências técnicas: [validadores Pydantic](https://docs.pydantic.dev/latest/concepts/validators/) e [corpos validados no FastAPI](https://fastapi.tiangolo.com/tutorial/body/).


A ficha de uma empresa cadastrada também permite [pesquisa direcionada](COMPANY_RESEARCH.md) de uma única organização em um estado de atuação conferido. O pacote é público e mínimo; o resultado passa pela mesma revisão e exige confirmação de vínculo.
