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
- **Fonte bloqueada** (login, erro 403/404, captcha, servidor que recusa, arquivo só em imagem etc.): não insista e não contorne. Registre em `viabilidade/BLOQUEIOS.md` (cada frente acrescenta linhas, nunca apaga) com:
  - o endereço;
  - o tipo de bloqueio;
  - a informação que ficou pendente de verificação;
  - o que você fez em seguida: **achou fonte oficial alternativa acessível** (dê o endereço) ou **encaminhou pra conferência humana**.

  Todo dado que dependia da fonte bloqueada fica `"conferido": false` até ser resolvido.

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
- Vagas: se a zona trouxer regra de vagas (frente Lei), a lei manda; senão vale `vagas_por_unidade`. Em São Carlos prédio residencial não tem vaga mínima (COE Tabela 1): `vagas_por_unidade` é premissa do cliente.

v3 (14/11, a partir de `lei/FONTES.md`):

- **Recuo frontal `null`** (São Carlos não define na lei). O motor usa `premissas.recuo_frontal_m` (padrão 4,0, marcado em `padrao`) e avisa "vale a restrição do loteamento".
- **Recuo que muda com a altura:** a Zona pode trazer `recuo_lateral_por_altura` = `{"ate_pavimento": 1, "recuo_m": 1.5, "acima": {"fracao_h": 0.125, "minimo_m": 2.0}}`, mais `parede_cega_encosta_ate_m`: 12. Ou seja: recuo de 1,5 m até o 1º pavimento; acima dele, o maior entre h/8 e 2,0 m. O motor escalona o volume (embasamento + torre) ou usa o recuo do topo no prédio todo, e diz qual dos dois fez.
- A mesma regra por altura vale pros **fundos** (o art. 67 fala da divisa, que inclui os fundos; a frente é alinhamento e fica fora).
- No Estudo: cada volume traz `recuo_lateral_m` e `recuo_fundos_m` usados; `caixa_maxima` traz `recuo_frontal_m` e `degraus` (lista de `{z0_m, altura_m, projecao_utm}` quando a caixa escalona com a altura).
- **`areas_especiais`** (lista no Lote, não na Zona): restrição por cima da zona, como `{"tipo": "gabarito", "altura_max_m": 9, "fonte": "..."}` (centro histórico) ou o cone do Observatório da USP. A frente Terreno preenche nos lotes-piloto.
- **De onde veio a zona do lote** (v4): o Lote traz `zona_origem` = `"oficial"` (mapa digital oficial), `"anotada_a_mao"` (lida no anexo em PDF) ou `"teste"` (escolhida só pra testar), e `zona_conferida` (true/false). `zona.conferido` diz se os NÚMEROS da zona foram conferidos na lei. É outra coisa. O aviso da página tem que separar os dois: "números da zona conferidos" ≠ "o terreno está nessa zona".
- **Não computável:** garagem, escada, elevador/shaft, casa de máquinas, reservatório, lixo e área técnica não contam no CA nem na TO (COE art. 51). Varanda conta até prova em contrário.
- **Acesso a dado público:** só o que a fonte oferece abertamente. Nada de forçar parâmetro de URL, burlar bloqueio ou contornar login.
