# Tarefa 23 do Terreno: lote na divisa vira "zona candidata" em vez de recusa (parte 1 de 2)

**Galho:** `viabilidade/duas-zonas` (sai do `viabilidade/pos-124`; o PR #125 continua separado).
**Onde mexer:** só `viabilidade/terreno/`.
**Não fazer:** não commitar; não tocar em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`.

## Por quê
No sorteio de 500 lotes (T20/T21), 137 são recusados por **zona incerta**, e a maior parte é "divisa a menos de 10 m". Hoje o `estudar.py` (motor) recusa e pede `--zona`. O plano é gerar **um estudo por zona candidata, lado a lado**, com o aviso "confirmar a zona na Prefeitura". O Motor faz isso na T29, mas precisa que o terreno diga, de forma estruturada, quando a dúvida é **só** a divisa.

## O que fazer
1. **Em `sugerir_zona.py`:** quando a única razão da dúvida for "Divisa/cor não zonal a menos de 10 m" (cor do polígono de uma zona só, cor segura, dentro do Anexo 02, sem eixo), grave em `ZonaIncerta.sugestao`:
   - `so_divisa: True`;
   - `candidatas`: a zona do polígono primeiro, depois as vizinhas válidas a até 10 m (só SC-Z1..Z6 da legenda), sem repetir.
   Qualquer outra razão (cor ambígua, várias zonas no polígono, fora do Anexo 02, eixo, cor não zonal como campus ou branco) dá `so_divisa: False` e continua como hoje.
   - **Atenção:** se a "cor vizinha" for não zonal (branco, campus, área especial sem zona), ela não vira candidata. Se sobrar só 1 candidata, `so_divisa` fica `False`: não há segunda zona para comparar.
2. **Em `novo_lote.py`:** deixe `Cadastro.gerar` aceitar uma zona candidata dessa lista com `zona_origem: "candidata_na_divisa"`, guardando a `zona_sugestao` inteira (com `candidatas` e `distancia_divisa_m`). Escolha a forma mais simples, por exemplo um parâmetro `candidata=True` ou a zona `"auto:SC-Z2"`, e documente em uma linha no `LOTES.md`. Zona fora das candidatas: erro.
3. **Nada muda** para lote aceito pela zona automática nem para lote com zona informada: mesmo JSON, byte a byte. Os pilotos também não mudam.

## Números
No sorteio de 500 (semente 20261120, mesmo do RELATORIO-21): quantos dos 137 "zona incerta" ficam `so_divisa: True` com 2 ou mais candidatas? Quantos têm 3? Abra 5 na foto ou no Anexo 02: as candidatas fazem sentido?

## Testes
`novo_lote --testar`, `gerar_lotes --testar`, `test_sugerir_zona.py`, `test_ponto.py`, `conferir.py` 8/8. Casos novos:
- um lote real `so_divisa` com 2 candidatas;
- um lote com cor ambígua (`so_divisa: False`);
- gerar com zona candidata dá `zona_origem` certo;
- gerar com zona fora da lista dá erro.

Relatório: `viabilidade/terreno/RELATORIO-23.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 23 pronta"`.
