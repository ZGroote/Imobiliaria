# Auditoria 7 — Conferência das entregas de 15/11 (Completa: perguntas 1 a 6)

**Status:** **Concluída (Partes 1 e 2 — perguntas 1 a 6).**

**Galho analisado:** `viabilidade/lote-livre` (Parte 1 no HEAD `d9d48598`, commits `fc1b070e` e `59a1b20c`; Parte 2 no HEAD `d6ba9791`, incluindo `18be7045`, `bef01602` e `8d526cb4`).

## Resumo dos achados e veredito

**Veredito para merge no `main`:** **Não há achados de severidade ALTA** nas 6 perguntas conferidas. Há **1 achado MÉDIA** (da Parte 1, lote `75931` recebendo frente falsa no miolo da quadra) e **2 achados BAIXA** (`TopologyException` em 1 de 440 lotes em `gerar_lotes.py:187`; e, na Pergunta 3, a comparação `z0_m + altura_m <= 9 m` usar `z=0` e altura só de pavimentos, mitigada por avisos explícitos no relatório). Cabe ao coordenador decidir se o achado **MÉDIA** da Parte 1 bloqueia o merge ou segue como pendência conhecida.

- **Pergunta 1 (ponto `-21.985132, -47.885094` perto da SP-318 km 236):** **Fechada, sem achado em `areas_especiais.py`.** Na CLI (`novo_lote.py`), o ponto cai no lote `43701` (`515,197 m²`) e é **recusado** antes de gerar `lote.json` porque o asfalto mais próximo da malha está a `161,2 m` (`exit 1`). Chamando `AreasEspeciais().ler()` diretamente na geometria/ponto, retornam `4` entradas, incluindo **`anexo: "06/09-A"` (`nao_verificada`)** com alerta expresso sobre a `Lei 19.166/2019` (`AEI 44 e 45`, `áreas N e O do Anexo 9-A`, `ZUPI-II` na `SP-318 km 236`).
- **Pergunta 2 (aviso do Anexo 9-A e links das leis posteriores):** **Fechada, sem achado.** `leis_posteriores()` é sempre anexado ao fim de `AreasEspeciais.ler()` (`areas_especiais.py:239`), informa explicitamente que o Anexo 9-A não é lido, e os 3 links oficiais respondem **HTTP 200**.
- **Pergunta 3 (subárea de 9 m — art. 80 nos lotes `74451`, `77015`, `77022`, `77375`, `80172`):** **1 achado BAIXA (já mitigado por alertas).** `74451` e `80172` ficam fora do tracejado no `anexo06.jpg` (`4 pav / 13,5 m`), enquanto `77015`, `77022` e `77375` ficam dentro e são limitados a `2 pav / 7,5 m`. O motor mede apenas pavimentos a partir de `z=0` (não do nível da via pública nem inclui platibanda/caixa d'água), mas `areas_especiais.py:55-57` e `motor.py:827` já alertam o usuário.
- **Pergunta 4 (`borda_de_quadra`):** **1 achado MÉDIA** e **1 achado BAIXA**. Nos lotes `92058`, `46087`, `62350`, `73863`, `77017` e `76476`, as frentes escolhidas dão para vias reais do Anexo 02 (ainda que `77017` e `76476` tenham vão de ~29–30 m por falta de lote na quadra oposta). Porém, no lote **`75931`** (em L, no Centro), `frentes_borda` aceita como frente principal uma aresta interna (`24,029 m`, vão `17,05 m`) que dá para **um vazio de lote faltando no miolo da quadra**, e não para rua no mapa oficial — preterindo a frente sul (`12,014 m`), que é a rua real. Na varredura de 400 m, houve ainda 1 `TopologyException` em `gerar_lotes.py:187`.
- **Pergunta 5 (alertas agrupados no estudo):** **Fechada, sem achado.** Nos estudos reais de `92058` (`SC-Z1`) e `30516` (`SC-Z4`) em pasta temporária, cada opção traz exatamente **1 alerta agrupado** de `nao_verificada` e **1 alerta próprio por área encontrada sem altura**; nenhum alerta sumiu sem substituição.
- **Pergunta 6 (conferência independente dos 21 cruzamentos no `anexo02.jpg`):** **Fechada, sem achado.** Dois cruzamentos nomeados fora dos 21 de `zonas-controles.json` (a `1028,0 m` e `724,5 m` do controle mais próximo) caem sobre os respectivos cruzamentos no `anexo02.jpg` (`3,85 px` / `5,42 m` medidos no Centro; centralizado na pista dupla da Vila Prado).

---

## Pergunta 1 — Leis novas em lote perto da SP-318 km 236 (`-21.985132, -47.885094`)

> *Rode `novo_lote.py` para o ponto `-21.985132, -47.885094` (ou um lote perto da SP-318 km 236) e verifique se sai o alerta das leis novas em `areas_especiais`.*

**Fechada, sem achado em `areas_especiais.py`.**

1. **Comportamento da CLI (`novo_lote.py`) nesse ponto:**
   ```powershell
   python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-21.985132, -47.885094" --zona auto --saida ".../lote_p1.json"
   ```
   O comando **encerra com código 1** antes de gravar `lote.json`, porque o lote encontrado (`43701`, área `515,197 m²`) não tem asfalto na malha a menos de `30 m`:
   ```text
   Erro: Lote sem frente para rua: nenhum lado de pelo menos 8 m a até 6 m do asfalto (nem juntando arestas colineares, nem até 12 m sem lote no meio, nem pela borda da quadra com vão de 8 a 30 m até a quadra da frente ligado ao asfalto); o asfalto mais próximo da malha está a 161.2 m. A malha de ruas tem buracos: se o lote dá pra rua, informe outro lote ou confira a base
   ```
   O lote vizinho (`43702`, `510,700 m²`, obtido via `--listar-vizinhos`) também falha pelo mesmo motivo (`asfalto mais próximo da malha está a 159.1 m`).

2. **Leitura direta de `AreasEspeciais().ler()` no ponto `-21.985132, -47.885094` (e sobre o lote `43701`):**
   ```powershell
   python -I -X utf8 ".../scratch/audit7_p2_extra.py"
   ```
   Saída observada:
   ```text
   === Q1: AreasEspeciais em -21.985132, -47.885094 ===
     {'tipo': 'nao_verificada', 'observacoes': 'Leitura automática sem cor da legenda nem cone no lote e na margem de ~10 m; confirmar no cadastro e no órgão competente; sem altura numérica aplicada.', 'anexo': '05'}
     {'tipo': 'nao_verificada', 'observacoes': 'Leitura automática sem cor da legenda nem cone no lote e na margem de ~10 m; confirmar no cadastro e no órgão competente; sem altura numérica aplicada.', 'anexo': '06'}
     {'tipo': 'gabarito_aeronautico', 'observacoes': 'Possível incidência, confirmar: interior ou proximidade do contorno dos cones e da pista; consultar DECEA; confirmar no cadastro e no órgão competente; sem altura numérica aplicada.', 'anexo': '07'}
     {'tipo': 'nao_verificada', 'observacoes': 'Os mapas lidos (Anexos 05, 06 e 07 da Lei 18.053/2016) são de dez/2016 e não trazem estas alterações, que não estão desenhadas aqui: Lei 19.166/2019, AEI de Interesse Industrial e de Serviços 44 e 45 (Anexo 6), áreas N e O do Anexo 9-A e ZUPI-II, na SP-318 km 236, com perímetro só em texto (rumos e distâncias, sem coordenadas); Lei 18.927/2018, Zona 6E (Santa Eudóxia), sem mapa. O Anexo 9-A (áreas compatíveis com usos incômodos) não é lido por nenhum módulo: não verificado. Confirmar na Prefeitura, sobretudo perto da SP-318 km 236; sem altura numérica aplicada.', 'anexo': '06/09-A'}
   ```
   Portanto, `areas_especiais` emite o alerta completo de leis posteriores (`06/09-A`, `nao_verificada`) na região da SP-318 km 236.

---

## Pergunta 2 — Aviso do Anexo 9-A, links oficiais e coerência dos textos

> *Confira que o aviso inclui o Anexo 9-A (que nenhum módulo lê), que os links das leis abrem e são os oficiais, e que nenhum texto promete o que o código não faz.*

**Fechada, sem achado.**

1. **Inclusão universal em `AreasEspeciais.ler()`:** em `viabilidade/terreno/areas_especiais.py:239`, `resultado.append(leis_posteriores())` é executado incondicionalmente ao final de toda chamada (mesmo se algum mapa falhar). Exemplo real em `lote_74451.json` gerado por `novo_lote.py`:
   ```json
   {
     "tipo": "nao_verificada",
     "nome": "Leis posteriores aos mapas de dez/2016 (19.166/2019 e 18.927/2018): não desenhadas",
     "incidencia": "nao_verificada",
     "conferido": false,
     "fonte": "Lei 19.166/2019 (https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_339); Lei 18.927/2018 (https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_754; PDF https://www.saocarlos.sp.gov.br/images/stories/pdf/conselhos/lei18927-digital.pdf)",
     "observacoes": "Os mapas lidos (Anexos 05, 06 e 07 da Lei 18.053/2016) são de dez/2016 e não trazem estas alterações, que não estão desenhadas aqui: Lei 19.166/2019, AEI de Interesse Industrial e de Serviços 44 e 45 (Anexo 6), áreas N e O do Anexo 9-A e ZUPI-II, na SP-318 km 236, com perímetro só em texto (rumos e distâncias, sem coordenadas); Lei 18.927/2018, Zona 6E (Santa Eudóxia), sem mapa. O Anexo 9-A (áreas compatíveis com usos incômodos) não é lido por nenhum módulo: não verificado. Confirmar na Prefeitura, sobretudo perto da SP-318 km 236; sem altura numérica aplicada.",
     "evidencia": "AUDITORIA-6b: a legenda do anexo06.jpg lista AEI só até o item 43; o Anexo 9-A de 2016 vai de A a M; os textos das leis não trazem coordenadas",
     "anexo": "06/09-A"
   }
   ```
2. **Conferência dos 3 links oficiais (`saocarlos.sp.gov.br`):**
   ```powershell
   curl.exe -4 -sSL -o NUL -w "19166: %{http_code} %{url_effective}\n" "https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_339"; curl.exe -4 -sSL -o NUL -w "18927: %{http_code} %{url_effective}\n" "https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_754"; curl.exe -4 -sSL -I "https://www.saocarlos.sp.gov.br/images/stories/pdf/conselhos/lei18927-digital.pdf" | Select-Object -First 8
   ```
   Saída observada:
   ```text
   19166: 200 https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_339
   18927: 200 https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_754
   HTTP/1.1 200 OK
   Content-Type: application/pdf
   Content-Length: 1699980
   ```
3. **Coerência dos textos:** o texto afirma explicitamente que o Anexo 9-A *"não é lido por nenhum módulo: não verificado"* e não promete leitura nem altura numérica aplicada.

---

## Pergunta 3 — Subárea de 9 m (art. 80) nos lotes `74451`, `77015`, `77022`, `77375`, `80172`

> *Rode estudos nos lotes 74451, 77015, 77022, 77375 e 80172 (SC-Z1, em pasta temporária fora do repositório). Confira visualmente no Anexo 6 se cada um está dentro ou fora do tracejado da subárea de 9 m, e se o texto do relatório condiz com o art. 80 da lei (limitação acima do nível da via pública).*

**1 achado BAIXA (mitigado pelos alertas explícitos do código).**

1. **Conferência nos estudos (`estudar.py` em `scratch/estudo_q3/`, `--zona SC-Z1`) e visual no `anexo06.jpg` (`scratch/p3_subarea_anexo06.png`):**
   ```text
   idx=74451: subarea=[] opcoes=[(None, None, 4, 4)]             -> fora do tracejado; 4 pavimentos (13,5 m)
   idx=77015: subarea=[('sobreposicao_visual', 9)] opcoes=[(None, None, 2, 4)] -> dentro da subárea 33; 2 pavimentos (7,5 m)
   idx=77022: subarea=[('sobreposicao_visual', 9)] opcoes=[(None, None, 2, 4)] -> dentro da subárea 33; 2 pavimentos (7,5 m)
   idx=77375: subarea=[('sobreposicao_visual', 9)] opcoes=[(None, None, 2, 3)] -> dentro da subárea 33; 2 pavimentos (7,5 m)
   idx=80172: subarea=[] opcoes=[(None, None, 4, 3)]             -> fora do tracejado; 4 pavimentos (13,5 m)
   ```
   A sobreposição direta dos 5 polígonos sobre `anexo06.jpg` (`p3_subarea_anexo06.png`) confirma visualmente: `77015`, `77022` e `77375` estão totalmente **dentro** do tracejado magenta da Subárea 33, enquanto `74451` (a leste) e `80172` (ao sul) estão claramente **fora**.

2. **Confronto com o art. 80 da Lei 18.053/2016:**
   - Texto legal (Lei Municipal 18.053/2016, art. 80): *"Art. 80. A Subárea Especial de Restrição de Gabarito é a subárea interna à Poligonal de Interesse Histórico na qual há limitação do gabarito a 9m (nove metros) acima do nível da via pública nas novas construções ou ampliações."*
   - Texto em `viabilidade/terreno/areas_especiais.py:55-57`:
     `"Art. 80: \"limitação do gabarito a 9m (nove metros) acima do nível da via pública nas novas construções ou ampliações\". Aplicado como altura máxima de 9 m no lote todo, medida como a do motor; em lote acima do nível da rua, ou só em parte dentro do tracejado (margem de ~%g m do mapa), confirmar na Prefeitura."`

3. **[BAIXA] Medição de altura no motor usa `z=0` e apenas pavimentos (`motor.py:402-405, 536`):**
   - `_cabe()` (`motor.py:536`) verifica `max(v["z0_m"] + v["altura_m"] for v in vols) <= ctx["altura_max"]` (`9 m`), onde `altura_m` soma apenas `pe_direito_terreo_m + (pav - 1) * pe_direito_m` (`motor.py:402-405`), sem platibanda, telhado, caixa d'água ou cota real da via pública (`z=0`). Como `areas_especiais.py:55-57` e o alerta de relevo (`motor.py:827`) já informam explicitamente essa limitação, o risco prático fica documentado ao usuário.

---

## Pergunta 4 — Frente pela borda da quadra (T12)

> *Escolha 3 lotes com `regra: borda_de_quadra` (por exemplo, o 92058) e diga, olhando o mapa ou a foto aérea pública, se a frente presumida é plausível. Algum caso aceita frente que claramente não dá para rua?*

### Amostra executada e conferida no mapa oficial (`anexo02.jpg`)

Comando executado (`scratch/audit7_q4.py`) sobre `Cadastro("completo")`:
```powershell
python -I -X utf8 "C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/audit7_q4.py"
```
Saída (resumo dos casos inspecionados + varredura num raio de 400 m do centro):
```text
idx=92058 area=300.4 comp=12.193 vao=12.47 asfalto=11.046 n_frentes=1
idx=46087 area=369.5 comp=11.87 vao=11.625 asfalto=8.529 n_frentes=1
idx=77017 area=509.3 comp=12.12 vao=29.755 asfalto=23.703 n_frentes=1
idx=76476 area=146.9 comp=12.206 vao=29.018 asfalto=5.23 n_frentes=2
idx=62350 area=316.1 comp=11.931 vao=11.625 asfalto=28.987 n_frentes=1
idx=73863 area=518.4 comp=12.021 vao=14.737 asfalto=29.141 n_frentes=1

Raio 400m: borda_de_quadra=440, geos_err=1; top 5 maiores vaos:
  (77017, 29.755, 12.12, 23.703, 1)
  (77018, 29.496, 12.12, 13.446, 1)
  (76476, 29.018, 12.206, 5.23, 2)
  (72904, 27.832, 11.815, 12.655, 1)
  (75926, 26.657, 12.014, 24.069, 1)
```

Conferência visual das sobreposições do polígono e da aresta `frente` no `anexo02.jpg`:
1. **`92058` (Mirante da Bela Vista; `comp=12.193 m`, `vao=12.47 m`):** **plausível.** A frente escolhida dá para o corredor viário cinza entre as duas fileiras de lotes, alinhado com a rua desenhada no Anexo 02.
2. **`46087` (`comp=11.87 m`, `vao=11.625 m`):** **plausível.** A frente escolhida dá diretamente para a rua interna do loteamento desenhada no Anexo 02.
3. **`62350` (Parque Maria Stella; `comp=11.931 m`, `vao=11.625 m`):** **plausível.** A frente escolhida dá diretamente para a **Rua Domingos Juliano** no Anexo 02.
4. **`73863` (Centro; `comp=12.021 m`, `vao=14.737 m`):** **plausível.** A frente escolhida dá para a rua transversal desenhada entre a Rua José Bonifácio e a Rua Nove de Julho.
5. **`77017` e `76476` (`vao=29.755 m` e `29.018 m`):** **plausíveis quanto à direção da via**, embora o vão chegue perto do teto de 30 m porque falta um lote na quadra oposta do cadastro; no `anexo02.jpg`, as frentes escolhidas dão de fato para as vias desenhadas (Rua São Carlos / transversal do Centro).

### Achados da Pergunta 4

#### [MÉDIA] Falso positivo no miolo da quadra: lote `75931` recebe como frente principal um lado que não dá para rua
- **Evidência:** comando sobre `75931` em `Cadastro("completo")`:
  ```powershell
  python -I -X utf8 -c "import sys; sys.path.insert(0,'viabilidade/terreno'); import gerar_lotes as gl, novo_lote as nl; cad=nl.Cadastro('completo'); print(gl.avaliar(cad.geos[75931], 75931, cad.geos, cad.tree, cad.malha, cad.tree_ruas, ampliar=True)['frentes'])"
  ```
  Saída:
  ```text
  [{'aresta': 3, 'arestas': [3, 4], 'pontos': [[201267.58774151636, 7562388.017835932], [201266.4771256362, 7562412.020911745]], 'comprimento_m': 24.029, 'largura_vao_m': 17.05, 'regra': 'borda_de_quadra', 'distancia_max_asfalto_m': 10.46}, {'aresta': 9, 'arestas': [9, 0], 'pontos': [[201287.75572128192, 7562372.104596508], [201275.7491619583, 7562371.6712256465]], 'comprimento_m': 12.014, 'largura_vao_m': 14.725, 'regra': 'borda_de_quadra', 'distancia_max_asfalto_m': 10.46}]
  ```
- **O que a sobreposição no `anexo02.jpg` mostra:** o lote `75931` tem formato em **L** no meio de um quarteirão entre a `Rua Aquidaban` e a `Rua Nove de Julho`. A aresta sul (`[9, 0]`, `12,014 m`, `vao=14,725 m`) dá para a rua transversal real. Já a aresta oeste (`[3, 4]`, `24,029 m`, `vao=17,05 m`) fica **dentro do miolo da quadra**, voltada para um vazio de lotes não cadastrados entre o `75931` e os lotes voltados à `Rua Aquidaban`. Como `frentes_borda` ordena por `-comprimento_m` (`gerar_lotes.py:202`), **essa borda interna falsa foi escolhida como `frentes[0]` (frente principal)**.

#### [BAIXA] `TopologyException` em `frentes_borda` ao unir vizinhos inválidos (`gerar_lotes.py:187`)
- **Evidência:** na varredura dos lotes num raio de 400 m (`audit7_q4.py`), `geos_err=1` por erro de topologia em `sh.union_all([geos[j] ...])` na linha `187` de `viabilidade/terreno/gerar_lotes.py`:
  ```text
  shapely.errors.GEOSException: TopologyException: side location conflict at 201708.64041643747 7562133.9459773526. This can occur if the input geometry is invalid.
  ```
  (Na consulta individual só falha quando há lote vizinho inválido na faixa `ALEM_M=30 m`.)

---

## Pergunta 5 — Alertas no estudo (T21)

> *Num estudo real, cada opção tem exatamente um alerta agrupado de área não verificada e um alerta próprio por área encontrada sem altura? Algum alerta sumiu sem ser substituído?*

**Sim, o comportamento está conforme o esperado e nenhum alerta sumiu sem substituição.**

### Evidência em estudos reais (pasta temporária fora do repositório)

Comando executado (`scratch/audit7_q5.py`, chamando `viabilidade/motor/estudar.py` para `92058` em `SC-Z1` e `30516` em `SC-Z4` em `scratch/estudo_q5/`):
```powershell
python -I -X utf8 "C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/audit7_q5.py"
```

Saída observada:
1. **Lote `92058` (`SC-Z1`)** — possui `6` registros em `areas_especiais`: `4` `nao_verificada` (`Anexo 05`, `Anexo 06`, `Anexo 07`, `Anexo 06/09-A`) + `2` encontradas sem altura (`interesse_ambiental (AIA)` e `interesse_historico (Área de Interesse Histórico)`).
   - `opcoes=1` (`C - Lâmina baixa`):
     ```text
     opcao C (Lâmina baixa): total_alertas=4 | esp_nv=1 (esperado 1) | esp_proprios=2 (esperado 2)
     Alertas opcao A:
       * Recuo lateral/fundos: residencial 2.00/2.00 m (recuo do topo no prédio todo).
       * ÁREA ESPECIAL não verificada (nao_verificada), sem altura numérica, NÃO aplicada: Anexo 05, Anexo 06, Anexo 07, Anexo 06/09-A. O resultado pode passar do que o terreno permite; conferir antes de usar.
       * ÁREA ESPECIAL sem altura numérica, NÃO aplicada: interesse_ambiental (AIA). O resultado pode passar do que o terreno permite; conferir antes de usar.
       * ÁREA ESPECIAL sem altura numérica, NÃO aplicada: interesse_historico (Área de Interesse Histórico). O resultado pode passar do que o terreno permite; conferir antes de usar.
     ```
   - A incerteza da frente também usou o ramo novo de `motor.py:769-770`:
     `Frente presumida pela borda da quadra (sem asfalto no mapa; vão de 12.47 m entre quadras): conferir no local.`

2. **Lote `30516` (`SC-Z4`)** — possui `5` registros em `areas_especiais`: `4` `nao_verificada` (`Anexo 05`, `Anexo 06`, `Anexo 07`, `Anexo 06/09-A`) + `1` encontrada sem altura (`interesse_ambiental (AIA)`).
   - Em **todas as 4 opções calculadas (`A, B, C, D`)**:
     ```text
     opcao A (Torre única): total_alertas=3 | esp_nv=1 (esperado 1) | esp_proprios=1 (esperado 1)
     opcao B (Duas torres): total_alertas=4 | esp_nv=1 (esperado 1) | esp_proprios=1 (esperado 1)
     opcao C (Lâmina baixa): total_alertas=3 | esp_nv=1 (esperado 1) | esp_proprios=1 (esperado 1)
     opcao D (Embasamento + torre): total_alertas=3 | esp_nv=1 (esperado 1) | esp_proprios=1 (esperado 1)
     ```
   - O alerta agrupado lista exatamente os 4 anexos (`Anexo 05, Anexo 06, Anexo 07, Anexo 06/09-A`) via `dict.fromkeys(nao_verif)` (`motor.py:788-801`), mantendo todas as `incertezas` individuais (1 por registro em `estudo["incertezas"]`) e a lista no `resumo.txt` (`estudar.py:82-84`). Nenhum alerta foi suprimido sem substituição.

---

## Pergunta 6 — Conferência independente dos 21 cruzamentos (`anexo02.jpg`)

> *Conferência independente dos **21 cruzamentos** usados para alinhar os 4 anexos (`viabilidade/terreno/RELATORIO-17.md` e `RELATORIO-18.md`): escolha **dois cruzamentos de ruas nomeadas da cidade que NÃO estejam nos 21** de `zonas-controles.json`, calcule onde o novo código os projeta no `anexo02.jpg` e confira visualmente se batem com os cruzamentos no mapa (em pixels e em metros).*

**Fechada, sem achado.**

1. **Parâmetros da afim no Anexo 02 (`MapaGeorreferenciado("02")` em `sugerir_zona.py:105-121`):**
   ```text
   Total controles: 21
   escala_min=0.706988 px/m, escala_max=0.711234 px/m, residuo_max=6.242 m
   ```
2. **Projeção de 2 cruzamentos independentes fora dos 21 controles (`scratch/audit7_q6.py`):**
   ```powershell
   python -I -X utf8 "C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/audit7_q6.py"
   ```
   Saída observada:
   ```text
   Cruzamento 1: Centro (Rua José Bonifácio x Av. Comendador Alfredo Maffei / Conde do Pinhal)
     latlon=-22.017834, -47.893650 | UTM=(201260.48, 7562369.32) | dist_a_lotes=15.21 m | dist_min_aos_21=1028.0 m
     Pixel projetado=(4706.24, 5519.07) | Eixo cinza no recorte=(4704.50, 5522.50)
     Erro visual estimado: dx=+1.74 px, dy=-3.43 px -> 3.85 px (5.42 m)

   Cruzamento 2: Sul/Vila Prado (perto de -22.028, -47.897)
     latlon=-22.027743, -47.897330 | UTM=(200901.14, 7561264.26) | dist_a_lotes=18.15 m | dist_min_aos_21=724.5 m
     Pixel projetado=(4437.11, 6300.07)
   ```
3. **Conferência visual nos recortes do `anexo02.jpg` (`scratch/q6_cruz_1.png` e `scratch/q6_cruz_2.png`):**
   - **Cruzamento 1 (Centro, `Rua José Bonifácio` entre `Rua Aquidaban` e `Rua Nove de Julho`, a `1028,0 m` do controle mais próximo):** o marcador cai sobre o cruzamento cinza no `anexo02.jpg`, com desvio medido de **`3,85 px` (`5,42 m`)** até o encontro dos eixos cinzas (`dx=+1,74 px`, `dy=-3,43 px`), dentro do resíduo máximo declarado de `6,242 m`.
   - **Cruzamento 2 (Vila Prado, `Rua Antonio Botelho` x pista dupla transversal acima da `Rua São Pio X`, a `724,5 m` do controle mais próximo):** o marcador cai exatamente sobre o encontro da `Rua Antonio Botelho` com o eixo central da pista dupla cinza.
