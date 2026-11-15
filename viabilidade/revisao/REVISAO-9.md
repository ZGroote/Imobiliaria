# Revisão 9 — T19 (`b236fec4`) e T24 (`e3ecfafd`) no galho `viabilidade/pos-124`

**Base revisada:** `git diff 633ddaeb..e9541362 -- '*.py' '*.json'` em cópia temporária isolada do commit `e9541362` (sem tocar na worktree onde T21/T26 trabalham).

## Veredicto

**Sem achados `ALTA` nem `MÉDIA`; 1 achado `BAIXA` (validação de `acrescimo_topo_m` ignorada quando não há gabarito).** Aprovado para seguir.

---

## Achados por gravidade

### [BAIXA] `acrescimo_topo_m` inválido é silenciosamente ignorado em lote sem gabarito (`viabilidade/motor/motor.py:736-738`)
Quando o lote não tem gabarito de área especial (`gabarito is None`), a linha 736 faz `acr = pr["acrescimo_topo_m"] if gabarito else 0` **antes** da validação das linhas 737-738. Como resultado:
- Valores válidos (ex.: `3.0`) são ignorados na conta (correto), mas permanecem em `premissas["acrescimo_topo_m"]`.
- Valores inválidos (ex.: `-5`, `"abc"`) passam sem `ValueError`, diferentemente do que ocorre quando há gabarito.
- Em nenhum caso altera a conta (`opcoes` idênticas ao estudo sem a premissa).

Comando de reprodução (na cópia temporária):
```powershell
python -I -X utf8 -c "
import sys, json, pathlib, copy
root = pathlib.Path(r'C:\Users\respawn\AppData\Local\Temp\revisao9\src\viabilidade')
sys.path.insert(0, str(root / 'motor'))
import motor
zonas = {z['id']: z for z in json.loads((root / 'lei/zonas.json').read_text(encoding='utf-8'))}
lotes = {l['id']: l for l in json.loads((root / 'terreno/lotes-piloto.json').read_text(encoding='utf-8'))}
lote_base = copy.deepcopy(lotes['SC-completo-25297']); lote_base['areas_especiais'] = []
zona_base = copy.deepcopy(zonas['SC-Z1'])
r3_b = motor.gerar_estudo(lote_base, zona_base)
r3_a = motor.gerar_estudo(lote_base, zona_base, premissas={'acrescimo_topo_m': 3.0})
r3_neg = motor.gerar_estudo(lote_base, zona_base, premissas={'acrescimo_topo_m': -5})
r3_str = motor.gerar_estudo(lote_base, zona_base, premissas={'acrescimo_topo_m': 'abc'})
print('3) sem_gab: acr=3.0 iguais=', r3_a['opcoes'] == r3_b['opcoes'], 'acr=-5 iguais=', r3_neg['opcoes'] == r3_b['opcoes'], 'acr=abc iguais=', r3_str['opcoes'] == r3_b['opcoes'], 'prem_3=', r3_a['premissas'].get('acrescimo_topo_m'))
"
```
Saída:
```text
3) sem_gab: acr=3.0 iguais= True acr=-5 iguais= True acr=abc iguais= True prem_3= 3.0
```

---

## 1. T19 (Terreno, `b236fec4`)

- **`reconferencia` só em `dados/anotacoes-zonas.json`:** confirmado no diff (`viabilidade/terreno/dados/anotacoes-zonas.json` e gerador `viabilidade/terreno/dados/zonas-anotar.py`).
- **`preparar_zonas.py` não leva ao lote:** `viabilidade/terreno/preparar_zonas.py:39` exclui `"reconferencia"` do dicionário `lote["anotacao_zoneamento"]`.
- **Pode vazar por outro caminho?** Busca em todos os `.py` de `viabilidade/` por `anotacoes-zonas|reconferencia|anotacao_zoneamento` confirmou que nenhum outro script copia `reconferencia` para `lotes-piloto.json` ou para estudos (`dados/eixo-reproduzir.py:121` e `dados/z2-reproduzir.py:66` apenas leem `fontes` / item 0 para referência).
- **`testar_pilotos.py` e `ORIGINAIS`:** `viabilidade/terreno/testar_pilotos.py:158-159` valida `reconferencia` e garante que o campo não entra no lote; `--reproduzir` manteve `ORIGINAIS`.
- **Distâncias "antes e depois" vs `RELATORIO-18.md`:** todas as 7 entradas em `dados/anotacoes-zonas.json` / `dados/zonas-anotar.py` batem com `viabilidade/terreno/RELATORIO-18.md`:
  - `30516`: `null` / `null` (`nenhuma a 250 m -> nenhuma`)
  - `37607`: `null` / `null` (`nenhuma -> nenhuma`)
  - `22426`: `29.7` / `3.7` (`29,7 -> 3,7`)
  - `22421`: `0.0` / `12.9` (`0,0 -> 12,9`)
  - `25297`: `50.8` / `71.4` (`50,8 -> 71,4`)
  - `q1382`: `null` / `null` (`não se aplica`)
  - `75352`: `24.4` / `9.2` (`24,4 -> 9,2`)

---

## 2. T24 (Motor, `e3ecfafd`)

- **Lote com altura de zona menor que o gabarito (`zona=6.0 m`, `gabarito=9 m`):** `acrescimo_topo_m` **não entrou** (`acr_in_prem= False`, `in_padrao= False`, `n_opcoes= 1`, `alt_max= [4.5]`, `folgas= []`).
- **Lote com duas áreas especiais de altura diferente (`12 m` e `9 m`):** prevalece a menor (`9 m`) e `origem_altura` aponta `art. 80 do Plano Diretor`:
  ```text
  2) duas_areas(12m,9m): acr= 1.5 folga= ["Altura: sobram 1.5 m até os 9 m de art. 80 do Plano Diretor para platibanda/caixa d'água (premissa acrescimo_topo_m: 1.5 m, não validada); medido do térreo, não da via; confirmar na Prefeitura."]
  ```
- **`acrescimo_topo_m` em lote sem gabarito:** nunca muda a conta (ver achado `BAIXA` acima).
- **Alerta com folga zero ou negativa:**
  - Com folga zero (`gabarito=7.5 m`, `acrescimo_topo_m=0`, altura `7.5 m`), saída obtida:
    ```text
    4a) folga_zero: ["Altura: sobram 0.0 m até os 7.5 m de art. 80 do Plano Diretor para platibanda/caixa d'água (premissa acrescimo_topo_m: 0 m, não validada); medido do térreo, não da via; confirmar na Prefeitura. DEPENDE DE CONFIRMAÇÃO NA PREFEITURA: a folga é menor que o acréscimo técnico de 1.5 m."]
    ```
  - Folga negativa não ocorre em opções geradas porque `altura_cmp = max(altura_max - acr, 0.001)` rejeita opções com altura acima de `gabarito - acr`.
- **Citação do COE (Lei nº 19.950/2020, art. 3º-IV) em `RELATORIO-24.md`:** conferida na redação oficial da Prefeitura de São Carlos: *"IV - altura da edificação: distância medida do piso do pavimento mais baixo até o forro do pavimento mais alto, descontando-se os subsolos, caixas d'água e áticos (sem permanência humana);"*. Bate com `RELATORIO-24.md` (que apenas resume sem o parêntese final `(sem permanência humana)`).

---

## 3. Testes na cópia temporária (`%TEMP%\revisao9\src`)

- `python -I -X utf8 ...\viabilidade\motor\test_motor.py` -> exit `0` (`ok`)
- `python -I -X utf8 ...\viabilidade\motor\test_estudar.py` -> exit `0` (`ok`)
- `python -I -X utf8 ...\viabilidade\motor\test_varrer.py` -> exit `0` (`ok`)
- `python -X utf8 ...\viabilidade\terreno\testar_pilotos.py` -> exit `0` (`OK: sete pilotos v4, cinco originais preservados, relevo e evidências presentes.`)
- `python -X utf8 ...\viabilidade\terreno\testar_pilotos.py --reproduzir` -> exit `0` (`OK: sete pilotos v4, cinco originais preservados, relevo e evidências presentes.`)
- `python -X utf8 ...\viabilidade\conferir.py`:
  ```text
  APROVADO      motor (155.4s)
  APROVADO      terreno (95.2s)
  APROVADO      lote-novo (179.7s)
  APROVADO      estudar (45.0s)
  APROVADO      relatorio (117.4s)
  REPROVADO     lei (0.1s)
     [conferir] zonas.json refeito igual ao versionado: False  -> lei.log
  APROVADO      visual (63.0s)
  NAO_EXECUTADO nada fora de viabilidade/ desde origin/main
     referência 'origin/main' não encontrada (git fetch?)
  soltos em viabilidade/: nenhum
  executados 7 | aprovados 6 | reprovados 1 | não executados 1 | log: viabilidade/.conferir/resumo.json
  ```
  Nota: na cópia via `git archive` no Windows, `lei/zonas.json` veio com `\r\n` (`92177` bytes) enquanto o repositório/gerador usa `\n` (`90736` bytes), explicando o falso positivo de `REPROVADO lei` (`equal after strip cr: True`); e `origin/main` não existe sem `.git`.
