# Relatório 4 — Visual

- `testar.cjs` resolve Playwright pelo `require` normal e usa o runtime Codex como fallback; Chrome respeita `CHROME_PATH`, depois Chrome Windows existente, e por fim Chromium do Playwright.
- Workflow `viabilidade.yml` cobre pushes em `feat/viabilidade` e `ci/viabilidade-testes` e PRs para `feat/viabilidade`, com permissões mínimas, timeout e concorrência do CI existente.
- Ações fixadas por SHA; `upload-artifact` usa v7.0.2 (`cf430e0…`), confirmada na página oficial de releases.
- Playwright e Chromium são instalados em `/tmp`; os logs de `.conferir/` são publicados mesmo em falha.
- Dependências Python: `shapely` e `numpy` vêm de `motor.py` e `gerar_lotes.py`; `pyproj` vem dos scripts de reprodução de eixo/Z2 e `preparar_relevo.py`; `rasterio` vem de `preparar_relevo.py`; `Pillow` vem dos scripts de reprodução de eixo/Z2.
- `PyMuPDF` foi omitido porque `zonas-renderizar.py` não é chamado pela suíte de reprodução executada pelo `conferir.py`.
- Verificação local limitada a `node --check`, conforme solicitado; execução do Chrome e do CI fica para a central.
