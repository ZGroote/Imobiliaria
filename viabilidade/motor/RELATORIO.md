# Relatório do Motor, tarefa 3 (14/11): defeitos da auditoria

Motor v0.5.0. `python -I viabilidade/motor/test_motor.py` passa ("ok", ~110 s). Cada defeito tem um teste em `test_motor.py` (função `defeitos_da_auditoria`, mais as checagens novas em `confere` e em `monotonia`). Rodei os blocos contra o `motor.py` do commit anterior: todos falham nele (crash, `AssertionError` ou `ZeroDivisionError`).

## 1. O que foi corrigido

| # | Defeito | O que o motor faz agora | Teste |
|---|---|---|---|
| 1 ALTA | `ca_maximo` null quebrava (`TypeError`, zona real SC-Z6E) | Sem CA o teto de área é infinito. A procura de andares vem da altura, de `pavimentos_max` ou da premissa nova `pavimentos_sem_ca` (padrão 10). Entra uma incerteza explicando. | zona sem CA: 4 opções, sem crash |
| 6 ALTA | `_cabe` não olhava a permeabilidade | `_cabe` rejeita opção com área permeável abaixo do mínimo. A caixa do térreo, o subsolo e a parede cega ficam limitados a `(1 − permeabilidade) × lote`. `confere` agora confere a permeabilidade em todo estudo. | perm 35% e TO 100% + perm 25% |
| 2 ALTA | Subsolo saía do lote em L (escala pelo centroide) | O subsolo é a caixa encolhida igualmente em todo lado (buffer negativo com quina reta), sempre dentro do lote. | L com perm 35%: subsolo dentro do lote |
| 5 ALTA | Frente e fundos trocados em L com frente recuada | O sentido "rua pra dentro" vem de um passo a partir do meio da frente (o centroide é só reserva). Aresta é frente só se for paralela à rua e estiver perto da linha da frente; divisa interna do L vira lateral. | L com frente no trecho recuado: nada a menos do recuo da frente; quina do L reta |
| 3 e 4 ALTA | Monotonia em A, B e D | A e B já estavam ok desde a tarefa 2. A D ainda piorava (recuo fixo 2,5 → 2,0 m: 3703 → 3658 m²). Duas causas novas: base maior comia CA, e a base mínima só existia se a proporção casasse com a lista (dava vazio num lote estreito). Agora a base mínima é a torre crescida igualmente em volta (`_cresce`), e na busca por CA (laje encolhida) só ela entra, porque trocar de base no meio dava salto e a secante parava cedo. A secante também não aborta mais quando passa do tamanho natural. Resultado: D no recuo fixo 2,5 e 2,0 m dá **4070,01** nos dois (era 3703 → 3658). | casos mono-*: recuo fixo 2,5 → 2,0, TO 25 → 35%, CA 2,614 → 2,620 com TO 95%, mais os cinco que já existiam, em 3 lotes |
| 8 MÉDIA | Unidades fatiadas entre andares | Unidades = soma por pavimento de `int(privativa do andar / 60)`. Laje de 80,9 m² dá 55,9 m² por andar: 0 unidade (antes 3 em 4 andares). `confere` recalcula a conta por andar em todo estudo. | laje 80,9 m² |
| 9 MÉDIA | Vaga sumia calada; subsolo sem área dividia por zero | Sem área de subsolo, vira o alerta "Faltam vagas: precisa de N, S subsolo(s) comportam C. Em metricas.vagas ficam as C." `confere` exige o alerta sempre que `vagas` ficar abaixo do necessário. | subsolo vazio com vaga a fazer |
| 12 MÉDIA | Frente com dois pontos iguais e polígono em "8" quebravam | Polígono inválido: fica a maior parte, com incerteza. Área zero: `ValueError` claro. Frente degenerada: usa a maior aresta, com incerteza. | frente repetida, polígono em "8" |
| 11 MÉDIA | Último degrau da caixa (topo) sumia | A amostra de 12 degraus inclui o primeiro e o último. | exercitado pelos estudos com regra por altura |
| 14 BAIXA | `parede_cega_ate_m` passava da altura da caixa | `min(parede cega, altura da caixa)`. | idem |
| 15 BAIXA | Sem alerta quando o lote é menor que o mínimo da zona | Incerteza de lote abaixo de `lote_min_m2` e de testada abaixo de `testada_min_m` (a testada é o comprimento da frente). | lote 8 × 20 m |

## 2. Mudanças que a Visual e a central precisam saber

- **Os números mudaram.** `exemplos/estudo-exemplo.json` e os 7 `exemplos/pilotos/*.json` foram regenerados. **A Visual usa o `estudo-exemplo.json`.** Exemplo SC-Z2, unidades (antes → agora): A 47 → 36, B 78 → 60, C 56 → 56, D 42 → 32. A queda é só a conta certa por andar; antes o motor inventava apartamento atravessando andar. Pilotos (melhor opção): 30516 de 30 → 28, 37607 de 54 → 40, 22426 e 22421 em 12, 25297 de 5 → 4, q1382 de 94 → 72, remembramento de 82 → 64.
- **`caixa_maxima.area_computavel_max_m2` pode ser `null`** (zona sem CA). A Visual precisa tratar.
- **Premissa nova `pavimentos_sem_ca`** (padrão 10, escolha de projeto, não lei): só vale quando a zona não tem CA, altura nem pavimentos. Aparece em `premissas` e em `premissas.padrao`.
- Frente degenerada ou polígono inválido: o campo `lote` do estudo continua com o que veio; o motor só usa a versão corrigida por dentro e avisa em `incertezas`.
- O README não foi mexido.

## 3. Lentidão (MÉDIA 7): meta não atingida

Exemplo: **~2,5 s** (a meta era < 1 s; a auditoria mediu 7,8 s, então caiu a um terço, mas isso já vinha da tarefa 2 e não mudou nesta). Perfil: 2,1 s dos 3,0 s ficam em `_centros` (erosão exata dos retângulos, via `union_all` do shapely), chamada ~5.400 vezes. A D gasta ~1,7 s (134 gerações) e a B ~0,8 s.

Por que não dá pra baixar a 1 s sem risco: o motor gera um prédio por pavimento possível e escolhe o de maior privativa, sem cortar cedo. Isso é o que garante a monotonia (cortar quando "parou de subir" já provou piorar ao afrouxar a regra). Caminhos, em ordem de custo: (a) cache de `_centros` por região e tamanho (vários pavimentos repetem a mesma região); (b) trocar a erosão exata por uma grade grosseira com refino só no melhor; (c) podar só os pavimentos em que a laje ajustada ao CA já ficou abaixo da mínima. Nenhum foi feito; (a) é o de menor risco. Lotes grandes com CA alto continuam levando dezenas de segundos.

## 4. Pendentes (não cabem em 1–2 linhas)

- **MÉDIA 10:** zona sem limite de altura num lote grande dá prédio de ~98 pavimentos e subsolo de 100% da caixa por nível. Falta decidir um teto de projeto (premissa) e um teto de subsolo. A SC-Z6E cai nisso, agora com `pavimentos_sem_ca`.
- **MÉDIA 13:** `laje_max` trava a laje bruta em `TO × A`, mas a TO real desconta o núcleo (20 m² por prédio); a C não chega a 100% da TO permitida. Pequeno, mexe no limite de TO e na parede cega ao mesmo tempo.
- **BAIXA 16:** `utm.para_utm23s` não valida inversão (lat, lon) nem coordenadas fora do fuso 23S. Arquivo `utm.py`, não mexido.
- Triângulo isósceles da auditoria: o `recuo_fundos` parece não ser aplicado (a aresta oposta à frente vira lateral). Não mexi nem confirmei de novo.

## 5. Sem commit

`motor.py`, `test_motor.py`, `RELATORIO.md`, `exemplos/estudo-exemplo.json`, `exemplos/pilotos/` (7 arquivos). Também solto, mas não é meu: `viabilidade/auditoria/`.
