# T22: desnível lote − rua gravado no lote novo (15/11)
1. **Método** (`novo_lote.desnivel_lote_rua`, o mesmo do `via.py` da T26): cota do DSM no **centroide do lote** menos a **mediana do DSM sobre o asfalto da malha** a até 25 m da **frente principal** (a T26 usava o lote inteiro), amostrado numa grade de 3 m. Mudança: entra também um ponto por pedaço de asfalto, porque a malha é picotada e a grade sozinha pegava só 4 pontos no 22421. Arredondado a 0,1 m. Quando não há asfalto a até 25 m ou o pixel do raster está sem dado, o campo não é gravado. Junto vai `relevo.metodo_desnivel`, dizendo: Copernicus GLO-30, DSM de ~30 m, mede prédio e árvore, só triagem.
2. **Pilotos (não gravei, só o valor que daria):**

| Lote | Desnível (m) |
|---|---:|
| 30516 | −2,4 |
| 37607 | +1,4 |
| 22426 | −1,0 |
| 22421 | −2,4 |
| 25297 | +0,4 |
| Eixo q1382 | +1,3 |
| Z2 75352–75354 | 0,0 |

3. **Subárea:** 74451 −2,1 · **77015 −5,0** · **77022 +5,2** · 77375 −0,6 · 80172 −2,3. Bate com o DSM da T26 (−5,0 e +5,2). O 77375 deu −0,6 aqui e −0,03 na T26, porque agora só conta a rua da frente.
4. **Amostra T20/T21:** dos 214 aceitos, 161 ganham o campo. Os outros 53 ficam sem ele: 41 pela borda de quadra e 12 pela rua do OSM, porque não há asfalto a até 25 m. Desnível: mediana 0,9 m, p90 2,3 m. **26 aceitos (12%) têm |desnível| ≥ 2 m** e vão receber o aviso da T27: 20 com o lote acima da rua e 6 abaixo.
5. **Testes:** caso novo com raster sintético, um plano que sobe 0,1 m por metro, e rua a 2–10 m da frente. Dá +2,1 e, com o plano invertido, −2,1. Asfalto além de 25 m e pixel sem dado não gravam o campo; o 77022 real dá +5,2. Passaram: `novo_lote --testar`, `gerar_lotes --testar`, `test_estudar`, `test_varrer` e `conferir.py` **8/8**. Não toquei em motor, `lotes-piloto.json` nem relatório.
