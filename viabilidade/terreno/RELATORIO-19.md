# Terreno, tarefa 19: reconferência gravada nas anotações (opção 2 da central)
**Feito:** `dados/zonas-anotar.py` grava `reconferencia` nos 7 pilotos de `dados/anotacoes-zonas.json`. O campo traz data 2026-11-15, método novo (RMSE 2,9 m e máximo 6,2 m, de `zonas-posicionamento.json` → `02.afim_31983`), `zona_confirmada`, distância à divisa antes/depois (T18), observação e fonte `terreno/RELATORIO-18.md`. O `metodo` original não mudou.
**Ajuste da opção 2:** `preparar_zonas.py` agora inclui `"reconferencia"` na lista de chaves que não são copiadas para o lote. Por isso `lotes-piloto.json`, os exemplos do motor e a linha de base do `test_8b` ficaram iguais ao HEAD. O hash do `testar_pilotos.py` também ficou como era (`ORIGINAIS` sem mudança).
**Teste novo em `testar_pilotos.py`:** confere que, nos 7, `anotacoes-zonas.json` tem `reconferencia.zona_confirmada` igual à `zona_id` do lote, com data 2026-11-15. Confere também que o campo não chegou a `lote.anotacao_zoneamento`.
**Aceite:**
- `python -I viabilidade/terreno/testar_pilotos.py` passou, com e sem `--reproduzir`. A reprodução manteve os sete JSONs iguais byte a byte, os três tolerantes dentro de 1e-6 e o PNG idêntico.
- `test_estudar.py` saiu com exit 0.
- `python -I -X utf8 viabilidade/conferir.py` deu **8/8**, motor incluído.
