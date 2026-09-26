# Checkpoint de estabilização — 26/09/2026

Retrato conferido no fim da fase de estabilização. Cada número abaixo foi lido de volta de
produção ou medido no próprio `main`, e nada vem de memória. É um registro datado: o estado
vigente continua sendo o de [DOCUMENTACAO.md](../../DOCUMENTACAO.md) e da
[proposta, §14](../painel/proposta.md).

## Referência

- **`main` = `43d8cb10d7ac0fe7c74e980eb4220f1554b5ee00`** (merge do PR #29).
- **O código no ar é o de `main`.** Painel, regras e índices foram publicados a partir de `3afc464`,
  e de `3afc464` até `43d8cb1` só mudaram arquivos `.md` (PRs #26 a #29).

## O que a fase entregou

| PR | Entrega |
|---|---|
| #14–#16 | Identidade exata do artefato na aprovação e no registro (build + manifest), relida no clique que grava |
| #17, #18, #20 | Site de imóveis configurado no painel; layout dos cartões de comando |
| #19, #27 | Estado de produção e o primeiro ciclo real registrados na proposta |
| #21 | A área total nunca sai como "Área útil" na maquete |
| #22 | CI: os gates rodam em todo PR e em todo push em `main` |
| #23 | Listas paginadas (limite crescente de 50), filtros no servidor, Kanban por coluna com `count()` |
| #24 | Nomes por id (sem ler coleções inteiras) e Início da imobiliária com `count()` |
| #25 | O aceite consome o convite (`invites/` = pendentes, garantido pelas regras) e usuários paginados |
| #26 | Decisão adiada da busca de imóvel nos seletores (D11) |
| #28, #29 | Índice da documentação, registros históricos marcados e backlog v1.0 reconciliado |

## Produção (lida de volta em 26/09)

| Peça | Estado |
|---|---|
| Regras do Firestore | ruleset `d965b18a-49dc-490a-8fe8-9b9073038373`, sha256 `f9764b07…`, igual byte a byte a `main`. Rollback: `bb95ee6b` (`5e46af7`) |
| Índices | 12 compostos, todos `READY`, iguais a `firebase/firestore.indexes.json`, sem overrides |
| Painel | `imobilaria-deccb-painel`, versão `ef9c4d811735cfb8` (de `3afc464`) |
| Site de imóveis | `imobilaria-deccb-imoveis`, versão `56630f63b23116cc`. Cedros no ar: build `215965d37d7d`, manifest `c2b2a242…`, sem anterior |
| Mapa e miniaturas | `imobilaria-deccb` `1855179e3c93c2eb` e `imobilaria-deccb-miniaturas` `2769c1c05b7090a4`, sem mudança nesta fase |
| Dados | 1 imobiliária, 2 usuários, 0 convites, 1 imóvel, 1 pedido publicado, 1 publicação, 6 AuditLogs |

## Gates

| Gate | Local, em `43d8cb1` | CI |
|---|---|---|
| `npm test` | 122/122 | verde |
| `npm run test:py` | 70/70 | verde |
| `npm run test:painel` (emulador) | 30/30 | verde |
| `npm run test:regras` (emulador) | 28/28 | verde |
| `tsc --noEmit` do painel | limpo | verde |
| build do painel | 18 rotas; bundle sem exemplo, seed, emulador ou credencial | verde |

O CI passou nos três últimos pushes em `main` (`2daf41f`, `7f05ed1`, `43d8cb1`).

## Pendências deliberadas

Nenhuma é esquecimento: cada uma tem o motivo e o gatilho que a destrava.

| Pendência | Por que ficou | Gatilho |
|---|---|---|
| Busca de imóvel nos seletores (D11) | O `<select>` resolve com a carteira de hoje | Uma imobiliária com algumas dezenas de imóveis |
| Reversão exercitada em produção | Testada no emulador; o live só tem um build | Um segundo build **legítimo** de algum imóvel (não fabricar) |
| Storage | O bucket não existe | Plano do Storage confirmado (T03) |
| Convite para e-mail que já tem conta | Fica pendente e não pode ser aceito; aparece e pode ser cancelado | Barrar na criação do convite |
| Nome por id com erro de rede | Vira "?" até recarregar (evita laço de novas tentativas) | Aparecer em uso real |
| Contadores do Kanban e do Início | `count()` recalculado por gatilho, não ao vivo | Aparecer número atrasado em uso real |
| 404 de `__next.*.__PAGE__.txt` | Formato do export do Next 16; o fallback carrega a rota | Atualização do Next ou decisão de reescrever |
| Janela entre a leitura HTTP e o commit no registro | Cliente web não torna Hosting + Firestore atômicos | Fase 2: BuildJob no servidor |
| Canal de preview do Cedros | Expira em **25/10/2026**; o live não depende dele | Renovar só se for preciso revisar de novo |
| Publicação do mapa por hash, com troca atômica (T04) | O mapa confere os tiles, mas é nomeado pela versão | O mapa voltar a ser publicado com frequência |
| Backlog v1.0: T05–T15 | Abertos; ver o [todo.md](../v1.0/todo.md) reconciliado | Priorização |

## Próximos trilhos

1. **Backlog do produto (v1.0):** T05 em diante, na ordem do [todo.md](../v1.0/todo.md).
2. **Fase 2 da publicação:** um BuildJob no servidor coordena geração, preview, promoção e registro;
   o painel continua com a aprovação e a rastreabilidade.
3. **Engine V2 e móveis fabricáveis:** trilho separado, sem misturar com esta base estabilizada.
4. **Item C (D11):** quando o gatilho acontecer, com a direção já decidida.
