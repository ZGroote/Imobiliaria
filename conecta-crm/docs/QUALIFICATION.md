# Qualificação comercial

Abra **Qualificação comercial** no menu ou **Qualificar empresa** na ficha de uma empresa revisada. A avaliação é manual e local. Pontos não são probabilidade de fechamento nem autorização de contato.

O modelo inicial distribui 100 pontos entre relevância para a plataforma 3D (25), estágio comercial (20), quantidade/recorrência de projetos (20), qualidade das evidências e contatos (20) e adequação da demonstração (15). Em **Pesos dos critérios**, os cinco pesos podem mudar, sempre como inteiros positivos que somam 100, com motivo e versão.

## Avaliar uma empresa

1. Confira os dados e as datas das fontes. Uma fonte antiga não demonstra, por si só, que um projeto continua ativo.
2. Preencha os pontos de cada critério, entre zero e seu peso máximo. Deixe em branco o que ainda é desconhecido.
3. Para cada nota, inclusive zero, escreva uma justificativa de pelo menos cinco caracteres e marque de uma a cinco fontes da própria empresa. Podem ser itens de pesquisa aprovada, contatos profissionais ou empreendimentos cadastrados. O CRM valida formato e vínculo; não consulta nem comprova o conteúdo das páginas.
4. Confirme a conferência e salve. Avaliações parciais são permitidas. Sem fontes, só é possível guardar observações, sem atribuir notas.

Uma avaliação parcial mostra pontos e capacidade dos critérios preenchidos, além do número de critérios desconhecidos. Não recebe um total comparável. Zero é uma nota explícita; desconhecido não vira zero.

Só avaliações completas com o modelo e a base cadastrada vigentes são ordenadas por pontos, do maior para o menor. Empates usam nome e ID. As demais ficam depois, por nome; busca, estado, situação e paginação ajudam a localizar empresas. As contagens consideram a busca e o estado, antes do filtro de situação.

## Nova conferência e histórico

Mudar os pesos, os dados da empresa, seus estados, as pesquisas aprovadas ou as versões dos contatos/empreendimentos marca a avaliação salva como **Requer nova conferência**. O total antigo fica identificado como histórico e sai da ordenação por pontos. Reabra, confira limites, notas e fontes, confirme e salve uma nova versão. Não há recálculo proporcional silencioso.

O histórico mantém justificativas, pontos, pesos e os metadados das fontes usados em cada versão. A tela apresenta as 50 avaliações e as 20 versões de modelo mais recentes; registros anteriores permanecem no banco. Links históricos podem ter mudado ou deixado de existir na internet.

Alteração simultânea do modelo, da base ou da avaliação recusa o salvamento. Os campos editados ficam na tela; **Descartar edição e reabrir** carrega a base atual. Filtros, troca de empresa e de modelo ficam bloqueados durante edição. A navegação principal mantém a confirmação de descarte já existente no CRM.

“Vigente” significa compatível com a versão da base local. Não garante atualidade no mundo real: páginas não são monitoradas e não existe expiração por idade nesta etapa. Uma avaliação idêntica à já salva é idempotente e não cria versão adicional.

## Dados e verificação

Migração aditiva `0015`: `qualification_policy_history`, `company_qualifications` e `qualification_history`. Rotas locais protegidas por sessão e origem em `/api/qualifications`, `/policy` e `/companies/{id}`. O limite de corpo é 64 KiB; fontes de outra empresa, campos extras, notas inválidas e versões antigas são recusados.

Verificação em 08/11/2026: 423 testes passaram, incluindo 23 casos de qualificação. Build TypeScript/esbuild aprovado. No navegador, com três empresas fictícias em banco isolado: nota completa, parcial com zero e quatro desconhecidos, confirmação obrigatória, pesos com soma inválida, mudança de modelo, nova conferência, histórico com pesos originais, acesso pela ficha da empresa e edição protegida. Alterar uma fonte durante a edição produziu conflito sem sobrescrever os campos; reabertura e nova confirmação funcionaram. Avaliação e modelo sem overflow horizontal em 320, 768, 1024 e 1440 px; console sem erros/avisos.

Não houve avaliação de empresas reais, aprovação de candidatos, criação de oportunidades, rascunhos ou envios. Não houve execução de agente externo. A qualidade comercial das notas depende da conferência do operador; o teste visual usou dados fictícios.

Instalação principal atualizada para 0015 com backups DPAPI anterior/posterior e nove originais conferidos por hash. O modelo inicial segue em v1 e não há avaliações reais. As rotinas contact/team continuam em 30 minutos. Auditoria npm completa sem vulnerabilidades. O desenvolvimento desta etapa usa codex/crm-qualificacao, derivada de codex/crm-prospeccao; o snapshot do PR #110 foi preservado.

Publicação pública autorizada pelo usuário: [PR #111 — qualificação comercial](https://github.com/ZGroote/Imobiliaria/pull/111), em rascunho, com base em codex/crm-prospeccao para revisão somente desta etapa. O checkpoint do PR #110 foi preservado; nenhuma incorporação à main foi realizada.
