# Tarefa 10 do Visual — three servido junto da página (sem CDN)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/`. Não commite. Não toque em `viabilidade/motor/`.

## Por quê

A central mediu (ver o fim de `viabilidade/visual/MEDICAO.md`): o ~1,3 s e os 9,5 s até a primeira maquete eram **latência do CDN** (`cdn.jsdelivr.net/npm/three@0.186.1`), não o estudo. Sem o atraso do CDN, a maquete abre em ~0,3 s. A página também não deve depender de rede externa.

## O que fazer

1. Gerar **um arquivo** `viabilidade/visual/vendor/three-viabilidade.min.js` com **esbuild** (ESM, minificado, tree-shaking), a partir do three **0.186.1** que já existe em disco:
   - fonte: `C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-experimental-2026-10-14/node_modules/three` (versão 0.186.1; confira o `package.json`);
   - esbuild: `C:/Users/respawn/Desktop/imobiliaria/node_modules/esbuild` (ou `.bin/esbuild`);
   - um módulo de entrada `vendor/entrada.js` que reexporta só o que o `index.html` usa (`three` + `OrbitControls` e outros addons que a página importar).
2. Script `viabilidade/visual/vendor/gerar.mjs` que refaz o arquivo e grava `vendor/three-viabilidade.json` com versão do three, versão do esbuild e sha256 do resultado. O arquivo final precisa ficar **abaixo de 1 MiB** (regra do repositório: `tests/test_tamanho_versionado.py`); diga o tamanho.
3. `index.html`: o importmap aponta para o arquivo local. Nada de CDN na página, nem como reserva.
4. `testar.cjs`: falha se a página pedir qualquer recurso de fora da mesma origem.
5. `node --check` em tudo. O Chrome e a remedição a central rodam.

## Relatório

`viabilidade/visual/RELATORIO-10.md`, até 8 linhas (tamanho do bundle, o que exporta, como refazer). Depois: `maestri ask "Claude Code" "Visual tarefa 10 pronta"`.
