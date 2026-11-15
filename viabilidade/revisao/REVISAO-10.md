# Revisão 10 — T21, T22 (Terreno) e T27, T28 (Motor)

**Base revisada:** `git diff e9541362..89639ef2 -- '*.py' '*.json' '*.gz'` em cópia temporária isolada do commit `89639ef2` (sem tocar na worktree).

## Veredicto

**Sem achados `ALTA`, `MÉDIA` ou `BAIXA`.** Aprovado para seguir.

---

## 1. T21 — Rua do OSM e `make_valid` (`terreno/gerar_lotes.py`, `terreno/osm_vias.py`, `terreno/novo_lote.py`)

- **Travas da regra 4 (`gerar_lotes.py:199-268`):**
  - **5 classes:** `OSM_FRENTE = {"residential", "primary", "secondary", "tertiary", "living_street"}` (`gerar_lotes.py:199, 245`). Em `osm_vias.py:450`, `*_link` entram apenas para manter a conectividade da rede.
  - **Ligada à malha:** `vias_osm` usa Union-Find nas linhas que se intersectam e marca `ligada` apenas para componentes a até `6 m` de distância da malha (`tree_ruas.query(l, predicate="dwithin", distance=6)`).
  - **`<= 8 m` do eixo e `<= 20°`:** `OSM_EIXO_M = 8` (máximo nas amostras `0.15, 0.5, 0.85`) e `OSM_ANGULO = 20` (ângulo entre a corda da frente e o trecho do eixo em `[s-5, s+5]`).
  - **Não encostar em outro lote:** `miolo = substring(linha, 0.1, 0.9, normalized=True)` exige `distance > 0.5 m` de qualquer vizinho, e `shortest_line(amostras[1], eixo)` não pode cortar o próprio lote nem vizinhos (`> 0.5 m`).

- **5 lotes `rua_osm` inéditos (fora dos 31 de `RELATORIO-21.md` e `14421+14429` de `test_ponto.py`):**
  Sorteados com `random.Random(123456)` na base `completo` e inspecionados visualmente em recortes sobre `anexo02.jpg` (e sobre cadastro + OSM no `49438`, onde o Anexo 02 ainda não desenha o loteamento novo):
  - `17512` — `Rua Jorge Assef` (`residential`, `dist=5.833 m`, `ang=0.0°`): frente voltada para a rua no Anexo 02.
  - `49438` — `Avenida Italo Cardinali` (`residential`, `dist=5.834 m`, `ang=0.0°`): frente voltada para o eixo da avenida no cadastro + OSM.
  - `57370` — `Avenida Filomena Rispoli` (`residential`, `dist=5.804 m`, `ang=0.0°`): frente voltada para a avenida no Anexo 02.
  - `14819` — `Rua Alvaro Giongo` (`residential`, `dist=5.771 m`, `ang=0.1°`): frente voltada para a rua no Anexo 02.
  - `75402` — `Rua Lauriberto Duarte` (`residential`, `dist=5.857 m`, `ang=0.0°`): frente voltada para a rua no Anexo 02.

- **Reprodutibilidade byte a byte de `osm-vias-sao-carlos.json.gz`:**
  `sudeste-latest.osm.pbf` presente em `C:\Users\respawn\Desktop\imobiliaria\fontes_osm\`. Executado `osm_vias.py` na cópia temporária:
  ```text
  6434 vias, OSM de 2026-08-28T20:20:46Z; 0.34 MiB -> C:\Users\respawn\AppData\Local\Temp\revisao10\src\viabilidade\terreno\dados\osm-vias-sao-carlos.json.gz
  antes : 81d8b494ae83113cb0152ba559b6a78608ddf6c7ee431886ab62398733ec1a8a
  depois: 81d8b494ae83113cb0152ba559b6a78608ddf6c7ee431886ab62398733ec1a8a
  igual_byte_a_byte: True
  ```

- **Recusa do `make_valid` quando a área do vizinho muda `> 1%` (`novo_lote.py:242-246`):**
  Testado em `Cadastro.gerar` com vizinho inválido (`Ring Self-intersection`, área mudando `28.6%` sem sobrepor o lote avaliado):
  ```text
  g1.is_valid= False g1.area= 175.0 mv.area= 225.0 overlap= 0.0
  OK recusou: Não foi possível validar sobreposição: o vizinho de índice 1 tem geometria inválida (Ring Self-intersection[200020 7560010]) e consertá-la muda a área em 28.6% (limite 1%)
  ```

---

## 2. T22 — Desnível lote-rua (`terreno/novo_lote.py`)

- **Sinal:** `desnivel_lote_rua` (`novo_lote.py:330`) calcula `altura(c.x, c.y) - float(gl.np.median([altura(p.x, p.y) for p in pts]))`. Lote mais alto que a rua resulta positivo (`+2.1` no sintético e `+5.2` no `77022`), lote abaixo resulta negativo (`-2.1`).
- **Lote de esquina com asfalto de duas ruas:** `novo_lote.py:393` passa apenas a frente principal escolhida (`escolhida = qualidade["frentes"][0]`) para `desnivel_lote_rua`. O buffer de `25 m` ao redor dessa frente coleta o asfalto da via principal (e eventuais trechos da 2ª rua que caiam dentro desse raio de `25 m`), sem incluir trechos mais afastados da 2ª rua. Testado no lote de esquina `77033`:
  ```text
  esquina 77033: n_frentes= 2 esquina_malha= True desnivel= 0.6
  ```

---

## 3. T27/T28 — Motor (`motor/motor.py`, `motor/test_estudar.py`, `motor/test_motor.py`)

- **Aviso de relevo não muda `metricas`:** `_relevo(lote)` (`motor.py:735, 1066-1085`) alimenta apenas `alerta_relevo` e `_texto_desnivel` dentro de `folga` e `alertas`; nenhuma variável de cálculo usa `declive` ou `desnivel` (coberto também por `test_relevo` em `test_motor.py`).
- **Aviso `rua_osm` só na frente principal (`motor.py:787-796`):** lê `frentes[0]`. Conferido com teste na cópia temporária:
  ```text
  frente[1]=rua_osm -> alerta OSM? False incerteza OSM? False
  frente[0]=rua_osm -> count_opcao0= 1 count_inc= 1
  ```
- **`acrescimo_topo_m` dá erro com e sem gabarito (`motor.py:736-739`):** a validação (`0 <= acr < 50`, não `bool`, numérico) agora roda antes de `acr = acr if gabarito else 0`, corrigindo o achado `BAIXA` da Revisão 9. Coberto por `test_frente_osm_e_acrescimo_invalido` em `test_motor.py` (`ok`, exit `0`).
- **`test_estudar.py` (`test_estudar.py:69-72`):** aceita apenas alertas extras específicos de área especial (`nao_verificada` ou `possível incidência`) ou relevo (`Terreno com ~` / `Lote ~` terminando em `podem mudar; conferir com levantamento planialtimétrico.`), mantendo a checagem estrita.

---

## 4. `conferir.py` e `test_motor.py` na cópia temporária (`%TEMP%\revisao10\src`)

- `python -I -X utf8 ...\viabilidade\motor\test_motor.py` -> exit `0` (`ok`)
- `python -X utf8 ...\viabilidade\conferir.py`:
  ```text
  APROVADO      motor (173.0s)
  APROVADO      terreno (30.5s)
  APROVADO      lote-novo (78.0s)
  APROVADO      estudar (32.6s)
  APROVADO      relatorio (73.4s)
  REPROVADO     lei (0.1s)
     [conferir] zonas.json refeito igual ao versionado: False  -> lei.log
  APROVADO      visual (42.6s)
  NAO_EXECUTADO nada fora de viabilidade/ desde origin/main
     referência 'origin/main' não encontrada (git fetch?)
  soltos em viabilidade/: nenhum
  executados 7 | aprovados 6 | reprovados 1 | não executados 1 | log: viabilidade/.conferir/resumo.json
  ```
  Nota: `REPROVADO lei` e `NAO_EXECUTADO nada fora de viabilidade/ desde origin/main` decorrem apenas da extração via `git archive` no Windows (`lei/zonas.json` com `\r\n` vs `\n` e ausência de `.git` na cópia).
