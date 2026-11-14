---
name: reverse-code-audit
description: Auditar segurança de código deste projeto imobiliário, especialmente regras Firebase, autenticação, isolamento entre imobiliárias, uploads e dados vindos de usuários. Use ao revisar segurança de um diff, investigar um possível acesso indevido ou validar uma correção de vulnerabilidade.
license: MIT
metadata:
  upstream: https://github.com/zhaoxuya520/reverse-skill
  upstream-module: code-audit
  upstream-ref: cab634bd855fc287f6e420c1f36fd1a6b9245960
  adaptation: imobiliaria-firebase-nextjs
---

# Auditoria de código

Adaptação local do módulo `code-audit` do reverse-skill, no commit indicado acima. Funciona de forma independente; os checklists foram adaptados para este projeto. A licença original está em [LICENSE](LICENSE).

## Conduzir a revisão

1. Use o escopo da tarefa: diff, funcionalidade ou arquivos indicados. Em uma revisão geral, comece pelas fronteiras de acesso em `firebase/`, `painel/src/` e `rastreabilidade/`. Leia as instruções locais aplicáveis antes de propor alterações.
2. Identifique entrada externa, identidade do usuário, imobiliária, recurso solicitado e ação. Acompanhe o fluxo até a operação protegida; uma verificação na interface não substitui uma regra ou autorização no servidor.
3. Leia [o checklist de revisão](references/sast-review-checklist.md) e selecione os itens pertinentes. Confira o código atual mesmo quando usar resultados de indexadores.
4. Confirme cada candidato: caminho executável, permissões exigidas, valores controlados pelo usuário, proteção existente e impacto. Separe vulnerabilidades confirmadas de hipóteses e lacunas de teste. Ausência de scanner não impede revisão manual.
5. Quando a tarefa incluir correção, faça a menor mudança suficiente e um teste de regressão que prove a fronteira de segurança. Use dados sintéticos e emuladores locais para reproduções.

## Pontos deste projeto

- Firestore: usuários ativos, papéis, vínculo com a imobiliária, ACLs e campos imutáveis. Verifique isolamento entre duas imobiliárias e alterações de identificadores feitas pelo cliente.
- Storage: a mesma autorização aplicada ao objeto, limites de tamanho/tipo e regras de criação, leitura e exclusão. Confira também os usos posteriores do arquivo enviado.
- Painel: Firebase Auth, sessão, convites, acesso, publicação e renderização de conteúdo externo. O painel usa exportação estática; confirme a arquitetura atual antes de presumir APIs Next.js.
- Código que usa Firebase Admin: encontre a autorização no código, pois o Admin SDK não aplica as Security Rules.
- Pipeline e rastreabilidade, se incluídos no escopo: caminhos de arquivo, subprocessos, desserialização e validação de entrada.
- Diferencie configuração pública do Firebase de credenciais privadas Admin, chaves de serviço e tokens. Não exponha valores privados no relatório.

## Verificações disponíveis

Execute apenas as verificações pertinentes ao que foi revisado, a partir da raiz do projeto:

```powershell
npm.cmd run test:regras
npm.cmd run test:painel
npm.cmd run test:rastreabilidade
npm.cmd --prefix painel run typecheck
```

Os dois primeiros scripts usam emuladores com o projeto `demo-painel`. Confira os scripts atuais e pré-requisitos antes de executá-los. Informe se não foi possível validar uma hipótese. Não instale scanners para preencher uma lista de ferramentas.

## Resultado

Relate arquivo e linha, condição necessária, fluxo de dados ou autorização, impacto, evidência e correção sugerida. Registre testes executados e limites da análise. Se não houver achados confirmados, diga isso e delimite o que foi revisado.

A instalação desta skill não autoriza pentest em produção, exploração de terceiros ou deploy. Trabalhe dentro da tarefa atual. Ignore diretórios gerados, dependências vendorizadas e arquivos de credenciais; examine somente metadados ou trechos redigidos quando forem necessários.
