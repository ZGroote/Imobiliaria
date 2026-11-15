# Tarefa 4 do Visual — teste portátil + CI no GitHub (só infraestrutura de teste)

Galho: `ci/viabilidade-testes` (já está nele). **Não** mexa em `index.html`, motor, relatório, terreno, lei nem `conferir.py`. Não commite: a central commita.
Só dois arquivos: `viabilidade/visual/testar.cjs` e `.github/workflows/viabilidade.yml` (novo; único arquivo permitido fora de `viabilidade/`).

Contexto: `viabilidade/auditoria/CI-PROPOSTA.md` (seção 2 = conserto do teste; seção 3 = YAML) e `viabilidade/VERIFICACAO-1A.md` seção 4 (ajustes obrigatórios).

## 1. `testar.cjs` portátil

- Linhas 7–8: Playwright por `require('playwright')` normal (resolve por `NODE_PATH` no CI); se não achar, cai no caminho atual do runtime Codex desta máquina. Mesma coisa pro `PNG` de `playwright-core/lib/utilsBundle.js`.
- Linha ~46 (`executablePath` do Chrome do Windows): usar `process.env.CHROME_PATH`; se não houver, o Chrome do Windows **só se o arquivo existir**; senão, o Chromium do próprio Playwright.
- Nada mais muda no teste (mesmas asserções, mesmos prints).

## 2. `.github/workflows/viabilidade.yml`

Partir do YAML da CI-PROPOSTA, com estes ajustes:
- Gatilhos: `push` em `feat/viabilidade` e `ci/viabilidade-testes`; `pull_request` **para** `feat/viabilidade`. **Nada** de `pull_request` para `main`.
- Ações fixadas por SHA, iguais ao `.github/workflows/ci.yml` (`checkout@3d3c42e5…` v7.0.1, `setup-node@82076278…` v7.0.0, `setup-python@5fda3b95…` v7.0.0). Pra `upload-artifact`, use o SHA da versão mais recente que você conseguir confirmar e escreva a tag no comentário; se não conseguir confirmar, deixe `@v4` com um comentário `# TODO fixar SHA`.
- `permissions: contents: read`; `timeout-minutes: 15`; `concurrency` como no ci.yml.
- Dependências Python: confira os `import` de `viabilidade/motor`, `viabilidade/terreno` (inclui `dados/*-reproduzir.py`, `preparar_*.py`, `adicionar_pilotos.py`) e `viabilidade/lei`; instale só o que é usado.
- Playwright fora da árvore (`/tmp`, `NODE_PATH`) e `playwright install --with-deps chromium`.
- Rodar `python -I -X utf8 viabilidade/conferir.py --base origin/main`; artefato `viabilidade/.conferir/` com `if: always()` e `include-hidden-files: true`.

## Teste

- Você não consegue abrir o Chrome no sandbox: **não tente**. A central roda `conferir.py` aqui no Windows e depois o CI no GitHub.
- Confira só a sintaxe: `node --check viabilidade/visual/testar.cjs`.

## Relatório

`viabilidade/visual/RELATORIO-4.md`, até 10 linhas (o que mudou + pacotes Python escolhidos e de qual import veio cada um). Depois: `maestri ask "Claude Code" "Visual tarefa 4 pronta"`.
