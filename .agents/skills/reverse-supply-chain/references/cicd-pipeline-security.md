# Checklist de CI e build

Adaptado do módulo supply-chain-security do reverse-skill, commit cab634bd855fc287f6e420c1f36fd1a6b9245960.

Use para revisar os workflows existentes; confirme a configuração atual e não copie um pipeline genérico.

- Eventos e confiança: verifique quem controla o código executado. Em pull_request_target ou workflow_run, conferir se dados/artefatos de PRs não confiáveis chegam a uma etapa com privilégios.
- Permissões: conceder ao GITHUB_TOKEN somente o necessário por workflow/job. Conferir credenciais persistidas pelo checkout e permissões de escrita.
- Injeção: acompanhar títulos, nomes de branches e outros dados externos até comandos de shell. Preferir variáveis de ambiente/argumentos tratados com segurança à interpolação direta.
- Actions e downloads: verificar origem e revisão fixa; evitar tags móveis na automação de segurança. Conferir a integridade de binários baixados quando houver digest publicado.
- Dependências: usar os lockfiles correspondentes e instalação reproduzível. Identificar scripts de instalação/build executados e as credenciais disponíveis a eles.
- Credenciais: revisar referências a secrets e sua exposição a passos, logs, caches e artefatos, sem ler ou imprimir valores. Preferir tokens limitados e de curta duração quando aplicável.
- Runners: avaliar isolamento, reutilização, caches e execução de contribuições não confiáveis, sobretudo em runners próprios.
- Artefatos: conferir bundles estáticos, mapas de origem, arquivos .env, chaves privadas, service accounts e caminhos incluídos no upload. Não presumir que todo mapa de origem contém um segredo.
- Firebase: testes e reproduções devem usar emuladores demo-painel. Credenciais de produção não são necessárias para validar Security Rules.
- Remediação: conservar os controles já existentes. Após uma alteração autorizada, testar a fronteira afetada e justificar permissões, versões e fontes introduzidas.

Neste projeto, comece por .github/workflows/ci.yml. Há controles de permissões, revisões de Actions e testes em emuladores que devem ser conferidos antes de propor novos workflows.

Fontes primárias: [segurança do GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) e [SLSA](https://slsa.dev/).
