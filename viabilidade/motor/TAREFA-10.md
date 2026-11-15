# Tarefa 10 do Motor — achados da AUDITORIA-5 (junta com a 9)

**Quem:** Codex (Astra, alto). **Galho:** `fix/viabilidade-1b`. Mesmas regras: só `viabilidade/motor/` (+ contrato do README); não commite.
Faça **junto com a TAREFA-9** (garagem computável): é a mesma região do código (`_Caixas.fixa_limite`, `_ajusta_ao_ca`, busca por pavimento). A versão final das duas é a **0.8.1**.

Leia `viabilidade/auditoria/AUDITORIA-5.md`. A central **reproduziu os 4 ALTA** na 0.8.0 (`b5e14eba`). Casos e comandos estão na própria auditoria (`viabilidade/auditoria/casos/audit5-*`).

## Prioridade

| # | Achado | Expectativa |
|---|---|---|
| A1 | ALTA: perm 0,55→0,25 em 20×35, B 30→28. `_ajusta_ao_ca` aborta cedo (`nf` abaixo da laje mínima → `fazer` devolve `None` → `return achado`) | Busca não aborta por um ponto inviável; a janela válida (100,00–101,67 m²) é achada |
| A2 | ALTA: recuo de fundos 10→2 m em trapézio, B 64→56. O envelope da 8B **liga/desliga** conforme a caixa legal passa do limite, e a forma da solução salta | Sem salto: os candidatos com e sem envelope **concorrem sempre** e a `_chave` escolhe; nenhum caminho é desligado por um limiar |
| A3 | ALTA: lote 13×40, perm 0,73, vagas 0: as 4 opções "impossível", mas um 10×10 cabe na caixa legal e cumpre a permeabilidade | O `fixa_limite` simétrico não pode ser a única forma testada; e `impossivel` só com prova que valha para **qualquer** forma (ex.: caixa legal inteira < laje mínima, ou ocupação máxima pela permeabilidade < laje mínima) |
| A4 | ALTA: D "impossível" usando a caixa do térreo (recuo 4 m) como teto, sem testar o embasamento encostado (parede cega) + torre acima | Teto da D considera embasamento com parede cega e a torre com o recuo de cima |
| M1 | MÉDIA: `_encolhe` mede a área com todas as ilhas e depois fica com a maior → subsolo menor que vagas×27 m² sem alerta | Medir depois de escolher a parte, ou alertar "Faltam vagas"; `confere` passa a checar `area_garagem_m2 >= vagas × area_por_vaga_m2` (ou o alerta) |
| M2 | MÉDIA: D perde 18,7 m² privativos ao afrouxar TO/perm (mesmas unidades) | Privativa não cai ao afrouxar; se for o passo da secante, a busca fina corrige |
| B1 | BAIXA: `detalhe` da opção ausente guarda só o último pavimento, com float sem arredondar | Detalhe resume o **melhor** pavimento tentado e o motivo (laje < mínima ou 0 unidade); números com 2 casas |

## Testes

- Todos os pares da AUDITORIA-5 entram no teste de monotonia (`audit5-*`), além dos da TAREFA-9.
- Teste de "impossível verdadeiro": para cada `impossivel` nos 8 estudos e nos casos `audit5-*`, a prova numérica do `detalhe` vale para a caixa legal inteira.
- Não regressão contra `linha-de-base-0.7.1.json` e os 42 casos continuam passando.
- **Tempo:** teto de 2× a coluna 0.8.0 de `TEMPOS.md`, medido com `medir_tempo.py`.

## Relatório

Mesmo `RELATORIO-9.md` (seções 9 e 10), até 25 linhas: tabela A1–B1 (reproduzido, causa, correção, teste), monotonia (todos os pares passam?), tempos 0.8.0 × 0.8.1 nos 8 estudos. Depois: `maestri ask "Claude Code" "Motor tarefas 9 e 10 prontas"`.
