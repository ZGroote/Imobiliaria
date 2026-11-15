# Revisão 7 — Verificação independente das correções dos 4 achados ALTA

**Galho:** `viabilidade/lote-livre`  
**Escopo:** [TAREFA-7.md](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/revisao/TAREFA-7.md), comparando com [AUDITORIA-6.md](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/auditoria/AUDITORIA-6.md) e [REVISAO-6.md](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/revisao/REVISAO-6.md) sem confiar nos números de [RELATORIO-11.md](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/RELATORIO-11.md).

## Veredito

- **ALTA 1 (Eixo Estruturante aceito como zona de fundo no `--zona auto`):** **FECHADO.** Recusa corretamente tanto no caso da auditoria (`25369`) e no da regressão (`91923`) quanto no caso inédito (`88527`).
- **ALTA 2 (`Área de Interesse Histórico` translúcida invisível no Anexo 06):** **FECHADO.** Detectada em `74451`, `79299` e nos lotes inéditos `77022`, `77375`, `73053` e `80172`.
- **ALTA 3 (Vão entre cones do Anexo 07 cego para `gabarito_aeronautico`):** **FECHADO** como triagem conservadora (`possivel_incidencia`). Os 3 pontos da auditoria e o ponto inédito `(5050, 5500)` agora disparam o alerta.
- **ALTA 4 (Categorias omitidas dos Anexos 05, 06 e 07):** **PARCIALMENTE FECHADO.** As 3 categorias agora aparecem na triagem (`restricao_gabarito_historico`, `transporte_aereo`, `chacaras_recreio`), mas restam **1 achado MÉDIA** (`art. 80: 9 m` continua não aplicado numericamente ao gabarito do estudo, saindo prédios de `13.5 m`) e **2 achados BAIXA** (falsos positivos por retângulo/fecho convexo e erro de concorrência no `.cache/` sem trava entre processos).

---

## 1. Os 4 ALTA — Antes, Depois e Caso Inédito

| Achado | Caso da Auditoria / Regressão (antes → depois) | Caso inédito do Revisor | Veredito |
|---|---|---|---|
| **ALTA 1** (`Eixo` no `--zona auto`) | `idx=25369`: antes aceitava `SC-Z3`; **agora recusa (`rc=2`)** com `Alternativas: SC-Z3, SC-EIXO`. Na regressão, `idx=91923` antes saía `SC-Z3` (`alt: ['SC-EIXO']`); **agora recusa (`rc=2`)**. | `idx=88527` (Vila Sônia, ao lado do Eixo Estrut. Av. Grécia, conferido em `anexo02.jpg`): **recusa (`rc=2`)** com `Alternativas: SC-Z3, SC-EIXO`. | **FECHADO** |
| **ALTA 2** (`Área de Interesse Histórico` no Anexo 06) | `idx=74451`: antes não constava; **agora `rc=0`** com `Área de Interesse Histórico (sobreposição visual)` (`pixels_no_lote: 135`). Na regressão, `idx=79299` ganhou o alerta. | `idx=77375` e `idx=77022`: **`sobreposicao_visual`** (`SC-Z1`, `rc=0`). | **FECHADO** |
| **ALTA 3** (Vão entre cones no Anexo 07) | Pixels `(5150,5620)`, `(4800,5600)` e `(4950,5400)`: antes `nao_verificada`; **agora todos retornam `gabarito_aeronautico (possivel_incidencia)`** (`dist=0.0`). | Pixel `(5050,5500)` (`-21.867350, -47.910601`): retorna `('gabarito_aeronautico', 'possivel_incidencia', 0.0)` e `('transporte_aereo', 'possivel_incidencia', 0.0)`. | **FECHADO** |
| **ALTA 4** (Categorias omitidas: Subárea 9 m, AEI Transporte Aéreo, Chácaras de Recreio) | `idx=74451` agora traz `Subárea Especial de Restrição de Gabarito (art. 80: 9 m) (possível incidência)`. Pontos `(5150,5620)` e `(4950,5400)` trazem `transporte_aereo (possivel_incidencia)`. | `idx=77015` (Anexo 06: `restricao_gabarito_historico`); `(5220,5880)` (Anexo 07 hachura: `transporte_aereo`); `(6902,8492)` Parque Itaipu e `(4408,3576)` setor norte (Anexo 05: `chacaras_recreio`, `sobreposicao_visual`). | **PARCIAL** (ver achados abaixo) |

### Evidências reproduzíveis (comandos e saídas literais)

**ALTA 1 — Caso da auditoria (`25369`) e caso inédito (`88527`):**

```powershell
python -I viabilidade/motor/estudar.py --base completo --indices 25369 --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao7\b_25369
```
```text
Erro: Zona automática recusada: Traço de Eixo a até 60 m: art. 11 vale para lote com testada na via; conferir via, trecho e alinhamento cadastral (zona de fundo listada nas alternativas). Alternativas: SC-Z3, SC-EIXO. Confira o mapa e informe --zona SC-XX explicitamente. Rode de novo com --zona SC-XX, uma destas: SC-Z3, SC-EIXO.
EXIT_25369=2
```

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 88527 --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao7\tematicos\eixo_88527_auto
```
```text
Erro: Zona automática recusada: Traço de Eixo a até 60 m: art. 11 vale para lote com testada na via; conferir via, trecho e alinhamento cadastral (zona de fundo listada nas alternativas). Alternativas: SC-Z3, SC-EIXO. Confira o mapa e informe --zona SC-XX explicitamente. Rode de novo com --zona SC-XX, uma destas: SC-Z3, SC-EIXO.
```

**ALTA 2 e 4 — Caso da auditoria (`74451`):**

```powershell
python -I viabilidade/motor/estudar.py --base completo --indices 74451 --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao7\b_74451
```
```text
Lote: SC-completo-74451 (base completo, feições [74451])
Área: 517.353 m²
Zona: SC-Z1 (sugerida pelo mapa do Plano Diretor, não conferida; outras zonas por perto: nenhuma)
Áreas especiais encontradas: Área de Interesse Histórico (sobreposição visual); Subárea Especial de Restrição de Gabarito (art. 80: 9 m) (possível incidência); Superfícies de aproximação e decolagem do Aeroporto Mário Pereira Lopes (possível incidência)
Áreas especiais não verificadas: Anexo 06 (o resultado pode passar do que o terreno permite; conferir)
Domínio do motor: dentro
Opções calculadas: 1 (C)
```
*(No `estudo.json` de `74451`, a Opção C saiu com `"altura_m": 13.5, "pavimentos": 4` e o alerta `"ÁREA ESPECIAL sem altura numérica, NÃO aplicada: restricao_gabarito_historico (Subárea Especial de Restrição de Gabarito (art. 80: 9 m))."`)*

**ALTA 3 e 4 — Pontos da auditoria e pontos inéditos (`MapaEspecial`):**

```text
=== Anexo 07 Audit Gap Pixels ===
px=(5150,5620) -> latlon=(-21.873419, -47.905142) -> [('gabarito_aeronautico', 'possivel_incidencia', 0.0), ('transporte_aereo', 'possivel_incidencia', 0.0), ('nao_verificada', 'nao_verificada', None)]
px=(4800,5600) -> latlon=(-21.872271, -47.924341) -> [('gabarito_aeronautico', 'possivel_incidencia', 0.0), ('nao_verificada', 'nao_verificada', None)]
px=(4950,5400) -> latlon=(-21.862285, -47.916064) -> [('gabarito_aeronautico', 'possivel_incidencia', 0.0), ('transporte_aereo', 'possivel_incidencia', 0.0), ('nao_verificada', 'nao_verificada', None)]

=== New pixel coordinates for ALTA 3 & ALTA 4 ===
ALTA3_gap_new_center anexo=07 px=(5050,5500) latlon=(-21.867350,-47.910601) -> [('gabarito_aeronautico', 'possivel_incidencia', 0.0), ('transporte_aereo', 'possivel_incidencia', 0.0), ('nao_verificada', 'nao_verificada', None)]
ALTA4_aei_hatched_new anexo=07 px=(5220,5880) latlon=(-21.886509,-47.901361) -> [('gabarito_aeronautico', 'possivel_incidencia', 0.0), ('transporte_aereo', 'possivel_incidencia', 0.0), ('nao_verificada', 'nao_verificada', None)]
ALTA4_aei_bbox_false_pos_9A anexo=07 px=(5500,5200) latlon=(-21.852461,-47.885844) -> [('gabarito_aeronautico', 'possivel_incidencia', 0.0), ('transporte_aereo', 'possivel_incidencia', 0.0), ('nao_verificada', 'nao_verificada', None)]
ALTA4_chacaras_itaipu anexo=05 px=(6902,8492) latlon=(-22.070396,-47.802802) -> [('chacaras_recreio', 'sobreposicao_visual', 0.0)]
ALTA4_chacaras_norte anexo=05 px=(4408,3576) latlon=(-21.933869,-47.877838) -> [('chacaras_recreio', 'sobreposicao_visual', 0.0)]
```

*(Observação de cobertura do cadastro: na varredura completa da base `completo`, o lote válido mais ao norte está em `py07=7148` (`idx=105406`, ~8,8 km ao sul da pista), não havendo lotes de `completo` dentro do retângulo `AEI_TRANSPORTE_AEREO` nem em `Chácaras de Recreio`.)*

---

## 2. Regressão dos 20 lotes da Revisão 6 (semente `20261115`)

Comando executado para cada índice da lista `[39431, 3321, 62350, 92058, 100434, 94130, 86650, 108586, 79299, 21164, 46087, 23249, 91412, 91923, 102159, 104833, 59281, 82415, 25212, 97132]`:

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices <IDX> --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao7\regressao\reg_<IDX>
```

- **Nenhum lote foi aceito com zona errada:** conferidos os recortes de `anexo02.jpg` para os 4 lotes recém-aceitos pela regra de frente ampliada (`94130` em salmão `SC-Z4`, `21164` e `59281` em amarelo `SC-Z2`, `82415` em azul-acinzentado `SC-Z3`), todos em cor sólida da respectiva zona e longe de eixos/divisas.
- **Nenhum alerta especial anterior desapareceu** nos lotes que continuaram gerando estudo (`100434`, `79299`, `25212`).

| Índice | `REVISAO-6` (`rc` / zona / especiais) | Atual (`rc` / zona / especiais) | Mudança |
|---|---|---|---|
| `91923` | `rc=0`, `SC-Z3` (`alt: ['SC-EIXO']`), sem especiais encontrados | **`rc=2` (recusado por `Traço de Eixo a até 60 m`: `SC-Z3, SC-EIXO`)** | Corrigido (ALTA 1) |
| `79299` | `rc=0`, `SC-Z1`, só `nao_verificada` (05/06/07) | `rc=0`, `SC-Z1`, **`interesse_historico (sobreposicao_visual)` + `restricao_gabarito_historico (possivel_incidencia)`** + `nao_verificada` | Ganhou alertas do Anexo 06 |
| `94130` | `rc=2` (sem frente) | `rc=0`, `SC-Z4`, `AIA (possivel_incidencia)`, `AEIS tipo 2 (sobreposicao_visual)` | Passou na frente ampliada; zona conferida em `anexo02.jpg` |
| `21164` | `rc=2` (sem frente) | `rc=0`, `SC-Z2`, `gabarito_aeronautico (possivel_incidencia)` | Passou na frente ampliada; zona conferida em `anexo02.jpg` |
| `59281` | `rc=2` (sem frente) | `rc=0`, `SC-Z2`, `gabarito_aeronautico (possivel_incidencia)` | Passou na frente ampliada; zona conferida em `anexo02.jpg` |
| `82415` | `rc=2` (sem frente) | `rc=0`, `SC-Z3`, `nenhuma` especial encontrada | Passou na frente ampliada; zona conferida em `anexo02.jpg` |
| `23249` | `rc=2` (sem frente) | `rc=2` (`Cores de mais de uma zona`: `SC-Z2, SC-Z3`) | Passou frente, recusado por divisa de zona |
| `100434`, `25212` | `rc=0` (`SC-Z4` / `SC-Z2`) | Idênticos (`rc=0`, mesmos alertas e opções) | Sem alteração |
| Demais 11 índices | `rc=2` (sem frente) | `rc=2` (sem frente) | Sem alteração |

---

## 3. Dez novos lotes temáticos

### 3.1. Cinco lotes mais próximos do aeroporto com `--zona auto` válido

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices <IDX> --zona auto --pasta C:\Users\respawn\AppData\Local\Temp\revisao7\tematicos2\lote_<IDX>
```

*(Nota: os 5 lotes válidos mais próximos ainda ao norte — `37768`, `97554`, `277`, `37818`, `100046` — também disparam `gabarito_aeronautico`, mas são recusados no `--zona auto` por estarem em borda/área branca do Anexo 02 ou divisa `SC-Z3/SC-Z4`. Os 5 abaixo são os mais próximos do aeroporto que fecham o estudo completo com `--zona auto`.)*

| Índice | Dist. aeroporto | Zona (`rc`) | Alertas encontrados no estudo | Conferência visual (`anexo07.jpg`) |
|---|---|---|---|---|
| `97558` | 8.928,0 m | `SC-Z3` (`rc=0`) | `AEI de Urbanização Específica (sobreposição visual)`; `Superfícies de aproximação e decolagem do Aeroporto Mário Pereira Lopes (possível incidência)` | Dentro do cone tracejado roxo |
| `97536` | 9.030,5 m | `SC-Z3` (`rc=0`) | `AEI de Urbanização Específica (sobreposição visual)`; `gabarito_aeronautico (possível incidência)` | Dentro do cone tracejado roxo |
| `249` | 9.121,0 m | `SC-Z3` (`rc=0`) | `AEI de Urbanização Específica (sobreposição visual)`; `gabarito_aeronautico (possível incidência)` | Fora do tracejado roxo (a leste), dentro do fecho convexo |
| `144` | 9.143,8 m | `SC-Z3` (`rc=0`) | `AEI de Urbanização Específica (sobreposição visual)`; `gabarito_aeronautico (possível incidência)` | Fora do tracejado roxo (a leste), dentro do fecho convexo |
| `106` | 9.167,7 m | `SC-Z3` (`rc=0`) | `AEI de Urbanização Específica (sobreposição visual)`; `gabarito_aeronautico (possível incidência)` | Fora do tracejado roxo (a leste), dentro do fecho convexo |

### 3.2. Cinco lotes no centro histórico / entorno

```powershell
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices <IDX> --zona auto --pasta <PASTA>
```

| Índice | Zona (`rc`) | Alertas encontrados no estudo | Opção C (pav. / altura) | Conferência visual (`anexo06.jpg`) |
|---|---|---|---|---|
| `77015` | `SC-Z1` (`rc=0`) | `restricao_gabarito_historico (possivel_incidencia)`; `gabarito_aeronautico (possivel_incidencia)` | `4` pav. / `13.5 m` | Dentro da subárea 9 m; toca marcador branco `32/33` (`interesse_historico` encoberto) |
| `77022` | `SC-Z1` (`rc=0`) | `interesse_historico (sobreposicao_visual)`; `restricao_gabarito_historico (possivel_incidencia)`; `gabarito_aeronautico (possivel_incidencia)` | `4` pav. / `13.5 m` | Dentro da `Área de Interesse Histórico` e da subárea 9 m |
| `77375` | `SC-Z1` (`rc=0`) | `interesse_historico (sobreposicao_visual)`; `restricao_gabarito_historico (possivel_incidencia)` | `4` pav. / `13.5 m` | Dentro de ambas |
| `73053` | `SC-Z1` (`rc=0`) | `interesse_historico (possivel_incidencia, 9.09 m)`; `gabarito_aeronautico (possivel_incidencia)` | `4` pav. / `13.5 m` | Fora da subárea 9 m e na borda externa do interesse histórico |
| `80172` | `SC-Z1` (`rc=0`) | `interesse_historico (sobreposicao_visual)` (sem `restricao_gabarito_historico`) | `4` pav. / `13.5 m` | Ao sul da subárea 9 m, dentro da `Área de Interesse Histórico` |

---

## 4. Novos achados desta revisão

### MÉDIA — Limite de 9 m da Subárea Especial de Restrição de Gabarito (art. 80) não é aplicado no cálculo do estudo
- **Onde:** [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L152-L155).
- **Evidência:** Em `74451`, `77015`, `77022` e `77375`, `restricao_gabarito_historico` sai sem `altura_max_m`, e o motor calcula a Opção C com `4` pavimentos e `13.5 m` (excedendo 9 m), apenas emitindo `"ÁREA ESPECIAL sem altura numérica, NÃO aplicada: restricao_gabarito_historico (Subárea Especial de Restrição de Gabarito (art. 80: 9 m))."`.

### BAIXA — Aproximações por retângulo / fecho convexo geram falsos positivos de `possivel_incidencia`
- **Onde:** [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L35-L38), [`ler_cones`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L90-L97) e [`ler_subarea`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L99-L104).
- **Evidência:**
  - `AEI_TRANSPORTE_AEREO = (4940, 4940, 5560, 6260)` marca o ponto `(5500, 5200)` (`-21.852461, -47.885844`, em área rural verde `9A` fora da hachura) como `transporte_aereo (possivel_incidencia)`.
  - `ler_cones` une os dois cones em um único `convex_hull`, marcando lotes a leste do cone sul (`249`, `144`, `106`) e pontos a oeste da pista (`4800, 5600`) fora do tracejado roxo.
  - `ler_subarea` usa `convex_hull` sobre polígono côncavo do tracejado magenta, incluindo quinas externas no topo-esquerdo e na base-direita.

### BAIXA — Cache em `viabilidade/terreno/.cache/` sem trava entre processos concorrentes
- **Onde:** gravação temporária em `viabilidade/terreno/.cache/` durante execução de `estudar.py` em paralelo com outro processo gravando o cache.
- **Evidência (saída literal observada na primeira execução dos lotes `97558`, `97536`, `249`, `144`, `106`, `77022`):**
```text
Erro: [Errno 13] Permission denied: 'C:\\Users\\respawn\\Desktop\\imobiliaria-viabilidade\\viabilidade\\terreno\\.cache\\tmpikzenkn0.tmp'
```
Na reexecução após o término da gravação concorrente, todos os 6 comandos concluíram com `rc=0`.
