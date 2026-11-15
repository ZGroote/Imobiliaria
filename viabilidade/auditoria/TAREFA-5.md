# Tarefa 5 do Auditor — Portão 1A (matriz do PRD + proposta de CI)

Esforço: alto. Escreva **só** em `viabilidade/auditoria/`. Não altere motor, visual, relatório, terreno, lei, `conferir.py` nem `.github/`. Não commite.

Leia: `viabilidade/PRD-VIABILIDADE-1.0.md` (o PRD do módulo), `viabilidade/README.md` (contrato) e o resultado da conferência no HEAD `667caf3e`:
`viabilidade/.conferir/resumo.json` e os logs ao lado (6 verificações aprovadas, rodadas pela central).
Se quiser rodar de novo: `python -I -X utf8 viabilidade/conferir.py --saida viabilidade/auditoria/.conferir-auditor` (~3 min).

## 1. `MATRIZ-PRD-1.0.md`

Uma linha por requisito: VF-001 a VF-012, os itens da seção 9.1 (testes mínimos), as 6 pendências da seção 2 e as regras das seções 5.1 e 5.2.

| ID | Requisito (curto) | Status | Evidência | O que falta |

- Status: **atendido**, **parcial**, **pendente** ou **não verificado**.
- Evidência = arquivo:linha, nome do teste, caso da auditoria ou log em `.conferir/`. Sem evidência que você mesmo conferiu no HEAD = **não verificado** (nunca "atendido" por relatório antigo; o PRD 9.3 manda o HEAD valer sobre relatório).
- Exemplos do que conferir: o motor descarta opção com 0 unidades sem dizer o motivo (5.1)? A tela e o relatório usam a palavra "melhor" sem critério escrito (5.2)? O relevo aparece com fonte e precisão no relatório (VF-009)?
- No fim: lista curta dos itens que **bloqueiam** o portão 1B e 1C.

## 2. `CI-PROPOSTA.md`

Proposta (texto + YAML pronto, **sem criar arquivo em `.github/`**) de um job que roda `viabilidade/conferir.py` em todo push no galho `feat/viabilidade`:
- Ubuntu, Python 3.14 e Node 24; o que instalar (shapely etc.: veja os imports do motor/terreno; Playwright + Chromium pro visual).
- **Problema conhecido:** `visual/testar.cjs` carrega o Playwright por um caminho fixo desta máquina (`C:/Users/respawn/.cache/codex-runtimes/...`). No CI isso falha → o visual sai `nao_executado` e o job falha. Proponha a menor correção (não aplique: é tarefa do Visual).
- `--base origin/main` precisa de `fetch-depth: 0`.
- Subir `viabilidade/.conferir/` como artefato (`actions/upload-artifact`), também quando falhar.
- Estime os minutos por execução (o repositório usa a cota de Actions; ver custo).

## Relatório

`viabilidade/auditoria/RELATORIO-5.md` com até 15 linhas. Não precisa mandar mensagem: a central confere os arquivos.
