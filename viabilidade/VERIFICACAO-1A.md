# Verificação do Portão 1A

**Data:** 14/11/2026. **Galho:** `feat/viabilidade`. **Escopo autorizado:** `conferir.py` + documentação de evidência + proposta de CI (sem `.github/`). Motor, visual, relatório e produção **não** foram alterados. Portões 1B–1E **não** iniciados.

## 1. O que mudou

| Commit | O quê |
|---|---|
| `490c0c7b` | PRD da plataforma 0.2 e PRD do módulo 1.0 guardados em `viabilidade/` |
| `667caf3e` | `conferir.py` novo + `/.conferir/` no `viabilidade/.gitignore` (linhas antigas mantidas) |
| este commit | `auditoria/TAREFA-5.md`, `auditoria/MATRIZ-PRD-1.0.md`, `auditoria/CI-PROPOSTA.md` (Auditor) e esta verificação (central) |

Diff do `conferir.py`: `git diff cfc7986e 667caf3e -- viabilidade/conferir.py viabilidade/.gitignore`.

## 2. `conferir.py`: requisitos do pedido

| # | Pedido | Como ficou | Prova |
|---|---|---|---|
| 1 | Preservar falha por teste obrigatório ausente | Mantido; agora sai como `nao_executado` e o script devolve 1 | Rodado sem `relatorio/test_relatorio.py`: `NAO_EXECUTADO relatorio`, saída 1 |
| 2 | Mudanças fora de `viabilidade/` com referência explícita | `--base` (padrão `origin/main`): arquivos alterados desde o `merge-base`, commitados ou soltos. Referência inexistente = `nao_executado` | Arquivo-sonda na raiz → `reprovado ['__sonda_fora.txt']`; `--base ref-que-nao-existe` → `nao_executado` |
| 3 | Evidência completa em arquivo, saída curta | Log inteiro por verificação + `resumo.json` (HEAD, base, Python, plataforma, tempos, código de saída, sha256 de cada log) em `viabilidade/.conferir/` (fora do git; no CI vira artefato) | Tela: 8 linhas |
| 4 | Separar executados / aprovados / reprovados / não executados | Estado por verificação; ferramenta ausente, tempo estourado (900 s) e `skipped=` também contam como `nao_executado`. Só sai 0 com tudo aprovado | Linha final do `conferir.py` |
| — | Teste do visual | Entrou no `conferir.py` (servidor local em porta livre). O teste regrava os prints versionados de `visual/evidencias/`; se estavam limpos antes, voltam como eram | `visual` aprovado, `git status` limpo depois |

**Execução no código atual** (código do `667caf3e`, HEAD `490c0c7b` + `conferir.py` novo, Python 3.14.4, Node 24.15.0, Windows 11):

```
APROVADO      motor (124.9s)
APROVADO      terreno (28.5s)
APROVADO      relatorio (2.0s)
APROVADO      lei (0.1s)
APROVADO      visual (18.2s)
APROVADO      nada fora de viabilidade/ desde origin/main
executados 6 | aprovados 6 | reprovados 0 | não executados 0
```

Tempo total: 2 min 55 s. Uma segunda rodada (com o teste do relatório retirado de propósito) repetiu os outros 5 resultados.

## 3. Conferência da matriz do Auditor

O Auditor (Antigravity) gravou `auditoria/MATRIZ-PRD-1.0.md` e `auditoria/CI-PROPOSTA.md` e parou por **cota esgotada** (volta em ~158 h), sem o `RELATORIO-5.md`. A central conferiu as afirmações principais no código. **Esta seção prevalece sobre a matriz onde as duas divergem.**

### 3.1 Erros encontrados na matriz

| Item da matriz | O que a matriz diz | O que o código mostra |
|---|---|---|
| VF-002 / T9.1-3 / P2-5 | **Parcial**: métrica usa a área sem arredondar; lote 20×40 dá 36 × 18 unidades | **Já corrigido na v0.7.1.** `motor.py:398` arredonda o polígono antes de guardar em `_geom`, e `_avaliar` mede esse mesmo polígono. Teste de regressão do lote 20×40 em `test_motor.py:362`. A matriz repetiu um achado antigo da AUDITORIA-4. Fica só uma dúvida menor, **não verificada**: a área do subsolo (`motor.py:447`) |
| Contagens de teste | "27/27 testes" no motor, "11/11" no relatório | O motor não conta testes: imprime só `ok`. O relatório roda **4** testes (`Ran 4 tests`) |
| Nomes citados | `test_monotonicidade_condicionada`, `test_reprodutibilidade`, `_MOTIVO_OPCAO_AUSENTE`, `verificar_fora_do_modulo`, regex `\bskipped=\d+\b` | Nenhum desses nomes existe. As funções de verdade são `monotonia`, `defeitos_da_auditoria`, `auditoria3`, `tarefa6` e `tarefa7` (motor), `fecha(..., motivo)` (motor.py:710) e `fora_do_modulo` (conferir). Várias referências de linha não batem |
| Seções 2 e 9.1 | Listas "P2-1…6" e "T9.1-1…7" | Vêm do **PRD 0.1** (`viabilidade/PRD.md`), não do PRD 1.0. As listas certas estão na 3.3 abaixo |

### 3.2 Confirmados pela central

- **5.2, palavra "melhor":** não aparece no `visual/index.html` nem no `relatorio/relatorio.py`. O critério de escolha está só no código (`motor.py:545`, `_chave`), não no JSON do estudo.
- **5.1, opção que não coube:** não é descartada calada: vira incerteza (`fecha`, motor.py:710). Mas o motivo é um texto fixo por opção (C diz sempre "sem área") e não separa os 4 casos que o PRD pede (impossível, a busca não achou, dados insuficientes, erro). **Parcial.**
- **VF-009, relevo:** o motor sempre escreve "Relevo ignorado: volumes assentados em terreno plano" (motor.py:705) e o relatório mostra cotas, fonte e resolução. A tela não mostra `lote.relevo` (index.html:187 só tem a frase fixa). **Parcial.**
- **VF-007:** garagem computável **declarada** no estudo (motor.py:694: "nesse regime o resultado NÃO é monotônico"). Recuo assimétrico com permeabilidade apertada **não** é declarado no estudo: só aparece em CENTRAL.md e no relatório do Motor. **Parcial.**
- **VF-012:** nenhum estudo revisado por profissional. **Pendente.**

### 3.3 Listas do PRD 1.0 que a matriz não cobriu

Seção 2 (pendências que não podem sumir):

| # | Pendência | Status | Evidência |
|---|---|---|---|
| 1 | Monotonia: recuo assimétrico + permeabilidade | pendente | Não declarada no estudo (ver VF-007) |
| 2 | Monotonia com garagem computável | parcial | Declarada em `incertezas` (motor.py:694); não corrigida |
| 3 | Zona dos lotes limítrofes confirmada por humano | pendente | 7 pilotos com `zona_conferida: false` |
| 4 | Zonas com interpretação conflitante | pendente | `conferencia/CONFERENCIA.md` (Z5A/Z5B, Z6B, Z6E) |
| 5 | Relevo aproximado, não usado como validação | parcial | Aviso no estudo e no relatório; a tela não mostra os dados de relevo |
| 6 | Reproduzir no commit atual os testes dos relatórios | parcial | `conferir.py` 6/6 local (seção 2); ainda sem CI no galho |

Seção 9.1 (testes mínimos):

| Teste | Status | Evidência |
|---|---|---|
| Geométricos sintéticos (retângulo, triângulos, trapézio, L, frente repetida, inválido, degenerado) | parcial | Há casos de triângulo, trapézio, L e degenerado em `test_motor.py` (174–279) + 89 arquivos em `auditoria/casos/`. "Frente repetida" não foi achado por busca: **não verificado** |
| Consistência (CRS, arredondamento, área, recuos, alturas, pavimentos) | atendido | `confere()` em `test_motor.py:26`; regressão do arredondamento em `test_motor.py:362` |
| Propriedades (determinismo, invariantes, monotonia onde exigida) | parcial | `monotonia()` em 3 lotes; exceções da seção 2 (itens 1 e 2) |
| Contas (CA, TO, privativa, unidades por pavimento, vagas) | atendido | `confere()` + casos da auditoria (42/42 na AUDITORIA-4, reproduzidos pela central) |
| Contratos (JSON lido pelo visual e pelo relatório) | atendido | `visual` e `relatorio` aprovados no `conferir.py` |
| UI (desktop/celular, `null`, inválidos) | atendido | `testar.cjs`: 2 perfis, larguras 320/768/1024, 19 JSONs inválidos |
| Casos reais revisados por profissional | pendente | Nenhum (portão 1C) |

## 4. Proposta de CI (`auditoria/CI-PROPOSTA.md`): ajustes antes de aplicar

A proposta está boa no essencial: `fetch-depth: 0`, Playwright fora da árvore (`NODE_PATH`), artefato com `include-hidden-files` e `if: always()`, e o conserto mínimo do `testar.cjs`, que tem caminhos fixos desta máquina **e** do Chrome do Windows (linha 46). Corrigir antes de aplicar:

1. **Gatilho:** tirar `pull_request: branches: [main]`. Num PR de outro galho para a main, a verificação "nada fora de `viabilidade/`" falharia sempre. Deixar só `push` em `feat/viabilidade` (e, se quiser, PR **vindo** dele).
2. **Ações fixadas por SHA**, como no `ci.yml` do repositório (a proposta usa `@v4`/`@v5`).
3. A tabela de comandos descreve errado o que o `conferir.py` roda (motor não usa `unittest discover`; terreno roda `testar_pilotos.py --reproduzir`). Isso não muda o YAML.
4. **Custo:** ~5 min por push. Hoje o repositório é público (sem custo). Se voltar a privado, conta na cota de 2.000 min/mês, onde o CI atual já usa ~1.300.
5. A reprodução do terreno lê `sao-carlos/dados/*.geojson` e `street_tris.json`. **Conferido:** estão no git. Que o resto rode no Ubuntu só o primeiro CI prova.

Aplicar exige duas autorizações: criar `.github/workflows/` (pedido 6) e mexer no `visual/testar.cjs` (frente Visual).

## 5. O que fica aberto (para decisão do usuário)

- **Portão 1B (motor/visual, precisa de autorização):** declarar ou corrigir a monotonia com recuo assimétrico; motivo específico quando uma opção não cabe (5.1); relevo na tela (VF-009); conserto portátil do `testar.cjs` + ativar o CI.
- **Portão 1C (humano):** zona dos 7 pilotos, zonas conflitantes, revisão de pelo menos uma amostra por arquiteto ou engenheiro.
- **Auditor sem cota** até ~21/11. A próxima auditoria independente precisa de outro modelo ou de esperar a cota voltar.
