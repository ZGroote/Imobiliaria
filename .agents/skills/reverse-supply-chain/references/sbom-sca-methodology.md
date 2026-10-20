# Dependências, advisories e SBOM

Adaptado do módulo supply-chain-security do reverse-skill, commit cab634bd855fc287f6e420c1f36fd1a6b9245960.

## Inventário deste projeto

- Node: leia package.json e package-lock.json na raiz e em painel/. A versão declarada no manifest pode diferir da versão realmente resolvida.
- Python: localize os requirements pertinentes e confira versões/limites/origens. Uma lista com versões mínimas não é um lock reproduzível; não deduza a versão instalada a partir dela.
- Diferencie código entregue ao usuário, serviços, ferramentas de build, testes e dependências transitivas. Dependências de build também podem comprometer artefatos ou credenciais.
- Integridade no lockfile detecta mudança de conteúdo; não prova que um pacote é benigno.

## Confirmar um advisory

1. Confirme o identificador, faixa afetada, versão corrigida e data na publicação do mantenedor, GitHub Advisory Database ou OSV.
2. Encontre a versão resolvida e o caminho até a dependência no lockfile. Use npm explain quando node_modules existente corresponder ao lockfile; registre se não corresponder.
3. Identifique a operação vulnerável, quem controla a entrada, ambiente, autenticação necessária e mitigação já existente.
4. Reproduza somente quando a tarefa exigir, com dados sintéticos e ambiente isolado. A consulta ao registry envia metadados; a revisão local não precisa enviar código.
5. Proponha uma atualização limitada. Confira a versão do pacote que introduz a dependência transitiva e a compatibilidade antes de sugerir overrides.

Priorize combinando impacto, exposição, evidência e disponibilidade da correção. Se o uso não foi demonstrado, mantenha o status como não avaliado em vez de declarar seguro.

## SBOM quando houver necessidade

CycloneDX e SPDX são formatos de inventário. Uma SBOM deve indicar o artefato/commit, ecossistemas cobertos, ferramenta/versão usada e limites de cobertura. Ela não substitui lockfiles, revisão de origem ou confirmação de vulnerabilidades.

Use ferramentas já disponíveis e versões verificadas. Um inventário inicial por manifests e lockfiles é suficiente para uma revisão de dependências sem requisito de SBOM. Não adicione servidores de monitoramento, contas, uploads ou tarefas agendadas por padrão.

## Fontes primárias para confirmação

- [npm audit](https://docs.npmjs.com/cli/commands/npm-audit)
- [GitHub Advisory Database](https://github.com/advisories)
- [OSV](https://osv.dev/)
- [CycloneDX](https://cyclonedx.org/)
- [SPDX](https://spdx.dev/)

Consulte a documentação atual quando for adotar comandos, formatos ou ferramentas adicionais.
