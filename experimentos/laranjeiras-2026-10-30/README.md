# Parque das Laranjeiras — segundo prédio no molde do LIV

Branch `feat/predio-novo`. Fonte única: o book da ADN (`plantas_fornecidas/parque-das-laranjeiras/`).

## Plantas (feito)

As quatro plantas do book foram traçadas pela API real do construtor de plantas do painel, pelo mesmo
caminho do Meio do LIV (`liv-experimental-2026-10-14/interiores/meio/construir-meio.ts`). A diferença é
que os pontos ficam em `interiores/<tipologia>/planta.json`, e um script só serve para todas:

```
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts canto
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts meio
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts terreo-canto
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts terreo-meio
```

Cada um grava `leitura.json`, `projeto-planta.json`, `moveis.json`, `contexto.json`, `referencia.json`,
`unidade.json` (o arquivo que o interior do LIV lê) e `conferencia.jpg` / `conferencia.json`: contornos,
vãos e móveis desenhados por cima da imagem do book. As quatro saem `PASS`, ou seja, todo móvel fica
dentro de um cômodo e nenhum se sobrepõe a outro, fora as cadeiras sob a mesa.

| Planta | Área do book | Escala da imagem | Cômodos / portas / janelas / móveis |
|---|---|---|---|
| canto | 39,12 m² | 184,2 px/m | 5 / 5 / 4 / 23 |
| meio | até 40,79 m² | 159,1 px/m | 5 / 5 / 4 / 22 |
| terreo-canto | 60,11 m² | herda o canto | igual ao canto + jardim em L de 22,4 m² |
| terreo-meio | até 54,17 m² | herda o meio | igual ao meio + jardim de 14,5 m² |

Como cada coisa foi aproximada:

- **Escala:** a planta é humanizada e não tem cota. A área das faces internas do contorno foi igualada
  à do book. Vaso e cooktop conferem a escala (184–188 px/m no canto, 157–172 no meio).
- **Térreo:** é o apartamento do tipo. As paredes pretas das duas imagens coincidem
  (`terreo-*/comparacao-tipo.png`). O jardim fica em `referencia.json` como polígono em metros, para a
  maquete externa, e não vira cômodo, porque cômodo ganha parede de 2,60 m.
- **Portas e janelas:** lidas no desenho (folha fechada com maçaneta, rasgo na parede preta). A largura
  sai da imagem; a altura segue o padrão do LIV.
- **Móveis:** do catálogo do construtor, no lugar e na medida do desenho. Os guarda-roupas seguem o book
  ("até 1,50 m"). A churrasqueira e a bancada comprida do meio ficaram de fora, porque o catálogo não tem.

## Próximos passos

Implantação em metros e posição no mapa de São Carlos; torres por fora com os 312 apartamentos;
interiores no visualizador do LIV; luz gravada por hora; celular e publicação em endereço de teste.
