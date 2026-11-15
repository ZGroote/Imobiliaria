# Proposta de CI — Conferência Automatizada (`viabilidade/conferir.py`)

Esta proposta define o workflow do GitHub Actions para rodar [conferir.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/conferir.py) a cada `push` (e `pull_request`) na branch `feat/viabilidade`, atendendo aos requisitos **VF-010** e **VF-011** do [PRD-VIABILIDADE-1.0.md](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/PRD-VIABILIDADE-1.0.md).

> **Nota de escopo (Portão 1A):** nenhum arquivo foi criado em `.github/` nem alterado em `viabilidade/visual/`. O YAML e o patch mínimo abaixo estão prontos para aplicação no Portão 1B.

---

## 1. Diagnóstico das Dependências por Etapa do `conferir.py`

O script [conferir.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/conferir.py#L68-L86) executa 5 suítes em subprocessos (`python -I -X utf8 ...` e `node ...`) mais a verificação git `fora_do_modulo`:

| Etapa | Comando executado pelo `conferir.py` | Dependências externas exigidas |
| :--- | :--- | :--- |
| **`motor`** | `python -I -X utf8 -m unittest discover -s viabilidade/motor -p test_*.py -v` | Python: `shapely` ([motor.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/motor/motor.py#L10)) |
| **`terreno`** | `gerar_lotes.py --testar`, `preparar_relevo.py --testar`, `testar_pilotos.py` | Python: `numpy`, `shapely`, `pyproj`, `rasterio` ([gerar_lotes.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/gerar_lotes.py#L16-L25), [preparar_relevo.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/preparar_relevo.py#L20-L28)) |
| **`relatorio`** | `python -I -X utf8 viabilidade/relatorio/test_relatorio.py` | Biblioteca padrão do Python (`unittest`, `html.parser`, `json`, `math`, `re`) |
| **`lei`** | `python -I -X utf8 viabilidade/lei/gera_zonas.py` + comparação byte a byte de `zonas.json` | Biblioteca padrão do Python |
| **`visual`** | `node viabilidade/visual/testar.cjs` | Node 24 + `playwright` (`chromium` + `playwright-core`) + dependências de sistema do Chromium headless |
| **`fora_do_modulo`** | `git diff --name-only origin/main...HEAD` e `git status --porcelain` | Git com histórico completo (`fetch-depth: 0`) para que `origin/main` exista no runner |

### Cuidado com `python -I` no Linux
Todos os comandos Python em [conferir.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/conferir.py#L68-L83) usam a flag `-I` (*isolated mode*), que ignora `PYTHONPATH` e o `user site-packages` (`~/.local/lib/...`). Portanto, no GitHub Actions, o `pip install` **não pode usar `--user`**: os pacotes `numpy`, `shapely`, `pyproj` e `rasterio` devem ser instalados direto no `site-packages` global da instância Python 3.14 provisionada pelo `actions/setup-python`.

---

## 2. Problema Conhecido em `viabilidade/visual/testar.cjs` e Menor Conserto Possível

Em [testar.cjs](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/visual/testar.cjs), há **dois pontos** com caminhos absolutos de Windows que quebram em qualquer outra máquina ou runner Linux:

1. **Linhas 7–8 (imports do Playwright fixos no cache local do usuário Windows):**
   ```js
   const { chromium } = require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
   const { PNG } = require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/lib/utilsBundle.js');
   ```
2. **Linha 46 (`executablePath` fixo no Google Chrome de Windows):**
   ```js
   const browser = await chromium.launch({
     executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
     headless: true, args: ['--enable-unsafe-swiftshader'],
   });
   ```

### Menor conserto proposto para `viabilidade/visual/testar.cjs`
Substituir as linhas 7–8 e 45–48 por uma resolução com fallback automático (mantém funcionamento zero-config na máquina Windows atual e funciona nativamente no Ubuntu CI com `NODE_PATH` / Playwright padrão):

```js
// Substituição para as linhas 7-8 de viabilidade/visual/testar.cjs:
const PW_CACHE = 'C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const pwBase = fs.existsSync(PW_CACHE) ? PW_CACHE + '/' : '';
const { chromium } = require(pwBase + 'playwright');
const { PNG } = require(pwBase + 'playwright-core/lib/utilsBundle.js');
```

```js
// Substituição para as linhas 45-48 de viabilidade/visual/testar.cjs:
const WIN_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.CHROME_PATH || (fs.existsSync(WIN_CHROME) ? WIN_CHROME : undefined);
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true, args: ['--enable-unsafe-swiftshader'],
});
```

**Por que esse é o menor conserto seguro:**
- Não exige criar `package.json` nem `package-lock.json` dentro de `viabilidade/` (no CI basta instalar `playwright` em um diretório temporário fora do repositório, como `/tmp/pw`, e exportar `NODE_PATH=/tmp/pw/node_modules`, mantendo `git status --porcelain` 100% limpo para a etapa `fora_do_modulo`).
- Continua rodando no Windows local sem precisar baixar outro Chromium se o Chrome já estiver instalado.
- No Ubuntu CI, como `WIN_CHROME` não existe, `executablePath` fica `undefined` e o Playwright usa o binário do Chromium instalado por `npx playwright install --with-deps chromium`.

---

## 3. YAML Completo Proposto (`.github/workflows/viabilidade-conferir.yml`)

```yaml
name: Conferir Viabilidade

on:
  push:
    branches:
      - feat/viabilidade
  pull_request:
    branches:
      - main
      - feat/viabilidade

jobs:
  conferir:
    name: Portão de Qualidade (conferir.py)
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout com histórico completo (necessário para origin/main)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configurar Python 3.14
        uses: actions/setup-python@v5
        with:
          python-version: '3.14'
          allow-prereleases: true
          cache: 'pip'

      - name: Configurar Node 24
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Instalar dependências Python (motor e terreno)
        run: |
          python -m pip install --upgrade pip
          python -m pip install numpy shapely pyproj rasterio

      - name: Instalar Playwright e Chromium fora da árvore git
        run: |
          mkdir -p /tmp/viabilidade-pw
          npm --prefix /tmp/viabilidade-pw install --no-save playwright
          npx --prefix /tmp/viabilidade-pw playwright install --with-deps chromium

      - name: Executar viabilidade/conferir.py
        env:
          NODE_PATH: /tmp/viabilidade-pw/node_modules
        run: |
          python -I -X utf8 viabilidade/conferir.py --base origin/main --saida viabilidade/.conferir

      - name: Publicar logs e resumo (.conferir/) como artefato
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: viabilidade-conferir-logs-${{ github.sha }}
          path: viabilidade/.conferir/
          include-hidden-files: true
          if-no-files-found: error
          retention-days: 14
```

### Detalhes importantes do YAML acima:
1. **`fetch-depth: 0`**: indispensável para que `git diff --name-only origin/main...HEAD` em [conferir.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/conferir.py#L90) encontre a ref `origin/main` e o ancestral comum (`merge-base`).
2. **Playwright instalado em `/tmp/viabilidade-pw` + `NODE_PATH`**: evita criar `node_modules/` ou `package-lock.json` na raiz do repositório, o que faria `verificar_fora_do_modulo()` falhar no `git status --porcelain` ([conferir.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/conferir.py#L94-L98)).
3. **`include-hidden-files: true` no `actions/upload-artifact@v4`**: como a pasta `.conferir` começa com ponto (`.`), o `upload-artifact@v4` por padrão ignora dotfiles/dotfolders a menos que `include-hidden-files: true` esteja habilitado.
4. **`if: always()`**: garante que `resumo.json`, `motor.log`, `terreno.log`, `relatorio.log`, `lei.log`, `visual.log` e `fora-do-modulo.log` sejam salvos mesmo quando `conferir.py` retorna código `1`.

---

## 4. Estimativa de Tempo por Execução e Cota do GitHub Actions

Com base nos tempos reais medidos em [resumo.json](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/.conferir/resumo.json) no commit `490c0c7bbd5ba2de2caef650b3718fbf0c6a404a`:

| Etapa do Job | Tempo medido / estimado | Observação |
| :--- | :--- | :--- |
| Checkout (`fetch-depth: 0`) + Setup Python 3.14 + Setup Node 24 | ~20 s | Imagens pré-instaladas/cacheadas no `ubuntu-latest` |
| `pip install numpy shapely pyproj rasterio` (wheels manylinux) | ~15 s (ou ~5 s com cache) | Todos possuem wheels binários pré-compilados |
| `npm install playwright` + `playwright install --with-deps chromium` | ~45 s | Download do Chromium headless + libs apt |
| `conferir.py` — `motor` | **124,9 s** (~2m05s) | 27 testes + 42 casos de auditoria |
| `conferir.py` — `terreno` | **28,5 s** | `gerar_lotes.py`, `preparar_relevo.py`, `testar_pilotos.py` (7 pilotos) |
| `conferir.py` — `visual` | **18,2 s** | Playwright + WebGL SwiftShader (8 opções + 10 estados + 19 inválidos) |
| `conferir.py` — `relatorio` + `lei` + `fora_do_modulo` | **2,1 s** | `2,0 s` + `0,1 s` + `< 0,1 s` |
| Upload do artefato `viabilidade/.conferir/` | ~3 s | ~15 KB de logs em texto/JSON |
| **Total por execução (`push`)** | **~4,0 a 4,5 minutos** | Cobrado como **5 minutos** por run (arredondamento por minuto do GitHub) |

### Impacto na cota mensal do GitHub Actions
- **Repositório público:** gratuito e ilimitado para runners padrão `ubuntu-latest`.
- **Repositório privado (GitHub Free — 2.000 min/mês):** a ~5 min por execução em `ubuntu-latest` (multiplicador `1x`), a cota comporta **~400 pushes/mês** (~18 pushes por dia útil).
- **Repositório privado (GitHub Pro/Team — 3.000 min/mês):** comporta **~600 pushes/mês**.
