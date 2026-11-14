# Viabilidade (Fase 0)

Protótipo isolado: lote + lei → opções de volume em 3D com números.
Pedido de origem: cliente cujo arquiteto leva 1–2 semanas por estudo e precisa de 5–6 até achar um bom.
PRD completo: nota `prd-imobiliaria-3d` no Maestri.

## Regras

- Nada fora de `viabilidade/` é alterado. O resto do projeto só é LIDO (ex.: `lotes_saocarlos.geojson`, `sao-carlos/relevo_wide.json`).
- Cada frente escreve só na sua pasta. Commit só pela central (Claude Code).
- Nada vai pro ar. Nada de Firebase, painel ou deploy.
- Todo número da lei carrega fonte (lei, artigo, anexo, data). Sem fonte = `"conferido": false`.
- Português simples nos textos.

## Frentes

| Pasta | Frente | Entrega |
|---|---|---|
| `lei/` | Zoneamento de São Carlos | `lei/zonas.json` no formato abaixo + `lei/FONTES.md` |
| `terreno/` | Lotes e relevo | `terreno/lotes-piloto.json` + `terreno/RELEVO.md` (fontes e precisão) |
| `motor/` | Caixa máxima e opções | `motor/` em Python, gera `estudo.json` a partir de lote + zona |
| `visual/` | Maquete das opções | `visual/index.html` que abre um `estudo.json` e mostra as opções |
| `produto/` | O que o arquiteto entrega | `produto/ESTUDO-REAL.md` (conteúdo de um estudo de viabilidade de verdade, concorrentes, formato do relatório) |

## Contrato (o que passa entre as frentes)

Coordenadas em metros, SIRGAS 2000 / UTM 23S (EPSG:31983), convertidas da latitude/longitude do polígono do `lotes_saocarlos.geojson`.
**Não usar `fx`/`fy` desse arquivo:** estão em SAD69 / UTM 23S (EPSG:29193), 40–57 m deslocados (achado do Motor, 14/11).

### Zona (`lei/zonas.json`: lista)

```json
{
  "id": "ZONA-EXEMPLO",
  "nome": "Zona de exemplo",
  "parametros": {
    "ca_basico": 1.0,          "ca_maximo": 4.0,
    "taxa_ocupacao": 0.7,       "taxa_permeabilidade": 0.15,
    "recuo_frontal_m": 4.0,     "recuo_lateral_m": 1.5,  "recuo_fundos_m": 1.5,
    "recuo_lateral_regra": "texto quando depende da altura, ex.: H/6 com mínimo de 1,5 m",
    "altura_max_m": null,       "pavimentos_max": null
  },
  "fontes": [{ "lei": "Lei nº ...", "artigo": "art. ..., Anexo ...", "url": "...", "data": "AAAA-MM-DD" }],
  "conferido": false,
  "observacoes": "o que ficou de fora ou é ambíguo"
}
```

Parâmetro que a lei não define: `null`. Parâmetro que não achamos: ausente + citado em `observacoes`.

### Lote (`terreno/lotes-piloto.json`: lista)

```json
{
  "id": "SC-lid-12345",
  "lid": 12345,
  "poligono_utm": [[201424.0, 7576599.3], "..."],
  "frente": [[x1, y1], [x2, y2]],
  "area_m2": 0,
  "zona_id": "ZONA-EXEMPLO",
  "relevo": { "fonte": "...", "resolucao_m": 30, "cota_min_m": 0, "cota_max_m": 0, "declividade_pct": 0 },
  "observacoes": ""
}
```

### Estudo (`motor` gera, `visual` lê)

```json
{
  "versao_motor": "0.1.0",
  "lote": { "...": "o objeto Lote acima" },
  "zona": { "...": "o objeto Zona acima" },
  "premissas": {
    "pe_direito_m": 3.0, "pe_direito_terreo_m": 4.5,
    "area_privativa_por_unidade_m2": 60,
    "eficiencia": 0.8,
    "area_comum_por_pavimento_m2": 40,
    "vagas_por_unidade": 1, "area_por_vaga_m2": 27,
    "garagem": "subsolo", "subsolos_max": 2, "garagem_computavel": false,
    "preco_venda_m2_privativo": null,
    "padrao": ["lista dos nomes de premissa que vieram do padrão do motor, não do cliente"]
  },
  "caixa_maxima": { "projecao_utm": [[x, y], "..."], "altura_m": 0 },
  "opcoes": [
    {
      "id": "A",
      "nome": "Torre única",
      "volumes": [{ "base_utm": [[x, y], "..."], "z0_m": 0, "altura_m": 0, "pavimentos": 0, "uso": "residencial" }],
      "metricas": {
        "area_construida_m2": 0, "area_computavel_m2": 0, "area_nao_computavel_m2": 0,
        "area_privativa_m2": 0, "area_acima_ca_basico_m2": 0,
        "area_garagem_m2": 0, "vagas": 0, "area_permeavel_m2": 0,
        "ca_usado": 0, "to_usada": 0, "pavimentos": 0, "unidades_estimadas": 0,
        "vgv_estimado": null
      },
      "alertas": ["texto de cada regra violada ou no limite"]
    }
  ],
  "incertezas": ["dado que faltou ou é estimativa"]
}
```

Definições (v2 do contrato, 14/11, a partir de `produto/ESTUDO-REAL.md`):

- `eficiencia` = área privativa ÷ área construída (sem garagem).
- `area_acima_ca_basico_m2` = o que passa do CA básico e exige outorga onerosa.
- `vgv_estimado` = `area_privativa_m2` × `preco_venda_m2_privativo`. Fica `null` se o preço não for informado. CUB, TIR e permuta ficam fora da Fase 0.
- Premissa sem fonte (ex.: `pe_direito_terreo_m`, `area_comum_por_pavimento_m2`) entra com o nome em `premissas.padrao` e aparece no relatório como "padrão".
- Vagas: se a zona trouxer regra de vagas (frente Lei), a lei manda; senão vale `vagas_por_unidade`.
