# Revisão 8 — PR #124 (`e7a79f13..3287e6d7`, branch `viabilidade/lote-livre`)

## Veredicto

**APROVADO PARA MERGE NA `main` (sem achados `ALTA`, `MÉDIA` ou `BAIXA`).**

A revisão independente do diff de código (`git diff e7a79f13..3287e6d7 -- '*.py'`, 13 arquivos, +435 / -76 linhas), a execução integral das suítes de teste (`motor` e `terreno`) e as verificações independentes em dados reais (posicionamento T17 em cruzamentos inéditos, invalidação de cache T14/T17 e frentes `borda_de_quadra` T15) confirmaram que as mudanças estão corretas, coesas e seguras para integração.

---

## 1. Leitura do diff e suítes de teste

- **Diff inspecionado:** `git diff e7a79f13..3287e6d7 -- '*.py'` (13 arquivos: `viabilidade/conferir.py`, `viabilidade/motor/motor.py`, `viabilidade/motor/test_estudar.py`, `viabilidade/motor/test_motor.py`, `viabilidade/terreno/areas_especiais.py`, `viabilidade/terreno/cache.py`, `viabilidade/terreno/gerar_lotes.py`, `viabilidade/terreno/novo_lote.py`, `viabilidade/terreno/sugerir_zona.py`, `viabilidade/terreno/test_areas_especiais.py`, `viabilidade/terreno/test_cache.py`, `viabilidade/terreno/test_novo_lote.py`, `viabilidade/terreno/test_sugerir_zona.py`).
- **Pontos verificados no código:**
  - `viabilidade/conferir.py`: `stderr=subprocess.DEVNULL` no `http.server` evita deadlock de buffer de pipe no Windows sem afetar stdout/exit code.
  - `viabilidade/motor/motor.py`: trata `regra == "borda_de_quadra"` no texto da frente e agrupa registros `nao_verificada` em um alerta único de área especial não aplicada por opção, mantendo os detalhes em `incertezas`.
  - `viabilidade/terreno/areas_especiais.py`: `subarea_gabarito` só aplica `altura_max_m = 9` (`incidencia = "sobreposicao_visual"`) quando `self.anexo == "06"` e há interseção real com `self.subarea`; perto do tracejado magenta usa `restricao_gabarito_historico` sem altura numérica. `MapaEspecial` inclui `sugerir_zona.py`, `dados/zonas-controles.json` e `dados/zonas-posicionamento.json` nas fontes de cache de `subarea-06` e `cones-07`. `AreasEspeciais.ler` registra anexos sem achado com `nada_encontrado` e inclui `leis_posteriores()` (`anexo: "06/09-A"`, `tipo: "nao_verificada"`).
  - `viabilidade/terreno/cache.py`: `except OSError` limpa arquivo temporário e retorna `_Memoria(arrays)` quando não há permissão de escrita.
  - `viabilidade/terreno/gerar_lotes.py`: `frentes_borda` valida vão livre entre quadras (`VAO_M=(8,30)`, `ALEM_M=30`, `LIVRE_MAX=0.5`, `EIXO_M=(60,250)`), repara vizinhos inválidos com `sh.make_valid` e ordena/promove arestas próximas a `tree_ruas`.
  - `viabilidade/terreno/sugerir_zona.py`: projeção direta `EPSG:31983 -> pixel` via `afim_31983` calibrada com 21 cruzamentos, com checagem de ajuste e resíduos contra `zonas-controles.json`.

- **Execução das suítes (todas com código de saída 0):**

```powershell
python -I -X utf8 viabilidade/motor/test_motor.py
```
Saída:
```text
ok
```

```powershell
python -I -X utf8 viabilidade/motor/test_estudar.py
```
Saída (trecho final):
```text
alertas extras no lote novo (todos de área especial não verificada): 4
ok
```

```powershell
python -I -X utf8 viabilidade/terreno/test_areas_especiais.py
```
Saída (trecho final):
```text
OK: nos pilotos só mudam os registros novos (um por anexo vazio e o das leis posteriores).
ok
```

```powershell
python -X utf8 viabilidade/terreno/test_cache.py
python -X utf8 viabilidade/terreno/test_sugerir_zona.py
```
Saída: ambos encerraram com código `0` (sem erros).

```powershell
python -X utf8 viabilidade/terreno/test_novo_lote.py
```
Saída (trecho final):
```text
OK: 3 processos gravando o mesmo cache frio ao mesmo tempo, sem erro e sem .tmp largado.
OK: --testar completo; fontes e arquivos protegidos inalterados, saídas temporárias removidas.
```

---

## 2. Posicionamento (T17) — 3 cruzamentos inéditos nos Anexos 02, 05, 06 e 07

Foram escolhidos 3 cruzamentos inéditos (fora dos 21 pontos de `zonas-controles.json` e fora dos 8 de `VERIFICACAO` em `test_sugerir_zona.py`), com coordenada UTM obtida pelo centro entre as esquinas das quadras no cadastro (`lotes_saocarlos_completo.geojson`) e projetada via `afim_31983` (`dados/zonas-posicionamento.json`) sobre recortes de 160x160 px em pasta temporária externa:

1. **Rua São Pio X × Rua Dona Ana Prado** — `UTM = (201058.16, 7561237.85)`
   - Anexo 02 (`1px = 1.41 m`): `px = (4547.75, 6320.95)` — desvio visual `~1–2 px` (`~1.4–2.8 m`)
   - Anexo 05 (`1px = 3.10 m`): `px = (3835.15, 6974.02)` — desvio visual `~1 px` (`~3.1 m`)
   - Anexo 06 (`1px = 1.41 m`): `px = (4513.93, 6453.31)` — desvio visual `~1 px` (`~1.4 m`)
   - Anexo 07 (`1px = 5.64 m`): `px = (5343.29, 8695.41)` — desvio visual `~0.5–1 px` (`~2.8–5.6 m`)

2. **Rua Oscar Jensen × Rua Lauro Corsi** (entroncamento em T) — `UTM = (200079.27, 7563164.33)`
   - Anexo 02 (`1px = 1.41 m`): `px = (3882.16, 4937.93)` — desvio visual `~1–2 px` (`~1.4–2.8 m`)
   - Anexo 05 (`1px = 3.10 m`): `px = (3532.62, 6345.33)` — desvio visual `~0.5–1 px` (`~1.5–3.1 m`)
   - Anexo 06 (`1px = 1.41 m`): `px = (3848.57, 5070.73)` — desvio visual `~1–2 px` (`~1.4–2.8 m`)
   - Anexo 07 (`1px = 5.64 m`): `px = (5176.90, 8349.67)` — desvio visual `~0.5–1 px` (`~2.8–5.6 m`)

3. **Av. São Carlos × Rua General Osório** — `UTM = (201691.41, 7561965.52)` (média das 4 esquinas das quadras ao redor)
   - Anexo 02 (`1px = 1.41 m`): `px = (5004.72, 5812.50)` — desvio visual `~1–2 px` (`~1.4–2.8 m`)
   - Anexo 05 (`1px = 3.10 m`): `px = (4042.88, 6742.90)` — desvio visual `~0.5–1 px` (`~1.5–3.1 m`)
   - Anexo 06 (`1px = 1.41 m`): `px = (4970.78, 5945.01)` — desvio visual `~1 px` (`~1.4 m`)
   - Anexo 07 (`1px = 5.64 m`): `px = (5457.52, 8568.32)` — desvio visual `~0.5–1 px` (`~2.8–5.6 m`)

Todos os 12 recortes inspecionados visualmente ficaram bem centrados nos respectivos cruzamentos, com erro bem abaixo de `10 m`.

---

## 3. Cache (T14/T17) — invalidação de `subarea-06` e `cones-07`

Em cópia temporária isolada fora do repositório (`%TEMP%\revisao8\repo_copia\viabilidade\terreno`), foi verificada a chave `_chave` gravada em `.cache/subarea-06.npz` e `.cache/cones-07.npz` antes e depois de adicionar a chave `"_teste_revisor": "mudou"` em `dados/zonas-posicionamento.json`:

```powershell
python -X utf8 -c "... # instancia MapaEspecial('06') e MapaEspecial('07') antes e depois de alterar dados/zonas-posicionamento.json na cópia temporária"
```
Saída literal:
```text
=== ANTES ===
subarea-06 fontes[4]= 660654e4f5d5a83e n_fontes= 5
cones-07 fontes[4]= 660654e4f5d5a83e n_fontes= 5
=== DEPOIS ===
subarea-06 fontes[4]= 9cc9970f7e6be60d n_fontes= 5
cones-07 fontes[4]= 9cc9970f7e6be60d n_fontes= 5
```
O hash da 5ª fonte (`dados/zonas-posicionamento.json`) mudou em ambos os caches (`660654e4f5d5a83e` -> `9cc9970f7e6be60d`), invalidando e reconstruindo `subarea-06.npz` e `cones-07.npz` automaticamente.

---

## 4. Frente (T15 — `borda_de_quadra`) — 3 lotes inéditos

Foram selecionados 3 lotes inéditos classificados pela regra `borda_de_quadra` (fora de `AUDITORIA-7` e `test_novo_lote.py`): índices `57`, `228` e `456` da base `completo`.

Comandos executados (gravando apenas em `%TEMP%\revisao8\`):
```powershell
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 57 --zona auto --saida $env:TEMP\revisao8\borda_57.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 228 --zona auto --saida $env:TEMP\revisao8\borda_228.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 456 --zona auto --saida $env:TEMP\revisao8\borda_456.json
```
Todos encerraram com código `0`, sugerindo `SC-Z3` (`zona_origem: "sugerida_pelo_mapa"`), com os seguintes resultados:
- **`SC-completo-57`** (`area_m2: 242.532`, `frente` em `[[202242.671442, 7569537.480718], [202242.20662, 7569548.04644]]`): inspeção visual no recorte do Anexo 02 confirma que a aresta escolhida volta-se para a **Rua Joaquim de Meira**.
- **`SC-completo-228`** (`area_m2: 200.007`, `frente` em `[[201863.599659, 7569433.90089], [201862.999694, 7569443.556291]]`): inspeção visual no recorte do Anexo 02 confirma que a aresta escolhida volta-se para o prolongamento norte da **Rua Rheda Widenbruck**.
- **`SC-completo-456`** (`area_m2: 250.334`, `frente` em `[[201859.370235, 7569090.536677], [201859.800391, 7569080.728039]]`): inspeção visual no recorte do Anexo 02 confirma que a aresta escolhida volta-se para a **Rua Rheda Widenbruck**.
