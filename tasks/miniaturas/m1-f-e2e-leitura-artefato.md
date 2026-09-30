# M1-F — E2E controlado da leitura até o artefato navegável

Prova, sem Firestore de produção, BuildJob, Blender, Hosting ou publicação:

```
snapshot fixado → hash conferido → M1-0 → M1-A → contexto explícito → consumidor 3D real → artefato local
```

Comando: `python -m pipeline.e2e_leitura ENTRADA.json CONTEXTO.json --destino PASTA`
([e2e_leitura.py](../../pipeline/e2e_leitura.py)). Stdout: relatório (0) ou
`{valid: false, errors}` (2), no formato do M1-0. Falha interna (página ou sonda) sai 1.

## Qual consumidor, e por quê

O consumidor de planta é a **maquete LEVE**
([pagina_maquete.py](../../v1.5/miniaturas/pagina_maquete.py), modo `leve`). Ela monta a
unidade com `FloorPlan.plantaDaUnidade`
([floor-plan.js](../../v1.5/renderizador-v16-moveis/interior/floor-plan.js)), o mesmo módulo
do interior do mapa, e dali saem a planta 2D, a planta 3D e a visita em primeira pessoa.

- `pipeline/fonte_leve.py` **não** consome planta: projeta o prédio a partir de
  `plantas_fornecidas/<id>/unidade.json` (`lote.predio`) para o Blender. Rodar
  `fabrica_miniaturas.py` provaria uma maquete de prédio, não a planta capturada. Não foi
  usado nem alterado.
- O tour (`pipeline/imovel.py`, o mapa recortado) exige lote georreferenciado; a planta
  sintética não tem lote real e inventar um seria fabricar contexto. Fica fora; o módulo de
  planta dele é o mesmo `floor-plan.js`.

## F0 — entrada

`ENTRADA` é o par que o M1-E fixa, no formato em que o M2 vai lê-lo do Firestore:

```
{schema: 1,
 pedido:   {id, agencyId, propertyId, productionInput: {readingId, readingVersion,
            readingRevision, schemaVersion, contentSha256, ...}},
 snapshot: {id, propertyId, agencyId, version, revision, schemaVersion, contentSha256,
            leitura, ...}}
```

Recusa, antes de qualquer outra coisa: ponteiro que não repete o snapshot campo a campo
(`PONTEIRO_DIVERGENTE`), snapshot de outro imóvel/agência (`VINCULO_DIVERGENTE`) e
`sha256(serializar(leitura))` diferente do persistido (`CONTEUDO_ADULTERADO`). Nenhum hash
de fora é aceito sem recálculo. Depois o M1-A (`normalizar`, que valida no M1-0 primeiro;
erros M1-0 passam intactos) e a conferência de que `source` da planta derivada é a leitura
fixada (id, revisão, hash).

## F1 — contexto explícito

`CONTEXTO` ([exemplo sintético](../../tests/fixtures/m1f/contexto-sintetico.json)) é o que
não pertence ao capturador: `propertyId`, `agencyId`, `andar`, `ficha` (valores simples),
`cores` (#RRGGBB) e `lote.predio` (`largura_m`, `profundidade_m`, `pavimentos`). Lista
fechada: planta ou qualquer chave de geometria no contexto é `CONTEXTO_INVALIDO`; contexto de
outro imóvel/agência é `CONTEXTO_DE_OUTRO_IMOVEL`. Nenhum campo é deduzido da planta (a
ficha sem área útil mostra "? m²" em vez de uma área calculada). A planta tem de caber no
prédio do jeito que o consumidor a assenta (x no eixo maior, casca recuada 0,25 m):
`CONTEXTO_NAO_COMPORTA`.

A unidade que a página recebe é a planta derivada (`pe_direito`, `comodos`, `portas`,
`janelas`, com ids e procedência) mais o contexto, e `planta.entrada`: o vínculo
(`readingId`, versão, revisão, schema, hash, `nominal-floor-plan@1.0.0`) viaja **dentro** do
artefato. Nada é escrito em `plantas_fornecidas/`: a unidade existe só na pasta da execução.

## Injeção no consumidor

`pagina_maquete.py --cadastro <unidade.json> --modo leve` troca a varredura do acervo por
uma unidade explícita. Ela entra com `_id` nulo, e esse é o único interruptor: tudo que a
página busca **pelo id** (modelo Blender do perfil LEVE, atlas do Unreal, editor e
enquadramento do Cedros/Castanheiras) fica desligado para ela. O prédio vem só do
`lote.predio` do documento. `--cadastro` exige `--modo leve` e exclui `--unidade`. O caminho
do acervo não mudou: Colinas, Castanheiras, Sanca e o exemplo embutido saem byte a byte iguais
antes e depois.

## F5 — o que bloqueia antes da página

Além do M1-0, o que o M1-0 aceita mas o consumidor aproximaria calado:

| Código | Regra do consumidor |
|---|---|
| `FORA_DA_GRADE` | `paredesDaGrade` rasteriza em 5 cm a partir do menor x/y: todo x/y de cômodo relativo a esse canto, e toda largura/profundidade, múltiplos de 50 mm |
| `VAO_ESTREITO` | `decideVao` descarta vão com menos de 20 cm |

Toda recusa (F0, F1, F5) acontece antes de gerar a página; os testes provam isso trocando o
gerador por um que falha se for chamado.

## F2 — conferência geométrica

[`tools/sonda-maquete.mjs`](../../tools/sonda-maquete.mjs) roda, em Node, os blocos
`MapGeometry`, `Openings` e `FloorPlan` **embutidos no próprio artefato**, com o mesmo `rec`
e as mesmas opções que a página monta. Esse trecho da página é conferido pelo texto: se
mudar, a sonda para em vez de medir outra coisa. Ela devolve o que o consumidor montou no
referencial da planta (sem a rotação do prédio).

A conferência exige, com tolerância de 1 µm: os mesmos cômodos (nome e polígono); as mesmas
aberturas (porta/janela, centro, largura, peitoril e topo), nenhuma a mais nem a menos; o
mesmo pé-direito; e o vínculo `planta.entrada` igual ao ponteiro. Qualquer divergência é
`GEOMETRIA_DIVERGENTE` e o artefato é descartado.

As paredes são derivadas pelo consumidor e entram na identidade da geometria, mas não são
comparadas uma a uma com a leitura. O tipo de esquadria (`giro`, `vao`, `correr`, `fixa`) é
inferido pelo consumidor e não vem da leitura.

## F3/F4 — artefato e relatório

Na pasta de destino (nova ou vazia): `maquete.html` (LF canônico, como o `build_imovel`),
`unidade.json` (o que a página consumiu) e `relatorio.json`:

| Chave | Conteúdo |
|---|---|
| `entrada` | pedido, imóvel, agência, `readingId`, `readingVersion`, `readingRevision`, `schemaVersion`, `contentSha256` |
| `normalizador` | `nominal-floor-plan` 1.0.0 e as transformações |
| `planta.sha256` | identidade da planta derivada |
| `contexto.sha256` | identidade do contexto |
| `consumidor` | página e sha256 do `FloorPlan` embutido |
| `geometria` | contagens, pé-direito, `conferida` e sha256 do que o consumidor montou |
| `artefato` | bytes, sha256 e id (12 primeiros) do `maquete.html` |

Sem data nem caminho: as mesmas entradas dão os mesmos bytes. A geometria tem identidade
própria, separada da do artefato:

- leitura nova (janela 20 cm adiante, revisão 2) muda entrada, planta, geometria e artefato,
  e a sonda mostra exatamente essa janela deslocada 0,20 m;
- só dado comercial (preço) muda contexto e artefato, mas não entrada, planta nem geometria,
  e a planta embutida sai byte a byte igual;
- prédio girado (eixo maior em z) assenta a mesma planta: mesma geometria, outro artefato.

## Limites e continuidade

- Caso controlado único: `tests/fixtures/leitura/v1/exemplo-geometrico.json` (8 cômodos,
  7 portas compartilhadas, 4 janelas). Cedros/Mirante e o acervo não foram tocados.
- Sem mobília: móvel não é da leitura. Visita e seus gestos são os da maquete atual;
  usabilidade é M1.1.
- O M2 terá de produzir a `ENTRADA` a partir do Firestore (a forma está no teste
  `painel/tests/e2e_leitura.test.mjs`) e o `CONTEXTO` a partir do imóvel; `--cadastro` é a
  fronteira do consumidor.

Evidências: [checkpoint](../checkpoints/m1-f-2026-09-30.md).
