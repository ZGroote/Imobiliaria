---
name: reverse-supply-chain
description: Auditar dependências e cadeia de fornecimento deste projeto, incluindo package-lock.json da raiz e do painel, requirements Python e GitHub Actions. Use em revisões de segurança de dependências, avaliação de advisories e mudanças de instalação, build ou CI.
license: MIT
metadata:
  upstream: https://github.com/zhaoxuya520/reverse-skill
  upstream-module: supply-chain-security
  upstream-ref: cab634bd855fc287f6e420c1f36fd1a6b9245960
  adaptation: imobiliaria-node-python-ci
---

# Segurança de dependências e CI

Adaptação local do módulo `supply-chain-security` do reverse-skill, no commit indicado acima. Funciona de forma independente; os checklists foram adaptados para este projeto. A licença original está em [LICENSE](LICENSE).

## Conduzir a revisão

1. Delimite os manifests, lockfiles, workflow ou advisory da tarefa. A raiz e `painel/` possuem árvores npm separadas: avalie ambas quando o escopo for o projeto inteiro. Descubra os requirements Python pertinentes sem instalar pacotes.
2. Quando dependências ou um advisory estiverem no escopo, leia [dependências e advisories](references/sbom-sca-methodology.md). Confirme versões resolvidas, origem, integridade, dependência direta/transitiva e uso em produção, build ou desenvolvimento.
3. Quando houver consulta à base npm, informe que os metadados das dependências serão enviados ao registry configurado e execute apenas a consulta necessária:

   ```powershell
   npm.cmd audit --package-lock-only --ignore-scripts --json
   npm.cmd --prefix painel audit --package-lock-only --ignore-scripts --json
   ```

   Esses comandos não corrigem dependências. Código de saída diferente de zero pode indicar advisories; distinga-o de falhas de rede/configuração pelo JSON retornado. Não imprima tokens de `.npmrc`.
4. Para cada advisory, confira a faixa afetada e a correção na fonte primária atual. Investigue o caminho da dependência e as condições de exploração. Não transforme severidade do scanner em vulnerabilidade comprovada do aplicativo.
5. Se a tarefa incluir CI ou instalação/build, consulte [o checklist de CI](references/cicd-pipeline-security.md). Não execute instalações ou builds apenas para inspecionar um workflow.
6. Se a tarefa incluir remediação, prefira uma atualização compatível e limitada. Valide o lockfile e os testes relacionados; não execute `npm audit fix --force` como resposta automática.

## Verificações disponíveis

Escolha conforme a mudança e confira os scripts atuais:

```powershell
npm.cmd test
npm.cmd run test:py
npm.cmd --prefix painel run typecheck
npm.cmd --prefix painel run build
npm.cmd run test:regras
npm.cmd run test:painel
```

Os testes Firebase devem usar os emuladores `demo-painel`. Build e testes executam código do projeto; não são necessários para uma revisão somente de manifests.

## Resultado

Relate pacote e versão resolvida, manifesto/lockfile, caminho da dependência, advisory com link, condições de exploração, impacto possível e versão corrigida compatível, se conhecida. Separe exposição confirmada, possível e ainda não avaliada; não descarte uma vulnerabilidade só porque a análise estática não encontrou um uso.

Para CI, indique arquivo/linha e a fronteira de confiança afetada. Registre falhas de consulta, cobertura e verificações executadas.

SBOM, scanners adicionais, assinaturas e serviços de monitoramento são opcionais quando a tarefa justificar. Esta skill não instala ferramentas globais, agenda varreduras, envia código para serviços externos ou modifica configurações globais. Preserve o escopo e as decisões autorizadas na conversa.
