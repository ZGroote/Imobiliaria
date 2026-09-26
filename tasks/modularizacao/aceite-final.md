# Aceite final da modularização — São Carlos, 18/09/2026

> **Registro histórico.** Aceite que encerrou a modularização em 18/09/2026; não é mantido. Estado atual: [DOCUMENTACAO.md](../../DOCUMENTACAO.md).

Cada linha abaixo foi **medida**, não declarada. O critério da própria tarefa 30 é que
*ausência de medição não conta como sucesso*, então o que não foi medido está marcado
como não medido, e o que falhou está marcado como falha.

Escopo: **São Carlos, variante `v16-moveis`**. As outras cidades estão fora de escopo —
são a única cidade na versão recente do renderizador.

## Os seis critérios do plano

| critério | medida | veredito |
|---|---|---|
| `app.js` só compõe módulos | 2.793 linhas (era 10.603); 71 módulos somando 12.339 linhas; `app.js` é **18,5%** do JS | **ok** |
| Módulos sem ciclo | 69 globais registrados; **nenhum módulo cita global de módulo que nasce depois dele** | **ok** |
| Build, QA e publicação concordam | montar → `sao-carlos-v16-moveis-aberto.html`; QA → `cidade=sao-carlos variante=v16-moveis`; publicar aceita `--variante` e confere tiles | **ok** |
| Fluxos e limites do `PADRAO.md`, incl. `file://` | **19 portões, 0 reprovados, 0 não medidos**; `abre em file:// (duplo clique)`: 1 de 1 página pronta | **ok** |
| Scripts antigos têm caminho canônico | duplicata textual em código: **2**, e as duas são `three.min.js`/`earcut.min.js`, biblioteca de terceiros entre pastas de variante | **ok** |
| Artefatos e persistência preservados | as **duas** páginas de 18/09 17:29, com `sombra_projetada` e o mesmo carimbo; publicado servido por HTTP com **1.027.020 vértices de quintal** e zero CORS barrado | **ok** |

## A falha que havia, e como ela fechou

A página comprimida era de 14/09 — sem `sombra_projetada` e sem os módulos —, enquanto a
aberta já era de hoje. Como `pipeline/publicar.py` parte da comprimida, **publicar
publicava a página de 14/09**; testei, vi os 13,96 MB, removi o artefato e devolvi o
`index.html` ao de 11/09.

Remontado em 18/09 17:29. As duas páginas agora carregam a chave e o **mesmo carimbo**
(`sao-carlos / v16-moveis / 2026-09-18 17:29`).

**A remontagem levou 3,3 s, não os ~11 min previstos.** O custo do cache de encaixe é de
UMA vez: a montagem logo após promover a chave pagou 11m28 (o hash inclui `cid._d`
inteiro, então uma chave de aparência que não move um lote invalida tudo), e a seguinte
já achou o cache válido. Promover atrapalha uma vez, não o ciclo curto.

**O mapa publicado foi testado servido por HTTP**, que é como o Firebase serve — e não
por `file://`, que é como todas as outras sondas abrem a página. Medido:

| | file:// | HTTP |
|---|---|---|
| fetch barrado por CORS | dezenas | **0** |
| malha de quintal | ausente | **1.027.020 vértices** |
| avisos de quintal no console | contínuos | **0** |

São os 64.769 lotes de quintal que não existiam em nenhuma página aberta por duplo
clique. Ver `[[mapa-3d-quintais-tiles-externos]]`.

**Os 19 portões foram rodados de novo no artefato exato** que está publicado (17:29), e
não só no build anterior: 19 portões, 0 reprovados, 0 não medidos, 837 s.

## O que os portões mediram hoje

19 portões, 1.395 s. Os 10 de geometria vieram com valores **idênticos ao relatório de
14/09**, dígito a dígito — a modularização não moveu um polígono. Os 9 de comportamento
passaram todos, inclusive os dois que reprovavam desde antes deste plano:

- `UX: busca, link, noite, minimapa` — a transição de noite parava em `t=0,38` e a
  exposição em 0,818 contra um piso de 0,45. Não era o renderizador: em Chrome headless o
  rAF para depois dos primeiros quadros, e a sonda esperava tempo de parede para uma
  transição que anda por relógio. Com relógio vivo: `t=1`, exposição 0,40, em 3 quadros.
- `ficha e 'o que tem por perto'` — a sonda disparava `mousedown` puro, que era o evento
  certo no v15; o galho v16 trocou para `click` **antes** da modularização, e ela virou
  teste de caminho morto. O código de acender o pino sempre esteve certo.

**Nenhum limite de portão foi afrouxado** em nenhum dos dois.

## Testes

| suíte | contagem | comando |
|---|---|---|
| Node (equivalência dos módulos contra o monólito) | **111** | `npm test` |
| Python (build, caminhos canônicos, publicação) | **36** | `npm run test:py` |

Os oráculos comparam cada módulo extraído contra o `app.js` do commit imediatamente
anterior à extração, rodando os dois em contextos `vm` com os mesmos stubs.

## Aparência

`sombra_projetada` **promovida** em São Carlos. Aceite por foto com controle primeiro: duas
capturas do mesmo arquivo voltaram **100,00% idênticas, delta max 0** — piso de ruído zero.
Com a chave: 824 malhas passam a projetar onde nenhuma projetava, `sombra%` 33,2 (piso 12),
`escuro%` 8,70 → 12,85 (piso 8), e **486 chamadas de desenho e 7.920.280 triângulos nos dois
lados** — custo zero.

`especular_fragmento` portada e **deliberadamente não promovida**: o ganho dela só aparece
em telhado visto de cima (+2,68 de luminância média ali, 0,11 no quadro de rua) e o sol
baixo da sombra o apaga.

## Não medido

Estas coisas não foram medidas e **não contam como aprovadas**:

- ~~Publicação real~~ — **feita e medida** (acima).
- **Desempenho em GPU real** — todas as medidas de hoje saíram do rasterizador de software
  do Chrome headless, onde o quadro leva ~750 ms. Draw call e triângulo são comparáveis
  (não dependem da GPU); tempo de quadro não é.
- **As outras cidades** — fora de escopo por decisão, não por esquecimento.
- **`renderizador-v16/`** — não arquivado. Medido: **não é subconjunto** do v16-moveis
  (96 linhas só nele). Pelo conteúdo são versões antigas de coisas reescritas, não
  capacidades ausentes, mas classificar linha a linha é trabalho que não se fez. A pasta
  está inerte (sem consumidor), então fica.
- **`renderizador/` (v15)** — não pode ser arquivado: é o `V_PADRAO`, e todo comando sem
  `--variante` monta ele.
