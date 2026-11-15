# Tarefa 13 do Terreno: silêncio por anexo e leis posteriores aos mapas (AUDITORIA-6b)

**Quem:** Claude Code (Motor), emprestado ao terreno. O Terreno está na tarefa 12 em `novo_lote.py`, `gerar_lotes.py` e `test_novo_lote.py`: **não mexa nesses três**.
**Galho:** `viabilidade/lote-livre` (PR #124).
**Onde mexer:** só `viabilidade/terreno/areas_especiais.py` e um teste novo `viabilidade/terreno/test_areas_especiais.py`.
**Não fazer:** não commitar; não tocar em motor, tela, relatório, `conferir.py` nem `dados/`.

## Por quê

Leia `viabilidade/auditoria/AUDITORIA-6b.md`. A central conferiu os dois achados:

1. Em `AreasEspeciais.ler()` (`areas_especiais.py`), a ressalva "nada encontrado" só sai quando os **três** anexos (05, 06 e 07) voltam vazios. Se o 07 (cone do aeroporto) acusa, o 06 vazio some sem ressalva. Exemplo do Auditor: `-21.985132, -47.885094` sai só com `gabarito_aeronautico`.
2. Os mapas são de dez/2016. Duas leis posteriores mudam o que eles mostram e **não estão desenhadas**:
   - Lei 19.166/2019: AEI 44 e 45 (Interesse Industrial e de Serviços) no Anexo 6, áreas N e O no Anexo 9-A, ZUPI-II, na SP-318 km 236. O perímetro só existe em texto, sem coordenadas.
   - Lei 18.927/2018: Zona 6E (Santa Eudóxia), sem mapa. Hoje o lote lá é recusado, e isso está certo.

## O que fazer

1. **Ressalva por anexo.** Cada anexo lido que não achar nada no lote gera o seu próprio registro `nao_verificada` com "nenhuma encontrada — não conferida", mesmo quando outro anexo acusou algo. Não mude o texto nem o status do caso em que tudo volta vazio além do necessário. Se for mais simples, troque o registro único "05/06/07" por um registro por anexo e diga isso no relatório.
2. **Leis posteriores aos mapas.** Todo lote ganha um registro fixo `nao_verificada` dizendo que os mapas são de dez/2016 e que estas alterações não estão desenhadas:
   - Lei 19.166/2019: AEI 44/45, áreas N/O do Anexo 9-A, SP-318 km 236, só em texto;
   - Lei 18.927/2018: Zona 6E.
   Com os links oficiais que estão no `AUDITORIA-6b.md`. **Não invente polígono nem raio** para a SP-318 km 236: o perímetro não tem coordenadas.
3. **Anexo 9-A** (usos incômodos) não é lido por nenhum módulo: cite no mesmo registro que ele não é verificado.
4. **Testes** em `test_areas_especiais.py` (novo, roda sozinho com `python -I -X utf8`):
   - o ponto do Auditor sai com o alerta do 07 **e** com a ressalva do 06;
   - um lote qualquer traz o registro das leis posteriores;
   - os pilotos continuam como antes, fora os registros novos (liste no teste o que muda).
5. Rode `novo_lote.py --testar`, `motor/test_estudar.py` e `motor/test_varrer.py`. Se a mudança mexer em saída que o motor compara byte a byte, diga onde e por quê; não altere o motor.

## Relatório

`viabilidade/terreno/RELATORIO-13.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Motor: terreno tarefa 13 pronta"`.
