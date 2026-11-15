# Revisão 6 — Teste do estudo de lote livre (`estudar.py`) com 20 índices sorteados e 10 coordenadas

**Veredito: fluxo funcional sem quebras (0 tracebacks) e sem números urbanísticos absurdos nos 20 + 10 ensaios, com duas ressalvas de gravidade MÉDIA descobertas na auditoria dirigida e uma observação operacional.**

1. **Achado 1 (MÉDIA):** Existem lotes na base `completo` em que os Anexos 05, 06 e 07 caem inteiramente sobre cor de fundo limpa, fazendo `lote.areas_especiais` sair vazio (`[]`); nesses estudos **não aparece nenhum alerta `"ÁREA ESPECIAL"` nas opções nem menção a `"não verificada"`** no `estudo.json` ou no `resumo.txt` (que imprime `Áreas especiais não verificadas: nenhuma`).
2. **Achado 2 (MÉDIA):** Em **todos** os estudos gerados pelo `estudar.py` (com `--zona auto` ou `--zona SC-XX`), há contradição entre `lote.json`/`resumo.txt` (que informam `sugerida_pelo_mapa` / `informada_pelo_usuario`) e `estudo.json["incertezas"][0]` (e `relatorio.html`), que imprime `sem origem informada (falta zona_origem no lote)`.
3. **Observação operacional (BAIXA):** 16 dos 20 índices sorteados (80%) e 3 dos 5 pontos em lotes urbanos foram recusados com `Lote sem frente para rua: nenhuma aresta de pelo menos 8 m aprovada por avaliar() a até 6 m do asfalto` (em alguns casos por aresta frontal segmentada em trechos menores que 8 m ou distância à malha de asfalto logo acima de 6 m). Todas as recusas tiveram motivo explícito, código 2 e **não deixaram pasta no destino**.

Execução em 15/11/2026 no galho `viabilidade/lote-livre` (após a conclusão da Tarefa 8 do Terreno, com `viabilidade/terreno/.cache/` já aquecido). Todos os comandos rodaram em subprocesso real (`python -I -X utf8 viabilidade/motor/estudar.py ...`), gravando saídas temporárias em `%TEMP%\revisao6\`. Nenhum arquivo de código foi alterado e nada foi commitado.

---

## O que passou nas conferências dos 20 + 10

- **Quebras (traceback):** 0 em 30 execuções (saída sempre `0` para estudo e `2` para recusa).
- **Limpeza na recusa:** nas 25 recusas (16 do sorteio + 9 dos pontos), a pasta `--pasta` não foi criada/mantida.
- **Motivo da recusa:** todas as 25 recusas trouxeram causa explícita (`Erro: Lote sem frente para rua...`, `Erro: Não foi possível validar sobreposição: vizinhos com geometria inválida [24088]`, ou `Erro: Nenhuma feição contém o ponto no interior...` com os 3 índices mais próximos e distância em metros).
- **Números urbanísticos:** nos 5 estudos da bateria (3 com opção `C` e 2 com 0 opções) e nos 4 extras verificados, `area_computavel_m2 <= ca_maximo × area_m2`, `to_usada <= taxa_ocupacao`, `area_permeavel_m2 >= taxa_permeabilidade × area_m2`, `unidades_estimadas > 0`, `area_privativa_m2 > 0` e `vagas >= 0` foram respeitados.
  - *Nota sobre `area_construida_m2`:* no índice `100434` (`307,878 m²`, `SC-Z4`, `CA_max = 1,4` → teto computável `431,03 m²`), a opção `C` tem `area_construida_m2 = 619,03 m²`, acima de `1,4 × 307,878`. Isso **não é erro**: `area_computavel_m2 = 431,02 m²` (`ca_usado = 1,400`), e os `188,01 m²` excedentes são `area_nao_computavel_m2` (garagem em subsolo + núcleo de circulação vertical, isentos pelo COE art. 51).
- **Zonas sugeridas em divisa:** os 5 estudos aceitos com `--zona auto` na bateria (`100434`, `79299`, `91923`, `25212`, `75902`) foram inspecionados visualmente em recortes do `anexo02.jpg`; nenhum fica sobre divisa de zona (e `91923` listou corretamente `SC-EIXO` em `alternativas`). Uma varredura adicional (`stride=100`, 71 lotes aceitos) também teve os 3 lotes de menor `distancia_divisa_m` (`23700` a `10,11 m`, `73200` a `11,76 m`, `72400` a `11,93 m`) inspecionados visualmente — nenhum estava em divisa de zona.
- **`resumo.txt` × `estudo.json`:** nos 5 estudos da bateria (e nos extras), ID, base, índices, área, zona sugerida, alternativas, áreas especiais encontradas/não verificadas, domínio do motor, opções calculadas, opções ausentes (motivo e detalhe) e revisão SHA-256 (12 dígitos + `<meta name="estudo-sha256">` do `relatorio.html`) batem com `estudo.json` e `lote.json`. A única contradição observada está em `estudo.json["incertezas"][0]` (Achado 2).

---

## Tabela 1 — 20 índices sorteados da base `completo` (`--zona auto`)

**Sorteio reproduzível:** `random.Random(20261115).sample(range(110089), 20)`
Índices: `[39431, 3321, 62350, 92058, 100434, 94130, 86650, 108586, 79299, 21164, 46087, 23249, 91412, 91923, 102159, 104833, 59281, 82415, 25212, 97132]`.

| # | Índice | Resultado | Motivo (se recusa) / Área | Zona sugerida (outras; divisa) | Opções | Ausentes | Áreas especiais (Enc = encontradas; NV = não verificadas) | Tempo |
|---:|---:|---|---|---|---|---|---|---:|
| 1 | `39431` | Recusa (2) | `Lote sem frente para rua: nenhuma aresta de pelo menos 8 m aprovada por avaliar() a até 6 m do asfalto` | — | — | — | — | 1,779 s |
| 2 | `3321` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,500 s |
| 3 | `62350` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,652 s |
| 4 | `92058` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,729 s |
| 5 | `100434` | **Estudo** | `307,878 m²` | `SC-Z4` (alt: nenhuma; div: `null`) | `C` (4 un., 351,02 m² priv.) | `A`, `B`, `D` (`busca_inconclusiva`) | Enc: `AEIS tipo 2 (sobreposicao_visual)`; NV: `Anexo 06, Anexo 07` | 3,643 s |
| 6 | `94130` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,484 s |
| 7 | `86650` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,578 s |
| 8 | `108586` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,658 s |
| 9 | `79299` | **Estudo** | `350,533 m²` | `SC-Z1` (alt: nenhuma; div: `161,44 m`) | `C` (2 un., 153,24 m² priv.) | `A`, `B`, `D` (`busca_inconclusiva`) | Enc: nenhuma; NV: `Anexo 05, Anexo 06, Anexo 07` | 6,392 s |
| 10 | `21164` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,723 s |
| 11 | `46087` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,766 s |
| 12 | `23249` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,818 s |
| 13 | `91412` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,821 s |
| 14 | `91923` | **Estudo** | `150,482 m²` | `SC-Z3` (alt: `SC-EIXO`; div: `137,82 m`) | nenhuma (0) | `A`, `B`, `C`, `D` (`impossivel`, laje ≤ 63,19 m² < 80 m²) | Enc: nenhuma; NV: `Anexo 05, Anexo 06, Anexo 07` | 3,938 s |
| 15 | `102159` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,705 s |
| 16 | `104833` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,719 s |
| 17 | `59281` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,666 s |
| 18 | `82415` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,606 s |
| 19 | `25212` | **Estudo** | `138,945 m²` | `SC-Z2` (alt: nenhuma; div: `31,46 m`) | nenhuma (0) | `A`, `B`, `C`, `D` (`impossivel`, laje ≤ 47,48 m² < 80 m²) | Enc: nenhuma; NV: `Anexo 07` | 3,496 s |
| 20 | `97132` | Recusa (2) | `Lote sem frente para rua` (mesma regra) | — | — | — | — | 1,689 s |

---

## Tabela 2 — 10 coordenadas em São Carlos (`--ponto` com `--zona auto`)

5 pontos em lotes de bairros distintos e 5 pontos em ruas/logradouros (conferidos na base e malha viária).

| # | Ponto (`lat, lon`) e local | Tipo | Resultado | Motivo (se recusa) / Lote e área | Zona sugerida | Opções | Ausentes | Áreas especiais | Tempo |
|---:|---|---|---|---|---|---|---|---|---:|
| P1 | `-22.017500, -47.890800` (Centro) | Lote | **Estudo** | `SC-completo-75902` (`517,991 m²`) | `SC-Z1` (alt: nenhuma; div: `161,08 m`) | `C` (12 un., 863,01 m² priv.) | `A`, `B`, `D` (`busca_inconclusiva`) | Enc: `Superfícies de aproximação e decolagem do Aeroporto Mário Pereira Lopes (possivel_incidencia)`; NV: `Anexo 06` | 4,438 s |
| P2 | `-22.025000, -47.897000` (Vila Prado) | Lote (`24089`) | Recusa (2) | `Não foi possível validar sobreposição: vizinhos com geometria inválida [24088]` | — | — | — | — | 1,490 s |
| P3 | `-22.003000, -47.882000` (Jd. Paulista) | Lote (`15444`) | Recusa (2) | `Lote sem frente para rua` (`avaliar()`) | — | — | — | — | 1,718 s |
| P4 | `-21.998000, -47.892000` (Pq. Arnold Schimidt) | Lote (`11961`) | Recusa (2) | `Lote sem frente para rua` (`avaliar()`) | — | — | — | — | 1,657 s |
| P5 | `-21.995100, -47.912000` (Santa Felícia) | Lote (`9574`) | Recusa (2) | `Lote sem frente para rua` (`avaliar()`) | — | — | — | — | 1,606 s |
| P6 | `-22.017727, -47.890710` (Rua Centro/Catedral) | Rua | Recusa (2) | `Nenhuma feição contém o ponto no interior na base completo (rua, lacuna ou divisa). As 3 mais próximas, distância ao polígono: índice 75904: 5.064 m; índice 75903: 8.648 m; índice 75878: 15.086 m. Confira e informe --indices; nenhuma feição escolhida` | — | — | — | — | 1,913 s |
| P7 | `-22.011659, -47.895877` (Rua Praça XV) | Rua | Recusa (2) | `Nenhuma feição contém o ponto no interior... As 3 mais próximas...: índice 71116: 2.734 m; índice 71115: 2.734 m; índice 71138: 8.891 m...` | — | — | — | — | 1,699 s |
| P8 | `-22.007781, -47.894963` (Av. Trab. São-Carlense) | Rua | Recusa (2) | `Nenhuma feição contém o ponto no interior... As 3 mais próximas...: índice 68492: 9.679 m; índice 68493: 9.688 m; índice 68491: 15.106 m...` | — | — | — | — | 1,874 s |
| P9 | `-22.024952, -47.896695` (Rua Vila Prado) | Rua | Recusa (2) | `Nenhuma feição contém o ponto no interior... As 3 mais próximas...: índice 24088: 3.471 m; índice 24743: 10.220 m; índice 24087: 14.680 m...` | — | — | — | — | 2,086 s |
| P10 | `-22.020500, -47.893500` (Av. Com. Alfredo Maffei) | Logradouro | Recusa (2) | `Nenhuma feição contém o ponto no interior... As 3 mais próximas...: índice 77664: 5.610 m; índice 77653: 9.882 m; índice 77654: 11.998 m...` | — | — | — | — | 2,041 s |

---

## Achados com comando para reproduzir

### Achado 1 (MÉDIA) — Estudo sem nenhum alerta de área especial nem `"não verificada"`

Quando todos os pixels do lote (mais margem de ~10 m) nos Anexos 05, 06 e 07 caem em cor de fundo reconhecida e longe de manchas/cones, `areas_especiais.py` retorna `[]`. Como não há registro nem de `"nao_verificada"` nem de área encontrada, o `estudo.json` sai sem nenhum alerta `"ÁREA ESPECIAL"` nas opções calculadas, `incertezas` não traz aviso de área especial não conferida e `resumo.txt` imprime `Áreas especiais não verificadas: nenhuma` (omitindo a ressalva de conferência).

**Comando para reproduzir:**

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 25300 --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao6\extra_25300
```

**Trecho copiado da saída (`stdout` / `resumo.txt`):**

```text
Lote: SC-completo-25300 (base completo, feições [25300])
Área: 290.591 m²
Zona: SC-Z1 (sugerida pelo mapa do Plano Diretor, não conferida; outras zonas por perto: nenhuma)
Áreas especiais encontradas: nenhuma
Áreas especiais não verificadas: nenhuma
Domínio do motor: dentro
Opções calculadas: 1 (C)
```

**Trecho copiado de `estudo.json` (`opcoes[0].alertas` e `lote.areas_especiais`):**

```json
  "areas_especiais": []
```
```json
   "alertas": [
    "Recuo lateral/fundos: residencial 2.00/2.00 m (recuo do topo no prédio todo)."
   ]
```

*(Também reproduzido com `--indices 26300 --zona auto`.)*

---

### Achado 2 (MÉDIA) — Contradição entre `lote.json`/`resumo.txt` e `estudo.json`/`relatorio.html` quanto à `zona_origem`

O `novo_lote.py` grava `"zona_origem": "sugerida_pelo_mapa"` (ou `"informada_pelo_usuario"`). O `estudar.py` e o `relatorio.py` reconhecem esses dois valores, mas `motor.py` (`texto_origem` na linha 756) só mapeia `"oficial"`, `"anotada_a_mao"` e `"teste"`. Com isso, **todo estudo gerado pelo `estudar.py`** grava em `estudo.json["incertezas"][0]` que falta `zona_origem` no lote, contradizendo `lote.json`, `resumo.txt` e o próprio cabeçalho do `relatorio.html`.

**Comandos para reproduzir (com `--zona auto` e com zona explícita):**

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 100434 --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao6\idx_100434
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 25300 --zona SC-Z1 --pasta C:\Users\respawn\AppData\Local\Temp\revisao6\extra_25300_z1
```

**Trechos copiados (`resumo.txt` × `estudo.json["incertezas"][0]` no caso `25300` com `SC-Z1`):**

`resumo.txt`:
```text
Zona: SC-Z1 (informada pelo usuário, não conferida)
```

`estudo.json`:
```text
"Terreno na zona SC-Z1: NÃO conferido (sem origem informada (falta zona_origem no lote)). Confirmar a zona do lote antes de usar o estudo."
```

E no `relatorio.html` (`extra_25300`), a seção de zona exibe `Origem: zona sugerida pela leitura automática do mapa do Plano Diretor · não conferida (sugerida_pelo_mapa)`, enquanto a lista de incertezas na mesma página exibe `Terreno na zona SC-Z1: NÃO conferido (sem origem informada (falta zona_origem no lote)).`

---

### Achado 3 (BAIXA / limitação operacional) — 80% de recusa por `"Lote sem frente para rua"` em lotes sorteados e 3/5 em lotes urbanos por `--ponto`

No sorteio de 20 índices (`semente 20261115`), 16 foram recusados por frente (`80,0%`; uma varredura adicional com passo 200 em 551 lotes da base `completo` deu exatamente `441/551 = 80,0%` com essa mesma recusa e apenas `45/551 = 8,2%` aprovados). Nos casos inspecionados, a causa foi polígono com aresta frontal fragmentada abaixo de 8 m (mesmo encostado na rua) ou distância aos triângulos da malha `street_tris.json` ligeiramente acima de 6 m (ou ausência de malha próxima em áreas periféricas).

**Comandos para reproduzir exemplos típicos:**

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 94130 --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao6\idx_94130
python -I -X utf8 viabilidade/motor/estudar.py --base completo --ponto "-21.995100, -47.912000" --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao6\pt_5
```

**Trecho copiado da saída (`stderr`, código 2, sem criar pasta):**

```text
Erro: Lote sem frente para rua: nenhuma aresta de pelo menos 8 m aprovada por avaliar() a até 6 m do asfalto
```

*(Na geometria, o lote `94130` está a `0,00 m` da malha viária com arestas frontais de `7,34 m` e `6,53 m` < `8,0 m`; o lote `9574` do ponto `P5` está a `3,51 m` da malha com segmento de `4,59 m`; e o lote `59281` tem aresta de `11,08 m` a `6,03 m` da malha, 3 cm acima do corte de 6 m.)*

---

### Observação operacional — Concorrência no `.cache/` no Windows

Durante uma bateria anterior executada em paralelo com a reconstrução de `viabilidade/terreno/.cache/` pela Tarefa 8, duas invocações simultâneas de `estudar.py` saíram com código 2 sem traceback e sem deixar pasta de saída por disputa de escrita em `viabilidade/terreno/.cache/` (`[WinError 5] Acesso negado: '...\viabilidade\terreno\.cache'` e `[Errno 13] Permission denied: '...\viabilidade\terreno\.cache\tmpr56yi5fo.tmp'`). Em execução sequencial (com o cache já pronto), todas as 30 rodadas executaram sem erro de arquivo entre `1,484 s` e `6,392 s`.
