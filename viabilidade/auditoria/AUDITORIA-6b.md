# Auditoria 6b — Adendo: Leis 19.166/2019 (AEIs 44/45 e 9-A N/O), 18.927/2018 (Zona 6E) e anexos oficiais

**Escopo:** Verificação independente sobre o estado atual do repositório (`viabilidade/terreno/`, `viabilidade/lei/`) e fontes oficiais abertas da Prefeitura/Câmara de São Carlos, sem alterar código nem commitar.

---

## Resumo executivo

1. **Lei 19.166/2019 (AEIs 44/45 no Anexo 6 e áreas N/O no Anexo 9-A):** **Não aparecem** no `anexo06.jpg` usado pelo código (nem no `ANEXO 09a` oficial de 2017). A lei traz **roteiro perimétrico textual** (rumos, distâncias e confrontantes junto à SP-318 km 236, UFSCar e Córrego do Monjolinho, sem coordenadas UTM/geográficas). **Impacto:** um lote nessa faixa sai **sem nenhum alerta** de AEI Industrial e de Serviços (arts. 84–86), de ZUPI-II ou do Anexo 9-A; pior, onde incide o cone do Anexo 07 (`gabarito_aeronautico`), nem sequer aparece ressalva `nao_verificada` para o Anexo 06.
2. **Lei 18.927/2018 (Zona 6E — Santa Eudóxia):** **Não aparece** no `anexo02.jpg` usado (nem no texto/PDF oficial da própria lei há mapa ou coordenadas). Um lote lá **recebe recusa** (não zona automática errada), barrado em cascata por estar fora do `bbox` do projeto, fora dos GeoJSONs de cadastro e fora do quadro georreferenciado do Anexo 02 (`ZonaIncerta`).
3. **Página oficial com versão atualizada dos anexos:** **Não localizada** em fontes abertas oficiais. Tanto a página principal do Plano Diretor quanto a página secundária de Utilidade Pública mantêm os mapas em PDF de **janeiro de 2017** (carimbo `Dezembro de 2016`), e a página secundária mistura links antigos de **2013** (da Lei 13.691/2005).

---

## (1) Lei nº 19.166/2019 — AEIs 44 e 45 (Anexo 6) e áreas N e O (Anexo 9-A)

### Aparecem no `anexo06.jpg` usado pelo código?
**Não.** O arquivo `viabilidade/terreno/dados/zonas-mapas/anexo06.jpg` é o fluxo JPEG embutido em `viabilidade/lei/mapa/lei18053_anexos_2017_pdf/ANEXO 06 - AEIs Urbanas.pdf` (carimbo `Data: Dezembro de 2016`):

```powershell
python -I -X utf8 -c "import hashlib, pathlib; [print(name, 'pdf_sha256=', hashlib.sha256(pathlib.Path(pdf).read_bytes()).hexdigest()[:16], 'jpg_in_pdf=', pathlib.Path(jpg).read_bytes() in pathlib.Path(pdf).read_bytes()) for name, pdf, jpg in [('02','viabilidade/lei/mapa/lei18053_anexos_2017_pdf/ANEXO 02 - Zoneamento Urbano.pdf','viabilidade/terreno/dados/zonas-mapas/anexo02.jpg'),('06','viabilidade/lei/mapa/lei18053_anexos_2017_pdf/ANEXO 06 - AEIs Urbanas.pdf','viabilidade/terreno/dados/zonas-mapas/anexo06.jpg')]]"
```
Saída:
```text
02 pdf_sha256= f2dbbf98a0698092 jpg_in_pdf= True
06 pdf_sha256= 3bfc5f7b8b79c501 jpg_in_pdf= True
```

Na legenda impressa no próprio `anexo06.jpg`, a lista **"Áreas de Interesse Industrial e de Serviços:"** termina no item **43** (`35 Do Jardim Jockey Clube` até `43 R. Luiz Lázaro Zamenhoff, entre as Ruas Pascoal Meca e Bolívia`). Não há itens **44** nem **45**.

Da mesma forma, o `ANEXO 09a - Areas compativeis para instalação de usos incômodos.pdf` (carimbo `Data: Dezembro de 2016`, baixado da página oficial do Plano Diretor) lista apenas as áreas **A** a **M** (não há **N** nem **O**), e o código em `viabilidade/terreno/areas_especiais.py` (`LEGENDAS`) só lê os Anexos `"05"`, `"06"` e `"07"` — **o Anexo 9-A não é lido por nenhum módulo**.

### Onde ficam e o texto da lei descreve o perímetro?
**Sim**, o texto oficial descreve o perímetro por **rumos, distâncias, confrontantes e matrículas** (sem coordenadas geográficas ou UTM), localizando as áreas na **rodovia SP-318 – km 236**, entre a rodovia, a **UFSCar**, uma pequena represa e o **Córrego do Monjolinho** (junto à *São Carlos S/A Indústria de Papel e Embalagens*, ~`-21.9844, -47.8856`).

- **Fonte oficial:** https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_339
- **Trechos copiados (Lei nº 19.166, de 10/06/2019):**
  > *"Art. 1º Ficam incluídos os perímetros 44 e 45 definidos como Áreas de Interesse Industrial e de Serviços no Anexo 6 da Lei Municipal nº 18.053 de 19 de dezembro de 2016, com as seguintes descrições:*
  > *I - Matrícula nº 10.031: Gleba de terras situada na rodovia SP 318 – km 236 com área de 62.801,98 metros quadrados, com o seguinte roteiro perimétrico: Parte do marco nº 1, cravado junto à cerca do D.E.R. e segue confrontando com a área remanescente da São Carlos S/A Indústria de Papel e Embalagens com rumo 82º07’ medindo 189,89 metros até o marco nº 2, cravado junto à cerca da divisa com a Universidade Federal de São Carlos; [...] até o marco nº 6, cravado à margem de um córrego; [...] até o marco nº 7, cravado à margem do mesmo e junto à cerca do D.E.R. na rodovia SP 318 (São Carlos a Ribeirão Preto) [...]*
  > *II - Matrícula nº 10.032: Gleba de terras situada na rodovia SP 318 – km 236 com área de 48.400,00 metros quadrados [...] confrontando com a área remanescente da São Carlos S/A Indústria de Papel e Embalagens [...] e com a Universidade Federal de São Carlos [...]*
  > *III - Matrícula nº 84.360: Gleba de terras situada na rodovia SP 318 – km 236 com área de 30.624,00 metros quadrados [...] confrontando com Joaquim Toyama até ter a margem de uma pequena represa [...] até as margens do córrego do Monjolinho [...] tendo por confrontante o D.E.R. (atual rodovia São Carlos – Ribeirão Preto) [...].*
  > *Art. 2º Os perímetros de que trata o art. 1º desta Lei serão inseridos no Anexo 9-A da Lei Municipal nº 18.053/16, que trata das Áreas Compatíveis para instalação de Atividades Incômodas e serão designados como N e O.*
  > *Art. 3º As áreas de que trata o art. 1º desta Lei estão classificadas [...] de Zona Predominantemente Industrial do Tipo II (ZUPI-II) [...].*
  > *Art. 4º Os coeficientes urbanísticos a serem respeitados são os da Zona 3 - Ocupação Condicionada, na qual as áreas se situam e definidos no art. 25 da Lei Municipal nº 18.053/16."*

Na conferência visual de `anexo06.jpg` na região correspondente (`px ≈ 5213, 3023`, leste da SP-318, oeste do campus da UFSCar e norte do Córrego do Monjolinho), toda a mancha está pintada apenas com o azul-claro da **Zona 3**, sem a cor ocre de *AEI Industrial e de Serviços*.

### Qual o impacto no código? Lote dentro delas sai sem alerta?
**Sim, sai sem alerta das AEIs 44/45, da ZUPI-II e do Anexo 9-A (N/O).**

Testando um polígono de 20 m × 20 m no interior desse bolsão azul de Zona 3 (`px06=(5265, 3060)`, `lat=-21.985132, lon=-47.885094`):

```text
=== wedge_east_of_pond_10031 px06=(5265,3060) latlon=(-21.985132, -47.885094) ===
  sugerir_zona: SC-Z3
  Anexo 06 ler: []
  AreasEspeciais tipos: [('07', 'gabarito_aeronautico', 'Superfícies de aproximação e decolagem do Aeroporto Mário Pereira Lopes')]
```

- **Zona (`sugerir_zona.py`):** sugere `SC-Z3` (coerente com o art. 4º da Lei 19.166/2019 quanto aos índices básicos de Zona 3, ou recusa perto de divisa/córrego).
- **Áreas especiais (`areas_especiais.py`):**
  1. `MapaEspecial("06").ler(pol)` devolve **`[]`** (zero detecção de `interesse_industrial_servicos`).
  2. Como o **Anexo 07** dispara `gabarito_aeronautico` nesse ponto, `resultado` em `AreasEspeciais.ler()` (linhas 187–194) **não fica vazio**, de modo que **nem a ressalva genérica `NADA_ENCONTRADO` (`anexo: "05/06/07"`) nem `nao_verificada` do Anexo 06 aparece na saída**. O lote sai apenas com o alerta do Anexo 07 (e, se tocar o córrego/lagoa, AIA do Anexo 05), omitindo por completo a incidência industrial 44/45 (arts. 84–86), ZUPI-II e áreas N/O do Anexo 9-A.
  3. Observação cadastral: num raio de 600 m de `(-21.985132, -47.885094)`, `lotes_saocarlos_completo.geojson` tem 1.294 feições, mas `big>5000m2: []` (as três glebas originais de 30k–62k m² não figuram como lotes grandes subdivididos ali).

---

## (2) Lei nº 18.927/2018 — Zona 6E (Santa Eudóxia)

### Aparece no `anexo02.jpg` usado?
**Não.**
- `anexo02.jpg` (`Data: Dezembro de 2016`, `ANEXO 02 - Zoneamento Urbano.pdf`) lista na legenda apenas `1`, `2`, `3`, `4`, `5A`, `5B`, `Campus Universitário` e `Pq. Ecológico` (e nos quadros inferiores só `Eixos` e Zonas `1` a `5`).
- O encarte **"Distrito de Santa Eudóxia"** no canto inferior esquerdo de `anexo02.jpg` mostra exclusivamente **Zona `3` (Ocupação Condicionada)** dentro do perímetro urbano de 2016 — **sem Zona 6E**.
- O texto oficial e o PDF assinado da Lei nº 18.927, de 11/12/2018 (`lei18927-digital.pdf`, 2 páginas, linkado na página da Prefeitura), também **não trazem mapa anexo nem coordenadas**, apenas referendam o traçado aprovado pelos conselhos:
  - **Fonte oficial (texto):** https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_754
  - **PDF oficial (2 páginas, sem mapa):** https://www.saocarlos.sp.gov.br/images/stories/pdf/conselhos/lei18927-digital.pdf
  - **Trecho copiado (art. 1º e art. 2º):**
    > *"Art. 1º Fica criada no Plano Diretor Estratégico do Município de São Carlos, Lei Municipal nº 18.053/16 o artigo 42A., instituindo a Zona 6E com objetivo de disciplinar a expansão urbana do Distrito de Santa Eudóxia [...].*
    > *Art. 2º Esta Lei referenda a expansão urbana definida pela Secretaria Municipal de Habitação e Desenvolvimento Urbano-SMHDU, Conselho Municipal de Defesa do Meio Ambiente-COMDEMA, Conselho Municipal de Desenvolvimento Urbano-COMDUSC e nas audiências públicas realizadas no referido Distrito e Câmara Municipal."*

### Um lote lá recebe zona automática errada ou recusa?
**Recebe recusa** (não recebe zona automática errada), por três barreiras sucessivas no código atual:

1. **Bloqueio no `--ponto` (`viabilidade/terreno/novo_lote.py:39-46`):**
   `padrao/cidades/sao-carlos.json` define `bbox: [-48.1211, -22.1044, -47.8006, -21.9154]`. Santa Eudóxia (`~ -21.7730, -47.7680`) fica ~25 km a NNE, fora do recorte:
   ```powershell
   python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-21.7730, -47.7680" --listar-vizinhos
   ```
   Saída (código `1`):
   ```text
   Erro: Ponto fora da área de São Carlos coberta pelo projeto (recorte de dados, não limite municipal)
   ```
   Além disso, nenhuma das duas bases de lotes cobre o distrito: `lotes_saocarlos_completo.geojson` vai de `lat=[-22.0772, -21.9492]` (`n=110089`) e `lotes_saocarlos.geojson` (`antigo`) vai de `lat=[-22.0802, -21.8898]` (`n=113501`).

2. **Bloqueio em `MapaZonas().sugerir(pol)` (`viabilidade/terreno/sugerir_zona.py:16, 167-170`):**
   Mesmo passando um polígono sintético em Santa Eudóxia (`-21.773, -47.768`) diretamente ao método, o ponto projeta em `px02 = [13878.2, -13963.8]`, fora dos limites `(250, 70, 8770, 10450)` — e mesmo um polígono sobre o encarte `(250, 10150, 2500, 12746)` é bloqueado:
   ```text
   === Probe Santa_Eudoxia_real (-21.773, -47.768) px06=[ 13838.9 -13813.3] px02=[ 13878.2 -13963.8] ===
   MapaZonas.sugerir RECUSADA: Fora do quadro georreferenciado do Anexo 02 (borda, legenda ou encarte) alts: []
   ```
   Adicionalmente, `ZONAS` em `sugerir_zona.py:16` lista apenas `["SC-Z1", "SC-Z2", "SC-Z3", "SC-Z4", "SC-Z5A", "SC-Z5B"]` (não contempla `SC-Z6E`).

*(Nota: se o usuário informar `--zona SC-Z6E` manualmente, `validar_zona` em `novo_lote.py:53-55` já aceita, pois `viabilidade/lei/zonas.json` já contém `SC-Z6E`, com `ca_basico: null` e `ca_maximo: null`.)*

---

## (3) Há página oficial com versão atualizada dos anexos?

**Não foi localizada nenhuma página oficial com versões atualizadas dos mapas/anexos** que incorporem as Leis nº 18.927/2018 e nº 19.166/2019. As páginas oficiais verificadas na Prefeitura de São Carlos mantêm os arquivos originais de 2017 (ou mais antigos):

1. **Página principal do Plano Diretor Estratégico:**
   - **URL:** https://www.saocarlos.sp.gov.br/index.php/habitacao-morar/166049-plano-diretor-estrategico.html
   - **Evidência (cabeçalhos HTTP `Last-Modified` em `curl.exe -4 -sSLI`):** todos os anexos da seção *"Lei do Plano Diretor"* apontam para `/images/stories/pdf/2017/pde/` com data de **20 de janeiro de 2017** (e carimbo interno `Dezembro de 2016`):
     - `ANEXO 02 - Zoneamento Urbano.pdf` → `Last-Modified: Fri, 20 Jan 2017 19:50:50 GMT` (`15.013.109` bytes)
     - `ANEXO 06 - AEIs Urbanas.pdf` → `Last-Modified: Fri, 20 Jan 2017 19:51:10 GMT` (`14.678.499` bytes)
     - `ANEXO 09a - Areas compativeis para instalação de usos incômodos.pdf` → `Last-Modified: Fri, 20 Jan 2017 19:51:18 GMT` (`10.550.992` bytes; mapa com descrição apenas de **A** a **M**)
     - `lei18053 - Plano Diretor e Anexos - digital.pdf` → `Last-Modified: Fri, 20 Jan 2017 19:51:00 GMT` (`165.664.940` bytes)
   - Os links mais abaixo na mesma página (`/images/stories/plano_diretor/ANEXO ...`) são da etapa preliminar (*"Produto consolidado Final"*).

2. **Página secundária (`Utilidade Pública → Plano Diretor`):**
   - **URL:** https://www.saocarlos.sp.gov.br/index.php/utilidade-publica/plano-diretor.html
   - **Evidência:** traz o título *"PLANO DIRETOR DE SÃO CARLOS - LEI Nº 18.053 de dezembro de 2018 alterada pelas leis nº 18.410/17, nº 18.927/18"* e hospeda `/images/stories/pdf/conselhos/lei18927-digital.pdf` (`Last-Modified: Fri, 04 Oct 2019 17:52:21 GMT`, `1.699.980` bytes), mas esse PDF contém **apenas as 2 páginas do texto assinado da Lei 18.927/2018, sem mapa**. Os links listados logo abaixo sob `ANEXOS` (`/images/download/habitacao/Anexo02_Zon_Urb_e_Perimetro.pdf` e `Anexo06_AEIs Urbanas.pdf`) têm `Last-Modified: Fri, 25 Jan 2013` e pertencem ao Plano Diretor anterior (**Lei nº 13.691/2005**).

3. **Portal de Leis e Decretos Municipais (`consultaleis`):**
   - **URLs:** `https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_754` (Lei 18.927/2018) e `https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_339` (Lei 19.166/2019).
   - **Evidência:** disponibilizam apenas o texto HTML das leis; os links internos `../legislacao/leis/754/lei18927-digital.pdf` e `../legislacao/leis/339/lei19166-digital.pdf` retornam `HTTP 404 Not Found`, e não há anexos cartográficos consolidados publicados ali.
