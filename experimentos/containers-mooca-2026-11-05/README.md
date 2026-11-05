# Moradia estudantil em containers (Mooca) — terceiro empreendimento no molde do Laranjeiras

Branch `feat/containers-mooca`. Fonte única: o caderno do TCC de Tamires Ruffino (Escola da Cidade, 2025),
em `plantas_fornecidas/containers-mooca/` (ficha, páginas e o que falta no `LEIA-ME.md`). O caderno só
autoriza o uso para estudo e pesquisa, com a fonte citada: publicar exige o OK da autora.

Ordem, a mesma do Laranjeiras: plantas → implantação → modelo externo → luz do exterior + visualizador →
cadastro dos dormitórios → página → interiores e luz por hora → mapa 2D da Mooca → pacote.

## Plantas (feito)

Os cinco dormitórios do caderno foram traçados pela API real do construtor de plantas do painel.
`interiores/construir.ts` e `interiores/exportar.py` são cópias dos do Laranjeiras; os pontos ficam em
`interiores/<tipo>/planta.json`, em pixels da imagem original do caderno.

```
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts individual
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts individual-pne
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts casal
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts quadruplo
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts casal-bebe
```

Os cinco saem `PASS` em `conferencia.jpg`/`conferencia.json`: todo móvel fica dentro de um cômodo, e
nenhum se sobrepõe a outro.

| Tipo | Container | Área | Aluguel | Cômodos / portas / janelas / móveis |
|---|---|---|---|---|
| individual | 6 m | 14,8 m² | R$ 500 | 2 / 2 / 2 / 8 |
| individual-pne | 6 m | 14,8 m² | R$ 500 | 2 / 2 / 2 / 6 |
| casal | 6 m | 14,8 m² | R$ 800 | 2 / 2 / 2 / 8 |
| quadruplo | 12 m | 29,7 m² | R$ 1.000 | 2 / 2 / 2 / 10 |
| casal-bebe | 12 m | 29,7 m² | R$ 900 | 3 / 3 / 2 / 9 |

Como cada coisa foi aproximada:

- **Escala:** as plantas são 1:50, mas sem cotas. O contorno externo do container foi igualado à área
  do container marítimo: 6,058 × 2,438 m = 14,8 m² e 12,192 × 2,438 m = 29,7 m². São os dois números
  do caderno.
- **Pé-direito:** 2,35 m. O corte dá 2,69 m de piso a piso (container de 2,59 m mais a laje).
- **Catálogo:** o construtor não tem beliche, banheira nem berço. O beliche virou cama de solteiro (a
  ficha diz 4 moradores), a banheira virou box e o berço virou uma cama de solteiro pequena.
- **Quádruplo:** quarto e estudo são um cômodo só, porque a divisória do meio não chega à bancada.
- **Esquadrias:** lidas no desenho quando aparecem (portas do PNE, do casal e dos 12 m, vidros do lado
  comprido). No individual, a porta e a janela são aproximadas.
- **Prédio declarado:** 45 × 40 m e 2 pavimentos, que é a pegada do conjunto. O pipeline exige um prédio,
  e o container não serve como prédio.
- O desenho preto da folha dos dormitórios 6 m (dois vasos, quatro lavatórios, copa e dois armários)
  não é um dos cinco tipos do caderno e ficou de fora.
