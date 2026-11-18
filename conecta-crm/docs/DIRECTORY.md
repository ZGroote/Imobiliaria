# Contatos profissionais e empreendimentos pesquisados

Abra **Empresas**, selecione uma empresa já cadastrada após revisão humana e use **Contatos profissionais** ou **Empreendimentos pesquisados**. Esses cadastros enriquecem a pesquisa comercial. O acompanhamento de produção/entrega da Conecta continua no contexto da oportunidade, em Projetos e entregas.

## Contatos e canais públicos

Use **Novo contato** para registrar uma pessoa, equipe ou departamento. Informe nome, função conhecida e pelo menos um e-mail publicado ou canal HTTPS público, como formulário ou questionário para fornecedores. Não é preciso inventar e-mail quando a empresa oferece somente um formulário. Não inferir que um departamento representa uma pessoa específica.

Todo registro exige título e URL pública da fonte, data/hora de consulta em UTC e confiança declarada de 0 a 100%. Essa confiança é uma avaliação do operador, não uma comprovação automática. Registre nas observações a finalidade publicada do canal e qualquer incerteza. Não use e-mails de imprensa ou suporte como se fossem decisores comerciais sem evidência.

Marque **Conferi a fonte pública, a identidade e os dados deste registro** antes de salvar. Alterar um campo desmarca a confirmação. O cadastro normaliza o endereço de e-mail e exige um único endereço. O CRM não abre links, verifica a caixa postal, envia formulários ou gera mensagens nesse fluxo. Cadastro de contato não comprova consentimento nem libera envio.

## Empreendimentos pesquisados

Informe nome, cidade/UF, endereço quando conhecido, tipologia, estágio e fonte. O estado deve constar na atuação da empresa já revisada em Tarefas assistidas. Para incluir outro estado, revise uma nova pesquisa e confirme o vínculo da mesma organização.

Estágios disponíveis: não confirmado, em análise, aprovado, em construção e concluído com venda ativa. Qualquer estágio diferente de não confirmado exige uma data de evidência. Essa data não pode ultrapassar a data da observação nem o dia atual do calendário pessoal. Uma notícia de início de obra em 2025 comprova aquele momento; não confirma o estágio em 2026. Quando faltar fonte suficiente, mantenha **Estágio não confirmado** e registre a pendência.

## Preenchimento a partir de pesquisa

**Preencher a partir de pesquisa aprovada** copia um único contato ou empreendimento para o formulário. Esse botão fica disponível apenas para itens de candidatos aprovados daquela empresa. Os dados ainda exigem conferência e salvamento explícito. Aprovar uma empresa não cadastra automaticamente seus contatos ou empreendimentos.

O registro guarda o identificador da pesquisa de origem. Alterações posteriores no cadastro não reescrevem o resultado importado. A origem é imutável depois da criação; cadastros manuais podem ser criados sem esse identificador, mantendo a fonte pública obrigatória.

## Edição, duplicatas e histórico

A empresa do registro é imutável. O salvamento usa a versão aberta e recusa sobrescrita concorrente. Salvar sem mudanças não cria versão. Cada alteração preserva os dados anteriores no histórico; a interface mostra as 50 versões mais recentes e mantém as anteriores no banco.

A deduplicação é por empresa: contato com e-mail usa o endereço normalizado; contato sem e-mail usa a URL normalizada do canal. Empreendimento usa nome/cidade/estado com normalização de caixa, espaços e Unicode. Essas regras evitam repetições identificáveis e não substituem a conferência de identidades, renomeações ou grupos que compartilham canais. Dados iguais de empresas diferentes não são fundidos automaticamente.

Há busca por nome/e-mail nos contatos e por nome/cidade nos empreendimentos, com paginação. Alterações pendentes impedem trocar de cadastro/empresa ou limpar a ficha silenciosamente. **Descartar edição do cadastro** fecha o formulário sem salvar. A navegação entre páginas usa a proteção existente de alterações pendentes. Não há exclusão de registros nesta etapa.

## API e armazenamento

- `POST /api/contacts` e `PUT /api/contacts/{id}`.
- `POST /api/developments` e `PUT /api/developments/{id}`.
- `GET /api/companies/{company_id}/directory/contacts` e `/developments`: busca e paginação.
- `GET /api/companies/{company_id}/directory/{kind}/{id}`: registro e histórico da empresa correta.

Criação exige chave idempotente, confirmação das fontes e empresa cadastrada. Origem opcional precisa pertencer a candidato aprovado da mesma empresa. Edição exige versão atual. Entradas estritas/limitadas, consultas parametrizadas, tipo de cadastro em lista fechada e proteção local de sessão/origem. Datas futuras e URLs locais, com credenciais ou domínios de exemplo são recusadas.

A migração 0011 é aditiva. Dados e histórico ficam no cache local e entram nos backups DPAPI existentes; não são exportados para agentes nem incluídos em campanhas. O cadastro não altera mensagens, bloqueios, candidatos, oportunidades ou projetos de produção. A implantação principal não inclui os registros fictícios dos testes.

## Conferência do piloto e validação

O [relatório dos três candidatos da Flórida](FL_PILOT_SOURCE_REVIEW_2026-11-08.md) registra o que pôde ser confirmado e as pendências de fonte/estágio. Os candidatos permanecem aguardando decisão do operador.

Verificação: 280 testes, incluindo 25 casos dos cadastros, com validação de fontes/datas/canais, deduplicação, versões, histórico, origem e isolamento entre empresas. Build TypeScript/esbuild aprovado; auditoria npm sem vulnerabilidades. No navegador separado: preenchimento a partir da pesquisa, confirmação obrigatória, contato com e-mail e somente com formulário, edição, duplicata, descarte, mudança de empresa, empreendimento e referência de estágio. Em 320/768/1024/1440 px, sem overflow horizontal; console sem erros. Dados reais de contatos não foram cadastrados automaticamente.
