# T22 — `varredura.html` conhece o status "divisa" (16/11)

Achado BAIXA da `revisao/REVISAO-11.md`. A T29 fez o `motor/varrer.py` gravar `status = "divisa"` para lote na divisa entre zonas, com `zona = "divisa: SC-Z4 | SC-Z3"` e `estudo_json = lotes/<i>/resumo.txt`. O `visual/varredura.html` não quebra, mas:
- a `#contagem` (linhas ~167-168) só soma estudo, recusa e erro;
- o `#filtro-status` (linha ~45) não tem a opção divisa;
- o `ROTULO` (linha ~61) não tem rótulo para divisa.

Faça os três: rótulo "Na divisa (2 zonas)" ou parecido, a opção no filtro, e a contagem incluindo divisa. Se houver link, aponte para o `resumo.txt`, que tem a comparação. Teste com uma varredura que inclua o 90050 (raio de 15 m, como no `motor/test_varrer.py`), numa pasta temporária. Print de computador e de celular em `visual/evidencias/t22/`. Rode o portão `visual` do `conferir.py`.

Só `visual/varredura.html` e evidências. Não commite. Relato em `visual/RELATORIO-22.md`. Ao terminar: `maestri ask "Claude Code" "Visual tarefa 22 pronta"`.
