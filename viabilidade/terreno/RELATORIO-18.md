# Terreno, tarefa 18: pilotos reconferidos com a afim de 21 cruzamentos (nenhuma zona errada)
| Piloto | Zona anotada | Confere no lugar novo | Divisa antes → depois (m, `sugerir`, conservadora) | Observação (desloc. 43–66 m p/ leste-norte; áreas especiais pela leitura automática nova) |
|---|---|---|---|---|
| 30516 | Z4 | sim | nenhuma a 250 m → nenhuma | AIA (05) continua, agora na borda (29 de 164 px do lote); AEIS 21 (06) ficou mais longe |
| 37607 | Z4 | sim | nenhuma → nenhuma | Continua dentro da AEI industrial 42 (06) |
| 22426 | Z1 | sim | 29,7 → 3,7 (cor não zonal; mancha Z2 70 → 52) | Traço do Eixo (Maffei) 19 → 2 m; gabarito aeronáutico (07) continua |
| 22421 | Z1 | sim | 0,0 → 12,9 (mancha Z2 0,7 → 44,5) | A dúvida Z1/Z2 quase sumiu; Eixo 20 → 3 m; gabarito aeronáutico (07) continua |
| 25297 | Z1 | sim | 50,8 → 71,4 (Z3) | Sem área especial nos dois |
| q1382 | EIXO | sim | não se aplica (traço do Eixo a 0 m nos dois) | Fundo Z2 (89–97%); gabarito aeronáutico (07) continua |
| 75352 | Z2 | sim | 24,4 → 9,2 (o texto "BOTELHO"; outra zona: 209 m → >250 m) | Sem área especial nos dois |
**Bloqueio, `lotes-piloto.json` não foi mexido:** o `conferir.py` roda `testar_pilotos.py --reproduzir`, que refaz o arquivo a partir de `dados/zonas-anotar.py` e compara byte a byte, e confere o SHA256 (`ORIGINAIS`) dos 5 pilotos originais. Trocar o `metodo` exige mexer em `dados/` e no teste, o que esta tarefa proíbe. Proposta: o texto de reconferência (o exemplo da tarefa) entra pelo `dados/zonas-anotar.py`, com os `ORIGINAIS` recalculados. Por isso `motor/exemplos/pilotos/*.json` também não mudam, e não há o que regenerar.
**Feito:** "3,53 m" e os erros de 05/06/07 trocados pela afim nova (2,9/6,2; 2,9/6,1; 2,9/6,1; 3,2/6,2; verificação ≤ 6,8 m; antigo 40–100 m) em `PACOTE-ARQUITETO.md` (P01, P04, nota geral, bloqueio) e `pacote-arquiteto.json` (P01, P04). `lei/FONTES.md`: o 02ABC agora é só verificação, e o controle são os 21 cruzamentos. `ZONAS.md:33` guarda a tabela antiga, que a T17 já marcou como histórica. Testes: `novo_lote.py --testar`, `test_estudar.py` e `conferir.py` (8/8) saem com exit 0. Recortes (vermelho = antigo, verde = novo) em `scratchpad/t18/*-0{2,5,6,7}.png`.
