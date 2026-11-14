# Relatório do Motor, tarefa 4 (14/11): auditoria 2

Motor **v0.6.0**. `python -I viabilidade/motor/test_motor.py` passa ("ok", ~55 s). Cada conserto tem teste em `test_motor.py` (`monotonia(..., auditoria=True)`, `defeitos_da_auditoria`, `confere`, laço dos 7 pilotos). Rodei os casos contra o `motor.py` do commit anterior: todos falham nele (opção com 0 unidade, unidades caindo ao afrouxar, `KeyError`/crash).

## 1. O que foi feito

| # | Item | O que o motor faz agora | Teste |
|---|---|---|---|
| 1 | Opção com 0 unidade | `_cabe` exige pelo menos 1 apartamento. Opção que não dá apartamento sai do estudo, com incerteza "Opção X não coube: motivo". Escaleno: sobram A e C (2 un.); simétrico: 4 opções. | `confere` exige `unidades >= 1`; os 2 triângulos |
| 2 | Monotonia em unidades | O "melhor" de cada opção passa a ser **mais unidades; empate, mais área privativa; empate, menos pavimentos** (`_chave`). A escolha entre opções no `gerar_pilotos.py` usa a mesma ordem. | `monotonia` compara unidades e, com unidades iguais, privativa |
| 3a | `mono-ca-20-d → 25-d` | Resolvido pelo critério acima: com mais CA o candidato antigo continua disponível, então não dá menos unidades (A 24→32, D 20→26 no 22x41). | caso do lote 22x41 |
| 3b | D que sumia (`sumico-d-2m0 → 1m5`) | A base crescida por bisseção sobrava ~1e-5 m² abaixo do alvo e a regra "torre menor que 90% da base" a descartava. Folga de 0,01 m². D passa a existir nos dois casos (14 un.). | sumiço da D, recuo 2,0 → 1,5 |
| 3c | `garagem_computavel=True` | A garagem conta no CA só a área que as vagas pedem (nível encolhido), em vez da caixa inteira. Caixa maior não rouba mais CA. Recuo 2,5 → 2,0 → 1,5: 54/54/52/48 un. nos três. | `_garagem_comp` 2,5 → 2,0 e 2,0 → 1,5 |
| 4 | Teto de altura | Premissa **`pavimentos_max_projeto`** (padrão 30, marcada como padrão, escolha de projeto e não lei). Vale para toda opção, **na D como embasamento + torre**. Quando a zona não tem CA, `pavimentos_sem_ca` (10) também vale pra D. Alerta "Parou no teto de projeto" quando é o teto que mandou. Lote enorme (100×200): 30 pav. nas opções altas (era 103–108). | lote enorme com teto 30 e com teto 8; zona sem CA |
| 5a | `recuo_fundos` no triângulo | Sem aresta de fundos, a caixa fica a `recuo_fundos` do vértice mais fundo (círculo). | triângulo simétrico, 10 m |
| 5b | `cap_style="square"` no L | Faixas de recuo sem ponta quadrada, mais um preenchimento quadrado só nas quinas côncavas. Fundos só vale perto do fundo de verdade (o degrau interno do L não leva mais 10 m de fundos). | L aba-fundos e L frente-recuada |
| 5c | `confere()` com frente repetida | O `lote` do estudo agora leva o que o motor usou (frente corrigida, polígono em "8" corrigido). | frente repetida e polígono em "8" passam no `confere` |
| 6 | Lentidão | `lru_cache` em `maior_retangulo`, `_maior_lamina`, `dois_quadrados` (a geometria do shapely 2 é hasheável). O teto de pavimentos também corta tentativas. Exemplo: **1,4 s** a frio (meta 1,5), 0,5 s repetido. Antes 2,5 s. | medido |

Achado no caminho: o piloto 22421 quebrava (`ValueError: The first input geometry is empty`) com uma região de área zero na procura do retângulo. `maior_retangulo` devolve polígono vazio nesse caso. O laço dos 7 pilotos no teste cobre.

## 2. Dá pra garantir a monotonia em unidades?

**Quase, e o teste cobre.** Com o critério "mais unidades, depois mais privativa", afrouxar uma regra mantém o candidato antigo disponível, então unidades nunca caem **por construção**. O que sobra:

- Ruído numérico da secante e da bisseção: com as mesmas unidades a privativa pode cair uns centésimos (visto: 729,10 → 729,06 m²). O teste aceita 0,1 m².
- Regime "faltam vagas" (subsolos no limite): a garagem corta unidades por outro caminho e a conta de CA não é monótona. Não apareceu em nenhum caso testado, mas não está provado.
- Garantia vale para o que o teste varre (recuo, TO, CA, altura, recuo dos 2 primeiros pavimentos, mais 8 casos da auditoria), não para toda combinação.

## 3. Que a Visual e a central precisam saber

- **Os números mudaram de novo.** `exemplos/estudo-exemplo.json` e os 7 `exemplos/pilotos/*.json` foram regenerados. Exemplo SC-Z2, unidades (antes → agora): A 36 → 45, B 60 → 72, C 56 → 56, D 32 → 39. Melhor opção por piloto: 30516 de 28 → 32, 37607 de 40 → 54, 22426 e 22421 em 12, 25297 em 4, q1382 de 72 → 84, remembramento de 64 → 81.
- **Pode faltar opção.** Triângulo escaleno devolve só A e C; `opcoes` já podia vir com menos de 4, agora acontece com mais frequência. A Visual não pode assumir 4 opções.
- Premissa nova `pavimentos_max_projeto` em `premissas` e em `premissas.padrao`.
- Os volumes de subsolo seguem o mesmo formato; o campo interno `_nivel_m2` não vai pra saída.
- O `lote` do estudo pode diferir do de entrada (frente ou polígono corrigidos), com incerteza avisando.
- README não mexido.

## 4. Pendentes

- **MÉDIA 13** (da tarefa 3): `laje_max` trava a laje bruta em `TO × A`, mas a TO real desconta o núcleo. Não mexi.
- **BAIXA 16:** `utm.para_utm23s` não valida (lat, lon) invertido nem fuso. Não mexi.
- Triângulo escaleno: a torre única dá só 2 apartamentos em 2 pavimentos. É o que cabe, mas vale o Auditor olhar se a caixa está sendo avaliada com folga demais no vértice.
- Cache: `lru_cache` guarda até 4096 regiões por função, memória cresce nos lotes grandes em processo longo.

## 5. Sem commit

`motor.py`, `test_motor.py`, `gerar_pilotos.py`, `RELATORIO.md`, `exemplos/estudo-exemplo.json`, `exemplos/pilotos/` (7 arquivos). Nada commitado (sem autorização).
