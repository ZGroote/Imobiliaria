# Revisão 11 — galho `viabilidade/duas-zonas` (16/11)

Revise os commits `bdc5e3e4` (Terreno T23), `d667bd9b` (Visual T21) e `bb6bd246` (Motor T29) contra `origin/viabilidade/pos-124`. Relatos: `terreno/RELATORIO-23.md`, `visual/RELATORIO-21.md`, `motor/RELATORIO-29.md`.

Procure principalmente:
1. **Estudo que finge certeza:** algum caminho em que um lote na divisa sai com uma zona só, sem o alerta "confirmar a zona na Prefeitura", ou com `zona_conferida` verdadeiro; `--zona auto:SC-Zx` aceitando zona fora das candidatas ou lote sem dúvida.
2. **Candidata falsa ou perdida:** o filtro de mancha 3×3 px pode apagar zona real estreita? Cor não zonal nunca vira candidata?
3. **Gravação:** falha no meio do estudo de duas zonas deixa pasta pela metade? `--pasta` existente é respeitada como antes?
4. **Relatório:** a caixa "Alertas que valem para todas as opções" pode esconder um alerta que só vale para parte das opções? Algum alerta some do HTML (o teste procura cada alerta inteiro)?
5. **`varrer`:** linha `divisa` quebra algum consumidor do `RESUMO.md`/CSV?
6. Lote aceito, com zona informada e pilotos iguais byte a byte (rode `conferir.py`).

Achados em `revisao/REVISAO-11.md` (ALTA/MÉDIA/BAIXA, com arquivo:linha e como reproduzir; "sem achados" se for o caso). Não conserte nada e não commite. O Terreno está mexendo em `terreno/sugerir_zona.py` (T24): revise o que está commitado, não o solto. Ao terminar: `maestri ask "Claude Code" "Revisor tarefa 11 pronta"`.
