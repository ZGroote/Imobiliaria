# Revisão independente 1 — motor 0.8.1

**Alvo:** `947e2ec8`, comparado com `b5e14eba` (0.8.0). **Data:** 15/11/2026. **Parecer: solicitar correções; Gate 1B não fechado.**

Os casos específicos A1–A4, M1/M2 e B1 da tarefa 10 passam, mas há **dois problemas de gravidade ALTA** ainda reproduzíveis. A varredura independente encontrou **12 pares com quebra em 94**, abrangendo 15 resultados de opção: nove perdas de unidades e seis perdas de privativa com as mesmas unidades. Nenhum dos 188 estudos violou os invariantes geométricos/numéricos conferidos: o problema é perder soluções viáveis na busca.

## Reprodução e isolamento

Todos os comandos abaixo partem da raiz do repositório. Código, testes e oito exemplos da 0.8.1 estão fixados em `referencias/0.8.1/`; motor 0.8.0 em `referencias/0.8.0/`. Foram extraídos com `git show`, sem checkout ou alteração no motor. O executor verifica SHA-256 do motor contra `947e2ec8` e desativa bytecode. A tarefa 11 começou no diretório compartilhado durante a revisão e **não integra este parecer**. Lei, terreno e casos de auditoria são somente lidos. O diff revisado está em `evidencias/diff-motor.patch`.

Ambiente: Python 3.14.4, Shapely 2.1.2 / GEOS 3.13.1, NumPy 2.4.6, Windows 11; registro em `evidencias/ambiente.txt`. Ferramentas Ruflo não estavam disponíveis no catálogo desta sessão.

## R1 — ALTA: aumentar CA desliga a busca que resolvia a permeabilidade

**Código:** `motor.py:591–602`, principalmente a condição `area_computavel_m2 > cap + 0.01` em `_melhor`. É um caminho preexistente que permaneceu aberto depois das correções A1/A2; não afirmo que nasceu na 0.8.1.

**Reprodução:**

```powershell
python -I -B -X utf8 viabilidade/revisao/revisar.py caso L-gc0-CA-perm0.65-CAalto
python -I -B -X utf8 viabilidade/revisao/diagnosticar.py L-gc0-CA-perm0.65-CAalto
python -I -B -X utf8 viabilidade/revisao/revisar.py caso trapezio-gc0-CA-perm0.65-CAalto
```

**Esperado:** aumentar somente CA 2,8 → 12 deve preservar a opção B, pois sua implantação, altura, vagas e permeabilidade continuam permitidas. **Obtido:** B desaparece, de 28 unidades para opção ausente (`busca_inconclusiva`), tanto no L quanto no trapézio, sem garagem computável. O L perde 1.887,68 m² privativos; o trapézio perde 2.497,59 m².

No L de 1.087 m², a opção natural de 14 pavimentos tem computável 4.766,29 m² e permeável 618,17 m², abaixo dos **706,55 m²** exigidos. Com CA 2,8, ela excede o teto 3.043,60 m², entra em `_ajusta_ao_ca` e encontra 28 unidades. Com CA 12, o teto sobe a 13.044,00 m²: o mesmo candidato continua reprovado pela permeabilidade, mas **não entra no ajuste**. O diagnóstico encontra, no próprio gerador e contexto da regra nova, `f=0.55` viável com 28 unidades. A solução anterior inteira também passa sob a regra nova.

**Correção necessária:** encaminhar candidatos reprovados por limites ajustáveis, como permeabilidade/TO, à busca de dimensões viáveis; não condicionar essa busca exclusivamente ao excesso de CA. Preservar candidatos já viáveis e adicionar estes dois pares à regressão. O rótulo `busca_inconclusiva` está correto, mas não elimina a quebra de VF-007.

Entradas e saídas completas: `casos/L-gc0-CA-perm0.65-CAalto*.json` e `casos/trapezio-gc0-CA-perm0.65-CAalto*.json`. Traço: `evidencias/diagnostico-L-gc0-CA-perm0.65-CAalto.json`.

## R2 — ALTA: garagem computável continua não monotônica; dois subsolos não preservam o candidato anterior

**Código:** `motor.py:440–479` (`_avaliar`, alternativas de subsolo, níveis e vagas) e `motor.py:832–834` (posição das duas torres). A alternativa compacta reduz o problema, mas também cresce/muda de posição com a regra relaxada. Não há enumeração/preservação de subsolos menores anteriormente viáveis. O aviso específico de não monotonia foi retirado em `motor.py:750–754`, embora o defeito permaneça.

**Reprodução:**

```powershell
python -I -B -X utf8 viabilidade/revisao/revisar.py caso degrau-13x23-gc1
python -I -B -X utf8 viabilidade/revisao/diagnosticar.py degrau-13x23-gc1
python -I -B -X utf8 viabilidade/revisao/revisar.py caso L-gc1-frontal-ca3.4
python -I -B -X utf8 viabilidade/revisao/revisar.py caso L-gc1-frontal
```

**Esperado:** afrouxar recuos preserva unidades e, no empate, privativa. **Obtido:**

| Caso / relaxamento | Opção | Unidades antes → depois | Privativa antes → depois |
|---|---|---:|---:|
| Retângulo 13×23: recuo dos dois primeiros pavimentos 4 → 1,5 m; recuo superior fica 1,5 m | A | 14 → 13 | 840,00 → 780,00 m² |
| Mesmo caso | D | 12 → 11 | 720,00 → 660,00 m² |
| L, CA 3,4: frontal 7 → 3 m | B | 40 → 36 | 2.485,82 → 2.371,04 m² |
| L, CA 4,2: frontal 7 → 3 m | B | 52 → 48 | 3.235,40 → 3.113,41 m² |
| L, CA 4,3: frontal 7 → 3 m | B | 52 → 52 | 3.344,10 → 3.182,12 m² |

**Prova da causa no 13×23:** o mesmo prédio A, de 14 unidades e 840 m² privativos, tem computável **1.255 m²** com a garagem anterior de cinco vagas / 135 m², abaixo do teto **1.285,70 m²**. Afrouxar o recuo amplia o subsolo disponível de 75 para 175 m². Reavaliando exatamente o mesmo prédio, as alternativas automáticas passam a fornecer pelo menos sete vagas / 189 m²; o computável sobe a **1.309 m²**, e o prédio é recusado. Conservar a garagem anterior continuaria legal. Os alertas de déficit estão presentes: o problema não é ocultar vagas, e sim eliminar uma solução que vence pelo critério declarado de unidades/privativa.

No L com CA 4,3, a nova implantação das torres expande a garagem de 809,99 para 971,99 m² e consome a privativa perdida. As duas buscas, com e sem envelope, não recuperam a implantação anterior. Há **dez pares** com garagem computável quebrados na amostra; suas entradas/saídas estão em `casos/`. A solução antiga passa nas verificações sob a regra nova em todos os pares direcionados com quebra; o primeiro L também foi reexecutado com essa verificação em `evidencias/repro-L-gc1-frontal.json`.

**Correção necessária:** fazer candidatos de implantação/subsolo e patamares de vagas menores concorrerem, respeitando o critério primário unidades/privativa. Enquanto não resolver, declarar expressamente a não monotonia nos estudos afetados; “não prova ótimo global” não informa que afrouxar a regra pode reduzir apartamentos. Não tratar o aumento das vagas como melhoria que compensa a perda de unidades.

## Conferências que passaram

```powershell
python -I -B -X utf8 viabilidade/revisao/revisar.py auditoria
python -I -B -X utf8 viabilidade/revisao/revisar.py suite
python -I -B -X utf8 viabilidade/revisao/revisar.py regressao
```

| Exigência | Evidência na 0.8.1 |
|---|---|
| A1: permeabilidade 0,55 → 0,25 | B 30 → 30 unidades; 1.850,01 → 1.850,01 m². Ajuste não retorna ao primeiro `None`. |
| A2: fundos 10 → 2 m no trapézio | B 64 → 64; 3.953,75 → 3.953,75 m². Buscas com/sem envelope concorrem. |
| A3: 13×40, permeabilidade 0,73 e zero vagas | A, C e D presentes; A 19, C 4, D 17 unidades. Tangência e limite legal substituem o falso teto do envelope. |
| A4: parede cega, recuo inicial maior | D presente, quatro unidades; teto da busca não usa apenas a caixa do térreo. |
| M1 da tarefa 10: ilhas/subsolo | Haltere e L regenerados passam; capacidade final confere com a geometria. Nenhum dos 94 pares novos exporta mais vagas que a capacidade, dentro de 0,011 m². |
| M2 da tarefa 10: privativa D | Pares TO 0,20 → 0,50 e permeabilidade 0,55 → 0,15: D mantém 66 unidades e 4.068,58 m². |
| B1: melhor tentativa e números | Piloto 22426, A: tentativa de um pavimento, zero unidades, CA 1.805,44 m²; números formatados. |
| Garagem computável — pares antigos | Pares D2 e `audit5-gc` passam; isso não se generaliza aos casos novos de R2. |
| Provas de `impossivel` | Verificadas nos 14 casos audit5 e nos oito estudos de referência; casos novos do recuo por altura não reproduzem o falso `impossivel` de A4. |

`auditoria-comandos.json` guarda os **oito comandos da tabela da AUDITORIA-5**, com suas saídas e códigos de retorno (todos zero), executados com pré-carregamento do motor fixado. Atenção: o comando M1 da tabela lê um JSON histórico e ainda imprime o defeito antigo de 270,23 m²/20 vagas. Por isso os **14 estudos audit5 foram também regenerados**, sem substituir arquivos da auditoria, em `evidencias/auditoria-atual/`. O comando do validador de relatório também passou no estado compartilhado, mas não constitui revisão completa do relatório.

**Suíte completa:** `test_motor.main()` do commit fixado passou (`ok`, código 0), em **461,02 s**; log em `evidencias/suite.log`. Inclui os 42 casos antigos, os 14 audit5, a linha de base 0.7.1 dos oito estudos, a reprodução exata dos oito JSONs, determinismo e as matrizes anteriores. O tempo total da suíte teve outras verificações concorrentes e não foi usado para avaliar desempenho por estudo.

**Comparação 0.8.0 × 0.8.1:** 56 entradas regeneradas/comparadas (42 históricas + 14 audit5), **zero perdas de unidades**. Existem oito reduções de privativa entre versões, de 0,11 a 1,24 m², detalhadas em `evidencias/regressao-080-081.json`; portanto não afirmo preservação integral dessa métrica. A comparação usa o motor 0.8.0 de fato: os JSONs históricos têm versões antigas e erros já corrigidos, e não servem sozinhos como baseline 0.8.0.

## Varredura própria e pontos suspeitos

```powershell
python -I -B -X utf8 viabilidade/revisao/revisar.py varredura
python -I -B -X utf8 viabilidade/revisao/revisar.py direcionados
```

- **70 pares da matriz:** cinco geometrias (retângulo 23×37, estreito 13,5×44, L, trapézio, triângulo) × dois regimes de garagem × sete relaxamentos (recuos simétricos, fundos, frontal, CA, TO, altura, permeabilidade). Uma quebra: `L-gc1-frontal`.
- **24 pares dirigidos:** dez de CA alto/permeabilidade para a seleção de caminho em `_melhor`; dez variações de CA no L para os patamares de garagem/posição das torres; quatro pares de recuo por pavimento/parede cega para os limites de impossibilidade. Onze quebras adicionais.
- O retorno precoce corrigido de `_ajusta_ao_ca`, os limites legais de `busca`, a deduplicação de envelope e a troca de base em D foram inspecionados em conjunto com esses casos e a reprodução A1–A4. Não alego prova de monotonia em todo o domínio.
- Comparação lexicográfica: nenhuma perda de unidades; no empate, privativa com tolerância de **0,10 m²**, igual à suíte do Motor. Não exigir privativa crescente quando o número de unidades aumenta. O comparador contém auto-verificações para esses dois casos.

Dados completos: `evidencias/varredura.json`, `evidencias/direcionados.json` e seus manifestos de entradas; os 12 pares com falha têm entradas e ambas as saídas em `casos/`. A verificação da solução anterior sob a regra afrouxada copia somente a zona e a caixa legal novas, preservando volumes e métricas anteriores, e reexecuta os invariantes.

## Tempo por estudo

```powershell
python -I -B -X utf8 viabilidade/motor/medir_tempo.py viabilidade viabilidade/revisao/referencias/0.8.0 viabilidade/revisao/referencias/0.8.1
```

Mediana de três gerações com caches limpos, exatamente pelo script solicitado. Medição concluída **antes** de iniciar as suítes e varreduras. Fonte: `evidencias/tempos.txt`.

| Estudo | 0.8.0 medida | 0.8.1 medida | Razão |
|---|---:|---:|---:|
| estudo-exemplo | 2,03 s | 1,54 s | 0,76× |
| SC-completo-30516 | 4,58 s | 9,00 s | 1,96× |
| SC-completo-37607 | 5,40 s | 2,45 s | 0,45× |
| SC-completo-22426 | 1,12 s | 1,40 s | 1,25× |
| SC-completo-22421 | 0,63 s | 0,94 s | 1,50× |
| SC-completo-25297 | 0,18 s | 0,24 s | 1,34× |
| SC-completo-q1382-11984-11988 | 6,48 s | 8,93 s | 1,38× |
| SC-completo-remembramento-75352-75354 | 8,37 s | 8,18 s | 0,98× |
| Total | 28,8 s | 32,7 s | 1,14× |

**Teto de 2× atendido nos oito estudos**, tanto contra a 0.8.0 medida nesta revisão quanto contra a coluna histórica de `TEMPOS.md`. O 30516 ficou próximo do limite na comparação medida; o resultado é uma medição, não garantia de tempo em outras execuções.

## Limites e entrega

Revisão restrita à 0.8.1. Não executados CI completo, navegador, revisão normativa/topográfica ou homologação profissional. Não foi alterado o motor, nem exemplos compartilhados, visual, relatório ou auditoria; não houve commit. Código de reprodução, casos e evidências novos ficam somente em `viabilidade/revisao/`, sem commit, para a central revisar. As mudanças simultâneas da tarefa 11 pertencem ao Motor.
