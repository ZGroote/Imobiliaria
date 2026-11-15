# Tarefa 4 do Terreno: lote novo a partir do cadastro (V1-001)

**Quem:** Codex (Terreno).
**Galho:** `feat/viabilidade-lote` (a central já fez o checkout).
**Onde mexer:** só em `viabilidade/terreno/`. Arquivo novo + testes.
**Não fazer:**
- não commitar;
- não alterar `lotes-piloto.json`, `dados/` nem os scripts existentes; pode importar funções deles;
- não tocar no motor, na tela nem no `conferir.py`.

## Por quê

Hoje o sistema só estuda os 7 lotes-piloto, que foram montados um a um. O usuário quer estudar **qualquer lote de São Carlos**. O motor já aceita `--lote lote.json --zona` (`motor/gerar.py`). Falta transformar um lote do cadastro num lote do contrato.

## O que fazer

`viabilidade/terreno/novo_lote.py`

```
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 30516 --zona SC-Z4 --saida <arquivo.json>
python -I -X utf8 viabilidade/terreno/novo_lote.py --testar
```

### 1. Entrada

- `--base completo|antigo`: as mesmas duas bases de `gerar_lotes.py`.
- `--indices`: um ou mais índices de feição.
  - Vários índices = remembramento.
  - Só aceite se os lotes se tocarem e a união for um polígono só e válido. Senão, erro claro.
- `--zona`: obrigatória.
  - Tem que existir em `viabilidade/lei/zonas.json`. Senão, erro com a lista das zonas válidas.
  - Não adivinhe a zona pelo mapa nesta tarefa.

### 2. Saída: um lote no formato do contrato (veja o `README.md` do módulo e um item de `lotes-piloto.json`)

| Campo | O que gravar |
| --- | --- |
| `poligono_utm` | Em EPSG:31983, pela latitude/longitude do GeoJSON. Nunca pelo `fx`/`fy` (estão em SAD69). |
| `area_m2` | Área do polígono. |
| `frente` | Pela mesma regra do `avaliar()` de `gerar_lotes.py` (malha de ruas `street_tris.json`). Reuse a função, não copie. |
| `relevo` | Do raster Copernicus, pelo mesmo método do `preparar_relevo.py` (bilinear, `resumir`), com o mesmo aviso de precisão em `observacoes`. Reuse as funções. |
| `zona_id`, `zona_origem`, `zona_conferida` | A zona informada, `"informada_pelo_usuario"` e `false`. |
| `conferido` | `false`. |
| `id` | `SC-<base>-<índices unidos por ->`. |
| `fonte` | Base e índices. |

Sobre a frente:
- Se houver mais de uma candidata, use a mesma ordem do `avaliar()`.
- Se o `avaliar()` indicar esquina, registre isso em `observacoes`.
- Se `avaliar()` devolver `None` (sem frente para rua, invade o asfalto ou se sobrepõe ao vizinho), saia com erro dizendo **qual** desses motivos.

Os campos que os pilotos têm e um lote novo não tem (`anotacao_zoneamento`, `categoria` etc.) ficam de fora ou com valor neutro documentado.

### 3. O resultado tem que rodar no motor sem erro

`python -I -X utf8 viabilidade/motor/gerar.py --lote <saida> --zona viabilidade/lei/zonas.json --zona-id <zona> --saida <estudo.json>`

Confira os argumentos reais do `gerar.py`.

### 4. `--testar` (autoteste, sem gravar nada versionado)

1. **Reprodução dos pilotos.** Para os 5 pilotos originais de um lote só (`SC-completo-30516`, `37607`, `22426`, `22421`, `25297`), gerar com a zona deles e comparar com `lotes-piloto.json`:
   - polígono e área: tolerância 1e-6;
   - frente igual;
   - relevo igual (mesma tolerância).
   - Diferenças esperadas, como `zona_origem`, ficam listadas no teste.
2. **Remembramento.** Gerar o `q1382-11984-11988` (índices 11984..11988, base conforme `lotes-piloto.json`) e comparar a área.
3. **Recusas.** Cada uma tem que dar erro com mensagem clara, nunca um lote meio montado:
   - índice inexistente;
   - zona inexistente;
   - índices que não se tocam;
   - um lote sem frente para rua (ache um real e documente o índice).
4. **Motor.** Um lote novo, fora dos pilotos, passa pelo `motor/gerar.py` e sai um estudo com `opcoes` ou com `opcoes_ausentes`.

### 5. Tempo

Meça quanto leva `novo_lote.py` para um lote, sem cache, e anote no relatório. Se carregar as bases demorar mais de ~10 s, diga, mas não otimize ainda.

## Relatório

`viabilidade/terreno/RELATORIO-4.md`, até 12 linhas:
- o que entra e o que sai;
- o resultado do `--testar`;
- o tempo;
- os limites.

Depois: `maestri ask "Claude Code" "Terreno tarefa 4 pronta"`.
