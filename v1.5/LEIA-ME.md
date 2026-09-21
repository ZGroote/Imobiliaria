# v1.5

O que saiu da **modularização** e a função nova das **miniaturas**, reunidos numa pasta
só. Antes de 21/09/2026 isso estava espalhado por quatro diretórios na raiz.

```
v1.5/
  renderizador-v16-moveis/   o renderizador modular: 80 módulos no lugar de um app.js
  renderizador-v17/          as três etapas (mapa, interior, planta) e a planta 3D
  renderizador-v18/          a maquete como fio condutor da ficha até a visita
  miniaturas/                o montador da maquete, os demos e o portão de 7 sondas
```

## Isto é FONTE, não pacote

**A pasta não abre nada sozinha, e não dá pra fazer com que abra.** Vale escrever por
extenso, porque a pergunta volta:

| o que falta aqui | tamanho | por que não pode vir junto |
|---|---|---|
| `pipeline/` (`montar.py` + `build/`) | 1,6 MB | é quem monta a página, e os mesmos arquivos servem o v15 e as outras cidades |
| `sao-carlos/`, `moveis/`, `arvores/`, `texturas/`, `padrao/` | ~200 MB | é o **dado**. 98% do peso, compartilhado entre cidades |
| `tests/` | 66 arquivos | são o aceite da modularização; ficam junto dos outros 45 |
| `renderizador/` (v15) | 1,4 MB | é o monólito de ONDE as peças foram extraídas — não é resultado, é origem |

Estes 1,6 MB de código só viram página quando o `pipeline/` lê ~200 MB de dado. O que
**consegue** ser autossuficiente é a saída: `releases/<versão>/`, que abre com duplo
clique e não depende de nada.

## Como montar

```bash
npm run montar                 # python pipeline/montar.py sao-carlos --variante v16-moveis
npm test                       # 111 sondas Node dos módulos
npm run test:py                # 43 testes Python (build, caminhos, publicação)
python v1.5/miniaturas/pagina_maquete.py
```

`MAPA_V` continua sendo `v16-moveis`: o nome da variante é a chave de **saída**
(`v16-moveis/sao-carlos-v16-moveis-aberto.html`), e mudá-lo renomearia os artefatos
publicados. O que mudou foi só onde a fonte mora — uma linha em
[`pipeline/build/config.py`](../pipeline/build/config.py).

## O que foi conferido na mudança de lugar

A página montada a partir daqui é **idêntica peça a peça** à publicada antes do move
(`python pipeline/montar.py sao-carlos --variante v16-moveis --conferir
v16-moveis/sao-carlos-v16-moveis-aberto.html`): 32,91 MB, 50.277 encaixes com o cache
validado, só espaço em branco entre blocos de topo mudou. Os 43 testes Python passam.
As 11 falhas do `npm test` são anteriores ao move — foram reproduzidas no caminho
antigo com as mesmas fontes, e vêm do trabalho em curso nas três etapas.
