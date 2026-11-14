# Tarefa da frente Auditoria (Auditor/QA)

Você faz parte de um time de IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno em São Carlos-SP. Leia primeiro `viabilidade/README.md` (regras e contrato).

## Seu papel

Revisar de fora o código do Motor (`viabilidade/motor/`) e **tentar quebrar**. O Motor foi escrito por outra IA e testado por ela mesma. Você é o olhar independente.

Já sabemos de um defeito em investigação pelo Motor: na opção D, o recuo AFROUXOU (2,00 → 1,50 m) e o resultado PIOROU (38 → 37 unidades). Afrouxar regra não pode piorar a melhor opção. Procure outros casos assim.

## O que fazer

1. Leia `motor.py`, `gerar.py`, `utm.py` e `test_motor.py`. Rode `python -I viabilidade/motor/test_motor.py`.
2. Monte casos extremos (em arquivos SEUS) e rode o motor com eles (`python -I viabilidade/motor/gerar.py --lote X --zona Y --saida Z`):
   - lote triangular, em L, muito estreito (8 m de frente), minúsculo (150 m²), enorme (20.000 m²);
   - zona sem CA máximo, com TO 100%, altura máxima baixa (9 m), área especial de gabarito;
   - **monotonia:** o mesmo lote com recuo menor, CA maior ou TO maior não pode dar área privativa menor em nenhuma opção;
   - coordenadas: lote perto da borda do fuso UTM, polígono com vértice repetido, sentido horário e anti-horário.
3. Para cada caso: o motor travou? Saiu volume fora do lote ou da caixa? Furou recuo, CA, TO ou altura? O alerta apareceu? O número faz sentido?
4. Leia o código atrás de erro de conta (unidades, área computável, garagem, arredondamento).

## Entrega

Em `viabilidade/auditoria/`:
- `casos/` (os lotes e zonas que você montou, mais as saídas);
- `AUDITORIA.md` (tabela: caso | o que esperava | o que saiu | defeito? | gravidade alta/média/baixa | linha do código).

Termine com a lista de defeitos em ordem de gravidade.

## Regras

- Escreva SÓ em `viabilidade/auditoria/`. NÃO corrija o motor: só aponte. Não commite (a central commita).
- O Motor pode mudar enquanto você trabalha. Antes de fechar, rode de novo os casos que deram defeito.
- Fonte bloqueada: registre em `viabilidade/BLOQUEIOS.md` (regra no README).
- Português do Brasil simples.
- Ao terminar, mande o relatório (até ~20 linhas) com:
  `maestri ask "Claude Code" "<relatório>"`
