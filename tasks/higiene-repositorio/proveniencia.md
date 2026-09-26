# Proveniência dos dados — 26/09/2026

De onde vem cada dado de terceiros que o projeto usa e até onde ele chega. Complementa o
[THIRD_PARTY.md](../../THIRD_PARTY.md), que trata de código e mídia, e o
[levantamento](levantamento.md) de higiene. Nenhuma fonte foi removida, e nenhuma página mudou.

Cada fonte tem quatro informações:

- **uso atual:** a etapa do pipeline que a lê hoje, ou "só histórico";
- **chega ao artefato final:** o que está versionado no git e o que vai para dentro de cada página;
- **licença ou termo conhecido:** a que está registrada no repositório. Quando não há registro, o
  texto diz isso. Nada aqui é parecer jurídico;
- **evidência no código:** o arquivo e a linha que sustentam o que foi dito.

**Os artefatos finais.** Todos os dados do mapa entram na página por `pipeline/montar.py` e
`pipeline/build/blocos.py`, na lista `DADOS`.

| Artefato | O que é | O que carrega |
|---|---|---|
| **mapa** | o site do mapa (`firebase.json` → `v16-moveis/publicado`) | todos os blocos de dado da cidade inteira |
| **tour** | `/imovel/<id>`, o mapa recortado num raio em volta do imóvel (`pipeline/recorte.py`) | a geometria (`__citydata`, ruas, chão, muros, portões), os anúncios e as unidades recortados pelo raio. Relevo, vegetação, POIs, texturas, árvores e móveis entram inteiros (`INTEIROS`, `recorte.py:27`) |
| **maquete** | `/maquete/<id>` | só o imóvel: cadastro da unidade, móveis, luz assada e o three. **Nenhum dado de cidade** (`pagina_maquete.py:2397–2420`) |

"Distribuído" quer dizer: está no git ou vai para dentro de uma página publicada.

## Resumo

| Fonte | Uso atual | No git | Nas páginas | Crédito hoje |
|---|---|---|---|---|
| OpenStreetMap | etapas 0.2, 0.3, 0.4 e 0f | só derivado | mapa, tour | **"© OpenStreetMap"** no mapa e no tour |
| Overture Maps (edificações) | etapa 0.1, que alimenta a 0a, a 0c, a 5 e a 7 | só derivado | mapa, tour | nenhum |
| SigaSC: quadras, loteamentos e endereços | etapas 0.5, 0.6 e 0.7 | só derivado | mapa, tour | nenhum |
| SigaSC: OpenPlots (plantas de loteamento) | etapas 0.9, 0d e 0e | só derivado | mapa, tour | nenhum |
| IBGE CNEFE | etapa 5, por `enderecos_extra` (extração manual) | nada | só indireto | nenhum |
| Sentinel-2, via Element84 | etapa 0.10 | derivado | mapa, tour | nenhum |
| open-elevation | etapa 0.8 | derivado | mapa, tour | nenhum |
| ambientCG | fora do `rodar.py` (`pipeline/baixa_texturas.py`) | sim | mapa, tour | não exigido (CC0) |
| Anúncios de `roca.com.br` | **substituídos por fictícios em 26/09/2026** | não | não (a partir do próximo build) | — |
| Imóveis de clientes | cadastro das unidades | sim | mapa, tour, maquete | não se aplica |
| Geoportal de Ribeirão Preto | **só histórico** | nada | nada | — |

## OpenStreetMap

- **Uso atual:** sim.
  - Etapa 0.2: malha viária e base, `rebuild_city.py`. Usa o extract local da Geofabrik quando
    ele existe; senão, o Overpass.
  - Etapa 0.3: tags de prédio (nome e `building:levels`), `fetch_osm_buildings.py`.
  - Etapa 0.4: POIs, `fetch_osm_pois.py`.
  - Etapa 0f: POIs da página, `pipeline/fontes/pois.py`.
  - O `build_pois.py` da raiz também consulta o Overpass, mas não é chamado. A saída dele,
    `pois_sao_carlos.json`, não tem leitor.
- **Chega ao artefato final:**
  - no git, só derivados: `sao-carlos/sao-carlos-v7.city.json` (ruas; nome e altura dos prédios
    mantidos), `sao-carlos/dados/street_tris.json`, `ground_tris.json` e
    `sao-carlos/poidata_merged.json`. Os brutos (`osm_*_raw.json`) não estão versionados;
  - nas páginas: `__citydata`, `__streetdata` e `__grounddata` no mapa e no tour (recortados no
    tour), e `__poidata` inteiro nos dois;
  - a maquete não recebe nada do OSM.
- **Licença:** ODbL 1.0.
  - O mapa e o tour mostram "© OpenStreetMap", com link para `openstreetmap.org/copyright`.
  - O crédito some só na cena de planta, que não desenha cidade.
- **Evidência:**
  - `pipeline/rodar.py:85–92` e `:135–137`, e `rebuild_city.py:184–191`;
  - `v1.5/renderizador-v16-moveis/corpo.html:214` (e `renderizador/corpo.html`);
  - `estilo/70-manche.css:83`.

## Overture Maps (edificações)

- **Uso atual:** sim, é a massa do mapa.
  - Etapa 0.1 (`pipeline/fontes/overture.py`), depois 0.2, 0a, 0c e 7.
  - Na etapa 7, os prédios comerciais, cívicos, com nome ou com altura do OSM **mantêm o contorno
    do Overture** (`city_final.py:98–106`).
  - O footprint residencial também é uma das provas de ocupação (etapa 5, `city_final.py:239`) e
    o critério de urbanização da etapa 1b.
- **Chega ao artefato final:**
  - no git, derivado dentro de `sao-carlos/sao-carlos-v7.city.json`. O bruto
    (`overture_buildings.geojson`) não está versionado;
  - nas páginas: os contornos mantidos em `__citydata`, no mapa e no tour.
- **Licença:** **não registrada no repositório.**
  - O próprio `overture.py` diz que o arquivo original foi baixado antes do script, e que "a
    proveniência exata não ficou registrada". A release usada é desconhecida.
  - As fontes de dentro do arquivo são o Google Open Buildings e o Microsoft ML Buildings
    (`overture.py:5–7`).
  - O Overture publica o tema de edificações sob ODbL, e as fontes de dentro têm termos próprios.
    Isso precisa ser conferido numa release identificada.
- **Evidência:** `pipeline/fontes/overture.py:1–20`, `pipeline/rodar.py:82–84`,
  `pipeline/city_final.py:98–106`.

## SigaSC, Prefeitura de São Carlos: quadras, loteamentos e endereços

- **Uso atual:** sim.
  - Etapa 0.5: quadras oficiais, `sigasc_quadras.py`. É a base de quadra, completada pela 1b onde o
    cadastro não cobre.
  - Etapa 0.6: loteamentos, `sigasc_parcelamentos.py`. Serve "só pra nomear": as ferramentas de
    planta o usam para casar nome e georreferenciar.
  - Etapa 0.7: pontos de endereço, `sigasc_enderecos.py`. É a prova de ocupação da etapa 5.
  - Extraídos pelo render do MapServer (`geo.saocarlos.sp.gov.br`), porque o WFS e o WMS estão
    trancados (`pipeline/fontes/sigasc.py:1–5`).
- **Chega ao artefato final:**
  - no git, só derivados: `sao-carlos/dados/lotes_saocarlos_completo.geojson`, `muros_segs.json`,
    `portoes.json` e `ground_tris.json`. Os brutos (`quadras_saocarlos*.geojson`,
    `address_points.json` e `loteamentos_saocarlos_oficial.geojson`) não estão versionados;
  - nas páginas: a forma das quadras, dos lotes, dos muros e dos portões, e quais lotes ganham
    casa, em `__citydata`, `__murosdata`, `__portoes` e `__grounddata`, no mapa e no tour.
- **Licença:** **nenhum termo de uso registrado.**
- **Evidência:** `pipeline/rodar.py:93–101`, `pipeline/fontes/sigasc*.py` e
  `pipeline/ocupacao.py:46`.

## SigaSC: OpenPlots (plantas urbanísticas de loteamento)

- **Uso atual:** sim.
  - Etapa 0.9: baixa as plantas (`pipeline/plantas/baixar_openplots.py`, do módulo de Habitação
    em `geo.saocarlos.sp.gov.br/habitacao/OpenPlots`).
  - Etapa 0d: vetoriza e georreferencia.
  - Etapa 0e: consolida e filtra. O lote oficial vale onde a planta presta.
- **Chega ao artefato final:**
  - no git: a geometria dos lotes oficiais dentro de `lotes_saocarlos_completo.geojson`, marcada
    `"fonte": "planta"`. As plantas brutas (`plantas_openplots/`) não estão versionadas;
  - nas páginas: os lotes, muros e casas assentadas neles, no mapa e no tour.
- **Licença:** **nenhum termo de uso registrado.**
- **Evidência:** `pipeline/plantas/baixar_openplots.py:1–5`, `pipeline/rodar.py:108–134` e
  `pipeline/consolidar.py:1–5`.

## IBGE CNEFE (endereços do Censo 2022)

- **Uso atual:** sim, mas **fora da tabela de etapas.**
  - `pipeline/fontes/cnefe.py` roda à mão e grava `sao-carlos/dados/address_points_cnefe.json`.
  - A etapa 5 lê esse arquivo como `enderecos_extra`, a segunda prova de ocupação, quando ele
    existe.
- **Chega ao artefato final:** nada versionado.
  - Nas páginas, só de forma indireta: o CNEFE decide quais lotes ganham casa, mas nenhum ponto
    de endereço vai para a página.
- **Licença:** dado público do IBGE. O termo de uso não está registrado.
- **Evidência:** `pipeline/fontes/cnefe.py:1–12`, `pipeline/ocupacao.py:46` e
  `padrao/cidades/sao-carlos.json` (`fontes.enderecos_extra`).

## Sentinel-2 (Copernicus), via Element84 Earth Search

- **Uso atual:** sim, na etapa 0.10 (`pipeline/fontes/vegetacao.py`). O NDVI dá a densidade de
  vegetação.
- **Chega ao artefato final:**
  - no git: `sao-carlos/dados/vegetacao_ndvi.json` (0,33 MB);
  - nas páginas: `__vegetacao`, inteiro no mapa e no tour.
- **Licença:** **não registrada no repositório.**
  - Os dados Sentinel da Copernicus têm termos de uso próprios, que incluem aviso de fonte. Isso
    precisa ser conferido.
  - Hoje a página não mostra crédito; a fonte só aparece em comentário do `app.js`.
- **Evidência:** `pipeline/fontes/vegetacao.py:1–33`, `pipeline/rodar.py:105–107` e
  `v1.5/renderizador-v16-moveis/app.js:199`.

## open-elevation (relevo)

- **Uso atual:** sim, na etapa 0.8 (`pipeline/fontes/relevo.py`, `api.open-elevation.com`).
- **Chega ao artefato final:**
  - no git: `sao-carlos/relevo_wide.json`;
  - nas páginas: `__elevdata`, inteiro no mapa e no tour.
- **Licença:** **não registrada.** Não estão registrados o termo da API nem a base de elevação
  por trás dela.
- **Evidência:** `pipeline/fontes/relevo.py:1–36` e `pipeline/rodar.py:102–104`.

## ambientCG (texturas de fachada)

- **Uso atual:** sim, fora do `rodar.py`: `pipeline/baixa_texturas.py` roda à mão.
- **Chega ao artefato final:**
  - no git: `texturas/*.webp` (`Plaster001`, `Bricks023` e `Ground037`);
  - nas páginas: `__textura`, no mapa e no tour.
- **Licença:** CC0, registrada no script. Não exige atribuição.
- **Evidência:** `pipeline/baixa_texturas.py:1–8` e `:36`, e o [THIRD_PARTY.md](../../THIRD_PARTY.md).

## Anúncios de `roca.com.br` (vitrine de demonstração)

**Substituídos em 26/09/2026.** Até essa data, a vitrine do mapa tinha duas partes vindas da Roca:

- 7 anúncios reais em `sao-carlos/dados/imoveis.json`: título, preço, quartos, vagas, bairro,
  lat/lon e `url`;
- 6 estudos 3D de fachada em `modelos_cadastrados/estudos.json`, feitos a partir das fotos dos
  anúncios. Eles traziam o título e a URL de cada anúncio.

As duas partes iam para dentro das páginas: `__imoveis` e `__listingModels`, inteiros no mapa, e
no tour os que caem no raio (`recorte.py:319–342`). Não havia termo nem autorização registrados.

O que ficou:

- **Anúncios:** 7 anúncios **fictícios**, com o mesmo contrato de dados.
  - O título começa com `[FICTÍCIO]` e a URL é de `example.com` (domínio reservado pela RFC 2606).
  - Cada pino fica no centro de um quarteirão residencial, escolhido por regra fixa em volta do
    centro da cidade, sem usar posição de anúncio. O pino mais próximo de um anúncio antigo fica
    a 436 m dele.
- **Estudos:** o pacote está vazio (`{"version":1,"assets":[]}`), e a ficha esconde o botão de
  estudo 3D.
- **Gerador:** `modelos_cadastrados/gerar_estudos.mjs`, com a geometria de cada casa escrita a
  partir das fotos, e o `testar.mjs` dele saíram do `HEAD`.
- **Trava:** `tests/test_vitrine_ficticia.py` confere o contrato, o marcador `[FICTÍCIO]` e que
  nenhuma URL fora dos domínios reservados apareça nos arquivos da vitrine nem no pacote de
  estudos.
- **Fora da trava:** o extrator de anúncio (`modelos_cadastrados/pipeline/extrair_anuncio.py`)
  continua sabendo ler o `roca.com.br`. Ele é código, e o teste dele usa dados montados à mão.
- **Produção:** o tour do Cedros no ar (build `215965d37d7d`, publicado em 25/09) ainda leva 4
  dos anúncios antigos, os que caem no raio dele, e os 3 estudos 3D que existiam para eles. Conferido
  no `tour.html` do build local. Isso só muda num próximo build e publicação, e produção está
  congelada neste ciclo.

## Imóveis de clientes (plantas fornecidas)

- **Uso atual:** sim, é o produto.
  - `plantas_fornecidas/<id>/unidade.json`: 5 unidades reais e um exemplo.
  - Os modelos em `v1.5/miniaturas/*_blender/`.
- **Chega ao artefato final:**
  - no git: os cadastros, os modelos e as páginas `v1.5/miniaturas/maquete-*.html`;
  - nas páginas: `__unidades` com todas as unidades no mapa, e as do raio no tour
    (`recorte.py:344`); a maquete de cada unidade.
- **Licença:** não é licença de software. O que falta é a **autorização do dono do dado**, e ela
  não está registrada no repositório.
- **Evidência:** `pipeline/build/blocos.py:134–150`, `pipeline/recorte.py:344–368` e
  `pipeline/build_imovel.py:71–86`.

## Geoportal de Ribeirão Preto

- **Uso atual:** **só histórico.**
  - `pipeline/fontes/geoportal_rp.py` e `cadastro_rp.py` servem a Ribeirão Preto, e o escopo atual
    é só São Carlos.
  - Nenhum dado de Ribeirão está versionado; só os JSON de configuração em `padrao/cidades/`.
- **Chega ao artefato final:** nada.
- **Licença:** a API REST é aberta (`geoportal_rp.py:3–8`). O termo de uso não está registrado.

## Bases versionadas: usada ou sobra?

**`lotes_saocarlos.geojson` (raiz, 35,4 MB): sobra com papel de fallback.** Em São Carlos, hoje,
**os bytes dele não chegam a nenhuma página.** Os leitores:

| Leitor | Quando lê |
|---|---|
| `pipeline/consolidar.py:94` | só com `FALLBACK=1` no ambiente, e o padrão é `0` (`:32`) |
| `pipeline/encaixar_casas_lotes.py:44–49` e `modelos_urbanos/v1/integracao/auditar_quarteiroes.py:59` | só quando `lotes` (`lotes_saocarlos_completo.geojson`) **não** existe, e em São Carlos ele existe |

Mesmo assim, o arquivo está na lista de entradas do build (`pipeline/build/manifest.py:25`,
`lotes_visualizacao`). Se ele mudar, muda o `fontes` do manifesto sem mudar a página.

- **Origem:** lotes sintéticos da época do v6. O `city_final.py:5–7` cita o `build_lots_city2`,
  que não está no repositório.
- **Decisão a tomar:** o PR de arquivos grandes decide se o arquivo sai do build ou do git.

**`sao-carlos/dados/lotes_saocarlos_completo.geojson` (62,3 MB): usada.** É a fonte `lotes` das
etapas 5, 6, 6b e 7.

## O que isso deixa em aberto

1. **Crédito nas páginas.** Hoje só o OSM é creditado, no mapa e no tour. As fontes sem crédito
   são o Overture (e as de dentro dele), o SigaSC/OpenPlots, o Sentinel-2 e o open-elevation.
   - Os dados delas chegam à página, na forma derivada. O crédito de cada uma depende do termo que
     ainda não está registrado.
   - Mudar o crédito é mudança do renderizador. Ela muda os manifests e só vai ao ar depois do
     congelamento.
2. **Termos a registrar:**
   - a release e a licença do Overture;
   - os termos do SigaSC/OpenPlots;
   - o termo Copernicus;
   - o termo do open-elevation.
3. **Dados de terceiros e de clientes:** os anúncios da Roca viraram fictícios, e as imagens do
   Mirante 7 saíram (26/09). As plantas fornecidas continuam, classificadas como privadas em
   [dados-privados.md](dados-privados.md), até a política de artefatos.
4. **Sobras com leitor:** o `lotes_saocarlos.geojson` e o `build_pois.py`. Decidir no PR de arquivos
   grandes e no de scripts.
