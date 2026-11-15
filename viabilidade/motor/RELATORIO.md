# Relatório do Motor, tarefa 7 (14/11): auditoria 4

Motor **v0.7.1** (sem troca de versão). `python -I viabilidade/motor/test_motor.py` passa ("ok"); os 4 consertos têm teste em `tarefa7()`. Exemplo e os 7 pilotos regenerados (`preparar_exemplo.py`, `gerar_pilotos.py`).

## 1. O que foi feito

| # | Item | Causa e conserto | Teste |
|---|---|---|---|
| 1 | ALTA 1: unidades na métrica ≠ unidades da geometria exportada | **Reproduzi** no lote 20×40, TO 0,35 (sem permeabilidade, CA 6): a opção B dava 68 unidades na métrica e 34 contando pelo `base_utm`. A métrica usava a área sem arredondar; o `base_utm` sai a 1 cm. Agora `_volume` guarda como `_geom` o polígono **já arredondado**, então métrica e `confere` medem a mesma área. Efeito colateral: com a área em degraus de 1 cm a secante do `_ajusta_ao_ca` empacava num degrau (a opção A do exemplo parava a 3,47 de CA em vez de 3,50). Ela agora guarda o intervalo (cabe / passa) e cai na bisseção quando empaca; até 12 rodadas (era 7). | lote 20×40, TO 0,35: `confere` passa |
| 2 | MÉDIA 4: rótulo `parede_cega` / recuo 0,0 em base que não toca a divisa | Na base do D com parede cega, o recuo agora é a **distância real** até a divisa (`recuo_lateral_m` = `recuo_fundos_m`) e `parede_cega` só vale se a base sai da caixa do recuo normal (ou seja, usa a isenção). Base encostada: 0,0. Base solta a 0,19 m: 0,19 (antes dizia 0,0). | TO 90% com base de 90% (encosta, 0,0) e de 80% (solta, 0,19 m); exemplo sem parede cega ganha e mantém 1,5 m |
| 3 | BAIXA 5: `parede_cega_ate_m` 12 com caixa de altura 0 | Sem opção a altura da caixa é 0 e o valor sai 0 (não 12). | lote 10×15: sem opções, altura 0, parede cega até 0 |
| 4 | BAIXA 6: subsolo ocupava 100% da projeção | Em qualquer regime (não só `garagem_computavel`), cada nível sai com `vagas × area_por_vaga_m2 / níveis` (a vaga de 27 m² já traz a circulação), encolhido pra dentro da caixa (`_encolhe`, com cache). A área permeável e a garagem da métrica usam esse mesmo polígono (antes a permeável contava o subsolo cheio; também resolve a parte "não atualiza `area_permeavel_m2`" da MÉDIA 3). `_sub_final` e `_nivel_m2` saíram. | lote 100×200: nível = vagas × 27 m² nas 4 opções, bem abaixo da projeção; `confere` passa |

## 2. O que mudou nos números

- **Unidades e pavimentos por opção: iguais** no exemplo e nos 7 pilotos (conferi contra o `HEAD`).
- `area_garagem_m2` cai muito (exemplo A: 2.252,64 → 1.215,00; piloto 22421: 455,44 → 108,00 a 324,00) e a `area_permeavel_m2` sobe (exemplo A: 392,68 → 855,11). `area_construida_m2` cai junto (a garagem não conta no CA, então o computável não muda).
- Área privativa mexe ±0,1% (arredondamento a 1 cm da laje; exemplo A 2.768,50 → 2.767,01).
- Custo do arredondamento: a laje agora só assume valores a 1 cm, então o ajuste ao CA pode parar até ~0,2% abaixo do teto (opção A do exemplo, antes 3,500 de CA, agora 3,492). Mesmas unidades.

## 3. Limitações conhecidas (não mexi, como pedido)

- **MÉDIA 2**: recuo assimétrico (lateral 1,5 m, fundos 10 → 3 m) com permeabilidade apertada pode perder unidades. O limite de permeabilidade só é provado monotônico no recuo simétrico. Não achei jeito simples de detectar no estudo pra pôr incerteza.
- **MÉDIA 3**: `garagem_computavel = True` continua não monotônico (já tem incerteza no estudo).

## 4. Sem commit

`motor.py`, `test_motor.py`, `RELATORIO.md`, `exemplos/estudo-exemplo.json`, `exemplos/pilotos/` (7 arquivos). Nada commitado (sem autorização).
