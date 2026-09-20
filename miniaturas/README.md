# miniaturas

A maquete do imóvel: a miniatura 3D que fica junto da ficha, e as três leituras que
saem dela — planta 2D, planta 3D e visita em primeira pessoa.

Feito entre 19 e 20/09/2026. O registro de engenharia (o porquê de cada decisão, e os
defeitos que custaram caro) está na **seção 26 do [PIPELINE.md](../PIPELINE.md)**.

---

## Abrir agora, sem instalar nada

```
miniaturas/maquete.html
```

Duplo clique. São 740 KB com o three.js embutido — não depende de rede, de servidor
nem de build. É a página que está publicada em
`https://claude.ai/artifact/JSqvSPTHCibgdGMVdtd3hx`.

**Este HTML é saída, não fonte.** Quem o escreve é o `pagina_maquete.py`; editar o
HTML na mão é trabalho que a próxima montagem apaga.

---

## O que tem aqui

| arquivo | o que é |
|---|---|
| `pagina_maquete.py` | **o montador da página.** Escreve o HTML inteiro — dado, CSS e programa. Trocar de imóvel é trocar o dicionário `IMOVEL`, no topo do arquivo. |
| `maquete.html` | a página montada, pronta pra abrir. |
| `demo_v18.py` | monta o RENDERIZADOR (`renderizador-v18/`) com um prédio e uma planta sintéticos, pra conferir as três etapas sem o acervo da cidade. |
| `demo_v17.py` | o mesmo pro `renderizador-v17/`. |
| `testa_etapas.py` | portão headless de 7 sondas sobre as três etapas do v17/v18. Roda contra a página montada do acervo de verdade. |

```bash
python miniaturas/pagina_maquete.py                 # -> v18/maquete.html
python miniaturas/pagina_maquete.py --saida x.html

python miniaturas/demo_v18.py --abre planta         # abre direto na etapa 3
MAPA_V=v18 python miniaturas/testa_etapas.py sao-carlos --unidade <id>
```

---

## O que NÃO está aqui, e por quê

Os renderizadores continuam em **`renderizador-v17/`** e **`renderizador-v18/`**, na
raiz. Não é desleixo: `pipeline/montar.py` acha a variante por
`FONTE = renderizador-<MAPA_V>`, e mover as pastas quebraria a montagem de todas as
cidades. A convenção de nome é a mesma desde o `renderizador-v16`.

- `renderizador-v17/` — as três etapas (mapa, interior, planta) e a planta 3D em cena
  própria.
- `renderizador-v18/` — a maquete como fio condutor: ela nasce sobre a ficha, pisca o
  pavimento da unidade em verde e cresce até a tela pra entregar a visita ou a planta.

`firebase.v17.json` também fica na raiz, porque o `public:` de um config do Firebase é
relativo à pasta do próprio arquivo.

---

## Quatro defeitos que esta pasta existe pra não repetir

Todos custaram uma ida e volta, e **nenhum deles dá erro no console**. Estão em detalhe
no PIPELINE.md; o resumo, porque a mesma armadilha reaparece em qualquer cena 3D nova:

1. **Câmera de sombra que não cabe no objeto não deixa sombra errada — deixa o objeto
   PRETO.** Nos ±5 m do padrão do three, todo fragmento fora da caixa da luz é
   amostrado fora do mapa, e isso lê como sombra total.
2. **`metalness` sem mapa de ambiente também é preto.** Vidro não é pintado pela luz, é
   pelo que reflete. Como a página abre com duplo clique, o céu é gerado: um degradê
   equirretangular de 64×32 passado pelo PMREM.
3. **`hidden` é propriedade de `HTMLElement`, e `<svg>` não é um.** `svg.hidden = false`
   cria uma propriedade solta que depois *lê* como `false`, mas o atributo do markup
   fica, e `[hidden]{display:none!important}` continua valendo.
4. **Canvas sem tamanho de CSS é exibido no tamanho do BUFFER.** Num monitor de dpr 1
   os dois números coincidem e não se vê nada; num celular de dpr 1,75 a maquete sai
   75% maior que o painel. Por isso `ren.setSize(w, h)` atualiza o estilo, e por isso o
   montador **reprova a saída** se sobrar marcador de formatação (`%%`, `%(...)s`,
   `@@...@@`) — foi um `width:100%%` inválido que produziu esse caso.

E uma armadilha de MEDIÇÃO, não de código: em Chrome headless o relógio de animação
congela junto com o rAF. Transição de CSS fica presa em `running` e o print mostra o
valor inicial; `readPixels` fora do rAF devolve um buffer já apagado. Para fotografar o
estado de verdade: `*{transition:none!important}` antes, e desenhar por
`window.__maq.quadro(t)` com relógio crescente — e não chamando `render` direto, senão
o que o laço DECIDE (a câmera da visita, o passo de caminhada) nunca roda.
