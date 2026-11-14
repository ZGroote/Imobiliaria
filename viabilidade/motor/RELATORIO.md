# Relatório do Motor, tarefa 5 (14/11): auditoria 3

Motor **v0.7.0**. `python -I viabilidade/motor/test_motor.py` passa ("ok"). Os consertos têm teste novo em `auditoria3()` (`test_motor.py`); rodei esse teste contra o `motor.py` do commit anterior e ele falha lá (`AttributeError: 'Point' object has no attribute 'exterior'`, o primeiro item). `relatorio/test_relatorio.py` também passa. Exemplo e os 7 pilotos regenerados (`preparar_exemplo.py`, `gerar_pilotos.py`).

## 1. O que foi feito

| # | Item | Causa e conserto | Teste |
|---|---|---|---|
| 1 | Crash no triângulo escaleno (3.5.1) | **Reproduziu**: `gerar_estudo` com `lote-triangular-escaleno.json` + `zona-base.json` dava `AttributeError` em `_arestas` (chamada de `tenta_d`). A torre da D é `caixas.local(...).intersection(cb)`, e a interseção de duas regiões pode ser `Point` ou linha. Agora `maior_retangulo`, `_maior_lamina` e `dois_quadrados` tratam região sem área como vazia, e `_arestas` ignora ponto/linha solto numa coleção. O escaleno devolve A e C. As 22 variantes `lote-*.json` da auditoria rodam sem crash. | escaleno em UTM, com e sem regra por altura; `Point` nas 3 funções |
| 2 | Recuo de fundos em lote torto (3.5.2–3) | A divisa de fundos era decidida pelo **ponto médio** da aresta (`p >= pmax - tol`). Divisa inclinada tem o meio longe do fundo, então virava lateral (1,5 m). Agora vale a **ponta mais funda** da aresta. Mais um disco de raio `rb` nas pontas das divisas de fundos: no canto obtuso a faixa reta deixava uma cunha a 3,35 m da divisa. `caixa_recuada` devolve vazio quando sobra só fiapo (1e-15 m²). O degrau interno do L continua lateral. | trapézio de fundo inclinado, triângulo raso (rb 3 m mede, rb 10 m dá caixa vazia), pentágono: nenhuma divisa de fundos a menos de `rb` |
| 3 | `pavimentos_sem_ca` com `altura_max_m` (3.4.1) | Zona sem CA e sem `pavimentos_max` agora usa `pavimentos_sem_ca` mesmo com altura de cone/gabarito. A incerteza diz isso ("a altura limita a 90 m ... procurou até 10 pavimentos, premissa, não é lei"). Cone de 90 m: A 10, B 10, C 4, D 10 pavimentos (era B 19 e D 16). | cone de 90 m sem CA |
| 3b | Alerta falso "Parou no teto de projeto" (3.4.2) | O alerta saiu de `fecha` e foi para `_melhor`: só dispara se o melhor prédio está no teto de projeto **e** o prédio com mais um andar (teto solto) daria mais apartamentos (`_parou_no_teto`). CA, altura da lei ou teto da lei no mesmo andar não alertam. O lote enorme 100×200 continua com o alerta. | altura da lei = 30 pavimentos: opções chegam a 30 sem alerta |
| 4 | `@lru_cache` (3.6) | **Objeto mutável confirmado**: `dois_quadrados` devolvia `list`. Agora devolve `tuple` (`()` quando não cabe). As outras duas devolvem `Polygon` (imutável). Resultado igual entre 1ª e 2ª chamada: as funções são puras e a chave é a geometria do shapely 2 (comparação exata); não achei risco de resultado mudar. | resultado de `dois_quadrados` sem `.clear` |
| 5 | `garagem_computavel=True` (3.2) | **Não consertei**, não é conserto curto (o subsolo maior gasta CA, a laje cruzando múltiplo de 60 m² dá degrau no computável, e `_sub_final` desenha o subsolo encolhido diferente do que `_avaliar` mediu). Virou **limitação conhecida**: com `garagem_computavel=True` o estudo traz incerteza dizendo que o resultado não é monotônico e é estimativa. Em São Carlos a garagem não conta no CA (zona manda e fica `False`), então não aparece. | com e sem o regime |

## 2. O que mudou nos números

- Exemplo e 6 dos 7 pilotos: **mesmas unidades e pavimentos por opção**. O JSON só diferiu na versão (`0.7.0`) e nos vértices dos polígonos (a união com disco gera pontos extras).
- Piloto **remembramento 75352-75354, opção B: 56 → 66 unidades** (28 → 11 pavimentos, torres de 232 m² no lugar de 101 m²). A caixa tem a mesma área e a mesma forma de antes; só mudaram os vértices, e a procura de dois quadrados é sensível a eles. É resultado melhor e passa no `confere`, mas mostra que a procura não é estável a vértice à toa.
- Quem usa a versão do motor (`relatorio/saida/*.html` cita `0.6.0`) deve regerar. Não regerei: é da frente Relatório.

## 3. Pendentes (iguais aos da tarefa 4, não mexi)

- **MÉDIA 13:** `laje_max` trava a laje bruta em `TO × A`, mas a TO real desconta o núcleo.
- **BAIXA 16:** `utm.para_utm23s` não valida (lat, lon) invertido nem fuso.
- Auditoria 3, item 3.1: a permeabilidade (`_Caixas.fixa_limite`) muda a proporção da caixa quando o recuo diminui, e a opção B de `lote-20x35-perm-b` pode sumir ao afrouxar o recuo. **Não estava na tarefa 5**, não mexi.
- Cache: `lru_cache` guarda até 4096 regiões por função; memória cresce em processo longo com lotes grandes.

## 4. Sem commit

`motor.py`, `test_motor.py`, `RELATORIO.md`, `exemplos/estudo-exemplo.json`, `exemplos/pilotos/` (7 arquivos). Nada commitado (sem autorização). Na árvore há também 4 arquivos da frente Visual (Codex), que não toquei.
