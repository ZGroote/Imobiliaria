# Auditoria 6 — Leitura Automática dos Mapas e Seleção por Coordenada

**Veredito: REPROVADA PARA USO SEM CONFERÊNCIA HUMANA (NÃO CONFIÁVEL COMO FILTRO ÚNICO DE ZONA E ÁREAS ESPECIAIS).**

Foram identificados **4 achados de gravidade ALTA**, **6 achados de gravidade MÉDIA** e **1 achado de gravidade BAIXA** nos módulos [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py), [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py) e [novo_lote.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/novo_lote.py):

- A suíte interna `python -I -B -X utf8 viabilidade/terreno/novo_lote.py --testar` passou (código de saída `0`, linha final `OK: --testar completo; fontes e arquivos protegidos inalterados, saídas temporárias removidas.`), porém os ensaios não cobrem falhas críticas reais em campo:
  1. **Aceitação silenciosa de lote em Eixo Estruturante (ALTA):** `sugerir_zona.py:159-186` detecta traço do art. 11 a `<= 60 m` e preenche `motivo_duvida`, mas **não** adiciona motivo impeditivo a `motivos`; lotes que dão de frente para a Av. Henrique Gregori são aprovados automaticamente como `SC-Z3` (`idx=25369` reproduzido na CLI).
  2. **Camada histórica invisível por transparência (ALTA):** no Anexo 06, `Área de Interesse Histórico` é desenhada com transparência sobre a Zona 1 (`[180, 108, 182]`), ficando a distância euclidiana **`69,54 >> 18`** da amostra opaca da legenda (`[188, 134, 246]`); apenas `656` pixels de todo o quadro útil do mapa casam com a legenda.
  3. **Vão descoberto sobre a pista do aeroporto no Anexo 07 (ALTA):** `ler_cones()` fecha dois cascos convexos descontínuos e deixa um vão de ~`2,64 km` (`y=5380..5850`) exatamente sobre a pista e sobre a `AEI do Transporte Aéreo` (itens `09`, `10`, `11`), retornando lista **vazia** `[]` (sem `gabarito_aeronautico` nem `nao_verificada`).
  4. **Áreas especiais omitidas das legendas (ALTA):** `Subárea Especial de Restrição de Gabarito` (`9 m`, art. 80, Anexo 06), `Área Especial de Influência do Transporte Aéreo` (Anexo 07) e `Chácaras de Recreio` (Anexo 05) ficaram fora de `LEGENDAS`/`FUNDOS`.

---

## Resumo dos Achados por Gravidade

| # | Gravidade | Pergunta | Resumo do Achado | Local |
|---|---|---|---|---|
| 1 | **ALTA** | P2 / P3 | Traço de Eixo `<= 60 m` não entra em `motivos` e aprova zona de fundo errada (ex.: `idx=25369` aceito como `SC-Z3` com `SC-EIXO` oculto em `alternativas`) | [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L156-L186) |
| 2 | **ALTA** | P4 | Transparência da `Área de Interesse Histórico` sobre a Zona 1 gera RGB `[180,108,182]` (dist. `69,54` da legenda `[188,134,246]`): apenas `656` px reconhecidos no mapa inteiro | [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L14-L85) |
| 3 | **ALTA** | P4 | `ler_cones()` deixa vão central (~`470 px` ≈ `2,64 km`) sobre a pista do aeroporto e área `09` retornando `[]` (sem alerta algum) | [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L56-L66) |
| 4 | **ALTA** | P4 | Omissão na tabela `LEGENDAS`: `Subárea de Gabarito 9 m` (Anexo 06, art. 80), `AEI Transporte Aéreo` (Anexo 07) e `Chácaras de Recreio` (Anexo 05) | [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L7-L25) |
| 5 | **MÉDIA** | P1 | `Represas - reservatórios` (`[192,198,234]`) tem distância **`9,11 <= 18`** para `SC-Z3` (`[187,201,227]`), classificando água como Zona 3 | [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L109-L117) |
| 6 | **MÉDIA** | P1 | Proximidade RGB `SC-Z5B <-> Parque` (`22,16 < 36`) e `SC-Z5A <-> Parque` (`34,07 < 36`); além de `27.897` centroides (`25,3%` da base) caírem em classe `0` ou `Branco` (Zonas `6A`–`8B` ausentes) | [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L17-L117) |
| 7 | **MÉDIA** | P2 / P3 | Anti-aliasing de bordas vermelhas `[255,0,0]` sobre texto preto dispara falso `SC-EIXO` fora dos eixos legais (ex.: `idx=100`, Rua Ernesto Bentin) | [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L111-L156) |
| 8 | **MÉDIA** | P2 / P3 | Ausência de lista nominal dos trechos do art. 11 e omissão dos "eixos viários arteriais tipo 1" das Zonas 6A/6B (arts. 41 IV e 45 IV da Lei 18.053/2016); `DIVISA_M = 10 m` menor que resíduo máximo nos Anexos 06 (`10,46 m`) e 07 (`11,37 m`) | [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L70) |
| 9 | **MÉDIA** | P4 | Uso excessivo de `nao_verificada` por `leitura == 0` na margem (`15,6`–`32,5 m`) sobre selos brancos, grade cinza e áreas omitidas, e marcação fixa de `gabarito_aeronautico` sempre como `possivel_incidencia` (nunca `sobreposicao_visual`) | [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L104-L110) |
| 10 | **MÉDIA** | P5 | `1.352` polígonos da base `completo` têm buracos (`interiors`): `--listar-vizinhos` aceita o ponto no anel, mas `--zona` falha em `unir()`; condomínios acima de `1 km²` / `2M px` são recusados integralmente pelos leitores raster | [novo_lote.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/novo_lote.py#L56-L80) |
| 11 | **BAIXA** | P5 | Ponto sobre divisa exata entre lotes oscila silenciosamente entre os vizinhos (`900` vs `901`) conforme casas decimais (conversão WGS84 ↔ UTM) | [novo_lote.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/novo_lote.py#L115-L131) |

---

## Pergunta 1 — Legenda → zona (Anexo 02)

### Integridade das imagens e correspondência com os PDFs oficiais
Todos os arquivos do manifesto [mapas-externos.json](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/dados/mapas-externos.json) batem com o SHA256 declarado, e os 4 JPEGs locais em `viabilidade/terreno/dados/zonas-mapas/` (`anexo02.jpg`, `anexo05.jpg`, `anexo06.jpg`, `anexo07.jpg`) são **idênticos byte a byte** aos fluxos JPEG embutidos (a partir do byte `111752`) nos PDFs oficiais em `viabilidade/lei/mapa/lei18053_anexos_2017_pdf/` (fonte oficial: [PDFs do PDE São Carlos](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/)).

As coordenadas de amostragem em [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L108-L111) (`x=4280..4330`, `y` espaçado de `79 px` de `10855` a `11408` para as 6 zonas + Campus + Parque Ecológico, e `(3265..3345, 11165..11170)` para `Eixo Estruturante`) acertam o miolo dos retângulos correspondentes da legenda do Anexo 02.

**Comando rodado e saída copiada:**
```powershell
python -I -u -X utf8 C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/audit6_repro_nums.py
```
```text
=== 1. SHA256 E IDENTIDADE BYTE-A-BYTE PDF <-> JPEG ===
  anexo02.jpg <-> ANEXO 02 - Zoneamento Urbano.pdf: sha_ok=True, bytes=14897265, embutido_no_pdf_offset=111752
  lei18053-anexo02.pdf: sha_ok=True, bytes=15013109
  anexo05.jpg <-> ANEXO 05 - AEIs Ambientais.pdf: sha_ok=True, bytes=12983308, embutido_no_pdf_offset=111752
  lei18053-anexo05.pdf: sha_ok=True, bytes=13099152
  anexo06.jpg <-> ANEXO 06 - AEIs Urbanas.pdf: sha_ok=True, bytes=14562656, embutido_no_pdf_offset=111752
  lei18053-anexo06.pdf: sha_ok=True, bytes=14678499
  anexo07.jpg <-> ANEXO 07 - AEIs Rurais.pdf: sha_ok=True, bytes=12605006, embutido_no_pdf_offset=111752
  lei18053-anexo07.pdf: sha_ok=True, bytes=12720850

=== 2. PALETA ANEXO 02 E DISTANCIAS RGB ===
  SC-Z1   : [240, 202, 127]
  SC-Z2   : [255, 241, 152]
  SC-Z3   : [187, 201, 227]
  SC-Z4   : [247, 190, 183]
  SC-Z5A  : [189, 213, 179]
  SC-Z5B  : [167, 180, 160]
  Campus  : [220, 220, 220]
  Parque  : [178, 197, 151]
  Branco  : [255, 255, 255]
  cor_eixo: [147, 22, 0]
  6 menores distancias: [(22.16, 'SC-Z5B', 'Parque'), (34.07, 'SC-Z5A', 'Parque'), (38.72, 'SC-Z3', 'Campus'), (43.98, 'SC-Z5A', 'SC-Z5B'), (48.69, 'SC-Z1', 'SC-Z2'), (49.52, 'SC-Z3', 'SC-Z5A')]
```

### Achados da Pergunta 1

1. **[MÉDIA] `Represas - reservatórios` no Anexo 02 é classificada como `SC-Z3` (`dist = 9,11 <= 18`).**
   Na legenda do Anexo 02 (`(3275, 10915, 3335, 10945)`), a cor de `Represas - reservatórios - escala 1:2.000` tem mediana RGB `[192, 198, 234]`. A distância euclidiana para `SC-Z3` (`[187, 201, 227]`) é **`9,11`**, abaixo da tolerância `18` em [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L113-L117).

   **Comando rodado e saída copiada:**
   ```powershell
   python -I -u -X utf8 C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/audit6_condo.py
   ```
   ```text
   === ANEXO 02 Represas-reservatorios legenda RGB=[192. 198. 234.] -> classificar()=[3] (3=SC-Z3) ===
   ```

2. **[MÉDIA] Pares `SC-Z5B / Parque` e `SC-Z5A / Parque` têm sobreposição de esfera de tolerância (`dist < 36`), e `25,3%` dos centroides da base `completo` caem fora das 6 zonas lidas.**
   - Com tolerância `<= 18`, duas cores ficam em conflito na zona intermediária (compressão JPEG / anti-aliasing) quando sua distância é `<= 36`: **`SC-Z5B <-> Parque` (`22,16`)** e **`SC-Z5A <-> Parque` (`34,07`)**. Na inspeção de um recorte `400x400` sobre a região do Parque Ecológico (`px=(5820,2831)`), foram medidos `11.568` px de `Parque` (`8`), `152` px classificados como `SC-Z5B` (`6`) e `1` px como `SC-Z5A` (`5`).
   - Além disso, [viabilidade/lei/zonas.json](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/lei/zonas.json) define `15` zonas (incluindo `SC-Z6A`, `SC-Z6B`, `SC-Z6C`, `SC-Z6D`, `SC-Z6E`, `SC-Z7`, `SC-Z8A`, `SC-Z8B`), mas `sugerir_zona.py` lê somente `SC-Z1..SC-Z5B` no Anexo 02. Na checagem de todos os `110.089` centroides da base `completo`, `25.460` caíram em classe `0` (desconhecida) e `2.437` em `Branco` (`25,3%` do total).

   **Comando rodado e saída copiada:**
   ```powershell
   python -I -u -X utf8 C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/audit6_casos_concretos.py
   ```
   ```text
   === CENTROIDES DOS 110.089 LOTES NO ANEXO 02 ===
     classe 0 (Z0_desc): 25460
     classe 1 (SC-Z1): 4976
     classe 2 (SC-Z2): 26258
     classe 3 (SC-Z3): 22207
     classe 4 (SC-Z4): 13953
     classe 5 (SC-Z5A): 7092
     classe 6 (SC-Z5B): 855
     classe 7 (Campus): 6358
     classe 8 (Parque): 493
     classe 9 (Branco): 2437
   ```

---

## Pergunta 2 — Regras de recusa (`divisa < 10 m`, `Eixo <= 60 m`, `RGB <= 18`)

### Análise frente à resolução e ao erro de georreferenciamento
Os parâmetros medidos em [zonas-posicionamento.json](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/dados/zonas-posicionamento.json) são:

```text
Anexo 02: px/m=0.7124 (1px=1.40m), rmse_controles_m=3.5257, residuos_controles_m=[4.656, 5.691, 0.860, 1.718, 2.098]
Anexo 05: px/m=0.3234 (1px=3.09m), rmse_controles_m=4.0909, residuos_controles_m=[6.766, 4.609, 2.414, 2.362, 2.290]
Anexo 06: px/m=0.7118 (1px=1.40m), rmse_controles_m=7.8764, residuos_controles_m=[8.942, 10.146, 10.462, 2.995, 2.978]
Anexo 07: px/m=0.1779 (1px=5.62m), rmse_controles_m=7.3081, residuos_controles_m=[11.373, 8.502, 5.919, 3.952, 3.842]
```

- **No Anexo 02 (`1 px ≈ 1,40 m`, `rmse = 3,53 m`, `máx = 5,69 m`):**
  - `divisa < 10 m` desconta `4 / escala_min ≈ 5,65 m` antes de comparar com `10 m` (buscando mudança de cor a até `~15,65 m`). Embora maior que o resíduo máximo dos 5 pontos de controle (`5,69 m`), os 5 pontos não passaram por validação cruzada fora da amostra e há deslocamento cadastral visível de ~15–20 m em vias arteriais (visto no lote `25700`/`25369` na Av. Henrique Gregori).
  - `Eixo <= 60 m`: margem ampla frente ao erro de georreferenciamento, porém **inócua** para barrar falso positivo por causa do bug abaixo.
  - `RGB <= 18`: adequada para cores opacas com leve compressão JPEG (ex.: `Z1..Z4`), mas insuficiente perto de `Parque`/`Z5B` (`dist = 22,16`) e quebrada em camadas com transparência (Pergunta 4).
- **Nos Anexos 06 e 07:** [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L70) reaproveita a mesma constante `DIVISA_M = 10.0`, que é **menor** que o resíduo máximo de controle do Anexo 06 (**`10,462 m`**) e do Anexo 07 (**`11,373 m`**, onde 1 pixel já vale `5,62 m`, `3 px` de recuperação equivalem a `16,86 m` e `4 px` de desconto valem `22,48 m`).

### Achados da Pergunta 2

1. **[ALTA] Bug que aceita zona errada em lotes a `<= 60 m` do Eixo Estruturante.**
   Em [sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L156-L186), quando um traço de Eixo está a `<= 60 m`, o método grava `info["alternativas"].append("SC-EIXO")` e `info["motivo_duvida"] = "Traço de Eixo a até 60 m: art. 11 depende da testada; conferir via, trecho e alinhamento cadastral"`, mas **nunca adiciona motivo algum à lista `motivos`**. Se o polígono for homogêneo na cor de fundo (ex.: `SC-Z3` ou `SC-Z2`) e estiver a `>= 10 m` de outras cores zonais/não zonais, `motivos` fica vazio, `ZonaIncerta` **não** é lançada e a função aprova e grava `zona_id = "SC-Z3"`!
   - Na varredura amostral `1:100` (`951` lotes válidos em `audit6_detalhes.py`), os lotes `100`, `12800`, `14100`, `16200` e `25700` foram todos **aceitos** com `"SC-EIXO"` escondido em `alternativas`.
   - Caso concreto reproduzido ponta a ponta na CLI (lote `idx=25369`, quadra lindeira à **Av./Rua Henrique Gregori**, Eixo do art. 11, IV, com `cor_eixo` logo à frente na mesma imagem do Anexo 02):

   **Comando rodado e saída copiada:**
   ```powershell
   python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.026864, -47.906026" --zona auto --saida C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/lote25369.json
   ```
   ```text
   SC-completo-25369: 250.619 m²; gravado em C:\Users\respawn\.gemini\antigravity-cli\brain\a1b187a7-53c3-4f05-bf07-152fef0f4e49\scratch\lote25369.json
   ```
   Trecho do JSON gravado ([lote25369.json](file:///C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/lote25369.json#L45-L47), [linhas 1098-1106](file:///C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/lote25369.json#L1098-L1106)):
   ```json
     "zona_id": "SC-Z3",
     "zona_origem": "sugerida_pelo_mapa",
     "zona_conferida": false,
     ...
       "proporcao_por_zona": { "SC-Z3": 1.0 },
       "distancia_divisa_m": 206.41,
       "alternativas": [ "SC-EIXO" ],
       "motivo_duvida": "Traço de Eixo a até 60 m: art. 11 depende da testada; conferir via, trecho e alinhamento cadastral"
   ```

2. **[MÉDIA] Falso positivo de `SC-EIXO` em bordas vermelhas comuns de zona.**
   A detecção usa `norm(rgb - [147, 22, 0]) <= 35` ([sugerir_zona.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L111-L156)). Quando o traço vermelho vivo de limite entre zonas (`[255, 0, 0]`) cruza texto preto de rua ou borda cinza anti-aliased, os pixels misturados caem a distância `<= 35` de `[147, 22, 0]`. Exemplo concreto: `idx=100` (`pt=(-21.953894,-47.883118)`, Rua Ernesto Bentin, longe de qualquer Eixo do art. 11) recebe `alt=['SC-EIXO']` e `motivo="Traço de Eixo a até 60 m..."`.

---

## Pergunta 3 — Eixo Estruturante (Art. 11 da Lei 18.053/2016)

### Regra jurídica e comparação com o Portal de Leis
- **Fonte oficial conferida:** [Lei Municipal nº 18.053/2016 no Portal de Leis de São Carlos](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) (verificadas também as 6 leis alteradoras listadas no portal: 18.410, 18.927, 19.165, 21.601, 22.010 e 23.150 — nenhuma alterou o art. 11).

**Trecho extraído diretamente do portal oficial (art. 11):**
> `Art. 11. Eixo Estruturante é formado por algumas das principais vias urbanas que estruturam o Município, englobando os lotes que possuem testadas para tais vias, sendo elas as seguintes: I – Avenida Miguel Petroni e Avenida Miguel João, entre a Avenida Francisco Pereira Lopes e a rotatória com a Avenida Bruno Ruggieiro Filho; II – Avenida Bruno Ruggieiro Filho; III – Avenida Comendador Alfredo Maffei, da Rotatória do Cristo até a Rua Visconde de Inhaúma; IV – Avenida Tancredo Neves, Avenida Henrique Gregori, Rua Theodureto de Camargo, Avenida Grécia; V – Avenida Morumbi, da rotatória com a Avenida Grécia até a nova rotatória próxima à Rua Alan Kardec, abrangendo o trecho a ser duplicado da referida avenida. Parágrafo único. Neste Eixo, os empreendimentos de uso misto de habitação com comércio ou serviços no térreo, terão estas áreas térreas consideradas não computáveis para o Coeficiente de Aproveitamento, desde que não sejam desrespeitados os demais índices fixados para o zoneamento do local onde se situa o empreendimento.`

**Avaliação:**
1. **O princípio ("testada para a via, não a cor") está certo:** o art. 11 restringe explicitamente o Eixo Estruturante aos **"lotes que possuem testadas para tais vias"**. A falha prática não está na premissa jurídica, e sim em `sugerir_zona.py` aceitar automaticamente a zona de fundo mesmo quando encontra o traço a `<= 60 m` (Achado 1).
2. **Lista do código e outros eixos da lei (MÉDIA):** `sugerir_zona.py` **não possui nenhuma lista nominal de ruas ou trechos** — apenas detecta a cor marrom-escura `[147, 22, 0]` (`96.588` px no quadro principal do Anexo 02), sem validar nome de logradouro nem limites de trecho (rotatória do Cristo até Visconde de Inhaúma; trecho específico da Av. Morumbi) e confundindo bordas vermelhas com texto (ex.: `idx=100`, Achado 7). Além disso, a própria Lei 18.053/2016 prevê regra viária adicional fora do art. 11 — os **"eixos viários arteriais tipo 1"** das **Zonas 6A e 6B** (**arts. 41, IV e 45, IV**, que elevam o CA de `1,4` / `1,0` para `2,0`), totalmente ausentes da leitura automática porque as Zonas 6A/6B nem constam de `sugerir_zona.py`:

> `Art. 41. Os Coeficientes Urbanísticos para a Zona 6A – Regulação e Ocupação Controlada de Maior Densidade são: ... IV – CA = 1,4 e CA = 2,0 nos eixos viários arteriais tipo 1`
> `Art. 45. São Coeficientes Urbanísticos para a Zona 6B – Regulação e Ocupação Controlada de Média Densidade: ... IV – CA = 1,0 e CA = 2,0 nos eixos viários arteriais tipo 1`

---

## Pergunta 4 — Áreas especiais (Anexos 05, 06 e 07)

### Achados da Pergunta 4

1. **[ALTA] Transparência na `Área de Interesse Histórico` (Anexo 06) zera detecção sobre o Centro Histórico.**
   Em [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L14), `Área de Interesse Histórico` coleta na legenda `(2131, 12246)` o RGB opaco **`[188, 134, 246]`**. Porém, no mapa principal sobre a Zona 1, a mancha foi renderizada com transparência, resultando no RGB **`[180, 108, 182]`** — distância euclidiana **`69,54 >> 18`**. O mesmo efeito de baixa correspondência no mapa ocorre na `AEI Influência no Observatório da USP` (`4.248` px), `AEI Industrial e de Serviços` (`6.103` px) e `AEI Agricultura Familiar` (Anexo 07, `3.541` px).

   **Comando rodado e saída copiada (`audit6_check3.py`):**
   ```text
     [5] Área de Interesse Histórico: [188. 134. 246.]
     Lote 75838 centro px=(4952,5648) cor mediana=[180. 108. 182.], menor dist=69.54 (idx=5)
     Anexo 06 'AEIS tipo 1' rgb=[255. 252.   1.] pixels<=18 no quadro: 479345
     Anexo 06 'AEIS tipo 2' rgb=[  1. 176. 241.] pixels<=18 no quadro: 706225
     Anexo 06 'AEIS tipo 3' rgb=[225.   0. 156.] pixels<=18 no quadro: 29580
     Anexo 06 'Influência no Observatório da USP' rgb=[240.  70.  70.] pixels<=18 no quadro: 4248
     Anexo 06 'Área de Interesse Histórico' rgb=[188. 134. 246.] pixels<=18 no quadro: 656
     Anexo 06 'AEI Industrial e de Serviços' rgb=[244. 183.  77.] pixels<=18 no quadro: 6103
     Anexo 07 'AEI de Urbanização Específica' rgb=[254.   0.   0.] pixels<=18 no quadro: 516445
     Anexo 07 'AEI de Logística' rgb=[252. 184.  99.] pixels<=18 no quadro: 37115
     Anexo 07 'AEI de Proteção Paisagística' rgb=[ 85. 216. 140.] pixels<=18 no quadro: 4281631
     Anexo 07 'AEI de Agricultura Familiar e Camponesa' rgb=[232.  88. 211.] pixels<=18 no quadro: 3541
   ```
   Reprodução ponta a ponta na CLI em lote válido dentro do Centro Histórico (`idx=74451`, `-22.016466, -47.887994`):
   ```powershell
   python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.016466, -47.887994" --zona auto --saida C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/lote74451.json
   ```
   Saída `areas_especiais` em [lote74451.json](file:///C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/lote74451.json#L2233-L2255): devolve **apenas** `nao_verificada` para Anexo 06 e `gabarito_aeronautico` (Anexo 07), omitindo completamente `Área de Interesse Histórico` e `Subárea Especial de Restrição de Gabarito`.

2. **[ALTA] Vão central descoberto sobre a pista do aeroporto no Anexo 07 devolve lista vazia `[]`.**
   [ler_cones()](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L56-L66) procura o tracejado roxo `[97, 19, 190]` somente em duas caixas separadas (`y=2650..5380` e `y=5850..8560`) e gera dois fechos convexos desconexos. O intervalo central **`y=5380..5850` (~`470 px` ≈ `2,64 km`)**, onde passa a própria pista de pouso e ficam as poligonais `09`, `10` e `11` (`Área Especial de Influência do Transporte Aéreo`), fica **totalmente descoberto**. Como o fundo desse trecho é rosado (Zona 6D), listado em `FUNDOS["07"]`, a hachura cinza é recuperada para `FUNDO`, fazendo `me7.ler()` devolver lista vazia `[]` — **nenhum alerta nem `nao_verificada`!**

   **Comando rodado e saída copiada (`audit6_check2.py`):**
   ```text
     Anexo 07 centro_pista_amarelo px=(5150,5620) rgb=(236, 179, 162) pt=(-21.873394,-47.905169) -> []
     Anexo 07 tam_09_cinza px=(4800,5600) rgb=(254, 255, 253) pt=(-21.872245,-47.924368) -> []
     Anexo 07 tam_09_norte px=(4950,5400) rgb=(200, 238, 191) pt=(-21.862260,-47.916091) -> []
   ```

3. **[ALTA] Três categorias cartográficas dos Anexos 05, 06 e 07 ficaram de fora de `LEGENDAS`.**
   Confrontando [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L7-L25) com as legendas oficiais (`ANEXO 05 - AEIs Ambientais.pdf`, `ANEXO 06 - AEIs Urbanas.pdf`, `ANEXO 07 - AEIs Rurais.pdf`):
   - **Anexo 06:** faltou **`Subárea Especial de Restrição de Gabarito`** (item `33` no Centro Histórico, borda tracejada magenta localizada entre `y=12246` e `y=12424`, limitação legal de gabarito a `9 m`, **art. 80** da Lei 18.053/2016: `"A Subárea Especial de Restrição de Gabarito é a subárea interna à Poligonal de Interesse Histórico na qual há limitação do gabarito a 9m (nove metros) acima do nível da via pública nas novas construções ou ampliações."`).
   - **Anexo 07:** faltou **`Área Especial de Influência do Transporte Aéreo`** (quadro hachurado entre `y=10980` e `y=11160`; mediana `[255, 248, 249]`, mínima `[136, 106, 106]`; engloba os itens `09`, `10` e `11` no entorno da pista).
   - **Anexo 05:** faltou **`Chácaras de Recreio - Loteamentos rurais regulares`** (cinza `[170, 170, 170]` acima da AECRA na legenda; `1.545.904` px casam `<= 15` no quadro útil do Anexo 05, todos caindo em classe `0` → `nao_verificada`).

4. **[MÉDIA] Uso de `nao_verificada` e `possivel_incidencia` tem falsos negativos e rigidez:**
   - Qualquer pixel `leitura == 0` na margem (`margem_m = 10 + 4/escala_min`, chegando a `~32,5 m` no Anexo 07) dispara `nao_verificada` em [areas_especiais.py](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L108), o que ocorre em quase todo o Centro por conta da cor `[180,108,182]` não reconhecida e dos selos brancos/linhas.
   - `gabarito_aeronautico` ([linhas 104-107](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/areas_especiais.py#L104-L107)) recebe **sempre** `incidencia = "possivel_incidencia"`, mesmo quando o polígono está 100% no interior dos dois cones (nunca `"sobreposicao_visual"`).
   - Os encartes de distrito/aeroporto (Santa Eudóxia no Anexo 06, onde ficam os itens `13` e `18` de AEIS Social tipo 1, e aeroporto ampliado no Anexo 07) são recusados como `nao_verificada` porque não há afim própria para eles.

---

## Pergunta 5 — Seleção por coordenada (`novo_lote.py --ponto`)

A seleção em [localizar()](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/novo_lote.py#L115-L131) converte `WGS84 -> EPSG:31983`, consulta `STRtree(..., predicate="intersects")` (para detectar geometria inválida ou múltiplas feições) e decide o polígono escolhido via `predicate="within"`. Os testes reais na CLI revelaram três comportamentos distintos:

### 5.1 Ponto na divisa entre dois lotes (**Achado BAIXA**)
Na aresta comum entre os lotes `900` (`353.904 m²`) e `901` (`381.239 m²`), a ida e volta `UTM -> WGS84 (texto) -> UTM` introduz deslocamento numérico submilimétrico que decide silenciosamente qual lote vence `within`: com 6 casas decimais escolhe `900`; com 12 casas muda para `901`; num vértice compartilhado arredondado recusa dizendo que nenhuma feição contém o ponto.

**Comandos rodados e saídas copiadas:**
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-21.963013, -47.886674" --listar-vizinhos
```
```text
Base completo; índices começam em zero. Contato não comprova aptidão para remembramento.
Feição achada: índice 900; área 353.904 m²
Vizinha: índice 901; área 381.239 m²
```
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-21.963013022579, -47.886674469625" --listar-vizinhos
```
```text
Base completo; índices começam em zero. Contato não comprova aptidão para remembramento.
Feição achada: índice 901; área 381.239 m²
Vizinha: índice 900; área 353.904 m²
Vizinha: índice 902; área 403.512 m²
```
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-21.963029, -47.886892" --listar-vizinhos
```
```text
Erro: Nenhuma feição contém o ponto no interior na base completo (rua, lacuna ou divisa). As 3 mais próximas, distância ao polígono: índice 900: 0.054 m; índice 901: 0.074 m; índice 899: 8.420 m. Confira e informe --indices; nenhuma feição escolhida
```
*(Em caso de sobreposição real na base, ex.: `-21.97162121, -47.90330773`, o comando recusa corretamente listando `[978, 980]`.)*

### 5.2 Ponto num lote com buraco / pátio interno (**Achado MÉDIA**)
Na base `completo` existem **`1.352` polígonos com `interiors`**.
1. **Ponto no buraco vazio (`idx=55999`, `hole_area=6,84 m²`):** é recusado como se fosse rua/lacuna externa.
2. **Ponto em buraco preenchido por lote encravado (`idx=14429`, `884,447 m²`, com `idx=14421`, `256,379 m²`, dentro do buraco):** seleciona o polígono encravado (`14421`).
3. **Ponto no anel (`idx=14429`):** `--listar-vizinhos` **funciona** e mostra `14429`, porém ao gerar o lote com `--zona SC-Z2` (ou `auto`), [unir()](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/novo_lote.py#L56-L59) **quebra** antes mesmo da zona automática com `Erro: Componente 1: exige polígono válido, não vazio e sem buracos` (o que impede também remembrar o anel `14429` com seu miolo `14421` para fechar o buraco).

**Comandos rodados e saídas copiadas:**
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-21.99203689, -47.88204138" --listar-vizinhos
```
```text
Erro: Nenhuma feição contém o ponto no interior na base completo (rua, lacuna ou divisa). As 3 mais próximas, distância ao polígono: índice 55999: 0.064 m; índice 56000: 14.541 m; índice 56001: 24.413 m. Confira e informe --indices; nenhuma feição escolhida
```
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.00229627, -47.88238835" --listar-vizinhos
```
```text
Base completo; índices começam em zero. Contato não comprova aptidão para remembramento.
Feição achada: índice 14421; área 256.379 m²
Vizinha: índice 14429; área 884.447 m²
```
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.00227174, -47.88258690" --listar-vizinhos
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.00227174, -47.88258690" --zona SC-Z2 --saida C:/Users/respawn/.gemini/antigravity-cli/brain/a1b187a7-53c3-4f05-bf07-152fef0f4e49/scratch/out_buraco.json
```
```text
Base completo; índices começam em zero. Contato não comprova aptidão para remembramento.
Feição achada: índice 14429; área 884.447 m²
Vizinha: índice 14421; área 256.379 m²
Vizinha: índice 14430; área 179.132 m²
Erro: Componente 1: exige polígono válido, não vazio e sem buracos
```

### 5.3 Ponto num condomínio grande (**Achado MÉDIA**)
Na base `completo` (`110.089` feições), o percentil 99 de área é **`642,96 m²`** e o maior polígono único é **`2.862,43 m²`** (`idx=37737`). Não existem grandes glebas únicas cadastradas; condomínios horizontais fechados (como o Parque Faber) estão fragmentados em unidades individuais separadas por viário interno sem feição cadastral:
1. Clicar na **via/área comum interna** de um condomínio recusa (`lacuna`), sugerindo as 3 unidades mais próximas.
2. Clicar sobre uma **casa/edificação** dentro do condomínio seleciona apenas aquela unidade isolada (`292,762 m²`), não o conjunto condominial.
3. Para qualquer gleba/remembramento com área `> 1.000.000 m²` (`1 km²`) ou caixa com margem `> 2.000.000 px` (no Anexo 02, `~1.480 × 1.480 m` já atinge `2.040.778 px`), tanto `sugerir_zona.py:133-137` quanto `areas_especiais.py:77-81` **recusam integralmente** a leitura raster mesmo dentro do quadro principal.

**Comandos rodados e saídas copiadas:**
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.00778217, -47.90898544" --listar-vizinhos
```
```text
Erro: Nenhuma feição contém o ponto no interior na base completo (rua, lacuna ou divisa). As 3 mais próximas, distância ao polígono: índice 18898: 1.454 m; índice 18890: 3.373 m; índice 18865: 5.683 m. Confira e informe --indices; nenhuma feição escolhida
```
```powershell
python -I -B -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.007864, -47.908977" --listar-vizinhos
```
```text
Base completo; índices começam em zero. Contato não comprova aptidão para remembramento.
Feição achada: índice 18890; área 292.762 m²
Vizinha: índice 18898; área 85.857 m²
```
Teste direto em polígono `> 1 km²` (`area = 1.193.488,5 m²`, `audit6_check3.py`):
```text
  mz.sugerir(>1km2): ZonaIncerta: Zona automática recusada: Fora do quadro georreferenciado ou lote excede a leitura local (1 km²/2 milhões de pixels). Alternativas: nenhuma identificada. Confira o mapa e informe --zona SC-XX explicitamente.
  me6.ler(>1km2): [('nao_verificada', 'Áreas especiais do Anexo 06: não verificada')]
```
